#!/usr/bin/env node
// ============================================================
// Reporte de Flota — Budget Perú (versión GitHub Actions)
// - Extrae la flota de la intranet usando agent-browser
// - Genera public/flota_data.json (snapshot JSON; la app React se sirve
//   desde el index.html raíz, así que aquí NO se genera public/index.html)
// - Envía la flota completa por Telegram (si hay token configurado)
// - El workflow (flota.yml) envía public/flota_data.json al panel (Convex)
//   vía el endpoint /ingest-flota
//
// Credenciales: variables de entorno (GitHub Secrets):
//   BUDGET_USER, BUDGET_PASS, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
// (o config.json local, que NO se sube a GitHub)
//
// Uso:
//   node extraer_flota.cjs            → extrae + genera + envía Telegram
//   node extraer_flota.cjs --mensaje  → prueba el mensaje de Telegram sin enviar
//
// Nota: usa la extensión .cjs porque package.json declara "type": "module"
// y este script usa require() (CommonJS).
// ============================================================
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NODE_DIR = path.dirname(process.execPath);
process.env.PATH = NODE_DIR + path.delimiter + (process.env.PATH || '');

const DIR = __dirname;
const PUBLIC = path.join(DIR, 'public');

const config = { usuario: '', password: '' };
try {
  Object.assign(config, JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')));
} catch (e) { /* sin config local: se usan las variables de entorno */ }

const USUARIO = process.env.BUDGET_USER || config.usuario;
const PASSWORD = process.env.BUDGET_PASS || config.password;

// Modo descubrimiento: activado con DISCOVERY=true (workflow manual) o --descubrir.
// Vuelca las páginas de la intranet relacionadas con taller/movimientos para
// localizar los datos de entradas y salidas de taller.
const DISCOVERY = process.env.DISCOVERY === 'true' || process.argv.includes('--descubrir');
const URL_LOGIN = 'https://intranet.budgetperu.com/hiker/auth/login';
const URL_FLOTA = 'https://intranet.budgetperu.com/hiker/ControlCar/flota';
// Lista de movimientos de taller (entradas/salidas) — módulo inAndOut.
// Descubierto en la exploración: GET inAndOut/list responde 200 con una tabla.
const URL_INOUT_LIST = 'https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/list';

function ab(args, timeoutMs = 40000) {
  try {
    let out;
    if (process.platform === 'win32') {
      // Windows: agent-browser es un .cmd y no se lanza directo (EINVAL).
      // Se usa shell — aquí '#' NO es comentario, por eso no daba error.
      out = execSync('agent-browser ' + args.join(' '), { shell: true, encoding: 'utf8', timeout: timeoutMs });
    } else {
      // Linux (GitHub Actions): sin shell → el '#' de #identity no se come el resto
      // del comando (bug de bash) y el login funciona.
      out = execFileSync('agent-browser', args, { encoding: 'utf8', timeout: timeoutMs });
    }
    return out.trim();
  } catch (e) {
    const msg = (e.stderr ? e.stderr.toString() : '') || String(e.message || e);
    return '__ERR__' + msg.split('\n')[0];
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pollUrl(needle, timeoutMs = 60000) {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < timeoutMs) {
    last = ab(['get', 'url'], 15000);
    if (last && !last.startsWith('__ERR__') && last.toLowerCase().includes(needle.toLowerCase())) return last;
    await sleep(2000);
  }
  throw new Error('Timeout esperando URL "' + needle + '" (última: ' + last + ')');
}

// Columnas de la tabla (encabezados): ['', 'Unid.', 'Ubic.', 'RA', 'KM', 'Fuel', 'Estado', 'Rev.']
// → unidad=td[1], select de ubicación en td[2], ra=td[3], km=td[4], fuel=td[5], estado=td[6].
const EXTRACT_JS =
  "JSON.stringify([...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')].map(function(tr){var tds=tr.querySelectorAll('td');var sel=tr.querySelector('select');return {unidad:(tds[1]?tds[1].innerText:'').trim(),ubic:sel?sel.value:'',ra:(tds[3]?tds[3].innerText:'').trim(),km:(tds[4]?tds[4].innerText:'').trim(),fuel:(tds[5]?tds[5].innerText:'').trim(),estado:(tds[6]?tds[6].innerText:'').trim()}}))";

// Extracción defensiva de la tabla de movimientos (inAndOut/list). Mapea columnas
// por encabezado (unidad/fecha/tipo/reporte). Sin literales de regex ni arrow
// functions: agent-browser@0.34.0 falla con regex y prefiere ES5.
// Incluye diagnóstico (URL, texto, enlaces, nº de tablas/iframes) para cuando la
// página no trae tabla: así el log del workflow muestra qué hay realmente.
const EXTRACT_MOV_JS =
  "(function(){var sp=function(s){return (s||'').trim()};var out={ok:false,why:'sin tabla',headers:[],rows:[],url:'',body:'',links:[],nTablas:0,nIframes:0,nSelects:0,nInputs:0};out.url=location.href;var tables=document.querySelectorAll('table');out.nTablas=tables.length;out.nIframes=document.querySelectorAll('iframe').length;out.nSelects=document.querySelectorAll('select').length;out.nInputs=document.querySelectorAll('input').length;var anchors=document.querySelectorAll('a');for(var i=0;i<anchors.length;i++){var h=anchors[i].getAttribute('href')||'';if(h.indexOf('/hiker/')>=0)out.links.push(h+' => '+sp(anchors[i].innerText).slice(0,40));}var body=document.body;if(body)out.body=sp(body.innerText).slice(0,1500);if(!tables||tables.length===0)return JSON.stringify(out);var t=tables[0];out.why='sin filas';var rows=t.querySelectorAll('tbody tr');if(!rows||rows.length===0)return JSON.stringify(out);var thead=t.querySelector('thead');var headers=[];if(thead){var ths=thead.querySelectorAll('th,td');for(var i=0;i<ths.length;i++)headers.push(sp(ths[i].innerText));}out.headers=headers;var idxU=-1,idxF=-1,idxT=-1,idxR=-1;for(var i=0;i<headers.length;i++){var h=headers[i].toLowerCase();if(idxU<0&&h.indexOf('unid')>=0)idxU=i;if(idxF<0&&(h.indexOf('fecha')>=0||h.indexOf('date')>=0))idxF=i;if(idxT<0&&(h.indexOf('tipo')>=0||h.indexOf('mov')>=0||h.indexOf('modalidad')>=0||h.indexOf('ingreso')>=0||h.indexOf('salida')>=0))idxT=i;if(idxR<0&&(h.indexOf('report')>=0||h.indexOf('ra')>=0||h.indexOf('doc')>=0||h.indexOf('codigo')>=0))idxR=i;}var out2=[];for(var i=0;i<rows.length;i++){var tds=rows[i].querySelectorAll('td');if(tds.length===0)continue;var row={};if(idxU>=0)row.unidad=sp(tds[idxU].innerText);else if(tds.length>=1)row.unidad=sp(tds[0].innerText);if(idxF>=0)row.fecha=sp(tds[idxF].innerText);if(idxT>=0)row.tipo=sp(tds[idxT].innerText);if(idxR>=0)row.reportId=sp(tds[idxR].innerText);out2.push(row);}out.ok=out2.length>0;out.why=out.ok?'ok':(out2.length===0?'filas vacías':'sin mapeo');out.rows=out2.slice(0,1500);return JSON.stringify(out)})()";

const fmtKm = v => (+v).toLocaleString('es-PE');

// ---------- Mensaje de Telegram ----------
function buildMensaje(unidades, fecha) {
  const grupos = {};
  unidades.forEach(u => { (grupos[u.ubic] = grupos[u.ubic] || []).push(u); });
  const ordenUbic = Object.keys(grupos).sort();
  const lineas = ['🚗 FLOTA BUDGET — ' + fecha, ''];
  ordenUbic.forEach(ubic => {
    const g = grupos[ubic];
    lineas.push('📍 PARQUEO ' + ubic + ' (' + g.length + ' autos)');
    g.forEach(u => {
      const limpio = /limpio/i.test(u.estado) ? '✅' : '🧼';
      lineas.push('▸ ' + u.unidad + ' · ' + fmtKm(u.km) + ' km · ' + u.fuel + ' · ' + limpio + ' ' + u.estado);
    });
    lineas.push('');
  });
  const limpias = unidades.filter(u => /limpio/i.test(u.estado)).length;
  const tanqueo = unidades.filter(u => !/full/i.test(u.fuel)).length;
  lineas.push('✅ ' + limpias + ' limpias · 🧼 ' + (unidades.length - limpias) + ' sucias · ⛽ ' + tanqueo + ' por tanquear');
  return lineas.join('\n');
}

function dividirMensaje(texto, max = 4000) {
  if (texto.length <= max) return [texto];
  const partes = [];
  let resto = texto;
  while (resto.length > max) {
    let corte = resto.lastIndexOf('\n', max);
    if (corte < 1) corte = max;
    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  partes.push(resto);
  return partes;
}

async function enviarTelegram(texto) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('ℹ️  Telegram no configurado (faltan TELEGRAM_TOKEN / TELEGRAM_CHAT_ID) — no se envió mensaje.');
    return;
  }
  for (const parte of dividirMensaje(texto)) {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: parte }),
    });
    if (!res.ok) throw new Error('Telegram respondió ' + res.status + ': ' + (await res.text()).slice(0, 200));
  }
  console.log('✅ Mensaje de Telegram enviado (' + dividirMensaje(texto).length + ' parte(s)).');
}

// ---------- Extracción ----------
async function extraerFlota() {
  console.log('[1/5] Lanzando navegador (agent-browser)...');
  ab(['open'], 30000);
  await sleep(2500);

  console.log('[2/5] Navegando al portal...');
  ab(['eval', "location.href='" + URL_LOGIN + "'"], 20000);
  await sleep(4000);
  let url = ab(['get', 'url'], 15000);
  console.log('    URL actual: ' + url);

  if (url.toLowerCase().includes('/hiker/auth/login')) {
    console.log('[3/5] Iniciando sesión...');
    await pollUrl('/hiker/auth/login', 60000);
    ab(['fill', '#identity', String(USUARIO)], 20000);
    ab(['fill', '#password', String(PASSWORD)], 20000);
    ab(['eval', "document.querySelector('form').requestSubmit()"], 20000);
    await sleep(4000);
    url = ab(['get', 'url'], 15000);
    if (!url.toLowerCase().includes('/hiker/control')) {
      ab(['eval', "document.querySelector('form').submit()"], 20000);
      await sleep(4000);
    }
    url = await pollUrl('/hiker/control', 90000);
    console.log('    ✅ Login OK → ' + url);
  } else if (url.toLowerCase().includes('/hiker/control')) {
    console.log('[3/5] ✅ Sesión activa → ' + url);
  }

  console.log('[4/5] Abriendo sección Flota...');
  ab(['eval', "location.href='" + URL_FLOTA + "'"], 20000);
  await sleep(4000);
  await pollUrl('/flota', 60000);

  console.log('[5/5] Extrayendo datos...');
  const raw = ab(['eval', EXTRACT_JS], 30000);
  if (raw.startsWith('__ERR__')) throw new Error('Error extrayendo: ' + raw);
  let unidades = JSON.parse(raw);
  if (typeof unidades === 'string') unidades = JSON.parse(unidades);
  if (!Array.isArray(unidades) || unidades.length === 0) throw new Error('Sin unidades en la respuesta');
  return unidades;
}

// ---------- Descubrimiento (modo --descubrir) ----------
async function descubrirEnlaces() {
  console.log('    [--descubrir] Volcando página: ' + ab(['get', 'url'], 15000));
  // Nota: agent-browser devuelve el JSON de string con comillas extra → doble parse.
  // Sin literales de regex: algunas versiones de agent-browser eval fallan con
  // "Invalid regular expression: missing /". Todo con indexOf y split/join.
  const js = `(function(){var sp=function(ss){return (ss||'').split(' ').filter(function(x){return x!==''}).join(' ')};var terms=['taller','movimiento','mantenimiento','salida','retorno','reporte','ingreso','vehiculo','historial'];var hasTerm=function(txt){var low=(txt||'').toLowerCase();for(var i=0;i<terms.length;i++){if(low.indexOf(terms[i])>=0)return true;}return false;};var out={links:[],text:'',table:'',menciones:[],items:{},scripts:[],inputs:[]};document.querySelectorAll('a').forEach(function(a){var h=a.getAttribute('href')||'';if(h.indexOf('/hiker/')>=0)out.links.push(h+'  =>  '+sp(a.innerText).slice(0,60))});var body=document.body;if(body)out.text=sp(body.innerText).slice(0,2000);var t=document.querySelector('table');if(t)out.table=t.outerHTML.slice(0,4500);var all=document.querySelectorAll('*');var n=0;for(var i=0;i<all.length&&n<30;i++){var el=all[i];var txt=sp(el.innerText);if(hasTerm(txt)&&txt.length<60){out.menciones.push(el.tagName+': '+txt.slice(0,60));n++;}}['Ingreso','Salida','Buscar RA','Flota'].forEach(function(term){var found=null;for(var i=0;i<all.length;i++){var el=all[i];var t=(el.childNodes.length===1&&el.childNodes[0].nodeType===3)?el.textContent.trim():'';if(t===term){found=el;break;}}if(found){var chain=[];var cur=found;for(var k=0;k<5&&cur;k++){chain.push(cur.outerHTML.slice(0,260));cur=cur.parentElement;}out.items[term]=chain.join(' || ');}});document.querySelectorAll('script:not([src])').forEach(function(s){var c=(s.textContent||'');if(c.indexOf('ajax')>=0||c.indexOf('fetch')>=0||c.indexOf('/hiker/')>=0)out.scripts.push(sp(c).slice(0,600));});document.querySelectorAll('input,select,button').forEach(function(el){out.inputs.push(el.outerHTML.slice(0,200));});return JSON.stringify(out)})()`;
  // Nota: agent-browser eval solo acepta expresiones simples; el JS complejo
  // debe ir en base64 con el flag -b. Además, se evitan literales de regex
  // (algunas versiones de agent-browser fallan con "missing /").
  const b64 = Buffer.from(js).toString('base64');
  const raw = ab(['eval', '-b', b64], 30000);
  if (raw.startsWith('__ERR__')) {
    console.log('    [--descubrir] Error evaluando: ' + raw.slice(0, 300));
    return;
  }
  let d;
  try {
    d = JSON.parse(raw);
    if (typeof d === 'string') d = JSON.parse(d);
  } catch (e) {
    console.log('    [--descubrir] No se pudo parsear: ' + raw.slice(0, 600));
    return;
  }
  d.links.forEach(l => console.log('    LINK ' + l));
  console.log('    BODY_TEXT: ' + d.text.replace(/\n/g, ' \\n '));
  if (d.table) console.log('    TABLE_HTML: ' + d.table.slice(0, 4200));
  d.menciones.forEach(m => console.log('    MENCION ' + m));
  Object.keys(d.items).forEach(k => console.log('    ITEM[' + k + ']: ' + d.items[k]));
  d.scripts.forEach(s => console.log('    SCRIPT_AJAX: ' + s));
  d.inputs.forEach(i => console.log('    INPUT: ' + i));
}

// ---------- Movimientos de taller (inAndOut/list) ----------
async function extraerMovimientos() {
  console.log('    [taller] Abriendo lista de movimientos (inAndOut/list)...');
  ab(['eval', "location.href='" + URL_INOUT_LIST + "'"], 20000);
  await sleep(4500);
  const raw = ab(['eval', EXTRACT_MOV_JS], 30000);
  if (raw.startsWith('__ERR__')) {
    console.log('    [taller] ⚠️ No se pudo evaluar la página: ' + raw.slice(0, 160));
    return [];
  }
  let d;
  try {
    d = JSON.parse(raw);
    if (typeof d === 'string') d = JSON.parse(d);
  } catch (e) {
    console.log('    [taller] ⚠️ No se pudo parsear la respuesta: ' + raw.slice(0, 300));
    return [];
  }
  if (!d || !d.ok) {
    console.log('    [taller] ⚠️ Sin movimientos (' + (d && d.why ? d.why : 'respuesta vacía') + '). Cabeceras: ' + JSON.stringify((d && d.headers) || []));
    // Diagnóstico: qué contiene realmente la página de inAndOut/list.
    if (d) {
      console.log('    [taller] URL: ' + d.url + ' | tablas: ' + d.nTablas + ' | iframes: ' + d.nIframes + ' | selects: ' + d.nSelects + ' | inputs: ' + d.nInputs);
      if (d.links && d.links.length) d.links.slice(0, 20).forEach(l => console.log('    [taller] LINK ' + l));
      if (d.body) console.log('    [taller] BODY: ' + d.body.replace(/\n/g, ' | ').slice(0, 1200));
    }
    return [];
  }
  const movimientos = d.rows
    .map(r => ({
      unidad: String(r.unidad || '').trim(),
      fecha: String(r.fecha || '').trim(),
      tipo: String(r.tipo || '').trim(),
      reportId: r.reportId ? String(r.reportId).trim() : undefined,
    }))
    .filter(m => m.unidad && m.tipo);
  console.log('    [taller] ✅ ' + movimientos.length + ' movimientos extraídos (' + d.headers.join(' | ') + ')');
  return movimientos;
}

// ---------- Snapshot JSON ----------
function generarReporte(unidades, fecha, movimientos) {
  fs.mkdirSync(PUBLIC, { recursive: true });
  // Solo el JSON: NO se genera public/index.html porque la app React usa el
  // index.html raíz y public/index.html la pisotearía en dev y en build.
  const snapshot = { fecha, unidades };
  if (movimientos && movimientos.length > 0) snapshot.movimientos = movimientos;
  fs.writeFileSync(path.join(PUBLIC, 'flota_data.json'), JSON.stringify(snapshot, null, 2));
  console.log('    📄 Snapshot guardado en public/flota_data.json (' + unidades.length + ' unidades, ' + (movimientos ? movimientos.length : 0) + ' movimientos)');
}

// ---------- Main ----------
async function main() {
  const soloMensaje = process.argv.includes('--mensaje');
  console.log('[DISCOVERY] env=' + process.env.DISCOVERY + ' → modo descubrimiento ' + (DISCOVERY ? 'ON' : 'off'));

  let unidades;
  let fecha;
  let movimientos = [];
  if (soloMensaje) {
    const json = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'flota_data.json'), 'utf8'));
    unidades = json.unidades;
    fecha = json.fecha;
    movimientos = json.movimientos || [];
    console.log('Modo prueba de mensaje (sin enviar). Datos de: ' + fecha);
  } else {
    if (!USUARIO || !PASSWORD) throw new Error('Faltan credenciales (BUDGET_USER/BUDGET_PASS o config.json)');
    unidades = await extraerFlota();
    // GitHub Actions corre en UTC; forzamos la zona horaria de Lima para que la
    // fecha del reporte coincida con la hora local de Perú (UTC-5).
    fecha = new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    // Movimientos de taller: opcionales — un fallo aquí no rompe el reporte.
    try {
      movimientos = await extraerMovimientos();
    } catch (e) {
      console.log('    [taller] ⚠️ No se pudieron extraer movimientos: ' + e.message);
      movimientos = [];
    }

    // Verificaciones
    let fallos = 0;
    const check = (c, m) => { console.log((c ? '   [PASS] ' : '   [FAIL] ') + m); if (!c) fallos++; };
    const total = unidades.length;
    const limpias = unidades.filter(u => /limpio/i.test(u.estado)).length;
    const sucias = unidades.filter(u => /sucio/i.test(u.estado)).length;
    check(unidades.every(u => u.unidad && u.km), 'Todas las filas tienen unidad y KM');
    check(limpias + sucias === total, 'Limpio + Sucio = total (' + limpias + ' + ' + sucias + ' = ' + total + ')');
    check(unidades.every(u => /^(E1|E7|E12)$/.test(u.ubic)), 'Ubicaciones válidas (E1/E7/E12)');
    if (fallos > 0) throw new Error(fallos + ' verificación(es) fallaron');
    if (movimientos.length > 0) {
      const salidas = movimientos.filter(m => m.tipo.toLowerCase().indexOf('salida') >= 0).length;
      const retornos = movimientos.filter(m => m.tipo.toLowerCase().indexOf('retorno') >= 0).length;
      console.log('    [taller] Resumen: ' + salidas + ' salidas · ' + retornos + ' retornos · ' + (movimientos.length - salidas - retornos) + ' otros');
    }
    console.log('    ✅ Verificaciones OK — ' + total + ' unidades');

    generarReporte(unidades, fecha, movimientos);

    if (DISCOVERY) {
      console.log('[--descubrir] Explorando páginas de la intranet...');
      const b64 = js => Buffer.from(js).toString('base64');
      const ev = (js, t = 25000) => ab(['eval', '-b', b64(js)], t);

      // 1) Volcar todos los scripts (src y contenido) de la página ControlCar
      //    para encontrar endpoints AJAX de reportes/movimientos.
      const scripts = ev("JSON.stringify([...document.querySelectorAll('script')].map(function(s){var src=s.getAttribute('src')||'';return {src:src,body:(src?'':(s.textContent||'').slice(0,1400))}}).filter(function(x){return x.src||x.body}))");
      console.log('    [scripts] CONTROL_CAR: ' + (scripts.startsWith('__ERR__') ? scripts : scripts.slice(0, 5500)));

      // 2) Menú lateral completo (todos los ítems, no solo los que mencionan términos)
      const menu = ev("JSON.stringify([...document.querySelectorAll('.sidebar a, .sidenav a, .navbar-vertical a, aside a, nav a')].map(function(a){return {text:(a.innerText||'').trim().slice(0,40),href:a.getAttribute('href')||'',onclick:(a.getAttribute('onclick')||'').slice(0,100)}}))");
      console.log('    [menu] SIDEBAR: ' + (menu.startsWith('__ERR__') ? menu : menu.slice(0, 3000)));

      // 3) Fila completa de la tabla de flota (incluye columnas ocultas RA y Rev.)
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/flota'"], 20000);
      await sleep(4000);
      const fila = ev("var tr=document.querySelectorAll('table tbody tr')[0]; (tr?tr.outerHTML:'NO ROW').slice(0,2500)");
      console.log('    [flota] FILA_COMPLETA: ' + (fila.startsWith('__ERR__') ? fila : fila));

      // 4) Buscar RA: ver cómo envía el formulario y probar búsqueda por número de RA
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/buscarRa'"], 20000);
      await sleep(3500);
      const formRa = ev("var f=document.querySelector('form'); (f?f.outerHTML:'NO FORM').slice(0,1200)");
      console.log('    [buscarRa] FORM: ' + (formRa.startsWith('__ERR__') ? formRa : formRa));
      // Búsqueda por el número de RA que devolvió la búsqueda anterior (511102793)
      ev("document.getElementById('search').value='511102793'");
      await sleep(300);
      ev("(document.querySelector('button[type=submit]')||document.querySelector('form')).click()");
      await sleep(3500);
      const tablaPorRa = ev("var t=document.querySelectorAll('table')[0]; (t?t.innerText:'NO TABLA').slice(0,500)");
      console.log('    [buscarRa] BUSQUEDA_POR_RA: ' + (tablaPorRa.startsWith('__ERR__') ? tablaPorRa : tablaPorRa.replace(/\n/g, ' | ')));
      const linksPorRa = ev("JSON.stringify([...document.querySelectorAll('a')].map(function(a){return {text:(a.innerText||'').trim().slice(0,40),href:a.getAttribute('href')||''}}).filter(function(x){return x.href.indexOf('ControlCar')>=0&&x.href!==location.href}))");
      console.log('    [buscarRa] LINKS_POR_RA: ' + (linksPorRa.startsWith('__ERR__') ? linksPorRa : linksPorRa.slice(0, 1500)));

      // 5) Flota: ver TODAS las filas con su columna RA (¿alguna unidad tiene RA =
      //    taller activo?) y el modal de inspección completo.
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/flota'"], 20000);
      await sleep(4000);
      const filasRa = ev("JSON.stringify([...document.querySelectorAll('table tbody tr')].map(function(tr){var tds=tr.querySelectorAll('td');return {unidad:(tds[1]?tds[1].innerText:'').trim(),ra:(tds[3]?tds[3].innerText:'').trim(),km:(tds[4]?tds[4].innerText:'').trim(),estado:(tds[6]?tds[6].innerText:'').trim(),ccid:(tr.querySelector('[data-ccid]')||{getAttribute:function(){return ''}}).getAttribute('data-ccid')||''}}))");
      console.log('    [flota] TODAS_FILAS_RA: ' + (filasRa.startsWith('__ERR__') ? filasRa : filasRa.slice(0, 4000)));

      // 6) Buscar RA con búsqueda VACÍA: ¿lista todas las unidades con su último RA?
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/buscarRa'"], 20000);
      await sleep(3500);
      ev("(document.querySelector('button[type=submit]')||document.querySelector('form')).click()");
      await sleep(3500);
      const tablaVacia = ev("var t=document.querySelectorAll('table')[0]; (t?t.innerText:'NO TABLA').slice(0,1200)");
      console.log('    [buscarRa] BUSQUEDA_VACIA: ' + (tablaVacia.startsWith('__ERR__') ? tablaVacia : tablaVacia.replace(/\n/g, ' | ')));
      // Búsqueda por placa (CMO-371 = unidad 1063)
      ev("document.getElementById('search').value='CMO-371'");
      await sleep(300);
      ev("(document.querySelector('button[type=submit]')||document.querySelector('form')).click()");
      await sleep(3500);
      const tablaPlaca = ev("var t=document.querySelectorAll('table')[0]; (t?t.innerText:'NO TABLA').slice(0,500)");
      console.log('    [buscarRa] BUSQUEDA_POR_PLACA: ' + (tablaPlaca.startsWith('__ERR__') ? tablaPlaca : tablaPlaca.replace(/\n/g, ' | ')));

      // 7) Salida (inAndOut/0): form completo tras buscar una unidad (motivo,
      //    movimiento, conductor, acción del form) — SOLO LECTURA, sin guardar.
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/0'"], 20000);
      await sleep(4000);
      const formSalida = ev("var f=document.querySelector('form'); (f?f.outerHTML:'NO FORM').slice(0,6000)");
      console.log('    [salida] FORM_COMPLETO: ' + (formSalida.startsWith('__ERR__') ? formSalida : formSalida.slice(0, 6000)));
      // Ingreso (inAndOut/1): mismo dump
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/1'"], 20000);
      await sleep(4000);
      const formIngreso = ev("var f=document.querySelector('form'); (f?f.outerHTML:'NO FORM').slice(0,6000)");
      console.log('    [ingreso] FORM_COMPLETO: ' + (formIngreso.startsWith('__ERR__') ? formIngreso : formIngreso.slice(0, 6000)));

      // 8) Probar endpoints POST hermanos de validateExistence para movimientos
      //    (GET a movimientos dio 404; probar POST con unidad y cc_id).
      const posts = [
        ['movimientos', 'unidad=1063'],
        ['getMovimientos', 'unidad=1063'],
        ['listMovimientos', 'unidad=1063'],
        ['historial', 'unidad=1063'],
        ['movements', 'unidad=1063'],
        ['getMovimientosUnidad', 'unidad=1063'],
        ['inAndOut/list', 'unidad=1063'],
        ['reportes', 'unidad=1063'],
      ];
      for (const [ep, body] of posts) {
        const jsx = `(function(){try{var x=new XMLHttpRequest();x.open('POST','https://intranet.budgetperu.com/hiker/ControlCar/${ep}/',false);x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.setRequestHeader('X-Requested-With','XMLHttpRequest');x.setRequestHeader('X-CSRF-TOKEN',(document.querySelector('meta[name=csrf-token]')||{content:''}).content);x.send('${body}');return x.status+' :: '+(x.responseText||'').slice(0,200).replace(/\\s+/g,' ');}catch(e){return 'ERR '+e.message;}})()`;
        const r = ev(jsx);
        console.log('    [ep-post] ' + ep + ' → ' + (r.startsWith('__ERR__') ? r : r.slice(0, 300)));
      }

      // 9) inAndOut/list respondió 200 (no 404): volcar el BODY COMPLETO vía GET
      //    (¿lista de movimientos / historial de taller?)
      const listHtml = ev("(function(){try{var x=new XMLHttpRequest();x.open('GET','https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/list',false);x.setRequestHeader('X-Requested-With','XMLHttpRequest');x.send();return x.status+' :: '+(x.responseText||'').slice(0,6000);}catch(e){return 'ERR '+e.message;}})()");
      console.log('    [inAndOut-list] GET: ' + (listHtml.startsWith('__ERR__') ? listHtml : listHtml.slice(0, 6000)));
      // Variantes de la ruta de listado
      for (const u of [
        'https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/listado',
        'https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/historial',
        'https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/movimientos',
        'https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/history',
        'https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/lista',
      ]) {
        const jsx = `(function(){try{var x=new XMLHttpRequest();x.open('GET','${u}',false);x.setRequestHeader('X-Requested-With','XMLHttpRequest');x.send();return x.status+' :: '+(x.responseText||'').slice(0,300).replace(/\\s+/g,' ');}catch(e){return 'ERR '+e.message;}})()`;
        const r = ev(jsx);
        console.log('    [inout-get] ' + u + ' → ' + (r.startsWith('__ERR__') ? r : r.slice(0, 350)));
      }

      // 10) Buscar RA: tabla completa de la búsqueda vacía (¿todas las unidades con su RA?)
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/buscarRa'"], 20000);
      await sleep(3500);
      ev("document.getElementById('search').value=''");
      await sleep(300);
      ev("(document.querySelector('button[type=submit]')||document.querySelector('form')).click()");
      await sleep(3500);
      const tablaVaciaFull = ev("var t=document.querySelectorAll('table')[0]; (t?t.outerHTML:'NO TABLA').slice(0,8000)");
      console.log('    [buscarRa] TABLA_VACIA_COMPLETA: ' + (tablaVaciaFull.startsWith('__ERR__') ? tablaVaciaFull : tablaVaciaFull.slice(0, 8000)));
      const contarFilas = ev("var t=document.querySelectorAll('table')[0]; (t?t.querySelectorAll('tbody tr').length:'NO TABLA')");
      console.log('    [buscarRa] FILAS_BUSQUEDA_VACIA: ' + contarFilas);

      // 11) inAndOut: TODOS los scripts inline de la página (SPA con #modalidad
      //    según el segmento de la URL) — ahí están los endpoints AJAX.
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/0'"], 20000);
      await sleep(4000);
      const modalidad = ev("var m=document.getElementById('modalidad'); (m?m.value:'SIN MODALIDAD')");
      console.log('    [inAndOut/0] MODALIDAD: ' + modalidad);
      const scriptsInOut = ev("JSON.stringify([...document.querySelectorAll('script:not([src])')].map(function(s){var c=(s.textContent||'');return c.slice(0,6000)}).filter(function(c){return c.indexOf('ajax')>=0||c.indexOf('fetch')>=0||c.indexOf('$.post')>=0||c.indexOf('$.get')>=0||c.indexOf('url')>=0||c.indexOf('modalidad')>=0||c.indexOf('movimiento')>=0||c.indexOf('Guardar')>=0||c.indexOf('salida')>=0||c.indexOf('ingreso')>=0}))");
      console.log('    [inAndOut/0] SCRIPTS_AJAX: ' + (scriptsInOut.startsWith('__ERR__') ? scriptsInOut : scriptsInOut.slice(0, 9000)));

      // 12) inAndOut: extraer SOLO los fragmentos de los scripts que mencionan
      //    validateExistence / guardar / modalidad / movimiento / formSubmit
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/0'"], 20000);
      await sleep(4000);
      const frags = ev("JSON.stringify([...document.querySelectorAll('script:not([src])')].map(function(s){var c=(s.textContent||'');var out=[];var terms=['validateExistence','Guardar','guardar','modalidad','movimiento','save','salida','ingreso','formAction'];for(var i=0;i<terms.length;i++){var t=terms[i];var idx=c.indexOf(t);while(idx>=0&&out.length<4){out.push(c.slice(Math.max(0,idx-400),idx+500));idx=c.indexOf(t,idx+1);}}return out.join(' |||| ');}).filter(function(c){return c.length>0}))");
      console.log('    [inAndOut/0] FRAGS: ' + (frags.startsWith('__ERR__') ? frags : frags.slice(0, 10000)));

      // 13) Probar rutas de listado de movimientos fuera de inAndOut
      const rutasList = [
        'https://intranet.budgetperu.com/hiker/ControlCar/movimientosLista',
        'https://intranet.budgetperu.com/hiker/ControlCar/listMovimientos',
        'https://intranet.budgetperu.com/hiker/ControlCar/movimiento',
        'https://intranet.budgetperu.com/hiker/ControlCar/salidas',
        'https://intranet.budgetperu.com/hiker/ControlCar/ingresos',
        'https://intranet.budgetperu.com/hiker/ControlCar/reporteMovimientos',
        'https://intranet.budgetperu.com/hiker/ControlCar/reportesMovimientos',
        'https://intranet.budgetperu.com/hiker/ControlCar/movimientosReporte',
        'https://intranet.budgetperu.com/hiker/ControlCar/getMovimientos/1063',
        'https://intranet.budgetperu.com/hiker/ControlCar/movimientos/1063',
      ];
      for (const u of rutasList) {
        const jsx = `(function(){try{var x=new XMLHttpRequest();x.open('GET','${u}',false);x.setRequestHeader('X-Requested-With','XMLHttpRequest');x.send();return x.status+' :: '+(x.responseText||'').slice(0,150).replace(/\\s+/g,' ');}catch(e){return 'ERR '+e.message;}})()`;
        const r = ev(jsx);
        console.log('    [ep2-get] ' + u + ' → ' + (r.startsWith('__ERR__') ? r : r.slice(0, 200)));
      }

      console.log('[--descubrir] Fin de la exploración.');
    }
  }

  const mensaje = buildMensaje(unidades, fecha);
  console.log('');
  console.log('--- Mensaje de Telegram (vista previa) ---');
  console.log(mensaje);
  console.log('------------------------------------------');
  console.log('Longitud: ' + mensaje.length + ' caracteres (límite 4096) · ' + unidades.length + ' autos');

  if (soloMensaje) {
    console.log('(modo --mensaje: no se envió nada)');
    return;
  }
  if (process.env.TELEGRAM_DRY_RUN) {
    console.log('(TELEGRAM_DRY_RUN activo: no se envió)');
    return;
  }
  try {
    await enviarTelegram(mensaje);
  } catch (e) {
    // Un fallo de Telegram no debe romper el pipeline: el reporte web ya se generó.
    console.log('⚠️  Telegram falló (el reporte web sí se generó y se publicará): ' + e.message);
  }
}

main().catch(err => {
  console.error('ERROR: ' + err.message);
  process.exit(1);
});

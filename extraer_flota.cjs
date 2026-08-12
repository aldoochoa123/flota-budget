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
// → unidad=td[1], select de ubicación en td[2], km=td[4], fuel=td[5], estado=td[6].
const EXTRACT_JS =
  "JSON.stringify([...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')].map(function(tr){var tds=tr.querySelectorAll('td');var sel=tr.querySelector('select');return {unidad:(tds[1]?tds[1].innerText:'').trim(),ubic:sel?sel.value:'',km:(tds[4]?tds[4].innerText:'').trim(),fuel:(tds[5]?tds[5].innerText:'').trim(),estado:(tds[6]?tds[6].innerText:'').trim()}}))";

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

// ---------- Snapshot JSON ----------
function generarReporte(unidades, fecha) {
  fs.mkdirSync(PUBLIC, { recursive: true });
  // Solo el JSON: NO se genera public/index.html porque la app React usa el
  // index.html raíz y public/index.html la pisotearía en dev y en build.
  fs.writeFileSync(path.join(PUBLIC, 'flota_data.json'), JSON.stringify({ fecha, unidades }, null, 2));
  console.log('    📄 Snapshot guardado en public/flota_data.json (' + unidades.length + ' unidades)');
}

// ---------- Main ----------
async function main() {
  const soloMensaje = process.argv.includes('--mensaje');

  let unidades;
  let fecha;
  if (soloMensaje) {
    const json = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'flota_data.json'), 'utf8'));
    unidades = json.unidades;
    fecha = json.fecha;
    console.log('Modo prueba de mensaje (sin enviar). Datos de: ' + fecha);
  } else {
    if (!USUARIO || !PASSWORD) throw new Error('Faltan credenciales (BUDGET_USER/BUDGET_PASS o config.json)');
    unidades = await extraerFlota();
    fecha = new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

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
    console.log('    ✅ Verificaciones OK — ' + total + ' unidades');

    generarReporte(unidades, fecha);

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

      // 5) Llamar validateExistence y capturar la RESPUESTA completa (¿historial?)
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar/inAndOut/0'"], 20000);
      await sleep(4000);
      const jsx = `(function(){
        try{
          var x=new XMLHttpRequest();
          x.open('POST','https://intranet.budgetperu.com/hiker/ControlCar/validateExistence/',false);
          x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
          x.setRequestHeader('X-Requested-With','XMLHttpRequest');
          x.setRequestHeader('X-CSRF-TOKEN',(document.querySelector('meta[name=csrf-token]')||{content:''}).content);
          x.send('unidad=1063');
          return x.status+' :: '+(x.responseText||'').slice(0,3000);
        }catch(e){return 'ERR '+e.message;}
      })()`;
      const resp = ev(jsx);
      console.log('    [validateExistence] 1063: ' + (resp.startsWith('__ERR__') ? resp : resp));

      // 6) Volcar TODOS los scripts inline de la página inAndOut (buscar rutas del router)
      const dumpScripts = `(function(){
        var out=[];
        document.querySelectorAll('script:not([src])').forEach(function(s){
          var c=(s.textContent||'');
          if(c.indexOf('url:')>=0||c.indexOf('$.post')>=0||c.indexOf('$.ajax')>=0||c.indexOf('fetch(')>=0||c.indexOf('window.location')>=0||c.indexOf('route(')>=0){
            out.push(c.slice(0,2500));
          }
        });
        return out.join('\n=====\n');
      })()`;
      const sc = ev(dumpScripts);
      console.log('    [scripts-inline] inAndOut: ' + (sc.startsWith('__ERR__') ? sc : sc.slice(0, 6000)));

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

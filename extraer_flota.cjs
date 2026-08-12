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
// Vuelca los enlaces de la intranet relacionados con taller/movimientos para
// encontrar las URLs de entradas y salidas de taller.
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
  const js = `(function(){var out={links:[],text:'',table:'',menciones:[]};document.querySelectorAll('a').forEach(function(a){var h=a.getAttribute('href')||'';if(h.indexOf('/hiker/')>=0)out.links.push(h+'  =>  '+((a.innerText||'').trim().replace(/\\s+/g,' ').slice(0,60)))});var body=document.body;if(body)out.text=body.innerText.replace(/\\n{3,}/g,'\\n\\n').slice(0,2500);var t=document.querySelector('table');if(t)out.table=t.outerHTML.slice(0,2500);var all=document.querySelectorAll('*');var n=0;for(var i=0;i<all.length&&n<40;i++){var el=all[i];var txt=(el.innerText||'').trim().replace(/\\s+/g,' ');if(/taller|movimiento|mantenimiento|salida|retorno|reporte/i.test(txt)&&txt.length<60){out.menciones.push(el.tagName+': '+txt.slice(0,60));n++;}}return JSON.stringify(out)})()`;
  const raw = ab(['eval', js], 30000);
  if (raw.startsWith('__ERR__')) {
    console.log('    [--descubrir] Error evaluando: ' + raw.slice(0, 200));
    return;
  }
  try {
    const d = JSON.parse(raw);
    d.links.forEach(l => console.log('    LINK ' + l));
    console.log('    [--descubrir] Total links /hiker/: ' + d.links.length);
    console.log('    BODY_TEXT: ' + d.text.replace(/\n/g, ' \\n '));
    if (d.table) console.log('    TABLE_HTML: ' + d.table.slice(0, 2200));
    d.menciones.forEach(m => console.log('    MENCION ' + m));
  } catch (e) {
    console.log('    [--descubrir] No se pudo parsear: ' + raw.slice(0, 600));
  }
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
      // Sección flota (la tabla ya está renderizada aquí)
      ab(['eval', "location.href='" + URL_FLOTA + "'"], 20000);
      await sleep(5000);
      await descubrirEnlaces();
      // Raíz del módulo ControlCar (posible menú)
      ab(['eval', "location.href='https://intranet.budgetperu.com/hiker/ControlCar'"], 20000);
      await sleep(5000);
      await descubrirEnlaces();
      // Páginas de Ingreso/Salida (taller) del módulo ControlCar
      const probar = [
        'https://intranet.budgetperu.com/hiker/ControlCar/ingreso',
        'https://intranet.budgetperu.com/hiker/ControlCar/salida',
      ];
      for (const u of probar) {
        ab(['eval', "location.href='" + u + "'"], 20000);
        await sleep(4500);
        console.log('    --- Probando: ' + u);
        await descubrirEnlaces();
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

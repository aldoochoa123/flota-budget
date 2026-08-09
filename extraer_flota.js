#!/usr/bin/env node
// ============================================================
// Reporte de Flota — Budget Perú (versión GitHub Actions)
// - Extrae la flota de la intranet usando agent-browser
// - Genera public/index.html (reporte) + public/flota_data.json
// - Envía la flota completa por Telegram (si hay token configurado)
//
// Credenciales: variables de entorno (GitHub Secrets):
//   BUDGET_USER, BUDGET_PASS, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
// (o config.json local, que NO se sube a GitHub)
//
// Uso:
//   node extraer_flota.js              → extrae + genera + envía Telegram
//   node extraer_flota.js --mensaje    → prueba el mensaje de Telegram sin enviar
// ============================================================
const { execSync } = require('child_process');
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
const URL_LOGIN = 'https://intranet.budgetperu.com/hiker/auth/login';
const URL_FLOTA = 'https://intranet.budgetperu.com/hiker/ControlCar/flota';

function ab(args, timeoutMs = 40000) {
  try {
    return execSync('agent-browser ' + args, { shell: true, encoding: 'utf8', timeout: timeoutMs }).trim();
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
    last = ab('get url', 15000);
    if (last && !last.startsWith('__ERR__') && last.toLowerCase().includes(needle.toLowerCase())) return last;
    await sleep(2000);
  }
  throw new Error('Timeout esperando URL "' + needle + '" (última: ' + last + ')');
}

const EXTRACT_JS =
  "JSON.stringify([...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')].map(function(tr){var tds=tr.querySelectorAll('td');var sel=tr.querySelector('select');return {unidad:(tds[0]?tds[0].innerText:'').trim(),ubic:sel?sel.value:'',km:(tds[2]?tds[2].innerText:'').trim(),fuel:(tds[3]?tds[3].innerText:'').trim(),estado:(tds[4]?tds[4].innerText:'').trim()}}))";

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
  ab('open', 30000);
  await sleep(2500);

  console.log('[2/5] Navegando al portal...');
  ab("eval \"location.href='" + URL_LOGIN + "'\"", 20000);
  await sleep(4000);
  let url = ab('get url', 15000);
  console.log('    URL actual: ' + url);

  if (url.toLowerCase().includes('/hiker/auth/login')) {
    console.log('[3/5] Iniciando sesión...');
    await pollUrl('/hiker/auth/login', 60000);
    ab('fill #identity ' + USUARIO, 20000);
    ab('fill #password ' + PASSWORD, 20000);
    ab("eval \"document.querySelector('form').requestSubmit()\"", 20000);
    await sleep(4000);
    url = ab('get url', 15000);
    if (!url.toLowerCase().includes('/hiker/control')) {
      ab("eval \"document.querySelector('form').submit()\"", 20000);
      await sleep(4000);
    }
    url = await pollUrl('/hiker/control', 90000);
    console.log('    ✅ Login OK → ' + url);
  } else if (url.toLowerCase().includes('/hiker/control')) {
    console.log('[3/5] ✅ Sesión activa → ' + url);
  }

  console.log('[4/5] Abriendo sección Flota...');
  ab("eval \"location.href='" + URL_FLOTA + "'\"", 20000);
  await sleep(4000);
  await pollUrl('/flota', 60000);

  console.log('[5/5] Extrayendo datos...');
  const raw = ab('eval "' + EXTRACT_JS + '"', 30000);
  if (raw.startsWith('__ERR__')) throw new Error('Error extrayendo: ' + raw);
  let unidades = JSON.parse(raw);
  if (typeof unidades === 'string') unidades = JSON.parse(unidades);
  if (!Array.isArray(unidades) || unidades.length === 0) throw new Error('Sin unidades en la respuesta');
  return unidades;
}

// ---------- Reporte HTML ----------
function generarReporte(unidades, fecha) {
  fs.mkdirSync(PUBLIC, { recursive: true });
  const tpl = fs.readFileSync(path.join(DIR, 'informe_flota_template.html'), 'utf8');
  const html = tpl.replace('__DATA__', JSON.stringify({ fecha, unidades }));
  fs.writeFileSync(path.join(PUBLIC, 'index.html'), html);
  fs.writeFileSync(path.join(PUBLIC, 'flota_data.json'), JSON.stringify({ fecha, unidades }, null, 2));
  console.log('    📄 Reporte generado en public/index.html (' + unidades.length + ' unidades)');
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
  await enviarTelegram(mensaje);
}

main().catch(err => {
  console.error('ERROR: ' + err.message);
  process.exit(1);
});

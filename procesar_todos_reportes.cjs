// Procesador masivo de OCR para las 161 unidades
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'reportes_imagenes');
const portalData = JSON.parse(fs.readFileSync('flota_161_portal.json', 'utf8'));

// Función para normalizar fechas extraídas por OCR
function parseDate(str) {
  if (!str) return null;
  // Buscar formatos dd-mm-yy, dd/mm/yyyy, etc.
  const clean = str.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
  const m = clean.match(/(\d{1,2})[\s\-\/\.]+(\d{1,2})[\s\-\/\.]+(\d{2,4})/);
  if (!m) return null;
  let day = parseInt(m[1], 10);
  let month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);

  if (year < 100) year += 2000;
  if (month > 12 && day <= 12) {
    // invertir si mes y día vinieron al revés
    const tmp = day; day = month; month = tmp;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseMileage(str) {
  if (!str) return null;
  const clean = str.replace(/[^\d]/g, '');
  const num = parseInt(clean, 10);
  if (isNaN(num) || num < 1000 || num > 350000) return null;
  return num;
}

async function processAll() {
  console.log("Iniciando Worker Tesseract...");
  const worker = await createWorker('spa');

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg'));
  console.log(`Encontradas ${files.length} imágenes para procesar.`);

  // Agrupar archivos por unidad
  const filesByUnit = {};
  for (const f of files) {
    const unit = f.split('_')[0];
    if (!filesByUnit[unit]) filesByUnit[unit] = [];
    filesByUnit[unit].push(f);
  }

  const extractedResults = {};
  const doubts = []; // Casos dudosos para consultar

  let count = 0;
  const units = Object.keys(portalData);

  for (const unit of units) {
    count++;
    const info = portalData[unit] || {};
    const unitFiles = filesByUnit[unit] || [];
    
    let soatFound = null;
    let revFound = null;
    let nextServiceKmFound = null;
    let nextServiceDateFound = null;

    console.log(`[${count}/${units.length}] Procesando Unidad #${unit} (${unitFiles.length} imágenes)...`);

    for (const imgFile of unitFiles) {
      const fullPath = path.join(IMAGES_DIR, imgFile);
      try {
        const res = await worker.recognize(fullPath);
        const text = res.data.text || '';
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];

          // 1. SOAT
          if (/SOAT|Propiedad/i.test(l)) {
            const dateStr = l.replace(/.*SOAT.*Vence:?/i, '').replace(/.*Propiedad.*Vence:?/i, '').trim();
            const d = parseDate(dateStr) || parseDate(lines[i+1]);
            if (d && (!soatFound || d > soatFound)) {
              soatFound = d;
            }
          }

          // 2. Revisión Técnica
          if (/Revisi[oó]n\s*T[eé]cnica/i.test(l)) {
            const dateStr = l.replace(/.*T[eé]cnica.*Vence:?/i, '').trim();
            const d = parseDate(dateStr) || parseDate(lines[i+1]);
            if (d && (!revFound || d > revFound)) {
              revFound = d;
            }
          }

          // 3. Próximo Servicio de Mantenimiento
          if (/PR[OÓ]XIMO\s*SERVICIO/i.test(l) || /MANTENIMIENTO/i.test(l)) {
            const val = (lines[i+1] || '') + ' ' + (lines[i+2] || '') + ' ' + l;
            const km = parseMileage(val);
            const d = parseDate(val);
            if (km && !nextServiceKmFound) nextServiceKmFound = km;
            if (d && !nextServiceDateFound) nextServiceDateFound = d;
          }
        }
      } catch (err) {
        console.error(`  Error en ${imgFile}:`, err.message);
      }
    }

    extractedResults[unit] = {
      unitNumber: unit,
      plate: info.placa || undefined,
      mileage: info.ultimoKm ? parseInt(info.ultimoKm, 10) : undefined,
      soatExpiry: soatFound || undefined,
      revisionExpiry: revFound || undefined,
      nextServiceKm: nextServiceKmFound || undefined,
      nextMaintenance: nextServiceDateFound || undefined,
      updatedAt: Date.now()
    };

    console.log(`  Resultado #${unit}: Placa: ${info.placa || "—"} | SOAT: ${soatFound || "—"} | RT: ${revFound || "—"} | Próx Serv: ${nextServiceKmFound ? nextServiceKmFound + ' km' : nextServiceDateFound || "—"}`);
  }

  await worker.terminate();

  fs.writeFileSync('flota_base_procesada.json', JSON.stringify(extractedResults, null, 2));
  console.log("\n✅ Proceso completado. Guardado en flota_base_procesada.json");
}

processAll();

// Script de depuración, validación y siembra de datos extraídos en Convex
const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('flota_base_procesada.json', 'utf8'));
const portalData = JSON.parse(fs.readFileSync('flota_161_portal.json', 'utf8'));

function cleanDate(dStr) {
  if (!dStr) return undefined;
  // Si viene con años OCR erróneos como 727, 927, 726
  let s = dStr;
  if (/^(\d{3})-(\d{2})-(\d{2})$/.test(s)) {
    const parts = s.split('-');
    let y = parseInt(parts[0], 10);
    if (y >= 700 && y <= 999) {
      y = 2000 + (y % 100);
    }
    s = `${y}-${parts[1]}-${parts[2]}`;
  }
  
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return undefined;

  // Filtrar fechas absurdas (menores a 2024 o mayores a 2035)
  const year = d.getFullYear();
  if (year < 2024 || year > 2035) return undefined;

  return s;
}

function cleanMileage(km, currentKm) {
  if (!km) return undefined;
  const val = parseInt(km, 10);
  if (isNaN(val)) return undefined;
  // Si el servicio es menor a 1,000 km o mayor a 300,000 km descartar
  if (val < 1000 || val > 300000) return undefined;
  return val;
}

const cleanedList = [];
const summary = {
  total: 0,
  withPlate: 0,
  withNextServiceKm: 0,
  withNextServiceDate: 0,
  withSoat: 0,
  withRevision: 0,
};

for (const unit of Object.keys(portalData)) {
  summary.total++;
  const raw = rawData[unit] || {};
  const portal = portalData[unit] || {};

  const plate = portal.placa ? portal.placa.trim().toUpperCase() : (raw.plate ? raw.plate.trim().toUpperCase() : undefined);
  const mileage = portal.ultimoKm ? parseInt(portal.ultimoKm, 10) : (raw.mileage ? parseInt(raw.mileage, 10) : undefined);
  
  let soat = cleanDate(raw.soatExpiry);
  let rev = cleanDate(raw.revisionExpiry);
  let nextKm = cleanMileage(raw.nextServiceKm, mileage);
  let nextDate = cleanDate(raw.nextMaintenance);

  // Si SOAT ya venció (antes de agosto 2026), descartar según instrucción del usuario
  if (soat) {
    const dSoat = new Date(`${soat}T00:00:00`);
    // Considerar no vencido si es >= 2026-08-01
    if (dSoat < new Date('2026-08-01T00:00:00')) {
      soat = undefined;
    }
  }

  if (plate) summary.withPlate++;
  if (nextKm) summary.withNextServiceKm++;
  if (nextDate) summary.withNextServiceDate++;
  if (soat) summary.withSoat++;
  if (rev) summary.withRevision++;

  cleanedList.push({
    unitNumber: unit,
    plate: plate || undefined,
    mileage: mileage || undefined,
    clean: true,
    nextServiceKm: nextKm || undefined,
    nextMaintenance: nextDate || undefined,
    soatExpiry: soat || undefined,
    revisionExpiry: rev || undefined,
    observations: undefined,
  });
}

console.log("==================================================");
console.log("   RESUMEN DE DATOS EXTRAÍDOS Y DEPURADOS         ");
console.log("==================================================");
console.log(`Total unidades procesadas: ${summary.total}`);
console.log(`Unidades con Placa Oficial: ${summary.withPlate}`);
console.log(`Unidades con Próximo Servicio (KM): ${summary.withNextServiceKm}`);
console.log(`Unidades con Próximo Servicio (Fecha): ${summary.withNextServiceDate}`);
console.log(`Unidades con SOAT Vigente: ${summary.withSoat}`);
console.log(`Unidades con Revisión Técnica: ${summary.withRevision}`);

fs.writeFileSync('flota_161_limpia.json', JSON.stringify(cleanedList, null, 2));
console.log("\nGuardado en flota_161_limpia.json");

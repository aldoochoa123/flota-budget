const fs = require('fs');

// Leer datos depurados de las 161 unidades
const flota161 = JSON.parse(fs.readFileSync('flota_161_limpia.json', 'utf8'));

// Leer PAST_FLEET actual para no perder ningún dato previo
const currentPast = [
  { unitNumber: "0101", nextServiceKm: 76214, soatExpiry: "2026-12-21" },
  { unitNumber: "0102", nextServiceKm: 80955, soatExpiry: "2026-12-21" },
  { unitNumber: "0104", nextServiceKm: 73572, soatExpiry: "2026-12-21" },
  { unitNumber: "0131", nextServiceKm: 36626, soatExpiry: "2027-06-11" },
  { unitNumber: "0134", nextServiceKm: 43317, soatExpiry: "2027-06-11" },
  { unitNumber: "0135", nextServiceKm: 10000, soatExpiry: "2027-04-13" },
  { unitNumber: "0137", nextServiceKm: 10000, soatExpiry: "2027-04-08" },
  { unitNumber: "0139", nextServiceKm: 10000, soatExpiry: "2027-04-08" },
  { unitNumber: "0254", nextServiceKm: 76039, soatExpiry: "2026-11-23", revisionExpiry: "2026-12-01" },
  { unitNumber: "0255", nextServiceKm: 94979, soatExpiry: "2026-11-22" },
  { unitNumber: "0257", nextServiceKm: 65963, soatExpiry: "2026-11-29", revisionExpiry: "2027-02-03" },
  { unitNumber: "0260", nextServiceKm: 54242, soatExpiry: "2027-02-05" },
  { unitNumber: "0262", nextServiceKm: 43242, soatExpiry: "2027-02-07" },
  { unitNumber: "0263", nextServiceKm: 53345, soatExpiry: "2027-02-07" },
  { unitNumber: "0264", nextServiceKm: 45075, soatExpiry: "2027-02-21" },
  { unitNumber: "0265", nextServiceKm: 53460, soatExpiry: "2027-02-21" },
  { unitNumber: "0268", nextServiceKm: 55015, soatExpiry: "2027-02-22" },
  { unitNumber: "0326", nextServiceKm: 93442, soatExpiry: "2026-12-03", revisionExpiry: "2027-03-18" },
  { unitNumber: "0327", nextServiceKm: 82429, soatExpiry: "2026-10-07", revisionExpiry: "2027-02-20" },
  { unitNumber: "0328", nextServiceKm: 86393, soatExpiry: "2026-10-07", revisionExpiry: "2027-04-24" },
  { unitNumber: "0468", nextServiceKm: 46597, soatExpiry: "2026-10-21" },
  { unitNumber: "0471", nextServiceKm: 72430, soatExpiry: "2026-08-08" },
  { unitNumber: "0474", nextServiceKm: 77052, soatExpiry: "2026-08-15" },
  { unitNumber: "0475", nextServiceKm: 67924, soatExpiry: "2026-08-15" },
  { unitNumber: "0476", nextServiceKm: 82990, soatExpiry: "2026-08-14" },
  { unitNumber: "0477", nextServiceKm: 77854, soatExpiry: "2026-08-15" },
  { unitNumber: "0478", nextServiceKm: 78715, soatExpiry: "2026-08-15" },
  { unitNumber: "0479", nextServiceKm: 69187, soatExpiry: "2027-08-15" },
  { unitNumber: "0480", nextServiceKm: 76340, soatExpiry: "2026-08-15" },
  { unitNumber: "0481", nextServiceKm: 82316, soatExpiry: "2026-08-17" },
  { unitNumber: "0482", nextServiceKm: 75211, soatExpiry: "2026-08-17" },
  { unitNumber: "0487", nextServiceKm: 64875, soatExpiry: "2026-10-31" },
  { unitNumber: "0489", nextServiceKm: 55879, soatExpiry: "2026-10-31" },
  { unitNumber: "0490", nextServiceKm: 73924, soatExpiry: "2026-11-10" },
  { unitNumber: "0492", nextServiceKm: 53454, soatExpiry: "2026-11-15" },
  { unitNumber: "0494", nextServiceKm: 76578, soatExpiry: "2026-11-15" },
  { unitNumber: "0497", nextServiceKm: 71757, soatExpiry: "2027-03-12" },
  { unitNumber: "0498", nextServiceKm: 64251, soatExpiry: "2027-03-12" },
  { unitNumber: "0506", nextServiceKm: 44433, soatExpiry: "2027-03-04" },
  { unitNumber: "0508", nextServiceKm: 34360, soatExpiry: "2027-03-04" },
  { unitNumber: "0509", nextServiceKm: 35381, soatExpiry: "2027-03-04" },
  { unitNumber: "0515", nextServiceKm: 34868, soatExpiry: "2027-05-12" },
  { unitNumber: "0770", nextServiceKm: 64991, soatExpiry: "2027-01-10" },
  { unitNumber: "0772", nextServiceKm: 73420, soatExpiry: "2027-01-26" },
  { unitNumber: "0774", nextServiceKm: 75782, soatExpiry: "2027-01-08" },
  { unitNumber: "0775", nextServiceKm: 59740, soatExpiry: "2027-01-11" },
  { unitNumber: "0778", nextServiceKm: 43350, soatExpiry: "2027-01-12" },
  { unitNumber: "0780", nextServiceKm: 54101, soatExpiry: "2027-01-12" },
  { unitNumber: "0782", nextServiceKm: 49457, soatExpiry: "2027-01-11" },
  { unitNumber: "0783", nextServiceKm: 53100, soatExpiry: "2027-01-12" },
  { unitNumber: "0890", nextServiceKm: 76000, soatExpiry: "2026-11-23" },
  { unitNumber: "0891", nextServiceKm: 61400, soatExpiry: "2026-11-23" },
  { unitNumber: "0893", nextServiceKm: 57400, soatExpiry: "2026-11-23" },
  { unitNumber: "0894", nextServiceKm: 45700, soatExpiry: "2026-12-14" },
  { unitNumber: "0895", nextServiceKm: 34800, soatExpiry: "2026-12-14" },
  { unitNumber: "0896", nextServiceKm: 30400, soatExpiry: "2027-06-11" },
  { unitNumber: "0897", nextServiceKm: 17700, soatExpiry: "2027-06-11" },
  { unitNumber: "0898", nextServiceKm: 23800, soatExpiry: "2027-06-11" },
  { unitNumber: "0899", nextServiceKm: 25200, soatExpiry: "2027-06-11" },
  { unitNumber: "0900", nextServiceKm: 41500, soatExpiry: "2026-11-23" },
  { unitNumber: "0901", nextServiceKm: 64000, soatExpiry: "2026-11-23" },
  { unitNumber: "0903", nextServiceKm: 42000, soatExpiry: "2026-11-23" },
  { unitNumber: "0909", nextServiceKm: 80400, soatExpiry: "2027-10-24" },
  { unitNumber: "0915", nextServiceKm: 61200, soatExpiry: "2026-12-14" },
  { unitNumber: "0916", nextServiceKm: 59600, soatExpiry: "2026-12-14" },
  { unitNumber: "0943", nextServiceKm: 114000, soatExpiry: "2026-11-15" },
  { unitNumber: "0944", nextServiceKm: 72100, soatExpiry: "2027-01-26" },
  { unitNumber: "0945", nextServiceKm: 58800, soatExpiry: "2027-01-26" },
  { unitNumber: "0946", nextServiceKm: 49800, soatExpiry: "2027-02-22" },
  { unitNumber: "0947", nextServiceKm: 51000, soatExpiry: "2027-02-22" },
  { unitNumber: "0960", nextServiceKm: 96200, soatExpiry: "2026-10-07" },
  { unitNumber: "0961", nextServiceKm: 84400, soatExpiry: "2026-10-07" },
  { unitNumber: "0962", nextServiceKm: 82900, soatExpiry: "2026-10-07" },
  { unitNumber: "0963", nextServiceKm: 87500, soatExpiry: "2026-10-07" },
  { unitNumber: "0964", nextServiceKm: 85900, soatExpiry: "2026-10-07" },
  { unitNumber: "0965", nextServiceKm: 66100, soatExpiry: "2026-10-07" },
  { unitNumber: "0966", nextServiceKm: 21300, soatExpiry: "2027-06-11" },
  { unitNumber: "0967", nextServiceKm: 17100, soatExpiry: "2027-06-11" },
  { unitNumber: "0968", nextServiceKm: 19000, soatExpiry: "2027-06-11" },
  { unitNumber: "0969", nextServiceKm: 15800, soatExpiry: "2027-06-11" },
  { unitNumber: "1032", nextServiceKm: 105700, soatExpiry: "2026-10-31" },
  { unitNumber: "1033", nextServiceKm: 86400, soatExpiry: "2026-10-31" },
  { unitNumber: "1034", nextServiceKm: 84300, soatExpiry: "2026-10-31" },
  { unitNumber: "1035", nextServiceKm: 68600, soatExpiry: "2026-10-31" },
  { unitNumber: "1036", nextServiceKm: 62500, soatExpiry: "2026-10-31" },
  { unitNumber: "1037", nextServiceKm: 40900, soatExpiry: "2027-02-22" },
  { unitNumber: "1038", nextServiceKm: 41800, soatExpiry: "2027-02-22" },
  { unitNumber: "1061", nextServiceKm: 73800, soatExpiry: "2027-01-26" },
  { unitNumber: "1063", nextServiceKm: 73500, soatExpiry: "2027-01-26" },
  { unitNumber: "1064", nextServiceKm: 57200, soatExpiry: "2027-01-26" },
  { unitNumber: "1065", nextServiceKm: 61200, soatExpiry: "2027-01-26" },
  { unitNumber: "1066", nextServiceKm: 63600, soatExpiry: "2027-01-26" },
  { unitNumber: "1067", nextServiceKm: 25200, soatExpiry: "2027-06-11" },
  { unitNumber: "1068", nextServiceKm: 20600, soatExpiry: "2027-06-11" },
  { unitNumber: "1081", nextServiceKm: 114500, soatExpiry: "2026-08-15" },
  { unitNumber: "1083", nextServiceKm: 126600, soatExpiry: "2026-08-15" },
  { unitNumber: "1084", nextServiceKm: 118600, soatExpiry: "2026-08-15" },
  { unitNumber: "1085", nextServiceKm: 124000, soatExpiry: "2026-08-15" },
];

const pastMap = new Map();
for (const p of currentPast) {
  pastMap.set(p.unitNumber, { ...p });
}

// Combinar con los datos extraídos
for (const item of flota161) {
  const existing = pastMap.get(item.unitNumber) || { unitNumber: item.unitNumber };
  if (item.plate) existing.plate = item.plate;
  if (item.nextServiceKm && !existing.nextServiceKm) existing.nextServiceKm = item.nextServiceKm;
  if (item.soatExpiry && !existing.soatExpiry) existing.soatExpiry = item.soatExpiry;
  if (item.revisionExpiry && !existing.revisionExpiry) existing.revisionExpiry = item.revisionExpiry;
  pastMap.set(item.unitNumber, existing);
}

const mergedList = Array.from(pastMap.values()).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));

let tsContent = `/**
 * Datos enriquecidos de la Flota Base — combinados desde los formularios
 * históricos escaneados y el nuevo portal de inspecciones (http://168.181.8.120:81).
 *
 * Contiene:
 *   - Placa Oficial
 *   - SOAT (vencimiento no expirado)
 *   - Revisión técnica (vencimiento)
 *   - Próximo servicio (kilometraje)
 */
export type PastFleetEntry = {
  unitNumber: string;
  plate?: string;
  nextServiceKm?: number;
  soatExpiry?: string;
  revisionExpiry?: string;
};

export const PAST_FLEET: PastFleetEntry[] = [
`;

for (const entry of mergedList) {
  const parts = [`unitNumber: "${entry.unitNumber}"`];
  if (entry.plate) parts.push(`plate: "${entry.plate}"`);
  if (entry.nextServiceKm) parts.push(`nextServiceKm: ${entry.nextServiceKm}`);
  if (entry.soatExpiry) parts.push(`soatExpiry: "${entry.soatExpiry}"`);
  if (entry.revisionExpiry) parts.push(`revisionExpiry: "${entry.revisionExpiry}"`);
  tsContent += `  { ${parts.join(', ')} },\n`;
}

tsContent += `];\n`;

fs.writeFileSync('src/convex/pastFleet.ts', tsContent);
console.log(`✅ Archivo src/convex/pastFleet.ts actualizado con ${mergedList.length} unidades enriquecidas.`);

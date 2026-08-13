/**
 * Datos históricos — "Control Inventario de Flota Aeropuerto" (formularios escaneados).
 *
 * De cada formulario se extraen:
 *   - SOAT (vencimiento)                 → soatExpiry (ISO "aaaa-mm-dd")
 *   - Revisión técnica (vencimiento)     → revisionExpiry (ISO "aaaa-mm-dd")
 *   - Próximo servicio (kilometraje)     → nextServiceKm (número)
 */
export type PastFleetEntry = {
  unitNumber: string;
  nextServiceKm?: number;
  soatExpiry?: string;
  revisionExpiry?: string;
};

export const PAST_FLEET: PastFleetEntry[] = [
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
  { unitNumber: "0773", nextServiceKm: 66323, soatExpiry: "2027-01-26" },
  { unitNumber: "0774", nextServiceKm: 64113, soatExpiry: "2027-01-30" },
  { unitNumber: "0778", nextServiceKm: 41148, soatExpiry: "2026-09-26" },
  { unitNumber: "0782", nextServiceKm: 44963, soatExpiry: "2026-12-04" },
  { unitNumber: "0871", nextServiceKm: 54165, soatExpiry: "2026-11-15" },
  { unitNumber: "0880", nextServiceKm: 10000, soatExpiry: "2027-03-31" },
  { unitNumber: "0881", nextServiceKm: 10000, soatExpiry: "2027-03-31" },
  { unitNumber: "0891", nextServiceKm: 57031, soatExpiry: "2027-01-30" },
  { unitNumber: "0893", nextServiceKm: 51285, soatExpiry: "2026-09-30" },
  { unitNumber: "0897", nextServiceKm: 10000, soatExpiry: "2027-11-26" },
  { unitNumber: "0898", nextServiceKm: 14439, soatExpiry: "2027-01-27" },
  { unitNumber: "0901", nextServiceKm: 56655, soatExpiry: "2027-06-05" },
  { unitNumber: "0909", nextServiceKm: 78196, soatExpiry: "2026-08-05", revisionExpiry: "2027-07-10" },
  { unitNumber: "0943", nextServiceKm: 107935, soatExpiry: "2026-11-16" },
  { unitNumber: "0946", nextServiceKm: 42468, soatExpiry: "2027-04-07" },
  { unitNumber: "0947", nextServiceKm: 44177, soatExpiry: "2027-04-07" },
  { unitNumber: "0950", nextServiceKm: 87300, soatExpiry: "2026-11-16" },
  { unitNumber: "0951", nextServiceKm: 80418, soatExpiry: "2026-11-20" },
  { unitNumber: "0953", nextServiceKm: 20000, soatExpiry: "2027-04-08" },
  { unitNumber: "0960", nextServiceKm: 92489, soatExpiry: "2026-09-15" },
  { unitNumber: "0961", nextServiceKm: 78458, soatExpiry: "2026-09-15" },
  { unitNumber: "0962", nextServiceKm: 75647, soatExpiry: "2026-10-04" },
  { unitNumber: "0963", nextServiceKm: 82137, soatExpiry: "2026-11-06" },
  { unitNumber: "0964", nextServiceKm: 78067, soatExpiry: "2026-11-15", revisionExpiry: "2027-07-14" },
  { unitNumber: "0966", nextServiceKm: 20000, soatExpiry: "2027-03-16" },
  { unitNumber: "0968", nextServiceKm: 10000, soatExpiry: "2027-03-31" },
  { unitNumber: "1035", nextServiceKm: 62089, soatExpiry: "2026-12-05" },
  { unitNumber: "1037", nextServiceKm: 34797, soatExpiry: "2027-04-11" },
  { unitNumber: "1061", nextServiceKm: 72915, soatExpiry: "2027-02-23" },
  { unitNumber: "1063", nextServiceKm: 65517, soatExpiry: "2027-07-11" },
  { unitNumber: "1064", nextServiceKm: 53972, soatExpiry: "2026-07-11" },
  { unitNumber: "1065", nextServiceKm: 54500, soatExpiry: "2027-07-11" },
  { unitNumber: "1067", nextServiceKm: 20000, soatExpiry: "2027-02-26" },
  { unitNumber: "1068", nextServiceKm: 19200, soatExpiry: "2027-03-09" },
  { unitNumber: "1081", nextServiceKm: 110097, soatExpiry: "2026-09-08", revisionExpiry: "2027-05-08" },
];

// Guard: no debe haber unidades duplicadas en el dataset histórico.
const seen = new Set<string>();
for (const entry of PAST_FLEET) {
  if (seen.has(entry.unitNumber)) {
    throw new Error(`Unidad duplicada en PAST_FLEET: ${entry.unitNumber}`);
  }
  seen.add(entry.unitNumber);
}

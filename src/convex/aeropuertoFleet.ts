/**
 * Planilla "Control Inventario de Flota Aeropuerto" (transcrita a PDF el 16/08/2026).
 *
 * Es la versión más reciente de la planilla física del inventario del aeropuerto:
 * 31 unidades con su próximo servicio (kilometraje), vencimiento de SOAT y
 * vencimiento de revisión técnica. Los números de unidad se normalizan a 4
 * dígitos (ej: "508" → "0508") para coincidir con la flota base (fleetCatalog.ts).
 *
 * Interpretación de fechas (dd-mm-aa, formato peruano) → ISO "aaaa-mm-dd".
 *  - "4-3-27" → 2027-03-04
 *  - "16-12-26" → 2026-12-16
 *
 * Campos ausentes en la planilla (ej: RT de la mayoría de unidades, o el km de
 * la unidad 254 que dice "(sin dato)") se omiten a propósito: al aplicarla no se
 * borran datos existentes, solo se actualizan los que la planilla sí registra.
 */
export type AeropuertoFleetEntry = {
  unitNumber: string;
  nextServiceKm?: number;
  soatExpiry?: string;
  revisionExpiry?: string;
};

export const AEROPUERTO_FLEET: AeropuertoFleetEntry[] = [
  { unitNumber: "0508", nextServiceKm: 34360, soatExpiry: "2027-03-04" },
  { unitNumber: "0263", nextServiceKm: 53345, soatExpiry: "2027-02-07" },
  { unitNumber: "1084", nextServiceKm: 118690, soatExpiry: "2027-04-08", revisionExpiry: "2027-02-28" },
  { unitNumber: "0962", nextServiceKm: 75647, soatExpiry: "2026-10-04" },
  { unitNumber: "0946", nextServiceKm: 51146, soatExpiry: "2027-04-07" },
  { unitNumber: "1037", nextServiceKm: 34747, soatExpiry: "2027-04-11" },
  { unitNumber: "1083", nextServiceKm: 126699, soatExpiry: "2026-12-16", revisionExpiry: "2027-03-28" },
  { unitNumber: "0961", nextServiceKm: 78458, soatExpiry: "2027-04-07" },
  { unitNumber: "0915", nextServiceKm: 59672, soatExpiry: "2026-12-16" },
  { unitNumber: "0103", nextServiceKm: 75833, soatExpiry: "2026-12-21" },
  { unitNumber: "0137", nextServiceKm: 15000, soatExpiry: "2027-04-08" },
  { unitNumber: "1064", nextServiceKm: 53970, soatExpiry: "2027-07-11" },
  { unitNumber: "1035", nextServiceKm: 62089, soatExpiry: "2026-12-05" },
  { unitNumber: "0513", nextServiceKm: 24041, soatExpiry: "2027-05-09" },
  { unitNumber: "0899", nextServiceKm: 24625, soatExpiry: "2027-01-29" },
  { unitNumber: "0133", nextServiceKm: 35829, soatExpiry: "2027-06-11" },
  { unitNumber: "0909", nextServiceKm: 78196, soatExpiry: "2027-08-05", revisionExpiry: "2027-07-10" },
  { unitNumber: "0255", nextServiceKm: 94979, soatExpiry: "2026-11-22", revisionExpiry: "2027-01-10" },
  { unitNumber: "0773", nextServiceKm: 66323, soatExpiry: "2027-01-26" },
  { unitNumber: "0893", nextServiceKm: 51285, soatExpiry: "2026-09-30" },
  { unitNumber: "0469", nextServiceKm: 44164, soatExpiry: "2026-10-23" },
  { unitNumber: "0952", nextServiceKm: 15000, soatExpiry: "2027-04-08" },
  { unitNumber: "0268", nextServiceKm: 55015, soatExpiry: "2027-02-22" },
  { unitNumber: "0491", nextServiceKm: 72475, soatExpiry: "2026-11-15" },
  { unitNumber: "0132", nextServiceKm: 30000, soatExpiry: "2027-06-11" },
  { unitNumber: "0488", nextServiceKm: 67521, soatExpiry: "2026-10-31" },
  { unitNumber: "0262", nextServiceKm: 43242, soatExpiry: "2027-02-07" },
  { unitNumber: "0774", nextServiceKm: 73690, soatExpiry: "2027-01-30" },
  { unitNumber: "0254", soatExpiry: "2026-11-23", revisionExpiry: "2026-12-01" },
  { unitNumber: "0481", nextServiceKm: 82316, soatExpiry: "2026-08-17" },
  { unitNumber: "0321", nextServiceKm: 97118, soatExpiry: "2026-09-29" },
];

// Guard: la planilla registra 31 unidades.
if (AEROPUERTO_FLEET.length !== 31) {
  throw new Error(`La planilla Aeropuerto debe tener 31 unidades (hay ${AEROPUERTO_FLEET.length}).`);
}

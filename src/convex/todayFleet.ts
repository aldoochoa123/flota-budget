/**
 * Flota del día — "Control Inventario de Flota Aeropuerto" (formulario diario).
 *
 * Estas 29 unidades son la flota operativa de hoy (NO el total de la empresa,
 * que son las 161 unidades de fleetCatalog.ts).
 *
 * Interpretación del formulario (escrito a mano):
 *  - "Limpio/Sucio": todas las filas marcadas como Limpio (L).
 *  - "Próximo Servicio": kilometraje al que corresponde el próximo servicio (no es una fecha).
 *  - "SOAT/RT Vencimiento": vencimiento del SOAT. Columna "RT": vencimiento de revisión técnica.
 *  - Fechas en formato dd-mm-aa → ISO "aaaa-mm-dd".
 */
export type TodayFleetEntry = {
  unitNumber: string;
  mileage?: number;
  clean: boolean;
  nextServiceKm?: number;
  soatExpiry?: string;
  revisionExpiry?: string;
  observations?: string;
};

export const TODAY_FLEET: TodayFleetEntry[] = [
  { unitNumber: "0134", mileage: 35317, clean: true, nextServiceKm: 43317, soatExpiry: "2026-06-11" },
  { unitNumber: "0101", mileage: 72346, clean: true, nextServiceKm: 76214, soatExpiry: "2026-12-21" },
  { unitNumber: "0482", mileage: 66430, clean: true, nextServiceKm: 75211, soatExpiry: "2026-08-17", observations: "PROX. RENOVAR SOAT" },
  { unitNumber: "1061", mileage: 63893, clean: true, nextServiceKm: 72915, soatExpiry: "2027-02-23" },
  { unitNumber: "0102", mileage: 71528, clean: true, nextServiceKm: 80955, soatExpiry: "2026-12-21" },
  { unitNumber: "0265", mileage: 47758, clean: true, nextServiceKm: 53460, soatExpiry: "2027-02-21" },
  { unitNumber: "0773", mileage: 63022, clean: true, nextServiceKm: 66323, soatExpiry: "2027-01-26" },
  { unitNumber: "1065", mileage: 51254, clean: true, nextServiceKm: 54500, soatExpiry: "2027-07-11" },
  { unitNumber: "0498", mileage: 54966, clean: true, nextServiceKm: 64251, soatExpiry: "2027-03-12" },
  { unitNumber: "0268", mileage: 45248, clean: true, nextServiceKm: 55015, soatExpiry: "2027-02-22" },
  { unitNumber: "0137", mileage: 8047, clean: true, nextServiceKm: 15000, soatExpiry: "2027-04-08" },
  { unitNumber: "0778", mileage: 34360, clean: true, nextServiceKm: 41148, soatExpiry: "2026-09-26" },
  { unitNumber: "0479", mileage: 61992, clean: true, nextServiceKm: 69187, soatExpiry: "2027-08-15" },
  { unitNumber: "1068", mileage: 10784, clean: true, nextServiceKm: 19200, soatExpiry: "2027-03-09" },
  { unitNumber: "0326", mileage: 83727, clean: true, nextServiceKm: 93442, soatExpiry: "2026-12-03", revisionExpiry: "2027-03-18" },
  { unitNumber: "0327", mileage: 75508, clean: true, nextServiceKm: 82429, soatExpiry: "2026-10-07", revisionExpiry: "2027-02-20" },
  { unitNumber: "0474", mileage: 69903, clean: true, nextServiceKm: 77052, soatExpiry: "2026-08-15", observations: "PROX. RENOVAR SOAT" },
  { unitNumber: "0478", mileage: 76559, clean: true, nextServiceKm: 78715, soatExpiry: "2026-08-13", observations: "PROX. RENOVAR SOAT" },
  { unitNumber: "0497", mileage: 70390, clean: true, nextServiceKm: 71757, soatExpiry: "2027-03-12" },
  { unitNumber: "1063", mileage: 63568, clean: true, nextServiceKm: 65587, soatExpiry: "2027-08-15" },
  { unitNumber: "0962", mileage: 72924, clean: true, nextServiceKm: 75647, soatExpiry: "2026-10-04" },
  { unitNumber: "0871", mileage: 44196, clean: true, nextServiceKm: 54165, soatExpiry: "2026-10-14" },
  { unitNumber: "1064", mileage: 48643, clean: true, nextServiceKm: 53972, soatExpiry: "2026-07-11", observations: "SOAT VENCIDO" },
  { unitNumber: "1081", mileage: 104592, clean: true, nextServiceKm: 110097, soatExpiry: "2026-09-08" },
  { unitNumber: "1035", mileage: 58688, clean: true, nextServiceKm: 62089, soatExpiry: "2026-12-05" },
  { unitNumber: "0943", mileage: 104043, clean: true, nextServiceKm: 107935, soatExpiry: "2026-11-16" },
  { unitNumber: "1067", mileage: 16040, clean: true, nextServiceKm: 20000, soatExpiry: "2027-02-26" },
  { unitNumber: "0909", mileage: 71116, clean: true, nextServiceKm: 78196, soatExpiry: "2027-08-05", revisionExpiry: "2027-07-10" },
  { unitNumber: "0772", mileage: 66680, clean: true, nextServiceKm: 73420, soatExpiry: "2027-01-26" },
];

// Guard: el formulario registra 29 unidades.
if (TODAY_FLEET.length !== 29) {
  throw new Error(`La flota del día debe tener 29 unidades (hay ${TODAY_FLEET.length}).`);
}

/**
 * Flota base — unidades de la empresa, Flota Budget Perú.
 *
 * Fuente: reporte "unidades_solo_2026.pdf" de la intranet (generado 10/08/2026).
 * Estas 161 unidades son la FLOTA BASE de la empresa (no la flota de hoy).
 * Los marcadores de confianza del reporte original (* / +) no se incluyen:
 * aquí van solo los números de unidad.
 */
export const FLEET_SERIES: { name: string; range: string; units: string[] }[] = [
  {
    name: "Serie 01",
    range: "0100 – 0139",
    units: [
      "0100", "0101", "0102", "0103", "0104",
      "0130", "0131", "0132", "0133", "0134", "0135", "0136", "0137", "0138", "0139",
    ],
  },
  {
    name: "Serie 02",
    range: "0200 – 0268",
    units: [
      "0200",
      "0254", "0255", "0256", "0257", "0258", "0259",
      "0260", "0261", "0262", "0263", "0264", "0265", "0266", "0267", "0268",
    ],
  },
  {
    name: "Serie 03",
    range: "0320 – 0328",
    units: ["0320", "0321", "0322", "0324", "0325", "0326", "0327", "0328"],
  },
  {
    name: "Serie 04",
    range: "0445 – 0499",
    units: [
      "0445", "0446", "0447", "0448", "0450", "0451", "0452",
      "0460", "0461",
      "0470", "0471", "0474", "0475", "0476", "0477", "0478", "0479",
      "0480", "0481", "0482", "0483", "0484", "0485", "0486", "0488", "0489",
      "0490", "0491", "0492", "0493", "0494", "0495", "0497", "0498", "0499",
    ],
  },
  {
    name: "Serie 05",
    range: "0500 – 0519",
    units: [
      "0500", "0501",
      "0504", "0505", "0506", "0507", "0508", "0509",
      "0510", "0511", "0512", "0513", "0514", "0515", "0516", "0517", "0519",
    ],
  },
  {
    name: "Serie 07",
    range: "0720 – 0783",
    units: [
      "0720", "0721", "0722",
      "0761", "0762", "0763",
      "0770", "0771", "0772", "0773", "0774", "0775", "0776", "0778",
      "0780", "0781", "0782", "0783",
    ],
  },
  {
    name: "Serie 08",
    range: "0880 – 0899",
    units: ["0880", "0881", "0882", "0883", "0890", "0891", "0893", "0894", "0895", "0896", "0897", "0898", "0899"],
  },
  {
    name: "Serie 09",
    range: "0900 – 0969",
    units: [
      "0900", "0901", "0903", "0909",
      "0915", "0916",
      "0943", "0944", "0945", "0946", "0947",
      "0960", "0961", "0962", "0963", "0964", "0965", "0966", "0967", "0968", "0969",
    ],
  },
  {
    name: "Serie 10",
    range: "1032 – 1085",
    units: [
      "1032", "1033", "1034", "1035", "1036", "1037", "1038",
      "1061", "1063", "1064", "1065", "1066", "1067", "1068",
      "1081", "1083", "1084", "1085",
    ],
  },
];

export const FLEET_UNITS: string[] = FLEET_SERIES.flatMap((s) => s.units);

// Guard: el reporte indica 161 unidades totales; detecta cualquier error de transcripción.
if (FLEET_UNITS.length !== 161) {
  throw new Error(`La flota base debe tener 161 unidades (hay ${FLEET_UNITS.length}).`);
}

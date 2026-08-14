import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { Doc } from "../convex/_generated/dataModel";
import { formatDate, formatMileage } from "./dates";

type IntranetSnapshot = Doc<"intranetSnapshots">;
type Vehicle = Doc<"vehicles">;

function unitKey(n: string): string {
  const num = Number(n);
  return Number.isFinite(num) ? String(num) : n.trim();
}

export async function downloadFlotaPdf(
  snap: IntranetSnapshot,
  allVehicles: Vehicle[] = [],
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Mapeo de unidades registradas
  const vehicleByUnit = new Map<string, Vehicle>();
  for (const v of allVehicles) {
    vehicleByUnit.set(unitKey(v.unitNumber), v);
  }

  // Resumen
  const total = snap.unidades.length;
  const limpias = snap.unidades.filter((u) => /limpio/i.test(u.estado)).length;
  const sucias = total - limpias;
  const porTanquear = snap.unidades.filter((u) => !/full/i.test(u.fuel)).length;

  // Barra superior decorativa corporativa Budget (Naranja)
  doc.setFillColor(234, 88, 12); // #ea580c (Budget Orange)
  doc.rect(0, 0, pageWidth, 4, "F");

  // Determinar turno según la hora actual de descarga (07:00 - 19:00 = DÍA; 19:00 - 07:00 = NOCHE)
  const now = new Date();
  const currentHour = now.getHours();
  const isDia = currentHour >= 7 && currentHour < 19;
  const turnoText = isDia ? "TURNO : DIA" : "TURNO : NOCHE";

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(20, 24, 33);
  doc.text("BUDGET PERÚ — REPORTE DE FLOTA EN PARQUEO", 14, 14);

  // Subtítulo: Turno
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(234, 88, 12);
  doc.text(turnoText, 14, 20.5);

  // Tarjetas / Bloques de resumen (KPIs)
  const kpiY = 25;
  const kpiHeight = 12;
  const kpiGap = 4;
  const kpiWidth = (pageWidth - 28 - kpiGap * 3) / 4;

  const kpis = [
    { label: "TOTAL PARQUEO", val: `${total} autos`, bg: [241, 245, 249], text: [30, 41, 59] },
    { label: "LIMPIAS", val: `${limpias} unidades`, bg: [236, 253, 245], text: [5, 150, 105] },
    { label: "SUCIAS", val: `${sucias} unidades`, bg: [254, 242, 242], text: [220, 38, 38] },
    { label: "POR TANQUEAR", val: `${porTanquear} unidades`, bg: [254, 243, 199], text: [217, 119, 6] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (kpiWidth + kpiGap);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.roundedRect(x, kpiY, kpiWidth, kpiHeight, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 4, kpiY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.val, x + 4, kpiY + 9.5);
  });

  // Preparar datos para la tabla
  const tableData = snap.unidades.map((u) => {
    const veh = vehicleByUnit.get(unitKey(u.unidad));
    const proxServ = veh?.nextServiceKm
      ? formatMileage(veh.nextServiceKm)
      : veh?.nextMaintenance
        ? formatDate(veh.nextMaintenance)
        : "—";

    return [
      `#${u.unidad}`,
      u.ubic || "—",
      u.km ? `${Number(u.km).toLocaleString("es-PE")} km` : "—",
      u.fuel || "—",
      /limpio/i.test(u.estado) ? "Limpio" : "Sucio",
      proxServ,
      formatDate(veh?.soatExpiry),
      formatDate(veh?.revisionExpiry),
      veh?.observations || "—",
    ];
  });

  autoTable(doc, {
    startY: 41,
    head: [
      [
        "Nº Unidad",
        "Parqueo",
        "Kilometraje",
        "Combustible",
        "Estado",
        "Próx. Servicio",
        "SOAT",
        "Rev. Técnica",
        "Observaciones",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [20, 24, 33], // Dark corporate slate
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 22 },
      1: { cellWidth: 20 },
      2: { cellWidth: 26 },
      3: { cellWidth: 24 },
      4: { cellWidth: 20 },
      5: { cellWidth: 28 },
      6: { cellWidth: 24 },
      7: { cellWidth: 24 },
      8: { cellWidth: "auto" },
    },
    didDrawPage: (data) => {
      // Pie de página
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      const str = `Flota Budget Perú  •  Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.text(str, pageWidth - 14, pageHeight - 6, { align: "right" });
    },
  });

  const cleanDateStr = snap.fecha.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
  const fileName = `Flota_Budget_Parqueo_${cleanDateStr}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output("datauristring");
      const base64Data = dataUri.split(",")[1];
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: fileName,
        text: `Reporte de Flota Budget Perú — ${snap.fecha} ${snap.hora}`,
        url: writeResult.uri,
        dialogTitle: "Guardar o Compartir Reporte PDF",
      });
      return;
    } catch (err) {
      console.warn("Capacitor Filesystem / Share error:", err);
    }
  }

  // Descarga estándar para navegador web / desktop
  doc.save(fileName);
}

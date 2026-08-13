export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export type ExpiryTone = "none" | "ok" | "warn" | "danger";

export function expiryInfo(iso?: string): { label: string; tone: ExpiryTone } {
  const days = daysUntil(iso);
  if (days === null) return { label: "", tone: "none" };
  if (days < 0) return { label: `Vencido (${Math.abs(days)}d)`, tone: "danger" };
  if (days === 0) return { label: "Vence hoy", tone: "danger" };
  if (days <= 30) return { label: `En ${days}d`, tone: "danger" };
  if (days <= 60) return { label: `En ${days}d`, tone: "warn" };
  return { label: "", tone: "ok" };
}

export function formatMileage(km?: number): string {
  if (km === undefined || km === null) return "—";
  return `${km.toLocaleString("es-PE")} km`;
}

/**
 * Convierte la fecha de un movimiento de taller ("dd/mm/yyyy" o "dd/mm/yy")
 * a un Date válido. Devuelve null si no se puede interpretar.
 */
export function parseMovDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatMovDate(s?: string): string {
  const d = parseMovDate(s);
  if (!d) return s || "—";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

/** Fecha y hora en zona horaria de Perú (UTC-5), sin depender del navegador. */
export function formatLimaDateTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo fecha (día/mes) en zona horaria de Perú. */
export function formatLimaDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
  });
}

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
  if (days === null) return { label: "—", tone: "none" };
  if (days < 0) return { label: `Vencido (${Math.abs(days)}d)`, tone: "danger" };
  if (days === 0) return { label: "Vence hoy", tone: "danger" };
  if (days <= 30) return { label: `En ${days} días`, tone: "danger" };
  if (days <= 60) return { label: `En ${days} días`, tone: "warn" };
  return { label: formatDate(iso), tone: "ok" };
}

export function formatMileage(km?: number): string {
  if (km === undefined || km === null) return "—";
  return `${km.toLocaleString("es-PE")} km`;
}

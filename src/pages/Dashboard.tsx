import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { Badge, Button, Card, Input, Label, Logo, Textarea } from "../components/ui";
import {
  daysUntil,
  expiryInfo,
  formatDate,
  formatLimaDate,
  formatLimaDateTime,
  formatMileage,
  formatMovDate,
  parseMovDate,
} from "../lib/dates";
import { downloadFlotaPdf } from "../lib/generatePdf";

type Vehicle = Doc<"vehicles">;
type Movement = NonNullable<Doc<"intranetSnapshots">["movimientos"]>[number];

/** Unidad “en taller” = su último movimiento NO es un retorno (RT Retorno). */
function isEnTaller(tipo: string): boolean {
  return !/retorno/i.test(tipo);
}

function movTone(tipo: string): "ok" | "warn" | "danger" | "muted" {
  if (/retorno/i.test(tipo)) return "ok";
  if (/taller/i.test(tipo)) return "danger";
  if (/salida/i.test(tipo)) return "warn";
  return "muted";
}

function movLabel(tipo: string): string {
  if (/retorno/i.test(tipo)) return "Retorno";
  if (/taller/i.test(tipo)) return "En taller";
  if (/salida/i.test(tipo)) return "Salida";
  return tipo;
}

/** Normaliza un número de unidad para cruzar fuentes ("0909" de la app = "909" de la intranet). */
function unitKey(n: string): string {
  const num = Number(n);
  return Number.isFinite(num) ? String(num) : n.trim();
}

const emptyForm = {
  unitNumber: "",
  mileage: "",
  clean: true,
  nextMaintenance: "",
  nextServiceKm: "",
  soatExpiry: "",
  revisionExpiry: "",
  observations: "",
};

function SyncCountdownWidget({ syncedAt }: { syncedAt?: number }) {
  const [timeLeft, setTimeLeft] = useState<{ min: number; sec: number; isImminent: boolean }>({
    min: 0,
    sec: 0,
    isImminent: false,
  });

  useEffect(() => {
    function update() {
      const now = Date.now();
      const d = new Date(now);
      // El workflow en GitHub Actions corre al minuto :00 de cada hora programada.
      // Calculamos la hora siguiente en punto.
      const nextHour = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours() + 1,
        0,
        0,
      ).getTime();
      const diffMs = Math.max(0, nextHour - now);
      const totalSec = Math.floor(diffMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      setTimeLeft({
        min,
        sec,
        isImminent: totalSec <= 60,
      });
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [syncedAt]);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
      </span>
      {timeLeft.isImminent ? (
        <span className="font-bold text-warn animate-pulse">⏳ Sincronizando en breve…</span>
      ) : (
        <span>
          Próxima sincronización:{" "}
          <span className="font-mono font-bold text-foreground">
            {String(timeLeft.min).padStart(2, "0")}:{String(timeLeft.sec).padStart(2, "0")}
          </span>
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const vehicles = useQuery(api.vehicles.listVehicles);
  const allVehicles = useQuery(api.vehicles.listAllVehicles);
  const intranetSnapshot = useQuery(api.intranet.getLatestSnapshot);
  const addVehicle = useMutation(api.vehicles.addVehicle);
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const deleteVehicle = useMutation(api.vehicles.deleteVehicle);
  const importFleet = useMutation(api.vehicles.importFleet);
  const applyTodayFleet = useMutation(api.vehicles.applyTodayFleet);
  const applyHistoricalData = useMutation(api.vehicles.applyHistoricalData);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"vehicles"> | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fleetMsg, setFleetMsg] = useState<string | null>(null);
  const [showBaseFleet, setShowBaseFleet] = useState(false);
  const autoSeeded = useRef(false);

  // Si no hay flota de hoy, siembra la flota base (161) y aplica la flota del día.
  useEffect(() => {
    if (vehicles === undefined || autoSeeded.current) return;
    if (vehicles.length === 0) {
      autoSeeded.current = true;
      void importFleet()
        .then(() => applyTodayFleet())
        .then((r) => {
          setFleetMsg(
            `✅ Flota de hoy cargada automáticamente: ${r.total} unidades (flota base de 161 en la base).`,
          );
        })
        .catch(() => {
          autoSeeded.current = false;
        });
    }
  }, [vehicles, importFleet, applyTodayFleet]);

  // Cierre del modal con tecla Escape y bloqueo del scroll de fondo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showForm) {
        setShowForm(false);
        setEditingId(null);
        setError(null);
      }
    }
    if (showForm) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showForm]);

  // Catálogo: flota de hoy por defecto; con el botón se ve la flota base completa (161).
  const catalogVehicles = showBaseFleet ? allVehicles : vehicles;

  // Índice por número de unidad normalizado (la intranet omite ceros: "909" = "0909").
  const vehicleByUnit = new Map<string, Vehicle>();
  for (const v of allVehicles ?? []) {
    vehicleByUnit.set(unitKey(v.unitNumber), v);
  }

  const serviceSoon = (catalogVehicles ?? []).filter((v) => {
    if (v.nextServiceKm && v.mileage && v.nextServiceKm - v.mileage <= 1500) return true;
    if (v.nextMaintenance && (daysUntil(v.nextMaintenance) ?? Infinity) <= 30) return true;
    return false;
  }).length;
  const docsSoon = (catalogVehicles ?? []).filter(
    (v) =>
      (daysUntil(v.soatExpiry) ?? Infinity) <= 30 ||
      (daysUntil(v.revisionExpiry) ?? Infinity) <= 30,
  ).length;

  // Resumen del último snapshot de la intranet (la flota visible).
  const snap = intranetSnapshot;
  const snapTotal = snap?.unidades.length ?? 0;
  const snapLimpias = snap ? snap.unidades.filter((u) => /limpio/i.test(u.estado)).length : 0;
  const snapSucias = snapTotal - snapLimpias;
  const snapPorTanquear = snap ? snap.unidades.filter((u) => !/full/i.test(u.fuel)).length : 0;

  // Movimientos de taller (entradas/salidas) del último snapshot.
  const movimientos = snap?.movimientos ?? [];
  const movByUnit = new Map<string, Movement>();
  for (const m of movimientos) {
    const prev = movByUnit.get(m.unidad);
    if (!prev) {
      movByUnit.set(m.unidad, m);
      continue;
    }
    const cur = parseMovDate(m.fecha)?.getTime() ?? 0;
    const old = parseMovDate(prev.fecha)?.getTime() ?? 0;
    if (cur >= old) movByUnit.set(m.unidad, m);
  }
  const enTaller = [...movByUnit.entries()]
    .filter(([, m]) => isEnTaller(m.tipo))
    .sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }))
    .map(([unidad, m]) => ({ ...m, unidad }));
  const movRecientes = movimientos
    .slice()
    .sort(
      (a, b) =>
        (parseMovDate(b.fecha)?.getTime() ?? 0) - (parseMovDate(a.fecha)?.getTime() ?? 0),
    )
    .slice(0, 25);

  async function handleImportFleet() {
    setBusy(true);
    setFleetMsg(null);
    try {
      const result = await importFleet();
      setFleetMsg(
        `✅ Flota base sembrada: ${result.added} agregadas, ${result.skipped} ya existían (total: ${result.total}). No se muestra en la flota visible.`,
      );
    } catch (err) {
      setFleetMsg(
        `No se pudo importar la flota: ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyTodayFleet() {
    setBusy(true);
    setFleetMsg(null);
    try {
      const result = await applyTodayFleet();
      setFleetMsg(
        `✅ Flota de hoy aplicada: ${result.updated} unidades actualizadas, ${result.added} agregadas (total: ${result.total})${result.cleared > 0 ? `, ${result.cleared} fuera de flota` : ""}.`,
      );
    } catch (err) {
      setFleetMsg(
        `No se pudo aplicar la flota de hoy: ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyHistoricalData() {
    setBusy(true);
    setFleetMsg(null);
    try {
      const result = await applyHistoricalData();
      setFleetMsg(
        `✅ Datos históricos aplicados: ${result.updated} unidades rellenadas (${result.soat} SOAT, ${result.revision} R. técnica, ${result.nextService} próximo servicio). Solo se llenaron campos vacíos — nada se sobrescribió.`,
      );
    } catch (err) {
      setFleetMsg(
        `No se pudieron aplicar los datos históricos: ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(v: Vehicle) {
    setEditingId(v._id);
    setForm({
      unitNumber: v.unitNumber,
      mileage: v.mileage === undefined ? "" : String(v.mileage),
      clean: v.clean,
      nextMaintenance: v.nextMaintenance ?? "",
      nextServiceKm: v.nextServiceKm === undefined ? "" : String(v.nextServiceKm),
      soatExpiry: v.soatExpiry ?? "",
      revisionExpiry: v.revisionExpiry ?? "",
      observations: v.observations ?? "",
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      unitNumber: form.unitNumber.trim(),
      mileage: form.mileage === "" ? undefined : Number(form.mileage),
      clean: form.clean,
      nextMaintenance: form.nextMaintenance || undefined,
      nextServiceKm: form.nextServiceKm === "" ? undefined : Number(form.nextServiceKm),
      soatExpiry: form.soatExpiry || undefined,
      revisionExpiry: form.revisionExpiry || undefined,
      observations: form.observations.trim() || undefined,
    };
    if (!payload.unitNumber) {
      setError("El número de unidad es obligatorio.");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateVehicle({ id: editingId, ...payload });
      } else {
        await addVehicle(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la unidad");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: Id<"vehicles">, unit: string) {
    if (!window.confirm(`¿Eliminar la unidad ${unit}?`)) return;
    try {
      await deleteVehicle({ id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la unidad");
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <Logo className="h-8" badgeClassName="h-8 w-8 rounded-lg shadow-none" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Título principal: flota vinculada a la intranet */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Flota vinculada a la intranet</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            La flota visible es la que reporta la intranet. Se actualiza sola cada hora dentro
            del horario de trabajo (15:00 – 08:00, hora Perú).
            {snap ? (
              <>
                {" "}
                Último reporte: <strong className="text-foreground">{snap.fecha}</strong> ·{" "}
                {snapTotal} unidades en parqueo.
              </>
            ) : (
              " Aún no hay datos sincronizados."
            )}
          </p>
        </div>

        {/* Resumen de la flota intranet */}
        {snap && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                En parqueo
              </div>
              <div className="mt-1 text-3xl font-extrabold">🚗 {snapTotal}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Limpias
              </div>
              <div className="mt-1 text-3xl font-extrabold text-ok">✅ {snapLimpias}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sucias
              </div>
              <div className="mt-1 text-3xl font-extrabold text-warn">🧼 {snapSucias}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Por tanquear
              </div>
              <div className="mt-1 text-3xl font-extrabold text-danger">⛽ {snapPorTanquear}</div>
            </Card>
          </div>
        )}

        {/* Tabla principal: flota de la intranet */}
        <Card className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">📡 Flota en parqueo (intranet)</h2>
            <div className="flex flex-wrap items-center gap-3">
              <SyncCountdownWidget syncedAt={snap?.syncedAt} />
              {snap && (
                <Button
                  variant="outline"
                  onClick={() => downloadFlotaPdf(snap, allVehicles ?? [])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all active:scale-95 shadow-sm"
                >
                  📥 Descargar PDF
                </Button>
              )}
              {snap && (
                <span className="text-xs text-muted-foreground">
                  Sincronizado {formatLimaDateTime(snap.syncedAt)}
                </span>
              )}
            </div>
          </div>
          {snap === undefined ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : snap === null ? (
            <div className="text-sm text-muted-foreground">
              <p>
                Aún no hay sincronización desde la intranet. El workflow de GitHub Actions se
                ejecuta cada hora dentro del horario de trabajo (15:00 – 08:00, hora Perú) y envía
                el reporte automáticamente.
              </p>
              <p className="mt-2">
                Si acabas de activar la configuración, espera la próxima corrida programada o
                ejecútala manualmente desde{" "}
                <strong className="text-foreground">GitHub → Actions → “Reporte de Flota” → Run workflow</strong>.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Reporte de <strong className="text-foreground">{snap.fecha}</strong> — {snapTotal}{" "}
                unidades en parqueo (E1/E7/E12).
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge tone="muted">🚗 {snapTotal} unidades</Badge>
                <Badge tone="ok">✅ {snapLimpias} limpias</Badge>
                <Badge tone="warn">🧼 {snapSucias} sucias</Badge>
                <Badge tone="danger">⛽ {snapPorTanquear} por tanquear</Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[1150px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5">Nº unidad</th>
                      <th className="px-4 py-2.5">Parqueo</th>
                      <th className="px-4 py-2.5">RA (Contrato)</th>
                      <th className="px-4 py-2.5">Kilometraje</th>
                      <th className="px-4 py-2.5">Combustible</th>
                      <th className="px-4 py-2.5">Estado</th>
                      <th className="px-4 py-2.5">Próximo servicio</th>
                      <th className="px-4 py-2.5">SOAT</th>
                      <th className="px-4 py-2.5">Revisión técnica</th>
                      <th className="px-4 py-2.5">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.unidades.map((u) => {
                      const veh = vehicleByUnit.get(unitKey(u.unidad));
                      const maint = expiryInfo(veh?.nextMaintenance);
                      const soat = expiryInfo(veh?.soatExpiry);
                      const rev = expiryInfo(veh?.revisionExpiry);
                      return (
                        <tr
                          key={`${u.unidad}-${u.ubic}`}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-2.5 font-bold">#{u.unidad}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone="muted">{u.ubic}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            {u.ra ? (
                              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                {u.ra}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {u.km ? `${Number(u.km).toLocaleString("es-PE")} km` : "—"}
                          </td>
                          <td className="px-4 py-2.5">{u.fuel || "—"}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone={/limpio/i.test(u.estado) ? "ok" : "warn"}>
                              {u.estado}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            {veh?.nextServiceKm ? (
                              <Badge tone={veh.mileage && veh.nextServiceKm - veh.mileage <= 1500 ? "warn" : "muted"}>
                                🔧 {formatMileage(veh.nextServiceKm)}
                              </Badge>
                            ) : veh?.nextMaintenance ? (
                              <Badge tone={maint.tone === "none" ? "muted" : maint.tone}>
                                {formatDate(veh.nextMaintenance)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone={soat.tone === "none" ? "muted" : soat.tone}>
                              {formatDate(veh?.soatExpiry)}
                              {soat.tone !== "none" && ` · ${soat.label}`}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone={rev.tone === "none" ? "muted" : rev.tone}>
                              {formatDate(veh?.revisionExpiry)}
                              {rev.tone !== "none" && ` · ${rev.label}`}
                            </Badge>
                          </td>
                          <td
                            className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground"
                            title={veh?.observations}
                          >
                            {veh?.observations || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Taller — entradas y salidas sincronizadas desde la intranet */}
        <section className="mt-14">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight">🛠️ Taller — entradas y salidas</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Movimientos de taller (salida / retorno) extraídos del módulo inAndOut de la
              intranet. Se actualizan con el mismo reporte horario de la flota. Una unidad está
              en taller cuando su último movimiento no es un retorno.
            </p>
          </div>

          {snap === undefined ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Cargando movimientos…</Card>
          ) : snap === null || movimientos.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mb-3 text-4xl">🛠️</div>
              <p className="font-semibold">Sin movimientos de taller sincronizados todavía</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                El reporte horario aún no incluye el listado del módulo inAndOut. Si el taller no
                registró entradas o salidas en el último reporte, esta sección se llena sola en la
                próxima sincronización.
              </p>
            </Card>
          ) : (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Unidades en taller ahora
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-danger">🛠️ {enTaller.length}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Movimientos en el reporte
                  </div>
                  <div className="mt-1 text-3xl font-extrabold">🔁 {movimientos.length}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Última actualización
                  </div>
                  <div className="mt-1 text-3xl font-extrabold">{formatLimaDate(snap.syncedAt)}</div>
                </Card>
              </div>

              {enTaller.length > 0 && (
                <div className="mb-8 rounded-2xl border border-danger/30 bg-danger/10 p-5">
                  <h3 className="mb-3 text-sm font-bold text-danger">
                    🛠️ Unidades en taller ({enTaller.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {enTaller.map((m) => (
                      <span
                        key={m.unidad}
                        className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-card px-3 py-1.5 text-sm"
                        title={`${m.tipo} · ${m.reportId ?? "sin reporte"}`}
                      >
                        <strong>#{m.unidad}</strong>
                        <span className="text-xs text-muted-foreground">
                          {movLabel(m.tipo)} · {formatMovDate(m.fecha)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Card>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">📋 Movimientos recientes</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge tone="danger">RT Taller = en taller</Badge>
                    <Badge tone="warn">SL Salida = hacia taller</Badge>
                    <Badge tone="ok">RT Retorno = de vuelta</Badge>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5">Fecha</th>
                        <th className="px-4 py-2.5">Nº unidad</th>
                        <th className="px-4 py-2.5">Movimiento</th>
                        <th className="px-4 py-2.5">Reporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movRecientes.map((m, i) => (
                        <tr
                          key={`${m.unidad}-${m.fecha}-${m.tipo}-${i}`}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">{formatMovDate(m.fecha)}</td>
                          <td className="px-4 py-2.5 font-bold">#{m.unidad}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone={movTone(m.tipo)}>{movLabel(m.tipo)}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{m.reportId || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </section>

        {/* Catálogo de flota (base 161) — se llena con fotos poco a poco */}
        <section className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {showBaseFleet ? "🗂️ Flota base completa" : "🗂️ Catálogo de flota"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {showBaseFleet
                  ? `Las 161 unidades de la empresa (flota base). Mostrando ${catalogVehicles?.length ?? "…"} unidades. Se va completando con las fotos que se pasen (SOAT, revisión técnica, kilometraje…).`
                  : `Flota de hoy: ${catalogVehicles?.length ?? "…"} unidades del inventario diario. Con el botón “Ver flota base (161)” se ve la flota completa de la empresa.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => setShowBaseFleet((s) => !s)}
                disabled={catalogVehicles === undefined}
              >
                {showBaseFleet ? "Ver flota de hoy" : "🚗 Ver flota base (161)"}
              </Button>
              <Button variant="outline" onClick={handleApplyTodayFleet} disabled={busy}>
                {busy ? "Cargando…" : "Cargar flota de hoy"}
              </Button>
              <Button variant="outline" onClick={handleApplyHistoricalData} disabled={busy}>
                {busy ? "Cargando…" : "Rellenar datos históricos"}
              </Button>
              <Button variant="ghost" onClick={handleImportFleet} disabled={busy}>
                {busy ? "Cargando…" : "Sembrar flota base (161)"}
              </Button>
              <Button onClick={openNew}>+ Nueva unidad</Button>
            </div>
          </div>

          {/* Solo se muestran errores; el aviso de éxito (“29 unidades cargadas”) se oculta */}
          {fleetMsg?.startsWith("No se pudo") && (
            <p className="mb-8 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {fleetMsg}
            </p>
          )}

          {/* Stats del catálogo */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próximo servicio cercano (≤ 1500 km)
              </div>
              <div className="mt-1 text-3xl font-extrabold text-warn">
                {catalogVehicles === undefined ? "—" : serviceSoon}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                SOAT / R. técnica ≤ 30 días
              </div>
              <div className="mt-1 text-3xl font-extrabold text-danger">
                {catalogVehicles === undefined ? "—" : docsSoon}
              </div>
            </Card>
          </div>

          {/* Modal Pop-up para Crear / Editar Unidad */}
          {showForm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowForm(false);
                  setEditingId(null);
                  setError(null);
                }
              }}
            >
              <div
                className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl shadow-black/80 ring-1 ring-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header del Modal */}
                <div className="mb-6 flex items-start justify-between border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-14 items-center justify-center rounded-2xl bg-white/5 p-2 ring-1 ring-border/60 shadow-md">
                      <Logo className="h-8 w-auto object-contain" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-foreground">
                        {editingId ? `Editar Unidad ${form.unitNumber || ""}` : "Agregar Nueva Unidad"}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {editingId
                          ? "Actualiza kilometraje, estado de limpieza y fechas de vencimiento."
                          : "Ingresa los datos para registrar la unidad en el sistema."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setError(null);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground font-bold text-sm"
                    title="Cerrar (Esc)"
                  >
                    ✕
                  </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Número de unidad *</Label>
                    <Input
                      value={form.unitNumber}
                      onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                      placeholder="Ej: 0909"
                      required
                    />
                  </div>
                  <div>
                    <Label>Kilometraje Actual</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.mileage}
                      onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                      placeholder="Ej: 75000"
                    />
                  </div>
                  <div>
                    <Label>Próximo Servicio (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.nextServiceKm}
                      onChange={(e) => setForm({ ...form, nextServiceKm: e.target.value })}
                      placeholder="Ej: 80000"
                    />
                  </div>
                  <div>
                    <Label>Vencimiento SOAT</Label>
                    <Input
                      type="date"
                      value={form.soatExpiry}
                      onChange={(e) => setForm({ ...form, soatExpiry: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Vencimiento Revisión Técnica (RT)</Label>
                    <Input
                      type="date"
                      value={form.revisionExpiry}
                      onChange={(e) => setForm({ ...form, revisionExpiry: e.target.value })}
                    />
                  </div>

                  {error && (
                    <div className="sm:col-span-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="sm:col-span-2 mt-4 flex items-center justify-end gap-3 border-t border-border/50 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                        setError(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="px-6 font-semibold" disabled={saving}>
                      {saving ? "⏳ Guardando…" : editingId ? "💾 Guardar cambios" : "➕ Agregar unidad"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tabla del catálogo */}
          {vehicles === undefined || (showBaseFleet && allVehicles === undefined) ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Cargando unidades…</Card>
          ) : (catalogVehicles ?? []).length === 0 && !showForm ? (
            <Card className="p-10 text-center">
              <div className="mb-3 text-4xl">🚗</div>
              <p className="font-semibold">
                {showBaseFleet ? "La flota base aún no está sembrada" : "No hay flota de hoy cargada"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {showBaseFleet
                  ? "Usa el botón “Sembrar flota base (161)” para crear las 161 unidades en la base."
                  : "Carga el inventario diario para poblar el catálogo. La flota base (161 unidades) se siembra con el botón de abajo y se va completando con las fotos."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button onClick={handleApplyTodayFleet} disabled={busy}>
                  {busy ? "Cargando…" : "Cargar flota de hoy"}
                </Button>
                <Button variant="outline" onClick={handleApplyHistoricalData} disabled={busy}>
                  {busy ? "Cargando…" : "Rellenar datos históricos"}
                </Button>
                <Button variant="outline" onClick={handleImportFleet} disabled={busy}>
                  {busy ? "Cargando…" : "Sembrar flota base (161)"}
                </Button>
                <Button variant="ghost" onClick={openNew}>
                  + Nueva unidad
                </Button>
              </div>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Nº unidad</th>
                    <th className="px-4 py-3">Kilometraje</th>
                    <th className="px-4 py-3">Próximo servicio</th>
                    <th className="px-4 py-3">SOAT</th>
                    <th className="px-4 py-3">Revisión técnica</th>
                    <th className="px-4 py-3">RA (Contrato)</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(catalogVehicles ?? []).map((v) => {
                    const maint = expiryInfo(v.nextMaintenance);
                    const soat = expiryInfo(v.soatExpiry);
                    const rev = expiryInfo(v.revisionExpiry);
                    const snapUnit = snap?.unidades.find(
                      (u) => unitKey(u.unidad) === unitKey(v.unitNumber),
                    );
                    const raVal = snapUnit?.ra?.trim();
                    return (
                      <tr key={v._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold">#{v.unitNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatMileage(v.mileage)}</td>
                        <td className="px-4 py-3">
                          {v.nextServiceKm ? (
                            <span className="font-medium text-foreground">
                              {formatMileage(v.nextServiceKm)}
                              {v.mileage && v.nextServiceKm - v.mileage <= 1500 && (
                                <span className="ml-2 inline-block rounded-full bg-warn/20 px-2 py-0.5 text-xs font-semibold text-warn">
                                  {v.nextServiceKm - v.mileage <= 0 ? "⚠️ Vencido" : `en ${formatMileage(v.nextServiceKm - v.mileage)}`}
                                </span>
                              )}
                            </span>
                          ) : v.nextMaintenance ? (
                            <Badge tone={maint.tone === "none" ? "muted" : maint.tone}>
                              {formatDate(v.nextMaintenance)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={soat.tone === "none" ? "muted" : soat.tone}>
                            {formatDate(v.soatExpiry)}
                            {soat.tone !== "none" && ` · ${soat.label}`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={rev.tone === "none" ? "muted" : rev.tone}>
                            {formatDate(v.revisionExpiry)}
                            {rev.tone !== "none" && ` · ${rev.label}`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {raVal ? (
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                              {raVal}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => openEdit(v)}>
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              className="px-3 py-1 text-xs"
                              onClick={() => handleDelete(v._id, v.unitNumber)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Telegram info */}
        <Card className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">🤖 Tu bot de Telegram</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Consulta tu flota desde el celular. Comandos disponibles:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/flota</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/unidad &lt;nº&gt;</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/ayuda</code>.
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Nivel básico: cada unidad muestra número de unidad, kilometraje, estado (limpio/sucio),
            próximo mantenimiento, SOAT, revisión técnica y observaciones.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Crea tu bot con <strong className="text-foreground">@BotFather</strong> en Telegram
              (comando <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/newbot</code>) y
              guarda el token.
            </li>
            <li>
              Pon el token en <strong className="text-foreground">API Keys</strong> con el nombre{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">TELEGRAM_BOT_TOKEN</code>.
            </li>
            <li>
              Registra el webhook con tu URL de Convex:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url=&lt;CONVEX_URL&gt;/telegram-webhook
              </code>
            </li>
          </ol>
        </Card>
      </main>
    </div>
  );
}

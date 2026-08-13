import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const HELP_TEXT = [
  "🚗 <b>Flota Control — Bot de Telegram</b>",
  "",
  "Nivel básico: por cada unidad se reporta número de unidad, kilometraje, si está limpio o sucio, próximo servicio/mantenimiento, SOAT, revisión técnica y observaciones.",
  "",
  "Comandos disponibles:",
  "• /flota — lista la flota de hoy (nivel básico)",
  "• /unidad &lt;nº o texto&gt; — detalle de una unidad (ej: /unidad 42)",
  "• /ayuda — muestra esta ayuda",
].join("\n");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function expiryTag(iso?: string): string {
  const days = daysUntil(iso);
  if (days === null) return "—";
  if (days < 0) return `⚠️ vencido hace ${Math.abs(days)} días`;
  if (days === 0) return "⚠️ vence HOY";
  if (days <= 30) return `⚠️ vence en ${days} días`;
  if (days <= 60) return `🟠 vence en ${days} días`;
  return `🟢 vence en ${days} días`;
}

function unitLine(v: {
  unitNumber: string;
  clean: boolean;
  mileage?: number;
  nextMaintenance?: string;
  nextServiceKm?: number;
  soatExpiry?: string;
  revisionExpiry?: string;
  observations?: string;
}): string {
  const estado = v.clean ? "🟢 Limpio" : "🟡 Sucio";
  const km = v.mileage ? `${v.mileage.toLocaleString("es-PE")} km` : "—";
  const lines = [
    `🚗 <b>Unidad ${escapeHtml(v.unitNumber)}</b>`,
    `   Kilometraje: ${km}`,
    `   Estado: ${estado}`,
  ];
  if (v.nextServiceKm) {
    lines.push(`   Próximo servicio: a los ${v.nextServiceKm.toLocaleString("es-PE")} km`);
  }
  if (v.nextMaintenance) {
    lines.push(`   Próximo mantenimiento: ${expiryTag(v.nextMaintenance)}`);
  }
  lines.push(`   SOAT: ${expiryTag(v.soatExpiry)}`);
  lines.push(`   Revisión técnica: ${expiryTag(v.revisionExpiry)}`);
  if (v.observations) {
    lines.push(`   📝 Observaciones: ${escapeHtml(v.observations)}`);
  }
  return lines.join("\n");
}

http.route({
  path: "/ingest-flota",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.FLOTA_SYNC_SECRET;
    if (!secret) {
      return new Response("FLOTA_SYNC_SECRET no está configurado", { status: 500 });
    }
    const provided = request.headers.get("x-flota-secret");
    if (provided !== secret) {
      return new Response("No autorizado", { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("JSON inválido", { status: 400 });
    }
    const { fecha, unidades, movimientos } = body as {
      fecha?: unknown;
      unidades?: unknown;
      movimientos?: unknown;
    };
    if (typeof fecha !== "string" || !Array.isArray(unidades) || unidades.length === 0) {
      return new Response(
        "Formato inválido: espera { fecha: string, unidades: [{unidad, ubic, km, fuel, estado}] }",
        { status: 400 },
      );
    }
    const clean = unidades
      .map((u) => {
        const x = (u ?? {}) as Record<string, unknown>;
        return {
          unidad: String(x.unidad ?? ""),
          ubic: String(x.ubic ?? ""),
          km: String(x.km ?? ""),
          fuel: String(x.fuel ?? ""),
          estado: String(x.estado ?? ""),
        };
      })
      .filter((u) => u.unidad.length > 0);
    if (clean.length === 0) {
      return new Response("No hay unidades válidas en el payload", { status: 400 });
    }

    // Movimientos de taller: opcionales; se validan y limpian igual que unidades.
    const cleanMov = Array.isArray(movimientos)
      ? (movimientos as Record<string, unknown>[])
          .map((m) => {
            const x = (m ?? {}) as Record<string, unknown>;
            return {
              unidad: String(x.unidad ?? ""),
              fecha: String(x.fecha ?? ""),
              tipo: String(x.tipo ?? ""),
              reportId: x.reportId === undefined ? undefined : String(x.reportId),
            };
          })
          .filter((m) => m.unidad.length > 0 && m.tipo.length > 0)
      : [];

    const result = await ctx.runMutation(internal.intranet.upsertSnapshot, {
      fecha,
      unidades: clean,
      movimientos: cleanMov.length > 0 ? cleanMov : undefined,
    });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

function buildIntranetMessage(snap: {
  fecha: string;
  unidades: Array<{ unidad: string; ubic: string; km: string; fuel: string; estado: string }>;
}): string {
  const grupos: Record<string, typeof snap.unidades> = {};
  for (const u of snap.unidades) {
    const ubic = u.ubic || "Sin ubicación";
    if (!grupos[ubic]) grupos[ubic] = [];
    grupos[ubic].push(u);
  }
  const ordenUbic = Object.keys(grupos).sort();
  const lineas: string[] = [
    `🚗 <b>FLOTA EN PARQUEO (INTRANET)</b>`,
    `📅 <i>${escapeHtml(snap.fecha)}</i>`,
    ``,
  ];

  for (const ubic of ordenUbic) {
    const g = grupos[ubic];
    lineas.push(`📍 <b>PARQUEO ${escapeHtml(ubic)} (${g.length} autos)</b>`);
    for (const u of g) {
      const limpio = /limpio/i.test(u.estado) ? "✅" : "🧼";
      const kmNum = Number(u.km);
      const kmFormatted = Number.isFinite(kmNum) ? `${kmNum.toLocaleString("es-PE")} km` : `${escapeHtml(u.km)} km`;
      lineas.push(`▸ <b>${escapeHtml(u.unidad)}</b> · ${kmFormatted} · ${escapeHtml(u.fuel)} · ${limpio} ${escapeHtml(u.estado)}`);
    }
    lineas.push("");
  }

  const limpias = snap.unidades.filter((u) => /limpio/i.test(u.estado)).length;
  const sucias = snap.unidades.length - limpias;
  const porTanquear = snap.unidades.filter((u) => !/full/i.test(u.fuel)).length;
  lineas.push(`✅ <b>${limpias}</b> limpias · 🧼 <b>${sucias}</b> sucias · ⛽ <b>${porTanquear}</b> por tanquear`);

  return lineas.join("\n");
}

function chunkMessage(text: string, maxLen = 3800): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

http.route({
  path: "/telegram-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return new Response("TELEGRAM_BOT_TOKEN no está configurado", { status: 500 });
    }

    const update: unknown = await request.json();
    const message = (update as { message?: { chat?: { id: number }; text?: string } })?.message;
    if (!message?.text || !message.chat) return new Response("ok");

    const chatId = message.chat.id;
    const [cmd, ...rest] = message.text.trim().split(/\s+/);
    const arg = rest.join(" ");

    let reply: string;
    if (cmd === "/start" || cmd === "/ayuda" || cmd === "/help") {
      reply = HELP_TEXT;
    } else if (cmd === "/flota") {
      const snap = await ctx.runQuery(internal.intranet.getLatestSnapshotInternal, {});
      if (!snap || snap.unidades.length === 0) {
        reply = "No hay reporte de 'Flota en parqueo (intranet)' cargado aún. Ejecuta el workflow de sincronización en GitHub Actions o carga datos desde el panel. 🚗";
      } else {
        reply = buildIntranetMessage(snap);
      }
    } else if (cmd === "/unidad") {
      const snap = await ctx.runQuery(internal.intranet.getLatestSnapshotInternal, {});
      const vehicles = await ctx.runQuery(internal.vehicles.listAll, {});
      const needle = arg.toLowerCase().trim();

      const snapUnit = snap?.unidades.find(
        (u) => u.unidad.toLowerCase() === needle || u.unidad.toLowerCase().includes(needle),
      );
      const vehicleUnit = vehicles.find(
        (v) => v.unitNumber.toLowerCase() === needle || v.unitNumber.toLowerCase().includes(needle),
      );

      if (!snapUnit && !vehicleUnit) {
        reply = `No encontré la unidad "${escapeHtml(arg)}". Usa /flota para ver la lista en parqueo.`;
      } else {
        const lines: string[] = [];
        const uNum = snapUnit?.unidad || vehicleUnit?.unitNumber || arg;
        lines.push(`🚗 <b>Unidad ${escapeHtml(uNum)}</b>`);
        if (snapUnit) {
          const limpio = /limpio/i.test(snapUnit.estado) ? "✅ Limpio" : "🧼 Sucio";
          lines.push(`📍 Parqueo: <b>${escapeHtml(snapUnit.ubic)}</b>`);
          lines.push(`   Kilometraje: <b>${escapeHtml(snapUnit.km)} km</b>`);
          lines.push(`   Combustible: <b>${escapeHtml(snapUnit.fuel)}</b>`);
          lines.push(`   Estado: <b>${limpio}</b> (${escapeHtml(snapUnit.estado)})`);
        }
        if (vehicleUnit) {
          if (vehicleUnit.nextServiceKm) lines.push(`   Próximo servicio: a los ${vehicleUnit.nextServiceKm.toLocaleString("es-PE")} km`);
          if (vehicleUnit.nextMaintenance) lines.push(`   Próximo mantenimiento: ${expiryTag(vehicleUnit.nextMaintenance)}`);
          lines.push(`   SOAT: ${expiryTag(vehicleUnit.soatExpiry)}`);
          lines.push(`   Revisión técnica: ${expiryTag(vehicleUnit.revisionExpiry)}`);
          if (vehicleUnit.observations) lines.push(`   📝 Observaciones: ${escapeHtml(vehicleUnit.observations)}`);
        }
        reply = lines.join("\n");
      }
    } else {
      reply = "Comando no reconocido. Usa /ayuda para ver los comandos disponibles.";
    }

    const chunks = chunkMessage(reply);
    for (const chunk of chunks) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
      });
    }

    return new Response("ok");
  }),
});

export default http;

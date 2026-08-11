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
    const { fecha, unidades } = body as { fecha?: unknown; unidades?: unknown };
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

    const result = await ctx.runMutation(internal.intranet.upsertSnapshot, {
      fecha,
      unidades: clean,
    });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

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
      const vehicles = await ctx.runQuery(internal.vehicles.listAll, {});
      if (vehicles.length === 0) {
        reply = "No hay flota de hoy cargada. Cárgala desde el panel web (Cargar flota de hoy). 🚗";
      } else {
        reply = `🚗 <b>Flota de hoy (${vehicles.length} unidades)</b>\n\n` + vehicles.map(unitLine).join("\n\n");
      }
    } else if (cmd === "/unidad") {
      const vehicles = await ctx.runQuery(internal.vehicles.listAll, {});
      const needle = arg.toLowerCase();
      const found = vehicles.find(
        (v) => v.unitNumber.toLowerCase() === needle || v.unitNumber.toLowerCase().includes(needle),
      );
      if (!found) {
        reply = `No encontré la unidad "${arg}". Usa /flota para ver la lista completa.`;
      } else {
        reply = unitLine(found);
      }
    } else {
      reply = "Comando no reconocido. Usa /ayuda para ver los comandos disponibles.";
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: "HTML" }),
    });

    return new Response("ok");
  }),
});

export default http;

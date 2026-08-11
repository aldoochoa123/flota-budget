import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export type IntranetUnit = {
  unidad: string;
  ubic: string;
  km: string;
  fuel: string;
  estado: string;
};

const unitFields = v.object({
  unidad: v.string(),
  ubic: v.string(),
  km: v.string(),
  fuel: v.string(),
  estado: v.string(),
});

/**
 * Guarda (o reemplaza) el snapshot de la intranet para una fecha y poda el
 * historial a los últimos ~30 días (720 snapshots a razón de 1 por hora).
 * Lo llama el endpoint HTTP /ingest-flota.
 */
export const upsertSnapshot = internalMutation({
  args: {
    fecha: v.string(),
    unidades: v.array(unitFields),
  },
  handler: async (ctx, { fecha, unidades }) => {
    // Reemplaza el snapshot del mismo día si ya existe (evita duplicados en reintentos).
    const previos = await ctx.db
      .query("intranetSnapshots")
      .filter((q) => q.eq(q.field("fecha"), fecha))
      .collect();
    for (const doc of previos) {
      await ctx.db.delete(doc._id);
    }

    const id = await ctx.db.insert("intranetSnapshots", {
      fecha,
      syncedAt: Date.now(),
      unidades,
    });

    // Poda: conserva solo los 720 snapshots más recientes (~30 días a 1 por hora).
    const todos = await ctx.db
      .query("intranetSnapshots")
      .withIndex("by_syncedAt")
      .order("desc")
      .collect();
    let pruned = 0;
    for (const doc of todos.slice(720)) {
      await ctx.db.delete(doc._id);
      pruned += 1;
    }

    return { id, unidades: unidades.length, pruned };
  },
});

/** Último snapshot sincronizado desde la intranet. */
export const getLatestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const snap = await ctx.db
      .query("intranetSnapshots")
      .withIndex("by_syncedAt")
      .order("desc")
      .first();
    return snap ?? null;
  },
});

/** Historial de fechas sincronizadas (para mostrar cuándo se actualizó). */
export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("intranetSnapshots")
      .withIndex("by_syncedAt")
      .order("desc")
      .take(30);
  },
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  vehicles: defineTable({
    unitNumber: v.string(),
    mileage: v.optional(v.number()),
    clean: v.boolean(),
    nextMaintenance: v.optional(v.string()),
    nextServiceKm: v.optional(v.number()),
    soatExpiry: v.optional(v.string()),
    revisionExpiry: v.optional(v.string()),
    observations: v.optional(v.string()),
    // true = forma parte de la flota de hoy (visible); la flota base queda oculta.
    todayFleet: v.optional(v.boolean()),
    updatedAt: v.number(),
  }),
  // Snapshots diarios sincronizados desde la intranet (extraer_flota.js + GitHub Actions).
  intranetSnapshots: defineTable({
    fecha: v.string(), // etiqueta de fecha del reporte (ej: "10/08/26, 10:34 a. m.")
    syncedAt: v.number(), // timestamp de la sincronización
    unidades: v.array(
      v.object({
        unidad: v.string(),
        ubic: v.string(),
        km: v.string(),
        fuel: v.string(),
        estado: v.string(),
      }),
    ),
  }).index("by_syncedAt", ["syncedAt"]),
});

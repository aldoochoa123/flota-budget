import { v } from "convex/values";
import { internalQuery, internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { FLEET_UNITS } from "./fleetCatalog";
import { TODAY_FLEET } from "./todayFleet";
import { PAST_FLEET } from "./pastFleet";
import { AEROPUERTO_FLEET } from "./aeropuertoFleet";

const vehicleFields = {
  unitNumber: v.string(),
  plate: v.optional(v.string()),
  mileage: v.optional(v.number()),
  clean: v.boolean(),
  nextMaintenance: v.optional(v.string()),
  nextServiceKm: v.optional(v.number()),
  soatExpiry: v.optional(v.string()),
  revisionExpiry: v.optional(v.string()),
  observations: v.optional(v.string()),
};

/**
 * Flota visible: solo las unidades marcadas como flota de hoy.
 * La flota base (161 unidades) queda en la base de datos pero oculta.
 */
async function todayUnits(ctx: { db: QueryCtx["db"] }) {
  const all = await ctx.db.query("vehicles").collect();
  return all
    .filter((v) => v.todayFleet === true)
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
}

export const listVehicles = query({
  args: {},
  handler: async (ctx) => todayUnits(ctx),
});

/** Lista la flota de hoy — usada por el bot de Telegram. */
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => todayUnits(ctx),
});

/** Lista todas las unidades del catálogo base — usada por el bot de Telegram para /unidad y /placa. */
export const listAllCatalogInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("vehicles").collect();
    return all.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, "es", { numeric: true }));
  },
});

/**
 * Todas las unidades registradas (flota base 161 + flota de hoy + agregadas),
 * ordenadas por número. Se usa para el catálogo completo y para cruzar los
 * datos (mantenimiento, SOAT, revisión, observaciones) con la flota intranet.
 */
export const listAllVehicles = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("vehicles").collect();
    return all.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, "es", { numeric: true }));
  },
});

/**
 * Aplica la flota del día (formulario diario, 29 unidades).
 * Marca esas unidades como visibles (todayFleet: true) y desmarca las que ya
 * no están en el inventario de hoy.
 */
export const applyTodayFleet = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("vehicles").collect();
    const todayNumbers = new Set(TODAY_FLEET.map((e) => e.unitNumber));
    const byNumber = new Map(existing.map((v) => [v.unitNumber, v._id]));

    let added = 0;
    let updated = 0;
    let cleared = 0;
    for (const v of existing) {
      if (!todayNumbers.has(v.unitNumber) && v.todayFleet === true) {
        await ctx.db.patch(v._id, { todayFleet: false, updatedAt: Date.now() });
        cleared += 1;
      }
    }
    for (const entry of TODAY_FLEET) {
      const fields = {
        mileage: entry.mileage,
        clean: entry.clean,
        nextServiceKm: entry.nextServiceKm,
        soatExpiry: entry.soatExpiry,
        revisionExpiry: entry.revisionExpiry,
        observations: entry.observations,
        todayFleet: true,
        updatedAt: Date.now(),
      };
      const id = byNumber.get(entry.unitNumber);
      if (id) {
        await ctx.db.patch(id, fields);
        updated += 1;
      } else {
        await ctx.db.insert("vehicles", {
          unitNumber: entry.unitNumber,
          ...fields,
        });
        added += 1;
      }
    }
    return { added, updated, cleared, total: TODAY_FLEET.length };
  },
});

/**
 * Rellena SOAT, revisión técnica y próximo servicio con los datos históricos
 * de los formularios pasados. Regla del usuario: si una unidad se repite, NO
 * se sobrescribe — solo se llenan los campos que están vacíos y nunca se pisan
 * los datos existentes (ni kilometraje, ni estado, ni observaciones).
 */
export const applyHistoricalData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("vehicles").collect();
    const byNumber = new Map(existing.map((v) => [v.unitNumber, v]));

    let updated = 0;
    let plates = 0;
    let soat = 0;
    let revision = 0;
    let nextService = 0;
    let notFound = 0;
    for (const entry of PAST_FLEET) {
      const vehicle = byNumber.get(entry.unitNumber);
      if (!vehicle) {
        notFound += 1;
        continue;
      }
      const patch: Record<string, unknown> = {};
      if (entry.plate && !vehicle.plate) {
        patch.plate = entry.plate;
        plates += 1;
      }
      if (entry.soatExpiry && !vehicle.soatExpiry) {
        patch.soatExpiry = entry.soatExpiry;
        soat += 1;
      }
      if (entry.revisionExpiry && !vehicle.revisionExpiry) {
        patch.revisionExpiry = entry.revisionExpiry;
        revision += 1;
      }
      if (entry.nextServiceKm !== undefined && vehicle.nextServiceKm === undefined) {
        patch.nextServiceKm = entry.nextServiceKm;
        nextService += 1;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(vehicle._id, { ...patch, updatedAt: Date.now() });
        updated += 1;
      }
    }
    return { updated, plates, soat, revision, nextService, total: PAST_FLEET.length, notFound };
  },
});

/**
 * Siembra la flota base (161 unidades) en la base de datos, oculta
 * (todayFleet: false) con sus placas y datos enriquecidos.
 */
/**
 * Aplica la planilla "Control Inventario de Flota Aeropuerto" (31 unidades,
 * transcrita a PDF el 16/08/2026) sobre la flota base. Actualiza próximo
 * servicio, SOAT y revisión técnica de esas unidades; si una unidad de la
 * planilla aún no existe (ej: 0952), la crea oculta (flota base). Solo escribe
 * los campos que la planilla registra: nunca borra datos existentes.
 */
export const applyAeropuertoFleet = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("vehicles").collect();
    const byNumber = new Map(existing.map((v) => [v.unitNumber, v]));

    let updated = 0;
    let added = 0;
    for (const entry of AEROPUERTO_FLEET) {
      const fields: { nextServiceKm?: number; soatExpiry?: string; revisionExpiry?: string } = {};
      if (entry.nextServiceKm !== undefined) fields.nextServiceKm = entry.nextServiceKm;
      if (entry.soatExpiry) fields.soatExpiry = entry.soatExpiry;
      if (entry.revisionExpiry) fields.revisionExpiry = entry.revisionExpiry;

      const existingVehicle = byNumber.get(entry.unitNumber);
      if (existingVehicle) {
        await ctx.db.patch(existingVehicle._id, { ...fields, updatedAt: Date.now() });
        updated += 1;
      } else {
        await ctx.db.insert("vehicles", {
          unitNumber: entry.unitNumber,
          clean: true,
          todayFleet: false,
          ...fields,
          updatedAt: Date.now(),
        });
        added += 1;
      }
    }
    return { total: AEROPUERTO_FLEET.length, updated, added };
  },
});

export const importFleet = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("vehicles").collect();
    const existingNumbers = new Set(existing.map((v) => v.unitNumber));
    const pastByUnit = new Map(PAST_FLEET.map((p) => [p.unitNumber, p]));

    let added = 0;
    for (const unitNumber of FLEET_UNITS) {
      if (existingNumbers.has(unitNumber)) continue;
      const past = pastByUnit.get(unitNumber);
      await ctx.db.insert("vehicles", {
        unitNumber,
        plate: past?.plate,
        nextServiceKm: past?.nextServiceKm,
        soatExpiry: past?.soatExpiry,
        revisionExpiry: past?.revisionExpiry,
        clean: true,
        todayFleet: false,
        updatedAt: Date.now(),
      });
      added += 1;
    }
    return { added, skipped: FLEET_UNITS.length - added, total: FLEET_UNITS.length };
  },
});

export const addVehicle = mutation({
  args: vehicleFields,
  handler: async (ctx, args) => {
    await ctx.db.insert("vehicles", {
      ...args,
      todayFleet: true,
      updatedAt: Date.now(),
    });
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    ...vehicleFields,
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Unidad no encontrada");
    await ctx.db.replace(id, {
      unitNumber: fields.unitNumber,
      plate: fields.plate,
      clean: fields.clean,
      mileage: fields.mileage,
      nextMaintenance: fields.nextMaintenance,
      nextServiceKm: fields.nextServiceKm,
      soatExpiry: fields.soatExpiry,
      revisionExpiry: fields.revisionExpiry,
      observations: fields.observations,
      todayFleet: existing.todayFleet,
      updatedAt: Date.now(),
    });
  },
});

export const deleteVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Unidad no encontrada");
    await ctx.db.delete(id);
  },
});

/**
 * Importa o enriquece masivamente la flota base (161 unidades) con datos
 * extraídos del portal de reportes e inspecciones (Placa, SOAT, RT, Próximo servicio).
 */
/**
 * Aplica datos del Ticket Center (puerto 82) sobre la flota base.
 * Actualiza SOAT, RT, placa, marca, modelo, color, año y observaciones.
 * Nunca borra datos existentes: solo escribe campos que la fuente provee.
 */
export const applyRedisData = mutation({
  args: {
    unidades: v.array(
      v.object({
        unidad: v.string(),
        placa: v.optional(v.string()),
        marca: v.optional(v.string()),
        modelo: v.optional(v.string()),
        color: v.optional(v.string()),
        anyo: v.optional(v.string()),
        soat: v.optional(v.string()),
        rt: v.optional(v.string()),
        obs: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { unidades }) => applyRedisDataImpl(ctx, unidades),
});

export const applyRedisDataInternal = internalMutation({
  args: {
    unidades: v.array(
      v.object({
        unidad: v.string(),
        placa: v.optional(v.string()),
        marca: v.optional(v.string()),
        modelo: v.optional(v.string()),
        color: v.optional(v.string()),
        anyo: v.optional(v.string()),
        soat: v.optional(v.string()),
        rt: v.optional(v.string()),
        obs: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { unidades }) => applyRedisDataImpl(ctx, unidades),
});

async function applyRedisDataImpl(
  ctx: { db: any },
  unidades: { unidad: string; placa?: string; marca?: string; modelo?: string; color?: string; anyo?: string; soat?: string; rt?: string; obs?: string }[],
) {
    const existing: any[] = await ctx.db.query("vehicles").collect();
    const byNumber = new Map(existing.map((v: any) => [v.unitNumber, v]));

    let updated = 0;
    let added = 0;
    for (const entry of unidades) {
      const unitNum = entry.unidad;
      const fields: Record<string, unknown> = { updatedAt: Date.now() };
      if (entry.placa) fields.plate = entry.placa;
      if (entry.marca) fields.marca = entry.marca;
      if (entry.modelo) fields.modelo = entry.modelo;
      if (entry.color) fields.color = entry.color;
      if (entry.anyo) fields.anyoFabrica = entry.anyo;
      if (entry.soat) fields.soatExpiry = entry.soat;
      if (entry.rt) fields.revisionExpiry = entry.rt;
      if (entry.obs) fields.observations = entry.obs;

      const v: any = byNumber.get(unitNum);
      if (v) {
        await ctx.db.patch(v._id, fields);
        updated += 1;
      } else {
        await ctx.db.insert("vehicles", {
          unitNumber: unitNum,
          clean: true,
          todayFleet: false,
          ...fields,
        } as any);
        added += 1;
      }
    }
    return { total: unidades.length, updated, added };
}

export const importEnrichedFleet = mutation({
  args: {
    vehicles: v.array(
      v.object({
        unitNumber: v.string(),
        plate: v.optional(v.string()),
        mileage: v.optional(v.number()),
        clean: v.optional(v.boolean()),
        nextMaintenance: v.optional(v.string()),
        nextServiceKm: v.optional(v.number()),
        soatExpiry: v.optional(v.string()),
        revisionExpiry: v.optional(v.string()),
        observations: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { vehicles: items }) => {
    const existing = await ctx.db.query("vehicles").collect();
    const byNumber = new Map(existing.map((v) => [v.unitNumber, v]));

    let updated = 0;
    let added = 0;

    for (const item of items) {
      const existingVehicle = byNumber.get(item.unitNumber);
      const fields = {
        unitNumber: item.unitNumber,
        plate: item.plate,
        mileage: item.mileage,
        clean: item.clean ?? true,
        nextMaintenance: item.nextMaintenance,
        nextServiceKm: item.nextServiceKm,
        soatExpiry: item.soatExpiry,
        revisionExpiry: item.revisionExpiry,
        observations: item.observations,
        updatedAt: Date.now(),
      };

      if (existingVehicle) {
        // Preservar todayFleet existente
        await ctx.db.patch(existingVehicle._id, {
          ...fields,
          todayFleet: existingVehicle.todayFleet,
        });
        updated++;
      } else {
        await ctx.db.insert("vehicles", {
          ...fields,
          todayFleet: false,
        });
        added++;
      }
    }

    return { total: items.length, updated, added };
  },
});

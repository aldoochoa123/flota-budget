// Probar ejecución de updateVehicle en Convex
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('./src/convex/_generated/api.js');

const client = new ConvexHttpClient("https://artful-otter-336.convex.cloud");

async function test() {
  try {
    const list = await client.query(api.vehicles.listAllVehicles, {});
    console.log("Total vehículos:", list.length);
    if (list.length > 0) {
      const v = list[0];
      console.log("Probando updateVehicle en:", v.unitNumber, "ID:", v._id);
      
      // Intentar actualizar
      const res = await client.mutation(api.vehicles.updateVehicle, {
        id: v._id,
        unitNumber: v.unitNumber,
        plate: "TEST-123",
        clean: v.clean,
        mileage: v.mileage,
        nextMaintenance: v.nextMaintenance,
        nextServiceKm: v.nextServiceKm,
        soatExpiry: v.soatExpiry,
        revisionExpiry: v.revisionExpiry,
        observations: "Prueba de guardado"
      });
      console.log("Resultado update:", res);
    }
  } catch (err) {
    console.error("Error al actualizar:", err.message);
    if (err.data) console.error("Error data:", err.data);
  }
}

test();

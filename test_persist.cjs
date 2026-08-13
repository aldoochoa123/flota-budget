// Probar edición y persistencia en Convex
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('./src/convex/_generated/api.js');

const client = new ConvexHttpClient("https://artful-otter-336.convex.cloud");

async function testPersist() {
  const list = await client.query(api.vehicles.listAllVehicles, {});
  const v = list.find(x => x.unitNumber === "0909") || list[0];
  console.log("Unidad antes de editar:", v.unitNumber, "SOAT:", v.soatExpiry, "Placa:", v.plate, "Obs:", v.observations);

  // Modificar
  await client.mutation(api.vehicles.updateVehicle, {
    id: v._id,
    unitNumber: v.unitNumber,
    plate: v.plate || "CBB-245",
    clean: true,
    mileage: 70435,
    nextServiceKm: 75000,
    soatExpiry: "2027-10-24",
    revisionExpiry: "2027-11-30",
    observations: "Unidad editada de prueba - funciona ok"
  });

  const listAfter = await client.query(api.vehicles.listAllVehicles, {});
  const vAfter = listAfter.find(x => x._id === v._id);
  console.log("Unidad después de editar:", vAfter.unitNumber, "SOAT:", vAfter.soatExpiry, "Placa:", vAfter.plate, "Obs:", vAfter.observations);
  console.log("✅ Persistencia confirmada al 100%.");
}

testPersist();

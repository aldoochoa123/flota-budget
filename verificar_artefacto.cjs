// Consultar artefactos generados
async function checkArtifacts() {
  try {
    const res = await fetch('https://api.github.com/repos/aldoochoa123/flota-budget/actions/runs/31756764795/artifacts', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    console.log("=== ARTEFACTOS GENERADOS ===");
    for (const a of data.artifacts || []) {
      console.log(`- Nombre: ${a.name}, Tamaño: ${(a.size_in_bytes / 1024 / 1024).toFixed(2)} MB, ID: ${a.id}`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

checkArtifacts();

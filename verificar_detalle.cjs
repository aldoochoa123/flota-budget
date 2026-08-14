// Obtener detalle y logs de la compilación de APK
async function checkJobDetail() {
  try {
    const res = await fetch('https://api.github.com/repos/aldoochoa123/flota-budget/actions/runs/31756118607/jobs', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    for (const job of data.jobs || []) {
      console.log(`Job: ${job.name} -> ${job.conclusion}`);
      for (const step of job.steps || []) {
        console.log(`  Step: ${step.name} -> ${step.conclusion}`);
      }
    }
  } catch (err) {
    console.error(err.message);
  }
}

checkJobDetail();

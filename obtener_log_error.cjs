// Obtener log detallado del step fallido en GitHub Actions
async function getFailedLog() {
  try {
    const res = await fetch('https://api.github.com/repos/aldoochoa123/flota-budget/actions/runs/31754963249/jobs', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const job = data.jobs[0];
    console.log("Job:", job.name, "Status:", job.status, "Conclusion:", job.conclusion);
    for (const step of job.steps) {
      console.log(`- Step: ${step.name} (${step.conclusion})`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

getFailedLog();

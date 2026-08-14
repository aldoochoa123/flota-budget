// Obtener el log exacto de Gradle
async function getLogs() {
  try {
    const res = await fetch('https://api.github.com/repos/aldoochoa123/flota-budget/actions/runs/31756295158/jobs', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const jobId = data.jobs[0].id;
    console.log("Job ID:", jobId);
    
    // Consultar logs del job
    const logRes = await fetch(`https://api.github.com/repos/aldoochoa123/flota-budget/actions/jobs/${jobId}/logs`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const logText = await logRes.text();
    const lines = logText.split('\n');
    console.log("=== ÚLTIMAS 50 LÍNEAS DEL LOG ===");
    console.log(lines.slice(-60).join('\n'));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

getLogs();

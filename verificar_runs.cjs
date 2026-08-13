// Consultar estado de los workflow runs en GitHub
async function checkRuns() {
  try {
    const res = await fetch('https://api.github.com/repos/aldoochoa123/flota-budget/actions/runs?per_page=5', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    for (const r of data.workflow_runs || []) {
      console.log(`Run #${r.id}: ${r.name} -> Status: ${r.status}, Conclusion: ${r.conclusion}, HTML: ${r.html_url}`);
      if (r.conclusion === 'failure') {
        const jobsRes = await fetch(r.jobs_url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const jobsData = await jobsRes.json();
        for (const j of jobsData.jobs || []) {
          console.log(`  Job: ${j.name} -> Conclusion: ${j.conclusion}`);
          for (const s of j.steps || []) {
            if (s.conclusion === 'failure') {
              console.log(`    ❌ Step falló: "${s.name}" (status: ${s.status}, conclusion: ${s.conclusion})`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkRuns();

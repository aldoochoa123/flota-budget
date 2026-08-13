// Extractor masivo de historial y placas desde el nuevo portal http://168.181.8.120:81
const fs = require('fs');

async function extractFromNewPortal() {
  try {
    console.log("==================================================");
    console.log("   CONECTANDO A PORTAL http://168.181.8.120:81   ");
    console.log("==================================================");

    // 1. Login
    const getRes = await fetch('http://168.181.8.120:81/login', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const setCookie = getRes.headers.get('set-cookie') || '';
    const authCookie = setCookie.match(/laravel_session=([^;]+)/)[1];

    const html = await getRes.text();
    const tokenMatch = html.match(/window\.livewire_token\s*=\s*'([^']+)'/);
    const csrfToken = tokenMatch ? tokenMatch[1] : '';
    const loginMatches = [...html.matchAll(/wire:initial-data="([^"]+)"/g)];
    const loginData = JSON.parse(loginMatches[0][1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

    const loginPayload = {
      fingerprint: loginData.fingerprint,
      serverMemo: loginData.serverMemo,
      updates: [
        { type: "syncInput", payload: { name: "email", value: "aochoa" } },
        { type: "syncInput", payload: { name: "password", value: "6264" } },
        { type: "callMethod", payload: { id: "call_login", method: "login", params: [] } }
      ]
    };

    const postRes = await fetch(`http://168.181.8.120:81/livewire/message/${loginData.fingerprint.name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
        'X-Livewire': 'true',
        'Cookie': `laravel_session=${authCookie}`,
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(loginPayload)
    });

    const finalAuthCookie = (postRes.headers.get('set-cookie') || setCookie).match(/laravel_session=([^;]+)/)[1];
    console.log("✅ Autenticado con éxito como aochoa.");

    // 2. Obtener componente vehicle-report
    const repRes = await fetch('http://168.181.8.120:81/reporte-vehiculo', {
      headers: { 'Cookie': `laravel_session=${finalAuthCookie}`, 'User-Agent': 'Mozilla/5.0' }
    });
    const repHtml = await repRes.text();
    const repCsrf = repHtml.match(/window\.livewire_token\s*=\s*'([^']+)'/)[1];
    const repMatches = [...repHtml.matchAll(/wire:initial-data="([^"]+)"/g)];
    
    let vehicleReportData = null;
    for (const m of repMatches) {
      const parsed = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      if (parsed.fingerprint.name === 'vehicle-report') {
        vehicleReportData = parsed;
        break;
      }
    }

    if (!vehicleReportData) throw new Error("No se encontró componente vehicle-report");

    // Lista de unidades de prueba
    const testUnits = ["0871", "0909", "1063", "0745", "0863", "0898", "0921", "0955", "1012", "1050"];
    const results = {};

    console.log(`\nConsultando ${testUnits.length} unidades en la base de datos SQL Server...`);

    for (const u of testUnits) {
      const searchPayload = {
        fingerprint: vehicleReportData.fingerprint,
        serverMemo: vehicleReportData.serverMemo,
        updates: [
          { type: "syncInput", payload: { name: "search", value: u } }
        ]
      };

      const sRes = await fetch(`http://168.181.8.120:81/livewire/message/vehicle-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': repCsrf,
          'X-Livewire': 'true',
          'Cookie': `laravel_session=${finalAuthCookie}`,
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify(searchPayload)
      });

      const sText = await sRes.text();
      try {
        const sJson = JSON.parse(sText);
        const list = sJson.serverMemo?.data?.vehicles || [];
        results[u] = list;
        console.log(`▸ Unidad #${u}: ${list.length} registros encontrados. Placa: ${list[0]?.placa?.trim() || "N/A"} | Último Km: ${list[0]?.nume_kilometraje?.trim() || "N/A"} | Última fecha: ${list[0]?.fech_movi || "N/A"}`);
      } catch (e) {
        console.log(`▸ Unidad #${u}: Error parseando respuesta`);
      }
    }

    fs.writeFileSync('reporte_vehiculo_extraido.json', JSON.stringify(results, null, 2));
    console.log("\n✅ Extracción de prueba completada. Guardado en reporte_vehiculo_extraido.json");

  } catch (err) {
    console.error("Error:", err.message);
  }
}

extractFromNewPortal();

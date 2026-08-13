// Script refinado para interactuar con Livewire vehicle-report
const fs = require('fs');

async function testLivewireComponents() {
  try {
    // 1. Login
    console.log("[1] Login...");
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
    console.log("    ✅ Login OK.");

    // 2. /reporte-vehiculo
    console.log("[2] Obteniendo /reporte-vehiculo ...");
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

    if (vehicleReportData) {
      console.log("    Encontrado vehicle-report component ID:", vehicleReportData.fingerprint.id);

      for (const query of ["0909", "909", "1063", "0871", "0745", "1088"]) {
        const searchPayload = {
          fingerprint: vehicleReportData.fingerprint,
          serverMemo: vehicleReportData.serverMemo,
          updates: [
            { type: "syncInput", payload: { name: "search", value: query } }
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

        console.log(`    Status búsqueda "${query}":`, sRes.status);
        const sText = await sRes.text();
        try {
          const sJson = JSON.parse(sText);
          console.log(`    Vehicles data para "${query}":`, JSON.stringify(sJson.serverMemo?.data?.vehicles, null, 2));
          if (sJson.effects?.html) {
            console.log(`    HTML de tabla para "${query}":\n`, sJson.effects.html.slice(0, 1500));
          }
        } catch (e) {
          console.log(`    Respuesta cruda para "${query}":`, sText.slice(0, 500));
        }
      }
    }

    // 3. /registro-de-salida
    console.log("[3] Accediendo a /registro-de-salida ...");
    const salRes = await fetch('http://168.181.8.120:81/registro-de-salida', {
      headers: { 'Cookie': `laravel_session=${finalAuthCookie}`, 'User-Agent': 'Mozilla/5.0' }
    });
    const salHtml = await salRes.text();
    fs.writeFileSync('registro_salida.html', salHtml);
    console.log("    Guardado registro_salida.html (status:", salRes.status, "longitud:", salHtml.length, ")");

    // 4. /inspecciones
    console.log("[4] Accediendo a /inspecciones ...");
    const inspRes = await fetch('http://168.181.8.120:81/inspecciones', {
      headers: { 'Cookie': `laravel_session=${finalAuthCookie}`, 'User-Agent': 'Mozilla/5.0' }
    });
    const inspHtml = await inspRes.text();
    fs.writeFileSync('inspecciones.html', inspHtml);
    console.log("    Guardado inspecciones.html (status:", inspRes.status, "longitud:", inspHtml.length, ")");

  } catch (err) {
    console.error("Error en test:", err);
  }
}

testLivewireComponents();

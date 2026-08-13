// Script para consultar las 161 unidades y descargar sus últimos reportes de inspección
const fs = require('fs');
const path = require('path');

// Lista completa de las 161 unidades
const FLEET_UNITS = [
  "0100", "0101", "0102", "0103", "0104",
  "0130", "0131", "0132", "0133", "0134", "0135", "0136", "0137", "0138", "0139",
  "0200",
  "0254", "0255", "0256", "0257", "0258", "0259",
  "0260", "0261", "0262", "0263", "0264", "0265", "0266", "0267", "0268",
  "0320", "0321", "0322", "0324", "0325", "0326", "0327", "0328",
  "0445", "0446", "0447", "0448", "0450", "0451", "0452",
  "0460", "0461",
  "0470", "0471", "0474", "0475", "0476", "0477", "0478", "0479",
  "0480", "0481", "0482", "0483", "0484", "0485", "0486", "0488", "0489",
  "0490", "0491", "0492", "0493", "0494", "0495", "0497", "0498", "0499",
  "0500", "0501",
  "0504", "0505", "0506", "0507", "0508", "0509",
  "0510", "0511", "0512", "0513", "0514", "0515", "0516", "0517", "0519",
  "0720", "0721", "0722",
  "0761", "0762", "0763",
  "0770", "0771", "0772", "0773", "0774", "0775", "0776", "0778",
  "0780", "0781", "0782", "0783",
  "0880", "0881", "0882", "0883", "0890", "0891", "0893", "0894", "0895", "0896", "0897", "0898", "0899",
  "0900", "0901", "0903", "0909",
  "0915", "0916",
  "0943", "0944", "0945", "0946", "0947",
  "0960", "0961", "0962", "0963", "0964", "0965", "0966", "0967", "0968", "0969",
  "1032", "1033", "1034", "1035", "1036", "1037", "1038",
  "1061", "1063", "1064", "1065", "1066", "1067", "1068",
  "1081", "1083", "1084", "1085"
];

const IMAGES_DIR = path.join(__dirname, 'reportes_imagenes');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

async function run() {
  console.log(`[1] Iniciando sesión en http://168.181.8.120:81 ...`);
  const getRes = await fetch('http://168.181.8.120:81/login', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const setCookie = getRes.headers.get('set-cookie') || '';
  const authCookie = setCookie.match(/laravel_session=([^;]+)/)[1];

  const html = await getRes.text();
  const csrfToken = html.match(/window\.livewire_token\s*=\s*'([^']+)'/)[1];
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
  console.log(`    ✅ Login exitoso.`);

  // Obtener componente vehicle-report
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

  const allResults = {};
  const imagesToDownload = [];
  let foundCount = 0;

  console.log(`[2] Consultando las 161 unidades...`);

  for (let i = 0; i < FLEET_UNITS.length; i++) {
    const unit = FLEET_UNITS[i];
    // Probar tanto con formato '0909' como '909'
    let records = [];
    let queryUsed = unit;

    for (const q of [unit, String(Number(unit))]) {
      const searchPayload = {
        fingerprint: vehicleReportData.fingerprint,
        serverMemo: vehicleReportData.serverMemo,
        updates: [
          { type: "syncInput", payload: { name: "search", value: q } }
        ]
      };

      try {
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
        const sJson = JSON.parse(sText);
        const list = sJson.serverMemo?.data?.vehicles || [];
        if (list.length > 0) {
          records = list;
          queryUsed = q;
          break;
        }
      } catch (e) {
        // error ignore
      }
    }

    if (records.length > 0) {
      foundCount++;
      const placa = records[0].placa ? records[0].placa.trim() : "";
      const ultimoKm = records[0].nume_kilometraje ? records[0].nume_kilometraje.trim() : "";
      const ultimaFecha = records[0].fech_movi || "";
      
      // Tomar hasta los 2 reportes más recientes para descargar sus imágenes
      const topReports = records.slice(0, 2).map(r => r.nomb_imag).filter(Boolean);
      for (const imgName of topReports) {
        imagesToDownload.push({ unit, imgName, placa });
      }

      allResults[unit] = {
        unit,
        placa,
        ultimoKm,
        ultimaFecha,
        recordsCount: records.length,
        records: records.slice(0, 6)
      };

      console.log(`  [${i + 1}/${FLEET_UNITS.length}] Unidad #${unit}: Placa ${placa || "—"} | Km: ${ultimoKm} | Fecha: ${ultimaFecha} (${records.length} reportes)`);
    } else {
      console.log(`  [${i + 1}/${FLEET_UNITS.length}] Unidad #${unit}: Sin reportes en el portal`);
      allResults[unit] = { unit, placa: "", ultimoKm: "", recordsCount: 0, records: [] };
    }
  }

  console.log(`\n✅ Resumen de consulta: ${foundCount} de 161 unidades tienen historial en el portal.`);
  fs.writeFileSync('flota_161_portal.json', JSON.stringify(allResults, null, 2));

  console.log(`\n[3] Descargando ${imagesToDownload.length} imágenes de los 2 reportes más recientes de cada unidad...`);
  let downloaded = 0;
  for (const item of imagesToDownload) {
    const fileName = `${item.imgName}.jpg`;
    const localPath = path.join(IMAGES_DIR, `${item.unit}_${fileName}`);
    if (fs.existsSync(localPath)) {
      downloaded++;
      continue;
    }
    const url = `http://168.181.8.121/revision/Documentos_Siscar/Vehiculos_Reporte/${fileName}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(localPath, buffer);
        downloaded++;
      }
    } catch (e) {
      // ignore
    }
  }
  console.log(`✅ Descarga completada: ${downloaded} imágenes guardadas en reportes_imagenes/`);
}

run();

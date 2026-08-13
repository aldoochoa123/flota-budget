// Probar descarga de imagen de reporte desde http://168.181.8.121/
const fs = require('fs');

async function testImageFetch() {
  const testImages = [
    'RV1063-0078.jpg',
    'RV1063-0077.jpg',
    'RV0909-0074.jpg',
    'RV0871-0040.jpg'
  ];

  for (const img of testImages) {
    const url = `http://168.181.8.121/revision/Documentos_Siscar/Vehiculos_Reporte/${img}`;
    console.log(`Descargando ${url} ...`);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      });
      console.log(`Status ${img}:`, res.status, res.statusText);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        console.log(`Longitud buffer: ${buffer.length} bytes`);
        fs.writeFileSync(img, buffer);
        console.log(`Guardado ${img}`);
      }
    } catch (e) {
      console.error(`Error descargando ${img}:`, e.message);
    }
  }
}

testImageFetch();

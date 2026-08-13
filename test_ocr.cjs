const { createWorker } = require('tesseract.js');
const fs = require('fs');

async function testOCR() {
  console.log("Iniciando worker de Tesseract (idioma español)...");
  const worker = await createWorker('spa');
  
  const testImages = ['RV0871-0040.jpg', 'RV0909-0074.jpg', 'RV1063-0078.jpg'];
  for (const img of testImages) {
    console.log(`\n=== Procesando OCR en ${img} ===`);
    const ret = await worker.recognize(img);
    console.log("Texto detectado:\n", ret.data.text);
  }

  await worker.terminate();
}

testOCR();

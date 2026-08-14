// Verificar dimensiones y propiedades de logo.png
const fs = require('fs');

const buf = fs.readFileSync('public/logo.png');
console.log('Tamaño en bytes:', buf.length);
if (buf.toString('ascii', 1, 4) === 'PNG') {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  console.log(`Dimensiones de public/logo.png: ${width}x${height}`);
}

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function buildIcons() {
  console.log("Generando íconos y splash screens con logo de Budget...");

  const logoPath = path.join(__dirname, 'public', 'logo.png');
  const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

  // Cargar logo original (1688x396)
  // Crear un icono cuadrado 512x512 con fondo Budget Dark (#09090b) y logo centrado
  const logoResized = await sharp(logoPath)
    .resize({ width: 380, height: 260, fit: 'inside' })
    .toBuffer();

  const squareIconBuffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 9, g: 9, b: 11, alpha: 1 } // #09090b
    }
  })
    .composite([
      {
        input: logoResized,
        gravity: 'center'
      }
    ])
    .png()
    .toBuffer();

  // Guardar icono cuadrado para PWA en public/icon-512.png
  fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.png'), squareIconBuffer);
  
  const icon192 = await sharp(squareIconBuffer).resize(192, 192).toBuffer();
  fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.png'), icon192);

  // Generar mipmaps para Android
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(resDir, m.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png
    await sharp(squareIconBuffer)
      .resize(m.size, m.size)
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(squareIconBuffer)
      .resize(m.size, m.size)
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (logo centrado transparente para adaptive icon)
    const fgLogo = await sharp(logoPath)
      .resize({ width: Math.round(m.fgSize * 0.7), height: Math.round(m.fgSize * 0.5), fit: 'inside' })
      .toBuffer();

    await sharp({
      create: {
        width: m.fgSize,
        height: m.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: fgLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
  }

  // Generar Splash screens (pantalla de inicio de la app con el logo)
  const splashDirs = [
    { dir: 'drawable', w: 480, h: 800 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const s of splashDirs) {
    const targetDir = path.join(resDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const splashLogo = await sharp(logoPath)
      .resize({ width: Math.round(Math.min(s.w, s.h) * 0.65), height: Math.round(Math.min(s.w, s.h) * 0.3), fit: 'inside' })
      .toBuffer();

    await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: { r: 9, g: 9, b: 11, alpha: 1 } // #09090b
      }
    })
      .composite([{ input: splashLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));
  }

  console.log("✅ Todos los íconos de Budget y Splash screens fueron generados con éxito.");
}

buildIcons().catch(console.error);

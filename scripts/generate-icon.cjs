// Generates Windows .ico and runtime PNGs from public/mini-logo.svg.
// Windows needs 16/24/32/48/64/128/256 for taskbar, alt-tab, NSIS installer,
// and .exe properties. Tray/window icons in main.js read mushu-icon.png.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const toIco = require("to-ico");

const SOURCE = path.join(__dirname, "..", "public", "logo.svg");
const ICO_OUT = path.join(__dirname, "..", "build", "icon.ico");
const PNG_TRAY_OUT = path.join(__dirname, "..", "public", "mushu-icon.png");
const PNG_LOGO_OUT = path.join(__dirname, "..", "public", "mushu-logo.png");
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function renderSvg(size) {
  return sharp(SOURCE, { density: 384 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

(async () => {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source SVG not found: ${SOURCE}`);
    process.exit(1);
  }

  const icoBuffers = await Promise.all(ICO_SIZES.map(renderSvg));
  const ico = await toIco(icoBuffers);
  fs.mkdirSync(path.dirname(ICO_OUT), { recursive: true });
  fs.writeFileSync(ICO_OUT, ico);
  console.log(`OK ${ICO_OUT} (${ICO_SIZES.join(", ")}px) — ${ico.length} bytes`);

  const trayPng = await renderSvg(256);
  fs.writeFileSync(PNG_TRAY_OUT, trayPng);
  console.log(`OK ${PNG_TRAY_OUT} (256px) — ${trayPng.length} bytes`);

  const logoPng = await renderSvg(512);
  fs.writeFileSync(PNG_LOGO_OUT, logoPng);
  console.log(`OK ${PNG_LOGO_OUT} (512px) — ${logoPng.length} bytes`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

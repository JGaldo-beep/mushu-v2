// Generates Windows .ico and runtime PNGs from public/mini-logo.svg.
// Windows needs 16/24/32/48/64/128/256 for taskbar, alt-tab, NSIS installer,
// and .exe properties. Tray/window icons in main.js read mushu-icon.png.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const toIco = require("to-ico");

const SOURCE = path.join(__dirname, "..", "public", "mini-logo.svg");
// Flat variant for small sizes: the glass highlights of SOURCE turn to mud below ~48px.
const SOURCE_SMALL = path.join(__dirname, "..", "public", "icon-small.svg");
const SMALL_MAX = 32;
const ICO_OUT = path.join(__dirname, "..", "build", "icon.ico");
const PNG_TRAY_OUT = path.join(__dirname, "..", "public", "mushu-icon.png");
const PNG_LOGO_OUT = path.join(__dirname, "..", "public", "mushu-logo.png");
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function renderSvg(size, source = size <= SMALL_MAX ? SOURCE_SMALL : SOURCE) {
  return sharp(source, { density: 384 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

(async () => {
  for (const source of [SOURCE, SOURCE_SMALL]) {
    if (!fs.existsSync(source)) {
      console.error(`Source SVG not found: ${source}`);
      process.exit(1);
    }
  }

  const icoBuffers = await Promise.all(ICO_SIZES.map((size) => renderSvg(size)));
  const ico = await toIco(icoBuffers);
  fs.mkdirSync(path.dirname(ICO_OUT), { recursive: true });
  fs.writeFileSync(ICO_OUT, ico);
  console.log(`OK ${ICO_OUT} (${ICO_SIZES.join(", ")}px) — ${ico.length} bytes`);

  // The tray shows this at 16-24px, so it is drawn from the small variant.
  const trayPng = await renderSvg(256, SOURCE_SMALL);
  fs.writeFileSync(PNG_TRAY_OUT, trayPng);
  console.log(`OK ${PNG_TRAY_OUT} (256px) — ${trayPng.length} bytes`);

  const logoPng = await renderSvg(512);
  fs.writeFileSync(PNG_LOGO_OUT, logoPng);
  console.log(`OK ${PNG_LOGO_OUT} (512px) — ${logoPng.length} bytes`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

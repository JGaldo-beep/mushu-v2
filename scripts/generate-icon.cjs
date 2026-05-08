// Genera build/icon.ico multi-resolución desde public/mushu-logo.png.
// Windows necesita 16/24/32/48/64/128/256 para mostrar el ícono bien
// en taskbar, alt-tab, instalador NSIS y propiedades del .exe.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const toIco = require("to-ico");

const SOURCE = path.join(__dirname, "..", "public", "mushu-logo.png");
const OUT = path.join(__dirname, "..", "build", "icon.ico");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  if (!fs.existsSync(SOURCE)) {
    console.error(`No se encontró el PNG fuente: ${SOURCE}`);
    process.exit(1);
  }
  const buffers = await Promise.all(
    SIZES.map((size) =>
      sharp(SOURCE).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    ),
  );
  const ico = await toIco(buffers);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, ico);
  console.log(`OK ${OUT} (${SIZES.join(", ")}px) – ${ico.length} bytes`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

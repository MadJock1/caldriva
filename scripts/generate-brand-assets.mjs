// Generates the reusable Caldriva brand assets from the canonical emblem
// geometry in src/lib/logo-mark.json. Re-run with: node scripts/generate-brand-assets.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mark = JSON.parse(readFileSync(join(root, "src/lib/logo-mark.json"), "utf8"));

const [minX, minY, maxX, maxY] = mark.bounds;
const MARGIN = 10;
const round = (value) => Math.round(value * 1000) / 1000;
const tightW = maxX - minX + MARGIN * 2;
const tightH = maxY - minY + MARGIN * 2;
const ASPECT = tightW / tightH;
const tightViewBox = [round(minX - MARGIN), round(minY - MARGIN), round(tightW), round(tightH)].join(" ");

const COLOR = {
  blue: "#4F8CFF",
  white: "#F8FAFC",
  graphite: "#121924",
  textDark: "#F8FAFC",
  textDarkMuted: "#A8B5C8",
  textLight: "#0F172A",
  textLightMuted: "#475569",
  tile: "#0B1018",
  tileBorder: "#1B2533",
};

const FONT = "Manrope, Inter, 'Helvetica Neue', Arial, sans-serif";
const LABEL = "CALDRIVA Engineering & Technology";
const NAME = "CALDRIVA";
const DESCRIPTOR = "ENGINEERING & TECHNOLOGY";

const esc = (s) => s.replace(/&/g, "&amp;");

function symbol(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tightViewBox}" fill="none" role="img" aria-label="${esc(LABEL)}"><title>${esc(NAME)}</title><path d="${mark.path}" fill="${color}"/></svg>\n`;
}

// Places the emblem as a nested SVG of the given `height`, centred horizontally
// inside a box of `boxWidth` that starts at `x` (the artwork keeps its aspect).
function emblemAt(x, y, height, boxWidth = null, color = COLOR.blue) {
  const width = height * ASPECT;
  const left = boxWidth === null ? x : x + (boxWidth - width) / 2;
  return `<svg x="${round(left)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" viewBox="${tightViewBox}"><path d="${mark.path}" fill="${color}"/></svg>`;
}

function horizontal({ word, muted }) {
  const eh = 256, ew = eh * ASPECT, textX = round(ew + 56);
  const width = round(textX + 744);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 256" fill="none" role="img" aria-label="${esc(LABEL)}"><title>${esc(NAME)}</title>${emblemAt(0, 0, eh)}<text x="${textX}" y="142" font-family="${FONT}" font-size="104" font-weight="700" letter-spacing="8" fill="${word}">${NAME}</text><text x="${round(textX + 2)}" y="186" font-family="${FONT}" font-size="32" font-weight="500" letter-spacing="6" fill="${muted}">${esc(DESCRIPTOR)}</text></svg>\n`;
}

function stacked({ word, muted }) {
  const eh = 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 470" fill="none" role="img" aria-label="${esc(LABEL)}"><title>${esc(NAME)}</title>${emblemAt(0, 0, eh, 880)}<text x="440" y="368" text-anchor="middle" font-family="${FONT}" font-size="128" font-weight="700" letter-spacing="10" fill="${word}">${NAME}</text><text x="440" y="428" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="500" letter-spacing="8" fill="${muted}">${esc(DESCRIPTOR)}</text></svg>\n`;
}

function iconSvg(size, radius, pad) {
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(NAME)}"><title>${esc(NAME)}</title><rect width="${size}" height="${size}" rx="${radius}" fill="${COLOR.tile}"/><rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${radius}" fill="none" stroke="${COLOR.tileBorder}"/>${emblemAt(pad, pad, inner, inner)}</svg>\n`;
}

const brandDir = join(root, "public/brand");
mkdirSync(brandDir, { recursive: true });

writeFileSync(join(brandDir, "caldriva-symbol.svg"), symbol(COLOR.blue));
writeFileSync(join(brandDir, "caldriva-symbol-white.svg"), symbol(COLOR.white));
writeFileSync(join(brandDir, "caldriva-symbol-graphite.svg"), symbol(COLOR.graphite));
writeFileSync(join(brandDir, "caldriva-logo-horizontal.svg"), horizontal({ word: COLOR.textDark, muted: COLOR.textDarkMuted }));
writeFileSync(join(brandDir, "caldriva-logo-horizontal-light.svg"), horizontal({ word: COLOR.textLight, muted: COLOR.textLightMuted }));
writeFileSync(join(brandDir, "caldriva-logo-stacked.svg"), stacked({ word: COLOR.textDark, muted: COLOR.textDarkMuted }));
writeFileSync(join(brandDir, "caldriva-logo-stacked-light.svg"), stacked({ word: COLOR.textLight, muted: COLOR.textLightMuted }));

const iconPath = join(root, "src/app/icon.svg");
writeFileSync(iconPath, iconSvg(64, 14, 12));

const raster = async (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

const icon512 = await raster(iconSvg(512, 112, 96), 512);
writeFileSync(join(brandDir, "caldriva-icon-512.png"), icon512);

const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="${COLOR.tile}"/>${emblemAt(0, 34, 112, 180)}</svg>`;
writeFileSync(join(root, "src/app/apple-icon.png"), await raster(appleSvg, 180));

const icoSizes = [16, 32, 48];
const entries = [];
for (const size of icoSizes) entries.push({ size, png: await raster(iconSvg(64, 14, 12), size) });

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
const directory = Buffer.alloc(16 * entries.length);
let offset = 6 + 16 * entries.length;
entries.forEach((entry, index) => {
  const base = index * 16;
  const dim = entry.size >= 256 ? 0 : entry.size;
  directory.writeUInt8(dim, base);
  directory.writeUInt8(dim, base + 1);
  directory.writeUInt8(0, base + 2);
  directory.writeUInt8(0, base + 3);
  directory.writeUInt16LE(1, base + 4);
  directory.writeUInt16LE(32, base + 6);
  directory.writeUInt32LE(entry.png.length, base + 8);
  directory.writeUInt32LE(offset, base + 12);
  offset += entry.png.length;
});
writeFileSync(join(root, "src/app/favicon.ico"), Buffer.concat([header, directory, ...entries.map((e) => e.png)]));

console.log("Brand assets generated in public/brand and src/app (icon.svg, apple-icon.png, favicon.ico).");

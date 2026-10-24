// Dependency-free PWA icon generator: rasterises the Oketex logo mark
// (dark square, orange border, white roof chevron, orange ridge line —
// the same geometry as public/favicon.svg) into PNG icons using only
// node:zlib. Run: node scripts/gen-pwa-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = row + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const DARK = [0x21, 0x21, 0x21, 255];
const ORANGE = [0xff, 0x60, 0x26, 255];
const WHITE = [0xf5, 0xf5, 0xf5, 255];

// Geometry in the favicon's 0..64 viewBox (scaled to 0..1 here).
function pixel(u, v) {
  const x = u * 64, y = v * 64;
  // Orange border ring: rect inset 4, stroke 4.
  const inBorderBand = (x >= 2 && x <= 62 && y >= 2 && y <= 62) && !(x > 6 && x < 58 && y > 6 && y < 58);
  if (inBorderBand) return ORANGE;
  // Roof chevron: M14 42 L32 20 L50 42, stroke 5 — distance to segments.
  const dSeg = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };
  if (Math.min(dSeg(x, y, 14, 42, 32, 20), dSeg(x, y, 32, 20, 50, 42)) <= 2.6) return WHITE;
  // Ridge line: y=38, x 22..42, stroke 3.
  if (x >= 22 && x <= 42 && Math.abs(y - 38) <= 1.6) return ORANGE;
  return DARK;
}

for (const size of [192, 512]) {
  const out = `public/icons/icon-${size}.png`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(size, pixel));
  console.log(`wrote ${out}`);
}

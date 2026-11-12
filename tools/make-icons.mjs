// Generates the ComPrep 12 app icons as PNG files with no dependencies.
// Usage: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- PNG encoding -------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Drawing (coverage by supersampling) --------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG_A = hex('#17656F'), BG_B = hex('#0B3940');
const RING = hex('#FFFFFF'), BAR = hex('#F4A93B');

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function draw(size, { maskable = false, rounded = false }) {
  const s = maskable ? 0.72 : 1; // shrink artwork into the maskable safe zone
  const bars = [[0.39, 0.12], [0.5, 0.19], [0.61, 0.26]];
  const SS = 4;
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgCov = 0, ringCov = 0, barCov = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) / size, y = (py + (sy + 0.5) / SS) / size;
        const inBg = rounded ? inRoundRect(x, y, 0, 0, 1, 1, 0.22) : true;
        if (!inBg) continue;
        bgCov++;
        // artwork in un-scaled coordinates
        const ux = 0.5 + (x - 0.5) / s, uy = 0.5 + (y - 0.5) / s;
        const dx = ux - 0.5, dy = uy - 0.5, d = Math.hypot(dx, dy);
        let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360; // 0 = top, clockwise
        if (d >= 0.27 && d <= 0.33 && ang <= 290) ringCov++;
        else if (bars.some(([cx, h]) => inRoundRect(ux, uy, cx - 0.04, 0.63 - h, cx + 0.04, 0.63, 0.02))) barCov++;
      }
      const n = SS * SS, i = (py * size + px) * 4;
      const t = (px + py) / (2 * size);
      let c = BG_A.map((a, k) => a + (BG_B[k] - a) * t);
      const rc = ringCov / Math.max(bgCov, 1), bc = barCov / Math.max(bgCov, 1);
      c = c.map((v, k) => v * (1 - rc - bc) + RING[k] * rc + BAR[k] * bc);
      out[i] = Math.round(c[0]); out[i + 1] = Math.round(c[1]); out[i + 2] = Math.round(c[2]);
      out[i + 3] = Math.round(255 * bgCov / n);
    }
  }
  return png(size, out);
}

const jobs = [
  ['icon-180.png', 180, {}],                       // apple-touch-icon: full bleed, iOS rounds it
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['icon-maskable-192.png', 192, { maskable: true }],
];
for (const [name, size, opts] of jobs) {
  writeFileSync(join(OUT, name), draw(size, opts));
  console.log('wrote icons/' + name);
}

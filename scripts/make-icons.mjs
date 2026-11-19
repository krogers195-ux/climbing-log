// Generates PNG app icons (Sea Blue background, Lemonade sun, cream mountains)
// with no dependencies: rasterises simple shapes and encodes PNG via zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SEA = hex('#0F4E77'), LEMON = hex('#FBD271'), CREAM = hex('#FBF5EC'), HONEY = hex('#E7BD8B'), MATCHA = hex('#89A377');

function inTri(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (p1x, p1y, p2x, p2y, p3x, p3y) => (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
  const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function render(size, pad = 0) {
  const SS = 3; // supersampling
  const px = Buffer.alloc(size * size * 4);
  const shape = (u, v) => {
    // u,v in 0..1 within the safe area
    const sx = (u - 0.68), sy = (v - 0.3);
    if (inTri(u, v, [0.02, 0.86], [0.38, 0.34], [0.7, 0.86])) return CREAM;
    if (inTri(u, v, [0.36, 0.86], [0.66, 0.48], [0.98, 0.86])) return HONEY;
    if (v > 0.86 && v < 0.93 && u > 0.02 && u < 0.98) return MATCHA;
    if (sx * sx + sy * sy < 0.016) return LEMON;
    return null;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const fx = (x + (i + 0.5) / SS) / size, fy = (y + (j + 0.5) / SS) / size;
      const u = (fx - pad) / (1 - 2 * pad), v = (fy - pad) / (1 - 2 * pad);
      const c = (u >= 0 && u <= 1 && v >= 0 && v <= 1 && shape(u, v)) || SEA;
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = (y * size + x) * 4, n = SS * SS;
    px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n; px[o + 3] = 255;
  }
  return png(size, size, px);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// 20% padding keeps the art inside the maskable safe zone
writeFileSync('public/icon-192.png', render(192, 0.2));
writeFileSync('public/icon-512.png', render(512, 0.2));
writeFileSync('public/apple-touch-icon.png', render(180, 0.14));
console.log('icons written');

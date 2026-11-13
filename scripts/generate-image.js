#!/usr/bin/env node
/**
 * Generates the test image: a 3840×2160 "aurora" PNG (~20 MB).
 *
 * A smooth gradient alone would compress to a few kilobytes, which is useless
 * for a speed test, so a layer of film grain is added. Grain is random and
 * therefore incompressible: the file stays big on disk and on the wire, while
 * still looking like a picture rather than TV static.
 *
 * Usage: node scripts/generate-image.js [out.png] [width] [height]
 */
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const [out = 'aurora-4k.png', w = '3840', h = '2160'] = process.argv.slice(2);
const W = Number(w);
const H = Number(h);

// Deterministic PRNG so the file is reproducible byte-for-byte.
let seed = 0x9e3779b9;
const rand = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
};

const clamp = (x) => (x < 0 ? 0 : x > 255 ? 255 : x | 0);
const raw = Buffer.alloc((W * 3 + 1) * H);

for (let y = 0; y < H; y++) {
  const row = y * (W * 3 + 1);
  raw[row] = 0; // PNG filter: none
  const v = y / H;
  for (let x = 0; x < W; x++) {
    const u = x / W;
    // Night sky base.
    let r = 8 + 20 * v;
    let g = 10 + 15 * v;
    let b = 30 + 40 * v;
    // Stars (sparse, only in the upper sky).
    if (v < 0.75 && rand() < 0.0009) {
      const s = 120 + rand() * 135;
      r += s;
      g += s;
      b += s;
    }
    // Two aurora curtains: sharp lower edge, long soft rays going up.
    for (const [amp, freq, phase, center, cr, cg, cb] of [
      [0.07, 5.0, 0.0, 0.50, 40, 255, 150],
      [0.05, 8.0, 1.7, 0.36, 170, 70, 255],
    ]) {
      const curve = center + amp * Math.sin(u * freq + phase) + 0.025 * Math.sin(u * 19 + phase * 3);
      const d = v - curve;
      const profile = d > 0 ? Math.exp(-((d / 0.018) ** 2)) : Math.exp(d / 0.16);
      const rays = 0.55 + 0.25 * Math.sin(u * 180 + 4 * Math.sin(u * 11 + phase)) + 0.2 * Math.sin(u * 47 + phase);
      const fade = 0.6 + 0.4 * Math.sin(u * 3.1 + phase * 2);
      const glow = profile * rays * fade;
      r += cr * glow;
      g += cg * glow;
      b += cb * glow;
    }
    // Mountains silhouette.
    const ridge = 0.84 - 0.06 * Math.sin(u * 7) - 0.04 * Math.sin(u * 17 + 1) - 0.015 * Math.sin(u * 53);
    if (v > ridge) {
      r = 16;
      g = 18;
      b = 30;
    }
    // Film grain: luminance + a little per-channel chroma noise.
    const n = (rand() - 0.5) * 40;
    const p = row + 1 + x * 3;
    raw[p] = clamp(r + n + (rand() - 0.5) * 24);
    raw[p + 1] = clamp(g + n + (rand() - 0.5) * 24);
    raw[p + 2] = clamp(b + n + (rand() - 0.5) * 24);
  }
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(out, png);
console.log(`${out}: ${W}×${H}, ${(png.length / 1e6).toFixed(1)} MB`);

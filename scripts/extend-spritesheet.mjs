/**
 * extend-spritesheet.mjs  v3
 *
 * Adds walk-up/walk-down frames (4-7) that are pixel-for-pixel the same
 * size and position as the existing character in frames 0-3.
 *
 * The character occupies exactly:  x=20-37 (18 px wide), y=27-55 (29 px tall)
 * within each 48×64 frame.  New frames are drawn within that same bounding box.
 *
 * Run:  node scripts/extend-spritesheet.mjs
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const PATH = ROOT + '/public/assets/sprites/yotam.png';
const FW = 48, FH = 64;

// ── Load & probe frame 0 to get exact char bounds + colours ──────────────────
const src  = await loadImage(readFileSync(PATH));
const prob = createCanvas(FW, FH);
const pctx = prob.getContext('2d');
pctx.drawImage(src, 0, 0);
const pd = pctx.getImageData(0, 0, FW, FH).data;

// Compute bounding box of opaque pixels in frame 0
let tY = FH, bY = 0, lX = FW, rX = 0;
for (let y = 0; y < FH; y++) {
  for (let x = 0; x < FW; x++) {
    if (pd[(y * FW + x) * 4 + 3] > 20) {
      if (y < tY) tY = y;
      if (y > bY) bY = y;
      if (x < lX) lX = x;
      if (x > rX) rX = x;
    }
  }
}
const CW = rX - lX + 1;   // character width  (18)
const CH = bY - tY + 1;   // character height (29)
const MX = lX;            // left edge of character in frame
const MY = tY;            // top  edge of character in frame

console.log(`Character bounds in frame 0: x=${lX}-${rX} (${CW}px), y=${tY}-${bY} (${CH}px)`);

// ── Sample palette from frame 0 ───────────────────────────────────────────────
function getpx(x, y) {
  const i = (y * FW + x) * 4;
  return { r: pd[i], g: pd[i+1], b: pd[i+2], a: pd[i+3] };
}
function css(x, y) {
  const p = getpx(x, y);
  if (p.a < 30) return null;
  return `rgb(${p.r},${p.g},${p.b})`;
}

// Probe specific areas of the character
const midX  = Math.round((lX + rX) / 2);
const helmY = MY + 1;                            // top of helmet
const jackY = MY + Math.round(CH * 0.45);        // mid-jacket
const legY  = MY + Math.round(CH * 0.76);        // leg area

const C_HELM   = css(midX, helmY)      ?? '#2a3040';
const C_JACK   = css(midX, jackY)      ?? '#1a3a5c';
const C_JACK_L = css(midX - 3, jackY) ?? '#2255a0';   // lighter left panel
const C_PANTS  = css(midX - 3, legY)  ?? '#141828';
const C_DARK   = '#0a0c14';

// Find the brightest blue/cyan pixel for neon
let nR = 0, nG = 0, nB = 255, maxScore = 0;
for (let y = MY; y <= bY; y++) {
  for (let x = lX; x <= rX; x++) {
    const { r, g, b, a } = getpx(x, y);
    if (a > 128 && b > 150) {
      const score = b * 1.5 - r;
      if (score > maxScore) { maxScore = score; nR = r; nG = g; nB = b; }
    }
  }
}
const C_NEON = `rgb(${nR},${nG},${nB})`;
const C_SKIN = '#b87040';
const C_BOOT = '#181820';
const C_RIM  = '#141820';

console.log('Palette:', { C_HELM, C_JACK, C_JACK_L, C_PANTS, C_NEON });

// ── Pixel-accurate drawing helpers ───────────────────────────────────────────
// All coordinates are in "character space": (0,0) = top-left of bounding box
// We offset by (MX, MY) to place correctly in the 48×64 frame.

function r(ctx, cx, cy, w, h, c) {
  if (!c || w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(MX + cx, MY + cy, w, h);
}

// ── Walk-Up: back of character ────────────────────────────────────────────────
// Layout within CW×CH (18×29) character space:
//
//   0-6   : helmet dome (back — no brim detail)
//   7-8   : neck/collar
//   9-21  : jacket back with centre stripe and neon flanks
//   22-24 : belt
//   25-28 : legs & boots  (two cols, alternating for walk cycle)
//
function drawUp(ctx, stepA) {
  ctx.clearRect(0, 0, FW, FH);

  // Helmet dome
  r(ctx,  2, 0, 14, 1, C_RIM);    // top cap
  r(ctx,  1, 1, 16, 5, C_HELM);   // dome body
  r(ctx,  5, 1,  4, 3, '#3a4050'); // highlight strip
  r(ctx,  1, 6, 16, 1, C_RIM);    // rim base

  // Neck / collar
  r(ctx,  5, 7,  8, 2, C_DARK);

  // Jacket back
  r(ctx,  1, 9,  16, 13, C_JACK);
  r(ctx,  5, 10,  8, 11, C_JACK_L);   // centre back panel (lighter)
  // Neon flanks
  r(ctx,  0, 11,  2, 10, C_NEON);
  r(ctx, 16, 11,  2, 10, C_NEON);
  // Faint horizontal back seam
  r(ctx,  1, 15, 16,  1, C_DARK);

  // Belt
  r(ctx,  1, 22, 16, 2, C_DARK);

  // Legs — two columns with walk alternation
  const fCol = stepA ? 2 :  9;
  const bCol = stepA ? 9 :  2;

  // back leg (shorter)
  r(ctx, bCol, 24, 5, 4, C_PANTS);
  r(ctx, bCol, 28, 5, 1, C_BOOT);

  // forward leg (longer, slightly raised)
  r(ctx, fCol, 23, 5, 5, C_PANTS);
  r(ctx, fCol, 28, 5, 1, C_BOOT);

  // Shadow ellipse
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(MX + 9, MY + CH + 2, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── Walk-Down: face toward player ─────────────────────────────────────────────
// Layout:
//   0-5   : helmet (front — has face band visible at base)
//   6-10  : face band / visor / eyes
//   11-20 : jacket front (two chest panels, neon flanks, zip)
//   21-23 : belt
//   24-28 : legs & boots
//
function drawDown(ctx, stepA) {
  ctx.clearRect(0, 0, FW, FH);

  // Helmet
  r(ctx,  2, 0, 14, 1, C_RIM);
  r(ctx,  1, 1, 16, 4, C_HELM);
  r(ctx,  2, 1,  3, 3, '#3a4050');   // left highlight
  r(ctx,  1, 5, 16, 1, C_RIM);       // visor rim

  // Face / visor band
  r(ctx,  2, 6, 14, 4, C_SKIN);
  // Glowing eyes
  ctx.fillStyle = C_NEON;
  ctx.fillRect(MX + 3,  MY + 7, 3, 2);   // left eye
  ctx.fillRect(MX + 12, MY + 7, 3, 2);   // right eye
  // eye glow halo
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = C_NEON;
  ctx.fillRect(MX + 2,  MY + 6, 5, 4);
  ctx.fillRect(MX + 11, MY + 6, 5, 4);
  ctx.globalAlpha = 1;
  // Chin shadow
  r(ctx,  3, 10, 12, 1, '#7a4828');

  // Jacket front
  r(ctx,  1, 11, 16, 10, C_JACK);
  r(ctx,  2, 12,  6, 8, C_JACK_L);    // left chest panel
  r(ctx, 10, 12,  5, 8, C_JACK_L);    // right chest panel
  r(ctx,  8, 12,  2, 9, C_DARK);      // centre zip
  // Neon flanks
  r(ctx,  0, 13,  2, 7, C_NEON);
  r(ctx, 16, 13,  2, 7, C_NEON);
  // Gun glow on right hip
  ctx.globalAlpha = 0.6;
  r(ctx, 15, 15,  3, 5, C_NEON);
  ctx.globalAlpha = 1;

  // Belt
  r(ctx,  1, 21, 16, 2, C_DARK);

  // Legs
  const fCol = stepA ? 2 : 9;
  const bCol = stepA ? 9 : 2;

  r(ctx, bCol, 23, 5, 4, C_PANTS);
  r(ctx, bCol, 27, 5, 1, C_BOOT);

  r(ctx, fCol, 23, 5, 5, C_PANTS);
  r(ctx, fCol, 28, 5, 1, C_BOOT);

  // Shadow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(MX + 9, MY + CH + 2, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── Composite: existing 4 frames + new 4 ─────────────────────────────────────
const out  = createCanvas(FW * 8, FH);
const octx = out.getContext('2d');
octx.drawImage(src, 0, 0);   // copy frames 0-3

const draws = [
  (c) => drawUp(c,   true),
  (c) => drawUp(c,   false),
  (c) => drawDown(c, true),
  (c) => drawDown(c, false),
];
for (let i = 0; i < 4; i++) {
  const fc = createCanvas(FW, FH);
  draws[i](fc.getContext('2d'));
  octx.drawImage(fc, (4 + i) * FW, 0);
}

writeFileSync(PATH, out.toBuffer('image/png'));
console.log(`Saved 384×64 (8 frames) → ${PATH}`);

#!/usr/bin/env node
/**
 * generate_tileset.cjs
 * Outputs: public/assets/tiles/neon_lab_tiles.png
 * Exactly 256×32 px — 8 tiles of 32×32, transparent background.
 * Pixel-perfect, no anti-aliasing, locked palette only.
 */

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

// ── palette ──────────────────────────────────────────────────────────────
const NAVY   = '#0a1428';
const DBLU   = '#1a2a4a';
const NBLU   = '#00b4ff';
const CYAN   = '#00ffe5';
const GREEN  = '#00ff88';
const ORANGE = '#ff9a00';
const WHITE  = '#ffffff';

// ── canvas ───────────────────────────────────────────────────────────────
const canvas = createCanvas(256, 32);
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── draw helpers ─────────────────────────────────────────────────────────
const fr  = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
const dot = (col, x, y)        => fr(col, x, y, 1, 1);

const outline = (col, x, y, w, h) => {
  fr(col, x,     y,     w, 1);
  fr(col, x,     y+h-1, w, 1);
  fr(col, x,     y,     1, h);
  fr(col, x+w-1, y,     1, h);
};

// ═══════════════════════════════════════════════════════════════════════════
// TILE 0 — FLOOR  (tx = 0)
// Darker than walls so it reads as "ground you walk on".
// Base: NAVY (#0a1428), seams: DBLU (#1a2a4a) — inverted from walls.
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 0;
  fr(NAVY, tx, 0, 32, 32);      // dark navy base (was DBLU)
  fr(DBLU, tx+15, 0,  2, 32);  // lighter seam — vertical   (was NAVY)
  fr(DBLU, tx,   15, 32,  2);  // lighter seam — horizontal (was NAVY)
  dot(CYAN, tx+14, 14);
  dot(CYAN, tx+17, 14);
  dot(CYAN, tx+14, 17);
  dot(CYAN, tx+17, 17);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 1 — WALL  (tx = 32)
// ═══════════════════════════════════════════════════════════════════════════
function drawWallBase(tx) {
  fr(DBLU,  tx,    0, 32, 32);
  fr(NBLU,  tx,    0, 32,  4);   // neon-blue strip rows 0-3
  fr(CYAN,  tx,    0, 32,  2);   // rows 0-1 overwritten with bright cyan (was row 1 only)
  fr(NAVY,  tx+15, 0,  1, 32);
  fr(NAVY,  tx,   30, 32,  2);
  outline(NAVY, tx, 0, 32, 32);
}
drawWallBase(32);

// ═══════════════════════════════════════════════════════════════════════════
// TILE 2 — CRACKED WALL  (tx = 64)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 64;
  drawWallBase(tx);
  const crack = [
    [11, 4],[12, 5],[11, 6],[12, 7],
    [13, 8],[12, 9],[13,10],[14,11],
    [13,12],[14,13],[14,14],[15,15],
    [14,16],[15,17],[16,18],[15,19],
    [16,20],[17,21],[16,22],
  ];
  crack.forEach(([cx,cy]) => dot(NAVY,   tx+cx,   cy));
  crack.forEach(([cx,cy]) => dot(ORANGE, tx+cx+1, cy));
  dot(WHITE, tx+14, 14);
  dot(WHITE, tx+15, 15);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 3 — ENERGY WALL / GREEN  (tx = 96)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 96;
  fr(DBLU,  tx,    0,  32, 32);
  fr(GREEN, tx+4,  4,  24, 24);
  for (let i = 0; i <= 10; i++) {
    dot(NAVY, tx+16+i, 6+i);
    dot(NAVY, tx+16-i, 6+i);
    dot(NAVY, tx+16+i, 26-i);
    dot(NAVY, tx+16-i, 26-i);
  }
  dot(WHITE, tx+16, 15);
  dot(WHITE, tx+16, 16);
  dot(WHITE, tx+16, 17);
  outline(NAVY, tx, 0, 32, 32);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 4 — DOOR  (tx = 128)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 128;
  fr(DBLU,  tx,    0, 32, 32);
  fr(CYAN,  tx+15, 0,  1, 32);
  fr(NBLU,  tx,    2, 32,  2);
  fr(NBLU,  tx,   26, 32,  2);
  fr(NBLU,  tx+14, 14,  2,  2);
  outline(NAVY, tx, 0, 32, 32);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 5 — CONSOLE  (tx = 160)   transparent background
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx  = 160;
  const bx  = tx+8, by = 12, bw = 16, bh = 20;
  fr(DBLU,  bx, by, bw, bh);
  outline(NAVY, bx, by, bw, bh);
  fr(CYAN,  tx+12, 15, 8, 6);
  fr(GREEN, tx+13, 17, 4, 1);
  fr(GREEN, tx+13, 19, 3, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 6 — CRATE  (tx = 192)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 192;
  fr(DBLU,  tx+4, 4, 24, 24);
  outline(NAVY, tx+4, 4, 24, 24);
  fr(NBLU,  tx+ 4,  4, 2, 2);
  fr(NBLU,  tx+26,  4, 2, 2);
  fr(NBLU,  tx+ 4, 26, 2, 2);
  fr(NBLU,  tx+26, 26, 2, 2);
  fr(CYAN,  tx+5,  5, 22, 1);
  fr(NAVY,  tx+15,  4,  1, 24);
  fr(NAVY,  tx+ 4, 15, 24,  1);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 7 — PILLAR  (tx = 224)   transparent background
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 224;
  const bx = tx+10, by = 2, bw = 12, bh = 28;
  fr(NAVY,  bx, by,      bw, bh);
  fr(DBLU,  bx, by,      bw,  3);
  fr(DBLU,  bx, by+bh-3, bw,  3);
  fr(CYAN,  tx+13, 5, 6, 22);
  fr(NBLU,  tx+ 9, by,       bw+2, 1);
  fr(NBLU,  tx+ 9, by+bh,    bw+2, 1);
  fr(NBLU,  tx+ 9, by,       1, bh);
  fr(NBLU,  tx+21, by,       1, bh);
}

// ═══════════════════════════════════════════════════════════════════════════
// Write PNG
// ═══════════════════════════════════════════════════════════════════════════
const dir     = path.join(__dirname, '..', 'public', 'assets', 'tiles');
const outPath = path.join(dir, 'neon_lab_tiles.png');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Saved   : ${outPath}`);
console.log(`Canvas  : ${canvas.width} x ${canvas.height} px`);
console.log(`File    : ${sizeKB} KB`);

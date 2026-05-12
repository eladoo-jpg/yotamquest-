#!/usr/bin/env node
/**
 * generate_tileset.js
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
//const PURPLE = '#4a1a6e';  // reserved
const ORANGE = '#ff9a00';
const WHITE  = '#ffffff';

// ── canvas ───────────────────────────────────────────────────────────────
const canvas = createCanvas(256, 32);
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── draw helpers ─────────────────────────────────────────────────────────
const fr = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
const dot = (col, x, y)       => fr(col, x, y, 1, 1);

// Outline a rect with 1-px edge
const outline = (col, x, y, w, h) => {
  fr(col, x,       y,       w, 1);  // top
  fr(col, x,       y+h-1,   w, 1);  // bottom
  fr(col, x,       y,       1, h);  // left
  fr(col, x+w-1,   y,       1, h);  // right
};

// ═══════════════════════════════════════════════════════════════════════════
// TILE 0 — FLOOR  (tx = 0)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 0;
  fr(DBLU, tx, 0, 32, 32);
  // 2-px seams → 4 equal 15×15 panels (gap at x=15-16, y=15-16)
  fr(NAVY, tx+15, 0,  2, 32);   // vertical seam
  fr(NAVY, tx,   15, 32,  2);   // horizontal seam
  // Single cyan accent at each inner panel corner (just outside the seam)
  dot(CYAN, tx+14, 14);
  dot(CYAN, tx+17, 14);
  dot(CYAN, tx+14, 17);
  dot(CYAN, tx+17, 17);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 1 — WALL  (tx = 32)
// ═══════════════════════════════════════════════════════════════════════════
function drawWallBase(tx) {
  fr(DBLU,  tx,     0, 32, 32);   // base fill
  fr(NBLU,  tx,     0, 32,  4);   // neon strip rows 0-3
  fr(CYAN,  tx,     1, 32,  1);   // cyan highlight row 1
  fr(NAVY,  tx+15,  0,  1, 32);   // vertical centre seam
  fr(NAVY,  tx,    30, 32,  2);   // 2-px bottom shadow rows 30-31
  outline(NAVY, tx, 0, 32, 32);   // 1-px perimeter (drawn last)
}
drawWallBase(32);

// ═══════════════════════════════════════════════════════════════════════════
// TILE 2 — CRACKED WALL  (tx = 64)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 64;
  drawWallBase(tx);

  // Jagged crack — zigzag from upper-mid to lower-mid (tile-local coords)
  const crack = [
    [11, 4],[12, 5],[11, 6],[12, 7],
    [13, 8],[12, 9],[13,10],[14,11],
    [13,12],[14,13],[14,14],[15,15],
    [14,16],[15,17],[16,18],[15,19],
    [16,20],[17,21],[16,22],
  ];
  crack.forEach(([cx,cy]) => dot(NAVY,   tx+cx,   cy));   // dark crack pixel
  crack.forEach(([cx,cy]) => dot(ORANGE, tx+cx+1, cy));   // orange glow beside crack

  // 2 bright white pixels at focal point (≈ tile centre)
  dot(WHITE, tx+14, 14);
  dot(WHITE, tx+15, 15);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 3 — ENERGY WALL / GREEN  (tx = 96)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 96;
  fr(DBLU, tx, 0, 32, 32);        // 4-px border ring
  fr(GREEN, tx+4, 4, 24, 24);     // inner 24×24 neon-green fill

  // Diamond outline — radius 10, centred at tile-local (16,16)
  for (let i = 0; i <= 10; i++) {
    dot(NAVY, tx+16+i, 6+i);      // top → right arm
    dot(NAVY, tx+16-i, 6+i);      // top → left arm
    dot(NAVY, tx+16+i, 26-i);     // bottom → right arm
    dot(NAVY, tx+16-i, 26-i);     // bottom → left arm
  }

  // 3-px white highlight at diamond centre
  dot(WHITE, tx+16, 15);
  dot(WHITE, tx+16, 16);
  dot(WHITE, tx+16, 17);

  outline(NAVY, tx, 0, 32, 32);   // perimeter
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 4 — DOOR  (tx = 128)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 128;
  fr(DBLU, tx, 0, 32, 32);

  // Cyan centre-seam glow (vertical, 1-px)
  fr(CYAN, tx+15, 0, 1, 32);

  // Horizontal tech bands
  fr(NBLU, tx, 2, 32, 2);    // top band  (rows 2-3)
  fr(NBLU, tx, 26, 32, 2);   // bottom band (rows 26-27)

  // 2×2 indicator at tile centre
  fr(NBLU, tx+14, 14, 2, 2);

  outline(NAVY, tx, 0, 32, 32);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 5 — CONSOLE  (tx = 160)   transparent background
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 160;
  // Canvas default is transparent — only draw the console object

  // Body 16×20, bottom-centre of tile: tile-local x=8, y=12
  const bx = tx+8, by = 12, bw = 16, bh = 20;
  fr(DBLU,  bx, by, bw, bh);
  outline(NAVY, bx, by, bw, bh);

  // Screen 8×6 inside body: tile-local x=12, y=15
  fr(CYAN,  tx+12, 15, 8, 6);

  // 2 green text-line rows inside screen
  fr(GREEN, tx+13, 17, 4, 1);
  fr(GREEN, tx+13, 19, 3, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 6 — CRATE  (tx = 192)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 192;
  // 24×24 body at tile-local (4,4)
  fr(DBLU,  tx+4, 4, 24, 24);
  outline(NAVY, tx+4, 4, 24, 24);

  // 2×2 neon-blue corner squares
  fr(NBLU, tx+ 4,  4, 2, 2);   // TL
  fr(NBLU, tx+26,  4, 2, 2);   // TR
  fr(NBLU, tx+ 4, 26, 2, 2);   // BL
  fr(NBLU, tx+26, 26, 2, 2);   // BR

  // Top-edge cyan highlight (row 5, inside outline)
  fr(CYAN, tx+5, 5, 22, 1);

  // Cross seam through body centre
  fr(NAVY, tx+15,  4,  1, 24);  // vertical
  fr(NAVY, tx+ 4, 15, 24,  1);  // horizontal
}

// ═══════════════════════════════════════════════════════════════════════════
// TILE 7 — PILLAR  (tx = 224)   transparent background
// ═══════════════════════════════════════════════════════════════════════════
{
  const tx = 224;
  // 12×28 pillar body centred horizontally: tile-local x=10, y=2
  const px = tx+10, py = 2, pw = 12, ph = 28;

  fr(NAVY, px, py, pw, ph);          // dark outer body
  fr(DBLU, px, py,      pw, 3);      // top cap 3px
  fr(DBLU, px, py+ph-3, pw, 3);     // bottom cap 3px

  // Inner glow tube: 6px wide, tile-local x=13, y=5-26
  fr(CYAN, tx+13, 5, 6, 22);

  // 1-px neon-blue ring just outside the body
  fr(NBLU, tx+ 9, py,      pw+2, 1);  // top edge
  fr(NBLU, tx+ 9, py+ph,   pw+2, 1);  // bottom edge  (y=30)
  fr(NBLU, tx+ 9, py,      1, ph);    // left side
  fr(NBLU, tx+21, py,      1, ph);    // right side
}

// ═══════════════════════════════════════════════════════════════════════════
// Write PNG
// ═══════════════════════════════════════════════════════════════════════════
const dir     = path.join(__dirname, '..', 'public', 'assets', 'tiles');
const outPath = path.join(dir, 'neon_lab_tiles.png');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`✓  Saved   : ${outPath}`);
console.log(`   Canvas  : ${canvas.width} × ${canvas.height} px`);
console.log(`   File    : ${sizeKB} KB`);

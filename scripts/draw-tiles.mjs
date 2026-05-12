/**
 * draw-tiles.mjs
 * Generates pixel-art tiles for YotamQuest neon sci-fi dungeon.
 * 48×48 px, seamless, max 16 colours, strict pixel art (no blur).
 *
 * Run: node scripts/draw-tiles.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = dirname(fileURLToPath(import.meta.url)) + '/..';
const OUT    = ROOT + '/public/assets/tiles';
mkdirSync(OUT, { recursive: true });

const S = 48;  // tile size

// ── Shared palette ────────────────────────────────────────────────────────────
const P = {
  SH: '#050a18',   // shadow / darkest
  BD: '#0a1428',   // base dark
  FM: '#101a34',   // floor mid (panel fill)
  PL: '#1a2a4a',   // panel lines / dividers
  HL: '#2f4f7a',   // highlight edge
  NB: '#00b4ff',   // neon blue
  NC: '#00ffe5',   // neon cyan
  NG: '#00ff88',   // neon green
};

function make() {
  const c = createCanvas(S, S);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function r(ctx, x, y, w, h, col) {
  if (!col) return;
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}
function px(ctx, x, y, col) { r(ctx, x, y, 1, 1, col); }

function save(canvas, name) {
  const path = `${OUT}/${name}.png`;
  writeFileSync(path, canvas.toBuffer('image/png'));
  console.log(`Saved: ${path}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TILE 1 — FLOOR
//  Layout: 2×2 panel grid with neon corner dots, top-right highlight
// ─────────────────────────────────────────────────────────────────────────────
function drawFloor() {
  const { c, x: ctx } = make();

  // 1. Background fill (shadow base — seamless at edges)
  r(ctx, 0, 0, S, S, P.BD);

  // 2. Panel grid: dividers at x=22-23, y=22-23 (2 px thick)
  //    Panels: TL x=1..21 y=1..21  TR x=24..46 y=1..21
  //            BL x=1..21 y=24..46  BR x=24..46 y=24..46
  const panels = [
    { x: 1, y:  1, w: 21, h: 21 },  // TL
    { x: 25, y:  1, w: 22, h: 21 },  // TR
    { x: 1, y: 25, w: 21, h: 22 },  // BL
    { x: 25, y: 25, w: 22, h: 22 },  // BR
  ];

  for (const p of panels) {
    // panel fill
    r(ctx, p.x, p.y, p.w, p.h, P.FM);
    // top highlight (1px, top-right lit)
    r(ctx, p.x, p.y, p.w, 1, P.HL);
    // right highlight (1px)
    r(ctx, p.x + p.w - 1, p.y, 1, p.h, P.HL);
    // bottom shadow (1px)
    r(ctx, p.x, p.y + p.h - 1, p.w, 1, P.SH);
    // left shadow (1px)
    r(ctx, p.x, p.y, 1, p.h, P.SH);
  }

  // 3. Dividers (panel lines colour)
  r(ctx, 22, 0, 2, S, P.PL);   // vertical divider
  r(ctx, 0, 22, S, 2, P.PL);   // horizontal divider
  // outer border
  r(ctx, 0, 0, S, 1, P.PL);
  r(ctx, 0, S-1, S, 1, P.PL);
  r(ctx, 0, 0, 1, S, P.PL);
  r(ctx, S-1, 0, 1, S, P.PL);

  // 4. Neon corner dots (2×2 per corner, inside each panel)
  // TL panel — top-left corner dot
  r(ctx, 3,  3,  2, 2, P.NB);
  // TR panel — top-right corner dot
  r(ctx, 43, 3,  2, 2, P.NB);
  // BL panel — bottom-left corner dot
  r(ctx, 3,  43, 2, 2, P.NB);
  // BR panel — bottom-right corner dot
  r(ctx, 43, 43, 2, 2, P.NB);

  // 5. Subtle surface variation — occasional darker pixel clusters
  //    Deterministic pattern (not random — keeps tile consistent)
  const vars = [
    [5,8],[8,5],[16,14],[13,17],[28,9],[35,12],
    [6,30],[10,38],[30,28],[38,35],[18,40],[40,18],
  ];
  for (const [vx, vy] of vars) {
    px(ctx, vx, vy, P.BD);
  }

  // 6. Global top-right lightening — 1px along top + right edges of tile
  //    (gives overall lighting direction hint across many tiles)
  r(ctx, 0, 0, S, 1, P.PL);    // top row tinted lighter
  r(ctx, S-1, 0, 1, S, P.PL);  // right col

  // 7. Global bottom-left deepening
  r(ctx, 0, S-1, S, 1, P.SH);
  r(ctx, 0, 0, 1, S, P.SH);

  save(c, 'floor');
}

drawFloor();

// ─────────────────────────────────────────────────────────────────────────────
//  TILE 2 — WALL
//  Top-down depth: top face (lighter) + front face (darker)
//  Neon blue strip along top edge, stone panel front
// ─────────────────────────────────────────────────────────────────────────────
function drawWall() {
  const { c, x: ctx } = make();

  // ── TOP FACE (y=0..13, 14px) — lit from top-right ────────────────────────
  // Neon strip: very top 2px
  r(ctx,  0,  0, S,   2, P.NB);
  px(ctx, S-1, 0,        P.NC);   // corner neon cyan accent
  px(ctx, S-1, 1,        P.NC);

  // Top face fill
  r(ctx,  0,  2, S,  10, P.PL);   // base top face (#1a2a4a)
  // Top-right highlight on top face
  r(ctx, 30,  2, 18,  2, P.HL);   // bright patch top-right
  r(ctx, 40,  2,  7,  5, P.HL);
  // Left edge shadow on top face
  r(ctx,  0,  2,  2, 10, P.BD);
  // Surface detail — 2 horizontal score lines
  r(ctx,  0,  6, S,   1, P.BD);   // mid score
  r(ctx,  2,  9, S-4, 1, P.HL);   // highlight below score (bevel)

  // Bottom of top face — overhang shadow line
  r(ctx,  0, 12, S,   2, P.SH);

  // ── FRONT FACE (y=14..47, 34px) — darker, panel blocks ───────────────────
  r(ctx,  0, 14, S,  34, P.BD);   // base front (#0a1428)

  // Three vertical stone panels divided by 1px mortar lines at x=16, x=32
  const panels = [
    { x:  1, w: 14 },
    { x: 17, w: 14 },
    { x: 33, w: 14 },
  ];
  for (const p of panels) {
    // panel fill slightly lighter than base
    r(ctx, p.x, 15, p.w, 32, P.FM);        // #101a34
    // top highlight (bevel under overhang)
    r(ctx, p.x, 15, p.w,  1, P.PL);        // #1a2a4a
    // right highlight (top-right light)
    r(ctx, p.x + p.w - 1, 15, 1, 32, P.PL);
    // bottom shadow
    r(ctx, p.x, 46, p.w,  1, P.SH);
    // left shadow
    r(ctx, p.x, 15,  1, 32, P.SH);
    // subtle mid-panel horizontal score at y=30
    r(ctx, p.x + 1, 30, p.w - 2, 1, P.BD);
    r(ctx, p.x + 1, 31, p.w - 2, 1, P.PL); // bevel below
  }

  // Mortar lines (vertical dividers)
  r(ctx,  0, 14,  1, 34, P.SH);   // far left edge
  r(ctx, 15, 14,  2, 34, P.SH);   // divider 1
  r(ctx, 31, 14,  2, 34, P.SH);   // divider 2
  r(ctx, S-1,14,  1, 34, P.SH);   // far right edge

  // Bottom edge
  r(ctx,  0, 47, S,   1, P.SH);

  // Small neon blue accent dots on front face (tech panel feel)
  r(ctx,  2, 18,  2, 2, P.NB);    // top-left stud
  r(ctx, 44, 18,  2, 2, P.NB);    // top-right stud

  save(c, 'wall');
}

drawWall();

// ─────────────────────────────────────────────────────────────────────────────
//  TILE 3 — DOOR (closed)
//  Metallic frame + dark interior + vertical neon energy line centre
// ─────────────────────────────────────────────────────────────────────────────
function drawDoor() {
  const { c, x: ctx } = make();

  // ── Floor base (tile background matches floor) ────────────────────────────
  r(ctx, 0, 0, S, S, P.BD);

  // ── Outer door frame (full-width header + side columns + footer) ──────────
  // Header bar y=2..7
  r(ctx,  4,  2, 40,  6, P.PL);          // frame fill
  r(ctx,  4,  2, 40,  1, P.HL);          // top highlight
  r(ctx, 28,  2, 14,  2, P.HL);          // top-right extra bright
  r(ctx,  4,  7, 40,  1, P.SH);          // header bottom shadow
  // Header neon top-strip
  r(ctx,  4,  2, 40,  2, P.NB);          // neon blue header line
  px(ctx, 43,  2,          P.NC);         // cyan corner accent
  px(ctx, 43,  3,          P.NC);

  // Side columns x=4..8 (left), x=39..43 (right), y=8..42
  r(ctx,  4,  8,  5, 35, P.PL);          // left column
  r(ctx,  4,  8,  1, 35, P.HL);          // left col outer highlight
  r(ctx,  8,  8,  1, 35, P.SH);          // left col inner shadow
  r(ctx, 39,  8,  5, 35, P.PL);          // right column
  r(ctx, 39,  8,  1, 35, P.SH);          // right col inner shadow
  r(ctx, 43,  8,  1, 35, P.HL);          // right col outer highlight

  // Footer bar y=42..45
  r(ctx,  4, 42, 40,  4, P.PL);
  r(ctx,  4, 42, 40,  1, P.SH);          // shadow top of footer
  r(ctx,  4, 45, 40,  1, P.HL);          // highlight bottom

  // Frame corner bolts
  r(ctx,  5,  9,  2, 2, P.BD);  r(ctx, 41,  9,  2, 2, P.BD);
  r(ctx,  5, 39,  2, 2, P.BD);  r(ctx, 41, 39,  2, 2, P.BD);

  // ── Door interior x=9..38, y=8..41 ───────────────────────────────────────
  r(ctx,  9,  8, 30, 34, P.BD);          // dark interior base

  // Two recessed panels (left + right of energy line)
  r(ctx, 10,  9, 12, 32, P.FM);          // left panel fill
  r(ctx, 10,  9, 12,  1, P.PL);          // top edge
  r(ctx, 10,  9,  1, 32, P.SH);          // left shadow
  r(ctx, 21,  9,  1, 32, P.SH);          // right shadow

  r(ctx, 27,  9, 11, 32, P.FM);          // right panel fill
  r(ctx, 27,  9, 11,  1, P.PL);
  r(ctx, 27,  9,  1, 32, P.SH);
  r(ctx, 37,  9,  1, 32, P.HL);          // right panel outer highlight

  // Panel horizontal score lines
  r(ctx, 10, 22, 12,  1, P.BD);  r(ctx, 10, 23, 12, 1, P.PL);
  r(ctx, 27, 22, 11,  1, P.BD);  r(ctx, 27, 23, 11, 1, P.PL);

  // ── Centre energy line x=22..25, y=8..41 ─────────────────────────────────
  r(ctx, 22,  8,  4, 34, P.BD);          // gutter / dark gap
  r(ctx, 23,  8,  2, 34, P.NB);          // core neon blue (2px)
  // Controlled glow: 1px halo using PL (slightly lighter than BD)
  r(ctx, 22,  8,  1, 34, P.PL);
  r(ctx, 25,  8,  1, 34, P.PL);
  // Scatter glow flecks (deterministic, not random)
  for (const gy of [10,14,18,22,26,30,34,38]) {
    px(ctx, 21, gy,   P.NB);
    px(ctx, 26, gy,   P.NB);
  }
  // Energy line end caps (neon cyan accent at top/bottom)
  r(ctx, 23,  8,  2,  2, P.NC);
  r(ctx, 23, 40,  2,  2, P.NC);

  save(c, 'door');
}

drawDoor();

// ─────────────────────────────────────────────────────────────────────────────
//  TILE 4 — CRATE  (pushable / breakable)
//  Top-down box: top face + front face, neon edges, wear marks
// ─────────────────────────────────────────────────────────────────────────────
function drawCrate() {
  const { c, x: ctx } = make();

  // ── Background (floor bleed around crate) ────────────────────────────────
  r(ctx, 0, 0, S, S, P.BD);

  // ── TOP FACE  y=2..13 (12px) ─────────────────────────────────────────────
  r(ctx,  3,  2, 42, 12, P.PL);          // top face fill (#1a2a4a)
  r(ctx, 22,  2, 22,  5, P.HL);          // top-right highlight patch
  r(ctx,  3,  2, 42,  1, P.NB);          // neon blue top edge
  r(ctx, 44,  2,  1, 12, P.NB);          // neon blue right edge
  px(ctx, 44,  2,          P.NC);         // cyan corner
  // Left + bottom of top face = shadow
  r(ctx,  3,  2,  1, 12, P.SH);
  r(ctx,  3, 13, 42,  1, P.SH);          // overhang shadow line
  // Interior recess on top face
  r(ctx,  6,  4, 35,  8, P.FM);          // inner top panel (#101a34)
  r(ctx,  6,  4, 35,  1, P.HL);          // inner bevel top
  r(ctx, 40,  4,  1,  8, P.HL);          // inner bevel right
  r(ctx,  6, 11, 35,  1, P.SH);          // inner bevel bottom
  r(ctx,  6,  4,  1,  8, P.SH);          // inner bevel left

  // ── FRONT FACE  y=14..45 (32px) ──────────────────────────────────────────
  r(ctx,  3, 14, 42, 32, P.BD);          // front face base
  // Outer shell border
  r(ctx,  3, 14,  2, 32, P.PL);          // left shell
  r(ctx, 43, 14,  2, 32, P.PL);          // right shell
  r(ctx, 43, 14,  2,  8, P.HL);          // top-right shell highlight
  r(ctx,  3, 44, 42,  2, P.SH);          // bottom shell

  // Main front panel (recessed, slightly lighter)
  r(ctx,  6, 16, 36, 27, P.FM);          // panel fill
  r(ctx,  6, 16, 36,  1, P.PL);          // panel top bevel
  r(ctx, 41, 16,  1, 27, P.HL);          // panel right bevel (lit)
  r(ctx,  6, 42, 36,  1, P.SH);          // panel bottom bevel
  r(ctx,  6, 16,  1, 27, P.SH);          // panel left bevel

  // Neon corner accents (2×2 each corner of front panel)
  r(ctx,  7, 17,  2, 2, P.NB);           // TL
  r(ctx, 39, 17,  2, 2, P.NB);           // TR
  r(ctx,  7, 40,  2, 2, P.NB);           // BL
  r(ctx, 39, 40,  2, 2, P.NB);           // BR

  // Centre cross / latch mark (sci-fi crate detail)
  r(ctx, 23, 18,  2, 23, P.PL);          // vertical centre mark
  r(ctx,  8, 29, 32,  1, P.PL);          // horizontal centre mark
  r(ctx, 23, 18,  2,  1, P.NB);          // neon top of cross
  r(ctx, 23, 40,  2,  1, P.NB);          // neon bottom
  r(ctx,  8, 29,  1,  1, P.NB);          // neon left
  r(ctx, 39, 29,  1,  1, P.NB);          // neon right

  // Wear / scratch marks (deterministic, subtle)
  px(ctx, 12, 22, P.SH);  px(ctx, 13, 23, P.SH);  px(ctx, 14, 22, P.SH); // scratch 1
  px(ctx, 33, 35, P.SH);  px(ctx, 34, 36, P.SH);                          // scratch 2
  px(ctx, 10, 38, P.HL);  px(ctx, 11, 37, P.HL);                          // wear 1

  // Outer tile border (blends with floor)
  r(ctx, 0, 0, S, 2, P.BD);
  r(ctx, 0, S-2, S, 2, P.BD);
  r(ctx, 0, 0, 3, S, P.BD);
  r(ctx, S-3, 0, 3, S, P.BD);

  save(c, 'crate');
}

drawCrate();

// ─────────────────────────────────────────────────────────────────────────────
//  TILE 5 — CRYSTAL  (collectible / decoration)
//  Faceted neon blue/cyan gem on rock base, 1px controlled glow
// ─────────────────────────────────────────────────────────────────────────────
function drawCrystal() {
  const { c, x: ctx } = make();

  // Floor background
  r(ctx, 0, 0, S, S, P.BD);

  // ── Crystal silhouette shape ──────────────────────────────────────────────
  // Row-by-row: [y, x_start, width]
  // Diamond-ish: narrow tip, widens through torso, tapers to base
  const rows = [
    [10, 22,  4],  // tip
    [11, 21,  6],
    [12, 20,  8],
    [13, 19, 10],
    [14, 18, 12],
    [15, 17, 14],  // widest
    [16, 17, 14],
    [17, 17, 14],
    [18, 18, 12],
    [19, 19, 10],
    [20, 19, 10],
    [21, 20,  8],
    [22, 20,  8],
    [23, 21,  6],
    [24, 22,  4],
  ];

  // 1. Glow halo — 1px surround using PL (#1a2a4a), slightly lighter than BD
  for (const [y, xs, w] of rows) {
    r(ctx, xs-1, y, w+2, 1, P.PL);   // left+right 1px bleed per row
  }
  // top & bottom glow caps
  r(ctx, 22,  9,  4, 1, P.PL);
  r(ctx, 22, 25,  4, 1, P.PL);

  // 2. Left facet — shadow (#1a2a4a)
  for (const [y, xs, w] of rows) {
    r(ctx, xs, y, Math.ceil(w * 0.38), 1, P.PL);
  }

  // 3. Right facet — neon cyan highlight (top-right lit)
  for (const [y, xs, w] of rows) {
    const rw = Math.floor(w * 0.35);
    r(ctx, xs + w - rw, y, rw, 1, P.NC);
  }

  // 4. Centre facet — neon blue main
  for (const [y, xs, w] of rows) {
    const lw = Math.ceil(w * 0.38);
    const rw = Math.floor(w * 0.35);
    const cx = xs + lw, cw = w - lw - rw;
    if (cw > 0) r(ctx, cx, y, cw, 1, P.NB);
  }

  // 5. Internal facet crack lines (1px dark dividers between faces)
  for (const [y, xs, w] of rows) {
    px(ctx, xs + Math.ceil(w * 0.37), y, P.SH);   // left/centre seam
    px(ctx, xs + w - Math.floor(w * 0.35) - 1, y, P.SH);  // centre/right seam
  }

  // 6. Tip highlight — top 2 rows get extra bright cyan
  r(ctx, 22, 10,  4, 2, P.NC);
  px(ctx, 23, 10,        P.WH ?? '#c0f8ff');   // specular 1px
  // top-right facet sparkle
  px(ctx, 28, 15, P.NC);  px(ctx, 29, 16, P.NB);

  // ── Rock base  y=25..34 ──────────────────────────────────────────────────
  // Jagged top edge
  r(ctx, 17, 25, 14,  1, P.PL);   // base top
  r(ctx, 15, 26, 18,  1, P.PL);   // widens
  r(ctx, 14, 27, 20,  7, P.PL);   // main base body
  r(ctx, 15, 34, 18,  1, P.BD);   // bottom taper
  // Top highlight on base (lit from top-right)
  r(ctx, 25, 25,  6,  1, P.HL);
  r(ctx, 27, 26,  5,  1, P.HL);
  // Shadow left + bottom
  r(ctx, 14, 27,  2,  7, P.SH);
  r(ctx, 14, 33, 20,  1, P.SH);
  // Rock crack detail
  px(ctx, 20, 29, P.SH);  px(ctx, 21, 30, P.SH);  px(ctx, 22, 29, P.BD);
  px(ctx, 30, 28, P.SH);  px(ctx, 31, 29, P.SH);

  // Faint floor shadow under rock
  r(ctx, 16, 35, 16,  1, P.SH);

  save(c, 'crystal');
}

// Palette extension for crystal specular
P.WH = '#c0f8ff';

drawCrystal();

// ─────────────────────────────────────────────────────────────────────────────
//  TILE 6 — ENERGY PILLAR  (obstacle)
//  Cylinder: oval top cap + vertical shaft with glowing core + metal base
// ─────────────────────────────────────────────────────────────────────────────
function drawPillar() {
  const { c, x: ctx } = make();

  r(ctx, 0, 0, S, S, P.BD);   // floor bg

  // ── Shaft body  y=10..38 (before cap/base are drawn over) ────────────────
  //   Left shadow | dark body | glow core | lit body | right highlight
  const SX = 13, SW = 22;  // shaft x-start, width
  const CX = 23, CW = 2;   // core x, width (2px neon core)

  r(ctx, SX,       10, SW,   29, P.B2);    // full shaft fill (dark blue)
  r(ctx, SX,       10, 3,    29, P.SH);    // left shadow strip
  r(ctx, SX+SW-4,  10, 4,    29, P.HL);    // right highlight strip (top-right lit)
  r(ctx, SX+SW-2,  10, 2,    29, P.B4);    // far right bright edge

  // Core glow — vertical neon cyan column
  r(ctx, CX-2,  10,  1, 29, P.PL);        // 1px soft glow left
  r(ctx, CX-1,  10,  1, 29, P.NB);        // neon blue inner-left
  r(ctx, CX,    10, CW, 29, P.NC);        // cyan core
  r(ctx, CX+CW, 10,  1, 29, P.NB);        // neon blue inner-right
  r(ctx, CX+CW+1,10, 1, 29, P.PL);        // 1px soft glow right

  // Horizontal scan lines (subtle — every 4px, dark band across shaft)
  for (let sy = 13; sy < 38; sy += 4) {
    r(ctx, SX+3, sy, SW-6, 1, P.B1);
  }

  // ── Top cap  y=2..11 (oval metal cap) ────────────────────────────────────
  // Oval rows: [y, x, w]
  const capRows = [
    [ 3, 17, 14],
    [ 4, 14, 20],
    [ 5, 13, 22],
    [ 6, 13, 22],
    [ 7, 13, 22],
    [ 8, 14, 20],
    [ 9, 15, 18],
    [10, 17, 14],
    [11, 18, 12],
  ];
  for (const [cy, cx, cw] of capRows) {
    r(ctx, cx, cy, cw, 1, P.PL);          // cap metal fill
  }
  // Cap top-right highlight
  for (const [cy, cx, cw] of capRows) {
    const hw = Math.max(1, Math.floor(cw * 0.4));
    r(ctx, cx + cw - hw, cy, hw, 1, P.HL);
  }
  // Cap left shadow
  for (const [cy, cx] of capRows) {
    px(ctx, cx, cy, P.SH);
  }
  // Cap surface neon ring (inner oval, 1px)
  const ringRows = [[4,17,6],[5,16,8],[6,16,8],[7,16,8],[8,17,6]];
  for (const [ry, rx, rw] of ringRows) {
    px(ctx, rx, ry, P.NC);
    px(ctx, rx+rw-1, ry, P.NC);
  }
  // Cap centre glow dot
  r(ctx, CX, 5, CW, 4, P.NC);
  px(ctx, CX, 5, P.WH);                   // specular top

  // ── Base  y=37..45 ───────────────────────────────────────────────────────
  const baseRows = [
    [38, 13, 22],
    [39, 11, 26],
    [40, 10, 28],
    [41, 10, 28],
    [42, 10, 28],
    [43, 11, 26],
    [44, 12, 24],
    [45, 14, 20],
  ];
  for (const [by, bx, bw] of baseRows) {
    r(ctx, bx, by, bw, 1, P.PL);
  }
  // Base highlight (top-right)
  for (const [by, bx, bw] of baseRows) {
    const hw = Math.floor(bw * 0.45);
    r(ctx, bx + bw - hw, by, hw, 1, P.HL);
  }
  // Base shadow (left + bottom)
  for (const [by, bx] of baseRows) { px(ctx, bx, by, P.SH); }
  r(ctx, 10, 45, 28, 1, P.SH);
  // Neon ring on base top
  r(ctx, 12, 38, 24, 1, P.NC);
  // Base core opening glow
  r(ctx, CX-1, 38, CW+2, 1, P.NC);

  // Floor shadow under base
  r(ctx, 12, 46, 24, 1, P.SH);

  save(c, 'pillar');
}

drawPillar();

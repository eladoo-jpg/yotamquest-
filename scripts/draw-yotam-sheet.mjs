/**
 * draw-yotam-sheet.mjs  v1
 *
 * Draws Agent Yotam pixel-art from scratch.
 * 48×48 frames · 8 rows × 4 cols → 192×384 sheet
 *
 * Rules: ≤18 colours · 1px outline #0a0a0a · no anti-alias
 *        light top-right · head 40% height · character ~70% frame
 *
 * Run: node scripts/draw-yotam-sheet.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = dirname(fileURLToPath(import.meta.url)) + '/..';
const OUTPUT = ROOT + '/public/assets/sprites/yotam.png';
const FW = 48, FH = 48, ROWS = 8, COLS = 4;

// ── Palette (18 colours) ──────────────────────────────────────────────────────
const C = {
  B1: '#081020',   //  1 deepest shadow
  B2: '#1a2a4a',   //  2 dark jacket
  B3: '#2f4f7a',   //  3 mid jacket (main)
  B4: '#5fa8ff',   //  4 jacket highlight
  N1: '#00b4ff',   //  5 neon blue  (eyes / gun)
  N2: '#00ffe5',   //  6 neon cyan  (trim / accents)
  SK: '#f0b078',   //  7 skin light
  SD: '#b86040',   //  8 skin shadow
  G1: '#d0d4e0',   //  9 hat light
  G2: '#8890a0',   // 10 hat shadow
  DR: '#241c18',   // 11 boots / hair dark
  HA: '#604838',   // 12 hair mid
  WH: '#ffffff',   // 13 specular / eye shine
  GN: '#303840',   // 14 gun body
  PA: '#182030',   // 15 pants
  NH: '#80ffff',   // 16 neon glow tip
  OL: '#0a0a0a',   // 17 outline
  TR: null,        // 18 transparent (skip)
};

// ── Low-level helpers ─────────────────────────────────────────────────────────
function r(ctx, x, y, w, h, c) {
  if (!c) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}
function px(ctx, x, y, c) { r(ctx, x, y, 1, 1, c); }

// ── Outline pass (4-neighbour, modifies canvas in-place) ──────────────────────
function outline(ctx) {
  const id = ctx.getImageData(0, 0, FW, FH);
  const d  = id.data;
  // collect pixels needing outline
  const mask = new Uint8Array(FW * FH);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      if (d[(y*FW+x)*4+3] > 64) continue;
      for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx=x+dx, ny=y+dy;
        if (nx<0||nx>=FW||ny<0||ny>=FH) continue;
        if (d[(ny*FW+nx)*4+3] > 64) { mask[y*FW+x]=1; break; }
      }
    }
  }
  for (let i=0; i<mask.length; i++) {
    if (!mask[i]) continue;
    d[i*4]=10; d[i*4+1]=10; d[i*4+2]=10; d[i*4+3]=255;
  }
  ctx.putImageData(id, 0, 0);
}

// ── Character parts (all coords in absolute 48×48 frame space) ───────────────
// Character: x=10..38, y=6..41  (29×36 ≈ 75%)
//   Head y=6..19  (14px = 39%)
//   Body y=19..32 (13px)
//   Legs y=32..41  (9px + boots)

// Hat – tilted cap, peak to right
function drawHat(ctx, yo=0) {
  const y = 6+yo;
  // dome
  r(ctx, 13, y,   20, 1, C.G2);           // top row
  r(ctx, 12, y+1, 22, 3, C.G2);           // dome body
  r(ctx, 25, y+1,  7, 2, C.G1);           // top-right highlight
  r(ctx, 12, y+4,  2, 1, C.G2);           // left dome base
  r(ctx, 14, y+4, 18, 1, C.N1);           // neon band
  r(ctx, 32, y+4,  2, 1, C.G2);
  // brim
  r(ctx, 10, y+5, 26, 1, C.G2);           // brim top
  r(ctx, 10, y+6, 26, 1, C.G2);           // brim main
  r(ctx, 27, y+5,  8, 2, C.G1);           // right brim highlight
  r(ctx, 10, y+6,  4, 1, C.B1);           // left brim underside shadow
  // hair peek
  r(ctx, 14, y+7,  3, 1, C.HA);
  r(ctx, 14, y+8,  2, 1, C.DR);
}

// Face – front view
function drawFaceFront(ctx, yo=0) {
  const y = 13+yo;                         // face top (under hat brim)
  // base skin
  r(ctx, 14, y,   20, 8, C.SK);
  // shadow: left edge + bottom
  r(ctx, 14, y,    1, 8, C.SD);
  r(ctx, 14, y+7, 20, 1, C.SD);
  r(ctx, 15, y,    1, 8, C.SD);           // narrow left shadow
  // top shadow (under brim)
  r(ctx, 14, y,   20, 1, C.SD);
  // highlight: top-right
  r(ctx, 28, y+1,  5, 2, C.SK);
  // eyes  (3×2 each, neon, 1px white shine top-right)
  r(ctx, 16, y+2,  3, 2, C.N1);           // left eye
  px(ctx, 18, y+2,         C.WH);          // shine
  r(ctx, 25, y+2,  3, 2, C.N1);           // right eye
  px(ctx, 27, y+2,         C.WH);
  // nose hint
  px(ctx, 23, y+4,         C.SD);
  // mouth – small smile
  r(ctx, 20, y+5,  7, 1, C.SD);
  px(ctx, 19, y+5,         C.SK);
  px(ctx, 27, y+5,         C.SK);
}

// Face – back view (hat back, no face)
function drawFaceBack(ctx, yo=0) {
  const y = 7+yo;
  // hat dome (from back — no peak, centred)
  r(ctx, 13, y,   22, 1, C.G2);
  r(ctx, 12, y+1, 24, 3, C.G2);
  r(ctx, 12, y+1,  5, 2, C.G1);           // left-top highlight (reversed light)
  r(ctx, 14, y+4, 20, 1, C.N1);           // neon band
  r(ctx, 10, y+5, 28, 1, C.G2);           // brim
  r(ctx, 10, y+6, 28, 1, C.G2);
  // hair
  r(ctx, 14, y+7, 20, 2, C.HA);
  r(ctx, 15, y+8, 18, 1, C.DR);
}

// Face – side view (profile, dir: 1=right, -1=left)
function drawFaceSide(ctx, yo=0, dir=1) {
  const y = 6+yo;
  const fl = dir===1 ? 14 : 18;  // face left x for each direction
  const fw = 14;                   // face width for side view
  // hat dome (side: narrower)
  r(ctx, fl-2, y,    fw+4, 1, C.G2);
  r(ctx, fl-3, y+1,  fw+5, 3, C.G2);
  if (dir===1)  r(ctx, fl+fw-2, y+1, 4, 2, C.G1);  // highlight right
  else           r(ctx, fl-3,   y+1, 4, 2, C.G1);   // highlight left
  r(ctx, fl-2, y+4,  fw+3, 1, C.N1);
  // peak (direction-side)
  if (dir===1) { r(ctx, fl+fw+2, y+4, 5, 2, C.G2); r(ctx, fl+fw+5, y+4, 2, 2, C.G2); }
  else          { r(ctx, fl-9,   y+4, 5, 2, C.G2); }
  // brim
  r(ctx, fl-4, y+5, fw+7, 2, C.G2);
  if (dir===1) { r(ctx, fl+fw, y+5, 3, 2, C.G1); }
  // face
  r(ctx, fl, y+7,  fw-2, 7, C.SK);
  r(ctx, fl, y+7,   1,   7, C.SD);
  if (dir===1) r(ctx, fl+fw-3, y+7, 2, 7, C.SK);  // right highlight
  // eye (single, near front)
  const ex = dir===1 ? fl+1 : fl+fw-4;
  r(ctx, ex, y+9, 2, 2, C.N1);
  px(ctx, ex+(dir===1?1:0), y+9, C.WH);
  // nose (front-facing side of face)
  const nx = dir===1 ? fl+fw-3 : fl+1;
  px(ctx, nx, y+12, C.SD);
}

// Neck
function drawNeck(ctx, yo=0) {
  r(ctx, 20, 21+yo, 8, 2, C.SD);
}

// Body – front/back jacket
function drawBodyFront(ctx, yo=0) {
  const y = 23+yo;
  r(ctx, 12, y, 24, 10, C.B3);          // jacket main
  r(ctx, 12, y,  4, 10, C.B2);          // left shadow
  r(ctx, 32, y,  4, 10, C.B4);          // right highlight
  r(ctx, 12, y,  1, 10, C.N2);          // left neon trim
  r(ctx, 35, y,  1, 10, C.N2);          // right neon trim
  // collar
  r(ctx, 19, y,  10, 2, C.B1);
  // centre zip
  r(ctx, 23, y+2, 2, 7, C.B2);
}

function drawBodyBack(ctx, yo=0) {
  const y = 23+yo;
  r(ctx, 12, y, 24, 10, C.B3);
  r(ctx, 12, y,  4, 10, C.B4);          // left highlight (reversed: light from top-left in back view)
  r(ctx, 32, y,  4, 10, C.B2);
  r(ctx, 12, y,  1, 10, C.N2);
  r(ctx, 35, y,  1, 10, C.N2);
  r(ctx, 19, y,  10, 2, C.B1);
  // backpack hint
  r(ctx, 20, y+3,  8, 6, C.B2);
  r(ctx, 21, y+4,  6, 4, C.B1);
}

function drawBodySide(ctx, yo=0, dir=1) {
  const y = 23+yo;
  const xl = dir===1 ? 14 : 10;
  r(ctx, xl, y, 20, 10, C.B3);
  // highlight side
  if (dir===1) { r(ctx, xl+16, y, 4, 10, C.B4); r(ctx, xl+19, y, 1, 10, C.N2); }
  else          { r(ctx, xl,   y, 4, 10, C.B4); r(ctx, xl,    y, 1, 10, C.N2); }
  r(ctx, xl, y,    1, 10, dir===1 ? C.N2 : C.B2);
  r(ctx, xl, y,   20,  2, C.B1);  // collar
}

// Left arm / right arm (front view)
function drawArmsFront(ctx, yo=0) {
  const y = 23+yo;
  // left arm
  r(ctx, 8,  y,   4, 6, C.B3);
  r(ctx, 8,  y+5, 4, 4, C.SK);   // hand
  r(ctx, 8,  y,   1, 10, C.B2);  // shadow
  // right arm (gun side)
  r(ctx, 36, y,   4, 6, C.B3);
  r(ctx, 36, y+4, 4, 4, C.SK);
  r(ctx, 39, y,   1, 10, C.B4);  // highlight
  // gun held in right hand
  r(ctx, 38, y+5, 7, 3, C.GN);   // gun body
  r(ctx, 38, y+5, 7, 1, C.WH);   // top glint (1px)
  r(ctx, 43, y+5, 3, 2, C.N1);   // barrel neon
  px(ctx, 45, y+5,         C.NH); // glow tip 1px
  r(ctx, 39, y+7, 2, 3, C.GN);   // grip
}

function drawArmsBack(ctx, yo=0) {
  const y = 23+yo;
  r(ctx, 8,  y,   4, 10, C.B3);
  r(ctx, 36, y,   4, 10, C.B3);
  // right hand holds gun down/away (partially hidden)
  r(ctx, 36, y+6, 4, 4,  C.SK);
  r(ctx, 38, y+8, 5, 2,  C.GN);
}

// Arms for side view (one arm forward, one back)
function drawArmsSide(ctx, yo=0, dir=1) {
  const y = 23+yo;
  // forward arm (gun)
  const gx = dir===1 ? 33 : 9;
  r(ctx, gx, y+2, 4, 5, C.B4);        // arm highlight (front)
  r(ctx, gx, y+6, 4, 4, C.SK);         // hand
  // gun
  if (dir===1) {
    r(ctx, gx+1, y+6, 8, 3, C.GN);
    r(ctx, gx+1, y+6, 8, 1, C.WH);    // top glint
    r(ctx, gx+7, y+6, 3, 2, C.N1);
    px(ctx, gx+9, y+6,        C.NH);
  } else {
    r(ctx, gx-8, y+6, 8, 3, C.GN);
    r(ctx, gx-8, y+6, 8, 1, C.WH);
    r(ctx, gx-10,y+6, 3, 2, C.N1);
    px(ctx, gx-11,y+6,        C.NH);
  }
  // back arm
  const bx = dir===1 ? 10 : 34;
  r(ctx, bx, y+2, 3, 5, C.B2);
  r(ctx, bx, y+6, 3, 4, C.SD);
}

// Belt
function drawBelt(ctx, yo=0) {
  const y = 33+yo;
  r(ctx, 12, y,   24, 1, C.B1);
  r(ctx, 12, y+1, 24, 1, C.N2);       // neon belt line
  r(ctx, 22, y,    4, 2, C.N2);       // buckle
  r(ctx, 23, y,    2, 2, C.WH);       // buckle shine
}

// Legs – front view
// step: 0=neutral  1=left fwd  2=right fwd  3=left fwd (=1)
function drawLegsFront(ctx, yo=0, step=0) {
  const y = 35+yo;
  const lx=14, rx=24, lw=6, rw=6;

  let lyo=0, ryo=0;
  if      (step===1) { lyo=-1; ryo=+1; }
  else if (step===2) { lyo=+1; ryo=-1; }

  // back leg first (drawn under front)
  if (step===1) { // right leg is back
    r(ctx, rx, y+ryo, rw, 5, C.PA);
    r(ctx, rx, y+ryo+5, rw, 2, C.DR);
    r(ctx, rx+rw-1, y+ryo, 1, 7, C.B4); // highlight
  } else if (step===2) {
    r(ctx, lx, y+lyo, lw, 5, C.PA);
    r(ctx, lx, y+lyo+5, lw, 2, C.DR);
    r(ctx, lx, y+lyo, 1, 7, C.B2);
  } else {
    r(ctx, lx, y, lw, 5, C.PA);  r(ctx, lx, y+5, lw, 2, C.DR);
    r(ctx, rx, y, rw, 5, C.PA);  r(ctx, rx, y+5, rw, 2, C.DR);
  }

  // front leg
  if (step===1) {
    r(ctx, lx, y+lyo, lw, 5, C.PA);
    r(ctx, lx, y+lyo+5, lw, 2, C.DR);
    r(ctx, lx, y+lyo, 1, 7, C.B2);    // shadow
    r(ctx, lx+lw-1, y+lyo, 1, 7, C.B4); // highlight
  } else if (step===2) {
    r(ctx, rx, y+ryo, rw, 5, C.PA);
    r(ctx, rx, y+ryo+5, rw, 2, C.DR);
    r(ctx, rx, y+ryo, 1, 7, C.B2);
    r(ctx, rx+rw-1, y+ryo, 1, 7, C.B4);
  }
}

// Legs – side view, dir 1=right, -1=left
// step: 0=neutral, 1=forward stride, 2=backward stride
function drawLegsSide(ctx, yo=0, dir=1, step=0) {
  const y = 35+yo;
  // Hip to knee to boot
  // front leg (more visible)
  const fx = dir===1 ? 20 : 18;
  const bx = dir===1 ? 16 : 22;   // back leg

  let fyo=0, byo=0;
  if (step===1) { fyo=-1; byo=+1; }
  if (step===2) { fyo=+1; byo=-1; }

  // back leg
  r(ctx, bx, y+byo, 5, 4, C.B2);          // pants (dark, back)
  r(ctx, bx, y+byo+4, 5, 3, C.DR);        // boot

  // front leg (slightly lighter)
  r(ctx, fx, y+fyo, 5, 4, C.PA);           // pants front
  r(ctx, fx, y+fyo+4, 5, 3, C.DR);        // boot
  r(ctx, fx+4, y+fyo, 1, 7, dir===1 ? C.B4 : C.B2); // edge highlight
}

// Legs – back view (same as front but mirrored)
function drawLegsBack(ctx, yo=0, step=0) {
  drawLegsFront(ctx, yo, step);
}

// ── Composite frame functions ─────────────────────────────────────────────────

function frameIdle(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  const bob = fi===1 ? 1 : 0;
  drawHat(ctx, bob);
  drawFaceFront(ctx, bob);
  drawNeck(ctx, bob);
  drawBodyFront(ctx, bob);
  drawArmsFront(ctx, bob);
  drawBelt(ctx, bob);
  drawLegsFront(ctx, bob, 0);
  outline(ctx);
}

function frameWalkDown(ctx, fi) {
  // Walk toward viewer: 4-frame cycle
  ctx.clearRect(0,0,FW,FH);
  const steps = [1, 0, 2, 0];
  const step  = steps[fi];
  drawHat(ctx);
  drawFaceFront(ctx);
  drawNeck(ctx);
  drawBodyFront(ctx);
  drawArmsFront(ctx);
  drawBelt(ctx);
  drawLegsFront(ctx, 0, step);
  outline(ctx);
}

function frameWalkUp(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  const steps = [1, 0, 2, 0];
  drawFaceBack(ctx);
  drawBodyBack(ctx);
  drawArmsBack(ctx);
  drawBelt(ctx);
  drawLegsBack(ctx, 0, steps[fi]);
  outline(ctx);
}

function frameWalkLeft(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  const steps = [1, 0, 2, 0];
  drawFaceSide(ctx, 0, -1);
  drawBodySide(ctx, 0, -1);
  drawArmsSide(ctx, 0, -1);
  drawBelt(ctx);
  drawLegsSide(ctx, 0, -1, steps[fi]);
  outline(ctx);
}

function frameWalkRight(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  const steps = [1, 0, 2, 0];
  drawFaceSide(ctx, 0, 1);
  drawBodySide(ctx, 0, 1);
  drawArmsSide(ctx, 0, 1);
  drawBelt(ctx);
  drawLegsSide(ctx, 0, 1, steps[fi]);
  outline(ctx);
}

function frameShoot(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  // fi=0 raise, fi=1 fire, fi=2 recoil
  const yo = fi===2 ? 1 : 0;
  drawHat(ctx, yo);
  drawFaceFront(ctx, yo);
  drawNeck(ctx, yo);
  drawBodyFront(ctx, yo);
  drawBelt(ctx, yo);
  drawLegsFront(ctx, yo, 0);

  // arms – gun arm raised/extended
  const y = 23+yo;
  r(ctx, 8,  y,   4,  6, C.B3);     // left arm
  r(ctx, 8,  y+5, 4,  4, C.SK);
  r(ctx, 8,  y,   1, 10, C.B2);

  if (fi===0) {
    // raising: gun angled up-right
    r(ctx, 35, y-2, 4, 6, C.B3);
    r(ctx, 35, y+3, 4, 4, C.SK);
    r(ctx, 37, y-2, 7, 3, C.GN);
    r(ctx, 37, y-2, 7, 1, C.WH);
    r(ctx, 41, y-2, 3, 2, C.N1);
    px(ctx, 43, y-2,        C.NH);
  } else if (fi===1) {
    // fire: gun fully extended, muzzle flash
    r(ctx, 35, y-1, 4, 5, C.B3);
    r(ctx, 35, y+3, 4, 4, C.SK);
    r(ctx, 37, y-1, 8, 3, C.GN);
    r(ctx, 37, y-1, 8, 1, C.WH);
    r(ctx, 43, y-1, 3, 2, C.N1);
    // muzzle flash (2px cross, neon)
    r(ctx, 44, y-3, 2, 5, C.NH);
    r(ctx, 42, y-1, 5, 2, C.NH);
    px(ctx, 46, y,          C.WH);
  } else {
    // recoil: gun slightly back
    r(ctx, 35, y,   4, 5, C.B3);
    r(ctx, 35, y+4, 4, 4, C.SK);
    r(ctx, 36, y+1, 7, 3, C.GN);
    r(ctx, 36, y+1, 7, 1, C.WH);
    r(ctx, 41, y+1, 3, 2, C.N1);
    px(ctx, 43, y+1,         C.NH);
  }
  outline(ctx);
}

function frameHit(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  const yo = fi===0 ? -1 : 0;  // lean back = hat moves up
  const tilt = fi===0 ? 2 : 0; // body tilts back
  drawHat(ctx, yo-tilt);
  drawFaceFront(ctx, yo-tilt+1);
  drawNeck(ctx, yo);
  // body tilts back – draw slightly right-shifted
  const y = 23+yo;
  r(ctx, 14, y, 22, 10, C.B3);
  r(ctx, 14, y,  4, 10, C.B2);
  r(ctx, 32, y,  4, 10, C.B4);
  r(ctx, 14, y,  1, 10, C.N2);
  r(ctx, 35, y,  1, 10, C.N2);
  r(ctx, 20, y, 10,  2, C.B1);
  // arms flailed out
  r(ctx,  7, y-1, 5, 8, C.B3);  r(ctx,  7, y+6, 5, 4, C.SK);
  r(ctx, 36, y-2, 5, 7, C.B3);  r(ctx, 36, y+4, 5, 4, C.SK);
  drawBelt(ctx, yo);
  drawLegsFront(ctx, yo, 0);
  // hit flash lines
  if (fi===0) {
    r(ctx,  5, 16, 4, 1, C.NH);
    r(ctx, 39, 14, 4, 1, C.NH);
    px(ctx,  4, 14,         C.WH);
    px(ctx, 43, 13,         C.WH);
  }
  outline(ctx);
}

function frameVictory(ctx, fi) {
  ctx.clearRect(0,0,FW,FH);
  // Both arms raised with gun
  drawHat(ctx, -1);
  drawFaceFront(ctx, -1);
  drawNeck(ctx, -1);
  drawBodyFront(ctx, -1);
  drawBelt(ctx, -1);
  drawLegsFront(ctx, -1, fi===0 ? 0 : 0);  // standing

  const y = 22;  // arms raised higher
  // left arm raised
  r(ctx,  8, y-4, 4, 8, C.B3);
  r(ctx,  8, y+3, 4, 4, C.SK);
  // right arm raised with gun
  r(ctx, 36, y-5, 4, 7, C.B3);
  r(ctx, 36, y+1, 4, 4, C.SK);
  r(ctx, 35, y-7, 7, 3, C.GN);
  r(ctx, 35, y-7, 7, 1, C.WH);
  r(ctx, 40, y-7, 3, 2, C.N1);
  px(ctx, 42, y-7,         C.NH);
  // sparkles
  const sp = fi===0
    ? [[6,6],[40,8],[8,28],[42,24]]
    : [[5,10],[41,6],[7,32],[43,20]];
  for (const [sx,sy] of sp) {
    px(ctx, sx,   sy,   C.N2);
    px(ctx, sx+1, sy,   C.N1);
    px(ctx, sx,   sy+1, C.N1);
    px(ctx, sx-1, sy,   C.N2);
    px(ctx, sx,   sy-1, C.N2);
  }
  outline(ctx);
}

// ── Build sheet ───────────────────────────────────────────────────────────────
const sheet = createCanvas(FW*COLS, FH*ROWS);
const sctx  = sheet.getContext('2d');
sctx.imageSmoothingEnabled = false;
sctx.clearRect(0, 0, FW*COLS, FH*ROWS);

const ANIM_DEFS = [
  { row:0, frames:[0,1],       fn: frameIdle      },
  { row:1, frames:[0,1,2,3],   fn: frameWalkDown  },
  { row:2, frames:[0,1,2,3],   fn: frameWalkUp    },
  { row:3, frames:[0,1,2,3],   fn: frameWalkLeft  },
  { row:4, frames:[0,1,2,3],   fn: frameWalkRight },
  { row:5, frames:[0,1,2],     fn: frameShoot     },
  { row:6, frames:[0,1],       fn: frameHit       },
  { row:7, frames:[0,1],       fn: frameVictory   },
];

for (const { row, frames, fn } of ANIM_DEFS) {
  for (const fi of frames) {
    const fc = createCanvas(FW, FH);
    fc.getContext('2d').imageSmoothingEnabled = false;
    fn(fc.getContext('2d'), fi);
    sctx.drawImage(fc, fi*FW, row*FH);
    console.log(`row${row} frame${fi} done`);
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, sheet.toBuffer('image/png'));
console.log(`\nSaved: ${FW*COLS}×${FH*ROWS} → ${OUTPUT}`);

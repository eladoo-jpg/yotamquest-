#!/usr/bin/env node
/**
 * generate_hd_tileset.cjs
 *
 * Crops the HD reference image into 6 tiles, composites them into a
 * single 192×32 PNG (6 × 32px tiles) that Phaser loads as a spritesheet.
 *
 * Panel boundaries determined by pixel sampling of hd_tileset_ref.png:
 *   Stone  (floor)     : x=0..634
 *   Neon wall          : x=636..1079
 *   Door               : x=1082..1543
 *   Crystal            : x=1545..2063
 *
 * Tile index → type:
 *   0  Floor        — stone texture (dark, walkable)
 *   1  Wall         — neon metal panel
 *   2  Cracked Wall — wall + orange SVG crack overlay
 *   3  Energy Wall  — wall + green tint overlay
 *   4  Door         — orange-ring door
 *   5  Crystal      — cyan crystal, white bg removed → transparent
 */

const sharp  = require('sharp');
const fs     = require('fs');
const path   = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'tiles', 'hd_tileset_ref.png');
const OUT = path.join(__dirname, '..', 'public', 'assets', 'tiles', 'neon_lab_tiles.png');

const T = 32;           // tile display size (matches TILE=32 in MazeScene)
const N = 6;            // number of tiles
const STRIP_W = T * N;  // 192
const STRIP_H = T;      // 32

// ── Source crop regions (all are h=512 to use full image height) ──────────
const CROPS = {
  stone:   { left: 0,    top: 0, width: 634, height: 512 },
  wall:    { left: 636,  top: 0, width: 443, height: 512 },
  door:    { left: 1082, top: 0, width: 461, height: 512 },
  crystal: { left: 1545, top: 0, width: 518, height: 512 },
};

// ── SVG crack overlay for tile 2 (Cracked Wall) ──────────────────────────
const CRACK_SVG = `<svg width="${T}" height="${T}" xmlns="http://www.w3.org/2000/svg">
  <line x1="11" y1="1"  x2="15" y2="14" stroke="#ff9a00" stroke-width="1.5" opacity="0.95"/>
  <line x1="15" y1="14" x2="12" y2="25" stroke="#ff9a00" stroke-width="1.5" opacity="0.95"/>
  <line x1="15" y1="14" x2="22" y2="19" stroke="#ff6600" stroke-width="1"   opacity="0.80"/>
  <circle cx="15" cy="14" r="1.5" fill="#ffffff" opacity="0.90"/>
  <circle cx="15" cy="14" r="3"   fill="#ff9a00" opacity="0.20"/>
</svg>`;

async function cropAndResize(region) {
  return sharp(SRC)
    .extract(region)
    .resize(T, T, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function run() {
  console.log('Reading:', SRC);

  // ── Tile 0: Floor (stone texture) ──────────────────────────────────────
  const floor = await cropAndResize(CROPS.stone);
  console.log('  tile 0 floor     ✓');

  // ── Tile 1: Wall (neon metal panel) ────────────────────────────────────
  const wall = await cropAndResize(CROPS.wall);
  console.log('  tile 1 wall      ✓');

  // ── Tile 2: Cracked Wall (wall + orange crack SVG) ──────────────────────
  const cracked = await sharp(wall)
    .composite([{ input: Buffer.from(CRACK_SVG), blend: 'over' }])
    .png()
    .toBuffer();
  console.log('  tile 2 cracked   ✓');

  // ── Tile 3: Energy Wall (wall + semi-transparent green tint) ───────────
  const greenBuf = await sharp({
    create: { width: T, height: T, channels: 4,
              background: { r: 0, g: 220, b: 80, alpha: 90 } },
  }).png().toBuffer();

  const energyWall = await sharp(wall)
    .composite([{ input: greenBuf, blend: 'over' }])
    .png()
    .toBuffer();
  console.log('  tile 3 energy    ✓');

  // ── Tile 4: Door ────────────────────────────────────────────────────────
  const door = await cropAndResize(CROPS.door);
  console.log('  tile 4 door      ✓');

  // ── Tile 5: Crystal (remove near-white checkered background) ───────────
  // The reference PNG renders the "transparent" bg as white/light-gray pixels.
  // Threshold: pixels with high brightness AND low saturation → alpha 0.
  const { data: cRaw, info: cInfo } = await sharp(SRC)
    .extract(CROPS.crystal)
    .resize(T, T, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < cRaw.length; i += 4) {
    const r = cRaw[i], g = cRaw[i + 1], b = cRaw[i + 2];
    const brightness  = (r + g + b) / 3;
    const saturation  = Math.max(r, g, b) - Math.min(r, g, b);
    // White/grey checkerboard: bright AND nearly neutral
    if (brightness > 185 && saturation < 30) {
      cRaw[i + 3] = 0;   // fully transparent
    }
  }
  const crystal = await sharp(cRaw, {
    raw: { width: cInfo.width, height: cInfo.height, channels: 4 },
  }).png().toBuffer();
  console.log('  tile 5 crystal   ✓ (bg removed)');

  // ── Composite into 192×32 strip ─────────────────────────────────────────
  const tiles = [floor, wall, cracked, energyWall, door, crystal];

  await sharp({
    create: { width: STRIP_W, height: STRIP_H, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
  .png()
  .composite(tiles.map((buf, i) => ({ input: buf, left: i * T, top: 0 })))
  .toFile(OUT);

  const stat = fs.statSync(OUT);
  console.log(`\n✓ Saved: ${OUT}`);
  console.log(`  Dimensions: ${STRIP_W} × ${STRIP_H} px  (${N} tiles × ${T}px)`);
  console.log(`  File size : ${(stat.size / 1024).toFixed(1)} KB`);
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });

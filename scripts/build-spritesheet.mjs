/**
 * build-spritesheet.mjs
 * Converts the 4-pose reference image into a game-ready 4-frame spritesheet.
 * Each frame: 48 × 64 px, transparent background (white-keyed).
 * Output: public/assets/sprites/yotam.png  (192 × 64)
 *
 * Run: node scripts/build-spritesheet.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const INPUT  = 'C:/Users/elado/Downloads/ChatGPT Image May 1, 2026, 05_42_01 PM (1).png';
const OUTPUT = join(ROOT, 'public/assets/sprites/yotam.png');

// Source frame layout: 4 poses side-by-side in a 1536×1024 image
const SRC_W    = 1536;
const SRC_H    = 1024;
const COLS     = 4;
const FRAME_W  = SRC_W / COLS;       // 384 px per pose column
const CROP_TOP = 20;                  // skip tiny top padding
const CROP_BOT = 160;                 // skip label text at bottom
const FRAME_H  = SRC_H - CROP_TOP - CROP_BOT;  // 844 px usable height

// Output per-frame size (must be divisible for Phaser spritesheet)
const OUT_W = 48;
const OUT_H = 64;

// White-key threshold: pixels with R,G,B all above this become transparent
const WHITE_THRESH = 230;

async function keyWhite(buf) {
  // Convert to RGBA raw, zero out near-white pixels, then back to PNG
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = new Uint8Array(data);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i+1], b = px[i+2];
    if (r > WHITE_THRESH && g > WHITE_THRESH && b > WHITE_THRESH) {
      px[i+3] = 0; // fully transparent
    }
  }

  return sharp(Buffer.from(px), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

async function main() {
  console.log('Reading source image...');

  const frames = [];
  for (let col = 0; col < COLS; col++) {
    // 1. Crop the column region (drop label row at bottom, tiny top padding)
    let buf = await sharp(INPUT)
      .extract({
        left:   col * FRAME_W,
        top:    CROP_TOP,
        width:  FRAME_W,
        height: FRAME_H,
      })
      .toBuffer();

    // 2. Remove white background
    buf = await keyWhite(buf);

    // 3. Resize to output frame size, keeping aspect ratio with transparent padding
    buf = await sharp(buf)
      .resize(OUT_W, OUT_H, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    frames.push(buf);
    console.log(`  Frame ${col} done`);
  }

  // 4. Composite all frames into a horizontal strip
  const compositeInputs = frames.map((input, i) => ({
    input,
    left: i * OUT_W,
    top:  0,
  }));

  mkdirSync(dirname(OUTPUT), { recursive: true });

  await sharp({
    create: {
      width:      OUT_W * COLS,
      height:     OUT_H,
      channels:   4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toFile(OUTPUT);

  console.log(`\nSpritesheet written: ${OUTPUT}`);
  console.log(`  ${OUT_W * COLS} × ${OUT_H} px  (${COLS} frames @ ${OUT_W}×${OUT_H})`);
}

main().catch(err => { console.error(err); process.exit(1); });

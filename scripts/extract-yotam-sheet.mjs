/**
 * extract-yotam-sheet.mjs  v3-restore
 *
 * RESTORED v3 pipeline — this is what produced the sharp, crisp look:
 *   crop 64×64 → resize to 32×32 (nearest-neighbour) → key dark bg
 *   → centre in 48×48 transparent cell (8 px pad each side)
 *
 * Final sheet: 192×384  (4 cols × 8 rows × 48×48)
 *
 * Run: node scripts/extract-yotam-sheet.mjs
 */

import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = dirname(fileURLToPath(import.meta.url)) + '/..';
const SRC    = 'C:/Users/elado/Downloads/ChatGPT Image May 5, 2026, 07_17_32 PM.png';
const OUTPUT = ROOT + '/public/assets/sprites/yotam.png';

const PANEL_X = 662, PANEL_H = 1024;

const CELL      = 48;   // output cell
const NATIVE    = 32;   // resize target (nearest-neighbour → crisp pixels)
const PAD       = (CELL - NATIVE) / 2;  // 8 px centering
const CROP_HALF = 32;   // → 64×64 source crop

const KEY_THRESH = 35;  // r+g+b < 35 → transparent

const ROW_DEFS = [
  { name: 'idle',       row: 0, yc:  90, xs: [360, 452]           },
  { name: 'walk_down',  row: 1, yc: 191, xs: [358, 466, 585, 693] },
  { name: 'walk_up',    row: 2, yc: 288, xs: [357, 464, 583, 691] },
  { name: 'walk_left',  row: 3, yc: 385, xs: [356, 464, 584, 693] },
  { name: 'walk_right', row: 4, yc: 482, xs: [358, 465, 584, 697] },
  { name: 'shoot',      row: 5, yc: 584, xs: [357, 441, 510]      },
  { name: 'hit',        row: 6, yc: 704, xs: [364, 468], ch: 32   },
  { name: 'victory',    row: 7, yc: 724, xs: [659, 771], ch: 44   },
];

const sheetW = CELL * 4;   // 192
const sheetH = CELL * 8;   // 384

const sheet = createCanvas(sheetW, sheetH);
const sctx  = sheet.getContext('2d');
sctx.clearRect(0, 0, sheetW, sheetH);
sctx.imageSmoothingEnabled = false;

for (const { name, row, yc, xs, ch: rowCH } of ROW_DEFS) {
  const ch = rowCH ?? CROP_HALF;

  for (let fi = 0; fi < xs.length; fi++) {
    const xc = xs[fi];

    const cropL = Math.max(0, PANEL_X + xc - ch);
    const cropT = Math.max(0, yc - ch);
    const cropW = Math.min(ch * 2, 1536 - cropL);
    const cropH = Math.min(ch * 2, PANEL_H - cropT);

    // 1. Crop from source
    let buf = await sharp(SRC)
      .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
      .toBuffer();

    // 2. Resize to 32×32 nearest-neighbour (produces crisp pixel-art look)
    const { data, info } = await sharp(buf)
      .resize(NATIVE, NATIVE, { kernel: 'nearest', fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 3. Key dark background
    const px = new Uint8Array(data);
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] + px[i+1] + px[i+2] < KEY_THRESH) px[i+3] = 0;
    }

    const keyed = await sharp(Buffer.from(px), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toBuffer();

    // 4. Place 32×32 centred in 48×48 cell (8 px pad)
    const img = await loadImage(keyed);
    sctx.drawImage(img, fi * CELL + PAD, row * CELL + PAD, NATIVE, NATIVE);

    console.log(`${name}[${fi}] → sheet(${fi*CELL+PAD}, ${row*CELL+PAD})`);
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, sheet.toBuffer('image/png'));
console.log(`\nSaved: ${sheetW}×${sheetH} → ${OUTPUT}`);

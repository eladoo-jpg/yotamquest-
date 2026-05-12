/**
 * YotamQuest — programmatic icon generator.
 * Creates icon-512.png, icon-192.png, icon-180.png in ./public/
 * Run: node generate-icon.mjs
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

mkdirSync('./public', { recursive: true });

/* ─── helpers ────────────────────────────────────────────────────────────── */

/** Draw a rounded rectangle path */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Multi-layer glow: draw fn multiple times with increasing blur + reducing alpha */
function withGlow(ctx, color, layers, drawFn) {
  layers.forEach(([blur, alpha]) => {
    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = blur;
    ctx.globalAlpha  = alpha;
    drawFn();
    ctx.restore();
  });
  // Crisp top layer
  ctx.save();
  drawFn();
  ctx.restore();
}

/* ─── icon drawing ───────────────────────────────────────────────────────── */

function drawIcon(canvas) {
  const S   = canvas.width;   // 512 (or smaller)
  const cx  = S / 2;
  const cy  = S / 2;
  const ctx = canvas.getContext('2d');

  /* ── background ── */
  const bg = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy, S * 0.72);
  bg.addColorStop(0,   '#071428');
  bg.addColorStop(0.6, '#030b18');
  bg.addColorStop(1,   '#010408');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  /* ── subtle grid lines ── */
  const gridStep = S / 12;
  ctx.strokeStyle = '#0a1e30';
  ctx.lineWidth   = S * 0.003;
  for (let i = 1; i < 12; i++) {
    ctx.beginPath(); ctx.moveTo(i * gridStep, 0); ctx.lineTo(i * gridStep, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * gridStep); ctx.lineTo(S, i * gridStep); ctx.stroke();
  }

  /* ── outer neon ring ── */
  const ringR = S * 0.455;
  withGlow(ctx, '#0088ff', [[40, 0.18], [22, 0.30], [10, 0.50]], () => {
    ctx.strokeStyle = '#0077cc';
    ctx.lineWidth   = S * 0.018;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();
  });
  // Inner ring accent (thinner, brighter)
  withGlow(ctx, '#00ccff', [[18, 0.25], [8, 0.45]], () => {
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth   = S * 0.007;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 0.88, 0, Math.PI * 2);
    ctx.stroke();
  });

  /* ── circuit traces (4 cardinal spokes + corner dots) ── */
  const traceColor = '#003a66';
  const traceGlow  = '#0055aa';
  const traceW     = S * 0.007;
  const traceStart = ringR * 0.82;
  const traceEnd   = ringR + S * 0.04;

  ctx.strokeStyle = traceGlow;
  ctx.lineWidth   = traceW;
  ctx.shadowColor = traceGlow;
  ctx.shadowBlur  = 10;

  // Cardinal spokes
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * traceStart, cy + dy * traceStart);
    ctx.lineTo(cx + dx * traceEnd,   cy + dy * traceEnd);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;

  // Tick marks around ring at 12 positions
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const isCard = i % 3 === 0;
    const r1 = ringR + S * 0.01;
    const r2 = r1 + S * (isCard ? 0.03 : 0.015);
    ctx.strokeStyle = isCard ? '#0077cc' : '#003a55';
    ctx.lineWidth   = S * (isCard ? 0.007 : 0.004);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }

  /* ── giant "Y" letterform ── */
  const yScale = S * 0.0052;  // scales to size
  const yTop   = cy - S * 0.22;
  const yMid   = cy - S * 0.02;
  const yBot   = cy + S * 0.28;
  const spread = S * 0.22;
  const stem   = S * 0.055;

  // Build the Y path
  const drawY = () => {
    ctx.beginPath();
    // Left arm — top-left to mid
    ctx.moveTo(cx - spread, yTop);
    ctx.lineTo(cx - stem * 0.5, yMid);
    // Right arm — mid to top-right
    ctx.lineTo(cx + spread, yTop);
    ctx.lineTo(cx + spread + stem, yTop);
    ctx.lineTo(cx + stem * 0.5, yMid + stem * 0.6);
    // Stem — mid down
    ctx.lineTo(cx + stem * 0.5, yBot);
    ctx.lineTo(cx - stem * 0.5, yBot);
    ctx.lineTo(cx - stem * 0.5, yMid + stem * 0.6);
    // Back up left arm
    ctx.lineTo(cx - spread - stem, yTop);
    ctx.closePath();
  };

  // Deep glow layers
  withGlow(ctx, '#00aaff', [[60, 0.12], [35, 0.22], [18, 0.40]], () => {
    ctx.fillStyle = '#00aaff';
    drawY();
    ctx.fill();
  });

  // Fill body
  ctx.save();
  const yGrad = ctx.createLinearGradient(cx - spread, yTop, cx + spread, yBot);
  yGrad.addColorStop(0, '#2266dd');
  yGrad.addColorStop(0.4, '#1188ff');
  yGrad.addColorStop(1, '#004499');
  ctx.fillStyle = yGrad;
  drawY();
  ctx.fill();
  ctx.restore();

  // Bright cyan outline
  withGlow(ctx, '#00eeff', [[20, 0.55], [8, 0.80]], () => {
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth   = S * 0.010;
    ctx.lineJoin    = 'round';
    drawY();
    ctx.stroke();
  });

  // Inner highlight (top-left of each arm)
  ctx.save();
  ctx.fillStyle = 'rgba(140,220,255,0.18)';
  drawY();
  ctx.clip();
  ctx.fillRect(cx - spread - stem, yTop, spread * 1.1, S * 0.18);
  ctx.restore();

  /* ── small pixel-art "dots" forming Yotam's face above the Y ── */
  const faceY = yTop - S * 0.07;
  const faceR = S * 0.045;

  // Head circle
  withGlow(ctx, '#ddaa88', [[12, 0.35]], () => {
    ctx.fillStyle = '#cc9977';
    ctx.beginPath();
    ctx.arc(cx, faceY, faceR, 0, Math.PI * 2);
    ctx.fill();
  });
  // Eyes (cyan glowing dots)
  [[-.45, -.15], [.45, -.15]].forEach(([ex, ey]) => {
    withGlow(ctx, '#00ffff', [[10, 0.7]], () => {
      ctx.fillStyle = '#00eeff';
      ctx.beginPath();
      ctx.arc(cx + ex * faceR, faceY + ey * faceR, faceR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  /* ── Hebrew "י" (yod) in bottom-right — subtle accent ── */
  const yodSize = S * 0.11;
  ctx.save();
  ctx.shadowColor = '#0077cc';
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = '#0055aa';
  ctx.font        = `bold ${yodSize}px "Arial","Helvetica",sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline= 'middle';
  ctx.globalAlpha = 0.55;
  ctx.fillText('י', cx + ringR * 0.62, cy + ringR * 0.62);
  ctx.restore();

  /* ── 4 corner neon dots ── */
  const dotR   = S * 0.022;
  const dotPos = S * 0.44;
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
    withGlow(ctx, '#0088ff', [[14, 0.4], [6, 0.7]], () => {
      ctx.fillStyle = '#0099ff';
      ctx.beginPath();
      ctx.arc(cx + sx * dotPos, cy + sy * dotPos, dotR, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  /* ── version "v" tiny text ── */
  ctx.save();
  ctx.fillStyle   = '#113355';
  ctx.font        = `${S * 0.04}px "Courier New",monospace`;
  ctx.textAlign   = 'center';
  ctx.textBaseline= 'bottom';
  ctx.fillText('v0.1', cx, S * 0.97);
  ctx.restore();
}

/* ─── generate all sizes ─────────────────────────────────────────────────── */

const SIZES = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-180.png', size: 180 },  // Apple Touch Icon
];

for (const { file, size } of SIZES) {
  const canvas = createCanvas(size, size);
  drawIcon(canvas);
  const buffer = canvas.toBuffer('image/png');
  const outPath = join('./public', file);
  writeFileSync(outPath, buffer);
  console.log(`✅  ${outPath}  (${(buffer.length / 1024).toFixed(0)} KB)`);
}

console.log('\nAll icons generated in ./public/');

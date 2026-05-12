import { readFileSync, writeFileSync } from 'fs';
const f = 'C:/Projects/Claude proj/yotamquesT/src/game/scenes/MazeScene.js';
let s = readFileSync(f, 'utf8');

// ── PART 2A: enhance _onCoin ──────────────────────────────────────────────────
const O1 = [
  `  _onCoin(yotam, coin) {`,
  `    coin.disableBody(false, false);`,
  `    this.st.coins++;`,
  `    this.st.xp += 5;`,
  `    this._playSound('collect');`,
  `    this.tweens.add({`,
  `      targets: coin, y: coin.y - 26, alpha: 0, scaleX: 1.5, scaleY: 1.5,`,
  `      duration: 280, ease: 'Cubic.easeOut',`,
  `      onComplete: () => coin.destroy(),`,
  `    });`,
  `    this._refreshHUD();`,
  `  }`,
].join('\n');

const N1 = [
  `  _onCoin(yotam, coin) {`,
  `    coin.disableBody(false, false);`,
  `    this.st.coins++;`,
  `    this.st.xp += 5;`,
  `    this._playSound('coin');`,
  ``,
  `    // Fly-up + fade existing coin sprite`,
  `    this.tweens.add({`,
  `      targets: coin, y: coin.y - 26, alpha: 0, scaleX: 1.5, scaleY: 1.5,`,
  `      duration: 280, ease: 'Cubic.easeOut',`,
  `      onComplete: () => coin.destroy(),`,
  `    });`,
  ``,
  `    // Floating '+1' text`,
  `    const ft = this.add.text(coin.x, coin.y - 8, '+1', {`,
  `      fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#ffdd00',`,
  `      stroke: '#000000', strokeThickness: 3,`,
  `    }).setDepth(200).setScrollFactor(1);`,
  `    this.tweens.add({`,
  `      targets: ft, y: ft.y - 40, alpha: 0, duration: 500, ease: 'Cubic.easeOut',`,
  `      onComplete: () => ft.destroy(),`,
  `    });`,
  ``,
  `    // Particle burst`,
  `    const pe = this.add.particles(coin.x, coin.y, 'particle_dot', {`,
  `      speed: { min: 40, max: 110 }, angle: { min: 0, max: 360 },`,
  `      scale: { start: 0.7, end: 0 }, lifespan: 320,`,
  `      tint: [0xffcc00, 0xffee88], emitting: false,`,
  `    }).setDepth(20);`,
  `    pe.explode(Phaser.Math.Between(4, 5));`,
  `    this.time.delayedCall(380, () => { if (pe?.active) pe.destroy(); });`,
  ``,
  `    // Combo tracking`,
  `    this._trackCombo();`,
  ``,
  `    // Every-5-coins milestone`,
  `    if (this.st.coins > 0 && this.st.coins % 5 === 0) {`,
  `      this.tweens.add({`,
  `        targets: this._hCoins, scaleX: 1.5, scaleY: 1.5,`,
  `        yoyo: true, duration: 110, ease: 'Back.easeOut',`,
  `      });`,
  `      this.cameras.main.flash(200, 0, 80, 255, false);`,
  `      const cx = this.cameras.main.width / 2;`,
  `      const ul = this.add.text(cx, 70, 'NEW TECH UNLOCKED 🔓', {`,
  `        fontFamily: 'Courier New, monospace', fontSize: '15px', color: '#00ccff',`,
  `        stroke: '#000000', strokeThickness: 3,`,
  `        shadow: { offsetX: 0, offsetY: 0, color: '#00aaff', blur: 12, fill: true },`,
  `      }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);`,
  `      this.tweens.add({`,
  `        targets: ul, alpha: 1, duration: 250,`,
  `        onComplete: () => {`,
  `          this.time.delayedCall(1200, () => {`,
  `            this.tweens.add({ targets: ul, alpha: 0, duration: 350,`,
  `              onComplete: () => ul.destroy() });`,
  `          });`,
  `        },`,
  `      });`,
  `    }`,
  ``,
  `    this._refreshHUD();`,
  `  }`,
].join('\n');

if (!s.includes(O1)) { console.error('O1 (onCoin) not found'); process.exit(1); }
s = s.replace(O1, N1);
console.log('✓ _onCoin replaced');

// ── magnet pull before parallax ──────────────────────────────────────────────
const MAG_MARKER = '    // ── Parallax update (after camera follows player to avoid jitter) ──';
const MAG_INSERT = [
  `    // Magnet: slide coins toward Yotam when within 60px`,
  `    if (this.coinGroup) {`,
  `      this.coinGroup.getChildren().forEach(coin => {`,
  `        if (!coin.active) return;`,
  `        const dx = this.yotam.x - coin.x;`,
  `        const dy = this.yotam.y - coin.y;`,
  `        const dist = Math.sqrt(dx * dx + dy * dy);`,
  `        if (dist < 60 && dist > 1) {`,
  `          const pull = 220 * (1 - dist / 60) * (1 / 60);`,
  `          coin.x += (dx / dist) * pull;`,
  `          coin.y += (dy / dist) * pull;`,
  `          coin.refreshBody();`,
  `        }`,
  `      });`,
  `    }`,
  ``,
  `    `,
].join('\n');
if (!s.includes(MAG_MARKER)) { console.error('MAG_MARKER not found'); process.exit(1); }
s = s.replace(MAG_MARKER, MAG_INSERT + MAG_MARKER);
console.log('✓ magnet pull inserted');

// ── footstep sound in dust block ─────────────────────────────────────────────
const OLD_DUST = [
  `    // Dust particles when walking`,
  `    if (vx || vy) {`,
  `      const now2 = this.time.now;`,
  `      if (now2 - (this._lastDustTime ?? 0) > 140) {`,
  `        this._lastDustTime = now2;`,
  `        this._emitDust(this.yotam.x, this.yotam.y + 10);`,
  `      }`,
  `    }`,
].join('\n');
const NEW_DUST = [
  `    // Dust particles + footstep sound when walking`,
  `    if (vx || vy) {`,
  `      const now2 = this.time.now;`,
  `      if (now2 - (this._lastDustTime ?? 0) > 140) {`,
  `        this._lastDustTime = now2;`,
  `        this._emitDust(this.yotam.x, this.yotam.y + 10);`,
  `      }`,
  `      if (now2 - (this._lastFootstepTime ?? 0) > 500) {`,
  `        this._lastFootstepTime = now2;`,
  `        this._playSound('footstep');`,
  `      }`,
  `    }`,
].join('\n');
if (!s.includes(OLD_DUST)) { console.error('OLD_DUST not found'); process.exit(1); }
s = s.replace(OLD_DUST, NEW_DUST);
console.log('✓ footstep sound added');

// ── mine sound ───────────────────────────────────────────────────────────────
s = s.replace(
  `      this._emitSparks(c * TILE + TILE / 2, r * TILE + TILE / 2);\n      this._playSound('break');`,
  `      this._emitSparks(c * TILE + TILE / 2, r * TILE + TILE / 2);\n      this._playSound('mine');`
);
console.log('✓ mine sound');

// ── expand _playSound ─────────────────────────────────────────────────────────
const OLD_COLLECT = [
  `      case 'collect':`,
  `        osc.type = 'sine';`,
  `        osc.frequency.setValueAtTime(660, now);`,
  `        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);`,
  `        gain.gain.setValueAtTime(0.12, now);`,
  `        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);`,
  `        osc.start(now); osc.stop(now + 0.14);`,
  `        break;`,
  `      default: return;`,
].join('\n');

const NEW_SOUNDS = [
  `      case 'collect':  // alias kept for compatibility`,
  `      case 'coin':`,
  `        osc.type = 'sine';`,
  `        osc.frequency.setValueAtTime(880, now);`,
  `        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);`,
  `        gain.gain.setValueAtTime(0.12, now);`,
  `        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);`,
  `        osc.start(now); osc.stop(now + 0.09);`,
  `        break;`,
  `      case 'correct': {`,
  `        const o2c = ctx.createOscillator(); const g2c = ctx.createGain();`,
  `        o2c.connect(g2c); g2c.connect(ctx.destination);`,
  `        osc.type = 'sine'; o2c.type = 'sine';`,
  `        osc.frequency.setValueAtTime(523, now); osc.frequency.setValueAtTime(659, now + 0.08);`,
  `        o2c.frequency.setValueAtTime(784, now + 0.13);`,
  `        gain.gain.setValueAtTime(0.10, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);`,
  `        g2c.gain.setValueAtTime(0.0, now); g2c.gain.setValueAtTime(0.10, now + 0.12);`,
  `        g2c.gain.exponentialRampToValueAtTime(0.001, now + 0.28);`,
  `        osc.start(now); osc.stop(now + 0.22); o2c.start(now + 0.12); o2c.stop(now + 0.28);`,
  `        break;`,
  `      }`,
  `      case 'wrong':`,
  `        osc.type = 'sawtooth';`,
  `        osc.frequency.setValueAtTime(180, now);`,
  `        osc.frequency.linearRampToValueAtTime(90, now + 0.15);`,
  `        gain.gain.setValueAtTime(0.07, now);`,
  `        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);`,
  `        osc.start(now); osc.stop(now + 0.15);`,
  `        break;`,
  `      case 'door_unlock': {`,
  `        const o3d = ctx.createOscillator(); const g3d = ctx.createGain();`,
  `        o3d.connect(g3d); g3d.connect(ctx.destination);`,
  `        osc.type = 'square'; o3d.type = 'sine';`,
  `        osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);`,
  `        o3d.frequency.setValueAtTime(1320, now + 0.14); o3d.frequency.exponentialRampToValueAtTime(660, now + 0.30);`,
  `        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);`,
  `        g3d.gain.setValueAtTime(0.10, now + 0.14); g3d.gain.exponentialRampToValueAtTime(0.001, now + 0.32);`,
  `        osc.start(now); osc.stop(now + 0.14); o3d.start(now + 0.14); o3d.stop(now + 0.32);`,
  `        break;`,
  `      }`,
  `      case 'footstep':`,
  `        osc.type = 'triangle';`,
  `        osc.frequency.setValueAtTime(200, now);`,
  `        gain.gain.setValueAtTime(0.022, now);`,
  `        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);`,
  `        osc.start(now); osc.stop(now + 0.04);`,
  `        break;`,
  `      case 'mine': {`,
  `        const nm = ctx.createOscillator(); const gm = ctx.createGain();`,
  `        nm.connect(gm); gm.connect(ctx.destination);`,
  `        osc.type = 'sawtooth'; nm.type = 'square';`,
  `        osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);`,
  `        nm.frequency.setValueAtTime(160, now); nm.frequency.exponentialRampToValueAtTime(40, now + 0.1);`,
  `        gain.gain.setValueAtTime(0.14, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);`,
  `        gm.gain.setValueAtTime(0.08, now); gm.gain.exponentialRampToValueAtTime(0.001, now + 0.08);`,
  `        osc.start(now); osc.stop(now + 0.1); nm.start(now); nm.stop(now + 0.08);`,
  `        break;`,
  `      }`,
  `      default: return;`,
].join('\n');

if (!s.includes(OLD_COLLECT)) { console.error('OLD_COLLECT not found'); process.exit(1); }
s = s.replace(OLD_COLLECT, NEW_SOUNDS);
console.log('✓ _playSound expanded');

// ── HUD font size + contrast ──────────────────────────────────────────────────
const OLD_HUD = [
  `      fontFamily: 'Courier New, monospace', fontSize: '13px', color,`,
  `      }).setScrollFactor(0).setDepth(100);`,
  ``,
  `    this._hHearts   = t(10,  9, '❤❤❤',  '#ff4455');`,
  `    this._hCoins    = t(80,  9, '🪙 0',   '#ffcc00');`,
  `    this._hDiamonds = t(136, 9, '💎 0',   '#00eeff');`,
  `    this._hXP       = t(192, 9, '⚡0',    '#88ff44');`,
].join('\n');
const NEW_HUD = [
  `      fontFamily: 'Courier New, monospace', fontSize: '15px', color,`,
  `    }).setScrollFactor(0).setDepth(100);`,
  ``,
  `    this._hHearts   = t(10,  7, '❤❤❤',  '#ff3344');`,
  `    this._hCoins    = t(82,  7, '🪙 0',   '#ffdd00');`,
  `    this._hDiamonds = t(140, 7, '💎 0',   '#00ffff');`,
  `    this._hXP       = t(198, 7, '⚡0',    '#99ff44');`,
].join('\n');
if (!s.includes(OLD_HUD)) { console.error('OLD_HUD not found'); process.exit(1); }
s = s.replace(OLD_HUD, NEW_HUD);
console.log('✓ HUD font/contrast updated');

writeFileSync(f, s, 'utf8');
console.log('All 2A-2D edits saved.');

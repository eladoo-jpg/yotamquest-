import { readFileSync, writeFileSync } from 'fs';
const f = 'C:/Projects/Claude proj/yotamquesT/src/game/scenes/BossScene.js';
let s = readFileSync(f, 'utf8');

// ── 1. _glitchHit: boss sprite shake + white tint flash ──────────────────────
const OLD_HIT = `    this.cameras.main.shake(200, 0.009);
    this._showTextPop('קוד נפרץ! 💥', '#00ffaa', this.glitch.x, this.glitch.y - 50);`;
const NEW_HIT = `    this.cameras.main.shake(200, 0.009);
    this._showTextPop('קוד נפרץ! 💥', '#00ffaa', this.glitch.x, this.glitch.y - 50);
    // Boss sprite shake ±4px + white tint flash (Part 3B)
    if (this.glitch?.active) {
      const _ox = this.glitch.x;
      this.tweens.add({
        targets: this.glitch, x: { from: _ox - 4, to: _ox + 4 },
        yoyo: true, repeat: 2, duration: 50,
        onComplete: () => { if (this.glitch?.active) this.glitch.x = _ox; },
      });
      this.glitch.setTint(0xffffff);
      this.time.delayedCall(100, () => { if (this.glitch?.active) this.glitch.clearTint(); });
    }`;
if (!s.includes(OLD_HIT)) { console.error('OLD_HIT not found'); process.exit(1); }
s = s.replace(OLD_HIT, NEW_HIT);
console.log('✓ boss sprite shake + white tint added to _glitchHit');

// ── 2. _fireQuestion: micro shake when boss "speaks" ─────────────────────────
const OLD_FIRE = `    console.log('[Boss] _fireQuestion — dispatching gate:open with id:', eventId, '| bossHP:', this._bossHP);

    window.dispatchEvent(new CustomEvent('yotam:gate:open', {`;
const NEW_FIRE = `    console.log('[Boss] _fireQuestion — dispatching gate:open with id:', eventId, '| bossHP:', this._bossHP);
    this.cameras.main.shake(120, 0.004);

    window.dispatchEvent(new CustomEvent('yotam:gate:open', {`;
if (!s.includes(OLD_FIRE)) { console.error('OLD_FIRE not found'); process.exit(1); }
s = s.replace(OLD_FIRE, NEW_FIRE);
console.log('✓ boss-speaks shake added to _fireQuestion');

writeFileSync(f, s, 'utf8');
console.log('All 3B boss edits saved.');

/**
 * Glitch — the final boss.
 * Invulnerable to weapons. Damaged ONLY by correct LearningGate answers.
 * Wrong answers heal it.
 */
import * as Phaser from 'phaser';

const GW = 80;
const GH = 88;

export default class Glitch extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    Glitch._buildTexture(scene);

    super(scene, x, y, 'glitch');
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body — boss doesn't move w/ physics

    this.setDepth(12);
    this.setScale(1);

    this.hp    = 5;
    this.maxHp = 5;
    this._dead = false;

    // Floating sine movement (purely cosmetic, overrides x/y each frame)
    this._baseX = x;
    this._baseY = y;
    this._floatT = 0;

    // Glitch flicker timer
    this._glitchTimer = scene.time.addEvent({
      delay: 120,
      callback: this._flicker,
      callbackScope: this,
      loop: true,
    });
  }

  /* ─── texture ────────────────────────────────────────────────────────────── */
  static _buildTexture(scene) {
    if (scene.textures.exists('glitch')) return;
    const g = scene.make.graphics({ add: false });

    // ── body background ──
    g.fillStyle(0x0a0018, 1);
    g.fillRoundedRect(8, 14, GW - 16, GH - 18, 10);

    // ── corrupted body segments ──
    for (let i = 0; i < 6; i++) {
      const even = i % 2 === 0;
      g.fillStyle(even ? 0x260033 : 0x1a0022, 0.9);
      g.fillRect(10, 16 + i * 11, GW - 20, 10);
    }

    // ── neon red glitch stripes (diagonal corruption) ──
    const stripes = [0xff0022, 0xcc0033, 0xff3300, 0x990011, 0xff1144];
    for (let i = 0; i < 9; i++) {
      g.fillStyle(stripes[i % 5], 0.28);
      const sw = 12 + ((i * 7) % 22);
      const sx = 10 + ((i * 13) % (GW - 22));
      g.fillRect(sx, 18 + i * 8, sw, 3);
    }

    // ── spikes / horns on top ──
    g.fillStyle(0xcc0033, 1);
    g.fillTriangle(GW / 2 - 20, 14,  GW / 2 - 30, -4,  GW / 2 - 10, 14);
    g.fillTriangle(GW / 2,       14,  GW / 2,      2,   GW / 2 + 10, 14);
    g.fillTriangle(GW / 2 + 20, 14,  GW / 2 + 10, 14,  GW / 2 + 30, -4);
    // spike glow
    g.lineStyle(1, 0xff3355, 0.6);
    g.strokeTriangle(GW / 2 - 20, 14, GW / 2 - 30, -4, GW / 2 - 10, 14);
    g.strokeTriangle(GW / 2,      14, GW / 2,       2,  GW / 2 + 10, 14);
    g.strokeTriangle(GW / 2 + 20, 14, GW / 2 + 10, 14, GW / 2 + 30, -4);

    // ── left eye ──
    const ex1 = GW / 2 - 18, ey = 36;
    g.fillStyle(0xff0000, 0.25); g.fillCircle(ex1, ey, 12);   // outer glow
    g.fillStyle(0xdd1111, 1);    g.fillCircle(ex1, ey, 7);    // iris
    g.fillStyle(0xff6600, 1);    g.fillCircle(ex1, ey, 3.5);  // pupil
    g.fillStyle(0xffffff, 0.8);  g.fillCircle(ex1 - 2, ey - 2, 1.5); // glint

    // ── right eye ──
    const ex2 = GW / 2 + 18;
    g.fillStyle(0xff0000, 0.25); g.fillCircle(ex2, ey, 12);
    g.fillStyle(0xdd1111, 1);    g.fillCircle(ex2, ey, 7);
    g.fillStyle(0xff6600, 1);    g.fillCircle(ex2, ey, 3.5);
    g.fillStyle(0xffffff, 0.8);  g.fillCircle(ex2 - 2, ey - 2, 1.5);

    // ── mouth (jagged) ──
    g.lineStyle(2, 0xff2222, 0.8);
    g.beginPath();
    g.moveTo(GW / 2 - 14, 56);
    for (let i = 0; i < 7; i++) {
      const mx = GW / 2 - 14 + i * 4;
      const my = 56 + (i % 2 === 0 ? 5 : 0);
      g.lineTo(mx, my);
    }
    g.strokePath();

    // ── neon red outline ──
    g.lineStyle(2, 0xff0033, 0.75);
    g.strokeRoundedRect(8, 14, GW - 16, GH - 18, 10);

    // ── bottom "legs" / tendrils ──
    g.lineStyle(2, 0xcc0033, 0.55);
    for (let i = 0; i < 5; i++) {
      const lx = 18 + i * 12;
      g.lineBetween(lx, GH - 4, lx + (i % 2 ? 6 : -4), GH + 8);
    }

    g.generateTexture('glitch', GW, GH + 10);
    g.destroy();
  }

  /* ─── glitch flicker ─────────────────────────────────────────────────────── */
  _flicker() {
    if (this._dead || !this.scene) return;
    const r = Math.random();
    if (r < 0.15) {
      // Brief tint shift
      this.setTint(r < 0.07 ? 0xff2244 : 0xdd0022);
      this.scene.time.delayedCall(80, () => { if (!this._dead && this.scene) this.clearTint(); });
    }
    if (r < 0.08) {
      // Micro jitter
      this.setPosition(
        this._baseX + (Math.random() - 0.5) * 6,
        this._baseY + (Math.random() - 0.5) * 4,
      );
    }
  }

  /* ─── take hit (from correct answer) ────────────────────────────────────── */
  hit(damage = 1) {
    if (this._dead) return false;
    this.hp = Math.max(0, this.hp - damage);
    // Big white flash
    this.setTint(0xffffff);
    this.scene.time.delayedCall(200, () => { if (!this._dead && this.scene) this.clearTint(); });
    if (this.hp <= 0) { this._die(); return true; }
    return false;
  }

  /* ─── heal (from wrong answer) ───────────────────────────────────────────── */
  heal(amount = 1) {
    if (this._dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    // Red glow burst
    this.setTint(0xff0000);
    this.scene.tweens.add({
      targets: this, alpha: { from: 1, to: 0.6 },
      duration: 80, yoyo: true, repeat: 2,
      onComplete: () => { if (!this._dead && this.scene) { this.clearTint(); this.setAlpha(1); } },
    });
  }

  /* ─── death ──────────────────────────────────────────────────────────────── */
  _die() {
    if (this._dead) return;
    this._dead = true;
    this._glitchTimer?.remove(false);

    if (this.body) this.body.setEnable(false);

    // Massive 3-wave particle explosion
    const colors = [0xff0033, 0xff6600, 0xffff00, 0x00ffff, 0xff00ff, 0xffffff];
    [0, 120, 260].forEach(delay => {
      this.scene.time.delayedCall(delay, () => {
        if (!this.scene) return;
        try {
          const em = this.scene.add.particles(this.x, this.y, 'coin', {
            speed:    { min: 80, max: 320 },
            angle:    { min: 0, max: 360 },
            scale:    { start: 1.2, end: 0 },
            alpha:    { start: 1, end: 0 },
            lifespan: 800,
            quantity: 40,
            tint:     colors,
            gravityY: 0,
            emitting: false,
          });
          em.explode(40);
          this.scene.time.delayedCall(1000, () => em?.destroy());
        } catch (_) {}
      });
    });

    // Scale & fade out
    this.scene.tweens.add({
      targets: this, alpha: 0, scaleX: 3.5, scaleY: 3.5,
      duration: 500, ease: 'Cubic.easeOut',
      onComplete: () => { if (this.scene) this.destroy(); },
    });
  }

  /* ─── float animation ────────────────────────────────────────────────────── */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this._dead) return;
    this._floatT += delta * 0.0015;
    const floatY = this._baseY + Math.sin(this._floatT) * 7;
    const floatX = this._baseX + Math.cos(this._floatT * 0.7) * 3;
    this.setPosition(floatX, floatY);
    if (this.body) this.body.reset(floatX, floatY);
  }
}

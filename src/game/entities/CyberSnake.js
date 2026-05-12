/**
 * CyberSnake — Patrol enemy for MazeScene.
 * Procedurally generated sprite. Left-right patrol. 3 HP.
 * Communicates back to the scene via return values (no coupling to scene methods).
 */
import * as Phaser from 'phaser';

const SW = 36;   // texture width  (includes tongue tip)
const SH = 20;   // texture height

export default class CyberSnake extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x  world x (spawn centre)
   * @param {number} y  world y (spawn centre)
   * @param {number} patrolHalfW  pixels to patrol each side (default 88)
   */
  constructor(scene, x, y, patrolHalfW = 88) {
    /* ── procedural texture (generated once per app session) ── */
    if (!scene.textures.exists('cybersnake')) {
      const g = scene.make.graphics({ add: false });
      const bw = SW - 6;  // body width (no tongue)
      const bh = SH - 4;

      // Dark body
      g.fillStyle(0x001a0a, 1);
      g.fillRoundedRect(0, 4, bw, bh, 4);

      // Scale segments (alternating greens)
      for (let i = 0; i < 4; i++) {
        g.fillStyle(i % 2 === 0 ? 0x00aa44 : 0x007a30, 0.9);
        g.fillRoundedRect(i * (bw / 4) + 1, 5, bw / 4 - 2, bh - 2, 2);
      }

      // Head (right side — default faces right)
      g.fillStyle(0x00cc55, 1);
      g.fillRoundedRect(bw - 10, 3, 12, bh + 1, 4);

      // Eye + glow
      g.fillStyle(0xff9900, 0.35);
      g.fillCircle(bw + 1, 7, 5);        // glow
      g.fillStyle(0xff6600, 1);
      g.fillCircle(bw + 1, 7, 2.5);      // pupil

      // Tongue (sticks out past head)
      g.lineStyle(1.5, 0xff2222, 0.9);
      g.lineBetween(bw + 4, 9, SW, 7);
      g.lineBetween(bw + 4, 9, SW, 11);

      // Neon outline
      g.lineStyle(1.2, 0x00ff66, 0.55);
      g.strokeRoundedRect(0, 4, bw, bh, 4);

      g.generateTexture('cybersnake', SW, SH);
      g.destroy();
    }

    super(scene, x, y, 'cybersnake');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    /* ── physics ── */
    this.body.setSize(SW - 8, SH - 6);
    this.body.setOffset(2, 4);
    this.body.setAllowGravity(false);
    this.setDepth(8);

    /* ── state ── */
    this.hp          = 3;
    this.maxHp       = 3;
    this._dead       = false;
    this._invincible = false;

    /* ── patrol ── */
    this._patrolMinX = x - patrolHalfW;
    this._patrolMaxX = x + patrolHalfW;
    this.body.setVelocityX(55);
    this.setFlipX(false);   // starts facing right

    /* ── HP bar (world-space, depth 9 = above floor, below fog) ── */
    this._hpBar = scene.add.graphics().setDepth(9);
    this._drawHPBar();
  }

  /* ─── HP bar ────────────────────────────────────────────────────────────── */
  _drawHPBar() {
    if (!this._hpBar?.scene) return;
    const BW = SW + 2, BH = 3;
    const bx = this.x - BW / 2;
    const by = this.y - SH / 2 - 8;
    const g  = this._hpBar;
    g.clear();
    g.fillStyle(0x220000, 0.8);
    g.fillRect(bx, by, BW, BH);
    const pct = Math.max(0, this.hp / this.maxHp);
    const col = pct > 0.55 ? 0x00ff55 : pct > 0.28 ? 0xffaa00 : 0xff2222;
    g.fillStyle(col, 1);
    g.fillRect(bx, by, BW * pct, BH);
  }

  /* ─── patrol logic ──────────────────────────────────────────────────────── */
  _patrol() {
    if (this._dead || !this.body) return;
    if (this.x >= this._patrolMaxX && this.body.velocity.x > 0) {
      this.body.setVelocityX(-55);
      this.setFlipX(true);
    } else if (this.x <= this._patrolMinX && this.body.velocity.x < 0) {
      this.body.setVelocityX(55);
      this.setFlipX(false);
    }
    this._drawHPBar();
  }

  /* ─── take a hit ────────────────────────────────────────────────────────── */
  /**
   * Apply damage. Returns true if this hit killed the snake.
   */
  hit(damage = 1) {
    if (this._dead || this._invincible) return false;

    this.hp = Math.max(0, this.hp - damage);
    this._invincible = true;

    // White flash → clear
    this.setTint(0xffffff);
    this.scene.time.delayedCall(130, () => {
      if (this.scene && !this._dead) this.clearTint();
      this._invincible = false;
    });

    this._drawHPBar();

    if (this.hp <= 0) {
      this._die();
      return true;
    }
    return false;
  }

  /* ─── death ─────────────────────────────────────────────────────────────── */
  _die() {
    if (this._dead) return;
    this._dead = true;

    // Destroy HP bar
    this._hpBar?.destroy();
    this._hpBar = null;

    // Disable physics so no further damage/overlaps fire
    if (this.body) this.body.setEnable(false);

    // Neon particle burst
    try {
      const emitter = this.scene.add.particles(this.x, this.y, 'coin', {
        speed:    { min: 80, max: 240 },
        angle:    { min: 0, max: 360 },
        scale:    { start: 0.75, end: 0 },
        alpha:    { start: 1, end: 0 },
        lifespan: 550,
        quantity: 22,
        tint:     [0x00ff55, 0xff6600, 0xffff00, 0x00ffff],
        gravityY: 0,
        emitting: false,
      });
      emitter.explode(22);
      this.scene.time.delayedCall(700, () => emitter?.destroy());
    } catch (_) { /* particle system unavailable */ }

    // Scale-out + fade
    this.scene.tweens.add({
      targets:  this,
      alpha:    0,
      scaleX:   2.4,
      scaleY:   2.4,
      duration: 300,
      ease:     'Cubic.easeOut',
      onComplete: () => { if (this.scene) this.destroy(); },
    });
  }

  /* ─── Phaser lifecycle ──────────────────────────────────────────────────── */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this._patrol();
  }
}

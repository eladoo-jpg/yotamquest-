import * as Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Dark background
    this.cameras.main.setBackgroundColor('#050a14');

    // Subtle scanline overlay — drawn as thin horizontal lines
    const scanlines = this.add.graphics();
    for (let y = 0; y < height; y += 4) {
      scanlines.lineStyle(1, 0x001a33, 0.18);
      scanlines.lineBetween(0, y, width, y);
    }

    // Outer glow ring (decorative neon circle)
    const ring = this.add.graphics();
    ring.lineStyle(2, 0x00aaff, 0.15);
    ring.strokeCircle(cx, cy, 160);
    ring.lineStyle(1, 0x0066cc, 0.08);
    ring.strokeCircle(cx, cy, 180);

    // Main title — "YotamQuest" in neon blue
    // We stack multiple text objects to fake a multi-layer glow
    const glowLayers = [
      { blur: 32, alpha: 0.12, color: '#00ccff' },
      { blur: 16, alpha: 0.25, color: '#00aaff' },
      { blur: 8,  alpha: 0.4,  color: '#33bbff' },
    ];

    glowLayers.forEach(({ alpha, color }) => {
      this.add.text(cx, cy - 30, 'YotamQuest', {
        fontFamily: 'Courier New, monospace',
        fontSize: '64px',
        fontStyle: 'bold',
        color,
        alpha,
        stroke: color,
        strokeThickness: 12,
        shadow: { offsetX: 0, offsetY: 0, color, blur: 24, fill: true },
      }).setOrigin(0.5);
    });

    // Crisp foreground title
    const title = this.add.text(cx, cy - 30, 'YotamQuest', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#88ddff',
      stroke: '#00aaff',
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ccff', blur: 18, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    // Subtitle
    const subtitle = this.add.text(cx, cy + 42, 'פיילוט: גליץ', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#5599cc',
      shadow: { offsetX: 0, offsetY: 0, color: '#003366', blur: 8, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    // Version tag bottom-right
    this.add.text(width - 12, height - 12, 'v0.1.0', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#224466',
    }).setOrigin(1, 1);

    // Boot sound — generated via Web Audio API (no asset file needed)
    this._playBootSound();

    // Fade-in title, then pulse glow, then transition
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // Pulsing glow after fade-in
        this.tweens.add({
          targets: title,
          alpha: { from: 1, to: 0.7 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 600,
      delay: 500,
      ease: 'Cubic.easeOut',
    });

    // Auto-transition to MainMenuScene after 3 seconds
    this.time.delayedCall(3000, () => {
      this.cameras.main.fadeOut(400, 5, 10, 20);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainMenuScene');
      });
    });
  }

  // Synthesizes a short sci-fi boot chime via Web Audio — no asset file required
  _playBootSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      const play = (freq, startTime, duration, type = 'sine', gainVal = 0.18) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration + 0.05);
      };

      // Rising arpeggio chord — neon sci-fi feel
      play(220, 0.0,  0.4, 'sine',     0.15);
      play(330, 0.12, 0.4, 'sine',     0.12);
      play(440, 0.24, 0.5, 'sine',     0.14);
      play(660, 0.36, 0.6, 'sine',     0.16);
      play(880, 0.50, 0.8, 'triangle', 0.10);
      // Subtle noise swoosh underneath
      play(110, 0.0,  0.5, 'sawtooth', 0.04);
    } catch {
      // Audio context unavailable — skip silently
    }
  }
}

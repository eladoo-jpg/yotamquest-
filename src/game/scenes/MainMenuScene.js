import * as Phaser from 'phaser';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  /* ── load background ─────────────────────────────────────────────────────── */
  preload() {
    this.load.image('menu-bg', 'assets/backgrounds/main-menu-bg.png');
  }

  /* ── build screen ────────────────────────────────────────────────────────── */
  create() {
    const W = this.cameras.main.width;   // 480
    const H = this.cameras.main.height;  // 640
    const cx = W / 2;

    this.cameras.main.setBackgroundColor('#050a14');
    this.cameras.main.fadeIn(600, 5, 10, 20);

    /* 1 ── Background image */
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(cx, H / 2, 'menu-bg')
        .setDisplaySize(W, H)
        .setDepth(0);

      // Subtle breathing pulse on the neon glow
      this.tweens.add({
        targets:  bg,
        alpha:    { from: 1, to: 0.82 },
        duration: 2200,
        ease:     'Sine.easeInOut',
        yoyo:     true,
        repeat:   -1,
      });
    } else {
      // Fallback: procedural grid if image missing
      const grid = this.add.graphics().setDepth(0);
      grid.lineStyle(1, 0x001a33, 0.3);
      for (let x = 0; x < W; x += 40) grid.lineBetween(x, 0, x, H);
      for (let y = 0; y < H; y += 40) grid.lineBetween(0, y, W, y);
    }

    /* 2 ── Logo */
    const logo = this.add.text(cx, 115, 'YOTAM QUEST', {
      fontFamily: 'Courier New, monospace',
      fontSize:   '40px',
      fontStyle:  'bold',
      color:      '#00ffff',
      stroke:     '#8800ff',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ffff', blur: 22, fill: true },
    }).setOrigin(0.5).setDepth(10);

    // Logo idle float
    this.tweens.add({
      targets:  logo,
      y:        108,
      duration: 1800,
      ease:     'Sine.easeInOut',
      yoyo:     true,
      repeat:   -1,
    });

    // Sub-title
    this.add.text(cx, 158, 'סוכן קוד — עצור את גליץ', {
      fontFamily: 'Courier New, monospace',
      fontSize:   '14px',
      color:      '#55aacc',
      shadow: { offsetX: 0, offsetY: 0, color: '#0088aa', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(10);

    /* 3 ── Buttons */
    const BTN_STYLE = {
      fontFamily: 'Courier New, monospace',
      fontSize:   '28px',
      color:      '#ffffff',
      stroke:     '#004466',
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ccff', blur: 10, fill: true },
      padding:    { x: 28, y: 12 },
      backgroundColor: '#00ccff18',
    };

    this._makeBtn(cx, 310, 'התחל משחק ▶', BTN_STYLE, '#00ffff', () => this._startGame());
    this._makeBtn(cx, 400, 'הגדרות ⚙',    BTN_STYLE, '#aa88ff', null);
    this._makeBtn(cx, 475, 'גבורות 🏆',   BTN_STYLE, '#ffcc44', null);

    /* 4 ── Version tag */
    this.add.text(W - 10, H - 14, 'v0.1 — Pilot', {
      fontFamily: 'Courier New, monospace',
      fontSize:   '10px',
      color:      '#1a3a55',
    }).setOrigin(1, 1).setDepth(10);

    /* 5 ── Scan-line overlay for CRT feel */
    const scan = this.add.graphics().setDepth(50).setScrollFactor(0);
    for (let y = 0; y < H; y += 4) {
      scan.lineStyle(1, 0x000000, 0.08);
      scan.lineBetween(0, y, W, y);
    }
  }

  /* ── button factory ──────────────────────────────────────────────────────── */
  _makeBtn(x, y, label, style, hoverColor, callback) {
    const btn = this.add.text(x, y, label, style)
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: !!callback });

    if (callback) {
      btn.on('pointerover', () => {
        btn.setStyle({ color: hoverColor });
        this.tweens.add({ targets: btn, scaleX: 1.06, scaleY: 1.06, duration: 100 });
      });
      btn.on('pointerout', () => {
        btn.setStyle({ color: '#ffffff' });
        this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
      });
      btn.on('pointerdown', callback);
    } else {
      // Inactive buttons — dimmer
      btn.setAlpha(0.4);
    }
    return btn;
  }

  /* ── transition ──────────────────────────────────────────────────────────── */
  _startGame() {
    // Cyan flash → fade to black → MazeScene
    this.cameras.main.flash(350, 0, 220, 255, false);
    this.time.delayedCall(200, () => {
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MazeScene');
      });
    });
  }
}

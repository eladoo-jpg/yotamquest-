import * as Phaser from 'phaser';
import MusicManager from '../audio/MusicManager';

export default class VictoryScene extends Phaser.Scene {
  constructor() { super({ key: 'VictoryScene' }); }

  /* ── receive data from BossScene ─────────────────────────────────────────── */
  init(data = {}) {
    this.st = {
      hearts:   data.hearts   ?? 3,
      xp:       data.xp       ?? 0,
      coins:    data.coins    ?? 0,
      diamonds: data.diamonds ?? 0,
    };
  }

  /* ── load assets ─────────────────────────────────────────────────────────── */
  preload() {
    this.load.image('victory-bg', 'assets/backgrounds/victory-bg.png');
  }

  /* ── build screen ────────────────────────────────────────────────────────── */
  create() {
    const W  = this.cameras.main.width;   // 480
    const H  = this.cameras.main.height;  // 640
    const cx = W / 2;

    this._music = new MusicManager(this);
    this._music.play('victory');

    this.cameras.main.setBackgroundColor('#e8f4ff');
    this.cameras.main.fadeIn(700, 240, 248, 255);

    /* 1 ── Background */
    if (this.textures.exists('victory-bg')) {
      this.add.image(cx, H / 2, 'victory-bg').setDisplaySize(W, H).setDepth(0);
    }

    /* 2 ── Confetti particles (procedural — no external texture needed) */
    this._spawnConfetti(W, H);

    /* 3 ── Title */
    const title = this.add.text(cx, 72, '!ניצחון', {
      fontFamily: 'Courier New, Arial, sans-serif',
      fontSize:   '58px',
      fontStyle:  'bold',
      color:      '#ffd700',
      stroke:     '#ffffff',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 2, color: '#aa6600', blur: 0, fill: true },
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, y: 80, duration: 600, ease: 'Back.easeOut' });

    this.add.text(cx, 136, 'המערכת הגלקטית ניצלה!', {
      fontFamily: 'Courier New, Arial, sans-serif',
      fontSize:   '20px',
      color:      '#cc4400',
      stroke:     '#ffffff',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setAlpha(0)
      .setData('tweenTarget', true);

    // fade in subtitle after title lands
    this.time.delayedCall(500, () => {
      this.children.list
        .filter(c => c.getData?.('tweenTarget'))
        .forEach(c => this.tweens.add({ targets: c, alpha: 1, duration: 400 }));
    });

    /* 4 ── Stats panel (inside the radiant white circle ~y:200–480) */
    this._buildStats(cx, H);

    /* 5 ── Buttons */
    this.time.delayedCall(900, () => {
      this._makeGoldBtn(cx, 540, 'המשך לחקור  ▶', () => {
        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('MazeScene', {
            hearts:   this.st.hearts,
            xp:       this.st.xp,
            coins:    this.st.coins,
            diamonds: this.st.diamonds,
            postBoss: true,
          });
        });
      });

      this._makeGoldBtn(cx, 598, 'חזור לתפריט', () => {
        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('MainMenuScene');
        });
      }, true);
    });
  }

  /* ── stats panel ─────────────────────────────────────────────────────────── */
  _buildStats(cx, H) {
    const panelY = 220;

    // "!כל הכבוד יותם"
    this.add.text(cx, panelY, '!כל הכבוד יותם', {
      fontFamily: 'Courier New, Arial, sans-serif',
      fontSize:   '26px',
      fontStyle:  'bold',
      color:      '#1a0044',
    }).setOrigin(0.5).setDepth(20);

    // Stat rows with animated counters
    const rows = [
      { label: 'מטבעות שנאספו',   icon: '🪙', value: this.st.coins,    color: '#bb7700' },
      { label: 'יהלומים שנאספו', icon: '💎', value: this.st.diamonds, color: '#0077bb' },
      { label: 'נקודות ניסיון',   icon: '⚡', value: this.st.xp,       color: '#226600' },
    ];

    rows.forEach(({ label, icon, value, color }, i) => {
      const y = panelY + 60 + i * 52;

      const labelTxt = this.add.text(cx - 80, y, `${icon}  ${label}:`, {
        fontFamily: 'Courier New, Arial, sans-serif',
        fontSize:   '18px',
        color:      '#333333',
      }).setOrigin(0, 0.5).setDepth(20).setAlpha(0);

      // Animated counter (starts hidden)
      const numTxt = this.add.text(cx + 100, y, '0', {
        fontFamily: 'Courier New, Arial, sans-serif',
        fontSize:   '22px',
        fontStyle:  'bold',
        color,
      }).setOrigin(0.5).setDepth(20).setAlpha(0);

      this.time.delayedCall(300 + i * 300, () => {
        this._playTick();
        this.tweens.add({ targets: [labelTxt, numTxt], alpha: 1, duration: 200 });
        const obj = { val: 0 };
        this.tweens.add({
          targets:  obj,
          val:      value,
          duration: 900,
          ease:     'Cubic.easeOut',
          onUpdate: () => numTxt.setText(String(Math.floor(obj.val))),
          onComplete: () => numTxt.setText(String(value)),
        });
      });
    });

    // Skin preview box — scale-from-0 bounce reveal (Part 3E)
    const skinX = cx + 120, skinY = panelY + 200;
    const skinCon = this.add.container(skinX, skinY - 8).setDepth(20).setScale(0);

    const skinBox = this.add.graphics();
    skinBox.lineStyle(2, 0x8800ff, 0.9).fillStyle(0xeef0ff, 1);
    skinBox.fillRoundedRect(-42, -42, 84, 84, 8);
    skinBox.strokeRoundedRect(-42, -42, 84, 84, 8);

    const skinLabel = this.add.text(0, -54, 'סקין חדש נפתח!', {
      fontFamily: 'Courier New, Arial, sans-serif',
      fontSize:   '10px',
      color:      '#8800ff',
    }).setOrigin(0.5, 1);

    // Placeholder skin icon — gold star agent
    const skinIcon = this.add.text(0, 0, '🦸', {
      fontSize: '44px',
      fontFamily: '"Apple Color Emoji","Segoe UI Emoji",sans-serif',
    }).setOrigin(0.5);

    skinCon.add([skinBox, skinLabel, skinIcon]);

    this.tweens.add({
      targets: skinCon, scaleX: 1, scaleY: 1,
      duration: 500, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: skinCon, alpha: { from: 1, to: 0.7 },
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      },
    });
  }

  /* ── tick sound (Web Audio API, Part 3E) ──────────────────────────────────── */
  _playTick() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now); osc.stop(now + 0.06);
    } catch (_) {}
  }

  /* ── gold button ─────────────────────────────────────────────────────────── */
  _makeGoldBtn(x, y, label, callback, small = false) {
    const W   = small ? 200 : 260;
    const H   = small ? 38  : 50;
    const fs  = small ? '16px' : '22px';
    const col = small ? 0xbbaa00 : 0xffd700;

    const gfx = this.add.graphics().setDepth(25);
    const drawBtn = (active) => {
      gfx.clear();
      gfx.fillStyle(active ? 0xffee44 : col, 1);
      gfx.fillRoundedRect(x - W / 2, y - H / 2, W, H, H / 2);
      gfx.lineStyle(2, 0xffffff, 0.7);
      gfx.strokeRoundedRect(x - W / 2, y - H / 2, W, H, H / 2);
    };
    drawBtn(false);

    const txt = this.add.text(x, y, label, {
      fontFamily: 'Courier New, Arial, sans-serif',
      fontSize:   fs,
      fontStyle:  'bold',
      color:      '#1a0000',
    }).setOrigin(0.5).setDepth(26);

    // Hit zone
    const zone = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true }).setDepth(27);
    zone.on('pointerover',  () => { drawBtn(true);  txt.setStyle({ color: '#000000' }); });
    zone.on('pointerout',   () => { drawBtn(false); txt.setStyle({ color: '#1a0000' }); });
    zone.on('pointerdown',  callback);

    // Slide up on entry
    [gfx, txt].forEach(o => {
      o.setAlpha(0);
      o.y += 20;
      this.tweens.add({ targets: o, alpha: 1, y: `-=20`, duration: 400, ease: 'Back.easeOut' });
    });
  }

  /* ── cleanup ─────────────────────────────────────────────────────────────── */
  shutdown() {
    this._music?.destroy();
  }

  /* ── confetti ────────────────────────────────────────────────────────────── */
  _spawnConfetti(W, H) {
    // Build a tiny square texture for particles
    if (!this.textures.exists('confetti')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 8);
      g.generateTexture('confetti', 8, 8);
      g.destroy();
    }

    const COLORS = [0xffd700, 0x00ffff, 0x8800ff, 0x00cc44, 0xff4488, 0xff8800];

    COLORS.forEach((tint, i) => {
      const emitter = this.add.particles(
        Phaser.Math.Between(40, W - 40), -16,
        'confetti',
        {
          x:        { min: -W / 2, max: W / 2 },
          speedY:   { min: 120, max: 320 },
          speedX:   { min: -60,  max: 60  },
          angle:    { min: 0,    max: 360  },
          rotate:   { min: 0,    max: 360  },
          scale:    { start: 1,  end: 0.2  },
          alpha:    { start: 1,  end: 0    },
          lifespan: 3000,
          frequency: 80,
          tint,
          gravityY: 180,
        }
      ).setDepth(5);

      // Stop after 5 seconds so it doesn't run forever
      this.time.delayedCall(5000, () => { try { emitter.stop(); } catch (_) {} });
    });
  }
}

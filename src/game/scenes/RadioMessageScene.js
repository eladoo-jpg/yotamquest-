import Phaser from 'phaser';

const FRAME_X  = 240;  // center x
const FRAME_Y  = 300;  // center y
const FRAME_W  = 400;
const FRAME_H  = 200;

export default class RadioMessageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RadioMessageScene' });
  }

  init(data) {
    this._eventData    = data;
    this._content      = data.content;
    this._reward       = data.reward;
    this._audioCtx     = null;
    this._resolved     = false;
    this._frameObjects = []; // elements that slide out together on correct
  }

  create() {
    const W = 480, H = 854;

    try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}

    // Dark overlay — does not slide out
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setScrollFactor(0).setDepth(0);

    // Radio frame (rounded rect via Graphics)
    const fg = this.add.graphics().setScrollFactor(0).setDepth(10);
    fg.fillStyle(0x0a1428, 1);
    fg.fillRoundedRect(FRAME_X - FRAME_W / 2, FRAME_Y - FRAME_H / 2, FRAME_W, FRAME_H, 8);
    fg.lineStyle(2, 0x00b4ff, 1);
    fg.strokeRoundedRect(FRAME_X - FRAME_W / 2, FRAME_Y - FRAME_H / 2, FRAME_W, FRAME_H, 8);
    this._frameObjects.push(fg);

    // Scanlines over frame
    for (let i = 0; i < 10; i++) {
      const sy = FRAME_Y - FRAME_H / 2 + i * (FRAME_H / 10) + FRAME_H / 20;
      const sl = this.add.rectangle(FRAME_X, sy, FRAME_W, 1, 0x000000, 0.1)
        .setScrollFactor(0).setDepth(11);
      this._frameObjects.push(sl);
    }

    // Radio text with typewriter effect
    this._radioText = this.add.text(FRAME_X, FRAME_Y - 30, '', {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: '#00ff88',
      align: 'center',
      wordWrap: { width: 360 },
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(12);
    this._frameObjects.push(this._radioText);

    // Typewriter — Hebrew: substring(0, i) reveals correctly RTL left-to-right
    this._typewriter(this._content.radio_text, () => {
      this.time.delayedCall(500, () => this._showQuestion());
    });
  }

  _typewriter(fullText, onComplete) {
    let i = 0;
    const timer = this.time.addEvent({
      delay: 30,
      repeat: fullText.length - 1,
      callback: () => {
        i++;
        this._radioText.setText(fullText.substring(0, i));
        if (i >= fullText.length) {
          timer.remove();
          if (onComplete) onComplete();
        }
      },
    });
  }

  _showQuestion() {
    // Question text below frame
    const qText = this.add.text(FRAME_X, FRAME_Y + FRAME_H / 2 + 36, this._content.question, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 380 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(12);
    this._frameObjects.push(qText);

    // Answer buttons — stacked vertically, RTL
    const btnW = 340, btnH = 55, gap = 12;
    const startY = FRAME_Y + FRAME_H / 2 + 90;

    this._content.options.forEach((option, idx) => {
      const by = startY + idx * (btnH + gap);

      const bg = this.add.graphics().setScrollFactor(0).setDepth(12);
      this._drawBtn(bg, FRAME_X, by, btnW, btnH, 0x1a2a4a, 0x00b4ff);
      this._frameObjects.push(bg);

      const label = this.add.text(FRAME_X, by, option, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: btnW - 20 },
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(13);
      this._frameObjects.push(label);

      // Hit zone
      const zone = this.add.zone(FRAME_X, by, btnW, btnH)
        .setScrollFactor(0).setDepth(14)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        if (this._resolved) return;
        if (idx === this._content.correct_index) this._onCorrect();
        else                                     this._onWrong(bg);
      });
      zone.on('pointerover', () => { this._drawBtn(bg, FRAME_X, by, btnW, btnH, 0x2a3e6a, 0x00b4ff); });
      zone.on('pointerout',  () => { this._drawBtn(bg, FRAME_X, by, btnW, btnH, 0x1a2a4a, 0x00b4ff); });

      this._frameObjects.push(zone);
    });
  }

  _drawBtn(g, cx, cy, w, h, fill, stroke) {
    g.clear();
    g.fillStyle(fill, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
    g.lineStyle(2, stroke, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
  }

  _onCorrect() {
    this._resolved = true;
    this._playSound('correct');

    // Green flash
    const flash = this.add.rectangle(240, 427, 480, 854, 0x00ff88)
      .setAlpha(0.25).setScrollFactor(0).setDepth(20);
    this.tweens.add({ targets: flash, alpha: 0, duration: 300 });

    // Slide frame out right
    this.tweens.add({
      targets: this._frameObjects,
      x: '+=500',
      duration: 400,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        window.dispatchEvent(new CustomEvent('yotam:gate:answered', {
          detail: { event_id: this._eventData.event_id, correct: true },
        }));
        if (this._reward?.xp) this._showJuiceText(`+${this._reward.xp} XP ⚡`, '#88ff44');
        this.time.delayedCall(400, () => {
          this.scene.stop('RadioMessageScene');
          this.scene.resume('MazeScene');
        });
      },
    });
  }

  _onWrong(bgGraphics) {
    this._playSound('wrong');

    // Static burst: flash frame white 3×
    let count = 0;
    const flashTimer = this.time.addEvent({
      delay: 100,
      repeat: 5,
      callback: () => {
        count++;
        const isOn = count % 2 === 1;
        const fg = this._frameObjects[0]; // radio frame Graphics
        if (fg?.clear) {
          fg.clear();
          if (isOn) {
            fg.fillStyle(0xffffff, 0.8);
            fg.fillRoundedRect(FRAME_X - FRAME_W / 2, FRAME_Y - FRAME_H / 2, FRAME_W, FRAME_H, 8);
          } else {
            fg.fillStyle(0x0a1428, 1);
            fg.fillRoundedRect(FRAME_X - FRAME_W / 2, FRAME_Y - FRAME_H / 2, FRAME_W, FRAME_H, 8);
            fg.lineStyle(2, 0x00b4ff, 1);
            fg.strokeRoundedRect(FRAME_X - FRAME_W / 2, FRAME_Y - FRAME_H / 2, FRAME_W, FRAME_H, 8);
          }
        }
      },
    });

    // "שיבוש בקשר" error message
    const errText = this.add.text(FRAME_X, FRAME_Y, 'שיבוש בקשר', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(50);

    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: errText,
        alpha: 0,
        duration: 300,
        onComplete: () => errText.destroy(),
      });
    });
  }

  _showJuiceText(text, color = '#00ffff') {
    const cy = 180;
    const t = this.add.text(240, cy, text, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setDepth(9999).setScrollFactor(0).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: cy - 60,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  _playSound(type) {
    const ctx = this._audioCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'correct') {
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      osc.type = 'sine'; o2.type = 'sine';
      osc.frequency.setValueAtTime(523, now); osc.frequency.setValueAtTime(659, now + 0.08);
      o2.frequency.setValueAtTime(784, now + 0.13);
      gain.gain.setValueAtTime(0.10, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      g2.gain.setValueAtTime(0.0, now); g2.gain.setValueAtTime(0.10, now + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now); osc.stop(now + 0.22); o2.start(now + 0.12); o2.stop(now + 0.28);
    } else {
      // static buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.20);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      osc.start(now); osc.stop(now + 0.20);
    }
  }

  shutdown() {
    if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
  }
}

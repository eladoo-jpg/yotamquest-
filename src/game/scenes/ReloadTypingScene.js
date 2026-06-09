import Phaser from 'phaser';

const KB_ROWS = [
  ['א','ב','ג','ד','ה','ו','ז','ח','ט','י'],
  ['כ','ל','מ','נ','ס','ע','פ','צ','ק','ר'],
  ['ש','ת','ך','ם','ן','ף','ץ'],
];
const BTN_W = 44, BTN_H = 50, BTN_GAP = 3;

export default class ReloadTypingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ReloadTypingScene' });
  }

  init(data) {
    this._eventData    = data;
    this._word         = data.content.typing_word;
    this._reward       = data.reward;
    this._typed        = [];
    this._done         = false;
    this._audioCtx     = null;
    this._kbObjects    = []; // all keyboard elements for slide tween
    this._slotTexts    = []; // progress slot Text objects
  }

  create() {
    const W = 480, H = 854;

    try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}

    // Dark overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setScrollFactor(0).setDepth(0);

    // Notify MazeScene weapon is overheated
    window.dispatchEvent(new CustomEvent('yotam:weapon:overheat'));

    // Smoke particles at approximate gun position (player screen center, slightly right)
    if (this.textures.exists('particle_dot')) {
      const emitter = this.add.particles(260, 400, 'particle_dot', {
        speed: { min: 10, max: 30 },
        angle: { min: 260, max: 280 },
        scale: { start: 0.8, end: 0 },
        lifespan: 1200,
        tint: [0x888888, 0xaaaaaa, 0x666666],
        quantity: 1,
        frequency: 200,
        alpha: { start: 0.6, end: 0 },
      }).setScrollFactor(0).setDepth(5);
      // Stop after 3 puffs
      this.time.delayedCall(600, () => emitter.stop());
    }

    // Instruction text: "הקלד:" + word
    this.add.text(W / 2, 250, `הקלד: ${this._word}`, {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // Progress slots
    this._buildProgressSlots(W / 2, 320);

    // Keyboard
    this._buildKeyboard(580);
  }

  _buildProgressSlots(cx, y) {
    const letters = [...this._word];
    const slotW = 48, slotGap = 12;
    const totalW = letters.length * slotW + (letters.length - 1) * slotGap;
    const startX = cx - totalW / 2 + slotW / 2;

    this._slotTexts = letters.map((_, i) => {
      const x = startX + i * (slotW + slotGap);
      // Underline
      this.add.rectangle(x, y + 22, slotW, 2, 0x00b4ff).setScrollFactor(0).setDepth(10);
      // Letter text (starts as underscore placeholder)
      const t = this.add.text(x, y, '_', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#00ff88',
        align: 'center',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      return t;
    });

    this._progressY = y;
    this._progressCX = cx;
  }

  _buildKeyboard(startY) {
    KB_ROWS.forEach((row, ri) => {
      const rowW = row.length * BTN_W + (row.length - 1) * BTN_GAP;
      const rowStartX = 240 - rowW / 2 + BTN_W / 2;
      const ry = startY + ri * (BTN_H + BTN_GAP + 2);

      row.forEach((letter, ci) => {
        const bx = rowStartX + ci * (BTN_W + BTN_GAP);

        const bg = this.add.graphics().setScrollFactor(0).setDepth(20);
        this._drawKey(bg, bx, ry, 0x1a2a4a, 0x00b4ff);
        this._kbObjects.push(bg);

        const lbl = this.add.text(bx, ry, letter, {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
          align: 'center',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(21);
        this._kbObjects.push(lbl);

        const zone = this.add.zone(bx, ry, BTN_W, BTN_H)
          .setScrollFactor(0).setDepth(22)
          .setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => this._onKeyPress(letter, bg));
        zone.on('pointerover', () => this._drawKey(bg, bx, ry, 0x2a3e6a, 0x00b4ff));
        zone.on('pointerout',  () => this._drawKey(bg, bx, ry, 0x1a2a4a, 0x00b4ff));

        this._kbObjects.push(zone);
      });
    });
  }

  _drawKey(g, cx, cy, fill, stroke) {
    g.clear();
    g.fillStyle(fill, 1);
    g.fillRoundedRect(cx - BTN_W / 2, cy - BTN_H / 2, BTN_W, BTN_H, 4);
    g.lineStyle(1, stroke, 1);
    g.strokeRoundedRect(cx - BTN_W / 2, cy - BTN_H / 2, BTN_W, BTN_H, 4);
  }

  _onKeyPress(letter, bg) {
    if (this._done) return;

    const expected = this._word[this._typed.length];

    if (letter === expected) {
      this._playSound('click');
      this._typed.push(letter);

      // Fill slot
      const slotIdx = this._typed.length - 1;
      this._slotTexts[slotIdx].setText(letter);

      // Flash key green
      this._drawKey(bg, bg.x, bg.y, 0x004400, 0x00ff88);
      this.time.delayedCall(200, () => this._drawKey(bg, bg.x, bg.y, 0x1a2a4a, 0x00b4ff));

      if (this._typed.length === this._word.length) {
        this._onWordComplete();
      }
    } else {
      this._playSound('buzz');
      this._onWrongLetter();
    }
  }

  _onWrongLetter() {
    // Shake progress slots
    const targets = this._slotTexts;
    let count = 0;
    const shakeTimer = this.time.addEvent({
      delay: 50,
      repeat: 5,
      callback: () => {
        count++;
        const offset = count % 2 === 0 ? 4 : -4;
        targets.forEach(t => t.setX(t.x + offset));
      },
      onComplete: () => targets.forEach(t => t.setX(this._progressCX - (this._word.length * 60) / 2 + targets.indexOf(t) * 60 + 30)),
    });

    // Reset slots to underscores
    this.time.delayedCall(300, () => {
      this._typed = [];
      this._slotTexts.forEach(t => t.setText('_'));
      // Re-center slots properly
      this._resetSlotPositions();
    });
  }

  _resetSlotPositions() {
    const letters = [...this._word];
    const slotW = 48, slotGap = 12;
    const totalW = letters.length * slotW + (letters.length - 1) * slotGap;
    const startX = this._progressCX - totalW / 2 + slotW / 2;
    this._slotTexts.forEach((t, i) => {
      t.setPosition(startX + i * (slotW + slotGap), this._progressY);
    });
  }

  _onWordComplete() {
    this._done = true;
    this._playSound('reload');

    // Slide keyboard down off screen
    this.tweens.add({
      targets: this._kbObjects,
      y: '+=400',
      duration: 400,
      ease: 'Cubic.easeIn',
    });

    // "טוען נשק!" text
    const reloadText = this.add.text(240, 420, 'טוען נשק!', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

    this.tweens.add({ targets: reloadText, alpha: 1, duration: 200 });

    if (this._reward?.xp) this._showJuiceText(`+${this._reward.xp} XP ⚡`, '#88ff44');

    window.dispatchEvent(new CustomEvent('yotam:gate:answered', {
      detail: { event_id: this._eventData.event_id, correct: true },
    }));
    window.dispatchEvent(new CustomEvent('yotam:weapon:reloaded', {
      detail: { ammo: this._reward?.ammo ?? 0 },
    }));

    this.time.delayedCall(600, () => {
      this.scene.stop('ReloadTypingScene');
      this.scene.resume('MazeScene');
    });
  }

  _showJuiceText(text, color = '#00ffff') {
    const cy = 200;
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
    if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now); osc.stop(now + 0.06);
    } else if (type === 'reload') {
      // Ascending mechanical chime
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      osc.type = 'square'; o2.type = 'sine';
      osc.frequency.setValueAtTime(300, now); osc.frequency.setValueAtTime(450, now + 0.1);
      o2.frequency.setValueAtTime(700, now + 0.15);
      gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      g2.gain.setValueAtTime(0.0, now); g2.gain.setValueAtTime(0.10, now + 0.14);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.2); o2.start(now + 0.14); o2.stop(now + 0.35);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(70, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    }
  }

  shutdown() {
    if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
  }
}

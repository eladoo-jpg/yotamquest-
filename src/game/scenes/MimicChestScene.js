import Phaser from 'phaser';
import CyberSnake from '../entities/CyberSnake';

export default class MimicChestScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MimicChestScene', physics: { default: 'arcade' } });
  }

  init(data) {
    this._eventData   = data;
    this._content     = data.content;
    this._reward      = data.reward;
    this._audioCtx    = null;
    this._resolved    = false;
  }

  create() {
    const W = 480, H = 854;

    try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}

    // Dark overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setScrollFactor(0);

    // Instruction text
    this.add.text(W / 2, 250, this._content.instruction, {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 440 },
    }).setOrigin(0.5, 0.5).setScrollFactor(0);

    // Randomize which side correct chest appears
    const correctOnLeft = Math.random() < 0.5;
    const leftWord  = correctOnLeft ? this._content.correct_word : this._content.distractors[0];
    const rightWord = correctOnLeft ? this._content.distractors[0] : this._content.correct_word;

    this._leftChest  = this._makeChest(W / 2 - 100, 420, leftWord,  leftWord  === this._content.correct_word);
    this._rightChest = this._makeChest(W / 2 + 100, 420, rightWord, rightWord === this._content.correct_word);
  }

  _makeChest(x, y, word, isCorrect) {
    const bg = this.add.rectangle(x, y, 90, 70, 0x4a3000)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xffaa00)
      .setInteractive({ useHandCursor: true });

    // Lid line
    this.add.rectangle(x, y - 10, 90, 4, 0xffaa00).setScrollFactor(0);

    // Lock dot
    this.add.rectangle(x, y + 4, 10, 10, 0xffcc44).setScrollFactor(0);

    // Word label below chest
    this.add.text(x, y + 52, word, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0);

    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff));
    bg.on('pointerout',  () => bg.setStrokeStyle(2, 0xffaa00));
    bg.on('pointerdown', () => {
      if (this._resolved) return;
      this._resolved = true;
      if (isCorrect) this._onCorrect(bg, x, y);
      else           this._onWrong(bg, x, y);
    });

    return { bg, x, y };
  }

  _onCorrect(bg, x, y) {
    this._playSound('correct');

    // Chest bounce
    this.tweens.add({
      targets: bg,
      scaleX: 1.3, scaleY: 1.3,
      duration: 150,
      ease: 'Back.easeOut',
      yoyo: true,
      onComplete: () => { bg.setScale(1); },
    });

    // Gold coin particle burst
    const emitter = this.add.particles(x, y, 'particle_dot', {
      speed: { min: 60, max: 160 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.9, end: 0 },
      lifespan: 500,
      tint: [0xffcc00, 0xffee88],
      quantity: 20,
      emitting: false,
    }).setDepth(500).setScrollFactor(0);
    emitter.explode(20);

    if (this._reward?.coins) {
      this._showJuiceText(`+${this._reward.coins} 🪙`, '#ffcc00');
      window.dispatchEvent(new CustomEvent('yotam:reward:coins', {
        detail: { amount: this._reward.coins },
      }));
    }
    if (this._reward?.xp) {
      this._showJuiceText(`+${this._reward.xp} XP ⚡`, '#88ff44');
    }

    window.dispatchEvent(new CustomEvent('yotam:gate:answered', {
      detail: { event_id: this._eventData.event_id, correct: true },
    }));

    this.time.delayedCall(600, () => {
      this.scene.stop('MimicChestScene');
      this.scene.resume('MazeScene');
    });
  }

  _onWrong(bg, x, y) {
    this._playSound('wrong');

    // Red tint for 400ms
    bg.setFillStyle(0x6a0000);
    this.time.delayedCall(400, () => bg.setFillStyle(0x4a3000));

    // Chest shake ±3px
    this.tweens.add({
      targets: bg,
      x: { from: x - 3, to: x + 3 },
      duration: 60,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 3,
      onComplete: () => bg.setPosition(x, y),
    });

    // Tiny enemy near chest
    try {
      const snake = new CyberSnake(this, x, y - 60, 0);
      snake.setScale(0.4).setDepth(600).setScrollFactor(0);
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('yotam:gate:answered', {
      detail: { event_id: this._eventData.event_id, correct: false },
    }));

    this.time.delayedCall(1000, () => {
      this.scene.stop('MimicChestScene');
      this.scene.resume('MazeScene');
    });
  }

  _showJuiceText(text, color = '#00ffff') {
    const cy = 330;
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
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.15);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    }
  }

  shutdown() {
    if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
  }
}

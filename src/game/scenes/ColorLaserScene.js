import Phaser from 'phaser';

export default class ColorLaserScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ColorLaserScene' });
  }

  init(data) {
    this._eventData     = data;
    this._content       = data.content;
    this._correctColor  = data.content.correct_color;
    this._audioCtx      = null;
    this._crossedBeams  = new Set();
    this._beamCooldowns = new Set();
    this._mazeCam       = null;
    this._player        = null;
    this._done          = false;
  }

  create() {
    const maze = this.scene.get('MazeScene');
    if (!maze?.yotam) { this.scene.stop('ColorLaserScene'); return; }

    this._mazeCam = maze.cameras.main;
    this._player  = maze.yotam;
    const baseY   = this._player.y;

    try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}

    // Instruction text — screen space, fades after 3s
    const txt = this.add.text(240, 80, this._content.instruction, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 440 },
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: txt, alpha: 0, duration: 400, onComplete: () => txt.destroy() });
    });

    // Beams in world space below player — green first (correct/safe), then wrong beams
    // Player walks down through the gauntlet; beams match spec colors top→bottom: green/red/blue
    this._beams = [
      { key: 'green', color: 0x00ff88, worldY: baseY + 100 },
      { key: 'red',   color: 0xff3333, worldY: baseY + 200 },
      { key: 'blue',  color: 0x4488ff, worldY: baseY + 300 },
    ].map(({ key, color, worldY }) => {
      // Glow halo
      this.add.rectangle(240, worldY, 480, 16, color, 0.25).setDepth(150);
      // Main beam
      const rect = this.add.rectangle(240, worldY, 480, 8, color, 0.8).setDepth(151);
      this.tweens.add({
        targets: rect,
        alpha: { from: 0.8, to: 0.4 },
        duration: 600 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
      });
      return { key, color, worldY, rect };
    });
  }

  update() {
    if (this._done || !this._player || !this._mazeCam) return;

    // Mirror MazeScene camera so world-space beams render correctly
    this.cameras.main.setScroll(this._mazeCam.scrollX, this._mazeCam.scrollY);

    const py = this._player.y;

    for (const beam of this._beams) {
      if (this._beamCooldowns.has(beam.key)) continue;
      if (Math.abs(py - beam.worldY) < 14) {
        this._crossedBeams.add(beam.key);
        this._beamCooldowns.add(beam.key);
        if (beam.key === this._correctColor) this._onCorrectBeam();
        else                                 this._onWrongBeam(py, beam.worldY);
        this.time.delayedCall(1200, () => this._beamCooldowns.delete(beam.key));
      }
    }

    if (this._crossedBeams.size === 3) {
      this._done = true;
      window.dispatchEvent(new CustomEvent('yotam:gate:answered', {
        detail: { event_id: this._eventData.event_id, correct: true },
      }));
      this.time.delayedCall(300, () => this.scene.stop('ColorLaserScene'));
    }
  }

  _onCorrectBeam() {
    this._playSound('chime');
    this._player.setTint(0x00ff88);
    this.time.delayedCall(300, () => this._player.clearTint());
  }

  _onWrongBeam(playerY, beamWorldY) {
    this._playSound('buzz');
    this._player.setTint(0xff3333);
    this.time.delayedCall(400, () => this._player.clearTint());
    window.dispatchEvent(new CustomEvent('yotam:player:damage', { detail: { amount: 5 } }));
    // Push player back 32px away from beam
    const pushY = playerY >= beamWorldY ? 32 : -32;
    this._player.setPosition(this._player.x, this._player.y + pushY);
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
    if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      osc.start(now); osc.stop(now + 0.30);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.18);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now); osc.stop(now + 0.18);
    }
  }

  shutdown() {
    if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
  }
}

/**
 * BossScene — Epic final boss fight.
 * Learning IS the combat: correct MCQ answers damage Glitch; wrong answers heal it.
 *
 * Layout (480×640 canvas, no scrolling):
 *   y 0-52   : HUD (boss HP bar + player hearts)
 *   y 52-590 : battle arena
 *   y 590-640: virtual joystick zone
 */
import * as Phaser from 'phaser';
import Yotam        from '../entities/Yotam';
import Glitch       from '../entities/Glitch';
import CyberSnake   from '../entities/CyberSnake';
import VirtualControls from '../systems/VirtualControls';
import bossData     from '../../data/events/boss_events.json';

// ─── arena constants ──────────────────────────────────────────────────────────
const W = 480, H = 640;
const HUD_H  = 52;
const CTRL_Y = 590;      // virtual controls zone starts here
const ARENA_TOP    = HUD_H;
const ARENA_BOTTOM = CTRL_Y;

const GLITCH_POS = { x: W / 2, y: 128 };
const YOTAM_POS  = { x: W / 2, y: 540 };
const MINION_POSITIONS = [
  { x: 110, y: 320, patrolHalfW: 70 },
  { x: 370, y: 320, patrolHalfW: 70 },
];

const QUESTION_INITIAL_DELAY = 7000;  // ms before first question
const QUESTION_REPEAT_DELAY  = 6000;  // ms between questions
const WAVE_INTERVAL          = 4000;  // ms between disruption waves
const WAVE_SPEED             = 1.2;   // px per frame (60 fps) — slow enough to dodge
const WAVE_MAX_R             = 360;   // destroy wave when radius reaches this

export default class BossScene extends Phaser.Scene {
  constructor() { super({ key: 'BossScene' }); }

  preload() {
    const UI = 'assets/ui/';
    ['joy-base','joy-thumb','btn-gun','btn-gun-press',
     'btn-sword','btn-sword-press','btn-axe','btn-axe-press']
      .forEach(k => { if (!this.textures.exists(k)) this.load.image(k, UI + k + '.png'); });
  }

  /* ─── scene data from MazeScene ─────────────────────────────────────────── */
  init(data = {}) {
    this.incoming = data;
  }

  /* ─── create ─────────────────────────────────────────────────────────────── */
  create() {
    // Inherit stats or use defaults
    this.st = {
      hearts:   this.incoming.hearts   ?? 3,
      xp:       this.incoming.xp       ?? 0,
      coins:    this.incoming.coins     ?? 0,
      diamonds: this.incoming.diamonds  ?? 0,
    };

    this._bossDefeated    = false;
    this._bossHP          = 5;     // mirrors Glitch.maxHp — our own kill tracker
    this._warnTimers      = [];    // local warn-animation timers (killed on victory)
    this._questionActive  = false;
    this._currentQId      = null;
    this._questionCount   = 0;
    this._yotamInvincible = false;
    this._lastFaceAngle   = -Math.PI / 2;
    this._lastFireTime    = -Infinity;
    this._lastSwordTime   = -Infinity;
    this._waves           = [];

    // Shuffle question queue
    this._qQueue = Phaser.Utils.Array.Shuffle([...bossData.boss_questions]);
    this._qIdx   = 0;

    this._buildTextures();
    this._buildArena();
    this._spawnEntities();
    this._buildHUD();
    this._buildInput();

    // Virtual controls
    this.virtCtrl = new VirtualControls(this);

    // Projectile group
    this.bolts = this.physics.add.group();
    this.physics.add.overlap(this.bolts, this.snakeGroup, (bolt, snake) => {
      bolt.destroy();
      this._hitMinion(snake, 1);
    });
    this.physics.add.overlap(this.yotam, this.snakeGroup, (_y, snake) => {
      if (!snake._dead) this._yotamHit();
    });
    this.physics.add.overlap(this.yotam, this.glitch, () => {
      // Touching Glitch hurts
      this._yotamHit();
    });

    // Event listeners
    this._gateHandler  = (e) => this._onGateAnswered(e);
    this._shakeHandler = (e) => this._onShake(e);
    this._juiceHandler = (e) => this._onJuice(e);
    window.addEventListener('yotam:gate:answered', this._gateHandler);
    window.addEventListener('yotam:shake',         this._shakeHandler);
    window.addEventListener('yotam:juice',         this._juiceHandler);

    // Timers — start after a short intro pause
    this.time.delayedCall(1500, () => {
      this._waveTimer     = this.time.addEvent({ delay: WAVE_INTERVAL, callback: this._spawnWave, callbackScope: this, loop: true });
      this._questionTimer = this.time.delayedCall(QUESTION_INITIAL_DELAY, () => this._fireQuestion());
    });

    // Safety poller — catches any case where victory didn't fire despite HP=0
    this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        if (!this._bossDefeated && this._bossHP <= 0) {
          console.log('[Boss] SAFETY POLLER triggered victory — _bossHP:', this._bossHP);
          this._victory();
        }
      },
    });

    // Stage 4: boss music (asset already in cache from MazeScene.preload)
    this.sound.stopAll();   // stop any music carried over from MazeScene before starting boss track
    if (this.cache.audio.exists('music_boss')) {
      this._bossMusic = this.sound.add('music_boss', { loop: true, volume: 0 });
      this._bossMusic.play();
      this.tweens.add({ targets: this._bossMusic, volume: 0.65, duration: 500 });
    }

    this.cameras.main.fadeIn(600, 2, 8, 16);
    this._playIntroText();
  }

  /* ─── textures (guard with exists check — shared registry) ──────────────── */
  _buildTextures() {
    const once = (key, w, h, fn) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      fn(g); g.generateTexture(key, w, h); g.destroy();
    };
    once('__wall', 32, 32, g => g.fillStyle(0xffffff, 1).fillRect(0, 0, 32, 32));
    once('coin',  14, 14, g => {
      g.fillStyle(0xffcc00, 1).fillCircle(7, 7, 6);
      g.lineStyle(1.5, 0xffee66, 1).strokeCircle(7, 7, 6);
    });
    once('neonBolt', 5, 12, g => {
      g.fillStyle(0x00ffff, 1).fillRoundedRect(0, 0, 5, 12, 2);
      g.fillStyle(0xffffff, 0.7).fillRoundedRect(1, 1, 3, 6, 1);
    });
    once('slashDot', 4, 4, g => g.fillStyle(0x88ffff, 1).fillCircle(2, 2, 2));
    once('particle_dot', 8, 8, g => g.fillStyle(0x00ffff, 1).fillCircle(4, 4, 4));
  }

  /* ─── arena visuals ──────────────────────────────────────────────────────── */
  _buildArena() {
    // Physics world = arena only (keeps player out of HUD + ctrl zones)
    this.physics.world.setBounds(8, ARENA_TOP + 4, W - 16, ARENA_BOTTOM - ARENA_TOP - 8);
    this.cameras.main.setBackgroundColor('#020810');

    const gfx = this.add.graphics();

    // Floor grid (subtle)
    gfx.lineStyle(1, 0x0a1a2a, 0.35);
    for (let x = 0; x <= W; x += 40) gfx.lineBetween(x, ARENA_TOP, x, ARENA_BOTTOM);
    for (let y = ARENA_TOP; y <= ARENA_BOTTOM; y += 40) gfx.lineBetween(0, y, W, y);

    // Neon arena border
    gfx.lineStyle(2, 0x003366, 0.7);
    gfx.strokeRect(6, ARENA_TOP + 2, W - 12, ARENA_BOTTOM - ARENA_TOP - 4);
    gfx.lineStyle(1, 0x001a44, 0.5);
    gfx.strokeRect(4, ARENA_TOP, W - 8, ARENA_BOTTOM - ARENA_TOP);

    // HUD panel background
    gfx.fillStyle(0x010810, 0.92);
    gfx.fillRect(0, 0, W, HUD_H);
    gfx.lineStyle(1, 0x003366, 0.5);
    gfx.lineBetween(0, HUD_H, W, HUD_H);

    // Corner accent marks (neon sci-fi)
    const corners = [[8, ARENA_TOP + 8], [W - 8, ARENA_TOP + 8], [8, ARENA_BOTTOM - 8], [W - 8, ARENA_BOTTOM - 8]];
    corners.forEach(([cx, cy]) => {
      gfx.lineStyle(2, 0x0055aa, 0.65);
      gfx.lineBetween(cx - 10, cy, cx + 10, cy);
      gfx.lineBetween(cx, cy - 10, cx, cy + 10);
    });
  }

  /* ─── entities ───────────────────────────────────────────────────────────── */
  _spawnEntities() {
    // Glitch boss
    this.glitch = new Glitch(this, GLITCH_POS.x, GLITCH_POS.y);

    // Minion snakes
    this.snakeGroup = this.physics.add.group();
    MINION_POSITIONS.forEach(pos => {
      const snake = new CyberSnake(this, pos.x, pos.y, pos.patrolHalfW);
      this.snakeGroup.add(snake);
    });

    // Yotam (player)
    this.yotam = new Yotam(this, YOTAM_POS.x, YOTAM_POS.y);
    this.yotam.setCollideWorldBounds(true);
  }

  /* ─── input ──────────────────────────────────────────────────────────────── */
  _buildInput() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wasd     = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.zKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  }

  /* ─── HUD ─────────────────────────────────────────────────────────────────── */
  _buildHUD() {
    const D = 101;

    // Boss name
    this.add.text(W / 2, 6, '⚡ GLITCH.EXE ⚡', {
      fontFamily: 'Courier New, monospace', fontSize: '11px', color: '#ff3355',
      shadow: { offsetX: 0, offsetY: 0, color: '#ff0000', blur: 8, fill: true },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 1);

    // Boss HP segments (drawn dynamically)
    this._bossHPGfx = this.add.graphics().setScrollFactor(0).setDepth(D);

    // Player hearts + XP (right side)
    this._hHearts = this.add.text(W - 12, 6, '', {
      fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#ff4455',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D + 1);

    this._hXP = this.add.text(W - 12, 22, '', {
      fontFamily: 'Courier New, monospace', fontSize: '11px', color: '#88ff44',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D + 1);

    this._refreshHUD();
  }

  _refreshHUD() {
    // Boss HP segments
    const g = this._bossHPGfx;
    g.clear();
    const SEG_COUNT = this.glitch?.maxHp ?? 5;
    const barX = 60, barY = 20, barW = 240, barH = 12;
    const segW = (barW - (SEG_COUNT - 1) * 2) / SEG_COUNT;
    // Background
    g.fillStyle(0x1a0005, 0.9);
    g.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    for (let i = 0; i < SEG_COUNT; i++) {
      const filled = i < (this.glitch?.hp ?? 0);
      const sx = barX + i * (segW + 2);
      g.fillStyle(filled ? 0xff1133 : 0x330008, filled ? 1 : 0.35);
      g.fillRect(sx, barY, segW, barH);
      if (filled) {
        // Highlight
        g.fillStyle(0xff6677, 0.4);
        g.fillRect(sx, barY, segW * 0.4, barH);
      }
    }
    g.lineStyle(1, 0xff0022, 0.55);
    g.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // Player hearts
    const { hearts, xp } = this.st;
    this._hHearts?.setText('❤'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, 3 - hearts)));
    this._hXP?.setText(`⚡${xp}`);
  }

  /* ─── update loop ─────────────────────────────────────────────────────────── */
  update(time) {
    if (this._bossDefeated) return;

    // ── movement ──
    const SPEED = 160;
    const { left, right, up, down } = this.cursors;
    const { left: a, right: d, up: w, down: s } = this.wasd;
    let vx = 0, vy = 0;
    if (left.isDown  || a.isDown)  vx = -SPEED;
    if (right.isDown || d.isDown)  vx =  SPEED;
    if (up.isDown    || w.isDown)  vy = -SPEED;
    if (down.isDown  || s.isDown)  vy =  SPEED;
    if (!vx && !vy && this.virtCtrl) {
      const j = this.virtCtrl.getJoy();
      vx = j.vx * SPEED;
      vy = j.vy * SPEED;
    }
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    this.yotam.setVelocity(vx, vy);
    if (vx || vy) {
      const angle = Math.atan2(vy, vx);
      this.yotam.setRotation(angle + Math.PI / 2);
      this._lastFaceAngle = angle;
    }

    // ── waves (paused during questions) ──
    if (!this._questionActive) this._updateWaves();

    // ── bolt shield check (bolts vanish near Glitch with shield effect) ──
    this.bolts.getChildren().forEach(bolt => {
      if (!bolt.active || !this.glitch?.active) return;
      const dist = Phaser.Math.Distance.Between(bolt.x, bolt.y, this.glitch.x, this.glitch.y);
      if (dist < 58) {
        this._showShieldEffect(bolt.x, bolt.y);
        bolt.destroy();
      }
    });

    // ── combat input ──
    const fireKb  = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const swordKb = Phaser.Input.Keyboard.JustDown(this.zKey);
    if (fireKb  || this.virtCtrl?.consumeFire())  this._tryFire(time);
    if (swordKb || this.virtCtrl?.consumeSword()) this._trySword(time);
  }

  /* ─── disruption waves ───────────────────────────────────────────────────── */
  _spawnWave() {
    if (this._questionActive || this._bossDefeated || !this.glitch?.active) return;

    // Brief warning pulse first
    const warnGfx = this.add.graphics().setDepth(6);
    const wx = this.glitch.x, wy = this.glitch.y;
    let warnR = 10;
    const warnT = this.time.addEvent({
      delay: 16,
      callback: () => {
        if (this._bossDefeated) { warnT.remove(); warnGfx.destroy(); return; }
        warnR += 3;
        warnGfx.clear();
        warnGfx.lineStyle(3, 0xffaa00, 0.65 * (1 - warnR / 60));
        warnGfx.strokeCircle(wx, wy, warnR);
        if (warnR >= 60) { warnT.remove(); warnGfx.destroy(); this._launchWave(wx, wy); }
      },
      loop: true,
    });
    this._warnTimers.push(warnT);
  }

  _launchWave(originX, originY) {
    this._waves.push({ radius: 14, gfx: this.add.graphics().setDepth(7), originX, originY });
  }

  _updateWaves() {
    for (let i = this._waves.length - 1; i >= 0; i--) {
      const wave = this._waves[i];
      wave.radius += WAVE_SPEED;

      wave.gfx.clear();
      const alpha = 0.75 * (1 - wave.radius / WAVE_MAX_R);
      wave.gfx.lineStyle(5, 0xff1133, alpha);
      wave.gfx.strokeCircle(wave.originX, wave.originY, wave.radius);
      wave.gfx.lineStyle(2, 0xff6666, alpha * 0.5);
      wave.gfx.strokeCircle(wave.originX, wave.originY, wave.radius - 7);

      // Damage check
      if (!this._yotamInvincible) {
        const dist = Phaser.Math.Distance.Between(
          this.yotam.x, this.yotam.y, wave.originX, wave.originY,
        );
        if (Math.abs(dist - wave.radius) < 14) {
          this._yotamHit('', false);
        }
      }

      if (wave.radius >= WAVE_MAX_R) {
        wave.gfx.destroy();
        this._waves.splice(i, 1);
      }
    }
  }

  /* ─── weapons (work on minions, not on Glitch) ───────────────────────────── */
  _tryFire(time) {
    if (time - this._lastFireTime < 500) return;
    this._lastFireTime = time;
    const angle = this._lastFaceAngle;
    const bolt = this.bolts.create(
      this.yotam.x + Math.cos(angle) * 18,
      this.yotam.y + Math.sin(angle) * 18,
      'neonBolt',
    );
    if (!bolt) return;
    bolt.setDepth(12).setRotation(angle + Math.PI / 2);
    bolt.body.setAllowGravity(false);
    bolt.setVelocity(Math.cos(angle) * 400, Math.sin(angle) * 400);
    this.time.delayedCall(1400, () => { if (bolt.active) bolt.destroy(); });
  }

  _trySword(time) {
    if (time - this._lastSwordTime < 800) return;
    this._lastSwordTime = time;
    const angle = this._lastFaceAngle;
    const sx = this.yotam.x + Math.cos(angle) * 44;
    const sy = this.yotam.y + Math.sin(angle) * 44;
    const gfx = this.add.graphics().setDepth(15);
    gfx.lineStyle(4, 0x00ffff, 0.9);
    gfx.beginPath();
    gfx.arc(this.yotam.x, this.yotam.y, 44, angle - 0.75, angle + 0.75, false);
    gfx.strokePath();
    this.tweens.add({ targets: gfx, alpha: 0, duration: 220, onComplete: () => gfx.destroy() });
    this.snakeGroup.getChildren().forEach(snake => {
      if (!snake.active || snake._dead) return;
      if (Phaser.Math.Distance.Between(sx, sy, snake.x, snake.y) < 58) this._hitMinion(snake, 1);
    });
    // Sword near Glitch → shield effect
    if (this.glitch?.active) {
      if (Phaser.Math.Distance.Between(sx, sy, this.glitch.x, this.glitch.y) < 80) {
        this._showShieldEffect(sx, sy);
      }
    }
    this.cameras.main.shake(60, 0.003);
  }

  _hitMinion(snake, damage) {
    if (!snake || snake._dead) return;
    const killed = snake.hit(damage);
    this.cameras.main.shake(80, 0.004);
    if (killed) {
      this.st.xp += 10;
      this._refreshHUD();
    }
  }

  /* ─── shield visual (when bolt/sword hits Glitch) ───────────────────────── */
  _showShieldEffect(x, y) {
    const gfx = this.add.graphics().setDepth(20);
    let r = 8;
    const t = this.time.addEvent({
      delay: 16,
      callback: () => {
        r += 4;
        gfx.clear();
        gfx.lineStyle(3, 0x8800ff, 0.8 * (1 - r / 40));
        gfx.strokeCircle(x, y, r);
        if (r >= 40) { t.remove(); gfx.destroy(); }
      },
      loop: true,
    });
  }

  /* ─── boss question mechanics ────────────────────────────────────────────── */
  _nextQuestion() {
    if (this._qIdx >= this._qQueue.length) {
      this._qQueue = Phaser.Utils.Array.Shuffle([...bossData.boss_questions]);
      this._qIdx   = 0;
    }
    return this._qQueue[this._qIdx++];
  }

  _fireQuestion() {
    if (this._bossDefeated || this._questionActive) return;
    this._questionActive = true;
    const q = this._nextQuestion();
    const eventId = `boss_q_${this._questionCount++}`;
    this._currentQId = eventId;
    console.log('[Boss] _fireQuestion — dispatching gate:open with id:', eventId, '| bossHP:', this._bossHP);
    this.cameras.main.shake(120, 0.004);

    window.dispatchEvent(new CustomEvent('yotam:gate:open', {
      detail: {
        event_id: eventId,
        type:     'mcq_gate',
        label:    '⚡ גליץ מאתגר אותך!',
        content: {
          passage:       q.passage,
          question:      q.question,
          options:       q.options,
          correct_index: q.correct_index,
          hint:          q.hint ?? '',
          timer:         24,
        },
        reward:   { xp: 20 },
        adaptive: { if_wrong_once: 'show_hint', if_wrong_twice: null },
      },
    }));
  }

  _onGateAnswered(e) {
    const { eventId, correct, reward } = e.detail ?? {};
    console.log('[Boss] gate:answered — eventId:', eventId, '| currentQId:', this._currentQId, '| correct:', correct);
    if (eventId !== this._currentQId) {
      console.log('[Boss] gate:answered IGNORED — id mismatch');
      return;
    }
    this._questionActive = false;
    this._currentQId     = null;

    if (correct) {
      this.st.xp += reward?.xp ?? 20;
      this._glitchHit();
    } else {
      this._glitchHeal();
      this._yotamHit('הווירוס מתחזק! ❌', true);
    }

    if (!this._bossDefeated) {
      this._questionTimer?.remove(false);
      this._questionTimer = this.time.delayedCall(QUESTION_REPEAT_DELAY, () => this._fireQuestion());
    }
  }

  _glitchHit() {
    if (this._bossDefeated) { console.log('[Boss] _glitchHit skipped — already defeated'); return; }
    if (!this.glitch)        { console.log('[Boss] _glitchHit skipped — no glitch ref'); return; }

    // Decrement our own HP tracker (belt-and-suspenders alongside Glitch.hp)
    this._bossHP = (this._bossHP ?? this.glitch.maxHp) - 1;
    console.log('[Boss] _glitchHit — Glitch.hp before:', this.glitch.hp,
                '| _bossHP:', this._bossHP, '| _dead:', this.glitch._dead);

    const killed = this.glitch.hit(1);

    console.log('[Boss] _glitchHit — Glitch.hp after:', this.glitch.hp,
                '| killed (return):', killed,
                '| _dead (post):', this.glitch._dead);

    this.cameras.main.shake(200, 0.009);
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
    }
    this._refreshHUD();

    // Use BOTH the return value AND our own counter as kill conditions
    if (killed || this._bossHP <= 0 || this.glitch._dead) {
      console.log('[Boss] VICTORY condition met — calling _victory()');
      if (!this._bossDefeated) this._victory();
    }
  }

  _glitchHeal() {
    if (!this.glitch || this._bossDefeated) return;
    this.glitch.heal(1);
    this.cameras.main.flash(280, 150, 0, 0, false);
    this._showTextPop('הווירוס מתחזק! 🔴', '#ff3355', this.glitch.x, this.glitch.y - 50);
    this._refreshHUD();
  }

  /* ─── Yotam damage ───────────────────────────────────────────────────────── */
  _yotamHit(message = '', fromAnswer = false) {
    if (this._yotamInvincible || this.st.hearts <= 0) return;
    this._yotamInvincible = true;
    this.st.hearts = Math.max(0, this.st.hearts - 1);
    this._refreshHUD();
    this.cameras.main.flash(280, 200, 0, 0, false);
    if (!fromAnswer) this.cameras.main.shake(180, 0.008);
    if (message) this._showTextPop(message, '#ff3355', this.yotam.x, this.yotam.y - 30);
    this.tweens.add({
      targets: this.yotam, alpha: { from: 1, to: 0.25 },
      duration: 100, yoyo: true, repeat: 5,
      onComplete: () => { this.yotam.setAlpha(1); this._yotamInvincible = false; },
    });
    if (this.st.hearts <= 0) this._gameOver();
  }

  /* ─── event listener handlers ────────────────────────────────────────────── */
  _onShake(e) {
    this.cameras.main.shake(180, e.detail?.strength ?? 0.008);
  }

  _onJuice(e) {
    const { type, attempt } = e.detail ?? {};

    if (type === 'correct') {
      this.cameras.main.flash(200, 0, 255, 150);

      if (this.yotam?.active) {
        const emitter = this.add.particles(this.yotam.x, this.yotam.y, 'particle_dot', {
          speed: { min: 80, max: 200 },
          angle: { min: 0, max: 360 },
          scale: { start: 1, end: 0 },
          lifespan: 600,
          tint: [0x00ffff, 0x9900ff, 0x00ff88],
          emitting: false,
        }).setDepth(20);
        emitter.explode(20);
        this.time.delayedCall(700, () => { if (emitter?.active) emitter.destroy(); });
      }

      this._showTextPop('!קוד מפוענח', '#00ffff', W / 2, H / 2 - 20);

    } else if (type === 'wrong') {
      if (attempt <= 1) {
        this.cameras.main.shake(300, 0.012);
        this._showTextPop('שיבוש בקשר — נסה שוב', '#ff8800', W / 2, H / 2 - 20);
      } else {
        this.cameras.main.shake(500, 0.025);

        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.25)
          .setDepth(9998).setScrollFactor(0);
        this.tweens.add({
          targets: overlay, alpha: 0, duration: 400,
          onComplete: () => overlay.destroy(),
        });

        this._showTextPop('...הקוד נפרץ חלקית', '#ff0044', W / 2, H / 2 - 20);
      }
    }
  }

  /* ─── floating text pop ──────────────────────────────────────────────────── */
  _showTextPop(text, color = '#ffffff', x = W / 2, y = H / 2) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace', fontSize: '18px',
      color, stroke: '#000000', strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 0, color, blur: 10, fill: true },
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: t, y: y - 60, alpha: 0, duration: 1200, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /* ─── intro text ─────────────────────────────────────────────────────────── */
  _playIntroText() {
    const lines = [
      { text: '⚡ GLITCH.EXE ⚡', y: H / 2 - 40, color: '#ff3355', size: '28px' },
      { text: 'ענה נכון — תפגע בבוס!', y: H / 2 + 10, color: '#88ddff', size: '16px' },
      { text: 'ענה לא נכון — הוא יתחזק!', y: H / 2 + 36, color: '#ffaa00', size: '14px' },
    ];
    lines.forEach(({ text, y, color, size }, i) => {
      const t = this.add.text(W / 2, y, text, {
        fontFamily: 'Courier New, monospace', fontSize: size, color,
        shadow: { offsetX: 0, offsetY: 0, color, blur: 12, fill: true },
      }).setOrigin(0.5).setAlpha(0).setDepth(200);
      this.tweens.add({
        targets: t, alpha: 1, duration: 400, delay: i * 200,
        yoyo: false,
        onComplete: () => {
          this.time.delayedCall(1200, () => {
            this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() });
          });
        },
      });
    });
  }

  /* ─── victory ────────────────────────────────────────────────────────────── */
  _victory() {
    if (this._bossDefeated) return;        // guard double-call
    this._bossDefeated = true;
    console.log('[Boss] _victory() — scene stopping combat');

    // Kill all timers — including any pending wave-warn timers
    this._waveTimer?.remove(false);
    this._questionTimer?.remove(false);
    if (this._warnTimers) this._warnTimers.forEach(t => t?.remove(false));
    this.time.removeAllEvents();           // nuclear option — kill every pending timer

    // Destroy all live wave graphics immediately
    this._waves.forEach(w => { try { w.gfx.destroy(); } catch (_) {} });
    this._waves = [];

    // Freeze minions
    this.snakeGroup.getChildren().forEach(s => {
      try { if (s.body) s.body.setVelocity(0, 0); } catch (_) {}
    });

    // ── Victory juice ─────────────────────────────────────────────
    // 1. Triumph fanfare (Web Audio — no files needed)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523,0],[659,0.18],[784,0.36],[1047,0.54],[784,0.72],[1047,0.90]].forEach(([freq, t]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.28, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.38);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.4);
      });
    } catch (_) {}

    // 2. Confetti particle burst
    try {
      const confetti = this.add.particles(W / 2, H / 2, 'particle_dot', {
        speed:    { min: 120, max: 480 },
        angle:    { min: 0, max: 360 },
        scale:    { start: 2, end: 0 },
        lifespan: 1400,
        tint:     [0xffdd00, 0xff6600, 0x00ffcc, 0xff44aa, 0xffffff, 0x44aaff],
        emitting: false,
      }).setDepth(90);
      confetti.explode(80);
      this.time.delayedCall(1600, () => { if (confetti?.active) confetti.destroy(); });
    } catch (_) {}

    // 3. "כל הכבוד יותם!" hero text
    try {
      const heroTxt = this.add.text(W / 2, H / 2 - 20, '!כל הכבוד יותם 🏆', {
        fontFamily: 'Courier New, monospace',
        fontSize:   '26px',
        color:      '#ffdd00',
        stroke:     '#000000',
        strokeThickness: 5,
        align: 'center',
        shadow: { offsetX: 0, offsetY: 0, color: '#ffaa00', blur: 20, fill: true },
      }).setOrigin(0.5).setDepth(191).setScrollFactor(0).setAlpha(0);
      this.tweens.add({
        targets: heroTxt,
        alpha:   1,
        scaleX:  { from: 0.4, to: 1.1 },
        scaleY:  { from: 0.4, to: 1.1 },
        duration: 550, ease: 'Back.easeOut',
      });
    } catch (_) {}

    // Flash immediately — no nested delays
    try { this.cameras.main.flash(400, 255, 255, 200, true); } catch (_) {}

    // White flash → fade → launch dedicated VictoryScene
    this.time.delayedCall(400, () => {
      console.log('[Boss] _victory() — launching VictoryScene');
      this.cameras.main.flash(500, 255, 255, 255, false);
      this.time.delayedCall(300, () => {
        this.cameras.main.fadeOut(800, 255, 255, 255);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.virtCtrl?.destroy();
          this.scene.start('VictoryScene', {
            hearts:   this.st.hearts,
            xp:       this.st.xp + 100,   // bonus XP for defeating Glitch
            coins:    this.st.coins,
            diamonds: this.st.diamonds,
          });
        });
      });
    });
  }

  _showVictoryPanel() {
    console.log('[Boss] _showVictoryPanel called');
    const panelX = W / 2, panelY = H / 2;
    const panelW = 380, panelH = 430;
    const D = 191;
    const style = (size, color) => ({
      fontFamily: 'Courier New, monospace', fontSize: size, color,
      shadow: { offsetX: 0, offsetY: 0, color, blur: 10, fill: true },
    });
    const baseY = panelY - panelH / 2;

    const gfx = this.add.graphics().setDepth(190);
    gfx.fillStyle(0x010c1a, 0.96);
    gfx.fillRoundedRect(panelX - panelW / 2, baseY, panelW, panelH, 14);
    gfx.lineStyle(2, 0x00aaff, 0.9);
    gfx.strokeRoundedRect(panelX - panelW / 2, baseY, panelW, panelH, 14);
    gfx.lineStyle(1, 0x0066cc, 0.4);
    gfx.strokeRoundedRect(panelX - panelW / 2 + 4, baseY + 4, panelW - 8, panelH - 8, 12);

    const addText = (text, size, color, dy, delay = 0) => {
      const t = this.add.text(panelX, baseY + dy, text, style(size, color))
        .setOrigin(0.5).setDepth(D).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 500, delay });
      return t;
    };

    addText('כל הכבוד יותם! 🏆', '21px', '#88ddff', 36, 0);
    addText('המערכת הגלקטית ניצלה! 🌌', '13px', '#44ffaa', 68, 300);
    addText('XP: ' + (this.st.xp + 100) + ' ⚡', '13px', '#ffdd44', 100, 450);
    addText('מטבעות: ' + this.st.coins + ' 🪙', '13px', '#ffcc00', 122, 550);
    addText('יהלומים: ' + this.st.diamonds + ' 💎', '13px', '#88ccff', 144, 650);

    // Skin preview box
    this.time.delayedCall(800, () => {
      const sg = this.add.graphics().setDepth(D);
      sg.fillStyle(0x001a33, 1);
      sg.fillRoundedRect(panelX - 72, baseY + 164, 144, 68, 8);
      sg.lineStyle(1.5, 0xff6600, 0.8);
      sg.strokeRoundedRect(panelX - 72, baseY + 164, 144, 68, 8);
      sg.setAlpha(0);
      this.tweens.add({ targets: sg, alpha: 1, duration: 400 });
      const sl = this.add.text(panelX, baseY + 170, 'סקין חדש נפתח!', style('11px', '#ff9933')).setOrigin(0.5).setDepth(D + 1).setAlpha(0);
      const sc = this.add.text(panelX, baseY + 188, '🦸', { fontSize: '26px' }).setOrigin(0.5).setDepth(D + 1).setAlpha(0);
      this.tweens.add({ targets: [sl, sc], alpha: 1, duration: 400 });
    });

    // Hint
    this.time.delayedCall(1000, () => {
      addText('?רוצה להמשיך', '14px', '#aaccff', 248, 0);
      addText('יש עוד סודות במבוך...', '11px', '#667799', 270, 100);
      addText('חפש קיר שביר במסלול השמאלי', '10px', '#445566', 290, 200);
    });

    // Buttons
    this.time.delayedCall(1400, () => {
      const btnCont = this.add.text(panelX - 88, baseY + 336, '[ המשך לחקור ]', {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#44ddaa',
        shadow: { offsetX: 0, offsetY: 0, color: '#004433', blur: 8, fill: true },
      }).setOrigin(0.5).setDepth(D).setAlpha(0).setInteractive({ useHandCursor: true });
      btnCont.on('pointerover', () => btnCont.setStyle({ color: '#88ffcc' }));
      btnCont.on('pointerout',  () => btnCont.setStyle({ color: '#44ddaa' }));
      btnCont.on('pointerdown', () => {
        this.cameras.main.fadeOut(600, 2, 8, 16);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.virtCtrl && this.virtCtrl.destroy();
          this.scene.start('MazeScene', { hearts: this.st.hearts, xp: this.st.xp + 100, coins: this.st.coins, diamonds: this.st.diamonds, postBoss: true });
        });
      });
      this.tweens.add({ targets: btnCont, alpha: { from: 0, to: 1 }, duration: 400 });

      const btnFin = this.add.text(panelX + 88, baseY + 336, '[ סיים משחק ]', {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#5577aa',
        shadow: { offsetX: 0, offsetY: 0, color: '#001133', blur: 8, fill: true },
      }).setOrigin(0.5).setDepth(D).setAlpha(0).setInteractive({ useHandCursor: true });
      btnFin.on('pointerover', () => btnFin.setStyle({ color: '#88aadd' }));
      btnFin.on('pointerout',  () => btnFin.setStyle({ color: '#5577aa' }));
      btnFin.on('pointerdown', () => { this.virtCtrl && this.virtCtrl.destroy(); this.scene.start('MainMenuScene'); });
      this.tweens.add({ targets: btnFin, alpha: { from: 0, to: 1 }, duration: 400, delay: 100 });

      const btnPlay = this.add.text(panelX, baseY + 375, '[ שחק שוב את הבוס ]', {
        fontFamily: 'Courier New, monospace', fontSize: '11px', color: '#334455',
        shadow: { offsetX: 0, offsetY: 0, color: '#001122', blur: 4, fill: true },
      }).setOrigin(0.5).setDepth(D).setAlpha(0).setInteractive({ useHandCursor: true });
      btnPlay.on('pointerover', () => btnPlay.setStyle({ color: '#5577aa' }));
      btnPlay.on('pointerout',  () => btnPlay.setStyle({ color: '#334455' }));
      btnPlay.on('pointerdown', () => { this.virtCtrl && this.virtCtrl.destroy(); this.scene.restart(); });
      this.tweens.add({ targets: btnPlay, alpha: { from: 0, to: 0.6 }, duration: 400, delay: 300 });
    });
  }

  /* ─── game over ──────────────────────────────────────────────────────────── */
  _gameOver() {
    this._waveTimer?.remove(false);
    this._questionTimer?.remove(false);
    this.time.delayedCall(500, () => {
      this.cameras.main.fadeOut(600, 20, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.virtCtrl?.destroy();
        this.scene.restart();  // restart BossScene with same data
      });
    });
  }

  /* ─── cleanup ────────────────────────────────────────────────────────────── */
  shutdown() {
    window.removeEventListener('yotam:gate:answered', this._gateHandler);
    window.removeEventListener('yotam:shake',         this._shakeHandler);
    window.removeEventListener('yotam:juice',         this._juiceHandler);
    this._waves.forEach(w => w.gfx?.destroy());
    this._waves = [];
    this._waveTimer?.remove(false);
    this._questionTimer?.remove(false);
    if (this._bossMusic?.isPlaying) { this._bossMusic.stop(); this._bossMusic = null; }
    this.virtCtrl?.destroy();
  }
}

import * as Phaser from 'phaser';
import Yotam         from '../entities/Yotam';
import CyberSnake    from '../entities/CyberSnake';
import EventManager  from '../systems/EventManager';
import VirtualControls from '../systems/VirtualControls';
import pilotEvents   from '../../data/events/pilot01_events.json';
import MusicManager  from '../audio/MusicManager';
import SfxManager    from '../audio/SfxManager';
import { AUDIO_MANIFEST } from '../audio/AudioManifest';
import _mp3_intro from '../../assets/audio/יותם, אנחנו חייבים את עזרתך..mp3';

// ─── Tile types ───────────────────────────────────────────────────────────────
const WALL      = 0;
const FLOOR     = 1;
const GREEN     = 2;   // special green wall (האת location)
const BREAKABLE = 5;   // cracked wall — press E to reveal treasure

// ─── World ────────────────────────────────────────────────────────────────────
const TILE    = 32;
const COLS    = 20;
const ROWS    = 25;
const WORLD_W = COLS * TILE;   // 640
const WORLD_H = ROWS * TILE;   // 800
const REVEAL_R = 5.5;          // fog reveal radius in tiles

// ─── Coin positions [r, c] ────────────────────────────────────────────────────
const COIN_POS = [
  // North corridor
  [11, 9], [12, 10], [13, 8],
  // North-west branch
  [7, 5], [8, 4], [7, 6],
  // North dead end
  [4, 3],
  // West corridor + pocket
  [17, 3], [17, 4], [13, 2],
  // East corridor + dead end
  [16, 15], [17, 16], [21, 17],
];

// ─── Breakable wall definitions ───────────────────────────────────────────────
const BREAK_DEFS = [
  { r: 8,  c: 2,  reward: 'diamond' },          // west face of NW branch
  { r: 21, c: 15, reward: 'diamond' },          // west face of east dead end
  { r: 12, c: 4,  reward: 'coins3'  },          // east face of west pocket
  { r: 2,  c: 3,  reward: 'coins3', noTypeChange: true },  // green wall (radio mission)
  { r: 2,  c: 4,  reward: 'coins3', noTypeChange: true },  // green wall (radio mission)
  // New areas (bonus map extension)
  { r: 22, c: 13, reward: 'coins3'  },          // south room dead-end
  { r: 7,  c: 16, reward: 'diamond' },          // northeast arm tip
  { r: 9,  c: 1,  reward: 'jackpot' },          // far-west secret (post-boss hint)
];

// ─── Snake constants ─────────────────────────────────────────────────────────
const SNAKE_SPAWN   = { x: 10.5 * TILE, y: 12 * TILE };
const SNAKE_PATROL  = [
  { x: 9.5 * TILE,  y: 12 * TILE },
  { x: 10.5 * TILE, y: 10 * TILE },
  { x: 10.5 * TILE, y: 13 * TILE },
];
const SNAKE_ZONE    = { rMin: 8, rMax: 15, cMin: 7, cMax: 12 };

// ─── Direction marker labels ──────────────────────────────────────────────────
const MARKERS = [
  { r: 14.5, c: 9.5,  text: '▲  קדימה  ▲', color: '#5599cc' },
  { r: 17,   c: 6.6,  text: '◄  שמאל',      color: '#4488aa' },
  { r: 17,   c: 12.4, text: 'ימין  ►',       color: '#4488aa' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default class MazeScene extends Phaser.Scene {
  constructor() { super({ key: 'MazeScene' }); }

  // ── init (receives data from BossScene when continuing) ────────────────────
  init(data = {}) {
    this._initData = data;
    this.canDig = false;   // reset here too — before create() runs
  }

  // ── preload ─────────────────────────────────────────────────────────────────
  preload() {
    // Legacy parallax layers kept in case PNGs are later provided (graceful fallback)
    this.load.image('bg-far',  'assets/backgrounds/bg-far.png');
    this.load.image('bg-mid',  'assets/backgrounds/bg-mid.png');
    this.load.image('bg-near', 'assets/backgrounds/bg-near.png');

    // Virtual controls (joystick + action buttons)
    this.load.image('joy-base',       'assets/ui/joy-base.png');
    this.load.image('joy-thumb',      'assets/ui/joy-thumb.png');
    this.load.image('btn-gun',        'assets/ui/btn-gun.png');
    this.load.image('btn-gun-press',  'assets/ui/btn-gun-press.png');
    this.load.image('btn-sword',      'assets/ui/btn-sword.png');
    this.load.image('btn-sword-press','assets/ui/btn-sword-press.png');
    this.load.image('btn-axe',        'assets/ui/btn-axe.png');
    this.load.image('btn-axe-press',  'assets/ui/btn-axe-press.png');

    // Neon-lab pixel-art tileset (8 tiles × 32px, one row)
    this.load.spritesheet('neonLabTiles', 'assets/tiles/neon_lab_tiles.png', {
      frameWidth: 32, frameHeight: 32,
    });

    // Yotam character spritesheet (8 rows × 4 cols × 48×48 px, drawn pixel-art)
    // row 0=idle(2)  1=walk_down(4)  2=walk_up(4)  3=walk_left(4)
    // row 4=walk_right(4)  5=shoot(3)  6=hit(2)  7=victory(2)
    this.load.spritesheet('yotam_sheet', 'assets/sprites/yotam.png', {
      frameWidth: 48, frameHeight: 48,
    });

    // Stage 4: music tracks
    Object.values(AUDIO_MANIFEST.music).forEach(({ key, path }) => {
      this.load.audio(key, path);
    });
    // Stage 4: SFX + ambience
    Object.entries(AUDIO_MANIFEST.sfxPaths).forEach(([key, path]) => {
      this.load.audio(key, path);
    });
    this.load.audio(AUDIO_MANIFEST.ambienceKey, AUDIO_MANIFEST.ambiencePath);
  }

  // ── create ──────────────────────────────────────────────────────────────────
  create() {
    // Player state — restore from BossScene if returning post-victory
    const d = this._initData ?? {};
    this.st = {
      hearts:   d.hearts   ?? 3,
      coins:    d.coins    ?? 0,
      diamonds: d.diamonds ?? 0,
      xp:       d.xp       ?? 0,
    };
    this.canDig           = false;  // ALWAYS starts locked — unlocked only by gate_chest_typing
    this._wallBroken       = false;  // set true after first successful wall break
    this._blockMsgCooldown = false;  // throttle "not available" messages
    this._lastTR = -1;
    this._lastTC = -1;

    // Map + visited tracking
    this.map = this._buildMap();
    this.visited = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));

    // Physics / camera world bounds
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#020810');

    // ── Parallax background layers ─────────────────────────────────────────
    this._buildParallax();

    // Generate shared textures once
    this._buildTextures();

    // Draw map visuals + tilemap collision
    this._buildTilemap();
    this._buildProgressionBlocks();
    this._addDirectionMarkers();

    // Collectibles
    this.coinGroup    = this.physics.add.staticGroup();
    this.diamondGroup = this.physics.add.staticGroup();
    this._breakHints  = [];
    this._spawnCoins();
    this._spawnBreakHints();

    // Post-boss welcome message
    if (this._initData?.postBoss) {
      this.time.delayedCall(800, () => {
        const line1 = this.add.text(
          this.cameras.main.width / 2, this.cameras.main.height / 2 - 80,
          'ברוך השב גיבור!',
          { fontFamily: 'Courier New, monospace', fontSize: '18px', color: '#88ffcc',
            stroke: '#003322', strokeThickness: 3, align: 'center',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffaa', blur: 14, fill: true } }
        ).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
        const line2 = this.add.text(
          this.cameras.main.width / 2, this.cameras.main.height / 2 - 52,
          'המשמר הגלקטי ממתין לך!',
          { fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#44ffaa',
            stroke: '#003322', strokeThickness: 2, align: 'center' }
        ).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
        this.tweens.add({ targets: [line1, line2], alpha: 1, duration: 600, yoyo: true, hold: 2200,
          onComplete: () => { line1.destroy(); line2.destroy(); } });
      });
    }

    // Player
    this.yotam = new Yotam(this, 9.5 * TILE, 17.5 * TILE);
    this.physics.add.collider(this.yotam, this.wallLayer);
    this._addProgressionColliders(); // wire block groups now that yotam exists
    this.physics.add.overlap(this.yotam, this.coinGroup,    this._onCoin,    null, this);
    this.physics.add.overlap(this.yotam, this.diamondGroup, this._onDiamond, null, this);

    // ── Yotam animations (only when real spritesheet is loaded) ───────────────
    if (this.textures.exists('yotam_sheet')) {
      if (!this.anims.exists('yotam_idle')) {
        // 8-row × 4-col sheet (48×48 cells). Frame indices: row*4 + col
        this.anims.create({
          key: 'yotam_idle',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [0, 1] }),
          frameRate: 3, repeat: -1,
        });
        this.anims.create({
          key: 'yotam_walk_down',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [4, 5, 6, 7] }),
          frameRate: 8, repeat: -1,
        });
        this.anims.create({
          key: 'yotam_walk_up',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [8, 9, 10, 11] }),
          frameRate: 8, repeat: -1,
        });
        this.anims.create({
          key: 'yotam_walk_left',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [12, 13, 14, 15] }),
          frameRate: 8, repeat: -1,
        });
        this.anims.create({
          key: 'yotam_walk_right',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [16, 17, 18, 19] }),
          frameRate: 8, repeat: -1,
        });
        this.anims.create({
          key: 'yotam_shoot',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [20, 21, 22] }),
          frameRate: 10, repeat: 0,
        });
        this.anims.create({
          key: 'yotam_hit',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [24, 25] }),
          frameRate: 6, repeat: 0,
        });
        this.anims.create({
          key: 'yotam_victory',
          frames: this.anims.generateFrameNumbers('yotam_sheet', { frames: [28, 29] }),
          frameRate: 4, repeat: -1,
        });
      }
      this.yotam.anims.play('yotam_idle');
    }
    this._yotamFacing   = 1;      // 1=right  -1=left
    this._yotamShooting = false;
    this._lastDir       = 'down'; // last movement direction: 'left'|'right'|'up'|'down'

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Fog
    this.fogGfx = this.add.graphics().setDepth(50);
    this._updateFog(17, 9);

    // Camera
    this.cameras.main.startFollow(this.yotam, true, 0.09, 0.09);
    this.cameras.main.setDeadzone(150, 50);
    this.cameras.main.setFollowOffset(0, 200);

    // HUD
    this._buildHUD();

    // Atmospheric lighting (vignette + smooth light gradient + collectible glow)
    this._createAtmosphere();
    this._playerLightRadius = 140;
    this._addCornerShadow();
    this._addNeonGlows();
    this._addAtmosphereParticles();

    // Particles + audio
    this._initParticles();
    this._initAudio();
    this._startAmbience();

    // Stage 4: music + SFX managers
    this.musicManager      = new MusicManager(this);
    this.sfxManager        = new SfxManager(this);
    this.game.musicManager = this.musicManager;
    this.game.sfxManager   = this.sfxManager;
    this.musicManager.play('maze_explore');
    this.sfxManager.startAmbience();

    // ── Combat ──────────────────────────────────────────────────────────────
    this._lastFaceAngle = -Math.PI / 2;   // default facing up
    this._lastFireTime  = -Infinity;
    this._lastSwordTime = -Infinity;
    this._yotamInvincible = false;

    // Combat keyboard
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.zKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

    // Laser bolt group
    this.bolts = this.physics.add.group();
    this.physics.add.collider(this.bolts, this.wallLayer, (b) => { this._emitBoltSparks(b.x, b.y); b.destroy(); });

    // Enemy group
    this.snakeGroup = this.physics.add.group();
    this.physics.add.overlap(this.bolts, this.snakeGroup, (bolt, snake) => {
      bolt.destroy();
      this._hitEnemy(snake, 1);
    });
    this.physics.add.overlap(this.yotam, this.snakeGroup, (yotam, snake) => {
      if (!snake._dead) this._yotamHit();
    });

    // Snake state
    this._snakeAlive      = false;
    this._snakeEverKilled = false;
    this._snakeLeftZone   = false;
    this._inSnakeZone     = false;
    this._spawnSnake();

    // Learning gate system
    this.eventMgr = new EventManager(pilotEvents);
    this.eventMgr.setScene(this);
    this._onShakeHandler        = (e) => this._onShake(e);
    this._onGateAnsweredHandler = (e) => this._onGateAnswered(e);
    this._onJuiceHandler        = (e) => this._onJuice(e);
    this._onGateBlockedHandler  = (e) => this._onGateBlocked(e);
    this._onGateOpenHandler     = (e) => this._onGateOpen(e);
    window.addEventListener('yotam:shake',         this._onShakeHandler);
    window.addEventListener('yotam:gate:answered', this._onGateAnsweredHandler);
    window.addEventListener('yotam:juice',         this._onJuiceHandler);
    window.addEventListener('yotam:gate:open',     this._onGateOpenHandler);
    window.addEventListener('yotam:gate:blocked',  this._onGateBlockedHandler);
    this._onIntroStartHandler = (e) => this._onIntroStart(e);
    window.addEventListener('yotam:intro:start',   this._onIntroStartHandler);

    // Virtual touch controls
    this.virtCtrl = new VirtualControls(this);

    this.cameras.main.fadeIn(500, 2, 8, 16);

    // Auto-fire intro narration (audio-only, no UI)
    this.time.delayedCall(800, () => { this.eventMgr.triggerEvent('intro_story'); });

    this.events.on('doorOpen', ({ eventId }) => {
      console.log(`[YQ-DEBUG] doorOpen received for ${eventId}`);
      this.sfxManager?.play('door_open');
      this.sfxManager?.duckAmbience();
      this.musicManager?.play('victory');
      this.musicManager?.scheduleReturn(4000);
      // Expand player light radius briefly
      this._playerLightRadius = 180;
      const cam = this.cameras.main;
      this._updateAtmosphere(
        Math.round(this.yotam.x - cam.scrollX),
        Math.round(this.yotam.y - cam.scrollY),
      );
      this.time.delayedCall(600, () => {
        this._playerLightRadius = 140;
        const cam2 = this.cameras.main;
        this._updateAtmosphere(
          Math.round(this.yotam.x - cam2.scrollX),
          Math.round(this.yotam.y - cam2.scrollY),
        );
      });
      // Brief cyan flash at door open
      const fr = this.add.rectangle(240, 427, 480, 854, 0x00ffee, 0)
        .setScrollFactor(0).setDepth(53);
      this.tweens.add({
        targets: fr, alpha: 0.06, duration: 200,
        yoyo: true, onComplete: () => fr.destroy(),
      });
    });
  }

  // ── update ──────────────────────────────────────────────────────────────────
  update(time) {
    if (this.playerInputPaused) { this.yotam?.setVelocity(0, 0); return; }
    const SPEED = 160;
    const { left, right, up, down } = this.cursors;
    const { left: a, right: d, up: w, down: s } = this.wasd;

    // Keyboard movement (takes priority over joystick)
    let vx = 0, vy = 0;
    if (left.isDown  || a.isDown)  vx = -SPEED;
    if (right.isDown || d.isDown)  vx =  SPEED;
    if (up.isDown    || w.isDown)  vy = -SPEED;
    if (down.isDown  || s.isDown)  vy =  SPEED;

    // Joystick fallback when no key held
    if (!vx && !vy && this.virtCtrl) {
      const JOY_SPEED = 120;      // joystick speed (px/s)
      const DEAD_ZONE = 0.15;     // ignore tiny unintentional thumb drift
      const j = this.virtCtrl.getJoy();
      const jx = Math.abs(j.vx) > DEAD_ZONE ? j.vx : 0;
      const jy = Math.abs(j.vy) > DEAD_ZONE ? j.vy : 0;
      vx = jx * JOY_SPEED;
      vy = jy * JOY_SPEED;
    }

    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }

    // Smooth acceleration — lerp toward target velocity (snappy, not floaty)
    const ACCEL = 0.30;
    this._vxCurr = Phaser.Math.Linear(this._vxCurr ?? 0, vx, ACCEL);
    this._vyCurr = Phaser.Math.Linear(this._vyCurr ?? 0, vy, ACCEL);
    this.yotam.setVelocity(this._vxCurr, this._vyCurr);

    if (vx || vy) {
      const angle = Math.atan2(vy, vx);
      this._lastFaceAngle = angle;

      // Determine dominant direction for animation
      const absVx = Math.abs(vx), absVy = Math.abs(vy);
      if (absVx >= absVy) {
        // Horizontal dominant (or diagonal — side view wins)
        if (vx < 0) { this._yotamFacing = -1; this._lastDir = 'left'; }
        else         { this._yotamFacing =  1; this._lastDir = 'right'; }
        this.yotam.setFlipX(false);
        if (!this._yotamShooting && this.textures.exists('yotam_sheet')) {
          const animKey = vx < 0 ? 'yotam_walk_left' : 'yotam_walk_right';
          this.yotam.anims.play(animKey, true);
        }
      } else {
        // Vertical dominant
        this._lastDir = vy < 0 ? 'up' : 'down';
        if (!this._yotamShooting && this.textures.exists('yotam_sheet')) {
          const animKey = vy < 0 ? 'yotam_walk_up' : 'yotam_walk_down';
          this.yotam.anims.play(animKey, true);
        }
      }
    } else {
      // Stopped — hold first frame of walk_up (back to camera) unless shooting
      if (!this._yotamShooting && this.textures.exists('yotam_sheet')) {
        this.yotam.anims.stop();
        this.yotam.setFrame(8);
      }
    }

    // Dust particles + footstep sound when walking
    if (vx || vy) {
      const now2 = this.time.now;
      if (now2 - (this._lastDustTime ?? 0) > 140) {
        this._lastDustTime = now2;
        this._emitDust(this.yotam.x, this.yotam.y + 10);
      }
      if (now2 - (this._lastFootstepTime ?? 0) > 500) {
        this._lastFootstepTime = now2;
        this._playSound('footstep');
      }
    }

    // Coin proximity glow pulse (runs on tile change — cheap enough here)
    if (this.coinGroup) {
      this.coinGroup.getChildren().forEach(coin => {
        if (!coin.active) return;
        const dist = Phaser.Math.Distance.Between(this.yotam.x, this.yotam.y, coin.x, coin.y);
        const near = dist < TILE * 2.5;
        if (near && !coin._nearPulsed) {
          coin._nearPulsed = true;
          this.tweens.add({
            targets: coin, scaleX: 1.45, scaleY: 1.45,
            yoyo: true, duration: 180, ease: 'Sine.easeOut',
          });
        } else if (!near) {
          coin._nearPulsed = false;
        }
      });
    }

    // Magnet: slide coins toward Yotam when within 60px
    if (this.coinGroup) {
      this.coinGroup.getChildren().forEach(coin => {
        if (!coin.active) return;
        const dx = this.yotam.x - coin.x;
        const dy = this.yotam.y - coin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60 && dist > 1) {
          const pull = 220 * (1 - dist / 60) * (1 / 60);
          coin.x += (dx / dist) * pull;
          coin.y += (dy / dist) * pull;
          coin.refreshBody();
        }
      });
    }

        // ── Parallax update (after camera follows player to avoid jitter) ──
    if (this.bgFar || this.bgMid || this.bgNear) {
      const cam = this.cameras.main;
      if (this.bgFar)  { this.bgFar.tilePositionX  = cam.scrollX * 0.3 + (this.time.now * 0.00005); this.bgFar.tilePositionY  = cam.scrollY * 0.3; }
      if (this.bgMid)  { this.bgMid.tilePositionX  = cam.scrollX * 0.8; this.bgMid.tilePositionY  = cam.scrollY * 0.8 + (this.time.now * 0.0001); }
      if (this.bgNear) { this.bgNear.tilePositionX = cam.scrollX * 1.5; this.bgNear.tilePositionY = cam.scrollY * 1.5; }
    }

    // Tile-based updates
    const tr = Math.floor(this.yotam.y / TILE);
    const tc = Math.floor(this.yotam.x / TILE);
    if (tr !== this._lastTR || tc !== this._lastTC) {
      this._lastTR = tr; this._lastTC = tc;
      this._updateFog(tr, tc);
      this.eventMgr?.checkTriggers(tr, tc);
      this._checkSnakeRespawn(tr, tc);
      this._updateDangerMusic();
    }

    // Dig / break wall
    if (Phaser.Input.Keyboard.JustDown(this.eKey) || this.virtCtrl?.consumeDig()) {
      this._tryBreak(tr, tc);
    }

    // Combat input
    const fireKb  = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const swordKb = Phaser.Input.Keyboard.JustDown(this.zKey);
    if (fireKb  || this.virtCtrl?.consumeFire())  this._tryFire(time);
    if (swordKb || this.virtCtrl?.consumeSword()) this._trySword(time);
  }

  // ── parallax background ──────────────────────────────────────────────────
  _buildParallax() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Solid dark base behind the tilemap ──────────────────────────────────
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x050a14)
      .setScrollFactor(1).setDepth(-10);

    // ── Bottom vignette — kills any bleed below world bounds ─────────────────
    // Depth 55: above tilemap (0-1) and fog (50), below HUD (99).
    const FADE_H = 60;
    const edgeFade = this.add.graphics().setScrollFactor(0).setDepth(55);
    edgeFade.fillStyle(0x010208, 1).fillRect(0, H - 20, W, 20);
    for (let i = 0; i < FADE_H - 20; i++) {
      edgeFade.fillStyle(0x010208, (i / (FADE_H - 20)) * 0.95)
              .fillRect(0, H - FADE_H + i, W, 1);
    }
  }

  // ── map building ─────────────────────────────────────────────────────────────
  _buildMap() {
    const m = Array.from({ length: ROWS }, () => new Array(COLS).fill(WALL));
    const fill = (r1, c1, r2, c2, v = FLOOR) => {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          m[r][c] = v;
    };

    // Entrance hall
    fill(15, 7, 19, 12);

    // North main corridor (4-wide)
    fill(9, 8, 14, 11);

    // North-west branch — turns left at the top of north corridor
    fill(6, 3, 9, 8);

    // North dead end — narrow passage going up from NW branch
    fill(3, 3, 5, 4);

    // Green special wall at the very top
    fill(2, 3, 2, 4, GREEN);

    // ── Corridor 1: North Dead End → NE Arm (one-way, event-gated) ──────────
    fill(4, 5, 4, 11);    // horizontal east along row 4, cols 5-11
    fill(5, 11, 8, 11);   // vertical south along col 11, rows 5-8 (meets NE arm at row 9)

    // ── Corridor 2: NE Arm → East Corridor (one-way, event-gated) ────────────
    fill(12, 13, 15, 14); // vertical bridge cols 13-14, rows 12-15 (gap between NE arm and east corridor)

    // East main corridor
    fill(16, 13, 18, 18);

    // East dead end — turns south
    fill(19, 16, 23, 18);

    // West main corridor
    fill(16, 1, 18, 6);

    // West pocket — branches north from west corridor
    fill(12, 1, 15, 3);

    // ── Bonus map extension ──────────────────────────────────────────────────
    // South room — large area below entrance hall
    fill(20, 7, 23, 13);

    // Secret passage — connects west corridor to south room
    fill(19, 5, 21, 8);

    // Northeast arm — branches east from north corridor
    fill(9,  11, 11, 16);
    fill(7,  14, 10, 16);   // north turn of NE arm

    // Far-west extension — extends west pocket northward (post-boss secret)
    fill(8,  1,  11, 2);

    // Breakable walls
    BREAK_DEFS.forEach(({ r, c, noTypeChange }) => { if (!noTypeChange) m[r][c] = BREAKABLE; });

    return m;
  }

  // ── textures ────────────────────────────────────────────────────────────────
  _buildTextures() {
    const once = (key, w, h, fn) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      fn(g); g.generateTexture(key, w, h); g.destroy();
    };

    once('__wall', TILE, TILE, g =>
      g.fillStyle(0xffffff, 1).fillRect(0, 0, TILE, TILE));

    once('coin', 14, 14, g => {
      g.fillStyle(0xffcc00, 1).fillCircle(7, 7, 6);
      g.lineStyle(1.5, 0xffee66, 1).strokeCircle(7, 7, 6);
      g.fillStyle(0xfff0a0, 1).fillCircle(5, 4, 2);
    });

    once('neonBolt', 8, 18, g => {
      g.fillStyle(0x00ffff, 1).fillRect(2, 0, 4, 18);
      g.fillStyle(0xffffff, 0.8).fillRect(3, 2, 2, 14);
    });

    once('particle_dot', 8, 8, g =>
      g.fillStyle(0x00ffff, 1).fillCircle(4, 4, 4));

    // Dust puff — tiny grey-brown square for walk trail
    once('particle_dust', 4, 4, g =>
      g.fillStyle(0x887755, 1).fillRect(0, 0, 4, 4));

    // Spark — small bright square for wall-break burst
    once('particle_spark', 5, 5, g =>
      g.fillStyle(0xff9900, 1).fillRect(0, 0, 5, 5));

    once('diamond', 16, 16, g => {
      g.fillStyle(0x00ccff, 1)
        .fillTriangle(8, 1, 15, 7, 8, 15)
        .fillStyle(0x0055aa, 1)
        .fillTriangle(8, 15, 1, 7, 8, 1);
      g.lineStyle(1, 0x88ffff, 0.8).strokeTriangle(8, 1, 15, 7, 8, 15);
    });
  }

  // ── tilemap rendering + collision ────────────────────────────────────────────
  //
  // Map-constant → tile ID:
  //   WALL (0)      → wallLayer  tile 1  (Wall)
  //   FLOOR (1)     → groundLayer tile 0  (Floor)
  //   GREEN (2)     → wallLayer  tile 3  (Energy Wall) + floor underneath
  //   BREAKABLE (5) → wallLayer  tile 2  (Cracked Wall) + floor underneath
  //
  // Collision is handled entirely by wallLayer (IDs 1, 2, 3).
  // Progression blocks (_buildProgressionBlocks) sit above the tilemap as
  // separate Graphics + staticGroups — NOT part of the tilemap.
  _buildTilemap() {
    this.tileMap = this.make.tilemap({
      tileWidth: TILE, tileHeight: TILE, width: COLS, height: ROWS,
    });
    this.tileset = this.tileMap.addTilesetImage('neonLabTiles', null, TILE, TILE, 0, 0);

    this.groundLayer = this.tileMap.createBlankLayer('Ground', this.tileset, 0, 0).setDepth(0);
    this.wallLayer   = this.tileMap.createBlankLayer('Walls',  this.tileset, 0, 0).setDepth(1);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.map[r][c];
        if (cell === FLOOR) {
          this.groundLayer.putTileAt(0, c, r);   // Floor tile
        } else if (cell === GREEN) {
          this.groundLayer.putTileAt(0, c, r);   // floor underneath
          this.wallLayer.putTileAt(3, c, r);     // Energy Wall tile
        } else if (cell === BREAKABLE) {
          this.groundLayer.putTileAt(0, c, r);   // floor underneath
          this.wallLayer.putTileAt(2, c, r);     // Cracked Wall tile
        } else {
          // WALL — every wall cell gets a tile (edge and non-edge alike)
          this.wallLayer.putTileAt(1, c, r);     // Wall tile
        }
      }
    }

    // Tile IDs that block movement: Wall(1), Cracked Wall(2), Energy Wall(3)
    this.wallLayer.setCollision([1, 2, 3]);
  }

  _wallBody(px, py, group, r = -1, c = -1) {
    const cx = px + TILE / 2, cy = py + TILE / 2;
    const b = group.create(cx, cy, '__wall');
    b.setAlpha(0).body.setSize(TILE, TILE);
    b.refreshBody();
    if (r >= 0) { b.tileR = r; b.tileC = c; }
    return b;
  }

  _edgeWall(r, c) {
    if (this.map[r][c] !== WALL) return false;
    return [[-1,0],[1,0],[0,-1],[0,1]].some(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && this.map[nr][nc] !== WALL;
    });
  }

  // ── direction markers ────────────────────────────────────────────────────────
  _addDirectionMarkers() {
    MARKERS.forEach(({ r, c, text, color }) =>
      this.add.text(c * TILE, r * TILE, text, {
        fontFamily: 'Courier New, monospace', fontSize: '11px', color,
        shadow: { offsetX: 0, offsetY: 0, color, blur: 5, fill: true },
      }).setOrigin(0.5).setDepth(5));

    // Green wall mystery hint
    this.add.text(3.5 * TILE, 4 * TILE, '?', {
      fontFamily: 'Courier New, monospace', fontSize: '20px', color: '#00cc44',
      shadow: { offsetX: 0, offsetY: 0, color: '#00ff44', blur: 12, fill: true },
    }).setOrigin(0.5).setDepth(5);

    this.add.text(9.5 * TILE, 16.5 * TILE, 'כניסה', {
      fontFamily: 'Courier New, monospace', fontSize: '10px', color: '#2a4a6a',
    }).setOrigin(0.5).setDepth(5);
  }

  // ── collectibles ─────────────────────────────────────────────────────────────
  _spawnCoins() {
    COIN_POS.forEach(([r, c]) => {
      if (this.map[r][c] < FLOOR) return;
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      const coin = this.coinGroup.create(x, y, 'coin').setDepth(8);
      coin.refreshBody();
      this._bob(coin, y);
      this._pulse(coin);
    });
  }

  _spawnBreakHints() {
    BREAK_DEFS.forEach(({ r, c }) => {
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2 - TILE;
      const hint = this.add.text(x, y, '[E]', {
        fontFamily: 'Courier New, monospace', fontSize: '9px', color: '#ff8800', alpha: 0,
      }).setOrigin(0.5).setDepth(9);
      hint.tileR = r; hint.tileC = c;
      this._breakHints.push(hint);
    });
  }

  _tryBreak(tileR, tileC) {
    // 300 ms cooldown — prevents rapid-fire calls from double-triggering
    const now = this.time.now;
    if (now - (this._lastDigTime ?? -Infinity) < 300) return;

    if (!this.canDig) {
      // Show "no axe" nudge only when adjacent to a breakable wall
      const hasAdjacentBreak = [[0,1],[0,-1],[1,0],[-1,0]].some(([dr, dc]) => {
        const r = tileR + dr, c = tileC + dc;
        return r >= 0 && r < ROWS && c >= 0 && c < COLS &&
               (this.map[r][c] === BREAKABLE || this.map[r][c] === GREEN);
      });
      if (hasAdjacentBreak && !this._noAxeShown) {
        this._noAxeShown = true;
        this._showFloatMsg('אין לך גרזן עדיין! חפש את התיבה המסתורית →', '#ff8833');
        this.time.delayedCall(3000, () => { this._noAxeShown = false; });
      }
      return;
    }
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const r = tileR + dr, c = tileC + dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (this.map[r][c] !== BREAKABLE && this.map[r][c] !== GREEN) continue;

      // Verify the tilemap tile is breakable (ID 2 = Cracked Wall, ID 3 = Energy Wall)
      const tile = this.wallLayer.getTileAt(c, r);
      if (!tile || (tile.index !== 2 && tile.index !== 3)) continue;

      // Swap wall tile → floor tile
      this.wallLayer.removeTileAt(c, r);
      this.groundLayer.putTileAt(0, c, r);
      this.map[r][c] = FLOOR;

      this.cameras.main.shake(180, 0.005);
      this._lastDigTime = now;
      this._emitSparks(c * TILE + TILE / 2, r * TILE + TILE / 2);
      this._playSound('mine');

      const def = BREAK_DEFS.find(d => d.r === r && d.c === c);
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;

      if (def?.reward === 'jackpot') {
        // Post-boss secret: 3 diamonds + big XP
        [[-14,0],[0,0],[14,0]].forEach(([dx, dy]) => {
          const gem = this.diamondGroup.create(cx + dx, cy + dy, 'diamond').setDepth(8);
          gem.refreshBody();
          this._pulse(gem);
          this.tweens.add({ targets: gem, angle: 360, duration: 3000, repeat: -1 });
        });
        this.st.xp += 30;
        this.cameras.main.flash(400, 100, 180, 255, false);
      } else if (def?.reward === 'diamond') {
        const gem = this.diamondGroup.create(cx, cy, 'diamond').setDepth(8);
        gem.refreshBody();
        this._pulse(gem);
        this.tweens.add({ targets: gem, angle: 360, duration: 4000, repeat: -1 });
        this.st.xp += 10;
      } else if (def?.reward === 'coins3') {
        [[-10, -10],[0, 10],[10, -10]].forEach(([dx, dy]) => {
          const coin = this.coinGroup.create(cx + dx, cy + dy, 'coin').setDepth(8);
          coin.refreshBody();
          this._bob(coin, cy + dy);
          this._pulse(coin);
        });
        this.st.xp += 5;
      }

      // Remove [E] hint
      const hint = this._breakHints.find(h => h.tileR === r && h.tileC === c);
      if (hint) hint.destroy();

      // Track first wall break → unlocks boss entry corridor
      if (!this._wallBroken) {
        this._wallBroken = true;
        this._removeBossBlock();
      }

      this._updateFog(this._lastTR, this._lastTC);
      this._refreshHUD();
      return;
    }
  }

  _onCoin(yotam, coin) {
    coin.disableBody(false, false);
    this.st.coins++;
    this.st.xp += 5;
    if (this.sfxManager) { this.sfxManager.play('pickup'); } else { this._playSound('coin'); }

    // Fly-up + fade existing coin sprite
    this.tweens.add({
      targets: coin, y: coin.y - 26, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 280, ease: 'Cubic.easeOut',
      onComplete: () => coin.destroy(),
    });

    // Floating '+1' text
    const ft = this.add.text(coin.x, coin.y - 8, '+1', {
      fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#ffdd00',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(200).setScrollFactor(1);
    this.tweens.add({
      targets: ft, y: ft.y - 40, alpha: 0, duration: 500, ease: 'Cubic.easeOut',
      onComplete: () => ft.destroy(),
    });

    // Particle burst
    const pe = this.add.particles(coin.x, coin.y, 'particle_dot', {
      speed: { min: 40, max: 110 }, angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 }, lifespan: 320,
      tint: [0xffcc00, 0xffee88], emitting: false,
    }).setDepth(20);
    pe.explode(Phaser.Math.Between(4, 5));
    this.time.delayedCall(380, () => { if (pe?.active) pe.destroy(); });

    // Combo tracking
    this._trackCombo();

    // Every-5-coins milestone
    if (this.st.coins > 0 && this.st.coins % 5 === 0) {
      this.tweens.add({
        targets: this._hCoins, scaleX: 1.5, scaleY: 1.5,
        yoyo: true, duration: 110, ease: 'Back.easeOut',
      });
      this.cameras.main.flash(200, 0, 80, 255, false);
      const cx = this.cameras.main.width / 2;
      const ul = this.add.text(cx, 70, 'NEW TECH UNLOCKED 🔓', {
        fontFamily: 'Courier New, monospace', fontSize: '15px', color: '#00ccff',
        stroke: '#000000', strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 0, color: '#00aaff', blur: 12, fill: true },
      }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
      this.tweens.add({
        targets: ul, alpha: 1, duration: 250,
        onComplete: () => {
          this.time.delayedCall(1200, () => {
            this.tweens.add({ targets: ul, alpha: 0, duration: 350,
              onComplete: () => ul.destroy() });
          });
        },
      });
    }

    this._refreshHUD();
  }

  _onDiamond(yotam, gem) {
    gem.disableBody(false, false);
    this.st.diamonds++;
    this.st.xp += 30;
    this.cameras.main.flash(200, 0, 140, 200, false);
    this.sfxManager?.play('crystal_collect');
    this.sfxManager?.duckAmbience();
    this.tweens.add({
      targets: gem, y: gem.y - 36, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 380, ease: 'Cubic.easeOut',
      onComplete: () => gem.destroy(),
    });
    this._refreshHUD();
  }

  // ── fog of war ───────────────────────────────────────────────────────────────
  _updateFog(pr, pc) {
    // 1. Mark floor tiles in reveal radius as visited
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const r = pr + dr, c = pc + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (Math.sqrt(dr * dr + dc * dc) <= REVEAL_R && this.map[r][c] >= FLOOR)
          this.visited[r][c] = true;
      }
    }

    // 2. Show/hide [E] hints when adjacent
    this._breakHints.forEach(h => {
      const d = Math.abs(h.tileR - pr) + Math.abs(h.tileC - pc);
      h.setAlpha(d <= 1 ? 0.9 : 0);
    });

    // 3. Update smooth atmosphere gradient (screen-space, on tile change)
    const cam = this.cameras.main;
    const psx = Math.round(this.yotam.x - cam.scrollX);
    const psy = Math.round(this.yotam.y - cam.scrollY);
    this._updateAtmosphere(psx, psy);

    // 4. Redraw fog
    this.fogGfx.clear();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.map[r][c];
        const px = c * TILE, py = r * TILE;
        const dr = r - pr, dc = c - pc;
        const dist = Math.sqrt(dr * dr + dc * dc);

        if (dist <= REVEAL_R) continue; // fully lit — no fog

        if (cell >= FLOOR) {
          // Floor, green, breakable tile
          const alpha = this.visited[r][c] ? 0.48 : 0.97;
          this.fogGfx.fillStyle(0x010208, alpha).fillRect(px, py, TILE, TILE);
        } else if (this._edgeWall(r, c)) {
          // Wall bordering a corridor
          const neighbourVisited = [[-1,0],[1,0],[0,-1],[0,1]].some(([ddr,ddc]) => {
            const nr = r + ddr, nc = c + ddc;
            return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS
              && this.map[nr][nc] >= FLOOR && this.visited[nr][nc];
          });
          const nearPlayer = dist <= REVEAL_R + 1;
          if (!nearPlayer && !neighbourVisited) {
            this.fogGfx.fillStyle(0x010208, 0.97).fillRect(px, py, TILE, TILE);
          } else if (!nearPlayer && neighbourVisited) {
            this.fogGfx.fillStyle(0x010208, 0.48).fillRect(px, py, TILE, TILE);
          }
        }
      }
    }
  }

  // ── particles ───────────────────────────────────────────────────────────────
  _initParticles() {
    // Persistent dust emitter — one emitter reused every walk step
    this._dustEmitter = this.add.particles(0, 0, 'particle_dust', {
      speed:    { min: 12, max: 36 },
      angle:    { min: 160, max: 380 },
      scale:    { start: 0.9, end: 0 },
      alpha:    { start: 0.7, end: 0 },
      lifespan: 260,
      emitting: false,
    }).setDepth(6);
  }

  _emitDust(x, y) {
    if (!this._dustEmitter) return;
    this._dustEmitter.setPosition(x, y);
    this._dustEmitter.explode(Phaser.Math.Between(3, 4));
  }

  _emitSparks(x, y) {
    const emitter = this.add.particles(x, y, 'particle_spark', {
      speed:    { min: 60, max: 180 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.1, end: 0 },
      tint:     [0xff9900, 0xffcc00, 0xff4400],
      lifespan: 320,
      emitting: false,
    }).setDepth(18);
    emitter.explode(Phaser.Math.Between(5, 7));
    this.time.delayedCall(400, () => { if (emitter?.active) emitter.destroy(); });
  }

  // ── audio (Web Audio API placeholders) ──────────────────────────────────────
  // Replace _playSoundFile(type) with real .mp3 loading once assets exist.
  // Supported types: 'walk' | 'fire' | 'break' | 'collect'
  _initAudio() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      this._audioCtx = null;   // no audio support — silent fallback
    }
  }

  _playSound(type) {
    const ctx = this._audioCtx;
    if (!ctx) return;
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'walk':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now); osc.stop(now + 0.06);
        break;
      case 'fire':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);
        break;
      case 'break':
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now); osc.stop(now + 0.22);
        break;
      case 'collect':  // alias kept for compatibility
      case 'coin':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now); osc.stop(now + 0.09);
        break;
      case 'correct': {
        const o2c = ctx.createOscillator(); const g2c = ctx.createGain();
        o2c.connect(g2c); g2c.connect(ctx.destination);
        osc.type = 'sine'; o2c.type = 'sine';
        osc.frequency.setValueAtTime(523, now); osc.frequency.setValueAtTime(659, now + 0.08);
        o2c.frequency.setValueAtTime(784, now + 0.13);
        gain.gain.setValueAtTime(0.10, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        g2c.gain.setValueAtTime(0.0, now); g2c.gain.setValueAtTime(0.10, now + 0.12);
        g2c.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now); osc.stop(now + 0.22); o2c.start(now + 0.12); o2c.stop(now + 0.28);
        break;
      }
      case 'wrong':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.15);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
        break;
      case 'door_unlock': {
        const o3d = ctx.createOscillator(); const g3d = ctx.createGain();
        o3d.connect(g3d); g3d.connect(ctx.destination);
        osc.type = 'square'; o3d.type = 'sine';
        osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        o3d.frequency.setValueAtTime(1320, now + 0.14); o3d.frequency.exponentialRampToValueAtTime(660, now + 0.30);
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        g3d.gain.setValueAtTime(0.10, now + 0.14); g3d.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now); osc.stop(now + 0.14); o3d.start(now + 0.14); o3d.stop(now + 0.32);
        break;
      }
      case 'footstep':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        gain.gain.setValueAtTime(0.022, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now); osc.stop(now + 0.04);
        break;
      case 'radio_static': {
        // Short white-noise burst via rapid frequency modulation
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(200, now + 0.05);
        osc.frequency.setValueAtTime(1200, now + 0.12);
        osc.frequency.setValueAtTime(400, now + 0.22);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
        osc.start(now); osc.stop(now + 0.30);
        break;
      }
      case 'mine': {
        const nm = ctx.createOscillator(); const gm = ctx.createGain();
        nm.connect(gm); gm.connect(ctx.destination);
        osc.type = 'sawtooth'; nm.type = 'square';
        osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        nm.frequency.setValueAtTime(160, now); nm.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.14, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        gm.gain.setValueAtTime(0.08, now); gm.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now); osc.stop(now + 0.1); nm.start(now); nm.stop(now + 0.08);
        break;
      }
      default: return;
    }
  }

  // ── bolt spark (Part 3C) ────────────────────────────────────────────────────
  _emitBoltSparks(wx, wy) {
    const emitter = this.add.particles(wx, wy, 'particle_spark', {
      speed: { min: 30, max: 90 }, angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 }, lifespan: 160,
      tint: [0xffffff, 0xff8800], emitting: false,
    }).setDepth(9);
    emitter.explode(3);
    this.time.delayedCall(200, () => { if (emitter?.active) emitter.destroy(); });
  }

  // ── combo system ──────────────────────────────────────────────────────────────
  _trackCombo() {
    const now = this.time.now;
    this._comboHistory = (this._comboHistory ?? []).filter(t => now - t < 2000);
    this._comboHistory.push(now);
    if (this._comboHistory.length >= 3) {
      this._showCombo(this._comboHistory.length);
      this._comboHistory = [];
    }
  }

  _showCombo(n) {
    const cx = this.cameras.main.width / 2;
    const txt = this.add.text(cx, this.cameras.main.height / 2 - 60,
      'COMBO x' + n + '! ⚡',
      {
        fontFamily: 'Courier New, monospace', fontSize: '22px', color: '#00ccff',
        stroke: '#000000', strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: '#00aaff', blur: 18, fill: true },
      }
    ).setOrigin(0.5).setDepth(202).setScrollFactor(0).setAlpha(0).setScale(0.5);
    this.tweens.add({
      targets: txt, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(800, () => {
          this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 20, duration: 300,
            onComplete: () => txt.destroy() });
        });
      },
    });
    this._playSound('correct');
  }

  // ── ambient atmosphere (Part 2E) ──────────────────────────────────────────────
  // Randomly triggers a subtle effect every 10-15 s. Never interrupts gameplay.
  _startAmbience() {
    const scheduleNext = () => {
      const delay = Phaser.Math.Between(10000, 15000);
      this.time.delayedCall(delay, () => {
        if (!this.scene.isActive()) return;
        this._doAmbientEffect();
        scheduleNext();
      });
    };
    scheduleNext();
  }

  _doAmbientEffect() {
    const pick = Phaser.Math.Between(0, 2);
    if (pick === 0) this._ambientRadio();
    else if (pick === 1) this._ambientWallBlink();
    else this._ambientFloorSpark();
  }

  _ambientRadio() {
    this._playSound('radio_static');
    // Brief white-noise visual: rapid flicker on a tiny screen overlay
    const flicker = this.add.rectangle(
      this.cameras.main.width / 2, this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height,
      0xffffff, 0.03
    ).setDepth(495).setScrollFactor(0);
    let ticks = 0;
    const iv = this.time.addEvent({
      delay: 50, repeat: 6,
      callback: () => {
        flicker.setAlpha(ticks % 2 === 0 ? 0.04 : 0);
        ticks++;
        if (ticks >= 6) { flicker.destroy(); iv.destroy(); }
      },
    });
  }

  _ambientWallBlink() {
    // Flash a small neon-blue square over a random wall tile near the player
    const pr = this._lastTR ?? 17, pc = this._lastTC ?? 9;
    const candidates = [];
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const r = pr + dr, c = pc + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (this.map[r][c] === WALL) candidates.push([r, c]);
      }
    }
    if (!candidates.length) return;
    const [r, c] = candidates[Phaser.Math.Between(0, candidates.length - 1)];
    const wx = c * TILE + TILE / 2, wy = r * TILE + TILE / 2;
    const rect = this.add.rectangle(wx, wy, TILE - 4, TILE - 4, 0x0044ff, 0.0)
      .setDepth(4);
    this.tweens.add({
      targets: rect, alpha: 0.18,
      yoyo: true, duration: 120, repeat: 2,
      onComplete: () => rect.destroy(),
    });
  }

  _ambientFloorSpark() {
    // Small spark burst at a random floor tile near player
    const pr = this._lastTR ?? 17, pc = this._lastTC ?? 9;
    const candidates = [];
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        const r = pr + dr, c = pc + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (this.map[r][c] >= FLOOR) candidates.push([r, c]);
      }
    }
    if (!candidates.length) return;
    const [r, c] = candidates[Phaser.Math.Between(0, candidates.length - 1)];
    const wx = c * TILE + Phaser.Math.Between(4, TILE - 4);
    const wy = r * TILE + Phaser.Math.Between(4, TILE - 4);
    const emitter = this.add.particles(wx, wy, 'particle_spark', {
      speed: { min: 20, max: 55 }, angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 }, lifespan: 220,
      tint: [0x00aaff, 0x00ffcc], emitting: false,
    }).setDepth(8);
    emitter.explode(Phaser.Math.Between(2, 4));
    this.time.delayedCall(300, () => { if (emitter?.active) emitter.destroy(); });
  }

  // ── atmospheric lighting ─────────────────────────────────────────────────────
  _createAtmosphere() {
    const W = this.cameras.main.width;   // 480
    const H = this.cameras.main.height;  // 854

    // 1. Static vignette — radial gradient transparent center → dark edges
    if (this.textures.exists('vignette')) this.textures.remove('vignette');
    const vt = this.textures.createCanvas('vignette', W, H);
    const vc = vt.getContext();
    const vg = vc.createRadialGradient(W/2, H/2, H*0.12, W/2, H/2, H*0.65);
    vg.addColorStop(0,    'rgba(0,0,0,0)');
    vg.addColorStop(0.5,  'rgba(0,0,0,0)');
    vg.addColorStop(0.78, 'rgba(0,0,8,0.35)');
    vg.addColorStop(1,    'rgba(0,0,8,0.85)');
    vc.fillStyle = vg;
    vc.fillRect(0, 0, W, H);
    vt.refresh();
    this._vignette = this.add.image(0, 0, 'vignette')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(490);

    // 2. Dynamic light gradient — CanvasTexture updated on tile change
    if (this.textures.exists('lightGrad')) this.textures.remove('lightGrad');
    this._lightTex = this.textures.createCanvas('lightGrad', W, H);
    this._lightImg = this.add.image(0, 0, 'lightGrad')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(52);

    // Dark floor overlay — depth 0.5: above groundLayer(0), below wallLayer(1)
    const floorDark = this.add.graphics().setDepth(0.5);
    floorDark.fillStyle(0x000000, 0.15).fillRect(0, 0, WORLD_W, WORLD_H);

    // 3. Pulsing glow behind coins / collectibles
    COIN_POS.forEach(([r, c]) => {
      const gx = this.add.graphics().setDepth(7);
      gx.fillStyle(0x00b4ff, 0.18).fillCircle(c * TILE + TILE / 2, r * TILE + TILE / 2, 10);
      this.tweens.add({
        targets: gx, alpha: { from: 0.4, to: 0.85 },
        yoyo: true, repeat: -1,
        duration: 900 + Math.random() * 600,
        ease: 'Sine.easeInOut',
      });
    });
  }

  _updateAtmosphere(psx, psy) {
    if (!this._lightTex) return;
    const W = 480, H = 854;
    const R_GLOW = this._playerLightRadius ?? 140;
    const R0 = REVEAL_R * TILE * 0.65;
    const R1 = REVEAL_R * TILE * 1.25;
    const lc = this._lightTex.getContext();
    lc.clearRect(0, 0, W, H);
    // Darkness ring (existing)
    const g = lc.createRadialGradient(psx, psy, R0, psx, psy, R1);
    g.addColorStop(0,   'rgba(0,0,8,0)');
    g.addColorStop(0.6, 'rgba(0,0,8,0.12)');
    g.addColorStop(1,   'rgba(0,0,8,0.42)');
    lc.fillStyle = g;
    lc.fillRect(0, 0, W, H);
    // Cyan player glow — screen composite (no blur, canvas-safe)
    lc.globalCompositeOperation = 'screen';
    const cg = lc.createRadialGradient(psx, psy, 0, psx, psy, R_GLOW);
    cg.addColorStop(0,    'rgba(0,255,238,0.28)');
    cg.addColorStop(0.55, 'rgba(0,255,238,0.10)');
    cg.addColorStop(1,    'rgba(0,255,238,0)');
    lc.fillStyle = cg;
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'source-over';
    this._lightTex.refresh();
  }

  _addCornerShadow() {
    const W = 480, H = 854;
    if (!this.textures.exists('cornerShadow')) {
      const ct = this.textures.createCanvas('cornerShadow', W, H);
      const cc = ct.getContext();
      const cg = cc.createRadialGradient(240, 427, 0, 240, 427, 520);
      cg.addColorStop(0,    'rgba(0,0,0,0)');
      cg.addColorStop(0.55, 'rgba(0,0,0,0)');
      cg.addColorStop(1,    'rgba(0,0,0,0.35)');
      cc.fillStyle = cg;
      cc.fillRect(0, 0, W, H);
      ct.refresh();
    }
    this.add.image(0, 0, 'cornerShadow')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(53);
  }

  _addNeonGlows() {
    const isWebGL = this.game.renderer.type !== Phaser.CANVAS;
    const addGlow = (wx, wy, tint, alpha, scale) => {
      const g = this.add.image(wx, wy, 'particle_dot')
        .setTint(tint).setAlpha(alpha).setScale(scale).setDepth(9);
      if (isWebGL) g.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: g, alpha: { from: 0.15, to: 0.28 },
        duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    };
    // GREEN energy wall tiles
    [[2, 3], [2, 4]].forEach(([r, c]) => {
      addGlow(Math.round(c * TILE + TILE / 2), Math.round(r * TILE + TILE / 2), 0x00ff88, 0.20, 5);
    });
    // Diamond / jackpot crystal spawn positions
    BREAK_DEFS.forEach(({ r, c, reward }) => {
      if (reward !== 'diamond' && reward !== 'jackpot') return;
      addGlow(Math.round(c * TILE + TILE / 2), Math.round(r * TILE + TILE / 2), 0x4488ff, 0.22, 4);
    });
  }

  _addAtmosphereParticles() {
    this._ambDustEmitter = this.add.particles(0, 0, 'particle_dust', {
      speedX: { min: -15, max: 15 },
      speedY: { min: -15, max: -8 },
      alpha:  { start: 0.30, end: 0 },
      lifespan: 3000,
      gravityY: 0,
      emitting: false,
    }).setDepth(48);
    this._ambSparkEmitter = this.add.particles(0, 0, 'particle_spark', {
      speedX: { min: -40, max: 40 },
      speedY: { min: -40, max: 40 },
      alpha:  { start: 0.20, end: 0 },
      lifespan: 800,
      gravityY: 0,
      emitting: false,
    }).setDepth(48);
    this._ambParticleTimer = this.time.addEvent({
      delay: 2000,
      repeat: -1,
      callback: () => {
        if (!this.yotam?.active) return;
        const ox = Phaser.Math.Between(-60, 60);
        const oy = Phaser.Math.Between(-60, 60);
        this._ambDustEmitter.setPosition(this.yotam.x + ox, this.yotam.y + oy);
        this._ambDustEmitter.explode(1);
        if (Phaser.Math.Between(0, 3) === 0) {
          this._ambSparkEmitter.setPosition(
            this.yotam.x + Phaser.Math.Between(-80, 80),
            this.yotam.y + Phaser.Math.Between(-80, 80));
          this._ambSparkEmitter.explode(1);
        }
      },
    });
  }

  _updateDangerMusic() {
    if (!this.musicManager) return;
    if (this._snakeAlive && this._inSnakeZone) {
      this.musicManager.play('danger');
    }
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────
  _buildHUD() {
    // Background bar
    const bg = this.add.graphics().setScrollFactor(0).setDepth(99);
    bg.fillStyle(0x010810, 0.88).fillRoundedRect(4, 4, 238, 30, 4);

    const t = (x, y, txt, color) =>
      this.add.text(x, y, txt, {
        fontFamily: 'Courier New, monospace', fontSize: '15px', color,
    }).setScrollFactor(0).setDepth(100);

    this._hHearts   = t(10,  7, '❤❤❤',  '#ff3344');
    this._hCoins    = t(82,  7, '🪙 0',   '#ffdd00');
    this._hDiamonds = t(140, 7, '💎 0',   '#00ffff');
    this._hXP       = t(198, 7, '⚡0',    '#99ff44');

    // Axe icon — appears after typing gate unlocks digging
    this._hAxe = this.add.text(244, 9, '', {
      fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#ffaa33',
      shadow: { offsetX: 0, offsetY: 0, color: '#ff6600', blur: 8, fill: true },
    }).setScrollFactor(0).setDepth(100);

    this.add.text(240, 636, 'WASD/↑↓←→  |  E פריצה', {
      fontFamily: 'Courier New, monospace', fontSize: '10px', color: '#1a3050',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
  }

  _refreshHUD() {
    const { hearts, coins, diamonds, xp } = this.st;
    this._hHearts.setText('❤'.repeat(hearts) + '🖤'.repeat(3 - hearts));
    this._hCoins.setText(`🪙 ${coins}`);
    this._hDiamonds.setText(`💎 ${diamonds}`);
    this._hXP.setText(`⚡${xp}`);
    this._hAxe?.setText(this.canDig ? '⛏' : '');
  }

  // ── axe unlock sequence ──────────────────────────────────────────────────
  _showAxeUnlockSequence() {
    const cx = this.cameras.main.width / 2;
    const baseY = this.cameras.main.height / 2 - 30;
    const style = (color, size = '16px') => ({
      fontFamily: 'Courier New, monospace', fontSize: size, color,
      stroke: '#000000', strokeThickness: 3, align: 'center',
      shadow: { offsetX: 0, offsetY: 0, color, blur: 12, fill: true },
    });

    const show = (text, color, y, delay, duration = 2200) => {
      const t = this.add.text(cx, y, text, style(color))
        .setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
      this.time.delayedCall(delay, () => {
        this.tweens.add({ targets: t, alpha: 1, duration: 300,
          onComplete: () => {
            this.time.delayedCall(duration, () => {
              this.tweens.add({ targets: t, alpha: 0, duration: 400,
                onComplete: () => t.destroy() });
            });
          },
        });
      });
      return t;
    };

    show('!קיבלת חפירה ⛏', '#ffaa33', baseY,       0,    1200);
    show('!עכשיו לך שמאלה למסדרון המערבי', '#44ffcc', baseY + 30, 1400, 2000);
    show('!תמצא קיר שביר — שבור אותו',    '#ff8833', baseY + 60, 3600, 2000);

    // Pulse the axe icon in HUD
    this.time.delayedCall(300, () => {
      if (this._hAxe) {
        this.tweens.add({
          targets: this._hAxe,
          scaleX: { from: 1, to: 1.8 }, scaleY: { from: 1, to: 1.8 },
          duration: 200, yoyo: true, repeat: 4,
        });
      }
    });

    // West-pointing arrow that pulses for 4 seconds
    this.time.delayedCall(1600, () => {
      const arrow = this.add.text(cx, baseY + 100, '◄◄◄ שמאלה', {
        fontFamily: 'Courier New, monospace', fontSize: '20px', color: '#00ffcc',
        stroke: '#003322', strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: '#00ffaa', blur: 16, fill: true },
      }).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);

      this.tweens.add({ targets: arrow, alpha: 1, duration: 300 });
      this.tweens.add({
        targets: arrow, x: cx - 14,
        duration: 500, yoyo: true, repeat: 6, ease: 'Sine.easeInOut',
        onComplete: () => {
          this.tweens.add({ targets: arrow, alpha: 0, duration: 400,
            onComplete: () => arrow.destroy() });
        },
      });
    });
  }

  // ── progression blocking walls ────────────────────────────────────────────
  /**
   * Creates three invisible-from-afar but physically solid wall segments that
   * enforce the learning sequence: radio → axe (east) → break wall → boss.
   *   _radioBlockGroup — south entrance + east corridor (removed on gate_radio)
   *   _bossBlockGroup  — north dead-end entrance (removed on first wall break)
   */
  _buildProgressionBlocks() {
    this._radioBlockGroup = this.physics.add.staticGroup();
    this._bossBlockGroup  = this.physics.add.staticGroup();
    // NOTE: colliders against this.yotam are wired in _addProgressionColliders()
    // which is called after this.yotam is created.

    // ── South room entrance (r=20, c=8–11) — four tiles across ──
    this._southBlockGfx = this.add.graphics().setDepth(2);
    this._southBodies   = [];
    for (let c = 8; c <= 11; c++) {
      const px = c * TILE, py = 20 * TILE;
      this._drawBlockWall(this._southBlockGfx, px, py);
      this._southBodies.push(this._wallBody(px, py, this._radioBlockGroup));
    }

    // ── Boss entry corridor (r=5, c=3–4) — two tiles wide ──
    this._bossBlockGfx = this.add.graphics().setDepth(2);
    this._bossBodies   = [];
    for (let c = 3; c <= 4; c++) {
      const px = c * TILE, py = 5 * TILE;
      this._drawBlockWall(this._bossBlockGfx, px, py);
      this._bossBodies.push(this._wallBody(px, py, this._bossBlockGroup));
    }
    // gate_boss decommissioned — glitch_final is now the final gate at [4,8]
    this._bossBodies.forEach(b => { b.enable = false; });
    this._bossBlockGroup.setActive(false).setVisible(false);
    this._bossBlockGfx.setVisible(false);

    // ── Corridor 2 entry blocker (r=12, c=13-14) — two tiles, event-gated ─────
    // Opens after NE Arm event (color_01) completes.
    // After open, permanent return blockers placed at [r=15, c=13-14].
    this._corridor2BlockGroup = this.physics.add.staticGroup();
    this._corridor2EntryGfx   = this.add.graphics().setDepth(2);
    this._corridor2EntryBodies = [];
    for (let c = 13; c <= 14; c++) {
      const px = c * TILE, py = 12 * TILE;
      this._drawBlockWall(this._corridor2EntryGfx, px, py);
      this._corridor2EntryBodies.push(this._wallBody(px, py, this._corridor2BlockGroup));
    }

    // ── Corridor 1 entry blocker (r=4, c=5) — one tile, event-gated ──────────
    // Opens after NW Branch (mimic_01) completes.
    // After open, a permanent return blocker is placed at [r=9, c=11].
    this._corridor1BlockGroup = this.physics.add.staticGroup();
    this._corridor1EntryGfx   = this.add.graphics().setDepth(2);
    this._corridor1EntryBody  = null;
    {
      const px = 5 * TILE, py = 4 * TILE;
      this._drawBlockWall(this._corridor1EntryGfx, px, py);
      this._corridor1EntryBody = this._wallBody(px, py, this._corridor1BlockGroup);
    }
  }

  /** Called after this.yotam exists — wires colliders for progression blocks */
  _addProgressionColliders() {
    this.physics.add.collider(this.yotam, this._radioBlockGroup, () => {
      if (this._blockMsgCooldown) return;
      this._blockMsgCooldown = true;
      this.time.delayedCall(2500, () => { this._blockMsgCooldown = false; });
    });
    this.physics.add.collider(this.yotam, this._bossBlockGroup, () => {
      if (this._blockMsgCooldown) return;
      this._blockMsgCooldown = true;
      const msg = !this.canDig
        ? '!מצא את הגרזן קודם — לך מזרחה'
        : '!שבור קיר שביר קודם — לך מערבה';
      this._showFloatMsg(msg, '#ff8833');
      this.time.delayedCall(2500, () => { this._blockMsgCooldown = false; });
    });
    this.physics.add.collider(this.yotam, this._corridor1BlockGroup, () => {
      if (this._blockMsgCooldown) return;
      this._blockMsgCooldown = true;
      this._showFloatMsg('!פתח את הארגז המסתורי קודם', '#ff8833');
      this.time.delayedCall(2500, () => { this._blockMsgCooldown = false; });
    });
    this.physics.add.collider(this.yotam, this._corridor2BlockGroup, () => {
      if (this._blockMsgCooldown) return;
      this._blockMsgCooldown = true;
      this._showFloatMsg('!השלם את משימת הלייזר קודם', '#ff8833');
      this.time.delayedCall(2500, () => { this._blockMsgCooldown = false; });
    });
  }

  _drawBlockWall(g, px, py) {
    // Same style as regular dark wall tile
    g.fillStyle(0x040810, 1).fillRect(px, py, TILE, TILE);
    g.lineStyle(1, 0x091828, 0.5).strokeRect(px, py, TILE, TILE);
  }

  /** Remove south + east blocks after gate_radio completes */
  _removeRadioBlocks() {
    this.cameras.main.flash(350, 0, 160, 80, false);

    // Destroy physics bodies
    [...(this._southBodies ?? []), ...(this._eastBodies ?? [])].forEach(b => {
      this._radioBlockGroup?.remove(b, true, true);
    });
    this._southBodies = [];
    this._eastBodies  = [];

    // Fade out graphics
    [this._southBlockGfx, this._eastBlockGfx].forEach(g => {
      if (!g || !g.active) return;
      this.tweens.add({
        targets: g, alpha: 0, duration: 500,
        onComplete: () => g.destroy(),
      });
    });

    this._showFloatMsg('!המסלול נפתח — לך ימינה למזרח', '#44ffcc');
  }

  /** Remove boss entry block after first wall is broken (canDig is guaranteed true by then) */
  _removeBossBlock() {
    this.cameras.main.flash(350, 100, 0, 200, false);

    (this._bossBodies ?? []).forEach(b => {
      this._bossBlockGroup?.remove(b, true, true);
    });
    this._bossBodies = [];

    if (this._bossBlockGfx?.active) {
      this.tweens.add({
        targets: this._bossBlockGfx, alpha: 0, duration: 500,
        onComplete: () => this._bossBlockGfx.destroy(),
      });
    }

  }

  /** Open Corridor 1 after mimic_01: remove entry blocker, seal return at [r=9,c=11] */
  _openCorridor1Gate() {
    this.cameras.main.flash(350, 0, 200, 120, false);

    // Remove entry blocker (r=4, c=5)
    if (this._corridor1EntryBody) {
      this._corridor1BlockGroup?.remove(this._corridor1EntryBody, true, true);
      this._corridor1EntryBody = null;
    }
    if (this._corridor1EntryGfx?.active) {
      this.tweens.add({
        targets: this._corridor1EntryGfx, alpha: 0, duration: 500,
        onComplete: () => this._corridor1EntryGfx?.destroy(),
      });
    }

    // Place permanent return blocker at [r=9, c=11] — no removal ever
    this._corridor1ReturnGroup = this.physics.add.staticGroup();
    this._corridor1ReturnGfx   = this.add.graphics().setDepth(2);
    {
      const px = 11 * TILE, py = 9 * TILE;
      this._drawBlockWall(this._corridor1ReturnGfx, px, py);
      this._wallBody(px, py, this._corridor1ReturnGroup);
    }
    this.physics.add.collider(this.yotam, this._corridor1ReturnGroup, () => {
      if (this._blockMsgCooldown) return;
      this._blockMsgCooldown = true;
      this._showFloatMsg('!אין חזרה — המסלול חד-כיווני', '#ff4444');
      this.time.delayedCall(2500, () => { this._blockMsgCooldown = false; });
    });

  }

  /** Open Corridor 2 after color_01: remove entry blockers [r=12,c=13-14], seal return at [r=15,c=13-14] */
  _openCorridor2Gate() {
    this.cameras.main.flash(350, 0, 180, 255, false);

    // Remove entry blockers (r=12, c=13-14)
    (this._corridor2EntryBodies ?? []).forEach(b => {
      this._corridor2BlockGroup?.remove(b, true, true);
    });
    this._corridor2EntryBodies = [];
    if (this._corridor2EntryGfx?.active) {
      this.tweens.add({
        targets: this._corridor2EntryGfx, alpha: 0, duration: 500,
        onComplete: () => this._corridor2EntryGfx?.destroy(),
      });
    }

    // Place permanent return blockers at [r=15, c=13-14] — no removal ever
    this._corridor2ReturnGroup = this.physics.add.staticGroup();
    this._corridor2ReturnGfx   = this.add.graphics().setDepth(2);
    for (let c = 13; c <= 14; c++) {
      const px = c * TILE, py = 15 * TILE;
      this._drawBlockWall(this._corridor2ReturnGfx, px, py);
      this._wallBody(px, py, this._corridor2ReturnGroup);
    }
    this.physics.add.collider(this.yotam, this._corridor2ReturnGroup, () => {
      if (this._blockMsgCooldown) return;
      this._blockMsgCooldown = true;
      this._showFloatMsg('!אין חזרה — המסלול חד-כיווני', '#ff4444');
      this.time.delayedCall(2500, () => { this._blockMsgCooldown = false; });
    });

    this._showFloatMsg('!המסלול נפתח — המשך דרומה', '#44ffcc');
  }

  // ── floating message helper ───────────────────────────────────────────────
  _showFloatMsg(text, color = '#ffffff') {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2 + 60;
    const t = this.add.text(cx, cy, text, {
      fontFamily: 'Courier New, monospace', fontSize: '13px', color,
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, duration: 300, yoyo: false,
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({ targets: t, alpha: 0, duration: 500,
            onComplete: () => t.destroy() });
        });
      },
    });
  }

  // ── tween helpers ────────────────────────────────────────────────────────────
  _bob(obj, baseY) {
    this.tweens.add({
      targets: obj, y: baseY - 5,
      duration: 700 + Math.random() * 400, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', delay: Math.random() * 600,
    });
  }

  _pulse(obj) {
    this.tweens.add({
      targets: obj,
      alpha: { from: 0.72, to: 1 },
      scaleX: { from: 0.88, to: 1.12 },
      scaleY: { from: 0.88, to: 1.12 },
      duration: 420 + Math.random() * 280, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', delay: Math.random() * 400,
    });
  }

  pausePlayerInput() {
    this.playerInputPaused = true;
  }

  resumePlayerInput() {
    this.playerInputPaused = false;
  }

  // ── scene lifecycle ───────────────────────────────────────────────────────────
  // ── scene lifecycle ───────────────────────────────────────────────────────────
  _onIntroStart(_e) {
    const done = () => this.eventMgr?.markComplete('intro_story');
    const safety = this.time.delayedCall(30000, done);
    const audio = new Audio(_mp3_intro);
    audio.onended = () => { safety.remove(); done(); };
    audio.onerror = () => { safety.remove(); done(); };
    const tryPlay = () => {
      audio.play()
        .then(() => {})
        .catch(() => { safety.remove(); done(); });
    };

    if (document.body.getAttribute('data-user-touched') === 'true') {
      tryPlay();
    } else {
      document.body.addEventListener('touchstart', tryPlay, { once: true });
    }
  }

  shutdown() {
    window.removeEventListener('yotam:shake',         this._onShakeHandler);
    window.removeEventListener('yotam:gate:answered', this._onGateAnsweredHandler);
    window.removeEventListener('yotam:juice',         this._onJuiceHandler);
    window.removeEventListener('yotam:gate:blocked',  this._onGateBlockedHandler);
    window.removeEventListener('yotam:gate:open',     this._onGateOpenHandler);
    window.removeEventListener('yotam:intro:start',   this._onIntroStartHandler);
    this.virtCtrl?.destroy();
    if (this.textures.exists('vignette'))     this.textures.remove('vignette');
    if (this.textures.exists('lightGrad'))    this.textures.remove('lightGrad');
    if (this.textures.exists('cornerShadow')) this.textures.remove('cornerShadow');
    if (this._ambParticleTimer) { this._ambParticleTimer.remove(false); this._ambParticleTimer = null; }
    this._ambDustEmitter?.destroy();
    this._ambSparkEmitter?.destroy();
    this.musicManager?.destroy();
    this.sfxManager?.destroy();
  }

  // ── enemy spawning & respawn ──────────────────────────────────────────────────
  _spawnSnake() {
    // Remove any destroyed/dead snakes still in the group
    this.snakeGroup.getChildren()
      .filter(s => !s.active || s._dead)
      .forEach(s => { s._hpBar?.destroy(); this.snakeGroup.remove(s, true, true); });

    const snake = new CyberSnake(this, SNAKE_SPAWN.x, SNAKE_SPAWN.y, SNAKE_PATROL);
    this.snakeGroup.add(snake);
    this._snakeAlive = true;
  }

  _checkSnakeRespawn(tr, tc) {
    const inZone = tr >= SNAKE_ZONE.rMin && tr <= SNAKE_ZONE.rMax &&
                   tc >= SNAKE_ZONE.cMin && tc <= SNAKE_ZONE.cMax;

    if (!this._snakeAlive && this._snakeEverKilled) {
      if (!inZone) {
        this._snakeLeftZone = true;           // player left after kill
      } else if (this._snakeLeftZone) {
        this._spawnSnake();                   // player returned → respawn
        this._snakeLeftZone = false;
        this._snakeEverKilled = false;
      }
    }
    this._inSnakeZone = inZone;
  }

  // ── weapons ──────────────────────────────────────────────────────────────────
  _tryFire(time) {
    if (time - this._lastFireTime < 500) return;
    this._lastFireTime = time;

    const angle = this._lastFaceAngle;
    const ox = this.yotam.x + Math.cos(angle) * 18;
    const oy = this.yotam.y + Math.sin(angle) * 18;

    const bolt = this.bolts.create(ox, oy, 'neonBolt');
    if (!bolt) return;

    bolt.setDepth(12).setRotation(angle + Math.PI / 2);
    bolt.body.setAllowGravity(false);
    bolt.setVelocity(Math.cos(angle) * 420, Math.sin(angle) * 420);

    // Auto-destroy after 1.5 s (if no wall hit)
    this.time.delayedCall(1500, () => { if (bolt.active) bolt.destroy(); });

    this.cameras.main.shake(100, 0.003);
    this._playSound('fire');

    // Shoot animation flash (350 ms)
    if (this.textures.exists('yotam_sheet')) {
      // Face the shot direction (flip only for shoot since we have one shoot row)
      if (Math.cos(angle) < -0.2)      { this.yotam.setFlipX(true);  this._yotamFacing = -1; this._lastDir = 'left'; }
      else if (Math.cos(angle) > 0.2)  { this.yotam.setFlipX(false); this._yotamFacing =  1; this._lastDir = 'right'; }
      this._yotamShooting = true;
      this.yotam.anims.play('yotam_shoot', true);
      this.time.delayedCall(350, () => {
        this._yotamShooting = false;
        this.yotam.setFlipX(false); // reset flip after shoot
      });
    }
  }

  _trySword(time) {
    if (time - this._lastSwordTime < 800) return;
    this._lastSwordTime = time;

    const angle = this._lastFaceAngle;
    const slashX = this.yotam.x + Math.cos(angle) * 44;
    const slashY = this.yotam.y + Math.sin(angle) * 44;

    // Slash arc visual
    const gfx = this.add.graphics().setDepth(15);
    gfx.lineStyle(4, 0x00ffff, 0.9);
    gfx.beginPath();
    gfx.arc(this.yotam.x, this.yotam.y, 44, angle - 0.75, angle + 0.75, false);
    gfx.strokePath();
    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.beginPath();
    gfx.arc(this.yotam.x, this.yotam.y, 40, angle - 0.5, angle + 0.5, false);
    gfx.strokePath();

    this.tweens.add({
      targets: gfx, alpha: 0, duration: 220,
      onComplete: () => gfx.destroy(),
    });

    // Hit detection — check every live enemy within slash reach
    this.snakeGroup.getChildren().forEach(snake => {
      if (!snake.active || snake._dead) return;
      const dist = Phaser.Math.Distance.Between(slashX, slashY, snake.x, snake.y);
      if (dist < 58) this._hitEnemy(snake, 1);
    });

    this.cameras.main.shake(70, 0.004);
  }

  // ── combat feedback ────────────────────────────────────────────────────────
  _hitEnemy(snake, damage) {
    if (!snake || snake._dead) return;
    const killed = snake.hit(damage);
    this.cameras.main.shake(100, 0.005);

    if (killed) {
      this.st.xp += 10;
      this._refreshHUD();
      this._snakeAlive      = false;
      this._snakeEverKilled = true;

      // Drop a coin at death location
      try {
        const coin = this.coinGroup.create(snake.x, snake.y + 8, 'coin');
        if (coin) {
          coin.setDepth(8).refreshBody();
          this._bob(coin, coin.y);
          this._pulse(coin);
        }
      } catch (_) {}

      this.cameras.main.flash(250, 0, 180, 100, false);
      this.musicManager?.scheduleReturn(3000);

    }
  }

  _yotamHit() {
    if (this._yotamInvincible || this.st.hearts <= 0) return;
    this._yotamInvincible = true;

    this.st.hearts = Math.max(0, this.st.hearts - 1);
    this._refreshHUD();

    // Red screen flash + shake
    this.cameras.main.flash(320, 200, 0, 0, false);
    this.cameras.main.shake(220, 0.009);

    // Yotam blink for 1.2 s
    this.tweens.add({
      targets:  this.yotam,
      alpha:    { from: 1, to: 0.25 },
      duration: 100,
      yoyo:     true,
      repeat:   6,
      onComplete: () => {
        this.yotam.setAlpha(1);
        this._yotamInvincible = false;
      },
    });

    if (this.st.hearts <= 0) this._gameOver();
  }

  _gameOver() {
    this.time.delayedCall(600, () => {
      this.cameras.main.fadeOut(700, 20, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.virtCtrl?.destroy();
        this.scene.restart();
      });
    });
  }
  // ── learning gate handlers ────────────────────────────────────────────────────
  _onShake(e) {
    const strength = e.detail?.strength ?? 0.008;
    this.cameras.main.shake(200, strength);
  }

  _onGateAnswered(e) {
    const { eventId, correct, reward } = e.detail ?? {};
    if (!eventId) return;

    if (correct) {
      this.eventMgr.markComplete(eventId);
      const _evt = this.eventMgr.events.find(e => e.event_id === eventId);
      if (_evt?.type === 'typing_gate' || _evt?.type === 'read_aloud_gate') {
        setTimeout(() => this.resumePlayerInput(), 1800);
      }
      if (reward?.xp) {
        this.st.xp += reward.xp;
        this._refreshHUD();
        // Float XP gain above screen centre
        this._showJuiceText(`+${reward.xp} XP ⚡`, '#88ff44');
      }

      // Radio completed → open south + east paths
      if (eventId === 'gate_radio') this._removeRadioBlocks();

      // NW Branch (mimic chest) completed → open Corridor 1 entry, seal return
      if (eventId === 'mimic_01') this._openCorridor1Gate();

      // NE Arm (color laser) completed → open Corridor 2 entry, seal return
      if (eventId === 'color_01') this._openCorridor2Gate();

      // Shovel unlocked — read_aloud_gate completed
      if (eventId === 'gate_chest_typing') {
        const _cEvt = this.eventMgr.events.find(ev => ev.event_id === 'gate_chest_typing');
        if (_cEvt?.success_says && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const _utt = new SpeechSynthesisUtterance(_cEvt.success_says);
          _utt.lang = 'he-IL'; _utt.rate = 0.8; _utt.pitch = 0.9;
          const _hv = window.speechSynthesis.getVoices().find(v => v.lang?.startsWith('he'));
          if (_hv) _utt.voice = _hv;
          window.speechSynthesis.speak(_utt);
        }
        this.canDig = true;
        console.log('[YQ-DEBUG] Shovel unlocked — canDig set to TRUE');
        this._refreshHUD();
        this.virtCtrl?.showDig();
        this._showAxeUnlockSequence();
      }

      if (eventId === 'gate_boss') this._launchBossScene();

      if (eventId === 'glitch_final') {
        const _gf = this.eventMgr.events.find(e => e.event_id === 'glitch_final');
        const onComplete = _gf?.on_complete ?? {};
        let launched = false;
        let safetyTimer;
        const launch = () => {
          if (launched) return;
          launched = true;
          safetyTimer?.remove();
          const delay = onComplete.delay_ms ?? 2000;
          this.time.delayedCall(delay, () => this._launchBossScene());
        };
        if (onComplete.robot_says && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(onComplete.robot_says);
          utt.lang = 'he-IL'; utt.rate = 0.8; utt.pitch = 0.9;
          const heVoice = window.speechSynthesis.getVoices().find(v => v.lang?.startsWith('he'));
          if (heVoice) utt.voice = heVoice;
          utt.onerror = launch;
          utt.onend = launch;
          window.speechSynthesis.speak(utt);
        } else {
          launch();
        }
        safetyTimer = this.time.delayedCall(8000, launch);
      }
    } else {
      this.eventMgr.allowRetry(eventId);
    }
  }

  _onJuice(e) {
    const { type, attempt } = e.detail ?? {};

    if (type === 'correct') {
      this.cameras.main.flash(200, 0, 255, 150);
      this.cameras.main.shake(80, 0.002);

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

      this._showJuiceText('!קוד מפוענח', '#00ffff');

    } else if (type === 'wrong') {
      if (attempt <= 1) {
        this.cameras.main.shake(300, 0.012);
        this._showJuiceText('שיבוש בקשר — נסה שוב', '#ff8800');
      } else {
        this.cameras.main.shake(500, 0.025);

        const overlay = this.add.rectangle(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2,
          this.cameras.main.width,
          this.cameras.main.height,
          0xff0000, 0.25,
        ).setDepth(9998).setScrollFactor(0);
        this.tweens.add({
          targets: overlay, alpha: 0, duration: 400,
          onComplete: () => overlay.destroy(),
        });

        this._showJuiceText('...הקוד נפרץ חלקית', '#ff0044');
      }
    }
  }

  _showJuiceText(text, color = '#00ffff') {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2 - 20;
    const t = this.add.text(cx, cy, text, {
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
      duration: 1200,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  _onGateOpen(e) {
    if (e.detail?.type === 'typing_gate' || e.detail?.type === 'read_aloud_gate') {
      this.pausePlayerInput();
    }
  }

  _onGateBlocked(e) {
    const msg = e.detail?.message || 'המערכת עדיין נעולה';
    this._showBlockedMessage(msg);
  }

  _showBlockedMessage(msg) {
    if (!this.yotam?.active) return;
    const t = this.add.text(this.yotam.x, this.yotam.y - 48, msg, {
      fontFamily: 'monospace',
      fontSize:   '14px',
      color:      '#ffaa33',
      stroke:     '#000000',
      strokeThickness: 3,
      align:      'center',
      wordWrap:   { width: 220 },
    }).setDepth(300).setOrigin(0.5);
    this.tweens.add({
      targets:  t,
      y:        this.yotam.y - 100,
      alpha:    0,
      duration: 2000,
      ease:     'Power2',
      onComplete: () => t.destroy(),
    });
  }

  _launchBossScene() {
    this.cameras.main.fadeOut(700, 2, 8, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.virtCtrl?.destroy();
      this.scene.start('BossScene', {
        hearts:   this.st.hearts,
        xp:       this.st.xp,
        coins:    this.st.coins,
        diamonds: this.st.diamonds,
      });
    });
  }

}
/**
 * VirtualControls — image-based touch joystick + action buttons.
 * Assets loaded from public/assets/ui/ (joy-base, joy-thumb, btn-gun/sword/axe).
 * Same public API as the procedural version: getJoy(), consumeFire(),
 * consumeSword(), consumeDig(), showDig(), destroy().
 *
 * All button/joystick positions are anchored relative to the actual canvas
 * dimensions (scene.cameras.main.width / .height) so the layout works on any
 * screen — no black bars on tall phones.
 */

const JOY_BASE_D  = 140;   // display diameter of base ring (forced 1:1)
const JOY_THUMB_D =  70;   // display diameter of thumb nub (forced 1:1)
const JOY_MAX_R   =  46;   // max thumb travel radius
const BTN_D       =  90;   // button display size (forced 1:1)

// Left-half bottom zone for joystick (X limit is fixed; Y limit is relative)
const JOY_ZONE_X_MAX = 220;

export default class VirtualControls {
  constructor(scene) {
    this.scene = scene;

    // Derive button layout from actual canvas size
    const W = scene.cameras.main.width;    // 480 always
    const H = scene.cameras.main.height;   // 640 on desktop, ~850+ on tall phones

    // ── Hard-maths layout ──────────────────────────────────────────────────
    // BTM = 34px iOS home indicator + 46px breathing room = 80px clearance
    // Every control's BOTTOM EDGE must be >= BTM px above the canvas bottom.
    const BTM   = 80;               // minimum gap from canvas bottom (px)
    const R     = JOY_BASE_D / 2;  // joystick outer radius = 70
    const BTN_R = BTN_D      / 2;  // action-button radius  = 45

    // ── Joystick — left side, bottom-anchored ─────────────────────────────
    this.joyOriginX = R + 30;          // 100  — clears left edge by 30px
    this.joyOriginY = H - R - BTM;    // 704  — bottom edge at 774, gap = 80

    console.log({ R, centerY: this.joyOriginY, canvasHeight: H,
                  gap: H - this.joyOriginY - R });  // gap MUST be >= 80

    // Touch zone: left half, starts 170px above joystick centre
    this._joyZoneYMin = this.joyOriginY - 170;  // 534

    // ── Action buttons — right side, bottom-anchored (same BTM clearance) ─
    const btnBotY = H - BTN_R - BTM;          // 729 — bottom btn centre
    const btnTopY = btnBotY - BTN_D - 10;     // 629 — top btn centre (100px up)

    this._fireCfg  = { x: W - 58,  y: btnTopY, r: 42 };  // gun  (top)
    this._swordCfg = { x: W - 58,  y: btnBotY, r: 42 };  // sword (bottom)
    this._digCfg   = { x: W - 152, y: btnBotY, r: 38 };  // axe   (left of sword)

    // Joystick state
    this.joyVx      = 0;
    this.joyVy      = 0;

    // Button state
    this.firePtr       = null;
    this.swordPtr      = null;
    this.digPtr        = null;
    this.fireJustDown  = false;
    this.swordJustDown = false;
    this.digJustDown   = false;
    this._digVisible   = false;

    scene.input.addPointer(3);
    this._buildSprites();
    this._bindEvents();
  }

  /* ─── build image sprites ─────────────────────────────────────────────── */
  _buildSprites() {
    const s = this.scene;
    const D = 2000;

    const useImg = (key) => s.textures.exists(key);

    // ── Joystick ──────────────────────────────────────────────────────────
    if (useImg('joy-base')) {
      // Image is 600x400 — crop centre 400x400 square so circle renders round
      this.joyBaseImg = s.add.image(this.joyOriginX, this.joyOriginY, 'joy-base')
        .setCrop(100, 0, 400, 400)
        .setDisplaySize(JOY_BASE_D, JOY_BASE_D)
        .setAlpha(0.72).setScrollFactor(0).setDepth(D);
    } else {
      this.joyBaseGfx = s.add.graphics().setScrollFactor(0).setDepth(D);
      this._drawFallbackBase(this.joyOriginX, this.joyOriginY, false);
    }

    if (useImg('joy-thumb')) {
      // Image is 600x380 — crop centre 380x380 square so thumb renders round
      this.joyThumbImg = s.add.image(this.joyOriginX, this.joyOriginY, 'joy-thumb')
        .setCrop(110, 0, 380, 380)
        .setDisplaySize(JOY_THUMB_D, JOY_THUMB_D)
        .setAlpha(0.9).setScrollFactor(0).setDepth(D + 1);
    } else {
      this.joyThumbGfx = s.add.graphics().setScrollFactor(0).setDepth(D + 1);
      this._drawFallbackThumb(this.joyOriginX, this.joyOriginY, 0, 0);
    }

    // ── Action buttons ────────────────────────────────────────────────────
    this.fireImg  = this._makeBtn('btn-gun',   'btn-gun-press',   this._fireCfg,  D);
    this.swordImg = this._makeBtn('btn-sword', 'btn-sword-press', this._swordCfg, D);
    this.digImg   = this._makeBtn('btn-axe',   'btn-axe-press',   this._digCfg,   D);

    // Dig button hidden until axe unlocked
    if (this.digImg) this.digImg.setAlpha(0);
  }

  _makeBtn(idleKey, pressKey, cfg, depth) {
    const s = this.scene;
    if (!s.textures.exists(idleKey)) return null;
    const img = s.add.image(cfg.x, cfg.y, idleKey)
      .setDisplaySize(BTN_D, BTN_D)
      .setAlpha(0.88).setScrollFactor(0).setDepth(depth);
    img._idleKey  = idleKey;
    img._pressKey = s.textures.exists(pressKey) ? pressKey : idleKey;
    return img;
  }

  /* ─── press / release visuals ─────────────────────────────────────────── */
  _pressBtn(img) {
    if (!img) return;
    img.setTexture(img._pressKey);
    // displayWidth/Height targets BTN_D units — safe regardless of the PNG's
    // natural pixel size (scaleX:0.82 absolute would have grown the ~300px PNG huge).
    this.scene.tweens.add({
      targets: img,
      displayWidth:  BTN_D * 0.82,
      displayHeight: BTN_D * 0.82,
      duration: 80, ease: 'Power2',
    });
  }

  _releaseBtn(img) {
    if (!img) return;
    img.setTexture(img._idleKey);
    this.scene.tweens.add({
      targets: img,
      displayWidth:  BTN_D,
      displayHeight: BTN_D,
      duration: 140, ease: 'Elastic.easeOut',
    });
  }

  /* ─── joystick visuals ────────────────────────────────────────────────── */
  _moveJoyBase(cx, cy) {
    if (this.joyBaseImg) this.joyBaseImg.setPosition(cx, cy);
    else if (this.joyBaseGfx) { this.joyBaseGfx.clear(); this._drawFallbackBase(cx, cy, true); }
  }

  _moveJoyThumb(cx, cy, dx, dy) {
    const tx = cx + dx, ty = cy + dy;
    if (this.joyThumbImg) this.joyThumbImg.setPosition(tx, ty);
    else if (this.joyThumbGfx) { this.joyThumbGfx.clear(); this._drawFallbackThumb(cx, cy, dx, dy); }
  }

  _resetJoyThumb() {
    this._moveJoyThumb(this.joyOriginX, this.joyOriginY, 0, 0);
    if (this.joyBaseImg) this.joyBaseImg.setAlpha(0.72);
  }

  /* ─── procedural fallbacks (if images fail to load) ─────────────────── */
  _drawFallbackBase(cx, cy) {
    const g = this.joyBaseGfx; if (!g) return;
    g.fillStyle(0x001a33, 0.45).fillCircle(cx, cy, 60);
    g.lineStyle(2, 0x0088cc, 0.6).strokeCircle(cx, cy, 60);
  }

  _drawFallbackThumb(cx, cy, dx, dy) {
    const g = this.joyThumbGfx; if (!g) return;
    const tx = cx + dx, ty = cy + dy;
    g.fillStyle(0x0099dd, 0.85).fillCircle(tx, ty, 24);
    g.lineStyle(2, 0x00ccff, 0.8).strokeCircle(tx, ty, 24);
  }

  /* ─── input binding ───────────────────────────────────────────────────── */
  _bindEvents() {
    const inp = this.scene.input;
    this._dnFn  = (p) => this._onDown(p);
    this._mvFn  = (p) => this._onMove(p);
    this._upFn  = (p) => this._onUp(p);
    inp.on('pointerdown',      this._dnFn);
    inp.on('pointermove',      this._mvFn);
    inp.on('pointerup',        this._upFn);
    inp.on('pointerupoutside', this._upFn);
  }

  _inJoyZone(px, py) { return px < JOY_ZONE_X_MAX && py > this._joyZoneYMin; }
  _inBtn(px, py, cfg) { return Math.hypot(px - cfg.x, py - cfg.y) <= cfg.r * 1.35; }

  _onDown(ptr) {
    const { x, y } = ptr;
    if (!this.firePtr && this._inBtn(x, y, this._fireCfg)) {
      this.firePtr = ptr; this.fireJustDown = true;
      this._pressBtn(this.fireImg);
    } else if (!this.swordPtr && this._inBtn(x, y, this._swordCfg)) {
      this.swordPtr = ptr; this.swordJustDown = true;
      this._pressBtn(this.swordImg);
    } else if (this._digVisible && !this.digPtr && this._inBtn(x, y, this._digCfg)) {
      this.digPtr = ptr; this.digJustDown = true;
      this._pressBtn(this.digImg);
    } else if (!this.joyPtr && this._inJoyZone(x, y)) {
      this.joyPtr     = ptr;
      this.joyOriginX = x;
      this.joyOriginY = y;
      this._moveJoyBase(x, y);
      this._moveJoyThumb(x, y, 0, 0);
      if (this.joyBaseImg) this.joyBaseImg.setAlpha(1);
    }
  }

  _onMove(ptr) {
    if (ptr !== this.joyPtr) return;
    const dx   = ptr.x - this.joyOriginX;
    const dy   = ptr.y - this.joyOriginY;
    const dist = Math.hypot(dx, dy);
    const clamp = Math.min(dist, JOY_MAX_R);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    this.joyVx = nx * (clamp / JOY_MAX_R);
    this.joyVy = ny * (clamp / JOY_MAX_R);
    this._moveJoyThumb(this.joyOriginX, this.joyOriginY, nx * clamp, ny * clamp);
  }

  _onUp(ptr) {
    if (ptr === this.joyPtr) {
      this.joyPtr = null; this.joyVx = 0; this.joyVy = 0;
      this._moveJoyThumb(this.joyOriginX, this.joyOriginY, 0, 0);
      this._resetJoyThumb();
    }
    if (ptr === this.firePtr)  { this.firePtr  = null; this._releaseBtn(this.fireImg); }
    if (ptr === this.swordPtr) { this.swordPtr = null; this._releaseBtn(this.swordImg); }
    if (ptr === this.digPtr)   { this.digPtr   = null; this._releaseBtn(this.digImg); }
  }

  /* ─── public API ──────────────────────────────────────────────────────── */
  getJoy() { return { vx: this.joyVx, vy: this.joyVy }; }

  consumeFire()  { if (this.fireJustDown)  { this.fireJustDown  = false; return true; } return false; }
  consumeSword() { if (this.swordJustDown) { this.swordJustDown = false; return true; } return false; }
  consumeDig()   { if (this.digJustDown)   { this.digJustDown   = false; return true; } return false; }

  /** Reveal the dig/axe button when the axe is unlocked */
  showDig() {
    this._digVisible = true;
    if (this.digImg) {
      this.digImg.setAlpha(0);
      this.scene.tweens.add({ targets: this.digImg, alpha: 0.88, duration: 400, ease: 'Cubic.easeOut' });
    }
  }

  destroy() {
    const inp = this.scene.input;
    inp.off('pointerdown',      this._dnFn);
    inp.off('pointermove',      this._mvFn);
    inp.off('pointerup',        this._upFn);
    inp.off('pointerupoutside', this._upFn);
    [
      this.joyBaseImg, this.joyThumbImg,
      this.joyBaseGfx, this.joyThumbGfx,
      this.fireImg, this.swordImg, this.digImg,
    ].forEach(o => o?.destroy());
  }
}

import { readFileSync, writeFileSync } from 'fs';
const f = 'C:/Projects/Claude proj/yotamquesT/src/game/scenes/MazeScene.js';
let s = readFileSync(f, 'utf8');

// ── 1. Bolt-wall collider → emit sparks before destroy ───────────────────────
const OLD_BOLT = `    this.physics.add.collider(this.bolts, this.wallLayer, (b) => b.destroy());`;
const NEW_BOLT = `    this.physics.add.collider(this.bolts, this.wallLayer, (b) => { this._emitBoltSparks(b.x, b.y); b.destroy(); });`;
if (!s.includes(OLD_BOLT)) { console.error('OLD_BOLT not found'); process.exit(1); }
s = s.replace(OLD_BOLT, NEW_BOLT);
console.log('✓ bolt-wall collider wired to _emitBoltSparks');

// ── 2. _emitBoltSparks method — insert before combo system ───────────────────
const SPARKS_BEFORE = '  // ── combo system ──────────────────────────────────────────────────────────────';
if (!s.includes(SPARKS_BEFORE)) { console.error('SPARKS_BEFORE not found'); process.exit(1); }
const SPARKS_METHOD = [
  `  // ── bolt spark (Part 3C) ────────────────────────────────────────────────────`,
  `  _emitBoltSparks(wx, wy) {`,
  `    const emitter = this.add.particles(wx, wy, 'particle_spark', {`,
  `      speed: { min: 30, max: 90 }, angle: { min: 0, max: 360 },`,
  `      scale: { start: 0.5, end: 0 }, lifespan: 160,`,
  `      tint: [0xffffff, 0xff8800], emitting: false,`,
  `    }).setDepth(9);`,
  `    emitter.explode(3);`,
  `    this.time.delayedCall(200, () => { if (emitter?.active) emitter.destroy(); });`,
  `  }`,
  ``,
  ``,
].join('\n');
s = s.replace(SPARKS_BEFORE, SPARKS_METHOD + SPARKS_BEFORE);
console.log('✓ _emitBoltSparks inserted');

// ── 3. _onJuice correct: add micro shake after flash ─────────────────────────
const OLD_JUICE = `    if (type === 'correct') {
      this.cameras.main.flash(200, 0, 255, 150);`;
const NEW_JUICE = `    if (type === 'correct') {
      this.cameras.main.flash(200, 0, 255, 150);
      this.cameras.main.shake(80, 0.002);`;
if (!s.includes(OLD_JUICE)) { console.error('OLD_JUICE not found'); process.exit(1); }
s = s.replace(OLD_JUICE, NEW_JUICE);
console.log('✓ correct-answer micro shake added to _onJuice');

// ── 4. Floor dark overlay in _createAtmosphere ───────────────────────────────
const OLD_LIGHT = `    this._lightImg = this.add.image(0, 0, 'lightGrad')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(52);`;
const NEW_LIGHT = `    this._lightImg = this.add.image(0, 0, 'lightGrad')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(52);

    // Dark floor overlay — depth 0.5: above groundLayer(0), below wallLayer(1)
    const floorDark = this.add.graphics().setDepth(0.5);
    floorDark.fillStyle(0x000000, 0.15).fillRect(0, 0, WORLD_W, WORLD_H);`;
if (!s.includes(OLD_LIGHT)) { console.error('OLD_LIGHT not found'); process.exit(1); }
s = s.replace(OLD_LIGHT, NEW_LIGHT);
console.log('✓ floor dark overlay added');

writeFileSync(f, s, 'utf8');
console.log('All 3C/3D maze edits saved.');

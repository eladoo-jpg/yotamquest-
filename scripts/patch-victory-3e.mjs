import { readFileSync, writeFileSync } from 'fs';
const f = 'C:/Projects/Claude proj/yotamquesT/src/game/scenes/VictoryScene.js';
let s = readFileSync(f, 'utf8');

// ── 1. Stats rows: label alpha 0, stagger 200→300ms, tick sound, fade-in ─────
const OLD_ROWS = `    rows.forEach(({ label, icon, value, color }, i) => {
      const y = panelY + 60 + i * 52;

      this.add.text(cx - 80, y, \`\${icon}  \${label}:\`, {
        fontFamily: 'Courier New, Arial, sans-serif',
        fontSize:   '18px',
        color:      '#333333',
      }).setOrigin(0, 0.5).setDepth(20);

      // Animated counter
      const numTxt = this.add.text(cx + 100, y, '0', {
        fontFamily: 'Courier New, Arial, sans-serif',
        fontSize:   '22px',
        fontStyle:  'bold',
        color,
      }).setOrigin(0.5).setDepth(20);

      this.time.delayedCall(300 + i * 200, () => {
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
    });`;
const NEW_ROWS = `    rows.forEach(({ label, icon, value, color }, i) => {
      const y = panelY + 60 + i * 52;

      const labelTxt = this.add.text(cx - 80, y, \`\${icon}  \${label}:\`, {
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
    });`;
if (!s.includes(OLD_ROWS)) { console.error('OLD_ROWS not found'); process.exit(1); }
s = s.replace(OLD_ROWS, NEW_ROWS);
console.log('✓ stats stagger 300ms + tick sound + fade-in added');

// ── 2. Skin box: replace static render with container + scale-bounce ──────────
const OLD_SKIN = `    // Skin preview box
    const skinX = cx + 120, skinY = panelY + 200;
    const skinBox = this.add.graphics().setDepth(20);
    skinBox.lineStyle(2, 0x8800ff, 0.9).fillStyle(0xeef0ff, 1);
    skinBox.fillRoundedRect(skinX - 42, skinY - 50, 84, 84, 8);
    skinBox.strokeRoundedRect(skinX - 42, skinY - 50, 84, 84, 8);

    this.add.text(skinX, skinY - 62, 'סקין חדש נפתח!', {
      fontFamily: 'Courier New, Arial, sans-serif',
      fontSize:   '10px',
      color:      '#8800ff',
    }).setOrigin(0.5, 1).setDepth(21);

    // Placeholder skin icon — gold star agent
    this.add.text(skinX, skinY - 8, '🦸', {
      fontSize: '44px',
      fontFamily: '"Apple Color Emoji","Segoe UI Emoji",sans-serif',
    }).setOrigin(0.5).setDepth(21);

    this.tweens.add({
      targets: skinBox,
      alpha: { from: 1, to: 0.6 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });`;
const NEW_SKIN = `    // Skin preview box — scale-from-0 bounce reveal (Part 3E)
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
    });`;
if (!s.includes(OLD_SKIN)) { console.error('OLD_SKIN not found'); process.exit(1); }
s = s.replace(OLD_SKIN, NEW_SKIN);
console.log('✓ skin box scale bounce added');

// ── 3. Add _playTick Web Audio helper before _makeGoldBtn ────────────────────
const OLD_BTN = `  /* ── gold button ─────────────────────────────────────────────────────────── */
  _makeGoldBtn(x, y, label, callback, small = false) {`;
const NEW_BTN = `  /* ── tick sound (Web Audio API, Part 3E) ──────────────────────────────────── */
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
  _makeGoldBtn(x, y, label, callback, small = false) {`;
if (!s.includes(OLD_BTN)) { console.error('OLD_BTN not found'); process.exit(1); }
s = s.replace(OLD_BTN, NEW_BTN);
console.log('✓ _playTick method added');

writeFileSync(f, s, 'utf8');
console.log('All 3E victory edits saved.');

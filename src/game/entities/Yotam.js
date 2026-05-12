import * as Phaser from 'phaser';

export default class Yotam extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    // Use the real spritesheet when it has been preloaded; fall back to
    // the programmatic placeholder only if running without assets (e.g. tests).
    const useSheet = scene.textures.exists('yotam_sheet');

    if (!useSheet && !scene.textures.exists('yotam')) {
      // ── Placeholder ──────────────────────────────────────────────────────────
      const W = 20, H = 26;
      const g = scene.make.graphics({ add: false });
      g.fillStyle(0x2255cc, 1);
      g.fillRoundedRect(2, 6, W - 4, H - 8, 3);
      g.fillStyle(0xddaa88, 1);
      g.fillCircle(W / 2, 5, 5);
      g.lineStyle(1, 0x00aaff, 1);
      g.strokeRoundedRect(2, 6, W - 4, H - 8, 3);
      g.fillStyle(0x00ffff, 1);
      g.fillCircle(W / 2, 1, 2);
      g.generateTexture('yotam', W, H);
      g.destroy();
    }

    const textureKey = useSheet ? 'yotam_sheet' : 'yotam';
    super(scene, x, y, textureKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (useSheet) {
      // 48×48 drawn pixel-art frame at 2× → 96×96 px on screen
      // Character occupies x=8..40, y=6..41 — physics box at lower torso/feet
      this.setScale(1.8);
      this.body.setSize(20, 14);
      this.body.setOffset(14, 28);
    } else {
      // Placeholder dimensions
      this.body.setSize(14, 16);
      this.body.setOffset(3, 8);
    }

    this.setCollideWorldBounds(true);
    this.setDepth(100);
  }
}

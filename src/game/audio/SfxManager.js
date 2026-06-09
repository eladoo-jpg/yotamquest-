import { AUDIO_MANIFEST } from './AudioManifest.js';

const MAX_CONCURRENT = 4;
const AMBIENCE_VOL   = 0.15;
const AMBIENCE_DUCK  = 0.05;

/**
 * SfxManager — categorized SFX playback with priority limiting.
 *
 * Usage:
 *   const sfx = new SfxManager(scene);
 *   sfx.play('correct_answer');
 *   sfx.startAmbience();
 *   sfx.duckAmbience();
 *   sfx.destroy();   // in scene shutdown()
 *
 * Also accessible globally via scene.game.sfxManager for overlay scenes.
 */
export default class SfxManager {
  constructor(scene) {
    this._scene    = scene;
    this._active   = [];    // currently playing SFX Sound instances
    this._ambience = null;
  }

  /**
   * Play a named action sound (e.g. 'correct_answer', 'pickup').
   * Silently skipped if MAX_CONCURRENT reached or asset missing.
   */
  play(actionKey, volume = 0.6) {
    const audioKey = AUDIO_MANIFEST.sfx[actionKey];
    if (!audioKey) return;
    if (!this._scene.cache.audio.exists(audioKey)) return;

    // Prune completed sounds
    this._active = this._active.filter(s => s.isPlaying);
    if (this._active.length >= MAX_CONCURRENT) return;

    const snd = this._scene.sound.add(audioKey, { volume });
    snd.play();
    snd.once('complete', () => {
      this._active = this._active.filter(s => s !== snd);
      try { snd.destroy(); } catch (_) {}
    });
    this._active.push(snd);
  }

  /** Start looping ambience track. No-op if already playing. */
  startAmbience() {
    if (this._ambience?.isPlaying) return;
    if (!this._scene.cache.audio.exists(AUDIO_MANIFEST.ambienceKey)) return;
    this._ambience = this._scene.sound.add(AUDIO_MANIFEST.ambienceKey, {
      loop: true, volume: AMBIENCE_VOL,
    });
    this._ambience.play();
  }

  /**
   * Duck ambience to 0.05 during a success moment, restore after durationMs.
   * Priority: music > SFX > ambience.
   */
  duckAmbience(durationMs = 1500) {
    if (!this._ambience?.isPlaying) return;
    this._scene.tweens.add({
      targets:    this._ambience,
      volume:     AMBIENCE_DUCK,
      duration:   200,
      onComplete: () => {
        this._scene.time.delayedCall(durationMs, () => {
          if (!this._ambience?.isPlaying) return;
          this._scene.tweens.add({
            targets:  this._ambience,
            volume:   AMBIENCE_VOL,
            duration: 400,
          });
        });
      },
    });
  }

  destroy() {
    this._active.forEach(s => { try { s.stop(); } catch (_) {} });
    this._active = [];
    try { this._ambience?.stop(); } catch (_) {}
    this._ambience = null;
  }
}

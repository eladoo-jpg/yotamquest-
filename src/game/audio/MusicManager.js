import { AUDIO_MANIFEST } from './AudioManifest.js';

const FADE_MS = 500;

/**
 * MusicManager — centralized music state machine for YotamQuest.
 *
 * Usage:
 *   const mm = new MusicManager(scene);
 *   mm.play('maze_explore');
 *   mm.scheduleReturn(3000);   // after danger ends
 *   mm.destroy();              // in scene shutdown()
 */
export default class MusicManager {
  constructor(scene) {
    this._scene       = scene;
    this._current     = null;   // active Phaser.Sound instance
    this._state       = null;   // current state key string
    this._returnTimer = null;
    this._tracks      = [];     // ALL created instances — for _stopAll()
    this._playToken   = 0;      // incremented on every play() call; guards delayed callbacks
  }

  /**
   * Switch to named music state.
   * No-op if already in that state.
   * Stops ALL playing tracks first, then crossfades in new one.
   */
  play(stateKey, volume = 0.65) {
    if (this._state === stateKey) return;
    const entry = AUDIO_MANIFEST.music[stateKey];
    if (!entry) return;
    if (!this._scene.cache.audio.exists(entry.key)) return;

    this._tryUnlockContext();

    // Stop every known track before starting a new one — prevents overlap
    this._stopAll(FADE_MS);

    this._state = stateKey;
    const token = ++this._playToken;   // any older delayed callback sees stale token → exits

    // Brief gap lets fade-out begin before new track starts
    this._scene.time.delayedCall(FADE_MS / 2, () => {
      if (this._playToken !== token) return;   // superseded by a newer play() call
      if (!this._scene.scene.isActive()) return;
      const snd = this._scene.sound.add(entry.key, { loop: true, volume: 0 });
      snd.play();
      this._current = snd;
      this._tracks.push(snd);
      this._scene.tweens.add({ targets: snd, volume, duration: FADE_MS });
    });
  }

  /** Fade out and stop ALL tracked music instances. */
  _stopAll(fadeDuration = FADE_MS) {
    this._tracks.forEach(t => {
      if (!t) return;
      try {
        this._scene.tweens.killTweensOf(t);
        if (t.isPlaying) {
          this._scene.tweens.add({
            targets:    t,
            volume:     0,
            duration:   fadeDuration,
            onComplete: () => { try { t.stop(); t.destroy(); } catch (_) {} },
          });
        } else {
          try { t.destroy(); } catch (_) {}
        }
      } catch (_) {}
    });
    this._tracks   = [];
    this._current  = null;
  }

  /**
   * Schedule automatic return to maze_explore after delayMs.
   * Cancels any pending return timer.
   */
  scheduleReturn(delayMs = 3000) {
    if (this._returnTimer) { this._returnTimer.remove(false); this._returnTimer = null; }
    this._returnTimer = this._scene.time.delayedCall(delayMs, () => {
      this._returnTimer = null;
      if (this._state === 'danger' || this._state === 'victory') {
        this.play('maze_explore');
      }
    });
  }

  /** Fade out all music and clear state. */
  stop(fadeDuration = FADE_MS) {
    if (this._returnTimer) { this._returnTimer.remove(false); this._returnTimer = null; }
    ++this._playToken;   // cancel any pending delayed start
    this._state = null;
    this._stopAll(fadeDuration);
  }

  /** Resume suspended AudioContext (iOS / mobile autoplay policy). */
  _tryUnlockContext() {
    try {
      const ctx = this._scene.sound.context;
      if (ctx?.state === 'suspended') ctx.resume();
    } catch (_) {}
  }

  destroy() {
    if (this._returnTimer) { this._returnTimer.remove(false); this._returnTimer = null; }
    ++this._playToken;
    this._state = null;
    this._tracks.forEach(t => { try { t.stop(); t.destroy(); } catch (_) {} });
    this._tracks  = [];
    this._current = null;
  }
}

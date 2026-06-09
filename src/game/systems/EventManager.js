/**
 * EventManager — proximity-based learning gate trigger system.
 * Decoupled from Phaser: receives tile coords, fires CustomEvents to React.
 * Never hardcodes content — all events come from the JSON data passed in.
 */
export default class EventManager {
  /**
   * @param {Array} eventsData — parsed JSON from pilot01_events.json (or any level)
   */
  constructor(eventsData) {
    this.events     = eventsData;
    console.log(`[YQ-DEBUG] EVENTS LOADED: ${eventsData.map(e => e.event_id).join(', ')}`);
    this.fired      = new Set();   // currently showing (prevents re-trigger while open)
    this.completed  = new Set();   // answered correctly — never fires again this session
    this.scene      = null;        // set via setScene() after Phaser scene is ready
    this._blockedAt = new Map();   // eventId → last blocked-notify timestamp (spam guard)
    this._debugFrame = 0;
  }

  /** Call from MazeScene.create() so new event types can launch Phaser scenes directly. */
  setScene(scene) {
    this.scene = scene;
  }

  /**
   * Call every frame (or on tile change) from MazeScene.update().
   * @param {number} tileR — player's current tile row
   * @param {number} tileC — player's current tile column
   */
  checkTriggers(tileR, tileC) {
    this._debugFrame++;
    const doLog = this._debugFrame % 60 === 0;

    for (const evt of this.events) {
      if (this.completed.has(evt.event_id)) continue;
      if (this.fired.has(evt.event_id))     continue;
      if (evt.requires && !this.completed.has(evt.requires)) {
        if (evt.event_id === 'gate_chest_typing') {
          console.log(`[YQ-DEBUG] gate_chest_typing BLOCKED — requires "${evt.requires}" not complete. completed=[${[...this.completed].join(',')}]`);
        }
        continue;
      }

      if (evt.requires_all) {
        const allDone = evt.requires_all.every(id => this.completed.has(id));
        if (!allDone) {
          const last = this._blockedAt.get(evt.event_id) ?? 0;
          if (Date.now() - last > 3000) {
            this._blockedAt.set(evt.event_id, Date.now());
            window.dispatchEvent(new CustomEvent('yotam:gate:blocked', {
              detail: { eventId: evt.event_id, message: evt.blocked_message ?? '' },
            }));
          }
          continue;
        }
      }

      if (!evt.trigger || typeof evt.trigger !== 'object') continue;

      const { tileR: tr, tileC: tc, radius } = evt.trigger;
      const dr = Math.abs(tileR - tr);
      const dc = Math.abs(tileC - tc);

      if (doLog) console.log(`[YQ-DEBUG] CHECK ${evt.event_id} Yotam[${tileR},${tileC}] trigger[${tr},${tc}] dr=${dr} dc=${dc}`);

      if (dr <= radius && dc <= radius) {
        this.fired.add(evt.event_id);
        console.log(`[YQ-DEBUG] FIRE ${evt.event_id} Yotam[${tileR},${tileC}]`);
        this._dispatch(evt);
        return;
      }
    }
  }

  /**
   * Fire an event immediately by ID — used for script-driven triggers
   * (e.g. "radio fires when snake is killed") rather than proximity.
   * Safe to call multiple times: ignored if already fired or completed.
   */
  triggerEvent(eventId) {
    if (this.completed.has(eventId)) return;
    if (this.fired.has(eventId))     return;
    const evt = this.events.find(e => e.event_id === eventId);
    if (!evt) return;
    this.fired.add(eventId);
    this._dispatch(evt);
  }

  /**
   * Routes event to the correct Phaser scene or falls back to React LearningGate.
   */
  _dispatch(evt) {
    const data = { ...evt };
    if (evt.type === 'intro_story') {
      window.dispatchEvent(new CustomEvent('yotam:intro:start', { detail: data }));
      return;
    }
    if (this.scene) {
      if (evt.type === 'pressure_door') {
        this.triggerPressureDoor(this.scene, evt.event_id, evt.contentPath);
        return;
      }
      if (evt.type === 'mimic_chest') {
        this.scene.scene.pause('MazeScene');
        this.scene.scene.launch('MimicChestScene', data);
        this.scene.scene.bringToTop('MimicChestScene');
        return;
      }
      if (evt.type === 'color_laser_path') {
        // Player continues moving — no pause
        this.scene.scene.launch('ColorLaserScene', data);
        this.scene.scene.bringToTop('ColorLaserScene');
        return;
      }
      if (evt.type === 'radio_message') {
        this.scene.scene.pause('MazeScene');
        this.scene.scene.launch('RadioMessageScene', data);
        this.scene.scene.bringToTop('RadioMessageScene');
        return;
      }
      if (evt.type === 'reload_typing') {
        this.scene.scene.pause('MazeScene');
        this.scene.scene.launch('ReloadTypingScene', data);
        this.scene.scene.bringToTop('ReloadTypingScene');
        return;
      }
    }
    // fallback: unknown types go through React LearningGate
    window.dispatchEvent(new CustomEvent('yotam:gate:open', { detail: data }));
  }

  triggerPressureDoor(scene, eventId, contentPath) {
    if (this.completed.has(eventId)) return;
    if (scene.scene.isActive('PressureDoorScene')) return;
    scene.scene.get('MazeScene').physics.pause();
    scene.scene.get('MazeScene').pausePlayerInput();
    scene.scene.launch('PressureDoorScene', { eventId, contentPath });
    scene.scene.bringToTop('PressureDoorScene');
    this.scene.game.events.once('eventComplete', (payload) => {
      if (payload.eventId !== eventId) return;
      if (payload.result === 'success') this.completed.add(eventId);
      this._onPressureDoorComplete(scene, payload);
    });
  }

  _onPressureDoorComplete(scene, payload) {
    scene.scene.get('MazeScene').physics.resume();
    scene.scene.get('MazeScene').resumePlayerInput();
    if (payload.result === 'success') {
      scene.scene.get('MazeScene').events.emit('doorOpen', { eventId: payload.eventId });
    } else {
      this.allowRetry(payload.eventId);
    }
  }

  /**
   * Called by MazeScene when React fires 'yotam:gate:answered' with { correct: true }.
   * Permanently seals this gate for the session.
   */
  markComplete(eventId) {
    this.completed.add(eventId);
    this.fired.add(eventId);
  }

  /**
   * Called by MazeScene when React fires 'yotam:gate:answered' with { correct: false }.
   * Allows the gate to re-trigger after a short walk-away cooldown.
   */
  allowRetry(eventId, delayMs = 2500) {
    setTimeout(() => {
      this.fired.delete(eventId);
    }, delayMs);
  }

  /**
   * Force-close the currently open gate (e.g. player died / scene restart).
   */
  forceClose(eventId) {
    this.fired.delete(eventId);
  }

  /** Dev helper — reset all state */
  reset() {
    this.fired.clear();
    this.completed.clear();
  }
}

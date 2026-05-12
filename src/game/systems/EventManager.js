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
    this.events    = eventsData;
    this.fired     = new Set();   // currently showing (prevents re-trigger while open)
    this.completed = new Set();   // answered correctly — never fires again this session
  }

  /**
   * Call every frame (or on tile change) from MazeScene.update().
   * @param {number} tileR — player's current tile row
   * @param {number} tileC — player's current tile column
   */
  checkTriggers(tileR, tileC) {
    for (const evt of this.events) {
      if (this.completed.has(evt.event_id)) continue;
      if (this.fired.has(evt.event_id))     continue;
      if (evt.requires && !this.completed.has(evt.requires)) continue; // gate dependency

      const { tileR: tr, tileC: tc, radius } = evt.trigger;
      const dr = Math.abs(tileR - tr);
      const dc = Math.abs(tileC - tc);

      if (dr <= radius && dc <= radius) {
        this.fired.add(evt.event_id);
        window.dispatchEvent(
          new CustomEvent('yotam:gate:open', { detail: { ...evt } })
        );
        return; // one gate at a time
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
    window.dispatchEvent(new CustomEvent('yotam:gate:open', { detail: { ...evt } }));
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

PROJECT ROOT: C:\Projects\Claude proj\yotamquesT

# YotamQuest

## Deployment
- Always build locally before deploying to Vercel production
- Verify build succeeds before running deploy command
- After deploy, confirm production URL is accessible

## YotamQuest Project Conventions
- Phaser.js scenes live in src/scenes/ (MazeScene, BossScene, VictoryScene, MainMenuScene)
- Mobile controls are in VirtualControls.js ג€” use displayWidth/displayHeight (not scaleX/scaleY) for tween targets
- iOS safe-area padding must be respected in all UI overlays
- Canvas uses FIT mode at 480ֳ—854 fixed dimensions
- When fixing rendering bugs, check for code corruption (duplicate function definitions) before editing

## Pixel Art Rules (CRITICAL)
- Yotam spritesheet: 64ֳ—64 px per frame (native, extracted without resize)
- Display scale MUST be integer only: `setScale(2)` ג†’ 128ֳ—128 on screen
- NEVER use non-integer scales: `setScale(1.5)` ג  `setScale(1.2)` ג  `setScale(3)` ג
- NEVER resize/smooth sprites during extraction ג€” nearest-neighbour display scaling only
- Always enable `pixelArt: true` in the Phaser game config (sets FilterMode.NEAREST globally)

## Bug Fixing
- For UI bugs, diagnose the actual root cause (e.g., CSS stacking context, z-index, initialization order) before applying a surface-level fix
- For trigger/event bugs, prefer event-driven triggers over coordinate-based ones
- After any fix, verify the originating symptom is gone, not just an adjacent symptom

=== YOTAMQUEST PROJECT CONTEXT ג€” READ THIS BEFORE DOING ANYTHING ===

PROJECT: YotamQuest ג€” Hebrew educational game for children.
TECH: Phaser 3 + React.
CANVAS: 480ֳ—854 fixed, FIT scale mode. Integer scales only. pixelArt: true.
PLATFORM: Mobile-first. iOS safe-area respected. RTL (Hebrew).
AESTHETIC: Sci-fi neon dungeon. Pixel art.

FILE LOCATIONS:
  Phaser scenes:         src/game/scenes/
  New scene file:        src/game/scenes/PressureDoorScene.js
  Event content:         src/data/events/pressure-door.json
  EventManager:          src/game/systems/EventManager.js
  GameWrapper:           src/react/GameWrapper.jsx
  Scene key to register: "PressureDoorScene"

EXISTING ARCHITECTURE:
  - EventManager handles proximity triggers and programmatic triggers.
  - MazeScene is the persistent game world. Runs underneath all event scenes.
  - Event scenes are launched as Phaser overlay scenes (scene.launch), not scene.start.
  - When an event scene finishes, MazeScene must resume.

=== EVENT CONTRACT (PressureDoorScene ג†” MazeScene) ===

PressureDoorScene RECEIVES on launch (via scene.settings.data):
  {
    eventId: string,        // e.g. "pressure-door-01"
    contentPath: string     // e.g. "events/pressure-door.json"
  }

PressureDoorScene EMITS before shutdown:
  this.game.events.emit('eventComplete', {
    eventId: string,
    result: 'success' | 'failure' | 'abandoned',
    attemptsUsed: number,
    timeMs: number
  })

MazeScene LISTENS for 'eventComplete' and:
  1. Resumes physics and player input.
  2. result === 'success': opens the door (removes collider, plays open anim or setVisible(false) placeholder).
  3. result === 'failure': door stays closed. Player can retry by re-entering proximity.

EventManager CHECKS before launching:
  - If eventId is in completedEvents: skip (do not launch).
  - If "PressureDoorScene" is already active: skip (no duplicate).
  - On launch: pause MazeScene physics and player input.

=== JSON SCHEMA ===

src/data/events/pressure-door.json:
{
  "eventId": "pressure-door-01",
  "type": "pressure-door",
  "maxAttempts": 3,
  "timeoutSeconds": 30,
  "sentences": [
    {
      "id": "s1",
      "hebrew": "׳”׳¡׳•׳›׳ ׳¨׳¥ ׳׳‘׳™׳×",
      "correctWordIndex": 1,
      "distractorWord": "׳›׳“׳•׳¨"
    }
  ],
  "ui": {
    "promptText": "׳‘׳—׳¨ ׳׳× ׳”׳׳™׳׳” ׳”׳ ׳›׳•׳ ׳”",
    "successText": "׳›׳ ׳”׳›׳‘׳•׳“!",
    "failureText": "׳ ׳¡׳” ׳©׳•׳‘"
  }
}

Field semantics:
  - hebrew: Full Hebrew sentence shown to player.
  - correctWordIndex: 0-based index of the target word in sentence.split(' ').
  - distractorWord: The one wrong word shown as the wrong button.
  - maxAttempts: Full rounds allowed before 'failure' emitted.
  - timeoutSeconds: Per-round timer. 0 = no timer.

=== LASER WALL SPEC ===

Prompt 1 placeholder (static):
  - Phaser Graphics rectangle: x=0, y=200, width=480, height=12, color 0xff2222, alpha 0.85.
  - No animation. Static.

Prompt 3 final (animated):
  - 3 lines at y=200, y=206, y=212. Each 480ֳ—2px.
  - Alpha oscillates 0.6ג†’1.0 independently per line (durations: 800ms, 950ms, 1100ms).
  - Color cycles 0xff2222 ג†’ 0xff6600 using a 100ms timer + manual redraw.
  - Store all three as this.laserLines = []; destroy in shutdown().

=== HARD RULES ===
  1. No React state/hooks inside Phaser scenes.
  2. shutdown() must destroy all tweens, timers, graphics.
  3. Integer pixel positions only. No fractional values.
  4. All text: fontFamily 'monospace'. RTL Hebrew where applicable.
  5. No dynamic imports inside create(). Load assets in preload() only.

=== END CONTEXT ===


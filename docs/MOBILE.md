# YotamQuest — Mobile Rendering Invariants

Every mobile rendering decision in one place. When fixing a mobile bug, check here before
editing — changing these values often causes regressions elsewhere.

---

## 1. Canvas Configuration

| Constant | Value | File:Line |
|----------|-------|-----------|
| `GAME_W` | `480` | `src/react/GameWrapper.jsx:11` |
| `GAME_H` | `854` | `src/react/GameWrapper.jsx:12` |
| Scale mode | `Phaser.Scale.FIT` | `src/react/GameWrapper.jsx:28` |
| Auto-center | `Phaser.Scale.CENTER_BOTH` | `src/react/GameWrapper.jsx:29` |

**Why FIT + 480×854:** Fixed 9:16 portrait canvas. FIT mode centers and letterboxes without
distortion — no stretching on any device. 480×854 gives crisp integer scaling on common iOS/Android
resolutions while keeping the tilemap grid math simple (480 = 15 tiles × 32px).

---

## 2. iOS Safe-Area Handling

| Decision | Value | File:Line |
|----------|-------|-----------|
| Viewport meta | `viewport-fit=cover` | `index.html:5` |
| Bottom padding | `env(safe-area-inset-bottom)` | `src/react/App.jsx:14` |
| Status bar style | `black-translucent` | `index.html:7` |
| iOS web app capable | `yes` | `index.html:6` |
| BTM clearance | `80px` | `src/game/systems/VirtualControls.js:31` |

**Why `viewport-fit=cover`:** Allows the canvas to fill the full screen including notch/home-bar
areas. Without it, the viewport shrinks above the safe area and the canvas appears letterboxed
with a gap.

**Why BTM = 80:** iOS home indicator is 34px tall. 46px breathing room was tuned by playtesting
on iPhone 14 Pro to ensure no thumb accidentally triggers the system swipe gesture.
Formula: `34 (home indicator) + 46 (breathing room) = 80`.

**Why `env(safe-area-inset-bottom)` on App.jsx:** Prevents the React UI shell from being clipped
by the home indicator when running as an installed PWA.

---

## 3. Virtual Controls — Joystick Rendering

| Constant | Value | File:Line |
|----------|-------|-----------|
| `JOY_BASE_D` | `140` | `src/game/systems/VirtualControls.js:12` |
| `JOY_THUMB_D` | `70` | `src/game/systems/VirtualControls.js:13` |
| `JOY_MAX_R` | `46` | `src/game/systems/VirtualControls.js:14` |
| `BTN_D` | `90` | `src/game/systems/VirtualControls.js:15` |
| `JOY_ZONE_X_MAX` | `220` | `src/game/systems/VirtualControls.js:18` |
| Base crop | `100, 0, 400, 400` | `src/game/systems/VirtualControls.js:82` |
| Thumb crop | `110, 0, 380, 380` | `src/game/systems/VirtualControls.js:93` |

**Why crop before setDisplaySize:** The joy-base PNG is 600×400 and joy-thumb is 600×380 —
both are wider than tall (sprite-sheet layout). Cropping the centre square before calling
`setDisplaySize(D, D)` ensures the circle renders round. Without the crop, Phaser stretches
the non-square source into a square display, producing an oval.

**Why `displayWidth`/`displayHeight` for tweens (not `scaleX`/`scaleY`):**

```js
// src/game/systems/VirtualControls.js:129-141
this.scene.tweens.add({
  targets: img,
  displayWidth:  BTN_D * 0.82,
  displayHeight: BTN_D * 0.82,
  ...
});
```

`scaleX: 0.82` would multiply the PNG's *natural pixel size* (~300px), producing a huge
button. `displayWidth` targets absolute canvas pixels regardless of source resolution —
safe when PNG assets change size.

---

## 4. GPU Artifact Mitigation — Edge Fade Overlay

| Constant | Value | File:Line |
|----------|-------|-----------|
| `FADE_H` | `60` | `src/game/scenes/MazeScene.js:312` |
| Solid cover strip | `20px` at bottom | `src/game/scenes/MazeScene.js:314` |
| Fade gradient | 40 × 1px rows | `src/game/scenes/MazeScene.js:315-317` |
| Overlay depth | `55` | `src/game/scenes/MazeScene.js:313` |
| Overlay color | `0x010208` | `src/game/scenes/MazeScene.js:314` |

**Why the edge fade exists:** On mobile GPUs (especially iOS Metal), pixels rendered beyond
the tilemap world bounds produce a bright pink/white artifact line at the bottom canvas edge.
A solid 20px strip + 40px alpha gradient fading in from the world background color masks
the artifact completely without visible seam.

**Why depth 55:** Must sit above the tilemap layers (depth 0–1) and fog-of-war graphics
(depth 50), but below the HUD (depth 99–100). Depth 55 is the stable slot for
screen-fixed overlays that belong to the world layer.

**Why `setScrollFactor(0)`:** The overlay must stay fixed to the screen edges even as the
camera follows the player through the world. ScrollFactor 0 = screen-space, not world-space.

---

## 5. Depth Layer Map

| Layer | Depth | File:Line |
|-------|-------|-----------|
| Background rect | `-10` | `src/game/scenes/MazeScene.js:308` |
| Tilemap (floor/wall) | `0–1` | Phaser default |
| Fog of war | `50` | `src/game/scenes/MazeScene.js:181` |
| Edge fade overlay | `55` | `src/game/scenes/MazeScene.js:313` |
| HUD background | `99` | `src/game/scenes/MazeScene.js:673` |
| HUD text | `100` | `src/game/scenes/MazeScene.js:679` |

**Rule:** Never assign a new element depth in the 51–54 or 56–98 ranges without checking
that it won't appear above the edge fade or below the fog. The 55-slot is load-bearing.

---

## 6. Touch & Scroll Prevention

| Rule | Value | File:Line |
|------|-------|-----------|
| Overflow hidden | `overflow: hidden` | `index.html:29` |
| Touch action | `touch-action: none` | `index.html:33` |
| iOS bounce | `overscroll-behavior: none` | `index.html:32` |
| Tap highlight | `-webkit-tap-highlight-color: transparent` | `index.html:34` |
| Touch callout | `-webkit-touch-callout: none` | `index.html:35` |

**Why all of these:** Without `touch-action: none`, iOS intercepts drag events for scroll
before Phaser's pointer handler sees them — the joystick stops tracking mid-swipe.
Without `overscroll-behavior: none`, a fast upward drag triggers pull-to-refresh and
freezes the game. The webkit properties suppress the blue flash and long-press menu on
game elements.

---

## 7. World & Scene Dimensions

| Constant | Value | File:Line |
|----------|-------|-----------|
| `TILE` | `32` | `src/game/scenes/MazeScene.js:15` |
| `WORLD_W` | `640` (20 cols × 32) | `src/game/scenes/MazeScene.js:18` |
| `WORLD_H` | `800` (25 rows × 32) | `src/game/scenes/MazeScene.js:19` |
| BossScene canvas | `480×640` | `src/game/scenes/BossScene.js:18` |
| BossScene HUD height | `52` | `src/game/scenes/BossScene.js:19` |
| BossScene controls Y | `590` | `src/game/scenes/BossScene.js:20` |

**Why world > canvas:** The 640×800 world is larger than the 480×854 canvas so the camera
can scroll. The camera clamps to world bounds, ensuring the edge fade overlay always
covers the boundary where GPU artifacts appear.

# YotamQuest

## Deployment
- Always build locally before deploying to Vercel production
- Verify build succeeds before running deploy command
- After deploy, confirm production URL is accessible

## YotamQuest Project Conventions
- Phaser.js scenes live in src/scenes/ (MazeScene, BossScene, VictoryScene, MainMenuScene)
- Mobile controls are in VirtualControls.js — use displayWidth/displayHeight (not scaleX/scaleY) for tween targets
- iOS safe-area padding must be respected in all UI overlays
- Canvas uses FIT mode at 480×854 fixed dimensions
- When fixing rendering bugs, check for code corruption (duplicate function definitions) before editing

## Pixel Art Rules (CRITICAL)
- Yotam spritesheet: 64×64 px per frame (native, extracted without resize)
- Display scale MUST be integer only: `setScale(2)` → 128×128 on screen
- NEVER use non-integer scales: `setScale(1.5)` ❌  `setScale(1.2)` ❌  `setScale(3)` ❌
- NEVER resize/smooth sprites during extraction — nearest-neighbour display scaling only
- Always enable `pixelArt: true` in the Phaser game config (sets FilterMode.NEAREST globally)

## Bug Fixing
- For UI bugs, diagnose the actual root cause (e.g., CSS stacking context, z-index, initialization order) before applying a surface-level fix
- For trigger/event bugs, prefer event-driven triggers over coordinate-based ones
- After any fix, verify the originating symptom is gone, not just an adjacent symptom

/**
 * AudioManifest — central registry for all YotamQuest audio assets.
 *
 * sfx:         action name → Phaser audio key
 * sfxPaths:    Phaser audio key → file path  (used in preload)
 * ambienceKey / ambiencePath
 * music:       state name → { key, path }
 */

const UI_BASE  = 'assets/audio/SoundFX/kenney_interface-sounds/Audio';
const SCI_BASE = 'assets/audio/SoundFX/kenney_sci-fi-sounds/Audio';
const MUS_BASE = 'assets/audio';

export const AUDIO_MANIFEST = {

  // ── SFX: action → Phaser audio key ─────────────────────────────────────────
  sfx: {
    button_tap:      'sfx_click',
    correct_answer:  'sfx_confirm',
    wrong_answer:    'sfx_error',
    laser_hit:       'sfx_impact',
    pickup:          'sfx_pickup',
    door_open:       'sfx_door_open',
    crystal_collect: 'sfx_crystal',
    chest_open:      'sfx_chest',
    typing_success:  'sfx_typing_ok',
    glitch_fail:     'sfx_glitch',
  },

  // ── SFX: Phaser audio key → file path ──────────────────────────────────────
  sfxPaths: {
    sfx_click:      `${UI_BASE}/click_001.ogg`,
    sfx_confirm:    `${UI_BASE}/confirmation_001.ogg`,
    sfx_error:      `${UI_BASE}/error_001.ogg`,
    sfx_impact:     `${SCI_BASE}/impactMetal_000.ogg`,
    sfx_pickup:     `${UI_BASE}/maximize_006.ogg`,
    sfx_door_open:  `${SCI_BASE}/doorOpen_000.ogg`,
    sfx_crystal:    `${UI_BASE}/bong_001.ogg`,
    sfx_chest:      `${SCI_BASE}/doorOpen_002.ogg`,
    sfx_typing_ok:  `${UI_BASE}/confirmation_003.ogg`,
    sfx_glitch:     `${UI_BASE}/glitch_001.ogg`,
  },

  // ── Ambience ────────────────────────────────────────────────────────────────
  ambienceKey:  'sfx_ambience',
  ambiencePath: `${SCI_BASE}/engineCircular_000.ogg`,

  // ── Music: state → { key, path } ───────────────────────────────────────────
  music: {
    maze_explore: {
      key:  'music_maze',
      path: `${MUS_BASE}/Neon Maze BelowLASTA.mp3`,
    },
    danger: {
      key:  'music_danger',
      path: `${MUS_BASE}/!Chrome Underpass Danger  Enemy Near (כשיש אויב בקרבת מקום).mp3`,
    },
    boss: {
      key:  'music_boss',
      path: `${MUS_BASE}/!!Cold Predator Core GLITCH FIGHT.mp3`,
    },
    victory: {
      key:  'music_victory',
      path: `${MUS_BASE}/!!Chrome Crown Victory  Level Complete (מסך הניצחון).mp3`,
    },
  },
};

import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import BootScene from '../game/scenes/BootScene';
import MainMenuScene from '../game/scenes/MainMenuScene';
import MazeScene from '../game/scenes/MazeScene';
import BossScene          from '../game/scenes/BossScene';
import VictoryScene      from '../game/scenes/VictoryScene';
import PressureDoorScene from '../game/scenes/PressureDoorScene';
import MimicChestScene   from '../game/scenes/MimicChestScene';
import ColorLaserScene    from '../game/scenes/ColorLaserScene';
import RadioMessageScene    from '../game/scenes/RadioMessageScene';
import ReloadTypingScene   from '../game/scenes/ReloadTypingScene';

// Fixed 9:16 portrait canvas. FIT mode centers and letterboxes — no distortion
// anywhere. Letterbox bars use the page background (#050a14).
const GAME_W = 480;
const GAME_H = 854;

const config = {
  type: Phaser.CANVAS,
  width:  GAME_W,
  height: GAME_H,
  backgroundColor: '#050a14',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, MazeScene, BossScene, VictoryScene, PressureDoorScene, MimicChestScene, ColorLaserScene, RadioMessageScene, ReloadTypingScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

export default function GameWrapper() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;
    gameRef.current = new Phaser.Game({
      ...config,
      parent: containerRef.current,
    });
    // Expose for dev tooling only
    if (import.meta.env.DEV) window.__yotamGame = gameRef.current;
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#050a14', overflow: 'hidden' }}
    />
  );
}

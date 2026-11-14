import Phaser from 'phaser';
import { HABITAT_SIZE, TILE_SIZE } from '../content/habitat';
import { BootScene } from './scenes/BootScene';
import { HabitatScene } from './scenes/HabitatScene';
import { HudScene } from './scenes/HudScene';

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: HABITAT_SIZE.cols * TILE_SIZE,
    height: HABITAT_SIZE.rows * TILE_SIZE,
    backgroundColor: '#05070d',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [BootScene, HabitatScene, HudScene],
  };
}

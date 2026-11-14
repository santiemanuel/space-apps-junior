import Phaser from 'phaser';
import { HABITAT_SIZE, TILE_SIZE } from '../content/habitat';
import { ALL_SCENES } from './scenes/registry';

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
    scene: ALL_SCENES,
  };
}

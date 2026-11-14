import type Phaser from 'phaser';
import { TILE_SIZE } from '../content/habitat';

export const TextureKeys = {
  Player: 'player',
  Floor: 'floor',
  Wall: 'wall',
} as const;

/** Texturas generadas en runtime: el prototipo no depende de assets externos. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Player)) return;
  const g = scene.add.graphics();

  g.fillStyle(0xe2e8f0).fillCircle(12, 12, 11);
  g.fillStyle(0x63b3ed).fillRoundedRect(6, 6, 12, 7, 3);
  g.generateTexture(TextureKeys.Player, 24, 24).clear();

  g.fillStyle(0x1a202c).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(1, 0x2d3748).strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture(TextureKeys.Floor, TILE_SIZE, TILE_SIZE).clear();

  g.fillStyle(0x4a5568).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0x718096).fillRect(2, 2, TILE_SIZE - 4, 4);
  g.generateTexture(TextureKeys.Wall, TILE_SIZE, TILE_SIZE);

  g.destroy();
}

import type Phaser from 'phaser';

export const TextureKeys = {
  Player: 'player',
} as const;

/** Texturas generadas en runtime: el tripulante provisional si no carga su hoja de sprites. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Player)) return;
  const g = scene.add.graphics();

  g.fillStyle(0xe2e8f0).fillCircle(12, 12, 11);
  g.fillStyle(0x63b3ed).fillRoundedRect(6, 6, 12, 7, 3);
  g.generateTexture(TextureKeys.Player, 24, 24);

  g.destroy();
}

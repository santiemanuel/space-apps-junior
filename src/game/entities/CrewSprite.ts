import type Phaser from 'phaser';
import type { CrewId, CrewMemberState } from '../../core/crew/types';
import { TextureKeys } from '../textures';

/**
 * Vista de un tripulante en los mapas. Contrato de la Etapa 0 (docs/plan-de-trabajo.md §5.2):
 * la escena de simulación mueve `sprite` (velocidad, colisiones) y la vista sólo anima y muestra estado.
 */
export interface CrewSprite {
  readonly crewId: CrewId;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  /** Llamar en cada frame: anima según la velocidad del sprite y refleja el estado (reposo, cansancio…). */
  sync(state: CrewMemberState): void;
  /** Marca al tripulante que controla el jugador. */
  setSelected(selected: boolean): void;
  destroy(): void;
}

const PLACEHOLDER_TINT: Record<CrewId, number> = { vega: 0x63b3ed, miga: 0xf6ad55, brote: 0x68d391, senda: 0xfc8181 };

/**
 * Provisional: círculo teñido por tripulante. Dueño: Facundo, que lo reemplaza por la versión animada
 * con docs/*-sprites.png (F2) manteniendo esta firma.
 */
export function createCrewSprite(scene: Phaser.Scene, crewId: CrewId, x: number, y: number): CrewSprite {
  const sprite = scene.physics.add.sprite(x, y, TextureKeys.Player).setTint(PLACEHOLDER_TINT[crewId]).setDepth(10);
  sprite.setCircle(10, 2, 2).setCollideWorldBounds(true);
  const ring = scene.add.circle(x, y, 15).setStrokeStyle(2, 0xfbd38d).setVisible(false).setDepth(9);

  return {
    crewId,
    sprite,
    sync(state) {
      const { x: vx, y: vy } = sprite.body?.velocity ?? { x: 0, y: 0 };
      if (vx !== 0 || vy !== 0) sprite.setRotation(Math.atan2(vy, vx));
      sprite.setAlpha(state.resting ? 0.5 : 1);
      ring.setPosition(sprite.x, sprite.y);
    },
    setSelected(selected) {
      ring.setVisible(selected);
    },
    destroy() {
      ring.destroy();
      sprite.destroy();
    },
  };
}

import type Phaser from 'phaser';
import { CREW_ROSTER } from '../../content/crew';
import type { CrewId, CrewMemberState } from '../../core/crew/types';
import { hasKey, t, type TranslationKey } from '../../i18n';
import { CREW_SHEET, crewTextureKey } from '../assets';
import { TextureKeys } from '../textures';
import {
  animFrameRate, animFrames, CREW_DIRECTIONS, crewAnimKey, directionFor, walkTimeScale, type CrewAnimKind, type CrewDirection,
} from './crewAnimations';

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

/** Escala en pantalla: ~1,7 tiles de 48 px de alto (plan §3.8). */
export const CREW_SCALE = 0.38;
/** Cuerpo físico en los pies, en coordenadas del cuadro de 176×216 (pies en y = 208, centro en x ≈ 88). */
const FEET_BODY = { width: 64, height: 36, offsetX: 56, offsetY: 172 } as const;
const SPRITE_HEIGHT = CREW_SHEET.frameHeight * CREW_SCALE * CREW_SHEET.origin.y;
const PLACEHOLDER_TINT: Record<CrewId, number> = { vega: 0x63b3ed, miga: 0xf6ad55, brote: 0x68d391, senda: 0xfc8181 };
const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;

/** Crea una vez (son globales del juego) las animaciones de reposo y caminata de un tripulante. */
export function ensureCrewAnimations(scene: Phaser.Scene, crewId: CrewId): boolean {
  const texture = crewTextureKey(crewId);
  if (!scene.textures.exists(texture)) return false;
  for (const direction of CREW_DIRECTIONS) {
    for (const kind of ['idle', 'walk'] as const) {
      const key = crewAnimKey(crewId, kind, direction);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texture, { frames: animFrames(kind, direction) }),
        frameRate: animFrameRate(kind),
        repeat: -1,
      });
    }
  }
  return true;
}

/**
 * Tripulante animado con su hoja de sprites (F2): reposo y caminata en 4 direcciones, a un ritmo proporcional a su
 * velocidad; burbuja con el motivo de su lentitud; marcador del tripulante activo. Si la hoja no cargó, usa el
 * círculo teñido provisional.
 */
export function createCrewSprite(scene: Phaser.Scene, crewId: CrewId, x: number, y: number): CrewSprite {
  const animated = ensureCrewAnimations(scene, crewId);
  const sprite = animated
    ? scene.physics.add.sprite(x, y, crewTextureKey(crewId), 0).setOrigin(CREW_SHEET.origin.x, CREW_SHEET.origin.y).setScale(CREW_SCALE)
    : scene.physics.add.sprite(x, y, TextureKeys.Player).setTint(PLACEHOLDER_TINT[crewId]);
  if (animated) sprite.setSize(FEET_BODY.width, FEET_BODY.height).setOffset(FEET_BODY.offsetX, FEET_BODY.offsetY);
  else sprite.setCircle(10, 2, 2);
  sprite.setCollideWorldBounds(true).setDepth(10);

  const ring = scene.add.ellipse(x, y, 34, 14).setStrokeStyle(2, 0xfbd38d).setVisible(false).setDepth(9);
  const arrow = scene.add.triangle(x, y, 0, 0, 12, 0, 6, 8, 0xfbd38d).setVisible(false).setDepth(12);
  const bubble = scene.add
    .text(x, y, '', { fontFamily: 'monospace', fontSize: '11px', color: '#1a202c', backgroundColor: '#fefcbf', padding: { x: 4, y: 2 } })
    .setOrigin(0.5, 1)
    .setVisible(false)
    .setDepth(13);
  let direction: CrewDirection = 'down';
  let reasonKey: string | undefined;
  let selected = false;

  const play = (kind: CrewAnimKind) => {
    const key = crewAnimKey(crewId, kind, direction);
    if (sprite.anims.currentAnim?.key !== key) sprite.anims.play(key, true);
  };
  const place = () => {
    const top = sprite.y - (animated ? SPRITE_HEIGHT : 14);
    ring.setPosition(sprite.x, sprite.y);
    arrow.setPosition(sprite.x, top - 6);
    bubble.setPosition(sprite.x, top - (selected ? 14 : 4));
    sprite.setDepth(10 + sprite.y / 10000);
  };

  return {
    crewId,
    sprite,
    sync(state) {
      const { x: vx, y: vy } = sprite.body?.velocity ?? { x: 0, y: 0 };
      const speed = Math.hypot(vx, vy);
      if (animated) {
        direction = directionFor(vx, vy, direction);
        play(speed > 1 && !state.resting ? 'walk' : 'idle');
        sprite.anims.timeScale = speed > 1 ? walkTimeScale(speed) : 1;
      } else if (speed > 0) {
        sprite.setRotation(Math.atan2(vy, vx));
      }
      sprite.setAlpha(state.resting ? 0.55 : 1);
      if (state.slowReasonKey !== reasonKey) {
        reasonKey = state.slowReasonKey;
        const visible = reasonKey !== undefined && hasKey(reasonKey);
        bubble.setText(visible ? t(reasonKey as TranslationKey, { name: NAMES[crewId] }) : '').setVisible(visible);
      }
      place();
    },
    setSelected(value) {
      selected = value;
      ring.setVisible(value);
      arrow.setVisible(value);
      place();
    },
    destroy() {
      ring.destroy();
      arrow.destroy();
      bubble.destroy();
      sprite.destroy();
    },
  };
}

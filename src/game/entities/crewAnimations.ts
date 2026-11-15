import type { CrewId } from '../../core/crew/types';
import { CREW_SHEET } from '../assets';

/** Filas de las hojas (`docs/*-sprites.png`): frente, espalda, perfil izquierdo y perfil derecho. */
export const CREW_DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
export type CrewDirection = (typeof CREW_DIRECTIONS)[number];
export type CrewAnimKind = 'idle' | 'walk';

/** En cada fila: los 3 primeros cuadros son el reposo (con parpadeo) y los 6 siguientes, la caminata. */
const FRAMES: Record<CrewAnimKind, { first: number; count: number; frameRate: number }> = {
  idle: { first: 0, count: 3, frameRate: 3 },
  walk: { first: 3, count: 6, frameRate: 10 },
};

/** Velocidad (px/s) a la que la caminata se ve a ritmo normal. */
export const WALK_REFERENCE_SPEED = 120;

export const crewAnimKey = (crewId: CrewId, kind: CrewAnimKind, direction: CrewDirection) => `crew-${crewId}-${kind}-${direction}`;

/** Índices de cuadro de una animación dentro de la hoja. */
export function animFrames(kind: CrewAnimKind, direction: CrewDirection): number[] {
  const row = CREW_DIRECTIONS.indexOf(direction);
  const { first, count } = FRAMES[kind];
  return Array.from({ length: count }, (_, i) => row * CREW_SHEET.columns + first + i);
}

export const animFrameRate = (kind: CrewAnimKind) => FRAMES[kind].frameRate;

/** Hacia dónde mira según la velocidad; quieto conserva la dirección anterior. */
export function directionFor(vx: number, vy: number, previous: CrewDirection): CrewDirection {
  if (vx === 0 && vy === 0) return previous;
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 'left' : 'right';
  return vy < 0 ? 'up' : 'down';
}

/** Ritmo de la caminata proporcional a la velocidad: un tripulante cansado camina (y se ve) más lento. */
export function walkTimeScale(speed: number): number {
  return Math.min(1.6, Math.max(0.4, speed / WALK_REFERENCE_SPEED));
}

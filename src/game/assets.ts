import type Phaser from 'phaser';
import { CREW_ROSTER } from '../content/crew';
import type { CrewId } from '../core/crew/types';

/**
 * Recursos externos que `Boot` carga antes de arrancar el juego. Viven en `public/assets/<dominio>/`
 * (docs/plan-de-trabajo.md §3.8). Las rutas son relativas para que funcione también bajo un subdirectorio.
 */
export type AssetEntry =
  | { kind: 'spritesheet'; key: string; url: string; frame: { frameWidth: number; frameHeight: number } }
  | { kind: 'image'; key: string; url: string }
  | { kind: 'audio'; key: string; urls: string[] };

/**
 * Geometría de las hojas de tripulantes (`public/assets/crew/`, pixel art regenerado a partir de
 * `docs/*-sprites.png`): 9 × 4 cuadros de 80×96 (40×48 px de arte ×2) con los pies en y = 94.
 * Filas: frente, espalda, perfil izquierdo, perfil derecho.
 */
export const CREW_SHEET = {
  frameWidth: 80,
  frameHeight: 96,
  columns: 9,
  rows: 4,
  origin: { x: 0.5, y: 94 / 96 },
} as const;

export const crewTextureKey = (crewId: CrewId): string => `crew-${crewId}`;

export const CREW_ASSETS: readonly AssetEntry[] = CREW_ROSTER.map(({ id }) => ({
  kind: 'spritesheet',
  key: crewTextureKey(id),
  url: `assets/crew/${id}.png`,
  frame: { frameWidth: CREW_SHEET.frameWidth, frameHeight: CREW_SHEET.frameHeight },
}));

/** Todo lo que carga `Boot`. Tiles y audio se agregan aquí cuando existan sus archivos. */
export const BOOT_ASSETS: readonly AssetEntry[] = [...CREW_ASSETS];

type AssetLoader = Pick<Phaser.Loader.LoaderPlugin, 'spritesheet' | 'image' | 'audio'>;

/** Encola cada recurso en el loader de Phaser según su tipo. */
export function queueAssets(load: AssetLoader, entries: readonly AssetEntry[]): void {
  for (const entry of entries) {
    if (entry.kind === 'spritesheet') load.spritesheet(entry.key, entry.url, entry.frame);
    else if (entry.kind === 'image') load.image(entry.key, entry.url);
    else load.audio(entry.key, entry.urls);
  }
}

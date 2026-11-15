import type Phaser from 'phaser';
import { CREW_ROSTER } from '../content/crew';
import type { CrewId } from '../core/crew/types';

/**
 * Recursos externos que `Boot` carga antes de arrancar el juego. Viven en `public/assets/<dominio>/`
 * (docs/plan-de-trabajo.md §3.8). Las rutas son relativas para que funcione también bajo un subdirectorio.
 */
export type AssetEntry =
  | { kind: 'spritesheet'; key: string; url: string; frame: { frameWidth: number; frameHeight: number }; normalMap?: string }
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
  // Normal map para la luz dinámica de los mapas (`scripts/art/normals.py`).
  normalMap: `assets/crew/${id}_n.png`,
  frame: { frameWidth: CREW_SHEET.frameWidth, frameHeight: CREW_SHEET.frameHeight },
}));

/** Pixel art del menú principal (`scripts/art/title-sky.py`; registro en docs/pixel-art.md). */
export const TitleTextures = {
  earthMap: 'title-earth-map',
  earthClouds: 'title-earth-clouds',
  marsMap: 'title-mars-map',
  iss: 'title-iss',
  meteor: 'title-meteor',
  meteorTrail: 'title-meteor-trail',
  asteroid: 'title-asteroid',
  ship: 'title-ship',
  stars: 'title-stars',
  opsis: 'title-opsis',
  logo: 'title-logo',
} as const;

const titleSheet = (key: string, file: string, frameWidth: number, frameHeight: number): AssetEntry => ({
  kind: 'spritesheet',
  key,
  url: `assets/ui/title/${file}`,
  frame: { frameWidth, frameHeight },
});

export const TITLE_ASSETS: readonly AssetEntry[] = [
  { kind: 'image', key: TitleTextures.earthMap, url: 'assets/ui/title/earth-map.png' },
  { kind: 'image', key: TitleTextures.earthClouds, url: 'assets/ui/title/earth-clouds.png' },
  { kind: 'image', key: TitleTextures.marsMap, url: 'assets/ui/title/mars-map.png' },
  { kind: 'image', key: TitleTextures.meteorTrail, url: 'assets/ui/title/meteor-trail.png' },
  { kind: 'image', key: TitleTextures.logo, url: 'assets/ui/title/logo.png' },
  titleSheet(TitleTextures.iss, 'iss.png', 42, 21),
  titleSheet(TitleTextures.meteor, 'meteor.png', 13, 13),
  titleSheet(TitleTextures.asteroid, 'asteroid.png', 20, 20),
  titleSheet(TitleTextures.ship, 'ship.png', 34, 11),
  titleSheet(TitleTextures.stars, 'stars.png', 7, 7),
  titleSheet(TitleTextures.opsis, 'opsis.png', 13, 9),
];

/** Pixel art de las escenas de vuelo (`scripts/art/flight.py`; registro en docs/pixel-art.md). */
export const FlightTextures = {
  rocket: 'flight-rocket',
  booster: 'flight-booster',
  tower: 'flight-tower',
  flame: 'flight-flame',
  smoke: 'flight-smoke',
  capsule: 'flight-capsule',
  shield: 'flight-shield',
  parachute: 'flight-parachute',
  lander: 'flight-lander',
  /** Escenografía generada de los despegues (`scripts/art/flight-scenery.py`). */
  earthFar: 'flight-earth-far',
  earthNear: 'flight-earth-near',
  marsFar: 'flight-mars-far',
  marsNear: 'flight-mars-near',
  core: 'flight-core',
  sideBooster: 'flight-side-booster',
  launchTower: 'flight-launch-tower',
  ascentVehicle: 'flight-ascent-vehicle',
  serviceMast: 'flight-service-mast',
  fuelTanks: 'flight-fuel-tanks',
  mothership: 'flight-mothership',
  van: 'flight-van',
  /** Aterrizaje en Marte y reentrada en la Tierra (generados, `scripts/art/flight-scenery.py`). */
  galePlain: 'flight-gale-plain',
  seaFar: 'flight-sea-far',
  entryCapsule: 'flight-entry-capsule',
  descentLander: 'flight-descent-lander',
  heatShield: 'flight-heat-shield',
  chute: 'flight-chute',
  seaCapsule: 'flight-sea-capsule',
  returnCapsule: 'flight-return-capsule',
  rescueShip: 'flight-rescue-ship',
  helicopter: 'flight-helicopter',
  chutes: 'flight-chutes',
} as const;

const SCENERY_FILES = {
  earthFar: 'earth-far',
  earthNear: 'earth-near',
  marsFar: 'mars-far',
  marsNear: 'mars-near',
  core: 'core',
  sideBooster: 'side-booster',
  launchTower: 'launch-tower',
  ascentVehicle: 'ascent-vehicle',
  serviceMast: 'service-mast',
  fuelTanks: 'fuel-tanks',
  mothership: 'mothership',
  van: 'van',
  galePlain: 'gale-plain',
  seaFar: 'sea-far',
  entryCapsule: 'entry-capsule',
  descentLander: 'descent-lander',
  heatShield: 'heat-shield',
  chute: 'chute',
  seaCapsule: 'sea-capsule',
  returnCapsule: 'return-capsule',
  rescueShip: 'rescue-ship',
  helicopter: 'helicopter',
  chutes: 'chutes',
} as const;

export const FLIGHT_ASSETS: readonly AssetEntry[] = [
  ...(['rocket', 'booster', 'tower', 'capsule', 'shield', 'parachute', 'lander'] as const).map(
    (name): AssetEntry => ({ kind: 'image', key: FlightTextures[name], url: `assets/ui/flight/${name}.png` }),
  ),
  { kind: 'spritesheet', key: FlightTextures.flame, url: 'assets/ui/flight/flame.png', frame: { frameWidth: 12, frameHeight: 20 } },
  { kind: 'spritesheet', key: FlightTextures.smoke, url: 'assets/ui/flight/smoke.png', frame: { frameWidth: 14, frameHeight: 14 } },
  ...Object.entries(SCENERY_FILES).map(
    ([name, file]): AssetEntry => ({ kind: 'image', key: FlightTextures[name as keyof typeof SCENERY_FILES], url: `assets/ui/flight/${file}.png` }),
  ),
];

/** Pixel art de la carga de vuelta, la bodega de casilleros (`scripts/art/cargo.py`; registro en docs/pixel-art.md). */
export const CargoTextures = {
  food: 'cargo-food',
  water: 'cargo-water',
  shield: 'cargo-shield',
  spare: 'cargo-spare',
  plant: 'cargo-plant',
  /** Roca según su tamaño en casilleros (1 × 1, 1 × 2 o 2 × 2). */
  rock: (w: number, h: number) => `cargo-rock-${w}x${h}`,
} as const;

export const CARGO_ASSETS: readonly AssetEntry[] = ['food', 'water', 'shield', 'spare', 'plant', 'rock-1x1', 'rock-1x2', 'rock-2x2'].map(
  (name): AssetEntry => ({ kind: 'image', key: `cargo-${name}`, url: `assets/ui/cargo/${name}.png` }),
);

/** Banderas del idioma en las opciones (`scripts/art/flags.py`; registro en docs/pixel-art.md), a resolución de arte. */
export const flagTextureKey = (locale: string): string => `flag-${locale}`;

export const FLAG_ASSETS: readonly AssetEntry[] = ['es', 'en'].map((locale): AssetEntry => ({ kind: 'image', key: flagTextureKey(locale), url: `assets/ui/flags/${locale}.png` }));

/** Todo lo que carga `Boot`. Tiles y audio se agregan aquí cuando existan sus archivos. */
export const BOOT_ASSETS: readonly AssetEntry[] = [...CREW_ASSETS, ...TITLE_ASSETS, ...FLIGHT_ASSETS, ...CARGO_ASSETS, ...FLAG_ASSETS];

type AssetLoader = Pick<Phaser.Loader.LoaderPlugin, 'spritesheet' | 'image' | 'audio'>;

/** Encola cada recurso en el loader de Phaser según su tipo. */
export function queueAssets(load: AssetLoader, entries: readonly AssetEntry[]): void {
  for (const entry of entries) {
    if (entry.kind === 'spritesheet') load.spritesheet({ key: entry.key, url: entry.url, frameConfig: entry.frame, ...(entry.normalMap ? { normalMap: entry.normalMap } : {}) });
    else if (entry.kind === 'image') load.image(entry.key, entry.url);
    else load.audio(entry.key, entry.urls);
  }
}

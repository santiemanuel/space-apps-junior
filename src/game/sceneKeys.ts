/**
 * Todas las escenas del juego, declaradas desde la Etapa 0 para que nadie tenga que editar este archivo
 * en paralelo. Dueños en docs/plan-de-trabajo.md §4.
 */
export const SceneKeys = {
  // Flujo de misión (Facundo)
  Boot: 'Boot',
  Title: 'Title',
  Loadout: 'Loadout',
  Maneuver: 'Maneuver',
  DataCard: 'DataCard',
  Report: 'Report',
  Pause: 'Pause',
  // Simulación (Santiago)
  Voyage: 'Voyage',
  Mars: 'Mars',
  Planning: 'Planning',
  Hud: 'Hud',
  MissionControl: 'MissionControl',
  DataPanel: 'DataPanel',
  /** Prototipo de base lunar: se reemplaza por Mars y se retira en la integración. */
  Habitat: 'Habitat',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

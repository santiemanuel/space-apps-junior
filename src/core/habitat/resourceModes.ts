/**
 * Modos de la consola de recursos (sala de mando; en Marte, la de energía): una prioridad a la vez, con lo que se
 * gana y lo que cuesta a la vista antes de confirmar [regla]. Textos en `hud.console.mode.<id>.*`.
 */
export type ResourceModeId = 'balanced' | 'saveEnergy' | 'science' | 'lifeSupport' | 'ration';

export interface ResourceMode {
  id: ResourceModeId;
  /** Consumo de los sistemas encendidos (×). */
  loadFactor: number;
  /** Aire y agua que se gastan (×): con el depurador y el reciclador a media máquina se gasta más. */
  lifeSupportFactor: number;
  /** Desgaste de los sistemas (×). */
  wearFactor: number;
  /** Ritmo de la ciencia (×): juntar muestras en Marte. */
  scienceFactor: number;
  /** Ración de comida (1 = completa): con menos, bajan el ánimo y la forma. */
  ration: number;
  /** Ánimo que suma por día a cada tripulante (hacer ciencia entusiasma). */
  moralePerDay: number;
}

/** Lo que una opción mueve, para dibujarlo con íconos y flechas ▲▼. */
export type ResourceGauge = 'energy' | 'lifeSupport' | 'food' | 'science' | 'wear' | 'morale' | 'condition';
export interface ModeEffect {
  gauge: ResourceGauge;
  /** Sube o baja lo que mide (la batería dura más = `up`; más desgaste = `up`). */
  direction: 'up' | 'down';
  /** Es bueno para la misión (verde) o es el costo (rojo). */
  good: boolean;
}

const BALANCED: ResourceMode = { id: 'balanced', loadFactor: 1, lifeSupportFactor: 1, wearFactor: 1, scienceFactor: 1, ration: 1, moralePerDay: 0 };

export const RESOURCE_MODES: readonly ResourceMode[] = [
  BALANCED,
  // La batería dura más, pero el depurador y el reciclador rinden menos: se gasta más aire y agua.
  { ...BALANCED, id: 'saveEnergy', loadFactor: 0.75, lifeSupportFactor: 1.15 },
  // Más muestras y mejor ánimo, pero más consumo y más desgaste.
  { ...BALANCED, id: 'science', loadFactor: 1.15, wearFactor: 1.5, scienceFactor: 1.5, moralePerDay: 0.02 },
  // Aire y agua seguros, pero la ciencia se frena.
  { ...BALANCED, id: 'lifeSupport', loadFactor: 1.05, lifeSupportFactor: 0.85, scienceFactor: 0.5 },
  // Los víveres rinden más días, pero con hambre bajan el ánimo y la forma.
  { ...BALANCED, id: 'ration', ration: 0.8 },
];

export const resourceMode = (id: ResourceModeId): ResourceMode => RESOURCE_MODES.find((m) => m.id === id) ?? BALANCED;

/** Qué sube y qué baja con un modo (primero lo que se gana, después lo que cuesta). */
export function modeEffects(mode: ResourceMode): ModeEffect[] {
  const effects: ModeEffect[] = [];
  const add = (gauge: ResourceGauge, direction: 'up' | 'down', good: boolean) => effects.push({ gauge, direction, good });
  if (mode.loadFactor < 1) add('energy', 'up', true);
  if (mode.loadFactor > 1) add('energy', 'down', false);
  if (mode.lifeSupportFactor < 1) add('lifeSupport', 'up', true);
  if (mode.lifeSupportFactor > 1) add('lifeSupport', 'down', false);
  if (mode.ration < 1) add('food', 'up', true);
  if (mode.scienceFactor > 1) add('science', 'up', true);
  if (mode.scienceFactor < 1) add('science', 'down', false);
  if (mode.moralePerDay > 0) add('morale', 'up', true);
  if (mode.wearFactor > 1) add('wear', 'up', false);
  if (mode.ration < 1) {
    add('morale', 'down', false);
    add('condition', 'down', false);
  }
  return effects.sort((a, b) => Number(b.good) - Number(a.good));
}

/** Tamaños de lo que se ve por las ventanas (sin Phaser, para poder probarlo). */

/** Radio del Sol en píxeles de arte a 1 UA: el tamaño aparente es proporcional a 1/distancia. */
export const SUN_RADIUS_AT_1AU = 6;
/** Radio del planeta de destino (px de arte) al salir y al llegar. */
export const PLANET_RADIUS = { from: 1, to: 6 } as const;

/** Radio del Sol (px de arte) a `au` unidades astronómicas: 6 cerca de la Tierra, 4 cerca de Marte. */
export const sunRadius = (au: number): number => Math.max(2, Math.round(SUN_RADIUS_AT_1AU / Math.max(0.3, au)));

/** Radio del planeta de destino según la fracción del tramo recorrida: crece cada vez más rápido al acercarse. */
export const planetRadius = (progress: number): number =>
  Math.round(PLANET_RADIUS.from + (PLANET_RADIUS.to - PLANET_RADIUS.from) * Math.min(1, Math.max(0, progress)) ** 2);

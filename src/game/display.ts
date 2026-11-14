/**
 * Resolución base y tamaño de tile, compartidos por mapas, UI, maniobras e imágenes generadas.
 * Contrato (docs/plan-de-trabajo.md §3.8): cambiarlo requiere acuerdo de ambos frentes.
 */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
/** Lado de un tile en px. La pantalla muestra 26,7 × 15 tiles; los mapas más grandes usan cámara con scroll. */
export const TILE = 48;

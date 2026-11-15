import type { TileRect } from '../habitat/layout';
import type { RealEvent } from '../events/RealEvent';
import type { HabitatContent } from '../habitat/types';

/** Reglas de la base en Gale que no tiene la nave (§4.4) [regla salvo que se indique]. */
export interface MarsContent extends HabitatContent {
  /** MOXIE escalado (kg de O2 por sol con el sistema sano). */
  moxieOxygenKgPerDay: number;
  greenhouse: {
    /** Comida que da el invernadero sano y encendido (kg por sol). */
    foodKgPerDay: number;
    /** Con la prioridad del invernadero (sacrificio de §3.5). */
    priorityMultiplier: number;
  };
  /**
   * Cosas que pasaron de verdad en Gale durante la estancia (p. ej. el azufre de Curiosity, 30/05/2024): al llegar el
   * reloj a su fecha se publican como tarjeta "Esto pasó de verdad" y quedan en el historial.
   */
  realMoments: readonly RealEvent[];
  /** Hora local de salida y puesta del Sol (se aproxima con la hora UTC del dato). La EVA es de día. */
  daylight: { sunriseHour: number; sunsetHour: number };
  samples: {
    count: number;
    minMassKg: number;
    maxMassKg: number;
    /** Valor científico = base + porTile × distancia a la esclusa: lo lejano vale más (§4.4). */
    baseValue: number;
    valuePerTile: number;
    /** Horas de trabajo (a velocidad 1) para juntar una muestra. */
    collectHours: number;
    /** A cuántos tiles de la muestra hay que estar para juntarla. */
    reachTiles: number;
    /** Distancia mínima a la esclusa (tiles) y cuánto se aleja por cada km que se erró el aterrizaje (§4.3). */
    minTiles: number;
    tilesPerLandingKm: number;
    /**
     * Dónde aparece cada tipo de roca (una franja del exterior por tipo). Las muestras se reparten entre las franjas
     * en orden, así que con tantas muestras como tipos o más hay una de cada tipo. Sin franjas, sin tipo.
     */
    rocks: readonly { rect: TileRect; rock: string }[];
  };
}

/** Punto de muestreo en el exterior, ubicado por semilla (§4.4). */
export interface SampleSite {
  id: string;
  x: number;
  y: number;
  massKg: number;
  value: number;
  /** Distancia a la esclusa (tiles). */
  distance: number;
  /** Tipo de roca: el de la franja donde está ('' si el contenido no define franjas). */
  rock: string;
}

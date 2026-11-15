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
}

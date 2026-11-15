import type { Point, TileRect } from '../habitat/layout';
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
  /**
   * Red eléctrica de la base (docs/mision_a_marte_referencias_topdown/plano-base-marte.png): tramos de cable entre los
   * paneles (`solar`), la base (`base`), la batería (`battery`), la nave y las cajas de empalme. Un tramo cortado no
   * lleva energía; si no queda camino de los paneles a la base o a la batería, no se carga nada, y si la batería no
   * llega a la base, de noche falta energía [regla].
   */
  grid: {
    /** `at`: donde se empalma el tramo cortado (tiles, afuera). */
    cables: readonly { id: string; from: string; to: string; at: Point }[];
    /** Lo que se pierde por cada tramo cortado mientras la energía da la vuelta por otro (0..1) [regla]. */
    lossPerCut: number;
    /** Hasta dónde llega la mano para reparar un tubo o un cable (tiles) [regla]. */
    repairReach: number;
  };
  /**
   * Polvo sobre los paneles solares [regla]: se junta de a poco (más rápido en una tormenta de polvo) y baja la
   * generación hasta `maxLoss`. Limpiarlos (una salida hasta `at`, a `reach` tiles) los deja como nuevos; se puede
   * desde que el polvo llega a `cleanFrom`.
   */
  panels: { at: Point; reach: number; dustPerSol: number; stormMultiplier: number; maxLoss: number; cleanFrom: number };
  /**
   * Preparar la base para la noche [regla]: se hace a la tarde (desde `fromHour`) en la sala de la batería. Esa noche
   * los sistemas y la calefacción gastan menos, pero el invernadero queda a oscuras y no crece.
   */
  night: { fromHour: number; loadFactor: number; heatingFactor: number };
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

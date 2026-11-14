import { clamp } from '../math';
import type { DataSource, EnvironmentSnapshot, NearEarthObject, SolarFlare } from './types';

const GOES_CLASS_FLUX: Record<string, number> = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };

/** Convierte una clase GOES ("M2.5") a flujo pico en W/m². */
export function flareClassToFlux(classType: string): number {
  const match = /^([ABCMX])(\d+(?:\.\d+)?)?$/i.exec(classType.trim());
  if (!match) throw new Error(`Clase de llamarada inválida: "${classType}"`);
  return GOES_CLASS_FLUX[match[1]!.toUpperCase()]! * Number(match[2] ?? 1);
}

/**
 * Riesgo de radiación 0..1 en escala logarítmica: C1≈0.1, M1≈0.4, X1≈0.7, X10≈1.
 * Abstracción de juego: las llamaradas M/X elevan la dosis en EVA y degradan electrónica.
 */
export function radiationRiskFromFlares(flares: readonly SolarFlare[]): number {
  if (flares.length === 0) return 0;
  const maxFlux = Math.max(...flares.map((f) => f.peakFlux));
  return clamp((Math.log10(maxFlux) + 6.333) / 3.333);
}

/** Amenaza 0..1 de un NEO: proximidad (log hasta 200 distancias lunares) × tamaño (log hasta ~1.6 km). */
export function neoThreat(neo: NearEarthObject): number {
  const proximity = clamp(1 - Math.log10(Math.max(1, neo.missDistanceLunar)) / Math.log10(200));
  const size = clamp(Math.log10(Math.max(1, neo.diameterMeters)) / 3.2);
  return clamp(proximity * size * (neo.hazardous ? 1.2 : 1));
}

export function debrisThreatFromNeos(neos: readonly NearEarthObject[]): number {
  return neos.reduce((max, neo) => Math.max(max, neoThreat(neo)), 0);
}

export function buildEnvironment(flares: SolarFlare[], neos: NearEarthObject[], source: DataSource): EnvironmentSnapshot {
  return {
    flares,
    neos,
    source,
    radiationRisk: radiationRiskFromFlares(flares),
    debrisThreat: debrisThreatFromNeos(neos),
  };
}

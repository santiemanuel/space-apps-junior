import { clamp } from '../math';
import type { DataSource, EnvironmentSnapshot, SolarFlare, SolarParticleEvent } from './types';

const GOES_CLASS_FLUX: Record<string, number> = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };

/** Umbrales de flujo de la escala NOAA de apagones de radio: R1=M1, R2=M5, R3=X1, R4=X10, R5=X20. */
const RADIO_BLACKOUT_THRESHOLDS = [1e-5, 5e-5, 1e-4, 1e-3, 2e-3] as const;

/** Regla de juego: con un evento SEP en la ventana, el riesgo de radiación es al menos este valor. */
export const SEP_RISK_FLOOR = 0.7;

/** Convierte una clase GOES ("M2.5") a flujo pico en W/m². */
export function flareClassToFlux(classType: string): number {
  const match = /^([ABCMX])(\d+(?:\.\d+)?)?$/i.exec(classType.trim());
  if (!match) throw new Error(`Clase de llamarada inválida: "${classType}"`);
  return GOES_CLASS_FLUX[match[1]!.toUpperCase()]! * Number(match[2] ?? 1);
}

const maxFlux = (flares: readonly SolarFlare[]): number => Math.max(0, ...flares.map((f) => f.peakFlux));

/** Nivel NOAA R (0..5) de la llamarada más intensa. */
export function radioBlackoutLevel(flares: readonly SolarFlare[]): number {
  const flux = maxFlux(flares);
  return RADIO_BLACKOUT_THRESHOLDS.filter((threshold) => flux >= threshold).length;
}

/**
 * Riesgo de radiación 0..1. Llamaradas en escala logarítmica (C1≈0.1, M1≈0.4, X1≈0.7, X10≈1);
 * cada evento SEP (protones energéticos) eleva el riesgo a SEP_RISK_FLOOR o más.
 */
export function radiationRisk(flares: readonly SolarFlare[], particleEvents: readonly SolarParticleEvent[]): number {
  const flux = maxFlux(flares);
  const flareRisk = flux > 0 ? clamp((Math.log10(flux) + 6.333) / 3.333) : 0;
  const sepDays = new Set(particleEvents.map((e) => e.eventTime.slice(0, 10))).size;
  const sepRisk = sepDays > 0 ? clamp(SEP_RISK_FLOOR + 0.05 * (sepDays - 1)) : 0;
  return Math.max(flareRisk, sepRisk);
}

export function buildEnvironment(
  flares: SolarFlare[],
  particleEvents: SolarParticleEvent[],
  source: DataSource,
  window: EnvironmentSnapshot['window'],
): EnvironmentSnapshot {
  return {
    source,
    window,
    flares,
    particleEvents,
    radiationRisk: radiationRisk(flares, particleEvents),
    radioBlackout: radioBlackoutLevel(flares),
  };
}

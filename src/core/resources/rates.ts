/**
 * Tasas de consumo por tripulante y día, aproximadas a partir del
 * NASA Life Support Baseline Values and Assumptions Document (BVAD, NASA/TP-2015-218570).
 */
export const BVAD_RATES_PER_CREW_DAY = {
  oxygen: 0.82, // kg O2
  water: 2.5, // kg agua potable + preparación de alimentos
  food: 1.8, // kg alimento empaquetado
} as const;

/** Parámetros energéticos del hábitat (escala reducida inspirada en la ISS). */
export const HABITAT_POWER = {
  batteryCapacityKwh: 120,
  solarGenerationKw: 12,
  baseLoadKw: 9,
} as const;

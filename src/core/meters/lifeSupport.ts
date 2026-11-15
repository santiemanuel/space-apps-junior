import type { SystemStatus } from '../systems/types';
import type { LifeSupportMeter } from './types';
import type { MeterRules } from './rules';

export interface LifeSupportInput {
  crewCount: number;
  hours: number;
  scrubber: SystemStatus;
  waterRecycler: SystemStatus;
  /** Horas de EVA sumadas de todos los tripulantes en el paso. */
  evaHours?: number;
  /** O2 fabricado en el paso (MOXIE en Marte, kg). */
  oxygenProducedKg?: number;
  /** Racionamiento de aire y agua de la falla en cascada (1 = normal, §3.5). */
  consumptionFactor?: number;
}

export interface LifeSupportStep {
  lifeSupport: LifeSupportMeter;
  /** O2 o agua que faltó (kg / L): la usa la falla en cascada (§3.5). */
  oxygenShortKg: number;
  waterShortL: number;
}

/** Agua bebida y usada en el paso (L): 2,5 L por tripulante y día más 240 mL por hora de EVA. */
export const waterUsedL = (rules: MeterRules, crewCount: number, hours: number, evaHours = 0): number =>
  (rules.lifeSupport.waterLPerCrewDay * crewCount * hours) / 24 + rules.lifeSupport.waterLPerEvaHour * evaHours;

/** El CO2 sube a una tasa fija si el depurador falla; sano, vuelve al valor nominal (§3.2). */
export function nextCo2(rules: MeterRules, co2MmHg: number, scrubber: SystemStatus, crewCount: number, hours: number): number {
  const { co2RatePerDayByStatus, co2NominalMmHg } = rules.lifeSupport;
  const delta = (co2RatePerDayByStatus[scrubber] * (crewCount / 4) * hours) / 24;
  if (delta < 0) return Math.max(Math.min(co2MmHg, co2NominalMmHg), co2MmHg + delta);
  return co2MmHg + delta;
}

export function stepLifeSupport(rules: MeterRules, ls: LifeSupportMeter, input: LifeSupportInput): LifeSupportStep {
  const { crewCount, hours, scrubber, waterRecycler, evaHours = 0, oxygenProducedKg = 0, consumptionFactor = 1 } = input;
  const oxygen = ls.oxygenKg + oxygenProducedKg - (rules.lifeSupport.oxygenKgPerCrewDay * crewCount * hours * consumptionFactor) / 24;
  const lostWater =
    waterUsedL(rules, crewCount, hours, evaHours) * consumptionFactor * (1 - rules.lifeSupport.recyclingByStatus[waterRecycler]);
  const water = ls.waterL - lostWater;
  return {
    lifeSupport: {
      oxygenKg: Math.max(0, oxygen),
      waterL: Math.max(0, water),
      co2MmHg: nextCo2(rules, ls.co2MmHg, scrubber, crewCount, hours),
    },
    oxygenShortKg: Math.max(0, -oxygen),
    waterShortL: Math.max(0, -water),
  };
}

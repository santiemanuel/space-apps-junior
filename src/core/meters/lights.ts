import type { CrewMemberState } from '../crew/types';
import type { SystemStatus } from '../systems/types';
import { careerFraction } from './dose';
import type { MeterRules } from './rules';
import type { MeterState } from './types';

/** Semáforo sin porcentajes (§3.6). */
export type Light = SystemStatus;

const RANK: Record<Light, number> = { green: 0, yellow: 1, red: 2 };
const worst = (...lights: Light[]): Light => lights.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'green');

/** Más es mejor: verde desde `green`, amarillo desde `yellow`, si no rojo. */
const atLeast = (value: number, green: number, yellow: number): Light =>
  value >= green ? 'green' : value >= yellow ? 'yellow' : 'red';
/** Menos es mejor. */
const atMost = (value: number, green: number, yellow: number): Light =>
  value <= green ? 'green' : value <= yellow ? 'yellow' : 'red';

/** Umbrales del semáforo [regla, a ajustar con pruebas con niños]. */
export const LIGHT_THRESHOLDS = {
  batteryFraction: { green: 0.4, yellow: 0.15 },
  /** Días de O2 o de agua que quedan. */
  reserveDays: { green: 5, yellow: 2 },
  /** mmHg por encima del límite que todavía es amarillo. */
  co2YellowMarginMmHg: 2,
  condition: { green: 0.6, yellow: 0.3 },
  fatigue: { green: 0.6, yellow: 0.85 },
  nutrition: { green: 0.9, yellow: 0.6 },
  careerFraction: { green: 0.5, yellow: 0.8 },
} as const;

export const energyLight = (m: MeterState): Light => {
  const t = LIGHT_THRESHOLDS.batteryFraction;
  return atLeast(m.energy.batteryKwh / m.energy.capacityKwh, t.green, t.yellow);
};

export function lifeSupportLight(rules: MeterRules, m: MeterState, crewCount: number): Light {
  const t = LIGHT_THRESHOLDS.reserveDays;
  const ls = rules.lifeSupport;
  const n = Math.max(1, crewCount);
  return worst(
    atLeast(m.lifeSupport.oxygenKg / (ls.oxygenKgPerCrewDay * n), t.green, t.yellow),
    atLeast(m.lifeSupport.waterL / (ls.waterLPerCrewDay * n), t.green, t.yellow),
    atMost(m.lifeSupport.co2MmHg, ls.co2LimitMmHg, ls.co2LimitMmHg + LIGHT_THRESHOLDS.co2YellowMarginMmHg),
  );
}

/** Los cuatro íconos de la barra de salud (§3.2) y su peor estado. */
export interface HealthLights {
  dose: Light;
  condition: Light;
  nutrition: Light;
  fatigue: Light;
  overall: Light;
}

export function healthLights(rules: MeterRules, member: CrewMemberState): HealthLights {
  const t = LIGHT_THRESHOLDS;
  const lights = {
    dose: atMost(careerFraction(rules, member.doseMSv), t.careerFraction.green, t.careerFraction.yellow),
    condition: atLeast(member.condition, t.condition.green, t.condition.yellow),
    nutrition: atLeast(member.nutrition, t.nutrition.green, t.nutrition.yellow),
    fatigue: atMost(member.fatigue, t.fatigue.green, t.fatigue.yellow),
  };
  return { ...lights, overall: worst(lights.dose, lights.condition, lights.nutrition, lights.fatigue) };
}

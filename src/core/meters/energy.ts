import type { UvIndex } from '../environment/series';
import type { EnergyMeter } from './types';
import type { MeterRules } from './rules';

/** Distancia media de Marte al Sol usada por el juego (UA): llega el 43 % de la luz [dato]. */
export const MARS_DISTANCE_AU = 1.52;

export interface SolarInput {
  /** Potencia de los paneles a 1 UA, sin polvo y a pleno sol (kW). */
  panelKwAt1Au: number;
  distanceAu: number;
  /** f_polvo (1 sin polvo). */
  dustFactor?: number;
  /** f_luz: fracción de luz (0 de noche, 1 a pleno sol; promedio del día en avance rápido). */
  lightFactor?: number;
}

/** generación = P_paneles × 1/r² × f_polvo × f_luz (§3.2). */
export const solarGenerationKw = ({ panelKwAt1Au, distanceAu, dustFactor = 1, lightFactor = 1 }: SolarInput): number =>
  (panelKwAt1Au * dustFactor * lightFactor) / distanceAu ** 2;

/** f_polvo a partir del UV de REMS; sin dato se supone cielo limpio. */
export const dustFactorFromUv = (rules: MeterRules, uv: UvIndex | null): number =>
  uv ? rules.energy.dustFactorByUv[uv] : 1;

/** calefacción = k × (T_interior − T_mín) (§3.2); nunca negativa. */
export const heatingKw = (rules: MeterRules, minTempC: number): number =>
  Math.max(0, rules.energy.heatingKwPerDegree * (rules.energy.interiorTempC - minTempC));

/** Distancia al Sol en un viaje: interpolación lineal entre la Tierra (1 UA) y Marte [regla]. */
export const cruiseDistanceAu = (progress: number, leg: 'out' | 'back'): number => {
  const p = Math.min(1, Math.max(0, progress));
  const t = leg === 'out' ? p : 1 - p;
  return 1 + (MARS_DISTANCE_AU - 1) * t;
};

export interface EnergyStep {
  energy: EnergyMeter;
  /** Energía que faltó con la batería vacía (kWh): la usa la falla en cascada (§3.5). */
  deficitKwh: number;
  /** Energía que sobró con la batería llena (kWh). */
  wastedKwh: number;
}

/** batería += (generación − consumo) × Δt, con tope de capacidad (§3.2). */
export function stepEnergy(energy: EnergyMeter, generationKw: number, loadKw: number, hours: number): EnergyStep {
  const next = energy.batteryKwh + (generationKw - loadKw) * hours;
  return {
    energy: { ...energy, batteryKwh: Math.min(energy.capacityKwh, Math.max(0, next)) },
    deficitKwh: Math.max(0, -next),
    wastedKwh: Math.max(0, next - energy.capacityKwh),
  };
}

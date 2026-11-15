import bvad from '../../datasets/curated/life-support-bvad.json';
import conjunctions from '../../datasets/curated/mars-conjunctions.json';
import std3001 from '../../datasets/curated/nasa-std-3001.json';
import osdr from '../../datasets/curated/osdr-facts.json';
import radiation from '../../datasets/curated/radiation-dose.json';
import type { SolarConjunction } from '../core/incidents/timeline';

/** Consumo por tripulante y día (kg) — NASA BVAD. */
export const LIFE_SUPPORT_RATES = {
  oxygen: bvad.perCrewMemberPerDay.oxygenKg,
  water: bvad.perCrewMemberPerDay.waterKg,
  food: bvad.perCrewMemberPerDay.foodKg,
} as const;

export type SurfaceSite = keyof typeof radiation.doseRates;

export interface DoseReference {
  mSvPerDay: number;
  source: string;
  url: string;
}

export const DOSE_RATES: Record<SurfaceSite, DoseReference> = radiation.doseRates;
export const CAREER_DOSE_LIMIT_MSV = radiation.careerLimit.mSv;
export const CHEST_XRAY_MSV = radiation.reference.chestXrayMSv;

/** Factores de calidad Q (dosis absorbida → equivalente): Hassler 2014, Zeitlin 2013 y la regla del SEP. */
export const QUALITY_FACTORS = {
  marsSurface: radiation.qualityFactors.marsSurface.q,
  cruise: radiation.qualityFactors.cruise.q,
  solarParticleEvent: radiation.qualityFactors.solarParticleEvent.q,
} as const;

/** Normas NASA-STD-3001 y valores de BVAD que usan los medidores (citas en el JSON). */
export const HUMAN_STANDARDS = {
  co2LimitMmHg: std3001.co2LimitMmHg.value,
  potableWaterLPerCrewDay: std3001.potableWaterLPerCrewDay.value,
  evaWaterLPerHour: std3001.evaWaterLPerHour.value,
  kcalPerCrewDay: std3001.kcalPerCrewDay.value,
  waterRecycling: { min: std3001.waterRecycling.min, max: std3001.waterRecycling.max },
  exerciseHoursPerDay: std3001.exerciseHoursPerDay.value,
} as const;

export interface ScienceFact {
  topic: string;
  accession: string;
  url: string;
  text: string;
}

export const SCIENCE_FACTS: readonly ScienceFact[] = osdr.facts;

/** Dato científico real (OSDR) sobre un tema; `random` en [0, 1). */
export function scienceFactFor(topic: string, random: () => number): ScienceFact | undefined {
  const matches = SCIENCE_FACTS.filter((fact) => fact.topic === topic);
  return matches[Math.floor(random() * matches.length)];
}

/** Moratorias de comandos de la NASA por conjunción solar de Marte (fechas inclusivas, citas en el JSON). */
export const MARS_CONJUNCTIONS: readonly SolarConjunction[] = conjunctions.conjunctions.map(({ id, start, end, url }) => ({ id, start, end, sourceUrl: url }));

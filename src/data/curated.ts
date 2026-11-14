import bvad from '../../datasets/curated/life-support-bvad.json';
import osdr from '../../datasets/curated/osdr-facts.json';
import radiation from '../../datasets/curated/radiation-dose.json';

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

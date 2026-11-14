import type { MeterRules } from './rules';

/** Dónde está un tripulante a efectos del blindaje (§3.2). */
export type ShieldZone = 'exterior' | 'habitat' | 'shelter';

/** Zona de blindaje a partir de la ubicación libre de `CrewMemberState.location`. */
export const shieldZoneOf = (location: string): ShieldZone =>
  location === 'shelter' ? 'shelter' : location === 'exterior' || location === 'eva' ? 'exterior' : 'habitat';

/** f_blindaje: exterior 1 · hábitat 0,6 · refugio de 0,6 (vacío) a 0,2 (escudo de agua lleno). */
export function shieldingFactor(rules: MeterRules, zone: ShieldZone, waterShield: number): number {
  const d = rules.dose;
  if (zone === 'exterior') return d.shieldExterior;
  if (zone === 'habitat') return d.shieldHabitat;
  const fill = Math.min(1, Math.max(0, waterShield));
  return d.shieldShelterEmpty + (d.shieldShelterFull - d.shieldShelterEmpty) * fill;
}

/** Q según el lugar; durante un SEP se simplifica a un Q menor (§3.2). */
export const qualityFactor = (rules: MeterRules, place: 'mars' | 'cruise', sepActive: boolean): number =>
  sepActive ? rules.dose.qSep : place === 'mars' ? rules.dose.qMars : rules.dose.qCruise;

/** dosis_mSv = tasa_μGy/h × f_blindaje × Q × Δt_h / 1000 (§3.2). */
export const doseMSv = (rateUGyH: number, shielding: number, q: number, hours: number): number =>
  (rateUGyH * shielding * q * hours) / 1000;

/** Dosis en radiografías de tórax (0,1 mSv cada una), para niños. */
export const chestXrays = (rules: MeterRules, mSv: number): number => mSv / rules.dose.chestXrayMSv;

/** Fracción (0..1+) del límite de carrera de 600 mSv. */
export const careerFraction = (rules: MeterRules, mSv: number): number => mSv / rules.dose.careerLimitMSv;

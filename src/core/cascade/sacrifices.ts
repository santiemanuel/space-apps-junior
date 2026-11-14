import type { CrewId } from '../crew/types';
import type { CascadeMeter, CascadeSacrifice } from '../incidents/types';
import { clamp } from '../math';
import { doseMSv } from '../meters/dose';
import type { MeterRules } from '../meters/rules';
import type { GameState } from '../state/types';
import type { CascadeRules } from './rules';
import type { CascadeFlags, CascadeState } from './types';

export type SacrificeId =
  | 'cleanPanels'
  | 'moxieOff'
  | 'unpowerShelter'
  | 'drinkWaterShield'
  | 'boostRecycler'
  | 'boostMoxie'
  | 'medicCare'
  | 'reduceRoutines'
  | 'extraRations'
  | 'prioritizeGreenhouse';

export type Place = 'mars' | 'cruise';

/**
 * Sacrificio de la tabla de §3.5. Cada uno muestra su coste antes de elegirlo (§3.6): las claves de texto
 * son `incidents.sacrifice.<id>.title` y `incidents.sacrifice.<id>.cost`.
 * "Dejar muestras para llevar más comida" se decide en la carga de vuelta (Loadout, §4.5), no aquí.
 */
export interface SacrificeDefinition {
  id: SacrificeId;
  meter: CascadeMeter;
  places: readonly Place[];
  /** Se puede revertir (vuelve a la situación anterior sin recuperar lo gastado). */
  toggle: boolean;
}

export const SACRIFICES: readonly SacrificeDefinition[] = [
  { id: 'cleanPanels', meter: 'energy', places: ['mars'], toggle: false },
  { id: 'moxieOff', meter: 'energy', places: ['mars'], toggle: true },
  { id: 'unpowerShelter', meter: 'energy', places: ['mars', 'cruise'], toggle: true },
  { id: 'drinkWaterShield', meter: 'lifeSupport', places: ['mars', 'cruise'], toggle: false },
  { id: 'boostRecycler', meter: 'lifeSupport', places: ['mars', 'cruise'], toggle: true },
  { id: 'boostMoxie', meter: 'lifeSupport', places: ['mars'], toggle: true },
  { id: 'medicCare', meter: 'health', places: ['mars', 'cruise'], toggle: false },
  { id: 'reduceRoutines', meter: 'health', places: ['mars', 'cruise'], toggle: true },
  { id: 'extraRations', meter: 'health', places: ['mars', 'cruise'], toggle: false },
  { id: 'prioritizeGreenhouse', meter: 'food', places: ['mars'], toggle: true },
];

const TOGGLE_FLAG: Partial<Record<SacrificeId, keyof CascadeFlags>> = {
  moxieOff: 'moxieOff',
  unpowerShelter: 'shelterUnpowered',
  boostRecycler: 'recyclerBoost',
  boostMoxie: 'moxieBoost',
  reduceRoutines: 'reduceRoutines',
  prioritizeGreenhouse: 'greenhousePriority',
};

const MEDIC: CrewId = 'senda';

const firstResting = (state: GameState): CrewId | undefined => state.crew.find((m) => m.resting)?.id;

/** ¿Se puede elegir ahora? Sólo con su medidor en emergencia, en el lugar adecuado y si tiene sentido. */
export function canSacrifice(cascade: CascadeState, state: GameState, place: Place, id: SacrificeId): boolean {
  const def = SACRIFICES.find((s) => s.id === id)!;
  if (!def.places.includes(place) || !cascade.emergencies.some((e) => e.meter === def.meter)) return false;
  const flag = TOGGLE_FLAG[id];
  if (flag && cascade.flags[flag]) return false;
  const medic = state.crew.find((m) => m.id === MEDIC);
  switch (id) {
    case 'drinkWaterShield':
      return state.waterShield > 0;
    case 'cleanPanels':
      return state.crew.some((m) => !m.resting);
    case 'medicCare':
      return !!medic && !medic.resting && cascade.flags.medicCaring === null && state.crew.some((m) => m.resting && m.id !== MEDIC);
    case 'extraRations':
      return state.inventory.foodKg > 0 && firstResting(state) !== undefined;
    default:
      return true;
  }
}

export const availableSacrifices = (cascade: CascadeState, state: GameState, place: Place): SacrificeDefinition[] =>
  SACRIFICES.filter((s) => canSacrifice(cascade, state, place, s.id));

export interface SacrificeOptions {
  /** Quién hace la EVA de limpieza o a quién se atiende (por defecto, el primero que corresponda). */
  crewId?: CrewId;
  /** Tasa de dosis real del momento (μGy/h): la EVA de limpieza la recibe sin blindaje. */
  doseRateUGyH?: number;
}

export interface SacrificeResult {
  cascade: CascadeState;
  state: GameState;
  /** Payload de `cascade:sacrifice`. */
  event: CascadeSacrifice;
}

/** Aplica un sacrificio: el efecto se gana ya y el coste se paga ya o mientras siga activo. */
export function applySacrifice(
  rules: CascadeRules,
  meterRules: MeterRules,
  cascade: CascadeState,
  state: GameState,
  id: SacrificeId,
  options: SacrificeOptions = {},
): SacrificeResult {
  const def = SACRIFICES.find((s) => s.id === id)!;
  const s = rules.sacrifices;
  let flags = cascade.flags;
  let next = state;
  const flag = TOGGLE_FLAG[id];
  if (flag) flags = { ...flags, [flag]: true };

  switch (id) {
    case 'drinkWaterShield':
      next = {
        ...state,
        waterShield: 0,
        meters: {
          ...state.meters,
          lifeSupport: { ...state.meters.lifeSupport, waterL: state.meters.lifeSupport.waterL + s.shelterWaterL * state.waterShield },
        },
      };
      break;
    case 'cleanPanels': {
      const who = options.crewId ?? state.crew.find((m) => !m.resting)!.id;
      const dose = doseMSv(options.doseRateUGyH ?? 0, meterRules.dose.shieldExterior, meterRules.dose.qMars, s.cleanPanels.evaHours);
      next = {
        ...state,
        crew: state.crew.map((m) =>
          m.id === who ? { ...m, fatigue: clamp(m.fatigue + s.cleanPanels.fatigue), doseMSv: m.doseMSv + dose } : m,
        ),
      };
      flags = { ...flags, panelsCleanUntil: new Date(Date.parse(state.simDate) + s.cleanPanels.cleanHours * 3_600_000).toISOString() };
      break;
    }
    case 'medicCare': {
      const patient = options.crewId ?? state.crew.find((m) => m.resting && m.id !== MEDIC)!.id;
      flags = { ...flags, medicCaring: patient };
      next = {
        ...state,
        crew: state.crew.map((m) =>
          m.id === MEDIC
            ? { ...m, taskId: null, location: 'infirmary' }
            : m.resting
              ? m
              : { ...m, fatigue: clamp(m.fatigue + s.medicCareFatigueForOthers) },
        ),
      };
      break;
    }
    case 'extraRations': {
      const patient = options.crewId ?? firstResting(state)!;
      const food = Math.min(state.inventory.foodKg, s.extraRation.foodKg);
      next = {
        ...state,
        inventory: { ...state.inventory, foodKg: state.inventory.foodKg - food },
        crew: state.crew.map((m) =>
          m.id === patient ? { ...m, nutrition: 1, condition: clamp(m.condition + s.extraRation.condition * (food / s.extraRation.foodKg)) } : m,
        ),
      };
      break;
    }
    default:
      break;
  }

  next = {
    ...next,
    history: [...next.history, { simDate: state.simDate, phase: state.phase, kind: 'cascade', key: `incidents.sacrifice.${id}.title` }],
  };
  return { cascade: { ...cascade, flags }, state: next, event: { id, meter: def.meter } };
}

/** Revierte un sacrificio que se puede deshacer (p. ej. volver a encender MOXIE). */
export function revertSacrifice(cascade: CascadeState, id: SacrificeId): CascadeState {
  const flag = TOGGLE_FLAG[id];
  return flag ? { ...cascade, flags: { ...cascade.flags, [flag]: false } } : cascade;
}

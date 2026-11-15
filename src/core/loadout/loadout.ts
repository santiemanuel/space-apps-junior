import type { LoadoutProfile, PhaseResult } from '../flow/types';
import { clamp } from '../math';
import type { GameState, Sample } from '../state/types';
import type { SystemStatus } from '../systems/types';

/** Un perfil de carga de ida (game-design §4.1): cuánto de cada cosa y qué riesgo deja. */
export interface OutboundProfile {
  id: LoadoutProfile;
  waterL: number;
  /** Llenado del escudo de agua del refugio (0..1). */
  waterShield: number;
  spares: number;
  foodKg: number;
  /** Cuánto lleva de cada cosa, de 1 (+) a 3 (+++), para mostrarlo sin números. */
  levels: { water: 1 | 2 | 3; spares: 1 | 2 | 3; food: 1 | 2 | 3 };
  /** Semáforo de cada riesgo (§3.6): verde es poco riesgo. */
  lights: { radiation: SystemStatus; repairs: SystemStatus };
}

const round = (value: number, step: number) => Math.round(value / step) * step;

function logged(state: GameState, key: string, data: Record<string, number | string | boolean>): GameState {
  state.history.push({ simDate: state.simDate, phase: state.phase, kind: 'loadout', key, data });
  return state;
}

/** Aplica el perfil elegido: agua (bebida y blindaje), repuestos y comida para todo el viaje. */
export function applyOutboundLoadout(state: GameState, profile: OutboundProfile): GameState {
  const next = structuredClone(state);
  next.loadout = profile.id;
  next.meters.lifeSupport.waterL = profile.waterL;
  next.waterShield = profile.waterShield;
  next.inventory.spares = profile.spares;
  next.inventory.foodKg = profile.foodKg;
  return logged(next, `outbound.${profile.id}`, { profile: profile.id });
}

export function outboundResult(state: GameState, profile: OutboundProfile): PhaseResult {
  return { phase: 'prep', outcome: 'completed', state: applyOutboundLoadout(state, profile), achievements: [] };
}

// --- Carga de vuelta (§4.5): muestras contra suministros, con un límite de masa. ---

/** Reglas de la carga de vuelta [regla]: el límite de masa se ajusta con pruebas de juego (plan §11). */
export interface ReturnRules {
  massLimitKg: number;
  spareKg: number;
  /** Litros de agua del escudo lleno. */
  shieldFullL: number;
  /** Lo que conviene llevar para volver tranquilos (semáforo en verde). */
  recommended: { foodKg: number; waterL: number; shield: number; spares: number };
  steps: { foodKg: number; waterL: number; shield: number };
}

/** Lo que el jugador sube a la nave. `samples`: cuántas de las mejores muestras lleva. */
export interface ReturnCargo {
  samples: number;
  foodKg: number;
  waterL: number;
  shield: number;
  spares: number;
}

export type CargoField = keyof ReturnCargo;
export const CARGO_FIELDS: readonly CargoField[] = ['samples', 'foodKg', 'waterL', 'shield', 'spares'];

/** Lo que hay en la base para cargar. El agua es una sola: se reparte entre bebida y escudo. */
export interface ReturnAvailable {
  /** Ordenadas de más a menos valiosa (y más liviana primero si valen lo mismo). */
  samples: Sample[];
  foodKg: number;
  waterPoolL: number;
  spares: number;
}

export function availableForReturn(state: GameState, rules: ReturnRules): ReturnAvailable {
  const samples = [...state.inventory.samples].sort((a, b) => b.value - a.value || a.massKg - b.massKg || a.id.localeCompare(b.id));
  return {
    samples,
    foodKg: state.inventory.foodKg,
    waterPoolL: state.meters.lifeSupport.waterL + state.waterShield * rules.shieldFullL,
    spares: state.inventory.spares,
  };
}

const waterUsed = (cargo: ReturnCargo, rules: ReturnRules) => cargo.waterL + cargo.shield * rules.shieldFullL;

export function samplesMass(cargo: ReturnCargo, available: ReturnAvailable): number {
  return available.samples.slice(0, cargo.samples).reduce((sum, s) => sum + s.massKg, 0);
}

export function cargoMass(cargo: ReturnCargo, available: ReturnAvailable, rules: ReturnRules): number {
  return samplesMass(cargo, available) + cargo.foodKg + waterUsed(cargo, rules) + cargo.spares * rules.spareKg;
}

export function withinLimit(cargo: ReturnCargo, available: ReturnAvailable, rules: ReturnRules): boolean {
  return cargoMass(cargo, available, rules) <= rules.massLimitKg + 1e-9;
}

/** Valor científico total de las muestras elegidas. */
export function samplesValue(cargo: ReturnCargo, available: ReturnAvailable): number {
  return available.samples.slice(0, cargo.samples).reduce((sum, s) => sum + s.value, 0);
}

/** Suma o resta un paso en un campo, sin pasarse de lo que hay (el agua de bebida y la del escudo comparten). */
export function adjustCargo(cargo: ReturnCargo, field: CargoField, delta: number, available: ReturnAvailable, rules: ReturnRules): ReturnCargo {
  const next = { ...cargo };
  const freeWater = (current: number, perUnit: number) => (available.waterPoolL - waterUsed(cargo, rules)) / perUnit + current;
  switch (field) {
    case 'samples':
      next.samples = clamp(cargo.samples + Math.sign(delta), 0, available.samples.length);
      break;
    case 'spares':
      next.spares = clamp(cargo.spares + Math.sign(delta), 0, available.spares);
      break;
    case 'foodKg':
      next.foodKg = clamp(round(cargo.foodKg + delta * rules.steps.foodKg, rules.steps.foodKg), 0, available.foodKg);
      break;
    case 'waterL':
      next.waterL = clamp(round(cargo.waterL + delta * rules.steps.waterL, rules.steps.waterL), 0, freeWater(cargo.waterL, 1));
      break;
    case 'shield':
      next.shield = clamp(round(cargo.shield + delta * rules.steps.shield, rules.steps.shield), 0, Math.min(1, freeWater(cargo.shield, rules.shieldFullL)));
      break;
  }
  return next;
}

/** Punto de partida: lo recomendado (si alcanza) y todas las muestras que entran sin pasarse del límite. */
export function initialReturnCargo(available: ReturnAvailable, rules: ReturnRules): ReturnCargo {
  const { recommended } = rules;
  const waterL = Math.min(recommended.waterL, available.waterPoolL);
  const shield = clamp(Math.min(recommended.shield, (available.waterPoolL - waterL) / rules.shieldFullL));
  const cargo: ReturnCargo = {
    samples: 0,
    foodKg: Math.min(recommended.foodKg, available.foodKg),
    waterL,
    shield,
    spares: Math.min(recommended.spares, available.spares),
  };
  while (cargo.samples < available.samples.length && withinLimit({ ...cargo, samples: cargo.samples + 1 }, available, rules)) {
    cargo.samples++;
  }
  return cargo;
}

/** Semáforo de un suministro frente a lo recomendado: verde si alcanza, amarillo si falta poco, rojo si falta mucho. */
export function supplyLight(cargo: ReturnCargo, field: Exclude<CargoField, 'samples'>, rules: ReturnRules): SystemStatus {
  const recommended = rules.recommended[field];
  const ratio = recommended > 0 ? cargo[field] / recommended : 1;
  return ratio >= 1 - 1e-9 ? 'green' : ratio >= 0.6 ? 'yellow' : 'red';
}

/** Sube la carga a la nave: lo que no entra queda en Marte. */
export function applyReturnCargo(state: GameState, cargo: ReturnCargo, rules: ReturnRules): GameState {
  const available = availableForReturn(state, rules);
  const next = structuredClone(state);
  next.inventory.samples = structuredClone(available.samples.slice(0, cargo.samples));
  next.inventory.foodKg = cargo.foodKg;
  next.inventory.spares = cargo.spares;
  next.meters.lifeSupport.waterL = cargo.waterL;
  next.waterShield = cargo.shield;
  return logged(next, 'return', {
    samples: cargo.samples,
    massKg: Math.round(cargoMass(cargo, available, rules)),
    shield: cargo.shield,
  });
}

export function returnResult(state: GameState, cargo: ReturnCargo, rules: ReturnRules): PhaseResult {
  if (!withinLimit(cargo, availableForReturn(state, rules), rules)) throw new Error('returnResult: la carga supera el límite');
  return { phase: 'marsAscent', outcome: 'completed', state: applyReturnCargo(state, cargo, rules), achievements: [] };
}

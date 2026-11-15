import { clamp } from '../math';
import type { CrewMemberState, CrewRole } from './types';

/** Pesos y límites de la eficiencia (game-design §3.3) [regla]. */
export const EFFICIENCY_RULES = {
  fatigue: 0.25,
  condition: 0.25,
  highCo2: 0.15,
  morale: 0.1,
  min: 0.5,
  co2LimitMmHg: 3,
  /** Reacción: de 1 s (bien) a 6 s (agotado). */
  reactionBaseS: 1,
  reactionRangeS: 5,
  optimalRouteFrom: 0.8,
  /** Una ruta a ciegas es más larga que la óptima [regla]. */
  blindRouteFactor: 1.4,
  specialtyMultiplier: 1.5,
  /** Por debajo de esta eficiencia la interfaz explica el motivo. */
  showReasonBelow: 0.95,
} as const;

/** Categorías de tarea para la especialidad (§3.3). */
export type TaskCategory =
  | 'energy'
  | 'scrubber'
  | 'leak'
  | 'trajectory'
  | 'food'
  | 'greenhouse'
  | 'water'
  | 'pests'
  | 'samples'
  | 'exercise'
  | 'infirmary'
  | 'comms'
  | 'general';

export const ROLE_SPECIALTIES: Record<CrewRole, readonly TaskCategory[]> = {
  commander: [],
  engineer: ['energy', 'scrubber', 'leak', 'trajectory'],
  botanist: ['food', 'greenhouse', 'water', 'pests'],
  geoMedic: ['samples', 'exercise', 'infirmary'],
};

const penalties = (m: CrewMemberState, co2MmHg: number) => ({
  fatigue: EFFICIENCY_RULES.fatigue * clamp(m.fatigue),
  condition: EFFICIENCY_RULES.condition * (1 - clamp(m.condition)),
  co2: co2MmHg > EFFICIENCY_RULES.co2LimitMmHg ? EFFICIENCY_RULES.highCo2 : 0,
  morale: EFFICIENCY_RULES.morale * (1 - clamp(m.morale)),
});

/** eficiencia = clamp(1 − 0,25·fatiga − 0,25·(1 − condición) − 0,15·[CO2 > 3] − 0,10·(1 − ánimo), 0,5, 1). */
export function efficiency(member: CrewMemberState, co2MmHg: number): number {
  const p = penalties(member, co2MmHg);
  return clamp(1 - p.fatigue - p.condition - p.co2 - p.morale, EFFICIENCY_RULES.min, 1);
}

/** reacción = 1 s + 5 s × (1 − eficiencia) / 0,5. */
export const reactionSeconds = (eff: number): number =>
  EFFICIENCY_RULES.reactionBaseS + (EFFICIENCY_RULES.reactionRangeS * (1 - eff)) / (1 - EFFICIENCY_RULES.min);

/** Ruta óptima con eficiencia ≥ 0,8; si no, la más corta a ciegas. */
export const usesOptimalRoute = (eff: number): boolean => eff >= EFFICIENCY_RULES.optimalRouteFrom;

/** Velocidad de trabajo: ×1,5 en la especialidad, × eficiencia; 0 si está en reposo. Vale también para el jugador. */
export function workSpeed(member: CrewMemberState, task: TaskCategory, co2MmHg: number): number {
  if (member.resting) return 0;
  const specialty = ROLE_SPECIALTIES[member.role].includes(task) ? EFFICIENCY_RULES.specialtyMultiplier : 1;
  return specialty * efficiency(member, co2MmHg);
}

/** Velocidad de movimiento (fracción de la velocidad base): misma eficiencia que el trabajo. */
export const moveSpeedFactor = (member: CrewMemberState, co2MmHg: number): number =>
  member.resting ? 0 : efficiency(member, co2MmHg);

/** Segundos reales hasta llegar a un lugar: reacción + recorrido (más largo si va a ciegas). */
export function arrivalSeconds(member: CrewMemberState, co2MmHg: number, optimalDistance: number, baseSpeed: number): number {
  if (member.resting) return Infinity;
  const eff = efficiency(member, co2MmHg);
  const distance = usesOptimalRoute(eff) ? optimalDistance : optimalDistance * EFFICIENCY_RULES.blindRouteFactor;
  return reactionSeconds(eff) + distance / (baseSpeed * eff);
}

/**
 * Clave del motivo principal de la lentitud (la interfaz siempre explica por qué, §3.3).
 * Se guarda en `CrewMemberState.slowReasonKey`; la capa game/ la traduce con `{name}`.
 */
export function slowReasonKey(member: CrewMemberState, co2MmHg: number): string | undefined {
  if (member.resting) return 'hud.crewSlow.resting';
  if (efficiency(member, co2MmHg) >= EFFICIENCY_RULES.showReasonBelow) return undefined;
  const p = penalties(member, co2MmHg);
  const [reason] = (Object.entries(p) as [keyof typeof p, number][]).sort((a, b) => b[1] - a[1])[0]!;
  return `hud.crewSlow.${reason}`;
}

/** Actualiza el motivo de lentitud de toda la tripulación. */
export const withSlowReasons = (crew: readonly CrewMemberState[], co2MmHg: number): CrewMemberState[] =>
  crew.map((m) => {
    const key = slowReasonKey(m, co2MmHg);
    const { slowReasonKey: _old, ...rest } = m;
    return key ? { ...rest, slowReasonKey: key } : rest;
  });

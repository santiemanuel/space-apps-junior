import type { CrewId } from '../crew/types';
import type { RealEvent } from '../events/RealEvent';
import { arrivalFor } from '../maneuvers/ManeuverRun';
import type { CrewArrival } from '../maneuvers/types';
import type { GameState, MissionLogEntry } from '../state/types';

export type MissionOutcome = 'completed' | 'suspended';

/** Logro (§5). Si se deduce del estado final tiene `earned`; si no, lo otorga la fase que lo vive (`PhaseResult`). */
export interface AchievementDefinition {
  id: string;
  earned?: (state: GameState, outcome: MissionOutcome) => boolean;
}

/** Umbrales del informe [regla], más las referencias de dosis [dato]. */
export interface ReportRules {
  /** Condición física mínima para contar como "sana". */
  healthyCondition: number;
  /** Dosis máxima (mSv) de un tripulante para la estrella de dosis baja. */
  lowDoseMSv: number;
  chestXrayMSv: number;
  careerLimitMSv: number;
  walkCondition: number;
}

export interface CrewReport {
  id: CrewId;
  doseMSv: number;
  /** Dosis expresada en radiografías de tórax (§3.2). */
  xrays: number;
  /** Porcentaje del límite de carrera. */
  careerPercent: number;
  /** Cómo bajó de la cápsula; `null` si la misión se suspendió. */
  arrival: CrewArrival | null;
  resting: boolean;
}

export interface MissionReport {
  outcome: MissionOutcome;
  stars: { healthyCrew: boolean; lowDose: boolean; samplesHome: boolean };
  starCount: number;
  achievements: { id: string; earned: boolean }[];
  crew: CrewReport[];
  /** Muestras que llegaron a la Tierra (sólo cuentan al volver, §5). */
  samples: { count: number; value: number; massKg: number };
  landingDistanceKm: number | null;
  /** Decisiones e hitos en orden, sin el detalle de cada etapa de maniobra. */
  decisions: MissionLogEntry[];
  /** Tarjetas "Esto pasó de verdad" vividas en la partida. */
  realEvents: RealEvent[];
}

// --- Eventos reales en el historial: `MissionLogEntry.data` sólo admite valores simples. ---

/** Anota un evento real vivido en el historial, para el informe y el guardado. */
export function realEventLogEntry(event: RealEvent, state: Pick<GameState, 'simDate' | 'phase'>): MissionLogEntry {
  const params = Object.fromEntries(Object.entries(event.kidValueParams ?? {}).map(([k, v]) => [`param.${k}`, v]));
  return {
    simDate: state.simDate,
    phase: state.phase,
    kind: 'realEvent',
    key: event.id,
    data: {
      date: event.date,
      instrument: event.instrument,
      mission: event.mission,
      agency: event.agency,
      value: event.value,
      unit: event.unit,
      kidValueKey: event.kidValueKey,
      explanationKey: event.explanationKey,
      sourceUrl: event.sourceUrl,
      capped: event.capped ?? false,
      ...params,
    },
  };
}

export function realEventFromLog(entry: MissionLogEntry): RealEvent | null {
  const d = entry.data;
  if (entry.kind !== 'realEvent' || !d) return null;
  const text = (key: string) => String(d[key] ?? '');
  const params = Object.entries(d).filter(([k]) => k.startsWith('param.'));
  return {
    id: entry.key,
    date: text('date'),
    instrument: text('instrument'),
    mission: text('mission'),
    agency: text('agency'),
    value: Number(d.value ?? 0),
    unit: text('unit'),
    kidValueKey: text('kidValueKey'),
    explanationKey: text('explanationKey'),
    sourceUrl: text('sourceUrl'),
    capped: d.capped === true,
    ...(params.length ? { kidValueParams: Object.fromEntries(params.map(([k, v]) => [k.slice(6), v as string | number])) } : {}),
  };
}

/** Detalle de una etapa de maniobra (`landing.parachute`): queda fuera del resumen de decisiones. */
const isStageEntry = (entry: MissionLogEntry) => entry.kind === 'maneuver' && entry.key.includes('.');

/** Decisiones e hitos en orden; de cada incidente queda la primera anotación (la simulación anota aviso, impacto y fin). */
function decisionsOf(history: readonly MissionLogEntry[]): MissionLogEntry[] {
  const seen = new Set<string | number | boolean>();
  return history.filter((e) => {
    if (e.kind === 'realEvent' || isStageEntry(e)) return false;
    const incidentId = e.kind === 'incident' ? e.data?.incidentId : undefined;
    if (incidentId === undefined) return true;
    if (seen.has(incidentId)) return false;
    seen.add(incidentId);
    return true;
  });
}

/** Informe final (§5): 3 estrellas, logros, tripulación, decisiones y datos reales vividos. */
export function buildReport(
  state: GameState,
  outcome: MissionOutcome,
  achievements: readonly AchievementDefinition[],
  rules: ReportRules,
): MissionReport {
  const completed = outcome === 'completed';
  const crew = state.crew.map((m) => ({
    id: m.id,
    doseMSv: m.doseMSv,
    xrays: Math.round(m.doseMSv / rules.chestXrayMSv),
    careerPercent: Math.round((m.doseMSv / rules.careerLimitMSv) * 100),
    arrival: completed ? arrivalFor(m.condition, rules) : null,
    resting: m.resting,
  }));
  const samples = completed ? state.inventory.samples : [];
  const stars = {
    healthyCrew: completed && state.crew.every((m) => m.condition >= rules.healthyCondition && !m.resting),
    lowDose: state.crew.every((m) => m.doseMSv <= rules.lowDoseMSv),
    samplesHome: samples.length > 0,
  };
  const granted = new Set(state.achievements ?? []);
  return {
    outcome,
    stars,
    starCount: Object.values(stars).filter(Boolean).length,
    achievements: achievements.map((a) => ({ id: a.id, earned: granted.has(a.id) || (a.earned?.(state, outcome) ?? false) })),
    crew,
    samples: {
      count: samples.length,
      value: samples.reduce((sum, s) => sum + s.value, 0),
      massKg: Math.round(samples.reduce((sum, s) => sum + s.massKg, 0) * 10) / 10,
    },
    landingDistanceKm: state.landingDistanceKm,
    decisions: decisionsOf(state.history),
    realEvents: state.history.map(realEventFromLog).filter((e): e is RealEvent => e !== null),
  };
}

/** Ids de los logros ganados, para guardarlos en la progresión. */
export const earnedAchievements = (report: MissionReport) => report.achievements.filter((a) => a.earned).map((a) => a.id);

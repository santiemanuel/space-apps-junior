import type { AlertLevel } from '../meters/types';
import type { CrewActivity } from '../meters/step';
import type { GameState } from '../state/types';
import type { CrewId, CrewMemberState } from './types';

/**
 * Rutina diaria de un tripulante, asignada en la planificación (§3.1, §3.3). Las horas suman 24;
 * `taskId` es la tarea de trabajo (la decide cada escena) y `callsHomePerDay` las llamadas a la Tierra.
 */
export interface Routine {
  sleepHours: number;
  exerciseHours: number;
  workHours: number;
  taskId: string | null;
  callsHomePerDay: number;
}

/** Rutina sana por defecto: 8 h de sueño, 2 h de ejercicio (ISS), 10 h de trabajo [regla]. */
export const DEFAULT_ROUTINE: Routine = { sleepHours: 8, exerciseHours: 2, workHours: 10, taskId: null, callsHomePerDay: 0.5 };

export type RoutinePlan = Record<CrewId, Routine>;

export const defaultRoutines = (crew: readonly CrewMemberState[]): RoutinePlan =>
  Object.fromEntries(crew.map((m) => [m.id, DEFAULT_ROUTINE])) as RoutinePlan;

/** Valida que una rutina sea posible (sin horas negativas ni más de 24 h). */
export const isValidRoutine = (r: Routine): boolean =>
  [r.sleepHours, r.exerciseHours, r.workHours, r.callsHomePerDay].every((h) => h >= 0) &&
  r.sleepHours + r.exerciseHours + r.workHours <= 24;

/**
 * Actividad de cada tripulante en un paso de `hours` según su rutina, para `stepMeters`.
 * En reposo sólo duerme. `workFactor` < 1 si se redujeron las rutinas (sacrificio de §3.5).
 */
export function routineActivities(
  crew: readonly CrewMemberState[],
  plan: RoutinePlan,
  hours: number,
  workFactor = 1,
): Partial<Record<CrewId, CrewActivity>> {
  const share = hours / 24;
  return Object.fromEntries(
    crew.map((m) => {
      const r = plan[m.id] ?? DEFAULT_ROUTINE;
      const activity: CrewActivity = m.resting
        ? { sleepHours: hours }
        : {
            sleepHours: r.sleepHours * share,
            exerciseHours: r.exerciseHours * share,
            workHours: r.workHours * share * workFactor,
            callsHome: r.callsHomePerDay * share,
          };
      return [m.id, activity];
    }),
  );
}

/**
 * Quiénes van solos al refugio cuando llega el impacto. Los automáticos no deciden riesgos (§3.3): sin modo
 * ayuda nadie va hasta que el jugador lo ordene; con modo ayuda van todos los que no reposan, salvo el jugador.
 */
export function autoShelterCrew(state: GameState, level: AlertLevel): CrewId[] {
  if (!state.helpMode || level !== 'impact') return [];
  return state.crew.filter((m) => !m.resting && m.id !== state.activeCrewId && m.location !== 'shelter').map((m) => m.id);
}

/** Tarea de trabajo que se puede asignar a la rutina (las de mantenimiento de cada escena). */
export interface AssignableTask {
  id: string;
  category: string;
  /** El sistema ya está gastado o pronto lo va a estar: va primero. */
  urgent?: boolean;
}

/**
 * Rutinas automáticas (reemplazan la planificación a mano): cada tripulante trabaja en la tarea de su especialidad
 * (las urgentes primero, sin repetir), duerme más si está cansado, hace más ejercicio si está débil y llama más a
 * casa si está desanimado [regla]. En reposo sólo duerme.
 */
export function smartRoutines(
  crew: readonly CrewMemberState[],
  tasks: readonly AssignableTask[],
  specialties: Readonly<Record<string, readonly string[]>>,
): RoutinePlan {
  const free = [...tasks].sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)));
  const take = (match: (t: AssignableTask) => boolean): string | null => {
    const index = free.findIndex(match);
    return index === -1 ? null : free.splice(index, 1)[0]!.id;
  };
  // Primero los especialistas, después el resto (la comandante cubre lo que falte).
  const order = [...crew].sort((a, b) => (specialties[b.role]?.length ?? 0) - (specialties[a.role]?.length ?? 0));
  const plan = {} as RoutinePlan;
  for (const m of order) {
    if (m.resting) {
      plan[m.id] = { sleepHours: 12, exerciseHours: 0, workHours: 0, taskId: null, callsHomePerDay: 0 };
      continue;
    }
    const mine = specialties[m.role] ?? [];
    const taskId = take((t) => mine.includes(t.category)) ?? (mine.length ? null : take((t) => Boolean(t.urgent)));
    const sleepHours = m.fatigue > 0.6 ? 10 : m.fatigue > 0.3 ? 9 : 8;
    const exerciseHours = m.condition < 0.7 ? 3 : 2;
    plan[m.id] = {
      sleepHours,
      exerciseHours,
      workHours: Math.max(0, 20 - sleepHours - exerciseHours),
      taskId,
      callsHomePerDay: m.morale < 0.6 ? 1 : 0.5,
    };
  }
  return plan;
}

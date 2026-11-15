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

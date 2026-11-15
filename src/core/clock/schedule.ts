import type { SpaceStorm } from '../environment/storms';
import type { MissionLength } from '../flow/types';
import { MissionClock, type ClockAlert, type PlayWindow } from './MissionClock';

const DAY_MS = 86_400_000;

/** Período real de una fase (ISO 8601, fin excluido). */
export interface PhaseWindow {
  start: string;
  end: string;
}

/** Fases con calendario que corre (las maniobras ocurren en un día puntual). */
export type TimedPhase = 'cruiseOut' | 'mars' | 'cruiseBack';

export interface PhaseCalendar {
  windows: Record<TimedPhase, PhaseWindow>;
  /** Jornadas (o soles) que se juegan a tiempo normal, por duración de misión (§2.1). */
  playedDays: Record<MissionLength, Record<TimedPhase, number>>;
  /** Horas simuladas por segundo real cuando se juega una jornada (§3.1). */
  playHoursPerSecond: Record<TimedPhase, number>;
  /**
   * Velocidad de una jornada sin nada que hacer, si la fase no usa la de siempre (`CLOCK_RULES.idleHoursPerSecond`).
   * Igual a la de juego: la fase dura siempre lo mismo (la estancia en Gale).
   */
  idleHoursPerSecond?: Partial<Record<TimedPhase, number>>;
  /** Velocidad mientras se duerme, si la fase no usa la de siempre (`CLOCK_RULES.sleepHoursPerSecond`). */
  sleepHoursPerSecond?: Partial<Record<TimedPhase, number>>;
}

/** `count` jornadas de 24 h repartidas de forma pareja desde el inicio de la ventana. */
export function evenPlayWindows(window: PhaseWindow, count: number): PlayWindow[] {
  const start = Date.parse(window.start);
  const totalDays = Math.floor((Date.parse(window.end) - start) / DAY_MS);
  const n = Math.min(count, totalDays);
  return Array.from({ length: n }, (_, i) => {
    const dayStart = start + Math.floor((i * totalDays) / n) * DAY_MS;
    return { start: new Date(dayStart).toISOString(), end: new Date(dayStart + DAY_MS).toISOString() };
  });
}

/** Una tormenta real frena el reloj: Alerta en la detección de DONKI, Impacto al subir la dosis. */
export const stormAlert = (storm: SpaceStorm): ClockAlert => ({
  id: storm.id,
  warnAt: storm.warnAt,
  impactAt: storm.impactAt,
  endAt: storm.endAt,
  reasonKey: 'incidents.radiationStorm',
});

export interface PhaseClockOptions {
  calendar: PhaseCalendar;
  phase: TimedPhase;
  length: MissionLength;
  alerts?: readonly ClockAlert[];
  /** Para continuar una partida guardada a mitad de la fase. */
  from?: string;
}

/** Reloj de una fase con su calendario, sus jornadas jugadas y los avisos que caen en ella. */
export function createPhaseClock({ calendar, phase, length, alerts = [], from }: PhaseClockOptions): MissionClock {
  const window = calendar.windows[phase];
  return new MissionClock({
    start: from ?? window.start,
    end: window.end,
    alerts,
    playWindows: evenPlayWindows(window, calendar.playedDays[length][phase]),
    playHoursPerSecond: calendar.playHoursPerSecond[phase],
    ...(calendar.idleHoursPerSecond?.[phase] !== undefined ? { idleHoursPerSecond: calendar.idleHoursPerSecond[phase] } : {}),
    ...(calendar.sleepHoursPerSecond?.[phase] !== undefined ? { sleepHoursPerSecond: calendar.sleepHoursPerSecond[phase] } : {}),
  });
}

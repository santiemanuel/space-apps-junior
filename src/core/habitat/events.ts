import type { SacrificeId } from '../cascade/sacrifices';
import type { ActiveEmergency } from '../cascade/types';
import type { TimedPhase } from '../clock/schedule';
import type { RoutinePlan } from '../crew/routines';
import type { DailyDose, MarsWeather } from '../environment/series';
import type { AlertLevel } from '../meters/types';
import type { GameState } from '../state/types';
import type { HabitatTask } from './types';
import type { PendingDecision } from './HabitatSession';

/** Pedido a Control de Misión (§3.7): la respuesta llega tras la demora de ida y vuelta de la señal. */
export interface MissionControlRequest {
  id: string;
  kind: 'advice' | 'diagnosis';
  incidentId: string;
  /** Clave del título del incidente (para mostrarlo aunque ya se haya resuelto). */
  textKey: string;
  askedAt: string;
  arrivesAt: string;
  arrived: boolean;
  /** Consejo: la respuesta que recomienda Control de Misión. */
  responseId?: string;
}

export interface PowerLoad {
  id: string;
  kw: number;
  on: boolean;
  /** Soporte vital: no se puede desenchufar. */
  essential: boolean;
}

/** Lo que muestran las escenas superpuestas en cada cuadro (JSON puro). */
export interface SimSnapshot {
  phase: TimedPhase;
  place: 'cruise' | 'mars';
  simDate: string;
  window: { start: string; end: string };
  progress: number;
  level: AlertLevel;
  reasonKey: string;
  manual: boolean;
  paused: boolean;
  state: GameState;
  dose: DailyDose;
  decisions: PendingDecision[];
  /** Modo ayuda: pista de Control de Misión para cada decisión, sin demora (§3.3). */
  hints: { incidentId: string; responseId: string }[];
  emergencies: readonly ActiveEmergency[];
  sacrifices: SacrificeId[];
  routines: RoutinePlan;
  tasks: readonly HabitatTask[];
  power: {
    loads: PowerLoad[];
    generationKw: number;
    loadKw: number;
    /** Enchufes libres para los sistemas que se pueden desenchufar: los que alcanza a dar el sol de hoy. */
    sockets: number;
  };
  missionControl: {
    /** Clave del motivo por el que no se puede pedir nada ahora, o null. */
    blockedKey: string | null;
    /** Demora de ida de la señal (s). */
    delaySeconds: number;
    /** Sin Control de Misión: conjunción solar o radio apagada. Sólo mensajes guardados. */
    offline: boolean;
    requests: MissionControlRequest[];
  };
  mars?: {
    weather: MarsWeather;
    /** Pronóstico: el dato real del sol siguiente. */
    forecast: MarsWeather;
    daylight: boolean;
    evaOpen: boolean;
    samples: { count: number; total: number; kg: number; value: number };
  };
}

/**
 * Bus propio de la simulación (dueño: Santiago) entre las escenas de mapa y las superpuestas (`Hud`, `Planning`,
 * `MissionControl`, `DataPanel`). No toca `GameEvents.ts` (congelado); se puede unir a él en la integración.
 */
export interface SimulationEvents {
  'sim:snapshot': SimSnapshot;
  'sim:pause': { paused: boolean };
  'sim:respond': { incidentId: string; responseId: string };
  'sim:sacrifice': { id: SacrificeId };
  'sim:routines': RoutinePlan;
  /** Tablero de energía: sistemas desenchufados. */
  'sim:loads': { off: string[] };
  'sim:ask': { kind: 'advice' | 'diagnosis'; incidentId: string };
}

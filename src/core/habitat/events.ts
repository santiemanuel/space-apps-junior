import type { SacrificeId } from '../cascade/sacrifices';
import type { ActiveEmergency } from '../cascade/types';
import type { TimedPhase } from '../clock/schedule';
import type { RoutinePlan } from '../crew/routines';
import type { DailyDose, MarsWeather } from '../environment/series';
import type { AlertLevel } from '../meters/types';
import type { GameState } from '../state/types';
import type { Point } from './layout';
import type { HabitatTask } from './types';
import type { Departure, PendingDecision, ZoneMinigame } from './HabitatSession';
import type { MarsGrid } from '../mars/MarsSession';

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
  /** Dónde está el tripulante del jugador (tiles): lo marca "estás acá" en el mapa del cráter. */
  activePosition: Point;
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
    /** Sala del tablero y si el jugador está lejos de ella (no puede desenchufar nada). */
    panelZone?: string;
    panelBlocked?: boolean;
    /** Falta energía ahora: la batería no está conectada y el sol no alcanza. */
    blackout: boolean;
  };
  /** Embarque final: la carga del depósito y quiénes ya subieron a la nave. */
  departure?: Departure;
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
    /** `stored`: en el depósito · `carried`: las lleva alguien encima (se dejan al entrar al depósito). */
    samples: { count: number; total: number; kg: number; value: number; stored: number; carried: number };
    /** Red eléctrica: tubos rotos, cables cortados, fusible y cómo llega la energía. */
    grid: MarsGrid;
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
  /** El mapa abre el minijuego de una zona (E); `reward` y `badge` ya vienen traducidos para el cartel final. */
  'sim:minigame': ZoneMinigame & { reward: string; badge: string | null };
  /** Minijuego ganado: la sesión termina la tarea de la zona. */
  'sim:minigameWon': { zone: string };
  /** Se cerró el minijuego (ganado o con Esc). */
  'sim:minigameClosed': { zone: string };
}

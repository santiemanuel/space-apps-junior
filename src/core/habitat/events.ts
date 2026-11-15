import type { SacrificeId } from '../cascade/sacrifices';
import type { ActiveEmergency } from '../cascade/types';
import type { TimedPhase } from '../clock/schedule';
import type { RoutinePlan } from '../crew/routines';
import type { DailyDose, MarsWeather } from '../environment/series';
import type { AlertLevel } from '../meters/types';
import type { GameState } from '../state/types';
import type { Point } from './layout';
import type { HabitatTask } from './types';
import type { Departure, PendingDecision, StormInfo, ZoneMinigame } from './HabitatSession';
import type { ResourceModeId } from './resourceModes';
import type { MarsGrid } from '../mars/MarsSession';
import type { CrewPresence } from '../crew/presence';
import type { CrewId } from '../crew/types';

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

/** Algo que el jugador tiene que hacer (mientras haya algo, la jornada va a tiempo normal). */
export type TodoItem =
  | { kind: 'decision' | 'emergency' | 'shelter' | 'departure' | 'sleep' }
  | { kind: 'repair'; textKey: string; /** Automático que ya está yendo a repararlo. */ helper?: CrewId }
  | {
      kind: 'task';
      taskId: string;
      zone: string;
      /** A quién nombra el motivo (la llamada a casa: quien está más desanimado). */
      crewId?: CrewId;
      /** Apareció al azar: horas simuladas hasta que un automático la tome, y quién la tomó. */
      chore?: { hoursLeft: number; helper?: CrewId };
    };

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
  /** Jornada sin nada que hacer: el reloj corre rápido hasta que aparezca algo (§3.1). */
  idle: boolean;
  /** Lo que falta hacer para que la jornada avance rápido (tareas del tripulante activo, incidentes…). */
  todo: TodoItem[];
  /** El tripulante del jugador duerme en la enfermería hasta el día siguiente. */
  asleep: boolean;
  /** Estado de cada tripulante (en línea, ausente, no molestar, desconectado), como en Discord. */
  presence: Record<CrewId, CrewPresence>;
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
  /** Consola de recursos: la prioridad elegida y si el jugador está lejos de ella (no puede cambiarla). */
  resources: { mode: ResourceModeId; blocked: boolean };
  /** Tormenta de radiación en camino o en curso. */
  storm: StormInfo | null;
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
    /** Muestras de plantas del invernadero (van al depósito, como las rocas). */
    plants: number;
    /** Ya están todas las rocas: se puede empezar el embarque antes de que termine la estancia (F). */
    canLeave: boolean;
    /** Red eléctrica: tubos rotos, cables cortados, fusible y cómo llega la energía. */
    grid: MarsGrid;
    /** Polvo sobre los paneles (0..1), la parte de la generación que se pierde y si ya vale la pena limpiarlos. */
    panels: { dust: number; loss: number; canClean: boolean };
    /** La base está preparada para la noche (gasta menos hasta que salga el Sol). */
    nightReady: boolean;
    /** Es la tarde y todavía no se preparó: se puede hacer ahora en la sala de la batería. */
    nightPrepOpen: boolean;
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
  /** Tablero de energía: sistemas desenchufados. */
  'sim:loads': { off: string[] };
  'sim:ask': { kind: 'advice' | 'diagnosis'; incidentId: string };
  /** Consola de recursos: prioridad elegida. */
  'sim:mode': { id: ResourceModeId };
  /** Botón de despertarse en la pantalla de dormir (lo mismo que Z o E). */
  'sim:wake': Record<string, never>;
  /** El mapa abre la consola de recursos (E junto a ella). */
  'sim:console': Record<string, never>;
  /** Aviso sobre el mapa (ya traducido), con un ícono del tablero o una imagen chica de un atlas. */
  'sim:toast': { text: string; icon?: string; image?: { key: string; frame: string } };
  /** El mapa abre el minijuego de una zona (E); `reward` y `badge` ya vienen traducidos para el cartel final. */
  'sim:minigame': ZoneMinigame & { reward: string; badge: string | null };
  /** Minijuego ganado: la sesión termina la tarea de la zona. */
  'sim:minigameWon': { zone: string };
  /** Se cerró el minijuego (ganado o con Esc). */
  'sim:minigameClosed': { zone: string };
}

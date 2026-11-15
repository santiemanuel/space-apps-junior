import { applyEmergencyEffects, cascadeAdjustments, updateCascade, type CascadeAdjustments } from '../cascade/cascade';
import {
  applySacrifice,
  availableSacrifices,
  revertSacrifice,
  type Place,
  type SacrificeDefinition,
  type SacrificeId,
} from '../cascade/sacrifices';
import { initialCascade, type ActiveEmergency, type CascadeEvent, type CascadeState } from '../cascade/types';
import type { ClockEvent, MissionClock } from '../clock/MissionClock';
import { createPhaseClock, type PhaseWindow, type TimedPhase } from '../clock/schedule';
import { efficiency, reactionSeconds, ROLE_SPECIALTIES, usesOptimalRoute, withSlowReasons, workSpeed, type TaskCategory } from '../crew/efficiency';
import { DEFAULT_ROUTINE, routineActivities, smartRoutines, type RoutinePlan } from '../crew/routines';
import type { CrewId, CrewMemberState } from '../crew/types';
import type { DailyDose } from '../environment/series';
import type { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { PhaseResult } from '../flow/types';
import type { IncidentActivity, } from '../incidents/planner';
import type { IncidentResponse } from '../incidents/definitions';
import {
  canRespond,
  definitionOf,
  incidentModifiers,
  incidentResponses,
  initialPlanner,
  phaseTimeline,
  publishIncidentEvents,
  respondToIncident,
  stepIncidents,
  timelineAlert,
  workOnIncident,
  type IncidentContext,
  type IncidentEvent,
  type IncidentModifiers,
  type IncidentPlannerState,
} from '../incidents/planner';
import type { TimelineEntry } from '../incidents/timeline';
import type { IncidentState } from '../incidents/types';
import { doseMSv, qualityFactor, shieldingFactor } from '../meters/dose';
import { stepMeters, type CrewActivity, type MeterEnvironment, type MeterPlan } from '../meters/step';
import type { AlertLevel } from '../meters/types';
import { clamp } from '../math';
import { INCIDENT_MINIGAMES, INCIDENT_MINIGAMES_BY_ID } from '../minigames/catalog';
import type { MinigameId, MinigameSetup } from '../minigames/Minigame';
import { DISH_IDS, type DishId, type MealStage } from '../minigames/rooms';
import { Rng } from '../rng/Rng';
import type { GameState, HabitatSave, MissionLogEntry } from '../state/types';
import type { SystemId } from '../systems/types';
import { EXTERIOR, pathLength, pointAlong, route, routeToPoint, zoneAt, zoneById, zoneSpot, type Closed, type Point } from './layout';
import type { MissionControlRequest, SimSnapshot, SimulationEvents, TodoItem } from './events';
import type { HabitatContent, HabitatTask } from './types';
import { resourceMode, RESOURCE_MODES, type ResourceMode, type ResourceModeId } from './resourceModes';
import { crewPresence, type CrewPresence } from '../crew/presence';

const HOUR_MS = 3_600_000;
/** Un cuadro largo (pestaña en segundo plano) no puede saltarse medio día de golpe. */
const MAX_STEP_S = 0.5;
/** Lo que devuelve `activityOf` cuando un automático está reparando un incidente. */
export const REPAIR_ACTIVITY = 'repair';
/** A menos de esto (tiles) del punto de trabajo, el automático ya llegó. */
const REPAIR_ARRIVED = 0.6;
/** Desde cuántas veces hechas una tarea deja de ser fácil para el especialista y pasa a ser difícil para todos [regla]. */
const PRACTICE = { normalFrom: 2, hardFrom: 3 } as const;
/**
 * Tareas que aparecen al azar durante la jornada, siempre con un motivo [regla]: como mucho unas pocas a la vez (una
 * más por cada tormenta vivida, hasta un tope) y separadas entre sí. Los automáticos las hacen solos, pero recién
 * `autoDelayHours` después de que aparecen (el jugador puede ganarles de mano y llevarse las estrellas). Si nadie la
 * hace en `expireHours`, baja un poco el ánimo o la forma de toda la tripulación.
 */
export const CHORE_RULES = {
  baseActive: 2,
  perStorm: 1,
  maxActive: 4,
  minGapHours: 3,
  chancePerHour: 0.5,
  autoDelayHours: 4,
  autoWorkHours: 1,
  expireHours: 14,
  missedMorale: 0.03,
  missedCondition: 0.02,
} as const;
/** Dormir en la enfermería [regla]: se despierta a esta hora, y descansado si durmió al menos `restHours`. */
export const SLEEP_RULES = { wakeHour: 6, restHours: 4 } as const;
/** Si la salud de un tripulante llega a esto, la misión se suspende (evacuación de emergencia) [regla]. */
const CRITICAL_CONDITION = 0.02;
/** Horas simuladas como máximo en cada cálculo de medidores (ver `update`). */
const MAX_SIM_HOURS = 1;

export interface HabitatOptions<C extends HabitatContent = HabitatContent> {
  phase: TimedPhase;
  /** Estado de partida: si `simDate` cae dentro de la fase, se continúa desde ahí (partida guardada). */
  state: GameState;
  bus: EventBus<GameEvents>;
  content: C;
  /** Línea de tiempo real de la fase (`incidentTimeline`); aquí se filtra por nivel. */
  timeline: readonly TimelineEntry[];
  /** Tasa de dosis real del día (`seriesFor(phase, date).dose`). */
  doseRate: (date: string) => DailyDose;
  /** Demora de ida de la señal a la Tierra (s) por fecha y avance de la fase (§3.7). Sin ella, 0. */
  signalDelaySeconds?: (date: string, progress: number) => number;
  cascade?: CascadeState;
  planner?: IncidentPlannerState;
}

/** Lo que la escena lee de la entrada en cada cuadro. */
export interface HabitatInput {
  /** Zona donde está el tripulante que controla el jugador (de su posición en el mapa). */
  activeZone: string | null;
  /** Posición del tripulante del jugador (tiles), para lo que no es un cuarto (p. ej. las muestras de Marte). */
  activePosition?: Point;
  /** Mantiene apretada la tecla de usar. */
  interacting: boolean;
}

/** Qué puede hacer el jugador en una zona: trabajar en un incidente o una tarea de la nave. */
export type ZoneTask =
  | { kind: 'incident'; incident: IncidentState; textKey: string; progress: number }
  /**
   * `upToDate`: mantenimiento al día (o ejercicio, llamada o cuidado ya hechos hoy); hasta que haga falta, trabajar
   * ahí no suma nada. `blockedKey`: por qué no se puede ahora (clave de texto).
   */
  | { kind: 'task'; task: HabitatTask; progress: number; upToDate?: boolean; blockedKey?: string };

/** Minijuego que abre E en una zona, con su preparación. */
export interface ZoneMinigame {
  zone: string;
  id: MinigameId;
  setup: MinigameSetup;
}

/** Cocina del día: qué abre E donde está el jugador (`action`, null si no está junto a nada) y qué le toca hacer. */
export interface KitchenStep {
  dish: DishId;
  action: MealStage | null;
  next: MealStage;
}

/** Lo que hace E fuera de las tareas en el embarque final: cargar el depósito, guardarlo en la nave. */
export type HabitatAction = 'loadCargo' | 'stowCargo';

/** Embarque al terminar la estancia: dónde está la carga y quiénes subieron. */
export interface Departure {
  /** `stored`: en el depósito · `carried`: la lleva el jugador · `aboard`: guardada en la nave. */
  cargo: 'stored' | 'carried' | 'aboard';
  /** Quién lleva la carga, si la lleva alguien. */
  carrier: CrewId | null;
  aboard: number;
  total: number;
}

/** Tarea que apareció al azar (`CHORE_RULES`): desde cuándo espera y qué automático la tomó. */
interface Chore {
  taskId: string;
  sinceMs: number;
  helper?: CrewId;
  workedHours: number;
}

/** Hasta dónde llega la mano (tiles): al recetario y a la mesada de la cocina [regla]. */
const KITCHEN_REACH = 1.6;
/** Hasta dónde llega la mano a la consola de recursos (tiles) [regla]. */
const CONSOLE_REACH = 1.4;

/** Tormenta de radiación en camino o en curso: lo que hay que saber para decidir y para ver quién se expone. */
export interface StormInfo {
  incidentId: string;
  /** Ya llegó (Impacto) o todavía es un aviso. */
  active: boolean;
  impactAt: string;
  /** Cuántas veces más dosis se recibe trabajando que en el refugio (×N). */
  doseFactor: number;
  /** Ya se eligió qué hacer (null: falta decidir). */
  responseId: string | null;
  /** Quiénes están fuera del refugio con la tormenta encima. */
  exposed: CrewId[];
  /** Lo que más recibió de más un tripulante en las tormentas de la fase, en radiografías de tórax. */
  extraXrays: number;
}

/** Lo que el paso ya sabe antes de los medidores: ajustes de la cascada y de las respuestas a incidentes. */
export interface StepContext {
  adj: CascadeAdjustments;
  mods: IncidentModifiers;
}

export interface PendingDecision {
  incident: IncidentState;
  textKey: string;
  options: { response: IncidentResponse; available: boolean }[];
}

/** Reparación de un incidente que hace solo un tripulante automático: dónde tiene que pararse a trabajar. */
interface RepairJob {
  incidentId: string;
  /** Clave del destino (para no replanear en cada cuadro). */
  key: string;
  /** Se trabaja dentro de un cuarto… */
  zone?: string;
  /** …o parado en un punto (junto a un tubo roto, al lado de un cable cortado). */
  point?: Point;
}

interface Travel {
  to: string;
  /** Dónde queda el tripulante al llegar, si el destino no es un cuarto (un punto de reparación). */
  arrive?: string;
  route: Point[];
  length: number;
  walked: number;
  /** Segundos de reacción antes de arrancar (§3.3). */
  waitS: number;
}

/** Lugar de cada tripulante dentro de un cuarto, para que no queden encimados (tiles desde el centro). */
const SLOTS: readonly Point[] = [
  { x: -0.8, y: 0.5 },
  { x: 0.8, y: 0.5 },
  { x: -0.8, y: 1.2 },
  { x: 0.8, y: 1.2 },
];

const NO_PASSAGES: Closed = new Set();

export const hashOf = (text: string): number => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/**
 * Motor común de `Voyage` y `Mars` sin Phaser: junta el reloj, los medidores, la tripulación, la falla en cascada y
 * el planificador de incidentes sobre un plano. Cada lugar define su entorno (luz, polvo, frío, MOXIE…) con los
 * métodos protegidos. La capa Phaser sólo pinta lo que expone y le pasa la entrada; todo se publica en el bus.
 */
export abstract class HabitatSession<C extends HabitatContent = HabitatContent> {
  readonly phase: TimedPhase;
  readonly window: PhaseWindow;
  protected abstract readonly place: Place;
  protected readonly content: C;
  protected readonly bus: EventBus<GameEvents>;
  private readonly doseRate: (date: string) => DailyDose;
  private readonly ctx: IncidentContext;
  private readonly clock: MissionClock;
  protected readonly rng: Rng;
  protected _state: GameState;
  private _cascade: CascadeState;
  protected _planner: IncidentPlannerState;
  private _dose: DailyDose;
  private _outcome: PhaseResult['outcome'] | null = null;
  private readonly positions = {} as Record<CrewId, Point>;
  /** Última posición del jugador que pasó la escena (la de la física, no la de la sesión). */
  private activeAt: Point | null = null;
  private readonly travel: Partial<Record<CrewId, Travel>> = {};
  /** Destino al que un automático no puede llegar ahora (tubos rotos): no se vuelve a buscar hasta que algo cambie. */
  private readonly unreachable = new Map<CrewId, string>();
  /** Reparaciones que hacen solos los automáticos (uno por incidente) y con qué situación se repartieron. */
  private repairJobs = new Map<CrewId, RepairJob>();
  private repairKey = '';
  /** Automáticos con orden de ir al refugio. */
  private readonly sheltering = new Set<CrewId>();
  private shelter: { incidentId: string; orderedAtS: number; reached: boolean } | null = null;
  private readonly maintenance: Partial<Record<SystemId, { hoursSince: number; progress: number }>> = {};
  private callProgress = 0;
  /** Llamadas a casa hechas con el minijuego que todavía no pasaron por los medidores. */
  private pendingCalls = 0;
  /** Día (AAAA-MM-DD) en que se hizo por última vez cada tarea diaria (`exercise:<tripulante>` para el ejercicio). */
  private readonly doneOn: Record<string, string> = {};
  /** Tormentas (avisos que llegaron a Impacto) vividas en la fase: cada una suma tareas por jornada. */
  private readonly stormsSeen = new Set<string>();
  /** Prioridad elegida en la consola de recursos. */
  private mode: ResourceModeId = 'balanced';
  /** Anotaciones del historial que salen en medio de un paso (se suman al terminar). */
  private pendingLog: MissionLogEntry[] = [];
  /** Tareas que aparecieron al azar y siguen pendientes (`CHORE_RULES`). */
  private chores: Chore[] = [];
  private lastChoreMs = -Infinity;
  /** Veces que se terminó cada tarea en la fase: la dificultad de su minijuego sube con la práctica. */
  private readonly doneCount: Record<string, number> = {};
  /** Cocina del día (AAAA-MM-DD): si ya se vio el menú y si ya se leyó la receta. */
  private kitchen = { day: '', menu: false, read: false };
  private realSeconds = 0;
  protected routines: RoutinePlan;
  private readonly loadsOff = new Set<string>();
  private readonly signalDelay: (date: string, progress: number) => number;
  private requests: MissionControlRequest[] = [];
  private readonly diagnosed = new Set<string>();
  private lastPower = { generationKw: 0, loadKw: 0 };
  private sim: EventBus<SimulationEvents> | null = null;
  /** Logros de la fase (§5) que se entregan en el `PhaseResult`. */
  private readonly achievements = new Set<string>();
  /** Dosis de más en las tormentas por tripulante (mSv); null mientras no haya habido ninguna. */
  private stormExtraMSv: Partial<Record<CrewId, number>> | null = null;
  /** Pasillos o tubos cerrados con los que se planearon los recorridos (para replanear si cambian). */
  private closedKey = '';
  /** En el último paso faltó energía: la batería no llega a la base y el sol no alcanza (o es de noche). */
  protected blackout = false;
  /** Embarque final (sólo si el lugar tiene `departure`): empieza cuando se termina el tiempo de la fase. */
  protected departure: Departure | null = null;

  constructor(options: HabitatOptions<C>) {
    const { state, content } = options;
    this.content = content;
    this.bus = options.bus;
    this.doseRate = options.doseRate;
    this.phase = options.phase;
    this.routines = content.routines;
    this.signalDelay = options.signalDelaySeconds ?? (() => 0);
    for (const id of [...content.wear.systems, ...content.tasks.flatMap((t) => (t.system ? [t.system] : []))])
      this.maintenance[id] = { hoursSince: 0, progress: 0 };
    this.window = content.calendar.windows[this.phase];
    const now = Date.parse(state.simDate);
    const resume = now > Date.parse(this.window.start) && now < Date.parse(this.window.end);
    const timeline = phaseTimeline(content.incidents, options.timeline, this.phase, state.unlockLevel, this.window);
    this.ctx = { definitions: content.incidents, rules: content.incidentRules, timeline };
    this.clock = createPhaseClock({
      calendar: content.calendar,
      phase: this.phase,
      length: state.length,
      alerts: timeline.map((e) => timelineAlert(content.incidents, e)),
      ...(resume ? { from: state.simDate } : {}),
    });
    this.rng = new Rng(state.rngState);
    const saved = resume ? state.habitat : undefined;
    this._cascade = options.cascade ?? saved?.cascade ?? initialCascade();
    this._planner = options.planner ?? saved?.planner ?? initialPlanner(this.clock.simDate);
    if (saved?.resourceMode && RESOURCE_MODES.some((m) => m.id === saved.resourceMode)) this.mode = saved.resourceMode as ResourceModeId;
    const ship = content.layout;
    const crew = state.crew.map((m) => {
      const zone = ship.zones.some((z) => z.id === m.location) ? m.location : ship.spawnZone;
      this.positions[m.id] = this.spotFor(m.id, zone, state.crew);
      return { ...m, location: zone };
    });
    const { habitat: _saved, ...rest } = state;
    this._state = { ...rest, phase: this.phase, simDate: this.clock.simDate, crew, meters: this.placeMeters(state, resume) };
    this._dose = this.doseRate(this.clock.simDate);
    this.planDay();
  }

  get state(): GameState {
    return this._state;
  }

  /** Estado para guardar a mitad de fase: incluye los incidentes ya disparados y la falla en cascada. */
  get savedState(): GameState {
    const habitat: HabitatSave = { planner: this._planner, cascade: this._cascade, ...(this.mode !== 'balanced' ? { resourceMode: this.mode } : {}), ...this.saveExtras() };
    return { ...this._state, habitat };
  }

  /**
   * Cada lugar tiene su batería (§3.2): al llegar a uno con otra capacidad (la base de Gale o la nave en órbita),
   * se usa la suya, que espera cargada.
   */
  private placeMeters(state: GameState, resume: boolean): GameState['meters'] {
    const capacityKwh = this.content.power.capacityKwh;
    if (resume || state.meters.energy.capacityKwh === capacityKwh) return state.meters;
    return { ...state.meters, energy: { batteryKwh: capacityKwh, capacityKwh } };
  }

  get cascade(): CascadeState {
    return this._cascade;
  }

  get planner(): IncidentPlannerState {
    return this._planner;
  }

  get simDate(): string {
    return this.clock.simDate;
  }

  get level(): AlertLevel {
    return this.clock.level;
  }

  get reasonKey(): string {
    return this.clock.reasonKey;
  }

  get paused(): boolean {
    return this.clock.isPaused;
  }

  get outcome(): PhaseResult['outcome'] | null {
    return this._outcome;
  }

  /** Dato real de dosis del día (μGy/h, con su fecha y si está recortado). */
  get dose(): DailyDose {
    return this._dose;
  }

  /** Fracción del viaje recorrida, 0..1. */
  get progress(): number {
    const start = Date.parse(this.window.start);
    return Math.min(1, Math.max(0, (Date.parse(this.clock.simDate) - start) / (Date.parse(this.window.end) - start)));
  }

  /**
   * El jugador maneja a su tripulante cuando el reloj va a tiempo normal; en avance rápido sigue su rutina. Una
   * jornada sin nada que hacer corre más rápido pero sigue siendo manual (`idle`).
   */
  get manual(): boolean {
    if (this.departure) return !this.clock.isPaused;
    return !this.clock.isPaused && this.clock.baseHoursPerSecond <= this.content.calendar.playHoursPerSecond[this.phase] + 1e-9;
  }

  /** El tripulante del jugador duerme en la enfermería hasta mañana. */
  private sleeping = false;
  /** Desde cuándo duerme y cuándo le toca despertarse (ms de la fecha simulada). */
  private sleepFromMs = 0;
  private wakeAtMs = 0;

  get asleep(): boolean {
    return this.sleeping;
  }

  /**
   * En la enfermería se puede dormir para pasar al día siguiente (con calma: sin avisos, decisiones, emergencias,
   * refugio ni embarque). También en avance rápido: dormir es siempre una acción del jugador.
   */
  canSleep(zone: string | null): boolean {
    return zone !== null && zone === this.content.infirmaryZone && this.sleepBlockedKey() === null;
  }

  /** Por qué no se puede dormir ahora (clave de texto), o null si se puede. No mira dónde está el jugador. */
  sleepBlockedKey(): string | null {
    const s = this._state;
    const member = s.crew.find((m) => m.id === s.activeCrewId);
    if (this.sleeping || !member || member.resting || this.clock.isPaused || this._outcome) return 'hud.sleep.blocked.busy';
    if (this.departure) return 'hud.sleep.blocked.departure';
    if (this._cascade.emergencies.length) return 'hud.sleep.blocked.emergency';
    if (this.shelter && !this.shelter.reached) return 'hud.sleep.blocked.shelter';
    if (this.pendingDecisions().length) return 'hud.sleep.blocked.decision';
    return this.clock.level === 'calm' ? null : 'hud.sleep.blocked.alert';
  }

  /**
   * Dormir hasta mañana: el reloj corre muy rápido (manda el ritmo de sueño; al despertar vuelve el de antes) hasta la
   * hora de levantarse. Las tareas del día que quedaban pendientes se cancelan sin efecto.
   */
  sleep(zone: string | null): boolean {
    if (!this.canSleep(zone)) return false;
    this.cancelChores();
    const now = Date.parse(this.clock.simDate);
    const day = 24 * HOUR_MS;
    let wake = Math.floor(now / day) * day + SLEEP_RULES.wakeHour * HOUR_MS;
    while (wake - now < SLEEP_RULES.restHours * HOUR_MS) wake += day;
    this.sleepFromMs = now;
    this.wakeAtMs = wake;
    this.sleeping = true;
    this.clock.setSleep(true);
    this.publishSnapshot();
    return true;
  }

  /** El jugador se despierta cuando quiere (Z o E): sin el descanso completo si durmió poco. */
  wakeUp(): boolean {
    if (!this.sleeping) return false;
    this.wake();
    this.publishSnapshot();
    return true;
  }

  /** Al dormir, las tareas al azar pendientes se cierran sin premio ni castigo; queda anotado en el historial. */
  private cancelChores(): void {
    if (!this.chores.length) return;
    const s = this._state;
    const data = { count: this.chores.length };
    this.chores = [];
    this._state = { ...s, history: [...s.history, { simDate: s.simDate, phase: this.phase, kind: 'decision', key: 'hud.log.tasksCancelled', data }] };
  }

  /** Se despierta: descansado si durmió lo suficiente; antes de tiempo si apareció un aviso o lo decidió el jugador. */
  private wake(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.clock.setSleep(false);
    if (Date.parse(this.clock.simDate) - this.sleepFromMs < SLEEP_RULES.restHours * HOUR_MS) return;
    const s = this._state;
    this._state = {
      ...s,
      crew: s.crew.map((m) => (m.id === s.activeCrewId ? { ...m, fatigue: clamp(m.fatigue - 0.4), morale: clamp(m.morale + 0.03) } : m)),
    };
  }

  /** La jornada corre rápido porque el jugador no tiene nada que hacer (ver `hasWork`). */
  get idle(): boolean {
    return this.clock.idleBoost;
  }

  /**
   * ¿Hay algo que hacer ahora? Decisiones o reparaciones de incidentes, emergencias de la falla en cascada, la orden
   * de refugio, el embarque o una tarea del día que el tripulante activo todavía puede hacer. Si no hay nada, la
   * jornada avanza rápido (partidas de ~15 min); apenas aparece algo, vuelve al tiempo normal.
   */
  hasWork(): boolean {
    // Una reparación que ya está haciendo un automático no frena el reloj: el jugador puede ayudar, pero no hace falta.
    return this.pendingWork().some((item) => !(item.kind === 'repair' && item.helper)) || this.extraWork();
  }

  /** Lo que falta hacer ahora, en orden de importancia (lo muestra el tablero para no perderse). */
  pendingWork(): TodoItem[] {
    const s = this._state;
    const todo: TodoItem[] = [];
    if (this.departure) todo.push({ kind: 'departure' });
    if (this.shelter && !this.shelter.reached) todo.push({ kind: 'shelter' });
    if (this._cascade.emergencies.length) todo.push({ kind: 'emergency' });
    if (this.pendingDecisions().length) todo.push({ kind: 'decision' });
    for (const incident of s.activeIncidents) {
      if (!incident.responseId || (incident.progress ?? 0) >= 1) continue;
      const def = definitionOf(this.content.incidents, incident.definitionId);
      if (!def.responses.find((r) => r.id === incident.responseId)?.work) continue;
      const helper = [...this.repairJobs].find(([, job]) => job.incidentId === incident.id)?.[0];
      todo.push({ kind: 'repair', textKey: def.textKey, ...(helper ? { helper } : {}) });
    }
    if (this.sleeping || s.crew.find((m) => m.id === s.activeCrewId)?.resting) return todo;
    const now = Date.parse(s.simDate);
    for (const t of this.content.tasks) {
      const task = this.taskAt(t.zone);
      if (task?.kind !== 'task' || task.task !== t || task.upToDate || task.blockedKey || !this.taskNeeded(t)) continue;
      const chore = this.chores.find((c) => c.taskId === t.id);
      const sad = t.kind === 'callHome' ? [...s.crew].sort((a, b) => a.morale - b.morale)[0]?.id : undefined;
      todo.push({
        kind: 'task',
        taskId: t.id,
        zone: t.zone,
        ...(sad ? { crewId: sad } : {}),
        ...(chore ? { chore: { hoursLeft: Math.max(0, CHORE_RULES.autoDelayHours - (now - chore.sinceMs) / HOUR_MS), ...(chore.helper ? { helper: chore.helper } : {}) } } : {}),
      });
    }
    return todo;
  }

  /**
   * ¿La tarea del día hace falta hoy? El mantenimiento, si el sistema lo pide (eso ya lo dice `taskAt`); el ejercicio,
   * si el tripulante perdió forma; la llamada y los cuidados, si el ánimo o la salud bajaron [regla]. Lo demás se puede
   * hacer igual, pero no frena el avance rápido ni aparece en la lista de pendientes.
   */
  private taskNeeded(task: HabitatTask): boolean {
    const s = this._state;
    const member = s.crew.find((m) => m.id === s.activeCrewId);
    if (!member) return false;
    const morale = Math.min(...s.crew.map((m) => m.morale));
    // La cosecha diaria es opcional: sólo frena el reloj si el sistema de verdad pide cuidado.
    if (task.kind === 'maintenance') return !task.daily || this.needsMaintenance(s, task);
    if (task.kind === 'exercise' && member.condition < 0.95) return true;
    if (task.kind === 'callHome' && (morale < 0.8 || this.callAnswersIncident(s))) return true;
    if (task.care?.condition && Math.min(...s.crew.map((m) => m.condition)) < 0.85) return true;
    if (task.care?.morale && morale < 0.75) return true;
    // Las demás aparecen al azar, con su motivo (`stepChores`).
    return this.chores.some((c) => c.taskId === task.id);
  }

  /** Cuántas tareas al azar puede haber a la vez: cada tormenta vivida suma una (la nave pide más cuidado). */
  private choreCap(): number {
    return Math.min(CHORE_RULES.maxActive, CHORE_RULES.baseActive + this.stormsSeen.size * CHORE_RULES.perStorm);
  }

  /** Tareas que pueden aparecer al azar: cuidados y llamadas de un cuarto, sin hacer hoy y sin nada que las trabe. */
  private choreCandidates(): HabitatTask[] {
    return this.content.tasks.filter((t) => {
      if ((t.kind !== 'care' && t.kind !== 'callHome') || t.tradeoff || !this.content.layout.zones.some((z) => z.id === t.zone)) return false;
      if (this.chores.some((c) => c.taskId === t.id)) return false;
      const at = this.taskAt(t.zone);
      return at?.kind === 'task' && at.task === t && !at.upToDate && !at.blockedKey;
    });
  }

  /**
   * Tareas al azar (`CHORE_RULES`): aparecen sólo en una jornada con calma (con el `Rng` de la partida), los
   * automáticos las toman después de la demora y, si nadie las hace, se pierden con un pequeño costo.
   */
  private stepChores(hours: number, manual: boolean): void {
    const R = CHORE_RULES;
    const now = Date.parse(this._state.simDate);
    const taken = new Set(this.chores.flatMap((c) => (c.helper ? [c.helper] : [])));
    for (const chore of [...this.chores]) {
      const task = this.content.tasks.find((t) => t.id === chore.taskId)!;
      const free = (m: CrewMemberState) => m.id !== this._state.activeCrewId && !m.resting && !this.sheltering.has(m.id) && !this.repairJobs.has(m.id);
      let helper = this._state.crew.find((m) => m.id === chore.helper);
      if (helper && !free(helper)) {
        taken.delete(helper.id);
        delete chore.helper;
        helper = undefined;
      }
      const waited = (now - chore.sinceMs) / HOUR_MS;
      if (!helper && waited >= R.autoDelayHours) {
        const candidates = this._state.crew.filter((m) => free(m) && !taken.has(m.id));
        helper = candidates.find((m) => ROLE_SPECIALTIES[m.role].includes(task.category)) ?? candidates[0];
        if (helper) {
          chore.helper = helper.id;
          taken.add(helper.id);
        }
      }
      if (helper && (!manual || (helper.location === task.zone && !this.travel[helper.id]))) chore.workedHours += hours;
      if (chore.workedHours >= R.autoWorkHours) this.closeChore(chore, task, 'auto');
      else if (!helper && waited >= R.expireHours) this.closeChore(chore, task, 'missed');
    }
    if (!manual || this.sleeping || this.departure || this.clock.level !== 'calm') return;
    if (this.chores.length >= this.choreCap() || now - this.lastChoreMs < R.minGapHours * HOUR_MS) return;
    if (!this.rng.chance(1 - Math.exp(-R.chancePerHour * hours))) return;
    const candidates = this.choreCandidates();
    if (!candidates.length) return;
    this.chores.push({ taskId: this.rng.pick(candidates).id, sinceMs: now, workedHours: 0 });
    this.lastChoreMs = now;
  }

  /** Cierra una tarea al azar: la hizo un automático (sin estrellas) o se pasó el tiempo (baja el ánimo o la forma). */
  private closeChore(chore: Chore, task: HabitatTask, how: 'auto' | 'missed'): void {
    this.chores = this.chores.filter((c) => c !== chore);
    const s = this._state;
    const all = (morale: number, condition: number) => s.crew.map((m) => ({ ...m, morale: clamp(m.morale + morale), condition: clamp(m.condition + condition) }));
    if (how === 'missed') {
      const condition = task.care?.condition ? -CHORE_RULES.missedCondition : 0;
      const morale = condition ? 0 : -CHORE_RULES.missedMorale;
      this._state = {
        ...s,
        crew: all(morale, condition),
        history: [...s.history, { simDate: s.simDate, phase: this.phase, kind: 'decision', key: 'hud.log.taskMissed', data: { taskId: task.id } }],
      };
      return;
    }
    if (task.kind === 'callHome') this.pendingCalls++;
    else if (task.care) this._state = { ...s, crew: all(task.care.morale ?? 0, task.care.condition ?? 0) };
    this.doneOn[task.id] = s.simDate.slice(0, 10);
  }

  /**
   * Rutinas del día automáticas según el perfil y el estado de cada tripulante (`smartRoutines`): ya no se planean a
   * mano. Se rehacen cada día simulado.
   */
  protected planDay(): void {
    const s = this._state;
    const tasks = this.content.tasks
      .filter((t) => t.kind === 'maintenance' && t.system)
      .map((t) => ({ id: t.id, category: t.category, urgent: this.needsMaintenance(s, t) }));
    this.routines = smartRoutines(s.crew, tasks, ROLE_SPECIALTIES);
  }

  /** Se terminó una tarea de sala con su minijuego (en Marte, la cosecha del invernadero da una muestra). */
  protected onTaskDone(_task: HabitatTask, _daily: boolean): void {}

  /** Trabajo propio del lugar (en Marte: una salida con muestras sin guardar). */
  protected extraWork(): boolean {
    return false;
  }

  get emergencies(): readonly ActiveEmergency[] {
    return this._cascade.emergencies;
  }

  /**
   * Qué está haciendo un tripulante automático: el cuarto donde trabaja según su rutina (gimnasio, depurador,
   * enfermería para dormir, refugio…), sólo cuando ya llegó. Null para el jugador o si va caminando.
   */
  activityOf(id: CrewId): string | null {
    const s = this._state;
    const m = s.crew.find((c) => c.id === id);
    if (!m || id === s.activeCrewId || this.travel[id]) return null;
    const job = this.repairJobs.get(id);
    if (job) return this.onRepairSite(id, job) ? REPAIR_ACTIVITY : null;
    const target = this.targetFor(m);
    return m.location === target ? target : null;
  }

  /** Estado de un tripulante para el tablero (ver `crewPresence`). */
  presenceOf(id: CrewId): CrewPresence {
    const s = this._state;
    const m = s.crew.find((c) => c.id === id)!;
    const active = id === s.activeCrewId;
    const zone = this.activityOf(id);
    return crewPresence(m, {
      sleeping: active ? this.sleeping : zone === this.content.infirmaryZone,
      sheltering: this.sheltering.has(id) || (this.shelter !== null && m.location === this.content.shelterZone),
      repairing: active ? this.incidentWorkAt(s, m.location) !== undefined : this.repairJobs.has(id),
    });
  }

  /** Posición (tiles) de un tripulante automático; la del jugador la lleva la escena. */
  positionOf(id: CrewId): Point {
    return this.positions[id];
  }

  togglePause(): void {
    if (this.clock.isPaused) this.clock.resume();
    else this.clock.pause();
  }

  /**
   * Conecta el bus de la simulación: escucha los pedidos de las escenas superpuestas y publica `sim:snapshot`
   * en cada cuadro. Devuelve la función para desconectarlo.
   */
  attach(sim: EventBus<SimulationEvents>): () => void {
    this.sim = sim;
    const offs = [
      sim.on('sim:pause', ({ paused }) => (paused ? this.clock.pause() : this.clock.resume())),
      sim.on('sim:respond', ({ incidentId, responseId }) => this.respond(incidentId, responseId)),
      sim.on('sim:sacrifice', ({ id }) => this.sacrifice(id)),
      sim.on('sim:loads', ({ off }) => this.setLoadsOff(off)),
      sim.on('sim:ask', ({ kind, incidentId }) => this.ask(kind, incidentId)),
      sim.on('sim:mode', ({ id }) => this.setMode(id)),
    ];
    this.publishSnapshot();
    return () => {
      offs.forEach((off) => off());
      this.sim = null;
    };
  }

  /** Tablero de energía (§3.2): los sistemas desenchufados no consumen. El soporte vital no se desenchufa. */
  setLoadsOff(off: readonly string[]): void {
    if (this.panelBlocked()) return;
    this.loadsOff.clear();
    for (const id of off) if (!this.content.power.essentialLoads.includes(id) && id in this.content.power.loadsKw) this.loadsOff.add(id);
    this.publishSnapshot();
  }

  /** El tablero sólo se toca en su sala (la de energía en Marte): el jugador tiene que estar ahí. */
  panelBlocked(): boolean {
    const zone = this.content.power.panelZone;
    if (!zone) return false;
    return this._state.crew.find((m) => m.id === this._state.activeCrewId)?.location !== zone;
  }

  /** Prioridad de recursos en uso (`RESOURCE_MODES`). */
  get resourceMode(): ResourceMode {
    return resourceMode(this.mode);
  }

  /**
   * ¿E abre la consola de recursos acá? Hay que estar en su sala y, si el mapa dice dónde está, pegado a ella (así no
   * le saca la E a la tarea del cuarto).
   */
  consoleAt(zone: string | null, position?: Point): boolean {
    const c = this.content.resourceConsole;
    if (!c || !zone || zone !== c.zone || this.departure || this.sleeping || this._outcome) return false;
    return !c.at || !position || Math.hypot(position.x - c.at.x, position.y - c.at.y) <= CONSOLE_REACH;
  }

  /** La consola sólo se toca en su sala: el jugador tiene que estar ahí. */
  consoleBlocked(): boolean {
    const zone = this.content.resourceConsole?.zone;
    return !!zone && this._state.crew.find((m) => m.id === this._state.activeCrewId)?.location !== zone;
  }

  /** Elige una prioridad de recursos en la consola; queda anotada en el historial. */
  setMode(id: ResourceModeId): boolean {
    if (id === this.mode || this.consoleBlocked() || !RESOURCE_MODES.some((m) => m.id === id)) return false;
    this.mode = id;
    const s = this._state;
    this._state = { ...s, history: [...s.history, { simDate: s.simDate, phase: this.phase, kind: 'decision', key: `hud.log.resourceMode.${id}` }] };
    this.publishState();
    this.publishSnapshot();
    return true;
  }

  /** Tormenta de radiación en camino o en curso (null si no hay): cuánto protege el refugio y quién está expuesto. */
  stormInfo(): StormInfo | null {
    const s = this._state;
    const incident = s.activeIncidents.find((i) => i.definitionId === 'radiationStorm');
    if (!incident) return null;
    const rules = this.content.meterRules;
    const adj = cascadeAdjustments(this.content.cascadeRules, this._cascade, s.simDate);
    const shelter = shieldingFactor(rules, 'shelter', s.waterShield * adj.shelterEfficacy);
    const active = incident.status === 'active';
    return {
      incidentId: incident.id,
      active,
      impactAt: incident.impactAt,
      doseFactor: Math.round((shieldingFactor(rules, 'habitat', 0) / shelter) * 10) / 10,
      responseId: incident.responseId ?? null,
      exposed: active ? s.crew.filter((m) => m.location !== this.content.shelterZone).map((m) => m.id) : [],
      extraXrays: Math.max(0, ...Object.values(this.stormExtraMSv ?? {})) / rules.dose.chestXrayMSv,
    };
  }

  isLoadOn(id: string): boolean {
    return !this.loadsOff.has(id);
  }

  /** Demora de ida de la señal (s) ahora. */
  get delaySeconds(): number {
    return this.signalDelay(this.simDate, this.progress);
  }

  /** Por qué no se puede pedir nada a Control de Misión ahora (clave de texto), o null (§3.7). */
  missionControlBlockedKey(): string | null {
    if (this.missionControlOffline()) return 'hud.missionControl.blocked.offline';
    const active = this._state.crew.find((m) => m.id === this._state.activeCrewId);
    if (active?.role !== 'commander') return 'hud.missionControl.blocked.notCommander';
    if (active.location !== this.content.missionControl.consoleZone) return 'hud.missionControl.blocked.notAtConsole';
    return null;
  }

  private missionControlOffline(): boolean {
    return (
      !incidentModifiers(this.content.incidents, this._state).missionControl || this.loadsOff.has('radio') || this._state.systems.radio === 'red'
    );
  }

  /**
   * Consejo o diagnóstico remoto (§3.7): la respuesta llega después de la ida y vuelta de la señal. El diagnóstico
   * gasta energía de la radio y, cuando llega, acelera la reparación en curso.
   */
  ask(kind: MissionControlRequest['kind'], incidentId: string): MissionControlRequest | null {
    const incident = this._state.activeIncidents.find((i) => i.id === incidentId);
    if (!incident || this.missionControlBlockedKey()) return null;
    const def = definitionOf(this.content.incidents, incident.definitionId);
    const mc = this.content.missionControl;
    if (kind === 'diagnosis') {
      const work = def.responses.find((r) => r.id === incident.responseId)?.work;
      if (!work || this.diagnosed.has(incidentId) || this._state.meters.energy.batteryKwh < mc.diagnosisKwh) return null;
      const { energy } = this._state.meters;
      this._state = { ...this._state, meters: { ...this._state.meters, energy: { ...energy, batteryKwh: energy.batteryKwh - mc.diagnosisKwh } } };
    }
    const best = def.responses.find((r) => r.risk === 'green') ?? def.responses.find((r) => r.risk === 'yellow') ?? def.responses[0]!;
    const request: MissionControlRequest = {
      id: `mc-${this.requests.length + 1}`,
      kind,
      incidentId,
      textKey: def.textKey,
      askedAt: this.simDate,
      arrivesAt: new Date(Date.parse(this.simDate) + 2 * this.delaySeconds * 1000).toISOString(),
      arrived: false,
      ...(kind === 'advice' ? { responseId: best.id } : {}),
    };
    this.requests = [...this.requests, request];
    this.receiveRequests();
    this.publishSnapshot();
    return request;
  }

  get missionControlRequests(): readonly MissionControlRequest[] {
    return this.requests;
  }

  private receiveRequests(): void {
    const now = Date.parse(this.simDate);
    if (!this.requests.some((r) => !r.arrived && Date.parse(r.arrivesAt) <= now)) return;
    this.requests = this.requests.map((r) => {
      if (r.arrived || Date.parse(r.arrivesAt) > now) return r;
      if (r.kind === 'diagnosis') this.diagnosed.add(r.incidentId);
      return { ...r, arrived: true };
    });
  }

  /** Lo que muestran las escenas superpuestas. */
  snapshot(): SimSnapshot {
    const decisions = this.pendingDecisions();
    const { loadsKw, essentialLoads } = this.content.power;
    return {
      phase: this.phase,
      place: this.place,
      simDate: this.simDate,
      window: this.window,
      progress: this.progress,
      level: this.level,
      reasonKey: this.reasonKey,
      manual: this.manual,
      idle: this.idle,
      todo: this.pendingWork(),
      asleep: this.sleeping,
      presence: Object.fromEntries(this._state.crew.map((m) => [m.id, this.presenceOf(m.id)])) as Record<CrewId, CrewPresence>,
      paused: this.paused,
      state: this._state,
      activePosition: this.activeAt ?? this.positions[this._state.activeCrewId],
      dose: this._dose,
      decisions,
      hints: this._state.helpMode
        ? decisions.map((d) => {
            const best = d.options.find((o) => o.available && o.response.risk === 'green') ?? d.options.find((o) => o.available);
            return { incidentId: d.incident.id, responseId: best?.response.id ?? d.options[0]!.response.id };
          })
        : [],
      emergencies: this._cascade.emergencies,
      sacrifices: this._cascade.emergencies.length ? this.sacrifices().map((x) => x.id) : [],
      routines: this.routines,
      tasks: this.content.tasks,
      power: {
        loads: Object.entries(loadsKw).map(([id, kw]) => ({ id, kw, on: !this.loadsOff.has(id), essential: essentialLoads.includes(id) })),
        ...this.lastPower,
        sockets: this.sockets(),
        ...(this.content.power.panelZone ? { panelZone: this.content.power.panelZone, panelBlocked: this.panelBlocked() } : {}),
        blackout: this.blackout,
      },
      ...(this.departure ? { departure: { ...this.departure } } : {}),
      resources: { mode: this.mode, blocked: this.consoleBlocked() },
      storm: this.stormInfo(),
      missionControl: {
        blockedKey: this.missionControlBlockedKey(),
        delaySeconds: this.delaySeconds,
        offline: this.missionControlOffline(),
        requests: this.requests,
      },
      ...this.snapshotExtras(),
    };
  }

  /** Datos propios del lugar para las escenas superpuestas. */
  protected snapshotExtras(): Partial<SimSnapshot> {
    return {};
  }

  private publishSnapshot(): void {
    this.sim?.emit('sim:snapshot', this.snapshot());
  }

  update(realSeconds: number, input: HabitatInput): void {
    if (input.activePosition) this.activeAt = input.activePosition;
    if (this._outcome || this.clock.isPaused) {
      this.publishSnapshot();
      return;
    }
    const dt = Math.min(realSeconds, MAX_STEP_S);
    this.realSeconds += dt;
    if (input.activeZone) this.setLocation(this._state.activeCrewId, input.activeZone);
    if (this.sleeping && (this.clock.level !== 'calm' || this.pendingDecisions().length || this._cascade.emergencies.length)) this.wake();
    this.clock.setIdle(!this.hasWork());
    const manual = this.manual;
    this.moveCrew(dt);
    // Con el reloj rápido, el paso se parte para que cada tramo simule a lo sumo MAX_SIM_HOURS (que el día y la
    // noche no se mezclen en un solo cálculo de energía).
    let hours = 0;
    for (let left = dt; left > 1e-9 && !this._outcome; ) {
      const step = Math.min(left, MAX_SIM_HOURS / Math.max(1e-6, this.clock.hoursPerSecond));
      left -= step;
      const before = Date.parse(this.clock.simDate);
      const clockEvents = this.clock.advance(step);
      const stepHours = (Date.parse(this.clock.simDate) - before) / HOUR_MS;
      if (stepHours > 0) this.simulate(stepHours, manual, manual && input.interacting ? input : null);
      hours += stepHours;
      this.handleClock(clockEvents);
      if (this.sleeping && Date.parse(this.clock.simDate) >= this.wakeAtMs) this.wake();
      if (this.clock.finished || this.clock.isPaused) break;
    }
    if (this._outcome) return;
    if (hours === 0 && this.clock.finished && this.departure) this.repairWhileBoarding(dt);
    if (this._state.crew.some((m) => m.condition <= CRITICAL_CONDITION)) {
      this._state = {
        ...this._state,
        history: [...this._state.history, { simDate: this._state.simDate, phase: this.phase, kind: 'decision', key: 'hud.log.crewCritical' }],
      };
      this.bus.emit('cascade:noReturn', { reasonKey: 'hud.log.crewCritical' });
      this.finish('suspended');
      return;
    }
    this.planRoutes(this.manual);
    this.checkShelter();
    this.afterUpdate();
    this.checkDeparture();
    if (this._outcome) return;
    if (hours > 0) this.publishState();
    this.publishSnapshot();
  }

  /** Falta energía ahora (la batería no llega a la base y el sol no alcanza). */
  get blackoutNow(): boolean {
    return this.blackout;
  }

  /** Embarque final en curso (null mientras dure la estancia). */
  get departing(): Readonly<Departure> | null {
    return this.departure;
  }

  /** Lo propio del lugar que se guarda a mitad de fase. */
  protected saveExtras(): Partial<HabitatSave> {
    return {};
  }

  /** Después de cada cuadro (lo propio del lugar: p. ej. dejar las muestras en el depósito). */
  protected afterUpdate(): void {}

  /** Pasillos o tubos cerrados (rotos) que no se pueden cruzar ahora. */
  closedPassages(): Closed {
    return NO_PASSAGES;
  }

  /** La batería está conectada a la base (en Marte, por los cables). */
  protected batteryLinked(): boolean {
    return true;
  }

  /** Reparación que se hace parado junto a algo (un tubo roto, un cable cortado): su zona de trabajo, o null. */
  protected repairZoneAt(_position: Point): string | null {
    return null;
  }

  /** Dónde se trabaja en la respuesta a un incidente (un cuarto, o la zona de una reparación como `repairZoneAt`). */
  protected incidentWorkZone(incident: IncidentState, work: NonNullable<IncidentResponse['work']>): string | undefined {
    const { workZones, tasks } = this.content;
    return workZones?.[work.task] ?? tasks.find((t) => t.category === work.task)?.zone ?? (work.task === 'leak' ? this.leakZone(incident.id) : undefined);
  }

  /** Lo que haría E fuera de las tareas en el embarque final (cargar el depósito o guardarlo en la nave). */
  actionAt(zone: string | null): HabitatAction | null {
    const d = this.departure;
    const plan = this.content.departure;
    const here = this._state.crew.find((m) => m.id === this._state.activeCrewId)?.location;
    if (!d || !plan || !zone || zone !== here || !this.manual) return null;
    if (zone === plan.cargoZone && d.cargo === 'stored') return 'loadCargo';
    if (zone === plan.shipZone && d.cargo === 'carried' && d.carrier === this._state.activeCrewId) return 'stowCargo';
    return null;
  }

  /** E en el embarque: el jugador carga el depósito o lo guarda en la nave. */
  doAction(zone: string | null): boolean {
    const action = this.actionAt(zone);
    if (!action || !this.departure) return false;
    this.departure =
      action === 'loadCargo'
        ? { ...this.departure, cargo: 'carried', carrier: this._state.activeCrewId }
        : { ...this.departure, cargo: 'aboard', carrier: null };
    this.publishSnapshot();
    return true;
  }

  /** Se terminó el tiempo de la fase: con embarque, todos van a la nave; sin él, termina. */
  protected windowEnded(): void {
    if (!this.content.departure) return this.finish('completed');
    if (this.departure) return;
    this.departure = { cargo: 'stored', carrier: null, aboard: 0, total: this._state.crew.length };
    this.sheltering.clear();
    this.shelter = null;
    this.planRoutes(true);
  }

  /** Embarque: con la carga guardada y toda la tripulación en la nave, termina la fase. */
  private checkDeparture(): void {
    const plan = this.content.departure;
    if (!this.departure || !plan) return;
    const aboard = this._state.crew.filter((m) => m.location === plan.shipZone).length;
    if (aboard !== this.departure.aboard) this.departure = { ...this.departure, aboard };
    if (this.departure.cargo === 'aboard' && aboard === this._state.crew.length) this.finish('completed');
  }

  /** Cambio de tripulante (Tab): el anterior queda donde lo dejó el jugador y vuelve a su rutina. */
  switchCrew(id: CrewId, previousPosition: Point): void {
    const previous = this._state.activeCrewId;
    if (id === previous || !this._state.crew.some((m) => m.id === id)) return;
    this.positions[previous] = previousPosition;
    delete this.travel[id];
    this.sheltering.delete(id);
    if (this.shelter && !this.shelter.reached) this.sheltering.add(previous);
    this._state = { ...this._state, activeCrewId: id };
  }

  /** Qué puede hacer el jugador en una zona (lo que hace al mantener apretada la tecla de usar). */
  taskAt(at: string | null, position?: Point): ZoneTask | null {
    const zone = (position && this.repairZoneAt(position)) || at;
    if (!zone) return null;
    const incident = this.incidentWorkAt(this._state, zone);
    if (incident) {
      const textKey = definitionOf(this.content.incidents, incident.definitionId).textKey;
      return { kind: 'incident', incident, textKey, progress: incident.progress ?? 0 };
    }
    const task = this.content.tasks.find((t) => t.zone === zone);
    if (!task || this.departure) return null;
    const s = this._state;
    if (task.kind === 'maintenance' && !task.daily && !this.needsMaintenance(s, task)) return { kind: 'task', task, progress: 1, upToDate: true };
    if (!this.taskReady(task)) return { kind: 'task', task, progress: 1, upToDate: true };
    if (this.doneOn[this.dailyKey(task)] === s.simDate.slice(0, 10) && !(task.kind === 'callHome' && this.callAnswersIncident(s)))
      return { kind: 'task', task, progress: 1, upToDate: true };
    const progress = task.system ? (this.maintenance[task.system]?.progress ?? 0) : task.kind === 'callHome' ? this.callProgress : 0;
    const blockedKey =
      task.system && s.systems[task.system] === 'red'
        ? 'hud.task.broken'
        : task.kind === 'callHome' && (this.loadsOff.has('radio') || s.systems.radio === 'red')
          ? 'hud.task.radioOff'
          : undefined;
    return { kind: 'task', task, progress, ...(blockedKey ? { blockedKey } : {}) };
  }

  /** ¿Se puede hacer ahora esta tarea? Lo propio del lugar (en Marte: paneles con polvo, la tarde para preparar la noche). */
  protected taskReady(_task: HabitatTask): boolean {
    return true;
  }

  /** Multiplica el consumo de los sistemas (en Marte: la base preparada para la noche). */
  protected loadFactor(): number {
    return 1;
  }

  private dailyKey(task: HabitatTask): string {
    return task.kind === 'exercise' ? `exercise:${this._state.activeCrewId}` : task.id;
  }

  /** Hay un aislamiento esperando una llamada a casa: se puede volver a llamar aunque ya se haya llamado hoy. */
  private callAnswersIncident(s: GameState): boolean {
    return s.activeIncidents.some((incident) =>
      definitionOf(this.content.incidents, incident.definitionId).responses.some((r) => r.resets === 'hoursSinceCallHome' && canRespond(this.ctx, s, incident.id, r.id)),
    );
  }

  /**
   * Minijuego que abre E en una zona: el de la reparación del incidente en curso o el de la tarea del cuarto. Más
   * fácil en modo ayuda o si el tripulante es especialista (§3.3); más difícil si se eligió improvisar. En la
   * cocina depende de dónde está parado (`position`, en tiles; sin ella, junto a la mesada).
   */
  minigameAt(at: string | null, position?: Point): ZoneMinigame | null {
    const zone = (position && this.repairZoneAt(position)) || at;
    const task = this.taskAt(zone);
    const s = this._state;
    const member = s.crew.find((m) => m.id === s.activeCrewId);
    if (!zone || !task || !member || member.resting || (task.kind === 'task' && (task.upToDate || task.blockedKey))) return null;
    let id: MinigameId | undefined;
    let category: TaskCategory;
    const setup: Omit<MinigameSetup, 'seed'> = { delaySeconds: this.delaySeconds };
    if (task.kind === 'incident') {
      const def = definitionOf(this.content.incidents, task.incident.definitionId);
      const response = def.responses.find((r) => r.id === task.incident.responseId);
      if (!response?.work) return null;
      category = response.work.task;
      id = INCIDENT_MINIGAMES_BY_ID[def.id] ?? INCIDENT_MINIGAMES[category] ?? this.content.tasks.find((t) => t.zone === zone)?.minigame ?? 'patch';
      setup.hard = response.risk !== 'green';
      setup.pests = def.id === 'greenhousePest';
    } else {
      // Con el sistema sano, la tarea diaria tiene su propio minijuego (la cosecha); si pide cuidado, el de siempre.
      const healthy = task.task.daily && !this.needsMaintenance(s, task.task);
      id = healthy ? (task.task.dailyMinigame ?? task.task.minigame) : task.task.minigame;
      category = task.task.category;
      if (id === 'meal') {
        const kitchen = this.kitchenAt(zone, position);
        if (!kitchen?.action) return null;
        setup.meal = { dish: kitchen.dish, stage: kitchen.action };
      }
    }
    if (!id) return null;
    // Con la práctica las tareas se ponen más difíciles (§3.3): el especialista deja de tenerla fácil desde la tercera
    // vez y todos pasan a la versión difícil desde la cuarta. En modo ayuda siguen fáciles.
    const practice = task.kind === 'task' ? (this.doneCount[task.task.id] ?? 0) : 0;
    setup.easy = s.helpMode || (ROLE_SPECIALTIES[member.role].includes(category) && practice < PRACTICE.normalFrom);
    if (!s.helpMode && practice >= PRACTICE.hardFrom) setup.hard = true;
    return { zone, id, setup: { ...setup, seed: hashOf(`${s.seed}|${s.simDate}|${zone}|${s.activeCrewId}`) } };
  }

  /**
   * Cocina del día (cuidado con el minijuego `meal`): primero el menú en la mesada, después la receta en el recetario
   * y de vuelta en la mesada, cocinar. Null fuera de la cocina o si ya se cocinó hoy.
   */
  kitchenAt(zone: string | null, position?: Point): KitchenStep | null {
    const task = this.taskAt(zone);
    if (!zone || task?.kind !== 'task' || task.task.minigame !== 'meal' || task.upToDate || task.blockedKey) return null;
    const k = this.kitchenToday();
    const next: MealStage = k.read ? 'cook' : k.menu ? 'recipe' : 'menu';
    const near = (p: Point) => !position || Math.hypot(position.x - p.x, position.y - p.y) <= KITCHEN_REACH;
    const { recipeAt } = task.task;
    const action = position && recipeAt && near(recipeAt) ? 'recipe' : near(zoneSpot(zoneById(this.content.layout, zone))) ? (k.read ? 'cook' : 'menu') : null;
    return { dish: k.dish, action, next };
  }

  private kitchenToday(): { dish: DishId; menu: boolean; read: boolean } {
    const day = this._state.simDate.slice(0, 10);
    if (this.kitchen.day !== day) this.kitchen = { day, menu: false, read: false };
    return { ...this.kitchen, dish: DISH_IDS[hashOf(`${this._state.seed}|${day}|meal`) % DISH_IDS.length]! };
  }

  /** Se abrió un minijuego: en la cocina, queda visto el menú o leída la receta. */
  minigameStarted(m: ZoneMinigame): void {
    const stage = m.setup.meal?.stage;
    if (!stage || stage === 'cook') return;
    this.kitchenToday();
    this.kitchen.menu = true;
    if (stage === 'recipe') this.kitchen.read = true;
  }

  /**
   * Minijuego ganado: termina de una vez lo que antes se hacía manteniendo apretada E (la reparación, el
   * mantenimiento, el ejercicio, la llamada o el cuidado del día). El trabajo cansa lo mismo que hecho a mano.
   */
  finishTask(zone: string): boolean {
    const task = this.taskAt(zone);
    let s = this._state;
    const member = s.crew.find((m) => m.id === s.activeCrewId)!;
    if (!task || this._outcome || member.resting) return false;
    const co2 = s.meters.lifeSupport.co2MmHg;
    if (task.kind === 'incident') {
      const work = definitionOf(this.content.incidents, task.incident.definitionId).responses.find((r) => r.id === task.incident.responseId)?.work;
      if (!work) return false;
      s = this.tired(s, member.id, ((1 - task.progress) * work.hours) / workSpeed(member, work.task, co2));
      const r = workOnIncident(this.ctx, this._planner, s, task.incident.id, member.id, 1e6);
      this._planner = r.planner;
      this._state = r.state;
      this.handleIncidentEvents(r.events);
    } else {
      const t = task.task;
      if (task.upToDate || task.blockedKey) return false;
      const needed = t.kind === 'maintenance' && this.needsMaintenance(s, t);
      if (t.kind === 'maintenance' && t.system) {
        const hours = ((1 - task.progress) * this.content.wear.maintenanceHours) / workSpeed(member, t.category, co2);
        this._state = this.maintained(this.tired(s, member.id, hours), t);
      } else if (t.kind === 'exercise') {
        // Un minijuego es el ejercicio de todo el día (§3.2): la condición sube lo que se habría perdido sin él.
        const h = this.content.meterRules.health;
        const gain = h.conditionGainPerDayExercise + h.conditionLossPerDayNoExercise;
        this._state = { ...s, crew: s.crew.map((m) => (m.id === member.id ? { ...m, condition: clamp(m.condition + gain) } : m)) };
      } else if (t.kind === 'callHome') {
        this.callProgress = 0;
        this.pendingCalls++;
        this._state = this.answerWithCall(s);
        this.handleIncidentEvents([]);
      } else if (t.care) {
        const { morale = 0, condition = 0 } = t.care;
        this._state = { ...s, crew: s.crew.map((m) => ({ ...m, morale: clamp(m.morale + morale), condition: clamp(m.condition + condition) })) };
      }
      // Curar el sistema no gasta la tarea diaria: después todavía se puede cosechar hoy.
      if (!(t.daily && needed)) this.doneOn[this.dailyKey(t)] = s.simDate.slice(0, 10);
      this.doneCount[t.id] = (this.doneCount[t.id] ?? 0) + 1;
      this.chores = this.chores.filter((c) => c.taskId !== t.id);
      this.onTaskDone(t, !needed);
    }
    this.publishState();
    this.publishSnapshot();
    return true;
  }

  /** Cansancio de `hours` de trabajo (el que daría hacerlo manteniendo apretada E). */
  private tired(s: GameState, id: CrewId, hours: number): GameState {
    const k = this.content.meterRules.health.fatiguePerWorkHour;
    return { ...s, crew: s.crew.map((m) => (m.id === id ? { ...m, fatigue: clamp(m.fatigue + Math.max(0, hours) * k) } : m)) };
  }

  /** Mantenimiento terminado: el sistema vuelve a verde y, si corresponde, se reinicia su contador. */
  private maintained(s: GameState, task: HabitatTask): GameState {
    const m = this.maintenance[task.system!]!;
    m.progress = 0;
    m.hoursSince = 0;
    if (task.resets) this._planner = { ...this._planner, counters: { ...this._planner.counters, [task.resets]: 0 } };
    return s.systems[task.system!] === 'yellow' ? { ...s, systems: { ...s.systems, [task.system!]: 'green' } } : s;
  }

  /**
   * Un mantenimiento hace falta si el sistema está gastado, si ya pasó la mitad del tiempo que aguanta sin cuidado o,
   * para las tareas que reinician un contador (invernadero, esclusa), si se gastó la mitad del rango seguro [regla].
   */
  private needsMaintenance(s: GameState, task: HabitatTask): boolean {
    if (!task.system || s.systems[task.system] !== 'green') return true;
    const { wear } = this.content;
    if (wear.systems.includes(task.system) && (this.maintenance[task.system]?.hoursSince ?? 0) >= wear.hoursToYellow / 2) return true;
    if (!task.resets) return false;
    const max = this.content.incidents
      .flatMap((d) => d.triggers)
      .find((t) => t.kind === 'safeRange' && t.variable === task.resets);
    return max?.kind === 'safeRange' && this._planner.counters[task.resets] >= max.max / 2;
  }

  /** Cuarto donde está la fuga de un micrometeorito (fijo para cada incidente, sin gastar tiradas del Rng). */
  leakZone(incidentId: string): string {
    const zones = this.content.layout.zones.filter((z) => z.id !== this.content.shelterZone);
    return zones[hashOf(incidentId) % zones.length]!.id;
  }

  /** Incidentes que esperan una respuesta del jugador, con el coste y el semáforo de cada opción (§3.6). */
  pendingDecisions(): PendingDecision[] {
    return this._state.activeIncidents
      .filter((i) => !i.responseId)
      .map((incident) => ({
        incident,
        textKey: definitionOf(this.content.incidents, incident.definitionId).textKey,
        options: incidentResponses(this.ctx, this._state, incident.id),
      }));
  }

  respond(incidentId: string, responseId: string): void {
    const r = respondToIncident(this.ctx, this._planner, this._state, incidentId, responseId);
    this._planner = r.planner;
    this._state = r.state;
    this.handleIncidentEvents(r.events);
    const incident = this._state.activeIncidents.find((i) => i.id === incidentId);
    const response = incident && definitionOf(this.content.incidents, incident.definitionId).responses.find((x) => x.id === responseId);
    if (response?.while?.shelter) this.orderShelter(incidentId);
    // Decidido y sin trabajo pendiente: el aviso deja de frenar el reloj.
    else if (!response?.work) this.handleClock(this.clock.resolve(incidentId));
    this.publishState();
  }

  sacrifices(): SacrificeDefinition[] {
    return availableSacrifices(this._cascade, this._state, this.place);
  }

  sacrifice(id: SacrificeId): void {
    const r = applySacrifice(this.content.cascadeRules, this.content.meterRules, this._cascade, this._state, id, {
      doseRateUGyH: this._dose.uGyH,
    });
    this._cascade = r.cascade;
    this._state = r.state;
    this.bus.emit('cascade:sacrifice', r.event);
    this.publishState();
  }

  revertSacrifice(id: SacrificeId): void {
    this._cascade = revertSacrifice(this._cascade, id);
  }

  /** Entorno real del paso: dosis, luz, polvo y frío del lugar (§3.2). */
  protected abstract environment(s: GameState, hours: number, ctx: StepContext): MeterEnvironment;

  /** Lo que el lugar agrega al plan de los medidores (calefacción, MOXIE…). */
  protected planExtras(_s: GameState, _hours: number, _ctx: StepContext): Partial<MeterPlan> {
    return {};
  }

  /** Sistemas encendidos (claves de `power.loadsKw`). */
  protected activeLoads(ctx: StepContext): readonly string[] {
    const { essentialLoads, loadsKw } = this.content.power;
    return ctx.adj.essentialOnly ? essentialLoads : Object.keys(loadsKw).filter((k) => !this.loadsOff.has(k));
  }

  /** Después de los medidores y antes de la cascada (invernadero, ejercicio de la vuelta…). */
  protected afterStep(_before: GameState, after: GameState, _hours: number, _ctx: StepContext): GameState {
    return after;
  }

  /** Generación promedio de hoy (kW): sin noche en el viaje; en Marte, con la luz y el polvo del sol. */
  protected averageGenerationKw(): number {
    return this.content.power.panelKwAt1Au;
  }

  /** Calefacción promedio de hoy (kW); sólo en Marte. */
  protected averageHeatingKw(): number {
    return 0;
  }

  /**
   * Enchufes del tablero (§3.2): lo que sobra del sol de hoy después del soporte vital y la calefacción, en fichas
   * de `socketKw`. Con polvo hay menos y hay que elegir qué desenchufar.
   */
  sockets(): number {
    const { loadsKw, essentialLoads, socketKw } = this.content.power;
    const essential = essentialLoads.reduce((sum, k) => sum + (loadsKw[k] ?? 0), 0);
    const free = this.averageGenerationKw() - essential - this.averageHeatingKw();
    const optional = Object.keys(loadsKw).filter((k) => !essentialLoads.includes(k)).length;
    return Math.min(optional, Math.max(0, Math.floor(free / socketKw)));
  }

  /** Multiplica el desgaste de los sistemas (la nave gastada de la vuelta, §4.6). */
  protected wearFactor(): number {
    return 1;
  }

  /** Trabajo del jugador fuera de las tareas de los cuartos (p. ej. juntar muestras). `null` si no hay nada. */
  protected workAtPoint(_s: GameState, _crewId: CrewId, _position: Point, _hours: number): GameState | null {
    return null;
  }

  private simulate(hours: number, manual: boolean, input: HabitatInput | null): void {
    const c = this.content;
    let s: GameState = { ...this._state, simDate: this.clock.simDate };
    this._dose = this.doseRate(s.simDate);
    const adj = cascadeAdjustments(c.cascadeRules, this._cascade, s.simDate);
    const ctx: StepContext = { adj, mods: incidentModifiers(c.incidents, s) };
    const activities = routineActivities(s.crew, this.routines, hours, adj.workFactor);
    const activeId = s.activeCrewId;
    let callsHome = 0;

    for (const m of s.crew) {
      if (manual && m.id === activeId) {
        const sleep = (this.routines[m.id] ?? DEFAULT_ROUTINE).sleepHours * (hours / 24);
        const activity: CrewActivity = m.resting || this.sleeping ? { sleepHours: hours } : { sleepHours: sleep };
        if (input && !m.resting) {
          const point = input.activePosition ? this.workAtPoint(s, m.id, input.activePosition, hours) : null;
          if (point) {
            s = point;
            activity.workHours = hours;
          } else if (input.activeZone) {
            const w = this.work(s, m.id, input.activeZone, hours, false);
            s = w.state;
            Object.assign(activity, w.activity);
          }
        }
        activities[m.id] = activity;
      } else if (!m.resting && !this.sheltering.has(m.id) && this.repairJobs.has(m.id)) {
        const job = this.repairJobs.get(m.id)!;
        if (this.onRepairSite(m.id, job)) {
          const boost = this.diagnosed.has(job.incidentId) ? c.missionControl.diagnosisBoost : 1;
          const r = workOnIncident(this.ctx, this._planner, s, job.incidentId, m.id, hours * boost);
          this._planner = r.planner;
          this.pendingIncidentEvents.push(...r.events);
          s = r.state;
        }
      } else if (!m.resting && !this.sheltering.has(m.id)) {
        const task = c.tasks.find((t) => t.id === this.routines[m.id]?.taskId);
        const workHours = activities[m.id]?.workHours ?? 0;
        if (task && workHours > 0) s = this.work(s, m.id, task.zone, workHours, true).state;
      }
    }
    if (this.pendingCalls) {
      activities[activeId] = { ...activities[activeId], callsHome: (activities[activeId]?.callsHome ?? 0) + this.pendingCalls };
      this.pendingCalls = 0;
    }
    // Una llamada desde la radio es de toda la tripulación con sus familias [regla].
    const playerCalls = activities[activeId]?.callsHome ?? 0;
    for (const m of s.crew) {
      const a = { ...activities[m.id] };
      if (m.location === c.shelterZone && this.sheltering.size > 0) Object.assign(a, { exerciseHours: 0, workHours: 0 });
      if (playerCalls && m.id !== activeId) a.callsHome = (a.callsHome ?? 0) + playerCalls;
      callsHome += a.callsHome ?? 0;
      activities[m.id] = a;
    }

    const loads = c.power.loadsKw;
    const mode = this.resourceMode;
    const loadKw = Math.max(0, this.activeLoads(ctx).reduce((sum, k) => sum + (loads[k] ?? 0), 0) * mode.loadFactor * this.loadFactor() + adj.extraLoadKw);
    const evaHours = hours * s.crew.filter((m) => m.location === EXTERIOR).length;
    const env = this.environment(s, hours, ctx);
    // Sin la batería conectada, la base usa sólo lo que llega del sol en el momento y la batería queda quieta.
    const linked = this.batteryLinked();
    const step = stepMeters(
      c.meterRules,
      linked ? s : { ...s, meters: { ...s.meters, energy: { batteryKwh: 0, capacityKwh: 0 } } },
      env,
      {
        ...this.planExtras(s, hours, ctx),
        evaHours,
        loadKw,
        ration: adj.ration * mode.ration,
        lifeSupportFactor: adj.lifeSupportFactor * mode.lifeSupportFactor,
        shelterEfficacy: adj.shelterEfficacy,
        recyclerBoost: adj.recyclerBoost,
        crew: activities,
      },
      hours,
    );
    this.lastPower = { generationKw: step.generationKw, loadKw: step.loadKw };
    this.blackout = !linked && step.deficitKwh > 1e-9;
    const stepped = linked ? step.state : { ...step.state, meters: { ...step.state.meters, energy: s.meters.energy } };
    if (env.sepActive) this.trackStormDose(env, step.doseMSv, s.waterShield * adj.shelterEfficacy, hours);
    s = applyEmergencyEffects(c.cascadeRules, this._cascade, this.afterStep(s, stepped, hours, ctx), hours);
    const cascade = updateCascade(c.cascadeRules, c.meterRules, this._cascade, s, hours);
    this._cascade = cascade.cascade;
    const activity: IncidentActivity = { callsHome, evaHours };
    const incidents = stepIncidents(this.ctx, this._planner, cascade.state, this.rng, hours, activity);
    this._planner = incidents.planner;
    s = this.wear(incidents.state, hours);
    if (mode.moralePerDay) s = { ...s, crew: s.crew.map((m) => ({ ...m, morale: clamp(m.morale + (mode.moralePerDay * hours) / 24) })) };
    if (this.pendingLog.length) {
      s = { ...s, history: [...s.history, ...this.pendingLog] };
      this.pendingLog = [];
    }
    this._state = { ...s, crew: withSlowReasons(s.crew, s.meters.lifeSupport.co2MmHg), rngState: this.rng.state };
    this.stepChores(hours, manual);
    this.receiveRequests();
    this.handleCascadeEvents(cascade.events);
    this.handleIncidentEvents(incidents.events);
  }

  /** Trabajo de `hours` en una zona: el incidente pendiente primero, si no la tarea de la nave. */
  private work(s: GameState, crewId: CrewId, zone: string, hours: number, auto: boolean): { state: GameState; activity: CrewActivity } {
    const incident = this.incidentWorkAt(s, zone);
    if (incident) {
      // Con el diagnóstico remoto de Control de Misión la reparación rinde más (§3.7).
      const boost = this.diagnosed.has(incident.id) ? this.content.missionControl.diagnosisBoost : 1;
      const r = workOnIncident(this.ctx, this._planner, s, incident.id, crewId, hours * boost);
      this._planner = r.planner;
      this.pendingIncidentEvents.push(...r.events);
      return { state: r.state, activity: { workHours: hours } };
    }
    const task = this.content.tasks.find((t) => t.zone === zone);
    if (!task) return { state: s, activity: {} };
    if (task.kind === 'maintenance' && task.system) {
      if (!this.needsMaintenance(s, task)) return { state: s, activity: {} };
      const member = s.crew.find((m) => m.id === crewId)!;
      const m = this.maintenance[task.system]!;
      m.progress += (hours * workSpeed(member, task.category, s.meters.lifeSupport.co2MmHg)) / this.content.wear.maintenanceHours;
      if (m.progress >= 1) s = this.maintained(s, task);
      return { state: s, activity: { workHours: hours } };
    }
    if (auto || task.kind === 'care') return { state: s, activity: {} };
    if (task.kind === 'exercise') return { state: s, activity: { exerciseHours: hours } };
    if (this.loadsOff.has('radio') || s.systems.radio === 'red') return { state: s, activity: {} };
    this.callProgress += hours / this.content.wear.callHours;
    if (this.callProgress < 1) return { state: s, activity: {} };
    this.callProgress = 0;
    return { state: this.answerWithCall(s), activity: { callsHome: 1 } };
  }

  /** La llamada también es la respuesta a un aislamiento que espera decisión. */
  private answerWithCall(s: GameState): GameState {
    let next = s;
    for (const incident of s.activeIncidents) {
      const response = definitionOf(this.content.incidents, incident.definitionId).responses.find((r) => r.resets === 'hoursSinceCallHome');
      if (!response || !canRespond(this.ctx, next, incident.id, response.id)) continue;
      const r = respondToIncident(this.ctx, this._planner, next, incident.id, response.id);
      this._planner = r.planner;
      next = r.state;
      this.pendingIncidentEvents.push(...r.events);
    }
    return next;
  }

  private pendingIncidentEvents: IncidentEvent[] = [];

  private incidentWorkAt(s: GameState, zone: string): IncidentState | undefined {
    return s.activeIncidents.find((incident) => {
      if (!incident.responseId || (incident.progress ?? 0) >= 1) return false;
      const work = definitionOf(this.content.incidents, incident.definitionId).responses.find((r) => r.id === incident.responseId)?.work;
      return !!work && this.incidentWorkZone(incident, work) === zone;
    });
  }

  /** Sin mantenimiento, los sistemas sanos pasan a amarillo. */
  private wear(s: GameState, hours: number): GameState {
    const { wear } = this.content;
    let systems = s.systems;
    for (const id of wear.systems) {
      const m = this.maintenance[id]!;
      m.hoursSince += hours * this.wearFactor() * this.resourceMode.wearFactor;
      if (m.hoursSince >= wear.hoursToYellow && systems[id] === 'green') systems = { ...systems, [id]: 'yellow' };
    }
    return systems === s.systems ? s : { ...s, systems };
  }

  private orderShelter(incidentId: string): void {
    this.shelter = { incidentId, orderedAtS: this.realSeconds, reached: false };
    for (const m of this._state.crew) if (!m.resting && m.id !== this._state.activeCrewId) this.sheltering.add(m.id);
    this.planRoutes(this.manual);
  }

  /** Todos los que pueden moverse están en el refugio: el aviso deja de frenar el reloj (§3.1). */
  private checkShelter(): void {
    const order = this.shelter;
    if (!order || order.reached) return;
    const all = this._state.crew.filter((m) => !m.resting).every((m) => m.location === this.content.shelterZone);
    if (!all) return;
    order.reached = true;
    const incident = this._state.activeIncidents.find((i) => i.id === order.incidentId);
    if (incident && Date.parse(this._state.simDate) <= Date.parse(incident.impactAt)) this.achievements.add('shelterInTime');
    this.handleClock(this.clock.resolve(order.incidentId));
    const seconds = Math.round((this.realSeconds - order.orderedAtS) * 10) / 10;
    this._state = {
      ...this._state,
      history: [
        ...this._state.history,
        { simDate: this._state.simDate, phase: this.phase, kind: 'decision', key: 'hud.log.allInShelter', data: { incidentId: order.incidentId, seconds } },
      ],
    };
  }

  // --- Los automáticos reparan solos ---

  /** Puntos (tiles) desde donde se repara un incidente que no está dentro de un cuarto (en Marte: tubos y cables). */
  protected repairSpots(_incident: IncidentState, _work: NonNullable<IncidentResponse['work']>): Point[] {
    return [];
  }

  /**
   * Reparte las reparaciones en curso (con la respuesta ya elegida por el jugador) entre los automáticos: a cada
   * incidente va el que mejor lo hace (su especialista, si puede llegar). Sólo se vuelve a repartir cuando cambia algo:
   * los incidentes, los tubos cerrados, quién está disponible o la hora.
   */
  private assignRepairs(closed: Closed): void {
    const s = this._state;
    const co2 = s.meters.lifeSupport.co2MmHg;
    const jobs = s.activeIncidents.flatMap((incident) => {
      if (!incident.responseId || (incident.progress ?? 0) >= 1) return [];
      const work = definitionOf(this.content.incidents, incident.definitionId).responses.find((r) => r.id === incident.responseId)?.work;
      return work ? [{ incident, work }] : [];
    });
    const free = s.crew.filter((m) => m.id !== s.activeCrewId && !m.resting && !this.sheltering.has(m.id));
    const key = [
      jobs.map(({ incident }) => `${incident.id}:${incident.responseId}`).join(','),
      free.map((m) => m.id).join(','),
      [...closed].sort().join(','),
      s.simDate.slice(0, 13),
      this.repairContextKey(),
    ].join('|');
    if (key === this.repairKey) return;
    this.repairKey = key;
    const previous = this.repairJobs;
    const next = new Map<CrewId, RepairJob>();
    for (const { incident, work } of jobs) {
      const zone = this.incidentWorkZone(incident, work);
      const room = zone && this.content.layout.zones.some((z) => z.id === zone) ? zone : null;
      const spots = room ? [] : this.repairSpots(incident, work);
      if (!room && !spots.length) continue;
      const before = [...previous].find(([, job]) => job.incidentId === incident.id)?.[0];
      const candidates = free
        .filter((m) => !next.has(m.id))
        .sort((a, b) => Number(b.id === before) - Number(a.id === before) || workSpeed(b, work.task, co2) - workSpeed(a, work.task, co2));
      for (const m of candidates) {
        const job = this.repairJobFor(m.id, incident.id, room, spots, closed);
        if (!job) continue;
        next.set(m.id, job);
        break;
      }
    }
    this.repairJobs = next;
  }

  /** Algo propio del lugar que cambia quién puede reparar qué (en Marte: si se puede salir afuera). */
  protected repairContextKey(): string {
    return '';
  }

  private routeClosed(id: CrewId, closed: Closed): Closed {
    const here = zoneAt(this.content.layout, this.positions[id]);
    return here && closed.has(here) ? new Set([...closed].filter((x) => x !== here)) : closed;
  }

  /** La reparación para este tripulante, si puede llegar al cuarto o a alguno de los puntos de trabajo. */
  private repairJobFor(id: CrewId, incidentId: string, room: string | null, spots: readonly Point[], closed: Closed): RepairJob | null {
    const ship = this.content.layout;
    const from = this.positions[id];
    const open = this.routeClosed(id, closed);
    const key = `repair:${incidentId}`;
    if (room) return zoneAt(ship, from) === room || route(ship, from, room, false, open).length >= 2 ? { incidentId, key, zone: room } : null;
    for (const point of spots) {
      if (Math.hypot(point.x - from.x, point.y - from.y) < REPAIR_ARRIVED || routeToPoint(ship, from, point, false, open).length >= 2) return { incidentId, key, point };
    }
    return null;
  }

  private onRepairSite(id: CrewId, job: RepairJob): boolean {
    if (this.travel[id]) return false;
    const at = this.positions[id];
    if (job.point) return Math.hypot(job.point.x - at.x, job.point.y - at.y) < REPAIR_ARRIVED;
    return zoneAt(this.content.layout, at) === job.zone;
  }

  /** Manda al tripulante a su reparación. Devuelve false si no hay camino. */
  private goRepair(m: CrewMemberState, job: RepairJob, manual: boolean, closed: Closed): boolean {
    const ship = this.content.layout;
    if (this.travel[m.id]?.to === job.key || this.onRepairSite(m.id, job)) return true;
    const arrive = job.zone ?? zoneAt(ship, job.point!) ?? m.location;
    const end = job.zone ? this.spotFor(m.id, job.zone) : job.point!;
    if (!manual) {
      // En avance rápido no se camina: aparece en el lugar de trabajo.
      delete this.travel[m.id];
      this.positions[m.id] = end;
      this.setLocation(m.id, arrive);
      return true;
    }
    const open = this.routeClosed(m.id, closed);
    const blind = !usesOptimalRoute(efficiency(m, this._state.meters.lifeSupport.co2MmHg));
    const found = job.zone ? route(ship, this.positions[m.id], job.zone, blind, open) : routeToPoint(ship, this.positions[m.id], job.point!, blind, open);
    if (found.length < 2) return false;
    const path = job.zone ? [...found.slice(0, -1), end] : found;
    this.travel[m.id] = { to: job.key, arrive, route: path, length: pathLength(path), walked: 0, waitS: 0 };
    return true;
  }

  /**
   * En el embarque final el calendario ya terminó y el reloj no corre: las reparaciones de los automáticos siguen al
   * ritmo de una jornada, para que un tubo roto no deje a nadie sin poder llegar a la nave.
   */
  private repairWhileBoarding(dt: number): void {
    const hours = dt * this.content.calendar.playHoursPerSecond[this.phase];
    const events: IncidentEvent[] = [];
    for (const [id, job] of this.repairJobs) {
      if (!this.onRepairSite(id, job)) continue;
      const r = workOnIncident(this.ctx, this._planner, this._state, job.incidentId, id, hours);
      this._planner = r.planner;
      this._state = r.state;
      events.push(...r.events);
    }
    if (events.length) this.handleIncidentEvents(events);
  }

  /** Adónde va cada automático: enfermería si reposa, refugio si hay orden, si no lo que marque su rutina. */
  private targetFor(m: CrewMemberState): string {
    const c = this.content;
    if (this.departure && c.departure) return c.departure.shipZone;
    if (m.resting) return c.infirmaryZone;
    if (this.sheltering.has(m.id)) return c.shelterZone;
    // Tomó una tarea de las que aparecen al azar: va a su cuarto.
    const chore = this.chores.find((x) => x.helper === m.id);
    if (chore) return c.tasks.find((t) => t.id === chore.taskId)!.zone;
    const r = this.routines[m.id] ?? DEFAULT_ROUTINE;
    const hour = (new Date(this.clock.simDate).getUTCHours() + 24 - (c.routineOffsetHours[m.id] ?? 0)) % 24;
    if (hour < r.sleepHours) return c.infirmaryZone;
    if (hour < r.sleepHours + r.exerciseHours) return c.tasks.find((t) => t.kind === 'exercise')?.zone ?? c.layout.spawnZone;
    if (hour < r.sleepHours + r.exerciseHours + r.workHours) return c.tasks.find((t) => t.id === r.taskId)?.zone ?? c.layout.spawnZone;
    return c.layout.spawnZone;
  }

  /**
   * En avance rápido los automáticos no caminan (sólo una orden de refugio los mueve); a tiempo normal van a su
   * lugar con la reacción y la ruta que da su eficiencia (§3.3).
   */
  private planRoutes(manual: boolean): void {
    const ship = this.content.layout;
    const co2 = this._state.meters.lifeSupport.co2MmHg;
    const closed = this.closedPassages();
    const key = [...closed].sort().join(',');
    // Se rompió o se arregló un tubo: todos vuelven a buscar camino.
    if (key !== this.closedKey) {
      this.closedKey = key;
      for (const id of Object.keys(this.travel) as CrewId[]) delete this.travel[id];
      this.unreachable.clear();
    }
    this.assignRepairs(closed);
    for (const m of this._state.crew) {
      if (m.id === this._state.activeCrewId) continue;
      const job = this.repairJobs.get(m.id);
      if (job) {
        if (this.goRepair(m, job, manual, closed)) continue;
        // No llega (se cerró el camino): deja la reparación y sigue con lo suyo.
        this.repairJobs.delete(m.id);
        this.repairKey = '';
      }
      const target = this.targetFor(m);
      const current = this.travel[m.id];
      if (current?.to === target || (!current && zoneAt(ship, this.positions[m.id]) === target)) continue;
      if (this.unreachable.get(m.id) === target) continue;
      const urgent = this.sheltering.has(m.id) && target === this.content.shelterZone;
      if (!manual && !urgent) {
        // En avance rápido nadie camina, pero quien reposa aparece en la enfermería y quien quedó en el refugio
        // después de la tormenta vuelve a lo suyo (si no, seguía ahí hasta la próxima jornada).
        if (m.resting || zoneAt(ship, this.positions[m.id]) === this.content.shelterZone) {
          delete this.travel[m.id];
          this.positions[m.id] = this.spotFor(m.id, target);
          this.setLocation(m.id, target);
        }
        continue;
      }
      const eff = efficiency(m, co2);
      // Quien quedó adentro de un tubo que se cerró puede salir por él.
      const here = zoneAt(ship, this.positions[m.id]);
      const open = here && closed.has(here) ? new Set([...closed].filter((id) => id !== here)) : closed;
      const found = route(ship, this.positions[m.id], target, !usesOptimalRoute(eff), open);
      if (found.length < 2) {
        // Sin camino (tubos rotos): espera donde está hasta que algo cambie.
        this.unreachable.set(m.id, target);
        delete this.travel[m.id];
        continue;
      }
      const path = [...found.slice(0, -1), this.spotFor(m.id, target)];
      this.travel[m.id] = { to: target, route: path, length: pathLength(path), walked: 0, waitS: urgent ? reactionSeconds(eff) : 0 };
    }
  }

  private spotFor(id: CrewId, zone: string, crew: readonly CrewMemberState[] = this._state.crew): Point {
    const spot = zoneSpot(zoneById(this.content.layout, zone));
    const slot = SLOTS[Math.max(0, crew.findIndex((m) => m.id === id)) % SLOTS.length]!;
    return { x: spot.x + slot.x, y: spot.y + slot.y };
  }

  private moveCrew(dt: number): void {
    const { layout: ship, crewSpeedTilesPerS } = this.content;
    const co2 = this._state.meters.lifeSupport.co2MmHg;
    for (const m of this._state.crew) {
      const t = this.travel[m.id];
      if (!t || m.id === this._state.activeCrewId) continue;
      if (t.waitS > 0) {
        t.waitS -= dt;
        continue;
      }
      t.walked += crewSpeedTilesPerS * efficiency(m, co2) * dt;
      this.positions[m.id] = pointAlong(t.route, t.walked);
      if (t.walked >= t.length) {
        delete this.travel[m.id];
        this.setLocation(m.id, t.arrive ?? t.to);
      } else {
        const zone = zoneAt(ship, this.positions[m.id]);
        if (zone && !m.resting) this.setLocation(m.id, zone);
      }
    }
  }

  private setLocation(id: CrewId, location: string): void {
    if (this._state.crew.find((m) => m.id === id)?.location === location) return;
    this._state = { ...this._state, crew: this._state.crew.map((m) => (m.id === id ? { ...m, location } : m)) };
  }

  private handleClock(events: readonly ClockEvent[]): void {
    for (const e of events) {
      if (e.type === 'end') this.wake();
      if (e.type === 'day') {
        this.bus.emit('clock:day', { simDate: e.simDate });
        this.planDay();
      }
      else if (e.type === 'level') {
        if (e.level === 'impact' && e.alertId) this.stormsSeen.add(e.alertId);
        this.bus.emit('alert:level', { level: e.level, reasonKey: e.reasonKey });
      }
      else if (e.type === 'end') this.windowEnded();
    }
  }

  private handleCascadeEvents(events: readonly CascadeEvent[]): void {
    for (const e of events) {
      if (e.type === 'entered') this.bus.emit('cascade:entered', e.emergency);
      else if (e.type === 'noReturn') {
        this.bus.emit('cascade:noReturn', { reasonKey: e.reasonKey });
        this.finish('suspended');
      }
    }
  }

  private handleIncidentEvents(events: readonly IncidentEvent[]): void {
    const all = [...this.pendingIncidentEvents, ...events];
    this.pendingIncidentEvents = [];
    publishIncidentEvents(this.bus, all);
    for (const e of all) {
      if (e.type === 'alert') this.handleClock(this.clock.addAlert(e.alert));
      else if (e.type === 'resolved') {
        this.handleClock(this.clock.resolve(e.incident.id));
        if (this.shelter?.incidentId === e.incident.id) {
          this.shelter = null;
          this.sheltering.clear();
        }
      } else if (e.type === 'started' && e.incident.definitionId === 'radiationStorm' && this._state.helpMode && !this.shelter) {
        // Modo ayuda: los automáticos van solos al refugio con la alarma (§3.3).
        this.orderShelter(e.incident.id);
      }
    }
  }

  private publishState(): void {
    this.bus.emit('meters:changed', this._state.meters);
    this.bus.emit('crew:changed', this._state.crew);
    this.bus.emit('phase:progress', this.savedState);
  }

  /**
   * "Cero radiografías extra" (§5): en cada paso de tormenta suma lo que cada uno recibió por encima de lo que daba
   * el refugio. Si nadie pasó de una radiografía de tórax, la fase entrega el logro.
   */
  private trackStormDose(env: MeterEnvironment, added: Record<CrewId, number>, waterShield: number, hours: number): void {
    const rules = this.content.meterRules;
    const inShelter = doseMSv(env.doseRateUGyH, shieldingFactor(rules, 'shelter', waterShield), qualityFactor(rules, env.place, true), hours);
    const extra = this.stormExtraMSv ?? {};
    const xray = rules.dose.chestXrayMSv;
    const before = Math.max(0, ...Object.values(extra));
    for (const [id, mSv] of Object.entries(added) as [CrewId, number][]) extra[id] = (extra[id] ?? 0) + Math.max(0, mSv - inShelter);
    this.stormExtraMSv = extra;
    // Alguien ya recibió una radiografía de más por no estar en el refugio: queda anotado (se pierde la estrella de dosis baja).
    if (before < xray && Math.max(0, ...Object.values(extra)) >= xray)
      this.pendingLog.push({ simDate: this._state.simDate, phase: this.phase, kind: 'decision', key: 'hud.log.stormDose' });
  }

  private phaseAchievements(outcome: PhaseResult['outcome']): string[] {
    const extra = this.stormExtraMSv;
    const xray = this.content.meterRules.dose.chestXrayMSv;
    if (outcome === 'completed' && extra && Object.values(extra).every((mSv) => mSv < xray)) this.achievements.add('zeroExtraXrays');
    return [...this.achievements];
  }

  private finish(outcome: PhaseResult['outcome']): void {
    if (this._outcome) return;
    this._outcome = outcome;
    this.bus.emit('phase:completed', { phase: this.phase, outcome, state: this._state, achievements: this.phaseAchievements(outcome) });
  }
}

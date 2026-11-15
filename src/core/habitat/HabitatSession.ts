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
import { efficiency, reactionSeconds, usesOptimalRoute, withSlowReasons, workSpeed } from '../crew/efficiency';
import { DEFAULT_ROUTINE, isValidRoutine, routineActivities, type RoutinePlan } from '../crew/routines';
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
import { stepMeters, type CrewActivity, type MeterEnvironment, type MeterPlan } from '../meters/step';
import type { AlertLevel } from '../meters/types';
import { Rng } from '../rng/Rng';
import type { GameState } from '../state/types';
import type { SystemId } from '../systems/types';
import { EXTERIOR, pathLength, pointAlong, route, zoneAt, zoneById, zoneSpot, type Point } from './layout';
import type { MissionControlRequest, SimSnapshot, SimulationEvents } from './events';
import type { HabitatContent, HabitatTask } from './types';

const HOUR_MS = 3_600_000;
/** Un cuadro largo (pestaña en segundo plano) no puede saltarse medio día de golpe. */
const MAX_STEP_S = 0.5;

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
  /** `upToDate`: mantenimiento al día; hasta que haga falta, trabajar ahí no suma nada. */
  | { kind: 'task'; task: HabitatTask; progress: number; upToDate?: boolean };

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

interface Travel {
  to: string;
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

const hashOf = (text: string): number => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

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
  private readonly bus: EventBus<GameEvents>;
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
  private readonly travel: Partial<Record<CrewId, Travel>> = {};
  /** Automáticos con orden de ir al refugio. */
  private readonly sheltering = new Set<CrewId>();
  private shelter: { incidentId: string; orderedAtS: number; reached: boolean } | null = null;
  private readonly maintenance: Partial<Record<SystemId, { hoursSince: number; progress: number }>> = {};
  private callProgress = 0;
  private realSeconds = 0;
  protected routines: RoutinePlan;
  private readonly loadsOff = new Set<string>();
  private readonly signalDelay: (date: string, progress: number) => number;
  private requests: MissionControlRequest[] = [];
  private readonly diagnosed = new Set<string>();
  private lastPower = { generationKw: 0, loadKw: 0 };
  private sim: EventBus<SimulationEvents> | null = null;

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
    this._cascade = options.cascade ?? initialCascade();
    this._planner = options.planner ?? initialPlanner(this.clock.simDate);
    const ship = content.layout;
    const crew = state.crew.map((m) => {
      const zone = ship.zones.some((z) => z.id === m.location) ? m.location : ship.spawnZone;
      this.positions[m.id] = this.spotFor(m.id, zone, state.crew);
      return { ...m, location: zone };
    });
    this._state = { ...state, phase: this.phase, simDate: this.clock.simDate, crew };
    this._dose = this.doseRate(this.clock.simDate);
  }

  get state(): GameState {
    return this._state;
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

  /** El jugador maneja a su tripulante cuando el reloj va a tiempo normal; en avance rápido sigue su rutina. */
  get manual(): boolean {
    return !this.clock.isPaused && this.clock.hoursPerSecond <= this.content.calendar.playHoursPerSecond[this.phase] + 1e-9;
  }

  get emergencies(): readonly ActiveEmergency[] {
    return this._cascade.emergencies;
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
      sim.on('sim:routines', (plan) => this.setRoutines(plan)),
      sim.on('sim:loads', ({ off }) => this.setLoadsOff(off)),
      sim.on('sim:ask', ({ kind, incidentId }) => this.ask(kind, incidentId)),
    ];
    this.publishSnapshot();
    return () => {
      offs.forEach((off) => off());
      this.sim = null;
    };
  }

  /** Rutinas nuevas de la planificación (§3.1); las imposibles (más de 24 h) se ignoran. */
  setRoutines(plan: RoutinePlan): void {
    this.routines = Object.fromEntries(
      Object.entries(this.routines).map(([id, r]) => {
        const next = plan[id as CrewId];
        return [id, next && isValidRoutine(next) ? next : r];
      }),
    ) as RoutinePlan;
    this.publishSnapshot();
  }

  /** Tablero de energía (§3.2): los sistemas desenchufados no consumen. El soporte vital no se desenchufa. */
  setLoadsOff(off: readonly string[]): void {
    this.loadsOff.clear();
    for (const id of off) if (!this.content.power.essentialLoads.includes(id) && id in this.content.power.loadsKw) this.loadsOff.add(id);
    this.publishSnapshot();
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
      paused: this.paused,
      state: this._state,
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
      },
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
    if (this._outcome || this.clock.isPaused) {
      this.publishSnapshot();
      return;
    }
    const dt = Math.min(realSeconds, MAX_STEP_S);
    this.realSeconds += dt;
    if (input.activeZone) this.setLocation(this._state.activeCrewId, input.activeZone);
    const manual = this.manual;
    this.moveCrew(dt);
    const before = Date.parse(this.clock.simDate);
    const clockEvents = this.clock.advance(dt);
    const hours = (Date.parse(this.clock.simDate) - before) / HOUR_MS;
    if (hours > 0) this.simulate(hours, manual, manual && input.interacting ? input : null);
    this.handleClock(clockEvents);
    if (this._outcome) return;
    this.planRoutes(this.manual);
    this.checkShelter();
    if (hours > 0) this.publishState();
    this.publishSnapshot();
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
  taskAt(zone: string | null): ZoneTask | null {
    if (!zone) return null;
    const incident = this.incidentWorkAt(this._state, zone);
    if (incident) {
      const textKey = definitionOf(this.content.incidents, incident.definitionId).textKey;
      return { kind: 'incident', incident, textKey, progress: incident.progress ?? 0 };
    }
    const task = this.content.tasks.find((t) => t.zone === zone);
    if (!task) return null;
    if (task.kind === 'maintenance' && !this.needsMaintenance(this._state, task)) return { kind: 'task', task, progress: 1, upToDate: true };
    const progress = task.system ? (this.maintenance[task.system]?.progress ?? 0) : task.kind === 'callHome' ? this.callProgress : 0;
    return { kind: 'task', task, progress };
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
        const activity: CrewActivity = m.resting ? { sleepHours: hours } : { sleepHours: sleep };
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
      } else if (!m.resting && !this.sheltering.has(m.id)) {
        const task = c.tasks.find((t) => t.id === this.routines[m.id]?.taskId);
        const workHours = activities[m.id]?.workHours ?? 0;
        if (task && workHours > 0) s = this.work(s, m.id, task.zone, workHours, true).state;
      }
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
    const loadKw = Math.max(0, this.activeLoads(ctx).reduce((sum, k) => sum + (loads[k] ?? 0), 0) + adj.extraLoadKw);
    const evaHours = hours * s.crew.filter((m) => m.location === EXTERIOR).length;
    const step = stepMeters(
      c.meterRules,
      s,
      this.environment(s, hours, ctx),
      {
        ...this.planExtras(s, hours, ctx),
        evaHours,
        loadKw,
        ration: adj.ration,
        lifeSupportFactor: adj.lifeSupportFactor,
        shelterEfficacy: adj.shelterEfficacy,
        recyclerBoost: adj.recyclerBoost,
        crew: activities,
      },
      hours,
    );
    this.lastPower = { generationKw: step.generationKw, loadKw: step.loadKw };
    s = applyEmergencyEffects(c.cascadeRules, this._cascade, this.afterStep(s, step.state, hours, ctx), hours);
    const cascade = updateCascade(c.cascadeRules, c.meterRules, this._cascade, s, hours);
    this._cascade = cascade.cascade;
    const activity: IncidentActivity = { callsHome, evaHours };
    const incidents = stepIncidents(this.ctx, this._planner, cascade.state, this.rng, hours, activity);
    this._planner = incidents.planner;
    s = this.wear(incidents.state, hours);
    this._state = { ...s, crew: withSlowReasons(s.crew, s.meters.lifeSupport.co2MmHg), rngState: this.rng.state };
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
      if (m.progress >= 1) {
        m.progress = 0;
        m.hoursSince = 0;
        if (s.systems[task.system] === 'yellow') s = { ...s, systems: { ...s.systems, [task.system]: 'green' } };
        if (task.resets) this._planner = { ...this._planner, counters: { ...this._planner.counters, [task.resets]: 0 } };
      }
      return { state: s, activity: { workHours: hours } };
    }
    if (auto) return { state: s, activity: {} };
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
      if (!work) return false;
      const { workZones, tasks } = this.content;
      const workZone =
        workZones?.[work.task] ?? tasks.find((t) => t.category === work.task)?.zone ?? (work.task === 'leak' ? this.leakZone(incident.id) : undefined);
      return workZone === zone;
    });
  }

  /** Sin mantenimiento, los sistemas sanos pasan a amarillo. */
  private wear(s: GameState, hours: number): GameState {
    const { wear } = this.content;
    let systems = s.systems;
    for (const id of wear.systems) {
      const m = this.maintenance[id]!;
      m.hoursSince += hours * this.wearFactor();
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

  /** Adónde va cada automático: enfermería si reposa, refugio si hay orden, si no lo que marque su rutina. */
  private targetFor(m: CrewMemberState): string {
    const c = this.content;
    if (m.resting) return c.infirmaryZone;
    if (this.sheltering.has(m.id)) return c.shelterZone;
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
    for (const m of this._state.crew) {
      if (m.id === this._state.activeCrewId) continue;
      const target = this.targetFor(m);
      const current = this.travel[m.id];
      if (current?.to === target || (!current && zoneAt(ship, this.positions[m.id]) === target)) continue;
      const urgent = this.sheltering.has(m.id) && target === this.content.shelterZone;
      if (!manual && !urgent) {
        if (m.resting) {
          delete this.travel[m.id];
          this.positions[m.id] = this.spotFor(m.id, target);
          this.setLocation(m.id, target);
        }
        continue;
      }
      const eff = efficiency(m, co2);
      const path = [...route(ship, this.positions[m.id], target, !usesOptimalRoute(eff)).slice(0, -1), this.spotFor(m.id, target)];
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
        this.setLocation(m.id, t.to);
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
      if (e.type === 'day') this.bus.emit('clock:day', { simDate: e.simDate });
      else if (e.type === 'level') this.bus.emit('alert:level', { level: e.level, reasonKey: e.reasonKey });
      else if (e.type === 'end') this.finish('completed');
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
  }

  private finish(outcome: PhaseResult['outcome']): void {
    if (this._outcome) return;
    this._outcome = outcome;
    this.bus.emit('phase:completed', { phase: this.phase, outcome, state: this._state, achievements: [] });
  }
}

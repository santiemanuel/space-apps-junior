import { applyEmergencyEffects, cascadeAdjustments, updateCascade } from '../cascade/cascade';
import { applySacrifice, availableSacrifices, revertSacrifice, type SacrificeDefinition, type SacrificeId } from '../cascade/sacrifices';
import { initialCascade, type ActiveEmergency, type CascadeEvent, type CascadeState } from '../cascade/types';
import type { ClockEvent, MissionClock } from '../clock/MissionClock';
import { createPhaseClock, type PhaseWindow, type TimedPhase } from '../clock/schedule';
import { efficiency, reactionSeconds, usesOptimalRoute, withSlowReasons, workSpeed } from '../crew/efficiency';
import { DEFAULT_ROUTINE, routineActivities } from '../crew/routines';
import type { CrewId, CrewMemberState } from '../crew/types';
import type { DailyDose } from '../environment/series';
import type { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { PhaseResult } from '../flow/types';
import type { IncidentResponse } from '../incidents/definitions';
import {
  canRespond,
  definitionOf,
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
  type IncidentPlannerState,
} from '../incidents/planner';
import type { TimelineEntry } from '../incidents/timeline';
import type { IncidentState } from '../incidents/types';
import { cruiseDistanceAu } from '../meters/energy';
import { stepMeters, type CrewActivity } from '../meters/step';
import type { AlertLevel } from '../meters/types';
import { Rng } from '../rng/Rng';
import type { GameState } from '../state/types';
import { pathLength, pointAlong, route, zoneAt, zoneById, zoneSpot, type Point } from './ship';
import type { MaintainedSystem, VoyageContent, VoyageLeg, VoyageTask } from './types';

const HOUR_MS = 3_600_000;
/** Un cuadro largo (pestaña en segundo plano) no puede saltarse medio día de golpe. */
const MAX_STEP_S = 0.5;
const MAINTAINED: readonly MaintainedSystem[] = ['scrubber', 'waterRecycler'];

export interface VoyageOptions {
  leg: VoyageLeg;
  /** Estado de partida: si `simDate` cae dentro de la fase, se continúa desde ahí (partida guardada). */
  state: GameState;
  bus: EventBus<GameEvents>;
  content: VoyageContent;
  /** Línea de tiempo real de la fase (`incidentTimeline`); aquí se filtra por nivel. */
  timeline: readonly TimelineEntry[];
  /** Tasa de dosis real del día (`seriesFor(phase, date).dose`). */
  doseRate: (date: string) => DailyDose;
  cascade?: CascadeState;
  planner?: IncidentPlannerState;
}

/** Lo que la escena lee de la entrada en cada cuadro. */
export interface VoyageInput {
  /** Zona donde está el tripulante que controla el jugador (de su posición en el mapa). */
  activeZone: string | null;
  /** Mantiene apretada la tecla de usar. */
  interacting: boolean;
}

/** Qué puede hacer el jugador en una zona: trabajar en un incidente o una tarea de la nave. */
export type ZoneTask =
  | { kind: 'incident'; incident: IncidentState; textKey: string; progress: number }
  | { kind: 'task'; task: VoyageTask; progress: number };

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
 * Escena `Voyage` sin motor (§4.2, §4.6): junta el reloj, los medidores, la tripulación, la falla en cascada y el
 * planificador de incidentes sobre el plano de la nave. La capa Phaser sólo pinta lo que expone y le pasa la
 * entrada; todo se publica en el bus con los eventos del contrato.
 */
export class VoyageSession {
  readonly leg: VoyageLeg;
  readonly phase: TimedPhase;
  readonly window: PhaseWindow;
  private readonly content: VoyageContent;
  private readonly bus: EventBus<GameEvents>;
  private readonly doseRate: (date: string) => DailyDose;
  private readonly ctx: IncidentContext;
  private readonly clock: MissionClock;
  private readonly rng: Rng;
  private _state: GameState;
  private _cascade: CascadeState;
  private _planner: IncidentPlannerState;
  private _dose: DailyDose;
  private _outcome: PhaseResult['outcome'] | null = null;
  private readonly positions = {} as Record<CrewId, Point>;
  private readonly travel: Partial<Record<CrewId, Travel>> = {};
  /** Automáticos con orden de ir al refugio. */
  private readonly sheltering = new Set<CrewId>();
  private shelter: { incidentId: string; orderedAtS: number; reached: boolean } | null = null;
  private readonly maintenance: Record<MaintainedSystem, { hoursSince: number; progress: number }> = {
    scrubber: { hoursSince: 0, progress: 0 },
    waterRecycler: { hoursSince: 0, progress: 0 },
  };
  private callProgress = 0;
  private realSeconds = 0;

  constructor(options: VoyageOptions) {
    const { leg, state, content } = options;
    this.leg = leg;
    this.content = content;
    this.bus = options.bus;
    this.doseRate = options.doseRate;
    this.phase = leg === 'out' ? 'cruiseOut' : 'cruiseBack';
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
    const { ship } = content;
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

  update(realSeconds: number, input: VoyageInput): void {
    if (this._outcome || this.clock.isPaused) return;
    const dt = Math.min(realSeconds, MAX_STEP_S);
    this.realSeconds += dt;
    if (input.activeZone) this.setLocation(this._state.activeCrewId, input.activeZone);
    const manual = this.manual;
    this.moveCrew(dt);
    const before = Date.parse(this.clock.simDate);
    const clockEvents = this.clock.advance(dt);
    const hours = (Date.parse(this.clock.simDate) - before) / HOUR_MS;
    if (hours > 0) this.simulate(hours, manual, manual && input.interacting ? input.activeZone : null);
    this.handleClock(clockEvents);
    if (this._outcome) return;
    this.planRoutes(this.manual);
    this.checkShelter();
    if (hours > 0) this.publishState();
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
    const progress = task.system ? this.maintenance[task.system].progress : task.id === 'callHome' ? this.callProgress : 0;
    return { kind: 'task', task, progress };
  }

  /** Cuarto donde está la fuga de un micrometeorito (fijo para cada incidente, sin gastar tiradas del Rng). */
  leakZone(incidentId: string): string {
    const zones = this.content.ship.zones.filter((z) => z.id !== this.content.shelterZone);
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
    return availableSacrifices(this._cascade, this._state, 'cruise');
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

  private simulate(hours: number, manual: boolean, workZone: string | null): void {
    const c = this.content;
    let s: GameState = { ...this._state, simDate: this.clock.simDate };
    this._dose = this.doseRate(s.simDate);
    const adj = cascadeAdjustments(c.cascadeRules, this._cascade, s.simDate);
    const activities = routineActivities(s.crew, c.routines, hours, adj.workFactor);
    const activeId = s.activeCrewId;
    let callsHome = 0;

    for (const m of s.crew) {
      if (manual && m.id === activeId) {
        const sleep = (c.routines[m.id] ?? DEFAULT_ROUTINE).sleepHours * (hours / 24);
        const activity: CrewActivity = m.resting ? { sleepHours: hours } : { sleepHours: sleep };
        if (workZone && !m.resting) {
          const w = this.work(s, m.id, workZone, hours, false);
          s = w.state;
          Object.assign(activity, w.activity);
        }
        activities[m.id] = activity;
      } else if (!m.resting && !this.sheltering.has(m.id)) {
        const task = c.tasks.find((t) => t.id === c.routines[m.id]?.taskId);
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
    const loadKw = (adj.essentialOnly ? (loads[c.power.essentialLoad] ?? 0) : Object.values(loads).reduce((a, b) => a + b, 0)) + adj.extraLoadKw;
    const sepActive = s.activeIncidents.some((i) => i.definitionId === 'radiationStorm' && i.status === 'active');
    const step = stepMeters(
      c.meterRules,
      s,
      {
        place: 'cruise',
        doseRateUGyH: this._dose.uGyH,
        sepActive,
        solar: { panelKwAt1Au: c.power.panelKwAt1Au, distanceAu: cruiseDistanceAu(this.progress, this.leg) },
      },
      {
        loadKw,
        ration: adj.ration,
        lifeSupportFactor: adj.lifeSupportFactor,
        shelterEfficacy: adj.shelterEfficacy,
        recyclerBoost: adj.recyclerBoost,
        crew: activities,
      },
      hours,
    );
    s = applyEmergencyEffects(c.cascadeRules, this._cascade, this.backExercise(s, step.state), hours);
    const cascade = updateCascade(c.cascadeRules, c.meterRules, this._cascade, s, hours);
    this._cascade = cascade.cascade;
    const incidents = stepIncidents(this.ctx, this._planner, cascade.state, this.rng, hours, { callsHome });
    this._planner = incidents.planner;
    s = this.wear(incidents.state, hours);
    this._state = { ...s, crew: withSlowReasons(s.crew, s.meters.lifeSupport.co2MmHg), rngState: this.rng.state };
    this.handleCascadeEvents(cascade.events);
    this.handleIncidentEvents(incidents.events);
  }

  /** En la vuelta, lo que se gana de condición física cuenta doble para llegar en forma a 1 g (§4.6). */
  private backExercise(before: GameState, after: GameState): GameState {
    if (this.leg !== 'back') return after;
    const k = this.content.wear.backExerciseMultiplier;
    return {
      ...after,
      crew: after.crew.map((m) => {
        const old = before.crew.find((b) => b.id === m.id)!.condition;
        return m.condition > old ? { ...m, condition: Math.min(1, old + (m.condition - old) * k) } : m;
      }),
    };
  }

  /** Trabajo de `hours` en una zona: el incidente pendiente primero, si no la tarea de la nave. */
  private work(s: GameState, crewId: CrewId, zone: string, hours: number, auto: boolean): { state: GameState; activity: CrewActivity } {
    const incident = this.incidentWorkAt(s, zone);
    if (incident) {
      const r = workOnIncident(this.ctx, this._planner, s, incident.id, crewId, hours);
      this._planner = r.planner;
      this.pendingIncidentEvents.push(...r.events);
      return { state: r.state, activity: { workHours: hours } };
    }
    const task = this.content.tasks.find((t) => t.zone === zone);
    if (!task) return { state: s, activity: {} };
    if (task.system) {
      const member = s.crew.find((m) => m.id === crewId)!;
      const m = this.maintenance[task.system];
      m.progress += (hours * workSpeed(member, task.category, s.meters.lifeSupport.co2MmHg)) / this.content.wear.maintenanceHours;
      if (m.progress >= 1) {
        m.progress = 0;
        m.hoursSince = 0;
        if (s.systems[task.system] === 'yellow') s = { ...s, systems: { ...s.systems, [task.system]: 'green' } };
      }
      return { state: s, activity: { workHours: hours } };
    }
    if (auto) return { state: s, activity: {} };
    if (task.id === 'exercise') return { state: s, activity: { exerciseHours: hours } };
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
      const workZone = work.task === 'leak' ? this.leakZone(incident.id) : this.content.tasks.find((t) => t.category === work.task)?.zone;
      return workZone === zone;
    });
  }

  /** Sin mantenimiento, el depurador y el reciclador pasan a amarillo; en la vuelta, el doble de rápido (§4.6). */
  private wear(s: GameState, hours: number): GameState {
    const { wear } = this.content;
    const factor = this.leg === 'back' ? wear.backWearMultiplier : 1;
    let systems = s.systems;
    for (const id of MAINTAINED) {
      const m = this.maintenance[id];
      m.hoursSince += hours * factor;
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
        { simDate: this._state.simDate, phase: this.phase, kind: 'decision', key: 'voyage.log.allInShelter', data: { incidentId: order.incidentId, seconds } },
      ],
    };
  }

  /** Adónde va cada automático: enfermería si reposa, refugio si hay orden, si no lo que marque su rutina. */
  private targetFor(m: CrewMemberState): string {
    const c = this.content;
    if (m.resting) return c.infirmaryZone;
    if (this.sheltering.has(m.id)) return c.shelterZone;
    const r = c.routines[m.id] ?? DEFAULT_ROUTINE;
    const hour = (new Date(this.clock.simDate).getUTCHours() + 24 - (c.routineOffsetHours[m.id] ?? 0)) % 24;
    if (hour < r.sleepHours) return c.infirmaryZone;
    if (hour < r.sleepHours + r.exerciseHours) return c.tasks.find((t) => t.id === 'exercise')?.zone ?? c.ship.spawnZone;
    if (hour < r.sleepHours + r.exerciseHours + r.workHours) return c.tasks.find((t) => t.id === r.taskId)?.zone ?? c.ship.spawnZone;
    return c.ship.spawnZone;
  }

  /**
   * En avance rápido los automáticos no caminan (sólo una orden de refugio los mueve); a tiempo normal van a su
   * lugar con la reacción y la ruta que da su eficiencia (§3.3).
   */
  private planRoutes(manual: boolean): void {
    const { ship } = this.content;
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
    const spot = zoneSpot(zoneById(this.content.ship, zone));
    const slot = SLOTS[Math.max(0, crew.findIndex((m) => m.id === id)) % SLOTS.length]!;
    return { x: spot.x + slot.x, y: spot.y + slot.y };
  }

  private moveCrew(dt: number): void {
    const { ship, crewSpeedTilesPerS } = this.content;
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

import type { ClockAlert } from '../clock/MissionClock';
import { workSpeed } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { RealEvent } from '../events/RealEvent';
import type { PhaseId, UnlockLevel } from '../flow/types';
import { clamp } from '../math';
import type { Rng } from '../rng/Rng';
import type { GameState, MissionLogEntry } from '../state/types';
import type {
  ActivityCounter,
  IncidentDefinition,
  IncidentId,
  IncidentResponse,
  IncidentRules,
  ResponseModifiers,
  SafeRangeVariable,
} from './definitions';
import { timelineBetween, type TimelineEntry } from './timeline';
import type { IncidentState } from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const iso = (ms: number): string => new Date(ms).toISOString();

/**
 * Estado propio del planificador (JSON puro, se guarda junto al `GameState` como `CascadeState`).
 * Los incidentes en curso viven en `GameState.activeIncidents`.
 */
export interface IncidentPlannerState {
  /** Eventos de la línea de tiempo ya disparados (no se repiten al cargar). */
  fired: string[];
  /** Último día simulado con tirada de fallas (`YYYY-MM-DD`). */
  lastRollDay: string;
  /** Contador para los ids de los incidentes dinámicos. */
  seq: number;
  counters: Record<ActivityCounter, number>;
  /** Hasta cuándo no puede reaparecer cada incidente dinámico (ISO). */
  cooldownUntil: Partial<Record<IncidentId, string>>;
}

export const initialPlanner = (simDate: string): IncidentPlannerState => ({
  fired: [],
  lastRollDay: simDate.slice(0, 10),
  seq: 0,
  counters: { hoursSinceCallHome: 0, evaHoursSinceMaintenance: 0, hoursSinceGreenhouseCare: 0 },
  cooldownUntil: {},
});

/** Contenido y línea de tiempo de la fase en curso. */
export interface IncidentContext {
  definitions: readonly IncidentDefinition[];
  rules: IncidentRules;
  timeline: readonly TimelineEntry[];
}

/** Lo que hizo la tripulación en el paso: alimenta los rangos seguros de actividad. */
export interface IncidentActivity {
  callsHome?: number;
  evaHours?: number;
  greenhouseCareHours?: number;
}

export type IncidentEvent =
  | { type: 'warned' | 'started' | 'resolved'; incident: IncidentState }
  | { type: 'realEvent'; event: RealEvent }
  /** Aviso nuevo para `MissionClock.addAlert` (incidentes dinámicos). */
  | { type: 'alert'; alert: ClockAlert };

export interface IncidentUpdate {
  planner: IncidentPlannerState;
  state: GameState;
  events: IncidentEvent[];
}

export const definitionOf = (definitions: readonly IncidentDefinition[], id: string): IncidentDefinition => {
  const def = definitions.find((d) => d.id === id);
  if (!def) throw new Error(`Incidente desconocido: ${id}`);
  return def;
};

/** Filtrado por fase y por nivel de desbloqueo (§6). */
export const isAvailable = (def: IncidentDefinition, phase: PhaseId, level: UnlockLevel): boolean =>
  (def.phases as readonly PhaseId[]).includes(phase) && def.unlockLevel <= level;

/** Eventos reales de la fase que el jugador puede ver con su nivel. */
export const phaseTimeline = (
  definitions: readonly IncidentDefinition[],
  entries: readonly TimelineEntry[],
  phase: PhaseId,
  level: UnlockLevel,
  window: { start: string; end: string },
): TimelineEntry[] =>
  timelineBetween(entries, window.start, window.end).filter((e) => isAvailable(definitionOf(definitions, e.definitionId), phase, level));

/** Aviso que frena el reloj (§3.1) para un evento real; los textos son `<textKey>.alert` y `.impact`. */
export const timelineAlert = (definitions: readonly IncidentDefinition[], entry: TimelineEntry): ClockAlert => ({
  id: entry.id,
  warnAt: entry.warnAt,
  impactAt: entry.impactAt,
  endAt: entry.endAt,
  reasonKey: definitionOf(definitions, entry.definitionId).textKey,
});

const reading = (planner: IncidentPlannerState, state: GameState, variable: SafeRangeVariable): number =>
  variable === 'co2MmHg' ? state.meters.lifeSupport.co2MmHg : planner.counters[variable];

const inSafeRange = (def: IncidentDefinition, planner: IncidentPlannerState, state: GameState): boolean =>
  def.triggers.every((t) => t.kind !== 'safeRange' || reading(planner, state, t.variable) <= t.max);

function updateCounters(c: IncidentPlannerState['counters'], hours: number, a: IncidentActivity): IncidentPlannerState['counters'] {
  return {
    hoursSinceCallHome: (a.callsHome ?? 0) > 0 ? 0 : c.hoursSinceCallHome + hours,
    evaHoursSinceMaintenance: c.evaHoursSinceMaintenance + (a.evaHours ?? 0),
    hoursSinceGreenhouseCare: (a.greenhouseCareHours ?? 0) > 0 ? 0 : c.hoursSinceGreenhouseCare + hours,
  };
}

/** Fuga de aire, ánimo y comida de los incidentes en impacto durante `hours`. */
function applyEffects(definitions: readonly IncidentDefinition[], state: GameState, hours: number): GameState {
  let leak = 0;
  let morale = 0;
  let food = 0;
  for (const incident of state.activeIncidents) {
    if (incident.status !== 'active') continue;
    const { effect } = definitionOf(definitions, incident.definitionId);
    leak += effect.oxygenLeakKgPerHour ?? 0;
    morale += effect.moraleLossPerDay ?? 0;
    food += effect.foodLossKgPerDay ?? 0;
  }
  if (!leak && !morale && !food) return state;
  const { lifeSupport } = state.meters;
  return {
    ...state,
    meters: { ...state.meters, lifeSupport: { ...lifeSupport, oxygenKg: Math.max(0, lifeSupport.oxygenKg - leak * hours) } },
    inventory: { ...state.inventory, foodKg: Math.max(0, state.inventory.foodKg - (food * hours) / 24) },
    crew: state.crew.map((m) => ({ ...m, morale: clamp(m.morale - (morale * hours) / 24) })),
  };
}

/** Borrador mutable dentro de una operación: todas devuelven un estado nuevo y los eventos en orden. */
class Draft {
  readonly events: IncidentEvent[] = [];
  private readonly history: MissionLogEntry[] = [];

  constructor(
    private readonly ctx: IncidentContext,
    public planner: IncidentPlannerState,
    public state: GameState,
  ) {}

  log(kind: MissionLogEntry['kind'], key: string, data?: MissionLogEntry['data']): void {
    this.history.push({ simDate: this.state.simDate, phase: this.state.phase, kind, key, ...(data ? { data } : {}) });
  }

  setIncidents(incidents: IncidentState[]): void {
    this.state = { ...this.state, activeIncidents: incidents };
  }

  replace(incident: IncidentState): void {
    this.setIncidents(this.state.activeIncidents.map((i) => (i.id === incident.id ? incident : i)));
  }

  warn(incident: IncidentState, def: IncidentDefinition): void {
    this.setIncidents([...this.state.activeIncidents, incident]);
    this.events.push({ type: 'warned', incident });
    this.log('incident', `${def.textKey}.title`, { incidentId: incident.id, status: 'warned' });
  }

  start(incident: IncidentState, def: IncidentDefinition): IncidentState {
    const started: IncidentState = { ...incident, status: 'active' };
    if (def.effect.systems) this.state = { ...this.state, systems: { ...this.state.systems, ...def.effect.systems } };
    this.replace(started);
    this.events.push({ type: 'started', incident: started });
    this.log('incident', `${def.textKey}.title`, { incidentId: incident.id, status: 'active' });
    const real = this.ctx.timeline.find((e) => e.realEvent.id === incident.realEventId)?.realEvent;
    if (real) {
      this.events.push({ type: 'realEvent', event: real });
      this.log('realEvent', real.id);
    }
    return started;
  }

  resolve(incident: IncidentState, def: IncidentDefinition): void {
    this.setIncidents(this.state.activeIncidents.filter((i) => i.id !== incident.id));
    this.events.push({ type: 'resolved', incident: { ...incident, status: 'resolved' } });
    this.log('incident', `${def.textKey}.title`, { incidentId: incident.id, status: 'resolved' });
    if (!incident.realEventId) {
      const until = iso(Date.parse(this.state.simDate) + this.ctx.rules.retriggerCooldownHours * HOUR_MS);
      this.planner = { ...this.planner, cooldownUntil: { ...this.planner.cooldownUntil, [def.id]: until } };
    }
  }

  /** La respuesta terminó: repara, reinicia su contador y, si corresponde, resuelve. */
  complete(incident: IncidentState, def: IncidentDefinition, response: IncidentResponse): void {
    const done: IncidentState = { ...incident, ...(response.work ? { progress: 1 } : {}) };
    if (response.repairs?.length) {
      const repaired = Object.fromEntries(response.repairs.map((id) => [id, 'green'] as const));
      this.state = { ...this.state, systems: { ...this.state.systems, ...repaired } };
    }
    if (response.resets) this.planner = { ...this.planner, counters: { ...this.planner.counters, [response.resets]: 0 } };
    if (response.resolves) this.resolve(done, def);
    else this.replace(done);
  }

  result(): IncidentUpdate {
    const state = this.history.length ? { ...this.state, history: [...this.state.history, ...this.history] } : this.state;
    return { planner: this.planner, state, events: this.events };
  }
}

/**
 * Avanza el planificador `hours` horas hasta `state.simDate` (§3.4): aplica los efectos en curso, dispara la
 * línea de tiempo real, los rangos seguros y las fallas con semilla (una tirada por día simulado, más en la
 * vuelta por desgaste), y pasa cada incidente de aviso a impacto y a resuelto.
 */
export function stepIncidents(
  ctx: IncidentContext,
  planner: IncidentPlannerState,
  state: GameState,
  rng: Rng,
  hours: number,
  activity: IncidentActivity = {},
): IncidentUpdate {
  const now = Date.parse(state.simDate);
  const today = state.simDate.slice(0, 10);
  const newDays = Math.max(0, Math.round((Date.parse(today) - Date.parse(planner.lastRollDay)) / DAY_MS));
  const d = new Draft(
    ctx,
    { ...planner, lastRollDay: newDays > 0 ? today : planner.lastRollDay, counters: updateCounters(planner.counters, hours, activity) },
    applyEffects(ctx.definitions, state, hours),
  );
  const available = (def: IncidentDefinition) => isAvailable(def, d.state.phase, d.state.unlockLevel);

  for (const entry of ctx.timeline) {
    if (d.planner.fired.includes(entry.id) || now < Date.parse(entry.warnAt) || now >= Date.parse(entry.endAt)) continue;
    const def = definitionOf(ctx.definitions, entry.definitionId);
    if (!available(def)) continue;
    d.planner = { ...d.planner, fired: [...d.planner.fired, entry.id] };
    d.warn(
      {
        id: entry.id,
        definitionId: def.id,
        phase: d.state.phase,
        status: 'warned',
        warnAt: entry.warnAt,
        impactAt: entry.impactAt,
        endAt: entry.endAt,
        realEventId: entry.realEvent.id,
      },
      def,
    );
  }

  for (const def of ctx.definitions) {
    if (!available(def)) continue;
    // Las tiradas se hacen siempre, para que la secuencia del Rng no dependa de lo que pasa en la partida.
    const rolled = def.triggers.map((t) => {
      if (t.kind !== 'random') return false;
      const chance = t.chancePerDay * (t.wear && d.state.phase === 'cruiseBack' ? ctx.rules.wearMultiplierBack : 1);
      let hit = false;
      for (let day = 0; day < newDays; day++) hit = rng.chance(chance) || hit;
      return hit;
    });
    const blocked =
      d.state.activeIncidents.some((i) => i.definitionId === def.id) ||
      now < Date.parse(d.planner.cooldownUntil[def.id] ?? '1970-01-01T00:00:00Z');
    const outOfRange = def.triggers.some((t) => t.kind === 'safeRange' && reading(d.planner, d.state, t.variable) > t.max);
    if (blocked || !(outOfRange || rolled.includes(true))) continue;
    d.planner = { ...d.planner, seq: d.planner.seq + 1 };
    const impactMs = now + def.warningHours * HOUR_MS;
    const incident: IncidentState = {
      id: `${def.id}-${d.planner.seq}`,
      definitionId: def.id,
      phase: d.state.phase,
      status: 'warned',
      warnAt: state.simDate,
      impactAt: iso(impactMs),
    };
    d.warn(incident, def);
    d.events.push({
      type: 'alert',
      alert: { id: incident.id, warnAt: incident.warnAt!, impactAt: incident.impactAt, endAt: iso(impactMs + ctx.rules.brakeHours * HOUR_MS), reasonKey: def.textKey },
    });
  }

  for (const original of [...d.state.activeIncidents]) {
    const def = definitionOf(ctx.definitions, original.definitionId);
    let incident = original;
    if (incident.status === 'warned' && now >= Date.parse(incident.impactAt)) incident = d.start(incident, def);
    if (incident.status !== 'active') continue;
    const ended =
      def.end === 'time'
        ? incident.endAt !== undefined && now >= Date.parse(incident.endAt)
        : def.end === 'inRange' && inSafeRange(def, d.planner, d.state);
    if (ended) d.resolve(incident, def);
  }

  return d.result();
}

const responseOf = (def: IncidentDefinition, id: string): IncidentResponse | undefined => def.responses.find((r) => r.id === id);

/** ¿Se puede elegir ahora? Una respuesta por incidente y sólo si alcanza para pagar su coste (§3.6). */
export function canRespond(ctx: IncidentContext, state: GameState, incidentId: string, responseId: string): boolean {
  const incident = state.activeIncidents.find((i) => i.id === incidentId);
  if (!incident || incident.responseId) return false;
  const response = responseOf(definitionOf(ctx.definitions, incident.definitionId), responseId);
  if (!response) return false;
  const { energyKwh = 0, spares = 0, foodKg = 0, oxygenKg = 0 } = response.cost;
  const { meters, inventory } = state;
  return (
    energyKwh <= meters.energy.batteryKwh &&
    spares <= inventory.spares &&
    foodKg <= inventory.foodKg &&
    oxygenKg <= meters.lifeSupport.oxygenKg
  );
}

/** Respuestas de un incidente con su disponibilidad, para mostrarlas con su coste y su semáforo. */
export const incidentResponses = (ctx: IncidentContext, state: GameState, incidentId: string) => {
  const incident = state.activeIncidents.find((i) => i.id === incidentId);
  if (!incident) return [];
  return definitionOf(ctx.definitions, incident.definitionId).responses.map((response) => ({
    response,
    available: canRespond(ctx, state, incidentId, response.id),
  }));
};

/** El jugador elige una respuesta: paga el coste ya; si no requiere trabajo, se completa en el acto. */
export function respondToIncident(
  ctx: IncidentContext,
  planner: IncidentPlannerState,
  state: GameState,
  incidentId: string,
  responseId: string,
): IncidentUpdate {
  if (!canRespond(ctx, state, incidentId, responseId)) throw new Error(`respondToIncident: ${responseId} no está disponible`);
  const incident = state.activeIncidents.find((i) => i.id === incidentId)!;
  const def = definitionOf(ctx.definitions, incident.definitionId);
  const response = responseOf(def, responseId)!;
  const { energyKwh = 0, spares = 0, foodKg = 0, oxygenKg = 0, fatigue = 0, morale = 0 } = response.cost;
  const { energy, lifeSupport } = state.meters;
  const paid: GameState = {
    ...state,
    meters: {
      energy: { ...energy, batteryKwh: energy.batteryKwh - energyKwh },
      lifeSupport: { ...lifeSupport, oxygenKg: lifeSupport.oxygenKg - oxygenKg },
    },
    inventory: { ...state.inventory, spares: state.inventory.spares - spares, foodKg: state.inventory.foodKg - foodKg },
    crew: state.crew.map((m) => ({ ...m, fatigue: m.resting ? m.fatigue : clamp(m.fatigue + fatigue), morale: clamp(m.morale - morale) })),
  };
  const d = new Draft(ctx, planner, paid);
  const chosen: IncidentState = { ...incident, responseId, ...(response.work ? { progress: 0 } : {}) };
  d.replace(chosen);
  d.log('decision', `${def.textKey}.response.${responseId}.title`, { incidentId });
  if (!response.work) d.complete(chosen, def, response);
  return d.result();
}

/**
 * Un tripulante trabaja `hours` en la respuesta elegida: avanza según su eficiencia y su especialidad (§3.3).
 * Sin trabajo pendiente no hace nada.
 */
export function workOnIncident(
  ctx: IncidentContext,
  planner: IncidentPlannerState,
  state: GameState,
  incidentId: string,
  crewId: CrewId,
  hours: number,
): IncidentUpdate {
  const d = new Draft(ctx, planner, state);
  const incident = state.activeIncidents.find((i) => i.id === incidentId);
  const member = state.crew.find((m) => m.id === crewId);
  if (!incident?.responseId || !member) return d.result();
  const def = definitionOf(ctx.definitions, incident.definitionId);
  const response = responseOf(def, incident.responseId)!;
  if (!response.work || (incident.progress ?? 0) >= 1) return d.result();
  const speed = workSpeed(member, response.work.task, state.meters.lifeSupport.co2MmHg);
  const progress = Math.min(1, (incident.progress ?? 0) + (hours * speed) / response.work.hours);
  const next: IncidentState = { ...incident, progress };
  if (progress >= 1) d.complete(next, def, response);
  else d.replace(next);
  return d.result();
}

/** Lo que los incidentes en curso imponen a la escena y a los medidores. */
export interface IncidentModifiers extends Required<Omit<ResponseModifiers, 'energyPriority'>> {
  energyPriority: ResponseModifiers['energyPriority'] | null;
  missionControl: boolean;
  energySplit: boolean;
}

export function incidentModifiers(definitions: readonly IncidentDefinition[], state: GameState): IncidentModifiers {
  const mods: IncidentModifiers = {
    shelter: false,
    evaBlocked: false,
    sciencePaused: false,
    heatingFactor: 1,
    greenhouseOff: false,
    energyPriority: null,
    missionControl: true,
    energySplit: false,
  };
  for (const incident of state.activeIncidents) {
    const def = definitionOf(definitions, incident.definitionId);
    if (incident.status === 'active') {
      if (def.effect.missionControlOff) mods.missionControl = false;
      if (def.effect.energySplit) mods.energySplit = true;
    }
    const w = incident.responseId ? responseOf(def, incident.responseId)?.while : undefined;
    if (!w) continue;
    mods.shelter ||= !!w.shelter;
    mods.evaBlocked ||= !!w.evaBlocked;
    mods.sciencePaused ||= !!w.sciencePaused;
    mods.greenhouseOff ||= !!w.greenhouseOff;
    mods.heatingFactor *= w.heatingFactor ?? 1;
    mods.energyPriority = w.energyPriority ?? mods.energyPriority;
  }
  return mods;
}

/** Publica en el bus los eventos del planificador (los avisos del reloj los maneja la escena). */
export function publishIncidentEvents(bus: EventBus<GameEvents>, events: readonly IncidentEvent[]): void {
  for (const e of events) {
    if (e.type === 'warned') bus.emit('incident:warned', e.incident);
    else if (e.type === 'started') bus.emit('incident:started', e.incident);
    else if (e.type === 'resolved') bus.emit('incident:resolved', e.incident);
    else if (e.type === 'realEvent') bus.emit('realEvent:shown', e.event);
  }
}

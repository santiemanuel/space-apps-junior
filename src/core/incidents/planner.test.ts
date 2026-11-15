import { describe, expect, it } from 'vitest';
import { INCIDENT_RULES as R, INCIDENTS } from '../../content/incidents';
import { makeCrewMember, makeGameState, makeMeters } from '../../test-utils/factories';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import { Rng } from '../rng/Rng';
import type { GameState } from '../state/types';
import type { IncidentDefinition, IncidentId } from './definitions';
import {
  canRespond,
  incidentModifiers,
  initialPlanner,
  phaseTimeline,
  publishIncidentEvents,
  respondToIncident,
  stepIncidents,
  timelineAlert,
  workOnIncident,
  type IncidentActivity,
  type IncidentContext,
  type IncidentEvent,
  type IncidentPlannerState,
} from './planner';
import { stormTimeline, type TimelineEntry } from './timeline';

const H = 3_600_000;
const START = '2024-05-01T00:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(START) + hours * H).toISOString();
const def = (id: IncidentId) => INCIDENTS.find((d) => d.id === id)!;

const storm = stormTimeline(
  [
    {
      id: 'storm-2024-05-11',
      warnAt: at(10),
      impactAt: at(20),
      endAt: at(40),
      leadHours: 10,
      warning: { kind: 'rule48h' },
      peakMeanUGyH: 380.7,
      baselineUGyH: 7,
      capped: false,
      sourceLinks: [],
    },
  ],
  R,
  'https://radlab',
);

const ctx = (over: Partial<IncidentContext> = {}): IncidentContext => ({ definitions: INCIDENTS, rules: R, timeline: [], ...over });
/** Sólo un incidente, con una falla segura cada día. */
const forced = (id: IncidentId, over: Partial<IncidentDefinition> = {}): IncidentContext =>
  ctx({ definitions: [{ ...def(id), triggers: [{ kind: 'random', chancePerDay: 1 }], ...over }] });

/** Corre el planificador hora por hora hasta `hours`, juntando los eventos. */
function run(c: IncidentContext, hours: number, state: GameState, opts: { rng?: Rng; activity?: IncidentActivity; step?: number } = {}) {
  const rng = opts.rng ?? new Rng(1);
  const step = opts.step ?? 1;
  let planner: IncidentPlannerState = initialPlanner(state.simDate);
  let s = state;
  const events: IncidentEvent[] = [];
  const startMs = Date.parse(state.simDate);
  for (let h = step; h <= hours; h += step) {
    const r = stepIncidents(c, planner, { ...s, simDate: new Date(startMs + h * H).toISOString() }, rng, step, opts.activity);
    planner = r.planner;
    s = r.state;
    events.push(...r.events);
  }
  return { planner, state: s, events };
}

const types = (events: IncidentEvent[]) => events.map((e) => (e.type === 'realEvent' ? `real:${e.event.id}` : e.type));

describe('planificador: línea de tiempo real', () => {
  it('un evento real avisa, impacta con su tarjeta y se resuelve solo al terminar', () => {
    const { events, state } = run(ctx({ timeline: storm }), 48, makeGameState({ simDate: START }));
    expect(types(events)).toEqual(['warned', 'started', 'real:storm-2024-05-11', 'resolved']);
    const real = events.find((e) => e.type === 'realEvent');
    expect(real).toMatchObject({ event: { mission: 'BioSentinel', value: 380.7, kidValueParams: { times: 54 } } });
    expect(state.activeIncidents).toEqual([]);
    expect(state.history.map((h) => [h.kind, h.key])).toContainEqual(['realEvent', 'storm-2024-05-11']);
  });

  it('si un paso salta todo el evento, igual emite aviso, impacto y fin en orden', () => {
    const { events } = run(ctx({ timeline: storm }), 39, makeGameState({ simDate: START }), { step: 39 });
    expect(types(events)).toEqual(['warned', 'started', 'real:storm-2024-05-11']);
  });

  it('no se repite al seguir avanzando y el aviso del reloj usa la clave del incidente', () => {
    const { events } = run(ctx({ timeline: storm }), 80, makeGameState({ simDate: START }));
    expect(events.filter((e) => e.type === 'warned')).toHaveLength(1);
    expect(timelineAlert(INCIDENTS, storm[0]!)).toMatchObject({ id: 'storm-2024-05-11', reasonKey: 'incidents.radiationStorm' });
  });

  it('filtra por nivel de desbloqueo: en el nivel 1 no hay conjunción solar (§6)', () => {
    const conj: TimelineEntry = { ...storm[0]!, id: 'conjunction-2023', definitionId: 'solarConjunction', kind: 'solarConjunction' };
    const window = { start: at(0), end: at(100) };
    expect(phaseTimeline(INCIDENTS, [storm[0]!, conj], 'mars', 1, window).map((e) => e.id)).toEqual(['storm-2024-05-11']);
    expect(phaseTimeline(INCIDENTS, [storm[0]!, conj], 'mars', 4, window)).toHaveLength(2);
    expect(phaseTimeline(INCIDENTS, [conj], 'cruiseOut', 4, window)).toEqual([]);
  });
});

describe('planificador: fallas con semilla y rango seguro', () => {
  it('las fallas sólo aparecen desde su nivel de desbloqueo', () => {
    const c = forced('scrubberFailure');
    expect(run(c, 72, makeGameState({ simDate: START, unlockLevel: 1 })).events).toEqual([]);
    expect(types(run(c, 72, makeGameState({ simDate: START, unlockLevel: 2 })).events)).toContain('warned');
  });

  it('misma semilla, mismas fallas; y la nave gastada falla más en la vuelta (§4.6)', () => {
    const c = ctx({ definitions: [{ ...def('scrubberFailure'), triggers: [{ kind: 'random', chancePerDay: 0.1, wear: true }], warningHours: 0, end: 'inRange' }] });
    const failures = (phase: GameState['phase'], seed: number) =>
      run(c, 24 * 400, makeGameState({ simDate: START, unlockLevel: 4, phase }), { rng: new Rng(seed), step: 24 })
        .events.filter((e) => e.type === 'warned')
        .map((e) => (e.type === 'warned' ? e.incident.warnAt : ''));
    expect(failures('cruiseOut', 7)).toEqual(failures('cruiseOut', 7));
    expect(failures('cruiseBack', 7).length).toBeGreaterThan(failures('cruiseOut', 7).length * 1.5);
  });

  it('la falla avisa, rompe el depurador al impactar y pide un aviso nuevo para el reloj', () => {
    const { events, state } = run(forced('scrubberFailure'), 30, makeGameState({ simDate: START, unlockLevel: 2 }));
    expect(types(events)).toEqual(['warned', 'alert', 'started']);
    const alert = events.find((e) => e.type === 'alert');
    expect(alert).toMatchObject({ alert: { id: 'scrubberFailure-1', reasonKey: 'incidents.scrubberFailure' } });
    expect(state.systems.scrubber).toBe('red');
    expect(state.activeIncidents[0]).toMatchObject({ status: 'active' });
  });

  it('la reparación paga el repuesto, la ingeniera la termina antes y el depurador vuelve a verde', () => {
    const { planner, state } = run(forced('scrubberFailure'), 30, makeGameState({ simDate: START, unlockLevel: 2 }));
    const id = state.activeIncidents[0]!.id;
    const c = forced('scrubberFailure');
    const chosen = respondToIncident(c, planner, state, id, 'repair');
    expect(chosen.state.inventory.spares).toBe(state.inventory.spares - 1);
    expect(chosen.state.activeIncidents[0]).toMatchObject({ responseId: 'repair', progress: 0 });

    const byCommander = workOnIncident(c, chosen.planner, chosen.state, id, 'vega', 2);
    expect(byCommander.state.activeIncidents[0]!.progress).toBeCloseTo(2 / 3);
    const byEngineer = workOnIncident(c, chosen.planner, chosen.state, id, 'miga', 2);
    expect(types(byEngineer.events)).toEqual(['resolved']);
    expect(byEngineer.state.systems.scrubber).toBe('green');
    expect(byEngineer.planner.cooldownUntil.scrubberFailure).toBeDefined();
  });

  it('una respuesta que no alcanza a pagarse no se puede elegir', () => {
    const { planner, state } = run(forced('scrubberFailure'), 30, makeGameState({ simDate: START, unlockLevel: 2 }));
    const broke = { ...state, inventory: { ...state.inventory, spares: 0 } };
    const id = broke.activeIncidents[0]!.id;
    expect(canRespond(forced('scrubberFailure'), broke, id, 'repair')).toBe(false);
    expect(canRespond(forced('scrubberFailure'), broke, id, 'improvise')).toBe(true);
    expect(() => respondToIncident(forced('scrubberFailure'), planner, broke, id, 'repair')).toThrow();
  });

  it('el micrometeorito impacta sin aviso y la fuga se lleva el oxígeno hasta taparla', () => {
    const state = makeGameState({ simDate: START, unlockLevel: 3 });
    const { planner, state: hit } = run(forced('micrometeoroid'), 24, state);
    const leaking = run(forced('micrometeoroid'), 24 + 10, state).state;
    expect(leaking.meters.lifeSupport.oxygenKg).toBeCloseTo(hit.meters.lifeSupport.oxygenKg - 0.5);
    const id = hit.activeIncidents[0]!.id;
    const sealed = respondToIncident(forced('micrometeoroid'), planner, hit, id, 'sealModule');
    expect(types(sealed.events)).toEqual(['resolved']);
    expect(sealed.state.meters.lifeSupport.oxygenKg).toBeCloseTo(hit.meters.lifeSupport.oxygenKg - 2);
  });

  it('CO2 por encima de 3 mmHg dispara el incidente y termina al volver al rango seguro', () => {
    const c = ctx();
    const high = makeGameState({ simDate: START, unlockLevel: 3, meters: makeMeters({ lifeSupport: { oxygenKg: 40, waterL: 300, co2MmHg: 3.4 } }) });
    let { planner, state, events } = run(c, 1, high);
    expect(types(events)).toEqual(['warned', 'alert', 'started']);
    const id = state.activeIncidents[0]!.id;
    ({ planner, state } = respondToIncident(c, planner, { ...state, systems: { ...state.systems, scrubber: 'red' } }, id, 'reassignEnergy'));
    expect(state.systems.scrubber).toBe('green');
    expect(state.meters.energy.batteryKwh).toBe(high.meters.energy.batteryKwh - 6);
    const back = stepIncidents(c, planner, { ...state, simDate: at(5), meters: makeMeters() }, new Rng(1), 4);
    expect(types(back.events)).toEqual(['resolved']);
  });

  it('diez días sin llamar a casa traen aislamiento; la llamada lo resuelve y reinicia el contador', () => {
    const c = ctx({ definitions: [def('isolation')] });
    const state = makeGameState({ simDate: START, unlockLevel: 2 });
    expect(run(c, 240, state, { step: 24, activity: { callsHome: 0.5 } }).events).toEqual([]);
    const lonely = run(c, 264, state, { step: 24 });
    expect(types(lonely.events)).toEqual(['warned', 'alert', 'started']);
    const id = lonely.state.activeIncidents[0]!.id;
    const called = respondToIncident(c, lonely.planner, lonely.state, id, 'callHome');
    expect(types(called.events)).toEqual(['resolved']);
    expect(called.planner.counters.hoursSinceCallHome).toBe(0);
  });

  it('las plagas aparecen en Marte si nadie cuida el invernadero, y no en el viaje', () => {
    const c = ctx({ definitions: [def('greenhousePest')] });
    const mars = makeGameState({ simDate: START, unlockLevel: 2, phase: 'mars' });
    expect(run(c, 96, mars, { activity: { greenhouseCareHours: 1 } }).events).toEqual([]);
    const pest = run(c, 96, mars);
    expect(pest.state.activeIncidents[0]).toMatchObject({ definitionId: 'greenhousePest', status: 'active' });
    expect(pest.state.systems.greenhouse).toBe('yellow');
    expect(run(c, 96, { ...mars, phase: 'cruiseOut' }).events.some((e) => e.type === 'warned' && e.incident.definitionId === 'greenhousePest')).toBe(false);
  });
});

describe('planificador: modificadores y bus', () => {
  it('ir al refugio frena tareas y EVA; la conjunción apaga el Control de Misión', () => {
    const shelter = makeGameState({
      activeIncidents: [
        { id: 's', definitionId: 'radiationStorm', phase: 'mars', status: 'warned', impactAt: at(1), responseId: 'goToShelter' },
        { id: 'c', definitionId: 'solarConjunction', phase: 'mars', status: 'active', impactAt: at(0) },
        { id: 'n', definitionId: 'extremeNight', phase: 'mars', status: 'active', impactAt: at(0), responseId: 'closeZone' },
      ],
    });
    expect(incidentModifiers(INCIDENTS, shelter)).toMatchObject({
      shelter: true,
      evaBlocked: true,
      sciencePaused: true,
      missionControl: false,
      heatingFactor: 0.6,
      greenhouseOff: true,
    });
    expect(incidentModifiers(INCIDENTS, makeGameState()).missionControl).toBe(true);
  });

  it('el trabajo cansado rinde menos: la reparación avanza con la eficiencia (§3.3)', () => {
    const { planner, state } = run(forced('scrubberFailure'), 30, makeGameState({ simDate: START, unlockLevel: 2 }));
    const tired = { ...state, crew: state.crew.map((m) => (m.id === 'vega' ? makeCrewMember({ fatigue: 1, condition: 0.5 }) : m)) };
    const id = state.activeIncidents[0]!.id;
    const chosen = respondToIncident(forced('scrubberFailure'), planner, tired, id, 'repair');
    const r = workOnIncident(forced('scrubberFailure'), chosen.planner, chosen.state, id, 'vega', 3);
    expect(r.state.activeIncidents[0]!.progress).toBeCloseTo(0.625);
  });

  it('publica incident:* y realEvent:shown con el RealEvent completo', () => {
    const bus = new EventBus<GameEvents>();
    const seen: string[] = [];
    bus.on('incident:warned', (i) => seen.push(`warned:${i.id}`));
    bus.on('incident:started', (i) => seen.push(`started:${i.status}`));
    bus.on('incident:resolved', (i) => seen.push(`resolved:${i.status}`));
    bus.on('realEvent:shown', (e) => seen.push(`real:${e.instrument}:${e.sourceUrl}`));
    publishIncidentEvents(bus, run(ctx({ timeline: storm }), 48, makeGameState({ simDate: START })).events);
    expect(seen).toEqual(['warned:storm-2024-05-11', 'started:active', 'real:BPD:https://radlab', 'resolved:resolved']);
  });
});

import { describe, expect, it } from 'vitest';
import { CAMPAIGN_2024 } from '../content/campaign';
import { INCIDENT_RULES, INCIDENTS } from '../content/incidents';
import { createPhaseClock, type TimedPhase } from '../core/clock/schedule';
import type { UnlockLevel } from '../core/flow/types';
import {
  initialPlanner,
  phaseTimeline,
  publishIncidentEvents,
  stepIncidents,
  timelineAlert,
  type IncidentContext,
} from '../core/incidents/planner';
import { EventBus } from '../core/events/EventBus';
import type { GameEvents } from '../core/events/GameEvents';
import type { RealEvent } from '../core/events/RealEvent';
import { Rng } from '../core/rng/Rng';
import { MARS_CONTENT } from '../content/gale';
import { VOYAGE_CONTENT } from '../content/ship';
import { MarsSession } from '../core/mars/MarsSession';
import { VoyageSession } from '../core/voyage/VoyageSession';
import { makeGameState, makeMeters } from '../test-utils/factories';
import { seriesFor } from './realData';
import { galeWeatherOn } from './series';
import { incidentTimeline } from './incidentTimeline';

const campaign = (phase: TimedPhase) => incidentTimeline(phase, CAMPAIGN_2024.windows[phase], INCIDENTS, INCIDENT_RULES);
const ids = (phase: TimedPhase) => campaign(phase).map((e) => e.id);

describe('línea de tiempo de la campaña 2024', () => {
  it('la ida trae la tormenta de mayo con el aviso real de DONKI (X1.0 del 08/05)', () => {
    const may = campaign('cruiseOut').find((e) => e.id === 'storm-2024-05-11')!;
    expect(may).toMatchObject({ warnAt: '2024-05-08T05:09:00Z', impactAt: '2024-05-11T02:10:00Z' });
    // Hay serie por minuto: la tarjeta muestra el pico real (653 μGy/h, §2), sin el tope de las medias diarias.
    expect(may.realEvent).toMatchObject({ mission: 'BioSentinel', value: 652.7, date: '2024-05-13T20:52:00Z', kidValueParams: { times: 88 } });
    expect(may.realEvent.capped).toBeUndefined();
    expect(ids('cruiseOut')).toEqual(['storm-2024-01-29', 'storm-2024-02-09', 'storm-2024-03-23', 'storm-2024-05-11']);
  });

  it('en Marte: el SEP del 20/05 en RAD, el polvo del 28/05 y la noche helada del 24/05; sin conjunción', () => {
    expect(ids('mars')).toEqual(['mars-storm-2024-05-20', 'cold-2024-05-24', 'dust-2024-05-28']);
    const sep = campaign('mars')[0]!.realEvent;
    expect(sep).toMatchObject({ instrument: 'RAD', mission: 'Curiosity', value: 304, kidValueParams: { times: 78 } });
    expect(campaign('mars')[0]).toMatchObject({ impactAt: '2024-05-20T05:38:56Z', warnAt: '2024-05-18T05:38:56.000Z' });
  });

  it('la vuelta llega hasta la tormenta del 09/10 (X1.8) con el valor recortado y avisado', () => {
    expect(ids('cruiseBack')).toEqual(['storm-2024-06-08', 'storm-2024-07-23', 'storm-2024-09-15', 'storm-2024-10-09']);
    const october = campaign('cruiseBack').at(-1)!;
    expect(Date.parse(october.impactAt) - Date.parse(october.warnAt)).toBeCloseTo(1.9 * 3_600_000, -5);
    expect(october.realEvent).toMatchObject({ value: 650, capped: true });
  });

  it('en el modo libre, una estancia en noviembre de 2023 tiene la conjunción solar real', () => {
    const window = { start: '2023-11-01T00:00:00Z', end: '2023-12-01T00:00:00Z' };
    const conj = incidentTimeline('mars', window, INCIDENTS, INCIDENT_RULES).find((e) => e.definitionId === 'solarConjunction');
    expect(conj).toMatchObject({ id: 'conjunction-2023', impactAt: '2023-11-11T00:00:00.000Z', endAt: '2023-11-26T00:00:00.000Z' });
    expect(conj!.realEvent.sourceUrl).toMatch(/^https:\/\/www\.jpl\.nasa\.gov\//);
  });
});

/** Juega una fase entera con el reloj real y el planificador, como lo harán las escenas. */
function playPhase(phase: TimedPhase, unlockLevel: UnlockLevel) {
  const window = CAMPAIGN_2024.windows[phase];
  const timeline = phaseTimeline(INCIDENTS, incidentTimeline(phase, window, INCIDENTS, INCIDENT_RULES), phase, unlockLevel, window);
  const ctx: IncidentContext = { definitions: INCIDENTS, rules: INCIDENT_RULES, timeline };
  const clock = createPhaseClock({ calendar: CAMPAIGN_2024, phase, length: 'short', alerts: timeline.map((e) => timelineAlert(INCIDENTS, e)) });
  const bus = new EventBus<GameEvents>();
  const shown: RealEvent[] = [];
  const levels: { level: string; at: string }[] = [];
  bus.on('realEvent:shown', (e) => shown.push(e));
  const rng = new Rng(42);
  let planner = initialPlanner(window.start);
  let state = makeGameState({ phase, simDate: window.start, unlockLevel });
  while (!clock.finished) {
    const before = Date.parse(clock.simDate);
    for (const e of clock.advance(1)) if (e.type === 'level') levels.push({ level: e.level, at: e.at });
    const r = stepIncidents(ctx, planner, { ...state, simDate: clock.simDate }, rng, (Date.parse(clock.simDate) - before) / 3_600_000, { callsHome: 1 });
    ({ planner, state } = r);
    for (const e of r.events) if (e.type === 'alert') clock.addAlert(e.alert);
    publishIncidentEvents(bus, r.events);
  }
  return { shown, levels, timeline };
}

describe('planificador + reloj en la campaña 2024', () => {
  it('el reloj pasa a Alerta con el aviso real del 08/05 y cada evento real abre su tarjeta', () => {
    const { shown, levels, timeline } = playPhase('cruiseOut', 1);
    expect(levels).toContainEqual({ level: 'alert', at: '2024-05-08T05:09:00.000Z' });
    expect(shown.map((e) => e.id)).toEqual(timeline.map((e) => e.realEvent.id));
  });

  it('en Marte con nivel 1 no hay noche extrema (es del nivel 3), pero sí la tormenta y el polvo', () => {
    expect(playPhase('mars', 1).shown.map((e) => e.id)).toEqual(['mars-storm-2024-05-20', 'dust-2024-05-28']);
    expect(playPhase('mars', 3).shown.map((e) => e.id)).toEqual(['mars-storm-2024-05-20', 'cold-2024-05-24', 'dust-2024-05-28']);
  });
});

describe('Voyage con los datos reales de 2024', () => {
  it('la tormenta de mayo frena el reloj, todos van al refugio y la ida termina el 15/05', () => {
    const bus = new EventBus<GameEvents>();
    const completed: string[] = [];
    bus.on('phase:completed', (r) => completed.push(`${r.outcome}@${r.state.simDate}`));
    const session = new VoyageSession({
      leg: 'out',
      state: makeGameState({ simDate: '2024-05-07T00:00:00.000Z', meters: makeMeters({ lifeSupport: { oxygenKg: 400, waterL: 300, co2MmHg: 1.5 } }) }),
      bus,
      content: VOYAGE_CONTENT,
      timeline: campaign('cruiseOut'),
      doseRate: (date) => seriesFor('cruiseOut', date).dose,
    });
    const input = { activeZone: 'command', interacting: false };
    for (let i = 0; i < 40_000 && !session.outcome; i++) {
      const storm = session.pendingDecisions().find((d) => d.incident.id === 'storm-2024-05-11');
      if (storm && session.level === 'impact') {
        session.respond(storm.incident.id, 'goToShelter');
        input.activeZone = 'shelter';
      }
      session.update(0.25, input);
    }
    expect(session.state.history).toContainEqual(expect.objectContaining({ key: 'hud.log.allInShelter', data: expect.objectContaining({ incidentId: 'storm-2024-05-11' }) }));
    expect(completed).toEqual(['completed@2024-05-15T00:00:00.000Z']);
  });
});

describe('Mars con los datos reales de 2024', () => {
  it('los 19 soles en Gale: la tormenta del 20/05, el polvo del 28/05 y el azufre de Curiosity del 30/05 llegan, y la tripulación aguanta', () => {
    const bus = new EventBus<GameEvents>();
    const shown: string[] = [];
    const cascade: string[] = [];
    const completed: string[] = [];
    bus.on('realEvent:shown', (e) => shown.push(e.id));
    bus.on('cascade:entered', (e) => cascade.push(e.meter));
    bus.on('phase:completed', (r) => completed.push(r.outcome));
    const session = new MarsSession({
      state: makeGameState({
        phase: 'mars',
        simDate: CAMPAIGN_2024.windows.mars.start,
        meters: makeMeters({ energy: { batteryKwh: 160, capacityKwh: 160 }, lifeSupport: { oxygenKg: 80, waterL: 300, co2MmHg: 1.5 } }),
      }),
      bus,
      content: MARS_CONTENT,
      timeline: campaign('mars'),
      doseRate: (date) => seriesFor('mars', date).dose,
      weather: galeWeatherOn,
    });
    for (let i = 0; i < 60_000 && !session.outcome; i++) {
      for (const d of session.pendingDecisions()) session.respond(d.incident.id, d.options[0]!.response.id);
      // Al final, el embarque: la carga del depósito a la nave.
      const departing = session.departing;
      const zone = departing ? (departing.cargo === 'stored' ? 'storage' : 'ship') : 'shelter';
      session.update(0.25, { activeZone: zone, interacting: false });
      if (departing) session.doAction(zone);
    }
    expect(shown).toEqual(['mars-storm-2024-05-20', 'dust-2024-05-28', 'curiositySulfur2024']);
    expect(completed).toEqual(['completed']);
    // El polvo real de fines de mayo deja la batería en cero: la base entra en emergencia pero no se termina.
    expect(cascade).toContain('energy');
  });
});

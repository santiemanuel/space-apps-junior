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
import { makeGameState } from '../test-utils/factories';
import { incidentTimeline } from './incidentTimeline';

const campaign = (phase: TimedPhase) => incidentTimeline(phase, CAMPAIGN_2024.windows[phase], INCIDENTS, INCIDENT_RULES);
const ids = (phase: TimedPhase) => campaign(phase).map((e) => e.id);

describe('línea de tiempo de la campaña 2024', () => {
  it('la ida trae la tormenta de mayo con el aviso real de DONKI (X1.0 del 08/05)', () => {
    const may = campaign('cruiseOut').find((e) => e.id === 'storm-2024-05-11')!;
    expect(may).toMatchObject({ warnAt: '2024-05-08T05:09:00Z', impactAt: '2024-05-11T02:10:00Z' });
    expect(may.realEvent).toMatchObject({ mission: 'BioSentinel', value: 380.7 });
    expect(ids('cruiseOut')).toEqual(['storm-2024-01-29', 'storm-2024-02-09', 'storm-2024-03-23', 'storm-2024-05-11']);
  });

  it('en Marte: el SEP del 20/05 en RAD, el polvo del 28/05 y la noche helada del 24/05; sin conjunción', () => {
    expect(ids('mars')).toEqual(['mars-storm-2024-05-20', 'cold-2024-05-24', 'dust-2024-05-28']);
    const sep = campaign('mars')[0]!.realEvent;
    expect(sep).toMatchObject({ instrument: 'RAD', mission: 'Curiosity', value: 69.3, kidValueParams: { times: 14 } });
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

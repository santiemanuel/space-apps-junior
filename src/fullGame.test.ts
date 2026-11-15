import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, REPORT_RULES } from './content/achievements';
import { MARS_CONTENT } from './content/gale';
import { INCIDENTS } from './content/incidents';
import { CARGO_GRID, OUTBOUND_PROFILES, RETURN_RULES } from './content/loadouts';
import { MANEUVER_RULES, MANEUVERS, maneuverConditions } from './content/maneuvers';
import { MISSION_START } from './content/missionStart';
import { VOYAGE_CONTENT } from './content/ship';
import { EventBus } from './core/events/EventBus';
import type { GameEvents } from './core/events/GameEvents';
import { MissionFlow, type FlowStep } from './core/flow/MissionFlow';
import { createNewGame } from './core/flow/newGame';
import type { ManeuverId, PhaseResult } from './core/flow/types';
import type { HabitatSession } from './core/habitat/HabitatSession';
import { autoPack, cargoItems, gridReturnResult } from './core/loadout/cargoGrid';
import { availableForReturn, outboundResult } from './core/loadout/loadout';
import { ManeuverRun } from './core/maneuvers/ManeuverRun';
import { MarsSession } from './core/mars/MarsSession';
import { buildReport } from './core/report/report';
import type { GameState } from './core/state/types';
import { VoyageSession } from './core/voyage/VoyageSession';
import { incidentTimeline } from './data/incidentTimeline';
import { seriesFor } from './data/realData';
import { galeWeatherOn } from './data/series';
import { VAN_ALLEN } from './data/vanAllen';

const DT = 0.25;
const MAX_STEPS = 200_000;

/** Maniobra jugada con buen pulso: arriesga los sistemas que no estén en verde y aprieta cerca del centro de la zona. */
function playManeuver(id: ManeuverId, state: GameState, bus: EventBus<GameEvents>): PhaseResult {
  const run = new ManeuverRun(MANEUVERS[id], state, MANEUVER_RULES, maneuverConditions(id, state, galeWeatherOn(state.simDate).uv));
  for (const item of run.items) run.decide(item.systemId, item.status === 'green' ? 'go' : 'risk');
  run.start();
  while (run.step === 'stage') {
    // Los minijuegos de preparación y pilotaje, jugados bien; la barra, cerca del centro.
    if ((run.stage!.kind ?? 'timing') !== 'timing') run.complete(0.9);
    else {
      for (let i = 0; i < 10_000 && Math.abs(run.marker - run.zone!.center) > run.zone!.width / 4; i++) run.update(0.005);
      run.press();
    }
    run.next();
  }
  if (run.definition.effect === 'vanAllen') bus.emit('realEvent:shown', VAN_ALLEN.realEvent);
  return run.toPhaseResult();
}

/**
 * Simulación jugada por un jugador prudente: responde cada incidente con la opción verde (o la primera posible) y,
 * con orden de refugio, lleva a su tripulante al refugio. En el embarque de Marte va al depósito, carga y la lleva a
 * la nave. Devuelve cuando la fase emite `phase:completed`.
 */
function playHabitat(session: HabitatSession, shelterZone: string): number {
  let seconds = 0;
  for (let i = 0; i < MAX_STEPS && !session.outcome; i++) {
    if (!session.departing) seconds += DT;
    for (const d of session.pendingDecisions()) {
      const option = d.options.find((o) => o.available && o.response.risk === 'green') ?? d.options.find((o) => o.available);
      if (option) session.respond(d.incident.id, option.response.id);
    }
    const sheltering = session.state.activeIncidents.some((i) => i.definitionId === 'radiationStorm' && i.responseId === 'goToShelter');
    const departing = session.departing;
    const plan = departing && MARS_CONTENT.departure!;
    const zone = plan ? (departing.cargo === 'stored' ? plan.cargoZone : plan.shipZone) : sheltering ? shelterZone : null;
    session.update(DT, { activeZone: zone, interacting: false });
    if (departing) session.doAction(zone);
  }
  if (!session.outcome) throw new Error(`la fase ${session.phase} no terminó`);
  // Segundos reales de la fase, sin contar el embarque final.
  return seconds;
}

function voyage(state: GameState, bus: EventBus<GameEvents>, leg: 'out' | 'back'): VoyageSession {
  const phase = leg === 'out' ? 'cruiseOut' : 'cruiseBack';
  const window = VOYAGE_CONTENT.calendar.windows[phase];
  return new VoyageSession({
    leg,
    state,
    bus,
    content: VOYAGE_CONTENT,
    timeline: incidentTimeline(phase, window, INCIDENTS, VOYAGE_CONTENT.incidentRules),
    doseRate: (date) => seriesFor(phase, date).dose,
  });
}

function mars(state: GameState, bus: EventBus<GameEvents>): MarsSession {
  const window = MARS_CONTENT.calendar.windows.mars;
  return new MarsSession({
    state,
    bus,
    content: MARS_CONTENT,
    timeline: incidentTimeline('mars', window, INCIDENTS, MARS_CONTENT.incidentRules),
    doseRate: (date) => seriesFor('mars', date).dose,
    weather: galeWeatherOn,
  });
}

/** Partida completa sin Phaser, conectada como en `FlowDirector`: de `prep` al informe. */
function playMission(seed: number) {
  const flow = new MissionFlow(
    createNewGame({ mode: 'campaign2024', length: 'short', helpMode: false }, { seed, unlockLevel: 1, start: MISSION_START }),
  );
  const steps: FlowStep[] = [flow.step];
  const results: PhaseResult[] = [];
  const bus = new EventBus<GameEvents>();
  bus.on('phase:completed', (r) => results.push(r));
  bus.on('phase:progress', (s) => flow.progress(s));
  bus.on('realEvent:shown', (e) => flow.recordRealEvent(e));

  let marsSeconds = 0;
  while (flow.step.kind !== 'report' && steps.length < 20) {
    const step = flow.step;
    const state = flow.state;
    if (step.kind === 'loadout' && step.mode === 'outbound') results.push(outboundResult(state, OUTBOUND_PROFILES.balanced));
    else if (step.kind === 'loadout') {
      // La vuelta: la bodega de casilleros, con "acomodar solo".
      const items = cargoItems(state, RETURN_RULES, CARGO_GRID);
      results.push(gridReturnResult(state, items, autoPack(items, CARGO_GRID, RETURN_RULES, availableForReturn(state, RETURN_RULES).waterPoolL)));
    }
    else if (step.kind === 'maneuver') results.push(playManeuver(step.maneuverId, state, bus));
    else if (step.kind === 'voyage') playHabitat(voyage(state, bus, step.leg), VOYAGE_CONTENT.shelterZone);
    else marsSeconds = playHabitat(mars(state, bus), MARS_CONTENT.shelterZone);
    steps.push(flow.complete(results.at(-1)!)!);
  }
  return { flow, steps, final: flow.state, marsSeconds };
}

describe('partida completa (campaña 2024, modo corto, semilla fija)', () => {
  const { flow, steps, final, marsSeconds } = playMission(2024);

  it('la estancia en Gale (20 soles) dura entre 10 y 12 minutos reales', () => {
    expect(marsSeconds / 60).toBeGreaterThanOrEqual(10);
    expect(marsSeconds / 60).toBeLessThanOrEqual(12);
  });

  it('recorre las 7 fases en orden hasta el informe, con la tripulación de vuelta', () => {
    expect(steps).toEqual([
      { kind: 'loadout', mode: 'outbound' },
      { kind: 'maneuver', maneuverId: 'ascent' },
      { kind: 'voyage', leg: 'out' },
      { kind: 'maneuver', maneuverId: 'landing' },
      { kind: 'mars' },
      { kind: 'loadout', mode: 'return' },
      { kind: 'maneuver', maneuverId: 'marsAscent' },
      { kind: 'voyage', leg: 'back' },
      { kind: 'maneuver', maneuverId: 'reentry' },
      { kind: 'report', outcome: 'completed' },
    ]);
    expect(flow.outcome).toBe('completed');
    expect(Date.parse(final.simDate)).toBe(Date.parse(VOYAGE_CONTENT.calendar.windows.cruiseBack.end));
    expect(final.habitat).toBeUndefined();
  });

  it('vive la tormenta real de mayo de 2024 y la anota una sola vez, con sus datos, para el informe', () => {
    const report = buildReport(final, 'completed', ACHIEVEMENTS, REPORT_RULES);
    const ids = report.realEvents.map((e) => e.id);
    expect(ids).toContain(VAN_ALLEN.realEvent.id);
    expect(ids).toContain('storm-2024-05-11');
    expect(new Set(ids).size).toBe(ids.length);
    expect(report.decisions.some((e) => e.key === 'incidents.radiationStorm.title')).toBe(true);
  });

  it('el aire alcanza para toda la misión y en Marte se usó la batería de la base', () => {
    expect(final.meters.lifeSupport.oxygenKg).toBeGreaterThan(0);
    expect(final.meters.energy.capacityKwh).toBe(VOYAGE_CONTENT.power.capacityKwh);
    expect(final.landingDistanceKm).not.toBeNull();
    expect(final.history.some((e) => e.phase === 'mars' && e.kind === 'incident')).toBe(true);
  });

  it('con la misma semilla la partida es idéntica', () => {
    expect(playMission(2024).final).toEqual(final);
  });
});

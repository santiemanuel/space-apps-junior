import { describe, expect, it } from 'vitest';
import { makeGameState, makeRealEvent } from '../../test-utils/factories';
import { initialCascade } from '../cascade/types';
import { initialPlanner } from '../incidents/planner';
import type { GameState, MissionLogEntry } from '../state/types';
import { MissionFlow, stepFor, type FlowStep } from './MissionFlow';
import type { PhaseId, PhaseResult } from './types';

/** Resultado falso de la fase en curso, con lo que dejaría la escena real en el historial. */
function fakeResult(flow: MissionFlow, extra: MissionLogEntry[] = [], over: Partial<PhaseResult> = {}): PhaseResult {
  const state: GameState = flow.state;
  state.history.push(...extra);
  return { phase: state.phase, outcome: 'completed', state, achievements: [], ...over };
}

const entry = (phase: PhaseId, kind: MissionLogEntry['kind'], key: string): MissionLogEntry => ({
  simDate: '2024-06-04T00:00:00Z',
  phase,
  kind,
  key,
});

describe('flujo de misión', () => {
  it('recorre las 7 fases en orden, con la carga y la maniobra del despegue de Marte, hasta el informe', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'prep' }));
    const steps: FlowStep[] = [flow.step];
    const sceneExtra: Partial<Record<string, MissionLogEntry[]>> = {
      'loadout:return': [entry('marsAscent', 'loadout', 'return')],
      'maneuver:marsAscent': [entry('marsAscent', 'maneuver', 'marsAscent')],
    };
    while (flow.step.kind !== 'report') {
      const step = flow.step;
      const id = step.kind === 'loadout' ? `loadout:${step.mode}` : step.kind === 'maneuver' ? `maneuver:${step.maneuverId}` : step.kind;
      steps.push(flow.complete(fakeResult(flow, sceneExtra[id]))!);
    }
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
  });

  it('aplica el estado que devuelve cada fase', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'prep', loadout: null }));
    const result = fakeResult(flow);
    result.state.loadout = 'workshop';
    flow.complete(result);
    expect(flow.state).toMatchObject({ phase: 'ascent', loadout: 'workshop' });
  });

  it('una misión suspendida va directo al informe, sin avanzar de fase', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'cruiseBack' }));
    expect(flow.complete(fakeResult(flow, [], { outcome: 'suspended' }))).toEqual({ kind: 'report', outcome: 'suspended' });
    expect(flow.state.phase).toBe('cruiseBack');
  });

  it('ignora resultados de otra fase o que llegan después del final', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'landing' }));
    expect(flow.complete(fakeResult(flow, [], { phase: 'ascent' }))).toBeNull();
    expect(flow.state.phase).toBe('landing');
    flow.complete(fakeResult(flow, [], { outcome: 'suspended' }));
    expect(flow.complete(fakeResult(flow))).toBeNull();
  });

  it('guarda las tarjetas vividas en el historial una sola vez, aunque la escena devuelva un estado sin ellas', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'cruiseOut' }));
    const stale = fakeResult(flow);
    flow.recordRealEvent(makeRealEvent());
    flow.recordRealEvent(makeRealEvent());
    expect(flow.state.history.filter((e) => e.kind === 'realEvent')).toHaveLength(1);
    flow.complete(stale);
    flow.recordRealEvent(makeRealEvent());
    expect(flow.state.history.filter((e) => e.kind === 'realEvent')).toHaveLength(1);
  });

  it('junta los logros de todas las fases sin repetir', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'cruiseOut' }));
    flow.complete(fakeResult(flow, [], { achievements: ['shelterInTime'] }));
    flow.complete(fakeResult(flow, [], { achievements: ['shelterInTime', 'zeroExtraXrays'] }));
    expect(flow.state.achievements).toEqual(['shelterInTime', 'zeroExtraXrays']);
  });

  it('una partida guardada en el despegue de Marte retoma la maniobra si la carga ya estaba hecha', () => {
    expect(stepFor(makeGameState({ phase: 'marsAscent' }))).toEqual({ kind: 'loadout', mode: 'return' });
    expect(stepFor(makeGameState({ phase: 'marsAscent', history: [entry('marsAscent', 'loadout', 'return')] }))).toEqual({
      kind: 'maneuver',
      maneuverId: 'marsAscent',
    });
  });

  it('no comparte el estado con quien lo creó', () => {
    const state = makeGameState({ phase: 'prep' });
    const flow = new MissionFlow(state);
    flow.complete(fakeResult(flow));
    expect(state.phase).toBe('prep');
  });

  it('guarda el estado que publica la fase en curso (Voyage/Mars) y descarta el de otra fase', () => {
    const flow = new MissionFlow(makeGameState({ phase: 'cruiseOut', simDate: '2024-01-15T00:00:00Z' }));
    flow.progress(makeGameState({ phase: 'cruiseOut', simDate: '2024-02-01T00:00:00Z' }));
    flow.progress(makeGameState({ phase: 'mars', simDate: '2024-05-20T00:00:00Z' }));
    expect(flow.state).toMatchObject({ phase: 'cruiseOut', simDate: '2024-02-01T00:00:00Z' });
  });

  it('no repite una tarjeta que la simulación ya anotó, ni deja en el estado lo que sólo sirve a mitad de fase', () => {
    const event = makeRealEvent({ id: 'storm-2024-05-11' });
    const flow = new MissionFlow(makeGameState({ phase: 'cruiseOut' }));
    flow.recordRealEvent(event);
    const inPhase = flow.state;
    inPhase.history.length = 0;
    inPhase.history.push({ simDate: inPhase.simDate, phase: 'cruiseOut', kind: 'realEvent', key: event.id });
    flow.progress({ ...inPhase, habitat: { planner: initialPlanner(inPhase.simDate), cascade: initialCascade() } });
    expect(flow.state.history.filter((e) => e.key === event.id)).toHaveLength(1);
    expect(flow.state.habitat).toBeDefined();
    flow.complete({ phase: 'cruiseOut', outcome: 'completed', state: flow.state, achievements: [] });
    expect(flow.state.history.filter((e) => e.key === event.id)).toHaveLength(1);
    expect(flow.state.habitat).toBeUndefined();
  });
});

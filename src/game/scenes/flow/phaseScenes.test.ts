import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../core/events/EventBus';
import type { GameEvents } from '../../../core/events/GameEvents';
import { stepFor, type FlowStep } from '../../../core/flow/MissionFlow';
import { PHASE_ORDER } from '../../../core/flow/types';
import { makeGameState } from '../../../test-utils/factories';
import { sceneForStep } from './phaseScenes';

describe('escena de cada paso del flujo', () => {
  const bus = new EventBus<GameEvents>();

  it('sigue el mapa de escenas del plan', () => {
    const steps: FlowStep[] = [...PHASE_ORDER.map((phase) => stepFor(makeGameState({ phase }))), { kind: 'report', outcome: 'suspended' }];
    const labels = steps.map((step) => {
      const { key, data } = sceneForStep(step, makeGameState(), bus);
      const extra = 'mode' in data ? data.mode : 'maneuverId' in data ? data.maneuverId : 'leg' in data ? data.leg : 'outcome' in data ? data.outcome : '';
      return `${key}${extra ? `:${extra}` : ''}`;
    });
    expect(labels).toEqual([
      'Loadout:outbound',
      'Maneuver:ascent',
      'Voyage:out',
      'Maneuver:landing',
      'Mars',
      'Loadout:return',
      'Voyage:back',
      'Maneuver:reentry',
      'Report:suspended',
    ]);
  });

  it('le pasa a la escena el mismo estado y el mismo bus', () => {
    const state = makeGameState({ phase: 'mars' });
    const { data } = sceneForStep(stepFor(state), state, bus);
    expect(data.state).toBe(state);
    expect(data.bus).toBe(bus);
  });
});

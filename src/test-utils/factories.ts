import type { EnvironmentSnapshot } from '../core/environment/types';
import type { MissionDefinition } from '../core/missions/types';

export function makeMission(over: Partial<MissionDefinition> = {}): MissionDefinition {
  return {
    id: 'm1',
    title: 'Misión de prueba',
    description: '',
    type: 'repair',
    stationId: 's1',
    workSeconds: 4,
    exposure: { radiation: 0, debris: 0 },
    reward: { oxygen: 5 },
    failurePenalty: { oxygen: -3 },
    ...over,
  };
}

export function makeEnvironment(over: Partial<EnvironmentSnapshot> = {}): EnvironmentSnapshot {
  return { flares: [], neos: [], source: 'fixture', radiationRisk: 0, debrisThreat: 0, ...over };
}

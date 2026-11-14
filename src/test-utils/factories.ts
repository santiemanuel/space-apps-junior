import type { EnvironmentSnapshot } from '../core/environment/types';
import type { MissionDefinition } from '../core/missions/types';
import type { GameSessionOptions } from '../core/session/GameSession';

export function makeMission(over: Partial<MissionDefinition> = {}): MissionDefinition {
  return {
    id: 'm1',
    title: 'Misión de prueba',
    description: '',
    type: 'repair',
    stationId: 's1',
    workSeconds: 4,
    exposure: { radiation: 0, comms: 0 },
    reward: { oxygen: 5 },
    failurePenalty: { oxygen: -3 },
    ...over,
  };
}

export function makeEnvironment(over: Partial<EnvironmentSnapshot> = {}): EnvironmentSnapshot {
  return {
    source: 'archive',
    window: { start: '2026-01-01', end: '2026-01-30' },
    flares: [],
    particleEvents: [],
    radiationRisk: 0,
    radioBlackout: 0,
    ...over,
  };
}

export const TEST_RATES = { oxygen: 0.82, water: 2.5, food: 1.8 };
export const TEST_POWER = { batteryCapacityKwh: 100, solarGenerationKw: 10, baseLoadKw: 8 };

export function makeSessionOptions(over: Partial<GameSessionOptions> = {}): GameSessionOptions {
  return {
    seed: 1,
    crew: 4,
    initialResources: { oxygen: 20, water: 40, food: 30, power: 60 },
    consumptionRates: TEST_RATES,
    power: TEST_POWER,
    doseRateMSvPerDay: 1.37,
    missions: [makeMission(), makeMission({ id: 'eva', stationId: 'airlock', exposure: { radiation: 1, comms: 0 } })],
    environment: makeEnvironment(),
    ...over,
  };
}

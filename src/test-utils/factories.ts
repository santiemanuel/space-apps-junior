import { CREW_ROSTER, STARTING_CREW_ID } from '../content/crew';
import type { CrewMemberState } from '../core/crew/types';
import type { RealEvent } from '../core/events/RealEvent';
import type { PhaseResult } from '../core/flow/types';
import type { IncidentState } from '../core/incidents/types';
import type { MeterState } from '../core/meters/types';
import { GAME_STATE_VERSION, type GameState } from '../core/state/types';
import { SYSTEM_IDS, type SystemId, type SystemStatus } from '../core/systems/types';

// --- Contratos de la Etapa 0 (docs/historial/plan-de-trabajo.md §3.5). Sólo agregar, no modificar. ---

export function makeCrewMember(over: Partial<CrewMemberState> = {}): CrewMemberState {
  return {
    id: 'vega',
    role: 'commander',
    fatigue: 0,
    condition: 1,
    morale: 1,
    nutrition: 1,
    doseMSv: 0,
    location: 'command',
    taskId: null,
    resting: false,
    ...over,
  };
}

/** Los 4 tripulantes del plantel, sanos y descansados. */
export function makeCrew(): CrewMemberState[] {
  return CREW_ROSTER.map(({ id, role }) => makeCrewMember({ id, role }));
}

export function makeMeters(over: Partial<MeterState> = {}): MeterState {
  return {
    energy: { batteryKwh: 80, capacityKwh: 120 },
    lifeSupport: { oxygenKg: 40, waterL: 300, co2MmHg: 1.5 },
    ...over,
  };
}

export function makeGameState(over: Partial<GameState> = {}): GameState {
  return {
    version: GAME_STATE_VERSION,
    seed: 1,
    rngState: 1,
    mode: 'campaign2024',
    length: 'short',
    helpMode: false,
    unlockLevel: 1,
    phase: 'cruiseOut',
    simDate: '2024-01-15T00:00:00Z',
    meters: makeMeters(),
    crew: makeCrew(),
    activeCrewId: STARTING_CREW_ID,
    systems: Object.fromEntries(SYSTEM_IDS.map((id) => [id, 'green'])) as Record<SystemId, SystemStatus>,
    inventory: { foodKg: 400, spares: 6, samples: [] },
    waterShield: 1,
    fuel: 1,
    loadout: 'balanced',
    landingDistanceKm: null,
    activeIncidents: [],
    history: [],
    ...over,
  };
}

/** Tormenta de radiación real del 20/05/2024 medida por Curiosity/RAD (game-design §2). */
export function makeRealEvent(over: Partial<RealEvent> = {}): RealEvent {
  return {
    id: 'rad-2024-05-20',
    date: '2024-05-20T00:00:00Z',
    instrument: 'RAD',
    mission: 'Curiosity',
    agency: 'NASA',
    value: 304,
    unit: 'μGy/h',
    kidValueKey: 'incidents.radiationStorm.title',
    explanationKey: 'incidents.radiationStorm.title',
    sourceUrl: 'https://visualization.osdr.nasa.gov/radlab/',
    ...over,
  };
}

export function makeIncident(over: Partial<IncidentState> = {}): IncidentState {
  return {
    id: 'incident-1',
    definitionId: 'radiationStorm',
    phase: 'cruiseOut',
    status: 'warned',
    impactAt: '2024-05-10T00:00:00Z',
    ...over,
  };
}

export function makePhaseResult(over: Partial<PhaseResult> = {}): PhaseResult {
  return { phase: 'cruiseOut', outcome: 'completed', state: makeGameState(), achievements: [], ...over };
}

// --- Flujo y maniobras (Facundo). ---

/** Muestra de Marte de prueba: 5 kg, valor 1. */
export function makeSample(over: Partial<GameState['inventory']['samples'][number]> = {}): GameState['inventory']['samples'][number] {
  return { id: 'sample-1', siteId: 'gale-1', massKg: 5, value: 1, ...over };
}

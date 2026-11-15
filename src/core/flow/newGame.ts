import type { CrewId, CrewMemberState } from '../crew/types';
import type { MeterState } from '../meters/types';
import { sanitizeSetup } from '../progression/progression';
import { GAME_STATE_VERSION, type GameState, type Inventory } from '../state/types';
import { SYSTEM_IDS, type SystemId, type SystemStatus } from '../systems/types';
import type { GameMode, MissionLength, UnlockLevel } from './types';

/** Lo que el jugador elige en `Title` antes de empezar (game-design §2.1, §3.3). */
export interface MissionSetup {
  mode: GameMode;
  length: MissionLength;
  helpMode: boolean;
}

/** Valores de arranque (vienen de `src/content/missionStart.ts`). La carga la completa `Loadout`. */
export interface MissionStart {
  simDate: Record<GameMode, string>;
  meters: MeterState;
  crew: readonly CrewMemberState[];
  activeCrewId: CrewId;
  inventory: Inventory;
  waterShield: number;
  fuel: number;
}

export interface NewGameOptions {
  seed: number;
  unlockLevel: UnlockLevel;
  start: MissionStart;
}

/** Estado inicial de una partida nueva: empieza en la preparación, con lo bloqueado reemplazado (§6). */
export function createNewGame(setup: MissionSetup, { seed, unlockLevel, start }: NewGameOptions): GameState {
  const { mode, length, helpMode } = sanitizeSetup(setup, unlockLevel);
  const normalizedSeed = seed >>> 0;
  return {
    version: GAME_STATE_VERSION,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    mode,
    length,
    helpMode,
    unlockLevel,
    phase: 'prep',
    simDate: start.simDate[mode],
    meters: structuredClone(start.meters),
    crew: start.crew.map((member) => ({ ...member })),
    activeCrewId: start.activeCrewId,
    systems: Object.fromEntries(SYSTEM_IDS.map((id) => [id, 'green'])) as Record<SystemId, SystemStatus>,
    inventory: structuredClone(start.inventory),
    waterShield: start.waterShield,
    fuel: start.fuel,
    loadout: null,
    landingDistanceKm: null,
    activeIncidents: [],
    history: [],
  };
}

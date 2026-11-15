import type { GameMode, LoadoutProfile, MissionLength, UnlockLevel } from '../flow/types';
import type { MissionSetup } from '../flow/newGame';

export const PROGRESSION_VERSION = 1;

/** Lo que se conserva entre partidas en el navegador (game-design §6). Récords y logros completos: F8. */
export interface Progression {
  version: typeof PROGRESSION_VERSION;
  completedMissions: number;
  achievements: string[];
}

export function emptyProgression(): Progression {
  return { version: PROGRESSION_VERSION, completedMissions: 0, achievements: [] };
}

/** Nivel 1 en la primera partida; cada misión terminada suma uno, hasta el 4 (§6). */
export function unlockLevelFor(completedMissions: number): UnlockLevel {
  return Math.min(4, 1 + Math.max(0, Math.floor(completedMissions))) as UnlockLevel;
}

/** Nivel desde el que se puede elegir cada opción (tabla de §6). */
export const UNLOCK_AT = {
  mode: { campaign2024: 1, free: 3 } satisfies Record<GameMode, UnlockLevel>,
  length: { short: 1, long: 3 } satisfies Record<MissionLength, UnlockLevel>,
  loadout: { balanced: 1, workshop: 2, waterShield: 4 } satisfies Record<LoadoutProfile, UnlockLevel>,
} as const;

export type UnlockKind = keyof typeof UNLOCK_AT;

export function isUnlocked<K extends UnlockKind>(level: UnlockLevel, kind: K, option: keyof (typeof UNLOCK_AT)[K]): boolean {
  return level >= (UNLOCK_AT[kind][option] as UnlockLevel);
}

/** Reemplaza lo bloqueado por la opción básica: nunca se arranca una partida con algo sin desbloquear. */
export function sanitizeSetup(setup: MissionSetup, level: UnlockLevel): MissionSetup {
  return {
    ...setup,
    mode: isUnlocked(level, 'mode', setup.mode) ? setup.mode : 'campaign2024',
    length: isUnlocked(level, 'length', setup.length) ? setup.length : 'short',
  };
}

/** Al llegar al informe: una misión completada suma un nivel; los logros se juntan aunque se haya suspendido. */
export function recordMissionEnd(progression: Progression, outcome: 'completed' | 'suspended', achievements: readonly string[]): Progression {
  return {
    ...progression,
    completedMissions: progression.completedMissions + (outcome === 'completed' ? 1 : 0),
    achievements: [...new Set([...progression.achievements, ...achievements])],
  };
}

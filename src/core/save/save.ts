import { PHASE_ORDER } from '../flow/types';
import { emptyProgression, PROGRESSION_VERSION, type Progression } from '../progression/progression';
import { GAME_STATE_VERSION, type GameState } from '../state/types';
import type { SaveStore } from './SaveStore';

export const SAVE_KEYS = {
  game: 'misionMarte.partida',
  progression: 'misionMarte.progresion',
  settings: 'misionMarte.ajustes',
} as const;

/** Preferencias del jugador que no dependen de la partida. */
export interface Settings {
  locale?: string;
  /** Volumen de los sonidos y de la música (0..1). */
  sound?: number;
  music?: number;
}

function readJson(store: SaveStore, key: string): unknown {
  const raw = store.read(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Partida guardada, o `null` si no hay, está dañada o es de otra versión del esquema. */
export function loadGame(store: SaveStore): GameState | null {
  const data = readJson(store, SAVE_KEYS.game);
  if (!isRecord(data) || data.version !== GAME_STATE_VERSION) return null;
  if (!PHASE_ORDER.includes(data.phase as GameState['phase'])) return null;
  return data as unknown as GameState;
}

export function saveGame(store: SaveStore, state: GameState): void {
  store.write(SAVE_KEYS.game, JSON.stringify(state));
}

export function clearGame(store: SaveStore): void {
  store.remove(SAVE_KEYS.game);
}

/** Progresión guardada; si no hay o no se puede leer, se empieza de cero. */
export function loadProgression(store: SaveStore): Progression {
  const data = readJson(store, SAVE_KEYS.progression);
  if (!isRecord(data) || data.version !== PROGRESSION_VERSION) return emptyProgression();
  const completedMissions = typeof data.completedMissions === 'number' ? Math.max(0, Math.floor(data.completedMissions)) : 0;
  const achievements = Array.isArray(data.achievements) ? data.achievements.filter((a) => typeof a === 'string') : [];
  return { version: PROGRESSION_VERSION, completedMissions, achievements };
}

export function saveProgression(store: SaveStore, progression: Progression): void {
  store.write(SAVE_KEYS.progression, JSON.stringify(progression));
}

export function loadSettings(store: SaveStore): Settings {
  const data = readJson(store, SAVE_KEYS.settings);
  if (!isRecord(data)) return {};
  const volume = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : undefined);
  const settings: Settings = {};
  if (typeof data.locale === 'string') settings.locale = data.locale;
  if (volume(data.sound) !== undefined) settings.sound = volume(data.sound);
  if (volume(data.music) !== undefined) settings.music = volume(data.music);
  return settings;
}

export function saveSettings(store: SaveStore, settings: Settings): void {
  store.write(SAVE_KEYS.settings, JSON.stringify(settings));
}

import type { GameState } from '../state/types';

/** Las siete fases del arco de la misión (game-design §2), en orden de juego. */
export const PHASE_ORDER = [
  'prep',
  'ascent',
  'cruiseOut',
  'landing',
  'mars',
  'marsAscent',
  'cruiseBack',
  'reentry',
] as const;

export type PhaseId = (typeof PHASE_ORDER)[number];

/** Maniobras con formato común checklist + acción en el momento justo (game-design §4.0). */
export type ManeuverId = 'ascent' | 'landing' | 'marsAscent' | 'reentry';

/** Campaña con el calendario real de 2024 o modo libre con ventanas reales distintas (§2.1). */
export type GameMode = 'campaign2024' | 'free';
export type MissionLength = 'short' | 'long';

/** Nivel de desbloqueo entre partidas (§6). */
export type UnlockLevel = 1 | 2 | 3 | 4;

/** Perfiles de carga de ida (§4.1). */
export type LoadoutProfile = 'waterShield' | 'workshop' | 'balanced';

/**
 * Lo que devuelve una fase al terminar. `suspended` es el punto de no retorno (§3.5):
 * la misión se detiene pero la tripulación está a salvo.
 */
export interface PhaseResult {
  phase: PhaseId;
  outcome: 'completed' | 'suspended';
  /** Estado completo al salir de la fase: la fase siguiente parte de aquí. */
  state: GameState;
  /** Ids de logros conseguidos durante la fase (§5). */
  achievements: string[];
}

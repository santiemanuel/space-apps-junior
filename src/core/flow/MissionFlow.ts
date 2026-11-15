import type { RealEvent } from '../events/RealEvent';
import { realEventLogEntry, type MissionOutcome } from '../report/report';
import type { GameState, MissionLogEntry } from '../state/types';
import { PHASE_ORDER, type ManeuverId, type PhaseResult } from './types';

/** Lo que hay que mostrar a continuación (mapa de escenas, plan §4). La capa `game/` lo traduce a una escena. */
export type FlowStep =
  | { kind: 'loadout'; mode: 'outbound' | 'return' }
  | { kind: 'maneuver'; maneuverId: ManeuverId }
  | { kind: 'voyage'; leg: 'out' | 'back' }
  | { kind: 'mars' }
  | { kind: 'report'; outcome: MissionOutcome };

const loadedForReturn = (state: GameState) =>
  state.history.some((e) => e.phase === 'marsAscent' && e.kind === 'loadout' && e.key === 'return');

const maneuverDone = (state: GameState, id: ManeuverId) => state.history.some((e) => e.kind === 'maneuver' && e.key === id);

/**
 * Paso con el que sigue una partida en curso. El despegue de Marte tiene dos pasos (carga de vuelta y maniobra):
 * el historial dice si la carga ya se hizo, así una partida guardada en medio retoma donde quedó.
 */
export function stepFor(state: GameState): FlowStep {
  switch (state.phase) {
    case 'prep':
      return { kind: 'loadout', mode: 'outbound' };
    case 'cruiseOut':
      return { kind: 'voyage', leg: 'out' };
    case 'mars':
      return { kind: 'mars' };
    case 'marsAscent':
      return loadedForReturn(state) ? { kind: 'maneuver', maneuverId: 'marsAscent' } : { kind: 'loadout', mode: 'return' };
    case 'cruiseBack':
      return { kind: 'voyage', leg: 'back' };
    default:
      return { kind: 'maneuver', maneuverId: state.phase };
  }
}

/**
 * Máquina de estados de la misión (F3): `prep → ascent → cruiseOut → landing → mars → marsAscent → cruiseBack →
 * reentry → report`. Aplica cada `PhaseResult` al estado, junta los eventos reales vividos y los logros, y decide el
 * paso siguiente. Pura: no conoce Phaser ni las escenas.
 */
export class MissionFlow {
  private current: GameState;
  private pending: MissionLogEntry[] = [];
  private ended: MissionOutcome | null = null;

  constructor(state: GameState) {
    this.current = structuredClone(state);
  }

  /** Estado actual con los eventos reales vividos en la fase en curso (lo que se guarda). */
  get state(): GameState {
    const state = structuredClone(this.current);
    state.history.push(...structuredClone(this.unlogged(state)));
    return state;
  }

  /**
   * Estado de la fase en curso que publican `Voyage` y `Mars` (`phase:progress`) para el guardado manual. Se guarda
   * la referencia sin copiar (llega en cada cuadro); `state` la copia al leerla. Ignora el de otra fase.
   */
  progress(state: GameState): void {
    if (this.ended || state.phase !== this.current.phase) return;
    this.current = state;
  }

  get outcome(): MissionOutcome | null {
    return this.ended;
  }

  get step(): FlowStep {
    return this.ended ? { kind: 'report', outcome: this.ended } : stepFor(this.current);
  }

  /** Una tarjeta "Esto pasó de verdad" que se mostró: queda en el historial para el informe (sin repetir). */
  recordRealEvent(event: RealEvent): void {
    const seen = [...this.current.history, ...this.pending].some((e) => e.kind === 'realEvent' && e.key === event.id);
    if (!seen) this.pending.push(realEventLogEntry(event, this.current));
  }

  /** Tarjetas vividas que la fase todavía no anotó en su historial (la simulación anota las suyas). */
  private unlogged(state: GameState): MissionLogEntry[] {
    const known = new Set(state.history.filter((e) => e.kind === 'realEvent').map((e) => e.key));
    return this.pending.filter((e) => !known.has(e.key));
  }

  /**
   * Aplica el resultado de la fase en curso y devuelve el paso siguiente. Ignora resultados de otra fase
   * (llegan tarde o de una escena vieja) y los que llegan después del final.
   */
  complete(result: PhaseResult): FlowStep | null {
    if (this.ended || result.phase !== this.current.phase) return null;
    const state = structuredClone(result.state);
    delete state.habitat;
    state.history.push(...this.unlogged(state));
    state.achievements = [...new Set([...(this.current.achievements ?? []), ...(state.achievements ?? []), ...result.achievements])];
    this.pending = [];

    if (result.outcome === 'suspended') {
      this.ended = 'suspended';
    } else if (result.phase !== 'marsAscent' || maneuverDone(state, 'marsAscent')) {
      const next = PHASE_ORDER[PHASE_ORDER.indexOf(result.phase) + 1];
      if (next) state.phase = next;
      else this.ended = 'completed';
    }
    this.current = state;
    return this.step;
  }
}

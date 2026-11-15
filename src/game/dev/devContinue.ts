import type Phaser from 'phaser';
import type { EventBus } from '../../core/events/EventBus';
import type { GameEvents } from '../../core/events/GameEvents';
import { MissionFlow } from '../../core/flow/MissionFlow';
import { MemorySaveStore } from '../../core/save/SaveStore';
import type { GameState } from '../../core/state/types';
import { FlowDirector } from '../scenes/flow/FlowDirector';
import { createBrowserSaveStore } from '../storage/browserSaveStore';

let game: Phaser.Game | null = null;

/** `BootScene` la anota antes de abrir una escena con `?scene=`. */
export function setDevGame(value: Phaser.Game): void {
  game = value;
}

/**
 * Una fase abierta sola con `?scene=` sigue con la partida al terminar (p. ej. del embarque en Marte a la carga de
 * vuelta), como en el juego. Guarda en memoria: no pisa la partida guardada del navegador.
 */
export function continueFlow(bus: EventBus<GameEvents>, state: GameState): void {
  bus.on('phase:completed', (result) => {
    if (!game || result.outcome !== 'completed') return;
    const flow = new MissionFlow(state);
    if (!flow.complete(result)) return;
    // Como en `FlowDirector`: después del cuadro en el que terminó la fase.
    queueMicrotask(() => game && new FlowDirector(game, new MemorySaveStore()).play(flow.state));
  });
}

let director: FlowDirector | null = null;

/** Director del flujo para las escenas abiertas solas con `?scene=`: sus botones llevan de verdad al menú o a la partida. */
export function devDirector(): FlowDirector | null {
  if (!game) return null;
  return (director ??= new FlowDirector(game, createBrowserSaveStore()));
}

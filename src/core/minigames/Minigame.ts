import { clamp } from '../math';
import { Rng } from '../rng/Rng';
import type { DishId, MealStage } from './rooms';

/** Minijuegos de las salas (lo que pasa al apretar E). Textos en `hud.minigame.<id>.*`. */
export type MinigameId =
  | 'bike'
  | 'scrubber'
  | 'water'
  | 'radio'
  | 'stars'
  | 'pulse'
  | 'meal'
  | 'shield'
  | 'plants'
  | 'moxie'
  | 'seals'
  | 'patch'
  | 'fuses'
  | 'wires';

export interface MinigameKeys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
}

/** Entrada de un cuadro: teclas mantenidas y teclas recién apretadas (con 1, 2 y 3). */
export interface MinigameInput {
  held: MinigameKeys;
  pressed: MinigameKeys & { choice: 1 | 2 | 3 | null };
}

export interface MinigameSetup {
  seed: number;
  /** Más fácil: modo ayuda o especialista en la tarea (§3.3). */
  easy?: boolean;
  /** Más difícil: la reparación improvisada de un incidente. */
  hard?: boolean;
  /** Radio: demora de ida de la señal a la Tierra (s), para el dato del final. */
  delaySeconds?: number;
  /** Invernadero: plaga de pulgones (el incidente). */
  pests?: boolean;
  /** Cocina: la comida del día y qué parte se abre (el menú, el recetario o la mesada). Sin esto, se cocina con la receta a la vista. */
  meal?: { dish: DishId; stage: MealStage };
}

/** Mensaje corto para mostrar (clave dentro de `hud.minigame.<id>`), si es bueno o malo y cuándo salió (s). */
export interface MinigameMessage {
  key: string;
  good: boolean;
  at: number;
}

export const NO_KEYS: MinigameKeys = { left: false, right: false, up: false, down: false, action: false };
export const NO_INPUT: MinigameInput = { held: NO_KEYS, pressed: { ...NO_KEYS, choice: null } };

/**
 * Base de los minijuegos: puros y sin Phaser, con su propio `Rng` (semilla de la sesión). No se pierden: los errores
 * sólo bajan las estrellas del final, así un chico siempre puede terminar.
 */
export abstract class Minigame {
  abstract readonly id: MinigameId;
  /** Tiempo (s) que tarda alguien que juega bien: las estrellas se miden contra esto. */
  protected abstract readonly parSeconds: number;
  progress = 0;
  mistakes = 0;
  elapsed = 0;
  message: MinigameMessage | null = null;
  /** Una tarjeta que sólo se lee ya se cerró con E (sin ganar nada). */
  closed = false;
  protected readonly rng: Rng;

  constructor(protected readonly setup: MinigameSetup) {
    this.rng = new Rng(setup.seed);
  }

  get done(): boolean {
    return this.progress >= 1;
  }

  /** Tarjeta que sólo se lee (sin barra de avance): E la cierra. */
  get card(): boolean {
    return false;
  }

  /** Al abrirlo va antes el mini tutorial (salvo que se haya pedido no verlo más). */
  get tutorial(): boolean {
    return true;
  }

  /** Clave de la ayuda de abajo, dentro de `hud.minigame.<id>`. */
  get helpKey(): string {
    return 'help';
  }

  update(dt: number, input: MinigameInput): void {
    if (this.done || this.closed) return;
    this.elapsed += dt;
    this.step(dt, input);
    this.progress = clamp(this.progress);
  }

  /** 3 estrellas: rápido y casi sin errores; 1: con muchos errores o muy lento. */
  stars(): 1 | 2 | 3 {
    const late = this.elapsed > this.parSeconds * 1.6;
    if (this.mistakes <= 1 && !late) return 3;
    return this.mistakes <= 4 && this.elapsed <= this.parSeconds * 3 ? 2 : 1;
  }

  protected abstract step(dt: number, input: MinigameInput): void;

  protected say(key: string, good: boolean): void {
    this.message = { key, good, at: this.elapsed };
  }

  protected int(n: number): number {
    return Math.floor(this.rng.next() * n);
  }

  /** `count` elementos distintos de `items`, mezclados. */
  protected sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, count);
  }
}

/** Repetición de las flechas mantenidas (s): la primera vez al apretar, después cada tanto. */
const REPEAT_DELAY_S = 0.28;
const REPEAT_EVERY_S = 0.12;

/** Cursor sobre una grilla que se mueve con las flechas (al apretar y, si se mantienen, repitiendo). */
export class GridCursor {
  private holdS = 0;

  constructor(
    readonly cols: number,
    readonly rows: number,
    public col = 0,
    public row = 0,
  ) {}

  get index(): number {
    return this.row * this.cols + this.col;
  }

  update(dt: number, { held, pressed }: MinigameInput): void {
    const dx = Number(held.right) - Number(held.left);
    const dy = Number(held.down) - Number(held.up);
    const fresh = pressed.left || pressed.right || pressed.up || pressed.down;
    if (fresh) {
      this.holdS = 0;
      this.move(Number(pressed.right) - Number(pressed.left), Number(pressed.down) - Number(pressed.up));
      return;
    }
    if (!dx && !dy) return (void (this.holdS = 0));
    this.holdS += dt;
    if (this.holdS >= REPEAT_DELAY_S) {
      this.move(dx, dy);
      this.holdS -= REPEAT_EVERY_S;
    }
  }

  private move(dx: number, dy: number): void {
    this.col = clamp(this.col + dx, 0, this.cols - 1);
    this.row = clamp(this.row + dy, 0, this.rows - 1);
  }
}

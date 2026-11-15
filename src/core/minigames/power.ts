import { GridCursor, Minigame, type MinigameInput, type MinigameSetup } from './Minigame';

/** Repuestos de fusible: cada uno aguanta una corriente (amperes) y tiene su color, como los de verdad. */
export const FUSE_TYPES = [
  { amps: 5, color: 'green' },
  { amps: 10, color: 'amber' },
  { amps: 20, color: 'red' },
] as const;

export interface FuseSlot {
  /** Índice en `FUSE_TYPES`: el que va en este lugar (está escrito en el tablero). */
  type: number;
  burnt: boolean;
}

/**
 * Tablero de fusibles (sala de energía): buscar los fusibles quemados (negros) con las flechas y poner el repuesto
 * del mismo amperaje con 1, 2 o 3. Un fusible más fuerte de lo que dice el tablero no protege; uno más débil se
 * vuelve a quemar: por eso hay que mirar el número.
 */
export class FusesGame extends Minigame {
  readonly id = 'fuses';
  protected readonly parSeconds = 14;
  readonly cols: number;
  readonly rows = 2;
  readonly slots: FuseSlot[];
  readonly cursor: GridCursor;
  private readonly toFix: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.cols = setup.easy ? 3 : 4;
    const burnt = setup.easy ? 1 : setup.hard ? 3 : 2;
    const count = this.cols * this.rows;
    const broken = new Set(this.sample(Array.from({ length: count }, (_, i) => i), burnt));
    this.slots = Array.from({ length: count }, (_, i) => ({ type: this.int(FUSE_TYPES.length), burnt: broken.has(i) }));
    this.toFix = burnt;
    this.cursor = new GridCursor(this.cols, this.rows);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    const choice = input.pressed.choice;
    if (!choice) return;
    const slot = this.slots[this.cursor.index]!;
    if (!slot.burnt) {
      this.mistakes++;
      this.say('notBurnt', false);
      return;
    }
    if (choice - 1 !== slot.type) {
      this.mistakes++;
      this.say(choice - 1 > slot.type ? 'tooStrong' : 'tooWeak', false);
      return;
    }
    slot.burnt = false;
    this.progress = (this.toFix - this.slots.filter((s) => s.burnt).length) / this.toFix;
    this.say('fixed', true);
  }
}

/** Colores de los cables (cada par une la misma punta de los dos lados del corte). */
export const WIRE_COLORS = ['red', 'blue', 'yellow', 'green', 'white'] as const;
export type WireColor = (typeof WIRE_COLORS)[number];

/**
 * Empalme de un cable cortado (afuera, junto a la caja de empalme): a la izquierda quedan las puntas de un lado del
 * corte, a la derecha las del otro, mezcladas. Para la punta que se enciende, elegir con ↑ y ↓ la del mismo color y
 * unirlas con E.
 */
export class WiresGame extends Minigame {
  readonly id = 'wires';
  protected readonly parSeconds = 14;
  readonly left: WireColor[];
  readonly right: WireColor[];
  /** Punta de la derecha unida a cada punta de la izquierda (o null). */
  readonly joined: (number | null)[];
  readonly cursor: GridCursor;

  constructor(setup: MinigameSetup) {
    super(setup);
    const pairs = setup.easy ? 3 : setup.hard ? 5 : 4;
    this.left = this.sample(WIRE_COLORS, pairs);
    this.right = this.sample(this.left, pairs);
    // Que nunca arranque todo en orden: así siempre hay que buscar.
    if (this.right.every((c, i) => c === this.left[i])) this.right.push(this.right.shift()!);
    this.joined = this.left.map(() => null);
    this.cursor = new GridCursor(1, pairs);
  }

  /** Punta de la izquierda que toca unir ahora. */
  get current(): number {
    return this.joined.findIndex((j) => j === null);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    if (!input.pressed.action || this.current < 0) return;
    const target = this.cursor.row;
    if (this.joined.includes(target) || this.right[target] !== this.left[this.current]) {
      this.mistakes++;
      this.say('wrongColor', false);
      return;
    }
    this.joined[this.current] = target;
    this.progress = this.joined.filter((j) => j !== null).length / this.joined.length;
    this.say('joined', true);
  }
}

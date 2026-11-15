import { GridCursor, Minigame, type MinigameInput, type MinigameSetup } from './Minigame';

/** Lados de una celda de cañería (máscara de bits). */
export const SIDE = { N: 1, E: 2, S: 4, W: 8 } as const;
const OPPOSITE: Record<number, number> = { 1: 4, 2: 8, 4: 1, 8: 2 };
const STEP: Record<number, [number, number]> = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
/** Caño recto (oeste-este) y codo (norte-este) sin girar. */
const BASE = { straight: SIDE.E | SIDE.W, corner: SIDE.N | SIDE.E } as const;

/** Gira una máscara un cuarto de vuelta en el sentido del reloj `times` veces. */
export const rotateSides = (mask: number, times: number): number => {
  let m = mask;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};

export interface PipeCell {
  shape: keyof typeof BASE;
  rot: number;
  /** Parte del camino que resuelve el tablero (no se muestra: es para generar y probar). */
  onPath: boolean;
  filter: boolean;
}

/**
 * Reciclador de agua: girar caños (flechas para elegir, E para girar) hasta que el agua usada llegue del tanque sucio,
 * pase por el filtro y termine en el tanque limpio. Siempre tiene solución: se arma a partir de un camino al azar.
 */
export class WaterGame extends Minigame {
  readonly id = 'water';
  protected readonly parSeconds = 25;
  readonly cols: number;
  readonly rows: number;
  readonly entryRow: number;
  readonly exitRow: number;
  readonly cells: PipeCell[];
  readonly cursor: GridCursor;
  private readonly pathLength: number;
  /** Celdas por las que corre el agua ahora, en orden, y si llega al tanque limpio. */
  flow: { cells: number[]; solved: boolean };

  constructor(setup: MinigameSetup) {
    super(setup);
    this.cols = setup.easy ? 4 : setup.hard ? 6 : 5;
    this.rows = setup.hard ? 4 : 3;
    this.entryRow = this.int(this.rows);
    this.exitRow = this.int(this.rows);
    const masks = new Map<number, number>();
    let row = this.entryRow;
    for (let col = 0; col < this.cols; col++) {
      const target = col === this.cols - 1 ? this.exitRow : this.int(this.rows);
      const dir = Math.sign(target - row);
      if (!dir) masks.set(row * this.cols + col, SIDE.W | SIDE.E);
      else {
        masks.set(row * this.cols + col, SIDE.W | (dir > 0 ? SIDE.S : SIDE.N));
        for (let r = row + dir; r !== target; r += dir) masks.set(r * this.cols + col, SIDE.N | SIDE.S);
        masks.set(target * this.cols + col, (dir > 0 ? SIDE.N : SIDE.S) | SIDE.E);
      }
      row = target;
    }
    this.pathLength = masks.size;
    const filterCol = Math.floor(this.cols / 2);
    let filterSet = false;
    this.cells = Array.from({ length: this.cols * this.rows }, (_, i) => {
      const mask = masks.get(i);
      const shape = mask === undefined ? (this.rng.chance(0.5) ? 'straight' : 'corner') : mask === 5 || mask === 10 ? 'straight' : 'corner';
      const filter = mask !== undefined && !filterSet && i % this.cols === filterCol;
      if (filter) filterSet = true;
      return { shape, rot: this.int(4), onPath: mask !== undefined, filter };
    });
    this.cursor = new GridCursor(this.cols, this.rows, 0, this.entryRow);
    this.flow = this.computeFlow();
    if (this.flow.solved) {
      this.cells[this.entryRow * this.cols]!.rot++;
      this.flow = this.computeFlow();
    }
  }

  sides(index: number): number {
    const c = this.cells[index]!;
    return rotateSides(BASE[c.shape], c.rot);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    if (!input.pressed.action) return;
    this.cells[this.cursor.index]!.rot++;
    const before = this.flow.cells.length;
    this.flow = this.computeFlow();
    if (this.flow.solved) this.say('solved', true);
    else if (this.flow.cells.length > before) this.say('flowing', true);
    this.progress = this.flow.solved ? 1 : Math.min(0.9, this.flow.cells.length / (this.pathLength + 1));
  }

  /** Sigue el agua desde la entrada (por el oeste de la primera columna) mientras los caños estén unidos. */
  private computeFlow(): { cells: number[]; solved: boolean } {
    const cells: number[] = [];
    let [col, row, from] = [0, this.entryRow, SIDE.W as number];
    while (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      const index = row * this.cols + col;
      const sides = this.sides(index);
      if (!(sides & from) || cells.includes(index)) return { cells, solved: false };
      cells.push(index);
      const out = sides & ~from;
      const [dx, dy] = STEP[out]!;
      [col, row, from] = [col + dx, row + dy, OPPOSITE[out]!];
    }
    return { cells, solved: col === this.cols && row === this.exitRow };
  }
}

export interface StarPoint {
  x: number;
  y: number;
}

/**
 * Rastreador de estrellas (módulo de mando): girar el cielo con ← y → hasta que la constelación de la izquierda
 * coincida con la de la cámara, y fijarla con E. Así sabe una nave hacia dónde apunta.
 */
export class StarsGame extends Minigame {
  readonly id = 'stars';
  protected readonly parSeconds = 20;
  readonly rounds: number;
  round = 0;
  /** Constelación de referencia (centrada en 0,0; radio ≤ 0,45). */
  pattern: StarPoint[] = [];
  /** Estrellas sueltas del cielo, que giran con la constelación. */
  others: StarPoint[] = [];
  /** Giro actual del cielo (grados); 0 es la posición correcta. */
  angle = 0;
  readonly tolerance: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.rounds = setup.easy ? 2 : 3;
    this.tolerance = setup.easy ? 12 : 8;
    this.newRound();
  }

  /** Cuánto falta girar (grados, de -180 a 180). */
  get offset(): number {
    return ((((this.angle + 180) % 360) + 360) % 360) - 180;
  }

  protected step(dt: number, { held, pressed }: MinigameInput): void {
    this.angle += (Number(held.right) - Number(held.left)) * 70 * dt;
    if (!pressed.action) return;
    if (Math.abs(this.offset) > this.tolerance) {
      this.mistakes++;
      this.say('notYet', false);
      return;
    }
    this.round++;
    this.progress = this.round / this.rounds;
    this.say('locked', true);
    if (!this.done) this.newRound();
  }

  private newRound(): void {
    const count = 5;
    this.pattern = Array.from({ length: count }, (_, i) => {
      const a = ((i + this.rng.between(-0.25, 0.25)) / count) * Math.PI * 2;
      const r = this.rng.between(0.18, 0.42);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    this.others = Array.from({ length: 9 }, () => {
      const a = this.rng.between(0, Math.PI * 2);
      const r = this.rng.between(0.25, 0.48);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    this.angle = this.rng.between(60, 160) * (this.rng.chance(0.5) ? 1 : -1);
  }
}

/**
 * Fuga de un micrometeorito: buscar el agujero en la pared con el detector (suena más rápido cuanto más cerca) y
 * ponerle un parche con E. Un parche donde no hay fuga es un error.
 */
export class PatchGame extends Minigame {
  readonly id = 'patch';
  protected readonly parSeconds = 14;
  readonly cols = 8;
  readonly rows = 5;
  readonly holes: { col: number; row: number; patched: boolean }[];
  readonly cursor: GridCursor;
  /** Parches puestos donde no había fuga (quedan en la pared). */
  readonly misses: { col: number; row: number }[] = [];

  constructor(setup: MinigameSetup) {
    super(setup);
    const cells = this.sample(
      Array.from({ length: this.cols * this.rows }, (_, i) => i).filter((i) => i % this.cols !== 3 && i % this.cols !== 4),
      setup.hard ? 2 : 1,
    );
    this.holes = cells.map((i) => ({ col: i % this.cols, row: Math.floor(i / this.cols), patched: false }));
    this.cursor = new GridCursor(this.cols, this.rows, 3, 2);
  }

  /** Qué tan cerca está el detector de una fuga abierta (0 lejos … 1 encima). */
  get signal(): number {
    const open = this.holes.filter((h) => !h.patched);
    if (!open.length) return 0;
    const d = Math.min(...open.map((h) => Math.hypot(h.col - this.cursor.col, h.row - this.cursor.row)));
    return Math.max(0, 1 - d / 5);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    if (!input.pressed.action) return;
    const { col, row } = this.cursor;
    const hole = this.holes.find((h) => !h.patched && h.col === col && h.row === row);
    if (hole) {
      hole.patched = true;
      this.progress = this.holes.filter((h) => h.patched).length / this.holes.length;
      this.say('patched', true);
    } else if (!this.misses.some((m) => m.col === col && m.row === row) && !this.holes.some((h) => h.col === col && h.row === row)) {
      this.misses.push({ col, row });
      this.mistakes++;
      this.say('noLeak', false);
    }
  }
}

import { GridCursor, Minigame, type MinigameInput, type MinigameSetup } from './Minigame';

/** Capas de polvo que puede tener un panel (0 limpio). */
export const DUST_LAYERS = 3;

/**
 * Limpiar los paneles solares (afuera, en Gale): ir con las flechas a cada panel con polvo y pasarle el cepillo con
 * E, una pasada por capa. Cepillar un panel limpio lo raya: eso es un error.
 */
export class DustGame extends Minigame {
  readonly id = 'dust';
  protected readonly parSeconds = 14;
  readonly cols: number;
  readonly rows = 2;
  /** Capas de polvo de cada panel. */
  readonly panels: number[];
  readonly cursor: GridCursor;
  /** Último panel cepillado y cuándo (para el brillo). */
  wiped: { index: number; at: number } | null = null;
  private readonly total: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.cols = setup.easy ? 3 : 4;
    const count = this.cols * this.rows;
    const dirty = new Set(this.sample(Array.from({ length: count }, (_, i) => i), setup.easy ? 3 : setup.hard ? count - 1 : count - 3));
    this.panels = Array.from({ length: count }, (_, i) => (dirty.has(i) ? 1 + this.int(setup.easy ? 2 : DUST_LAYERS) : 0));
    this.total = this.panels.reduce((a, b) => a + b, 0);
    this.cursor = new GridCursor(this.cols, this.rows);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    if (!input.pressed.action) return;
    const i = this.cursor.index;
    if (this.panels[i]! <= 0) {
      this.mistakes++;
      this.say('scratch', false);
      return;
    }
    this.panels[i]!--;
    this.wiped = { index: i, at: this.elapsed };
    if (this.panels[i] === 0) this.say('clean', true);
    this.progress = 1 - this.panels.reduce((a, b) => a + b, 0) / this.total;
  }
}

/** Sistemas del tablero de la noche: los de soporte vital no se apagan; los demás, sí. Nombres en `hud.minigame.night.load.<id>`. */
export const NIGHT_LOADS = {
  essential: ['lifeSupport', 'heating', 'radio'],
  optional: ['lights', 'lab', 'lamps', 'charger', 'printer', 'screens'],
} as const;
export type NightLoadId = (typeof NIGHT_LOADS)['essential' | 'optional'][number];

export interface NightSwitch {
  id: NightLoadId;
  essential: boolean;
  on: boolean;
}

/**
 * Preparar la base para la noche (sala de la batería): con ↑ y ↓ se elige una llave y con E se baja. Hay que apagar
 * todo lo que no hace falta de noche y dejar encendido lo que mantiene viva a la tripulación (está marcado).
 */
export class NightGame extends Minigame {
  readonly id = 'night';
  protected readonly parSeconds = 12;
  readonly switches: NightSwitch[];
  readonly cursor: GridCursor;

  constructor(setup: MinigameSetup) {
    super(setup);
    const [essential, optional] = setup.easy ? [1, 3] : setup.hard ? [3, 5] : [2, 4];
    const pick = (ids: readonly NightLoadId[], count: number, isEssential: boolean) => this.sample(ids, count).map((id) => ({ id, essential: isEssential, on: true }));
    const all = [...pick(NIGHT_LOADS.essential, essential, true), ...pick(NIGHT_LOADS.optional, optional, false)];
    this.switches = this.sample(all, all.length);
    this.cursor = new GridCursor(1, this.switches.length);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    if (!input.pressed.action) return;
    const sw = this.switches[this.cursor.row]!;
    if (sw.essential) {
      this.mistakes++;
      this.say('essential', false);
      return;
    }
    if (!sw.on) {
      this.mistakes++;
      this.say('already', false);
      return;
    }
    sw.on = false;
    this.say('off', true);
    const optional = this.switches.filter((s) => !s.essential);
    this.progress = optional.filter((s) => !s.on).length / optional.length;
  }
}

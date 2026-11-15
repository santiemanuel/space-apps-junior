import { clamp } from '../math';
import { Minigame, type MinigameInput, type MinigameSetup } from './Minigame';

/**
 * Bici fija (gimnasio): apretar ← y → alternando para pedalear. Hay que mantener la velocidad en la franja verde: muy
 * despacio no suma y muy rápido tampoco (en el espacio se entrena parejo, no a lo loco).
 */
export class BikeGame extends Minigame {
  readonly id = 'bike';
  protected readonly parSeconds = 12;
  speed = 0;
  /** Vueltas de la rueda, para la animación. */
  distance = 0;
  readonly band: { min: number; max: number };
  private readonly needS: number;
  /** Última tecla de pedal: la que sigue es la otra. */
  last: 'left' | 'right' | null = null;
  private zone: 'slow' | 'ok' | 'fast' = 'slow';

  constructor(setup: MinigameSetup) {
    super(setup);
    this.band = setup.easy ? { min: 0.35, max: 0.88 } : { min: 0.45, max: 0.8 };
    this.needS = setup.easy ? 6 : setup.hard ? 10 : 8;
  }

  protected step(dt: number, { pressed }: MinigameInput): void {
    for (const side of ['left', 'right'] as const) {
      if (!pressed[side]) continue;
      this.speed += side === this.last ? 0.03 : 0.12;
      this.last = side;
    }
    this.speed = clamp(this.speed - 0.35 * dt);
    this.distance += this.speed * dt * 3;
    const zone = this.speed > this.band.max ? 'fast' : this.speed >= this.band.min ? 'ok' : 'slow';
    if (zone !== this.zone) {
      if (zone === 'fast') this.say('tooFast', false);
      else if (zone === 'ok') this.say('good', true);
      else this.say('faster', false);
      this.zone = zone;
    }
    if (zone === 'ok') this.progress += dt / this.needS;
  }
}

export interface FallingMolecule {
  id: number;
  x: number;
  y: number;
  kind: 'co2' | 'o2';
  /** Atrapada por el filtro: segundos desde entonces (se achica y desaparece). */
  caughtS: number | null;
}

/**
 * Depurador de CO2: el filtro se mueve con ← y →; hay que atrapar el CO2 que cae y dejar pasar el oxígeno, que es el
 * que respira la tripulación. Atrapar oxígeno es un error; dejar pasar CO2 no castiga.
 */
export class ScrubberGame extends Minigame {
  static readonly FILTER_Y = 0.86;
  static readonly FILTER_HALF = 0.1;
  readonly id = 'scrubber';
  protected readonly parSeconds = 16;
  filterX = 0.5;
  molecules: FallingMolecule[] = [];
  caught = 0;
  readonly goal: number;
  private spawnS = 0.4;
  private nextId = 1;
  private readonly fall: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.goal = setup.easy ? 7 : setup.hard ? 14 : 10;
    this.fall = setup.easy ? 0.3 : 0.38;
  }

  protected step(dt: number, { held }: MinigameInput): void {
    this.filterX = clamp(this.filterX + (Number(held.right) - Number(held.left)) * 1.3 * dt, 0.08, 0.92);
    this.spawnS -= dt;
    if (this.spawnS <= 0) {
      this.spawnS = this.rng.between(0.5, 0.85) * (this.setup.easy ? 1.3 : 1);
      this.molecules.push({ id: this.nextId++, x: this.rng.between(0.08, 0.92), y: -0.05, kind: this.rng.chance(0.65) ? 'co2' : 'o2', caughtS: null });
    }
    const { FILTER_Y, FILTER_HALF } = ScrubberGame;
    for (const m of this.molecules) {
      if (m.caughtS !== null) {
        m.caughtS += dt;
        continue;
      }
      const before = m.y;
      m.y += this.fall * dt;
      if (before >= FILTER_Y || m.y < FILTER_Y || Math.abs(m.x - this.filterX) > FILTER_HALF) continue;
      m.caughtS = 0;
      if (m.kind === 'co2') {
        this.caught++;
        this.progress = this.caught / this.goal;
        this.say('caught', true);
      } else {
        this.mistakes++;
        this.say('oxygen', false);
      }
    }
    this.molecules = this.molecules.filter((m) => m.y < 1.1 && (m.caughtS ?? 0) < 0.35);
  }
}

/**
 * Radio: girar el dial con ← y → hasta que la onda quede limpia, y seguirla (se corre un poco, como una señal que
 * llega desde muy lejos). Con la señal enganchada un rato se conecta la llamada.
 */
export class RadioGame extends Minigame {
  readonly id = 'radio';
  protected readonly parSeconds = 9;
  dial: number;
  private readonly base: number;
  private readonly wobble: number;
  private locked = false;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.base = this.rng.between(0.25, 0.75);
    this.wobble = setup.easy ? 0.03 : setup.hard ? 0.1 : 0.06;
    this.dial = this.base > 0.5 ? 0.08 : 0.92;
  }

  /** Frecuencia de la señal ahora (0..1). */
  get target(): number {
    return this.base + this.wobble * Math.sin(this.elapsed * 0.8);
  }

  /** Qué tan limpia se oye la señal (0 ruido … 1 perfecta). */
  get quality(): number {
    return clamp(1 - Math.abs(this.dial - this.target) * 6);
  }

  protected step(dt: number, { held }: MinigameInput): void {
    this.dial = clamp(this.dial + (Number(held.right) - Number(held.left)) * 0.35 * dt);
    const locked = this.quality > 0.75;
    if (locked !== this.locked) this.say(locked ? 'locked' : 'lost', locked);
    this.locked = locked;
    this.progress = locked ? this.progress + dt / 4 : Math.max(0, this.progress - dt * 0.03);
  }
}

/**
 * MOXIE: mantener apretada E calienta la máquina y soltarla la enfría. Sólo a unos 800 °C separa el CO2 del aire de
 * Marte en oxígeno; pasarse de 950 °C la frena hasta que vuelve a la franja.
 */
export class MoxieGame extends Minigame {
  static readonly HOT_C = 950;
  readonly id = 'moxie';
  protected readonly parSeconds = 12;
  tempC = 20;
  readonly band: { min: number; max: number };
  overheated = false;
  private readonly needS: number;
  private inBand = false;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.band = setup.easy ? { min: 700, max: 900 } : { min: 750, max: 850 };
    this.needS = setup.easy ? 5 : setup.hard ? 8 : 6;
  }

  protected step(dt: number, { held }: MinigameInput): void {
    this.tempC = clamp(this.tempC + (held.action ? 320 : -200) * dt, 20, 1100);
    if (!this.overheated && this.tempC > MoxieGame.HOT_C) {
      this.overheated = true;
      this.mistakes++;
      this.say('hot', false);
    } else if (this.overheated && this.tempC <= this.band.max) this.overheated = false;
    const inBand = !this.overheated && this.tempC >= this.band.min && this.tempC <= this.band.max;
    if (inBand && !this.inBand) this.say('working', true);
    this.inBand = inBand;
    if (inBand) this.progress += dt / this.needS;
  }
}

export interface Beat {
  /** Segundo del juego en que el latido pasa por la línea. */
  t: number;
  result: 'hit' | 'miss' | null;
}

/** Enfermería: tomar el pulso apretando E justo cuando cada latido pasa por la línea. */
export class PulseGame extends Minigame {
  readonly id = 'pulse';
  protected readonly parSeconds = 11;
  readonly bpm: number;
  readonly beats: Beat[] = [];
  hits = 0;
  readonly goal: number;
  readonly window: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.bpm = Math.round(this.rng.between(62, 78));
    this.goal = setup.easy ? 6 : 8;
    this.window = setup.easy ? 0.22 : 0.16;
    const period = 60 / this.bpm;
    for (let i = 0; i < 200; i++) this.beats.push({ t: 1.6 + i * period, result: null });
  }

  protected step(_dt: number, { pressed }: MinigameInput): void {
    const now = this.elapsed;
    for (const b of this.beats) if (b.result === null && now - b.t > this.window) b.result = 'miss';
    if (!pressed.action) return;
    const next = this.beats.find((b) => b.result === null);
    if (next && Math.abs(next.t - now) <= this.window) {
      next.result = 'hit';
      this.hits++;
      this.progress = this.hits / this.goal;
      this.say('hit', true);
    } else {
      this.mistakes++;
      this.say(next && next.t > now ? 'early' : 'late', false);
    }
  }
}

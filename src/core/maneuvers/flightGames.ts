import { clamp } from '../math';
import { Rng } from '../rng/Rng';
import type { StageKind } from './types';

export type Arrow = 'up' | 'down' | 'left' | 'right';
export const ARROWS: readonly Arrow[] = ['up', 'down', 'left', 'right'];

/** Entrada de un cuadro: teclas mantenidas y teclas recién apretadas. */
export interface FlightInput {
  held: { left: boolean; right: boolean; action: boolean };
  pressed: { action: boolean; arrow: Arrow | null };
}

export const NO_FLIGHT_INPUT: FlightInput = { held: { left: false, right: false, action: false }, pressed: { action: false, arrow: null } };

/** Mensaje corto para la pantalla (clave dentro de `maneuvers.game.<tipo>`), bueno o malo. */
export interface FlightMessage {
  key: string;
  good: boolean;
}

/**
 * Minijuego de una etapa de vuelo (preparación y maniobra). Puro y determinista: la escena le pasa la entrada de
 * cada cuadro y lee su estado para dibujarlo. Nunca se pierde: el puntaje (0..1) sólo define cuánto combustible se
 * gasta. `factor` < 1 si los sistemas de la etapa quedaron en amarillo o rojo (todo se vuelve más difícil).
 */
export abstract class FlightGame {
  abstract readonly kind: Exclude<StageKind, 'timing'>;
  done = false;
  score = 0;
  elapsed = 0;
  mistakes = 0;
  message: FlightMessage | null = null;
  protected readonly rng: Rng;

  constructor(
    seed: number,
    protected readonly factor = 1,
  ) {
    this.rng = new Rng(seed);
  }

  update(dt: number, input: FlightInput): void {
    if (this.done) return;
    this.elapsed += dt;
    this.step(dt, input);
  }

  protected abstract step(dt: number, input: FlightInput): void;

  protected finish(score: number, message: FlightMessage): void {
    this.done = true;
    this.score = clamp(score);
    this.message = message;
  }
}

/**
 * Cargar combustible: mantener Espacio llena el tanque; hay que soltar dentro de la franja verde. Si rebalsa, se
 * corta solo y se pierde una parte.
 */
export class FuelGame extends FlightGame {
  readonly kind = 'fuel';
  static readonly FILL_PER_SECOND = 0.3;
  level = 0;
  readonly target: { center: number; width: number };
  private started = false;

  constructor(seed: number, factor = 1) {
    super(seed, factor);
    const width = 0.14 * factor;
    this.target = { center: this.rng.between(0.74, 0.9), width };
  }

  protected step(dt: number, { held }: FlightInput): void {
    if (held.action) {
      this.started = true;
      this.level = Math.min(1, this.level + FuelGame.FILL_PER_SECOND * dt);
      if (this.level >= 1) this.finish(0.15, { key: 'overflow', good: false });
      return;
    }
    if (!this.started) return;
    const distance = Math.abs(this.level - this.target.center);
    const half = this.target.width / 2;
    if (distance <= half) this.finish(1 - (distance / half) * 0.4, { key: distance <= half / 3 ? 'perfect' : 'good', good: true });
    else this.finish(Math.max(0.1, 0.55 - (distance - half) * 3), { key: this.level < this.target.center ? 'short' : 'over', good: false });
  }
}

/**
 * Abordaje: la tripulación se ajusta los cinturones y conecta los trajes. Se aprieta la secuencia de flechas que
 * se ve, en orden; cada error y la demora bajan el puntaje.
 */
export class BoardGame extends FlightGame {
  readonly kind = 'board';
  readonly sequence: Arrow[];
  index = 0;
  private readonly parSeconds: number;

  constructor(seed: number, factor = 1) {
    super(seed, factor);
    const length = 5 + (factor < 1 ? 1 : 0) + (factor < 0.5 ? 1 : 0);
    this.sequence = Array.from({ length }, () => this.rng.pick(ARROWS));
    this.parSeconds = length * 0.9;
  }

  protected step(_dt: number, { pressed }: FlightInput): void {
    if (!pressed.arrow) return;
    if (pressed.arrow === this.sequence[this.index]) {
      this.index++;
      this.message = { key: 'right', good: true };
    } else {
      this.mistakes++;
      this.message = { key: 'wrong', good: false };
    }
    if (this.index >= this.sequence.length) {
      const late = Math.max(0, this.elapsed - this.parSeconds) / 10;
      const score = 1 - 0.15 * this.mistakes - late;
      this.finish(score, { key: score >= 0.85 ? 'perfect' : 'good', good: true });
    }
  }
}

/**
 * Cuenta regresiva: T-10 … T-0 y en el cero, ¡ignición! Hay que apretar Espacio justo en el cero; apurarse cuesta y,
 * si nadie aprieta, los motores encienden solos un poco tarde.
 */
export class CountdownGame extends FlightGame {
  readonly kind = 'countdown';
  static readonly TICK_SECONDS = 0.6;
  static readonly FROM = 10;
  private early = 0;

  /** Segundos desde el inicio hasta el cero. */
  get zeroAt(): number {
    return CountdownGame.FROM * CountdownGame.TICK_SECONDS;
  }

  /** Número que se muestra (10 … 0). */
  get count(): number {
    return Math.max(0, CountdownGame.FROM - Math.floor(this.elapsed / CountdownGame.TICK_SECONDS));
  }

  protected step(_dt: number, { pressed }: FlightInput): void {
    const window = 0.5 * this.factor;
    if (pressed.action) {
      const diff = this.elapsed - this.zeroAt;
      if (diff < -window) {
        this.early++;
        this.mistakes++;
        this.message = { key: 'early', good: false };
        return;
      }
      const off = Math.abs(diff);
      const base = off <= 0.12 ? 1 : Math.max(0.45, 1 - off / (window * 1.6));
      this.finish(base - 0.2 * this.early, { key: off <= 0.12 ? 'perfect' : 'good', good: true });
      return;
    }
    if (this.elapsed > this.zeroAt + 1.2) this.finish(0.3 - 0.1 * this.early, { key: 'late', good: false });
  }
}

/**
 * Pilotaje: mantener la aguja en el centro con ← → mientras la nave se sacude (orientar el escudo, el giro del
 * despegue, el descenso con motores). Puntaje: el tiempo que estuvo en la zona.
 */
export class SteerGame extends FlightGame {
  readonly kind = 'steer';
  static readonly DURATION_SECONDS = 6;
  position = 0;
  readonly zone: number;
  private drift = 0;
  private target = 0;
  private sinceChange = 0;
  private inZone = 0;

  constructor(seed: number, factor = 1) {
    super(seed, factor);
    this.zone = 0.34 * factor;
    this.target = this.rng.between(-1, 1);
  }

  /** Avance del pilotaje (0..1) para la barra de tiempo. */
  get progress(): number {
    return Math.min(1, this.elapsed / SteerGame.DURATION_SECONDS);
  }

  protected step(dt: number, { held }: FlightInput): void {
    this.sinceChange += dt;
    if (this.sinceChange >= 1.1) {
      this.sinceChange = 0;
      this.target = this.rng.between(-1, 1);
    }
    // El sacudón cambia de a poco, para que se pueda corregir.
    this.drift += (this.target - this.drift) * Math.min(1, dt * 2.5);
    const steer = Number(held.right) - Number(held.left);
    this.position = clamp(this.position + (this.drift * 0.6 + steer * 1.15) * dt, -1, 1);
    if (Math.abs(this.position) <= this.zone) this.inZone += dt;
    if (this.elapsed >= SteerGame.DURATION_SECONDS) {
      const share = this.inZone / SteerGame.DURATION_SECONDS;
      const score = Math.min(1, share / 0.85);
      this.finish(score, { key: score >= 0.85 ? 'perfect' : score >= 0.5 ? 'good' : 'shaky', good: score >= 0.5 });
    }
  }
}

/** Crea el minijuego de una etapa (las de `timing` las maneja `ManeuverRun` con su barra). */
export function createFlightGame(kind: Exclude<StageKind, 'timing'>, seed: number, factor = 1): FlightGame {
  switch (kind) {
    case 'fuel':
      return new FuelGame(seed, factor);
    case 'board':
      return new BoardGame(seed, factor);
    case 'countdown':
      return new CountdownGame(seed, factor);
    case 'steer':
      return new SteerGame(seed, factor);
  }
}

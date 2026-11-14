/** RNG con semilla (mulberry32): mismas semillas => mismas partidas, ideal para tests y replays. */
export class Rng {
  private state_: number;

  constructor(seed: number) {
    this.state_ = seed >>> 0;
  }

  /** Estado interno: `new Rng(rng.state)` continúa exactamente la misma secuencia (guardado, §3.9). */
  get state(): number {
    return this.state_;
  }

  next(): number {
    this.state_ = (this.state_ + 0x6d2b79f5) >>> 0;
    let t = this.state_;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: lista vacía');
    return items[Math.floor(this.next() * items.length)]!;
  }
}

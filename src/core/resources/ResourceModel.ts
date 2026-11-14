import { clamp } from '../math';

export type ResourceKey = 'oxygen' | 'water' | 'food' | 'power';
export type ResourceState = Record<ResourceKey, number>;
export type ConsumableKey = Exclude<ResourceKey, 'power'>;

export interface PowerSystem {
  batteryCapacityKwh: number;
  solarGenerationKw: number;
  baseLoadKw: number;
}

export interface ResourceModelOptions {
  crew: number;
  initial: ResourceState;
  /** Consumo por tripulante y día (kg), p. ej. de NASA BVAD. */
  rates: Record<ConsumableKey, number>;
  power: PowerSystem;
}

/** Soporte vital: consumo por tripulante y balance energético. Lógica pura y determinista. */
export class ResourceModel {
  private state: ResourceState;
  private readonly crew: number;
  private readonly rates: Record<ConsumableKey, number>;
  private readonly power: PowerSystem;

  constructor({ crew, initial, rates, power }: ResourceModelOptions) {
    this.crew = crew;
    this.rates = rates;
    this.power = power;
    this.state = { ...initial };
  }

  get snapshot(): Readonly<ResourceState> {
    return { ...this.state };
  }

  /** Avanza la simulación `hours` horas de juego y devuelve los recursos agotados. */
  tick(hours: number): ResourceKey[] {
    const days = hours / 24;
    for (const key of ['oxygen', 'water', 'food'] as const) {
      this.state[key] = Math.max(0, this.state[key] - this.rates[key] * this.crew * days);
    }
    const netKw = this.power.solarGenerationKw - this.power.baseLoadKw;
    this.state.power = clamp(this.state.power + netKw * hours, 0, this.power.batteryCapacityKwh);
    return this.depleted();
  }

  apply(delta: Partial<ResourceState>): void {
    for (const [key, amount] of Object.entries(delta) as [ResourceKey, number][]) {
      const max = key === 'power' ? this.power.batteryCapacityKwh : Infinity;
      this.state[key] = clamp(this.state[key] + amount, 0, max);
    }
  }

  depleted(): ResourceKey[] {
    return (Object.keys(this.state) as ResourceKey[]).filter((key) => this.state[key] <= 0);
  }

  /** Días de autonomía restantes para un consumible al ritmo actual. */
  daysRemaining(key: ConsumableKey): number {
    return this.state[key] / (this.rates[key] * this.crew);
  }
}

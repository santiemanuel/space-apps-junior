import { clamp } from '../math';
import { BVAD_RATES_PER_CREW_DAY, HABITAT_POWER } from './rates';

export type ResourceKey = 'oxygen' | 'water' | 'food' | 'power';
export type ResourceState = Record<ResourceKey, number>;

export interface ResourceModelOptions {
  crew: number;
  initial: ResourceState;
  rates?: Record<Exclude<ResourceKey, 'power'>, number>;
  power?: { batteryCapacityKwh: number; solarGenerationKw: number; baseLoadKw: number };
}

/** Soporte vital: consumo por tripulante (BVAD) y balance energético. Lógica pura y determinista. */
export class ResourceModel {
  private state: ResourceState;
  private readonly crew: number;
  private readonly rates: Record<Exclude<ResourceKey, 'power'>, number>;
  private readonly power: Required<ResourceModelOptions>['power'];
  /** Multiplicador sobre la generación solar (p. ej. degradación por tormentas). */
  solarEfficiency = 1;

  constructor({ crew, initial, rates = BVAD_RATES_PER_CREW_DAY, power = HABITAT_POWER }: ResourceModelOptions) {
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
    const netKw = this.power.solarGenerationKw * this.solarEfficiency - this.power.baseLoadKw;
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
  daysRemaining(key: Exclude<ResourceKey, 'power'>): number {
    return this.state[key] / (this.rates[key] * this.crew);
  }
}

import { HabitatSession, type HabitatOptions } from '../habitat/HabitatSession';
import { cruiseDistanceAu } from '../meters/energy';
import type { MeterEnvironment } from '../meters/step';
import type { GameState } from '../state/types';
import type { VoyageContent, VoyageLeg } from './types';

export interface VoyageOptions extends Omit<HabitatOptions<VoyageContent>, 'phase'> {
  leg: VoyageLeg;
}

/** Escena `Voyage` sin motor (§4.2, §4.6): la nave en viaje, con la luz que cae con la distancia al Sol. */
export class VoyageSession extends HabitatSession<VoyageContent> {
  readonly leg: VoyageLeg;
  protected readonly place = 'cruise';

  constructor(options: VoyageOptions) {
    super({ ...options, phase: options.leg === 'out' ? 'cruiseOut' : 'cruiseBack' });
    this.leg = options.leg;
  }

  protected environment(s: GameState): MeterEnvironment {
    return {
      place: 'cruise',
      doseRateUGyH: this.dose.uGyH,
      sepActive: s.activeIncidents.some((i) => i.definitionId === 'radiationStorm' && i.status === 'active'),
      solar: { panelKwAt1Au: this.content.power.panelKwAt1Au, distanceAu: cruiseDistanceAu(this.progress, this.leg) },
    };
  }

  /** En la vuelta, lo que se gana de condición física cuenta doble para llegar en forma a 1 g (§4.6). */
  protected afterStep(before: GameState, after: GameState): GameState {
    if (this.leg !== 'back') return after;
    const k = this.content.back.exerciseMultiplier;
    return {
      ...after,
      crew: after.crew.map((m) => {
        const old = before.crew.find((b) => b.id === m.id)!.condition;
        return m.condition > old ? { ...m, condition: Math.min(1, old + (m.condition - old) * k) } : m;
      }),
    };
  }

  protected averageGenerationKw(): number {
    return this.content.power.panelKwAt1Au / cruiseDistanceAu(this.progress, this.leg) ** 2;
  }

  protected wearFactor(): number {
    return this.leg === 'back' ? this.content.back.wearMultiplier : 1;
  }
}

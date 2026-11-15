import { workSpeed } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { MarsWeather } from '../environment/series';
import { HabitatSession, type HabitatOptions, type StepContext } from '../habitat/HabitatSession';
import { EXTERIOR, type Point } from '../habitat/layout';
import { incidentModifiers } from '../incidents/planner';
import { dustFactorFromUv, heatingKw, MARS_DISTANCE_AU } from '../meters/energy';
import type { MeterEnvironment, MeterPlan } from '../meters/step';
import { Rng } from '../rng/Rng';
import type { GameState, Sample } from '../state/types';
import type { MarsContent, SampleSite } from './types';

const HOUR_MS = 3_600_000;
/** Semilla propia de los puntos de muestreo: no gasta tiradas del `Rng` de la partida y no cambia al cargar. */
const SITES_SALT = 0x5a3b1e;

export interface MarsOptions extends Omit<HabitatOptions<MarsContent>, 'phase'> {
  /** Clima real de Gale del día (`galeWeatherOn`). */
  weather: (date: string) => MarsWeather;
}

const hourOf = (ms: number): number => (((ms / HOUR_MS) % 24) + 24) % 24;

/** Puntos de muestreo en el exterior, más lejos si el aterrizaje quedó lejos de la base (§4.3, §4.4). */
export function sampleSites(content: MarsContent, seed: number, landingDistanceKm: number | null): SampleSite[] {
  const ext = content.layout.exterior;
  if (!ext) return [];
  const rng = new Rng((seed ^ SITES_SALT) >>> 0);
  const door = { x: ext.door.col + 0.5, y: ext.door.row + 0.5 };
  const { rect } = ext;
  const r = content.samples;
  const maxDistance = Math.hypot(rect.col + rect.cols - door.x, rect.rows);
  const minDistance = Math.min(maxDistance * 0.6, r.minTiles + r.tilesPerLandingKm * (landingDistanceKm ?? 0));
  const sites: SampleSite[] = [];
  for (let i = 0; i < r.count; i++) {
    let x = 0;
    let y = 0;
    let distance = 0;
    for (let tries = 0; tries < 50 && distance < minDistance; tries++) {
      x = rng.between(rect.col + 1, rect.col + rect.cols - 1);
      y = rng.between(rect.row + 1, rect.row + rect.rows - 1);
      distance = Math.hypot(x - door.x, y - door.y);
    }
    const round = (v: number) => Math.round(v * 10) / 10;
    sites.push({
      id: `sample-${i + 1}`,
      x: round(x),
      y: round(y),
      distance: round(distance),
      massKg: round(rng.between(r.minMassKg, r.maxMassKg)),
      value: Math.round(r.baseValue + r.valuePerTile * distance),
    });
  }
  return sites;
}

/**
 * Escena `Mars` sin motor (§4.4): la base en el cráter Gale con el polvo (UV) y el frío reales de REMS, la luz
 * del sol marciano, MOXIE, el invernadero y las salidas al exterior a juntar muestras.
 */
export class MarsSession extends HabitatSession<MarsContent> {
  protected readonly place = 'mars';
  readonly sites: readonly SampleSite[];
  private readonly weatherOf: (date: string) => MarsWeather;
  private readonly sampleProgress = new Map<string, number>();

  constructor(options: MarsOptions) {
    super({ ...options, phase: 'mars' });
    this.weatherOf = options.weather;
    this.sites = sampleSites(this.content, options.state.seed, options.state.landingDistanceKm);
  }

  /** Clima real de Gale de hoy (lo reporta Curiosity, el vecino robot). */
  get weather(): MarsWeather {
    return this.weatherOf(this.simDate);
  }

  get daylight(): boolean {
    const h = hourOf(Date.parse(this.simDate));
    return h >= this.content.daylight.sunriseHour && h < this.content.daylight.sunsetHour;
  }

  /** Se puede salir: es de día y ninguna respuesta a un incidente lo impide (tormenta, sellos, §4.4). */
  get evaOpen(): boolean {
    return this.daylight && !incidentModifiers(this.content.incidents, this.state).evaBlocked;
  }

  /** Muestras que siguen en el terreno, con lo que lleva juntado el jugador. */
  remainingSites(): { site: SampleSite; progress: number }[] {
    const taken = new Set(this.state.inventory.samples.map((s) => s.siteId));
    return this.sites.filter((s) => !taken.has(s.id)).map((site) => ({ site, progress: this.sampleProgress.get(site.id) ?? 0 }));
  }

  /** Muestra al alcance del jugador (si está afuera y se puede hacer ciencia). */
  siteAt(position: Point): SampleSite | null {
    const reach = this.content.samples.reachTiles;
    const mods = incidentModifiers(this.content.incidents, this.state);
    if (mods.sciencePaused) return null;
    return this.remainingSites().find(({ site }) => Math.hypot(site.x - position.x, site.y - position.y) <= reach)?.site ?? null;
  }

  /** Promedio de un sol: la luz (seno entre la salida y la puesta) da 1/π del máximo y el polvo la recorta. */
  protected averageGenerationKw(): number {
    const { daylight, power, meterRules } = this.content;
    const dayShare = (daylight.sunsetHour - daylight.sunriseHour) / 24;
    return (power.panelKwAt1Au / MARS_DISTANCE_AU ** 2) * dustFactorFromUv(meterRules, this.weather.uv) * dayShare * (2 / Math.PI);
  }

  protected averageHeatingKw(): number {
    return heatingKw(this.content.meterRules, this.weather.minTempC);
  }

  /** f_luz promedio del paso: el Sol sale a las 6 y se pone a las 18 (seno), 0 de noche (§3.2). */
  private lightFactor(hours: number): number {
    const { sunriseHour, sunsetHour } = this.content.daylight;
    const end = Date.parse(this.simDate);
    const steps = 12;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      const h = hourOf(end - hours * HOUR_MS * (1 - (i + 0.5) / steps));
      if (h > sunriseHour && h < sunsetHour) sum += Math.sin((Math.PI * (h - sunriseHour)) / (sunsetHour - sunriseHour));
    }
    return sum / steps;
  }

  protected environment(s: GameState, hours: number, { adj }: StepContext): MeterEnvironment {
    const weather = this.weatherOf(s.simDate);
    return {
      place: 'mars',
      doseRateUGyH: this.dose.uGyH,
      sepActive: s.activeIncidents.some((i) => i.definitionId === 'radiationStorm' && i.status === 'active'),
      solar: {
        panelKwAt1Au: this.content.power.panelKwAt1Au,
        distanceAu: MARS_DISTANCE_AU,
        dustFactor: adj.dustFactorOverride ?? dustFactorFromUv(this.content.meterRules, weather.uv),
        lightFactor: this.lightFactor(hours),
      },
      minTempC: weather.minTempC,
    };
  }

  protected planExtras(s: GameState, hours: number, { adj, mods }: StepContext): Partial<MeterPlan> {
    const moxie = s.systems.moxie;
    const moxieOn = adj.moxieOn && this.activeLoads({ adj, mods }).includes('moxie');
    const moxieKgPerDay = moxieOn && moxie !== 'red' ? this.content.moxieOxygenKgPerDay * (moxie === 'yellow' ? 0.5 : 1) : 0;
    return {
      heatingFactor: adj.heatingFactor * mods.heatingFactor,
      oxygenProducedKg: ((moxieKgPerDay + adj.extraOxygenKgPerDay) * hours) / 24,
    };
  }

  protected activeLoads(ctx: StepContext): readonly string[] {
    const loads = super.activeLoads(ctx);
    return ctx.mods.greenhouseOff ? loads.filter((k) => k !== 'greenhouse') : loads;
  }

  protected snapshotExtras() {
    const samples = this.state.inventory.samples;
    return {
      mars: {
        weather: this.weather,
        forecast: this.weatherOf(new Date(Date.parse(this.simDate) + 24 * HOUR_MS).toISOString()),
        daylight: this.daylight,
        evaOpen: this.evaOpen,
        samples: {
          count: samples.length,
          total: this.sites.length,
          kg: Math.round(samples.reduce((sum, x) => sum + x.massKg, 0) * 10) / 10,
          value: samples.reduce((sum, x) => sum + x.value, 0),
        },
      },
    };
  }

  /** El invernadero encendido suma comida al stock; con plaga rinde la mitad (§4.4). */
  protected afterStep(_before: GameState, after: GameState, hours: number, ctx: StepContext): GameState {
    const status = after.systems.greenhouse;
    if (status === 'red' || !this.activeLoads(ctx).includes('greenhouse')) return after;
    const { foodKgPerDay, priorityMultiplier } = this.content.greenhouse;
    const food = ((foodKgPerDay * hours) / 24) * (status === 'yellow' ? 0.5 : 1) * (ctx.adj.greenhousePriority ? priorityMultiplier : 1);
    return { ...after, inventory: { ...after.inventory, foodKg: after.inventory.foodKg + food } };
  }

  /** Afuera, junto a un punto de muestreo: la geóloga-médica junta ×1,5 más rápido (§3.3). */
  protected workAtPoint(s: GameState, crewId: CrewId, position: Point, hours: number): GameState | null {
    const member = s.crew.find((m) => m.id === crewId);
    if (!member || member.location !== EXTERIOR) return null;
    const site = this.siteAt(position);
    if (!site) return null;
    const progress = (this.sampleProgress.get(site.id) ?? 0) + (hours * workSpeed(member, 'samples', s.meters.lifeSupport.co2MmHg)) / this.content.samples.collectHours;
    if (progress < 1) {
      this.sampleProgress.set(site.id, progress);
      return s;
    }
    this.sampleProgress.delete(site.id);
    const sample: Sample = { id: site.id, siteId: site.id, massKg: site.massKg, value: site.value };
    return {
      ...s,
      inventory: { ...s.inventory, samples: [...s.inventory.samples, sample] },
      history: [
        ...s.history,
        { simDate: s.simDate, phase: 'mars', kind: 'decision', key: 'mars.log.sample', data: { siteId: site.id, massKg: site.massKg, value: site.value, crewId } },
      ],
    };
  }
}

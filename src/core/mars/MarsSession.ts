import { workSpeed } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { MarsWeather } from '../environment/series';
import { HabitatSession, type HabitatOptions, type StepContext } from '../habitat/HabitatSession';
import { EXTERIOR, exteriorDoorPoint, zoneAt, type Point } from '../habitat/layout';
import { incidentModifiers } from '../incidents/planner';
import { dustFactorFromUv, heatingKw, MARS_DISTANCE_AU } from '../meters/energy';
import type { MeterEnvironment, MeterPlan } from '../meters/step';
import { realEventLogEntry } from '../report/report';
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

/** Altura del Sol a una hora local: 0 de noche y 1 al mediodía (seno entre la salida y la puesta, §3.2). */
export function sunAt(hour: number, { sunriseHour, sunsetHour }: MarsContent['daylight']): number {
  return hour > sunriseHour && hour < sunsetHour ? Math.sin((Math.PI * (hour - sunriseHour)) / (sunsetHour - sunriseHour)) : 0;
}

/** Cielo de Gale en este momento, para pintar el exterior. */
export interface MarsSky {
  /** Altura del Sol (`sunAt`). */
  sun: number;
  /** f_polvo del día, del índice UV real de REMS (1 cielo limpio). */
  dust: number;
  /** Hay una tormenta de polvo en curso. */
  storm: boolean;
}

/**
 * Puntos de muestreo en el exterior, sólo en terreno transitable y más lejos si el aterrizaje quedó lejos de la base
 * (§4.3, §4.4).
 */
export function sampleSites(content: MarsContent, seed: number, landingDistanceKm: number | null): SampleSite[] {
  const { layout } = content;
  const ext = layout.exterior;
  if (!ext) return [];
  const rng = new Rng((seed ^ SITES_SALT) >>> 0);
  const door = exteriorDoorPoint(ext);
  const { rect } = ext;
  const r = content.samples;
  const corners = [rect.col, rect.col + rect.cols].flatMap((x) => [rect.row, rect.row + rect.rows].map((y) => Math.hypot(x - door.x, y - door.y)));
  const minDistance = Math.min(Math.max(...corners) * 0.6, r.minTiles + r.tilesPerLandingKm * (landingDistanceKm ?? 0));
  const round = (v: number) => Math.round(v * 10) / 10;
  const sites: SampleSite[] = [];
  for (let i = 0; i < r.count; i++) {
    // Una franja por muestra, en orden: así sale al menos una roca de cada tipo.
    const zone = r.rocks.length ? r.rocks[i % r.rocks.length]! : { rect, rock: '' };
    const top = Math.max(rect.row, zone.rect.row);
    const bottom = Math.min(rect.row + rect.rows, zone.rect.row + zone.rect.rows);
    const left = Math.max(rect.col, zone.rect.col);
    const right = Math.min(rect.col + rect.cols, zone.rect.col + zone.rect.cols);
    let site = { x: door.x, y: door.y + 1, distance: 1 };
    for (let tries = 0; tries < 80; tries++) {
      const x = round(rng.between(left + 1, right - 1));
      const y = round(rng.between(top + 0.5, bottom - 0.5));
      // En terreno transitable y con lugar alrededor para llegar desde cualquier lado (no pegada a una roca o una ladera).
      const around = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      if (around.some(([dx, dy]) => zoneAt(layout, { x: x + dx!, y: y + dy! }) !== EXTERIOR)) continue;
      site = { x, y, distance: Math.hypot(x - door.x, y - door.y) };
      if (site.distance >= minDistance) break;
    }
    sites.push({
      id: `sample-${i + 1}`,
      x: site.x,
      y: site.y,
      distance: round(site.distance),
      massKg: round(rng.between(r.minMassKg, r.maxMassKg)),
      value: Math.round(r.baseValue + r.valuePerTile * site.distance),
      rock: zone.rock,
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

  get sky(): MarsSky {
    return {
      sun: sunAt(hourOf(Date.parse(this.simDate)), this.content.daylight),
      dust: dustFactorFromUv(this.content.meterRules, this.weather.uv),
      storm: this.state.activeIncidents.some((i) => i.definitionId === 'dustStorm' && i.status === 'active'),
    };
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
    const end = Date.parse(this.simDate);
    const steps = 12;
    let sum = 0;
    for (let i = 0; i < steps; i++) sum += sunAt(hourOf(end - hours * HOUR_MS * (1 - (i + 0.5) / steps)), this.content.daylight);
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
    const s = this.realMomentsUntil(after);
    const status = s.systems.greenhouse;
    if (status === 'red' || !this.activeLoads(ctx).includes('greenhouse')) return s;
    const { foodKgPerDay, priorityMultiplier } = this.content.greenhouse;
    const food = ((foodKgPerDay * hours) / 24) * (status === 'yellow' ? 0.5 : 1) * (ctx.adj.greenhousePriority ? priorityMultiplier : 1);
    return { ...s, inventory: { ...s.inventory, foodKg: s.inventory.foodKg + food } };
  }

  /**
   * Lo que pasó de verdad desde el paso anterior (`this.state` todavía tiene su fecha) hasta `after`: tarjeta en el bus
   * y anotación en el historial, una sola vez.
   */
  private realMomentsUntil(after: GameState): GameState {
    const from = Date.parse(this.state.simDate);
    const to = Date.parse(after.simDate);
    let s = after;
    for (const event of this.content.realMoments) {
      const at = Date.parse(event.date);
      if (at <= from || at > to || s.history.some((e) => e.kind === 'realEvent' && e.key === event.id)) continue;
      s = { ...s, history: [...s.history, realEventLogEntry(event, s)] };
      this.bus.emit('realEvent:shown', event);
    }
    return s;
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
    const sample: Sample = { id: site.id, siteId: site.id, massKg: site.massKg, value: site.value, ...(site.rock ? { rock: site.rock } : {}) };
    return {
      ...s,
      inventory: { ...s.inventory, samples: [...s.inventory.samples, sample] },
      history: [
        ...s.history,
        { simDate: s.simDate, phase: 'mars', kind: 'decision', key: 'mars.log.sample', data: { siteId: site.id, massKg: site.massKg, value: site.value, crewId, rock: site.rock } },
      ],
    };
  }
}

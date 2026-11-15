import { workSpeed } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { MarsWeather } from '../environment/series';
import { hashOf, HabitatSession, type HabitatOptions, type StepContext } from '../habitat/HabitatSession';
import { EXTERIOR, exteriorDoorPoint, zoneAt, type Closed, type Point } from '../habitat/layout';
import type { IncidentResponse } from '../incidents/definitions';
import type { IncidentState } from '../incidents/types';
import { incidentModifiers } from '../incidents/planner';
import { dustFactorFromUv, heatingKw, MARS_DISTANCE_AU } from '../meters/energy';
import type { MeterEnvironment, MeterPlan } from '../meters/step';
import { realEventLogEntry } from '../report/report';
import { Rng } from '../rng/Rng';
import type { GameState, HabitatSave, Sample } from '../state/types';
import type { MarsContent, SampleSite } from './types';
import type { HabitatTask } from '../habitat/types';

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

/** Nodos de la red eléctrica que importan para las reglas (el resto son cajas de empalme y la nave). */
const SOLAR = 'solar';
const BASE = 'base';
const BATTERY = 'battery';
/** Prefijo de la zona de trabajo de un cable cortado (`repairZoneAt`). */
const CABLE = 'cable:';
/** Zona de trabajo de los paneles solares (afuera, junto a ellos) y tareas optativas de riesgo y recompensa. */
export const PANELS_ZONE = 'panels';
const CLEAN_PANELS = 'cleanPanels';
const NIGHT_PREP = 'nightPrep';

/** Cómo llega la energía ahora (red de cables y fusible de la sala de energía). */
export interface MarsGrid {
  /** Tubos rotos (cerrados) y tramos de cable cortados. */
  brokenTubes: string[];
  cutCables: string[];
  /** Se quemó el fusible de la entrada de los paneles. */
  fuseBlown: boolean;
  /** Llega algo del sol a la base o a la batería. */
  solarLinked: boolean;
  /** La batería está conectada a la base. */
  batteryLinked: boolean;
  /** Parte del sol que llega (1 todo, 0 nada). */
  solarFactor: number;
}

/** Tipo (`Sample.rock`) de las muestras de plantas del invernadero. */
export const PLANT_ROCK = 'plant';
export const isPlant = (sample: Sample): boolean => sample.rock === PLANT_ROCK;
/** Muestras de plantas [regla]: una por sol como mucho, livianas y con algo de valor científico. */
const PLANT_SAMPLES = { max: 4, massKg: 1, value: 8, harvestFoodKg: 2 } as const;

/**
 * Escena `Mars` sin motor (§4.4): la base en el cráter Gale con el polvo (UV) y el frío reales de REMS, la luz
 * del sol marciano, MOXIE, el invernadero y las salidas al exterior a juntar muestras.
 */
export class MarsSession extends HabitatSession<MarsContent> {
  protected readonly place = 'mars';
  readonly sites: readonly SampleSite[];
  private readonly weatherOf: (date: string) => MarsWeather;
  private readonly sampleProgress = new Map<string, number>();
  /** Muestras guardadas en el depósito y quién lleva cada una de las que todavía no se guardaron. */
  private readonly stored = new Set<string>();
  private readonly carried = new Map<string, CrewId>();
  /** Polvo juntado sobre los paneles (0 limpios, 1 lo más sucio). */
  private dust = 0;
  /** Hasta cuándo dura la base preparada para la noche (ms de la fecha simulada). */
  private nightReadyUntilMs = 0;

  constructor(options: MarsOptions) {
    super({ ...options, phase: 'mars' });
    this.weatherOf = options.weather;
    this.sites = sampleSites(this.content, options.state.seed, options.state.landingDistanceKm);
    const saved = Date.parse(options.state.simDate) > Date.parse(this.window.start) ? options.state.habitat?.mars : undefined;
    for (const id of saved?.stored ?? []) this.stored.add(id);
    for (const [id, crew] of Object.entries(saved?.carried ?? {})) this.carried.set(id, crew as CrewId);
    this.dust = saved?.panelDust ?? 0;
    this.nightReadyUntilMs = saved?.nightReadyUntil ? Date.parse(saved.nightReadyUntil) : 0;
  }

  /** Polvo sobre los paneles (0..1) y la parte de la generación que se pierde por él. */
  get panels(): { dust: number; loss: number; canClean: boolean } {
    const { maxLoss, cleanFrom } = this.content.panels;
    return { dust: this.dust, loss: maxLoss * this.dust, canClean: this.dust >= cleanFrom };
  }

  /** La base está preparada para esta noche (o la que viene). */
  get nightReady(): boolean {
    return Date.parse(this.simDate) < this.nightReadyUntilMs;
  }

  /** De noche y con la base preparada: los sistemas gastan menos y el invernadero queda a oscuras. */
  private get nightSaving(): boolean {
    return this.nightReady && !this.daylight;
  }

  protected loadFactor(): number {
    return this.nightSaving ? this.content.night.loadFactor : 1;
  }

  protected taskReady(task: HabitatTask): boolean {
    if (task.id === CLEAN_PANELS) return this.panels.canClean;
    if (task.id === NIGHT_PREP) return this.daylight && !this.nightReady && hourOf(Date.parse(this.simDate)) >= this.content.night.fromHour;
    return true;
  }

  /** Tubo que rompió un incidente (fijo para cada uno, sin gastar tiradas del Rng). */
  tubeOf(incidentId: string): string {
    const tubes = this.content.layout.passages;
    return tubes[hashOf(incidentId) % tubes.length]!.id;
  }

  /** Tramo de cable que cortó un incidente. */
  cableOf(incidentId: string): MarsContent['grid']['cables'][number] {
    const { cables } = this.content.grid;
    return cables[hashOf(incidentId) % cables.length]!;
  }

  private broken(definitionId: string): IncidentState[] {
    return this.state.activeIncidents.filter((i) => i.definitionId === definitionId && i.status === 'active');
  }

  /** Estado de la red: qué está roto y cómo llega la energía. */
  get grid(): MarsGrid {
    const brokenTubes = this.broken('tubeBreach').map((i) => this.tubeOf(i.id));
    const cut = new Set(this.broken('cableCut').map((i) => this.cableOf(i.id).id));
    const cables = this.content.grid.cables.filter((c) => !cut.has(c.id));
    const linked = (a: string, b: string) => {
      const seen = new Set([a]);
      const queue = [a];
      for (let i = 0; i < queue.length; i++)
        for (const c of cables) {
          const next = c.from === queue[i] ? c.to : c.to === queue[i] ? c.from : null;
          if (next && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      return seen.has(b);
    };
    const fuseBlown = this.broken('fuseBlown').length > 0;
    const solarLinked = !fuseBlown && (linked(SOLAR, BASE) || linked(SOLAR, BATTERY));
    return {
      brokenTubes,
      cutCables: [...cut],
      fuseBlown,
      solarLinked,
      batteryLinked: linked(BATTERY, BASE),
      solarFactor: solarLinked ? Math.max(0, 1 - this.content.grid.lossPerCut * cut.size) : 0,
    };
  }

  closedPassages(): Closed {
    return new Set(this.grid.brokenTubes);
  }

  protected batteryLinked(): boolean {
    return this.grid.batteryLinked;
  }

  /** Junto a la puerta de un tubo roto (de este lado) o afuera junto al corte de un cable. */
  protected repairZoneAt(position: Point): string | null {
    const { layout, grid } = this.content;
    const reach = grid.repairReach;
    const here = zoneAt(layout, position);
    const near = (p: Point) => Math.hypot(p.x - position.x, p.y - position.y) <= reach;
    for (const id of this.grid.brokenTubes) {
      const tube = layout.passages.find((p) => p.id === id)!;
      if (here !== id && (tube.doorTiles ?? []).some((d) => near({ x: d.col + 0.5, y: d.row + 0.5 }))) return id;
    }
    if (here !== EXTERIOR) return null;
    const cable = this.broken('cableCut').map((i) => this.cableOf(i.id)).find((c) => near(c.at));
    if (cable) return CABLE + cable.id;
    const { at, reach: panelReach } = this.content.panels;
    return Math.hypot(at.x - position.x, at.y - position.y) <= panelReach ? PANELS_ZONE : null;
  }

  /**
   * Dónde se para un automático para reparar: junto a una puerta del tubo roto (del lado de afuera del tubo) o al lado
   * del cable cortado, en el exterior (sólo si se puede salir).
   */
  protected repairSpots(incident: IncidentState, _work: NonNullable<IncidentResponse['work']>): Point[] {
    const { layout } = this.content;
    if (incident.definitionId === 'tubeBreach') {
      const id = this.tubeOf(incident.id);
      const tube = layout.passages.find((p) => p.id === id);
      const spots: Point[] = [];
      for (const door of tube?.doorTiles ?? [])
        for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const point = { x: door.col + dc + 0.5, y: door.row + dr + 0.5 };
          const zone = zoneAt(layout, point);
          if (zone && zone !== id && zone !== EXTERIOR) spots.push(point);
        }
      return spots;
    }
    if (incident.definitionId === 'cableCut') return this.evaOpen ? [this.cableOf(incident.id).at] : [];
    return [];
  }

  protected repairContextKey(): string {
    return this.evaOpen ? 'eva' : '';
  }

  protected incidentWorkZone(incident: IncidentState, work: NonNullable<IncidentResponse['work']>): string | undefined {
    if (incident.definitionId === 'tubeBreach') return this.tubeOf(incident.id);
    if (incident.definitionId === 'cableCut') return CABLE + this.cableOf(incident.id).id;
    return super.incidentWorkZone(incident, work);
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
    // En el embarque final la puerta queda abierta: la nave espera.
    if (this.departure) return true;
    return this.daylight && !incidentModifiers(this.content.incidents, this.state).evaBlocked;
  }

  /** Muestras juntadas: las del depósito y las que todavía lleva alguien encima. */
  get sampleStorage(): { stored: number; carried: number } {
    return { stored: this.stored.size, carried: this.carried.size };
  }

  /**
   * Cosecha del invernadero (su minijuego, una vez por sol): deja una muestra de plantas cultivadas en Marte, que el
   * tripulante lleva encima hasta el depósito, como las rocas, para subirla a la nave al final.
   */
  protected onTaskDone(task: HabitatTask, daily: boolean): void {
    const log = (key: string) => {
      const s = this._state;
      this._state = { ...s, history: [...s.history, { simDate: s.simDate, phase: 'mars', kind: 'decision', key, data: { crewId: s.activeCrewId } }] };
    };
    if (task.id === CLEAN_PANELS) {
      this.dust = 0;
      return log('mars.log.panelsCleaned');
    }
    if (task.id === NIGHT_PREP) {
      // Dura hasta la próxima salida del Sol.
      const now = Date.parse(this.simDate);
      const day = 24 * HOUR_MS;
      let sunrise = Math.floor(now / day) * day + this.content.daylight.sunriseHour * HOUR_MS;
      while (sunrise <= now) sunrise += day;
      this.nightReadyUntilMs = sunrise;
      return log('mars.log.nightReady');
    }
    if (task.id !== 'greenhouse' || !daily) return;
    // La cosecha siempre deja comida fresca; la muestra para la Tierra, mientras haya frascos.
    this._state = { ...this._state, inventory: { ...this._state.inventory, foodKg: this._state.inventory.foodKg + PLANT_SAMPLES.harvestFoodKg } };
    const s = this._state;
    if (!this.plantSamplesLeft) return;
    const id = `plant-${s.simDate.slice(0, 10)}`;
    if (s.inventory.samples.some((x) => x.id === id)) return;
    const sample: Sample = { id, siteId: id, massKg: PLANT_SAMPLES.massKg, value: PLANT_SAMPLES.value, rock: PLANT_ROCK };
    this.carried.set(id, s.activeCrewId);
    this._state = {
      ...s,
      inventory: { ...s.inventory, samples: [...s.inventory.samples, sample] },
      history: [...s.history, { simDate: s.simDate, phase: 'mars', kind: 'decision', key: 'mars.log.plant', data: { crewId: s.activeCrewId } }],
    };
  }

  /** Frascos de muestras de plantas que quedan por llenar. */
  get plantSamplesLeft(): number {
    return Math.max(0, PLANT_SAMPLES.max - this.state.inventory.samples.filter(isPlant).length);
  }

  /** Rocas juntadas (sin contar las plantas). */
  get rocksCollected(): number {
    return this.state.inventory.samples.filter((x) => !isPlant(x)).length;
  }

  /** Con todas las rocas juntadas se puede empezar el embarque sin esperar al último sol. */
  get canLeaveEarly(): boolean {
    return !this.departure && !this.outcome && this.sites.length > 0 && this.rocksCollected >= this.sites.length && !!this.content.departure;
  }

  /** Empieza el embarque ahora (F): todos a la nave y la carga del depósito. */
  leaveEarly(): boolean {
    if (!this.canLeaveEarly) return false;
    const s = this._state;
    this._state = { ...s, history: [...s.history, { simDate: s.simDate, phase: 'mars', kind: 'decision', key: 'mars.log.leaveEarly' }] };
    this.windowEnded();
    return true;
  }

  /** En una salida, o con muestras encima sin guardar en el depósito, hay trabajo: el reloj no se apura. */
  protected extraWork(): boolean {
    const active = this.state.crew.find((m) => m.id === this.state.activeCrewId);
    return active?.location === EXTERIOR || [...this.carried.values()].includes(this.state.activeCrewId);
  }

  /** Quien entra al depósito deja ahí las muestras que lleva. */
  protected afterUpdate(): void {
    const storage = this.content.departure?.cargoZone;
    for (const [site, crewId] of this.carried)
      if (this.state.crew.find((m) => m.id === crewId)?.location === storage) {
        this.carried.delete(site);
        this.stored.add(site);
      }
  }

  protected saveExtras(): Partial<HabitatSave> {
    return {
      mars: {
        stored: [...this.stored],
        carried: Object.fromEntries(this.carried),
        ...(this.dust > 0 ? { panelDust: this.dust } : {}),
        ...(this.nightReady ? { nightReadyUntil: new Date(this.nightReadyUntilMs).toISOString() } : {}),
      },
    };
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
    return (power.panelKwAt1Au / MARS_DISTANCE_AU ** 2) * dustFactorFromUv(meterRules, this.weather.uv) * (1 - this.panels.loss) * dayShare * (2 / Math.PI) * this.grid.solarFactor;
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
        // El polvo del cielo (UV real del día) y el que se juntó sobre los paneles.
        dustFactor: (adj.dustFactorOverride ?? dustFactorFromUv(this.content.meterRules, weather.uv)) * (1 - this.panels.loss),
        // Lo que llega por los cables: con el fusible quemado o sin camino, nada.
        lightFactor: this.lightFactor(hours) * this.grid.solarFactor,
      },
      minTempC: weather.minTempC,
    };
  }

  protected planExtras(s: GameState, hours: number, { adj, mods }: StepContext): Partial<MeterPlan> {
    const moxie = s.systems.moxie;
    const moxieOn = adj.moxieOn && !this.blackout && this.activeLoads({ adj, mods }).includes('moxie');
    const moxieKgPerDay = moxieOn && moxie !== 'red' ? this.content.moxieOxygenKgPerDay * (moxie === 'yellow' ? 0.5 : 1) : 0;
    return {
      heatingFactor: adj.heatingFactor * mods.heatingFactor * (this.nightSaving ? this.content.night.heatingFactor : 1),
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
          count: this.rocksCollected,
          total: this.sites.length,
          kg: Math.round(samples.reduce((sum, x) => sum + x.massKg, 0) * 10) / 10,
          value: samples.reduce((sum, x) => sum + x.value, 0),
          ...this.sampleStorage,
        },
        plants: samples.filter(isPlant).length,
        canLeave: this.canLeaveEarly,
        grid: this.grid,
        panels: this.panels,
        nightReady: this.nightReady,
        nightPrepOpen: this.taskAt(this.content.tasks.find((t) => t.id === NIGHT_PREP)?.zone ?? null)?.kind === 'task' && this.taskReady({ id: NIGHT_PREP } as HabitatTask) && !this.departure,
      },
    };
  }

  /** El invernadero encendido suma comida al stock; con plaga rinde la mitad (§4.4). */
  protected afterStep(_before: GameState, after: GameState, hours: number, ctx: StepContext): GameState {
    const s = this.realMomentsUntil(after);
    // El polvo se junta sobre los paneles: de a poco, y mucho más rápido en una tormenta de polvo.
    const { dustPerSol, stormMultiplier } = this.content.panels;
    this.dust = Math.min(1, this.dust + ((dustPerSol * hours) / 24) * (this.sky.storm ? stormMultiplier : 1));
    const status = s.systems.greenhouse;
    if (status === 'red' || this.blackout || this.nightSaving || !this.activeLoads(ctx).includes('greenhouse')) return s;
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
    const progress = (this.sampleProgress.get(site.id) ?? 0) + (hours * workSpeed(member, 'samples', s.meters.lifeSupport.co2MmHg) * this.resourceMode.scienceFactor) / this.content.samples.collectHours;
    if (progress < 1) {
      this.sampleProgress.set(site.id, progress);
      return s;
    }
    this.sampleProgress.delete(site.id);
    this.carried.set(site.id, crewId);
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

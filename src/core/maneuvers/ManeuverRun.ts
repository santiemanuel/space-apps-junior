import type { CrewId } from '../crew/types';
import type { PhaseResult } from '../flow/types';
import { clamp } from '../math';
import { Rng } from '../rng/Rng';
import type { GameState, MissionLogEntry } from '../state/types';
import type { SystemId, SystemStatus } from '../systems/types';
import type {
  ChecklistDecision, ChecklistItem, CrewArrival, ManeuverConditions, ManeuverDefinition, ManeuverRules, StageOutcome,
} from './types';

export type ManeuverStep = 'checklist' | 'stage' | 'feedback' | 'done';

export interface StageZone {
  center: number;
  width: number;
}

const STATUS_RANK: Record<SystemStatus, number> = { green: 0, yellow: 1, red: 2 };

/** Onda triangular 0 → 1 → 0: la marca va y vuelve por la barra. */
const triangle = (x: number) => {
  const f = x % 2;
  return f <= 1 ? f : 2 - f;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Sale caminando o en camilla según su condición física (§4.7). */
export function arrivalFor(condition: number, rules: Pick<ManeuverRules, 'walkCondition'>): CrewArrival {
  return condition >= rules.walkCondition ? 'walk' : 'stretcher';
}

/**
 * Una maniobra en curso (§4.0): checklist Go / No-Go y luego una barra por etapa. Pura y determinista:
 * la escena llama a `update(dt)` y a `press()`; los errores cuestan combustible y nunca terminan la partida.
 */
export class ManeuverRun {
  readonly items: ChecklistItem[];
  readonly outcomes: StageOutcome[] = [];
  step: ManeuverStep = 'checklist';
  stageIndex = 0;
  private readonly state: GameState;
  private readonly rng: Rng;
  private readonly log: MissionLogEntry[] = [];
  private zones: StageZone[] = [];
  /** Cuánto se achica la zona de cada etapa (1 = sistemas en verde): los minijuegos también se ponen más difíciles. */
  private factors: number[] = [];
  private time = 0;

  constructor(
    readonly definition: ManeuverDefinition,
    state: GameState,
    private readonly rules: ManeuverRules,
    private readonly conditions: ManeuverConditions = { speedFactor: 1 },
  ) {
    this.state = structuredClone(state);
    this.rng = new Rng(state.rngState);
    this.items = [...new Set(definition.checklist)].map((systemId) => ({
      systemId,
      status: state.systems[systemId],
      decision: null,
    }));
  }

  get spares(): number {
    return this.state.inventory.spares;
  }

  get fuel(): number {
    return this.state.fuel;
  }

  repairCost(systemId: SystemId): number {
    const status = this.state.systems[systemId];
    return status === 'green' ? 0 : this.rules.repairSpares[status];
  }

  canRepair(systemId: SystemId): boolean {
    return this.state.systems[systemId] !== 'green' && this.spares >= this.repairCost(systemId);
  }

  /** Confirma una estación: `go` si está en verde; si no, `repair` (gasta repuestos) o `risk`. */
  decide(systemId: SystemId, decision: ChecklistDecision): boolean {
    const item = this.items.find((i) => i.systemId === systemId);
    if (this.step !== 'checklist' || !item || item.decision) return false;
    if ((item.status === 'green') !== (decision === 'go')) return false;
    if (decision === 'repair') {
      if (!this.canRepair(systemId)) return false;
      this.state.inventory.spares -= this.repairCost(systemId);
      this.state.systems[systemId] = 'green';
      item.status = 'green';
    }
    if (decision !== 'go') this.logEntry('decision', `maneuver.${decision}`, { system: systemId });
    item.decision = decision;
    return true;
  }

  get checklistReady(): boolean {
    return this.items.every((item) => item.decision !== null);
  }

  /** Termina el checklist y arma las zonas de cada etapa (más chicas si un sistema quedó en amarillo o rojo). */
  start(): boolean {
    if (this.step !== 'checklist' || !this.checklistReady) return false;
    const { zoneFactor, zoneMargin } = this.rules;
    this.zones = this.definition.stages.map((stage) => {
      const worst = stage.systems
        .map((id) => this.state.systems[id])
        .reduce<SystemStatus>((acc, status) => (STATUS_RANK[status] > STATUS_RANK[acc] ? status : acc), 'green');
      const width = stage.zoneWidth * zoneFactor[worst];
      return { center: this.rng.between(zoneMargin + width / 2, 1 - zoneMargin - width / 2), width };
    });
    this.factors = this.definition.stages.map((_stage, i) => this.zones[i]!.width / this.definition.stages[i]!.zoneWidth);
    this.step = 'stage';
    this.time = 0;
    return true;
  }

  get stage() {
    return this.definition.stages[this.stageIndex];
  }

  get zone(): StageZone | undefined {
    return this.zones[this.stageIndex];
  }

  /** Dificultad de la etapa actual: 1 con sus sistemas en verde, menos si quedaron en amarillo o rojo. */
  get stageFactor(): number {
    return this.factors[this.stageIndex] ?? 1;
  }

  /** Semilla de la etapa actual para su minijuego (sale del Rng de la partida: misma partida, mismo minijuego). */
  get stageSeed(): number {
    return (this.zones[this.stageIndex]?.center ?? 0.5) * 2 ** 31;
  }

  /** Posición de la marca en la barra (0..1). */
  get marker(): number {
    const stage = this.stage;
    return stage ? triangle(this.time * stage.speed * this.conditions.speedFactor) : 0;
  }

  update(dtSeconds: number): void {
    if (this.step === 'stage') this.time += dtSeconds;
  }

  /** Espacio: acierta si la marca está en la zona. Un error gasta combustible. */
  press(): StageOutcome | null {
    const stage = this.stage;
    const zone = this.zone;
    if (this.step !== 'stage' || !stage || !zone || (stage.kind ?? 'timing') !== 'timing') return null;
    const distance = Math.abs(this.marker - zone.center);
    const hit = distance <= zone.width / 2;
    const precision = hit ? 1 - (distance / (zone.width / 2)) * 0.5 : 0;
    return this.record(precision, hit);
  }

  /**
   * Termina una etapa que es un minijuego (cargar combustible, abordar, cuenta regresiva, pilotar) con su puntaje
   * (0..1). Igual que la barra: nunca termina la partida, sólo cuesta combustible.
   */
  complete(score: number): StageOutcome | null {
    const stage = this.stage;
    if (this.step !== 'stage' || !stage || (stage.kind ?? 'timing') === 'timing') return null;
    const precision = clamp(score);
    return this.record(precision, precision >= 0.5);
  }

  /** El combustible se gasta según la calidad: perfecto no cuesta nada y un error, `fuelPerMiss` entero. */
  private record(precision: number, hit: boolean): StageOutcome {
    const stage = this.stage!;
    this.state.fuel = round(clamp(this.state.fuel - this.rules.fuelPerMiss * (1 - precision)));
    const outcome = { stageId: stage.id, hit, precision };
    this.outcomes.push(outcome);
    this.logEntry('maneuver', `${this.definition.id}.${stage.id}`, { hit, precision: round(precision) });
    this.step = 'feedback';
    return outcome;
  }

  /** Pasa a la etapa siguiente después de mostrar el resultado de la actual. */
  next(): void {
    if (this.step !== 'feedback') return;
    this.stageIndex++;
    this.time = 0;
    this.step = this.stageIndex >= this.definition.stages.length ? 'done' : 'stage';
  }

  /** Promedio de las etapas (0..1). */
  get precision(): number {
    return this.outcomes.length ? this.outcomes.reduce((sum, o) => sum + o.precision, 0) / this.outcomes.length : 0;
  }

  get misses(): number {
    return this.outcomes.filter((o) => !o.hit).length;
  }

  /** Distancia a la base (sólo el aterrizaje). */
  get landingDistanceKm(): number | null {
    if (this.definition.effect !== 'landingDistance') return null;
    const { best, worst } = this.rules.landingDistanceKm;
    return Math.round(best + (worst - best) * (1 - this.precision));
  }

  /** Combustible que queda al terminar, con el efecto propio de la maniobra. */
  get finalFuel(): number {
    if (this.definition.effect !== 'returnFuel') return this.state.fuel;
    const { worst, best } = this.rules.returnFuel;
    return round(Math.min(this.state.fuel, worst + (best - worst) * this.precision));
  }

  /** Cómo sale cada tripulante de la cápsula (sólo la reentrada). */
  get crewArrival(): Partial<Record<CrewId, CrewArrival>> {
    if (this.definition.effect !== 'crewArrival') return {};
    return Object.fromEntries(this.state.crew.map((m) => [m.id, arrivalFor(m.condition, this.rules)]));
  }

  /** Resultado de la fase con el estado de salida: combustible, repuestos, sistemas, distancia e historial. */
  toPhaseResult(): PhaseResult {
    if (this.step !== 'done') throw new Error('ManeuverRun.toPhaseResult: la maniobra no terminó');
    const state = structuredClone(this.state);
    state.fuel = this.finalFuel;
    state.rngState = this.rng.state;
    if (this.definition.effect === 'landingDistance') state.landingDistanceKm = this.landingDistanceKm;
    state.history.push(...this.log, {
      simDate: state.simDate,
      phase: this.definition.id,
      kind: 'maneuver',
      key: this.definition.id,
      data: { precision: round(this.precision), misses: this.misses, fuel: state.fuel, ...this.crewArrival },
    });
    return { phase: this.definition.id, outcome: 'completed', state, achievements: [] };
  }

  private logEntry(kind: MissionLogEntry['kind'], key: string, data: MissionLogEntry['data']): void {
    this.log.push({ simDate: this.state.simDate, phase: this.definition.id, kind, key, data });
  }
}

export type PrecisionLevel = 'great' | 'good' | 'rough';
export const PRECISION_LEVELS: readonly PrecisionLevel[] = ['great', 'good', 'rough'];

/** Precisión en palabras y semáforo, sin porcentajes en pantalla (§3.6) [regla]. */
export const precisionLevel = (precision: number): PrecisionLevel => (precision >= 0.85 ? 'great' : precision >= 0.6 ? 'good' : 'rough');

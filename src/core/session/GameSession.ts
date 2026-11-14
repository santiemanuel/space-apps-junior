import { buildDecision, resolveDecision, type Decision, type DecisionChoice, type DecisionOutcome } from '../decisions/DecisionEngine';
import type { EnvironmentSnapshot } from '../environment/types';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import { MissionSystem } from '../missions/MissionSystem';
import type { MissionDefinition, MissionState } from '../missions/types';
import { ResourceModel, type ResourceState } from '../resources/ResourceModel';
import { Rng } from '../rng/Rng';

export interface GameSessionOptions {
  seed: number;
  crew: number;
  initialResources: ResourceState;
  missions: readonly MissionDefinition[];
  environment: EnvironmentSnapshot;
  /** Horas de juego por segundo real. */
  gameHoursPerSecond?: number;
  /** Horas de juego que una misión queda bloqueada tras posponerla. */
  postponeHours?: number;
}

/**
 * Raíz de composición de la lógica de juego. Agnóstica del motor: Phaser sólo llama a
 * `update`, `interact` y `choose`, y escucha `bus`. Permite simular partidas completas en tests.
 */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  readonly rng: Rng;
  readonly resources: ResourceModel;
  readonly missions: MissionSystem;
  private _environment!: EnvironmentSnapshot;
  private _pendingDecision: Decision | null = null;
  private readonly postponedUntil = new Map<string, number>();
  private readonly gameHoursPerSecond: number;
  private readonly postponeHours: number;
  gameHours = 0;
  overReason: string | null = null;

  constructor(options: GameSessionOptions) {
    this.rng = new Rng(options.seed);
    this.resources = new ResourceModel({ crew: options.crew, initial: options.initialResources });
    this.missions = new MissionSystem(options.missions, this.bus);
    this.gameHoursPerSecond = options.gameHoursPerSecond ?? 0.5;
    this.postponeHours = options.postponeHours ?? 6;
    this.setEnvironment(options.environment);

    this.bus.on('mission:completed', (mission) => {
      this.applyEffects(mission.definition.reward);
      this.checkEnd();
    });
    this.bus.on('mission:failed', () => this.checkEnd());
  }

  get environment(): EnvironmentSnapshot {
    return this._environment;
  }

  get pendingDecision(): Decision | null {
    return this._pendingDecision;
  }

  /** La simulación se congela mientras hay una decisión pendiente o la partida terminó. */
  get paused(): boolean {
    return this._pendingDecision !== null || this.overReason !== null;
  }

  setEnvironment(environment: EnvironmentSnapshot): void {
    this._environment = environment;
    // Las tormentas solares degradan la eficiencia de los paneles hasta un 30 %.
    this.resources.solarEfficiency = 1 - environment.radiationRisk * 0.3;
    this.bus.emit('environment:changed', environment);
  }

  update(deltaSeconds: number): void {
    if (this.paused) return;
    const hours = deltaSeconds * this.gameHoursPerSecond;
    this.gameHours += hours;
    const depleted = this.resources.tick(hours);
    this.bus.emit('clock:tick', { gameHours: this.gameHours });
    this.bus.emit('resources:changed', this.resources.snapshot);
    for (const resource of depleted) this.bus.emit('resources:depleted', { resource });
    if (depleted.length > 0) this.end(`Soporte vital agotado: ${depleted.join(', ')}`);
  }

  /** Interacción continua del jugador con una estación durante `deltaSeconds`. */
  interact(stationId: string, deltaSeconds: number): MissionState | undefined {
    if (this.paused) return undefined;
    const mission = this.missions.forStation(stationId);
    if (!mission) return undefined;
    if (mission.status === 'active') return this.missions.work(mission.definition.id, deltaSeconds);
    if ((this.postponedUntil.get(mission.definition.id) ?? -Infinity) > this.gameHours) return mission;

    const decision = buildDecision(mission.definition, this._environment);
    if (!decision) return this.missions.start(mission.definition.id);
    this._pendingDecision = decision;
    this.bus.emit('decision:required', decision);
    return mission;
  }

  choose(choice: DecisionChoice): DecisionOutcome {
    const decision = this._pendingDecision;
    if (!decision) throw new Error('No hay ninguna decisión pendiente');
    const mission = this.missions.get(decision.missionId);
    const outcome = resolveDecision(decision, choice, mission.definition, this.rng);
    this._pendingDecision = null;
    this.applyEffects(outcome.effects);
    if (!outcome.attempted) this.postponedUntil.set(decision.missionId, this.gameHours + this.postponeHours);
    else if (outcome.success) this.missions.start(decision.missionId);
    else this.missions.fail(decision.missionId);
    this.bus.emit('decision:resolved', outcome);
    return outcome;
  }

  isPostponed(missionId: string): boolean {
    return (this.postponedUntil.get(missionId) ?? -Infinity) > this.gameHours;
  }

  private applyEffects(effects: Partial<ResourceState>): void {
    this.resources.apply(effects);
    this.bus.emit('resources:changed', this.resources.snapshot);
  }

  private checkEnd(): void {
    if (this.missions.allResolved) this.end('Todas las misiones resueltas');
  }

  private end(reason: string): void {
    if (this.overReason) return;
    this.overReason = reason;
    this.bus.emit('session:over', { reason });
  }
}

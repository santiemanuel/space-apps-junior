import type { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { MissionDefinition, MissionState } from './types';

/** Ciclo de vida de las misiones. No conoce recursos ni motor: comunica todo por eventos. */
export class MissionSystem {
  private readonly missions = new Map<string, MissionState>();

  constructor(definitions: readonly MissionDefinition[], private readonly bus: EventBus<GameEvents>) {
    for (const definition of definitions) {
      if (this.missions.has(definition.id)) throw new Error(`Misión duplicada: ${definition.id}`);
      this.missions.set(definition.id, { definition, status: 'available', progress: 0 });
    }
  }

  get all(): readonly MissionState[] {
    return [...this.missions.values()];
  }

  get allResolved(): boolean {
    return this.all.every((m) => m.status === 'completed' || m.status === 'failed');
  }

  get(id: string): MissionState {
    const mission = this.missions.get(id);
    if (!mission) throw new Error(`Misión desconocida: ${id}`);
    return mission;
  }

  /** Misión pendiente (disponible o activa) asociada a una estación. */
  forStation(stationId: string): MissionState | undefined {
    return this.all.find(
      (m) => m.definition.stationId === stationId && (m.status === 'available' || m.status === 'active'),
    );
  }

  start(id: string): MissionState {
    const mission = this.get(id);
    if (mission.status !== 'available') throw new Error(`La misión ${id} no está disponible (${mission.status})`);
    mission.status = 'active';
    this.bus.emit('mission:started', mission);
    return mission;
  }

  /** Aplica `seconds` de trabajo a una misión activa. */
  work(id: string, seconds: number): MissionState {
    const mission = this.get(id);
    if (mission.status !== 'active') return mission;
    mission.progress = Math.min(1, mission.progress + seconds / mission.definition.workSeconds);
    this.bus.emit('mission:progress', mission);
    if (mission.progress >= 1) this.complete(id);
    return mission;
  }

  complete(id: string): void {
    const mission = this.get(id);
    mission.status = 'completed';
    mission.progress = 1;
    this.bus.emit('mission:completed', mission);
  }

  fail(id: string): void {
    const mission = this.get(id);
    mission.status = 'failed';
    this.bus.emit('mission:failed', mission);
  }
}

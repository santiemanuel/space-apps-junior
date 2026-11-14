import type Phaser from 'phaser';
import type { EnvironmentSnapshot } from '../core/environment/types';
import type { GameSession } from '../core/session/GameSession';
import type { ScienceFact } from '../data/curated';

/**
 * Dependencias que las escenas reciben por inyección (vía registry), nunca importándolas
 * directamente. Así cada escena puede montarse con dobles de prueba.
 */
export interface GameServices {
  loadEnvironment(): Promise<EnvironmentSnapshot>;
  createSession(environment: EnvironmentSnapshot): GameSession;
  /** Dato científico real (NASA OSDR) asociado a un tema de misión. */
  scienceFact(topic: string): ScienceFact | undefined;
}

const SERVICES_KEY = 'services';

export function registerServices(game: Phaser.Game, services: GameServices): void {
  game.registry.set(SERVICES_KEY, services);
}

export function getServices(scene: Phaser.Scene): GameServices {
  const services = scene.registry.get(SERVICES_KEY) as GameServices | undefined;
  if (!services) throw new Error('GameServices no registrados: llama a registerServices() antes de arrancar');
  return services;
}

/** Datos que reciben las escenas de juego al iniciarse. */
export interface SessionSceneData {
  session: GameSession;
}

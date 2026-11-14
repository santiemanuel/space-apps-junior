import type Phaser from 'phaser';
import { EventBus } from '../../core/events/EventBus';
import type { GameEvents } from '../../core/events/GameEvents';
import { makeGameState } from '../../test-utils/factories';
import { SceneKeys, type SceneKey } from '../sceneKeys';
import type { PhaseSceneData } from '../scenes/sceneData';
import { flowDevData } from './flowDev';
import { simulationDevData } from './simulationDev';

/** Arma los datos de una escena a partir del estado de prueba. `null`: la escena no se puede abrir sola. */
export type DevDataBuilder = ((base: PhaseSceneData, params: URLSearchParams) => object) | null;
export type DevDataBuilders = Partial<Record<SceneKey, DevDataBuilder>>;

const BUILDERS: DevDataBuilders = { ...flowDevData, ...simulationDevData };

/**
 * Sólo en `npm run dev`: `?scene=Voyage` (más parámetros propios, p. ej. `&leg=back`) abre la escena
 * directamente con `makeGameState()`. Archivo congelado; cada frente edita su `*Dev.ts`.
 */
export function launchDevScene(scene: Phaser.Scene, params: URLSearchParams): boolean {
  const key = params.get('scene') as SceneKey | null;
  const builder = key ? BUILDERS[key] : undefined;
  if (!key || key === SceneKeys.Boot || !Object.values(SceneKeys).includes(key) || builder === null) {
    console.warn(`[dev] ?scene=${key} no se puede abrir directamente`);
    return false;
  }
  const base: PhaseSceneData = { state: makeGameState(), bus: new EventBus<GameEvents>() };
  base.bus.on('phase:completed', (result) => console.info('[dev] phase:completed', result));
  scene.scene.start(key, builder ? builder(base, params) : base);
  return true;
}

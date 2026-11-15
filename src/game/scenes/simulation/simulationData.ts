import type Phaser from 'phaser';
import type { SimulationEvents } from '../../../core/habitat/events';
import type { EventBus } from '../../../core/events/EventBus';
import type { SceneKey } from '../../sceneKeys';
import type { PhaseSceneData } from '../sceneData';

/**
 * Lo que reciben las escenas superpuestas de la simulación (`Hud`, `Planning`, `MissionControl`, `DataPanel`):
 * los datos de fase más el bus propio de la simulación (`SimulationEvents`, dueño: Santiago).
 */
export interface SimulationSceneData extends PhaseSceneData {
  sim: EventBus<SimulationEvents>;
  /** Archivo de textos del lugar (`voyage` o `mars`) para los nombres de cuartos y tareas. */
  namespace: 'voyage' | 'mars';
}

/** Abre o cierra una escena superpuesta encima de la escena de mapa. Cerrar siempre se puede; abrir, sólo si `canOpen`. */
export function toggleOverlay(plugin: Phaser.Scenes.ScenePlugin, key: SceneKey, data: SimulationSceneData, canOpen = true): void {
  if (plugin.isActive(key)) plugin.stop(key);
  else if (canOpen) plugin.launch(key, data);
}

/** Opciones de vista del mapa para probar escalas (docs/plan-visual.md, Fase 0): `&zoom=1.5&layout=large`. */
export interface MapViewOptions {
  zoom?: number;
  largeLayout?: boolean;
  /** Fuerza los efectos del mapa para verlos: nivel de alerta y corte de energía (`&fx=impact,powerOut`). */
  fx?: { level?: 'alert' | 'impact'; powerOut?: boolean };
}

/** Datos de escena con las opciones de vista: los agrega `simulationDev.ts`. */
export interface MapViewData {
  view?: MapViewOptions;
}

import type Phaser from 'phaser';
import type { SimSnapshot, SimulationEvents } from '../../../core/habitat/events';
import type { MinigameId } from '../../../core/minigames/Minigame';
import type { EventBus } from '../../../core/events/EventBus';
import type { SceneKey } from '../../sceneKeys';
import type { PhaseSceneData } from '../sceneData';
import { getLocale, hasKey, t, type TranslationKey } from '../../../i18n';

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

/** Clave del registro con la línea de ayuda del mapa (lo que hace E acá), que el tablero dibuja fija abajo. */
export const MAP_HINT = 'map-hint';

type TaskTodo = Extract<SimSnapshot['todo'][number], { kind: 'task' }>;

/**
 * Motivo de una tarea pendiente ("el filtro de CO₂ se está saturando", "Brote se siente solo: llamá a casa"), de
 * `<lugar>.chore.<tarea>`; si la tarea no tiene motivo escrito, dice en qué cuarto es.
 */
export function taskReason(namespace: 'voyage' | 'mars', item: TaskTodo, names: Readonly<Record<string, string>>): string {
  const place = t(`${namespace}.zone.${item.zone}` as TranslationKey);
  const key = `${namespace}.chore.${item.taskId}`;
  return hasKey(key, getLocale()) ? t(key as TranslationKey, { name: item.crewId ? (names[item.crewId] ?? '') : '', place }) : t('hud.todo.task', { place });
}

/** Opciones de vista del mapa para probar (docs/plan-visual.md): `&zoom=2&at=gediz`. */
export interface MapViewOptions {
  zoom?: number;
  /** Dónde arranca el jugador en `Mars`: una franja del exterior (`plain`, `dunes`, `gediz`…) o `curiosity`. */
  at?: string;
  /** Fuerza los efectos del mapa para verlos: nivel de alerta, corte de energía y, en `Mars`, tormenta de polvo (`&fx=impact,powerOut,storm`). */
  fx?: { level?: 'alert' | 'impact'; powerOut?: boolean; storm?: boolean };
  /** Abre este minijuego al arrancar (`&minigame=patch`), en la zona donde esté el jugador. */
  minigame?: MinigameId;
}

/** Datos de escena con las opciones de vista: los agrega `simulationDev.ts`. */
export interface MapViewData {
  view?: MapViewOptions;
}

/** Clave del nombre de una ubicación: pasillos y tubos son todos "pasillo"; afuera, "afuera"; si no, el cuarto. */
export const locationKey = (namespace: 'voyage' | 'mars', location: string): string =>
  location === 'exterior' ? 'hud.zone.exterior' : location === 'corridor' || location.startsWith('tube-') ? 'hud.zone.corridor' : `${namespace}.zone.${location}`;

/**
 * Lo más grave de la red eléctrica de la base en Gale, para una línea del tablero (clave de texto), o null si todo
 * anda: sin energía, fusible quemado, sin paneles, batería desconectada o un cable cortado.
 */
export function gridWarningKey(s: SimSnapshot): string | null {
  const grid = s.mars?.grid;
  if (!grid) return null;
  if (s.power.blackout) return 'mars.panel.blackout';
  if (grid.fuseBlown) return 'mars.panel.gridFuse';
  if (!grid.solarLinked) return 'mars.panel.gridSolarOff';
  if (!grid.batteryLinked) return 'mars.panel.gridBatteryOff';
  if (grid.cutCables.length) return 'mars.panel.gridLoss';
  return null;
}

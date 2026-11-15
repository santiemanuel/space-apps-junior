import type { EventBus } from '../../../core/events/EventBus';
import type { GameEvents } from '../../../core/events/GameEvents';
import type { FlowStep } from '../../../core/flow/MissionFlow';
import type { GameState } from '../../../core/state/types';
import { SceneKeys, type SceneKey } from '../../sceneKeys';
import type { LoadoutSceneData, ManeuverSceneData, PhaseSceneData, ReportSceneData, VoyageSceneData } from '../sceneData';

export interface SceneStart {
  key: SceneKey;
  data: PhaseSceneData | LoadoutSceneData | ManeuverSceneData | VoyageSceneData | ReportSceneData;
}

/** Escena y datos de cada paso de `MissionFlow` (mapa de escenas del plan §4). */
export function sceneForStep(step: FlowStep, state: GameState, bus: EventBus<GameEvents>): SceneStart {
  const base: PhaseSceneData = { state, bus };
  switch (step.kind) {
    case 'loadout':
      return { key: SceneKeys.Loadout, data: { ...base, mode: step.mode } };
    case 'maneuver':
      return { key: SceneKeys.Maneuver, data: { ...base, maneuverId: step.maneuverId } };
    case 'voyage':
      return { key: SceneKeys.Voyage, data: { ...base, leg: step.leg } };
    case 'mars':
      return { key: SceneKeys.Mars, data: base };
    case 'report':
      return { key: SceneKeys.Report, data: { ...base, outcome: step.outcome } };
  }
}

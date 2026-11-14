import type { EventBus } from '../../core/events/EventBus';
import type { GameEvents } from '../../core/events/GameEvents';
import type { RealEvent } from '../../core/events/RealEvent';
import type { ManeuverId } from '../../core/flow/types';
import type { GameState } from '../../core/state/types';

/**
 * Datos que recibe cada escena nueva en `scene.start(key, data)`. Las escenas se comunican por `bus`,
 * nunca llamándose entre sí. Contrato de la Etapa 0 (docs/plan-de-trabajo.md §3.3).
 */
export interface PhaseSceneData {
  state: GameState;
  bus: EventBus<GameEvents>;
}

export interface LoadoutSceneData extends PhaseSceneData {
  mode: 'outbound' | 'return';
}

export interface ManeuverSceneData extends PhaseSceneData {
  maneuverId: ManeuverId;
}

export interface VoyageSceneData extends PhaseSceneData {
  leg: 'out' | 'back';
}

export interface ReportSceneData extends PhaseSceneData {
  outcome: 'completed' | 'suspended';
}

export interface DataCardSceneData {
  event: RealEvent;
  bus: EventBus<GameEvents>;
}

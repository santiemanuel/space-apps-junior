import type { Decision, DecisionOutcome } from '../decisions/DecisionEngine';
import type { EnvironmentSnapshot } from '../environment/types';
import type { MissionState } from '../missions/types';
import type { ResourceKey, ResourceState } from '../resources/ResourceModel';

export interface GameEvents {
  'clock:tick': { gameHours: number };
  'resources:changed': ResourceState;
  'resources:depleted': { resource: ResourceKey };
  'environment:changed': EnvironmentSnapshot;
  'mission:started': MissionState;
  'mission:progress': MissionState;
  'mission:completed': MissionState;
  'mission:failed': MissionState;
  'decision:required': Decision;
  'decision:resolved': DecisionOutcome;
  'session:over': { reason: string };
}

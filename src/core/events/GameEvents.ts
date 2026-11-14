import type { CrewId, CrewMemberState } from '../crew/types';
import type { Decision, DecisionOutcome } from '../decisions/DecisionEngine';
import type { EnvironmentSnapshot } from '../environment/types';
import type { ManeuverId, PhaseId, PhaseResult } from '../flow/types';
import type { CascadeEmergency, CascadeSacrifice, IncidentState } from '../incidents/types';
import type { AlertLevel, MeterState } from '../meters/types';
import type { MissionState } from '../missions/types';
import type { ResourceKey, ResourceState } from '../resources/ResourceModel';
import type { RealEvent } from './RealEvent';

/**
 * Catálogo de eventos del bus. Contrato compartido entre los dos frentes de trabajo:
 * no renombrar ni cambiar payloads sin acordarlo (ver docs/plan-de-trabajo.md §3.2).
 */
export interface GameEvents {
  // Prototipo actual (base lunar). Se retiran en la integración.
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

  // Flujo de misión (Facundo emite phase:started; ambos emiten phase:completed).
  'phase:started': { phase: PhaseId };
  'phase:completed': PhaseResult;

  // Simulación (Santiago).
  'clock:day': { simDate: string };
  'alert:level': { level: AlertLevel; reasonKey: string };
  'meters:changed': MeterState;
  'crew:changed': CrewMemberState[];
  'incident:warned': IncidentState;
  'incident:started': IncidentState;
  'incident:resolved': IncidentState;
  'cascade:entered': CascadeEmergency;
  'cascade:sacrifice': CascadeSacrifice;
  'cascade:noReturn': { reasonKey: string };
  'realEvent:shown': RealEvent;

  // Entrada, maniobras y guardado (Facundo).
  'crew:switched': { crewId: CrewId };
  'maneuver:stage': { maneuverId: ManeuverId; stage: string; hit: boolean };
  'save:requested': { reason: 'manual' | 'phaseChange' };
  'save:completed': { savedAt: string };
}

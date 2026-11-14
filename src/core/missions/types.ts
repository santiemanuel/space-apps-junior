import type { ResourceState } from '../resources/ResourceModel';

export type MissionType = 'eva' | 'repair' | 'science' | 'logistics';
export type MissionStatus = 'available' | 'active' | 'completed' | 'failed';

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  /** Estación del mapa donde se ejecuta la tarea. */
  stationId: string;
  /** Segundos de trabajo en la estación para completarla. */
  workSeconds: number;
  /** Sensibilidad de la misión a cada amenaza del clima espacial (0..1). */
  exposure: { radiation: number; comms: number };
  reward: Partial<ResourceState>;
  failurePenalty: Partial<ResourceState>;
  /** Tema científico (OSDR) que se muestra al resolver la misión. */
  learnTopic?: string;
}

export interface MissionState {
  definition: MissionDefinition;
  status: MissionStatus;
  /** 0..1 */
  progress: number;
}

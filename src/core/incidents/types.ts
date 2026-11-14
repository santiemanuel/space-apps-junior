import type { PhaseId } from '../flow/types';

/** Instancia de un incidente activo (game-design §3.4). La definición completa vive en content/. */
export interface IncidentState {
  /** Id de la instancia (único en la partida). */
  id: string;
  /** Id de la definición en content/ (p. ej. 'radiationStorm'). */
  definitionId: string;
  phase: PhaseId;
  status: 'warned' | 'active' | 'resolved';
  /** Fecha simulada del impacto (ISO 8601). */
  impactAt: string;
  /** `RealEvent.id` que lo disparó, si viene de un dataset. */
  realEventId?: string;
  /** Fecha del aviso (ISO 8601). */
  warnAt?: string;
  /** Fin previsto (ISO 8601) de los incidentes que terminan solos (tormentas, noches, conjunción). */
  endAt?: string;
  /** Respuesta elegida por el jugador (id de la definición). */
  responseId?: string;
  /** Avance del trabajo de la respuesta, 0..1 (reparaciones). */
  progress?: number;
}

/** Medidor que entró en modo de emergencia (§3.5). */
export type CascadeMeter = 'energy' | 'lifeSupport' | 'health' | 'food';

export interface CascadeEmergency {
  meter: CascadeMeter;
  /** Tripulante afectado cuando el medidor es la salud. */
  crewId?: string;
  /** Horas de margen antes de que el modo de emergencia empeore. */
  marginHours: number;
}

export interface CascadeSacrifice {
  /** Id del sacrificio (p. ej. 'drinkWaterShield', 'cleanPanels'). */
  id: string;
  meter: CascadeMeter;
}

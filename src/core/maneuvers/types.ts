import type { ManeuverId } from '../flow/types';
import type { SystemId, SystemStatus } from '../systems/types';

/** Una etapa con acción en el momento justo: una barra y una zona de acierto (game-design §4.0). */
export interface StageDefinition {
  id: string;
  /** Ancho de la zona de acierto, como fracción de la barra (0..1). */
  zoneWidth: number;
  /** Barras recorridas por segundo por la marca (ida o vuelta). */
  speed: number;
  /** Sistemas que, en amarillo o rojo, achican la zona de esta etapa. */
  systems: SystemId[];
}

/** Qué cambia en la partida según la precisión, además del combustible por errores. */
export type ManeuverEffect = 'vanAllen' | 'landingDistance' | 'returnFuel' | 'crewArrival';

export interface ManeuverDefinition {
  id: ManeuverId;
  /** Estaciones a confirmar en el checklist Go / No-Go. */
  checklist: SystemId[];
  stages: StageDefinition[];
  effect: ManeuverEffect;
}

/** Reglas comunes de las maniobras [regla]: se ajustan con pruebas de juego. */
export interface ManeuverRules {
  /** Cuánto se achica la zona según el peor estado de los sistemas de la etapa. */
  zoneFactor: Record<SystemStatus, number>;
  /** Repuestos para dejar en verde un sistema antes de la maniobra. */
  repairSpares: Record<Exclude<SystemStatus, 'green'>, number>;
  /** Combustible (0..1) que cuesta cada error. */
  fuelPerMiss: number;
  /** La zona nunca toca los bordes de la barra. */
  zoneMargin: number;
  /** Distancia a la base al aterrizar, con precisión perfecta y con la peor. */
  landingDistanceKm: { best: number; worst: number };
  /** Combustible que queda para correcciones en la vuelta según la precisión del despegue de Marte. */
  returnFuel: { worst: number; best: number };
  /** Condición física mínima para salir caminando de la cápsula (§4.7). */
  walkCondition: number;
}

/** Dificultad del día (carga, combustible, polvo): multiplica la velocidad de la marca. */
export interface ManeuverConditions {
  speedFactor: number;
}

export type ChecklistDecision = 'go' | 'repair' | 'risk';

export interface ChecklistItem {
  systemId: SystemId;
  status: SystemStatus;
  decision: ChecklistDecision | null;
}

export interface StageOutcome {
  stageId: string;
  hit: boolean;
  /** 0 si falló; entre 0,5 (borde de la zona) y 1 (centro) si acertó. */
  precision: number;
}

export type CrewArrival = 'walk' | 'stretcher';

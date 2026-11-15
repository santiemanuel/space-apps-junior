import type { CascadeState } from '../cascade/types';
import type { CrewId, CrewMemberState } from '../crew/types';
import type { GameMode, LoadoutProfile, MissionLength, PhaseId, UnlockLevel } from '../flow/types';
import type { IncidentPlannerState } from '../incidents/planner';
import type { IncidentState } from '../incidents/types';
import type { MeterState } from '../meters/types';
import type { SystemId, SystemStatus } from '../systems/types';

export const GAME_STATE_VERSION = 1;

/** Muestra de Marte: cuenta al volver a la Tierra y pesa en el despegue (§4.4, §4.5). */
export interface Sample {
  id: string;
  siteId: string;
  massKg: number;
  /** Valor científico (más lejos → más valor). */
  value: number;
}

export interface Inventory {
  foodKg: number;
  /** Repuestos (unidades) para reparar sistemas. */
  spares: number;
  samples: Sample[];
}

/** Entrada del historial que alimenta el informe final (§5). */
export interface MissionLogEntry {
  simDate: string;
  phase: PhaseId;
  kind: 'decision' | 'incident' | 'maneuver' | 'realEvent' | 'cascade' | 'loadout';
  /** Id o clave de traducción de lo que pasó. */
  key: string;
  data?: Record<string, number | string | boolean>;
}

/** Lo que la simulación de `Voyage`/`Mars` necesita para retomar a mitad de fase (guardado manual, §3.9). */
export interface HabitatSave {
  planner: IncidentPlannerState;
  cascade: CascadeState;
}

/**
 * Estado completo y serializable de una partida (JSON puro): es lo que se guarda (§3.9) y lo que
 * pasa de una fase a la siguiente.
 */
export interface GameState {
  version: typeof GAME_STATE_VERSION;
  seed: number;
  /** Estado interno del `Rng` para que la partida siga siendo reproducible al cargar. */
  rngState: number;
  mode: GameMode;
  length: MissionLength;
  helpMode: boolean;
  unlockLevel: UnlockLevel;
  phase: PhaseId;
  /** Fecha simulada (ISO 8601). Los datos reales se consultan con esta fecha. */
  simDate: string;
  meters: MeterState;
  crew: CrewMemberState[];
  /** Tripulante que controla el jugador (cambia con Tab). */
  activeCrewId: CrewId;
  systems: Record<SystemId, SystemStatus>;
  inventory: Inventory;
  /** Llenado del escudo de agua del refugio, 0..1 (§3.2: f_blindaje de 0,2 lleno a 0,6 vacío). */
  waterShield: number;
  /** Combustible para correcciones, 0..1. */
  fuel: number;
  loadout: LoadoutProfile | null;
  /** Distancia del aterrizaje a la base (km); null antes de aterrizar (§4.3). */
  landingDistanceKm: number | null;
  activeIncidents: IncidentState[];
  history: MissionLogEntry[];
  /** Ids de logros conseguidos en esta partida (§5); se juntan de cada `PhaseResult`. */
  achievements?: string[];
  /** Sólo en una partida guardada a mitad de `Voyage`/`Mars`: incidentes ya disparados y falla en cascada. */
  habitat?: HabitatSave;
}

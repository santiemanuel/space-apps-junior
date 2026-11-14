/** Roles de la tripulación (game-design §3.3). */
export type CrewRole = 'commander' | 'engineer' | 'botanist' | 'geoMedic';

/** Vega (comandante), Miga (ingeniera), Brote (botánico), Senda (geóloga-médica). */
export type CrewId = 'vega' | 'miga' | 'brote' | 'senda';

/**
 * Estado de un tripulante. Todos los factores están en 0..1 salvo la dosis.
 * La eficiencia no se guarda: se calcula a partir de estos valores (§3.3).
 */
export interface CrewMemberState {
  id: CrewId;
  role: CrewRole;
  /** 0 descansado … 1 agotado. */
  fatigue: number;
  /** Condición física: 1 en forma … 0 muy debilitado. */
  condition: number;
  /** Ánimo: 1 alto … 0 muy bajo. */
  morale: number;
  /** Nutrición: 1 raciones completas … 0 sin comer. */
  nutrition: number;
  /** Dosis acumulada en la misión (mSv). */
  doseMSv: number;
  /** Zona del mapa donde está (id libre definido por cada escena: 'shelter', 'airlock'…). */
  location: string;
  /** Tarea en curso o null si está libre. */
  taskId: string | null;
  /** En reposo en la enfermería: no trabaja (§3.5). */
  resting: boolean;
  /** Clave de traducción que explica por qué rinde menos ("durmió poco"), si aplica. */
  slowReasonKey?: string;
}

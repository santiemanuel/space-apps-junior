import type { CrewId } from '../crew/types';
import type { CascadeEmergency, CascadeMeter } from '../incidents/types';

/** Modo de emergencia en curso (§3.5). `marginHours` es lo que queda antes de que se agote el margen. */
export interface ActiveEmergency extends CascadeEmergency {
  enteredAt: string;
  /** Se agotó el margen: los efectos empeoran y cuenta para el punto de no retorno. */
  overdue: boolean;
}

/** Sacrificios activos que siguen teniendo efecto hasta que el jugador los revierte. */
export interface CascadeFlags {
  moxieOff: boolean;
  shelterUnpowered: boolean;
  recyclerBoost: boolean;
  moxieBoost: boolean;
  greenhousePriority: boolean;
  reduceRoutines: boolean;
  /** Paciente al que atiende la geóloga-médica. */
  medicCaring: CrewId | null;
  /** Fecha hasta la que los paneles quedan limpios tras una EVA de limpieza. */
  panelsCleanUntil: string | null;
}

/**
 * Estado de la falla en cascada: JSON puro para guardarlo. Hasta la integración viaja junto al `GameState`
 * (no está dentro para no tocar los contratos congelados de la Etapa 0).
 */
export interface CascadeState {
  emergencies: ActiveEmergency[];
  flags: CascadeFlags;
  /** Clave del motivo si se llegó al punto de no retorno (misión suspendida, tripulación a salvo). */
  noReturnReasonKey: string | null;
}

export type CascadeEvent =
  | { type: 'entered'; emergency: CascadeEmergency }
  | { type: 'exited'; meter: CascadeMeter; crewId?: CrewId }
  | { type: 'overdue'; meter: CascadeMeter; crewId?: CrewId }
  | { type: 'noReturn'; reasonKey: string };

export const initialCascade = (): CascadeState => ({
  emergencies: [],
  flags: {
    moxieOff: false,
    shelterUnpowered: false,
    recyclerBoost: false,
    moxieBoost: false,
    greenhousePriority: false,
    reduceRoutines: false,
    medicCaring: null,
    panelsCleanUntil: null,
  },
  noReturnReasonKey: null,
});

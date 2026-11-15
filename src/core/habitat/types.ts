import type { CascadeRules } from '../cascade/rules';
import type { PhaseCalendar } from '../clock/schedule';
import type { TaskCategory } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { RoutinePlan } from '../crew/routines';
import type { ActivityCounter, IncidentDefinition, IncidentRules } from '../incidents/definitions';
import type { MeterRules } from '../meters/rules';
import type { SystemId } from '../systems/types';
import type { ShipLayout } from './layout';

/**
 * Tarea de un cuarto (§4.2, §4.4): ejercicio, llamada a casa o mantenimiento de un sistema. El mantenimiento
 * vuelve el sistema de amarillo a verde y, si corresponde, reinicia un contador del planificador de incidentes.
 */
export interface HabitatTask {
  id: string;
  zone: string;
  kind: 'exercise' | 'callHome' | 'maintenance';
  /** Categoría para la especialidad ×1,5 (§3.3). */
  category: TaskCategory;
  system?: SystemId;
  resets?: ActivityCounter;
}

/** Desgaste de los sistemas y ritmo de las tareas [regla]. */
export interface WearRules {
  /** Sistemas que se gastan sin mantenimiento. */
  systems: readonly SystemId[];
  /** Horas sin mantenimiento hasta que un sistema sano pasa a amarillo. */
  hoursToYellow: number;
  /** Horas de trabajo (a velocidad 1) que lleva un mantenimiento. */
  maintenanceHours: number;
  /** Horas de radio que dura una llamada a casa. */
  callHours: number;
}

/** Paneles a 1 UA y consumo de cada sistema encendido (§3.2). */
export interface HabitatPower {
  panelKwAt1Au: number;
  loadsKw: Record<string, number>;
  /** Lo que queda encendido en el modo de emergencia de energía (§3.5). */
  essentialLoads: readonly string[];
}

/** Contenido común de la nave y de la base; se inyecta para probar las sesiones con dobles. */
export interface HabitatContent {
  calendar: PhaseCalendar;
  layout: ShipLayout;
  tasks: readonly HabitatTask[];
  /** Cuarto donde se trabaja cada categoría de incidente, si no es el de la tarea de esa categoría. */
  workZones?: Partial<Record<TaskCategory, string>>;
  /** Rutinas por defecto hasta que exista la planificación (S9). `taskId` es el id de una `HabitatTask`. */
  routines: RoutinePlan;
  /** Hora del día (UTC) en la que empieza la rutina de cada uno, para que no estén todos juntos. */
  routineOffsetHours: Record<CrewId, number>;
  wear: WearRules;
  power: HabitatPower;
  /** Velocidad de caminata con eficiencia 1 (tiles por segundo real). */
  crewSpeedTilesPerS: number;
  /** Zona de las camas: ahí se duerme y ahí reposa quien entra en la emergencia de salud (§3.5). */
  infirmaryZone: string;
  /** Refugio de agua (§3.2). */
  shelterZone: string;
  meterRules: MeterRules;
  cascadeRules: CascadeRules;
  incidents: readonly IncidentDefinition[];
  incidentRules: IncidentRules;
}

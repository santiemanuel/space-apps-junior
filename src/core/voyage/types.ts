import type { CascadeRules } from '../cascade/rules';
import type { PhaseCalendar } from '../clock/schedule';
import type { TaskCategory } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { RoutinePlan } from '../crew/routines';
import type { IncidentDefinition, IncidentRules } from '../incidents/definitions';
import type { MeterRules } from '../meters/rules';
import type { ShipLayout } from './ship';

/** Ida o vuelta: el mismo mapa con la nave gastada en la vuelta (§4.6). */
export type VoyageLeg = 'out' | 'back';

/** Sistemas que se gastan sin mantenimiento en el viaje (§4.2). */
export type MaintainedSystem = 'scrubber' | 'waterRecycler';

/** Tareas de la nave (§4.2). La corrección de trayectoria queda para el nivel 3. */
export type VoyageTaskId = 'exercise' | 'scrubber' | 'recycler' | 'callHome';

export interface VoyageTask {
  id: VoyageTaskId;
  /** Cuarto donde se hace. */
  zone: string;
  /** Categoría para la especialidad ×1,5 (§3.3). */
  category: TaskCategory;
  /** Sistema que mantiene, si es una tarea de mantenimiento. */
  system?: MaintainedSystem;
}

/** Desgaste de la nave y ritmo de las tareas [regla]. */
export interface ShipWearRules {
  /** Horas sin mantenimiento hasta que un sistema sano pasa a amarillo. */
  hoursToYellow: number;
  /** Horas de trabajo (a velocidad 1) que lleva un mantenimiento. */
  maintenanceHours: number;
  /** La nave gastada se desgasta más rápido en la vuelta (§4.6). */
  backWearMultiplier: number;
  /** El ejercicio de la vuelta cuenta doble para llegar en forma a 1 g (§4.6). */
  backExerciseMultiplier: number;
  /** Horas de radio que dura una llamada a casa. */
  callHours: number;
}

/** Energía de la nave: paneles a 1 UA y consumo de cada sistema encendido (§3.2). */
export interface ShipPower {
  panelKwAt1Au: number;
  loadsKw: Record<string, number>;
  /** Consumo que queda en el modo de emergencia de energía (§3.5). */
  essentialLoad: string;
}

/** Todo lo que la escena `Voyage` necesita del contenido; se inyecta para probarla con dobles. */
export interface VoyageContent {
  calendar: PhaseCalendar;
  ship: ShipLayout;
  tasks: readonly VoyageTask[];
  /** Rutinas por defecto hasta que exista la planificación (S9). `taskId` es un `VoyageTaskId`. */
  routines: RoutinePlan;
  /** Hora del día (UTC) en la que empieza la rutina de cada uno, para que no estén todos juntos. */
  routineOffsetHours: Record<CrewId, number>;
  wear: ShipWearRules;
  power: ShipPower;
  /** Velocidad de caminata con eficiencia 1 (tiles por segundo real). */
  crewSpeedTilesPerS: number;
  /** Zona para quien está en reposo (§3.5). */
  infirmaryZone: string;
  /** Refugio de agua (§3.2). */
  shelterZone: string;
  meterRules: MeterRules;
  cascadeRules: CascadeRules;
  incidents: readonly IncidentDefinition[];
  incidentRules: IncidentRules;
}

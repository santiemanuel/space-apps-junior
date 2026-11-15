import type { CascadeRules } from '../cascade/rules';
import type { PhaseCalendar } from '../clock/schedule';
import type { TaskCategory } from '../crew/efficiency';
import type { CrewId } from '../crew/types';
import type { RoutinePlan } from '../crew/routines';
import type { ActivityCounter, IncidentDefinition, IncidentRules } from '../incidents/definitions';
import type { MeterRules } from '../meters/rules';
import type { MinigameId } from '../minigames/Minigame';
import type { SystemId } from '../systems/types';
import type { Point, ShipLayout } from './layout';

/**
 * Tarea de un cuarto (§4.2, §4.4): ejercicio, llamada a casa, mantenimiento de un sistema o un cuidado del día. El
 * mantenimiento vuelve el sistema de amarillo a verde y, si corresponde, reinicia un contador del planificador de
 * incidentes. El jugador la hace con un minijuego (E); los automáticos, con su rutina.
 */
export interface HabitatTask {
  id: string;
  zone: string;
  /** `care`: algo que el jugador hace una vez por día en un cuarto sin máquina (cocinar, el chequeo médico…). */
  kind: 'exercise' | 'callHome' | 'maintenance' | 'care';
  /** Categoría para la especialidad ×1,5 (§3.3). */
  category: TaskCategory;
  system?: SystemId;
  resets?: ActivityCounter;
  /** Minijuego que abre E en este cuarto. */
  minigame?: MinigameId;
  /** Mantenimiento que además se puede hacer una vez por día aunque el sistema esté sano (la cosecha del invernadero). */
  daily?: boolean;
  /** Minijuego de esa tarea diaria con el sistema sano (si falta, el mismo de siempre). */
  dailyMinigame?: MinigameId;
  /** Lo que suma a toda la tripulación un cuidado del día [regla]. */
  care?: CareReward;
  /**
   * Cocina (minijuego `meal`): dónde se lee el recetario (tiles). El menú del día y la mesada están junto al lugar
   * de trabajo del cuarto (`spot`).
   */
  recipeAt?: Point;
}

/** Cuánto sube el ánimo o la condición física de cada tripulante (0..1). */
export interface CareReward {
  morale?: number;
  condition?: number;
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
  /** Batería del lugar (kWh): al llegar a un lugar con otra batería, se usa la suya, cargada. */
  capacityKwh: number;
  loadsKw: Record<string, number>;
  /** Lo que queda encendido en el modo de emergencia de energía (§3.5). */
  essentialLoads: readonly string[];
  /** Potencia que representa cada enchufe del tablero (kW) [regla]: con menos luz hay menos enchufes (§3.2). */
  socketKw: number;
  /** Sala del tablero: desenchufar sistemas sólo se puede estando ahí (en Marte, la de energía). Sin sala, desde cualquier lado. */
  panelZone?: string;
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
  /** Control de Misión (§3.7) [regla]: consola, energía del diagnóstico y cuánto acelera la reparación. */
  missionControl: { consoleZone: string; diagnosisKwh: number; diagnosisBoost: number };
  meterRules: MeterRules;
  cascadeRules: CascadeRules;
  incidents: readonly IncidentDefinition[];
  incidentRules: IncidentRules;
  /**
   * Embarque al terminar el tiempo de la fase: hay que llevar la carga del depósito (`cargoZone`) a la nave
   * (`shipZone`) y que toda la tripulación suba. Sin esto, la fase termina con el tiempo.
   */
  departure?: { shipZone: string; cargoZone: string };
}

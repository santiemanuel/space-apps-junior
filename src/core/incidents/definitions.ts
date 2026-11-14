import type { TimedPhase } from '../clock/schedule';
import type { TaskCategory } from '../crew/efficiency';
import type { UnlockLevel } from '../flow/types';
import type { SystemId, SystemStatus } from '../systems/types';

/** Los 10 incidentes del diseño (§4.2, §4.4). */
export type IncidentId =
  | 'radiationStorm'
  | 'dustStorm'
  | 'scrubberFailure'
  | 'micrometeoroid'
  | 'isolation'
  | 'extremeNight'
  | 'highCo2'
  | 'greenhousePest'
  | 'sealDust'
  | 'solarConjunction';

/** Series reales de las que sale la línea de tiempo (§3.4, fuente 1). */
export type TimelineKind = 'deepSpaceStorm' | 'marsRadiation' | 'marsDust' | 'marsCold' | 'solarConjunction';

/** Contadores que lleva el planificador a partir de lo que hace la tripulación. */
export type ActivityCounter = 'hoursSinceCallHome' | 'evaHoursSinceMaintenance' | 'hoursSinceGreenhouseCare';

/** Variables con rango seguro (§3.4, fuente 2): el CO2 del medidor o un contador de actividad. */
export type SafeRangeVariable = 'co2MmHg' | ActivityCounter;

/** Disparador: `disparador` del formato de §3.4. */
export type IncidentTrigger =
  | { kind: 'timeline'; timeline: TimelineKind }
  | { kind: 'safeRange'; variable: SafeRangeVariable; max: number }
  /** Falla con semilla: una tirada por día simulado. `wear`: más probable con la nave gastada (§4.6). */
  | { kind: 'random'; chancePerDay: number; wear?: boolean };

/** Lo que hace el incidente mientras está en impacto (`efecto`). La dosis, el polvo y el frío salen de las series. */
export interface IncidentEffect {
  /** Sistemas que pasan a este estado al empezar; la respuesta los repara. */
  systems?: Partial<Record<SystemId, SystemStatus>>;
  oxygenLeakKgPerHour?: number;
  moraleLossPerDay?: number;
  foodLossKgPerDay?: number;
  /** Sin Control de Misión: sólo mensajes guardados (§3.7). */
  missionControlOff?: boolean;
  /** Hay que repartir la energía (tormenta de polvo, §4.4). */
  energySplit?: boolean;
}

/** Lo que una respuesta cambia mientras siga el incidente (la escena y los medidores lo leen). */
export interface ResponseModifiers {
  /** Todos al refugio de agua. */
  shelter?: boolean;
  evaBlocked?: boolean;
  sciencePaused?: boolean;
  /** Escala de la calefacción (1 = normal). */
  heatingFactor?: number;
  greenhouseOff?: boolean;
  energyPriority?: 'heat' | 'air' | 'science';
}

/** Coste que se paga al elegir (`coste_de_cada_respuesta`). Ninguna respuesta es gratis (§3.6). */
export interface IncidentCost {
  energyKwh?: number;
  spares?: number;
  foodKg?: number;
  oxygenKg?: number;
  /** Se suma a toda la tripulación que no reposa. */
  fatigue?: number;
  /** Se resta a toda la tripulación. */
  morale?: number;
}

/** Semáforo de §3.6: se muestra en cada opción, sin porcentajes. */
export type RiskLight = 'green' | 'yellow' | 'red';

/**
 * Respuesta del jugador (`respuesta_del_jugador`). Textos: `incidents.<id>.response.<respuesta>.title` y `.cost`.
 * Con `work`, alguien tiene que trabajar esas horas (la especialidad las acorta ×1,5, §3.3).
 */
export interface IncidentResponse {
  id: string;
  risk: RiskLight;
  cost: IncidentCost;
  work?: { task: TaskCategory; hours: number };
  /** Sistemas que vuelven a verde al completar la respuesta. */
  repairs?: readonly SystemId[];
  /** Contador que vuelve a cero al completarla (p. ej. la llamada a casa). */
  resets?: ActivityCounter;
  /** Terminar la respuesta resuelve el incidente. */
  resolves: boolean;
  while?: ResponseModifiers;
}

/** Cómo termina: por tiempo (dato real), por una respuesta o al volver al rango seguro. */
export type IncidentEnd = 'time' | 'response' | 'inRange';

/** `fuente`: dataset con fecha, norma o regla del juego. */
export interface IncidentSource {
  kind: 'dataset' | 'standard' | 'rule';
  ref: string;
}

/** Formato único de §3.4: de aquí salen los datos, los textos traducibles y los tests. */
export interface IncidentDefinition {
  id: IncidentId;
  phases: readonly TimedPhase[];
  unlockLevel: UnlockLevel;
  triggers: readonly IncidentTrigger[];
  /** `aviso_previo` en horas simuladas. En la línea de tiempo manda la antelación real si la hay. */
  warningHours: number;
  end: IncidentEnd;
  effect: IncidentEffect;
  responses: readonly IncidentResponse[];
  source: IncidentSource;
  /** `clave_texto_niños`: base de `.title`, `.alert`, `.impact` y `.explanation`. */
  textKey: string;
}

/** Parámetros del planificador [regla]: se ajustan con pruebas con niños (§10). */
export interface IncidentRules {
  /** Multiplica las fallas por desgaste en el viaje de vuelta (§4.6). */
  wearMultiplierBack: number;
  /** Tras resolverse, un incidente dinámico no vuelve a aparecer en estas horas. */
  retriggerCooldownHours: number;
  /** El aviso de un incidente abierto deja de frenar el reloj tras estas horas de impacto. */
  brakeHours: number;
  /** Tope de BioSentinel (§3.2.1). */
  stormCapUGyH: number;
  /** Tormenta en Marte: media diaria de RAD por encima de `factor` × la mediana de los días previos. */
  marsStorm: { factor: number; baselineDays: number };
  /** Noche extrema: mínima `dropC` por debajo de la mediana de los soles previos, o por debajo de `belowC`. */
  coldNight: { dropC: number; windowSols: number; belowC: number };
}

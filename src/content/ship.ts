import type { CrewId } from '../core/crew/types';
import { DEFAULT_ROUTINE, type RoutinePlan } from '../core/crew/routines';
import type { ShipLayout } from '../core/habitat/layout';
import type { HabitatTask } from '../core/habitat/types';
import type { VoyageContent } from '../core/voyage/types';
import { CAMPAIGN_2024 } from './campaign';
import { CASCADE_RULES } from './cascade';
import { INCIDENT_RULES, INCIDENTS } from './incidents';
import shipMap from './maps/ship.json';
import { METER_RULES, SHIP_POWER } from './meters';
import { layoutFromTiled, type TiledMap } from './tiledLayout';

/**
 * Plano de la nave (game-design §4.2): sale del mapa de Tiled `maps/ship.json` (41 × 20 tiles de 48 px, cuartos de
 * 9 × 6 a los dos lados de un pasillo; la cámara sigue al jugador). Ids de zona = `CrewMemberState.location`
 * ('shelter' e 'infirmary' son los que usan los medidores y la cascada). Nombres en `voyage.zone.<id>`.
 */
export const SHIP_MAP: TiledMap = shipMap;
export const SHIP_LAYOUT: ShipLayout = layoutFromTiled(SHIP_MAP);

/** Tareas del viaje (§4.2). Textos en `voyage.task.<id>`. */
export const VOYAGE_TASKS: readonly HabitatTask[] = [
  { id: 'exercise', zone: 'exercise', kind: 'exercise', category: 'exercise' },
  { id: 'scrubber', zone: 'scrubber', kind: 'maintenance', category: 'scrubber', system: 'scrubber' },
  { id: 'recycler', zone: 'recycler', kind: 'maintenance', category: 'water', system: 'waterRecycler' },
  { id: 'callHome', zone: 'radio', kind: 'callHome', category: 'comms' },
];

/**
 * Rutinas por defecto hasta que exista la planificación (S9): cada especialista mantiene lo suyo y la
 * comandante queda libre para el jugador [regla].
 */
export const VOYAGE_ROUTINES: RoutinePlan = {
  vega: DEFAULT_ROUTINE,
  miga: { ...DEFAULT_ROUTINE, taskId: 'scrubber' },
  brote: { ...DEFAULT_ROUTINE, taskId: 'recycler' },
  senda: DEFAULT_ROUTINE,
};

export const ROUTINE_OFFSET_HOURS: Record<CrewId, number> = { vega: 0, miga: 2, brote: 4, senda: 6 };

export const VOYAGE_CONTENT: VoyageContent = {
  calendar: CAMPAIGN_2024,
  layout: SHIP_LAYOUT,
  tasks: VOYAGE_TASKS,
  routines: VOYAGE_ROUTINES,
  routineOffsetHours: ROUTINE_OFFSET_HOURS,
  // [regla] Sin nadie que lo cuide, un sistema se gasta en 4 días (2 en la vuelta).
  wear: { systems: ['scrubber', 'waterRecycler'], hoursToYellow: 96, maintenanceHours: 2, callHours: 1 },
  back: { wearMultiplier: 2, exerciseMultiplier: 2 },
  power: { panelKwAt1Au: SHIP_POWER.panelKwAt1Au, capacityKwh: SHIP_POWER.capacityKwh, loadsKw: SHIP_POWER.loadsKw, essentialLoads: ['lifeSupport'], socketKw: 2 },
  // Algo más rápido que el jugador (210 px/s ≈ 4,4 tiles/s) [regla]: la nave mide 41 tiles de largo.
  crewSpeedTilesPerS: 4.5,
  infirmaryZone: 'infirmary',
  shelterZone: 'shelter',
  // El comandante pide desde la radio; el diagnóstico acelera ×1,5 (game-design §3.7).
  missionControl: { consoleZone: 'radio', diagnosisKwh: 0.5, diagnosisBoost: 1.5 },
  meterRules: METER_RULES,
  cascadeRules: CASCADE_RULES,
  incidents: INCIDENTS,
  incidentRules: INCIDENT_RULES,
};

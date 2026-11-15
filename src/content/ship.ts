import type { CrewId } from '../core/crew/types';
import { DEFAULT_ROUTINE, type RoutinePlan } from '../core/crew/routines';
import type { ShipLayout, ShipZone } from '../core/voyage/ship';
import type { VoyageContent, VoyageTask } from '../core/voyage/types';
import { CAMPAIGN_2024 } from './campaign';
import { CASCADE_RULES } from './cascade';
import { INCIDENT_RULES, INCIDENTS } from './incidents';
import { METER_RULES, SHIP_POWER } from './meters';

/** Cuartos de 4 tiles de alto arriba y abajo del pasillo; la puerta queda en la pared, en el medio del cuarto. */
const room = (id: string, col: number, cols: number, top: boolean): ShipZone => ({
  id,
  rect: { col, row: top ? 1 : 10, cols, rows: 4 },
  door: { col: col + Math.floor(cols / 2), row: top ? 5 : 9 },
});

/**
 * Plano de la nave (game-design §4.2; referencia visual `docs/ref-nave.png`): 19 × 15 tiles de 48 px, el resto
 * de la pantalla queda para el tablero. Ids de zona = `CrewMemberState.location` ('shelter' e 'infirmary' son
 * los que usan los medidores y la cascada). Nombres en `voyage.zone.<id>`.
 */
export const SHIP_LAYOUT: ShipLayout = {
  cols: 19,
  rows: 15,
  corridor: { col: 1, row: 6, cols: 17, rows: 3 },
  zones: [
    room('command', 1, 4, true),
    room('exercise', 6, 3, true),
    room('scrubber', 10, 3, true),
    room('recycler', 14, 4, true),
    room('infirmary', 1, 4, false),
    room('pantry', 6, 3, false),
    room('shelter', 10, 3, false),
    room('radio', 14, 4, false),
  ],
  spawnZone: 'command',
};

/** Tareas del viaje (§4.2). Textos en `voyage.task.<id>`. */
export const VOYAGE_TASKS: readonly VoyageTask[] = [
  { id: 'exercise', zone: 'exercise', category: 'exercise' },
  { id: 'scrubber', zone: 'scrubber', category: 'scrubber', system: 'scrubber' },
  { id: 'recycler', zone: 'recycler', category: 'water', system: 'waterRecycler' },
  { id: 'callHome', zone: 'radio', category: 'comms' },
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

const ROUTINE_OFFSET_HOURS: Record<CrewId, number> = { vega: 0, miga: 2, brote: 4, senda: 6 };

export const VOYAGE_CONTENT: VoyageContent = {
  calendar: CAMPAIGN_2024,
  ship: SHIP_LAYOUT,
  tasks: VOYAGE_TASKS,
  routines: VOYAGE_ROUTINES,
  routineOffsetHours: ROUTINE_OFFSET_HOURS,
  // [regla] Sin nadie que lo cuide, un sistema se gasta en 4 días (2 en la vuelta).
  wear: { hoursToYellow: 96, maintenanceHours: 2, backWearMultiplier: 2, backExerciseMultiplier: 2, callHours: 1 },
  power: { panelKwAt1Au: SHIP_POWER.panelKwAt1Au, loadsKw: SHIP_POWER.loadsKw, essentialLoad: 'lifeSupport' },
  // Algo más rápido que el jugador del prototipo (160 px/s ≈ 3,3 tiles/s) [regla].
  crewSpeedTilesPerS: 3.5,
  infirmaryZone: 'infirmary',
  shelterZone: 'shelter',
  meterRules: METER_RULES,
  cascadeRules: CASCADE_RULES,
  incidents: INCIDENTS,
  incidentRules: INCIDENT_RULES,
};

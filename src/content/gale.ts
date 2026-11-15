import type { ShipLayout } from '../core/habitat/layout';
import type { HabitatTask } from '../core/habitat/types';
import { DEFAULT_ROUTINE, type RoutinePlan } from '../core/crew/routines';
import type { MarsContent } from '../core/mars/types';
import { CAMPAIGN_2024 } from './campaign';
import { CASCADE_RULES } from './cascade';
import { INCIDENT_RULES, INCIDENTS } from './incidents';
import { GALE_POWER, METER_RULES, MOXIE_OXYGEN_KG_PER_DAY } from './meters';
import { ROUTINE_OFFSET_HOURS, room } from './ship';

/**
 * Base en el cráter Gale (game-design §4.4): los mismos cuartos alrededor de un pasillo que la nave, una esclusa
 * al final del pasillo y el exterior a la derecha (48 × 15 tiles; la cámara sigue al jugador). Nombres en
 * `mars.zone.<id>`; 'exterior' es la ubicación que usan los medidores para la EVA.
 */
export const GALE_LAYOUT: ShipLayout = {
  cols: 48,
  rows: 15,
  corridor: { col: 1, row: 6, cols: 17, rows: 3 },
  zones: [
    room('command', 1, 4, true),
    room('exercise', 6, 3, true),
    room('scrubber', 10, 3, true),
    room('greenhouse', 14, 4, true),
    room('infirmary', 1, 4, false),
    room('moxie', 6, 3, false),
    room('shelter', 10, 3, false),
    room('radio', 14, 4, false),
    { id: 'airlock', rect: { col: 19, row: 6, cols: 2, rows: 3 }, door: { col: 18, row: 7 } },
  ],
  exterior: { rect: { col: 22, row: 1, cols: 25, rows: 13 }, airlock: 'airlock', door: { col: 21, row: 7 } },
  spawnZone: 'command',
};

/** Tareas de la base (§4.4). Textos en `mars.task.<id>` y `mars.station.<id>`. */
export const GALE_TASKS: readonly HabitatTask[] = [
  { id: 'exercise', zone: 'exercise', kind: 'exercise', category: 'exercise' },
  { id: 'scrubber', zone: 'scrubber', kind: 'maintenance', category: 'scrubber', system: 'scrubber' },
  { id: 'greenhouse', zone: 'greenhouse', kind: 'maintenance', category: 'greenhouse', system: 'greenhouse', resets: 'hoursSinceGreenhouseCare' },
  { id: 'moxie', zone: 'moxie', kind: 'maintenance', category: 'energy', system: 'moxie' },
  { id: 'airlock', zone: 'airlock', kind: 'maintenance', category: 'leak', system: 'airlock', resets: 'evaHoursSinceMaintenance' },
  { id: 'callHome', zone: 'radio', kind: 'callHome', category: 'comms' },
];

/** La ingeniera cuida MOXIE y el botánico el invernadero; las salidas las decide el jugador [regla]. */
export const GALE_ROUTINES: RoutinePlan = {
  vega: DEFAULT_ROUTINE,
  miga: { ...DEFAULT_ROUTINE, taskId: 'moxie' },
  brote: { ...DEFAULT_ROUTINE, taskId: 'greenhouse' },
  senda: DEFAULT_ROUTINE,
};

export const MARS_CONTENT: MarsContent = {
  calendar: CAMPAIGN_2024,
  layout: GALE_LAYOUT,
  tasks: GALE_TASKS,
  // Las plagas se atienden en el invernadero.
  workZones: { pests: 'greenhouse' },
  routines: GALE_ROUTINES,
  routineOffsetHours: ROUTINE_OFFSET_HOURS,
  // [regla] Sin cuidado, MOXIE se gasta en 4 soles.
  wear: { systems: ['moxie'], hoursToYellow: 96, maintenanceHours: 2, callHours: 1 },
  power: { panelKwAt1Au: GALE_POWER.panelKwAt1Au, loadsKw: GALE_POWER.loadsKw, essentialLoads: ['lifeSupport', 'moxie'], socketKw: 2 },
  crewSpeedTilesPerS: 3.5,
  infirmaryZone: 'infirmary',
  shelterZone: 'shelter',
  // El comandante pide desde la radio; el diagnóstico acelera ×1,5 (game-design §3.7).
  missionControl: { consoleZone: 'radio', diagnosisKwh: 0.5, diagnosisBoost: 1.5 },
  meterRules: METER_RULES,
  cascadeRules: CASCADE_RULES,
  incidents: INCIDENTS,
  incidentRules: INCIDENT_RULES,
  moxieOxygenKgPerDay: MOXIE_OXYGEN_KG_PER_DAY,
  // ~1,5 kg por sol: una quinta parte de lo que come la tripulación [regla].
  greenhouse: { foodKgPerDay: 1.5, priorityMultiplier: 2 },
  daylight: { sunriseHour: 6, sunsetHour: 18 },
  samples: {
    count: 8,
    minMassKg: 0.5,
    maxMassKg: 2.5,
    baseValue: 10,
    valuePerTile: 2,
    collectHours: 1,
    reachTiles: 1,
    minTiles: 4,
    tilesPerLandingKm: 1.5,
  },
};

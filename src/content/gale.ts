import type { Point, ShipLayout } from '../core/habitat/layout';
import type { HabitatTask } from '../core/habitat/types';
import { DEFAULT_ROUTINE, type RoutinePlan } from '../core/crew/routines';
import type { MarsContent } from '../core/mars/types';
import { CAMPAIGN_2024 } from './campaign';
import { CASCADE_RULES } from './cascade';
import { INCIDENT_RULES, INCIDENTS } from './incidents';
import { GALE_POWER, METER_RULES, MOXIE_OXYGEN_KG_PER_DAY } from './meters';
import type { RealEvent } from '../core/events/RealEvent';
import { GALE_FACTS, GALE_ROCKS, type GaleStripId } from './galeTerrain';
import galeMap from './maps/gale.json';
import { ROUTINE_OFFSET_HOURS } from './ship';
import { landmarksFromTiled, layoutFromTiled, terrainFromTiled, type TerrainStrip, type TiledMap } from './tiledLayout';

/**
 * Base en el cráter Gale (game-design §4.4): sale del mapa de Tiled `maps/gale.json` (72 × 72 tiles, lo arma
 * `scripts/maps/build-gale.mjs`). Los mismos cuartos que la nave a los dos lados de un pasillo, una esclusa con una
 * puerta al pasillo y otra al exterior, y afuera un corte comprimido y no a escala del camino real de Curiosity, de
 * norte a sur (`GALE_STRIPS`, fuentes en `galeTerrain.ts`). Lo que no se pisa (acantilados, cerros, crestas de
 * duna, rocas, la base) sale de la capa `paredes`. Nombres en `mars.zone.<id>`; 'exterior' es la ubicación que usan
 * los medidores para la EVA.
 */
export const GALE_MAP: TiledMap = galeMap;
export const GALE_LAYOUT: ShipLayout = layoutFromTiled(GALE_MAP);
/** Franjas del exterior (rectángulos `terrain` del mapa), de norte a sur. */
export const GALE_TERRAIN: readonly TerrainStrip[] = terrainFromTiled(GALE_MAP);
/** Puntos con nombre del mapa: `curiosity` es donde está estacionado el rover. */
export const GALE_LANDMARKS: Readonly<Record<string, Point>> = landmarksFromTiled(GALE_MAP);

/**
 * Tarjeta "Esto pasó de verdad" del azufre (galeTerrain.ts, GALE_FACTS.sulfur): sale al mediodía del 30/05/2024 si
 * la estancia pasa por ese día. El valor es el sol de la misión de Curiosity.
 */
export const SULFUR_EVENT: RealEvent = {
  id: 'curiositySulfur2024',
  date: `${GALE_FACTS.sulfur.date}T12:00:00Z`,
  instrument: 'APXS · MAHLI',
  mission: 'Curiosity',
  agency: 'NASA/JPL',
  value: GALE_FACTS.sulfur.sol,
  unit: 'sol',
  kidValueKey: 'mars.realEvent.sulfur.kidValue',
  explanationKey: 'mars.realEvent.sulfur.explanation',
  sourceUrl: GALE_FACTS.sulfur.source.url,
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
  power: { panelKwAt1Au: GALE_POWER.panelKwAt1Au, capacityKwh: GALE_POWER.capacityKwh, loadsKw: GALE_POWER.loadsKw, essentialLoads: ['lifeSupport', 'moxie'], socketKw: 2 },
  // Como en la nave: la base mide 48 tiles de largo [regla].
  crewSpeedTilesPerS: 4.5,
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
  realMoments: [SULFUR_EVENT],
  samples: {
    count: 8,
    // Caja de muestras con su contenedor [regla]: compiten con los suministros en la carga de vuelta (§4.5).
    minMassKg: 4,
    maxMassKg: 14,
    baseValue: 10,
    // El exterior llega a ~58 tiles de la esclusa: lo más lejano vale ~70, como en el plano anterior [regla].
    valuePerTile: 1,
    collectHours: 1,
    reachTiles: 1,
    minTiles: 4,
    tilesPerLandingKm: 1.5,
    // Una roca por franja del exterior (galeTerrain.ts): 8 muestras para 5 tipos.
    rocks: GALE_TERRAIN.map((t) => ({ rect: t.rect, rock: GALE_ROCKS[t.id as GaleStripId].rock })),
  },
};

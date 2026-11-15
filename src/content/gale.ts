import { pathLength, pointAlong, type Point, type ShipLayout } from '../core/habitat/layout';
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
import { CARE_TASKS, ROUTINE_OFFSET_HOURS } from './ship';
import { cablesFromTiled, landmarksFromTiled, layoutFromTiled, terrainFromTiled, type MapCable, type TerrainStrip, type TiledMap } from './tiledLayout';

/**
 * Base en el cráter Gale (game-design §4.4): sale del mapa de Tiled `maps/gale.json` (72 × 98 tiles, lo arma
 * `scripts/maps/build-gale.mjs`) según el plano `docs/mision_a_marte_referencias_topdown/plano-base-marte.png`:
 * módulos con forma propia unidos por tubos aislados que se pueden romper (`tube-…`), el taller con la esclusa hacia
 * la nave, y afuera el depósito, la batería y la nave estacionada, a los que se llega con traje. Más al sur, un corte
 * comprimido y no a escala del camino real de Curiosity, de norte a sur (`GALE_STRIPS`, fuentes en
 * `galeTerrain.ts`). Lo que no se pisa (acantilados, cerros, crestas de duna, rocas, la base y los patios entre los
 * tubos) sale de la capa `paredes`. Nombres en `mars.zone.<id>`; 'exterior' es la ubicación que usan los medidores
 * para la EVA.
 */
export const GALE_MAP: TiledMap = galeMap;
export const GALE_LAYOUT: ShipLayout = layoutFromTiled(GALE_MAP);
/** Franjas del exterior (rectángulos `terrain` del mapa), de norte a sur. */
export const GALE_TERRAIN: readonly TerrainStrip[] = terrainFromTiled(GALE_MAP);
/** Puntos con nombre del mapa: `curiosity` (el rover), `recipe` (la receta de las reservas), `j1` y `j2` (cajas de empalme). */
export const GALE_LANDMARKS: Readonly<Record<string, Point>> = landmarksFromTiled(GALE_MAP);
/** Cables de la red eléctrica (verdes en el plano), con su recorrido. */
export const GALE_CABLES: readonly MapCable[] = cablesFromTiled(GALE_MAP);

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

/** Tareas de la base (§4.4), cada una con el minijuego que abre E. Textos en `mars.task.<id>` y `mars.station.<id>`. */
export const GALE_TASKS: readonly HabitatTask[] = [
  { id: 'exercise', zone: 'exercise', kind: 'exercise', category: 'exercise', minigame: 'bike' },
  { id: 'scrubber', zone: 'scrubber', kind: 'maintenance', category: 'scrubber', system: 'scrubber', minigame: 'scrubber' },
  { id: 'greenhouse', zone: 'greenhouse', kind: 'maintenance', category: 'greenhouse', system: 'greenhouse', resets: 'hoursSinceGreenhouseCare', minigame: 'plants' },
  { id: 'moxie', zone: 'moxie', kind: 'maintenance', category: 'energy', system: 'moxie', minigame: 'moxie' },
  { id: 'airlock', zone: 'airlock', kind: 'maintenance', category: 'leak', system: 'airlock', resets: 'evaHoursSinceMaintenance', minigame: 'seals' },
  { id: 'callHome', zone: 'radio', kind: 'callHome', category: 'comms', minigame: 'radio' },
  // Revisar los tableros de fusibles de la sala de energía una vez por día [regla]: así se aprende a cambiarlos.
  { id: 'fuseCheck', zone: 'energy', kind: 'care', category: 'energy', minigame: 'fuses', care: { morale: 0.02 } },
  CARE_TASKS.navigate,
  CARE_TASKS.checkup,
  { ...CARE_TASKS.cook, recipeAt: GALE_LANDMARKS.recipe! },
  CARE_TASKS.shield,
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
  // Las plagas se atienden en el invernadero y los fusibles quemados en la sala de energía.
  workZones: { pests: 'greenhouse', energy: 'energy' },
  routines: GALE_ROUTINES,
  routineOffsetHours: ROUTINE_OFFSET_HOURS,
  // [regla] Sin cuidado, MOXIE se gasta en 4 soles.
  wear: { systems: ['moxie'], hoursToYellow: 96, maintenanceHours: 2, callHours: 1 },
  // El tablero para desenchufar sistemas está en la sala de energía.
  power: { panelKwAt1Au: GALE_POWER.panelKwAt1Au, capacityKwh: GALE_POWER.capacityKwh, loadsKw: GALE_POWER.loadsKw, essentialLoads: ['lifeSupport', 'moxie'], socketKw: 2, panelZone: 'energy' },
  // Como en la nave [regla]: la base mide unos 50 tiles de punta a punta.
  grid: {
    // Cada cable se empalma en la mitad de su recorrido.
    cables: GALE_CABLES.map((c) => ({ id: c.id, from: c.from, to: c.to, at: pointAlong(c.points, pathLength(c.points) / 2) })),
    lossPerCut: 0.25,
    repairReach: 1.6,
  },
  // Al terminar la estancia hay que llevar la carga del depósito a la nave y subir todos.
  departure: { shipZone: 'ship', cargoZone: 'storage' },
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

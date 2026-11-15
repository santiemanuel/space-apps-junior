import type { MinigameId } from '../../core/minigames/Minigame';
import { CAMPAIGN_2024 } from '../../content/campaign';
import { GALE_POWER, METER_RULES } from '../../content/meters';
import type { TimedPhase } from '../../core/clock/schedule';
import type { UnlockLevel } from '../../core/flow/types';
import type { GameState } from '../../core/state/types';
import type { SystemId, SystemStatus } from '../../core/systems/types';
import type { PhaseSceneData, VoyageSceneData } from '../scenes/sceneData';
import type { MapViewData, MapViewOptions } from '../scenes/simulation/simulationData';
import type { DevDataBuilders } from './devLaunch';

const DAY_MS = 86_400_000;

/**
 * Estado de prueba de una fase con calendario. Parámetros comunes: `from=AAAA-MM-DD` (fecha de arranque), `help=1`
 * (modo ayuda), `level=N` (desbloqueo) y `length=long`. Suministros para lo que queda de la fase con un 20 % de
 * margen: la carga real la decide `Loadout` (Facundo).
 */
function phaseState(base: GameState, phase: TimedPhase, params: URLSearchParams): GameState {
  const state = calendarState(base, phase, params);
  // Para ver los efectos: `broken=scrubber,waterRecycler:yellow` (sistemas averiados) y `battery=0` (sin energía).
  const broken = (params.get('broken') ?? '').split(',').filter(Boolean).map((b) => b.split(':') as [SystemId, SystemStatus?]);
  const battery = params.get('battery');
  // `tired=1`: tripulación cansada, baja de forma y de ánimo (para ver la salud en el tablero y probar los cuidados).
  const tired = params.get('tired') === '1';
  return {
    ...state,
    ...(tired ? { crew: state.crew.map((m) => ({ ...m, fatigue: 0.75, condition: 0.55, morale: 0.5 })) } : {}),
    systems: { ...state.systems, ...Object.fromEntries(broken.map(([id, status]) => [id, status ?? 'red'])) },
    meters: battery === null ? state.meters : { ...state.meters, energy: { ...state.meters.energy, batteryKwh: Number(battery) } },
  };
}

function calendarState(base: GameState, phase: TimedPhase, params: URLSearchParams): GameState {
  const window = CAMPAIGN_2024.windows[phase];
  const from = params.get('from');
  // `from=AAAA-MM-DD` arranca a medianoche (UTC); `from=AAAA-MM-DDTHH`, a esa hora (de día en Marte: 06–18).
  const simDate = from ? new Date(from.includes('T') ? `${from}:00:00Z` : `${from}T00:00:00Z`).toISOString() : window.start;
  const days = ((Date.parse(window.end) - Date.parse(simDate)) / DAY_MS) * 1.2;
  const crew = base.crew.length;
  return {
    ...base,
    phase,
    simDate,
    helpMode: params.get('help') === '1',
    unlockLevel: Math.min(4, Math.max(1, Number(params.get('level') ?? 1))) as UnlockLevel,
    length: params.get('length') === 'long' ? 'long' : 'short',
    meters: {
      ...base.meters,
      lifeSupport: { ...base.meters.lifeSupport, oxygenKg: METER_RULES.lifeSupport.oxygenKgPerCrewDay * crew * days },
    },
    inventory: { ...base.inventory, foodKg: METER_RULES.food.foodKgPerCrewDay * crew * days },
  };
}

/**
 * Opciones de vista: `zoom=2` (zoom de la cámara; por defecto 1,5), `fx=alert|impact,powerOut,storm` (efectos
 * forzados; `storm`, la tormenta de polvo de `Mars`) y, en `Mars`, `at=<franja>|curiosity` (el jugador arranca afuera,
 * en esa franja del exterior o junto a Curiosity).
 */
/** `minigame=<id>` abre ese minijuego al arrancar (para verlo sin buscar la sala ni esperar un incidente). */
const fxOf = (params: URLSearchParams): MapViewOptions['fx'] => {
  const fx = (params.get('fx') ?? '').split(',');
  const level = fx.includes('impact') ? 'impact' : fx.includes('alert') ? 'alert' : undefined;
  return { ...(level ? { level } : {}), ...(fx.includes('powerOut') ? { powerOut: true } : {}), ...(fx.includes('storm') ? { storm: true } : {}) };
};

const viewOf = (params: URLSearchParams): MapViewData => ({
  view: { ...(params.get('zoom') ? { zoom: Math.min(3, Math.max(0.5, Number(params.get('zoom')) || 1)) } : {}), ...(params.get('at') ? { at: params.get('at')! } : {}), ...(params.get('minigame') ? { minigame: params.get('minigame') as MinigameId } : {}), fx: fxOf(params) },
});

/**
 * Datos de prueba para abrir las escenas de simulación con `?scene=`. Dueño: Santiago.
 * `?scene=Voyage&leg=back&where=shelter&broken=scrubber&battery=0` · `?scene=Mars&km=6&where=airlock` (distancia del aterrizaje a la base y cuarto donde
 * arranca el jugador) · más los de `phaseState` y `viewOf`.
 */
export const simulationDevData: DevDataBuilders = {
  Voyage: (base, params): VoyageSceneData & MapViewData => {
    const leg = params.get('leg') === 'back' ? 'back' : 'out';
    const phase = phaseState(base.state, leg === 'out' ? 'cruiseOut' : 'cruiseBack', params);
    // `where` elige el cuarto donde arranca el jugador.
    const where = params.get('where');
    const state = where ? { ...phase, crew: phase.crew.map((m) => (m.id === phase.activeCrewId ? { ...m, location: where } : m)) } : phase;
    if (leg === 'out') return { ...base, ...viewOf(params), leg, state };
    // Nave gastada y tripulación que arrastra Marte (§4.6).
    return {
      ...base,
      ...viewOf(params),
      leg,
      state: {
        ...state,
        inventory: { ...state.inventory, spares: 2 },
        crew: state.crew.map((m) => ({ ...m, condition: 0.75, fatigue: 0.2, doseMSv: 120 })),
        waterShield: 0.7,
      },
    };
  },
  Mars: (base, params): PhaseSceneData & MapViewData => {
    const state = phaseState(base.state, 'mars', params);
    return {
      ...base,
      ...viewOf(params),
      state: {
        ...state,
        landingDistanceKm: Number(params.get('km') ?? 2),
        meters: { ...state.meters, energy: { batteryKwh: GALE_POWER.capacityKwh, capacityKwh: GALE_POWER.capacityKwh } },
        // Llegan del viaje de ida con algo de dosis; `where` elige dónde arranca el jugador.
        crew: state.crew.map((m) => ({
          ...m,
          condition: 0.9,
          doseMSv: 220,
          ...(m.id === state.activeCrewId && params.get('where') ? { location: params.get('where')! } : {}),
        })),
      },
    };
  },
  // Superpuestas: necesitan el bus de la simulación de una escena de mapa (P, C y G desde Voyage o Mars).
  Hud: null,
  Planning: null,
  MissionControl: null,
  DataPanel: null,
};

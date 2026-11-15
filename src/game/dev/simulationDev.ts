import { CAMPAIGN_2024 } from '../../content/campaign';
import { GALE_POWER, METER_RULES } from '../../content/meters';
import type { TimedPhase } from '../../core/clock/schedule';
import type { UnlockLevel } from '../../core/flow/types';
import type { GameState } from '../../core/state/types';
import type { PhaseSceneData, VoyageSceneData } from '../scenes/sceneData';
import type { DevDataBuilders } from './devLaunch';

const DAY_MS = 86_400_000;

/**
 * Estado de prueba de una fase con calendario. Parámetros comunes: `from=AAAA-MM-DD` (fecha de arranque), `help=1`
 * (modo ayuda), `level=N` (desbloqueo) y `length=long`. Suministros para lo que queda de la fase con un 20 % de
 * margen: la carga real la decide `Loadout` (Facundo).
 */
function phaseState(base: GameState, phase: TimedPhase, params: URLSearchParams): GameState {
  const window = CAMPAIGN_2024.windows[phase];
  const from = params.get('from');
  const simDate = from ? new Date(`${from}T00:00:00Z`).toISOString() : window.start;
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
 * Datos de prueba para abrir las escenas de simulación con `?scene=`. Dueño: Santiago.
 * `?scene=Voyage&leg=back` · `?scene=Mars&km=6&where=airlock` (distancia del aterrizaje a la base y cuarto donde
 * arranca el jugador) · más los de `phaseState`.
 */
export const simulationDevData: DevDataBuilders = {
  Voyage: (base, params): VoyageSceneData => {
    const leg = params.get('leg') === 'back' ? 'back' : 'out';
    const state = phaseState(base.state, leg === 'out' ? 'cruiseOut' : 'cruiseBack', params);
    if (leg === 'out') return { ...base, leg, state };
    // Nave gastada y tripulación que arrastra Marte (§4.6).
    return {
      ...base,
      leg,
      state: {
        ...state,
        inventory: { ...state.inventory, spares: 2 },
        crew: state.crew.map((m) => ({ ...m, condition: 0.75, fatigue: 0.2, doseMSv: 120 })),
        waterShield: 0.7,
      },
    };
  },
  Mars: (base, params): PhaseSceneData => {
    const state = phaseState(base.state, 'mars', params);
    return {
      ...base,
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
  // Prototipo: dependen de GameSession y se abren sólo por el camino normal.
  Habitat: null,
  Hud: null,
};

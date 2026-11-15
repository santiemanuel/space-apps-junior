import { CAMPAIGN_2024 } from '../../content/campaign';
import { METER_RULES } from '../../content/meters';
import type { UnlockLevel } from '../../core/flow/types';
import type { VoyageSceneData } from '../scenes/sceneData';
import type { DevDataBuilders } from './devLaunch';

const DAY_MS = 86_400_000;

/**
 * Datos de prueba para abrir las escenas de simulación con `?scene=`. Dueño: Santiago.
 * `?scene=Voyage&leg=back&from=2024-05-07&help=1&level=2&length=long`: vuelta, fecha de arranque, modo ayuda,
 * nivel de desbloqueo y duración. La carga real la decide `Loadout` (Facundo).
 */
export const simulationDevData: DevDataBuilders = {
  Voyage: (base, params): VoyageSceneData => {
    const leg = params.get('leg') === 'back' ? 'back' : 'out';
    const phase = leg === 'out' ? 'cruiseOut' : 'cruiseBack';
    const window = CAMPAIGN_2024.windows[phase];
    const from = params.get('from');
    const simDate = from ? new Date(`${from}T00:00:00Z`).toISOString() : window.start;
    // Suministros para la fase con un 20 % de margen.
    const days = ((Date.parse(window.end) - Date.parse(simDate)) / DAY_MS) * 1.2;
    const crew = base.state.crew.length;
    const worn = leg === 'back';
    return {
      ...base,
      leg,
      state: {
        ...base.state,
        phase,
        simDate,
        helpMode: params.get('help') === '1',
        unlockLevel: Math.min(4, Math.max(1, Number(params.get('level') ?? 1))) as UnlockLevel,
        length: params.get('length') === 'long' ? 'long' : 'short',
        meters: {
          ...base.state.meters,
          lifeSupport: { ...base.state.meters.lifeSupport, oxygenKg: METER_RULES.lifeSupport.oxygenKgPerCrewDay * crew * days },
        },
        inventory: { ...base.state.inventory, foodKg: METER_RULES.food.foodKgPerCrewDay * crew * days, spares: worn ? 2 : 6 },
        // Nave gastada y tripulación que arrastra Marte (§4.6).
        crew: worn ? base.state.crew.map((m) => ({ ...m, condition: 0.75, fatigue: 0.2, doseMSv: 120 })) : base.state.crew,
        waterShield: worn ? 0.7 : 1,
      },
    };
  },
  // Prototipo: dependen de GameSession y se abren sólo por el camino normal.
  Habitat: null,
  Hud: null,
};

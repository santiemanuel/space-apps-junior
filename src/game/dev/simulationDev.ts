import type { VoyageSceneData } from '../scenes/sceneData';
import type { DevDataBuilders } from './devLaunch';

/** Datos de prueba para abrir las escenas de simulación con `?scene=`. Dueño: Santiago. */
export const simulationDevData: DevDataBuilders = {
  Voyage: (base, params): VoyageSceneData => ({ ...base, leg: params.get('leg') === 'back' ? 'back' : 'out' }),
  // Prototipo: dependen de GameSession y se abren sólo por el camino normal.
  Habitat: null,
  Hud: null,
};

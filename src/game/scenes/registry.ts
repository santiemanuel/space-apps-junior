import { flowScenes } from './flowScenes';
import { simulationScenes } from './simulationScenes';

/** Archivo congelado desde la Etapa 0: cada frente agrega escenas sólo en su propia lista. */
export const ALL_SCENES = [...flowScenes, ...simulationScenes];

import { DataPanelScene } from './simulation/DataPanelScene';
import { HabitatScene } from './simulation/HabitatScene';
import { HudScene } from './simulation/HudScene';
import { MarsScene } from './simulation/MarsScene';
import { MissionControlScene } from './simulation/MissionControlScene';
import { PlanningScene } from './simulation/PlanningScene';
import { VoyageScene } from './simulation/VoyageScene';

/** Escenas de simulación. Dueño: Santiago. */
export const simulationScenes = [HabitatScene, VoyageScene, MarsScene, PlanningScene, HudScene, MissionControlScene, DataPanelScene];

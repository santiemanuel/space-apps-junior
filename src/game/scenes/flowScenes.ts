import { BootScene } from './flow/BootScene';
import { DataCardScene } from './flow/DataCardScene';
import { LoadoutScene } from './flow/LoadoutScene';
import { ManeuverScene } from './flow/ManeuverScene';
import { PauseScene } from './flow/PauseScene';
import { ReportScene } from './flow/ReportScene';
import { TitleScene } from './flow/TitleScene';

/** Escenas del flujo de misión. Dueño: Facundo. `BootScene` va primero: Phaser arranca la primera. */
export const flowScenes = [BootScene, TitleScene, LoadoutScene, ManeuverScene, DataCardScene, ReportScene, PauseScene];

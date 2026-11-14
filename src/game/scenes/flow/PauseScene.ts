import { SceneKeys } from '../../sceneKeys';
import { PlaceholderScene } from '../PlaceholderScene';

/** Provisional (Etapa 0). Ver docs/plan-de-trabajo.md §4. */
export class PauseScene extends PlaceholderScene {
  constructor() {
    super(SceneKeys.Pause, 'menu.pause.sceneTitle');
  }
}

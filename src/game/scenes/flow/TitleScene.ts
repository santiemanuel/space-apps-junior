import { SceneKeys } from '../../sceneKeys';
import { PlaceholderScene } from '../PlaceholderScene';

/** Provisional (Etapa 0). Ver docs/plan-de-trabajo.md §4. */
export class TitleScene extends PlaceholderScene {
  constructor() {
    super(SceneKeys.Title, 'menu.title.sceneTitle');
  }
}

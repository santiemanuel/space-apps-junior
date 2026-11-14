import Phaser from 'phaser';
import { SceneKeys } from '../../sceneKeys';
import { getServices } from '../../services';
import { createPlaceholderTextures } from '../../textures';

/** Genera texturas, carga el entorno NASA y crea la sesión antes de arrancar el juego. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  async create(): Promise<void> {
    createPlaceholderTextures(this);
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.has('scene')) {
        const { launchDevScene } = await import('../../dev/devLaunch');
        if (launchDevScene(this, params)) return;
      }
    }
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'Recibiendo telemetría de la NASA…', {
      fontFamily: 'monospace', fontSize: '18px', color: '#90cdf4',
    }).setOrigin(0.5);

    const services = getServices(this);
    const session = services.createSession(await services.loadEnvironment());
    this.scene.start(SceneKeys.Habitat, { session });
    this.scene.launch(SceneKeys.Hud, { session });
  }
}

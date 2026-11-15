import Phaser from 'phaser';
import { loadSettings } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import { setLocale, t } from '../../../i18n';
import { isLocale } from '../../../i18n/locales';
import { BOOT_ASSETS, queueAssets } from '../../assets';
import { SceneKeys } from '../../sceneKeys';
import { getServices } from '../../services';
import { createBrowserSaveStore } from '../../storage/browserSaveStore';
import { createPlaceholderTextures } from '../../textures';
import { FlowDirector } from './FlowDirector';

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '18px', color: '#90cdf4' } as const;
const BAR = { width: 480, height: 24, padding: 4, color: 0x90cdf4 } as const;

/** Carga los recursos (sprites, tiles, audio), aplica el idioma guardado y arranca el menú principal. */
export class BootScene extends Phaser.Scene {
  private store!: SaveStore;

  constructor() {
    super(SceneKeys.Boot);
  }

  /** El idioma guardado se aplica antes de pintar la barra de carga. */
  init(): void {
    this.store = createBrowserSaveStore();
    const { locale } = loadSettings(this.store);
    if (isLocale(locale)) setLocale(locale);
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2 - 40, t('menu.boot.loading', { percent: 0 }), TEXT_STYLE).setOrigin(0.5);
    const frame = this.add.rectangle(width / 2, height / 2, BAR.width, BAR.height).setStrokeStyle(2, BAR.color);
    const fill = this.add
      .rectangle(width / 2 - BAR.width / 2 + BAR.padding, height / 2, BAR.width - BAR.padding * 2, BAR.height - BAR.padding * 2, BAR.color)
      .setOrigin(0, 0.5)
      .setScale(0, 1);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.setScale(value, 1);
      label.setText(t('menu.boot.loading', { percent: Math.round(value * 100) }));
    });
    // Un recurso que falla no frena el juego: las escenas siguen con las texturas provisionales.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[Boot] no se pudo cargar "${file.key}" (${file.src})`);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      label.destroy();
      frame.destroy();
      fill.destroy();
    });

    queueAssets(this.load, BOOT_ASSETS);
  }

  async create(): Promise<void> {
    createPlaceholderTextures(this);
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      // Prototipo lunar hasta la integración: depende de GameSession y no se abre con launchDevScene.
      if (params.get('scene') === SceneKeys.Habitat) return this.startPrototype();
      if (params.has('scene')) {
        const { launchDevScene } = await import('../../dev/devLaunch');
        if (launchDevScene(this, params)) return;
      }
    }
    new FlowDirector(this.game, this.store).showTitle();
  }

  private async startPrototype(): Promise<void> {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, t('menu.boot.telemetry'), TEXT_STYLE).setOrigin(0.5);

    const services = getServices(this);
    const session = services.createSession(await services.loadEnvironment());
    this.scene.start(SceneKeys.Habitat, { session });
    this.scene.launch(SceneKeys.Hud, { session });
  }
}

import Phaser from 'phaser';
import { t, type TranslationKey } from '../../i18n';
import type { SceneKey } from '../sceneKeys';

/**
 * Escena provisional de la Etapa 0: muestra su título y los datos recibidos. Cada dueño la reemplaza
 * por la escena real sin tocar el registro (`flowScenes.ts` / `simulationScenes.ts`).
 */
export abstract class PlaceholderScene extends Phaser.Scene {
  private received: unknown;

  protected constructor(key: SceneKey, private readonly titleKey: TranslationKey) {
    super(key);
  }

  init(data: unknown): void {
    this.received = data;
  }

  create(): void {
    const { width, height } = this.scale;
    const keys = this.received && typeof this.received === 'object' ? Object.keys(this.received).join(', ') : '—';
    this.add
      .text(width / 2, height / 2, [t(this.titleKey), '', t('common.pendingScene'), '', `data: ${keys}`], {
        fontFamily: 'monospace', fontSize: '18px', color: '#e2e8f0', align: 'center',
      })
      .setOrigin(0.5);
  }
}

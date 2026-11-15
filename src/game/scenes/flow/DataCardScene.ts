import Phaser from 'phaser';
import { t, type TranslationKey } from '../../../i18n';
import { formatDate, formatNumber } from '../../../i18n/format';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addPanel, addShade, addText, COLOR, onKeys, openSource, overlayIn } from '../../ui/ui';
import type { DataCardSceneData } from '../sceneData';

/** `onClose` lo pone quien abre la tarjeta (el director del flujo) para reanudar el juego. */
export type DataCardData = DataCardSceneData & { onClose?: () => void };

const CENTER = GAME_WIDTH / 2;
const PANEL_BOX = { x: 190, y: 90, width: 900, height: 540 } as const;

/** Dominio de la fuente, para mostrarlo corto junto al enlace. */
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * Tarjeta "Esto pasó de verdad" (game-design §3.8.1), en pausa: fecha, instrumento y misión, el valor traducido
 * para niños, una frase, el enlace a la fuente y un aviso si el valor está recortado.
 */
export class DataCardScene extends Phaser.Scene {
  private data_!: DataCardData;
  private closed = false;

  constructor() {
    super(SceneKeys.DataCard);
  }

  init(data: DataCardData): void {
    this.data_ = data;
    this.closed = false;
  }

  create(): void {
    const { event } = this.data_;
    addShade(this);
    addPanel(this, PANEL_BOX.x, PANEL_BOX.y, PANEL_BOX.width, PANEL_BOX.height, 0x63b3ed);
    const wrap = { align: 'center', wordWrap: { width: PANEL_BOX.width - 100 }, lineSpacing: 4 };

    addText(this, CENTER, 130, 28, COLOR.title).setOrigin(0.5).setText(t('report.dataCard.sceneTitle'));
    addText(this, CENTER, 178, 17, COLOR.text).setOrigin(0.5).setText(t('report.dataCard.date', { date: formatDate(event.date) }));
    addText(this, CENTER, 206, 15, COLOR.muted)
      .setOrigin(0.5)
      .setText(t('report.dataCard.by', { mission: event.mission, instrument: event.instrument, agency: event.agency }));
    addText(this, CENTER, 268, 44, COLOR.focus).setOrigin(0.5).setText(`${formatNumber(event.value)} ${event.unit}`);
    addText(this, CENTER, 312, 18, COLOR.text, wrap)
      .setOrigin(0.5, 0)
      .setText(t(event.kidValueKey as TranslationKey, event.kidValueParams));
    addText(this, CENTER, 382, 16, COLOR.muted, wrap).setOrigin(0.5, 0).setText(t(event.explanationKey as TranslationKey));
    if (event.capped) addText(this, CENTER, 492, 14, COLOR.warn, wrap).setOrigin(0.5).setText(t('report.dataCard.capped'));

    addText(this, CENTER, 528, 15, COLOR.link)
      .setOrigin(0.5)
      .setText(`${t('report.dataCard.source')} (${hostOf(event.sourceUrl)}) ↗`)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => openSource(event.sourceUrl));
    addButton(this, CENTER, 582, () => this.close(), { size: 20 }).setLabel(t('report.dataCard.continue')).setFocused(true);
    addText(this, CENTER, 660, 13, COLOR.dim).setOrigin(0.5).setText(t('report.dataCard.controls'));

    overlayIn(this);
    onKeys(this, (code) => {
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'Escape') this.close();
    });
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.stop();
    this.data_.onClose?.();
  }
}

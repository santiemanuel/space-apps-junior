import Phaser from 'phaser';
import { getLocale, t } from '../../../i18n';
import { formatTime } from '../../../i18n/format';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addPanel, addShade, addText, COLOR, onKeys, overlayIn } from '../../ui/ui';
import { audio } from '../../audio/audio';
import type { SaveStore } from '../../../core/save/SaveStore';
import type { PhaseSceneData } from '../sceneData';
import { createBrowserSaveStore } from '../../storage/browserSaveStore';
import { openSettings } from './settingsPanel';

/**
 * Datos de `Pause`. El guardado se pide por el bus (`save:requested` → `save:completed`); continuar y salir al menú
 * los resuelve quien abrió la pausa (el director del flujo), igual que en `Title`.
 */
export interface PauseSceneData extends PhaseSceneData {
  onResume(): void;
  onExit(): void;
  /** Ajustes guardados (sonidos, música e idioma). */
  store?: SaveStore;
  /** Guarda el idioma elegido (preferencia del jugador). */
  onLocaleChange?(locale: string): void;
}

type PauseItem = 'resume' | 'save' | 'saveAndExit' | 'settings';
const ITEMS: readonly PauseItem[] = ['resume', 'save', 'saveAndExit', 'settings'];
const CENTER = GAME_WIDTH / 2;
const ROW_Y = (index: number) => 300 + index * 56;

/** Pausa (Esc, §3.9): continuar, guardar, guardar y salir, e idioma. El tiempo de la misión no corre. */
export class PauseScene extends Phaser.Scene {
  private data_!: PauseSceneData;
  private rows: Phaser.GameObjects.Text[] = [];
  private focusBar!: Phaser.GameObjects.Container;
  private cursor = 0;
  private savedAt: Date | null = null;
  private texts!: { title: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; controls: Phaser.GameObjects.Text };
  private exiting = false;
  private closed = false;
  /** La misma tecla Esc que abrió la pausa no debe cerrarla enseguida. */
  private openedAt = 0;

  constructor() {
    super(SceneKeys.Pause);
  }

  init(data: PauseSceneData): void {
    this.data_ = data;
    this.cursor = 0;
    this.savedAt = null;
    this.exiting = false;
    this.closed = false;
  }

  create(): void {
    this.openedAt = this.time.now;
    addShade(this, 0.7);
    addPanel(this, CENTER - 260, 150, 520, 420);
    const bar = this.add.rectangle(0, 0, 460, 44, 0xfbd38d, 0.12);
    const accent = this.add.rectangle(-230, 0, 3, 30, 0xfbd38d).setOrigin(0, 0.5);
    this.focusBar = this.add.container(CENTER, ROW_Y(this.cursor), [bar, accent]);
    this.texts = {
      title: addText(this, CENTER, 195, 30, COLOR.title).setOrigin(0.5),
      hint: addText(this, CENTER, 236, 14, COLOR.muted, { align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5),
      status: addText(this, CENTER, 528, 14, COLOR.ok).setOrigin(0.5),
      controls: addText(this, CENTER, 600, 13, COLOR.dim).setOrigin(0.5),
    };
    this.rows = ITEMS.map((item, index) => {
      const label = addText(this, CENTER, ROW_Y(index), 18).setOrigin(0.5);
      const hit = this.add.rectangle(CENTER, ROW_Y(index), 460, 44, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.focus(index));
      hit.on('pointerdown', () => this.activate(item));
      return label;
    });
    this.render();

    const off = this.data_.bus.on('save:completed', ({ savedAt }) => {
      this.savedAt = new Date(savedAt);
      this.render();
      if (this.exiting) this.exit();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    overlayIn(this);
    onKeys(this, (code) => {
      if (code === 'ArrowUp' || code === 'KeyW') this.focus((this.cursor - 1 + ITEMS.length) % ITEMS.length);
      else if (code === 'ArrowDown' || code === 'KeyS') this.focus((this.cursor + 1) % ITEMS.length);
      else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.activate(ITEMS[this.cursor]!);
      else if (code === 'Escape' && this.time.now - this.openedAt > 250) this.activate('resume');
    });
  }

  private render(): void {
    const { title, hint, status, controls } = this.texts;
    title.setText(t('menu.pause.sceneTitle'));
    hint.setText(t('menu.pause.hint'));
    controls.setText(t('menu.pause.controls'));
    ITEMS.forEach((item, index) => this.rows[index]!.setText(this.label(item)).setColor(index === this.cursor ? COLOR.focus : COLOR.text));
    status.setText(this.savedAt ? t('menu.pause.saved', { time: formatTime(this.savedAt) }) : '');
  }

  private label(item: PauseItem): string {
    return t(`menu.pause.${item}`);
  }

  private focus(index: number): void {
    if (this.closed || index === this.cursor) return;
    audio.sfx('hover');
    this.cursor = index;
    // El mismo deslizamiento del menú principal, sin acumular animaciones al navegar rápido.
    this.tweens.killTweensOf(this.focusBar);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.focusBar.setY(ROW_Y(index));
    else this.tweens.add({ targets: this.focusBar, y: ROW_Y(index), duration: 140, ease: 'Cubic.Out' });
    this.render();
  }

  private activate(item: PauseItem): void {
    if (this.closed) return;
    audio.sfx('select');
    switch (item) {
      case 'resume':
        this.closed = true;
        this.scene.stop();
        this.data_.onResume();
        break;
      case 'save':
        this.data_.bus.emit('save:requested', { reason: 'manual' });
        break;
      case 'saveAndExit':
        this.exiting = true;
        this.data_.bus.emit('save:requested', { reason: 'manual' });
        break;
      case 'settings':
        this.closed = true;
        openSettings(this, this.data_.store ?? createBrowserSaveStore(), (changedLocale) => {
          this.closed = false;
          if (changedLocale) this.data_.onLocaleChange?.(getLocale());
          this.render();
        });
        break;
    }
  }

  private exit(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.stop();
    this.data_.onExit();
  }
}

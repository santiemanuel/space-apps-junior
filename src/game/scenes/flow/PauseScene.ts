import Phaser from 'phaser';
import { getLocale, LOCALES, setLocale, t } from '../../../i18n';
import { formatTime } from '../../../i18n/format';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addPanel, addShade, addText, COLOR, onKeys, type Button } from '../../ui/ui';
import type { PhaseSceneData } from '../sceneData';

/**
 * Datos de `Pause`. El guardado se pide por el bus (`save:requested` → `save:completed`); continuar y salir al menú
 * los resuelve quien abrió la pausa (el director del flujo), igual que en `Title`.
 */
export interface PauseSceneData extends PhaseSceneData {
  onResume(): void;
  onExit(): void;
  /** Guarda el idioma elegido (preferencia del jugador). */
  onLocaleChange?(locale: string): void;
}

type PauseItem = 'resume' | 'save' | 'saveAndExit' | 'language';
const ITEMS: readonly PauseItem[] = ['resume', 'save', 'saveAndExit', 'language'];
const CENTER = GAME_WIDTH / 2;

/** Pausa (Esc, §3.9): continuar, guardar, guardar y salir, e idioma. El tiempo de la misión no corre. */
export class PauseScene extends Phaser.Scene {
  private data_!: PauseSceneData;
  private buttons: Button[] = [];
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
    this.texts = {
      title: addText(this, CENTER, 195, 30, COLOR.title).setOrigin(0.5),
      hint: addText(this, CENTER, 236, 14, COLOR.muted, { align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5),
      status: addText(this, CENTER, 528, 14, COLOR.ok).setOrigin(0.5),
      controls: addText(this, CENTER, 600, 13, COLOR.dim).setOrigin(0.5),
    };
    this.buttons = ITEMS.map((item, index) =>
      addButton(this, CENTER, 300 + index * 56, () => this.activate(item), { size: 18, onHover: () => this.focus(index) }),
    );
    this.render();

    const off = this.data_.bus.on('save:completed', ({ savedAt }) => {
      this.savedAt = new Date(savedAt);
      this.render();
      if (this.exiting) this.exit();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    onKeys(this, (code) => {
      if (code === 'ArrowUp' || code === 'KeyW') this.focus((this.cursor - 1 + ITEMS.length) % ITEMS.length);
      else if (code === 'ArrowDown' || code === 'KeyS') this.focus((this.cursor + 1) % ITEMS.length);
      else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.activate(ITEMS[this.cursor]!);
      else if ((code === 'ArrowLeft' || code === 'ArrowRight') && ITEMS[this.cursor] === 'language') this.activate('language');
      else if (code === 'Escape' && this.time.now - this.openedAt > 250) this.activate('resume');
    });
  }

  private render(): void {
    const { title, hint, status, controls } = this.texts;
    title.setText(t('menu.pause.sceneTitle'));
    hint.setText(t('menu.pause.hint'));
    controls.setText(t('menu.pause.controls'));
    ITEMS.forEach((item, index) => this.buttons[index]!.setLabel(this.label(item)).setFocused(index === this.cursor));
    status.setText(this.savedAt ? t('menu.pause.saved', { time: formatTime(this.savedAt) }) : '');
  }

  private label(item: PauseItem): string {
    if (item !== 'language') return t(`menu.pause.${item}`);
    return `${t('menu.title.language')}:  ‹ ${t(`common.language.${getLocale()}`)} ›`;
  }

  private focus(index: number): void {
    this.cursor = index;
    this.render();
  }

  private activate(item: PauseItem): void {
    if (this.closed) return;
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
      case 'language': {
        const next = LOCALES[(LOCALES.indexOf(getLocale()) + 1) % LOCALES.length]!;
        setLocale(next);
        this.data_.onLocaleChange?.(next);
        this.render();
        break;
      }
    }
  }

  private exit(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.stop();
    this.data_.onExit();
  }
}

import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { MISSION_START } from '../../../content/missionStart';
import { createNewGame } from '../../../core/flow/newGame';
import { TitleMenu, type TitleRowId } from '../../../core/flow/titleMenu';
import type { UnlockLevel } from '../../../core/flow/types';
import { unlockLevelFor } from '../../../core/progression/progression';
import { Rng } from '../../../core/rng/Rng';
import { loadGame, loadProgression, saveSettings } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import type { GameState } from '../../../core/state/types';
import { getLocale, LOCALES, setLocale, t } from '../../../i18n';
import { formatDate } from '../../../i18n/format';
import { isLocale } from '../../../i18n/locales';
import { CREW_SHEET, crewTextureKey } from '../../assets';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { onKeys } from '../../ui/ui';

/**
 * Datos de `Title`. Es la entrada del juego: todavía no hay partida ni bus, así que avisa la elección por
 * callbacks que conecta quien la arranca (hoy `Boot`, en la integración `MissionFlow`).
 */
export interface TitleSceneData {
  store: SaveStore;
  onNewGame(state: GameState): void;
  onContinue(state: GameState): void;
}

const FONT = 'monospace';
const COLOR = { text: '#e2e8f0', focus: '#fbd38d', muted: '#a0aec0', title: '#90cdf4', locked: '#f6ad55' } as const;
const CENTER = GAME_WIDTH / 2;
const ROWS = { top: 220, gap: 50 } as const;
const CREW = { feetY: 560, scale: 0.6, x: [110, 230, 1050, 1170] } as const;

/** Menú principal (§2.1, §3.3, §8): idioma, campaña o modo libre, corta o larga, modo ayuda y continuar. */
export class TitleScene extends Phaser.Scene {
  private data_!: TitleSceneData;
  private menu!: TitleMenu;
  private saved: GameState | null = null;
  private unlockLevel: UnlockLevel = 1;
  private completedMissions = 0;
  private leaving = false;
  private texts!: {
    title: Phaser.GameObjects.Text;
    subtitle: Phaser.GameObjects.Text;
    level: Phaser.GameObjects.Text;
    rows: Phaser.GameObjects.Text[];
    description: Phaser.GameObjects.Text;
    locked: Phaser.GameObjects.Text;
    controls: Phaser.GameObjects.Text;
    roles: Phaser.GameObjects.Text[];
  };

  constructor() {
    super(SceneKeys.Title);
  }

  init(data: TitleSceneData): void {
    this.data_ = data;
    this.leaving = false;
    this.saved = loadGame(data.store);
    this.completedMissions = loadProgression(data.store).completedMissions;
    this.unlockLevel = unlockLevelFor(this.completedMissions);
    this.menu = new TitleMenu({ hasSave: this.saved !== null, unlockLevel: this.unlockLevel, locales: LOCALES, locale: getLocale() });
  }

  create(): void {
    this.drawBackdrop();
    const text = (y: number, size: number, color: string) =>
      this.add.text(CENTER, y, '', { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

    this.texts = {
      title: text(80, 48, COLOR.title),
      subtitle: text(132, 18, COLOR.muted),
      level: this.add.text(GAME_WIDTH - 24, 20, '', { fontFamily: FONT, fontSize: '14px', color: COLOR.muted }).setOrigin(1, 0),
      rows: this.menu.rows.map((_row, index) =>
        text(ROWS.top + index * ROWS.gap, 24, COLOR.text)
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => this.after(() => this.menu.select(index)))
          .on('pointerdown', () => this.activate()),
      ),
      description: text(545, 18, COLOR.muted).setWordWrapWidth(680),
      locked: text(595, 16, COLOR.locked),
      controls: text(690, 14, COLOR.muted),
      roles: this.drawCrew(),
    };

    onKeys(this, (code) => this.onKey(code));
    this.render();
  }

  private onKey(code: string): void {
    if (code === 'ArrowUp' || code === 'KeyW') this.after(() => this.menu.move(-1));
    else if (code === 'ArrowDown' || code === 'KeyS') this.after(() => this.menu.move(1));
    else if (code === 'ArrowLeft' || code === 'KeyA') this.after(() => this.menu.change(-1));
    else if (code === 'ArrowRight' || code === 'KeyD') this.after(() => this.menu.change(1));
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.activate();
  }

  /** Aplica un cambio del menú, guarda el idioma si cambió y vuelve a pintar. */
  private after(change: () => void): void {
    if (this.leaving) return;
    change();
    this.refresh();
  }

  private refresh(): void {
    if (this.menu.locale !== getLocale() && isLocale(this.menu.locale)) {
      setLocale(this.menu.locale);
      saveSettings(this.data_.store, { locale: this.menu.locale });
    }
    this.render();
  }

  private activate(): void {
    if (this.leaving) return;
    const action = this.menu.activate();
    this.refresh();
    if (action === 'continue' && this.saved) {
      this.leaving = true;
      this.data_.onContinue(this.saved);
    } else if (action === 'newGame') {
      this.leaving = true;
      // La semilla sale del reloj; desde acá todo el azar de la partida pasa por Rng.
      this.data_.onNewGame(createNewGame(this.menu.setup, { seed: Date.now(), unlockLevel: this.unlockLevel, start: MISSION_START }));
    }
  }

  private render(): void {
    const { texts, menu } = this;
    texts.title.setText(t('common.appTitle'));
    texts.subtitle.setText(t('menu.title.subtitle'));
    texts.level.setText(t('menu.title.level', { level: this.unlockLevel, missions: this.completedMissions }));
    texts.controls.setText(t('menu.title.controls'));
    menu.rows.forEach((row, index) => {
      const focused = index === menu.cursor;
      texts.rows[index]!.setText(`${focused ? '▶ ' : '  '}${this.rowLabel(row)}`).setColor(focused ? COLOR.focus : COLOR.text);
    });
    texts.description.setText(this.rowDescription(menu.current));
    texts.locked.setText(
      menu
        .lockedOptions(menu.current)
        .map(({ option, level }) =>
          t('menu.title.locked', { option: t(`menu.title.${menu.current}.${option}`), level }),
        )
        .join('   '),
    );
    CREW_ROSTER.forEach(({ role }, index) => texts.roles[index]?.setText(t(`common.role.${role}`)));
  }

  private rowLabel(row: TitleRowId): string {
    const { setup, locale } = this.menu;
    const option = (label: string, value: string) => `${label}:  ‹ ${value} ›`;
    switch (row) {
      case 'continue': {
        const saved = this.saved!;
        const detail = t('menu.title.continue.detail', { phase: t(`common.phase.${saved.phase}`), date: formatDate(saved.simDate) });
        return `${t('menu.title.continue')} (${detail})`;
      }
      case 'newGame':
        return t(this.menu.confirmingNewGame ? 'menu.title.newGame.confirm' : 'menu.title.newGame');
      case 'mode':
        return option(t('menu.title.mode'), t(`menu.title.mode.${setup.mode}`));
      case 'length':
        return option(t('menu.title.length'), t(`menu.title.length.${setup.length}`));
      case 'helpMode':
        return option(t('menu.title.helpMode'), t(setup.helpMode ? 'menu.title.helpMode.on' : 'menu.title.helpMode.off'));
      case 'language':
        return option(t('menu.title.language'), t(`common.language.${locale}`));
    }
  }

  private rowDescription(row: TitleRowId): string {
    if (row === 'newGame' && this.menu.confirmingNewGame) return t('menu.title.newGame.confirmDescription');
    if (row === 'mode') return t(`menu.title.mode.${this.menu.setup.mode}.description`);
    return t(`menu.title.${row}.description`);
  }

  /** Estrellas fijas (misma semilla siempre) y Marte en la esquina. */
  private drawBackdrop(): void {
    const { width, height } = this.scale;
    const rng = new Rng(2024);
    const stars = this.add.graphics();
    for (let i = 0; i < 160; i++) {
      stars.fillStyle(0xffffff, rng.between(0.2, 0.9)).fillRect(Math.floor(rng.between(0, width)), Math.floor(rng.between(0, height)), 2, 2);
    }
    this.add.circle(width - 150, 120, 46, 0xc05621);
    this.add.circle(width - 165, 108, 10, 0x9c4221);
    this.add.circle(width - 132, 136, 7, 0x9c4221);
  }

  /** La tripulación de frente, con las hojas que cargó `Boot`. Devuelve los textos de rol para traducirlos. */
  private drawCrew(): Phaser.GameObjects.Text[] {
    return CREW_ROSTER.map(({ id, name }, index) => {
      const x = CREW.x[index]!;
      if (this.textures.exists(crewTextureKey(id))) {
        this.add.sprite(x, CREW.feetY, crewTextureKey(id), 0).setOrigin(CREW_SHEET.origin.x, CREW_SHEET.origin.y).setScale(CREW.scale);
      }
      this.add.text(x, CREW.feetY + 14, name, { fontFamily: FONT, fontSize: '16px', color: COLOR.text }).setOrigin(0.5, 0);
      return this.add.text(x, CREW.feetY + 36, '', { fontFamily: FONT, fontSize: '12px', color: COLOR.muted }).setOrigin(0.5, 0);
    });
  }
}

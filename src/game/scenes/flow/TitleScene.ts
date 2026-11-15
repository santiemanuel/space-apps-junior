import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { MISSION_START } from '../../../content/missionStart';
import { createNewGame } from '../../../core/flow/newGame';
import { TitleMenu, type TitleRowId } from '../../../core/flow/titleMenu';
import type { UnlockLevel } from '../../../core/flow/types';
import { unlockLevelFor } from '../../../core/progression/progression';
import { loadGame, loadProgression, saveSettings } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import type { GameState } from '../../../core/state/types';
import { getLocale, LOCALES, setLocale, t } from '../../../i18n';
import { formatDate } from '../../../i18n/format';
import { isLocale } from '../../../i18n/locales';
import { CREW_SHEET, crewTextureKey, TitleTextures } from '../../assets';
import { crewAnimKey } from '../../entities/crewAnimations';
import { ensureCrewAnimations } from '../../entities/CrewSprite';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { fadeIn, onKeys, pulse } from '../../ui/ui';
import { openCredits } from './creditsPanel';
import { openSettings } from './settingsPanel';
import { TitleSky } from './titleSky';
import { audio } from '../../audio/audio';
import type { SfxId } from '../../audio/themes';

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
const COLOR = { text: '#e2e8f0', focus: '#fbd38d', muted: '#a0aec0', dim: '#718096', locked: '#f6ad55' } as const;
const CENTER = GAME_WIDTH / 2;
/** Logotipo (512 × 512, con el nombre del juego) a la mitad: cada píxel de arte queda en 2 × 2 de pantalla. */
const LOGO = { top: -22, scale: 0.5 } as const;
/** Tripulación flotando en ingravidez a los costados del menú (pies del sprite en cada punto). */
const CREW = { scale: 1.5, spots: [{ x: 115, y: 345 }, { x: 235, y: 255 }, { x: 1205, y: 345 }, { x: 1110, y: 520 }] } as const;
/**
 * Panel de opciones: angosto y compacto. Arriba las acciones (continuar, nueva misión) como botones; abajo los
 * ajustes en filas de etiqueta y valor; al pie, la explicación de la opción elegida.
 */
const PANEL = { width: 500, top: 238, pad: 20, primaryHeight: 44, primaryGap: 8, rowHeight: 34, groupGap: 14, footer: 66 } as const;
const PANEL_LEFT = CENTER - PANEL.width / 2;
const INNER = { left: PANEL_LEFT + PANEL.pad, width: PANEL.width - PANEL.pad * 2 } as const;
const PRIMARY: readonly TitleRowId[] = ['continue', 'newGame'];

interface RowView {
  id: TitleRowId;
  /** Centro vertical de la fila. */
  y: number;
  primary: boolean;
  box: Phaser.GameObjects.Rectangle | null;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
}

/** Menú principal (§2.1, §3.3, §8): idioma, campaña o modo libre, corta o larga, modo ayuda, continuar y créditos. */
export class TitleScene extends Phaser.Scene {
  private data_!: TitleSceneData;
  private menu!: TitleMenu;
  private saved: GameState | null = null;
  private unlockLevel: UnlockLevel = 1;
  private completedMissions = 0;
  private leaving = false;
  private sky!: TitleSky;
  private rows: RowView[] = [];
  private focusBar!: Phaser.GameObjects.Container;
  private focusedRow = -1;
  private texts!: {
    subtitle: Phaser.GameObjects.Text;
    level: Phaser.GameObjects.Text;
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
    this.rows = [];
    this.focusedRow = -1;
    this.saved = loadGame(data.store);
    this.completedMissions = loadProgression(data.store).completedMissions;
    this.unlockLevel = unlockLevelFor(this.completedMissions);
    this.menu = new TitleMenu({ hasSave: this.saved !== null, unlockLevel: this.unlockLevel, locales: LOCALES, locale: getLocale() });
  }

  create(): void {
    this.sky = new TitleSky(this);
    const text = (x: number, y: number, size: number, color: string) => this.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color });

    const logo = this.add.image(CENTER, LOGO.top, TitleTextures.logo).setOrigin(0.5, 0).setScale(LOGO.scale);
    const subtitle = text(CENTER, 214, 16, COLOR.muted).setOrigin(0.5);
    const panel = this.add.container(0, 0);
    const bottom = this.buildRows(panel);
    const description = text(INNER.left, bottom + 12, 13, COLOR.muted).setWordWrapWidth(INNER.width).setLineSpacing(3);
    const locked = text(INNER.left, bottom + 12 + 38, 12, COLOR.locked).setWordWrapWidth(INNER.width);
    panel.add([description, locked]);
    panel.addAt(this.panelBackground(bottom + PANEL.footer + 4), 0);

    this.texts = {
      subtitle,
      level: text(GAME_WIDTH - 24, 20, 13, COLOR.dim).setOrigin(1, 0),
      description,
      locked,
      controls: text(CENTER, 690, 13, COLOR.dim).setOrigin(0.5),
      roles: this.drawCrew(),
    };

    onKeys(this, (code) => this.onKey(code));
    this.render();
    // Entrada: el logotipo baja, el panel sube y el logotipo flota despacio.
    fadeIn(this, [logo, subtitle], { duration: 500, rise: -14 });
    fadeIn(this, panel, { duration: 480, rise: 18, delay: 160 });
    this.time.delayedCall(700, () => this.tweens.add({ targets: logo, y: logo.y - 4, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
  }

  update(_time: number, deltaMs: number): void {
    this.sky.update(deltaMs / 1000);
  }

  /** Arma las filas dentro del panel y devuelve dónde terminan (y de la última fila). */
  private buildRows(panel: Phaser.GameObjects.Container): number {
    let y = PANEL.top + PANEL.pad;
    let wasPrimary = true;
    const bar = this.add.rectangle(0, 0, INNER.width + 12, PANEL.rowHeight - 4, 0xfbd38d, 0.12).setOrigin(0, 0.5);
    const accent = this.add.rectangle(0, 0, 3, PANEL.rowHeight - 12, 0xfbd38d).setOrigin(0, 0.5);
    this.focusBar = this.add.container(INNER.left - 6, 0, [bar, accent]).setAlpha(0);
    panel.add(this.focusBar);

    this.menu.rows.forEach((id, index) => {
      const primary = PRIMARY.includes(id);
      if (!primary && wasPrimary) {
        y += PANEL.groupGap - PANEL.primaryGap;
        panel.add(this.add.rectangle(INNER.left, y - PANEL.groupGap / 2, INNER.width, 1, 0x4a5568, 0.7).setOrigin(0, 0.5));
      }
      wasPrimary = primary;
      const height = primary ? PANEL.primaryHeight : PANEL.rowHeight;
      const centerY = y + height / 2;
      const box = primary
        ? this.add.rectangle(INNER.left, centerY, INNER.width, height, 0x1e293b, 0.95).setOrigin(0, 0.5).setStrokeStyle(1, 0x475569)
        : null;
      const label = this.add
        .text(INNER.left + (primary ? 16 : 10), centerY, '', { fontFamily: FONT, fontSize: primary ? '18px' : '15px', color: COLOR.text })
        .setOrigin(0, 0.5);
      const value = this.add
        .text(INNER.left + INNER.width - (primary ? 16 : 10), centerY, '', { fontFamily: FONT, fontSize: primary ? '12px' : '15px', color: COLOR.text })
        .setOrigin(1, 0.5);
      const hit = this.add.rectangle(INNER.left, centerY, INNER.width, height, 0xffffff, 0.001).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.after(() => this.menu.select(index), 'hover'));
      hit.on('pointerdown', () => this.activate());
      panel.add([...(box ? [box] : []), label, value, hit]);
      this.rows.push({ id, y: centerY, primary, box, label, value });
      y += height + (primary ? PANEL.primaryGap : 0);
    });
    return y;
  }

  /** Fondo del panel: oscuro y translúcido, con borde y una línea de brillo arriba. */
  private panelBackground(bottom: number): Phaser.GameObjects.Graphics {
    const height = bottom - PANEL.top;
    return this.add
      .graphics()
      .fillStyle(0x0b1220, 0.8)
      .fillRoundedRect(PANEL_LEFT, PANEL.top, PANEL.width, height, 14)
      .lineStyle(1, 0x334155, 1)
      .strokeRoundedRect(PANEL_LEFT, PANEL.top, PANEL.width, height, 14)
      .lineStyle(2, 0x90cdf4, 0.25)
      .lineBetween(PANEL_LEFT + 18, PANEL.top + 1, PANEL_LEFT + PANEL.width - 18, PANEL.top + 1);
  }

  private onKey(code: string): void {
    if (this.leaving) return;
    if (code === 'ArrowUp' || code === 'KeyW') this.after(() => this.menu.move(-1), 'hover');
    else if (code === 'ArrowDown' || code === 'KeyS') this.after(() => this.menu.move(1), 'hover');
    else if (code === 'ArrowLeft' || code === 'KeyA') this.after(() => this.menu.change(-1), 'toggle');
    else if (code === 'ArrowRight' || code === 'KeyD') this.after(() => this.menu.change(1), 'toggle');
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.activate();
  }

  /** Aplica un cambio del menú, guarda el idioma si cambió y vuelve a pintar. */
  private after(change: () => void, sound?: SfxId): void {
    if (this.leaving) return;
    if (sound) audio.sfx(sound);
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
    audio.sfx('select');
    const action = this.menu.activate();
    this.refresh();
    if (action === 'continue' && this.saved) {
      this.leaving = true;
      this.data_.onContinue(this.saved);
    } else if (action === 'settings') {
      this.leaving = true;
      openSettings(this, this.data_.store, () => {
        this.leaving = false;
        this.menu.locale = getLocale();
        this.render();
      });
    } else if (action === 'credits') {
      this.leaving = true;
      audio.sfx('open');
      openCredits(this, () => {
        this.leaving = false;
        this.render();
      });
    } else if (action === 'newGame') {
      this.leaving = true;
      audio.sfx('missionStart');
      // La semilla sale del reloj; desde acá todo el azar de la partida pasa por Rng.
      this.data_.onNewGame(createNewGame(this.menu.setup, { seed: Date.now(), unlockLevel: this.unlockLevel, start: MISSION_START }));
    }
  }

  private render(): void {
    const { texts, menu } = this;
    texts.subtitle.setText(t('menu.title.subtitle'));
    texts.level.setText(t('menu.title.level', { level: this.unlockLevel, missions: this.completedMissions }));
    texts.controls.setText(t('menu.title.controls'));
    this.rows.forEach((row, index) => {
      const focused = index === menu.cursor;
      const { label, value } = this.rowTexts(row.id);
      const confirming = row.id === 'newGame' && menu.confirmingNewGame;
      row.label.setText(label).setColor(focused ? COLOR.focus : row.primary ? COLOR.text : COLOR.muted);
      row.label.setFontSize(row.primary ? (confirming ? 14 : 18) : 15);
      // Un valor que cambia late, para que se note el cambio.
      if (row.value.text && row.value.text !== value && !row.primary) pulse(this, row.value, { scale: 1.15, duration: 200 });
      row.value.setText(value).setColor(row.primary ? COLOR.dim : focused ? COLOR.focus : COLOR.text);
      row.box?.setStrokeStyle(focused ? 2 : 1, focused ? 0xfbd38d : 0x475569).setFillStyle(focused ? 0x273449 : 0x1e293b, 0.95);
    });
    this.moveFocus(menu.cursor);
    texts.description.setText(this.rowDescription(menu.current));
    texts.locked.setText(
      menu
        .lockedOptions(menu.current)
        .map(({ option, level }) => t('menu.title.locked', { option: t(`menu.title.${menu.current}.${option}`), level }))
        .join('   '),
    );
    CREW_ROSTER.forEach(({ role }, index) => texts.roles[index]?.setText(t(`common.role.${role}`)));
  }

  /** La barra de foco se desliza hasta la fila elegida; en los botones de arriba se apaga (ellos se resaltan solos). */
  private moveFocus(index: number): void {
    if (index === this.focusedRow) return;
    const row = this.rows[index];
    if (!row) return;
    const first = this.focusedRow === -1;
    this.focusedRow = index;
    this.tweens.killTweensOf(this.focusBar);
    if (row.primary) {
      this.tweens.add({ targets: this.focusBar, alpha: 0, duration: 120 });
      return;
    }
    if (first || this.focusBar.alpha === 0) this.focusBar.setY(row.y);
    this.tweens.add({ targets: this.focusBar, y: row.y, alpha: 1, duration: 140, ease: 'Cubic.Out' });
  }

  private rowTexts(row: TitleRowId): { label: string; value: string } {
    const { setup, locale } = this.menu;
    const choice = (value: string) => `‹ ${value} ›`;
    switch (row) {
      case 'continue': {
        const saved = this.saved!;
        return {
          label: t('menu.title.continue'),
          value: t('menu.title.continue.detail', { phase: t(`common.phase.${saved.phase}`), date: formatDate(saved.simDate) }),
        };
      }
      case 'newGame':
        return { label: t(this.menu.confirmingNewGame ? 'menu.title.newGame.confirm' : 'menu.title.newGame'), value: '' };
      case 'mode':
        return { label: t('menu.title.mode'), value: choice(t(`menu.title.mode.${setup.mode}`)) };
      case 'length':
        return { label: t('menu.title.length'), value: choice(t(`menu.title.length.${setup.length}`)) };
      case 'helpMode':
        return { label: t('menu.title.helpMode'), value: choice(t(setup.helpMode ? 'menu.title.helpMode.on' : 'menu.title.helpMode.off')) };
      case 'language':
        return { label: t('menu.title.language'), value: choice(t(`common.language.${locale}`)) };
      case 'settings':
        return { label: t('menu.settings.title'), value: `${t('menu.settings.summary')} ›` };
      case 'credits':
        return { label: t('menu.title.credits'), value: `${t('menu.title.credits.summary')} ›` };
    }
  }

  private rowDescription(row: TitleRowId): string {
    if (row === 'newGame' && this.menu.confirmingNewGame) return t('menu.title.newGame.confirmDescription');
    if (row === 'mode') return t(`menu.title.mode.${this.menu.setup.mode}.description`);
    return t(`menu.title.${row}.description`);
  }

  /**
   * La tripulación flota en ingravidez a los costados del menú: sube y baja despacio, se mece de costado y parpadea.
   * Devuelve los textos de rol para traducirlos.
   */
  private drawCrew(): Phaser.GameObjects.Text[] {
    return CREW_ROSTER.map(({ id, name }, index) => {
      const spot = CREW.spots[index]!;
      const crew = this.add.container(spot.x, spot.y);
      if (ensureCrewAnimations(this, id)) {
        const sprite = this.add.sprite(0, 0, crewTextureKey(id), 0).setOrigin(CREW_SHEET.origin.x, CREW_SHEET.origin.y).setScale(CREW.scale);
        sprite.play({ key: crewAnimKey(id, 'idle', 'down'), startFrame: index % 2 });
        crew.add(sprite);
        // Vaivén de costado en lugar de girar: rotar las hojas con normal map recorta el dibujo en Phaser 4.
        this.tweens.add({ targets: sprite, x: index % 2 ? 5 : -5, duration: 3100 + index * 400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      const role = this.add.text(0, 36, '', { fontFamily: FONT, fontSize: '12px', color: COLOR.muted }).setOrigin(0.5, 0);
      crew.add([this.add.text(0, 14, name, { fontFamily: FONT, fontSize: '16px', color: COLOR.text }).setOrigin(0.5, 0), role]);
      fadeIn(this, crew, { duration: 600, rise: 20, delay: 250 + index * 120 });
      this.time.delayedCall(900 + index * 120, () =>
        this.tweens.add({ targets: crew, y: spot.y - 12, duration: 2300 + index * 350, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      );
      return role;
    });
  }
}

import Phaser from 'phaser';
import { OUTBOUND_ORDER, OUTBOUND_PROFILES } from '../../../content/loadouts';
import type { LoadoutProfile } from '../../../core/flow/types';
import { outboundResult } from '../../../core/loadout/loadout';
import { isUnlocked, UNLOCK_AT } from '../../../core/progression/progression';
import { t } from '../../../i18n';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addText, COLOR, fadeIn, LIGHT_COLOR, listenUntilShutdown, onKeys, PANEL } from '../../ui/ui';
import type { LoadoutSceneData } from '../sceneData';
import { CargoGridView } from './cargoGridView';

const CENTER = GAME_WIDTH / 2;
const CARD = { width: 340, height: 390, top: 150, gap: 380 } as const;

const dots = (level: number) => '●'.repeat(level) + '○'.repeat(3 - level);

/**
 * Carga de la nave (§4.1, §4.5). `outbound`: tres perfiles con su efecto y su semáforo, bloqueados por nivel (§6).
 * `return`: una bodega de casilleros donde se acomodan las piezas (`CargoGridView`). Las reglas están en `core/loadout`.
 */
export class LoadoutScene extends Phaser.Scene {
  private data_!: LoadoutSceneData;
  private view!: Phaser.GameObjects.Container;
  private done = false;
  // Ida
  private selected: LoadoutProfile = 'balanced';
  // Vuelta
  private cargoView: CargoGridView | null = null;

  constructor() {
    super(SceneKeys.Loadout);
  }

  init(data: LoadoutSceneData): void {
    this.data_ = data;
    this.done = false;
    this.cargoView = null;
    if (data.mode === 'outbound') {
      this.selected = isUnlocked(data.state.unlockLevel, 'loadout', data.state.loadout ?? 'balanced') ? (data.state.loadout ?? 'balanced') : 'balanced';
    }
  }

  create(): void {
    this.view = this.add.container(0, 0);
    if (this.data_.mode === 'return') {
      this.cargoView = new CargoGridView(this, this.data_, this.view, () => this.header('menu.loadout.return.title', 'loadout.return.subtitle', 'loadout.return.controls'));
    }
    onKeys(this, (code, event) => (this.cargoView ? this.cargoView.onKey(code, event) : this.onOutboundKey(code)));
    listenUntilShutdown(this, this.events, Phaser.Scenes.Events.RESUME, () => this.render());
    this.render();
    fadeIn(this, this.view, { duration: 320, rise: 14 });
  }

  private render(): void {
    this.view.removeAll(true);
    if (this.cargoView) return this.cargoView.render();
    this.renderOutbound();
  }

  private header(titleKey: 'menu.loadout.outbound.title' | 'menu.loadout.return.title', subtitleKey: string, controlsKey: string): void {
    this.view.add([
      addText(this, CENTER, this.cargoView ? 40 : 56, 32, COLOR.title).setOrigin(0.5).setText(t(titleKey)),
      addText(this, CENTER, this.cargoView ? 72 : 100, 16, COLOR.muted, { align: 'center', wordWrap: { width: 1100 } }).setOrigin(0.5, 0).setText(t(`menu.${subtitleKey}`)),
      addText(this, CENTER, 695, 14, COLOR.dim).setOrigin(0.5).setText(t(`menu.${controlsKey}`)),
    ]);
  }

  // --- Ida ---

  private unlocked(profile: LoadoutProfile): boolean {
    return isUnlocked(this.data_.state.unlockLevel, 'loadout', profile);
  }

  private renderOutbound(): void {
    this.header('menu.loadout.outbound.title', 'loadout.outbound.subtitle', 'loadout.outbound.controls');
    OUTBOUND_ORDER.forEach((id, index) => {
      const profile = OUTBOUND_PROFILES[id];
      const x = CENTER + (index - 1) * CARD.gap;
      const left = x - CARD.width / 2 + 24;
      const unlocked = this.unlocked(id);
      const focused = id === this.selected;
      const card = this.add
        .rectangle(x, CARD.top, CARD.width, CARD.height, PANEL.fill, 0.95)
        .setOrigin(0.5, 0)
        .setStrokeStyle(focused ? 4 : 2, focused ? PANEL.focus : PANEL.stroke)
        .setInteractive({ useHandCursor: unlocked });
      card.on('pointerdown', () => unlocked && this.selectProfile(id));
      const parts: Phaser.GameObjects.GameObject[] = [
        card,
        addText(this, x, CARD.top + 30, 24, focused ? COLOR.focus : COLOR.text).setOrigin(0.5).setText(t(`menu.loadout.profile.${id}`)),
        addText(this, x, CARD.top + 62, 14, COLOR.muted, { align: 'center', wordWrap: { width: CARD.width - 40 } })
          .setOrigin(0.5, 0)
          .setText(t(`menu.loadout.profile.${id}.description`)),
      ];
      const items = [
        ['menu.loadout.item.water', profile.levels.water],
        ['menu.loadout.item.spares', profile.levels.spares],
        ['menu.loadout.item.food', profile.levels.food],
      ] as const;
      items.forEach(([key, level], i) => {
        const y = CARD.top + 170 + i * 30;
        parts.push(addText(this, left, y, 15).setText(t(key)), addText(this, x + CARD.width / 2 - 24, y, 15, COLOR.focus).setOrigin(1, 0).setText(dots(level)));
      });
      (['radiation', 'repairs'] as const).forEach((risk, i) => {
        const y = CARD.top + 290 + i * 32;
        const light = profile.lights[risk];
        parts.push(
          this.add.circle(left + 8, y + 9, 8, LIGHT_COLOR[light]),
          addText(this, left + 26, y, 15).setText(`${t(`menu.loadout.risk.${risk}`)}: ${t(`common.light.${light}`)}`),
        );
      });
      if (!unlocked) {
        card.setAlpha(0.5);
        parts.slice(1).forEach((p) => (p as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0.35));
        parts.push(
          addText(this, x, CARD.top + CARD.height - 24, 15, COLOR.warn).setOrigin(0.5).setText(t('menu.loadout.locked', { level: UNLOCK_AT.loadout[id] })),
        );
      } else if (focused) {
        parts.push(addText(this, x, CARD.top + CARD.height - 24, 15, COLOR.focus).setOrigin(0.5).setText(`▶ ${t('menu.loadout.selected')}`));
      }
      this.view.add(parts);
    });
    const button = addButton(this, CENTER, 630, () => this.confirmOutbound(), { size: 22 }).setLabel(t('menu.loadout.outbound.confirm')).setFocused(true);
    this.view.add([
      addText(this, CENTER, 574, 15, COLOR.muted, { align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5).setText(t('menu.loadout.outbound.fact')),
      button.text,
    ]);
  }

  private selectProfile(id: LoadoutProfile): void {
    this.selected = id;
    this.render();
  }

  private moveProfile(delta: number): void {
    const options = OUTBOUND_ORDER.filter((p) => this.unlocked(p));
    const index = options.indexOf(this.selected);
    this.selectProfile(options[(index + delta + options.length) % options.length]!);
  }

  private confirmOutbound(): void {
    if (this.done || !this.unlocked(this.selected)) return;
    this.done = true;
    this.data_.bus.emit('phase:completed', outboundResult(this.data_.state, OUTBOUND_PROFILES[this.selected]));
  }

  private onOutboundKey(code: string): void {
    if (code === 'ArrowLeft' || code === 'KeyA') this.moveProfile(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') this.moveProfile(1);
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.confirmOutbound();
  }

  // --- Vuelta: bodega de casilleros (`CargoGridView`) ---
}

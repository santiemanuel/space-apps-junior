import Phaser from 'phaser';
import { OUTBOUND_ORDER, OUTBOUND_PROFILES, RETURN_RULES } from '../../../content/loadouts';
import type { LoadoutProfile } from '../../../core/flow/types';
import {
  adjustCargo, availableForReturn, CARGO_FIELDS, cargoMass, initialReturnCargo, outboundResult, returnResult, samplesValue,
  supplyLight, withinLimit, type CargoField, type ReturnAvailable, type ReturnCargo,
} from '../../../core/loadout/loadout';
import { isUnlocked, UNLOCK_AT } from '../../../core/progression/progression';
import { t } from '../../../i18n';
import { formatNumber } from '../../../i18n/format';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addText, COLOR, LIGHT_COLOR, listenUntilShutdown, onKeys, PANEL, type Button } from '../../ui/ui';
import type { LoadoutSceneData } from '../sceneData';

const CENTER = GAME_WIDTH / 2;
const CARD = { width: 340, height: 390, top: 150, gap: 380 } as const;
const MASS_BAR = { x: 240, y: 520, width: 800, height: 18 } as const;
const ROWS = { top: 185, gap: 60 } as const;

const dots = (level: number) => '●'.repeat(level) + '○'.repeat(3 - level);

/**
 * Carga de la nave (§4.1, §4.5). `outbound`: tres perfiles con su efecto y su semáforo, bloqueados por nivel (§6).
 * `return`: muestras contra comida, agua y repuestos con un límite de masa. Las reglas están en `core/loadout`.
 */
export class LoadoutScene extends Phaser.Scene {
  private data_!: LoadoutSceneData;
  private view!: Phaser.GameObjects.Container;
  private done = false;
  // Ida
  private selected: LoadoutProfile = 'balanced';
  // Vuelta
  private available!: ReturnAvailable;
  private cargo!: ReturnCargo;
  private row = 0;
  private confirm: Button | null = null;

  constructor() {
    super(SceneKeys.Loadout);
  }

  init(data: LoadoutSceneData): void {
    this.data_ = data;
    this.done = false;
    this.row = 0;
    if (data.mode === 'outbound') {
      this.selected = isUnlocked(data.state.unlockLevel, 'loadout', data.state.loadout ?? 'balanced') ? (data.state.loadout ?? 'balanced') : 'balanced';
    } else {
      this.available = availableForReturn(data.state, RETURN_RULES);
      this.cargo = initialReturnCargo(this.available, RETURN_RULES);
    }
  }

  create(): void {
    this.view = this.add.container(0, 0);
    onKeys(this, (code) => (this.data_.mode === 'outbound' ? this.onOutboundKey(code) : this.onReturnKey(code)));
    listenUntilShutdown(this, this.events, Phaser.Scenes.Events.RESUME, () => this.render());
    this.render();
  }

  private render(): void {
    this.view.removeAll(true);
    if (this.data_.mode === 'outbound') this.renderOutbound();
    else this.renderReturn();
  }

  private header(titleKey: 'menu.loadout.outbound.title' | 'menu.loadout.return.title', subtitleKey: string, controlsKey: string): void {
    this.view.add([
      addText(this, CENTER, 56, 32, COLOR.title).setOrigin(0.5).setText(t(titleKey)),
      addText(this, CENTER, 100, 16, COLOR.muted, { align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5, 0).setText(t(`menu.${subtitleKey}`)),
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

  // --- Vuelta ---

  private amount(field: CargoField): string {
    const value = this.cargo[field];
    switch (field) {
      case 'samples':
        return this.available.samples.length
          ? t('menu.loadout.return.samplesDetail', {
              count: value,
              total: this.available.samples.length,
              value: formatNumber(samplesValue(this.cargo, this.available)),
            })
          : t('menu.loadout.return.noSamplesShort');
      case 'foodKg':
        return t('menu.loadout.return.amountKg', { amount: formatNumber(value) });
      case 'waterL':
        return t('menu.loadout.return.amountL', { amount: formatNumber(value) });
      case 'shield':
        return t('menu.loadout.return.amountPercent', { amount: formatNumber(value * 100, undefined, 0) });
      case 'spares':
        return t('menu.loadout.return.amountUnits', { amount: value });
    }
  }

  private recommended(field: Exclude<CargoField, 'samples'>): string {
    const { recommended } = RETURN_RULES;
    const saved = this.cargo;
    this.cargo = { ...saved, [field]: recommended[field] };
    const text = this.amount(field);
    this.cargo = saved;
    return t('menu.loadout.return.recommended', { amount: text });
  }

  private renderReturn(): void {
    this.header('menu.loadout.return.title', 'loadout.return.subtitle', 'loadout.return.controls');
    // Sin muestras, el aviso va bajo el subtítulo: en la fila no entra.
    if (!this.available.samples.length)
      this.view.add(addText(this, CENTER, 128, 15, COLOR.dim).setOrigin(0.5, 0).setText(t('menu.loadout.return.noSamples')));
    CARGO_FIELDS.forEach((field, index) => {
      const y = ROWS.top + index * ROWS.gap;
      const focused = index === this.row;
      const row = this.add
        .rectangle(CENTER, y, 900, 50, PANEL.fill, 0.95)
        .setStrokeStyle(focused ? 3 : 1, focused ? PANEL.focus : PANEL.stroke)
        .setInteractive();
      row.on('pointerover', () => this.focusRow(index));
      const minus = addButton(this, 760, y, () => this.adjust(field, -1), { size: 18, onHover: () => this.focusRow(index) }).setLabel('−');
      const plus = addButton(this, 816, y, () => this.adjust(field, 1), { size: 18, onHover: () => this.focusRow(index) }).setLabel('+');
      this.view.add([
        row,
        addText(this, 210, y, 18, focused ? COLOR.focus : COLOR.text).setOrigin(0, 0.5).setText(`${focused ? '▶ ' : ''}${t(`menu.loadout.return.${field}`)}`),
        addText(this, 720, y, 16).setOrigin(1, 0.5).setText(this.amount(field)),
        minus.text,
        plus.text,
      ]);
      if (field !== 'samples') {
        const light = supplyLight(this.cargo, field, RETURN_RULES);
        this.view.add([
          this.add.circle(862, y, 9, LIGHT_COLOR[light]),
          addText(this, 880, y, 13, COLOR.muted).setOrigin(0, 0.5).setText(this.recommended(field)),
        ]);
      }
    });

    const mass = cargoMass(this.cargo, this.available, RETURN_RULES);
    const ok = withinLimit(this.cargo, this.available, RETURN_RULES);
    const ratio = Math.min(1, mass / RETURN_RULES.massLimitKg);
    this.view.add([
      addText(this, MASS_BAR.x, MASS_BAR.y - 26, 16, ok ? COLOR.text : COLOR.bad).setText(
        t('menu.loadout.return.mass', { mass: formatNumber(mass, undefined, 0), limit: formatNumber(RETURN_RULES.massLimitKg) }),
      ),
      this.add.rectangle(MASS_BAR.x, MASS_BAR.y, MASS_BAR.width, MASS_BAR.height, 0x2d3748).setOrigin(0, 0),
      this.add.rectangle(MASS_BAR.x, MASS_BAR.y, MASS_BAR.width * ratio, MASS_BAR.height, ok ? LIGHT_COLOR.green : LIGHT_COLOR.red).setOrigin(0, 0),
      addText(this, CENTER, 562, 15, ok ? COLOR.muted : COLOR.bad, { align: 'center', wordWrap: { width: 1000 } })
        .setOrigin(0.5)
        .setText(ok ? t('menu.loadout.return.reminder') : t('menu.loadout.return.overLimit')),
    ]);
    this.confirm = addButton(this, CENTER, 630, () => this.confirmReturn(), { size: 22, onHover: () => this.focusRow(CARGO_FIELDS.length) })
      .setLabel(t('menu.loadout.return.confirm'))
      .setEnabled(ok)
      .setFocused(this.row === CARGO_FIELDS.length);
    this.view.add(this.confirm.text);
  }

  private focusRow(index: number): void {
    if (index === this.row) return;
    this.row = index;
    this.render();
  }

  private adjust(field: CargoField, delta: number): void {
    this.cargo = adjustCargo(this.cargo, field, delta, this.available, RETURN_RULES);
    this.render();
  }

  private confirmReturn(): void {
    if (this.done || !withinLimit(this.cargo, this.available, RETURN_RULES)) return;
    this.done = true;
    this.data_.bus.emit('phase:completed', returnResult(this.data_.state, this.cargo, RETURN_RULES));
  }

  private onReturnKey(code: string): void {
    const rows = CARGO_FIELDS.length + 1;
    const field = CARGO_FIELDS[this.row];
    if (code === 'ArrowUp' || code === 'KeyW') this.focusRow((this.row - 1 + rows) % rows);
    else if (code === 'ArrowDown' || code === 'KeyS') this.focusRow((this.row + 1) % rows);
    else if ((code === 'ArrowLeft' || code === 'KeyA') && field) this.adjust(field, -1);
    else if ((code === 'ArrowRight' || code === 'KeyD') && field) this.adjust(field, 1);
    else if (code === 'Enter' || code === 'NumpadEnter') this.confirmReturn();
  }
}

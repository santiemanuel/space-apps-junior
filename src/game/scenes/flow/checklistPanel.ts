import Phaser from 'phaser';
import type { ManeuverRun } from '../../../core/maneuvers/ManeuverRun';
import type { ChecklistDecision, ChecklistItem } from '../../../core/maneuvers/types';
import type { SystemId } from '../../../core/systems/types';
import { t, type TranslationKey } from '../../../i18n';
import { audio } from '../../audio/audio';
import type { SfxId } from '../../audio/themes';
import { HUD_ICONS } from '../../hudIcons';
import { COLOR, LIGHT_COLOR, LIGHT_CSS, reducedMotion, textStyle } from '../../ui/ui';

/** Consola del checklist, a la derecha (el vehículo queda a la vista en el medio). */
export const CHECK_PANEL = { x: 826, y: 80, width: 436 } as const;
const PAD = 14;
const INNER = CHECK_PANEL.width - PAD * 2;
const CARD = { height: 58, gap: 6 } as const;
const CHIP = { height: 28, gap: 6, pad: 10 } as const;
/** Paleta de la consola: metal oscuro con bordes de 2 px, como los botones con tecla de las salas. */
const INK = 0x05070d;
const PLATE = 0x141c30;
const PLATE_HI = 0x26324f;
const CARD_FILL = 0x0f1626;
const FOCUS = 0xfbd38d;
/** Colores de cada decisión: botón (relleno, brillo, sombra) y sello. */
const CHIP_COLOR: Record<ChecklistDecision, { fill: number; shine: number; shade: number; text: string }> = {
  go: { fill: 0x48bb78, shine: 0x9ae6b4, shade: 0x276749, text: '#0b1a12' },
  repair: { fill: 0x4299e1, shine: 0x90cdf4, shade: 0x2c5282, text: '#0b1424' },
  risk: { fill: 0xed8936, shine: 0xfbd38d, shade: 0x9c4221, text: '#1f1206' },
};
const STAMP_CSS: Record<ChecklistDecision, string> = { go: COLOR.ok, repair: '#90cdf4', risk: COLOR.warn };
const DECISION_SFX: Record<ChecklistDecision, SfxId> = { go: 'powerRelay01', repair: 'checklistRepair', risk: 'warning' };

interface Row {
  item: ChecklistItem;
  y: number;
  chips: { decision: ChecklistDecision; enabled: boolean; draw: (focused: boolean) => void }[];
}

/** Lo que la consola recuerda entre un repintado y otro (para animar sólo lo que cambió). */
export interface ChecklistMemory {
  /** Estación que se acaba de confirmar: su sello entra con un golpe. */
  justDecided: number | null;
  /** Dónde estaba el marco de foco (se desliza desde ahí). */
  focusY: number | null;
  /** Ya se festejó que todo quedó en GO. */
  celebrated: boolean;
}

/**
 * Checklist Go / No-Go como una consola de vuelo: cada sistema en su tarjeta (luz, ícono, estado y botones), una
 * barra de avance, el detalle de la estación elegida con lo que se gana y lo que se arriesga, y el botón grande para
 * empezar que cambia según cómo quedó todo. Sólo dibuja: las decisiones las valida `ManeuverRun`.
 */
export class ChecklistPanel {
  private rows: Row[] = [];
  private row = 0;
  private option = 0;
  private readonly focus: Phaser.GameObjects.Graphics;
  private readonly detail: { title: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text };
  private readonly launch: { draw: (focused: boolean) => void };
  private readonly top: number;
  private readonly launchY: number;
  readonly height: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: Phaser.GameObjects.Container,
    private readonly run: ManeuverRun,
    private readonly memory: ChecklistMemory,
    private readonly actions: { decide: (index: number, decision: ChecklistDecision) => void; start: () => void },
  ) {
    const { x, y } = CHECK_PANEL;
    const left = x + PAD;
    const items = run.items;
    const backdrop = this.add(scene.add.graphics());
    // Encabezado: título y repuestos.
    const title = this.add(this.text(left, y + 22, 17, COLOR.text, t('maneuvers.checklist.title')).setOrigin(0, 0.5));
    const spares = this.add(this.text(x + CHECK_PANEL.width - PAD, y + 22, 13, COLOR.focus, `×${run.spares}`).setOrigin(1, 0.5));
    this.icon(spares.x - spares.width - 14, y + 22, 'spares', 1);
    const hint = this.add(this.text(left, y + 48, 12, COLOR.muted, t('maneuvers.checklist.hint'), INNER));
    // Avance: un segmento por estación.
    const done = items.filter((i) => i.decision).length;
    const progressY = Math.ceil(hint.y + hint.height + 10);
    const progressLabel = this.add(this.text(x + CHECK_PANEL.width - PAD, progressY + 5, 12, done === items.length ? COLOR.ok : COLOR.muted, t('maneuvers.checklist.progress', { done, total: items.length })).setOrigin(1, 0.5));
    const segmentsWidth = INNER - progressLabel.width - 12;
    const segment = (segmentsWidth - (items.length - 1) * 4) / items.length;
    const bar = this.add(scene.add.graphics());
    items.forEach((item, i) => {
      const sx = Math.round(left + i * (segment + 4));
      bar.fillStyle(INK).fillRect(sx - 2, progressY - 2, Math.round(segment) + 4, 14);
      bar.fillStyle(item.decision ? (item.decision === 'risk' ? 0xed8936 : 0x48bb78) : 0x2d3748).fillRect(sx, progressY, Math.round(segment), 10);
      if (item.decision) bar.fillStyle(0xffffff, 0.35).fillRect(sx, progressY, Math.round(segment), 2);
    });
    this.top = progressY + 24;
    // Tarjetas de cada estación.
    items.forEach((item, index) => this.rows.push(this.card(item, index, this.top + index * (CARD.height + CARD.gap))));
    this.focus = this.add(scene.add.graphics());
    // Detalle de la estación elegida.
    const detailY = this.top + items.length * (CARD.height + CARD.gap) + 4;
    const detailBox = this.add(scene.add.graphics());
    this.detail = {
      title: this.add(this.text(left + 12, detailY + 10, 13, COLOR.focus, '', INNER - 24)),
      body: this.add(this.text(left + 12, detailY + 30, 12, COLOR.text, '', INNER - 24).setLineSpacing(2)),
    };
    const detailHeight = 100;
    detailBox.fillStyle(INK).fillRect(left - 2, detailY - 2, INNER + 4, detailHeight + 4);
    detailBox.fillStyle(0x0a1020).fillRect(left, detailY, INNER, detailHeight);
    detailBox.fillStyle(0x1c2742).fillRect(left, detailY, INNER, 2);
    // Botón grande para empezar y las teclas.
    this.launchY = detailY + detailHeight + 14;
    this.launch = this.launchButton(left, this.launchY);
    const keysY = this.launchY + 62;
    this.keyHints(left, keysY);
    this.height = keysY + 16 - y;
    // Fondo de la consola: placa con borde, remaches y una franja de color arriba.
    const h = this.height;
    backdrop.fillStyle(INK, 0.92).fillRect(x - 3, y - 3, CHECK_PANEL.width + 6, h + 6);
    backdrop.fillStyle(PLATE, 0.94).fillRect(x, y, CHECK_PANEL.width, h);
    backdrop.fillStyle(PLATE_HI).fillRect(x, y, CHECK_PANEL.width, 40);
    backdrop.fillStyle(0x3b4a70).fillRect(x, y, CHECK_PANEL.width, 2);
    backdrop.fillStyle(INK).fillRect(x, y + 40, CHECK_PANEL.width, 2);
    for (const [rx, ry] of [[x + 5, y + 5], [x + CHECK_PANEL.width - 9, y + 5], [x + 5, y + h - 9], [x + CHECK_PANEL.width - 9, y + h - 9]] as const) {
      backdrop.fillStyle(0x4a5a80).fillRect(rx, ry, 4, 4);
      backdrop.fillStyle(INK).fillRect(rx + 2, ry + 2, 2, 2);
    }
    title.setDepth(1);
    // Foco inicial: la primera estación sin confirmar o el botón de empezar.
    const pending = items.findIndex((i) => !i.decision);
    this.setFocus(pending === -1 ? items.length : pending, 0, false);
    this.celebrate();
  }

  // --- Navegación (teclado y mouse) ---

  move(delta: number): void {
    const count = this.rows.length + 1;
    let row = this.row;
    for (let i = 0; i < count; i++) {
      row = (row + delta + count) % count;
      if (row === this.rows.length || this.rows[row]!.chips.length > 0) break;
    }
    if (row !== this.row) audio.sfx('hover');
    this.setFocus(row, 0);
  }

  cycleOption(delta: number): void {
    const chips = this.rows[this.row]?.chips ?? [];
    if (chips.length < 2) return;
    audio.sfx('hover');
    this.setFocus(this.row, (this.option + delta + chips.length) % chips.length);
  }

  activate(): void {
    if (this.row === this.rows.length) return this.actions.start();
    const chip = this.rows[this.row]?.chips[this.option];
    if (chip?.enabled) this.actions.decide(this.row, chip.decision);
    else if (chip) audio.sfx('bad', 1, 0.6);
  }

  /** Y del marco de foco, para que el próximo repintado lo deslice desde acá. */
  get focusY(): number {
    return this.focus.y;
  }

  private setFocus(row: number, option: number, animate = true): void {
    this.row = row;
    this.option = option;
    this.rows.forEach((r, i) => r.chips.forEach((c, j) => c.draw(i === row && j === option)));
    this.launch.draw(row === this.rows.length);
    // Marco de foco alrededor de la tarjeta elegida (o del botón de empezar): se desliza.
    const g = this.focus.clear();
    const onLaunch = row === this.rows.length;
    const left = CHECK_PANEL.x + PAD;
    const height = onLaunch ? 48 : CARD.height;
    if (!onLaunch) {
      g.lineStyle(2, FOCUS).strokeRect(left - 3, -3, INNER + 6, height + 6);
      g.fillStyle(FOCUS).fillRect(left - 6, 6, 3, height - 12);
    }
    const y = onLaunch ? this.launchY : this.rows[row]!.y;
    const from = this.memory.focusY;
    this.memory.focusY = y;
    this.scene.tweens.killTweensOf(this.focus);
    if (animate && from !== null && from !== y && !reducedMotion()) {
      this.focus.setY(from);
      this.scene.tweens.add({ targets: this.focus, y, duration: 140, ease: 'Cubic.Out' });
    } else this.focus.setY(y);
    this.showDetail(row);
  }

  // --- Piezas ---

  private card(item: ChecklistItem, index: number, y: number): Row {
    const scene = this.scene;
    const left = CHECK_PANEL.x + PAD;
    const right = left + INNER;
    const g = this.add(scene.add.graphics());
    const decision = item.decision;
    // La franja de la izquierda dice cómo está el sistema (o cómo quedó).
    const status = decision === 'risk' ? LIGHT_COLOR.yellow : decision ? LIGHT_COLOR.green : LIGHT_COLOR[item.status];
    g.fillStyle(INK).fillRect(left - 2, y - 2, INNER + 4, CARD.height + 4);
    g.fillStyle(decision ? 0x0c1220 : CARD_FILL).fillRect(left, y, INNER, CARD.height);
    g.fillStyle(0x1c2742).fillRect(left, y, INNER, 2);
    g.fillStyle(status).fillRect(left, y, 4, CARD.height);
    // Luz del sistema: titila mientras está sin confirmar y no está en verde.
    const lamp = this.add(scene.add.graphics());
    const lx = left + 12;
    const ly = y + CARD.height / 2 - 7;
    lamp.fillStyle(INK).fillRect(lx - 2, ly - 2, 18, 18);
    lamp.fillStyle(status).fillRect(lx, ly, 14, 14);
    lamp.fillStyle(0xffffff, 0.55).fillRect(lx + 2, ly + 2, 4, 4);
    if (!decision && item.status !== 'green' && !reducedMotion()) {
      scene.tweens.add({ targets: lamp, alpha: 0.35, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.icon(left + 52, y + CARD.height / 2, item.systemId, 1.5, decision ? 0.75 : 1);
    const textX = left + 76;
    const chips = decision ? [] : this.options(item);
    const chipsWidth = chips.reduce((sum, c) => sum + c.width + CHIP.gap, 0);
    const textWidth = decision ? INNER - 76 - 130 : right - 10 - chipsWidth - textX;
    this.add(this.text(textX, y + 18, 14, decision ? COLOR.muted : COLOR.text, t(`common.system.${item.systemId}`), textWidth).setOrigin(0, 0.5));
    const stateKey = decision ? `maneuvers.checklist.done.${decision}` : `maneuvers.checklist.state.${item.status}`;
    const stateColor = decision ? STAMP_CSS[decision] : LIGHT_CSS[item.status];
    this.add(this.text(textX, y + 40, 12, stateColor, t(stateKey as TranslationKey), textWidth).setOrigin(0, 0.5));
    // Botones (sin confirmar) o sello (ya confirmado).
    const built: Row['chips'] = [];
    let cx = right - 10;
    for (let option = chips.length - 1; option >= 0; option--) {
      cx -= chips[option]!.width;
      built.unshift(this.chip(chips[option]!, cx, y + (CARD.height - CHIP.height) / 2, index, option));
      cx -= CHIP.gap;
    }
    if (decision) this.stamp(decision, right - 16, y + CARD.height / 2, index === this.memory.justDecided);
    // Con el mouse, la tarjeta entera toma el foco.
    const hit = this.add(scene.add.zone(left, y, INNER, CARD.height).setOrigin(0, 0).setInteractive());
    hit.on('pointerover', () => chips.length && this.row !== index && this.setFocus(index, 0));
    return { item, y, chips: built };
  }

  private options(item: ChecklistItem): { decision: ChecklistDecision; label: string; cost: number; width: number; enabled: boolean }[] {
    const measure = (label: string, cost: number) => {
      const probe = this.scene.add.text(0, 0, label, textStyle(13, '#000', { fontStyle: 'bold' }));
      const width = Math.ceil(probe.width);
      probe.destroy();
      return width + CHIP.pad * 2 + (cost ? 34 : 0);
    };
    if (item.status === 'green') return [{ decision: 'go', label: t('maneuvers.checklist.chip.go'), cost: 0, width: Math.max(72, measure(t('maneuvers.checklist.chip.go'), 0)), enabled: true }];
    const cost = this.run.repairCost(item.systemId);
    return [
      { decision: 'repair', label: t('maneuvers.checklist.chip.repair'), cost, width: measure(t('maneuvers.checklist.chip.repair'), cost), enabled: this.run.canRepair(item.systemId) },
      { decision: 'risk', label: t('maneuvers.checklist.chip.risk'), cost: 0, width: measure(t('maneuvers.checklist.chip.risk'), 0), enabled: true },
    ];
  }

  /** Botón de una decisión: tecla grande de color con su borde, que se hunde al tenerlo elegido. */
  private chip(chip: ReturnType<ChecklistPanel['options']>[number], x: number, y: number, index: number, option: number): Row['chips'][number] {
    const scene = this.scene;
    const color = CHIP_COLOR[chip.decision];
    const g = this.add(scene.add.graphics());
    const label = this.add(this.text(0, 0, 13, color.text, chip.label).setOrigin(0, 0.5).setFontStyle('bold'));
    const costText = chip.cost ? this.add(this.text(0, 0, 12, color.text, `×${chip.cost}`).setOrigin(0, 0.5).setFontStyle('bold')) : null;
    const costIcon = chip.cost ? this.icon(0, 0, 'spares', 0.75) : null;
    const { width } = chip;
    const draw = (focused: boolean) => {
      const down = focused && chip.enabled ? 2 : 0;
      g.clear();
      g.fillStyle(INK).fillRect(x - 2, y - 2, width + 4, CHIP.height + 4);
      if (!chip.enabled) {
        g.fillStyle(0x2d3748).fillRect(x, y, width, CHIP.height);
        if (focused) g.lineStyle(2, FOCUS).strokeRect(x - 1, y - 1, width + 2, CHIP.height + 2);
      } else {
        g.fillStyle(color.shade).fillRect(x, y + CHIP.height - 4, width, 4);
        g.fillStyle(focused ? color.shine : color.fill).fillRect(x, y + down, width, CHIP.height - 4);
        if (!down) g.fillStyle(0xffffff, 0.4).fillRect(x, y, width, 2);
        if (focused) g.lineStyle(2, 0xffffff).strokeRect(x - 1, y - 1 + down, width + 2, CHIP.height - 2);
      }
      const cy = y + CHIP.height / 2 - 2 + down;
      label.setPosition(x + CHIP.pad, cy).setColor(chip.enabled ? color.text : COLOR.dim);
      costIcon?.setPosition(x + CHIP.pad + label.width + 12, cy).setAlpha(chip.enabled ? 1 : 0.4);
      costText?.setPosition(x + CHIP.pad + label.width + 20, cy).setColor(chip.enabled ? color.text : COLOR.dim);
    };
    const hit = this.add(scene.add.zone(x, y, width, CHIP.height).setOrigin(0, 0).setInteractive({ useHandCursor: chip.enabled }));
    hit.on('pointerover', () => {
      if (this.row !== index || this.option !== option) {
        audio.sfx('hover');
        this.setFocus(index, option);
      }
    });
    hit.on('pointerdown', () => (chip.enabled ? this.actions.decide(index, chip.decision) : audio.sfx('bad', 1, 0.6)));
    return { decision: chip.decision, enabled: chip.enabled, draw };
  }

  /** Sello de la decisión (GO, REPARADO, RIESGO), un poco torcido; el recién puesto entra con un golpe. */
  private stamp(decision: ChecklistDecision, right: number, cy: number, fresh: boolean): void {
    const scene = this.scene;
    const css = STAMP_CSS[decision];
    const text = this.text(0, 0, 15, css, t(`maneuvers.checklist.stamp.${decision}`)).setOrigin(0.5).setFontStyle('bold');
    const w = Math.ceil(text.width) + 16;
    const h = 26;
    const box = scene.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(css).color;
    box.lineStyle(2, color).strokeRect(-w / 2, -h / 2, w, h);
    box.fillStyle(color, 0.12).fillRect(-w / 2, -h / 2, w, h);
    const stamp = this.add(scene.add.container(right - w / 2, cy, [box, text]).setAngle(-6));
    if (fresh && !reducedMotion()) {
      stamp.setScale(1.9).setAlpha(0);
      scene.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
    }
  }

  private launchButton(left: number, y: number): { draw: (focused: boolean) => void } {
    const scene = this.scene;
    const run = this.run;
    const ready = run.checklistReady;
    const risky = run.items.some((i) => i.decision === 'risk');
    const pending = run.items.filter((i) => !i.decision).length;
    const fill = !ready ? 0x2d3748 : risky ? 0xed8936 : 0x48bb78;
    const hover = !ready ? 0x2d3748 : risky ? 0xfbd38d : 0x9ae6b4;
    const shade = !ready ? 0x1a202c : risky ? 0x9c4221 : 0x276749;
    const textColor = !ready ? COLOR.dim : '#0b1020';
    const key = !ready ? 'maneuvers.checklist.pendingCount' : risky ? 'maneuvers.checklist.startRisk' : 'maneuvers.checklist.start';
    const height = 48;
    const g = this.add(scene.add.graphics());
    const glow = this.add(scene.add.graphics());
    const cap = this.add(this.text(0, 0, 12, COLOR.focus, 'Enter').setOrigin(0.5).setFontStyle('bold'));
    const label = this.add(this.text(0, 0, 17, textColor, t(key as TranslationKey, { n: pending })).setOrigin(0, 0.5).setFontStyle('bold'));
    const capW = Math.ceil(cap.width) + 14;
    const draw = (focused: boolean) => {
      const down = focused && ready ? 2 : 0;
      g.clear();
      g.fillStyle(INK).fillRect(left - 3, y - 3, INNER + 6, height + 6);
      g.fillStyle(shade).fillRect(left, y + height - 5, INNER, 5);
      g.fillStyle(focused && ready ? hover : fill).fillRect(left, y + down, INNER, height - 5);
      if (ready && !down) g.fillStyle(0xffffff, 0.45).fillRect(left, y, INNER, 3);
      if (focused) g.lineStyle(2, ready ? 0xffffff : FOCUS).strokeRect(left - 1, y - 1 + down, INNER + 2, height - 3);
      const cy = y + (height - 5) / 2 + down;
      const total = (ready ? capW + 10 : 0) + label.width;
      const start = left + (INNER - total) / 2;
      cap.setVisible(ready).setPosition(start + capW / 2, cy);
      if (ready) g.fillStyle(0x1a202c).fillRect(start, cy - 11, capW, 22);
      label.setPosition(start + (ready ? capW + 10 : 0), cy + 1);
    };
    // Listo para empezar: el botón late (brillo que sube y baja alrededor).
    if (ready && !reducedMotion()) {
      glow.lineStyle(4, risky ? 0xfbd38d : 0x9ae6b4, 1).strokeRect(left - 6, y - 6, INNER + 12, height + 12);
      scene.tweens.add({ targets: glow, alpha: 0.15, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else glow.setVisible(false);
    const hit = this.add(scene.add.zone(left, y, INNER, height).setOrigin(0, 0).setInteractive({ useHandCursor: ready }));
    hit.on('pointerover', () => {
      if (this.row !== this.rows.length) {
        if (ready) audio.sfx('hover');
        this.setFocus(this.rows.length, 0);
      }
    });
    hit.on('pointerdown', () => (ready ? this.actions.start() : audio.sfx('bad', 1, 0.6)));
    return { draw };
  }

  /** Teclas dibujadas con lo que hacen (↑↓ elegir · ←→ opción · Enter confirmar). */
  private keyHints(left: number, y: number): void {
    const g = this.add(this.scene.add.graphics());
    let x = left;
    for (const [keys, action] of [['↑↓', 'choose'], ['←→', 'option'], ['Enter', 'confirm']] as const) {
      const cap = this.add(this.text(0, y, 11, '#1a202c', keys).setOrigin(0.5).setFontStyle('bold'));
      const w = Math.ceil(cap.width) + 12;
      g.fillStyle(INK).fillRect(x - 1, y - 10, w + 2, 20);
      g.fillStyle(0x9c4221).fillRect(x, y + 5, w, 3);
      g.fillStyle(0xf6ad55).fillRect(x, y - 9, w, 14);
      cap.setPosition(x + w / 2, y - 2);
      const label = this.add(this.text(x + w + 6, y - 1, 11, COLOR.muted, t(`maneuvers.checklist.key.${action}`)).setOrigin(0, 0.5));
      x += w + 6 + label.width + 16;
    }
  }

  /** Detalle de la estación elegida: qué etapas toca y qué pasa con cada opción. */
  private showDetail(row: number): void {
    const { title, body } = this.detail;
    const item = this.rows[row]?.item;
    if (!item) {
      const risky = this.run.items.filter((i) => i.decision === 'risk').length;
      title.setText(t(this.run.checklistReady ? 'maneuvers.checklist.detail.readyTitle' : 'maneuvers.checklist.detail.pendingTitle'));
      body.setText(t(!this.run.checklistReady ? 'maneuvers.checklist.detail.pending' : risky === 1 ? 'maneuvers.checklist.detail.readyRiskOne' : risky ? 'maneuvers.checklist.detail.readyRisk' : 'maneuvers.checklist.detail.ready', { n: risky }));
      this.placeDetail();
      return;
    }
    const stages = this.affectedStages(item.systemId);
    title.setText(`${t(`common.system.${item.systemId}`)} · ${t('maneuvers.checklist.detail.affects', { stages })}`);
    const lines: string[] = [];
    if (item.decision) lines.push(t(`maneuvers.checklist.detail.done.${item.decision}` as TranslationKey));
    else if (item.status === 'green') lines.push(t('maneuvers.checklist.detail.green'));
    else {
      const cost = this.run.repairCost(item.systemId);
      lines.push(
        this.run.canRepair(item.systemId) ? t(cost === 1 ? 'maneuvers.checklist.detail.repairOne' : 'maneuvers.checklist.detail.repair', { cost }) : t('maneuvers.checklist.detail.noSpares', { cost, have: this.run.spares }),
        t(`maneuvers.checklist.detail.risk.${item.status}` as TranslationKey),
      );
    }
    body.setText(lines.map((l) => `· ${l}`).join('\n'));
    this.placeDetail();
  }

  /** El cuerpo va debajo del título, que en algunos idiomas ocupa dos renglones. */
  private placeDetail(): void {
    const { title, body } = this.detail;
    body.setY(Math.ceil(title.y + title.height + 4));
  }

  private affectedStages(systemId: SystemId): string {
    const id = this.run.definition.id;
    return this.run.definition.stages
      .filter((s) => s.systems.includes(systemId))
      .map((s) => t(`maneuvers.stage.${id}.${s.id}` as TranslationKey))
      .join(', ');
  }

  /** Recién quedó todo confirmado: cartel «¡Todos los sistemas GO!» que entra y se va solo. */
  private celebrate(): void {
    if (!this.run.checklistReady || this.memory.celebrated) return;
    this.memory.celebrated = true;
    audio.sfx('radioLock');
    const risky = this.run.items.some((i) => i.decision === 'risk');
    const css = risky ? COLOR.warn : COLOR.ok;
    const color = Phaser.Display.Color.HexStringToColor(css).color;
    const label = this.text(0, 0, 24, css, t(risky ? 'maneuvers.checklist.allGoRisk' : 'maneuvers.checklist.allGo')).setOrigin(0.5).setFontStyle('bold').setStroke('#05070d', 6);
    // Franja oscura detrás del cartel, con bordes del color del resultado, para que se lea sobre las tarjetas.
    const band = this.scene.add.graphics();
    const bh = 50;
    band.fillStyle(INK, 0.92).fillRect(-INNER / 2, -bh / 2, INNER, bh);
    band.fillStyle(color).fillRect(-INNER / 2, -bh / 2, INNER, 3).fillRect(-INNER / 2, bh / 2 - 3, INNER, 3);
    const banner = this.scene.add.container(CHECK_PANEL.x + CHECK_PANEL.width / 2, this.top + (this.rows.length * (CARD.height + CARD.gap)) / 2, [band, label]);
    this.view.add(banner);
    if (reducedMotion()) {
      this.scene.time.delayedCall(1400, () => banner.destroy());
      return;
    }
    banner.setScale(0.6).setAlpha(0);
    this.scene.tweens.chain({
      targets: banner,
      tweens: [
        { scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' },
        { alpha: 0, y: banner.y - 14, delay: 1100, duration: 300, ease: 'Sine.In', onComplete: () => banner.destroy() },
      ],
    });
  }

  // --- Ayudas ---

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.view.add(object);
    return object;
  }

  private text(x: number, y: number, size: number, color: string, value: string, wrap?: number): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, textStyle(size, color, wrap ? { wordWrap: { width: wrap } } : {}));
  }

  private icon(x: number, y: number, frame: string, scale: number, alpha = 1): Phaser.GameObjects.Image | null {
    const textures = this.scene.textures;
    if (!textures.exists(HUD_ICONS) || !textures.get(HUD_ICONS).has(frame)) return null;
    return this.add(this.scene.add.image(Math.round(x), Math.round(y), HUD_ICONS, frame).setScale(scale).setAlpha(alpha));
  }
}

/** Sonido de cada decisión del checklist. */
export const checklistSfx = (decision: ChecklistDecision): SfxId => DECISION_SFX[decision];

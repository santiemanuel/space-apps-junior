import Phaser from 'phaser';
import type { CrewId } from '../../../core/crew/types';
import { crewTextureKey } from '../../assets';
import { HUD_ICONS, ICON_CELL } from '../../hudIcons';

/** Ícono de estado: un ícono del atlas (`frame`) o, si no hay, un carácter (`glyph`), con una luz del color dado. */
export interface PanelIcon {
  frame?: string;
  glyph?: string;
  color: string;
}

export interface PanelRow {
  text: string;
  color?: string;
  /** Tamaño de letra en px (13 por defecto). */
  size?: number;
  /** Espacio extra antes de la fila (px). */
  gap?: number;
  onClick?: () => void;
  /** Íconos de color al final de la fila (p. ej. los cuatro de la salud, §3.2). */
  icons?: readonly PanelIcon[];
  /** Ícono del atlas antes del texto. */
  icon?: string;
  /**
   * Barra después del texto: fracción 0..1, color, desde dónde empieza y dónde termina (px desde el borde de la
   * columna; de 150 al final por defecto).
   */
  bar?: { fraction: number; color: string; from?: number; to?: number; segments?: number };
  /** Valor alineado a la derecha de la fila (p. ej. los días que dura una reserva). */
  value?: { text: string; color: string };
  /** Varias celdas de ícono y texto en la misma fila, repartidas a lo ancho (en vez de `text`). */
  cells?: readonly { icon: string; text: string; color: string }[];
  /** Cara del tripulante antes del texto. */
  portrait?: CrewId;
}

const FONT = 'monospace';
const ICON_SLOTS = 4;
const CELL_SLOTS = 4;
/** Dónde empieza la barra de una fila, desde el borde izquierdo de la columna (px). */
const BAR = { x: 150, height: 8, segments: 12 } as const;
/** Recorte de la cara en el cuadro de frente de las hojas de la tripulación (px de mundo; se muestra a la mitad). */
const PORTRAIT = { x: 4, y: 8, w: 72, h: 52, scale: 0.5 } as const;

/** Objetos de una fila (se crean al hacer falta y se reutilizan). */
interface Slot {
  text: Phaser.GameObjects.Text;
  lead: Phaser.GameObjects.Image;
  portrait: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  value: Phaser.GameObjects.Text;
  icons: { image: Phaser.GameObjects.Image; glyph: Phaser.GameObjects.Text; pip: Phaser.GameObjects.Rectangle }[];
  cells: { image: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }[];
}

const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color;

/** Columna de textos con filas que se pueden tocar con el mouse. Reutiliza los objetos y sólo redibuja lo que cambió. */
export class PanelColumn {
  private readonly slots: Slot[] = [];
  private readonly handlers = new Map<Phaser.GameObjects.Text, (() => void) | undefined>();
  private signature = '';
  private bottom = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private y: number,
    private readonly width: number,
  ) {}

  /** Mueve la columna (el tablero acomoda sus cajas según lo que haya que mostrar). */
  moveTo(y: number): void {
    if (y === this.y) return;
    this.y = y;
    this.signature = '';
  }

  render(rows: readonly PanelRow[]): void {
    const signature = rows.map(({ onClick, ...r }) => `${JSON.stringify(r)}|${onClick ? 1 : 0}`).join('\n');
    if (signature === this.signature) {
      // Mismo texto: sólo se actualizan los callbacks (pueden cerrar sobre datos nuevos).
      rows.forEach((row, i) => this.handlers.set(this.slots[i]!.text, row.onClick));
      return;
    }
    this.signature = signature;
    const icons = this.scene.textures.exists(HUD_ICONS);
    let y = this.y;
    rows.forEach((row, i) => {
      const slot = this.slots[i] ?? this.createSlot();
      y += row.gap ?? 0;
      const size = row.size ?? 13;
      const portrait = row.portrait && this.scene.textures.exists(crewTextureKey(row.portrait));
      const lead = row.icon && icons;
      const indent = portrait ? (PORTRAIT.w * PORTRAIT.scale) + 6 : lead ? ICON_CELL : 0;
      const { text } = slot;
      text.setText(row.cells ? '' : row.text).setColor(row.color ?? '#e2e8f0').setFontSize(size).setVisible(!row.cells);
      const textHeight = row.cells ? size + 4 : text.height;
      const height = Math.max(textHeight, portrait ? PORTRAIT.h * PORTRAIT.scale + 2 : 0, lead || row.icons?.some((c) => c.frame) || row.cells ? 22 : 0);
      const textY = y + Math.round((height - textHeight) / 2);
      text.setPosition(this.x + indent, textY);
      this.handlers.set(text, row.onClick);
      if (row.onClick) text.setInteractive({ useHandCursor: true });
      else text.disableInteractive();
      slot.lead.setVisible(!!lead);
      if (lead) slot.lead.setFrame(row.icon!).setPosition(this.x + ICON_CELL / 2 - 2, y + height / 2);
      slot.portrait.setVisible(!!portrait);
      if (portrait) {
        slot.portrait.setTexture(crewTextureKey(row.portrait!), 0).setCrop(PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h);
        slot.portrait.setPosition(this.x - PORTRAIT.x * PORTRAIT.scale, y + 1 - PORTRAIT.y * PORTRAIT.scale).setAlpha(row.color === '#a0aec0' ? 0.6 : 1);
      }
      slot.bar.clear().setVisible(!!row.bar);
      if (row.bar) this.drawBar(slot.bar, row.bar.from ?? BAR.x, row.bar.to ?? this.width, y + Math.round((height - BAR.height) / 2), row.bar.fraction, hex(row.bar.color), row.bar.segments);
      slot.value.setVisible(!!row.value);
      if (row.value) slot.value.setText(row.value.text).setColor(row.value.color).setFontSize(size).setPosition(this.x + this.width, textY);
      slot.icons.forEach((icon, n) => {
        const spec = row.icons?.[row.icons.length - 1 - n];
        const right = this.x + this.width - n * 22;
        const frame = spec?.frame && icons;
        icon.image.setVisible(!!frame);
        icon.pip.setVisible(!!frame);
        icon.glyph.setVisible(!!spec && !frame);
        if (!spec) return;
        if (frame) {
          icon.image.setFrame(spec.frame!).setPosition(right - ICON_CELL / 2 + 3, y + height / 2 - 1);
          icon.pip.setFillStyle(hex(spec.color)).setPosition(right - ICON_CELL / 2 + 3, y + height - 1);
        } else {
          icon.glyph.setText(spec.glyph ?? '').setColor(spec.color).setFontSize(size).setPosition(right, textY);
        }
      });
      const cellWidth = row.cells ? this.width / row.cells.length : 0;
      slot.cells.forEach((cell, n) => {
        const spec = row.cells?.[n];
        cell.image.setVisible(!!spec && icons);
        cell.text.setVisible(!!spec);
        if (!spec) return;
        const cx = this.x + n * cellWidth;
        cell.image.setFrame(spec.icon).setPosition(cx + ICON_CELL / 2 - 2, y + height / 2);
        cell.text.setText(spec.text).setColor(spec.color).setFontSize(size).setPosition(cx + ICON_CELL - 2, textY);
      });
      y += height + 2;
    });
    this.bottom = y;
    for (const [i, slot] of this.slots.entries()) {
      if (i < rows.length) continue;
      slot.text.setVisible(false).disableInteractive();
      slot.lead.setVisible(false);
      slot.portrait.setVisible(false);
      slot.bar.clear();
      slot.value.setVisible(false);
      slot.icons.forEach((icon) => [icon.image, icon.glyph, icon.pip].forEach((o) => o.setVisible(false)));
      slot.cells.forEach((cell) => [cell.image, cell.text].forEach((o) => o.setVisible(false)));
    }
  }

  /** Altura de una fila en el último dibujo (0 si no existe). */
  rowY(index: number): number {
    return this.slots[index]?.text.y ?? 0;
  }

  /** Dónde terminó la última fila del último dibujo (px). */
  get height(): number {
    return this.bottom - this.y;
  }

  /** Barra en segmentos, con el contorno y el brillo de un píxel de arte. */
  private drawBar(g: Phaser.GameObjects.Graphics, from: number, to: number, y: number, fraction: number, color: number, count?: number): void {
    const { height } = BAR;
    const segments = count ?? (from < BAR.x ? 30 : BAR.segments);
    const seg = Math.floor((to - from - 4) / segments);
    const x = this.x + from + 2;
    const full = Math.round(Phaser.Math.Clamp(fraction, 0, 1) * segments);
    g.fillStyle(0x0b1020).fillRect(x - 2, y - 2, seg * segments + 2, height + 4);
    for (let i = 0; i < segments; i++) {
      const on = i < full;
      g.fillStyle(on ? color : 0x2d3748).fillRect(x + i * seg, y, seg - 2, height);
      if (on) g.fillStyle(0xffffff, 0.35).fillRect(x + i * seg, y, seg - 2, 2);
    }
  }

  private createSlot(): Slot {
    const scene = this.scene;
    const icons = scene.textures.exists(HUD_ICONS);
    const image = () => (icons ? scene.add.image(0, 0, HUD_ICONS) : scene.add.image(0, 0, '__WHITE')).setDepth(51).setScrollFactor(0).setVisible(false);
    const text = scene.add
      .text(this.x, this.y, '', { fontFamily: FONT, fontSize: '13px', color: '#e2e8f0', wordWrap: { width: this.width } })
      .setDepth(51)
      .setScrollFactor(0);
    text.on('pointerdown', () => this.handlers.get(text)?.());
    text.on('pointerover', () => text.setAlpha(0.75));
    text.on('pointerout', () => text.setAlpha(1));
    const slot: Slot = {
      text,
      lead: image(),
      portrait: scene.add.image(0, 0, '__WHITE').setOrigin(0, 0).setScale(PORTRAIT.scale).setDepth(51).setScrollFactor(0).setVisible(false),
      bar: scene.add.graphics().setDepth(51).setScrollFactor(0),
      value: scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px' }).setOrigin(1, 0).setDepth(51).setScrollFactor(0).setVisible(false),
      icons: Array.from({ length: ICON_SLOTS }, () => ({
        image: image(),
        glyph: scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px' }).setOrigin(1, 0).setDepth(51).setScrollFactor(0).setVisible(false),
        pip: scene.add.rectangle(0, 0, 10, 2, 0xffffff).setDepth(51).setScrollFactor(0).setVisible(false),
      })),
      cells: Array.from({ length: CELL_SLOTS }, () => ({
        image: image(),
        text: scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px' }).setDepth(51).setScrollFactor(0).setVisible(false),
      })),
    };
    this.slots.push(slot);
    return slot;
  }
}

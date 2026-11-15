import Phaser from 'phaser';

export interface PanelRow {
  text: string;
  color?: string;
  /** Tamaño de letra en px (13 por defecto). */
  size?: number;
  /** Espacio extra antes de la fila (px). */
  gap?: number;
  onClick?: () => void;
  /** Íconos de color al final de la fila (p. ej. los cuatro de la salud, §3.2). */
  icons?: readonly { glyph: string; color: string }[];
}

const FONT = 'monospace';

const ICON_SLOTS = 4;

/** Columna de textos con filas que se pueden tocar con el mouse. Reutiliza los objetos y sólo redibuja lo que cambió. */
export class PanelColumn {
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly icons: Phaser.GameObjects.Text[][] = [];
  private readonly handlers = new Map<Phaser.GameObjects.Text, (() => void) | undefined>();
  private signature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
  ) {}

  render(rows: readonly PanelRow[]): void {
    const signature = rows.map((r) => `${r.text}|${r.color}|${r.size}|${r.gap}|${r.onClick ? 1 : 0}`).join('\n');
    if (signature === this.signature) {
      // Mismo texto: sólo se actualizan los callbacks (pueden cerrar sobre datos nuevos).
      rows.forEach((row, i) => this.handlers.set(this.texts[i]!, row.onClick));
      return;
    }
    this.signature = signature;
    let y = this.y;
    rows.forEach((row, i) => {
      const text = this.texts[i] ?? this.create();
      y += row.gap ?? 0;
      text
        .setText(row.text)
        .setColor(row.color ?? '#e2e8f0')
        .setFontSize(row.size ?? 13)
        .setPosition(this.x, y)
        .setVisible(true);
      this.handlers.set(text, row.onClick);
      if (row.onClick) text.setInteractive({ useHandCursor: true });
      else text.disableInteractive();
      this.icons[i]!.forEach((icon, n) => {
        const spec = row.icons?.[row.icons.length - 1 - n];
        icon.setVisible(!!spec);
        if (spec) icon.setText(spec.glyph).setColor(spec.color).setFontSize(row.size ?? 13).setPosition(this.x + this.width - n * 18, y);
      });
      y += text.height + 2;
    });
    for (const [i, text] of this.texts.entries()) {
      if (i < rows.length) continue;
      text.setVisible(false).disableInteractive();
      this.icons[i]!.forEach((icon) => icon.setVisible(false));
    }
  }

  /** Altura de una fila en el último dibujo (0 si no existe). */
  rowY(index: number): number {
    return this.texts[index]?.y ?? 0;
  }

  private create(): Phaser.GameObjects.Text {
    const text = this.scene.add
      .text(this.x, this.y, '', { fontFamily: FONT, fontSize: '13px', color: '#e2e8f0', wordWrap: { width: this.width } })
      .setDepth(51)
      .setScrollFactor(0);
    text.on('pointerdown', () => this.handlers.get(text)?.());
    text.on('pointerover', () => text.setAlpha(0.75));
    text.on('pointerout', () => text.setAlpha(1));
    this.texts.push(text);
    this.icons.push(
      Array.from({ length: ICON_SLOTS }, () =>
        this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px' }).setOrigin(1, 0).setDepth(51).setScrollFactor(0).setVisible(false),
      ),
    );
    return text;
  }
}

import Phaser from 'phaser';

export interface PanelRow {
  text: string;
  color?: string;
  /** Tamaño de letra en px (13 por defecto). */
  size?: number;
  /** Espacio extra antes de la fila (px). */
  gap?: number;
  onClick?: () => void;
}

const FONT = 'monospace';

/**
 * Columna de textos con filas que se pueden tocar con el mouse. Reutiliza los objetos de texto y sólo
 * redibuja lo que cambió. Provisional: el tablero definitivo es la escena `Hud` (S9).
 */
export class VoyagePanel {
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly handlers = new Map<Phaser.GameObjects.Text, (() => void) | undefined>();
  private signature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
    height: number,
  ) {
    scene.add.rectangle(x - 16, 0, width + 32, height, 0x0b1020, 0.96).setOrigin(0, 0).setDepth(50);
    scene.add.rectangle(x - 16, 0, 2, height, 0x2d3748).setOrigin(0, 0).setDepth(50);
  }

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
      y += text.height + 2;
    });
    for (const text of this.texts.slice(rows.length)) text.setVisible(false).disableInteractive();
  }

  private create(): Phaser.GameObjects.Text {
    const text = this.scene.add
      .text(this.x, this.y, '', { fontFamily: FONT, fontSize: '13px', color: '#e2e8f0', wordWrap: { width: this.width } })
      .setDepth(51);
    text.on('pointerdown', () => this.handlers.get(text)?.());
    text.on('pointerover', () => text.setAlpha(0.75));
    text.on('pointerout', () => text.setAlpha(1));
    this.texts.push(text);
    return text;
  }
}

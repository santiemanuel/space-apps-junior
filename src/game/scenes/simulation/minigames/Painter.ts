import Phaser from 'phaser';

/** Atlas de los minijuegos (`public/assets/minigames/items`, grupo `minigames` de `art/manifest.json`), con normal map. */
export const MINIGAME_ITEMS = 'minigame-items';

export function preloadMinigames(scene: Phaser.Scene): void {
  if (scene.textures.exists(MINIGAME_ITEMS)) return;
  scene.load.atlas({
    key: MINIGAME_ITEMS,
    textureURL: 'assets/minigames/items.png',
    atlasURL: 'assets/minigames/items.json',
    normalMap: 'assets/minigames/items_n.png',
  });
}

export interface ImageOptions {
  /** Escala sobre el atlas (que ya viene ×2): 1,5 deja cada píxel de arte en 3 px, como el mapa. */
  scale?: number;
  alpha?: number;
  originX?: number;
  originY?: number;
  angle?: number;
  tint?: number;
}

export interface TextOptions {
  size?: number;
  color?: string;
  originX?: number;
  originY?: number;
  wrap?: number;
  align?: 'left' | 'center';
}

/**
 * Dibujo inmediato: en cada cuadro se vuelve a pedir lo que se ve (gráficos, sprites del atlas y textos) y se
 * reutilizan los objetos del cuadro anterior. Así cada minijuego se dibuja con una función simple.
 */
export class Painter {
  /** Gráficos de abajo (fondos, caños, barras) y de arriba (brillos, cursor). */
  readonly g: Phaser.GameObjects.Graphics;
  readonly top: Phaser.GameObjects.Graphics;
  private readonly imageLayer: Phaser.GameObjects.Container;
  private readonly textLayer: Phaser.GameObjects.Container;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private usedImages = 0;
  private usedTexts = 0;
  private readonly light: Phaser.GameObjects.Light | null;

  constructor(
    private readonly scene: Phaser.Scene,
    root: Phaser.GameObjects.Container,
    lit = true,
  ) {
    this.g = scene.add.graphics();
    this.imageLayer = scene.add.container(0, 0);
    this.top = scene.add.graphics();
    this.textLayer = scene.add.container(0, 0);
    root.add([this.g, this.imageLayer, this.top, this.textLayer]);
    // Una luz cálida que sigue a lo que se está tocando: con los normal maps, los objetos toman relieve.
    this.light = lit ? scene.lights.addLight(0, 0, 420, 0xfff1d6, 1.4, 120) : null;
  }

  begin(): void {
    this.g.clear();
    this.top.clear();
    this.usedImages = 0;
    this.usedTexts = 0;
  }

  end(): void {
    for (let i = this.usedImages; i < this.images.length; i++) this.images[i]!.setVisible(false);
    for (let i = this.usedTexts; i < this.texts.length; i++) this.texts[i]!.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.light?.setVisible(visible);
  }

  /** Lleva la luz hacia un punto (lo que el jugador está tocando). */
  focus(x: number, y: number): void {
    this.light?.setPosition(x, y - 60);
  }

  image(frame: string, x: number, y: number, o: ImageOptions = {}): Phaser.GameObjects.Image {
    let image = this.images[this.usedImages];
    if (!image) {
      image = this.scene.add.image(0, 0, MINIGAME_ITEMS, frame).setLighting(true);
      this.imageLayer.add(image);
      this.images.push(image);
    }
    this.usedImages++;
    image
      .setFrame(frame)
      .setPosition(Math.round(x), Math.round(y))
      .setScale(o.scale ?? 1.5)
      .setOrigin(o.originX ?? 0.5, o.originY ?? 0.5)
      .setAlpha(o.alpha ?? 1)
      .setAngle(o.angle ?? 0)
      .setVisible(true);
    if (o.tint === undefined) image.clearTint();
    else image.setTint(o.tint);
    return image;
  }

  text(value: string, x: number, y: number, o: TextOptions = {}): Phaser.GameObjects.Text {
    let text = this.texts[this.usedTexts];
    if (!text) {
      text = this.scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e2e8f0' });
      this.textLayer.add(text);
      this.texts.push(text);
    }
    this.usedTexts++;
    const size = `${o.size ?? 14}px`;
    const color = o.color ?? '#e2e8f0';
    if (text.style.fontSize !== size) text.setFontSize(size);
    if (text.style.color !== color) text.setColor(color);
    if ((text.style.wordWrapWidth ?? 0) !== (o.wrap ?? 0)) text.setWordWrapWidth(o.wrap ?? null);
    if (text.style.align !== (o.align ?? 'left')) text.setAlign(o.align ?? 'left');
    if (text.text !== value) text.setText(value);
    return text.setPosition(Math.round(x), Math.round(y)).setOrigin(o.originX ?? 0, o.originY ?? 0).setVisible(true);
  }

  /** Tecla dibujada (para las ayudas): un rectángulo con su letra, encendida si se está usando. */
  key(label: string, x: number, y: number, lit = false, width = 34): void {
    const g = this.g;
    g.fillStyle(0x05070d).fillRect(x - width / 2 - 2, y - 17, width + 4, 34);
    g.fillStyle(lit ? 0xf6ad55 : 0x4a5568).fillRect(x - width / 2, y - 15, width, 30);
    g.fillStyle(lit ? 0xfbd38d : 0x718096).fillRect(x - width / 2, y - 15, width, 4);
    this.text(label, x, y + 1, { size: 15, color: lit ? '#1a202c' : '#e2e8f0', originX: 0.5, originY: 0.5 });
  }
}

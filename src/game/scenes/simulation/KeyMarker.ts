import Phaser from 'phaser';
import { HUD_ICONS } from '../../hudIcons';
import { reducedMotion } from '../../ui/ui';

/**
 * Estado de un marcador del mapa: `pending` hay algo para hacer acá (rebota), `available` se puede hacer pero no hace
 * falta (quieto), `done` al día (tilde verde), `blocked` no se puede ahora (gris con candado) e `incident` hay una
 * avería que reparar (rojo con signo de exclamación).
 */
export type MarkerState = 'pending' | 'available' | 'done' | 'blocked' | 'incident';

/** Pictograma del marcador: un ícono de un atlas, o un signo dibujado. */
export type MarkerPicture = { atlas: string; frame: string } | { glyph: 'book' | 'moon' };

const COLORS: Record<MarkerState, { edge: number; fill: number; cap: number }> = {
  pending: { edge: 0xf6ad55, fill: 0x1a202c, cap: 0xf6ad55 },
  available: { edge: 0x4a5568, fill: 0x1a202c, cap: 0x4a5568 },
  done: { edge: 0x68d391, fill: 0x16291f, cap: 0x4a5568 },
  blocked: { edge: 0x4a5568, fill: 0x171923, cap: 0x2d3748 },
  incident: { edge: 0xfc8181, fill: 0x2a1015, cap: 0xfc8181 },
};
const PLATE = 44;
const CAP = 22;

/**
 * Marcador de una tecla en el mapa (en vez del texto que seguía al jugador): una placa con el pictograma de lo que se
 * hace ahí, la tecla (E o Z) en la esquina y una insignia con el estado. Los que piden algo rebotan. Todo en píxeles de
 * arte de 2 px, como el resto del mapa.
 */
export class KeyMarker {
  private readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image;
  private readonly cap: Phaser.GameObjects.Text;
  private signature = '';
  private state: MarkerState = 'available';
  /** Avance de una reparación o una tarea (0..1), debajo de la placa. */
  private progress = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly key: string,
    depth = 40,
  ) {
    this.g = scene.add.graphics();
    this.image = scene.add.image(0, 0, '__WHITE').setVisible(false).setVertexRoundMode('full');
    this.cap = scene.add.text(-PLATE / 2 - 2, -PLATE / 2 - 3, key, { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#1a202c' }).setOrigin(0.5).setResolution(2);
    this.root = scene.add.container(x, y, [this.g, this.image, this.cap]).setDepth(depth);
  }

  setVisible(visible: boolean): this {
    this.root.setVisible(visible);
    return this;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** Estado y pictograma de este cuadro; sólo se redibuja si cambió algo. */
  set(state: MarkerState, picture: MarkerPicture, progress = 0): this {
    this.state = state;
    const signature = `${state}|${JSON.stringify(picture)}|${Math.round(progress * 20)}`;
    if (signature === this.signature) return this;
    this.signature = signature;
    this.progress = progress;
    this.draw(picture);
    return this;
  }

  /** Rebote (o titileo con movimiento reducido) de los marcadores que piden algo. */
  update(time: number): void {
    if (!this.root.visible) return;
    const active = this.state === 'pending' || this.state === 'incident';
    if (!active) {
      this.root.setPosition(this.x, this.y).setAlpha(this.state === 'blocked' ? 0.75 : 1);
      return;
    }
    if (reducedMotion()) {
      this.root.setPosition(this.x, this.y).setAlpha(0.7 + 0.3 * Math.sin(time / 300));
      return;
    }
    // Salta en pasos de 2 px (un píxel de arte), más rápido si es una avería.
    const speed = this.state === 'incident' ? 180 : 260;
    const hop = Math.abs(Math.sin(time / speed)) * 8;
    this.root.setPosition(this.x, this.y - Math.round(hop / 2) * 2).setAlpha(1);
  }

  private draw(picture: MarkerPicture): void {
    const c = COLORS[this.state];
    const g = this.g.clear();
    const h = PLATE / 2;
    // Placa: contorno oscuro, borde del color del estado y fondo.
    g.fillStyle(0x05070d).fillRect(-h - 2, -h - 2, PLATE + 4, PLATE + 4);
    g.fillStyle(c.edge).fillRect(-h, -h, PLATE, PLATE);
    g.fillStyle(c.fill).fillRect(-h + 2, -h + 2, PLATE - 4, PLATE - 4);
    const dim = this.state === 'blocked';
    if ('atlas' in picture && this.scene.textures.exists(picture.atlas) && this.scene.textures.get(picture.atlas).has(picture.frame)) {
      const frame = this.scene.textures.getFrame(picture.atlas, picture.frame);
      // Los íconos del tablero (24 px) van ×2; los más grandes se achican para entrar en la placa.
      const scale = picture.atlas === HUD_ICONS ? (frame.width <= 24 ? 1.5 : 1) : Math.min(1, 32 / Math.max(frame.width, frame.height));
      this.image.setTexture(picture.atlas, picture.frame).setScale(scale).setVisible(true).setAlpha(dim ? 0.45 : 1);
    } else {
      this.image.setVisible(false);
      if ('glyph' in picture && picture.glyph === 'book') {
        // Recetario: un libro abierto.
        g.fillStyle(0x05070d).fillRect(-14, -10, 28, 22);
        g.fillStyle(0xfefcbf).fillRect(-12, -8, 11, 18).fillRect(1, -8, 11, 18);
        g.fillStyle(0xd69e2e).fillRect(-1, -8, 2, 18);
        g.fillStyle(0x718096).fillRect(-10, -4, 7, 2).fillRect(-10, 0, 7, 2).fillRect(-10, 4, 7, 2).fillRect(3, -4, 7, 2).fillRect(3, 0, 7, 2);
      } else if ('glyph' in picture) {
        // Luna: dormir.
        g.fillStyle(dim ? 0x718096 : 0x90cdf4).fillCircle(0, 0, 12);
        g.fillStyle(c.fill).fillCircle(6, -4, 10);
      }
    }
    // Tecla en la esquina de arriba a la izquierda (apagada si no se puede usar).
    if (this.state === 'done') this.cap.setVisible(false);
    else {
      const [kx, ky] = [-h - 2 - CAP / 2, -h - 3 - CAP / 2];
      g.fillStyle(0x05070d).fillRect(kx - 2, ky - 2, CAP + 4, CAP + 6);
      g.fillStyle(c.cap).fillRect(kx, ky, CAP, CAP);
      g.fillStyle(0xffffff, 0.35).fillRect(kx, ky, CAP, 4);
      g.fillStyle(0x05070d, 0.35).fillRect(kx, ky + CAP, CAP, 2);
      this.cap.setVisible(true).setText(this.key).setColor(dim ? '#718096' : '#1a202c');
    }
    // Insignia del estado, abajo a la derecha.
    const [bx, by] = [h - 4, h - 4];
    if (this.state === 'done') {
      g.fillStyle(0x05070d).fillCircle(bx, by, 10).fillStyle(0x38a169).fillCircle(bx, by, 8);
      g.lineStyle(3, 0xf0fff4).beginPath().moveTo(bx - 4, by).lineTo(bx - 1, by + 3).lineTo(bx + 4, by - 3).strokePath();
    } else if (this.state === 'blocked') {
      // Candado.
      g.fillStyle(0x05070d).fillRect(bx - 9, by - 10, 18, 20);
      g.lineStyle(3, 0xa0aec0).strokeRect(bx - 4, by - 8, 8, 8);
      g.fillStyle(0xa0aec0).fillRect(bx - 7, by - 2, 14, 10);
      g.fillStyle(0x1a202c).fillRect(bx - 1, by + 1, 2, 4);
    } else if (this.state === 'incident') {
      g.fillStyle(0x05070d).fillCircle(bx, by, 10).fillStyle(0xe53e3e).fillCircle(bx, by, 8);
      g.fillStyle(0xfff5f5).fillRect(bx - 1, by - 5, 3, 6).fillRect(bx - 1, by + 3, 3, 2);
    }
    // Barra de avance (reparación empezada).
    if (this.progress > 0 && this.progress < 1) {
      g.fillStyle(0x05070d).fillRect(-h - 2, h + 4, PLATE + 4, 8);
      g.fillStyle(0x2d3748).fillRect(-h, h + 6, PLATE, 4);
      g.fillStyle(0x63b3ed).fillRect(-h, h + 6, Math.round(PLATE * this.progress), 4);
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}

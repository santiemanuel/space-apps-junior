import Phaser from 'phaser';
import type { SimulationEvents } from '../../../core/habitat/events';
import { HUD_ICONS } from '../../hudIcons';
import { reducedMotion } from '../../ui/ui';

export type Toast = SimulationEvents['sim:toast'];

/** Dónde van los avisos: arriba al centro del mapa, entre la placa del jugador y los botones (px de pantalla). */
const AREA = { cx: 530, top: 10, maxWidth: 490, pad: 14, icon: 44 } as const;
/** Cuánto dura un aviso [regla de interfaz]: según lo largo que sea, para que un chico llegue a leerlo. */
const DURATION = { baseMs: 1800, perCharMs: 62, minMs: 3500, maxMs: 13000, queuedMinMs: 2800 } as const;
const MAX_QUEUE = 6;

export const toastDurationMs = (text: string): number => Phaser.Math.Clamp(DURATION.baseMs + DURATION.perCharMs * text.length, DURATION.minMs, DURATION.maxMs);

/**
 * Avisos sobre el mapa (rocas juntadas, datos del terreno, incidentes): letra grande, caja oscura con borde y, si
 * hay un dato para aprender, un ícono o una foto chica. Salen de a uno, en cola, y duran según el largo del texto.
 */
export class Toasts {
  private readonly root: Phaser.GameObjects.Container;
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly picture: Phaser.GameObjects.Image;
  private readonly queue: Toast[] = [];
  private current: Toast | null = null;
  private until = 0;
  private shownAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.box = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#fefcbf', lineSpacing: 3 });
    this.picture = scene.add.image(0, 0, '__WHITE').setVisible(false);
    this.root = scene.add.container(0, 0, [this.box, this.picture, this.text]).setDepth(60).setVisible(false);
  }

  /** Suma un aviso a la cola (si es igual al último que espera o al que se ve, no se repite). */
  push(toast: Toast): void {
    const last = this.queue.at(-1) ?? this.current;
    if (last?.text === toast.text) return;
    if (this.queue.length >= MAX_QUEUE) this.queue.shift();
    this.queue.push(toast);
  }

  /** `hidden`: hay una pantalla encima; los avisos esperan sin perderse. */
  update(time: number, hidden: boolean): void {
    if (hidden) {
      this.root.setVisible(false);
      if (this.current) this.until = Math.max(this.until, time + 1200);
      return;
    }
    // Con otros esperando, el que se ve se va antes (pero nunca tan rápido que no se pueda leer).
    const early = this.current && this.queue.length > 0 && time - this.shownAt >= Math.max(DURATION.queuedMinMs, toastDurationMs(this.current.text) * 0.6);
    if (this.current && (time >= this.until || early)) this.current = null;
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) {
        this.root.setVisible(false);
        return;
      }
      this.show(next, time);
    }
    this.root.setVisible(true);
  }

  private show(toast: Toast, time: number): void {
    this.current = toast;
    this.shownAt = time;
    this.until = time + toastDurationMs(toast.text);
    const { textures } = this.scene;
    const source = toast.image && textures.exists(toast.image.key) && textures.get(toast.image.key).has(toast.image.frame)
      ? toast.image
      : toast.icon && textures.exists(HUD_ICONS) && textures.get(HUD_ICONS).has(toast.icon)
        ? { key: HUD_ICONS, frame: toast.icon }
        : null;
    const iconWidth = source ? AREA.icon + 10 : 0;
    this.text.setWordWrapWidth(AREA.maxWidth - 2 * AREA.pad - iconWidth).setText(toast.text);
    const width = Math.ceil(this.text.width) + 2 * AREA.pad + iconWidth;
    const height = Math.max(Math.ceil(this.text.height), source ? AREA.icon : 0) + 2 * AREA.pad - 6;
    const x = Math.round(AREA.cx - width / 2);
    const y = AREA.top;
    // Caja con contraste: contorno oscuro, borde ámbar con brillo y fondo casi negro.
    const g = this.box.clear();
    g.fillStyle(0x05070d).fillRect(x + 6, y, width - 12, height).fillRect(x, y + 6, width, height - 12).fillRect(x + 3, y + 3, width - 6, height - 6);
    g.fillStyle(0xb7791f).fillRect(x + 8, y + 2, width - 16, height - 4).fillRect(x + 2, y + 8, width - 4, height - 16).fillRect(x + 5, y + 5, width - 10, height - 10);
    g.fillStyle(0xfbd38d).fillRect(x + 8, y + 2, width - 16, 2);
    g.fillStyle(0x0d1322).fillRect(x + 8, y + 4, width - 16, height - 8).fillRect(x + 4, y + 8, width - 8, height - 16).fillRect(x + 6, y + 6, width - 12, height - 12);
    this.picture.setVisible(!!source);
    if (source) {
      const frame = textures.getFrame(source.key, source.frame);
      const scale = Math.min(2, AREA.icon / Math.max(frame.width, frame.height));
      g.fillStyle(0x1a2036).fillRect(x + AREA.pad - 2, y + height / 2 - AREA.icon / 2 - 2, AREA.icon + 4, AREA.icon + 4);
      this.picture.setTexture(source.key, source.frame).setScale(scale).setPosition(x + AREA.pad + AREA.icon / 2, y + height / 2);
    }
    this.text.setPosition(x + AREA.pad + iconWidth, Math.round(y + (height - this.text.height) / 2));
    // Entrada corta desde arriba (sin movimiento reducido).
    this.scene.tweens.killTweensOf(this.root);
    if (reducedMotion()) this.root.setY(0).setAlpha(1);
    else {
      this.root.setY(-12).setAlpha(0);
      this.scene.tweens.add({ targets: this.root, y: 0, alpha: 1, duration: 180, ease: 'Cubic.Out' });
    }
  }
}

import Phaser from 'phaser';
import type { SystemStatus } from '../../core/systems/types';

/** Paleta y estilos comunes de las pantallas del flujo (menús, maniobras, tarjetas, informe). */
export const FONT = 'monospace';
export const COLOR = {
  text: '#e2e8f0',
  muted: '#a0aec0',
  dim: '#718096',
  focus: '#fbd38d',
  title: '#90cdf4',
  warn: '#f6ad55',
  ok: '#68d391',
  bad: '#fc8181',
  link: '#63b3ed',
} as const;

export const PANEL = { fill: 0x111827, stroke: 0x4a5568, focus: 0xfbd38d, shade: 0x05070d } as const;

/** Semáforo (§3.6): verde, amarillo y rojo, sin porcentajes. */
export const LIGHT_COLOR: Record<SystemStatus, number> = { green: 0x48bb78, yellow: 0xecc94b, red: 0xf56565 };
export const LIGHT_CSS: Record<SystemStatus, string> = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' };

export function textStyle(size: number, color: string = COLOR.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra };
}

export function addText(scene: Phaser.Scene, x: number, y: number, size: number, color: string = COLOR.text, extra = {}) {
  return scene.add.text(x, y, '', textStyle(size, color, extra));
}

/** Rectángulo de panel con borde. */
export function addPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, stroke: number = PANEL.stroke) {
  return scene.add.rectangle(x, y, width, height, PANEL.fill, 0.92).setStrokeStyle(2, stroke).setOrigin(0, 0);
}

/** Fondo semitransparente para las pantallas superpuestas (pausa, tarjeta). */
export function addShade(scene: Phaser.Scene, alpha = 0.75) {
  const { width, height } = scene.scale;
  return scene.add.rectangle(0, 0, width, height, PANEL.shade, alpha).setOrigin(0, 0).setInteractive();
}

export interface Button {
  readonly text: Phaser.GameObjects.Text;
  setLabel(label: string): Button;
  setEnabled(enabled: boolean): Button;
  setFocused(focused: boolean): Button;
  readonly enabled: boolean;
}

/** Botón de texto: clic para activar, se resalta al pasar el mouse o al elegirlo con el teclado. */
export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onClick: () => void,
  { size = 20, onHover }: { size?: number; onHover?: () => void } = {},
): Button {
  const text = scene.add
    .text(x, y, '', textStyle(size, COLOR.text, { backgroundColor: '#1a202c', padding: { x: 14, y: 8 } }))
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  let enabled = true;
  let focused = false;
  const paint = () => {
    text.setColor(!enabled ? COLOR.dim : focused ? '#1a202c' : COLOR.text);
    text.setBackgroundColor(!enabled ? '#1a202c' : focused ? COLOR.focus : '#2d3748');
  };
  text.on('pointerover', () => onHover?.());
  text.on('pointerdown', () => enabled && onClick());
  const button: Button = {
    text,
    get enabled() {
      return enabled;
    },
    setLabel(label) {
      text.setText(label);
      return button;
    },
    setEnabled(value) {
      enabled = value;
      paint();
      return button;
    },
    setFocused(value) {
      focused = value;
      paint();
      return button;
    },
  };
  paint();
  return button;
}

/** Abre un enlace de una fuente de datos en otra pestaña. */
export function openSource(url: string): void {
  if (/^https?:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
}

/** Escucha un evento hasta que la escena se apaga (los emisores de Phaser sobreviven a un reinicio de escena). */
export function listenUntilShutdown(
  scene: Phaser.Scene,
  emitter: Phaser.Events.EventEmitter,
  event: string,
  listener: (...args: never[]) => void,
): void {
  emitter.on(event, listener);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => emitter.off(event, listener));
}

/** Teclado de la escena por código de tecla (`ArrowUp`, `Enter`, `Space`…), hasta que se apague. */
export function onKeys(scene: Phaser.Scene, handler: (code: string, event: KeyboardEvent) => void): void {
  const keyboard = scene.input.keyboard;
  if (keyboard) listenUntilShutdown(scene, keyboard, 'keydown', (event: KeyboardEvent) => handler(event.code, event));
}

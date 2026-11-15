import Phaser from 'phaser';
import type { SystemStatus } from '../../core/systems/types';
import { audio } from '../audio/audio';

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
  // Un poco más grande que la pantalla: cubre los bordes mientras la ventana se acerca (`overlayIn`).
  const margin = 80;
  return scene.add
    .rectangle(-margin, -margin, width + margin * 2, height + margin * 2, PANEL.shade, alpha)
    .setOrigin(0, 0)
    .setInteractive();
}

/** Entrada de una ventana superpuesta (tarjeta, pausa): toda la escena aparece acercándose desde un poco lejos. */
export function overlayIn(scene: Phaser.Scene, duration = 230): void {
  const camera = scene.cameras.main;
  camera.setAlpha(0).setZoom(0.94);
  scene.tweens.add({ targets: camera, alpha: 1, zoom: 1, duration, ease: 'Back.Out' });
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
  // Transiciones: crece un poco al pasar el mouse y se hunde al hacer clic.
  const scaleTo = (scale: number, duration = 110) => {
    scene.tweens.killTweensOf(text);
    scene.tweens.add({ targets: text, scale, duration, ease: 'Sine.Out' });
  };
  text.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(text));
  text.on('pointerover', () => {
    if (enabled) {
      scaleTo(1.05);
      audio.sfx('hover');
    }
    onHover?.();
  });
  text.on('pointerout', () => scaleTo(1));
  text.on('pointerdown', () => {
    if (!enabled) return;
    text.setScale(0.94);
    scaleTo(1, 160);
    audio.sfx('select');
    onClick();
  });
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

// --- Transiciones de la interfaz ---

/** Cualquier objeto con transparencia y posición: textos, imágenes, formas o contenedores. */
type Animated = Phaser.GameObjects.GameObject & {
  y: number;
  setAlpha(value: number): unknown;
  setY(value: number): unknown;
  setScale(value: number): unknown;
};

/** Aparece desde transparente, subiendo `rise` píxeles (paneles, páginas, filas). */
export function fadeIn(scene: Phaser.Scene, targets: Animated | Animated[], { duration = 240, rise = 10, delay = 0 } = {}): void {
  for (const target of Array.isArray(targets) ? targets : [targets]) {
    const y = target.y;
    target.setAlpha(0);
    target.setY(y + rise);
    scene.tweens.add({ targets: target, alpha: 1, y, duration, delay, ease: 'Cubic.Out' });
  }
}

/** Aparece agrandándose apenas (ventanas superpuestas: tarjeta, pausa). */
export function popIn(scene: Phaser.Scene, targets: Animated | Animated[], { duration = 220, from = 0.92 } = {}): void {
  for (const target of Array.isArray(targets) ? targets : [targets]) {
    target.setAlpha(0);
    target.setScale(from);
    scene.tweens.add({ targets: target, alpha: 1, scale: 1, duration, ease: 'Back.Out' });
  }
}

/** Entrada de una pantalla de la partida que no ocupa todo (planificación, datos, Control de Misión): aparece suave. */
export function overlayFade(scene: Phaser.Scene, duration = 180): void {
  const camera = scene.cameras.main;
  camera.setAlpha(0);
  scene.tweens.add({ targets: camera, alpha: 1, duration, ease: 'Sine.Out' });
}

/** Un contenedor de la interfaz que aparece suave y subiendo un poco (estado completo, mapa del cráter, minijuegos). */
export function panelIn(container: Phaser.GameObjects.Container, duration = 180): void {
  container.scene.tweens.killTweensOf(container);
  container.setAlpha(0).setY(10);
  container.scene.tweens.add({ targets: container, alpha: 1, y: 0, duration, ease: 'Cubic.Out' });
}

/** Latido corto para marcar un cambio (un valor que cambió, un acierto). */
export function pulse(scene: Phaser.Scene, target: Animated, { scale = 1.12, duration = 160 } = {}): void {
  scene.tweens.killTweensOf(target);
  target.setScale(scale);
  scene.tweens.add({ targets: target, scale: 1, duration, ease: 'Sine.Out' });
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

/** El sistema pide menos movimiento: sin temblores, deslizamientos ni destellos (se cambia a fundidos cortos). */
export const reducedMotion = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

import type { MinigameId } from '../../../../core/minigames/Minigame';
import { t, type TranslationKey } from '../../../../i18n';
import type { Painter } from './Painter';
import type { Area } from './renderers';

const tr = (key: string) => t(key as TranslationKey);

/**
 * Un paso del mini tutorial: íconos del atlas de los minijuegos (o un signo grande si no hay ícono) y las teclas que se
 * usan. El texto, corto, está en `hud.minigame.<id>.tutorial.<n>` (n desde 1) y el objetivo en `.tutorial.goal`.
 */
export interface TutorialStep {
  icons?: readonly string[];
  glyph?: string;
  keys?: readonly string[];
  /** Sí o no (✓ verde, ✗ roja) junto al ícono: lo que hay que hacer y lo que no. */
  mark?: 'yes' | 'no';
  /** Medidor chico con la franja verde y la aguja adentro (en vez de ícono). */
  gauge?: boolean;
}

const ARROWS = ['←', '↑', '↓', '→'];

export const TUTORIALS: Record<MinigameId, readonly TutorialStep[]> = {
  bike: [{ icons: ['bike'], keys: ['←', '→'] }, { gauge: true }],
  scrubber: [{ icons: ['cartridge'], keys: ['←', '→'] }, { icons: ['co2'], mark: 'yes' }, { icons: ['o2'], mark: 'no' }],
  water: [{ keys: ARROWS }, { keys: ['E'] }, { icons: ['dirtybag', 'filter', 'cleantank'] }],
  radio: [{ icons: ['dish'], keys: ['←', '→'] }, { glyph: '∿' }, { glyph: '↔' }],
  stars: [{ icons: ['star'], keys: ['←', '→'] }, { icons: ['star', 'star'] }, { keys: ['E'] }],
  pulse: [{ icons: ['stethoscope'] }, { icons: ['heart'], keys: ['E'] }],
  meal: [{ icons: ['dish-stew'] }, { icons: ['ing-tomato', 'ing-cheese'] }, { icons: ['ing-carrot'], keys: [...ARROWS, 'E'] }],
  shield: [{ icons: ['waterbag'], keys: [...ARROWS, 'E'] }, { glyph: '☀' }],
  plants: [
    { icons: ['plant-dry', 'wateringcan'], keys: ['1'] },
    { icons: ['plant-pale', 'growlamp'], keys: ['2'] },
    { icons: ['plant-bugs', 'ladybug'], keys: ['3'] },
  ],
  harvest: [{ icons: ['plant-pale'], keys: ['←', '→'] }, { icons: ['plant-ok'], keys: ['E'], mark: 'yes' }, { icons: ['plant-dry'], mark: 'no' }],
  moxie: [{ icons: ['heater'], keys: ['E'] }, { gauge: true }, { icons: ['heater'], mark: 'no' }],
  seals: [{ icons: ['brush'], keys: ['←', '→'] }, { icons: ['dust'], keys: ['E'] }],
  patch: [{ keys: ARROWS }, { glyph: '♪' }, { icons: ['patch'], keys: ['E'] }],
  fuses: [{ glyph: '▮', keys: ARROWS }, { glyph: '10 A' }, { keys: ['1', '2', '3'] }],
  wires: [{ glyph: '●' }, { keys: ['↑', '↓'] }, { glyph: '⟷', keys: ['E'] }],
  dust: [{ icons: ['dust'], keys: ARROWS }, { icons: ['brush'], keys: ['E'], mark: 'yes' }, { glyph: '▦', mark: 'no' }],
  night: [{ keys: ['↑', '↓'] }, { glyph: '☾', keys: ['E'], mark: 'yes' }, { glyph: '♥', mark: 'no' }],
};

const GAP = 14;
const KEY_W = 34;
/** Alto que ocupa el ícono de un paso (px); se achica para que entre. */
const ICON_BOX = 96;

/** Mini tutorial en una sola pantalla: los pasos lado a lado (número, íconos, teclas y una frase) y el objetivo abajo. */
export function renderTutorial(p: Painter, id: MinigameId, a: Area, now: number): void {
  const steps = TUTORIALS[id];
  const ns = `hud.minigame.${id}.tutorial`;
  p.text(tr('hud.minigame.tutorial.title'), a.x + a.w / 2, a.y + 2, { size: 18, color: '#90cdf4', originX: 0.5 });
  const top = a.y + 32;
  const goalH = 52;
  const h = a.h - (top - a.y) - goalH - 10;
  const w = (a.w - GAP * (steps.length - 1)) / steps.length;
  steps.forEach((step, i) => {
    const x = a.x + i * (w + GAP);
    p.g.fillStyle(0x05070d).fillRect(x - 2, top - 2, w + 4, h + 4);
    p.g.fillStyle(0x1d2340).fillRect(x, top, w, h);
    p.g.fillStyle(0x2a3156).fillRect(x, top, w, 4);
    // Número del paso.
    p.g.fillStyle(0x05070d).fillCircle(x + 20, top + 20, 15).fillStyle(0xf6ad55).fillCircle(x + 20, top + 20, 12);
    p.text(String(i + 1), x + 20, top + 21, { size: 15, color: '#1a202c', originX: 0.5, originY: 0.5 });
    const cx = x + w / 2;
    const iconY = top + 16 + ICON_BOX / 2;
    const icons = step.icons ?? [];
    if (icons.length) {
      const spacing = Math.min(w / icons.length, 110);
      icons.forEach((frame, k) => {
        const image = p.image(frame, cx + (k - (icons.length - 1) / 2) * spacing, iconY, { scale: 1 });
        const fit = Math.min(1.5, (spacing - 10) / image.width, ICON_BOX / image.height);
        image.setScale(fit);
      });
    } else if (step.glyph) p.text(step.glyph, cx, iconY, { size: 56, color: '#fbd38d', originX: 0.5, originY: 0.5 });
    if (step.mark) {
      const mx = cx + 70;
      const my = iconY - 26;
      p.g.fillStyle(0x05070d).fillCircle(mx, my, 17).fillStyle(step.mark === 'yes' ? 0x38a169 : 0xe53e3e).fillCircle(mx, my, 14);
      p.text(step.mark === 'yes' ? '✓' : '✗', mx, my + 1, { size: 18, color: '#ffffff', originX: 0.5, originY: 0.5 });
    }
    const keys = step.keys ?? [];
    // Sin ícono, las teclas ocupan su lugar.
    if (step.gauge) gauge(p, cx, iconY + 30, now);
    const pictured = icons.length > 0 || !!step.glyph || !!step.gauge;
    const keysY = pictured ? top + ICON_BOX + 40 : iconY;
    const pulse = Math.floor(now / 450) % Math.max(1, keys.length);
    keys.forEach((label, k) => p.key(label, cx + (k - (keys.length - 1) / 2) * (KEY_W + 6), keysY, k === pulse));
    p.text(tr(`${ns}.${i + 1}`), cx, top + ICON_BOX + (keys.length && pictured ? 66 : 34), { size: 14, color: '#e2e8f0', originX: 0.5, wrap: w - 20, align: 'center' });
  });
  // Objetivo: la estrella y una frase.
  const gy = a.y + a.h - goalH;
  p.g.fillStyle(0x05070d).fillRect(a.x - 2, gy - 2, a.w + 4, goalH + 4);
  p.g.fillStyle(0x23402f).fillRect(a.x, gy, a.w, goalH);
  p.image('star', a.x + 30, gy + goalH / 2, { scale: 0.45 });
  p.text(tr(`${ns}.goal`), a.x + 58, gy + goalH / 2, { size: 16, color: '#c6f6d5', originY: 0.5, wrap: a.w - 80 });
}

/** Medidor de media vuelta: gris, verde y rojo, con la aguja que se mueve dentro del verde. */
function gauge(p: Painter, cx: number, cy: number, now: number): void {
  const r = 46;
  const arc = (from: number, to: number, color: number, width: number) =>
    p.g.lineStyle(width, color).beginPath().arc(cx, cy, r, Math.PI + from * Math.PI, Math.PI + to * Math.PI).strokePath();
  arc(0, 1, 0x05070d, 16);
  arc(0, 0.4, 0x4a5568, 11);
  arc(0.4, 0.75, 0x68d391, 11);
  arc(0.75, 1, 0xfc8181, 11);
  const angle = Math.PI + (0.575 + 0.1 * Math.sin(now / 400)) * Math.PI;
  p.top.lineStyle(4, 0xf7fafc).lineBetween(cx, cy, cx + Math.cos(angle) * (r - 4), cy + Math.sin(angle) * (r - 4));
  p.top.fillStyle(0xf6ad55).fillCircle(cx, cy, 5);
}

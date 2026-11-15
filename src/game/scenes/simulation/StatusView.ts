import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { METER_RULES } from '../../../content/meters';
import { efficiency } from '../../../core/crew/efficiency';
import type { CrewId } from '../../../core/crew/types';
import type { SimSnapshot } from '../../../core/habitat/events';
import { careerFraction, chestXrays } from '../../../core/meters/dose';
import type { GameState } from '../../../core/state/types';
import type { SystemStatus } from '../../../core/systems/types';
import { getLocale, t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { crewTextureKey } from '../../assets';
import { GAME_HEIGHT } from '../../display';
import { HUD_ICONS } from '../../hudIcons';
import { VIEW_WIDTH } from './HudScene';
import { gridWarningKey, locationKey } from './simulationData';
import { panelIn } from '../../ui/ui';

export const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;
export const LIGHT: Record<SystemStatus, string> = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' };
/** Semáforo sin porcentajes (§3.6): verde, amarillo o rojo según dos umbrales. */
export const lightFor = (value: number, yellowBelow: number, redBelow: number) =>
  value < redBelow ? LIGHT.red : value < yellowBelow ? LIGHT.yellow : LIGHT.green;
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale() === 'es' ? 'es-AR' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

/** Días que duran las reservas (con la tripulación y el reciclador de hoy), batería y CO2: lo que resumen los medidores. */
export function supplies(st: GameState) {
  const rules = METER_RULES;
  const { energy, lifeSupport } = st.meters;
  const crewCount = st.crew.length || 1;
  const daysOf = (amount: number, perCrewDay: number) => Math.floor(amount / Math.max(1e-9, perCrewDay * crewCount));
  const recycling = rules.lifeSupport.recyclingByStatus[st.systems.waterRecycler];
  return {
    battery: energy.batteryKwh / energy.capacityKwh,
    air: daysOf(lifeSupport.oxygenKg, rules.lifeSupport.oxygenKgPerCrewDay),
    water: daysOf(lifeSupport.waterL, rules.lifeSupport.waterLPerCrewDay * (1 - recycling)),
    food: daysOf(st.inventory.foodKg, rules.food.foodKgPerCrewDay),
    co2High: lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg,
  };
}

/** Las cuatro luces de la salud de un tripulante (§3.2), con cuánto le queda de cada una (1 = perfecto). */
export function healthLights(m: GameState['crew'][number]): { id: 'condition' | 'fatigue' | 'food' | 'radiation'; fraction: number; color: string }[] {
  const dose = careerFraction(METER_RULES, m.doseMSv);
  return [
    { id: 'condition', fraction: m.condition, color: lightFor(m.condition, 0.7, 0.4) },
    { id: 'fatigue', fraction: 1 - m.fatigue, color: lightFor(1 - m.fatigue, 0.6, 0.3) },
    { id: 'food', fraction: m.nutrition, color: lightFor(m.nutrition, 0.8, 0.5) },
    { id: 'radiation', fraction: 1 - dose, color: dose >= 0.8 ? LIGHT.red : dose >= 0.5 ? LIGHT.yellow : LIGHT.green },
  ];
}

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color;
const TEXT = { fontFamily: 'monospace', color: '#e2e8f0' } as const;
const HEAD = '#90cdf4';
const SOFT = '#a0aec0';
const DIM = '#718096';
/** Dos columnas dentro de la vista del mapa. */
const LEFT = { x: 28, width: 400 } as const;
const RIGHT = { x: 480, width: 404 } as const;
const TOP = 78;
/** Dónde empiezan la barra y el valor de una fila de reservas o de máquinas, desde el borde de la columna (px). */
const VALUE_X = 130;
/** Recorte de la cara en el cuadro de frente de las hojas de la tripulación (px de mundo). */
const PORTRAIT = { x: 4, y: 8, w: 72, h: 52 } as const;
const CARD_HEIGHT = 96;
const KEYS_Y = 628;
const KEYS = ['move', 'use', 'sleep', 'switch', 'decide', 'sound', 'status', 'missionControl', 'charts'] as const;
const KEY_CAPS: Record<(typeof KEYS)[number] | 'crater', string> = {
  move: 'WASD', use: 'E', sleep: 'Z', switch: 'Tab', decide: '1 2 3', sound: 'M', status: 'I', missionControl: 'C', charts: 'G', crater: 'V',
};

/**
 * Estado completo de la nave o de la base (tecla I): lo que el tablero resume en barras y luces, acá con su detalle y
 * ordenado por tema: reservas, máquinas, tripulación, lo que pasa afuera (con la fuente del dato real) y las teclas.
 * Se arma de nuevo cada vez que se abre; el reloj queda en pausa mientras se mira.
 */
export class StatusView {
  private readonly root: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly namespace: 'voyage' | 'mars') {
    this.root = scene.add.container(0, 0).setDepth(100).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(s: SimSnapshot): void {
    this.root.removeAll(true);
    this.draw(s);
    if (!this.root.visible) panelIn(this.root);
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.root.add(o);
    return o;
  }

  private text(x: number, y: number, value: string, size = 12, color: string = TEXT.color, width = 0): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, value, { ...TEXT, fontSize: `${size}px`, color, ...(width ? { wordWrap: { width } } : {}) }));
  }

  private icon(x: number, y: number, frame: string): void {
    if (this.scene.textures.exists(HUD_ICONS) && this.scene.textures.get(HUD_ICONS).has(frame)) this.add(this.scene.add.image(x, y, HUD_ICONS, frame));
  }

  /** Título de un bloque con su línea; devuelve dónde empieza el contenido. */
  private section(g: Phaser.GameObjects.Graphics, column: { x: number; width: number }, y: number, key: string): number {
    this.text(column.x, y, tr(key), 14, HEAD);
    g.fillStyle(0x2d3748).fillRect(column.x, y + 21, column.width, 2);
    return y + 32;
  }

  /** Barra en segmentos, igual que las del tablero. */
  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, fraction: number, color: string, segments = 10, seg = 12, height = 8): void {
    const full = Math.round(Phaser.Math.Clamp(fraction, 0, 1) * segments);
    g.fillStyle(0x0b1020).fillRect(x - 2, y - 2, seg * segments + 2, height + 4);
    for (let i = 0; i < segments; i++) {
      const on = i < full;
      g.fillStyle(on ? hex(color) : 0x2d3748).fillRect(x + i * seg, y, seg - 2, height);
      if (on) g.fillStyle(0xffffff, 0.35).fillRect(x + i * seg, y, seg - 2, 2);
    }
  }

  private draw(s: SimSnapshot): void {
    this.add(this.scene.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0x05070d, 0.96).setOrigin(0, 0).setInteractive());
    const g = this.add(this.scene.add.graphics());
    this.text(LEFT.x, 14, tr(`hud.info.title.${s.place}`), 22, HEAD);
    this.text(LEFT.x, 44, t('hud.info.subtitle'), 12, SOFT);
    this.text(VIEW_WIDTH - 28, 20, t('hud.info.close'), 11, DIM).setOrigin(1, 0);

    let y = this.resources(g, s, TOP);
    y = this.systems(g, s, y + 14);
    if (s.mars) this.marsToday(g, s, s.mars, y + 14);
    y = this.crew(g, s, TOP);
    this.outside(g, s, y + 14);
    this.keys(g, !!s.mars);

  }

  /** Reservas: cada una con su barra y los días que dura. */
  private resources(g: Phaser.GameObjects.Graphics, s: SimSnapshot, top: number): number {
    const { battery, air, water, food, co2High } = supplies(s.state);
    const days = (n: number) => (n > 99 ? t('hud.meter.manyDays') : t('hud.meter.days', { days: n }));
    const spares = s.state.inventory.spares;
    const rows: { icon: string; label: string; bar?: number; value?: string; color: string }[] = [
      { icon: 'energy', label: t('hud.meter.energy'), bar: battery, color: lightFor(battery, 0.3, 0.1) },
      { icon: 'air', label: t('hud.meter.air'), bar: air / 60, value: days(air), color: lightFor(air, 14, 4) },
      { icon: 'water', label: t('hud.meter.water'), bar: water / 60, value: days(water), color: lightFor(water, 14, 4) },
      { icon: 'food', label: t('hud.meter.food'), bar: food / 60, value: days(food), color: lightFor(food, 14, 4) },
      { icon: 'co2', label: t('hud.info.co2'), value: t(co2High ? 'hud.meter.co2High' : 'hud.meter.co2Ok'), color: co2High ? LIGHT.red : LIGHT.green },
      { icon: 'spares', label: t('hud.info.spares'), value: `${spares}`, color: spares > 0 ? TEXT.color : LIGHT.yellow },
    ];
    let y = this.section(g, LEFT, top, 'hud.info.resources');
    for (const row of rows) {
      this.icon(LEFT.x + 12, y + 12, row.icon);
      this.text(LEFT.x + 34, y + 5, row.label, 13);
      if (row.bar !== undefined) this.bar(g, LEFT.x + VALUE_X, y + 8, row.bar, row.color);
      if (row.value) this.text(LEFT.x + VALUE_X + (row.bar === undefined ? -2 : 134), y + 5, row.value, 13, row.color);
      y += 32;
    }
    return y;
  }

  /** Máquinas que se gastan: una luz y cómo está cada una. */
  private systems(g: Phaser.GameObjects.Graphics, s: SimSnapshot, top: number): number {
    let y = this.section(g, LEFT, top, 'hud.info.systems');
    const seen = new Set<string>();
    for (const task of s.tasks) {
      if (!task.system || seen.has(task.system)) continue;
      seen.add(task.system);
      const status = s.state.systems[task.system];
      this.icon(LEFT.x + 12, y + 12, task.zone);
      this.text(LEFT.x + 34, y + 5, tr(`hud.system.${task.system}`), 13);
      g.fillStyle(0x0b1020).fillRect(LEFT.x + VALUE_X - 2, y + 6, 14, 14).fillStyle(hex(LIGHT[status])).fillRect(LEFT.x + VALUE_X, y + 8, 10, 10);
      this.text(LEFT.x + VALUE_X + 20, y + 5, tr(`hud.status.${status}`), 13, LIGHT[status]);
      y += 28;
    }
    return y;
  }

  /** En Marte: el tiempo real que midió Curiosity, si se puede salir y las muestras. */
  private marsToday(g: Phaser.GameObjects.Graphics, s: SimSnapshot, mars: NonNullable<SimSnapshot['mars']>, top: number): void {
    const w = mars.weather;
    let y = this.section(g, LEFT, top, 'hud.info.marsToday');
    const line = (value: string, color: string) => (y += this.text(LEFT.x, y, value, 12, color, LEFT.width).height + 4);
    line(t('mars.panel.curiosity', { sol: w.sol, min: Math.round(w.minTempC), max: w.maxTempC === null ? '?' : Math.round(w.maxTempC) }), '#fbd38d');
    line(tr(`mars.uv.${w.uv ?? 'none'}`), w.uv === 'Low' ? LIGHT.red : w.uv === 'Moderate' ? LIGHT.yellow : SOFT);
    line(
      `${t(mars.daylight ? 'mars.panel.day' : 'mars.panel.night')} · ${t(mars.evaOpen ? 'mars.panel.evaOpen' : mars.daylight ? 'mars.panel.evaBlocked' : 'mars.panel.evaNight')}`,
      mars.evaOpen ? LIGHT.green : LIGHT.yellow,
    );
    line(t('mars.panel.samples', mars.samples), TEXT.color);
    line(t('mars.panel.samplesStored', mars.samples), SOFT);
    const grid = gridWarningKey(s);
    if (grid) line(tr(grid), LIGHT.yellow);
    if (mars.grid.brokenTubes.length) line(t('mars.panel.tubes', { count: mars.grid.brokenTubes.length }), LIGHT.yellow);
  }

  /** Tripulación: cara, dónde está y las cuatro barras de la salud con su nombre. */
  private crew(g: Phaser.GameObjects.Graphics, s: SimSnapshot, top: number): number {
    const st = s.state;
    let y = this.section(g, RIGHT, top, 'hud.info.crew');
    for (const m of st.crew) {
      const key = crewTextureKey(m.id);
      if (this.scene.textures.exists(key))
        this.add(this.scene.add.image(RIGHT.x - PORTRAIT.x, y - PORTRAIT.y, key, 0).setOrigin(0, 0).setCrop(PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h).setAlpha(m.resting ? 0.6 : 1));
      const where = locationKey(this.namespace, m.location);
      const color = m.resting ? SOFT : lightFor(efficiency(m, st.meters.lifeSupport.co2MmHg), 0.8, 0.6);
      this.text(RIGHT.x + 84, y + 4, `${m.id === st.activeCrewId ? '▶ ' : ''}${NAMES[m.id]}`, 15, color);
      this.text(RIGHT.x + 84, y + 26, tr(where), 11, SOFT, 126);
      healthLights(m).forEach((light, i) => {
        const x = RIGHT.x + 216 + (i % 2) * 96;
        const cy = y + Math.floor(i / 2) * 28;
        this.icon(x + 12, cy + 12, light.id);
        this.text(x + 28, cy, t(`hud.health.${light.id}`), 10, SOFT);
        this.bar(g, x + 30, cy + 15, light.fraction, m.resting ? DIM : light.color, 6, 10, 6);
      });
      this.text(RIGHT.x, y + 58, t('hud.panel.xrays', { xrays: Math.round(chestXrays(METER_RULES, m.doseMSv)) }), 11, DIM);
      if (m.slowReasonKey) this.text(RIGHT.x, y + 73, tr(m.slowReasonKey, { name: NAMES[m.id] }), 11, '#fbd38d');
      y += CARD_HEIGHT;
    }
    return y;
  }

  /** Lo que pasa afuera. Nunca presentar datos archivados como en vivo: siempre con su fecha y su fuente. */
  private outside(g: Phaser.GameObjects.Graphics, s: SimSnapshot, top: number): void {
    const y = this.section(g, RIGHT, top, 'hud.info.outside');
    this.icon(RIGHT.x + 12, y + 12, 'radiation');
    const dose = this.text(
      RIGHT.x + 34,
      y + 5,
      `${t('hud.panel.dose', { value: Math.round(s.dose.uGyH) })}${s.dose.capped ? ` ${t('hud.panel.doseCapped')}` : ''}`,
      13,
      TEXT.color,
      RIGHT.width - 34,
    );
    this.text(RIGHT.x, y + 12 + dose.height, t('hud.panel.source', { date: formatDate(s.dose.date), source: t(`hud.source.${s.place}`) }), 11, DIM, RIGHT.width);
  }

  /** Todas las teclas, cada una en su tecla dibujada. */
  private keys(g: Phaser.GameObjects.Graphics, mars: boolean): void {
    const column = { x: LEFT.x, width: RIGHT.x + RIGHT.width - LEFT.x };
    const y = this.section(g, column, KEYS_Y, 'hud.info.keys');
    [...KEYS, ...(mars ? (['crater'] as const) : [])].forEach((id, i) => {
      const x = column.x + (i % 5) * 172;
      const cy = y + Math.floor(i / 5) * 26;
      const cap = this.add(
        this.scene.add.text(x, cy, KEY_CAPS[id], { ...TEXT, fontSize: '11px', color: '#fbd38d', backgroundColor: '#2d3748', padding: { x: 5, y: 2 } }),
      );
      this.text(x + cap.width + 6, cy + 2, t(`hud.info.key.${id}`), 11, SOFT);
    });
  }
}

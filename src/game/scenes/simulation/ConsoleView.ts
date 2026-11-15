import Phaser from 'phaser';
import type { EventBus } from '../../../core/events/EventBus';
import type { SimSnapshot, SimulationEvents } from '../../../core/habitat/events';
import { modeEffects, RESOURCE_MODES, type ResourceGauge } from '../../../core/habitat/resourceModes';
import { t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { audio } from '../../audio/audio';
import { GAME_HEIGHT } from '../../display';
import { HUD_ICONS } from '../../hudIcons';
import { panelIn } from '../../ui/ui';
import { VIEW_WIDTH } from './HudScene';

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
const TEXT = { fontFamily: 'monospace', color: '#e2e8f0' } as const;
const HEAD = '#90cdf4';
const SOFT = '#a0aec0';
const DIM = '#718096';
const GOOD = '#68d391';
const BAD = '#fc8181';
/** Columna de las prioridades y columna del tablero de energía. */
const MODES = { x: 28, width: 572, top: 84, height: 104, gap: 8 } as const;
const POWER = { x: 628, width: 352, top: 84 } as const;
/** Ícono del tablero de cada cosa que una prioridad sube o baja. */
const GAUGE_ICON: Record<ResourceGauge, string> = { energy: 'energy', lifeSupport: 'air', food: 'food', science: 'samples', wear: 'spares', morale: 'morale', condition: 'condition' };

/**
 * Consola de recursos (E junto a ella, en la sala de mando; en Marte, en la de energía). A la izquierda, las
 * prioridades: cada una muestra con íconos y flechas ▲▼ qué sube y qué baja antes de confirmarla. A la derecha, el
 * tablero de energía: lo que dan los paneles contra lo que se gasta y los sistemas que se pueden desenchufar. Sólo
 * dibuja: las reglas están en `core/habitat/resourceModes.ts` y `HabitatSession`. El reloj queda en pausa.
 */
export class ConsoleView {
  private readonly root: Phaser.GameObjects.Container;
  private snapshot: SimSnapshot | null = null;
  /** Dónde está el cursor: una prioridad o un sistema del tablero. */
  private cursor = { column: 'modes' as 'modes' | 'loads', row: 0 };
  private signature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: EventBus<SimulationEvents>,
    private readonly close: () => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(100).setVisible(false);
    const keyboard = scene.input.keyboard!;
    const on = (keys: string[], action: () => void) => {
      for (const key of keys) keyboard.addKey(key, false).on('down', () => this.visible && action());
    };
    on(['UP', 'W'], () => this.move(0, -1));
    on(['DOWN', 'S'], () => this.move(0, 1));
    on(['LEFT', 'A'], () => this.move(-1, 0));
    on(['RIGHT', 'D'], () => this.move(1, 0));
    on(['E', 'SPACE'], () => this.confirm());
    on(['Q'], () => this.close());
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(s: SimSnapshot): void {
    this.snapshot = s;
    this.cursor = { column: 'modes', row: Math.max(0, RESOURCE_MODES.findIndex((m) => m.id === s.resources.mode)) };
    this.signature = '';
    this.render();
    panelIn(this.root);
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  /** Con el estado nuevo de cada cuadro: se redibuja sólo si cambió algo de lo que se ve. */
  update(s: SimSnapshot): void {
    if (!this.visible) return;
    this.snapshot = s;
    this.render();
  }

  private loads(s: SimSnapshot) {
    return s.power.loads.filter((l) => !l.essential);
  }

  private move(dx: number, dy: number): void {
    const s = this.snapshot;
    if (!s) return;
    const loads = this.loads(s).length;
    if (dx) this.cursor = { column: dx > 0 && loads ? 'loads' : 'modes', row: 0 };
    else {
      const count = this.cursor.column === 'modes' ? RESOURCE_MODES.length : loads;
      this.cursor.row = Phaser.Math.Clamp(this.cursor.row + dy, 0, count - 1);
    }
    audio.sfx('hover');
    this.render();
  }

  private confirm(): void {
    const s = this.snapshot;
    if (!s) return;
    if (this.cursor.column === 'modes') this.choose(RESOURCE_MODES[this.cursor.row]!.id);
    else this.toggle(this.loads(s)[this.cursor.row]?.id);
  }

  private choose(id: (typeof RESOURCE_MODES)[number]['id']): void {
    const s = this.snapshot;
    if (!s || s.resources.blocked || s.resources.mode === id) return;
    audio.sfx('select');
    this.sim.emit('sim:mode', { id });
  }

  private toggle(id: string | undefined): void {
    const s = this.snapshot;
    if (!s || !id || s.power.panelBlocked) return;
    const off = new Set(s.power.loads.filter((l) => !l.on).map((l) => l.id));
    const turnOn = off.has(id);
    if (turnOn) off.delete(id);
    else off.add(id);
    audio.sfx(turnOn ? 'powerRelay01' : 'powerRelay02');
    this.sim.emit('sim:loads', { off: [...off] });
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.root.add(o);
    return o;
  }

  private text(x: number, y: number, value: string, size = 12, color: string = TEXT.color, width = 0): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, value, { ...TEXT, fontSize: `${size}px`, color, ...(width ? { wordWrap: { width } } : {}) }));
  }

  private icon(x: number, y: number, frame: string): boolean {
    if (!this.scene.textures.exists(HUD_ICONS) || !this.scene.textures.get(HUD_ICONS).has(frame)) return false;
    this.add(this.scene.add.image(x, y, HUD_ICONS, frame));
    return true;
  }

  private render(): void {
    const s = this.snapshot;
    if (!s) return;
    const signature = JSON.stringify([s.resources, s.power.loads.map((l) => l.on), s.power.sockets, Math.round(s.power.generationKw * 10), Math.round(s.power.loadKw * 10), this.cursor, s.mars?.nightReady, Math.round((s.mars?.panels.loss ?? 0) * 100)]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.root.removeAll(true);
    this.add(this.scene.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0x05070d, 0.96).setOrigin(0, 0).setInteractive());
    const g = this.add(this.scene.add.graphics());
    this.text(MODES.x, 14, t('hud.console.title'), 22, HEAD);
    this.text(MODES.x, 44, t('hud.console.subtitle'), 12, SOFT);
    this.text(VIEW_WIDTH - 28, 20, t('hud.console.close'), 11, DIM).setOrigin(1, 0);
    this.modes(g, s);
    this.power(g, s);
  }

  /** Las prioridades, una tarjeta cada una: nombre, lo que hace y, con íconos y flechas, qué sube y qué baja. */
  private modes(g: Phaser.GameObjects.Graphics, s: SimSnapshot): void {
    RESOURCE_MODES.forEach((mode, i) => {
      const y = MODES.top + i * (MODES.height + MODES.gap);
      const active = s.resources.mode === mode.id;
      const focused = this.cursor.column === 'modes' && this.cursor.row === i;
      g.fillStyle(0x05070d).fillRect(MODES.x - 2, y - 2, MODES.width + 4, MODES.height + 4);
      g.fillStyle(focused ? 0xfbd38d : active ? 0x68d391 : 0x4a4266).fillRect(MODES.x, y, MODES.width, MODES.height);
      g.fillStyle(active ? 0x16291f : 0x121829).fillRect(MODES.x + 3, y + 3, MODES.width - 6, MODES.height - 6);
      this.text(MODES.x + 16, y + 10, tr(`hud.console.mode.${mode.id}.name`), 16, focused ? '#fbd38d' : '#f7fafc');
      if (active) this.text(MODES.x + MODES.width - 14, y + 12, t('hud.console.inUse'), 11, GOOD).setOrigin(1, 0);
      else if (focused) this.text(MODES.x + MODES.width - 14, y + 12, t('hud.console.confirm'), 11, '#fbd38d').setOrigin(1, 0);
      this.text(MODES.x + 16, y + 34, tr(`hud.console.mode.${mode.id}.text`), 12, SOFT, MODES.width - 32);
      // Qué sube y qué baja: primero lo que se gana (verde), después lo que cuesta (rojo).
      let x = MODES.x + 16;
      const ey = y + MODES.height - 24;
      const effects = modeEffects(mode);
      if (!effects.length) this.text(x, ey - 6, t('hud.console.noChange'), 12, DIM);
      for (const effect of effects) {
        const color = effect.good ? GOOD : BAD;
        if (this.icon(x + 10, ey, GAUGE_ICON[effect.gauge])) x += 24;
        const label = this.text(x, ey - 8, `${effect.direction === 'up' ? '▲' : '▼'} ${tr(`hud.console.gauge.${effect.gauge}`)}`, 12, color);
        x += label.width + 14;
      }
      const hit = this.add(this.scene.add.zone(MODES.x, y, MODES.width, MODES.height).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', () => {
        this.cursor = { column: 'modes', row: i };
        this.choose(mode.id);
        this.render();
      });
    });
  }

  /** Tablero de energía: paneles contra consumo y los sistemas que se pueden desenchufar. */
  private power(g: Phaser.GameObjects.Graphics, s: SimSnapshot): void {
    const { x, width } = POWER;
    let y = POWER.top;
    this.text(x, y, t('hud.console.power'), 14, HEAD);
    g.fillStyle(0x2d3748).fillRect(x, y + 21, width, 2);
    y += 34;
    const max = Math.max(s.power.generationKw, s.power.loadKw, 1);
    const bar = (label: string, value: number, color: number) => {
      this.text(x, y, label, 12, SOFT);
      g.fillStyle(0x0b1020).fillRect(x, y + 18, width, 12);
      g.fillStyle(color).fillRect(x + 2, y + 20, Math.max(0, (width - 4) * (value / max)), 8);
      y += 40;
    };
    bar(t('hud.console.generation'), s.power.generationKw, 0xf6e05e);
    bar(t('hud.console.consumption'), s.power.loadKw, s.power.loadKw > s.power.generationKw ? 0xfc8181 : 0x68d391);

    this.text(x, y, t('hud.console.systems'), 14, HEAD);
    g.fillStyle(0x2d3748).fillRect(x, y + 21, width, 2);
    y += 32;
    const row = (label: string, on: boolean, locked: boolean, focused: boolean, onClick?: () => void) => {
      g.fillStyle(focused ? 0xfbd38d : 0x2d3748).fillRect(x, y, width, 34);
      g.fillStyle(on ? 0x16291f : 0x1a202c).fillRect(x + 2, y + 2, width - 4, 30);
      this.text(x + 12, y + 9, label, 13, on ? '#f7fafc' : DIM);
      this.text(x + width - 12, y + 10, locked ? t('hud.console.always') : t(on ? 'hud.console.on' : 'hud.console.off'), 11, locked ? SOFT : on ? GOOD : BAD).setOrigin(1, 0);
      if (onClick) this.add(this.scene.add.zone(x, y, width, 34).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', onClick);
      y += 38;
    };
    for (const load of s.power.loads.filter((l) => l.essential)) row(tr(`hud.load.${load.id}`), true, true, false);
    this.loads(s).forEach((load, i) =>
      row(tr(`hud.load.${load.id}`), load.on, false, this.cursor.column === 'loads' && this.cursor.row === i, () => {
        this.cursor = { column: 'loads', row: i };
        this.toggle(load.id);
        this.render();
      }),
    );
    const overload = this.loads(s).filter((l) => l.on).length > s.power.sockets;
    y += 4;
    const note = this.text(x, y, t(overload ? 'hud.console.overload' : 'hud.console.powerHint'), 11, overload ? BAD : DIM, width);
    y += note.height + 14;

    if (s.mars) {
      this.text(x, y, t('hud.console.tomorrow'), 14, HEAD);
      g.fillStyle(0x2d3748).fillRect(x, y + 21, width, 2);
      y += 32;
      const f = s.mars.forecast;
      const forecast = this.text(x, y, t('hud.console.forecast', { min: Math.round(f.minTempC), sky: tr(`mars.uv.${f.uv ?? 'none'}`) }), 12, '#fbd38d', width);
      y += forecast.height + 8;
      const loss = Math.round(s.mars.panels.loss * 100);
      const dust = this.text(x, y, t(loss > 0 ? 'hud.console.panelDust' : 'hud.console.panelClean', { loss }), 12, s.mars.panels.canClean ? '#f6e05e' : SOFT, width);
      y += dust.height + 6;
      this.text(x, y, t(s.mars.nightReady ? 'hud.console.nightReady' : 'hud.console.nightNotReady'), 12, s.mars.nightReady ? GOOD : SOFT, width);
    }
  }
}

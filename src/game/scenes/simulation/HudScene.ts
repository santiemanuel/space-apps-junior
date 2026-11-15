import Phaser from 'phaser';
import { INCIDENTS } from '../../../content/incidents';
import { efficiency } from '../../../core/crew/efficiency';
import type { CrewId } from '../../../core/crew/types';
import type { SimSnapshot } from '../../../core/habitat/events';
import { definitionOf } from '../../../core/incidents/planner';
import { cruiseDistanceAu } from '../../../core/meters/energy';
import type { AlertLevel } from '../../../core/meters/types';
import { Rng } from '../../../core/rng/Rng';
import { getLocale, t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../../display';
import { SceneKeys, type SceneKey } from '../../sceneKeys';
import { MARS_CONTENT } from '../../../content/gale';
import { SHIP_LAYOUT } from '../../../content/ship';
import { GALE_CRATER_VIEW } from '../../../content/galeTerrain';
import { crewTextureKey } from '../../assets';
import { CraterView, CRATER_TEXTURE } from './CraterView';
import { HUD_ICONS, preloadHudIcons } from '../../hudIcons';
import { Minimap, MINIMAP_FRAME, type MinimapFrame } from './Minimap';
import { PanelColumn, type PanelRow } from './PanelColumn';
import { MinigameView } from './minigames/MinigameView';
import { formatDate, healthLights, LIGHT, lightFor, NAMES, StatusView, supplies } from './StatusView';
import { toggleOverlay, type SimulationSceneData } from './simulationData';

/** La vista del mapa ocupa 21 tiles; el resto de la pantalla es el tablero (como en las referencias, angosto). */
export const VIEW_WIDTH = 21 * TILE;
/** Dónde aparecen los avisos sobre el mapa: debajo de la placa del jugador y de los botones. */
export const TOAST_Y = 104;
const DAY_MS = 86_400_000;
/** Superpuestas que tapan la vista del mapa: con una abierta no se abre el estado ni el mapa del cráter. */
const OVERLAYS = [SceneKeys.Planning, SceneKeys.DataPanel, SceneKeys.MissionControl] as const;
const LEVEL_COLOR: Record<AlertLevel, string> = { calm: '#68d391', alert: '#f6e05e', impact: '#fc8181' };
/** Tinte de la interfaz según el nivel del reloj (§3.1): amarillo en Alerta. */
const LEVEL_TINT: Record<AlertLevel, [number, number]> = { calm: [0, 0], alert: [0xecc94b, 0.1], impact: [0xe53e3e, 0.12] };
/** Cajas del tablero: borde izquierdo, ancho y margen interno (px). */
const PANEL = { x: VIEW_WIDTH + 10, width: GAME_WIDTH - VIEW_WIDTH - 18, pad: 10, gap: 6 } as const;
const INNER = { x: PANEL.x + PANEL.pad, width: PANEL.width - 2 * PANEL.pad } as const;
/** Alto máximo del minimapa (px). */
const MINIMAP_MAX_HEIGHT = 150;
/** Placa del jugador (arriba a la izquierda del mapa) y botones (arriba a la derecha). */
const BADGE = { x: 10, y: 10, width: 252, height: 60 } as const;
const BUTTON = { size: 46, gap: 6, y: 10 } as const;
/** Franja de la misión, arriba al centro del mapa (entre la placa y los botones): fase, fecha, avance y semáforo. */
const STRIP = { x: BADGE.x + BADGE.width + 10, width: 456, y: 10 } as const;
/** Tarjeta de la decisión pendiente, abajo al centro del mapa. */
const CARD = { width: 600, bottom: GAME_HEIGHT - 34 } as const;
/** Recorte de la cara en el cuadro de frente de las hojas de la tripulación (px de mundo). */
const FACE = { x: 4, y: 18, w: 72, h: 52, scale: 0.75 } as const;
const HEAD = '#90cdf4';
const SOFT = '#a0aec0';
const DIM = '#718096';

type BoxStyle = 'normal' | 'alert' | 'goal';
const BOX_COLORS: Record<BoxStyle, { edge: number; light: number; fill: number }> = {
  normal: { edge: 0x4a4266, light: 0x7c6fa8, fill: 0x121829 },
  goal: { edge: 0xb7791f, light: 0xfbd38d, fill: 0x161a2a },
  alert: { edge: 0xc53030, light: 0xfc8181, fill: 0x2a0f18 },
};

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
const bar = (fraction: number, width = 10) => {
  const full = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
};
const decimal = (value: number, digits = 1) => (getLocale() === 'es' ? value.toFixed(digits).replace('.', ',') : value.toFixed(digits));
const days = (n: number) => (n > 99 ? t('hud.meter.manyDaysShort') : t('hud.meter.daysShort', { days: n }));

/**
 * Caja de pixel art con las esquinas cortadas: contorno oscuro, borde de metal con brillo arriba y fondo. Cada capa
 * es un octógono hecho con tres rectángulos.
 */
export function drawBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, style: BoxStyle = 'normal'): void {
  const c = BOX_COLORS[style];
  const octagon = (inset: number, cut: number, color: number) => {
    const [ix, iy, iw, ih] = [x + inset, y + inset, w - 2 * inset, h - 2 * inset];
    g.fillStyle(color).fillRect(ix + cut, iy, iw - 2 * cut, ih).fillRect(ix, iy + cut, iw, ih - 2 * cut).fillRect(ix + cut / 2, iy + cut / 2, iw - cut, ih - cut);
  };
  octagon(0, 8, 0x05070d);
  octagon(2, 6, c.edge);
  g.fillStyle(c.light).fillRect(x + 8, y + 2, w - 16, 2);
  octagon(4, 4, c.fill);
}

/** Clics por segundo del monitor de partículas: suben con la dosis real y se aceleran en Alerta (§3.1) [regla]. */
export const particleClicksPerSecond = (uGyH: number, level: AlertLevel): number =>
  Math.min(25, 0.5 * Math.sqrt(Math.max(0, uGyH))) * (level === 'alert' ? 2 : level === 'impact' ? 3 : 1);

interface Button {
  frame: string;
  key: string;
  action: () => void;
}

/**
 * Tablero de la simulación (§3.1, §3.6), ordenado en cajas como en las referencias: minimapa, la misión (fase, fecha,
 * semáforo), los tres medidores con los días que duran, la tripulación, los datos reales del día (con su fuente) y
 * abajo el objetivo o, si algo anda mal, la caja de alerta. Sobre el mapa: la placa del tripulante que maneja el
 * jugador, botones para las pantallas (con su tecla) y la tarjeta de la decisión pendiente. El detalle completo está
 * en el estado (`StatusView`, tecla I). Lee `sim:snapshot` y responde por el bus de la simulación.
 */
export class HudScene extends Phaser.Scene {
  private data_!: SimulationSceneData;
  private snapshot: SimSnapshot | null = null;
  private columns!: Record<'meters' | 'crew' | 'real' | 'bottom', PanelColumn>;
  private boxes!: Phaser.GameObjects.Graphics;
  private boxSignature = '';
  private strip!: { box: Phaser.GameObjects.Graphics; column: PanelColumn; height: number };
  private minimap!: Minimap;
  private tint!: Phaser.GameObjects.Rectangle;
  private monitorDot!: Phaser.GameObjects.Arc;
  private badge!: {
    face: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.Text;
    place: Phaser.GameObjects.Text;
    icons: { image: Phaser.GameObjects.Image; pip: Phaser.GameObjects.Rectangle }[];
  };
  private card!: { box: Phaser.GameObjects.Graphics; column: PanelColumn; signature: string };
  /** Lo que el tablero dibuja sobre el mapa (placa, botones, ayuda): se esconde con una pantalla superpuesta abierta. */
  private readonly onMap: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[] = [];
  private covered = false;
  private nextClickAt = 0;
  private lastClickAt = -1000;
  private muted = false;
  private readonly rng = new Rng(0x9e1);

  constructor() {
    super(SceneKeys.Hud);
  }

  init(data: SimulationSceneData): void {
    this.snapshot = null;
    this.data_ = data;
    this.crater = null;
    this.boxSignature = '';
    this.onMap.length = 0;
    this.covered = false;
  }

  preload(): void {
    preloadHudIcons(this);
    if (this.data_.namespace === 'mars') this.load.image(CRATER_TEXTURE, GALE_CRATER_VIEW.image);
  }

  /** Mapa del cráter (sólo en Marte): se abre con V y solo al llegar a Gale. */
  private crater: CraterView | null = null;
  /** Estado completo (tecla I). */
  private status!: StatusView;
  private minigame!: MinigameView;

  /** Abre una de las vistas a pantalla entera del tablero (o las cierra con `null`); el reloj queda en pausa mientras se mira. */
  private show(view: 'status' | 'crater' | null): void {
    if (view === 'status' && !this.snapshot) return;
    if (this.minigame?.visible) return;
    if (view && OVERLAYS.some((key) => this.scene.isActive(key))) return;
    const was = !!this.crater?.visible || this.status.visible;
    this.crater?.setVisible(view === 'crater');
    if (view === 'status') this.status.show(this.snapshot!);
    else this.status.hide();
    if (was !== !!view) this.data_.sim.emit('sim:pause', { paused: !!view });
  }

  /** Ícono del atlas si existe (los nuevos pueden faltar si no se regeneró el atlas). */
  private hasIcon(frame: string): boolean {
    return this.textures.exists(HUD_ICONS) && this.textures.get(HUD_ICONS).has(frame);
  }

  private icon(frame: string): string | undefined {
    return this.hasIcon(frame) ? frame : undefined;
  }

  create(): void {
    const { sim } = this.data_;
    const mars = this.data_.namespace === 'mars';
    this.tint = this.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0, 0);
    this.drawFrame();
    this.boxes = this.add.graphics().setDepth(50);
    // Minimapa arriba de todo, en su caja.
    this.minimap = new Minimap(this, mars ? MARS_CONTENT.layout : SHIP_LAYOUT, { x: INNER.x, y: 8 + PANEL.pad, width: INNER.width, height: MINIMAP_MAX_HEIGHT });
    const column = () => new PanelColumn(this, INNER.x, 0, INNER.width);
    this.columns = { meters: column(), crew: column(), real: column(), bottom: column() };
    this.strip = { box: this.add.graphics().setDepth(50), column: new PanelColumn(this, STRIP.x + 14, STRIP.y + 9, STRIP.width - 28), height: 0 };
    this.monitorDot = this.add.circle(0, 0, 4, 0xfbd38d).setVisible(false).setDepth(52);
    this.createBadge();
    this.createButtons(mars);
    this.card = { box: this.add.graphics().setDepth(50), column: new PanelColumn(this, (VIEW_WIDTH - CARD.width) / 2 + 16, 0, CARD.width - 32), signature: '' };
    this.onMap.push(
      this.add
        .text(12, GAME_HEIGHT - 10, t('hud.panel.controlsShort'), { fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e0', backgroundColor: '#0b1020b0', padding: { x: 6, y: 3 } })
        .setOrigin(0, 1)
        .setDepth(50),
    );

    const off = sim.on('sim:snapshot', (s) => (this.snapshot = s));
    const keyboard = this.input.keyboard!;
    keyboard.addKey('M').on('down', () => (this.muted = !this.muted));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.status = new StatusView(this, this.data_.namespace);
    this.minigame = new MinigameView(this, sim);
    const offMinigame = sim.on('sim:minigame', (request) => {
      this.show(null);
      this.minigame.open(request);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offMinigame);
    keyboard.addKey('I').on('down', () => this.toggleStatus());
    keyboard.addKey('ENTER').on('down', () => this.show(null));
    if (mars) {
      this.crater = new CraterView(this, MARS_CONTENT.layout);
      keyboard.addKey('V').on('down', () => this.toggleCrater());
      // Recién llegados a Gale: primero, dónde estamos.
      if (Date.parse(this.data_.state.simDate) <= Date.parse(MARS_CONTENT.calendar.windows.mars.start)) this.show('crater');
    }
  }

  private toggleStatus(): void {
    this.show(this.status.visible ? null : 'status');
  }

  private toggleCrater(): void {
    this.show(this.crater!.visible ? null : 'crater');
  }

  private toggleOverlay(key: SceneKey): void {
    if (this.minigame.visible) return;
    this.show(null);
    toggleOverlay(this.scene, key, this.data_);
  }

  /** Placa del tripulante que maneja el jugador: cara, nombre, dónde está y las cuatro luces de su salud. */
  private createBadge(): void {
    const g = this.add.graphics().setDepth(50);
    drawBox(g, BADGE.x, BADGE.y, BADGE.width, BADGE.height, 'goal');
    g.fillStyle(0x05070d).fillRect(BADGE.x + 8, BADGE.y + 8, 58, 44);
    g.fillStyle(0x2a2440).fillRect(BADGE.x + 10, BADGE.y + 10, 54, 40);
    const face = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setScale(FACE.scale).setDepth(51).setVisible(false);
    const name = this.add.text(BADGE.x + 74, BADGE.y + 8, '', { fontFamily: 'monospace', fontSize: '15px', color: '#fbd38d' }).setDepth(51);
    const place = this.add.text(BADGE.x + 74, BADGE.y + 12, '', { fontFamily: 'monospace', fontSize: '11px', color: SOFT }).setDepth(51);
    const icons = Array.from({ length: 4 }, (_, i) => {
      const x = BADGE.x + 84 + i * 26;
      return {
        image: (this.textures.exists(HUD_ICONS) ? this.add.image(x, BADGE.y + 38, HUD_ICONS) : this.add.image(x, BADGE.y + 38, '__WHITE')).setDepth(51),
        pip: this.add.rectangle(x, BADGE.y + 49, 12, 2, 0x68d391).setDepth(51),
      };
    });
    this.badge = { face, name, place, icons };
    this.onMap.push(g, name, place, ...icons.flatMap((i) => [i.image, i.pip]));
  }

  /** Botones de las pantallas, arriba a la derecha del mapa: ícono y la tecla que hace lo mismo. */
  private createButtons(mars: boolean): void {
    const buttons: Button[] = [
      { frame: 'plan', key: 'P', action: () => this.toggleOverlay(SceneKeys.Planning) },
      { frame: 'missionControl', key: 'C', action: () => this.toggleOverlay(SceneKeys.MissionControl) },
      { frame: 'charts', key: 'G', action: () => this.toggleOverlay(SceneKeys.DataPanel) },
      { frame: 'status', key: 'I', action: () => this.toggleStatus() },
      ...(mars ? [{ frame: 'map', key: 'V', action: () => this.toggleCrater() }] : []),
    ];
    const tooltip = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0', backgroundColor: '#0b1020ee', padding: { x: 5, y: 3 } })
      .setOrigin(1, 0)
      .setDepth(56)
      .setVisible(false);
    const tips: Record<string, string> = { P: 'plan', C: 'missionControl', G: 'charts', I: 'status', V: 'crater' };
    buttons.forEach((b, i) => {
      const x = VIEW_WIDTH - 10 - BUTTON.size - (buttons.length - 1 - i) * (BUTTON.size + BUTTON.gap);
      const g = this.add.graphics().setDepth(50);
      const draw = (hover: boolean) => {
        g.clear();
        drawBox(g, x, BUTTON.y, BUTTON.size, BUTTON.size, hover ? 'goal' : 'normal');
      };
      draw(false);
      const cx = x + BUTTON.size / 2;
      const cy = BUTTON.y + BUTTON.size / 2 - 2;
      const icon = this.hasIcon(b.frame)
        ? this.add.image(cx, cy, HUD_ICONS, b.frame).setDepth(51)
        : this.add.text(cx, cy, b.key, { fontFamily: 'monospace', fontSize: '16px', color: '#e2e8f0' }).setOrigin(0.5).setDepth(51);
      const cap = this.add.text(x + BUTTON.size - 7, BUTTON.y + BUTTON.size - 5, b.key, { fontFamily: 'monospace', fontSize: '10px', color: '#fbd38d' }).setOrigin(1, 1).setDepth(51);
      const hit = this.add.zone(x, BUTTON.y, BUTTON.size, BUTTON.size).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(52);
      this.onMap.push(g, icon, cap, hit);
      hit.on('pointerover', () => {
        draw(true);
        tooltip.setText(`${b.key}: ${tr(`hud.info.key.${tips[b.key]}`)}`).setPosition(x + BUTTON.size, BUTTON.y + BUTTON.size + 4).setVisible(true);
      });
      hit.on('pointerout', () => {
        draw(false);
        tooltip.setVisible(false);
      });
      hit.on('pointerdown', b.action);
    });
  }

  /**
   * Marco del tablero en píxeles de arte (2 px): borde de metal con brillo arriba, remaches en las esquinas y una
   * franja de luz que separa el mapa, con los colores de la nave.
   */
  private drawFrame(): void {
    const x = VIEW_WIDTH;
    const w = GAME_WIDTH - VIEW_WIDTH;
    const h = GAME_HEIGHT;
    const g = this.add.graphics();
    g.fillStyle(0x0b1020, 0.98).fillRect(x, 0, w, h);
    g.fillStyle(0x1e162d).fillRect(x, 0, 4, h);
    g.fillStyle(0x4a4266).fillRect(x + 4, 0, 4, h);
    g.fillStyle(0x7c6fa8).fillRect(x + 4, 0, 2, h);
    // Franja de luz ámbar en el borde, cada tanto, como en las paredes de la nave.
    for (let y = 40; y < h - 40; y += 120) g.fillStyle(0xf6ad55).fillRect(x + 4, y, 2, 20).fillStyle(0xffe0a0).fillRect(x + 4, y + 4, 2, 6);
  }

  update(time: number, deltaMs: number): void {
    this.minigame.update(time, deltaMs);
    const s = this.snapshot;
    this.minimap.update(this.registry.get(MINIMAP_FRAME) as MinimapFrame | undefined, time);
    if (!s) return;
    this.crater?.update(s.activePosition, time);
    // Otra superpuesta se abrió encima (p. ej. la planificación con un aviso): se cierra la vista del tablero.
    if ((this.crater?.visible || this.status.visible) && OVERLAYS.some((key) => this.scene.isActive(key))) {
      this.crater?.setVisible(false);
      this.status.hide();
      if (!this.scene.isActive(SceneKeys.Planning) && !this.scene.isActive(SceneKeys.DataPanel)) this.data_.sim.emit('sim:pause', { paused: false });
    }
    const [color, alpha] = LEVEL_TINT[s.level];
    this.tint.setFillStyle(color, alpha);
    this.renderPanel(s);
    this.cover(!!this.crater?.visible || this.status.visible || this.minigame.visible || OVERLAYS.some((key) => this.scene.isActive(key)));
    if (!this.covered) {
      this.renderStrip(s);
      this.renderBadge(s);
      this.renderCard(s);
    }
    this.particleMonitor(s, time);
    // Alerta: el tablero titila un poco, como si la nave sintiera la tormenta que viene (§3.1).
    const camera = this.cameras.main;
    if (s.level === 'alert' && !s.paused) camera.setAlpha(0.9 + 0.1 * this.rng.next()).setScroll(this.rng.next() < 0.1 ? 1 : 0, 0);
    else camera.setAlpha(1).setScroll(0, 0);
  }

  /** Acomoda las cajas una debajo de otra según lo que tiene cada una; la de abajo llega hasta el borde. */
  private renderPanel(s: SimSnapshot): void {
    const bottom = this.bottomRows(s);
    const sections: [PanelColumn, PanelRow[]][] = [
      [this.columns.meters, this.meterRows(s)],
      [this.columns.crew, this.crewRows(s)],
      [this.columns.real, this.realRows(s)],
      [this.columns.bottom, bottom.rows],
    ];
    const boxes: [number, number, BoxStyle][] = [[8, this.minimap.height + 2 * PANEL.pad, 'normal']];
    let y = 8 + this.minimap.height + 2 * PANEL.pad + PANEL.gap;
    sections.forEach(([column, rows], i) => {
      column.moveTo(y + PANEL.pad - 2);
      column.render(rows);
      const last = i === sections.length - 1;
      const height = last ? GAME_HEIGHT - 8 - y : column.height + 2 * PANEL.pad - 2;
      boxes.push([y, height, last ? bottom.style : 'normal']);
      y += height + PANEL.gap;
    });
    const signature = JSON.stringify(boxes);
    if (signature === this.boxSignature) return;
    this.boxSignature = signature;
    this.boxes.clear();
    for (const [by, h, style] of boxes) drawBox(this.boxes, PANEL.x, by, PANEL.width, h, style);
  }

  /** Esconde (o vuelve a mostrar) lo que el tablero dibuja sobre el mapa. */
  private cover(covered: boolean): void {
    if (covered === this.covered) return;
    this.covered = covered;
    for (const object of this.onMap) {
      object.setVisible(!covered);
      if (object instanceof Phaser.GameObjects.Zone) {
        if (covered) object.disableInteractive();
        else object.setInteractive({ useHandCursor: true });
      }
    }
    this.badge.face.setVisible(!covered && this.badge.face.texture.key !== '__WHITE');
    if (!covered) return;
    for (const part of [this.strip, this.card]) {
      part.column.render([]);
      part.box.clear();
    }
    this.strip.height = 0;
    this.card.signature = '';
  }

  /** Franja de la misión: fase con la fecha y el día, la barra de avance y el semáforo con su motivo. */
  private renderStrip(s: SimSnapshot): void {
    const { column, box } = this.strip;
    column.render(this.missionRows(s));
    const height = column.height + 16;
    if (height === this.strip.height) return;
    this.strip.height = height;
    box.clear();
    drawBox(box, STRIP.x, STRIP.y, STRIP.width, height);
  }

  private missionRows(s: SimSnapshot): PanelRow[] {
    const start = Date.parse(s.window.start);
    const total = Math.round((Date.parse(s.window.end) - start) / DAY_MS);
    const day = Math.min(total, Math.floor((Date.parse(s.simDate) - start) / DAY_MS) + 1);
    const rows: PanelRow[] = [
      { text: tr(`common.phase.${s.phase}`), size: 14, color: HEAD, value: { text: `${formatDate(s.simDate)} · ${t(s.place === 'mars' ? 'hud.panel.sol' : 'hud.panel.day', { day, total })}`, color: SOFT } },
      { text: '', bar: { fraction: s.progress, color: '#63b3ed', from: 0, segments: 40 }, size: 4 },
      { gap: 2, text: `● ${tr(s.reasonKey)}`, color: LEVEL_COLOR[s.level], size: 12 },
    ];
    // El ritmo sólo aparece cuando no es el de siempre (manejando a alguien).
    if (s.paused || !s.manual) rows.push({ text: s.paused ? t('hud.panel.paused') : t('hud.panel.paceFast'), color: SOFT, size: 11 });
    if (s.mars) {
      const { daylight, evaOpen } = s.mars;
      rows.push({
        icon: this.icon('airlock'),
        text: `${t(daylight ? 'mars.panel.day' : 'mars.panel.night')} · ${t(evaOpen ? 'mars.panel.evaOpen' : daylight ? 'mars.panel.evaBlocked' : 'mars.panel.evaNight')}`,
        color: evaOpen ? LIGHT.green : LIGHT.yellow,
        size: 11,
      });
    }
    return rows;
  }

  /** Los tres medidores: barra con el semáforo y, a la derecha, cuántos días alcanza (la energía, si carga o gasta). */
  private meterRows(s: SimSnapshot): PanelRow[] {
    const st = s.state;
    const { battery, air, water, food, co2High } = supplies(st);
    const lifeSupport = Math.min(air, water);
    const lifeColor = co2High ? LIGHT.red : lightFor(lifeSupport, 14, 4);
    const charging = s.power.generationKw >= s.power.loadKw;
    const meter = (icon: string, label: string, fraction: number, color: string, value: string, valueColor = color): PanelRow => ({
      icon: this.icon(icon),
      text: label,
      color,
      size: 12,
      bar: { fraction, color, from: 112, to: INNER.width - 46, segments: 8 },
      value: { text: value, color: valueColor },
    });
    const rows: PanelRow[] = [
      meter('energy', t('hud.meter.energy'), battery, lightFor(battery, 0.3, 0.1), charging ? '▲' : '▼', charging ? LIGHT.green : LIGHT.yellow),
      meter('air', t('hud.meter.lifeSupport'), lifeSupport / 60, lifeColor, days(lifeSupport)),
      meter('food', t('hud.meter.food'), food / 60, lightFor(food, 14, 4), days(food)),
    ];
    // Sólo cuando hay un problema: el resto del detalle está en el estado completo (I).
    if (co2High) rows.push({ icon: this.icon('co2'), text: t('hud.meter.co2Short'), color: LIGHT.red, size: 11 });
    if (st.inventory.spares <= 0) rows.push({ icon: this.icon('spares'), text: t('hud.panel.sparesShort', { count: 0 }), color: LIGHT.yellow, size: 11 });
    const uv = s.mars?.weather.uv;
    if (uv === 'Low' || uv === 'Moderate') rows.push({ icon: this.icon('dustStorm'), text: tr(`mars.uv.${uv}`), color: uv === 'Low' ? LIGHT.red : LIGHT.yellow, size: 11 });
    return rows;
  }

  private crewRows(s: SimSnapshot): PanelRow[] {
    const st = s.state;
    const { bus } = this.data_;
    const rows: PanelRow[] = [{ text: t('hud.panel.crew'), color: HEAD, size: 11 }];
    for (const m of st.crew) {
      rows.push({
        portrait: m.id,
        half: true,
        text: `${m.id === st.activeCrewId ? '▶ ' : ''}${NAMES[m.id]}`,
        size: 12,
        color: m.resting ? SOFT : lightFor(efficiency(m, st.meters.lifeSupport.co2MmHg), 0.8, 0.6),
        // Sólo se prende el ícono de lo que no está en verde.
        icons: m.resting ? [] : healthLights(m).filter((l) => l.color !== LIGHT.green).map((l) => ({ frame: l.id, color: l.color })),
        onClick: m.id === st.activeCrewId ? undefined : () => bus.emit('crew:switched', { crewId: m.id }),
      });
    }
    return rows;
  }

  /** Datos reales del día, siempre como archivados: la dosis medida, la demora de la radio y el Sol o el tiempo de Gale. */
  private realRows(s: SimSnapshot): PanelRow[] {
    const mc = s.missionControl;
    const minutes = mc.delaySeconds / 60;
    const rows: PanelRow[] = [
      { text: t('hud.panel.realData'), color: HEAD, size: 11 },
      { icon: this.icon('radiation'), text: t('hud.panel.doseShort', { value: Math.round(s.dose.uGyH) }), color: '#e2e8f0', size: 11 },
      {
        icon: this.icon('earthSignal'),
        text: mc.offline ? t('hud.panel.signalOff') : minutes >= 1 ? t('hud.panel.signal', { minutes: Math.round(minutes) }) : t('hud.panel.signalSeconds', { seconds: Math.max(1, Math.round(mc.delaySeconds)) }),
        color: mc.offline ? LIGHT.yellow : '#e2e8f0',
        size: 11,
      },
    ];
    if (s.mars) {
      const w = s.mars.weather;
      rows.push({
        icon: this.icon('dustStorm'),
        text: t('hud.panel.curiosityShort', { sol: w.sol, min: Math.round(w.minTempC), max: w.maxTempC === null ? '?' : Math.round(w.maxTempC) }),
        color: '#fbd38d',
        size: 11,
      });
    } else {
      const au = cruiseDistanceAu(s.progress, s.phase === 'cruiseBack' ? 'back' : 'out');
      rows.push({ icon: this.icon('energy'), text: t('hud.panel.sunDistance', { au: decimal(au, 2) }), color: '#e2e8f0', size: 11 });
    }
    rows.push({ icon: this.icon('energy'), text: t('hud.panel.power', { gen: decimal(s.power.generationKw), load: decimal(s.power.loadKw) }), color: SOFT, size: 11 });
    rows.push({ text: t('hud.panel.archived', { date: formatDate(s.dose.date) }), color: DIM, size: 10 });
    return rows;
  }

  /**
   * Caja de abajo: con decisiones, emergencias o una alerta, la caja roja con qué pasa y qué se puede hacer; si no,
   * el objetivo de la fase con lo que ya está en orden tildado.
   */
  private bottomRows(s: SimSnapshot): { rows: PanelRow[]; style: BoxStyle } {
    const st = s.state;
    const { sim } = this.data_;
    const decided = st.activeIncidents.filter((i) => i.responseId);
    if (s.decisions.length || decided.length || s.emergencies.length || s.level === 'impact') {
      const rows: PanelRow[] = [{ icon: this.icon('warning'), text: t('hud.panel.alertBox'), color: LIGHT.red, size: 13 }];
      for (const d of s.decisions) rows.push({ text: `⚠ ${tr(`${d.textKey}.title`)}`, color: d.incident.status === 'active' ? LIGHT.red : LIGHT.yellow, size: 11 });
      if (s.decisions.length) rows.push({ text: t('hud.panel.decideOnMap'), color: SOFT, size: 10 });
      for (const incident of decided) {
        const def = definitionOf(INCIDENTS, incident.definitionId);
        const response = def.responses.find((r) => r.id === incident.responseId)!;
        const status = response.work ? t('hud.panel.working', { progress: bar(incident.progress ?? 0, 6) }) : tr(`${def.textKey}.response.${response.id}.title`);
        rows.push({ text: `• ${tr(`${def.textKey}.title`)}: ${status}`, color: '#e2e8f0', size: 11 });
      }
      const marginKey = s.place === 'mars' ? 'incidents.cascade.marginSols' : 'incidents.cascade.margin';
      for (const e of s.emergencies) {
        const margin = e.overdue ? tr('incidents.cascade.overdue') : tr(marginKey, { days: Math.ceil(e.marginHours / 24) });
        rows.push({ text: `${tr(`hud.meterName.${e.meter}`, { name: e.crewId ? NAMES[e.crewId as CrewId] : '' })}: ${margin}`, color: LIGHT.yellow, size: 11 });
      }
      if (s.sacrifices.length) rows.push({ gap: 4, text: t('hud.panel.sacrifices'), color: SOFT, size: 10 });
      for (const id of s.sacrifices) rows.push({ text: `● ${tr(`incidents.sacrifice.${id}.title`)}`, color: LIGHT.yellow, size: 11, onClick: () => sim.emit('sim:sacrifice', { id }) });
      return { rows, style: 'alert' };
    }
    const start = Date.parse(s.window.start);
    const left = Math.max(0, Math.ceil((Date.parse(s.window.end) - Date.parse(s.simDate)) / DAY_MS));
    const systemsOk = s.tasks.every((task) => !task.system || st.systems[task.system] === 'green');
    const crewOk = st.crew.every((m) => healthLights(m).every((l) => l.color !== LIGHT.red));
    const goal = s.mars
      ? { text: t('hud.panel.goal.samples', { count: s.mars.samples.count, total: s.mars.samples.total }), done: s.mars.samples.count >= s.mars.samples.total }
      : { text: t(s.phase === 'cruiseBack' ? 'hud.panel.goal.reachEarth' : 'hud.panel.goal.reachMars', { days: left }), done: Date.parse(s.simDate) - start >= Date.parse(s.window.end) - start };
    const check = (done: boolean, text: string): PanelRow => ({
      icon: done ? this.icon('check') : undefined,
      text: done ? text : `☐ ${text}`,
      color: done ? LIGHT.green : '#e2e8f0',
      size: 11,
    });
    return {
      style: 'goal',
      rows: [
        { icon: this.icon('target'), text: t('hud.panel.objective'), color: '#fbd38d', size: 13 },
        check(goal.done, goal.text),
        check(systemsOk, t('hud.panel.goal.systems')),
        check(crewOk, t('hud.panel.goal.crew')),
      ],
    };
  }

  private renderBadge(s: SimSnapshot): void {
    const m = s.state.crew.find((c) => c.id === s.state.activeCrewId);
    if (!m) return;
    const key = crewTextureKey(m.id);
    const b = this.badge;
    if (this.textures.exists(key) && b.face.texture.key !== key) {
      b.face.setTexture(key, 0).setCrop(FACE.x, FACE.y, FACE.w, FACE.h).setVisible(true);
      b.face.setPosition(BADGE.x + 10 - FACE.x * FACE.scale, BADGE.y + 10 - FACE.y * FACE.scale);
    }
    b.name.setText(NAMES[m.id]);
    const where = m.location === 'corridor' || m.location === 'exterior' ? `hud.zone.${m.location}` : `${this.data_.namespace}.zone.${m.location}`;
    b.place.setText(m.resting ? t('hud.panel.resting') : tr(where)).setX(b.name.x + b.name.width + 8);
    healthLights(m).forEach((light, i) => {
      const icon = b.icons[i]!;
      if (this.hasIcon(light.id)) icon.image.setFrame(light.id);
      icon.pip.setFillStyle(Phaser.Display.Color.HexStringToColor(light.color).color);
    });
  }

  /** Tarjeta de la primera decisión pendiente, sobre el mapa: cada opción con su color de riesgo, su tecla y su coste. */
  private renderCard(s: SimSnapshot): void {
    const d = s.decisions[0];
    const { column, box } = this.card;
    if (!d) {
      if (this.card.signature) {
        column.render([]);
        box.clear();
        this.card.signature = '';
      }
      return;
    }
    const { sim } = this.data_;
    const hint = s.hints.find((h) => h.incidentId === d.incident.id)?.responseId;
    const rows: PanelRow[] = [
      { icon: this.icon('warning'), text: tr(`${d.textKey}.title`), color: d.incident.status === 'active' ? LIGHT.red : LIGHT.yellow, size: 15 },
      { text: t('hud.panel.choose'), color: SOFT, size: 11 },
    ];
    d.options.forEach(({ response, available }, i) => {
      rows.push({
        gap: 4,
        text: `[${i + 1}] ● ${tr(`${d.textKey}.response.${response.id}.title`)}${hint === response.id ? ` ${t('hud.panel.hint')}` : ''}`,
        color: available ? LIGHT[response.risk] : '#4a5568',
        size: 13,
        onClick: available ? () => sim.emit('sim:respond', { incidentId: d.incident.id, responseId: response.id }) : undefined,
      });
      rows.push({ text: `     ${tr(`${d.textKey}.response.${response.id}.cost`)}`, color: DIM, size: 11 });
    });
    column.render(rows);
    const height = column.height + 24;
    const top = CARD.bottom - height;
    column.moveTo(top + 12);
    column.render(rows);
    const signature = `${top}|${height}`;
    if (signature === this.card.signature) return;
    this.card.signature = signature;
    box.clear();
    drawBox(box, (VIEW_WIDTH - CARD.width) / 2, top, CARD.width, height, 'alert');
  }

  /** Clics tipo contador Geiger con tiempos al azar (con semilla) según la dosis del día; el punto titila junto a la dosis. */
  private particleMonitor(s: SimSnapshot, time: number): void {
    const rate = s.paused ? 0 : particleClicksPerSecond(s.dose.uGyH, s.level);
    this.monitorDot.setPosition(INNER.x + INNER.width - 4, this.columns.real.rowY(1) + 7).setVisible(time - this.lastClickAt < 70);
    if (rate <= 0 || time < this.nextClickAt) return;
    this.nextClickAt = time + (-Math.log(1 - this.rng.next()) / rate) * 1000;
    this.lastClickAt = time;
    if (!this.muted) this.click();
  }

  private click(): void {
    const sound = this.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = sound.context as AudioContext | undefined;
    if (!ctx || ctx.state !== 'running') return;
    const length = Math.floor(ctx.sampleRate * 0.004);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (this.rng.next() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }
}

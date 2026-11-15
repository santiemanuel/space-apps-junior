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
import { PanelColumn, type PanelRow, PRESENCE_COLOR } from './PanelColumn';
import { MinigameView } from './minigames/MinigameView';
import { formatDate, healthLights, LIGHT, lightFor, NAMES, StatusView, supplies } from './StatusView';
import { gridWarningKey, locationKey, MAP_HINT, taskReason, toggleOverlay, type SimulationSceneData } from './simulationData';
import { Toasts } from './Toasts';
import { audio } from '../../audio/audio';
import { ConsoleView } from './ConsoleView';
import { SleepOverlay } from './SleepOverlay';
import { StormBanner } from './StormBanner';

/** La vista del mapa ocupa 21 tiles; el resto de la pantalla es el tablero (como en las referencias, angosto). */
export const VIEW_WIDTH = 21 * TILE;
/** Dónde aparecen los avisos sobre el mapa: arriba al centro, entre la placa del jugador y los botones. */
export const TOAST_Y = 14;
const DAY_MS = 86_400_000;
/** Superpuestas que tapan la vista del mapa: con una abierta no se abre el estado ni el mapa del cráter. */
const OVERLAYS = [SceneKeys.DataPanel, SceneKeys.MissionControl] as const;
/** Cuadros del indicador de avance rápido (⏩ que corre): no se parece en nada a dormir. */
const FAST_FRAMES = ['▶▷▷', '▶▶▷', '▶▶▶', '▷▶▶', '▷▷▶', '▷▷▷'] as const;
const HOUR_MS = 3_600_000;
const LEVEL_COLOR: Record<AlertLevel, string> = { calm: '#68d391', alert: '#f6e05e', impact: '#fc8181' };
const LEVEL_BOX: Record<AlertLevel, BoxStyle> = { calm: 'normal', alert: 'goal', impact: 'alert' };
/** Tinte de la interfaz según el nivel del reloj (§3.1): amarillo en Alerta. */
const LEVEL_TINT: Record<AlertLevel, [number, number]> = { calm: [0, 0], alert: [0xecc94b, 0.1], impact: [0xe53e3e, 0.12] };
/** Cajas del tablero: borde izquierdo, ancho y margen interno (px). */
const PANEL = { x: VIEW_WIDTH + 10, width: GAME_WIDTH - VIEW_WIDTH - 18, pad: 10, gap: 6 } as const;
const INNER = { x: PANEL.x + PANEL.pad, width: PANEL.width - 2 * PANEL.pad } as const;
/** Alto máximo del minimapa (px). */
const MINIMAP_MAX_HEIGHT = 150;
/** Placa del jugador (arriba a la izquierda del mapa) y botones (arriba a la derecha). */
const BADGE = { x: 10, y: 8, width: 262, height: 84 } as const;
/**
 * Avatar circular del jugador: la cara en el centro y un anillo con sus cuatro stats, un cuarto cada uno (comida,
 * forma, descanso y radiación). Cada cuarto se llena en el sentido del reloj con su color; lo vacío queda oscuro.
 */
const AVATAR = { cx: BADGE.x + 42, cy: BADGE.y + 42, outer: 40, ring: 11, face: 25, gap: 0.09 } as const;
const STAT_RING: Record<'food' | 'condition' | 'fatigue' | 'radiation', { start: number; color: number; dark: number }> = {
  food: { start: Math.PI, color: 0x48bb78, dark: 0x1c3a2a },
  condition: { start: Math.PI * 1.5, color: 0xf56565, dark: 0x4a1c22 },
  fatigue: { start: 0, color: 0x4299e1, dark: 0x1a2c4a },
  radiation: { start: Math.PI / 2, color: 0xecc94b, dark: 0x473b16 },
};
const BUTTON = { size: 46, gap: 6, y: 10 } as const;
/** Cartel de la misión, abajo a la izquierda del mapa: fase, fecha, avance, semáforo y tareas pendientes. */
const STRIP = { x: 10, width: 436, bottom: GAME_HEIGHT - 10 } as const;
/** Barra de controles, abajo a la derecha del mapa (compacta, con teclas dibujadas). */
const CONTROLS = { right: VIEW_WIDTH - 10, bottom: GAME_HEIGHT - 10, height: 30 } as const;
/** Tarjeta de la decisión pendiente, abajo a la derecha (encima de los controles, sin pisar el cartel de la misión). */
const CARD = { x: STRIP.x + STRIP.width + 12, width: VIEW_WIDTH - (STRIP.x + STRIP.width + 12) - 10, bottom: CONTROLS.bottom - CONTROLS.height - 6 } as const;
/** Recorte de la cara en el cuadro de frente de las hojas de la tripulación (px de mundo). */
const FACE = { x: 18, y: 20, w: 44, h: 44 } as const;
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
  private strip!: { box: Phaser.GameObjects.Graphics; column: PanelColumn; signature: string };
  private controlsBar!: { root: Phaser.GameObjects.Container; signature: string };
  private minimap!: Minimap;
  private tint!: Phaser.GameObjects.Rectangle;
  private monitorDot!: Phaser.GameObjects.Arc;
  private badge!: {
    face: Phaser.GameObjects.Image;
    ring: Phaser.GameObjects.Graphics;
    name: Phaser.GameObjects.Text;
    place: Phaser.GameObjects.Text;
    icons: Phaser.GameObjects.Image[];
    /** Estado del jugador (como en Discord), junto al nombre. */
    presenceText: Phaser.GameObjects.Text;
    signature: string;
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
  /** Consola de recursos (E junto a ella). */
  private console_!: ConsoleView;
  private banner!: StormBanner;
  private sleep!: SleepOverlay;
  /** Tarjeta de la tormenta: las dos opciones lado a lado, con lo que se gana y lo que se arriesga. */
  private stormCard!: { root: Phaser.GameObjects.Container; signature: string };
  /** Estaba dormido en el cuadro anterior (para el despertar). */
  private wasAsleep = false;
  /** Avisos del mapa, en cola. */
  private toasts!: Toasts;
  /** Línea de ayuda de lo que hace E donde está el jugador: fija sobre la barra de controles, no pegada a él. */
  private hint!: Phaser.GameObjects.Text;

  /** Abre una de las vistas a pantalla entera del tablero (o las cierra con `null`); el reloj queda en pausa mientras se mira. */
  private show(view: 'status' | 'crater' | 'console' | null): void {
    if (view && view !== 'crater' && !this.snapshot) return;
    if (this.minigame?.visible) return;
    if (view && OVERLAYS.some((key) => this.scene.isActive(key))) return;
    const was = !!this.crater?.visible || this.status.visible || this.console_.visible;
    if (was !== !!view) audio.sfx(view ? 'open' : 'back');
    this.crater?.setVisible(view === 'crater');
    if (view === 'console') this.console_.show(this.snapshot!);
    else this.console_.hide();
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
    this.strip = { box: this.add.graphics().setDepth(50), column: new PanelColumn(this, STRIP.x + 14, 0, STRIP.width - 28), signature: '' };
    this.monitorDot = this.add.circle(0, 0, 4, 0xfbd38d).setVisible(false).setDepth(52);
    this.createBadge();
    this.createButtons(mars);
    this.card = { box: this.add.graphics().setDepth(50), column: new PanelColumn(this, CARD.x + 16, 0, CARD.width - 32), signature: '' };
    const controlsRoot = this.add.container(0, 0).setDepth(50);
    this.controlsBar = { root: controlsRoot, signature: '' };
    this.onMap.push(controlsRoot);
    this.renderControls(false);

    const off = sim.on('sim:snapshot', (s) => (this.snapshot = s));
    const keyboard = this.input.keyboard!;
    keyboard.addKey('M').on('down', () => (this.muted = audio.toggleMute()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.status = new StatusView(this, this.data_.namespace);
    this.minigame = new MinigameView(this, sim);
    this.console_ = new ConsoleView(this, sim, () => this.show(null));
    this.banner = new StormBanner(this);
    this.sleep = new SleepOverlay(this, t('hud.sleep.wakeHint'));
    this.stormCard = { root: this.add.container(0, 0).setDepth(51), signature: '' };
    this.wasAsleep = false;
    this.toasts = new Toasts(this);
    this.hint = this.add
      .text((CARD.x + VIEW_WIDTH - 10) / 2, CONTROLS.bottom - CONTROLS.height - 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#fbd38d', backgroundColor: '#0d1322ee', padding: { x: 10, y: 5 }, align: 'center', wordWrap: { width: CARD.width - 30 } })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);
    const offToast = sim.on('sim:toast', (toast) => this.toasts.push(toast));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offToast);
    const offMinigame = sim.on('sim:minigame', (request) => {
      this.show(null);
      this.minigame.open(request);
    });
    const offConsole = sim.on('sim:console', () => this.show('console'));
    // Tormenta solar en camino (o que llega sin aviso): el cartel grande, como la entrada de un jefe.
    const stormBanner = (key: 'hud.storm.incoming' | 'hud.storm.arrived') => {
      if (this.minigame.visible) return;
      audio.sfx('siren', 0.9, 0.9);
      this.banner.show(t(key), () => this.stormCountdown());
    };
    const { bus } = this.data_;
    const offStorm = [
      bus.on('incident:warned', (i) => i.definitionId === 'radiationStorm' && stormBanner('hud.storm.incoming')),
      bus.on('incident:started', (i) => i.definitionId === 'radiationStorm' && !this.banner.visible && stormBanner('hud.storm.arrived')),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => [offMinigame, offConsole, ...offStorm].forEach((off) => off()));
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
    audio.sfx(this.scene.isActive(key) ? 'back' : key === SceneKeys.MissionControl ? 'commsPanelOpen' : key === SceneKeys.DataPanel ? 'dataScreenOpen' : 'open');
    toggleOverlay(this.scene, key, this.data_);
  }

  /** Placa del tripulante que maneja el jugador: avatar circular con el anillo de sus stats, nombre y dónde está. */
  private createBadge(): void {
    const g = this.add.graphics().setDepth(50);
    // Chapa del nombre detrás del avatar, que sale hacia la derecha.
    const plate = { x: AVATAR.cx + 20, y: AVATAR.cy - 24, w: BADGE.x + BADGE.width - AVATAR.cx - 20, h: 48 };
    drawBox(g, plate.x, plate.y, plate.w, plate.h, 'goal');
    // Disco del avatar: contorno oscuro, fondo del anillo y el círculo azul de la cara.
    g.fillStyle(0x05070d).fillCircle(AVATAR.cx, AVATAR.cy, AVATAR.outer + 3);
    g.fillStyle(0x1a1d2b).fillCircle(AVATAR.cx, AVATAR.cy, AVATAR.outer);
    g.fillStyle(0x05070d).fillCircle(AVATAR.cx, AVATAR.cy, AVATAR.face + 3);
    g.fillStyle(0x5a6fd6).fillCircle(AVATAR.cx, AVATAR.cy, AVATAR.face);
    const ring = this.add.graphics().setDepth(51);
    const face = this.add.image(AVATAR.cx, AVATAR.cy, '__WHITE').setDepth(52).setVisible(false);
    const textX = AVATAR.cx + AVATAR.outer + 10;
    const name = this.add.text(textX, plate.y + 8, '', { fontFamily: 'monospace', fontSize: '15px', color: '#fbd38d' }).setDepth(51);
    const place = this.add.text(textX, plate.y + 27, '', { fontFamily: 'monospace', fontSize: '11px', color: SOFT }).setDepth(51);
    const icons = (Object.keys(STAT_RING) as (keyof typeof STAT_RING)[]).map((id) => {
      const mid = STAT_RING[id].start + Math.PI / 4;
      const r = AVATAR.outer - AVATAR.ring / 2;
      return (this.textures.exists(HUD_ICONS) ? this.add.image(0, 0, HUD_ICONS) : this.add.image(0, 0, '__WHITE'))
        .setPosition(Math.round(AVATAR.cx + Math.cos(mid) * r), Math.round(AVATAR.cy + Math.sin(mid) * r))
        .setScale(0.72)
        .setDepth(53)
        .setData('stat', id);
    });
    const presenceText = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '10px', color: '#a0aec0' }).setDepth(53).setScrollFactor(0);
    this.badge = { face, ring, name, place, icons, presenceText, signature: '' };
    this.onMap.push(g, ring, name, place, presenceText, ...icons);
  }

  /** Cara del tripulante recortada en círculo (una textura por tripulante, hecha una vez). */
  private faceTexture(id: CrewId): string | null {
    const key = `badge-face-${id}`;
    if (this.textures.exists(key)) return key;
    const sheet = crewTextureKey(id);
    if (!this.textures.exists(sheet)) return null;
    const frame = this.textures.getFrame(sheet, 0);
    const size = AVATAR.face * 2;
    const canvas = this.textures.createCanvas(key, size, size);
    if (!canvas) return null;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX + FACE.x, frame.cutY + FACE.y, FACE.w, FACE.h, 0, 0, size, size);
    canvas.refresh();
    return key;
  }

  /** Botones de las pantallas, arriba a la derecha del mapa: ícono y la tecla que hace lo mismo. */
  private createButtons(mars: boolean): void {
    const buttons: Button[] = [
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
    const tips: Record<string, string> = { C: 'missionControl', G: 'charts', I: 'status', V: 'crater' };
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
    if ((this.crater?.visible || this.status.visible || this.console_.visible) && OVERLAYS.some((key) => this.scene.isActive(key))) {
      this.crater?.setVisible(false);
      this.status.hide();
      this.console_.hide();
      if (!this.scene.isActive(SceneKeys.DataPanel)) this.data_.sim.emit('sim:pause', { paused: false });
    }
    this.console_.update(s);
    this.banner.update(time);
    // Dormir de verdad: pantalla a oscuras con la hora que avanza. Si lo despierta un aviso, fundido rápido.
    const alarm = s.level !== 'calm' || s.decisions.length > 0 || s.emergencies.length > 0;
    if (this.wasAsleep && !s.asleep && !alarm) audio.sfx('habitatMorning', 1, 0.6);
    this.wasAsleep = s.asleep;
    this.sleep.update(s.asleep, this.sleepClock(s), alarm, time);
    const [color, alpha] = LEVEL_TINT[s.level];
    this.tint.setFillStyle(color, alpha);
    this.renderPanel(s);
    this.cover(!!this.crater?.visible || this.status.visible || this.console_.visible || this.minigame.visible || OVERLAYS.some((key) => this.scene.isActive(key)));
    this.toasts.update(time, this.covered || this.banner.visible);
    // La ayuda de E va fija abajo; con una decisión en pantalla, ese lugar es de su tarjeta.
    const hint = this.covered || s.asleep || s.decisions.length > 0 ? '' : ((this.registry.get(MAP_HINT) as string | undefined) ?? '');
    if (hint !== this.hint.text) this.hint.setText(hint);
    this.hint.setVisible(hint !== '');
    if (!this.covered) {
      this.renderStrip(s);
      this.renderBadge(s);
      this.renderCard(s);
      this.renderControls(s.decisions.length > 0);
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
    if (!covered) this.badge.signature = '';
    if (!covered) return;
    for (const part of [this.strip, this.card]) {
      part.column.render([]);
      part.box.clear();
      part.signature = '';
    }
    this.stormCard.root.removeAll(true);
    this.stormCard.signature = '';
  }

  /** Lo que falta para que llegue la tormenta, para el cartel grande. */
  private stormCountdown(): string {
    const s = this.snapshot;
    const storm = s?.storm;
    if (!s || !storm) return '';
    const hours = Math.ceil((Date.parse(storm.impactAt) - Date.parse(s.simDate)) / HOUR_MS);
    return storm.active || hours <= 0 ? t('hud.storm.now') : t('hud.storm.countdown', { hours });
  }

  /** Fecha y hora simuladas mientras se duerme. */
  private sleepClock(s: SimSnapshot): string {
    const date = new Date(s.simDate);
    return `${formatDate(s.simDate)} · ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }

  /** Barra de controles abajo a la derecha: teclas de pixel art con su acción, sin tapar el centro del mapa. */
  private renderControls(hasDecision: boolean): void {
    const signature = `${getLocale()}|${this.muted ? 1 : 0}|${hasDecision ? 1 : 0}`;
    if (signature === this.controlsBar.signature) return;
    this.controlsBar.signature = signature;
    const { root } = this.controlsBar;
    root.removeAll(true);
    const items: { cap: string; label: string; dim?: boolean }[] = [
      { cap: 'WASD', label: t('hud.info.key.move') },
      { cap: 'E', label: t('hud.info.key.use') },
      { cap: 'Tab', label: t('hud.info.key.switch') },
      ...(hasDecision ? [{ cap: '1-3', label: t('hud.info.key.decide') }] : []),
      { cap: 'M', label: t('hud.info.key.sound'), dim: this.muted },
    ];
    const g = this.add.graphics();
    root.add(g);
    const top = CONTROLS.bottom - CONTROLS.height;
    const cy = top + CONTROLS.height / 2;
    const parts: { capText: Phaser.GameObjects.Text; labelText: Phaser.GameObjects.Text; capW: number; totalW: number; dim?: boolean }[] = items.map((item) => {
      const capText = this.add
        .text(0, 0, item.cap, { fontFamily: 'monospace', fontSize: '10px', color: item.dim ? DIM : '#fbd38d' })
        .setOrigin(0.5, 0.5);
      const labelText = this.add
        .text(0, 0, item.label, { fontFamily: 'monospace', fontSize: '11px', color: item.dim ? DIM : '#cbd5e0' })
        .setOrigin(0, 0.5);
      const capW = Math.max(18, Math.ceil(capText.width) + 10);
      root.add([capText, labelText]);
      return { capText, labelText, capW, totalW: capW + 5 + Math.ceil(labelText.width), dim: item.dim };
    });
    const gap = 11;
    const padX = 10;
    const contentW = parts.reduce((sum, p) => sum + p.totalW, 0) + gap * (parts.length - 1);
    const barW = contentW + padX * 2;
    const barX = CONTROLS.right - barW;
    // Caja biselada con esquinas cortadas, un poco translúcida para que se perciba liviana sobre el mapa.
    const octagon = (inset: number, cut: number, color: number, alpha = 1) => {
      const [ix, iy, iw, ih] = [barX + inset, top + inset, barW - 2 * inset, CONTROLS.height - 2 * inset];
      g.fillStyle(color, alpha).fillRect(ix + cut, iy, iw - 2 * cut, ih).fillRect(ix, iy + cut, iw, ih - 2 * cut);
    };
    octagon(0, 6, 0x05070d, 0.94);
    octagon(2, 4, 0x4a4266, 0.94);
    g.fillStyle(0x7c6fa8, 0.94).fillRect(barX + 6, top + 2, barW - 12, 2);
    octagon(4, 2, 0x101626, 0.92);
    let x = barX + padX;
    for (const part of parts) {
      const kh = 18;
      const ky = Math.round(cy - kh / 2);
      g.fillStyle(0x05070d).fillRect(x, ky, part.capW, kh);
      g.fillStyle(part.dim ? 0x1a202c : 0x2a2440).fillRect(x + 1, ky + 1, part.capW - 2, kh - 3);
      g.fillStyle(part.dim ? 0x2d3748 : 0x6b5f94).fillRect(x + 1, ky + 1, part.capW - 2, 1);
      g.fillStyle(0x141225).fillRect(x + 1, ky + kh - 2, part.capW - 2, 1);
      part.capText.setPosition(Math.round(x + part.capW / 2), ky + Math.round((kh - 1) / 2));
      part.labelText.setPosition(x + part.capW + 5, Math.round(cy));
      x += part.totalW + gap;
    }
  }

  /** Cartel de la misión, anclado abajo a la izquierda: fase con la fecha y el día, avance y semáforo con su motivo. */
  private renderStrip(s: SimSnapshot): void {
    const { column, box } = this.strip;
    const rows = this.missionRows(s);
    column.render(rows);
    const height = column.height + 18;
    const top = STRIP.bottom - height;
    column.moveTo(top + 9);
    column.render(rows);
    const style = LEVEL_BOX[s.level];
    const signature = `${top}|${height}|${style}`;
    if (signature === this.strip.signature) return;
    this.strip.signature = signature;
    box.clear();
    drawBox(box, STRIP.x, top, STRIP.width, height, style);
  }

  private missionRows(s: SimSnapshot): PanelRow[] {
    const start = Date.parse(s.window.start);
    const total = Math.round((Date.parse(s.window.end) - start) / DAY_MS);
    const day = Math.min(total, Math.floor((Date.parse(s.simDate) - start) / DAY_MS) + 1);
    const mars = s.place === 'mars';
    const rows: PanelRow[] = [
      {
        text: tr(`common.phase.${s.phase}`),
        size: 14,
        color: mars ? '#fbd38d' : HEAD,
        value: { text: `${formatDate(s.simDate)} · ${t(mars ? 'hud.panel.sol' : 'hud.panel.day', { day, total })}`, color: SOFT, size: 11 },
      },
      { text: '', bar: { fraction: s.progress, color: mars ? '#f6ad55' : '#63b3ed', from: 0, segments: 31 }, size: 4 },
      { gap: 2, text: `● ${tr(s.reasonKey)}`, color: LEVEL_COLOR[s.level], size: 12 },
    ];
    // El ritmo sólo aparece cuando no es el de siempre. El avance rápido tiene su indicador propio (flechas que
    // corren): no es dormir, el jugador sigue manejando a su tripulante.
    const fast = FAST_FRAMES[Math.floor(this.time.now / 140) % FAST_FRAMES.length]!;
    if (s.paused) rows.push({ text: t('hud.panel.paused'), color: SOFT, size: 11 });
    else if (s.asleep) rows.push({ text: t('hud.sleep.sleeping'), color: '#90cdf4', size: 11 });
    else if (!s.manual) rows.push({ text: `${fast} ${t('hud.panel.paceFast')}`, color: '#63b3ed', size: 12 });
    else if (s.idle) rows.push({ text: `${fast} ${t('hud.panel.paceIdle')}`, color: '#63b3ed', size: 12 });
    // Qué falta hacer para que la jornada avance rápido (así nadie se pierde buscando qué rehacer).
    if (s.mars?.canLeave) rows.push({ gap: 2, text: t('mars.leave.prompt'), color: '#68d391', size: 11 });
    if (s.mars?.plants) rows.push({ text: t('mars.panel.plants', { count: s.mars.plants }), color: SOFT, size: 11 });
    if (!s.paused && s.manual && s.todo.length) {
      rows.push({ gap: 2, text: t('hud.todo.title'), color: '#fbd38d', size: 11 });
      for (const item of s.todo.slice(0, 4)) {
        const text =
          item.kind === 'task'
            ? this.taskReason(item)
            : item.kind === 'repair'
              ? item.helper
                ? t('hud.todo.repairHelper', { title: tr(`${item.textKey}.title`), name: NAMES[item.helper] })
                : t('hud.todo.repair', { title: tr(`${item.textKey}.title`) })
              : t(`hud.todo.${item.kind}`);
        rows.push({ text: `· ${text}`, color: SOFT, size: 11 });
      }
      if (s.todo.length > 4) rows.push({ text: t('hud.todo.more', { n: s.todo.length - 4 }), color: SOFT, size: 10 });
    }
    // Tareas optativas de Marte: qué se gana (▲) y qué se arriesga (▼), antes de decidir.
    if (s.mars && !s.departure && !s.paused && s.manual) {
      if (s.mars.panels.canClean) rows.push({ gap: 2, icon: this.icon('energy'), text: t('mars.tradeoff.cleanPanels', { loss: Math.round(s.mars.panels.loss * 100) }), color: '#f6e05e', size: 11 });
      if (s.mars.nightPrepOpen) rows.push({ gap: 2, icon: this.icon('energy'), text: t('mars.tradeoff.nightPrep'), color: '#f6e05e', size: 11 });
      else if (s.mars.nightReady) rows.push({ icon: this.icon('check'), text: t('mars.tradeoff.nightReady'), color: LIGHT.green, size: 11 });
    }
    if (s.mars) {
      const { daylight, evaOpen } = s.mars;
      rows.push({
        icon: this.icon('airlock'),
        text: `${t(daylight ? 'mars.panel.day' : 'mars.panel.night')} · ${t(evaOpen ? 'mars.panel.evaOpen' : daylight ? 'mars.panel.evaBlocked' : 'mars.panel.evaNight')}`,
        color: evaOpen ? LIGHT.green : LIGHT.yellow,
        size: 11,
      });
      // La red eléctrica y los tubos: sólo si algo anda mal.
      const grid = gridWarningKey(s);
      if (grid) rows.push({ icon: this.icon('energy'), text: tr(grid), color: s.power.blackout || s.mars.grid.fuseBlown ? LIGHT.red : LIGHT.yellow, size: 11 });
      if (s.mars.grid.brokenTubes.length) rows.push({ icon: this.icon('warning'), text: t('mars.panel.tubes', { count: s.mars.grid.brokenTubes.length }), color: LIGHT.yellow, size: 11 });
      if (s.departure) {
        const d = s.departure;
        const key = d.cargo === 'stored' ? 'mars.task.goStorage' : d.cargo === 'carried' ? 'mars.task.goShip' : 'mars.task.boardWait';
        rows.push({ icon: this.icon('target'), text: t(key as 'mars.task.boardWait', { aboard: d.aboard, total: d.total }), color: '#fbd38d', size: 11 });
      }
    }
    return rows;
  }

  /**
   * Una tarea pendiente con su motivo ("el filtro de CO₂ se está saturando", "Brote se siente solo: llamá a casa") y,
   * si apareció al azar, cuánto falta para que la tome un automático.
   */
  private taskReason(item: Extract<SimSnapshot['todo'][number], { kind: 'task' }>): string {
    const reason = taskReason(this.data_.namespace, item, NAMES);
    if (!item.chore) return reason;
    if (item.chore.helper) return `${reason} ${t('hud.todo.choreHelper', { name: NAMES[item.chore.helper] })}`;
    return `${reason} ${t('hud.todo.choreSoon', { hours: Math.max(1, Math.ceil(item.chore.hoursLeft)) })}`;
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
        presence: s.presence[m.id],
        half: true,
        text: NAMES[m.id],
        inverse: m.id === st.activeCrewId,
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
      { icon: this.icon('radiation'), text: t('hud.panel.doseShort', { value: Math.round(s.dose.uGyH) }), color: s.storm?.exposed.length ? LIGHT.red : '#e2e8f0', size: 11 },
      // Con la tormenta encima: quiénes están fuera del refugio y cuánta dosis de más llevan.
      ...(s.storm?.active
        ? [
            s.storm.exposed.length
              ? { icon: this.icon('warning'), text: t('hud.panel.exposed', { count: s.storm.exposed.length, factor: decimal(s.storm.doseFactor, s.storm.doseFactor % 1 ? 1 : 0) }), color: LIGHT.red, size: 11 }
              : { icon: this.icon('shelter'), text: t('hud.panel.sheltered'), color: LIGHT.green, size: 11 },
          ]
        : []),
      ...(s.storm && s.storm.extraXrays >= 1 ? [{ icon: this.icon('radiation'), text: t('hud.panel.extraXrays', { count: Math.floor(s.storm.extraXrays) }), color: LIGHT.red, size: 11 }] : []),
      {
        icon: this.icon('earthSignal'),
        text: mc.offline ? t('hud.panel.signalOff') : minutes >= 1 ? t('hud.panel.signal', { minutes: Math.round(minutes) }) : t('hud.panel.signalSeconds', { seconds: Math.max(1, Math.round(mc.delaySeconds)) }),
        color: mc.offline ? LIGHT.yellow : '#e2e8f0',
        size: 11,
      },
    ];
    if (s.mars) {
      const w = s.mars.weather;
      // En dos filas cortas: entra completo en los dos idiomas y con temperaturas de tres cifras (−100 °C).
      rows.push({ icon: this.icon('dustStorm'), text: t('hud.panel.curiositySol', { sol: w.sol }), color: '#fbd38d', size: 11 });
      rows.push({ text: t('hud.panel.curiosityTemp', { min: Math.round(w.minTempC), max: w.maxTempC === null ? '?' : Math.round(w.maxTempC) }), color: '#fbd38d', size: 11 });
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
    const b = this.badge;
    const faceKey = this.faceTexture(m.id);
    if (faceKey && b.face.texture.key !== faceKey) b.face.setTexture(faceKey).setVisible(true);
    b.name.setText(NAMES[m.id]);
    const where = locationKey(this.data_.namespace, m.location);
    b.place.setText(m.resting ? t('hud.panel.resting') : tr(where));
    const presence = s.presence[m.id];
    b.presenceText.setText(`● ${t(`hud.presence.${presence}`)}`).setColor(`#${PRESENCE_COLOR[presence].toString(16).padStart(6, '0')}`).setPosition(b.name.x + b.name.width + 8, b.name.y + 4);
    const lights = healthLights(m);
    // Lo que está en rojo titila (se redibuja a medio segundo).
    const blink = Math.floor(this.time.now / 450) % 2 === 0;
    const signature = `${lights.map((l) => `${Math.round(l.fraction * 40)}${l.color}`).join('|')}|${blink}`;
    for (const icon of b.icons) {
      const id = icon.getData('stat') as string;
      if (this.hasIcon(id)) icon.setFrame(id);
    }
    if (signature === b.signature) return;
    b.signature = signature;
    const g = b.ring.clear();
    const r = AVATAR.outer - AVATAR.ring / 2;
    for (const light of lights) {
      const spec = STAT_RING[light.id];
      const from = spec.start + AVATAR.gap / 2;
      const span = Math.PI / 2 - AVATAR.gap;
      const fill = Phaser.Math.Clamp(light.fraction, 0, 1);
      g.lineStyle(AVATAR.ring, spec.dark).beginPath().arc(AVATAR.cx, AVATAR.cy, r, from, from + span, false).strokePath();
      if (fill <= 0) continue;
      const alarm = light.color === LIGHT.red && !blink;
      g.lineStyle(AVATAR.ring, spec.color, alarm ? 0.45 : 1).beginPath().arc(AVATAR.cx, AVATAR.cy, r, from, from + span * fill, false).strokePath();
      // Brillo en el borde de afuera, como en el pixel art de los botones.
      g.lineStyle(2, 0xffffff, alarm ? 0.15 : 0.35).beginPath().arc(AVATAR.cx, AVATAR.cy, AVATAR.outer - 2, from, from + span * fill, false).strokePath();
    }
  }

  /** Tarjeta de la primera decisión pendiente, sobre el mapa: cada opción con su color de riesgo, su tecla y su coste. */
  private renderCard(s: SimSnapshot): void {
    const d = s.decisions[0];
    const { column, box } = this.card;
    const storm = d && s.storm && d.incident.id === s.storm.incidentId ? s.storm : null;
    if (!storm && this.stormCard.signature) {
      this.stormCard.root.removeAll(true);
      this.stormCard.signature = '';
    }
    if (d && storm) {
      column.render([]);
      this.renderStormCard(s, d, storm);
      return;
    }
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
      { icon: this.icon('warning'), text: tr(`${d.textKey}.title`), color: d.incident.status === 'active' ? LIGHT.red : LIGHT.yellow, size: 19 },
      { gap: 2, text: t('hud.panel.choose'), color: SOFT, size: 13 },
    ];
    d.options.forEach(({ response, available }, i) => {
      rows.push({
        gap: 8,
        text: `[${i + 1}] ● ${tr(`${d.textKey}.response.${response.id}.title`)}${hint === response.id ? ` ${t('hud.panel.hint')}` : ''}`,
        color: available ? LIGHT[response.risk] : '#4a5568',
        size: 16,
        onClick: available ? () => sim.emit('sim:respond', { incidentId: d.incident.id, responseId: response.id }) : undefined,
      });
      rows.push({ text: `     ${tr(`${d.textKey}.response.${response.id}.cost`)}`, color: SOFT, size: 12 });
    });
    column.render(rows);
    const height = column.height + 22;
    const top = CARD.bottom - height;
    column.moveTo(top + 11);
    column.render(rows);
    const signature = `${top}|${height}`;
    if (signature === this.card.signature) return;
    this.card.signature = signature;
    box.clear();
    drawBox(box, CARD.x, top, CARD.width, height, 'alert');
  }

  /**
   * Decisión de la tormenta de radiación: las dos opciones lado a lado, cada una con lo que se gana (▲ verde) y lo que
   * se arriesga (▼ rojo), con íconos y números simples. Tecla 1 o 2, o clic en la tarjeta.
   */
  private renderStormCard(s: SimSnapshot, d: SimSnapshot['decisions'][number], storm: NonNullable<SimSnapshot['storm']>): void {
    const { sim } = this.data_;
    const hint = s.hints.find((h) => h.incidentId === d.incident.id)?.responseId;
    const hours = Math.max(0, Math.ceil((Date.parse(storm.impactAt) - Date.parse(s.simDate)) / HOUR_MS));
    const factor = decimal(storm.doseFactor, storm.doseFactor % 1 ? 1 : 0);
    const signature = `${d.incident.id}|${storm.active ? 'now' : hours}|${factor}|${hint}|${getLocale()}|${d.options.map((o) => o.available).join()}`;
    if (signature === this.stormCard.signature) return;
    this.stormCard.signature = signature;
    const { root } = this.stormCard;
    root.removeAll(true);
    const height = 204;
    const top = CARD.bottom - height;
    this.card.signature = `storm|${top}`;
    this.card.box.clear();
    drawBox(this.card.box, CARD.x, top, CARD.width, height, 'alert');
    const text = (x: number, y: number, value: string, size: number, color: string, width = 0) => {
      const o = this.add.text(x, y, value, { fontFamily: 'monospace', fontSize: `${size}px`, color, ...(width ? { wordWrap: { width } } : {}) });
      root.add(o);
      return o;
    };
    text(CARD.x + 16, top + 12, `⚠ ${tr(`${d.textKey}.title`)}`, 18, LIGHT.red);
    text(CARD.x + CARD.width - 16, top + 16, storm.active ? t('hud.storm.now') : t('hud.storm.countdown', { hours }), 12, '#fbd38d').setOrigin(1, 0);
    text(CARD.x + 16, top + 38, t('hud.storm.choose'), 12, SOFT);
    const gap = 10;
    const width = (CARD.width - 32 - gap) / 2;
    const g = this.add.graphics();
    root.add(g);
    const lines: Record<string, { icon: string; lines: { up: boolean; good: boolean; text: string }[] }> = {
      goToShelter: {
        icon: 'shelter',
        lines: [
          { up: false, good: true, text: t('hud.storm.shelter.dose') },
          { up: false, good: false, text: t('hud.storm.shelter.tasks') },
          { up: false, good: false, text: t('hud.storm.shelter.outside') },
        ],
      },
      keepWorking: {
        icon: 'spares',
        lines: [
          { up: true, good: true, text: t('hud.storm.work.tasks') },
          { up: true, good: false, text: t('hud.storm.work.dose', { factor }) },
          { up: false, good: false, text: t('hud.storm.work.star') },
        ],
      },
    };
    d.options.forEach(({ response, available }, i) => {
      const x = CARD.x + 16 + i * (width + gap);
      const y = top + 60;
      const h = height - 72;
      const safe = response.risk === 'green';
      g.fillStyle(0x05070d).fillRect(x - 2, y - 2, width + 4, h + 4);
      g.fillStyle(!available ? 0x2d3748 : safe ? 0x2f855a : 0xc53030).fillRect(x, y, width, h);
      g.fillStyle(safe ? 0x10241a : 0x2a1015).fillRect(x + 3, y + 3, width - 6, h - 6);
      const spec = lines[response.id];
      if (spec && this.hasIcon(spec.icon)) root.add(this.add.image(x + 20, y + 22, HUD_ICONS, spec.icon));
      text(x + 38, y + 8, `[${i + 1}] ${tr(`${d.textKey}.response.${response.id}.short`)}`, 14, available ? LIGHT[response.risk] : '#4a5568', width - 46);
      let ly = y + 46;
      for (const line of spec?.lines ?? []) {
        const color = line.good ? LIGHT.green : LIGHT.red;
        text(x + 10, ly, line.up ? '▲' : '▼', 12, color);
        ly += text(x + 28, ly, line.text, 12, color, width - 38).height + 4;
      }
      if (hint === response.id) text(x + 10, y + h - 20, t('hud.panel.hint'), 10, '#fbd38d', width - 20);
      if (!available) return;
      const hit = this.add.zone(x, y, width, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => sim.emit('sim:respond', { incidentId: d.incident.id, responseId: response.id }));
      root.add(hit);
    });
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
    // Un poco de variación de tono para que la ráfaga no suene a metrónomo.
    audio.sfx('particleClick', 0.9 + this.rng.next() * 0.2, 0.5);
  }
}

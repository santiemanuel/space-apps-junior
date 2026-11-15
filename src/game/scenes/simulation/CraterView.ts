import Phaser from 'phaser';
import { GALE_LANDMARKS, GALE_TERRAIN } from '../../../content/gale';
import { craterKm, craterPoint, GALE_CRATER_VIEW, GALE_FACTS, GALE_PLACES } from '../../../content/galeTerrain';
import { exteriorDoorPoint, type Point, type ShipLayout } from '../../../core/habitat/layout';
import { t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { formatDate, formatNumber } from '../../../i18n/format';
import { GAME_HEIGHT } from '../../display';
import { VIEW_WIDTH } from './HudScene';
import { addKeyButton, KEY_BUTTON, panelIn } from '../../ui/ui';

export const CRATER_TEXTURE = 'gale-crater';

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
/** Mapa grande: cada píxel de arte mide 3 px (como en el mapa del juego). */
const MAP = { x: 16, y: 72 } as const;
const SCALE = GALE_CRATER_VIEW.scale;
/** Lupa sobre el camino de Curiosity: INSET_ART píxeles de arte a 6 px cada uno. */
const INSET = { x: 636, y: 72, art: 40, zoom: 6 } as const;
/** Color de cada franja del exterior en la lupa (los del suelo de cada una). */
const STRIP_COLOR: Record<string, number> = { plain: 0xd27a3c, lakebed: 0xe8cfa8, dunes: 0x6a585c, buttes: 0xc48a5c, gediz: 0xf2d34a };
const TEXT = { fontFamily: 'monospace', color: '#e2e8f0' } as const;

/**
 * Mapa del cráter Gale (docs/plan-visual.md, Fase 4): la foto real pixelada, el borde de 154 km, el monte Sharp, el
 * aterrizaje de Curiosity y su lugar de hoy en Gediz Vallis, con una lupa sobre el camino que muestra las franjas del
 * mapa del juego y un "estás acá" que sigue al jugador. Aclara que el mapa jugable está comprimido.
 */
export class CraterView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly here: Phaser.GameObjects.Graphics;
  private readonly route: { from: Point; to: Point; door: number; end: number };

  constructor(
    private readonly scene: Phaser.Scene,
    layout: ShipLayout,
    private readonly close: () => void,
  ) {
    scene.textures.get(CRATER_TEXTURE).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const from = craterPoint(GALE_PLACES.bradbury.lat, GALE_PLACES.bradbury.lon);
    const to = craterPoint(GALE_PLACES.gediz.lat, GALE_PLACES.gediz.lon);
    // El camino del juego va de la puerta de la esclusa (la base, en la llanura) hasta Curiosity (en Gediz Vallis).
    this.route = { from, to, door: exteriorDoorPoint(layout.exterior!).y, end: GALE_LANDMARKS.curiosity!.y };
    this.root = scene.add.container(0, 0).setDepth(100).setVisible(false);
    this.here = scene.add.graphics();
    this.draw();
  }

  get visible(): boolean {
    return this.root.visible;
  }

  setVisible(visible: boolean): void {
    if (visible && !this.root.visible) panelIn(this.root);
    this.root.setVisible(visible);
  }

  /** "Estás acá": late en la lupa y en el mapa grande, en el punto del camino que corresponde a la fila del jugador. */
  update(position: Point, time: number): void {
    if (!this.root.visible) return;
    const p = this.along(position.y);
    const pulse = Math.floor(time / 250) % 2;
    const g = this.here.clear();
    const big = this.onMap(p);
    const small = this.onInset(p);
    for (const [x, y, r] of [[big.x, big.y, 6], [small.x, small.y, 9]] as const) {
      g.fillStyle(0x1a202c).fillRect(x - r - 3, y - 3, 2 * r + 6, 6).fillRect(x - 3, y - r - 3, 6, 2 * r + 6);
      g.fillStyle(pulse ? 0x63f3ff : 0xffffff).fillRect(x - r, y - 1.5, 2 * r, 3).fillRect(x - 1.5, y - r, 3, 2 * r);
    }
  }

  /** Punto del camino real (píxel de arte) para una fila del mapa del juego. */
  private along(row: number): Point {
    const { from, to, door, end } = this.route;
    const k = Phaser.Math.Clamp((row - door) / (end - door), 0, 1);
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  }

  private onMap(p: Point): Point {
    return { x: MAP.x + p.x * SCALE, y: MAP.y + p.y * SCALE };
  }

  private insetOrigin(): Point {
    const { from, to } = this.route;
    return { x: Math.round((from.x + to.x) / 2 - INSET.art / 2), y: Math.round((from.y + to.y) / 2 - INSET.art / 2) };
  }

  private onInset(p: Point): Point {
    const o = this.insetOrigin();
    return { x: INSET.x + (p.x - o.x) * INSET.zoom, y: INSET.y + (p.y - o.y) * INSET.zoom };
  }

  private draw(): void {
    const s = this.scene;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.root.add(o);
      return o;
    };
    const text = (x: number, y: number, value: string, size = 12, color: string = TEXT.color, width = 0) =>
      add(s.add.text(x, y, value, { ...TEXT, fontSize: `${size}px`, color, ...(width ? { wordWrap: { width } } : {}) }).setResolution(2));
    const label = (x: number, y: number, value: string, color = '#fefcbf') =>
      add(s.add.text(x, y, value, { ...TEXT, fontSize: '11px', color, backgroundColor: '#1a202ccc', padding: { x: 3, y: 1 } }).setResolution(2));

    add(s.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0x05070d, 0.96).setOrigin(0, 0).setInteractive());
    text(MAP.x, 14, tr('mars.crater.title'), 22, '#fbd38d');
    text(MAP.x, 44, tr('mars.crater.subtitle'), 12, '#a0aec0');

    // Mapa grande: la foto, el borde de 154 km, el monte Sharp, el aterrizaje y Curiosity hoy.
    const size = GALE_CRATER_VIEW.artSize * SCALE;
    add(s.add.image(MAP.x, MAP.y, CRATER_TEXTURE).setOrigin(0, 0));
    const g = add(s.add.graphics());
    g.lineStyle(3, 0x2d3748).strokeRect(MAP.x - 2, MAP.y - 2, size + 4, size + 4);
    const center = this.onMap(craterPoint(GALE_PLACES.craterCenter.lat, GALE_PLACES.craterCenter.lon));
    const rim = (GALE_FACTS.craterDiameterKm.value / 2) * GALE_CRATER_VIEW.pxPerKm * SCALE;
    // Borde punteado en pasos de un píxel de arte.
    const dots = Math.round((2 * Math.PI * rim) / 15);
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2;
      const x = Math.round((center.x + Math.cos(a) * rim) / 3) * 3;
      const y = Math.round((center.y + Math.sin(a) * rim) / 3) * 3;
      g.fillStyle(0x1a202c).fillRect(x - 3, y - 3, 9, 9);
      g.fillStyle(0xfefcbf).fillRect(x, y, 3, 3);
    }
    label(center.x + 40, center.y + rim + 5, tr('mars.crater.rim', { km: GALE_FACTS.craterDiameterKm.value })).setOrigin(0.5, 0);
    const sharp = this.onMap(craterPoint(GALE_PLACES.mountSharp.lat, GALE_PLACES.mountSharp.lon));
    g.fillStyle(0x1a202c).fillTriangle(sharp.x, sharp.y - 12, sharp.x - 11, sharp.y + 7, sharp.x + 11, sharp.y + 7);
    g.fillStyle(0xfefcbf).fillTriangle(sharp.x, sharp.y - 7, sharp.x - 6, sharp.y + 4, sharp.x + 6, sharp.y + 4);
    label(sharp.x + 14, sharp.y - 8, tr('mars.crater.sharp', { km: formatNumber(GALE_FACTS.mountSharpHeightKm.value) }));
    const { from, to } = this.route;
    const landing = this.onMap(from);
    const today = this.onMap(to);
    for (const [p, color] of [[landing, 0xfbd38d], [today, 0xf2d34a]] as const) {
      g.fillStyle(0x1a202c).fillRect(p.x - 5, p.y - 5, 10, 10);
      g.fillStyle(color).fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    label(landing.x - 10, landing.y - 30, tr('mars.crater.landing', { date: formatDate(`${GALE_FACTS.landing.value}T00:00:00Z`) })).setOrigin(1, 0);
    label(today.x - 10, today.y + 10, tr('mars.crater.curiosity')).setOrigin(1, 0);
    // Recuadro de la lupa, unido al panel de la derecha.
    const o = this.insetOrigin();
    const box = { x: MAP.x + o.x * SCALE, y: MAP.y + o.y * SCALE, w: INSET.art * SCALE };
    g.lineStyle(3, 0x63f3ff).strokeRect(box.x, box.y, box.w, box.w);
    g.lineStyle(2, 0x63f3ff, 0.5).lineBetween(box.x + box.w, box.y, INSET.x, INSET.y).lineBetween(box.x + box.w, box.y + box.w, INSET.x, INSET.y + INSET.art * INSET.zoom);
    // Escala y norte.
    const km = 20;
    const barW = km * GALE_CRATER_VIEW.pxPerKm * SCALE;
    const barY = MAP.y + size - 24;
    g.fillStyle(0x1a202c).fillRect(MAP.x + 12, barY - 3, barW + 6, 12);
    g.fillStyle(0xfefcbf).fillRect(MAP.x + 15, barY, barW / 2, 6).fillStyle(0x718096).fillRect(MAP.x + 15 + barW / 2, barY, barW / 2, 6);
    label(MAP.x + 22 + barW, barY - 5, tr('mars.crater.scale', { km }));
    g.fillStyle(0x1a202c).fillTriangle(MAP.x + size - 26, MAP.y + 12, MAP.x + size - 36, MAP.y + 36, MAP.x + size - 16, MAP.y + 36);
    g.fillStyle(0xfefcbf).fillTriangle(MAP.x + size - 26, MAP.y + 17, MAP.x + size - 32, MAP.y + 32, MAP.x + size - 20, MAP.y + 32);
    text(MAP.x + size - 30, MAP.y + 38, 'N', 12, '#fefcbf');
    text(MAP.x, MAP.y + size + 8, tr('mars.crater.credit', { credit: GALE_CRATER_VIEW.credit }), 10, '#718096', size);

    // Lupa: el mismo recorte ×6, con el camino, las franjas del juego en orden y los dos extremos reales.
    const insetSize = INSET.art * INSET.zoom;
    add(s.add.image(INSET.x, INSET.y, CRATER_TEXTURE).setOrigin(0, 0).setCrop(o.x * SCALE, o.y * SCALE, INSET.art * SCALE, INSET.art * SCALE).setScale(INSET.zoom / SCALE).setPosition(INSET.x - o.x * INSET.zoom, INSET.y - o.y * INSET.zoom));
    const ig = add(s.add.graphics());
    ig.lineStyle(3, 0x63f3ff).strokeRect(INSET.x - 2, INSET.y - 2, insetSize + 4, insetSize + 4);
    const a = this.onInset(from);
    const b = this.onInset(to);
    const strips = GALE_TERRAIN;
    const door = this.route.door;
    const end = this.route.end;
    for (const strip of strips) {
      const k0 = Phaser.Math.Clamp((Math.max(strip.rect.row, door) - door) / (end - door), 0, 1);
      const k1 = Phaser.Math.Clamp((strip.rect.row + strip.rect.rows - door) / (end - door), 0, 1);
      const steps = Math.max(1, Math.round((k1 - k0) * 24));
      for (let i = 0; i <= steps; i++) {
        const k = k0 + ((k1 - k0) * i) / steps;
        const x = Math.round((a.x + (b.x - a.x) * k) / 3) * 3;
        const y = Math.round((a.y + (b.y - a.y) * k) / 3) * 3;
        ig.fillStyle(0x1a202c).fillRect(x - 5, y - 5, 10, 10);
        ig.fillStyle(STRIP_COLOR[strip.id] ?? 0xffffff).fillRect(x - 3, y - 3, 6, 6);
      }
    }
    for (const [p, color] of [[a, 0xfbd38d], [b, 0xf2d34a]] as const) {
      ig.fillStyle(0x1a202c).fillRect(p.x - 8, p.y - 8, 16, 16);
      ig.fillStyle(color).fillRect(p.x - 5, p.y - 5, 10, 10);
    }
    add(this.here);
    text(INSET.x, INSET.y - 22, tr('mars.crater.inset'), 13, '#63f3ff');

    // Leyenda: franjas en el orden en que aparecen, de la base a Curiosity.
    let y = INSET.y + insetSize + 14;
    for (const strip of strips) {
      const lg = add(s.add.graphics());
      lg.fillStyle(0x1a202c).fillRect(INSET.x, y + 1, 12, 12);
      lg.fillStyle(STRIP_COLOR[strip.id] ?? 0xffffff).fillRect(INSET.x + 3, y + 4, 6, 6);
      text(INSET.x + 20, y, tr(`mars.terrain.${strip.id}.name`), 12);
      y += 20;
    }
    const realKm = Math.round(craterKm(GALE_PLACES.bradbury, GALE_PLACES.gediz));
    text(INSET.x, y + 8, tr('mars.crater.compressed', { km: realKm }), 11, '#cbd5e0', VIEW_WIDTH - INSET.x - 14);
    add(addKeyButton(s, VIEW_WIDTH - KEY_BUTTON.margin, GAME_HEIGHT - KEY_BUTTON.margin, 'V', tr('mars.crater.close'), this.close, { sfx: null }));
  }
}

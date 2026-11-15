import Phaser from 'phaser';
import { EXTERIOR, isWalkable, zoneAt, type Point, type ShipLayout } from '../../../core/habitat/layout';

/** Colores del minimapa: piso de la nave o la base, paredes, suelo de afuera y lo que no se pisa afuera. */
const COLOR = { floor: 0x6b6390, corridor: 0x544c78, wall: 0x1e162d, ground: 0xa0603a, rock: 0x4e2c1e } as const;

/** Clave del `registry` de Phaser donde la escena del mapa deja lo que se dibuja en el minimapa en cada cuadro. */
export const MINIMAP_FRAME = 'sim-minimap-frame';

export interface MinimapDot {
  x: number;
  y: number;
  color: number;
  /** El del jugador: titila con un anillo. */
  active?: boolean;
}

/** Lo que cambia en cada cuadro (tiles): tripulación, puntos del lugar, refugio a marcar y lo que se ve. */
export interface MinimapFrame {
  crew: readonly MinimapDot[];
  /** Puntos chicos del lugar (las muestras en Marte), en amarillo. */
  marks: readonly Point[];
  /** Rectángulo del refugio si hay que ir: titila. */
  shelter: { col: number; row: number; cols: number; rows: number } | null;
  /** Lo que muestra la cámara del mapa. */
  view: { x: number; y: number; width: number; height: number };
}

/**
 * Minimapa del lugar, en una caja del tablero: el plano (piso, paredes y terreno de afuera), la tripulación, lo que
 * pida el lugar (las muestras en Marte), el refugio marcado en una tormenta y el rectángulo de lo que se ve. Lo
 * dibuja el tablero (sin zoom); los datos de cada cuadro los deja la escena del mapa en el `registry`.
 */
export class Minimap {
  private readonly dynamic: Phaser.GameObjects.Graphics;
  private readonly scale: number;
  private readonly origin: { x: number; y: number };
  /** Tamaño en pantalla (px). */
  readonly width: number;
  readonly height: number;

  /** @param area dónde puede ir (px de pantalla): se centra adentro con la mayor escala entera que entra. */
  constructor(scene: Phaser.Scene, private readonly layout: ShipLayout, area: { x: number; y: number; width: number; height: number }) {
    this.scale = Math.max(1, Math.min(Math.floor(area.width / layout.cols), Math.floor(area.height / layout.rows)));
    this.width = layout.cols * this.scale;
    this.height = layout.rows * this.scale;
    this.origin = { x: Math.round(area.x + (area.width - this.width) / 2), y: area.y };
    const stat = scene.add.graphics().setDepth(52);
    this.dynamic = scene.add.graphics().setDepth(53);
    const base = this.baseBounds();
    const { x, y } = this.origin;
    for (let row = 0; row < layout.rows; row++)
      for (let col = 0; col < layout.cols; col++) {
        const zone = zoneAt(layout, { x: col + 0.5, y: row + 0.5 });
        const inBase = col >= base.left && col <= base.right && row >= base.top && row <= base.bottom;
        const color = isWalkable(layout, col, row)
          ? zone === EXTERIOR ? COLOR.ground : zone === 'corridor' ? COLOR.corridor : COLOR.floor
          : inBase ? COLOR.wall : COLOR.rock;
        stat.fillStyle(color).fillRect(x + col * this.scale, y + row * this.scale, this.scale, this.scale);
      }
  }

  /** Rectángulo de la base (tiles, con sus paredes): una alrededor de los cuartos y, arriba, el techo y el frente. */
  private baseBounds() {
    const rects = [...this.layout.zones.map((z) => z.rect), this.layout.corridor];
    return {
      left: Math.min(...rects.map((r) => r.col)) - 1,
      right: Math.max(...rects.map((r) => r.col + r.cols)),
      top: Math.min(...rects.map((r) => r.row)) - 2,
      bottom: Math.max(...rects.map((r) => r.row + r.rows)),
    };
  }

  /** Posición en pantalla de un punto del plano (tiles). */
  private at(p: Point) {
    return { x: this.origin.x + p.x * this.scale, y: this.origin.y + p.y * this.scale };
  }

  update(frame: MinimapFrame | undefined, time: number): void {
    const g = this.dynamic.clear();
    if (!frame) return;
    const s = Math.max(3, this.scale);
    const pulse = Math.floor(time / 400) % 2 === 0;
    const { shelter, view } = frame;
    if (shelter && pulse) {
      const p = this.at({ x: shelter.col, y: shelter.row });
      g.lineStyle(2, 0xf6e05e).strokeRect(p.x, p.y, shelter.cols * this.scale, shelter.rows * this.scale);
    }
    for (const m of frame.marks) {
      const p = this.at(m);
      g.fillStyle(0xfefcbf).fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
    // Lo que se ve en la vista, recortado al plano.
    const tl = this.at({ x: Math.max(0, view.x), y: Math.max(0, view.y) });
    const br = this.at({ x: Math.min(this.layout.cols, view.x + view.width), y: Math.min(this.layout.rows, view.y + view.height) });
    g.lineStyle(1, 0xffffff, 0.55).strokeRect(Math.round(tl.x) + 0.5, Math.round(tl.y) + 0.5, Math.round(br.x - tl.x) - 1, Math.round(br.y - tl.y) - 1);
    for (const d of frame.crew) {
      const p = this.at(d);
      const [x, y] = [Math.round(p.x - s / 2), Math.round(p.y - s / 2)];
      g.fillStyle(0x0b1020).fillRect(x - 1, y - 1, s + 2, s + 2);
      g.fillStyle(d.color).fillRect(x, y, s, s);
      if (d.active && pulse) g.lineStyle(1, 0xfbd38d).strokeRect(x - 2.5, y - 2.5, s + 5, s + 5);
    }
  }
}

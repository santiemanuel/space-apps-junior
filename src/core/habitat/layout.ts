/** Punto en coordenadas de tile (el centro del tile `c` es `c + 0,5`). Independiente del render. */
export interface Point {
  x: number;
  y: number;
}

export interface TileRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface Cell {
  col: number;
  row: number;
}

/**
 * Cuarto de la nave o de la base. Puede tener cualquier forma (`mask` dentro de su rectángulo) y ninguna, una o
 * varias puertas; un cuarto sin puerta propia se abre a otro (p. ej. la esclusa dentro del taller).
 */
export interface ShipZone {
  id: string;
  /** Rectángulo que lo contiene. */
  rect: TileRect;
  /** Tiles del cuarto dentro de `rect`, por filas (`mask[r * cols + c]`). Sin máscara, todo el rectángulo. */
  mask?: readonly boolean[];
  /** Tile de la puerta principal (en la pared entre el cuarto y el pasillo). */
  door?: Cell;
  /** Otros tiles de puerta del cuarto (de la misma puerta o de otras). */
  doorTiles?: readonly Cell[];
  /** Donde se para quien trabaja ahí; por defecto, el centro del cuarto. */
  spot?: Point;
}

/**
 * Pasillo de la nave o tubo de la base (con piso de plástico aislado en Marte): une cuartos. Sus puertas son suyas,
 * así que si se cierra (un tubo roto) se cierran también ellas.
 */
export interface Passage {
  id: string;
  rect: TileRect;
  mask?: readonly boolean[];
  doorTiles?: readonly Cell[];
}

/** Exterior abierto (Marte, §4.4): se sale por la puerta de afuera de la esclusa. */
export interface ExteriorLayout {
  rect: TileRect;
  /** Zona de la esclusa. */
  airlock: string;
  /** Tile de la puerta exterior de la esclusa. */
  door: Cell;
  /** Otros tiles de la puerta exterior, si es más ancha que un tile. */
  doorTiles?: readonly Cell[];
  /**
   * Terreno que no se pisa dentro del rectángulo (acantilados, cerros, rocas grandes y las paredes de la base), por
   * filas de todo el plano: `blocked[row * cols + col]`. Sin máscara, todo el rectángulo es transitable.
   */
  blocked?: readonly boolean[];
}

/** Plano top-down de la nave o la base (§4.2, §4.4): cuartos unidos por pasillos o tubos. */
export interface ShipLayout {
  cols: number;
  rows: number;
  passages: readonly Passage[];
  zones: readonly ShipZone[];
  exterior?: ExteriorLayout;
  /** Tiles de los cuartos con un mueble encima (por filas de todo el plano): se pisan, pero los recorridos los esquivan. */
  obstacles?: readonly boolean[];
  /** Zona donde aparece la tripulación. */
  spawnZone: string;
}

/** Id del pasillo de la nave; los tubos de la base tienen el suyo (`tube-…`). En el tablero, todos son "pasillo". */
export const CORRIDOR = 'corridor';
/** Ubicación de quien está afuera: es la que usan los medidores para la EVA (`shieldZoneOf`). */
export const EXTERIOR = 'exterior';

const center = (col: number, row: number): Point => ({ x: col + 0.5, y: row + 0.5 });
const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
const inRect = (r: TileRect, col: number, row: number): boolean =>
  col >= r.col && col < r.col + r.cols && row >= r.row && row < r.row + r.rows;
/** El tile está en el área (rectángulo y máscara). */
const inArea = (a: { rect: TileRect; mask?: readonly boolean[] }, col: number, row: number): boolean =>
  inRect(a.rect, col, row) && (!a.mask || !!a.mask[(row - a.rect.row) * a.rect.cols + (col - a.rect.col)]);

export const zoneById = (layout: ShipLayout, id: string): ShipZone => {
  const zone = layout.zones.find((z) => z.id === id);
  if (!zone) throw new Error(`Zona desconocida: ${id}`);
  return zone;
};

/** La ubicación es un pasillo o un tubo. */
export const isPassage = (layout: ShipLayout, id: string | null): boolean => id !== null && layout.passages.some((p) => p.id === id);

/** Tiles de un cuarto o pasillo (sin las puertas). */
export function areaCells(a: { rect: TileRect; mask?: readonly boolean[] }): Cell[] {
  const cells: Cell[] = [];
  for (let row = a.rect.row; row < a.rect.row + a.rect.rows; row++)
    for (let col = a.rect.col; col < a.rect.col + a.rect.cols; col++) if (inArea(a, col, row)) cells.push({ col, row });
  return cells;
}

/** Donde se para quien trabaja en el cuarto: su `spot` o el centro. */
export const zoneSpot = (zone: ShipZone): Point => zone.spot ?? { x: zone.rect.col + zone.rect.cols / 2, y: zone.rect.row + zone.rect.rows / 2 };

const doorTilesOf = (zone: ShipZone): Cell[] => [...(zone.door ? [zone.door] : []), ...(zone.doorTiles ?? [])];

const average = (tiles: readonly Cell[]): Point => ({
  x: tiles.reduce((sum, t) => sum + t.col + 0.5, 0) / tiles.length,
  y: tiles.reduce((sum, t) => sum + t.row + 0.5, 0) / tiles.length,
});

/** Centro de la puerta principal (todos sus tiles vecinos); sin puerta, su lugar de trabajo. */
export const doorPoint = (zone: ShipZone): Point => {
  if (!zone.door) return zoneSpot(zone);
  const tiles = [zone.door];
  for (const t of zone.doorTiles ?? []) if (tiles.some((d) => Math.abs(d.col - t.col) + Math.abs(d.row - t.row) === 1)) tiles.push(t);
  return average(tiles);
};

const exteriorDoorTiles = (ext: ExteriorLayout) => [ext.door, ...(ext.doorTiles ?? [])];

/** Centro de la puerta exterior de la esclusa (de todos sus tiles). */
export const exteriorDoorPoint = (ext: ExteriorLayout): Point => average(exteriorDoorTiles(ext));

/** Zona de cada tile, calculada una vez por plano: cuartos (con sus puertas), pasillos (con las suyas) y exterior. */
const grids = new WeakMap<ShipLayout, (string | null)[]>();

function gridOf(layout: ShipLayout): (string | null)[] {
  const cached = grids.get(layout);
  if (cached) return cached;
  const { cols, rows } = layout;
  const grid: (string | null)[] = new Array(cols * rows).fill(null);
  const mark = (col: number, row: number, id: string) => {
    if (col >= 0 && row >= 0 && col < cols && row < rows && grid[row * cols + col] === null) grid[row * cols + col] = id;
  };
  for (const zone of layout.zones) {
    for (const c of areaCells(zone)) mark(c.col, c.row, zone.id);
    for (const d of doorTilesOf(zone)) mark(d.col, d.row, zone.id);
  }
  for (const p of layout.passages) {
    for (const c of areaCells(p)) mark(c.col, c.row, p.id);
    for (const d of p.doorTiles ?? []) mark(d.col, d.row, p.id);
  }
  const ext = layout.exterior;
  if (ext) {
    for (const d of exteriorDoorTiles(ext)) mark(d.col, d.row, EXTERIOR);
    for (let row = ext.rect.row; row < ext.rect.row + ext.rect.rows; row++)
      for (let col = ext.rect.col; col < ext.rect.col + ext.rect.cols; col++) if (!ext.blocked?.[row * cols + col]) mark(col, row, EXTERIOR);
  }
  grids.set(layout, grid);
  return grid;
}

const zoneOfTile = (layout: ShipLayout, col: number, row: number): string | null =>
  col < 0 || row < 0 || col >= layout.cols || row >= layout.rows ? null : gridOf(layout)[row * layout.cols + col]!;

/** Se puede caminar por los cuartos, los pasillos, las puertas y el exterior; el resto es pared o terreno. */
export const isWalkable = (layout: ShipLayout, col: number, row: number): boolean => zoneOfTile(layout, col, row) !== null;

/**
 * Zona de un punto: un cuarto (sus puertas cuentan como parte del cuarto), un pasillo o tubo, el exterior o null si es
 * pared o terreno que no se pisa. Los cuartos y pasillos van antes que el exterior, que puede rodear la base.
 */
export const zoneAt = (layout: ShipLayout, p: Point): string | null => zoneOfTile(layout, Math.floor(p.x), Math.floor(p.y));

/**
 * Lo que ocupa la base (por filas de todo el plano): sus cuartos, pasillos y tubos, y las paredes que los rodean (un
 * tile a los costados y abajo, dos arriba: el techo y el frente de la pared en la vista 3/4).
 */
export function baseFootprint(layout: ShipLayout): boolean[] {
  const { cols, rows } = layout;
  const inside = (col: number, row: number) => {
    const zone = zoneOfTile(layout, col, row);
    return zone !== null && zone !== EXTERIOR;
  };
  return Array.from({ length: cols * rows }, (_, i) => {
    const [col, row] = [i % cols, Math.floor(i / cols)];
    if (inside(col, row)) return true;
    if (isWalkable(layout, col, row)) return false;
    for (let dr = -1; dr <= 2; dr++) for (let dc = -1; dc <= 1; dc++) if (inside(col + dc, row + dr)) return true;
    return false;
  });
}

/** Lo que no se puede pisar en un recorrido: pasillos o tubos cerrados (rotos). */
export type Closed = ReadonlySet<string>;
const NONE: Closed = new Set();

type Walk = (col: number, row: number) => boolean;
const walker = (layout: ShipLayout, closed: Closed, only?: string): Walk => (col, row) => {
  const zone = zoneOfTile(layout, col, row);
  return zone !== null && !closed.has(zone) && (only === undefined || zone === only) && !layout.obstacles?.[row * layout.cols + col];
};

/** Separación con las paredes (tiles) que pide un tramo recto: así nadie roza los marcos de las puertas. */
const CLEARANCE = 0.3;

/** Se va en línea recta de `a` a `b` sin pisar nada que no se pueda, con un margen a los costados. */
function clearLine(walk: Walk, a: Point, b: Point, clearance = CLEARANCE): boolean {
  const d = dist(a, b);
  if (d === 0) return true;
  const [nx, ny] = [-(b.y - a.y) / d, (b.x - a.x) / d];
  const steps = Math.ceil(d / 0.2);
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k;
    for (const s of [0, clearance, -clearance]) if (!walk(Math.floor(x + nx * s), Math.floor(y + ny * s))) return false;
  }
  return true;
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/**
 * Camino más corto por tiles (en diagonal sólo si no corta una esquina) y después se saltean los puntos intermedios
 * que se ven entre sí. Devuelve `[from, …, to]` o null si no hay camino.
 */
function findPath(layout: ShipLayout, open: Walk, from: Point, to: Point): Point[] | null {
  const cols = layout.cols;
  const key = (col: number, row: number) => row * cols + col;
  const start = key(Math.floor(from.x), Math.floor(from.y));
  const goal = key(Math.floor(to.x), Math.floor(to.y));
  // El tile de salida y el de llegada se pisan siempre (quien está parado junto a un mueble puede salir).
  const walk: Walk = (col, row) => key(col, row) === start || key(col, row) === goal || open(col, row);
  if (clearLine(walk, from, to)) return [from, to];
  const cost = new Map<number, number>([[start, 0]]);
  const previous = new Map<number, number>([[start, start]]);
  const heap = new MinHeap();
  heap.push(start, 0);
  while (heap.size) {
    const [at, c] = heap.pop();
    if (at === goal) break;
    if (c > cost.get(at)!) continue;
    const col = at % cols;
    const row = Math.floor(at / cols);
    for (const [dc, dr] of NEIGHBORS) {
      if (!walk(col + dc, row + dr)) continue;
      if (dc && dr && !(walk(col + dc, row) && walk(col, row + dr))) continue;
      const next = key(col + dc, row + dr);
      const nc = c + (dc && dr ? Math.SQRT2 : 1);
      if (nc >= (cost.get(next) ?? Infinity)) continue;
      cost.set(next, nc);
      previous.set(next, at);
      heap.push(next, nc);
    }
  }
  if (!previous.has(goal)) return null;
  const tiles: Point[] = [];
  for (let at = previous.get(goal)!; at !== start; at = previous.get(at)!) tiles.unshift(center(at % cols, Math.floor(at / cols)));
  const points = [from];
  const all = [...tiles, to];
  let i = 0;
  while (i < all.length) {
    let j = all.length - 1;
    while (j > i && !clearLine(walk, points[points.length - 1]!, all[j]!)) j--;
    points.push(all[j]!);
    i = j + 1;
  }
  return points;
}

/** Cola de prioridad mínima (montículo binario) para el camino más corto. */
class MinHeap {
  private readonly items: [number, number][] = [];
  get size(): number {
    return this.items.length;
  }
  push(value: number, priority: number): void {
    const a = this.items;
    a.push([value, priority]);
    for (let i = a.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (a[parent]![1] <= a[i]![1]) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      i = parent;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const [l, r] = [i * 2 + 1, i * 2 + 2];
        let m = i;
        if (l < a.length && a[l]![1] < a[m]![1]) m = l;
        if (r < a.length && a[r]![1] < a[m]![1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/** Camino por el exterior esquivando el terreno que no se pisa. Sin camino, la línea recta. */
export function exteriorPath(layout: ShipLayout, from: Point, to: Point): Point[] {
  return findPath(layout, walker(layout, NONE, EXTERIOR), from, to) ?? [from, to];
}

/**
 * Vuelta de la ruta a ciegas (eficiencia < 0,8, §3.3): el tile de pasillo o tubo abierto más lejos del destino al que
 * se puede llegar. En la nave es la punta más lejana del pasillo.
 */
function detourFor(layout: ShipLayout, walk: Walk, target: Point): Point | null {
  let best: Point | null = null;
  for (const p of layout.passages)
    for (const c of areaCells(p)) {
      if (!walk(c.col, c.row)) continue;
      const point = center(c.col, c.row);
      if (!best || dist(point, target) > dist(best, target)) best = point;
    }
  return best;
}

/** Recorrido hasta un punto evitando lo cerrado; a ciegas, con una vuelta de más. Null si no se puede llegar. */
export function pathTo(layout: ShipLayout, from: Point, target: Point, blind = false, closed: Closed = NONE): Point[] | null {
  const walk = walker(layout, closed);
  const direct = findPath(layout, walk, from, target);
  if (!direct || !blind) return direct;
  const detour = detourFor(layout, walk, target);
  const out = detour && findPath(layout, walk, from, detour);
  const back = detour && out && findPath(layout, walk, detour, target);
  return out && back ? [...out, ...back.slice(1)] : direct;
}

/**
 * Recorrido de `from` al lugar de trabajo de la zona `to` por puertas, pasillos y tubos (y el exterior si hace falta).
 * Si no se puede llegar (tubos cerrados), `[from]`.
 */
export function route(layout: ShipLayout, from: Point, to: string, blind = false, closed: Closed = NONE): Point[] {
  const target = zoneById(layout, to);
  if (zoneAt(layout, from) === to) return [from, zoneSpot(target)];
  return pathTo(layout, from, zoneSpot(target), blind, closed) ?? [from];
}

/** Recorrido hasta un punto cualquiera: si está afuera, sale por la esclusa (§4.4). Si no se puede llegar, `[from]`. */
export function routeToPoint(layout: ShipLayout, from: Point, target: Point, blind = false, closed: Closed = NONE): Point[] {
  return pathTo(layout, from, target, blind, closed) ?? [from];
}

export const pathLength = (points: readonly Point[]): number =>
  points.slice(1).reduce((sum, p, i) => sum + dist(points[i]!, p), 0);

/** Punto a `distance` tiles del inicio del recorrido (el final si se pasa). */
export function pointAlong(points: readonly Point[], distance: number): Point {
  let left = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = dist(a, b);
    if (left <= d && d > 0) return { x: a.x + ((b.x - a.x) * left) / d, y: a.y + ((b.y - a.y) * left) / d };
    left -= d;
  }
  return points[points.length - 1]!;
}

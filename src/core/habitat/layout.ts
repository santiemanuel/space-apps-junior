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

/** Módulo de la nave: un cuarto rectangular con una puerta al pasillo. */
export interface ShipZone {
  id: string;
  rect: TileRect;
  /** Tile de la puerta (en la pared entre el cuarto y el pasillo). */
  door: { col: number; row: number };
  /** Otros tiles de la misma puerta, si es más ancha que un tile. */
  doorTiles?: readonly { col: number; row: number }[];
  /** Donde se para quien trabaja ahí; por defecto, el centro del cuarto. */
  spot?: Point;
}

/** Exterior abierto (Marte, §4.4): se sale por la puerta de afuera de la esclusa. */
export interface ExteriorLayout {
  rect: TileRect;
  /** Zona de la esclusa. */
  airlock: string;
  /** Tile de la puerta exterior de la esclusa. */
  door: { col: number; row: number };
  /** Otros tiles de la puerta exterior, si es más ancha que un tile. */
  doorTiles?: readonly { col: number; row: number }[];
  /**
   * Terreno que no se pisa dentro del rectángulo (acantilados, cerros, rocas grandes y las paredes de la base), por
   * filas de todo el plano: `blocked[row * cols + col]`. Sin máscara, todo el rectángulo es transitable.
   */
  blocked?: readonly boolean[];
}

/** Plano top-down de la nave o la base (§4.2, §4.4): cuartos alrededor de un pasillo central. */
export interface ShipLayout {
  cols: number;
  rows: number;
  corridor: TileRect;
  zones: readonly ShipZone[];
  exterior?: ExteriorLayout;
  /** Zona donde aparece la tripulación. */
  spawnZone: string;
}

/** Ubicación de quien está en el pasillo (blindaje de hábitat). */
export const CORRIDOR = 'corridor';
/** Ubicación de quien está afuera: es la que usan los medidores para la EVA (`shieldZoneOf`). */
export const EXTERIOR = 'exterior';

const center = (col: number, row: number): Point => ({ x: col + 0.5, y: row + 0.5 });
const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
const inRect = (r: TileRect, col: number, row: number): boolean =>
  col >= r.col && col < r.col + r.cols && row >= r.row && row < r.row + r.rows;

export const zoneById = (layout: ShipLayout, id: string): ShipZone => {
  const zone = layout.zones.find((z) => z.id === id);
  if (!zone) throw new Error(`Zona desconocida: ${id}`);
  return zone;
};

/** Donde se para quien trabaja en el cuarto: su `spot` o el centro. */
export const zoneSpot = (zone: ShipZone): Point => zone.spot ?? { x: zone.rect.col + zone.rect.cols / 2, y: zone.rect.row + zone.rect.rows / 2 };

const doorTilesOf = (zone: ShipZone) => [zone.door, ...(zone.doorTiles ?? [])];

/** Centro de la puerta (de todos sus tiles): por ahí pasan los recorridos. */
export const doorPoint = (zone: ShipZone): Point => {
  const tiles = doorTilesOf(zone);
  return { x: tiles.reduce((sum, t) => sum + t.col + 0.5, 0) / tiles.length, y: tiles.reduce((sum, t) => sum + t.row + 0.5, 0) / tiles.length };
};

/** Se puede caminar por los cuartos, el pasillo y las puertas; el resto es pared. */
export const isWalkable = (layout: ShipLayout, col: number, row: number): boolean => zoneAt(layout, center(col, row)) !== null;

const exteriorDoorTiles = (ext: ExteriorLayout) => [ext.door, ...(ext.doorTiles ?? [])];

/** Centro de la puerta exterior de la esclusa (de todos sus tiles). */
export const exteriorDoorPoint = (ext: ExteriorLayout): Point => {
  const tiles = exteriorDoorTiles(ext);
  return { x: tiles.reduce((sum, t) => sum + t.col + 0.5, 0) / tiles.length, y: tiles.reduce((sum, t) => sum + t.row + 0.5, 0) / tiles.length };
};

const isExteriorTile = (layout: ShipLayout, col: number, row: number): boolean => {
  const ext = layout.exterior;
  if (!ext) return false;
  if (exteriorDoorTiles(ext).some((d) => d.col === col && d.row === row)) return true;
  return inRect(ext.rect, col, row) && !ext.blocked?.[row * layout.cols + col];
};

/**
 * Zona de un punto: un cuarto (su puerta cuenta como parte del cuarto), el pasillo, el exterior o null si es pared o
 * terreno que no se pisa. El pasillo va antes que el exterior: el rectángulo del exterior puede rodear la base.
 */
export function zoneAt(layout: ShipLayout, p: Point): string | null {
  const col = Math.floor(p.x);
  const row = Math.floor(p.y);
  const zone = layout.zones.find((z) => inRect(z.rect, col, row) || doorTilesOf(z).some((d) => d.col === col && d.row === row));
  if (zone) return zone.id;
  if (inRect(layout.corridor, col, row)) return CORRIDOR;
  return isExteriorTile(layout, col, row) ? EXTERIOR : null;
}

/** Se ve de `a` a `b` caminando por el exterior: ningún punto del segmento cae en terreno que no se pisa. */
function clearLine(layout: ShipLayout, a: Point, b: Point): boolean {
  const steps = Math.ceil(dist(a, b) / 0.2);
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    if (!isExteriorTile(layout, Math.floor(a.x + (b.x - a.x) * k), Math.floor(a.y + (b.y - a.y) * k))) return false;
  }
  return true;
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/**
 * Camino por el exterior esquivando el terreno que no se pisa: búsqueda en anchura por tiles (en diagonal sólo si
 * no corta una esquina) y después se saltean los puntos intermedios que se ven entre sí. Devuelve `[from, …, to]`;
 * si no hay camino, la línea recta.
 */
export function exteriorPath(layout: ShipLayout, from: Point, to: Point): Point[] {
  if (clearLine(layout, from, to)) return [from, to];
  const cols = layout.cols;
  const key = (col: number, row: number) => row * cols + col;
  const start = key(Math.floor(from.x), Math.floor(from.y));
  const goal = key(Math.floor(to.x), Math.floor(to.y));
  const previous = new Map<number, number>([[start, start]]);
  const queue = [start];
  for (let i = 0; i < queue.length && !previous.has(goal); i++) {
    const at = queue[i]!;
    const col = at % cols;
    const row = Math.floor(at / cols);
    for (const [dc, dr] of NEIGHBORS) {
      const next = key(col + dc, row + dr);
      if (previous.has(next) || !isExteriorTile(layout, col + dc, row + dr)) continue;
      if (dc && dr && !(isExteriorTile(layout, col + dc, row) && isExteriorTile(layout, col, row + dr))) continue;
      previous.set(next, at);
      queue.push(next);
    }
  }
  if (!previous.has(goal)) return [from, to];
  const tiles: Point[] = [];
  for (let at = previous.get(goal)!; at !== start; at = previous.get(at)!) tiles.unshift(center(at % cols, Math.floor(at / cols)));
  const points = [from];
  let i = 0;
  const all = [...tiles, to];
  while (i < all.length) {
    let j = all.length - 1;
    while (j > i && !clearLine(layout, points[points.length - 1]!, all[j]!)) j--;
    points.push(all[j]!);
    i = j + 1;
  }
  return points;
}

/**
 * Recorrido de `from` al centro de la zona `to` pasando por las puertas y el pasillo. La ruta a ciegas
 * (eficiencia < 0,8, §3.3) da una vuelta hasta la punta más lejana del pasillo antes de entrar.
 */
export function route(layout: ShipLayout, from: Point, to: string, blind = false): Point[] {
  const ext = layout.exterior;
  if (zoneAt(layout, from) === EXTERIOR && ext) {
    const lock = zoneById(layout, ext.airlock);
    return [...exteriorPath(layout, from, exteriorDoorPoint(ext)), ...route(layout, zoneSpot(lock), to, blind)];
  }
  const target = zoneById(layout, to);
  const here = zoneAt(layout, from);
  if (here === to) return [from, zoneSpot(target)];
  const { corridor } = layout;
  const cy = corridor.row + corridor.rows / 2;
  const door = doorPoint(target);
  const points: Point[] = [from];
  if (here !== null && here !== CORRIDOR) {
    const own = zoneById(layout, here);
    const ownDoor = doorPoint(own);
    points.push(ownDoor, { x: ownDoor.x, y: cy });
  }
  if (blind) {
    const left = corridor.col + 0.5;
    const right = corridor.col + corridor.cols - 0.5;
    points.push({ x: Math.abs(left - door.x) > Math.abs(right - door.x) ? left : right, y: cy });
  }
  points.push({ x: door.x, y: cy }, door, zoneSpot(target));
  return points;
}

/** Recorrido hasta un punto cualquiera: si está afuera, sale por la esclusa (§4.4). */
export function routeToPoint(layout: ShipLayout, from: Point, target: Point, blind = false): Point[] {
  const ext = layout.exterior;
  const zone = zoneAt(layout, target);
  if (zone !== EXTERIOR || !ext) return zone && zone !== CORRIDOR ? [...route(layout, from, zone, blind).slice(0, -1), target] : [from, target];
  if (zoneAt(layout, from) === EXTERIOR) return exteriorPath(layout, from, target);
  return [...route(layout, from, ext.airlock, blind), ...exteriorPath(layout, exteriorDoorPoint(ext), target)];
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

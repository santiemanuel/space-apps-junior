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
}

/** Exterior abierto (Marte, §4.4): se sale por la puerta de afuera de la esclusa. */
export interface ExteriorLayout {
  rect: TileRect;
  /** Zona de la esclusa. */
  airlock: string;
  /** Tile de la puerta exterior de la esclusa. */
  door: { col: number; row: number };
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
const inRect = (r: TileRect, col: number, row: number): boolean =>
  col >= r.col && col < r.col + r.cols && row >= r.row && row < r.row + r.rows;

export const zoneById = (layout: ShipLayout, id: string): ShipZone => {
  const zone = layout.zones.find((z) => z.id === id);
  if (!zone) throw new Error(`Zona desconocida: ${id}`);
  return zone;
};

/** Centro del cuarto: donde se para quien trabaja ahí. */
export const zoneSpot = (zone: ShipZone): Point => ({ x: zone.rect.col + zone.rect.cols / 2, y: zone.rect.row + zone.rect.rows / 2 });

/** Se puede caminar por los cuartos, el pasillo y las puertas; el resto es pared. */
export const isWalkable = (layout: ShipLayout, col: number, row: number): boolean => zoneAt(layout, center(col, row)) !== null;

const isExteriorTile = (ext: ExteriorLayout | undefined, col: number, row: number): boolean =>
  !!ext && (inRect(ext.rect, col, row) || (ext.door.col === col && ext.door.row === row));

/** Zona de un punto: un cuarto (su puerta cuenta como parte del cuarto), el pasillo, el exterior o null si es pared. */
export function zoneAt(layout: ShipLayout, p: Point): string | null {
  const col = Math.floor(p.x);
  const row = Math.floor(p.y);
  const zone = layout.zones.find((z) => inRect(z.rect, col, row) || (z.door.col === col && z.door.row === row));
  if (zone) return zone.id;
  if (isExteriorTile(layout.exterior, col, row)) return EXTERIOR;
  return inRect(layout.corridor, col, row) ? CORRIDOR : null;
}

/**
 * Recorrido de `from` al centro de la zona `to` pasando por las puertas y el pasillo. La ruta a ciegas
 * (eficiencia < 0,8, §3.3) da una vuelta hasta la punta más lejana del pasillo antes de entrar.
 */
export function route(layout: ShipLayout, from: Point, to: string, blind = false): Point[] {
  const ext = layout.exterior;
  if (zoneAt(layout, from) === EXTERIOR && ext) {
    const lock = zoneById(layout, ext.airlock);
    return [from, center(ext.door.col, ext.door.row), ...route(layout, zoneSpot(lock), to, blind)];
  }
  const target = zoneById(layout, to);
  const here = zoneAt(layout, from);
  if (here === to) return [from, zoneSpot(target)];
  const { corridor } = layout;
  const cy = corridor.row + corridor.rows / 2;
  const door = center(target.door.col, target.door.row);
  const points: Point[] = [from];
  if (here !== null && here !== CORRIDOR) {
    const own = zoneById(layout, here);
    const ownDoor = center(own.door.col, own.door.row);
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
  if (zoneAt(layout, from) === EXTERIOR) return [from, target];
  return [...route(layout, from, ext.airlock, blind), center(ext.door.col, ext.door.row), target];
}

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

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

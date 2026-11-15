import type { ExteriorLayout, Point, ShipLayout, ShipZone, TileRect } from '../core/habitat/layout';

/**
 * Lo que se lee de un mapa de Tiled (JSON) para las reglas y para el render (docs/plan-visual.md §7). Capas:
 * `piso` y `paredes` (tiles), `zonas` (rectángulos `zone`, `corridor`, `door`, `exterior`; puntos `spot` y `spawn`;
 * el nombre de `zone`, `door` y `spot` es el id de la zona), `objetos` (rectángulo = caja de colisión; `type` =
 * sprite) y `decorado` (puntos sin colisión, colgados de la pared).
 */
export interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: TiledObject[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: TiledLayer[];
}

/** Objeto del mapa: `key` es su sprite; el rectángulo (px) es lo que choca, y el sprite se apoya en su borde de abajo. */
export interface MapProp {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const layerOf = (map: TiledMap, name: string): TiledLayer => {
  const layer = map.layers.find((l) => l.name === name);
  if (!layer) throw new Error(`Al mapa le falta la capa "${name}"`);
  return layer;
};

const objectsOf = (map: TiledMap, layer: string, type?: string): TiledObject[] =>
  (layerOf(map, layer).objects ?? []).filter((o) => type === undefined || o.type === type);

/** Plano de las reglas (`core/habitat/layout`) a partir de la capa `zonas`. */
export function layoutFromTiled(map: TiledMap): ShipLayout {
  const t = map.tilewidth;
  const rect = (o: TiledObject): TileRect => ({ col: Math.round(o.x / t), row: Math.round(o.y / t), cols: Math.round(o.width / t), rows: Math.round(o.height / t) });
  const tiles = (r: TileRect) => Array.from({ length: r.cols * r.rows }, (_, i) => ({ col: r.col + (i % r.cols), row: r.row + Math.floor(i / r.cols) }));
  const point = (o: TiledObject): Point => ({ x: o.x / t, y: o.y / t });
  const only = (type: string): TiledObject => {
    const found = objectsOf(map, 'zonas', type);
    if (found.length !== 1) throw new Error(`El mapa debe tener un solo objeto "${type}" (tiene ${found.length})`);
    return found[0]!;
  };

  const doors = objectsOf(map, 'zonas', 'door');
  const spots = objectsOf(map, 'zonas', 'spot');
  const zones: ShipZone[] = objectsOf(map, 'zonas', 'zone').map((o) => {
    const door = doors.find((d) => d.name === o.name);
    if (!door) throw new Error(`La zona "${o.name}" no tiene puerta`);
    const [first, ...rest] = tiles(rect(door));
    const spot = spots.find((s) => s.name === o.name);
    return { id: o.name, rect: rect(o), door: first!, ...(rest.length ? { doorTiles: rest } : {}), ...(spot ? { spot: point(spot) } : {}) };
  });

  const spawn = point(only('spawn'));
  const spawnZone = zones.find((z) => spawn.x >= z.rect.col && spawn.x < z.rect.col + z.rect.cols && spawn.y >= z.rect.row && spawn.y < z.rect.row + z.rect.rows);
  if (!spawnZone) throw new Error('El punto "spawn" no está dentro de una zona');

  const outside = objectsOf(map, 'zonas', 'exterior')[0];
  let exterior: ExteriorLayout | undefined;
  if (outside) {
    const door = doors.find((d) => d.name === 'exterior');
    if (!door) throw new Error('El exterior no tiene puerta');
    exterior = { rect: rect(outside), airlock: 'airlock', door: tiles(rect(door))[0]! };
  }
  return { cols: map.width, rows: map.height, corridor: rect(only('corridor')), zones, spawnZone: spawnZone.id, ...(exterior ? { exterior } : {}) };
}

/** Objetos con colisión de la capa `objetos`. */
export const propsFromTiled = (map: TiledMap): MapProp[] =>
  objectsOf(map, 'objetos').map((o) => ({ key: o.type, x: o.x, y: o.y, width: o.width, height: o.height }));

/** Tiles de pared (los que chocan): los que tienen algo en la capa `paredes`. */
export function wallTilesFromTiled(map: TiledMap): boolean[][] {
  const data = layerOf(map, 'paredes').data ?? [];
  return Array.from({ length: map.height }, (_, row) => Array.from({ length: map.width }, (_, col) => (data[row * map.width + col] ?? 0) > 0));
}

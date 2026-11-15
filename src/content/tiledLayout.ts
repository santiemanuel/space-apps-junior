import { EXTERIOR, zoneAt, type Cell, type ExteriorLayout, type Passage, type Point, type ShipLayout, type ShipZone, type TileRect } from '../core/habitat/layout';

/**
 * Lo que se lee de un mapa de Tiled (JSON) para las reglas y para el render (docs/historial/plan-visual.md §7). Capas:
 * `piso` y `paredes` (tiles), `zonas` (rectángulos o polígonos `zone`, `corridor` y `tube`; rectángulos `door`,
 * `exterior` y `terrain`; líneas `cable`; puntos `spot`, `spawn` y `landmark`; el nombre de `zone`, `door` y `spot` es
 * el id de la zona o del tubo, el de `terrain` el de la franja, el de `cable` el del tramo y el de `landmark` el del
 * punto), `objetos` (rectángulo = caja de colisión; `type` = sprite) y `decorado` (puntos sin colisión, colgados de la
 * pared).
 */
export interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Polígono o línea (px, relativos a `x`, `y`). */
  polygon?: Point[];
  polyline?: Point[];
  properties?: { name: string; type?: string; value: string | number | boolean }[];
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

/** Tiles cuyo centro cae dentro de un polígono (px), con el rectángulo que los contiene. */
function polygonArea(o: TiledObject, t: number): { rect: TileRect; mask: boolean[] } {
  const pts = o.polygon!.map((p) => ({ x: o.x + p.x, y: o.y + p.y }));
  const inside = (x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [a, b] = [pts[i]!, pts[j]!];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [c0, c1] = [Math.floor(Math.min(...xs) / t), Math.ceil(Math.max(...xs) / t)];
  const [r0, r1] = [Math.floor(Math.min(...ys) / t), Math.ceil(Math.max(...ys) / t)];
  const cells: Cell[] = [];
  for (let row = r0; row < r1; row++) for (let col = c0; col < c1; col++) if (inside((col + 0.5) * t, (row + 0.5) * t)) cells.push({ col, row });
  if (!cells.length) throw new Error(`El polígono "${o.name}" no cubre ningún tile`);
  const col = Math.min(...cells.map((c) => c.col));
  const row = Math.min(...cells.map((c) => c.row));
  const rect = { col, row, cols: Math.max(...cells.map((c) => c.col)) - col + 1, rows: Math.max(...cells.map((c) => c.row)) - row + 1 };
  const mask = new Array<boolean>(rect.cols * rect.rows).fill(false);
  for (const c of cells) mask[(c.row - row) * rect.cols + (c.col - col)] = true;
  return { rect, mask };
}

/** Plano de las reglas (`core/habitat/layout`) a partir de la capa `zonas`. */
export function layoutFromTiled(map: TiledMap): ShipLayout {
  const t = map.tilewidth;
  const rect = (o: TiledObject): TileRect => ({ col: Math.round(o.x / t), row: Math.round(o.y / t), cols: Math.round(o.width / t), rows: Math.round(o.height / t) });
  const area = (o: TiledObject) => (o.polygon ? polygonArea(o, t) : { rect: rect(o) });
  const tiles = (r: TileRect) => Array.from({ length: r.cols * r.rows }, (_, i) => ({ col: r.col + (i % r.cols), row: r.row + Math.floor(i / r.cols) }));
  const point = (o: TiledObject): Point => ({ x: o.x / t, y: o.y / t });
  const only = (type: string): TiledObject => {
    const found = objectsOf(map, 'zonas', type);
    if (found.length !== 1) throw new Error(`El mapa debe tener un solo objeto "${type}" (tiene ${found.length})`);
    return found[0]!;
  };

  const doors = objectsOf(map, 'zonas', 'door');
  const doorsOf = (name: string): Cell[] => doors.filter((d) => d.name === name).flatMap((d) => tiles(rect(d)));
  const spots = objectsOf(map, 'zonas', 'spot');
  const zones: ShipZone[] = objectsOf(map, 'zonas', 'zone').map((o) => {
    const [first, ...rest] = doorsOf(o.name);
    const spot = spots.find((s) => s.name === o.name);
    return { id: o.name, ...area(o), ...(first ? { door: first } : {}), ...(rest.length ? { doorTiles: rest } : {}), ...(spot ? { spot: point(spot) } : {}) };
  });
  const passages: Passage[] = [...objectsOf(map, 'zonas', 'corridor'), ...objectsOf(map, 'zonas', 'tube')].map((o) => {
    const id = o.type === 'corridor' ? 'corridor' : o.name;
    const own = doorsOf(id);
    return { id, ...area(o), ...(own.length ? { doorTiles: own } : {}) };
  });
  if (!passages.length) throw new Error('El mapa no tiene pasillos ni tubos');

  const outside = objectsOf(map, 'zonas', 'exterior')[0];
  let exterior: ExteriorLayout | undefined;
  if (outside) {
    const [first, ...rest] = doorsOf('exterior');
    if (!first) throw new Error('El exterior no tiene puerta');
    exterior = { rect: rect(outside), airlock: 'airlock', door: first, ...(rest.length ? { doorTiles: rest } : {}), blocked: blockedTiles(map) };
  }
  const draft: ShipLayout = { cols: map.width, rows: map.height, passages, zones, spawnZone: '', ...(exterior ? { exterior } : {}) };
  if (exterior) exterior.blocked = withoutCourtyards(draft, exterior);
  const layout: ShipLayout = { ...draft, obstacles: obstacleTiles(map, draft) };
  const spawnZone = zoneAt(layout, point(only('spawn')));
  if (!spawnZone || !zones.some((z) => z.id === spawnZone)) throw new Error('El punto "spawn" no está dentro de una zona');
  return { ...layout, spawnZone };
}

/** Tramo de cable de la red eléctrica (línea `cable` de la capa `zonas`): une dos nodos (`from`, `to`). */
export interface MapCable {
  id: string;
  from: string;
  to: string;
  /** Recorrido (tiles). */
  points: Point[];
}

export const cablesFromTiled = (map: TiledMap): MapCable[] =>
  objectsOf(map, 'zonas', 'cable').map((o) => {
    const prop = (name: string) => String(o.properties?.find((p) => p.name === name)?.value ?? '');
    return { id: o.name, from: prop('from'), to: prop('to'), points: (o.polyline ?? []).map((p) => ({ x: (o.x + p.x) / map.tilewidth, y: (o.y + p.y) / map.tilewidth })) };
  });

/**
 * Patios: el suelo encerrado entre los tubos y los módulos de la base se ve, pero no se llega desde la esclusa. Se
 * marca como bloqueado para que no aparezcan muestras ahí.
 */
function withoutCourtyards(layout: ShipLayout, ext: ExteriorLayout): boolean[] {
  const { cols } = layout;
  const blocked = [...(ext.blocked ?? [])];
  const open = (col: number, row: number) => zoneAt(layout, { x: col + 0.5, y: row + 0.5 }) === EXTERIOR;
  const start = [ext.door, ...(ext.doorTiles ?? [])];
  const seen = new Set(start.map((d) => d.row * cols + d.col));
  const queue = start.map((d) => [d.col, d.row] as const);
  for (let i = 0; i < queue.length; i++) {
    const [col, row] = queue[i]!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [c, r] = [col + dc, row + dr];
      if (seen.has(r * cols + c) || !open(c, r)) continue;
      seen.add(r * cols + c);
      queue.push([c, r]);
    }
  }
  for (let row = ext.rect.row; row < ext.rect.row + ext.rect.rows; row++)
    for (let col = ext.rect.col; col < ext.rect.col + ext.rect.cols; col++) if (open(col, row) && !seen.has(row * cols + col)) blocked[row * cols + col] = true;
  return blocked;
}

/**
 * Tiles de los cuartos y tubos que un mueble tapa (su caja toca el centro del tile, sin los bordes de un quinto de
 * tile): los recorridos de los automáticos los esquivan.
 */
function obstacleTiles(map: TiledMap, layout: ShipLayout): boolean[] {
  const t = map.tilewidth;
  const margin = t / 5;
  const obstacles = new Array<boolean>(map.width * map.height).fill(false);
  for (const p of propsFromTiled(map))
    for (let row = Math.floor(p.y / t); row <= Math.floor((p.y + p.height) / t); row++)
      for (let col = Math.floor(p.x / t); col <= Math.floor((p.x + p.width) / t); col++) {
        const [x0, y0] = [col * t + margin, row * t + margin];
        const touches = p.x < x0 + t - 2 * margin && p.x + p.width > x0 && p.y < y0 + t - 2 * margin && p.y + p.height > y0;
        const zone = zoneAt(layout, { x: col + 0.5, y: row + 0.5 });
        if (touches && zone && zone !== EXTERIOR) obstacles[row * map.width + col] = true;
      }
  return obstacles;
}

/**
 * Terreno que no se pisa, por filas (`[row * width + col]`): los tiles de la capa `paredes` y los que tienen el
 * centro dentro de la caja de colisión de un objeto (rocas grandes).
 */
function blockedTiles(map: TiledMap): boolean[] {
  const t = map.tilewidth;
  const walls = wallTilesFromTiled(map);
  const props = propsFromTiled(map);
  return Array.from({ length: map.width * map.height }, (_, i) => {
    const col = i % map.width;
    const row = Math.floor(i / map.width);
    const x = (col + 0.5) * t;
    const y = (row + 0.5) * t;
    return walls[row]![col]! || props.some((p) => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height);
  });
}

/** Franja del terreno (rectángulo `terrain` de la capa `zonas`): `id` es su nombre. */
export interface TerrainStrip {
  id: string;
  rect: TileRect;
}

export const terrainFromTiled = (map: TiledMap): TerrainStrip[] =>
  objectsOf(map, 'zonas', 'terrain').map((o) => ({
    id: o.name,
    rect: { col: Math.round(o.x / map.tilewidth), row: Math.round(o.y / map.tilewidth), cols: Math.round(o.width / map.tilewidth), rows: Math.round(o.height / map.tilewidth) },
  }));

/** Puntos con nombre de la capa `zonas` (`landmark`), en tiles: p. ej. dónde está estacionado Curiosity. */
export const landmarksFromTiled = (map: TiledMap): Record<string, Point> =>
  Object.fromEntries(objectsOf(map, 'zonas', 'landmark').map((o) => [o.name, { x: o.x / map.tilewidth, y: o.y / map.tilewidth }]));

/** Objetos con colisión de la capa `objetos`. */
export const propsFromTiled = (map: TiledMap): MapProp[] =>
  objectsOf(map, 'objetos').map((o) => ({ key: o.type, x: o.x, y: o.y, width: o.width, height: o.height }));

/** Tiles de pared (los que chocan): los que tienen algo en la capa `paredes`. */
export function wallTilesFromTiled(map: TiledMap): boolean[][] {
  const data = layerOf(map, 'paredes').data ?? [];
  return Array.from({ length: map.height }, (_, row) => Array.from({ length: map.width }, (_, col) => (data[row * map.width + col] ?? 0) > 0));
}

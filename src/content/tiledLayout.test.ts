import { describe, expect, it } from 'vitest';
import { EXTERIOR, doorPoint, isWalkable, pathLength, pointAlong, route, zoneAt, zoneById, zoneSpot, type ShipLayout } from '../core/habitat/layout';
import type { HabitatTask } from '../core/habitat/types';
import { GALE_CABLES, GALE_LANDMARKS, GALE_LAYOUT, GALE_MAP, GALE_TASKS, GALE_TERRAIN } from './gale';
import { GALE_STRIPS } from './galeTerrain';
import { SHIP_LAYOUT, SHIP_MAP, VOYAGE_TASKS } from './ship';
import { layoutFromTiled, propsFromTiled, wallTilesFromTiled, type TiledMap } from './tiledLayout';
import { PANELS_ZONE } from '../core/mars/MarsSession';

describe.each([
  ['nave', SHIP_MAP, SHIP_LAYOUT, VOYAGE_TASKS],
  ['base en Gale', GALE_MAP, GALE_LAYOUT, GALE_TASKS],
] as [string, TiledMap, ShipLayout, readonly HabitatTask[]][])('mapa de la %s (Tiled)', (_, map, layout, tasks) => {
  const walls = wallTilesFromTiled(map);
  const props = propsFromTiled(map);
  const tile = map.tilewidth;
  /** Suelo encerrado entre los tubos de la base: se ve pero no se pisa. */
  const courtyard = (col: number, row: number) => !!layout.exterior?.blocked?.[row * layout.cols + col];
  const insideProp = (x: number, y: number) =>
    props.some((p) => x * tile > p.x && x * tile < p.x + p.width && y * tile > p.y && y * tile < p.y + p.height);

  it('las puertas son de su cuarto y la tripulación aparece en el mando', () => {
    for (const zone of layout.zones) if (zone.door) expect(zoneAt(layout, doorPoint(zone)), zone.id).toBe(zone.id);
    expect(layout.spawnZone).toBe('command');
  });

  it('lo que no se pisa es pared o queda debajo de un objeto del exterior (rocas, Curiosity, paneles)', () => {
    for (let row = 0; row < layout.rows; row++)
      for (let col = 0; col < layout.cols; col++) {
        const walkable = isWalkable(layout, col, row);
        if (walls[row]![col]) expect(walkable, `${col},${row}`).toBe(false);
        else if (!walkable) expect(!!layout.exterior && (insideProp(col + 0.5, row + 0.5) || courtyard(col, row)), `${col},${row}`).toBe(true);
      }
  });

  it('los objetos quedan dentro de un cuarto, del pasillo o del exterior (nunca en una pared)', () => {
    for (const p of props) {
      for (const [x, y] of [[p.x, p.y], [p.x + p.width, p.y + p.height]] as const) {
        const [col, row] = [Math.floor(x / tile), Math.floor((y - 0.01) / tile)];
        const zone = zoneAt(layout, { x: x / tile, y: (y - 0.01) / tile });
        const outside = !!layout.exterior && !walls[row]![col];
        expect((zone !== null && zone !== EXTERIOR) || outside, `${p.key} en ${p.x},${p.y}`).toBe(true);
      }
    }
  });

  it('desde el mando se llega a cada cuarto sin atravesar paredes ni muebles', () => {
    const from = zoneSpot(zoneById(layout, 'command'));
    for (const zone of layout.zones) {
      const path = route(layout, from, zone.id);
      expect(path.length, zone.id).toBeGreaterThan(1);
      expect(insideProp(zoneSpot(zone).x, zoneSpot(zone).y), `${zone.id}: lugar de trabajo`).toBe(false);
      for (let d = 0.6; d <= pathLength(path) - 0.6; d += 0.1) {
        const p = pointAlong(path, d);
        expect(zoneAt(layout, p), `${zone.id}: ${p.x},${p.y}`).not.toBeNull();
        expect(insideProp(p.x, p.y), `${zone.id}: ${p.x},${p.y}`).toBe(false);
      }
    }
    // Cada tarea tiene su cuarto, salvo la de los paneles solares, que se hace afuera junto a ellos.
    for (const task of tasks) expect(task.zone === PANELS_ZONE || layout.zones.some((z) => z.id === task.zone), task.id).toBe(true);
  });
});

describe('mapa de la nave (Tiled)', () => {
  it('tiene los ocho cuartos', () => {
    expect(SHIP_LAYOUT.zones.map((z) => z.id).sort()).toEqual(['command', 'exercise', 'infirmary', 'pantry', 'radio', 'recycler', 'scrubber', 'shelter']);
  });

  it('avisa si al mapa le falta una capa o el pasillo', () => {
    expect(() => layoutFromTiled({ ...SHIP_MAP, layers: SHIP_MAP.layers.filter((l) => l.name !== 'zonas') })).toThrow(/zonas/);
    const withoutCorridor = SHIP_MAP.layers.map((l) => (l.name === 'zonas' ? { ...l, objects: l.objects!.filter((o) => o.type !== 'corridor') } : l));
    expect(() => layoutFromTiled({ ...SHIP_MAP, layers: withoutCorridor })).toThrow(/pasillos/);
  });
});

describe('mapa de la base en Gale (Tiled)', () => {
  const ext = GALE_LAYOUT.exterior!;

  it('sigue el plano: módulos con forma propia unidos por tubos, y afuera el depósito, la batería y la nave', () => {
    expect(GALE_LAYOUT.zones.map((z) => z.id).sort()).toEqual(
      ['airlock', 'battery', 'command', 'energy', 'exercise', 'greenhouse', 'infirmary', 'moxie', 'pantry', 'radio', 'scrubber', 'shelter', 'ship', 'storage', 'workshop'],
    );
    expect(GALE_LAYOUT.passages.map((p) => p.id).every((id) => id.startsWith('tube-'))).toBe(true);
    expect(GALE_LAYOUT.passages).toHaveLength(6);
    // Cada tubo tiene una puerta en cada punta, y sus dos puntas dan a cuartos distintos.
    for (const tube of GALE_LAYOUT.passages) {
      const ends = new Set(
        tube.doorTiles!.flatMap((d) =>
          [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => zoneAt(GALE_LAYOUT, { x: d.col + dc! + 0.5, y: d.row + dr! + 0.5 })),
        ).filter((z) => z && z !== tube.id && z !== EXTERIOR),
      );
      expect(ends.size, tube.id).toBe(2);
    }
    // El invernadero tiene forma de cúpula: no es un rectángulo lleno.
    expect(zoneById(GALE_LAYOUT, 'greenhouse').mask!.some((m) => !m)).toBe(true);
    // La puerta exterior de dos tiles está pegada a la esclusa; el depósito, la batería y la nave dan al exterior.
    const airlock = zoneById(GALE_LAYOUT, 'airlock');
    expect(ext.doorTiles).toHaveLength(1);
    expect(ext.door.row).toBe(airlock.rect.row + airlock.rect.rows);
    for (const id of ['storage', 'battery', 'ship']) {
      const door = doorPoint(zoneById(GALE_LAYOUT, id));
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => zoneAt(GALE_LAYOUT, { x: door.x + dx!, y: door.y + dy! }));
      expect(around, id).toContain(EXTERIOR);
    }
  });

  it('los cables unen los paneles, la base, la batería y la nave, pasando por dos cajas de empalme', () => {
    const nodes = new Set(GALE_CABLES.flatMap((c) => [c.from, c.to]));
    expect([...nodes].sort()).toEqual(['base', 'battery', 'j1', 'j2', 'ship', 'solar']);
    expect(GALE_LANDMARKS.j1).toBeDefined();
    expect(GALE_LANDMARKS.j2).toBeDefined();
    for (const c of GALE_CABLES) expect(c.points.length, c.id).toBeGreaterThan(1);
  });

  it('todo el exterior transitable se alcanza caminando desde la esclusa', () => {
    const { cols, rows } = GALE_LAYOUT;
    const seen = new Set([ext.door.row * cols + ext.door.col]);
    const queue = [[ext.door.col, ext.door.row]];
    for (let i = 0; i < queue.length; i++) {
      const [col, row] = queue[i]!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [c, r] = [col! + dc!, row! + dr!];
        if (seen.has(r * cols + c) || zoneAt(GALE_LAYOUT, { x: c + 0.5, y: r + 0.5 }) !== EXTERIOR) continue;
        seen.add(r * cols + c);
        queue.push([c, r]);
      }
    }
    let outside = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (zoneAt(GALE_LAYOUT, { x: c + 0.5, y: r + 0.5 }) !== EXTERIOR) continue;
        outside++;
        expect(seen.has(r * cols + c), `${c},${r}`).toBe(true);
      }
    // Hay terreno que no se pisa (cerros, dunas, rocas), pero la mayor parte del exterior se recorre.
    expect(outside).toBeGreaterThan(2000);
    expect(ext.blocked!.filter(Boolean).length).toBeGreaterThan(1000);
  });

  it('las franjas del exterior van de norte a sur como el camino de Curiosity, y Curiosity está en Gediz Vallis', () => {
    expect(GALE_TERRAIN.map((t) => t.id)).toEqual(GALE_STRIPS.map((s) => s.id));
    for (let i = 1; i < GALE_TERRAIN.length; i++) expect(GALE_TERRAIN[i]!.rect.row).toBe(GALE_TERRAIN[i - 1]!.rect.row + GALE_TERRAIN[i - 1]!.rect.rows);
    const curiosity = GALE_LANDMARKS.curiosity!;
    const gediz = GALE_TERRAIN.find((t) => t.id === 'gediz')!.rect;
    expect(curiosity.y).toBeGreaterThanOrEqual(gediz.row);
    expect(curiosity.y).toBeLessThan(gediz.row + gediz.rows);
    // Curiosity es un objeto con colisión: se llega a su lado, no se lo atraviesa.
    expect(zoneAt(GALE_LAYOUT, curiosity)).toBeNull();
    expect(zoneAt(GALE_LAYOUT, { x: curiosity.x, y: curiosity.y + 1.5 })).toBe(EXTERIOR);
  });
});

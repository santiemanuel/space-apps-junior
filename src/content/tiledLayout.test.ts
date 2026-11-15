import { describe, expect, it } from 'vitest';
import { doorPoint, EXTERIOR, exteriorDoorPoint, isWalkable, route, zoneAt, zoneSpot, type ShipLayout } from '../core/habitat/layout';
import type { HabitatTask } from '../core/habitat/types';
import { GALE_LANDMARKS, GALE_LAYOUT, GALE_MAP, GALE_TASKS, GALE_TERRAIN } from './gale';
import { GALE_STRIPS } from './galeTerrain';
import { SHIP_LAYOUT, SHIP_MAP, VOYAGE_TASKS } from './ship';
import { layoutFromTiled, propsFromTiled, wallTilesFromTiled, type TiledMap } from './tiledLayout';

describe.each([
  ['nave', SHIP_MAP, SHIP_LAYOUT, VOYAGE_TASKS],
  ['base en Gale', GALE_MAP, GALE_LAYOUT, GALE_TASKS],
] as [string, TiledMap, ShipLayout, readonly HabitatTask[]][])('mapa de la %s (Tiled)', (_, map, layout, tasks) => {
  const walls = wallTilesFromTiled(map);
  const props = propsFromTiled(map);
  const tile = map.tilewidth;
  const insideProp = (x: number, y: number) =>
    props.some((p) => x * tile > p.x && x * tile < p.x + p.width && y * tile > p.y && y * tile < p.y + p.height);

  it('cada cuarto tiene su puerta de dos tiles al pasillo', () => {
    for (const zone of layout.zones) {
      expect(zone.doorTiles, zone.id).toHaveLength(1);
      expect(zoneAt(layout, doorPoint(zone)), zone.id).toBe(zone.id);
    }
    expect(layout.spawnZone).toBe('command');
  });

  it('lo que no se pisa es pared o queda debajo de un objeto del exterior (rocas, Curiosity, paneles)', () => {
    for (let row = 0; row < layout.rows; row++)
      for (let col = 0; col < layout.cols; col++) {
        const walkable = isWalkable(layout, col, row);
        if (walls[row]![col]) expect(walkable, `${col},${row}`).toBe(false);
        else if (!walkable) expect(!!layout.exterior && insideProp(col + 0.5, row + 0.5), `${col},${row}`).toBe(true);
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

  it('ningún objeto tapa el lugar de trabajo ni el camino desde la puerta', () => {
    for (const zone of layout.zones) {
      const spot = zoneSpot(zone);
      const door = doorPoint(zone);
      for (let i = 0; i <= 20; i++) {
        const x = door.x + ((spot.x - door.x) * i) / 20;
        const y = door.y + ((spot.y - door.y) * i) / 20;
        expect(insideProp(x, y), `${zone.id}: ${x},${y}`).toBe(false);
      }
    }
  });

  it('cada tarea tiene su cuarto y se llega caminando por lugares transitables', () => {
    const from = zoneSpot(layout.zones.find((z) => z.id === 'command')!);
    for (const task of tasks) {
      for (const p of route(layout, from, task.zone)) expect(zoneAt(layout, p), `${task.id}: ${p.x},${p.y}`).not.toBeNull();
    }
  });
});

describe('mapa de la nave (Tiled)', () => {
  it('tiene los ocho cuartos', () => {
    expect(SHIP_LAYOUT.zones.map((z) => z.id).sort()).toEqual(['command', 'exercise', 'infirmary', 'pantry', 'radio', 'recycler', 'scrubber', 'shelter']);
  });

  it('avisa si al mapa le falta una capa o una puerta', () => {
    expect(() => layoutFromTiled({ ...SHIP_MAP, layers: SHIP_MAP.layers.filter((l) => l.name !== 'zonas') })).toThrow(/zonas/);
    const withoutDoors = SHIP_MAP.layers.map((l) => (l.name === 'zonas' ? { ...l, objects: l.objects!.filter((o) => o.type !== 'door') } : l));
    expect(() => layoutFromTiled({ ...SHIP_MAP, layers: withoutDoors })).toThrow(/puerta/);
  });
});

describe('mapa de la base en Gale (Tiled)', () => {
  const ext = GALE_LAYOUT.exterior!;

  it('tiene los ocho cuartos y la esclusa, con la puerta exterior de dos tiles debajo de la de adentro', () => {
    expect(GALE_LAYOUT.zones.map((z) => z.id).sort()).toEqual(['airlock', 'command', 'exercise', 'greenhouse', 'infirmary', 'moxie', 'radio', 'scrubber', 'shelter']);
    const airlock = GALE_LAYOUT.zones.find((z) => z.id === 'airlock')!;
    expect(ext.doorTiles).toHaveLength(1);
    expect(exteriorDoorPoint(ext).x).toBe(doorPoint(airlock).x);
    expect(ext.door.row).toBe(airlock.rect.row + airlock.rect.rows);
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

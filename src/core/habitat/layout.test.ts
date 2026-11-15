import { describe, expect, it } from 'vitest';
import { CORRIDOR, EXTERIOR, exteriorDoorPoint, exteriorPath, pathLength, pointAlong, route, routeToPoint, zoneAt, type Point, type ShipLayout } from './layout';

/**
 * Plano de prueba de 12 × 10: un cuarto (la esclusa) con su puerta al pasillo, la puerta exterior de 2 tiles abajo
 * y un exterior que rodea la base, con un muro de terreno de por medio que obliga a dar la vuelta.
 */
const COLS = 12;
const ROWS = 10;
const blocked = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const base = col >= 1 && col <= 6 && row >= 1 && row <= 5;
  const ridge = row === 7 && col >= 1 && col <= 9;
  return base || ridge;
});
const LAYOUT: ShipLayout = {
  cols: COLS,
  rows: ROWS,
  passages: [{ id: 'corridor', rect: { col: 2, row: 2, cols: 4, rows: 1 } }],
  zones: [{ id: 'airlock', rect: { col: 3, row: 4, cols: 2, rows: 1 }, door: { col: 3, row: 3 }, doorTiles: [{ col: 4, row: 3 }] }],
  exterior: { rect: { col: 0, row: 0, cols: COLS, rows: ROWS }, airlock: 'airlock', door: { col: 3, row: 5 }, doorTiles: [{ col: 4, row: 5 }], blocked },
  spawnZone: 'airlock',
};

const walkable = (path: Point[]) => {
  for (let d = 0; d <= pathLength(path); d += 0.05) if (zoneAt(LAYOUT, pointAlong(path, d)) === null) return pointAlong(path, d);
  return true;
};

describe('exterior con terreno que no se pisa', () => {
  it('el pasillo va antes que el exterior y la máscara deja afuera la base y el muro', () => {
    expect(zoneAt(LAYOUT, { x: 2.5, y: 2.5 })).toBe(CORRIDOR);
    expect(zoneAt(LAYOUT, { x: 1.5, y: 1.5 })).toBeNull();
    expect(zoneAt(LAYOUT, { x: 5.5, y: 7.5 })).toBeNull();
    expect(zoneAt(LAYOUT, { x: 0.5, y: 7.5 })).toBe(EXTERIOR);
    expect(zoneAt(LAYOUT, { x: 4.5, y: 5.5 })).toBe(EXTERIOR);
    expect(exteriorDoorPoint(LAYOUT.exterior!)).toEqual({ x: 4, y: 5.5 });
  });

  it('el camino por el exterior rodea el muro y no pisa terreno bloqueado', () => {
    const path = exteriorPath(LAYOUT, { x: 4, y: 6.5 }, { x: 4.5, y: 8.5 });
    expect(path.length).toBeGreaterThan(2);
    expect(walkable(path)).toBe(true);
    expect(path.at(-1)).toEqual({ x: 4.5, y: 8.5 });
  });

  it('en línea recta cuando nada lo tapa', () => {
    expect(exteriorPath(LAYOUT, { x: 8.5, y: 1.5 }, { x: 10.5, y: 5.5 })).toEqual([{ x: 8.5, y: 1.5 }, { x: 10.5, y: 5.5 }]);
  });

  it('se sale por la esclusa hasta un punto detrás del muro y se vuelve', () => {
    const target = { x: 2.5, y: 8.5 };
    const out = routeToPoint(LAYOUT, { x: 3.5, y: 2.5 }, target);
    expect(walkable(out)).toBe(true);
    expect(Array.from({ length: 200 }, (_, i) => zoneAt(LAYOUT, pointAlong(out, (pathLength(out) * i) / 199))).includes('airlock')).toBe(true);
    expect(walkable(route(LAYOUT, target, 'airlock'))).toBe(true);
  });

  it('un pasillo cerrado no se pisa: sin otro camino no se llega', () => {
    const from = { x: 2.5, y: 2.5 };
    expect(route(LAYOUT, { x: 3.5, y: 4.5 }, 'airlock')).toHaveLength(2);
    expect(routeToPoint(LAYOUT, { x: 3.5, y: 4.5 }, from, false, new Set(['corridor']))).toEqual([{ x: 3.5, y: 4.5 }]);
    expect(walkable(routeToPoint(LAYOUT, { x: 3.5, y: 4.5 }, from))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { doorPoint, isWalkable, route, zoneAt, zoneSpot } from '../core/habitat/layout';
import { SHIP_LAYOUT, SHIP_MAP, VOYAGE_TASKS } from './ship';
import { layoutFromTiled, propsFromTiled, wallTilesFromTiled } from './tiledLayout';

describe('mapa de la nave (Tiled)', () => {
  const walls = wallTilesFromTiled(SHIP_MAP);
  const props = propsFromTiled(SHIP_MAP);
  const tile = SHIP_MAP.tilewidth;
  const insideProp = (x: number, y: number) =>
    props.some((p) => x * tile > p.x && x * tile < p.x + p.width && y * tile > p.y && y * tile < p.y + p.height);

  it('tiene los ocho cuartos, cada uno con su puerta de dos tiles al pasillo', () => {
    expect(SHIP_LAYOUT.zones.map((z) => z.id).sort()).toEqual(['command', 'exercise', 'infirmary', 'pantry', 'radio', 'recycler', 'scrubber', 'shelter']);
    for (const zone of SHIP_LAYOUT.zones) {
      expect(zone.doorTiles, zone.id).toHaveLength(1);
      expect(zoneAt(SHIP_LAYOUT, doorPoint(zone)), zone.id).toBe(zone.id);
    }
    expect(SHIP_LAYOUT.spawnZone).toBe('command');
  });

  it('las paredes del mapa son exactamente lo que las reglas consideran pared', () => {
    for (let row = 0; row < SHIP_LAYOUT.rows; row++)
      for (let col = 0; col < SHIP_LAYOUT.cols; col++) expect(walls[row]![col], `${col},${row}`).toBe(!isWalkable(SHIP_LAYOUT, col, row));
  });

  it('los objetos quedan dentro de un cuarto o del pasillo', () => {
    for (const p of props) {
      for (const [x, y] of [[p.x, p.y], [p.x + p.width, p.y + p.height]] as const)
        expect(zoneAt(SHIP_LAYOUT, { x: x / tile, y: (y - 0.01) / tile }), `${p.key} en ${p.x},${p.y}`).not.toBeNull();
    }
  });

  it('ningún objeto tapa el lugar de trabajo ni el camino desde la puerta', () => {
    for (const zone of SHIP_LAYOUT.zones) {
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
    const from = zoneSpot(SHIP_LAYOUT.zones.find((z) => z.id === 'command')!);
    for (const task of VOYAGE_TASKS) {
      for (const p of route(SHIP_LAYOUT, from, task.zone)) expect(zoneAt(SHIP_LAYOUT, p), `${task.id}: ${p.x},${p.y}`).not.toBeNull();
    }
  });

  it('avisa si al mapa le falta una capa o una puerta', () => {
    expect(() => layoutFromTiled({ ...SHIP_MAP, layers: SHIP_MAP.layers.filter((l) => l.name !== 'zonas') })).toThrow(/zonas/);
    const withoutDoors = SHIP_MAP.layers.map((l) => (l.name === 'zonas' ? { ...l, objects: l.objects!.filter((o) => o.type !== 'door') } : l));
    expect(() => layoutFromTiled({ ...SHIP_MAP, layers: withoutDoors })).toThrow(/puerta/);
  });
});

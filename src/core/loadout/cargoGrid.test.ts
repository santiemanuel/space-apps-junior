import { describe, expect, it } from 'vitest';
import { CARGO_GRID, RETURN_RULES } from '../../content/loadouts';
import { makeGameState } from '../../test-utils/factories';
import type { Sample } from '../state/types';
import { availableForReturn, supplyLight } from './loadout';
import { applyGridCargo, autoPack, cargoItems, cargoTotals, findSpot, footprint, gridReturnResult, itemAt, placeError, placeItem, removeItem, totalsAsCargo } from './cargoGrid';

const rock = (id: string, massKg: number, value: number): Sample => ({ id, siteId: id, massKg, value, rock: 'basalt' });
const SAMPLES: Sample[] = [rock('a', 5, 40), rock('b', 9, 30), rock('c', 13, 70), rock('d', 6, 20), { id: 'p', siteId: 'p', massKg: 1, value: 8, rock: 'plant' }];

function base(samples: Sample[] = SAMPLES) {
  const state = makeGameState({ phase: 'marsAscent', waterShield: 1 });
  state.inventory = { ...state.inventory, foodKg: 2000, spares: 5, samples };
  state.meters.lifeSupport.waterL = 400;
  const items = cargoItems(state, RETURN_RULES, CARGO_GRID);
  const pool = availableForReturn(state, RETURN_RULES).waterPoolL;
  return { state, items, pool };
}
const put = (items: ReturnType<typeof base>['items'], placements: Parameters<typeof placeItem>[1], itemId: string, col: number, row: number, rotated = false, pool = 800) =>
  placeItem(items, placements, { itemId, col, row, rotated }, CARGO_GRID, RETURN_RULES, pool);

describe('bodega de la vuelta (casilleros)', () => {
  it('arma las piezas: suministros en cajas y cada muestra con su tamaño', () => {
    const { items } = base();
    const count = (kind: string) => items.filter((i) => i.kind === kind).length;
    expect(count('food')).toBe(5);
    expect(count('water')).toBe(5);
    expect(count('shield')).toBe(4);
    expect(count('spare')).toBe(4);
    const size = (id: string) => {
      const item = items.find((i) => i.id === `sample-${id}`)!;
      return `${item.w}x${item.h}`;
    };
    expect([size('a'), size('b'), size('c'), size('p')]).toEqual(['1x1', '1x2', '2x2', '1x1']);
    expect(items.find((i) => i.id === 'sample-p')!.kind).toBe('plant');
  });

  it('una pieza no entra fuera de la bodega ni encima de otra', () => {
    const { items, pool } = base();
    let placements = put(items, [], 'food-1', 0, 0, false, pool);
    expect(placements).toHaveLength(1);
    expect(itemAt(items, placements, 1, 1)?.itemId).toBe('food-1');
    expect(itemAt(items, placements, 2, 0)).toBeNull();
    const error = (itemId: string, col: number, row: number, rotated = false) => placeError(items, placements, { itemId, col, row, rotated }, CARGO_GRID, RETURN_RULES, pool);
    expect(error('food-2', 1, 1)).toBe('overlap');
    expect(error('food-2', 7, 0)).toBe('outside');
    expect(error('food-2', 2, 0)).toBeNull();
    // Mover la misma pieza no choca consigo misma.
    placements = put(items, placements, 'food-1', 1, 1, false, pool);
    expect(placements).toEqual([{ itemId: 'food-1', col: 1, row: 1, rotated: false }]);
    expect(removeItem(placements, 'food-1')).toEqual([]);
  });

  it('girar una pieza intercambia su ancho y su alto', () => {
    const { items, pool } = base();
    const shield = items.find((i) => i.id === 'shield-1')!;
    expect(footprint(shield, false)).toEqual({ w: 1, h: 3 });
    expect(footprint(shield, true)).toEqual({ w: 3, h: 1 });
    expect(placeError(items, [], { itemId: 'shield-1', col: 6, row: 5, rotated: false }, CARGO_GRID, RETURN_RULES, pool)).toBe('outside');
    expect(placeError(items, [], { itemId: 'shield-1', col: 5, row: 5, rotated: true }, CARGO_GRID, RETURN_RULES, pool)).toBeNull();
  });

  it('el agua de beber y la del escudo salen del mismo tanque de la base', () => {
    const { items } = base();
    // Con 100 L en la base entra una bolsa del escudo (100 L) y después no queda agua para un tanque.
    const placements = put(items, [], 'shield-1', 0, 0, false, 100);
    expect(placements).toHaveLength(1);
    expect(placeError(items, placements, { itemId: 'water-1', col: 2, row: 0, rotated: false }, CARGO_GRID, RETURN_RULES, 100)).toBe('water');
  });

  it('acomodar solo: entra todo lo recomendado y, en lo que sobra, las muestras que más valen por casillero', () => {
    const { items, pool } = base();
    const placements = autoPack(items, CARGO_GRID, RETURN_RULES, pool);
    const totals = cargoTotals(items, placements);
    for (const field of ['foodKg', 'waterL', 'shield', 'spares'] as const) expect(supplyLight(totalsAsCargo(totals), field, RETURN_RULES), field).toBe('green');
    expect(totals.cells).toBeLessThanOrEqual(CARGO_GRID.cols * CARGO_GRID.rows);
    const ids = totals.samples.map((s) => s.id);
    expect(ids).toContain('a');
    expect(ids).toContain('p');
    // No entran todas: la roca grande queda afuera.
    expect(ids).not.toContain('c');
    // Nada se pisa.
    for (const p of placements) expect(placeError(items, placements, p, CARGO_GRID, RETURN_RULES, pool)).toBeNull();
  });

  it('con la bodega llena no hay lugar para una pieza más', () => {
    const { items, pool } = base();
    const placements = autoPack(items, CARGO_GRID, RETURN_RULES, pool);
    expect(findSpot(items, placements, 'sample-c', CARGO_GRID, RETURN_RULES, pool)).toBeNull();
  });

  it('sube a la nave sólo lo que está en la bodega', () => {
    const { state, items, pool } = base();
    let placements = put(items, [], 'food-1', 0, 0, false, pool);
    placements = put(items, placements, 'water-1', 2, 0, false, pool);
    placements = put(items, placements, 'shield-1', 3, 0, false, pool);
    placements = put(items, placements, 'spare-1', 4, 0, false, pool);
    placements = put(items, placements, 'sample-c', 6, 0, false, pool);
    const next = applyGridCargo(state, items, placements);
    expect(next.inventory.samples.map((s) => s.id)).toEqual(['c']);
    expect(next.inventory.foodKg).toBe(RETURN_RULES.recommended.foodKg / 4);
    expect(next.meters.lifeSupport.waterL).toBe(50);
    expect(next.waterShield).toBe(0.25);
    expect(next.inventory.spares).toBe(1);
    expect(next.history.at(-1)).toMatchObject({ kind: 'loadout', key: 'return', data: { samples: 1 } });
    expect(state.inventory.samples).toHaveLength(SAMPLES.length);
    expect(gridReturnResult(state, items, placements)).toMatchObject({ phase: 'marsAscent', outcome: 'completed' });
  });
});

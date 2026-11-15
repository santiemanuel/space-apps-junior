import type { PhaseResult } from '../flow/types';
import type { GameState, Sample } from '../state/types';
import { availableForReturn, type ReturnCargo, type ReturnRules } from './loadout';

/**
 * Carga de vuelta como un maletín de casilleros (al estilo Resident Evil 4): la bodega de la nave es una grilla y
 * cada cosa ocupa más o menos lugar según su tamaño. Hay que acomodar las piezas (se pueden girar) y no entra todo:
 * llevar más muestras obliga a dejar comida, agua, escudo o repuestos (game-design §4.5). Puro y sin Phaser.
 */
export type CargoKind = 'rock' | 'plant' | 'food' | 'water' | 'shield' | 'spare';

export interface CargoItem {
  id: string;
  kind: CargoKind;
  /** Tamaño en casilleros, sin girar. */
  w: number;
  h: number;
  /** Lo que aporta la pieza. */
  sample?: Sample;
  foodKg?: number;
  waterL?: number;
  shield?: number;
  spares?: number;
}

export interface Placement {
  itemId: string;
  col: number;
  row: number;
  /** Girada 90°: ancho y alto intercambiados. */
  rotated: boolean;
}

export interface CargoGridRules {
  cols: number;
  rows: number;
  /** En cuántas piezas se parte lo recomendado de cada suministro. */
  pieces: { food: number; water: number; shield: number };
  /** Piezas de comida, agua y repuestos que se ofrecen además de lo recomendado (si hay en la base). */
  extra: number;
  size: Record<Exclude<CargoKind, 'rock'>, { w: number; h: number }>;
  /** Tamaño de una roca según su masa: la primera fila cuyo `maxKg` alcanza. */
  rockSizes: readonly { maxKg: number; w: number; h: number }[];
}

export type PlaceError = 'outside' | 'overlap' | 'water';

const isPlant = (sample: Sample) => sample.rock === 'plant';

/** Piezas que hay en la base para cargar: suministros en cajas y tanques, y cada muestra con su tamaño. */
export function cargoItems(state: GameState, rules: ReturnRules, grid: CargoGridRules): CargoItem[] {
  const available = availableForReturn(state, rules);
  const { recommended } = rules;
  const items: CargoItem[] = [];
  const push = (kind: Exclude<CargoKind, 'rock'>, index: number, payload: Partial<CargoItem>) =>
    items.push({ id: `${kind}-${index + 1}`, kind, ...grid.size[kind], ...payload });

  const crateKg = recommended.foodKg / grid.pieces.food;
  const crates = Math.min(grid.pieces.food + grid.extra, Math.floor(available.foodKg / crateKg + 1e-9));
  for (let i = 0; i < crates; i++) push('food', i, { foodKg: crateKg });
  if (crates === 0 && available.foodKg > 0) push('food', 0, { foodKg: available.foodKg });

  const tankL = recommended.waterL / grid.pieces.water;
  for (let i = 0; i < Math.min(grid.pieces.water + grid.extra, Math.floor(available.waterPoolL / tankL + 1e-9)); i++) push('water', i, { waterL: tankL });

  const shieldPart = recommended.shield / grid.pieces.shield;
  for (let i = 0; i < Math.min(grid.pieces.shield, Math.floor(available.waterPoolL / (shieldPart * rules.shieldFullL) + 1e-9)); i++) push('shield', i, { shield: shieldPart });

  for (let i = 0; i < Math.min(available.spares, recommended.spares + grid.extra); i++) push('spare', i, { spares: 1 });

  for (const sample of available.samples) {
    if (isPlant(sample)) items.push({ id: `sample-${sample.id}`, kind: 'plant', ...grid.size.plant, sample });
    else {
      const size = grid.rockSizes.find((s) => sample.massKg <= s.maxKg) ?? grid.rockSizes.at(-1)!;
      items.push({ id: `sample-${sample.id}`, kind: 'rock', w: size.w, h: size.h, sample });
    }
  }
  return items;
}

/** Ancho y alto de una pieza según esté girada o no. */
export function footprint(item: CargoItem, rotated: boolean): { w: number; h: number } {
  return rotated ? { w: item.h, h: item.w } : { w: item.w, h: item.h };
}

const byId = (items: readonly CargoItem[], id: string) => items.find((i) => i.id === id);

/** Pieza que ocupa un casillero (o null). */
export function itemAt(items: readonly CargoItem[], placements: readonly Placement[], col: number, row: number): Placement | null {
  for (const p of placements) {
    const item = byId(items, p.itemId);
    if (!item) continue;
    const { w, h } = footprint(item, p.rotated);
    if (col >= p.col && col < p.col + w && row >= p.row && row < p.row + h) return p;
  }
  return null;
}

/** Litros de agua (bebida y escudo) de lo que ya está en la bodega. */
export function waterLoadedL(items: readonly CargoItem[], placements: readonly Placement[], rules: ReturnRules): number {
  return placements.reduce((sum, p) => {
    const item = byId(items, p.itemId);
    return sum + (item?.waterL ?? 0) + (item?.shield ?? 0) * rules.shieldFullL;
  }, 0);
}

/**
 * ¿Se puede poner la pieza ahí? Tiene que entrar en la bodega, no pisar otra pieza y, si lleva agua, que quede agua
 * en la base (la de beber y la del escudo salen del mismo tanque). Devuelve null si se puede, o el motivo.
 */
export function placeError(
  items: readonly CargoItem[],
  placements: readonly Placement[],
  placement: Placement,
  grid: CargoGridRules,
  rules: ReturnRules,
  waterPoolL: number,
): PlaceError | null {
  const item = byId(items, placement.itemId);
  if (!item) return 'outside';
  const { w, h } = footprint(item, placement.rotated);
  if (placement.col < 0 || placement.row < 0 || placement.col + w > grid.cols || placement.row + h > grid.rows) return 'outside';
  const others = placements.filter((p) => p.itemId !== item.id);
  for (let c = placement.col; c < placement.col + w; c++) for (let r = placement.row; r < placement.row + h; r++) if (itemAt(items, others, c, r)) return 'overlap';
  const water = (item.waterL ?? 0) + (item.shield ?? 0) * rules.shieldFullL;
  if (water > 0 && waterLoadedL(items, others, rules) + water > waterPoolL + 1e-9) return 'water';
  return null;
}

/** Pone (o mueve) una pieza; si no se puede, devuelve las mismas ubicaciones. */
export function placeItem(
  items: readonly CargoItem[],
  placements: readonly Placement[],
  placement: Placement,
  grid: CargoGridRules,
  rules: ReturnRules,
  waterPoolL: number,
): Placement[] {
  if (placeError(items, placements, placement, grid, rules, waterPoolL)) return [...placements];
  return [...placements.filter((p) => p.itemId !== placement.itemId), placement];
}

export const removeItem = (placements: readonly Placement[], itemId: string): Placement[] => placements.filter((p) => p.itemId !== itemId);

export interface CargoTotals {
  foodKg: number;
  waterL: number;
  shield: number;
  spares: number;
  samples: Sample[];
  /** Valor científico de las muestras cargadas. */
  value: number;
  /** Casilleros ocupados. */
  cells: number;
}

/** Lo que suma todo lo que está en la bodega. */
export function cargoTotals(items: readonly CargoItem[], placements: readonly Placement[]): CargoTotals {
  const totals: CargoTotals = { foodKg: 0, waterL: 0, shield: 0, spares: 0, samples: [], value: 0, cells: 0 };
  for (const p of placements) {
    const item = byId(items, p.itemId);
    if (!item) continue;
    totals.foodKg += item.foodKg ?? 0;
    totals.waterL += item.waterL ?? 0;
    totals.shield = Math.round((totals.shield + (item.shield ?? 0)) * 1000) / 1000;
    totals.spares += item.spares ?? 0;
    totals.cells += item.w * item.h;
    if (item.sample) {
      totals.samples.push(item.sample);
      totals.value += item.sample.value;
    }
  }
  return totals;
}

/** Los totales como `ReturnCargo`, para el semáforo de cada suministro (`supplyLight`). */
export const totalsAsCargo = (totals: CargoTotals): ReturnCargo => ({
  samples: totals.samples.length,
  foodKg: totals.foodKg,
  waterL: totals.waterL,
  shield: totals.shield,
  spares: totals.spares,
});

/** Primer lugar libre para una pieza, recorriendo la bodega por filas y probando también girada. */
export function findSpot(
  items: readonly CargoItem[],
  placements: readonly Placement[],
  itemId: string,
  grid: CargoGridRules,
  rules: ReturnRules,
  waterPoolL: number,
): Placement | null {
  for (const rotated of [false, true])
    for (let row = 0; row < grid.rows; row++)
      for (let col = 0; col < grid.cols; col++) {
        const placement = { itemId, col, row, rotated };
        if (!placeError(items, placements, placement, grid, rules, waterPoolL)) return placement;
      }
  return null;
}

const SUPPLY_ORDER: readonly CargoKind[] = ['shield', 'food', 'water', 'spare'];

/**
 * "Acomodar solo": primero lo recomendado para volver tranquilos (escudo, comida, agua y repuestos) y, en el lugar
 * que sobra, las muestras que más valen por casillero.
 */
export function autoPack(items: readonly CargoItem[], grid: CargoGridRules, rules: ReturnRules, waterPoolL: number): Placement[] {
  const { recommended } = rules;
  const wanted: Record<string, number> = { shield: recommended.shield, food: recommended.foodKg, water: recommended.waterL, spare: recommended.spares };
  const amount = (item: CargoItem) => item.shield ?? item.foodKg ?? item.waterL ?? item.spares ?? 0;
  let placements: Placement[] = [];
  const add = (item: CargoItem) => {
    const spot = findSpot(items, placements, item.id, grid, rules, waterPoolL);
    if (spot) placements = [...placements, spot];
    return !!spot;
  };
  for (const kind of SUPPLY_ORDER) {
    let loaded = 0;
    for (const item of items.filter((i) => i.kind === kind)) {
      if (loaded >= wanted[kind]! - 1e-9) break;
      if (add(item)) loaded += amount(item);
    }
  }
  const samples = items
    .filter((i) => i.sample)
    .sort((a, b) => b.sample!.value / (b.w * b.h) - a.sample!.value / (a.w * a.h) || a.id.localeCompare(b.id));
  for (const item of samples) add(item);
  return placements;
}

/** Sube a la nave lo que está en la bodega: lo que quedó afuera se queda en Marte. */
export function applyGridCargo(state: GameState, items: readonly CargoItem[], placements: readonly Placement[]): GameState {
  const totals = cargoTotals(items, placements);
  const next = structuredClone(state);
  next.inventory.samples = structuredClone(totals.samples);
  next.inventory.foodKg = totals.foodKg;
  next.inventory.spares = totals.spares;
  next.meters.lifeSupport.waterL = totals.waterL;
  next.waterShield = totals.shield;
  next.history.push({
    simDate: next.simDate,
    phase: next.phase,
    kind: 'loadout',
    key: 'return',
    data: { samples: totals.samples.length, massKg: Math.round(totals.samples.reduce((sum, s) => sum + s.massKg, 0)), shield: totals.shield },
  });
  return next;
}

export function gridReturnResult(state: GameState, items: readonly CargoItem[], placements: readonly Placement[]): PhaseResult {
  return { phase: 'marsAscent', outcome: 'completed', state: applyGridCargo(state, items, placements), achievements: [] };
}

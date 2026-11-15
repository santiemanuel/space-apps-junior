import { describe, expect, it } from 'vitest';
import { BikeGame, MoxieGame, PulseGame, RadioGame, ScrubberGame } from './arcade';
import { createMinigame, MINIGAME_IDS } from './catalog';
import { NO_KEYS, NO_INPUT, type GridCursor, type Minigame, type MinigameInput, type MinigameKeys, type MinigameSetup } from './Minigame';
import { FUSE_TYPES, FusesGame, WiresGame } from './power';
import { PatchGame, rotateSides, StarsGame, WaterGame } from './puzzles';
import { DISH_IDS, MEAL_DISHES, MEAL_INGREDIENTS, MealGame, PLANT_TOOLS, PlantsGame, SealsGame, ShieldGame } from './rooms';

const DT = 1 / 30;
const input = (held: Partial<MinigameKeys> = {}, pressed: Partial<MinigameInput['pressed']> = {}): MinigameInput => ({
  held: { ...NO_KEYS, ...held },
  pressed: { ...NO_KEYS, choice: null, ...pressed },
});

/** Juega con una estrategia hasta terminar (o hasta `maxS` segundos); devuelve los segundos que tardó. */
function play<G extends Minigame>(game: G, policy: (g: G, frame: number) => MinigameInput, maxS = 120): number {
  let frame = 0;
  while (!game.done && game.elapsed < maxS) game.update(DT, policy(game, frame++));
  return game.elapsed;
}

/** Un paso hacia una celda de la grilla (en cuadros alternos, como un dedo que aprieta y suelta). */
function toward(cursor: GridCursor, col: number, row: number, frame: number): MinigameInput | null {
  if (cursor.col === col && cursor.row === row) return null;
  if (frame % 2) return NO_INPUT;
  const dir = cursor.col < col ? 'right' : cursor.col > col ? 'left' : cursor.row < row ? 'down' : 'up';
  return input({}, { [dir]: true });
}

/** Busca giros que lleven el agua del tanque sucio al limpio (búsqueda en profundidad). */
function solveWater(game: WaterGame): Map<number, number> | null {
  const sides = [1, 2, 4, 8] as const;
  const step: Record<number, [number, number, number]> = { 1: [0, -1, 4], 2: [1, 0, 8], 4: [0, 1, 1], 8: [-1, 0, 2] };
  const base = (i: number) => rotateSides(game.sides(i), -game.cells[i]!.rot);
  const search = (col: number, row: number, from: number, used: Map<number, number>): Map<number, number> | null => {
    if (col === game.cols && row === game.exitRow) return used;
    if (col < 0 || col >= game.cols || row < 0 || row >= game.rows) return null;
    const i = row * game.cols + col;
    if (used.has(i)) return null;
    for (let rot = 0; rot < 4; rot++) {
      const mask = rotateSides(base(i), rot);
      if (!(mask & from)) continue;
      const out = sides.find((s) => s !== from && mask & s)!;
      const [dx, dy, back] = step[out]!;
      const found = search(col + dx, row + dy, back, new Map(used).set(i, rot));
      if (found) return found;
    }
    return null;
  };
  return search(0, game.entryRow, 8, new Map());
}

const POLICIES: { [K in string]: (setup: MinigameSetup) => [Minigame, (g: never, frame: number) => MinigameInput] } = {
  bike: (s) => [
    new BikeGame(s),
    // Pedalea más rápido si va lento, como un chico que busca el ritmo.
    (g: BikeGame, f: number) => (f % 4 === 0 && g.speed < (g.band.min + g.band.max) / 2 ? input({}, g.last === 'left' ? { right: true } : { left: true }) : NO_INPUT),
  ],
  scrubber: (s) => [
    new ScrubberGame(s),
    (g: ScrubberGame) => {
      const next = g.molecules.filter((m) => m.kind === 'co2' && m.caughtS === null && m.y < ScrubberGame.FILTER_Y).sort((a, b) => b.y - a.y)[0];
      const avoid = g.molecules.find((m) => m.kind === 'o2' && m.caughtS === null && m.y < ScrubberGame.FILTER_Y && m.y > 0.7 && Math.abs(m.x - g.filterX) < 0.15);
      const target = avoid ? (avoid.x > g.filterX ? g.filterX - 0.3 : g.filterX + 0.3) : (next?.x ?? 0.5);
      return input({ left: target < g.filterX - 0.02, right: target > g.filterX + 0.02 });
    },
  ],
  radio: (s) => [new RadioGame(s), (g: RadioGame) => input({ left: g.dial > g.target + 0.01, right: g.dial < g.target - 0.01 })],
  moxie: (s) => [new MoxieGame(s), (g: MoxieGame) => input({ action: g.tempC < (g.band.min + g.band.max) / 2 })],
  pulse: (s) => [
    new PulseGame(s),
    (g: PulseGame) => {
      const next = g.beats.find((b) => b.result === null);
      return input({}, { action: !!next && Math.abs(next.t - g.elapsed) < DT / 2 + 1e-9 });
    },
  ],
  stars: (s) => [
    new StarsGame(s),
    (g: StarsGame) => (Math.abs(g.offset) < g.tolerance / 2 ? input({}, { action: true }) : input({ left: g.offset > 0, right: g.offset < 0 })),
  ],
  water: (s) => {
    const game = new WaterGame(s);
    const plan = solveWater(game)!;
    return [
      game,
      (g: WaterGame, f: number) => {
        const todo = [...plan].find(([i, rot]) => (g.cells[i]!.rot - rot) % (g.cells[i]!.shape === 'straight' ? 2 : 4) !== 0);
        if (!todo) return NO_INPUT;
        const [i] = todo;
        return toward(g.cursor, i % g.cols, Math.floor(i / g.cols), f) ?? input({}, { action: f % 2 === 0 });
      },
    ];
  },
  meal: (s) => [
    new MealGame(s),
    (g: MealGame, f: number) => {
      const i = g.shelf.indexOf(g.recipe[g.placed]!);
      return toward(g.cursor, i % g.cols, Math.floor(i / g.cols), f) ?? input({}, { action: f % 2 === 0 });
    },
  ],
  shield: (s) => [
    new ShieldGame(s),
    (g: ShieldGame, f: number) => {
      const i = [...g.gaps].find(([, filled]) => !filled)![0];
      return toward(g.cursor, i % g.cols, Math.floor(i / g.cols), f) ?? input({}, { action: f % 2 === 0 });
    },
  ],
  plants: (s) => [
    new PlantsGame(s),
    (g: PlantsGame, f: number) => {
      const i = g.plants.findIndex((p) => p.need);
      const choice = (PLANT_TOOLS.findIndex((t) => t.need === g.plants[i]!.need) + 1) as 1 | 2 | 3;
      return toward(g.cursor, i % g.cols, Math.floor(i / g.cols), f) ?? input({}, f % 2 ? {} : { choice });
    },
  ],
  seals: (s) => [
    new SealsGame(s),
    (g: SealsGame) => {
      const dirty = g.dust.findIndex((d) => d > 0);
      if (g.segment === dirty) return input({ action: true });
      const ahead = (dirty - g.brush + g.segments) % g.segments;
      return input({ right: ahead <= g.segments / 2, left: ahead > g.segments / 2 });
    },
  ],
  patch: (s) => [
    new PatchGame(s),
    (g: PatchGame, f: number) => {
      const hole = g.holes.find((h) => !h.patched)!;
      return toward(g.cursor, hole.col, hole.row, f) ?? input({}, { action: f % 2 === 0 });
    },
  ],
  fuses: (s) => [
    new FusesGame(s),
    (g: FusesGame, f: number) => {
      const i = g.slots.findIndex((x) => x.burnt);
      const choice = (g.slots[i]!.type + 1) as 1 | 2 | 3;
      return toward(g.cursor, i % g.cols, Math.floor(i / g.cols), f) ?? input({}, f % 2 ? {} : { choice });
    },
  ],
  wires: (s) => [
    new WiresGame(s),
    (g: WiresGame, f: number) => {
      const row = g.right.findIndex((c, i) => c === g.left[g.current] && !g.joined.includes(i));
      return toward(g.cursor, 0, row, f) ?? input({}, { action: f % 2 === 0 });
    },
  ],
};

describe('minijuegos de las salas', () => {
  it('hay una estrategia de prueba para cada minijuego del catálogo', () => {
    expect(Object.keys(POLICIES).sort()).toEqual([...MINIGAME_IDS].sort());
  });

  for (const id of MINIGAME_IDS) {
    it(`${id}: se puede terminar sin errores, en fácil, normal y difícil, con 20 semillas`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        for (const level of [{ easy: true }, {}, { hard: true }, { pests: true }]) {
          const [game, policy] = POLICIES[id]!({ seed, ...level });
          const seconds = play(game, policy as never);
          expect(game.done, `${id} semilla ${seed}`).toBe(true);
          expect(seconds).toBeLessThan(60);
          expect(game.mistakes).toBe(0);
          expect(game.stars()).toBe(3);
        }
      }
    });
  }

  it('la misma semilla arma el mismo tablero', () => {
    for (const id of MINIGAME_IDS) {
      const a = createMinigame(id, { seed: 7 });
      const b = createMinigame(id, { seed: 7 });
      for (let i = 0; i < 60; i++) [a, b].forEach((g) => g.update(DT, NO_INPUT));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('el reciclador nunca arranca resuelto y siempre tiene solución', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const game = new WaterGame({ seed, hard: seed % 2 === 0 });
      expect(game.flow.solved).toBe(false);
      expect(solveWater(game)).not.toBeNull();
    }
  });

  it('los errores bajan las estrellas pero nunca hacen perder', () => {
    const game = new ScrubberGame({ seed: 3 });
    // Atrapar oxígeno es un error: el filtro va siempre debajo del oxígeno más bajo.
    play(game, (g) => {
      const o2 = g.molecules.filter((m) => m.kind === 'o2' && m.caughtS === null).sort((a, b) => b.y - a.y)[0];
      const co2 = g.molecules.filter((m) => m.kind === 'co2' && m.caughtS === null).sort((a, b) => b.y - a.y)[0];
      const target = g.mistakes < 6 ? (o2?.x ?? 0.5) : (co2?.x ?? 0.5);
      return input({ left: target < g.filterX - 0.02, right: target > g.filterX + 0.02 });
    });
    expect(game.mistakes).toBeGreaterThanOrEqual(5);
    expect(game.done).toBe(true);
    expect(game.stars()).toBe(1);
  });

  it('en la cocina, un ingrediente fuera de orden vuelve a su lugar y explica por qué', () => {
    const game = new MealGame({ seed: 1, meal: { dish: 'pasta', stage: 'cook' } });
    const pick = (id: string) => {
      const i = game.shelf.indexOf(id as never);
      game.cursor.col = i % game.cols;
      game.cursor.row = Math.floor(i / game.cols);
      game.update(DT, input({}, { action: true }));
    };
    expect(game.recipeShown).toBe(false);
    pick('cheese');
    expect(game.message).toMatchObject({ key: 'notYet', good: false });
    pick('rice');
    expect(game.message).toMatchObject({ key: 'notInRecipe', good: false });
    expect(game.mistakes).toBe(2);
    // Los fideos van primero; después el tomate dos veces (se puede repetir) y el queso.
    for (const id of ['noodles', 'tomato', 'tomato', 'cheese']) pick(id);
    expect(game.done).toBe(true);
    expect(game.placed).toBe(4);
  });

  it('el menú y el recetario son tarjetas: E las cierra sin ganar', () => {
    for (const stage of ['menu', 'recipe'] as const) {
      const game = new MealGame({ seed: 1, meal: { dish: 'stew', stage } });
      expect(game.card).toBe(true);
      game.update(DT, input({}, { action: true }));
      expect(game.closed).toBe(true);
      expect(game.done).toBe(false);
    }
  });

  it('en modo fácil, después de un error se marca el ingrediente que sigue', () => {
    const game = new MealGame({ seed: 2, easy: true, meal: { dish: 'tacos', stage: 'cook' } });
    expect(game.hintIndex).toBeNull();
    const wrong = game.shelf.indexOf('rice');
    game.cursor.col = wrong % game.cols;
    game.cursor.row = Math.floor(wrong / game.cols);
    game.update(DT, input({}, { action: true }));
    expect(game.shelf[game.hintIndex!]).toBe('tortilla');
  });

  it('las cuatro comidas usan los doce ingredientes y alguna repite', () => {
    const used = new Set(Object.values(MEAL_DISHES).flat());
    expect([...used].sort()).toEqual([...MEAL_INGREDIENTS].sort());
    expect(DISH_IDS).toHaveLength(4);
    expect(Object.values(MEAL_DISHES).some((r) => new Set(r).size < r.length)).toBe(true);
  });

  it('en la plaga del invernadero hay más plantas con pulgones', () => {
    const bugs = (pests: boolean) =>
      Array.from({ length: 40 }, (_, seed) => new PlantsGame({ seed, pests }).plants.filter((p) => p.need === 'bugs').length).reduce((a, b) => a + b, 0);
    expect(bugs(true)).toBeGreaterThan(bugs(false) * 2);
  });

  it('fusibles: uno más fuerte o más débil que el del tablero es un error, y uno sano no se cambia', () => {
    const game = new FusesGame({ seed: 4 });
    const i = game.slots.findIndex((x) => x.burnt);
    const ok = game.slots.findIndex((x) => !x.burnt);
    const at = (k: number) => {
      game.cursor.col = k % game.cols;
      game.cursor.row = Math.floor(k / game.cols);
    };
    at(ok);
    game.update(DT, input({}, { choice: 1 }));
    expect(game.message).toMatchObject({ key: 'notBurnt', good: false });
    at(i);
    const wrong = ((game.slots[i]!.type + 1) % FUSE_TYPES.length) + 1;
    game.update(DT, input({}, { choice: wrong as 1 | 2 | 3 }));
    expect(game.mistakes).toBe(2);
    expect(game.slots[i]!.burnt).toBe(true);
  });

  it('cables: las puntas de la derecha nunca arrancan en el mismo orden que las de la izquierda', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const game = new WiresGame({ seed, easy: seed % 2 === 0 });
      expect(game.right).not.toEqual(game.left);
      expect([...game.right].sort()).toEqual([...game.left].sort());
    }
  });
});

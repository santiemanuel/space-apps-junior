import { clamp } from '../math';
import { GridCursor, Minigame, type MinigameInput, type MinigameSetup } from './Minigame';

/** Ingredientes de la mesada (ícono `ing-<id>` del atlas, nombre en `hud.minigame.meal.ingredient.<id>`). */
export const MEAL_INGREDIENTS = ['tortilla', 'beans', 'chicken', 'lettuce', 'cheese', 'tomato', 'potato', 'onion', 'carrot', 'noodles', 'rice', 'egg'] as const;
export type IngredientId = (typeof MEAL_INGREDIENTS)[number];

/**
 * Comidas del día con su receta, en el orden del recetario; un ingrediente puede ir más de una vez [regla]. Ícono
 * `dish-<id>`, nombre en `hud.minigame.meal.dish.<id>`.
 */
export const MEAL_DISHES = {
  tacos: ['tortilla', 'beans', 'chicken', 'lettuce', 'cheese'],
  stew: ['potato', 'onion', 'carrot', 'potato', 'tomato'],
  pasta: ['noodles', 'tomato', 'tomato', 'cheese'],
  friedRice: ['rice', 'egg', 'onion', 'carrot', 'rice'],
} as const satisfies Record<string, readonly IngredientId[]>;
export type DishId = keyof typeof MEAL_DISHES;
export const DISH_IDS = Object.keys(MEAL_DISHES) as DishId[];

/** Partes de la cocina: el menú del día (en la cocina), el recetario y la mesada donde se cocina. */
export type MealStage = 'menu' | 'recipe' | 'cook';

/**
 * Cocina: el menú del día y el recetario son tarjetas que se leen (E las cierra). En la mesada se eligen los
 * ingredientes con las flechas y E, en el orden de la receta y de memoria; uno que no sigue vuelve a su lugar.
 */
export class MealGame extends Minigame {
  readonly id = 'meal';
  protected readonly parSeconds = 16;
  readonly cols = 4;
  readonly rows = 3;
  readonly stage: MealStage;
  readonly dish: DishId;
  readonly recipe: readonly IngredientId[];
  /** La receta queda a la vista (sin el paso por el recetario, p. ej. al abrir el minijuego suelto). */
  readonly recipeShown: boolean;
  /** Ingredientes de la mesada, en el orden de la grilla. */
  readonly shelf: readonly IngredientId[];
  readonly cursor: GridCursor;
  /** Cuántos pasos de la receta ya están en la olla. */
  placed = 0;
  /** El último que no seguía (celda de la mesada) y cuándo. */
  wrong: { index: number; at: number } | null = null;
  private missesInRow = 0;

  constructor(setup: MinigameSetup) {
    super(setup);
    this.stage = setup.meal?.stage ?? 'cook';
    this.dish = setup.meal?.dish ?? this.rng.pick(DISH_IDS);
    this.recipe = MEAL_DISHES[this.dish];
    this.recipeShown = !setup.meal;
    this.shelf = this.sample(MEAL_INGREDIENTS, MEAL_INGREDIENTS.length);
    this.cursor = new GridCursor(this.cols, this.rows);
  }

  override get card(): boolean {
    return this.stage !== 'cook';
  }

  override get helpKey(): string {
    return `help.${this.stage}`;
  }

  /** El tutorial va al empezar la cocina (en el menú), no en el recetario ni al volver a la mesada. */
  override get tutorial(): boolean {
    return this.stage === 'menu' || this.recipeShown;
  }

  /** Más fácil: después de un error se marca el ingrediente que sigue. */
  get hintIndex(): number | null {
    if (!this.setup.easy || !this.missesInRow || this.placed >= this.recipe.length) return null;
    return this.shelf.indexOf(this.recipe[this.placed]!);
  }

  protected step(dt: number, input: MinigameInput): void {
    if (this.card) {
      if (input.pressed.action) this.closed = true;
      return;
    }
    this.cursor.update(dt, input);
    if (!input.pressed.action) return;
    const index = this.cursor.index;
    const id = this.shelf[index]!;
    if (id === this.recipe[this.placed]) {
      this.placed++;
      this.missesInRow = 0;
      this.progress = this.placed / this.recipe.length;
      this.say('good', true);
    } else {
      this.mistakes++;
      this.missesInRow++;
      this.wrong = { index, at: this.elapsed };
      this.say(this.recipe.includes(id) ? 'notYet' : 'notInRecipe', false);
    }
  }
}

/** Partícula de una tormenta solar que viaja hacia un hueco de la pared (t de 0 a 1). */
export interface ShieldParticle {
  id: number;
  cell: number;
  t: number;
  /** Cómo terminó: frenada por una bolsa de agua o pasó por el hueco. */
  end: { kind: 'blocked' | 'passed'; atS: number } | null;
}

/**
 * Refugio: tapar los huecos de la pared con bolsas de agua (flechas y E) antes de que lleguen las partículas del
 * Sol. Las que pasan sólo suman al contador del dosímetro; las que pegan en el agua se frenan.
 */
export class ShieldGame extends Minigame {
  readonly id = 'shield';
  protected readonly parSeconds = 14;
  readonly cols = 6;
  readonly rows = 4;
  /** Huecos de la pared (índices de celda) y si ya tienen su bolsa. */
  readonly gaps: Map<number, boolean>;
  readonly cursor: GridCursor;
  particles: ShieldParticle[] = [];
  blocked = 0;
  passed = 0;
  private spawnS = 1;
  private nextId = 1;
  private readonly travelS: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    const count = setup.easy ? 4 : setup.hard ? 8 : 6;
    this.gaps = new Map(this.sample(Array.from({ length: this.cols * this.rows }, (_, i) => i), count).map((i) => [i, false]));
    this.cursor = new GridCursor(this.cols, this.rows, 0, 0);
    this.travelS = setup.easy ? 2.6 : 2;
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    const index = this.cursor.index;
    if (input.pressed.action && this.gaps.get(index) === false) {
      this.gaps.set(index, true);
      const filled = [...this.gaps.values()].filter(Boolean).length;
      this.progress = filled / this.gaps.size;
      this.say('filled', true);
    }
    this.spawnS -= dt;
    const open = [...this.gaps].filter(([, filled]) => !filled).map(([i]) => i);
    if (this.spawnS <= 0 && open.length) {
      this.spawnS = this.rng.between(0.9, 1.4) * (this.setup.easy ? 1.4 : 1);
      this.particles.push({ id: this.nextId++, cell: this.rng.pick(open), t: 0, end: null });
    }
    for (const p of this.particles) {
      if (p.end) continue;
      p.t += dt / this.travelS;
      if (p.t < 1) continue;
      const kind = this.gaps.get(p.cell) ? 'blocked' : 'passed';
      p.end = { kind, atS: this.elapsed };
      if (kind === 'blocked') {
        this.blocked++;
        this.say('blocked', true);
      } else this.passed++;
    }
    this.particles = this.particles.filter((p) => !p.end || this.elapsed - p.end.atS < 0.5);
  }
}

export type PlantNeed = 'dry' | 'pale' | 'bugs';
/** Herramienta de cada tecla (1, 2, 3) y lo que cura. */
export const PLANT_TOOLS: readonly { need: PlantNeed; tool: 'water' | 'lamp' | 'ladybug' }[] = [
  { need: 'dry', tool: 'water' },
  { need: 'pale', tool: 'lamp' },
  { need: 'bugs', tool: 'ladybug' },
];

/**
 * Invernadero: cada planta muestra lo que le falta (tierra seca, hojas pálidas o pulgones). Elegir la planta con las
 * flechas y darle la herramienta justa con 1 (agua), 2 (luz) o 3 (mariquitas). E repite la última herramienta.
 */
export class PlantsGame extends Minigame {
  readonly id = 'plants';
  protected readonly parSeconds = 14;
  readonly cols = 3;
  readonly rows = 2;
  readonly plants: { need: PlantNeed | null; fixedAt: number | null; wrongAt: number | null }[];
  readonly cursor: GridCursor;
  tool: 0 | 1 | 2 = 0;
  private readonly goal: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    const count = setup.pests || setup.hard ? 6 : setup.easy ? 3 : 4;
    const needy = new Set(this.sample([0, 1, 2, 3, 4, 5], count));
    const needs: PlantNeed[] = ['dry', 'pale', 'bugs'];
    this.plants = Array.from({ length: 6 }, (_, i) => ({
      need: needy.has(i) ? (setup.pests && this.rng.chance(0.6) ? 'bugs' : this.rng.pick(needs)) : null,
      fixedAt: null,
      wrongAt: null,
    }));
    this.goal = count;
    this.cursor = new GridCursor(this.cols, this.rows);
  }

  protected step(dt: number, input: MinigameInput): void {
    this.cursor.update(dt, input);
    const { choice, action } = input.pressed;
    if (!choice && !action) return;
    if (choice) this.tool = (choice - 1) as 0 | 1 | 2;
    const plant = this.plants[this.cursor.index]!;
    if (!plant.need) return this.say('healthy', false);
    if (PLANT_TOOLS[this.tool]!.need === plant.need) {
      this.say(`fixed.${plant.need}`, true);
      plant.need = null;
      plant.fixedAt = this.elapsed;
      this.progress = this.plants.filter((p) => p.fixedAt !== null).length / this.goal;
    } else {
      plant.wrongAt = this.elapsed;
      this.mistakes++;
      this.say(`needs.${plant.need}`, false);
    }
  }
}

/**
 * Esclusa: el polvo de Marte se mete en el burlete de la puerta. Mover el cepillo alrededor del sello con ← y → y
 * mantener E para limpiar cada mancha. A mitad de camino una ráfaga trae un poco más de polvo.
 */
export class SealsGame extends Minigame {
  readonly id = 'seals';
  protected readonly parSeconds = 14;
  readonly segments = 12;
  /** Polvo en cada tramo del sello (0 limpio … 1 sucio). */
  readonly dust: number[];
  /** Dónde está el cepillo, en tramos (0..12, da la vuelta). */
  brush = 0;
  gustAt: number | null = null;
  private total: number;
  private readonly rate: number;

  constructor(setup: MinigameSetup) {
    super(setup);
    const dirty = new Set(this.sample(Array.from({ length: this.segments }, (_, i) => i).filter((i) => i !== 0), setup.easy ? 4 : setup.hard ? 8 : 6));
    this.dust = Array.from({ length: this.segments }, (_, i) => (dirty.has(i) ? 1 : 0));
    this.total = dirty.size;
    this.rate = setup.easy ? 2 : 1.4;
  }

  get segment(): number {
    return ((Math.round(this.brush) % this.segments) + this.segments) % this.segments;
  }

  protected step(dt: number, { held }: MinigameInput): void {
    this.brush = (this.brush + (Number(held.right) - Number(held.left)) * 4 * dt + this.segments) % this.segments;
    const i = this.segment;
    if (held.action && this.dust[i]! > 0) {
      this.dust[i] = Math.max(0, this.dust[i]! - this.rate * dt);
      if (this.dust[i] === 0) this.say('clean', true);
    }
    if (this.gustAt === null && this.progress >= 0.5) {
      const clean = this.dust.map((d, n) => (d === 0 && n !== i ? n : -1)).filter((n) => n >= 0);
      if (clean.length) {
        this.dust[this.rng.pick(clean)] = 0.6;
        this.total += 0.6;
      }
      this.gustAt = this.elapsed;
      this.say('gust', false);
    }
    this.progress = clamp(1 - this.dust.reduce((a, b) => a + b, 0) / this.total);
  }
}

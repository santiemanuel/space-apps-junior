import type { TaskCategory } from '../crew/efficiency';
import { BikeGame, MoxieGame, PulseGame, RadioGame, ScrubberGame } from './arcade';
import type { Minigame, MinigameId, MinigameSetup } from './Minigame';
import { PatchGame, StarsGame, WaterGame } from './puzzles';
import { MealGame, PlantsGame, SealsGame, ShieldGame } from './rooms';

const GAMES: Record<MinigameId, new (setup: MinigameSetup) => Minigame> = {
  bike: BikeGame,
  scrubber: ScrubberGame,
  water: WaterGame,
  radio: RadioGame,
  stars: StarsGame,
  pulse: PulseGame,
  meal: MealGame,
  shield: ShieldGame,
  plants: PlantsGame,
  moxie: MoxieGame,
  seals: SealsGame,
  patch: PatchGame,
};

export const MINIGAME_IDS = Object.keys(GAMES) as MinigameId[];

export function createMinigame(id: MinigameId, setup: MinigameSetup): Minigame {
  return new GAMES[id](setup);
}

/** Minijuego de la reparación de un incidente según la categoría de su trabajo (las fugas de la nave tienen el suyo). */
export const INCIDENT_MINIGAMES: Partial<Record<TaskCategory, MinigameId>> = {
  scrubber: 'scrubber',
  water: 'water',
  leak: 'seals',
  pests: 'plants',
  greenhouse: 'plants',
  energy: 'moxie',
  exercise: 'bike',
  comms: 'radio',
  infirmary: 'pulse',
  food: 'meal',
};

import type { TaskCategory } from '../crew/efficiency';
import { BikeGame, MoxieGame, PulseGame, RadioGame, ScrubberGame } from './arcade';
import type { Minigame, MinigameId, MinigameSetup } from './Minigame';
import { PatchGame, StarsGame, WaterGame } from './puzzles';
import type { IncidentId } from '../incidents/definitions';
import { DustGame, NightGame } from './outpost';
import { FusesGame, WiresGame } from './power';
import { HarvestGame, MealGame, PlantsGame, SealsGame, ShieldGame } from './rooms';

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
  harvest: HarvestGame,
  moxie: MoxieGame,
  seals: SealsGame,
  patch: PatchGame,
  fuses: FusesGame,
  wires: WiresGame,
  dust: DustGame,
  night: NightGame,
};

export const MINIGAME_IDS = Object.keys(GAMES) as MinigameId[];

export function createMinigame(id: MinigameId, setup: MinigameSetup): Minigame {
  return new GAMES[id](setup);
}

/** Minijuego de la reparación de un incidente según la categoría de su trabajo (las fugas de la nave tienen el suyo). */
/** Incidentes con un minijuego propio, más allá de la categoría de su trabajo. */
export const INCIDENT_MINIGAMES_BY_ID: Partial<Record<IncidentId, MinigameId>> = {
  micrometeoroid: 'patch',
  tubeBreach: 'patch',
  cableCut: 'wires',
  fuseBlown: 'fuses',
};

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

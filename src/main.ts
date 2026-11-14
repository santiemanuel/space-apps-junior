import Phaser from 'phaser';
import { CREW_SIZE, INITIAL_RESOURCES } from './content/startingConditions';
import { MISSIONS } from './content/missions';
import { GameSession } from './core/session/GameSession';
import { NasaClient } from './data/nasa/NasaClient';
import { loadEnvironment, type NasaDataMode } from './data/nasa/NasaDataService';
import { createGameConfig } from './game/config';
import { registerServices } from './game/services';

/** Raíz de composición: único lugar donde se conectan datos, lógica y motor. */
const mode = (import.meta.env.VITE_NASA_DATA_MODE ?? 'live') as NasaDataMode;
const client = new NasaClient({ apiKey: import.meta.env.VITE_NASA_API_KEY });

const game = new Phaser.Game(createGameConfig('game'));
registerServices(game, {
  loadEnvironment: () =>
    loadEnvironment({ mode, client, onError: (error) => console.warn('[NASA] usando fixtures:', error) }),
  createSession: (environment) =>
    new GameSession({
      seed: Date.now(),
      crew: CREW_SIZE,
      initialResources: INITIAL_RESOURCES,
      missions: MISSIONS,
      environment,
    }),
});

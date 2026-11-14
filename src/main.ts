import Phaser from 'phaser';
import { MISSIONS } from './content/missions';
import { CREW_SIZE, INITIAL_RESOURCES, OUTPOST_POWER, SITE_DOSE } from './content/startingConditions';
import { Rng } from './core/rng/Rng';
import { GameSession } from './core/session/GameSession';
import { LIFE_SUPPORT_RATES, scienceFactFor } from './data/curated';
import { DonkiClient } from './data/donki/DonkiClient';
import { loadEnvironment, type DataMode } from './data/EnvironmentService';
import { createGameConfig } from './game/config';
import { registerServices } from './game/services';

/** Raíz de composición: único lugar donde se conectan datos, lógica y motor. */
const mode = (import.meta.env.VITE_NASA_DATA_MODE ?? 'live') as DataMode;
const rng = new Rng(Date.now());
const random = () => rng.next();

const game = new Phaser.Game(createGameConfig('game'));
registerServices(game, {
  loadEnvironment: () =>
    loadEnvironment({
      mode,
      random,
      client: new DonkiClient(),
      onError: (error) => console.warn('[DONKI] sin conexión, usando archivo real de datasets/:', error),
    }),
  createSession: (environment) =>
    new GameSession({
      seed: Math.floor(random() * 2 ** 32),
      crew: CREW_SIZE,
      initialResources: INITIAL_RESOURCES,
      consumptionRates: LIFE_SUPPORT_RATES,
      power: OUTPOST_POWER,
      doseRateMSvPerDay: SITE_DOSE.mSvPerDay,
      missions: MISSIONS,
      environment,
    }),
  scienceFact: (topic) => scienceFactFor(topic, random),
});

import type { RealEvent } from '../core/events/RealEvent';
import type { ManeuverId } from '../core/flow/types';
import type { ManeuverConditions, ManeuverDefinition, ManeuverRules } from '../core/maneuvers/types';
import type { GameState } from '../core/state/types';

/**
 * Las cuatro maniobras (game-design §4.0, §4.1, §4.3, §4.5, §4.7). Velocidades y anchos de zona son [regla].
 * Las cifras físicas que muestra cada etapa están en `src/i18n/*\/maneuvers.json` y se presentan como estimación
 * hasta verificarlas (§10).
 */
export const MANEUVERS: Record<ManeuverId, ManeuverDefinition> = {
  ascent: {
    id: 'ascent',
    checklist: ['engines', 'scrubber', 'radio', 'solarPanels'],
    stages: [
      { id: 'ignition', zoneWidth: 0.24, speed: 0.6, systems: ['engines'] },
      { id: 'boosterSeparation', zoneWidth: 0.2, speed: 0.75, systems: ['engines'] },
      { id: 'stageSeparation', zoneWidth: 0.18, speed: 0.85, systems: ['engines'] },
      { id: 'engineCutoff', zoneWidth: 0.16, speed: 0.95, systems: ['engines', 'radio'] },
    ],
    effect: 'vanAllen',
  },
  landing: {
    id: 'landing',
    checklist: ['heatShield', 'parachutes', 'engines', 'radio'],
    stages: [
      { id: 'entry', zoneWidth: 0.22, speed: 0.7, systems: ['heatShield'] },
      { id: 'parachute', zoneWidth: 0.18, speed: 0.85, systems: ['parachutes'] },
      { id: 'heatShieldSeparation', zoneWidth: 0.18, speed: 0.9, systems: ['heatShield'] },
      { id: 'descentEngines', zoneWidth: 0.15, speed: 1, systems: ['engines'] },
    ],
    effect: 'landingDistance',
  },
  marsAscent: {
    id: 'marsAscent',
    checklist: ['engines', 'scrubber', 'radio'],
    stages: [
      { id: 'ignition', zoneWidth: 0.2, speed: 0.75, systems: ['engines'] },
      { id: 'orbitInsertion', zoneWidth: 0.16, speed: 0.95, systems: ['engines', 'radio'] },
    ],
    effect: 'returnFuel',
  },
  reentry: {
    id: 'reentry',
    checklist: ['heatShield', 'parachutes', 'radio'],
    stages: [
      { id: 'orientShield', zoneWidth: 0.22, speed: 0.75, systems: ['heatShield'] },
      { id: 'reentry', zoneWidth: 0.17, speed: 0.95, systems: ['heatShield', 'radio'] },
      { id: 'splashdown', zoneWidth: 0.17, speed: 0.9, systems: ['parachutes'] },
    ],
    effect: 'crewArrival',
  },
};

export const MANEUVER_RULES: ManeuverRules = {
  zoneFactor: { green: 1, yellow: 0.6, red: 0.35 },
  repairSpares: { yellow: 1, red: 2 },
  fuelPerMiss: 0.08,
  zoneMargin: 0.06,
  landingDistanceKm: { best: 1, worst: 30 },
  returnFuel: { worst: 0.35, best: 1 },
  walkCondition: 0.6,
};

/**
 * Dificultad del día [regla]. El aterrizaje es más difícil con poco combustible para corregir la trayectoria y con
 * la carga más pesada (§4.3). El polvo real del día (REMS) se suma en la integración.
 */
export function maneuverConditions(id: ManeuverId, state: GameState): ManeuverConditions {
  if (id !== 'landing') return { speedFactor: 1 };
  return { speedFactor: 1 + 0.2 * (1 - state.fuel) + (state.loadout === 'waterShield' ? 0.1 : 0) };
}

/**
 * Cruce de los cinturones de Van Allen (§4.1): pico de 14 393 μGy/h medido por Artemis I (EAD) el 16/11/2022
 * [dato, RadLab]. En la integración se reemplaza por `VAN_ALLEN` de `src/data/` con la serie completa.
 */
export const VAN_ALLEN_EVENT: RealEvent = {
  id: 'artemis1-van-allen-2022-11-16',
  date: '2022-11-16T00:00:00Z',
  instrument: 'EAD',
  mission: 'Artemis I',
  agency: 'NASA',
  value: 14393,
  unit: 'μGy/h',
  kidValueKey: 'maneuvers.vanAllen.kidValue',
  explanationKey: 'maneuvers.vanAllen.explanation',
  sourceUrl: 'https://visualization.osdr.nasa.gov/radlab/',
};

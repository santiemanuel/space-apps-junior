import type { UvIndex } from '../core/environment/series';
import type { ManeuverId } from '../core/flow/types';
import type { ManeuverConditions, ManeuverDefinition, ManeuverRules } from '../core/maneuvers/types';
import { dustFactorFromUv } from '../core/meters/energy';
import type { GameState } from '../core/state/types';
import { METER_RULES } from './meters';

/**
 * Las cuatro maniobras (game-design §4.0, §4.1, §4.3, §4.5, §4.7). Velocidades y anchos de zona son [regla].
 * Las cifras físicas que muestra cada etapa están en `src/i18n/*\/maneuvers.json` [dato]:
 * - Aterrizaje (Perseverance, 2021): entrada a ~20 000 km/h; escudo a ~1300 °C en el pico de calentamiento;
 *   paracaídas supersónico a ~11 km de altura y ~1512 km/h.
 *   https://www.nasa.gov/image-article/perseverance-rover-decelerates-martian-atmosphere/ ·
 *   https://www.nasa.gov/image-article/perseverance-deploys-parachute/
 * - Reentrada (Orion, Artemis I, 2022): ~40 000 km/h, ~2800 °C, el plasma corta las comunicaciones un rato y los
 *   paracaídas la frenan a menos de 32 km/h. https://www.nasa.gov/artemis-i-press-kit/ ·
 *   https://www.nasa.gov/blogs/missions/2022/12/11/artemis-i-flight-day-26-orion-crew-module-separation-from-service-module-complete/
 */
export const MANEUVERS: Record<ManeuverId, ManeuverDefinition> = {
  // Abordaje y despegue desde la Tierra (~1 min 30 s): cargar combustible, abordar, presurizar la cabina, prueba de
  // radio, cuenta regresiva desde T-60 con los preparativos a la vista, giro y separaciones.
  ascent: {
    id: 'ascent',
    checklist: ['engines', 'scrubber', 'radio', 'solarPanels'],
    stages: [
      { id: 'fuel', kind: 'fuel', zoneWidth: 0.2, speed: 0.6, systems: ['engines'] },
      { id: 'board', kind: 'board', zoneWidth: 0.2, speed: 0.6, systems: ['scrubber'] },
      { id: 'pressure', kind: 'pressure', zoneWidth: 0.2, speed: 0.6, systems: ['scrubber'] },
      { id: 'radioCheck', kind: 'radio', zoneWidth: 0.2, speed: 0.6, systems: ['radio'] },
      {
        id: 'countdown',
        kind: 'countdown',
        zoneWidth: 0.2,
        speed: 0.6,
        systems: ['engines'],
        from: 60,
        milestones: [
          { at: 45, id: 'armRetract' },
          { at: 30, id: 'beacons' },
          { at: 15, id: 'water' },
          { at: 6, id: 'engineStart' },
        ],
      },
      { id: 'gravityTurn', kind: 'steer', zoneWidth: 0.2, speed: 0.6, systems: ['engines', 'radio'] },
      { id: 'boosterSeparation', zoneWidth: 0.2, speed: 0.75, systems: ['engines'] },
      { id: 'stageSeparation', zoneWidth: 0.18, speed: 0.85, systems: ['engines'] },
    ],
    effect: 'vanAllen',
  },
  // Aterrizaje en Marte (~35 s): entrada con el escudo, paracaídas, separación del escudo y descenso con motores.
  landing: {
    id: 'landing',
    checklist: ['heatShield', 'parachutes', 'engines', 'radio'],
    stages: [
      { id: 'entry', kind: 'steer', zoneWidth: 0.22, speed: 0.7, systems: ['heatShield'] },
      { id: 'parachute', zoneWidth: 0.18, speed: 0.85, systems: ['parachutes'] },
      { id: 'heatShieldSeparation', zoneWidth: 0.18, speed: 0.9, systems: ['heatShield'] },
      { id: 'descentEngines', kind: 'steer', zoneWidth: 0.15, speed: 1, systems: ['engines'] },
    ],
    effect: 'landingDistance',
  },
  // Despegue de Marte (~1 min): cargar el propelente, abordar, presurizar, cuenta regresiva desde T-30 y entrada en órbita.
  marsAscent: {
    id: 'marsAscent',
    checklist: ['engines', 'scrubber', 'radio'],
    stages: [
      { id: 'fuel', kind: 'fuel', zoneWidth: 0.2, speed: 0.75, systems: ['engines'] },
      { id: 'board', kind: 'board', zoneWidth: 0.2, speed: 0.75, systems: ['scrubber'] },
      { id: 'pressure', kind: 'pressure', zoneWidth: 0.2, speed: 0.75, systems: ['scrubber'] },
      {
        id: 'countdown',
        kind: 'countdown',
        zoneWidth: 0.2,
        speed: 0.75,
        systems: ['engines'],
        from: 30,
        milestones: [
          { at: 20, id: 'mastRetract' },
          { at: 12, id: 'dust' },
          { at: 6, id: 'engineStart' },
        ],
      },
      { id: 'orbitInsertion', zoneWidth: 0.16, speed: 0.95, systems: ['engines', 'radio'] },
    ],
    effect: 'returnFuel',
  },
  // Regreso a la Tierra (~30 s): orientar el escudo, la reentrada con apagón de radio y los paracaídas.
  reentry: {
    id: 'reentry',
    checklist: ['heatShield', 'parachutes', 'radio'],
    stages: [
      { id: 'orientShield', kind: 'steer', zoneWidth: 0.22, speed: 0.75, systems: ['heatShield'] },
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

/** Cuánto más rápida va la marca con el cielo más polvoriento (UV "Low" de REMS) [regla]. */
const DUST_SPEED = 0.3;

/**
 * Dificultad del día [regla]. El aterrizaje es más difícil con poco combustible para corregir la trayectoria, con
 * la carga más pesada y con polvo en el aire de Gale: `uv` es el índice UV real de REMS del día (§4.3), que el juego
 * ya usa para el polvo en los paneles.
 */
export function maneuverConditions(id: ManeuverId, state: GameState, uv: UvIndex | null = null): ManeuverConditions {
  if (id !== 'landing') return { speedFactor: 1 };
  const dust = 1 - dustFactorFromUv(METER_RULES, uv);
  return { speedFactor: 1 + 0.2 * (1 - state.fuel) + (state.loadout === 'waterShield' ? 0.1 : 0) + DUST_SPEED * dust };
}

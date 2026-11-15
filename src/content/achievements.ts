import type { AchievementDefinition, ReportRules } from '../core/report/report';
import { CAREER_DOSE_LIMIT_MSV, CHEST_XRAY_MSV } from '../data/curated';
import { ROCK_TYPES } from './galeTerrain';
import { INCIDENTS } from './incidents';
import { MANEUVER_RULES } from './maneuvers';

/** La simulación anota cada incidente en el historial con la clave de su título. */
const DUST_STORM_KEY = `${INCIDENTS.find((d) => d.id === 'dustStorm')!.textKey}.title`;

/**
 * Logros del informe (game-design §5). "Refugio a tiempo" y "Cero radiografías extra" los otorga la simulación
 * en su `PhaseResult`; los otros se deducen del estado final.
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'shelterInTime' },
  // "Como Opportunity": vivir una tormenta de polvo en Marte y seguir adelante.
  { id: 'likeOpportunity', earned: (state) => state.history.some((e) => e.kind === 'incident' && e.key === DUST_STORM_KEY) },
  { id: 'zeroExtraXrays' },
  // Geóloga de Gale: juntar en Marte una roca de cada tipo (una por franja del exterior). Cuenta lo juntado, aunque
  // después no todo entre en la nave de vuelta.
  {
    id: 'allRockTypes',
    earned: (state) => ROCK_TYPES.every((rock) => state.history.some((e) => e.key === 'mars.log.sample' && e.data?.rock === rock)),
  },
  // La campaña vuelve pasando por la llamarada X9.0 del 03/10/2024 (§2.2).
  { id: 'survivedX9', earned: (state, outcome) => outcome === 'completed' && state.mode === 'campaign2024' },
];

/**
 * Umbrales de las estrellas [regla]. Con tramos de 4 meses el fondo de radiación de ida y vuelta suma ~440 mSv
 * (§2.1): la estrella de dosis baja exige usar bien el refugio en las tormentas.
 */
export const REPORT_RULES: ReportRules = {
  healthyCondition: 0.6,
  lowDoseMSv: 500,
  chestXrayMSv: CHEST_XRAY_MSV,
  careerLimitMSv: CAREER_DOSE_LIMIT_MSV,
  walkCondition: MANEUVER_RULES.walkCondition,
};

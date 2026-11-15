import type { LoadoutProfile } from '../core/flow/types';
import type { OutboundProfile, ReturnRules } from '../core/loadout/loadout';
import { LIFE_SUPPORT_RATES } from '../data/curated';
import { CREW_ROSTER } from './crew';

/**
 * Perfiles de carga de ida (game-design §4.1) [regla]. La comida alcanza para toda la misión en los tres:
 * lo que cambia es el agua (bebida y blindaje) contra los repuestos. Usar agua como blindaje es un concepto real
 * de diseño de naves [dato].
 */
export const OUTBOUND_PROFILES: Record<LoadoutProfile, OutboundProfile> = {
  waterShield: {
    id: 'waterShield',
    waterL: 400,
    waterShield: 1,
    spares: 2,
    foodKg: 2000,
    levels: { water: 3, spares: 1, food: 2 },
    lights: { radiation: 'green', repairs: 'red' },
  },
  workshop: {
    id: 'workshop',
    waterL: 200,
    waterShield: 0.25,
    spares: 8,
    foodKg: 2000,
    levels: { water: 1, spares: 3, food: 2 },
    lights: { radiation: 'red', repairs: 'green' },
  },
  balanced: {
    id: 'balanced',
    waterL: 300,
    waterShield: 0.6,
    spares: 5,
    foodKg: 2000,
    levels: { water: 2, spares: 2, food: 2 },
    lights: { radiation: 'yellow', repairs: 'yellow' },
  },
};

/** Orden en pantalla: del más protegido al más preparado para reparar. */
export const OUTBOUND_ORDER: readonly LoadoutProfile[] = ['waterShield', 'balanced', 'workshop'];

/** Días del viaje de vuelta en la campaña 2024: del 04/06 al 10/10/2024 (§2.2). */
const RETURN_DAYS = 128;
const FOOD_STEP_KG = 50;

/**
 * Carga de vuelta (§4.5) [regla]. Con lo recomendado quedan unos 70 kg para muestras: llevar más muestras obliga
 * a dejar comida, agua o repuestos. El límite se ajusta con pruebas de juego (plan §11).
 */
export const RETURN_RULES: ReturnRules = {
  massLimitKg: 1650,
  spareKg: 10,
  shieldFullL: 400,
  recommended: {
    foodKg: Math.ceil((CREW_ROSTER.length * LIFE_SUPPORT_RATES.food * RETURN_DAYS) / FOOD_STEP_KG) * FOOD_STEP_KG,
    waterL: 200,
    shield: 1,
    spares: 3,
  },
  steps: { foodKg: FOOD_STEP_KG, waterL: 25, shield: 0.25 },
};

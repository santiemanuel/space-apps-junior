import type { LoadoutProfile } from '../core/flow/types';
import type { OutboundProfile, ReturnRules } from '../core/loadout/loadout';
import { LIFE_SUPPORT_RATES } from '../data/curated';
import { CREW_ROSTER } from './crew';

/** Masa de un kit de repuestos y litros (≈ kg) del escudo de agua lleno [regla]: valen para la ida y la vuelta. */
const SPARE_KG = 25;
const SHIELD_FULL_L = 400;

/**
 * Masa de la carga de ida [regla]: los tres perfiles pesan lo mismo, "todo lo que llevás pesa" (§4.1). La comida
 * (2000 kg) alcanza para toda la misión; los otros 700 kg se reparten entre agua (bebida y escudo) y repuestos.
 */
export const OUTBOUND_MASS_KG = 2700;

/** Masa de un perfil de ida: comida, agua para beber, agua del escudo y repuestos. */
export const outboundMassKg = (p: OutboundProfile): number => p.foodKg + p.waterL + p.waterShield * SHIELD_FULL_L + p.spares * SPARE_KG;

/**
 * Perfiles de carga de ida (game-design §4.1) [regla]. Pesan lo mismo (`OUTBOUND_MASS_KG`): lo que cambia es el agua
 * (bebida y blindaje) contra los repuestos. Usar agua como blindaje es un concepto real de diseño de naves [dato].
 */
export const OUTBOUND_PROFILES: Record<LoadoutProfile, OutboundProfile> = {
  waterShield: {
    id: 'waterShield',
    waterL: 250,
    waterShield: 1,
    spares: 2,
    foodKg: 2000,
    levels: { water: 3, spares: 1, food: 2 },
    lights: { radiation: 'green', repairs: 'red' },
  },
  workshop: {
    id: 'workshop',
    waterL: 400,
    waterShield: 0.25,
    spares: 8,
    foodKg: 2000,
    levels: { water: 1, spares: 3, food: 2 },
    lights: { radiation: 'red', repairs: 'green' },
  },
  balanced: {
    id: 'balanced',
    waterL: 335,
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
 * Carga de vuelta (§4.5) [regla]. Lo recomendado pesa 1625 kg y quedan 35 kg: entran unas 3 o 4 de las 8 muestras
 * de Gale (4–14 kg cada una, `content/gale.ts`). Llevarlas todas obliga a dejar comida, agua o repuestos.
 */
export const RETURN_RULES: ReturnRules = {
  massLimitKg: 1660,
  spareKg: SPARE_KG,
  shieldFullL: SHIELD_FULL_L,
  recommended: {
    foodKg: Math.ceil((CREW_ROSTER.length * LIFE_SUPPORT_RATES.food * RETURN_DAYS) / FOOD_STEP_KG) * FOOD_STEP_KG,
    waterL: 200,
    shield: 1,
    spares: 3,
  },
  steps: { foodKg: FOOD_STEP_KG, waterL: 25, shield: 0.25 },
};

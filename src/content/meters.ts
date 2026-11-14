import type { MeterRules } from '../core/meters/rules';
import { CAREER_DOSE_LIMIT_MSV, CHEST_XRAY_MSV, HUMAN_STANDARDS, LIFE_SUPPORT_RATES, QUALITY_FACTORS } from '../data/curated';

const { min: RECYCLING_MIN, max: RECYCLING_MAX } = HUMAN_STANDARDS.waterRecycling;

/**
 * Parámetros de los medidores (game-design §3.2). Normas y datos citados en `datasets/curated/`;
 * lo marcado [regla] es diseño del juego y se ajusta con pruebas con niños.
 */
export const METER_RULES: MeterRules = {
  lifeSupport: {
    oxygenKgPerCrewDay: LIFE_SUPPORT_RATES.oxygen,
    waterLPerCrewDay: HUMAN_STANDARDS.potableWaterLPerCrewDay,
    waterLPerEvaHour: HUMAN_STANDARDS.evaWaterLPerHour,
    recyclingByStatus: { green: RECYCLING_MAX, yellow: (RECYCLING_MIN + RECYCLING_MAX) / 2, red: RECYCLING_MIN },
    co2LimitMmHg: HUMAN_STANDARDS.co2LimitMmHg,
    co2NominalMmHg: 2, // [regla]
    co2RatePerDayByStatus: { green: -2, yellow: 0.5, red: 1.5 }, // [regla]
  },
  dose: {
    qMars: QUALITY_FACTORS.marsSurface,
    qCruise: QUALITY_FACTORS.cruise,
    qSep: QUALITY_FACTORS.solarParticleEvent,
    shieldExterior: 1,
    shieldHabitat: 0.6,
    shieldShelterFull: 0.2,
    shieldShelterEmpty: 0.6,
    chestXrayMSv: CHEST_XRAY_MSV,
    careerLimitMSv: CAREER_DOSE_LIMIT_MSV,
  },
  food: {
    foodKgPerCrewDay: LIFE_SUPPORT_RATES.food,
    kcalPerCrewDay: HUMAN_STANDARDS.kcalPerCrewDay,
  },
  health: {
    exerciseHoursPerDay: HUMAN_STANDARDS.exerciseHoursPerDay,
    // [regla] Sin ejercicio, la condición baja de 1 a 0,6 en ~20 días.
    conditionLossPerDayNoExercise: 0.02,
    conditionGainPerDayExercise: 0.01,
    conditionLossPerDayStarving: 0.03,
    moraleLossPerDay: 0.01,
    moraleLossPerDayStarving: 0.05,
    moraleGainPerCallHome: 0.15,
    fatiguePerWorkHour: 0.05,
    fatiguePerHighCo2Hour: 0.01,
    fatigueRecoveryPerSleepHour: 0.1,
  },
  energy: {
    heatingKwPerDegree: 0.03, // [regla]
    interiorTempC: 21,
    dustFactorByUv: { Very_High: 1, High: 1, Moderate: 0.85, Low: 0.45 }, // [regla, §3.2]
  },
};

/** Consumo de cada sistema encendido (kW) para el tablero de energía [regla]. */
export interface PowerProfile {
  panelKwAt1Au: number;
  capacityKwh: number;
  loadsKw: Record<string, number>;
}

/** Nave de propulsión nuclear: el reactor sólo sirve para los motores; el hábitat usa paneles (§2.1). */
export const SHIP_POWER: PowerProfile = {
  panelKwAt1Au: 25,
  capacityKwh: 120,
  loadsKw: { lifeSupport: 5, radio: 0.5, lights: 1 },
};

/** Base en el cráter Gale: a 1,52 UA llega el 43 % de la luz y el polvo la reduce más (§3.2, §4.4). */
export const GALE_POWER: PowerProfile = {
  panelKwAt1Au: 50,
  capacityKwh: 100,
  loadsKw: { lifeSupport: 3, radio: 0.3, greenhouse: 1.5, moxie: 2 },
};

/** MOXIE escalado: el real dio ≤ 12 g/h; el del juego fabrica mucho más a cambio de energía [dato + regla]. */
export const MOXIE_OXYGEN_KG_PER_DAY = 1.5;

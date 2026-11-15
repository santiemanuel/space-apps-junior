import type { SystemStatus } from '../systems/types';

/**
 * Parámetros de los medidores (game-design §3.2). Los valores con norma o dato vienen de
 * `src/content/meters.ts` con su cita; aquí sólo está la forma, para que las fórmulas sean puras.
 */
export interface MeterRules {
  lifeSupport: {
    /** O2 consumido por tripulante y día (kg) [norma, BVAD]. */
    oxygenKgPerCrewDay: number;
    /** Agua potable por tripulante y día (L) [norma, NASA-STD-3001]. */
    waterLPerCrewDay: number;
    /** Agua extra por hora de EVA (L) [norma, NASA-STD-3001]. */
    waterLPerEvaHour: number;
    /** Fracción del agua que recupera el reciclador según su estado [dato ISS: 90–98 %]. */
    recyclingByStatus: Record<SystemStatus, number>;
    /** Límite de CO2 (mmHg) [norma, NASA-STD-3001 V2 6004]. */
    co2LimitMmHg: number;
    /** CO2 con el depurador sano (mmHg) [regla]. */
    co2NominalMmHg: number;
    /** Cambio del CO2 por día según el depurador, para 4 tripulantes (mmHg/día) [regla]. */
    co2RatePerDayByStatus: Record<SystemStatus, number>;
  };
  dose: {
    /** Factor de calidad (dosis absorbida → equivalente) [dato: Hassler 2014, Zeitlin 2013]. */
    qMars: number;
    qCruise: number;
    /** Q durante un evento SEP [regla]. */
    qSep: number;
    /** f_blindaje [regla]. */
    shieldExterior: number;
    shieldHabitat: number;
    shieldShelterFull: number;
    shieldShelterEmpty: number;
    /** Comparación para niños [dato]. */
    chestXrayMSv: number;
    /** Límite de carrera [norma, NASA-STD-3001]. */
    careerLimitMSv: number;
  };
  food: {
    /** Comida envasada por tripulante y día (kg) [norma, BVAD]. */
    foodKgPerCrewDay: number;
    /** Energía diaria por tripulante (kcal) [norma, NASA-STD-3001 V2 7003]. */
    kcalPerCrewDay: number;
  };
  health: {
    /** Ejercicio diario para no perder condición física (h) [dato: ~2 h/día en la ISS]. */
    exerciseHoursPerDay: number;
    /** Cambios por día [regla, a ajustar con pruebas con niños]. */
    conditionLossPerDayNoExercise: number;
    conditionGainPerDayExercise: number;
    conditionLossPerDayStarving: number;
    moraleLossPerDay: number;
    moraleLossPerDayStarving: number;
    moraleGainPerCallHome: number;
    /** Cambios por hora [regla]. */
    fatiguePerWorkHour: number;
    fatiguePerHighCo2Hour: number;
    fatigueRecoveryPerSleepHour: number;
  };
  energy: {
    /** Calefacción: kW por cada °C entre el interior y la mínima exterior [regla]. */
    heatingKwPerDegree: number;
    interiorTempC: number;
    /** f_polvo según el índice UV de REMS [regla]. */
    dustFactorByUv: Record<'Very_High' | 'High' | 'Moderate' | 'Low', number>;
  };
}

import type { CascadeRules } from '../core/cascade/rules';
import { GALE_POWER } from './meters';

/**
 * Falla en cascada (game-design §3.5). Todo es [regla] y se ajusta con pruebas con niños (§10).
 * Margen de 2 días para energía y aire/agua y de 3 para comida y salud: "unas jornadas o soles para recuperarse".
 */
export const CASCADE_RULES: CascadeRules = {
  marginHours: { energy: 48, lifeSupport: 48, food: 72, health: 72 },
  recover: { batteryFraction: 0.1, reserveDays: 1 },
  rest: { enterCondition: 0.15, enterFatigue: 0.98, leaveCondition: 0.4, leaveFatigue: 0.5 },
  effects: {
    energy: { heatingFactor: 0.5, conditionLossPerHour: 0.004, moraleLossPerHour: 0.004 },
    lifeSupport: { consumptionFactor: 0.75, fatiguePerHour: 0.02 },
    food: { ration: 0.5 },
    overdueMultiplier: 2,
  },
  resting: { fatigueRecoveryPerHour: 0.05, conditionGainPerHour: 0.004, medicMultiplier: 2 },
  sacrifices: {
    // Pared de agua de ~6 m² y 20 cm de espesor.
    shelterWaterL: 1200,
    shelterKw: 0.5,
    shelterUnpoweredEfficacy: 0.5,
    cleanPanels: { evaHours: 2, fatigue: 0.2, cleanHours: 72 },
    recyclerBoostKw: 1.5,
    moxieKw: GALE_POWER.loadsKw.moxie ?? 2,
    moxieBoostKw: 2,
    moxieBoostOxygenKgPerDay: 1.5,
    greenhouseKw: 1.5,
    medicCareFatigueForOthers: 0.1,
    reduceRoutinesWorkFactor: 0.5,
    extraRation: { foodKg: 1.8, condition: 0.05 },
  },
};

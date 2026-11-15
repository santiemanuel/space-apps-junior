import type { CascadeMeter } from '../incidents/types';

/** Parámetros de la falla en cascada (§3.5). Todos son [regla]: se ajustan con pruebas con niños. */
export interface CascadeRules {
  /** Margen de cada modo de emergencia antes de agotarse (h). */
  marginHours: Record<CascadeMeter, number>;
  /** Para salir de la emergencia hay que recuperar algo más que cero (histéresis). */
  recover: { batteryFraction: number; reserveDays: number };
  /** Un tripulante pasa a reposo con la condición muy baja o agotado, y vuelve cuando se recupera. */
  rest: { enterCondition: number; enterFatigue: number; leaveCondition: number; leaveFatigue: number };
  effects: {
    energy: { heatingFactor: number; conditionLossPerHour: number; moraleLossPerHour: number };
    lifeSupport: { consumptionFactor: number; fatiguePerHour: number };
    food: { ration: number };
    /** Con el margen agotado los efectos sobre la salud se multiplican. */
    overdueMultiplier: number;
  };
  resting: { fatigueRecoveryPerHour: number; conditionGainPerHour: number; medicMultiplier: number };
  sacrifices: {
    /** Litros de agua del escudo del refugio lleno. */
    shelterWaterL: number;
    shelterKw: number;
    shelterUnpoweredEfficacy: number;
    cleanPanels: { evaHours: number; fatigue: number; cleanHours: number };
    recyclerBoostKw: number;
    moxieKw: number;
    moxieBoostKw: number;
    moxieBoostOxygenKgPerDay: number;
    greenhouseKw: number;
    medicCareFatigueForOthers: number;
    reduceRoutinesWorkFactor: number;
    extraRation: { foodKg: number; condition: number };
  };
}

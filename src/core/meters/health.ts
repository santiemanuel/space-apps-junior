import type { CrewMemberState } from '../crew/types';
import { clamp } from '../math';
import type { MeterRules } from './rules';

export interface FoodStep {
  foodKg: number;
  /** Fracción comida de lo que necesitaba la tripulación (1 = raciones completas). */
  nutrition: number;
}

/**
 * La comida es un stock del inventario: 1,8 kg (3035 kcal) por tripulante y día. `ration` < 1 es racionar
 * (un sacrificio de la falla en cascada, §3.5); si se acaba el stock, comen lo que queda.
 */
export function stepFood(rules: MeterRules, foodKg: number, crewCount: number, hours: number, ration = 1): FoodStep {
  const needed = (rules.food.foodKgPerCrewDay * crewCount * hours) / 24;
  if (needed <= 0) return { foodKg, nutrition: 1 };
  const eaten = Math.min(foodKg, needed * clamp(ration));
  return { foodKg: foodKg - eaten, nutrition: eaten / needed };
}

/** kcal que representa una masa de comida envasada (para mostrar a los niños). */
export const kcalOf = (rules: MeterRules, foodKg: number): number =>
  (foodKg / rules.food.foodKgPerCrewDay) * rules.food.kcalPerCrewDay;

export interface CrewDayInput {
  hours: number;
  exerciseHours?: number;
  workHours?: number;
  sleepHours?: number;
  co2MmHg: number;
  /** Fracción comida en el paso (de `stepFood`). */
  nutrition: number;
  callsHome?: number;
}

/**
 * Condición física, cansancio, ánimo y nutrición de un tripulante (§3.2): la condición baja sin ejercicio,
 * el cansancio sube con el trabajo y el CO2 alto y baja durmiendo, el ánimo sube al hablar con la Tierra.
 */
export function stepCrewHealth(rules: MeterRules, member: CrewMemberState, input: CrewDayInput): CrewMemberState {
  const h = rules.health;
  const { hours, exerciseHours = 0, workHours = 0, sleepHours = 0, co2MmHg, nutrition, callsHome = 0 } = input;
  const days = hours / 24;
  const exercised = days > 0 ? clamp(exerciseHours / (h.exerciseHoursPerDay * days)) : 0;
  const hunger = 1 - clamp(nutrition);
  const highCo2Hours = co2MmHg > rules.lifeSupport.co2LimitMmHg ? hours - sleepHours : 0;
  return {
    ...member,
    nutrition: clamp(nutrition),
    condition: clamp(
      member.condition +
        days *
          (exercised * h.conditionGainPerDayExercise -
            (1 - exercised) * h.conditionLossPerDayNoExercise -
            hunger * h.conditionLossPerDayStarving),
    ),
    fatigue: clamp(
      member.fatigue +
        workHours * h.fatiguePerWorkHour +
        Math.max(0, highCo2Hours) * h.fatiguePerHighCo2Hour -
        sleepHours * h.fatigueRecoveryPerSleepHour,
    ),
    morale: clamp(
      member.morale - days * (h.moraleLossPerDay + hunger * h.moraleLossPerDayStarving) + callsHome * h.moraleGainPerCallHome,
    ),
  };
}

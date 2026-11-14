import type { CrewId } from '../crew/types';
import type { GameState } from '../state/types';
import { doseMSv, qualityFactor, shieldingFactor, shieldZoneOf } from './dose';
import { heatingKw, solarGenerationKw, stepEnergy, type SolarInput } from './energy';
import { stepCrewHealth, stepFood } from './health';
import { stepLifeSupport } from './lifeSupport';
import type { MeterRules } from './rules';

/** Lo que el mundo real aporta en el paso: datos por fecha (§3.2). */
export interface MeterEnvironment {
  place: 'mars' | 'cruise';
  /** Tasa real de la serie de la fase (μGy/h), ya con el tope de §3.2.1. */
  doseRateUGyH: number;
  sepActive: boolean;
  solar: SolarInput;
  /** Mínima exterior (°C): sólo en Marte, activa la calefacción. */
  minTempC?: number;
}

/** Actividad de un tripulante en el paso (la decide la rutina o el jugador, §3.3). */
export interface CrewActivity {
  exerciseHours?: number;
  workHours?: number;
  sleepHours?: number;
  callsHome?: number;
}

/** Lo que decide el jugador o la rutina: tablero de energía, EVA, raciones (§3.1). */
export interface MeterPlan {
  /** Consumo de los sistemas encendidos, sin la calefacción (kW). */
  loadKw: number;
  evaHours?: number;
  oxygenProducedKg?: number;
  ration?: number;
  crew?: Partial<Record<CrewId, CrewActivity>>;
}

export interface MeterStepResult {
  state: GameState;
  generationKw: number;
  loadKw: number;
  deficitKwh: number;
  oxygenShortKg: number;
  waterShortL: number;
  /** Dosis sumada a cada tripulante en el paso (mSv). */
  doseMSv: Record<CrewId, number>;
}

/** Avanza los tres medidores y el inventario `hours` horas. Puro: devuelve un estado nuevo. */
export function stepMeters(rules: MeterRules, state: GameState, env: MeterEnvironment, plan: MeterPlan, hours: number): MeterStepResult {
  const crewCount = state.crew.length;
  const generationKw = solarGenerationKw(env.solar);
  const loadKw = plan.loadKw + (env.minTempC === undefined ? 0 : heatingKw(rules, env.minTempC));
  const energy = stepEnergy(state.meters.energy, generationKw, loadKw, hours);
  const life = stepLifeSupport(rules, state.meters.lifeSupport, {
    crewCount,
    hours,
    scrubber: state.systems.scrubber,
    waterRecycler: state.systems.waterRecycler,
    evaHours: plan.evaHours,
    oxygenProducedKg: plan.oxygenProducedKg,
  });
  const food = stepFood(rules, state.inventory.foodKg, crewCount, hours, plan.ration);
  const q = qualityFactor(rules, env.place, env.sepActive);

  const dose = {} as Record<CrewId, number>;
  const crew = state.crew.map((member) => {
    const added = doseMSv(env.doseRateUGyH, shieldingFactor(rules, shieldZoneOf(member.location), state.waterShield), q, hours);
    dose[member.id] = added;
    const next = stepCrewHealth(rules, member, {
      hours,
      co2MmHg: life.lifeSupport.co2MmHg,
      nutrition: food.nutrition,
      ...plan.crew?.[member.id],
    });
    return { ...next, doseMSv: member.doseMSv + added };
  });

  return {
    state: {
      ...state,
      meters: { energy: energy.energy, lifeSupport: life.lifeSupport },
      inventory: { ...state.inventory, foodKg: food.foodKg },
      crew,
    },
    generationKw,
    loadKw,
    deficitKwh: energy.deficitKwh,
    oxygenShortKg: life.oxygenShortKg,
    waterShortL: life.waterShortL,
    doseMSv: dose,
  };
}

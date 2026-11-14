import type { CrewId } from '../crew/types';
import type { CascadeMeter } from '../incidents/types';
import { clamp } from '../math';
import type { MeterRules } from '../meters/rules';
import type { GameState, MissionLogEntry } from '../state/types';
import type { CascadeRules } from './rules';
import type { ActiveEmergency, CascadeEvent, CascadeState } from './types';

type ShipMeter = Exclude<CascadeMeter, 'health'>;
const SHIP_METERS: readonly ShipMeter[] = ['energy', 'lifeSupport', 'food'];

function isDepleted(meter: ShipMeter, state: GameState): boolean {
  const { energy, lifeSupport } = state.meters;
  if (meter === 'energy') return energy.batteryKwh <= 0;
  if (meter === 'lifeSupport') return lifeSupport.oxygenKg <= 0 || lifeSupport.waterL <= 0;
  return state.inventory.foodKg <= 0;
}

function isRecovered(meter: ShipMeter, state: GameState, rules: CascadeRules, meterRules: MeterRules): boolean {
  const { energy, lifeSupport } = state.meters;
  const days = rules.recover.reserveDays * state.crew.length;
  if (meter === 'energy') return energy.batteryKwh >= rules.recover.batteryFraction * energy.capacityKwh;
  if (meter === 'lifeSupport')
    return (
      lifeSupport.oxygenKg >= meterRules.lifeSupport.oxygenKgPerCrewDay * days &&
      lifeSupport.waterL >= meterRules.lifeSupport.waterLPerCrewDay * days
    );
  return state.inventory.foodKg >= meterRules.food.foodKgPerCrewDay * days;
}

const sameEmergency = (a: ActiveEmergency, meter: CascadeMeter, crewId?: CrewId) =>
  a.meter === meter && a.crewId === crewId;

const logEntry = (state: GameState, key: string, data?: MissionLogEntry['data']): MissionLogEntry => ({
  simDate: state.simDate,
  phase: state.phase,
  kind: 'cascade',
  key,
  ...(data ? { data } : {}),
});

export interface CascadeUpdate {
  cascade: CascadeState;
  state: GameState;
  events: CascadeEvent[];
}

/**
 * Tras cada paso de los medidores: descuenta el margen de las emergencias, entra o sale de los modos de
 * emergencia y detecta el punto de no retorno (§3.5). Un medidor en cero nunca termina la partida por sí solo.
 */
export function updateCascade(
  rules: CascadeRules,
  meterRules: MeterRules,
  cascade: CascadeState,
  state: GameState,
  hours: number,
): CascadeUpdate {
  const events: CascadeEvent[] = [];
  const history: MissionLogEntry[] = [];

  let emergencies = cascade.emergencies.map((e) => {
    const marginHours = Math.max(0, e.marginHours - hours);
    const overdue = marginHours <= 0;
    if (overdue && !e.overdue) events.push({ type: 'overdue', meter: e.meter, ...(e.crewId ? { crewId: e.crewId as CrewId } : {}) });
    return { ...e, marginHours, overdue };
  });

  const enter = (meter: CascadeMeter, crewId?: CrewId) => {
    const emergency: ActiveEmergency = {
      meter,
      ...(crewId ? { crewId } : {}),
      marginHours: rules.marginHours[meter],
      enteredAt: state.simDate,
      overdue: false,
    };
    emergencies.push(emergency);
    events.push({ type: 'entered', emergency: { meter, ...(crewId ? { crewId } : {}), marginHours: emergency.marginHours } });
    history.push(logEntry(state, `incidents.cascade.${meter}.entered`, crewId ? { crewId } : undefined));
  };
  const exit = (meter: CascadeMeter, crewId?: CrewId) => {
    emergencies = emergencies.filter((e) => !sameEmergency(e, meter, crewId));
    events.push({ type: 'exited', meter, ...(crewId ? { crewId } : {}) });
  };

  for (const meter of SHIP_METERS) {
    const active = emergencies.some((e) => sameEmergency(e, meter));
    if (active && isRecovered(meter, state, rules, meterRules)) exit(meter);
    else if (!active && isDepleted(meter, state)) enter(meter);
  }

  const { rest } = rules;
  const crew = state.crew.map((m) => {
    if (!m.resting && (m.condition <= rest.enterCondition || m.fatigue >= rest.enterFatigue)) {
      enter('health', m.id);
      return { ...m, resting: true, taskId: null, location: 'infirmary' };
    }
    if (m.resting && m.condition >= rest.leaveCondition && m.fatigue <= rest.leaveFatigue) {
      exit('health', m.id);
      return { ...m, resting: false };
    }
    return m;
  });

  let noReturnReasonKey = cascade.noReturnReasonKey;
  if (!noReturnReasonKey) {
    const overdueMeters = new Set(emergencies.filter((e) => e.overdue).map((e) => e.meter));
    if (crew.length > 0 && crew.every((m) => m.resting)) noReturnReasonKey = 'incidents.cascade.noReturn.allResting';
    else if (overdueMeters.size >= 2) noReturnReasonKey = 'incidents.cascade.noReturn.twoMeters';
    if (noReturnReasonKey) {
      events.push({ type: 'noReturn', reasonKey: noReturnReasonKey });
      history.push(logEntry(state, noReturnReasonKey));
    }
  }

  const flags =
    cascade.flags.medicCaring && !crew.find((m) => m.id === cascade.flags.medicCaring)?.resting
      ? { ...cascade.flags, medicCaring: null }
      : cascade.flags;

  return {
    cascade: { emergencies, flags, noReturnReasonKey },
    state: { ...state, crew, history: history.length ? [...state.history, ...history] : state.history },
    events,
  };
}

/** Ajustes al plan de los medidores que imponen las emergencias y los sacrificios activos. */
export interface CascadeAdjustments {
  /** Energía: sólo soporte vital (sin ciencia ni luces del invernadero). */
  essentialOnly: boolean;
  heatingFactor: number;
  lifeSupportFactor: number;
  ration: number;
  shelterEfficacy: number;
  recyclerBoost: boolean;
  moxieOn: boolean;
  /** kW que suman (o restan) los sacrificios. */
  extraLoadKw: number;
  extraOxygenKgPerDay: number;
  /** f_polvo forzado a 1 mientras los paneles siguen limpios. */
  dustFactorOverride: number | null;
  /** Escala de las horas de trabajo de quienes no están en reposo. */
  workFactor: number;
  greenhousePriority: boolean;
}

export function cascadeAdjustments(rules: CascadeRules, cascade: CascadeState, simDate: string): CascadeAdjustments {
  const active = (meter: CascadeMeter) => cascade.emergencies.some((e) => e.meter === meter);
  const { flags } = cascade;
  const s = rules.sacrifices;
  const energy = active('energy');
  const lifeSupport = active('lifeSupport');
  return {
    essentialOnly: energy,
    heatingFactor: energy ? rules.effects.energy.heatingFactor : 1,
    lifeSupportFactor: lifeSupport ? rules.effects.lifeSupport.consumptionFactor : 1,
    ration: active('food') ? rules.effects.food.ration : 1,
    shelterEfficacy: flags.shelterUnpowered ? s.shelterUnpoweredEfficacy : 1,
    recyclerBoost: flags.recyclerBoost,
    moxieOn: !flags.moxieOff,
    extraLoadKw:
      (flags.shelterUnpowered ? -s.shelterKw : 0) +
      (flags.moxieOff ? -s.moxieKw : 0) +
      (flags.recyclerBoost ? s.recyclerBoostKw : 0) +
      (flags.moxieBoost ? s.moxieBoostKw : 0) +
      (flags.greenhousePriority ? s.greenhouseKw : 0),
    extraOxygenKgPerDay: flags.moxieBoost ? s.moxieBoostOxygenKgPerDay : 0,
    dustFactorOverride: flags.panelsCleanUntil && Date.parse(simDate) < Date.parse(flags.panelsCleanUntil) ? 1 : null,
    workFactor: flags.reduceRoutines ? s.reduceRoutinesWorkFactor : 1,
    greenhousePriority: flags.greenhousePriority,
  };
}

/** Efectos por hora de los modos de emergencia sobre la tripulación y recuperación de quienes reposan. */
export function applyEmergencyEffects(rules: CascadeRules, cascade: CascadeState, state: GameState, hours: number): GameState {
  const find = (meter: CascadeMeter) => cascade.emergencies.find((e) => e.meter === meter);
  const factor = (e: ActiveEmergency | undefined) => (e ? (e.overdue ? rules.effects.overdueMultiplier : 1) : 0);
  const energy = factor(find('energy'));
  const lifeSupport = factor(find('lifeSupport'));
  const { effects, resting } = rules;
  const crew = state.crew.map((m) => {
    const care = cascade.flags.medicCaring === m.id ? resting.medicMultiplier : 1;
    return {
      ...m,
      condition: clamp(
        m.condition - energy * effects.energy.conditionLossPerHour * hours + (m.resting ? resting.conditionGainPerHour * care * hours : 0),
      ),
      morale: clamp(m.morale - energy * effects.energy.moraleLossPerHour * hours),
      fatigue: clamp(
        m.fatigue + lifeSupport * effects.lifeSupport.fatiguePerHour * hours - (m.resting ? resting.fatigueRecoveryPerHour * care * hours : 0),
      ),
    };
  });
  return { ...state, crew };
}

/** Margen que queda en un modo de emergencia, en días (o soles) para mostrarlo a los niños. */
export const marginDays = (emergency: ActiveEmergency, hoursPerDay = 24): number =>
  Math.ceil(emergency.marginHours / hoursPerDay);

import { describe, expect, it } from 'vitest';
import { makeCrew, makeCrewMember, makeGameState } from '../../test-utils/factories';
import {
  arrivalSeconds,
  efficiency,
  EFFICIENCY_RULES,
  reactionSeconds,
  slowReasonKey,
  usesOptimalRoute,
  withSlowReasons,
  workSpeed,
} from './efficiency';
import { autoShelterCrew, DEFAULT_ROUTINE, defaultRoutines, isValidRoutine, routineActivities } from './routines';

describe('eficiencia (§3.3)', () => {
  it('una tripulación bien cuidada rinde al 100 %', () => {
    expect(efficiency(makeCrewMember(), 2)).toBe(1);
  });

  it('aplica los pesos: 0,25 fatiga, 0,25 condición, 0,15 CO2 > 3 mmHg, 0,10 ánimo', () => {
    expect(efficiency(makeCrewMember({ fatigue: 0.4 }), 2)).toBeCloseTo(0.9);
    expect(efficiency(makeCrewMember({ condition: 0.6 }), 2)).toBeCloseTo(0.9);
    expect(efficiency(makeCrewMember(), 3.5)).toBeCloseTo(0.85);
    expect(efficiency(makeCrewMember(), 3)).toBe(1);
    expect(efficiency(makeCrewMember({ morale: 0.5 }), 2)).toBeCloseTo(0.95);
  });

  it('nunca baja de 0,5', () => {
    expect(efficiency(makeCrewMember({ fatigue: 1, condition: 0, morale: 0 }), 5)).toBe(0.5);
  });

  it('reacción de 1 s (bien) a 6 s (agotado)', () => {
    expect(reactionSeconds(1)).toBe(1);
    expect(reactionSeconds(0.5)).toBe(6);
    expect(reactionSeconds(0.75)).toBeCloseTo(3.5);
  });

  it('ruta óptima desde 0,8 de eficiencia', () => {
    expect(usesOptimalRoute(0.8)).toBe(true);
    expect(usesOptimalRoute(0.79)).toBe(false);
  });

  it('la especialidad trabaja ×1,5 y la comandante ×1 en todo', () => {
    const miga = makeCrewMember({ id: 'miga', role: 'engineer' });
    expect(workSpeed(miga, 'scrubber', 2)).toBe(1.5);
    expect(workSpeed(miga, 'greenhouse', 2)).toBe(1);
    expect(workSpeed(makeCrewMember(), 'scrubber', 2)).toBe(1);
    expect(workSpeed(makeCrewMember({ id: 'senda', role: 'geoMedic', fatigue: 0.4 }), 'samples', 2)).toBeCloseTo(1.35);
  });

  it('en reposo no trabaja ni llega', () => {
    const resting = makeCrewMember({ resting: true });
    expect(workSpeed(resting, 'general', 2)).toBe(0);
    expect(arrivalSeconds(resting, 2, 10, 2)).toBe(Infinity);
  });

  it('la misma alarma: ~1 s por la mejor ruta bien cuidado, mucho más agotado', () => {
    const fresh = arrivalSeconds(makeCrewMember(), 2, 10, 2);
    expect(fresh).toBeCloseTo(1 + 5);
    const exhausted = arrivalSeconds(makeCrewMember({ fatigue: 1, condition: 0.2 }), 4, 10, 2);
    expect(exhausted).toBeCloseTo(6 + (10 * EFFICIENCY_RULES.blindRouteFactor) / (2 * 0.5));
  });
});

describe('motivo de la lentitud', () => {
  it('sin motivo si rinde bien', () => {
    expect(slowReasonKey(makeCrewMember(), 2)).toBeUndefined();
  });

  it('elige el factor que más pesa', () => {
    expect(slowReasonKey(makeCrewMember({ fatigue: 0.6 }), 2)).toBe('hud.crewSlow.fatigue');
    expect(slowReasonKey(makeCrewMember({ condition: 0.5 }), 2)).toBe('hud.crewSlow.condition');
    expect(slowReasonKey(makeCrewMember(), 4)).toBe('hud.crewSlow.co2');
    expect(slowReasonKey(makeCrewMember({ morale: 0.2 }), 2)).toBe('hud.crewSlow.morale');
    expect(slowReasonKey(makeCrewMember({ resting: true }), 2)).toBe('hud.crewSlow.resting');
  });

  it('se guarda en el estado y se borra al recuperarse', () => {
    const [tired] = withSlowReasons([makeCrewMember({ fatigue: 0.6 })], 2);
    expect(tired!.slowReasonKey).toBe('hud.crewSlow.fatigue');
    const [ok] = withSlowReasons([{ ...tired!, fatigue: 0 }], 2);
    expect(ok).not.toHaveProperty('slowReasonKey');
  });
});

describe('rutinas', () => {
  it('la rutina por defecto es válida y suma ≤ 24 h', () => {
    expect(isValidRoutine(DEFAULT_ROUTINE)).toBe(true);
    expect(isValidRoutine({ ...DEFAULT_ROUTINE, workHours: 20 })).toBe(false);
  });

  it('reparte la rutina en el paso; quien reposa sólo duerme', () => {
    const crew = makeCrew().map((m) => (m.id === 'brote' ? { ...m, resting: true } : m));
    const acts = routineActivities(crew, defaultRoutines(crew), 12);
    expect(acts.vega).toEqual({ sleepHours: 4, exerciseHours: 1, workHours: 5, callsHome: 0.25 });
    expect(acts.brote).toEqual({ sleepHours: 12 });
  });

  it('reducir rutinas baja las horas de trabajo', () => {
    const crew = makeCrew();
    expect(routineActivities(crew, defaultRoutines(crew), 24, 0.5).miga!.workHours).toBe(5);
  });
});

describe('modo ayuda', () => {
  it('sin modo ayuda los automáticos no van solos al refugio', () => {
    expect(autoShelterCrew(makeGameState(), 'impact')).toEqual([]);
  });

  it('con modo ayuda van todos menos el jugador y quien reposa, sólo en el impacto', () => {
    const crew = makeCrew().map((m) => (m.id === 'senda' ? { ...m, resting: true } : m));
    const state = makeGameState({ helpMode: true, crew });
    expect(autoShelterCrew(state, 'impact')).toEqual(['miga', 'brote']);
    expect(autoShelterCrew(state, 'alert')).toEqual([]);
  });
});

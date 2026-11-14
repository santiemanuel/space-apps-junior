import { describe, expect, it } from 'vitest';
import { makeEnvironment, makeMission } from '../../test-utils/factories';
import { Rng } from '../rng/Rng';
import { buildDecision, missionRisk, resolveDecision } from './DecisionEngine';

const eva = makeMission({ id: 'eva', type: 'eva', exposure: { radiation: 1, debris: 0.5 }, failurePenalty: { oxygen: -6 } });

describe('missionRisk', () => {
  it('combina amenazas independientes ponderadas por exposición', () => {
    const env = makeEnvironment({ radiationRisk: 0.5, debrisThreat: 0.4 });
    expect(missionRisk(eva, env)).toBeCloseTo(1 - 0.5 * 0.8);
    expect(missionRisk(makeMission(), env)).toBe(0);
  });
});

describe('buildDecision', () => {
  it('no exige decisión en condiciones tranquilas', () => {
    expect(buildDecision(eva, makeEnvironment({ radiationRisk: 0.1 }))).toBeNull();
  });

  it('ofrece opciones con probabilidades coherentes cuando el riesgo es alto', () => {
    const decision = buildDecision(eva, makeEnvironment({ radiationRisk: 0.7 }))!;
    const [proceed, shield, postpone] = decision.options;
    expect(decision.prompt).toContain('actividad solar');
    expect(shield!.successChance).toBeGreaterThan(proceed!.successChance);
    expect(postpone!.successChance).toBe(1);
  });
});

describe('resolveDecision', () => {
  const decision = buildDecision(eva, makeEnvironment({ radiationRisk: 1 }))!;

  it('aplica la penalización de la misión si fracasa', () => {
    const outcome = resolveDecision(decision, 'proceed', eva, new Rng(1));
    expect(outcome).toMatchObject({ attempted: true, success: false, effects: { oxygen: -6 } });
  });

  it('posponer nunca intenta la misión y cobra su coste', () => {
    const outcome = resolveDecision(decision, 'postpone', eva, new Rng(1));
    expect(outcome.attempted).toBe(false);
    expect(outcome.effects).toEqual({ oxygen: -0.5, food: -0.5 });
  });

  it('el blindaje acumula su coste energético con la penalización', () => {
    const outcome = resolveDecision({ ...decision, options: decision.options.map((o) => ({ ...o, successChance: 0 })) }, 'shield', eva, new Rng(1));
    expect(outcome.effects).toEqual({ power: -25, oxygen: -6 });
  });
});

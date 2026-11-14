import { describe, expect, it } from 'vitest';
import { makeEnvironment, makeMission } from '../../test-utils/factories';
import { Rng } from '../rng/Rng';
import { buildDecision, missionRisk, resolveDecision } from './DecisionEngine';

const eva = makeMission({ id: 'eva', type: 'eva', exposure: { radiation: 1, comms: 0.5 }, failurePenalty: { oxygen: -6 } });
const radio = makeMission({ id: 'radio', exposure: { radiation: 0, comms: 1 } });

describe('missionRisk', () => {
  it('combina radiación y apagón de radio ponderados por exposición', () => {
    const env = makeEnvironment({ radiationRisk: 0.5, radioBlackout: 2 });
    expect(missionRisk(eva, env)).toBeCloseTo(1 - 0.5 * (1 - 0.4 * 0.5));
    expect(missionRisk(radio, env)).toBeCloseTo(0.4);
    expect(missionRisk(makeMission(), env)).toBe(0);
  });
});

describe('buildDecision', () => {
  it('no exige decisión en condiciones tranquilas', () => {
    expect(buildDecision(eva, makeEnvironment({ radiationRisk: 0.1 }))).toBeNull();
  });

  it('explica la causa y ofrece opciones con probabilidades coherentes', () => {
    const decision = buildDecision(eva, makeEnvironment({ radiationRisk: 0.7, radioBlackout: 3 }))!;
    const [proceed, shield, postpone] = decision.options;
    expect(decision.prompt).toContain('actividad solar');
    expect(decision.prompt).toContain('R3');
    expect(shield!.successChance).toBeGreaterThan(proceed!.successChance);
    expect(postpone!.successChance).toBe(1);
  });

  it('ninguna opción es gratis salvo arriesgarse', () => {
    const decision = buildDecision(eva, makeEnvironment({ radiationRisk: 0.9 }))!;
    const [proceed, shield, postpone] = decision.options;
    expect(proceed!.successChance).toBeLessThan(1);
    expect(Object.keys(shield!.cost)).not.toHaveLength(0);
    expect(Object.keys(postpone!.cost)).not.toHaveLength(0);
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
    const certainFailure = { ...decision, options: decision.options.map((o) => ({ ...o, successChance: 0 })) };
    expect(resolveDecision(certainFailure, 'shield', eva, new Rng(1)).effects).toEqual({ power: -25, oxygen: -6 });
  });
});

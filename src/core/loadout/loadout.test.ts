import { describe, expect, it } from 'vitest';
import { OUTBOUND_ORDER, OUTBOUND_PROFILES, RETURN_RULES } from '../../content/loadouts';
import { makeGameState, makeSample } from '../../test-utils/factories';
import { isUnlocked } from '../progression/progression';
import {
  adjustCargo, applyOutboundLoadout, availableForReturn, cargoMass, initialReturnCargo, outboundResult, returnResult,
  samplesValue, supplyLight, withinLimit, type ReturnRules,
} from './loadout';

const RULES: ReturnRules = {
  massLimitKg: 100,
  spareKg: 10,
  shieldFullL: 40,
  recommended: { foodKg: 30, waterL: 20, shield: 0.5, spares: 1 },
  steps: { foodKg: 10, waterL: 5, shield: 0.25 },
};

const marsState = () =>
  makeGameState({
    phase: 'marsAscent',
    inventory: {
      foodKg: 50,
      spares: 3,
      samples: [
        makeSample({ id: 'a', massKg: 10, value: 1 }),
        makeSample({ id: 'b', massKg: 8, value: 5 }),
        makeSample({ id: 'c', massKg: 6, value: 3 }),
      ],
    },
    meters: { ...makeGameState().meters, lifeSupport: { oxygenKg: 40, waterL: 30, co2MmHg: 1 } },
    waterShield: 0.5,
  });

describe('carga de ida', () => {
  it('los tres perfiles existen y se muestran en orden', () => {
    expect([...OUTBOUND_ORDER].sort()).toEqual(Object.keys(OUTBOUND_PROFILES).sort());
  });

  it('escudo de agua protege más de la radiación y taller repara mejor (sin opción gratis)', () => {
    const { waterShield, workshop, balanced } = OUTBOUND_PROFILES;
    expect(waterShield.waterShield).toBeGreaterThan(balanced.waterShield);
    expect(balanced.waterShield).toBeGreaterThan(workshop.waterShield);
    expect(workshop.spares).toBeGreaterThan(balanced.spares);
    expect(balanced.spares).toBeGreaterThan(waterShield.spares);
    for (const profile of Object.values(OUTBOUND_PROFILES)) {
      expect([profile.lights.radiation, profile.lights.repairs]).not.toEqual(['green', 'green']);
    }
  });

  it('en el nivel 1 sólo está el equilibrado; taller en el 2 y escudo de agua en el 4', () => {
    expect(OUTBOUND_ORDER.filter((p) => isUnlocked(1, 'loadout', p))).toEqual(['balanced']);
    expect(OUTBOUND_ORDER.filter((p) => isUnlocked(2, 'loadout', p))).toEqual(['balanced', 'workshop']);
    expect(OUTBOUND_ORDER.filter((p) => isUnlocked(4, 'loadout', p))).toEqual(['waterShield', 'balanced', 'workshop']);
  });

  it('aplica agua, escudo, repuestos y comida, y lo anota en el historial', () => {
    const state = makeGameState({ phase: 'prep', loadout: null });
    const next = applyOutboundLoadout(state, OUTBOUND_PROFILES.workshop);
    expect(next).toMatchObject({ loadout: 'workshop', waterShield: 0.25 });
    expect(next.inventory).toMatchObject({ spares: 8, foodKg: 2000 });
    expect(next.meters.lifeSupport.waterL).toBe(OUTBOUND_PROFILES.workshop.waterL);
    expect(next.history.at(-1)).toMatchObject({ phase: 'prep', kind: 'loadout', key: 'outbound.workshop' });
    expect(state.loadout).toBeNull();
  });

  it('completa la fase de preparación', () => {
    expect(outboundResult(makeGameState({ phase: 'prep' }), OUTBOUND_PROFILES.balanced)).toMatchObject({
      phase: 'prep',
      outcome: 'completed',
    });
  });
});

describe('carga de vuelta', () => {
  it('ordena las muestras de más a menos valiosa y junta el agua de bebida y la del escudo', () => {
    const available = availableForReturn(marsState(), RULES);
    expect(available.samples.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(available.waterPoolL).toBe(30 + 0.5 * 40);
  });

  it('empieza con lo recomendado y todas las muestras que entran sin pasarse', () => {
    const available = availableForReturn(marsState(), RULES);
    const cargo = initialReturnCargo(available, RULES);
    expect(cargo).toEqual({ samples: 2, foodKg: 30, waterL: 20, shield: 0.5, spares: 1 });
    expect(cargoMass(cargo, available, RULES)).toBe(8 + 6 + 30 + 20 + 20 + 10);
    expect(withinLimit(cargo, available, RULES)).toBe(true);
    expect(withinLimit({ ...cargo, samples: 3 }, available, RULES)).toBe(false);
  });

  it('más muestras valen más ciencia pero pesan', () => {
    const available = availableForReturn(marsState(), RULES);
    const cargo = initialReturnCargo(available, RULES);
    const more = adjustCargo(cargo, 'samples', 1, available, RULES);
    expect(samplesValue(more, available)).toBeGreaterThan(samplesValue(cargo, available));
    expect(cargoMass(more, available, RULES)).toBeGreaterThan(cargoMass(cargo, available, RULES));
  });

  it('no deja llevar más de lo que hay', () => {
    const available = availableForReturn(marsState(), RULES);
    let cargo = initialReturnCargo(available, RULES);
    for (let i = 0; i < 10; i++) {
      cargo = adjustCargo(cargo, 'foodKg', 1, available, RULES);
      cargo = adjustCargo(cargo, 'spares', 1, available, RULES);
      cargo = adjustCargo(cargo, 'samples', 1, available, RULES);
    }
    expect(cargo).toMatchObject({ foodKg: 50, spares: 3, samples: 3 });
    for (let i = 0; i < 10; i++) cargo = adjustCargo(cargo, 'foodKg', -1, available, RULES);
    expect(cargo.foodKg).toBe(0);
  });

  it('el agua del escudo y la de bebida salen del mismo tanque', () => {
    const available = availableForReturn(marsState(), RULES);
    let cargo = initialReturnCargo(available, RULES);
    for (let i = 0; i < 10; i++) cargo = adjustCargo(cargo, 'waterL', 1, available, RULES);
    expect(cargo.waterL + cargo.shield * RULES.shieldFullL).toBeLessThanOrEqual(available.waterPoolL);
    expect(cargo.waterL).toBe(30);
    cargo = adjustCargo(cargo, 'shield', 1, available, RULES);
    expect(cargo.shield).toBe(0.5);
  });

  it('el semáforo de cada suministro compara con lo recomendado', () => {
    const cargo = { samples: 0, foodKg: 30, waterL: 15, shield: 0.25, spares: 1 };
    expect(supplyLight(cargo, 'foodKg', RULES)).toBe('green');
    expect(supplyLight(cargo, 'waterL', RULES)).toBe('yellow');
    expect(supplyLight(cargo, 'shield', RULES)).toBe('red');
  });

  it('sube a la nave lo elegido y deja el resto en Marte', () => {
    const state = marsState();
    const cargo = { samples: 1, foodKg: 20, waterL: 10, shield: 1, spares: 2 };
    const result = returnResult(state, cargo, RULES);
    expect(result.phase).toBe('marsAscent');
    expect(result.state.inventory.samples.map((s) => s.id)).toEqual(['b']);
    expect(result.state.inventory).toMatchObject({ foodKg: 20, spares: 2 });
    expect(result.state.waterShield).toBe(1);
    expect(result.state.meters.lifeSupport.waterL).toBe(10);
    expect(result.state.history.at(-1)).toMatchObject({ kind: 'loadout', key: 'return', data: { samples: 1 } });
    expect(state.inventory.samples).toHaveLength(3);
  });

  it('no acepta una carga que supera el límite', () => {
    const state = marsState();
    expect(() => returnResult(state, { samples: 3, foodKg: 50, waterL: 30, shield: 0.5, spares: 3 }, RULES)).toThrow();
  });

  it('con las reglas reales, lo recomendado deja lugar para algunas muestras y no para todo', () => {
    const { recommended, spareKg, shieldFullL, massLimitKg } = RETURN_RULES;
    const supplies = recommended.foodKg + recommended.waterL + recommended.shield * shieldFullL + recommended.spares * spareKg;
    expect(massLimitKg - supplies).toBeGreaterThan(20);
    expect(massLimitKg - supplies).toBeLessThan(200);
  });
});

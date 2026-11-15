import { describe, expect, it } from 'vitest';
import { CASCADE_RULES as C } from '../../content/cascade';
import { METER_RULES as R, SHIP_POWER } from '../../content/meters';
import { makeCrew, makeGameState, makeMeters } from '../../test-utils/factories';
import { stepMeters, type MeterEnvironment } from '../meters/step';
import type { GameState } from '../state/types';
import { applyEmergencyEffects, cascadeAdjustments, marginDays, updateCascade } from './cascade';
import { applySacrifice, availableSacrifices, canSacrifice, revertSacrifice } from './sacrifices';
import { initialCascade, type CascadeState } from './types';

const noWater = (over: Partial<GameState> = {}) =>
  makeGameState({ meters: makeMeters({ lifeSupport: { oxygenKg: 40, waterL: 0, co2MmHg: 2 } }), ...over });
const update = (cascade: CascadeState, state: GameState, hours = 1) => updateCascade(C, R, cascade, state, hours);
const storm: MeterEnvironment = {
  place: 'cruise',
  doseRateUGyH: 653,
  sepActive: true,
  solar: { panelKwAt1Au: SHIP_POWER.panelKwAt1Au, distanceAu: 1.2 },
};

describe('falla en cascada', () => {
  it('un medidor en cero entra en modo de emergencia con margen, sin terminar la partida', () => {
    const { cascade, events, state } = update(initialCascade(), noWater());
    expect(events).toEqual([{ type: 'entered', emergency: { meter: 'lifeSupport', marginHours: 48 } }]);
    expect(cascade.noReturnReasonKey).toBeNull();
    expect(marginDays(cascade.emergencies[0]!)).toBe(2);
    expect(state.history.at(-1)).toMatchObject({ kind: 'cascade', key: 'incidents.cascade.lifeSupport.entered' });
  });

  it('el margen se descuenta y al agotarse se avisa una vez', () => {
    let { cascade } = update(initialCascade(), noWater());
    const r1 = update(cascade, noWater(), 47);
    expect(r1.cascade.emergencies[0]).toMatchObject({ marginHours: 1, overdue: false });
    const r2 = update(r1.cascade, noWater(), 2);
    expect(r2.events).toEqual([{ type: 'overdue', meter: 'lifeSupport' }]);
    cascade = update(r2.cascade, noWater(), 2).cascade;
    expect(cascade.emergencies[0]!.overdue).toBe(true);
  });

  it('se sale de la emergencia al recuperar al menos un día de reservas', () => {
    const { cascade } = update(initialCascade(), noWater());
    expect(update(cascade, noWater({ meters: makeMeters({ lifeSupport: { oxygenKg: 40, waterL: 5, co2MmHg: 2 } }) })).events).toEqual([]);
    const ok = update(cascade, makeGameState());
    expect(ok.events).toEqual([{ type: 'exited', meter: 'lifeSupport' }]);
    expect(ok.cascade.emergencies).toEqual([]);
  });

  it('modo de emergencia de energía: sólo lo esencial, calefacción reducida y la salud baja cada hora', () => {
    const empty = makeGameState({ meters: makeMeters({ energy: { batteryKwh: 0, capacityKwh: 100 } }) });
    const { cascade } = update(initialCascade(), empty);
    const adj = cascadeAdjustments(C, cascade, empty.simDate);
    expect(adj).toMatchObject({ essentialOnly: true, heatingFactor: 0.5 });
    const after = applyEmergencyEffects(C, cascade, empty, 10);
    expect(after.crew[0]!.condition).toBeCloseTo(1 - 0.04);
  });

  it('modo de emergencia de soporte vital: raciona aire y agua y cansa más', () => {
    const { cascade } = update(initialCascade(), noWater());
    expect(cascadeAdjustments(C, cascade, noWater().simDate).lifeSupportFactor).toBe(0.75);
    expect(applyEmergencyEffects(C, cascade, noWater(), 10).crew[0]!.fatigue).toBeCloseTo(0.2);
  });

  it('con el margen agotado los efectos se duplican', () => {
    const cascade = update(update(initialCascade(), noWater()).cascade, noWater(), 50).cascade;
    expect(applyEmergencyEffects(C, cascade, noWater(), 10).crew[0]!.fatigue).toBeCloseTo(0.4);
  });

  it('comida agotada: raciones mínimas', () => {
    const state = makeGameState({ inventory: { foodKg: 0, spares: 0, samples: [] } });
    expect(cascadeAdjustments(C, update(initialCascade(), state).cascade, state.simDate).ration).toBe(0.5);
  });

  it('salud en cero: el tripulante queda en reposo en la enfermería y se recupera', () => {
    const crew = makeCrew().map((m) => (m.id === 'miga' ? { ...m, fatigue: 1, taskId: 'repair' } : m));
    const r = update(initialCascade(), makeGameState({ crew }));
    expect(r.events).toEqual([{ type: 'entered', emergency: { meter: 'health', crewId: 'miga', marginHours: 72 } }]);
    const miga = r.state.crew.find((m) => m.id === 'miga')!;
    expect(miga).toMatchObject({ resting: true, taskId: null, location: 'infirmary' });
    const rested = applyEmergencyEffects(C, r.cascade, r.state, 10);
    expect(rested.crew.find((m) => m.id === 'miga')!.fatigue).toBeCloseTo(0.5);
    const back = update(r.cascade, rested);
    expect(back.events).toEqual([{ type: 'exited', meter: 'health', crewId: 'miga' }]);
  });

  it('punto de no retorno: toda la tripulación en reposo a la vez', () => {
    const crew = makeCrew().map((m) => ({ ...m, fatigue: 1 }));
    const r = update(initialCascade(), makeGameState({ crew }));
    expect(r.cascade.noReturnReasonKey).toBe('incidents.cascade.noReturn.allResting');
    expect(r.events.at(-1)).toEqual({ type: 'noReturn', reasonKey: 'incidents.cascade.noReturn.allResting' });
  });

  it('punto de no retorno: dos medidores agotados más tiempo que su margen', () => {
    const both = noWater({ meters: makeMeters({ energy: { batteryKwh: 0, capacityKwh: 100 }, lifeSupport: { oxygenKg: 40, waterL: 0, co2MmHg: 2 } }) });
    let r = update(initialCascade(), both);
    r = update(r.cascade, both, 47);
    expect(r.cascade.noReturnReasonKey).toBeNull();
    r = update(r.cascade, both, 2);
    expect(r.cascade.noReturnReasonKey).toBe('incidents.cascade.noReturn.twoMeters');
    expect(update(r.cascade, both).events.filter((e) => e.type === 'noReturn')).toEqual([]);
  });
});

describe('sacrificios', () => {
  it('sólo se ofrecen los del medidor en emergencia y del lugar', () => {
    const { cascade, state } = update(initialCascade(), noWater());
    expect(availableSacrifices(cascade, state, 'cruise').map((s) => s.id)).toEqual(['drinkWaterShield', 'boostRecycler']);
    expect(availableSacrifices(cascade, state, 'mars').map((s) => s.id)).toEqual(['drinkWaterShield', 'boostRecycler', 'boostMoxie']);
    expect(availableSacrifices(initialCascade(), state, 'cruise')).toEqual([]);
  });

  it('acepta S3: beber el escudo de agua → el refugio pasa a 0,6 → más dosis en la tormenta siguiente', () => {
    const entered = update(initialCascade(), noWater());
    const drank = applySacrifice(C, R, entered.cascade, entered.state, 'drinkWaterShield');
    expect(drank.event).toEqual({ id: 'drinkWaterShield', meter: 'lifeSupport' });
    expect(drank.state.waterShield).toBe(0);
    expect(drank.state.meters.lifeSupport.waterL).toBe(1200);
    expect(update(drank.cascade, drank.state).events).toEqual([{ type: 'exited', meter: 'lifeSupport' }]);
    expect(canSacrifice(drank.cascade, drank.state, 'cruise', 'drinkWaterShield')).toBe(false);

    const inShelter = (s: GameState) => ({ ...s, crew: s.crew.map((m) => ({ ...m, location: 'shelter' })) });
    const plan = { loadKw: 6.5 };
    const before = stepMeters(R, inShelter(makeGameState({ waterShield: 1 })), storm, plan, 6).doseMSv.vega;
    const after = stepMeters(R, inShelter(drank.state), storm, plan, 6).doseMSv.vega;
    expect(after / before).toBeCloseTo(0.6 / 0.2);
    expect(drank.state.history.at(-1)).toMatchObject({ kind: 'cascade', key: 'incidents.sacrifice.drinkWaterShield.title' });
  });

  it('desconectar el refugio ahorra energía pero el refugio pierde eficacia', () => {
    const empty = makeGameState({ meters: makeMeters({ energy: { batteryKwh: 0, capacityKwh: 100 } }) });
    const { cascade, state } = update(initialCascade(), empty);
    const r = applySacrifice(C, R, cascade, state, 'unpowerShelter');
    const adj = cascadeAdjustments(C, r.cascade, state.simDate);
    expect(adj.extraLoadKw).toBe(-0.5);
    expect(adj.shelterEfficacy).toBe(0.5);
    expect(cascadeAdjustments(C, revertSacrifice(r.cascade, 'unpowerShelter'), state.simDate).shelterEfficacy).toBe(1);
  });

  it('limpiar los paneles: EVA con dosis y cansancio, y paneles sin polvo por 3 soles', () => {
    const empty = makeGameState({ meters: makeMeters({ energy: { batteryKwh: 0, capacityKwh: 100 } }) });
    const { cascade, state } = update(initialCascade(), empty);
    const r = applySacrifice(C, R, cascade, state, 'cleanPanels', { crewId: 'senda', doseRateUGyH: 10 });
    const senda = r.state.crew.find((m) => m.id === 'senda')!;
    expect(senda.fatigue).toBeCloseTo(0.2);
    expect(senda.doseMSv).toBeCloseTo((10 * 1 * 3.05 * 2) / 1000);
    expect(cascadeAdjustments(C, r.cascade, state.simDate).dustFactorOverride).toBe(1);
    expect(cascadeAdjustments(C, r.cascade, '2024-01-19T00:00:00Z').dustFactorOverride).toBeNull();
  });

  it('apagar MOXIE baja el O2 fabricado; reforzarlo cuesta energía', () => {
    const { cascade, state } = update(initialCascade(), makeGameState({ meters: makeMeters({ energy: { batteryKwh: 0, capacityKwh: 100 } }) }));
    const off = applySacrifice(C, R, cascade, state, 'moxieOff');
    expect(cascadeAdjustments(C, off.cascade, state.simDate)).toMatchObject({ moxieOn: false, extraLoadKw: -2 });
    const air = update(initialCascade(), noWater());
    const boost = applySacrifice(C, R, air.cascade, air.state, 'boostMoxie');
    expect(cascadeAdjustments(C, boost.cascade, state.simDate)).toMatchObject({ extraLoadKw: 2, extraOxygenKgPerDay: 1.5 });
  });

  it('la geóloga-médica atiende al paciente: se recupera el doble y el resto se cansa más', () => {
    const crew = makeCrew().map((m) => (m.id === 'miga' ? { ...m, fatigue: 1 } : m));
    const r = update(initialCascade(), makeGameState({ crew }));
    expect(canSacrifice(r.cascade, r.state, 'cruise', 'medicCare')).toBe(true);
    const care = applySacrifice(C, R, r.cascade, r.state, 'medicCare');
    expect(care.cascade.flags.medicCaring).toBe('miga');
    expect(care.state.crew.find((m) => m.id === 'senda')).toMatchObject({ taskId: null, location: 'infirmary' });
    expect(care.state.crew.find((m) => m.id === 'vega')!.fatigue).toBeCloseTo(0.1);
    const later = applyEmergencyEffects(C, care.cascade, care.state, 5);
    expect(later.crew.find((m) => m.id === 'miga')!.fatigue).toBeCloseTo(0.5);
  });

  it('raciones extra al paciente gastan comida', () => {
    const crew = makeCrew().map((m) => (m.id === 'brote' ? { ...m, condition: 0.1, nutrition: 0.5 } : m));
    const r = update(initialCascade(), makeGameState({ crew }));
    const fed = applySacrifice(C, R, r.cascade, r.state, 'extraRations');
    expect(fed.state.inventory.foodKg).toBeCloseTo(400 - 1.8);
    expect(fed.state.crew.find((m) => m.id === 'brote')).toMatchObject({ nutrition: 1 });
    expect(fed.state.crew.find((m) => m.id === 'brote')!.condition).toBeCloseTo(0.15);
  });

  it('reducir rutinas baja el trabajo de los demás', () => {
    const crew = makeCrew().map((m) => (m.id === 'miga' ? { ...m, fatigue: 1 } : m));
    const r = update(initialCascade(), makeGameState({ crew }));
    const less = applySacrifice(C, R, r.cascade, r.state, 'reduceRoutines');
    expect(cascadeAdjustments(C, less.cascade, r.state.simDate).workFactor).toBe(0.5);
  });
});

import { describe, expect, it } from 'vitest';
import { GALE_POWER, METER_RULES as R, SHIP_POWER } from '../../content/meters';
import { makeCrew, makeGameState, makeMeters } from '../../test-utils/factories';
import { energyLight, healthLights, lifeSupportLight } from './lights';
import { stepMeters, type MeterEnvironment } from './step';

const cruise: MeterEnvironment = {
  place: 'cruise',
  doseRateUGyH: 6.5,
  sepActive: false,
  solar: { panelKwAt1Au: SHIP_POWER.panelKwAt1Au, distanceAu: 1 },
};
const shipLoad = Object.values(SHIP_POWER.loadsKw).reduce((a, b) => a + b, 0);

describe('stepMeters', () => {
  it('un día de crucero tranquilo: consume O2, agua y comida y suma dosis de fondo', () => {
    const state = makeGameState();
    const { state: next, doseMSv } = stepMeters(R, state, cruise, { loadKw: shipLoad }, 24);
    expect(next.meters.lifeSupport.oxygenKg).toBeCloseTo(state.meters.lifeSupport.oxygenKg - 4 * 0.82);
    expect(next.inventory.foodKg).toBeCloseTo(state.inventory.foodKg - 4 * 1.8);
    expect(doseMSv.vega).toBeCloseTo((6.5 * 0.6 * 3.8 * 24) / 1000);
    expect(next.crew[0]!.doseMSv).toBeCloseTo(doseMSv.vega);
    expect(state.crew[0]!.doseMSv).toBe(0);
  });

  it('en la tormenta, quien está en el refugio recibe menos dosis', () => {
    const crew = makeCrew().map((m) => (m.id === 'vega' ? m : { ...m, location: 'shelter' }));
    const { doseMSv } = stepMeters(R, makeGameState({ crew }), { ...cruise, doseRateUGyH: 653, sepActive: true }, { loadKw: shipLoad }, 1);
    expect(doseMSv.vega / doseMSv.miga).toBeCloseTo(3);
  });

  it('beber el escudo de agua deja el refugio en 0,6: más dosis en la tormenta', () => {
    const crew = makeCrew().map((m) => ({ ...m, location: 'shelter' }));
    const storm = { ...cruise, doseRateUGyH: 653, sepActive: true };
    const full = stepMeters(R, makeGameState({ crew, waterShield: 1 }), storm, { loadKw: shipLoad }, 1).doseMSv.vega;
    const empty = stepMeters(R, makeGameState({ crew, waterShield: 0 }), storm, { loadKw: shipLoad }, 1).doseMSv.vega;
    expect(empty / full).toBeCloseTo(3);
  });

  it('en Marte de noche, con polvo y frío, la batería se vacía y se informa el déficit', () => {
    const state = makeGameState({ meters: makeMeters({ energy: { batteryKwh: 10, capacityKwh: GALE_POWER.capacityKwh } }) });
    const night: MeterEnvironment = {
      place: 'mars',
      doseRateUGyH: 9,
      sepActive: false,
      solar: { panelKwAt1Au: GALE_POWER.panelKwAt1Au, distanceAu: 1.52, dustFactor: 0.45, lightFactor: 0 },
      minTempC: -69,
    };
    const result = stepMeters(R, state, night, { loadKw: 4.8 }, 12);
    expect(result.generationKw).toBe(0);
    expect(result.loadKw).toBeCloseTo(4.8 + 2.7);
    expect(result.state.meters.energy.batteryKwh).toBe(0);
    expect(result.deficitKwh).toBeCloseTo(7.5 * 12 - 10);
  });

  it('el CO2 alto por un depurador roto cansa a la tripulación', () => {
    const state = makeGameState({
      systems: { ...makeGameState().systems, scrubber: 'red' },
      meters: makeMeters({ lifeSupport: { oxygenKg: 40, waterL: 300, co2MmHg: 3.5 } }),
    });
    const { state: next } = stepMeters(R, state, cruise, { loadKw: shipLoad }, 10);
    expect(next.meters.lifeSupport.co2MmHg).toBeGreaterThan(3.5);
    expect(next.crew[0]!.fatigue).toBeGreaterThan(0);
  });
});

describe('semáforos', () => {
  it('energía: verde, amarillo y rojo según la carga de la batería', () => {
    expect(energyLight(makeMeters({ energy: { batteryKwh: 60, capacityKwh: 100 } }))).toBe('green');
    expect(energyLight(makeMeters({ energy: { batteryKwh: 20, capacityKwh: 100 } }))).toBe('yellow');
    expect(energyLight(makeMeters({ energy: { batteryKwh: 5, capacityKwh: 100 } }))).toBe('red');
  });

  it('soporte vital: manda el peor entre O2, agua y CO2', () => {
    expect(lifeSupportLight(R, makeMeters(), 4)).toBe('green');
    expect(lifeSupportLight(R, makeMeters({ lifeSupport: { oxygenKg: 40, waterL: 300, co2MmHg: 4 } }), 4)).toBe('yellow');
    expect(lifeSupportLight(R, makeMeters({ lifeSupport: { oxygenKg: 3, waterL: 300, co2MmHg: 2 } }), 4)).toBe('red');
  });

  it('salud: cuatro íconos y el peor manda', () => {
    const lights = healthLights(R, { ...makeCrew()[0]!, fatigue: 0.7, doseMSv: 100 });
    expect(lights).toEqual({ dose: 'green', condition: 'green', nutrition: 'green', fatigue: 'yellow', overall: 'yellow' });
  });
});

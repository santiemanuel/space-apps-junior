import { describe, expect, it } from 'vitest';
import { METER_RULES as R } from '../../content/meters';
import { makeCrewMember } from '../../test-utils/factories';
import { careerFraction, chestXrays, doseMSv, qualityFactor, shieldingFactor, shieldZoneOf } from './dose';
import { cruiseDistanceAu, dustFactorFromUv, heatingKw, MARS_DISTANCE_AU, solarGenerationKw, stepEnergy } from './energy';
import { kcalOf, stepCrewHealth, stepFood } from './health';
import { nextCo2, stepLifeSupport, waterUsedL } from './lifeSupport';

describe('energía', () => {
  it('en Marte (1,52 UA) llega el 43 % de la luz', () => {
    expect(solarGenerationKw({ panelKwAt1Au: 1, distanceAu: MARS_DISTANCE_AU })).toBeCloseTo(0.43, 2);
  });

  it('generación = P × 1/r² × f_polvo × f_luz', () => {
    expect(solarGenerationKw({ panelKwAt1Au: 50, distanceAu: 1.52, dustFactor: 0.45, lightFactor: 0.5 })).toBeCloseTo(
      (50 * 0.45 * 0.5) / 1.52 ** 2,
    );
  });

  it('f_polvo según el UV de REMS: alto 1, moderado 0,85, bajo 0,45', () => {
    expect(dustFactorFromUv(R, 'Very_High')).toBe(1);
    expect(dustFactorFromUv(R, 'High')).toBe(1);
    expect(dustFactorFromUv(R, 'Moderate')).toBe(0.85);
    expect(dustFactorFromUv(R, 'Low')).toBe(0.45);
    expect(dustFactorFromUv(R, null)).toBe(1);
  });

  it('calefacción = k × (T_interior − T_mín), nunca negativa', () => {
    expect(heatingKw(R, -69)).toBeCloseTo(0.03 * 90);
    expect(heatingKw(R, 30)).toBe(0);
  });

  it('la distancia al Sol va de 1 a 1,52 UA en la ida y vuelve en la vuelta', () => {
    expect(cruiseDistanceAu(0, 'out')).toBe(1);
    expect(cruiseDistanceAu(1, 'out')).toBeCloseTo(1.52);
    expect(cruiseDistanceAu(0, 'back')).toBeCloseTo(1.52);
    expect(cruiseDistanceAu(0.5, 'back')).toBeCloseTo(1.26);
  });

  it('la batería tiene tope y avisa lo que faltó', () => {
    const full = stepEnergy({ batteryKwh: 90, capacityKwh: 100 }, 10, 2, 2);
    expect(full).toEqual({ energy: { batteryKwh: 100, capacityKwh: 100 }, deficitKwh: 0, wastedKwh: 6 });
    const empty = stepEnergy({ batteryKwh: 5, capacityKwh: 100 }, 0, 4, 2);
    expect(empty).toEqual({ energy: { batteryKwh: 0, capacityKwh: 100 }, deficitKwh: 3, wastedKwh: 0 });
  });
});

describe('soporte vital', () => {
  const base = { crewCount: 4, hours: 24, scrubber: 'green', waterRecycler: 'green' } as const;
  const ls = { oxygenKg: 40, waterL: 100, co2MmHg: 2 };

  it('O2: 0,82 kg por tripulante y día (BVAD)', () => {
    expect(stepLifeSupport(R, ls, base).lifeSupport.oxygenKg).toBeCloseTo(40 - 4 * 0.82);
  });

  it('agua: 2,5 L por tripulante y día + 240 mL por hora de EVA', () => {
    expect(waterUsedL(R, 4, 24)).toBeCloseTo(10);
    expect(waterUsedL(R, 4, 24, 3)).toBeCloseTo(10.72);
  });

  it('el reciclador recupera del 98 % (sano) al 90 % (roto)', () => {
    expect(stepLifeSupport(R, ls, base).lifeSupport.waterL).toBeCloseTo(100 - 10 * 0.02);
    expect(stepLifeSupport(R, ls, { ...base, waterRecycler: 'red' }).lifeSupport.waterL).toBeCloseTo(100 - 10 * 0.1);
  });

  it('MOXIE suma O2 y lo que falta se informa', () => {
    expect(stepLifeSupport(R, ls, { ...base, oxygenProducedKg: 1.5 }).lifeSupport.oxygenKg).toBeCloseTo(40 - 3.28 + 1.5);
    const out = stepLifeSupport(R, { ...ls, oxygenKg: 1 }, base);
    expect(out.lifeSupport.oxygenKg).toBe(0);
    expect(out.oxygenShortKg).toBeCloseTo(2.28);
  });

  it('el CO2 sube con el depurador averiado y pasa el límite de 3 mmHg', () => {
    expect(nextCo2(R, 2, 'red', 4, 24)).toBeCloseTo(3.5);
    expect(nextCo2(R, 2, 'red', 4, 24)).toBeGreaterThan(R.lifeSupport.co2LimitMmHg);
    expect(nextCo2(R, 2, 'yellow', 4, 48)).toBeCloseTo(3);
  });

  it('con el depurador sano el CO2 vuelve al nominal sin bajar de él', () => {
    expect(nextCo2(R, 5, 'green', 4, 24)).toBeCloseTo(3);
    expect(nextCo2(R, 5, 'green', 4, 240)).toBe(2);
    expect(nextCo2(R, 1.5, 'green', 4, 24)).toBe(1.5);
  });
});

describe('dosis', () => {
  it('Marte: 0,21 mGy/día absorbidos con Q 3,05 dan 0,64 mSv/día (Hassler 2014)', () => {
    const rate = 210 / 24; // μGy/h
    expect(doseMSv(rate, 1, qualityFactor(R, 'mars', false), 24)).toBeCloseTo(0.64, 2);
  });

  it('crucero: 0,48 mGy/día con Q 3,8 dan ~1,84 mSv/día (Zeitlin 2013)', () => {
    expect(doseMSv(480 / 24, 1, qualityFactor(R, 'cruise', false), 24)).toBeCloseTo(1.84, 1);
  });

  it('durante un SEP el Q se simplifica a 1,5', () => {
    expect(qualityFactor(R, 'cruise', true)).toBe(1.5);
    expect(qualityFactor(R, 'mars', true)).toBe(1.5);
  });

  it('blindaje: exterior 1, hábitat 0,6, refugio de 0,2 lleno a 0,6 vacío', () => {
    expect(shieldingFactor(R, 'exterior', 1)).toBe(1);
    expect(shieldingFactor(R, 'habitat', 1)).toBe(0.6);
    expect(shieldingFactor(R, 'shelter', 1)).toBeCloseTo(0.2);
    expect(shieldingFactor(R, 'shelter', 0)).toBeCloseTo(0.6);
    expect(shieldingFactor(R, 'shelter', 0.5)).toBeCloseTo(0.4);
  });

  it('la ubicación del tripulante define su zona de blindaje', () => {
    expect(shieldZoneOf('shelter')).toBe('shelter');
    expect(shieldZoneOf('eva')).toBe('exterior');
    expect(shieldZoneOf('greenhouse')).toBe('habitat');
  });

  it('tormenta de mayo de 2024 (653 μGy/h): el refugio lleno reduce la dosis 3 veces', () => {
    const inHabitat = doseMSv(653, shieldingFactor(R, 'habitat', 1), R.dose.qSep, 1);
    const inShelter = doseMSv(653, shieldingFactor(R, 'shelter', 1), R.dose.qSep, 1);
    expect(inHabitat / inShelter).toBeCloseTo(3);
  });

  it('para niños: radiografías de tórax (0,1 mSv) y fracción del límite de 600 mSv', () => {
    expect(chestXrays(R, 0.64)).toBeCloseTo(6.4);
    expect(careerFraction(R, 300)).toBe(0.5);
  });
});

describe('nutrición y salud', () => {
  it('1,8 kg de comida (3035 kcal) por tripulante y día', () => {
    expect(stepFood(R, 100, 4, 24)).toEqual({ foodKg: 100 - 7.2, nutrition: 1 });
    expect(kcalOf(R, 1.8)).toBe(3035);
  });

  it('racionar o quedarse sin comida baja la nutrición', () => {
    expect(stepFood(R, 100, 4, 24, 0.5).nutrition).toBeCloseTo(0.5);
    expect(stepFood(R, 3.6, 4, 24)).toEqual({ foodKg: 0, nutrition: 0.5 });
  });

  const day = { hours: 24, co2MmHg: 2, nutrition: 1 };

  it('sin ejercicio la condición baja; con 2 h por día sube', () => {
    expect(stepCrewHealth(R, makeCrewMember({ condition: 0.8 }), day).condition).toBeCloseTo(0.78);
    expect(stepCrewHealth(R, makeCrewMember({ condition: 0.8 }), { ...day, exerciseHours: 2 }).condition).toBeCloseTo(0.81);
  });

  it('comer menos baja la condición física y el ánimo', () => {
    const hungry = stepCrewHealth(R, makeCrewMember({ condition: 0.8, morale: 0.8 }), { ...day, exerciseHours: 2, nutrition: 0 });
    expect(hungry.condition).toBeCloseTo(0.78);
    expect(hungry.morale).toBeCloseTo(0.74);
    expect(hungry.nutrition).toBe(0);
  });

  it('el cansancio sube trabajando y con CO2 alto, y baja durmiendo', () => {
    const tired = stepCrewHealth(R, makeCrewMember({ fatigue: 0.2 }), { hours: 10, co2MmHg: 2, nutrition: 1, workHours: 10 });
    expect(tired.fatigue).toBeCloseTo(0.7);
    const co2 = stepCrewHealth(R, makeCrewMember({ fatigue: 0.2 }), { hours: 10, co2MmHg: 4, nutrition: 1, workHours: 10 });
    expect(co2.fatigue).toBeCloseTo(0.8);
    const rested = stepCrewHealth(R, makeCrewMember({ fatigue: 0.7 }), { hours: 8, co2MmHg: 2, nutrition: 1, sleepHours: 8 });
    expect(rested.fatigue).toBeCloseTo(0);
  });

  it('hablar con la Tierra levanta el ánimo', () => {
    expect(stepCrewHealth(R, makeCrewMember({ morale: 0.5 }), { ...day, callsHome: 1 }).morale).toBeCloseTo(0.64);
  });
});

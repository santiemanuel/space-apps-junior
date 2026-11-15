import { describe, expect, it } from 'vitest';
import { availableForReturn, initialReturnCargo, withinLimit } from '../core/loadout/loadout';
import { sampleSites } from '../core/mars/MarsSession';
import { makeGameState } from '../test-utils/factories';
import { MARS_CONTENT } from './gale';
import { OUTBOUND_MASS_KG, OUTBOUND_ORDER, OUTBOUND_PROFILES, outboundMassKg, RETURN_RULES } from './loadouts';

describe('límites de masa de las cargas', () => {
  it('los tres perfiles de ida pesan lo mismo: sólo cambia el reparto entre agua y repuestos', () => {
    for (const id of OUTBOUND_ORDER) expect(outboundMassKg(OUTBOUND_PROFILES[id])).toBe(OUTBOUND_MASS_KG);
  });

  it('el nivel de agua de cada perfil sigue el total de agua (bebida y escudo)', () => {
    const water = (id: keyof typeof OUTBOUND_PROFILES) => OUTBOUND_PROFILES[id].waterL + OUTBOUND_PROFILES[id].waterShield * RETURN_RULES.shieldFullL;
    expect(water('waterShield')).toBeGreaterThan(water('balanced'));
    expect(water('balanced')).toBeGreaterThan(water('workshop'));
  });

  it('en la vuelta, con lo recomendado entran algunas muestras de Gale y no todas', () => {
    const sites = sampleSites(MARS_CONTENT, 2024, 5);
    const samples = sites.map((s) => ({ id: s.id, siteId: s.id, massKg: s.massKg, value: s.value }));
    const { recommended, shieldFullL } = RETURN_RULES;
    const state = makeGameState({
      phase: 'marsAscent',
      waterShield: recommended.shield,
      inventory: { foodKg: recommended.foodKg + 200, spares: recommended.spares + 2, samples },
      meters: { ...makeGameState().meters, lifeSupport: { oxygenKg: 400, waterL: recommended.waterL + shieldFullL, co2MmHg: 2 } },
    });
    const available = availableForReturn(state, RETURN_RULES);
    const cargo = initialReturnCargo(available, RETURN_RULES);
    expect(cargo).toMatchObject({ foodKg: recommended.foodKg, waterL: recommended.waterL, shield: recommended.shield, spares: recommended.spares });
    expect(cargo.samples).toBeGreaterThanOrEqual(2);
    expect(cargo.samples).toBeLessThan(samples.length);
    expect(withinLimit({ ...cargo, samples: samples.length }, available, RETURN_RULES)).toBe(false);
  });
});

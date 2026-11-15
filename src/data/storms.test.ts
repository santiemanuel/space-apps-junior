import { describe, expect, it } from 'vitest';
import { CAMPAIGN_2024 } from '../content/campaign';
import { createPhaseClock, stormAlert } from '../core/clock/schedule';
import { stormsBetween } from '../core/environment/storms';
import { DEEP_SPACE_STORMS } from './storms';

const { cruiseOut } = CAMPAIGN_2024.windows;

describe('tormentas en espacio profundo', () => {
  it('la tormenta de mayo de 2024 se detecta en DONKI el 8/5 y sube la dosis el 11/5', () => {
    const may = DEEP_SPACE_STORMS.find((s) => s.id === 'storm-2024-05-11')!;
    expect(may.warnAt).toBe('2024-05-08T05:09:00Z');
    expect(may.impactAt).toBe('2024-05-11T02:10:00Z');
    expect(may.warning).toMatchObject({ kind: 'donkiFlare', classType: 'X1.0' });
    expect(may.capped).toBe(false);
  });

  it('marca como recortadas las tormentas por encima del tope de 650 μGy/h', () => {
    const june = DEEP_SPACE_STORMS.find((s) => s.id === 'storm-2024-06-08')!;
    expect(june.capped).toBe(true);
    expect(june.peakMeanUGyH).toBeGreaterThan(650);
  });

  it('cada tormenta avisa antes de impactar y termina después', () => {
    for (const s of DEEP_SPACE_STORMS) {
      expect(Date.parse(s.warnAt), s.id).toBeLessThanOrEqual(Date.parse(s.impactAt));
      expect(Date.parse(s.impactAt), s.id).toBeLessThan(Date.parse(s.endAt));
    }
  });

  it('acepta S1: en los ~120 días de ida el reloj se frena el 8/5/2024, antes de la tormenta de mayo', () => {
    const storms = stormsBetween(DEEP_SPACE_STORMS, cruiseOut.start, cruiseOut.end);
    const clock = createPhaseClock({ calendar: CAMPAIGN_2024, phase: 'cruiseOut', length: 'short', alerts: storms.map(stormAlert) });
    const brakes: { at: string; alertId: string | null }[] = [];
    let days = 0;
    while (!clock.finished) {
      for (const e of clock.advance(1 / 30)) {
        if (e.type === 'day') days++;
        if (e.type === 'level' && e.level === 'alert') brakes.push({ at: e.at, alertId: e.alertId });
        // La tripulación llega al refugio: el reloj vuelve a la calma.
        if (e.type === 'level' && e.level === 'impact') clock.resolve(e.alertId!);
      }
    }
    expect(days).toBe(121); // 15/01 → 15/05 de 2024 (bisiesto)
    const may = brakes.find((b) => b.alertId === 'storm-2024-05-11');
    expect(may?.at).toBe('2024-05-08T05:09:00.000Z');
    expect(brakes.map((b) => b.at.slice(0, 10))).toEqual(['2024-01-29', '2024-02-07', '2024-03-23', '2024-05-08']);
  });
});

import { describe, expect, it } from 'vitest';
import { doseRateOn, galeWeatherOn, SERIES_RANGES } from './series';

describe('series diarias reales', () => {
  it('BioSentinel: tormenta de mayo de 2024 sin recortar', () => {
    expect(doseRateOn('deepSpace', '2024-05-11T12:00:00Z')).toEqual({ date: '2024-05-11', uGyH: 282.84, capped: false });
  });

  it('BioSentinel: el 08/06/2024 (2513 μGy/h) queda en el tope de 650 y se marca', () => {
    expect(doseRateOn('deepSpace', '2024-06-08')).toEqual({ date: '2024-06-08', uGyH: 650, capped: true });
  });

  it('Curiosity RAD: el día del evento SEP del 20/05/2024 supera varias veces el fondo', () => {
    const quiet = doseRateOn('marsSurface', '2024-05-15').uGyH;
    expect(doseRateOn('marsSurface', '2024-05-20').uGyH).toBeGreaterThan(3 * quiet);
  });

  it('sin dato ese día usa el último día con dato', () => {
    const last = SERIES_RANGES.marsSurface.end;
    expect(doseRateOn('marsSurface', '2024-07-01').date).toBe(last);
  });

  it('TGO en crucero cubre 2016', () => {
    expect(SERIES_RANGES.marsCruise.start.startsWith('2016')).toBe(true);
    expect(doseRateOn('marsCruise', '2016-06-01').uGyH).toBeGreaterThan(10);
  });

  it('REMS: el 16/05/2024 la mínima cruda de −98 °C se ajusta a la de los soles vecinos', () => {
    const w = galeWeatherOn('2024-05-16');
    expect(w).toMatchObject({ sol: 4186, adjusted: true, uv: 'Moderate' });
    expect(w.minTempC).toBeGreaterThan(-75);
  });

  it('REMS: un día normal no se toca', () => {
    expect(galeWeatherOn('2024-05-15')).toMatchObject({ sol: 4185, minTempC: -68, maxTempC: -2, adjusted: false });
  });
});

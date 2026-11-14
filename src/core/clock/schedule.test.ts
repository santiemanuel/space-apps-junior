import { describe, expect, it } from 'vitest';
import { CAMPAIGN_2024 } from '../../content/campaign';
import { createPhaseClock, evenPlayWindows } from './schedule';

describe('calendario de fases', () => {
  it('reparte las jornadas jugadas de forma pareja', () => {
    const windows = evenPlayWindows({ start: '2024-01-15T00:00:00Z', end: '2024-05-15T00:00:00Z' }, 4);
    expect(windows.map((w) => w.start.slice(0, 10))).toEqual(['2024-01-15', '2024-02-14', '2024-03-15', '2024-04-14']);
  });

  it('no juega más jornadas que días tiene la fase', () => {
    expect(evenPlayWindows({ start: '2024-05-15T00:00:00Z', end: '2024-05-18T00:00:00Z' }, 10)).toHaveLength(3);
  });

  it.each(['short', 'long'] as const)('la ida dura 121 días reales (2024 es bisiesto) en modo %s', (length) => {
    const clock = createPhaseClock({ calendar: CAMPAIGN_2024, phase: 'cruiseOut', length });
    const days = clock.advance(100_000).filter((e) => e.type === 'day');
    expect(days).toHaveLength(121);
    expect(clock.simDate).toBe('2024-05-15T00:00:00.000Z');
  });

  it('empieza jugando la primera jornada', () => {
    const clock = createPhaseClock({ calendar: CAMPAIGN_2024, phase: 'mars', length: 'short' });
    expect(clock.pace).toBe('play');
    expect(clock.hoursPerSecond).toBeCloseTo(24 / 90);
  });
});

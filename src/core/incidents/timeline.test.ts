import { describe, expect, it } from 'vitest';
import { INCIDENT_RULES as R } from '../../content/incidents';
import type { DailyDose, MarsWeather } from '../environment/series';
import type { SpaceStorm } from '../environment/storms';
import { coldTimeline, conjunctionTimeline, dustTimeline, marsRadiationTimeline, stormTimeline, timelineBetween } from './timeline';

const day = (i: number) => new Date(Date.UTC(2024, 4, 1) + i * 86_400_000).toISOString().slice(0, 10);
const dose = (rates: number[]): DailyDose[] => rates.map((uGyH, i) => ({ date: day(i), uGyH, capped: false }));
const weather = (rows: [number, MarsWeather['uv']][]): MarsWeather[] =>
  rows.map(([minTempC, uv], i) => ({ date: day(i), sol: 4000 + i, minTempC, maxTempC: null, uv, adjusted: false }));

const storm: SpaceStorm = {
  id: 'storm-x',
  warnAt: '2024-06-06T15:06:00Z',
  impactAt: '2024-06-08T02:25:00Z',
  endAt: '2024-06-11T00:00:00Z',
  leadHours: 35.3,
  warning: { kind: 'donkiFlare', classType: 'M7.2', link: 'https://donki/flr' },
  peakMeanUGyH: 2513.3,
  baselineUGyH: 6.5,
  capped: true,
  sourceLinks: ['https://donki/flr', 'https://donki/sep'],
};

describe('línea de tiempo real', () => {
  it('una tormenta de BioSentinel conserva la antelación real y recorta el pico al tope (§3.2.1)', () => {
    const [entry] = stormTimeline([storm], R, 'https://radlab');
    expect(entry).toMatchObject({ definitionId: 'radiationStorm', warnAt: storm.warnAt, impactAt: storm.impactAt, endAt: storm.endAt });
    expect(entry!.realEvent).toMatchObject({
      mission: 'BioSentinel',
      value: 650,
      capped: true,
      kidValueParams: { times: 100 },
      sourceUrl: 'https://donki/flr',
    });
  });

  it('en Marte, un día de RAD por encima de 5 × la mediana previa es una tormenta con 48 h de aviso', () => {
    const rates = [...Array(27).fill(4.5), 69.3, 12, 4.6];
    const [entry, ...rest] = marsRadiationTimeline(dose(rates), R, 48, 'https://radlab');
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({ id: `mars-storm-${day(27)}`, impactAt: `${day(27)}T00:00:00.000Z`, endAt: `${day(28)}T00:00:00.000Z` });
    expect(Date.parse(entry!.impactAt) - Date.parse(entry!.warnAt)).toBe(48 * 3_600_000);
    expect(entry!.realEvent).toMatchObject({ instrument: 'RAD', mission: 'Curiosity', value: 69.3, kidValueParams: { times: 15 } });
  });

  it('los soles seguidos con UV "Low" forman una sola tormenta de polvo', () => {
    const entries = dustTimeline(weather([[-70, 'Moderate'], [-70, 'Low'], [-70, 'Low'], [-70, 'Moderate'], [-70, 'Low']]), 24, 'u');
    expect(entries.map((e) => [e.id, e.endAt.slice(0, 10)])).toEqual([
      [`dust-${day(1)}`, day(3)],
      [`dust-${day(4)}`, day(5)],
    ]);
    expect(entries[0]!.realEvent.kidValueParams).toEqual({ sol: 4001, sols: 2 });
  });

  it('una noche es extrema si baja 4 °C de la mediana de los 7 soles previos o de −85 °C', () => {
    const temps: [number, MarsWeather['uv']][] = [...Array(7).fill([-69, 'High']), [-72, 'High'], [-73, 'High'], [-86, 'High']];
    expect(coldTimeline(weather(temps), R, 12, 'u').map((e) => [e.id, e.realEvent.value])).toEqual([
      [`cold-${day(8)}`, -73],
      [`cold-${day(9)}`, -86],
    ]);
  });

  it('la conjunción cubre la moratoria completa (fechas inclusivas)', () => {
    const [entry] = conjunctionTimeline([{ id: 'c', start: '2023-11-11', end: '2023-11-25', sourceUrl: 'u' }], 72);
    expect(entry).toMatchObject({ impactAt: '2023-11-11T00:00:00.000Z', endAt: '2023-11-26T00:00:00.000Z', warnAt: '2023-11-08T00:00:00.000Z' });
    expect(entry!.realEvent.kidValueParams).toEqual({ days: 15 });
  });

  it('timelineBetween deja los que se solapan con la ventana, en orden de aviso', () => {
    const entries = stormTimeline([storm, { ...storm, id: 'early', warnAt: '2024-01-01T00:00:00Z', endAt: '2024-01-02T00:00:00Z' }], R, 'u');
    expect(timelineBetween(entries, '2024-06-04T00:00:00Z', '2024-10-10T00:00:00Z').map((e) => e.id)).toEqual(['storm-x']);
  });
});

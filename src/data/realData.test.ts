import { describe, expect, it } from 'vitest';
import { INCIDENT_RULES } from '../content/incidents';
import { noticesBetween, noticeText } from '../core/environment/notices';
import { DONKI_NOTICES } from './notices';
import { cruiseSiteFor, dailyDoses, eventsBetween, seriesFor } from './realData';
import { VAN_ALLEN } from './vanAllen';

describe('seriesFor', () => {
  it('en Marte da la dosis de RAD y el clima de Gale del día', () => {
    const s = seriesFor('mars', '2024-05-20T12:00:00Z');
    expect(s.site).toBe('marsSurface');
    expect(s.dose).toMatchObject({ date: '2024-05-20', uGyH: 69.34 });
    expect(s.weather).toMatchObject({ date: '2024-05-20', minTempC: -69 });
  });

  it('en los viajes usa BioSentinel, y TGO en crucero para las fechas de 2016 del modo libre', () => {
    expect(seriesFor('cruiseOut', '2024-05-11T00:00:00Z')).toMatchObject({ site: 'deepSpace', weather: null });
    expect(cruiseSiteFor('2016-06-01')).toBe('marsCruise');
    expect(seriesFor('cruiseBack', '2016-06-01T00:00:00Z').site).toBe('marsCruise');
  });
});

describe('dailyDoses', () => {
  it('da un punto por día con la serie del lugar de cada fase', () => {
    const points = dailyDoses('2024-05-13T00:00:00Z', '2024-05-17T06:00:00Z', (date) => (date < '2024-05-15' ? 'cruiseOut' : 'mars'));
    expect(points.map((p) => [p.date, p.site])).toEqual([
      ['2024-05-13', 'deepSpace'],
      ['2024-05-14', 'deepSpace'],
      ['2024-05-15', 'marsSurface'],
      ['2024-05-16', 'marsSurface'],
      ['2024-05-17', 'marsSurface'],
    ]);
    expect(points[2]).toMatchObject(seriesFor('mars', '2024-05-15T00:00:00Z').dose);
  });
});

describe('eventsBetween', () => {
  it('junta los eventos reales de la campaña 2024 en orden de fecha', () => {
    const ids = eventsBetween('2024-05-01T00:00:00Z', '2024-06-01T00:00:00Z', INCIDENT_RULES).map((e) => e.id);
    expect(ids).toEqual(['storm-2024-05-11', 'mars-storm-2024-05-20', 'cold-2024-05-24', 'dust-2024-05-28']);
  });

  it('incluye el cruce de Van Allen y las conjunciones del modo libre', () => {
    expect(eventsBetween('2022-11-01T00:00:00Z', '2022-12-01T00:00:00Z', INCIDENT_RULES).map((e) => e.id)).toContain('van-allen-artemis-i');
    expect(eventsBetween('2023-11-01T00:00:00Z', '2023-12-01T00:00:00Z', INCIDENT_RULES).map((e) => e.id)).toContain('conjunction-2023');
  });
});

describe('Van Allen (Artemis I)', () => {
  it('el día del lanzamiento HERA marcó cientos de veces lo normal', () => {
    expect(VAN_ALLEN.launchDate).toBe('2022-11-16');
    expect(VAN_ALLEN.sensors.map((s) => s.instrument).sort()).toEqual(['EAD-MU01', 'HERA-HSU1', 'HERA-HSU2', 'M42-SN127']);
    expect(VAN_ALLEN.realEvent).toMatchObject({ mission: 'Artemis I', instrument: 'HERA', value: 8012.6 });
    expect(VAN_ALLEN.usualUGyH).toBeGreaterThan(15);
    expect(VAN_ALLEN.realEvent.kidValueParams!.times).toBeGreaterThan(400);
  });
});

describe('avisos de DONKI para Control de Misión', () => {
  it('el 08/05/2024 llega la X1.0 que anticipa la tormenta de mayo', () => {
    const may = noticesBetween(DONKI_NOTICES, '2024-05-08T00:00:00Z', '2024-05-09T00:00:00Z');
    const x1 = may.find((n) => n.kind === 'flare' && n.params.classType === 'X1.0');
    expect(x1).toMatchObject({ url: expect.stringMatching(/^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\//) });
    expect(noticeText(x1!)).toEqual({ key: 'hud.missionControl.notice.flare', params: { classType: 'X1.0' } });
  });

  it('las CME hacia Marte traen la velocidad y la llegada estimada', () => {
    const cme = DONKI_NOTICES.find((n) => n.kind === 'cmeMars')!;
    expect(cme.kind === 'cmeMars' && cme.params.speedKmS).toBeGreaterThan(0);
    expect(noticeText(cme).key).toMatch(/^hud\.missionControl\.notice\.cmeMars/);
  });

  it('no incluye pronósticos de SEP: sólo detecciones con su satélite', () => {
    const detectors = new Set(DONKI_NOTICES.flatMap((n) => (n.kind === 'sep' ? [n.params.detector] : [])));
    expect([...detectors].sort()).toEqual(['GOES', 'SOHO', 'STEREO']);
  });
});

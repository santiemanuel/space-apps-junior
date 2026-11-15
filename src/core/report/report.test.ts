import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, REPORT_RULES } from '../../content/achievements';
import { ROCK_TYPES } from '../../content/galeTerrain';
import { makeCrew, makeGameState, makeRealEvent, makeSample } from '../../test-utils/factories';
import { buildReport, earnedAchievements, realEventFromLog, realEventLogEntry } from './report';

const finalState = (over: Parameters<typeof makeGameState>[0] = {}) =>
  makeGameState({
    phase: 'reentry',
    simDate: '2024-10-10T00:00:00Z',
    crew: makeCrew().map((m) => ({ ...m, doseMSv: 420, condition: 0.8 })),
    inventory: { foodKg: 10, spares: 1, samples: [makeSample({ id: 'a', value: 3, massKg: 4 }), makeSample({ id: 'b', value: 2, massKg: 6 })] },
    ...over,
  });

describe('informe de misión', () => {
  it('tres estrellas: tripulación sana, dosis baja y muestras en la Tierra', () => {
    const report = buildReport(finalState(), 'completed', ACHIEVEMENTS, REPORT_RULES);
    expect(report.stars).toEqual({ healthyCrew: true, lowDose: true, samplesHome: true });
    expect(report.starCount).toBe(3);
    expect(report.samples).toEqual({ count: 2, value: 5, massKg: 10 });
  });

  it('cada estrella se pierde por su motivo', () => {
    const crew = makeCrew().map((m, i) => ({ ...m, condition: i === 0 ? 0.3 : 0.9, doseMSv: i === 1 ? 650 : 100 }));
    const report = buildReport(finalState({ crew, inventory: { foodKg: 0, spares: 0, samples: [] } }), 'completed', ACHIEVEMENTS, REPORT_RULES);
    expect(report.stars).toEqual({ healthyCrew: false, lowDose: false, samplesHome: false });
  });

  it('en una misión suspendida las muestras no llegaron y nadie bajó de la cápsula', () => {
    const report = buildReport(finalState({ phase: 'cruiseBack' }), 'suspended', ACHIEVEMENTS, REPORT_RULES);
    expect(report.stars.samplesHome).toBe(false);
    expect(report.stars.healthyCrew).toBe(false);
    expect(report.crew.every((c) => c.arrival === null)).toBe(true);
  });

  it('traduce la dosis a radiografías de tórax y a porcentaje del límite de carrera', () => {
    const [vega] = buildReport(finalState(), 'completed', ACHIEVEMENTS, REPORT_RULES).crew;
    expect(vega).toMatchObject({ id: 'vega', xrays: Math.round(420 / REPORT_RULES.chestXrayMSv), careerPercent: 70, arrival: 'walk' });
  });

  it('junta los logros otorgados por las fases con los que se deducen del final', () => {
    const state = finalState({
      achievements: ['shelterInTime'],
      history: [{ simDate: '2024-05-25T00:00:00Z', phase: 'mars', kind: 'incident', key: 'incidents.dustStorm.title' }],
    });
    const report = buildReport(state, 'completed', ACHIEVEMENTS, REPORT_RULES);
    expect(earnedAchievements(report)).toEqual(['shelterInTime', 'likeOpportunity', 'survivedX9']);
    expect(earnedAchievements(buildReport(finalState({ mode: 'free' }), 'suspended', ACHIEVEMENTS, REPORT_RULES))).toEqual([]);
  });

  it('"Coleccionista de rocas": juntar en Marte una de cada tipo, aunque no todas vuelvan en la nave', () => {
    const logOf = (rocks: readonly string[]) =>
      rocks.map((rock, i) => ({ simDate: '2024-05-20T00:00:00Z', phase: 'mars' as const, kind: 'decision' as const, key: 'mars.log.sample', data: { siteId: `s${i}`, rock } }));
    const earned = (rocks: readonly string[]) => earnedAchievements(buildReport(finalState({ history: logOf(rocks) }), 'completed', ACHIEVEMENTS, REPORT_RULES));
    expect(earned(ROCK_TYPES)).toContain('allRockTypes');
    expect(earned(ROCK_TYPES.slice(1))).not.toContain('allRockTypes');
  });

  it('las decisiones salen en orden y sin el detalle de cada etapa de maniobra', () => {
    const state = finalState({
      history: [
        { simDate: '2024-01-15T00:00:00Z', phase: 'prep', kind: 'loadout', key: 'outbound.balanced' },
        { simDate: '2024-01-15T00:00:00Z', phase: 'ascent', kind: 'maneuver', key: 'ascent.ignition', data: { hit: true } },
        { simDate: '2024-01-15T00:00:00Z', phase: 'ascent', kind: 'maneuver', key: 'ascent', data: { precision: 0.9 } },
        realEventLogEntry(makeRealEvent(), { simDate: '2024-05-20T00:00:00Z', phase: 'mars' }),
      ],
    });
    const report = buildReport(state, 'completed', ACHIEVEMENTS, REPORT_RULES);
    expect(report.decisions.map((e) => e.key)).toEqual(['outbound.balanced', 'ascent']);
    expect(report.realEvents.map((e) => e.id)).toEqual(['rad-2024-05-20']);
  });

  it('de cada incidente de la simulación queda una sola línea (aviso, impacto y fin van juntos)', () => {
    const incident = (status: string, simDate: string) =>
      ({ simDate, phase: 'cruiseOut', kind: 'incident', key: 'incidents.radiationStorm.title', data: { incidentId: 'storm-1', status } }) as const;
    const state = finalState({
      history: [
        incident('warned', '2024-05-09T00:00:00Z'),
        { simDate: '2024-05-09T02:00:00Z', phase: 'cruiseOut', kind: 'decision', key: 'incidents.radiationStorm.response.goToShelter.title' },
        incident('active', '2024-05-11T00:00:00Z'),
        incident('resolved', '2024-05-12T00:00:00Z'),
      ],
    });
    const report = buildReport(state, 'completed', ACHIEVEMENTS, REPORT_RULES);
    expect(report.decisions.map((e) => [e.kind, e.data?.status])).toEqual([
      ['incident', 'warned'],
      ['decision', undefined],
    ]);
  });

  it('un evento real se guarda en el historial y se recupera igual, con sus parámetros', () => {
    const event = makeRealEvent({ capped: true, kidValueParams: { times: 64, place: 'Marte' } });
    const entry = realEventLogEntry(event, { simDate: '2024-05-20T00:00:00Z', phase: 'mars' });
    expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
    expect(realEventFromLog(entry)).toEqual(event);
    expect(realEventFromLog(realEventLogEntry(makeRealEvent(), { simDate: '', phase: 'mars' }))).toEqual({ ...makeRealEvent(), capped: false });
  });
});

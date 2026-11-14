import { describe, expect, it } from 'vitest';
import { CLOCK_RULES, MissionClock, type ClockAlert, type ClockEvent } from './MissionClock';

const storm: ClockAlert = {
  id: 'tormenta',
  warnAt: '2024-01-03T06:00:00.000Z',
  impactAt: '2024-01-04T06:00:00.000Z',
  endAt: '2024-01-05T00:00:00.000Z',
  reasonKey: 'incidents.radiationStorm',
};

const run = (clock: MissionClock, seconds: number, step = 0.5): ClockEvent[] => {
  const events: ClockEvent[] = [];
  for (let t = 0; t < seconds; t += step) events.push(...clock.advance(step));
  return events;
};

describe('MissionClock', () => {
  it('en calma avanza ~1 día cada 2 s y avisa cada cambio de día', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-02-01T00:00:00Z' });
    const events = clock.advance(4);
    expect(clock.simDate).toBe('2024-01-03T00:00:00.000Z');
    expect(events).toEqual([
      { type: 'day', simDate: '2024-01-02' },
      { type: 'day', simDate: '2024-01-03' },
    ]);
  });

  it('nunca salta días aunque llegue un paso enorme', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-11T00:00:00Z' });
    const days = clock.advance(1000).filter((e) => e.type === 'day');
    expect(days).toHaveLength(10);
    expect(clock.finished).toBe(true);
  });

  it('se frena justo en el aviso y pasa a Alerta, luego a Impacto a tiempo normal', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-10T00:00:00Z', alerts: [storm] });
    const events = clock.advance(1000).filter((e) => e.type === 'level');
    expect(events[0]).toMatchObject({ type: 'level', level: 'alert', reasonKey: 'incidents.radiationStorm.alert', alertId: 'tormenta', at: storm.warnAt });
    expect(events[1]).toMatchObject({ level: 'impact', reasonKey: 'incidents.radiationStorm.impact' });
    expect(events[2]).toMatchObject({ type: 'level', level: 'calm', reasonKey: CLOCK_RULES.calmReasonKey, alertId: null });
  });

  it('la Alerta dura al menos los segundos mínimos aunque la antelación sea corta', () => {
    const shortLead = { ...storm, impactAt: '2024-01-03T07:00:00.000Z' };
    const clock = new MissionClock({ start: '2024-01-03T06:00:00Z', end: '2024-01-10T00:00:00Z', alerts: [shortLead] });
    expect(clock.level).toBe('alert');
    expect(clock.hoursPerSecond).toBeCloseTo(1 / CLOCK_RULES.alertMinSeconds);
    clock.advance(CLOCK_RULES.alertMinSeconds - 1);
    expect(clock.level).toBe('alert');
    clock.advance(1.01);
    expect(clock.level).toBe('impact');
  });

  it('Alerta más lenta que la calma y el Impacto a velocidad de juego', () => {
    const clock = new MissionClock({ start: '2024-01-03T06:00:00Z', end: '2024-01-10T00:00:00Z', alerts: [storm] });
    expect(clock.hoursPerSecond).toBeLessThan(CLOCK_RULES.calmHoursPerSecond);
    clock.advance(CLOCK_RULES.alertMinSeconds);
    expect(clock.level).toBe('impact');
    expect(clock.hoursPerSecond).toBe(CLOCK_RULES.playHoursPerSecond);
  });

  it('resolver el aviso devuelve la calma', () => {
    const clock = new MissionClock({ start: '2024-01-04T07:00:00Z', end: '2024-01-10T00:00:00Z', alerts: [storm] });
    expect(clock.level).toBe('impact');
    expect(clock.resolve('tormenta')).toEqual([
      { type: 'level', level: 'calm', reasonKey: CLOCK_RULES.calmReasonKey, alertId: null, at: '2024-01-04T07:00:00.000Z' },
    ]);
    expect(clock.hoursPerSecond).toBe(CLOCK_RULES.calmHoursPerSecond);
  });

  it('juega las jornadas a tiempo normal y avanza rápido entre ellas', () => {
    const clock = new MissionClock({
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-05T00:00:00Z',
      playWindows: [{ start: '2024-01-02T00:00:00Z', end: '2024-01-03T00:00:00Z' }],
      playHoursPerSecond: 0.2,
    });
    const events = clock.advance(2);
    expect(events).toContainEqual({ type: 'pace', pace: 'play' });
    expect(clock.hoursPerSecond).toBe(0.2);
    clock.advance(120);
    expect(clock.pace).toBe('fast');
    expect(clock.simDate).toBe('2024-01-03T00:00:00.000Z');
  });

  it('en pausa no avanza', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-05T00:00:00Z' });
    clock.pause();
    expect(clock.advance(10)).toEqual([]);
    expect(clock.simDate).toBe('2024-01-01T00:00:00.000Z');
    clock.resume();
    expect(run(clock, 2)).toHaveLength(1);
  });

  it('avisa el fin de la fase una sola vez', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' });
    expect(clock.advance(10).at(-1)).toEqual({ type: 'end' });
    expect(clock.advance(10)).toEqual([]);
  });
});

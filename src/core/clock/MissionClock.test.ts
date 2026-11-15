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
  it('en calma avanza rápido y avisa cada cambio de día', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-02-01T00:00:00Z' });
    const events = clock.advance(48 / CLOCK_RULES.calmHoursPerSecond);
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

  it('un aviso agregado durante la fase frena el reloj desde ya (falla con semilla)', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-02-01T00:00:00Z' });
    clock.advance(6 / CLOCK_RULES.calmHoursPerSecond);
    const events = clock.addAlert({ ...storm, id: 'falla', warnAt: clock.simDate, impactAt: '2024-01-02T00:00:00.000Z' });
    expect(events).toEqual([{ type: 'level', level: 'alert', reasonKey: 'incidents.radiationStorm.alert', alertId: 'falla', at: clock.simDate }]);
    expect(clock.hoursPerSecond).toBeLessThan(CLOCK_RULES.calmHoursPerSecond);
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
    const events = clock.advance(24 / CLOCK_RULES.calmHoursPerSecond);
    expect(events).toContainEqual({ type: 'pace', pace: 'play' });
    expect(clock.hoursPerSecond).toBe(0.2);
    clock.advance(120);
    expect(clock.pace).toBe('fast');
    expect(clock.simDate).toBe('2024-01-03T00:00:00.000Z');
  });

  describe('jornadas sin nada que hacer', () => {
    const day = () =>
      new MissionClock({
        start: '2024-01-02T00:00:00Z',
        end: '2024-01-05T00:00:00Z',
        playWindows: [{ start: '2024-01-02T00:00:00Z', end: '2024-01-03T00:00:00Z' }],
        playHoursPerSecond: 0.4,
        alerts: [{ ...storm, id: 'luego', warnAt: '2024-01-02T12:00:00.000Z', impactAt: '2024-01-02T18:00:00.000Z', endAt: '2024-01-02T20:00:00.000Z' }],
      });

    it('con tareas pendientes la jornada va a tiempo normal; sin nada que hacer, mucho más rápido', () => {
      const clock = day();
      expect(clock.hoursPerSecond).toBe(0.4);
      clock.setIdle(true);
      expect(clock.idleBoost).toBe(true);
      expect(clock.hoursPerSecond).toBe(CLOCK_RULES.idleHoursPerSecond);
      expect(clock.baseHoursPerSecond).toBe(0.4);
      clock.setIdle(false);
      expect(clock.hoursPerSecond).toBe(0.4);
    });

    it('un aviso frena el reloj aunque no haya nada que hacer', () => {
      const clock = day();
      clock.setIdle(true);
      clock.advance(12 / CLOCK_RULES.idleHoursPerSecond);
      expect(clock.level).toBe('alert');
      expect(clock.idleBoost).toBe(false);
      expect(clock.hoursPerSecond).toBeLessThan(CLOCK_RULES.idleHoursPerSecond);
    });

    it('entre jornadas no cambia nada: el avance rápido ya es más rápido', () => {
      const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-05T00:00:00Z' });
      clock.setIdle(true);
      expect(clock.idleBoost).toBe(false);
      expect(clock.hoursPerSecond).toBe(CLOCK_RULES.calmHoursPerSecond);
    });
  });

  it('en pausa no avanza', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-05T00:00:00Z' });
    clock.pause();
    expect(clock.advance(10)).toEqual([]);
    expect(clock.simDate).toBe('2024-01-01T00:00:00.000Z');
    clock.resume();
    const oneDay = 24 / CLOCK_RULES.calmHoursPerSecond;
    expect(run(clock, oneDay, oneDay / 4)).toHaveLength(1);
  });

  it('avisa el fin de la fase una sola vez', () => {
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' });
    expect(clock.advance(10).at(-1)).toEqual({ type: 'end' });
    expect(clock.advance(10)).toEqual([]);
  });
});

describe('tiempo entre avisos', () => {
  it('después de un aviso, el siguiente no llega antes de los segundos mínimos reales', () => {
    const second: ClockAlert = { ...storm, id: 'otra', warnAt: '2024-01-06T00:00:00.000Z', impactAt: '2024-01-06T06:00:00.000Z', endAt: '2024-01-07T00:00:00.000Z' };
    const clock = new MissionClock({ start: '2024-01-01T00:00:00Z', end: '2024-01-20T00:00:00Z', alerts: [storm, second] });
    let ended = -1;
    let warned = -1;
    for (let t = 0; t < 2000 && warned < 0; t += 0.5) {
      for (const e of clock.advance(0.5)) {
        if (e.type === 'level' && e.level === 'calm' && ended < 0) ended = t;
        if (e.type === 'level' && e.alertId === 'otra' && warned < 0) warned = t;
      }
    }
    expect(ended).toBeGreaterThanOrEqual(0);
    expect(warned - ended).toBeGreaterThanOrEqual(CLOCK_RULES.alertGapSeconds - 1);
    expect(clock.level).toBe('alert');
  });

  it('sin otro aviso por delante, la calma sigue a su velocidad', () => {
    const clock = new MissionClock({ start: '2024-01-04T23:00:00Z', end: '2024-01-20T00:00:00Z', alerts: [storm] });
    clock.advance(10);
    expect(clock.level).toBe('calm');
    expect(clock.hoursPerSecond).toBe(CLOCK_RULES.calmHoursPerSecond);
  });
});

describe('tormentas largas y dormir', () => {
  it('el Impacto va a tiempo normal sólo sus primeras horas; después sigue rápido', () => {
    const long = { ...storm, impactAt: '2024-01-04T00:00:00.000Z', endAt: '2024-01-09T00:00:00.000Z' };
    const clock = new MissionClock({ start: '2024-01-04T01:00:00Z', end: '2024-01-12T00:00:00Z', alerts: [long] });
    expect(clock.level).toBe('impact');
    expect(clock.hoursPerSecond).toBe(CLOCK_RULES.playHoursPerSecond);
    clock.advance((CLOCK_RULES.impactSlowHours - 1) / CLOCK_RULES.playHoursPerSecond + 0.1);
    expect(clock.level).toBe('impact');
    expect(clock.hoursPerSecond).toBe(CLOCK_RULES.idleHoursPerSecond);
  });

  it('durmiendo, el reloj corre muy rápido con calma y una alerta lo frena', () => {
    const clock = new MissionClock({
      start: '2024-01-02T00:00:00Z',
      end: '2024-01-05T00:00:00Z',
      playWindows: [{ start: '2024-01-02T00:00:00Z', end: '2024-01-03T00:00:00Z' }],
      alerts: [{ ...storm, warnAt: '2024-01-02T12:00:00.000Z' }],
    });
    clock.setSleep(true);
    expect(clock.hoursPerSecond).toBe(CLOCK_RULES.sleepHoursPerSecond);
    clock.advance(1);
    expect(clock.level).toBe('alert');
    expect(clock.hoursPerSecond).toBeLessThan(CLOCK_RULES.sleepHoursPerSecond);
  });
});

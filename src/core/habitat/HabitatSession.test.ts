import { describe, expect, it } from 'vitest';
import { INCIDENTS } from '../../content/incidents';
import { VOYAGE_CONTENT } from '../../content/ship';
import { makeGameState } from '../../test-utils/factories';
import type { PhaseCalendar } from '../clock/schedule';
import { DEFAULT_ROUTINE } from '../crew/routines';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { GameState } from '../state/types';
import type { VoyageContent } from '../voyage/types';
import { VoyageSession } from '../voyage/VoyageSession';
import type { SimSnapshot, SimulationEvents } from './events';
import type { HabitatInput } from './HabitatSession';

const H = 3_600_000;
const START = '2024-05-01T00:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(START) + hours * H).toISOString();
const CALENDAR: PhaseCalendar = {
  windows: { cruiseOut: { start: START, end: at(72) }, mars: { start: at(72), end: at(96) }, cruiseBack: { start: at(96), end: at(168) } },
  playedDays: { short: { cruiseOut: 0, mars: 0, cruiseBack: 0 }, long: { cruiseOut: 1, mars: 1, cruiseBack: 1 } },
  playHoursPerSecond: { cruiseOut: 0.2, mars: 0.2, cruiseBack: 0.2 },
};
/** Sólo el depurador averiado, con una falla segura el primer día. */
const CONTENT: VoyageContent = {
  ...VOYAGE_CONTENT,
  calendar: CALENDAR,
  incidents: INCIDENTS.map((d) => (d.id === 'scrubberFailure' ? { ...d, unlockLevel: 1, triggers: [{ kind: 'random', chancePerDay: 1 }] } : d)),
};
const AT_RADIO: HabitatInput = { activeZone: 'radio', interacting: false };

function setup(over: Partial<GameState> = {}) {
  const bus = new EventBus<GameEvents>();
  const sim = new EventBus<SimulationEvents>();
  const session = new VoyageSession({
    leg: 'out',
    state: makeGameState({ simDate: START, length: 'long', ...over }),
    bus,
    content: CONTENT,
    timeline: [],
    doseRate: (date) => ({ date: date.slice(0, 10), uGyH: 10, capped: false }),
    // Un minuto de luz hasta la Tierra.
    signalDelaySeconds: () => 60,
  });
  const snapshots: SimSnapshot[] = [];
  sim.on('sim:snapshot', (s) => snapshots.push(s));
  session.attach(sim);
  return { session, sim, snapshots, last: () => snapshots.at(-1)! };
}

const run = (session: VoyageSession, until: () => boolean, input: HabitatInput = AT_RADIO, max = 4000) => {
  for (let i = 0; i < max && !until(); i++) session.update(0.25, input);
};

describe('bus de la simulación', () => {
  it('publica el estado al conectarse y en cada cuadro', () => {
    const { session, snapshots, last } = setup();
    expect(snapshots).toHaveLength(1);
    session.update(0.25, AT_RADIO);
    expect(snapshots).toHaveLength(2);
    expect(last()).toMatchObject({ phase: 'cruiseOut', place: 'cruise', simDate: session.simDate, manual: true });
  });

  it('la planificación pausa el reloj y cambia las rutinas; una rutina imposible se ignora', () => {
    const { session, sim, last } = setup();
    sim.emit('sim:pause', { paused: true });
    const date = session.simDate;
    session.update(0.25, AT_RADIO);
    expect(session.simDate).toBe(date);
    expect(last().paused).toBe(true);
    const sleepy = { ...DEFAULT_ROUTINE, sleepHours: 10, workHours: 8 };
    sim.emit('sim:routines', { ...last().routines, miga: sleepy, brote: { ...DEFAULT_ROUTINE, sleepHours: 20, workHours: 10 } });
    expect(last().routines.miga).toEqual(sleepy);
    expect(last().routines.brote).toEqual(VOYAGE_CONTENT.routines.brote);
  });

  it('tablero de energía: desenchufar la radio ahorra energía y deja sin Control de Misión', () => {
    const { session, sim, last } = setup();
    session.update(0.25, AT_RADIO);
    const before = last().power.loadKw;
    sim.emit('sim:loads', { off: ['radio', 'lifeSupport'] });
    session.update(0.25, AT_RADIO);
    expect(last().power.loadKw).toBeCloseTo(before - VOYAGE_CONTENT.power.loadsKw.radio!);
    expect(last().power.loads.find((l) => l.id === 'lifeSupport')).toMatchObject({ on: true, essential: true });
    expect(last().missionControl).toMatchObject({ offline: true, blockedKey: 'hud.missionControl.blocked.offline' });
  });
});

describe('Control de Misión (§3.7)', () => {
  const failure = (session: VoyageSession) => session.state.activeIncidents.find((i) => i.definitionId === 'scrubberFailure');

  it('sólo la comandante pide, desde la radio', () => {
    const { session } = setup({ activeCrewId: 'miga' });
    run(session, () => !!failure(session));
    expect(session.missionControlBlockedKey()).toBe('hud.missionControl.blocked.notCommander');
    const other = setup();
    run(other.session, () => !!failure(other.session), { activeZone: 'command', interacting: false });
    expect(other.session.ask('advice', failure(other.session)!.id)).toBeNull();
    expect(other.session.missionControlBlockedKey()).toBe('hud.missionControl.blocked.notAtConsole');
  });

  it('el consejo llega después de la ida y vuelta de la señal y recomienda la opción verde', () => {
    const { session, sim, last } = setup();
    run(session, () => !!failure(session));
    sim.emit('sim:ask', { kind: 'advice', incidentId: failure(session)!.id });
    const [request] = last().missionControl.requests;
    expect(Date.parse(request!.arrivesAt) - Date.parse(request!.askedAt)).toBe(120_000);
    expect(request).toMatchObject({ arrived: false, responseId: 'repair' });
    run(session, () => session.missionControlRequests[0]!.arrived);
    expect(Date.parse(session.simDate)).toBeGreaterThanOrEqual(Date.parse(request!.arrivesAt));
  });

  it('el diagnóstico remoto gasta energía y acelera la reparación ×1,5', () => {
    const hoursToRepair = (diagnose: boolean) => {
      const { session } = setup();
      run(session, () => !!failure(session));
      const id = failure(session)!.id;
      session.respond(id, 'repair');
      if (diagnose) {
        const battery = session.state.meters.energy.batteryKwh;
        session.ask('diagnosis', id);
        expect(session.state.meters.energy.batteryKwh).toBeCloseTo(battery - 0.5);
        run(session, () => session.missionControlRequests[0]!.arrived);
      }
      // La comandante repara desde su cuarto (velocidad ×1, sin especialidad).
      const start = Date.parse(session.simDate);
      run(session, () => !failure(session), { activeZone: 'scrubber', interacting: true });
      return (Date.parse(session.simDate) - start) / H;
    };
    expect(hoursToRepair(true)).toBeLessThan(hoursToRepair(false) * 0.75);
  });

  it('con el modo ayuda da la pista sin demora', () => {
    const { session, last } = setup({ helpMode: true });
    run(session, () => !!failure(session));
    expect(last().hints).toEqual([{ incidentId: failure(session)!.id, responseId: 'repair' }]);
  });
});

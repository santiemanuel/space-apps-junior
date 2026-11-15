import { describe, expect, it } from 'vitest';
import { INCIDENTS } from '../../content/incidents';
import { VOYAGE_CONTENT } from '../../content/ship';
import { makeGameState } from '../../test-utils/factories';
import type { PhaseCalendar } from '../clock/schedule';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { GameState } from '../state/types';
import type { VoyageContent } from '../voyage/types';
import { VoyageSession } from '../voyage/VoyageSession';
import type { SimSnapshot, SimulationEvents } from './events';
import type { HabitatInput } from './HabitatSession';
import { modeEffects, RESOURCE_MODES, type ResourceModeId } from './resourceModes';

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

  it('la planificación pausa el reloj; las rutinas son automáticas según el perfil', () => {
    const { session, sim, last } = setup();
    sim.emit('sim:pause', { paused: true });
    const date = session.simDate;
    session.update(0.25, AT_RADIO);
    expect(session.simDate).toBe(date);
    expect(last().paused).toBe(true);
    // Nadie las elige a mano: la ingeniera cuida el depurador y el botánico, el reciclador.
    expect(last().routines.miga.taskId).toBe('scrubber');
    expect(last().routines.brote.taskId).toBe('recycler');
  });

  it('tablero de energía: desenchufar la radio ahorra energía y deja sin Control de Misión', () => {
    const { session, sim, last } = setup();
    session.update(0.25, AT_RADIO);
    const before = last().power.loadKw;
    // Lejos de la consola de la sala de mando no se toca nada.
    sim.emit('sim:loads', { off: ['radio'] });
    session.update(0.25, AT_RADIO);
    expect(last().power).toMatchObject({ loadKw: before, panelBlocked: true });
    session.update(0.25, { activeZone: 'command', interacting: false });
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

describe('consola de recursos (sala de mando)', () => {
  const AT_COMMAND: HabitatInput = { activeZone: 'command', interacting: false };
  const consoleAt = VOYAGE_CONTENT.resourceConsole!.at!;

  /** Un día a tiempo normal con una prioridad elegida desde la consola. */
  const dayWith = (mode: ResourceModeId) => {
    // Con el ánimo y la forma a medias, para que se vea si suben o bajan.
    const { session, last } = setup({ crew: makeGameState().crew.map((m) => ({ ...m, morale: 0.6, condition: 0.6 })) });
    session.update(0.25, AT_COMMAND);
    if (mode !== 'balanced') expect(session.setMode(mode)).toBe(true);
    const start = Date.parse(session.simDate);
    run(session, () => Date.parse(session.simDate) - start >= 20 * H, AT_COMMAND);
    return { session, last };
  };

  it('E la abre sólo pegado a ella, en la sala de mando', () => {
    const { session } = setup();
    expect(session.consoleAt('command', consoleAt)).toBe(true);
    expect(session.consoleAt('command', { x: consoleAt.x - 4, y: consoleAt.y })).toBe(false);
    expect(session.consoleAt('radio', consoleAt)).toBe(false);
  });

  it('la prioridad sólo se cambia desde la consola y queda anotada', () => {
    const { session, sim, last } = setup();
    session.update(0.25, AT_RADIO);
    sim.emit('sim:mode', { id: 'saveEnergy' });
    expect(last().resources).toEqual({ mode: 'balanced', blocked: true });
    session.update(0.25, AT_COMMAND);
    sim.emit('sim:mode', { id: 'saveEnergy' });
    expect(last().resources).toEqual({ mode: 'saveEnergy', blocked: false });
    expect(session.state.history).toContainEqual(expect.objectContaining({ key: 'hud.log.resourceMode.saveEnergy' }));
    expect(session.savedState.habitat?.resourceMode).toBe('saveEnergy');
  });

  it('cada opción tiene algo que se gana y algo que cuesta', () => {
    for (const mode of RESOURCE_MODES) {
      const effects = modeEffects(mode);
      if (mode.id === 'balanced') expect(effects).toEqual([]);
      else {
        expect(effects.some((e) => e.good), mode.id).toBe(true);
        expect(effects.some((e) => !e.good), mode.id).toBe(true);
      }
    }
  });

  it('ahorro de energía: la nave consume menos, pero se gasta más aire y agua', () => {
    const normal = dayWith('balanced');
    const saving = dayWith('saveEnergy');
    expect(saving.last().power.loadKw).toBeLessThan(normal.last().power.loadKw * 0.8);
    expect(saving.session.state.meters.lifeSupport.oxygenKg).toBeLessThan(normal.session.state.meters.lifeSupport.oxygenKg);
  });

  it('soporte vital primero: el aire rinde más y la nave consume algo más', () => {
    const normal = dayWith('balanced');
    const safe = dayWith('lifeSupport');
    expect(safe.session.state.meters.lifeSupport.oxygenKg).toBeGreaterThan(normal.session.state.meters.lifeSupport.oxygenKg);
    expect(safe.last().power.loadKw).toBeGreaterThan(normal.last().power.loadKw);
  });

  it('racionar: la comida rinde más días, pero la tripulación queda con hambre (baja el ánimo y la forma)', () => {
    const normal = dayWith('balanced').session.state;
    const rationed = dayWith('ration').session.state;
    expect(rationed.inventory.foodKg).toBeGreaterThan(normal.inventory.foodKg);
    const senda = (s: GameState) => s.crew.find((m) => m.id === 'senda')!;
    expect(senda(rationed).nutrition).toBeLessThan(1);
    expect(senda(rationed).morale).toBeLessThan(senda(normal).morale);
    expect(senda(rationed).condition).toBeLessThan(senda(normal).condition);
  });

  it('ciencia a fondo: sube el ánimo, pero la nave consume más y los sistemas se gastan más rápido', () => {
    const normal = dayWith('balanced');
    const science = dayWith('science');
    const wear = (s: VoyageSession) => (s as unknown as { maintenance: Record<string, { hoursSince: number }> }).maintenance.waterRecycler!.hoursSince;
    const senda = (s: VoyageSession) => s.state.crew.find((m) => m.id === 'senda')!;
    expect(senda(science.session).morale).toBeGreaterThan(senda(normal.session).morale);
    expect(science.last().power.loadKw).toBeGreaterThan(normal.last().power.loadKw);
    expect(wear(science.session)).toBeGreaterThan(wear(normal.session) * 1.3);
  });
});

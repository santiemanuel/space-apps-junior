import { describe, expect, it } from 'vitest';
import { GALE_LANDMARKS, GALE_LAYOUT, MARS_CONTENT, SULFUR_EVENT } from '../../content/gale';
import { INCIDENT_RULES } from '../../content/incidents';
import { makeGameState, makeMeters } from '../../test-utils/factories';
import type { PhaseCalendar } from '../clock/schedule';
import type { MarsWeather, UvIndex } from '../environment/series';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { HabitatInput } from '../habitat/HabitatSession';
import { EXTERIOR, isWalkable, pathLength, pointAlong, route, routeToPoint, zoneAt, zoneById, zoneSpot, type Point } from '../habitat/layout';
import { marsRadiationTimeline } from '../incidents/timeline';
import type { GameState } from '../state/types';
import { MarsSession, sampleSites } from './MarsSession';
import type { MarsContent } from './types';

const H = 3_600_000;
const START = '2024-05-15T00:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(START) + hours * H).toISOString();

/** Estancia de 3 soles; con `long` el primero se juega a tiempo normal. */
const CALENDAR: PhaseCalendar = {
  windows: {
    cruiseOut: { start: at(-72), end: START },
    mars: { start: START, end: at(72) },
    cruiseBack: { start: at(72), end: at(144) },
  },
  playedDays: { short: { cruiseOut: 0, mars: 0, cruiseBack: 0 }, long: { cruiseOut: 1, mars: 1, cruiseBack: 1 } },
  playHoursPerSecond: { cruiseOut: 0.2, mars: 24 / 90, cruiseBack: 0.2 },
};
const CONTENT: MarsContent = { ...MARS_CONTENT, calendar: CALENDAR };
const STILL: HabitatInput = { activeZone: null, interacting: false };

const weather = (uv: UvIndex | null = 'High', minTempC = -70) => (date: string): MarsWeather => ({
  date: date.slice(0, 10),
  sol: 4185,
  minTempC,
  maxTempC: -5,
  uv,
  adjusted: false,
});

function mars(over: Partial<GameState> = {}, opts: { uv?: UvIndex; content?: MarsContent; storm?: boolean } = {}) {
  const bus = new EventBus<GameEvents>();
  // Tormenta de radiación de prueba: fondo de 9 μGy/h y un día de 40 μGy/h (5 veces la mediana).
  const dose = (date: string) => (opts.storm && date.slice(0, 10) === '2024-05-15' ? 40 : 9);
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.parse(START) - (28 - i) * 24 * H).toISOString().slice(0, 10));
  const timeline = opts.storm
    ? marsRadiationTimeline(days.map((d) => ({ date: d, uGyH: d === '2024-05-15' ? 60 : 9, capped: false })), INCIDENT_RULES, 0, 'https://radlab')
    : [];
  const session = new MarsSession({
    state: makeGameState({ phase: 'mars', simDate: START, ...over }),
    bus,
    content: opts.content ?? CONTENT,
    timeline,
    doseRate: (date) => ({ date: date.slice(0, 10), uGyH: dose(date), capped: false }),
    weather: weather(opts.uv),
  });
  return { session, bus };
}

function runUntil(session: MarsSession, until: () => boolean, input: HabitatInput | (() => HabitatInput) = STILL, dt = 0.25, max = 20_000): void {
  for (let i = 0; i < max && !until() && !session.outcome; i++) session.update(dt, typeof input === 'function' ? input() : input);
}

const hoursIn = (s: MarsSession) => (Date.parse(s.simDate) - Date.parse(START)) / H;

describe('plano de la base en Gale', () => {
  const walkable = (path: Point[]) => {
    for (let d = 0; d <= pathLength(path); d += 0.1) {
      const p = pointAlong(path, d);
      if (!isWalkable(GALE_LAYOUT, Math.floor(p.x), Math.floor(p.y))) return `${p.x},${p.y}`;
    }
    return true;
  };

  it('se sale al exterior por la esclusa, se llega hasta Curiosity esquivando el terreno y se vuelve', () => {
    const outside = { x: GALE_LANDMARKS.curiosity!.x, y: GALE_LANDMARKS.curiosity!.y + 1.5 };
    const out = routeToPoint(GALE_LAYOUT, zoneSpot(zoneById(GALE_LAYOUT, 'command')), outside);
    expect(walkable(out)).toBe(true);
    expect(out.some((p) => zoneAt(GALE_LAYOUT, p) === 'airlock')).toBe(true);
    expect(zoneAt(GALE_LAYOUT, outside)).toBe(EXTERIOR);
    expect(walkable(route(GALE_LAYOUT, outside, 'shelter', true))).toBe(true);
  });
});

describe('Mars: puntos de muestreo', () => {
  it('se ubican por semilla en terreno transitable del exterior; los lejanos valen más', () => {
    const a = sampleSites(CONTENT, 7, null);
    expect(sampleSites(CONTENT, 7, null)).toEqual(a);
    expect(sampleSites(CONTENT, 8, null)).not.toEqual(a);
    for (let seed = 1; seed <= 40; seed++)
      for (const s of sampleSites(CONTENT, seed, seed % 30))
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
          expect(zoneAt(GALE_LAYOUT, { x: s.x + dx!, y: s.y + dy! }), `semilla ${seed}: ${s.x},${s.y} (+${dx},${dy})`).toBe(EXTERIOR);
    const [near, far] = [...a].sort((x, y) => x.distance - y.distance).filter((_, i, all) => i === 0 || i === all.length - 1);
    expect(far!.value).toBeGreaterThan(near!.value);
  });

  it('hay al menos una muestra de cada tipo de roca, y cada una está en la franja de su tipo', () => {
    const rocks = CONTENT.samples.rocks;
    for (let seed = 1; seed <= 20; seed++) {
      const sites = sampleSites(CONTENT, seed, null);
      expect(new Set(sites.map((s) => s.rock))).toEqual(new Set(rocks.map((r) => r.rock)));
      for (const s of sites) {
        const zone = rocks.find((r) => r.rock === s.rock)!.rect;
        expect(s.y >= zone.row && s.y < zone.row + zone.rows, `${s.rock}: ${s.x},${s.y}`).toBe(true);
      }
    }
  });

  it('un aterrizaje lejos de la base deja las muestras más lejos (§4.3)', () => {
    const closest = (km: number) => Math.min(...sampleSites(CONTENT, 7, km).map((s) => s.distance));
    expect(closest(8)).toBeGreaterThan(closest(0));
  });

  it('lo que pasó de verdad en Gale sale como tarjeta al llegar su fecha, una sola vez, y queda en el historial', () => {
    const moment = { ...SULFUR_EVENT, date: at(30) };
    const { session, bus } = mars({ length: 'long', simDate: at(26) }, { content: { ...CONTENT, realMoments: [moment] } });
    const shown: string[] = [];
    bus.on('realEvent:shown', (e) => shown.push(e.id));
    runUntil(session, () => Date.parse(session.simDate) >= Date.parse(at(36)));
    expect(shown).toEqual([SULFUR_EVENT.id]);
    expect(session.state.history.filter((e) => e.kind === 'realEvent').map((e) => e.key)).toEqual([SULFUR_EVENT.id]);
  });

  it('el jugador junta una muestra afuera, de día: queda en el inventario con su masa', () => {
    const { session } = mars({ length: 'long', simDate: at(10) });
    const site = session.sites[0]!;
    expect(session.evaOpen).toBe(true);
    runUntil(session, () => session.state.inventory.samples.length > 0, { activeZone: EXTERIOR, activePosition: site, interacting: true }, 0.25, 400);
    expect(session.state.inventory.samples).toEqual([{ id: site.id, siteId: site.id, massKg: site.massKg, value: site.value, rock: site.rock }]);
    expect(session.state.history.at(-1)).toMatchObject({ key: 'mars.log.sample', data: { rock: site.rock } });
    expect(session.remainingSites().map((r) => r.site.id)).not.toContain(site.id);
  });
});

describe('Mars: polvo, frío, MOXIE e invernadero', () => {
  it('con polvo (UV "Low") los paneles dan mucho menos y la batería baja', () => {
    const battery = (uv: UvIndex) => {
      const { session } = mars({}, { uv });
      runUntil(session, () => hoursIn(session) >= 48);
      return session.state.meters.energy.batteryKwh;
    };
    expect(battery('Low')).toBeLessThan(battery('High') - 20);
  });

  it('tablero de energía: con cielo limpio alcanzan los enchufes; con mucho polvo no queda ninguno (§3.2)', () => {
    expect(mars({}, { uv: 'High' }).session.sockets()).toBe(2);
    expect(mars({}, { uv: 'Low' }).session.sockets()).toBe(0);
  });

  it('de noche no hay sol ni salidas', () => {
    const { session } = mars({ simDate: at(20) });
    expect(session.daylight).toBe(false);
    expect(session.evaOpen).toBe(false);
  });

  it('el cielo: el Sol sube hasta el mediodía y de noche no está; el polvo del día sale del UV real', () => {
    const sky = (hours: number, uv: UvIndex = 'High') => mars({ simDate: at(hours) }, { uv }).session.sky;
    expect(sky(3).sun).toBe(0);
    expect(sky(7).sun).toBeGreaterThan(0);
    expect(sky(7).sun).toBeLessThan(sky(12).sun);
    expect(sky(12).sun).toBeCloseTo(1);
    expect(sky(12).dust).toBe(1);
    expect(sky(12, 'Low').dust).toBeLessThan(0.5);
    expect(sky(12).storm).toBe(false);
  });

  it('MOXIE fabrica oxígeno: sin él se gasta el doble de rápido', () => {
    const oxygenUsed = (moxie: 'green' | 'red') => {
      const { session } = mars({ systems: { ...makeGameState().systems, moxie } });
      runUntil(session, () => hoursIn(session) >= 48);
      return makeMeters().lifeSupport.oxygenKg - session.state.meters.lifeSupport.oxygenKg;
    };
    // 4 × 0,82 kg/sol de consumo contra 1,5 kg/sol de MOXIE.
    expect(oxygenUsed('red')).toBeCloseTo(4 * 0.82 * 2, 1);
    expect(oxygenUsed('green')).toBeCloseTo((4 * 0.82 - 1.5) * 2, 1);
  });

  it('el invernadero suma comida; si se apaga, no', () => {
    const food = (greenhouse: 'green' | 'red') => {
      const { session } = mars({ systems: { ...makeGameState().systems, greenhouse } });
      runUntil(session, () => hoursIn(session) >= 48);
      return session.state.inventory.foodKg;
    };
    expect(food('green') - food('red')).toBeCloseTo(1.5 * 2, 1);
  });

  it('afuera se recibe más dosis que adentro y se gasta más agua (EVA)', () => {
    const outside = mars({ length: 'long', simDate: at(8) }).session;
    const inside = mars({ length: 'long', simDate: at(8) }).session;
    runUntil(outside, () => hoursIn(outside) >= 12, { activeZone: EXTERIOR, activePosition: { x: 30, y: 7 }, interacting: false });
    runUntil(inside, () => hoursIn(inside) >= 12, { activeZone: 'command', interacting: false });
    const vega = (s: MarsSession) => s.state.crew.find((m) => m.id === 'vega')!;
    expect(vega(outside).doseMSv).toBeGreaterThan(vega(inside).doseMSv * 1.5);
    expect(outside.state.meters.lifeSupport.waterL).toBeLessThan(inside.state.meters.lifeSupport.waterL);
  });
});

describe('Mars: tormenta de radiación', () => {
  it('ir al refugio suspende la EVA (§4.4)', () => {
    const { session } = mars({ length: 'long' }, { storm: true });
    runUntil(session, () => session.pendingDecisions().length > 0);
    const [decision] = session.pendingDecisions();
    expect(decision!.textKey).toBe('incidents.radiationStorm');
    runUntil(session, () => session.daylight);
    session.respond(decision!.incident.id, 'goToShelter');
    expect(session.evaOpen).toBe(false);
  });

  it('al llegar se usa la batería de la base, cargada; una partida guardada conserva la suya', () => {
    const shipBattery = makeMeters({ energy: { batteryKwh: 30, capacityKwh: 120 } });
    const capacity = CONTENT.power.capacityKwh;
    expect(mars({ meters: shipBattery }).session.state.meters.energy).toEqual({ batteryKwh: capacity, capacityKwh: capacity });
    expect(mars({ meters: shipBattery, simDate: at(10) }).session.state.meters.energy).toEqual(shipBattery.energy);
  });

  it('al terminar la estancia emite phase:completed con las muestras', () => {
    const { session, bus } = mars();
    const done: string[] = [];
    bus.on('phase:completed', (r) => done.push(`${r.phase}:${r.outcome}:${r.state.inventory.samples.length}`));
    runUntil(session, () => false);
    expect(done).toEqual(['mars:completed:0']);
  });
});

describe('minijuegos de la base (E)', () => {
  it('cada sala de la base abre su minijuego, y la esclusa limpia sus sellos con el suyo', () => {
    const worn = { ...makeGameState().systems, moxie: 'yellow' as const, greenhouse: 'yellow' as const, airlock: 'yellow' as const, scrubber: 'yellow' as const };
    const { session } = mars({ length: 'long', systems: worn });
    const games = Object.fromEntries(GALE_LAYOUT.zones.map((z) => [z.id, session.minigameAt(z.id)?.id ?? null]));
    expect(games).toEqual({
      command: 'stars',
      exercise: 'bike',
      shelter: 'shield',
      greenhouse: 'plants',
      infirmary: 'pulse',
      scrubber: 'scrubber',
      radio: 'radio',
      moxie: 'moxie',
      airlock: 'seals',
    });
    expect(session.finishTask('airlock')).toBe(true);
    expect(session.state.systems.airlock).toBe('green');
  });
});

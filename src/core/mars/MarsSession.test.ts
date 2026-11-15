import { CLOCK_RULES } from '../clock/MissionClock';
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
import type { IncidentState } from '../incidents/types';
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
    expect(closest(20)).toBeGreaterThan(closest(0));
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
      // Pasos de 3 h de calma: se mide justo a las 48 h.
      runUntil(session, () => hoursIn(session) >= 48, STILL, 3 / CLOCK_RULES.calmHoursPerSecond);
      return makeMeters().lifeSupport.oxygenKg - session.state.meters.lifeSupport.oxygenKg;
    };
    // 4 × 0,82 kg/sol de consumo contra 1,5 kg/sol de MOXIE.
    expect(oxygenUsed('red')).toBeCloseTo(4 * 0.82 * 2, 1);
    expect(oxygenUsed('green')).toBeCloseTo((4 * 0.82 - 1.5) * 2, 1);
  });

  it('el invernadero suma comida; si se apaga, no', () => {
    const food = (greenhouse: 'green' | 'red') => {
      const { session } = mars({ systems: { ...makeGameState().systems, greenhouse } });
      runUntil(session, () => hoursIn(session) >= 48, STILL, 3 / CLOCK_RULES.calmHoursPerSecond);
      return session.state.inventory.foodKg;
    };
    expect(food('green') - food('red')).toBeCloseTo(1.5 * 2, 1);
  });

  it('afuera se recibe más dosis que adentro y se gasta más agua (EVA)', () => {
    const outside = mars({ length: 'long', simDate: at(8) }).session;
    const inside = mars({ length: 'long', simDate: at(8) }).session;
    // Pasos cortos: adentro no hay nada que hacer y el reloj corre más rápido (que no se pase de las 12 h).
    runUntil(outside, () => hoursIn(outside) >= 12, { activeZone: EXTERIOR, activePosition: { x: 30, y: 7 }, interacting: false }, 0.02);
    runUntil(inside, () => hoursIn(inside) >= 12, { activeZone: 'command', interacting: false }, 0.02);
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

  it('al terminar el tiempo empieza el embarque: se lleva la carga del depósito a la nave, suben todos y termina', () => {
    const { session, bus } = mars();
    const done: string[] = [];
    bus.on('phase:completed', (r) => done.push(`${r.phase}:${r.outcome}:${r.state.inventory.samples.length}`));
    runUntil(session, () => session.departing !== null);
    expect(session.departing).toMatchObject({ cargo: 'stored', aboard: 0, total: 4 });
    expect(session.evaOpen).toBe(true);
    // Sin la carga no se puede guardar nada en la nave, y el tiempo ya no corre.
    const end = session.simDate;
    session.update(0.25, { activeZone: 'ship', interacting: false });
    expect(session.actionAt('ship')).toBeNull();
    expect(session.doAction('storage')).toBe(false);
    session.update(0.25, { activeZone: 'storage', interacting: false });
    expect(session.doAction('storage')).toBe(true);
    expect(session.departing).toMatchObject({ cargo: 'carried', carrier: 'vega' });
    session.update(0.25, { activeZone: 'ship', interacting: false });
    expect(session.doAction('ship')).toBe(true);
    // Los demás caminan solos hasta la nave.
    runUntil(session, () => false, { activeZone: 'ship', interacting: false });
    expect(session.simDate).toBe(end);
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
      energy: 'fuses',
      // La cocina abre el menú junto a la mesada (sin posición, se está junto a ella).
      pantry: 'meal',
      workshop: null,
      storage: null,
      battery: null,
      ship: null,
    });
    expect(session.finishTask('airlock')).toBe(true);
    expect(session.state.systems.airlock).toBe('green');
  });
});

/** Incidente ya en impacto, con o sin respuesta elegida. */
const broken = (definitionId: string, id: string, responseId?: string): IncidentState => ({
  id,
  definitionId,
  phase: 'mars',
  status: 'active',
  impactAt: START,
  ...(responseId ? { responseId, progress: 0 } : {}),
});

describe('Mars: base con tubos, cables y fusibles', () => {
  it('un tubo roto se cierra: los automáticos dan la vuelta por otro y se repara desde su puerta', () => {
    const { session } = mars({ length: 'long', activeIncidents: [broken('tubeBreach', 'tube-1', 'patchTube')] });
    const tube = session.tubeOf('tube-1');
    expect([...session.closedPassages()]).toEqual([tube]);
    const passage = GALE_LAYOUT.passages.find((p) => p.id === tube)!;
    const door = passage.doorTiles![0]!;
    // Parado junto a la puerta (de este lado), E abre el parche; adentro del tubo no se llega.
    const outside = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      .map(([dx, dy]) => ({ x: door.col + 0.5 + dx!, y: door.row + 0.5 + dy! }))
      .find((p) => { const z = zoneAt(GALE_LAYOUT, p); return z !== null && z !== tube; })!;
    const zone = zoneAt(GALE_LAYOUT, outside);
    expect(session.minigameAt(zone, outside)?.id).toBe('patch');
    expect(session.minigameAt(zone, outside)?.zone).toBe(tube);
    // Ningún recorrido de la base pasa por el tubo roto.
    const closed = session.closedPassages();
    for (const z of GALE_LAYOUT.zones) {
      const path = route(GALE_LAYOUT, zoneSpot(zoneById(GALE_LAYOUT, 'command')), z.id, false, closed);
      for (let d = 0; d <= pathLength(path); d += 0.2) expect(zoneAt(GALE_LAYOUT, pointAlong(path, d))).not.toBe(tube);
    }
    expect(session.finishTask(tube)).toBe(true);
    expect(session.closedPassages().size).toBe(0);
  });

  it('el fusible quemado corta los paneles: la base pasa a la batería, que baja', () => {
    const { session } = mars({ length: 'long', activeIncidents: [broken('fuseBlown', 'fuse-1')] });
    expect(session.grid).toMatchObject({ fuseBlown: true, solarLinked: false, solarFactor: 0 });
    session.respond('fuse-1', 'replaceFuse');
    expect(session.minigameAt('energy')?.id).toBe('fuses');
    const before = session.state.meters.energy.batteryKwh;
    session.update(0.25, STILL);
    expect(session.state.meters.energy.batteryKwh).toBeLessThan(before);
    expect(session.finishTask('energy')).toBe(true);
    expect(session.grid.solarLinked).toBe(true);
  });

  it('los automáticos reparan solos: elegida la respuesta, la ingeniera va a la sala de energía y cambia el fusible', () => {
    const { session } = mars({ length: 'long', activeIncidents: [broken('fuseBlown', 'fuse-1')] });
    session.respond('fuse-1', 'replaceFuse');
    session.update(0.05, STILL);
    // La lista de pendientes dice quién va.
    expect(session.snapshot().todo).toContainEqual(expect.objectContaining({ kind: 'repair', helper: 'miga' }));
    expect(session.presenceOf('miga')).toBe('busy');
    runUntil(session, () => !session.state.activeIncidents.some((i) => i.id === 'fuse-1'), STILL, 0.05);
    expect(session.grid).toMatchObject({ fuseBlown: false, solarLinked: true });
  });

  it('un automático emparcha el tubo roto desde una de sus puertas, sin que el jugador vaya', () => {
    const { session } = mars({ length: 'long', activeIncidents: [broken('tubeBreach', 'tube-1', 'patchTube')] });
    expect(session.closedPassages().size).toBe(1);
    let repairing = false;
    runUntil(session, () => {
      repairing ||= session.state.crew.some((m) => session.activityOf(m.id) === 'repair');
      return session.closedPassages().size === 0;
    }, STILL, 0.05);
    expect(repairing).toBe(true);
    expect(session.closedPassages().size).toBe(0);
  });

  it('con un cable cortado la energía da la vuelta y se pierde una parte; sin camino, la batería no llega a la base', () => {
    const content: MarsContent = {
      ...CONTENT,
      grid: { ...CONTENT.grid, cables: CONTENT.grid.cables.filter((c) => ['cable-solar-base', 'cable-battery-base'].includes(c.id)) },
    };
    const { session } = mars({ length: 'long', activeIncidents: [broken('cableCut', 'cut-1', 'spliceCable')] }, { content });
    const cable = session.cableOf('cut-1');
    expect(session.grid.cutCables).toEqual([cable.id]);
    if (cable.id === 'cable-battery-base') expect(session.grid).toMatchObject({ batteryLinked: false, solarLinked: true, solarFactor: 0.75 });
    else expect(session.grid).toMatchObject({ batteryLinked: true, solarLinked: true, solarFactor: 0.75 });
    // Se empalma afuera, parado junto al corte.
    expect(zoneAt(GALE_LAYOUT, cable.at)).toBe(EXTERIOR);
    expect(session.minigameAt(EXTERIOR, cable.at)?.id).toBe('wires');
    expect(session.finishTask(`cable:${cable.id}`)).toBe(true);
    expect(session.grid.cutCables).toEqual([]);
  });

  it('la batería sin conexión no se usa: de noche falta energía y MOXIE se apaga, pero la batería queda como estaba', () => {
    const content: MarsContent = { ...CONTENT, grid: { ...CONTENT.grid, cables: CONTENT.grid.cables.filter((c) => c.id === 'cable-solar-base') } };
    const { session } = mars({}, { content });
    expect(session.grid.batteryLinked).toBe(false);
    const battery = session.state.meters.energy.batteryKwh;
    // Pasos cortos: en calma el reloj corre ~2 días por segundo y con 0,25 s ya sería de día.
    runUntil(session, () => Date.parse(session.simDate) >= Date.parse(at(3)), STILL, 0.05);
    expect(session.snapshot().power.blackout).toBe(true);
    expect(session.state.meters.energy.batteryKwh).toBe(battery);
  });

  it('cada cable se empalma afuera, en terreno que se pisa', () => {
    for (const c of CONTENT.grid.cables) expect(zoneAt(GALE_LAYOUT, c.at), c.id).toBe(EXTERIOR);
  });

  it('el tablero de energía sólo se toca desde su sala', () => {
    const { session } = mars({ length: 'long' });
    session.setLoadsOff(['radio']);
    expect(session.isLoadOn('radio')).toBe(true);
    expect(session.snapshot().power.panelBlocked).toBe(true);
    session.update(0.1, { activeZone: 'energy', interacting: false });
    session.setLoadsOff(['radio']);
    expect(session.isLoadOn('radio')).toBe(false);
  });

  it('las muestras que lleva alguien se guardan al entrar al depósito, y se conservan al guardar la partida', () => {
    const { session } = mars({ length: 'long' });
    runUntil(session, () => session.daylight);
    const site = session.sites[0]!;
    const near = { x: site.x, y: site.y };
    runUntil(session, () => session.state.inventory.samples.length > 0, { activeZone: EXTERIOR, activePosition: near, interacting: true });
    expect(session.sampleStorage).toEqual({ stored: 0, carried: 1 });
    expect(session.savedState.habitat?.mars?.carried).toEqual({ [site.id]: 'vega' });
    session.update(0.1, { activeZone: 'storage', interacting: false });
    expect(session.sampleStorage).toEqual({ stored: 1, carried: 0 });
    const resumed = mars(session.savedState).session;
    expect(resumed.sampleStorage).toEqual({ stored: 1, carried: 0 });
  });
});

describe('Mars: cosecha del invernadero y volver antes', () => {
  it('la cosecha del invernadero deja una muestra de plantas por sol, que va al depósito', () => {
    const { session } = mars({ length: 'long', activeCrewId: 'brote' });
    // Con el invernadero sano, el minijuego es la cosecha.
    expect(session.minigameAt('greenhouse')?.id).toBe('harvest');
    const food = session.state.inventory.foodKg;
    expect(session.finishTask('greenhouse')).toBe(true);
    expect(session.state.inventory.foodKg).toBeGreaterThan(food);
    const plants = session.state.inventory.samples.filter((x) => x.rock === 'plant');
    expect(plants).toHaveLength(1);
    expect(session.sampleStorage).toEqual({ stored: 0, carried: 1 });
    // Hoy ya se cosechó.
    expect(session.minigameAt('greenhouse')).toBeNull();
    // Las plantas no cuentan como rocas del objetivo.
    expect(session.snapshot().mars).toMatchObject({ plants: 1, samples: { count: 0 } });
    session.update(0.05, { activeZone: 'storage', interacting: false });
    expect(session.sampleStorage).toEqual({ stored: 1, carried: 0 });
  });

  it('si el invernadero pide cuidado, primero se curan las plantas (sin muestra) y después se cosecha', () => {
    const { session } = mars({ length: 'long', activeCrewId: 'brote', systems: { ...makeGameState().systems, greenhouse: 'yellow' } });
    expect(session.minigameAt('greenhouse')?.id).toBe('plants');
    expect(session.finishTask('greenhouse')).toBe(true);
    expect(session.state.systems.greenhouse).toBe('green');
    expect(session.state.inventory.samples).toHaveLength(0);
    // Curarlo no gasta la cosecha del día.
    expect(session.minigameAt('greenhouse')?.id).toBe('harvest');
    expect(session.finishTask('greenhouse')).toBe(true);
    expect(session.state.inventory.samples.filter((x) => x.rock === 'plant')).toHaveLength(1);
  });

  it('con todas las rocas juntadas se puede empezar el embarque sin esperar al último sol', () => {
    const { session } = mars({ length: 'long' });
    expect(session.canLeaveEarly).toBe(false);
    expect(session.leaveEarly()).toBe(false);
    const rocks = session.remainingSites().map(({ site }) => ({ id: site.id, siteId: site.id, massKg: site.massKg, value: site.value }));
    const full = mars({ length: 'long', inventory: { ...makeGameState().inventory, samples: rocks } }).session;
    expect(full.canLeaveEarly).toBe(true);
    expect(full.snapshot().mars?.canLeave).toBe(true);
    expect(full.leaveEarly()).toBe(true);
    expect(full.departing).toMatchObject({ cargo: 'stored' });
    expect(full.canLeaveEarly).toBe(false);
  });
});

describe('Mars: tareas de riesgo y recompensa', () => {
  const panelsAt = MARS_CONTENT.panels.at;
  const inner = (s: MarsSession) => s as unknown as { dust: number; averageGenerationKw(): number };
  const battery = (s: MarsSession) => s.state.meters.energy.batteryKwh;

  it('los paneles están afuera, en terreno que se pisa', () => {
    expect(zoneAt(GALE_LAYOUT, panelsAt)).toBe(EXTERIOR);
    expect(routeToPoint(GALE_LAYOUT, zoneSpot(zoneById(GALE_LAYOUT, 'airlock')), panelsAt).length).toBeGreaterThan(1);
  });

  it('el polvo se junta de a poco sobre los paneles y baja lo que generan', () => {
    const { session } = mars();
    const clean = inner(session).averageGenerationKw();
    runUntil(session, () => hoursIn(session) >= 48);
    expect(session.panels.dust).toBeGreaterThanOrEqual(2 * MARS_CONTENT.panels.dustPerSol);
    expect(session.panels.dust).toBeLessThan(3 * MARS_CONTENT.panels.dustPerSol);
    expect(session.panels.loss).toBeGreaterThan(0);
    expect(inner(session).averageGenerationKw()).toBeLessThan(clean);
    expect(session.snapshot().mars!.panels).toEqual(session.panels);
  });

  it('con los paneles sucios la batería carga menos en el día', () => {
    const afterDay = (dust: number) => {
      const { session } = mars({ meters: makeMeters({ energy: { batteryKwh: 20, capacityKwh: 160 } }) });
      inner(session).dust = dust;
      runUntil(session, () => hoursIn(session) >= 17);
      return battery(session);
    };
    expect(afterDay(1)).toBeLessThan(afterDay(0) - 5);
  });

  it('limpiarlos es una salida: junto a los paneles, E abre su minijuego y al terminar vuelven a dar todo', () => {
    const { session } = mars({ length: 'long' });
    const there: HabitatInput = { activeZone: EXTERIOR, activePosition: panelsAt, interacting: false };
    runUntil(session, () => session.evaOpen, there);
    // Con poco polvo todavía no hace falta.
    expect(session.minigameAt(EXTERIOR, panelsAt)).toBeNull();
    inner(session).dust = 0.6;
    expect(session.taskAt(EXTERIOR, panelsAt)).toMatchObject({ kind: 'task', task: { id: 'cleanPanels', tradeoff: true } });
    const game = session.minigameAt(EXTERIOR, panelsAt)!;
    expect(game).toMatchObject({ id: 'dust', zone: 'panels' });
    // Lejos de los paneles no hay nada que limpiar.
    expect(session.minigameAt(EXTERIOR, { x: panelsAt.x, y: panelsAt.y + 12 })).toBeNull();
    const dusty = inner(session).averageGenerationKw();
    expect(session.finishTask(game.zone)).toBe(true);
    expect(session.panels.dust).toBe(0);
    expect(inner(session).averageGenerationKw()).toBeGreaterThan(dusty * 1.2);
    expect(session.state.history).toContainEqual(expect.objectContaining({ key: 'mars.log.panelsCleaned' }));
    // No es una tarea de las que frenan el reloj ni aparece entre las pendientes.
    inner(session).dust = 0.6;
    expect(session.snapshot().todo.some((i) => i.kind === 'task' && i.taskId === 'cleanPanels')).toBe(false);
  });

  it('preparar la noche se hace a la tarde: la batería gasta menos de noche, pero el invernadero no crece', () => {
    const night = (prepare: boolean) => {
      const { session } = mars({ length: 'long' });
      const input: HabitatInput = { activeZone: 'battery', interacting: false };
      runUntil(session, () => hoursIn(session) >= 9, input);
      expect(session.minigameAt('battery')).toBeNull();
      runUntil(session, () => hoursIn(session) >= 13, input);
      expect(session.minigameAt('battery')).toMatchObject({ id: 'night' });
      if (prepare) {
        expect(session.finishTask('battery')).toBe(true);
        expect(session.nightReady).toBe(true);
        expect(session.minigameAt('battery')).toBeNull();
      }
      runUntil(session, () => hoursIn(session) >= 18, input);
      const dusk = { battery: battery(session), food: session.state.inventory.foodKg };
      runUntil(session, () => hoursIn(session) >= 29.5, input);
      return { session, used: dusk.battery - battery(session), eaten: dusk.food - session.state.inventory.foodKg };
    };
    const ready = night(true);
    const normal = night(false);
    expect(ready.used).toBeLessThan(normal.used * 0.9);
    // El costo: con las lámparas apagadas el invernadero no da comida esa noche.
    expect(ready.eaten).toBeGreaterThan(normal.eaten);
    expect(ready.session.state.history).toContainEqual(expect.objectContaining({ key: 'mars.log.nightReady' }));
    // Dura hasta que sale el Sol.
    runUntil(ready.session, () => hoursIn(ready.session) >= 31, { activeZone: 'battery', interacting: false });
    expect(ready.session.nightReady).toBe(false);
  });

  it('el polvo y la noche preparada se conservan al guardar la partida', () => {
    const { session, bus } = mars({ length: 'long' });
    const saved: GameState[] = [];
    bus.on('phase:progress', (s) => saved.push(s));
    runUntil(session, () => hoursIn(session) >= 13, { activeZone: 'battery', interacting: false });
    session.finishTask('battery');
    const state = saved.at(-1)!;
    expect(state.habitat?.mars?.panelDust).toBeGreaterThan(0);
    const resumed = mars(JSON.parse(JSON.stringify(state)) as GameState).session;
    expect(resumed.panels.dust).toBeCloseTo(session.panels.dust, 5);
    expect(resumed.nightReady).toBe(true);
  });

  it('ciencia a fondo: las muestras se juntan más rápido', () => {
    const hoursToSample = (science: boolean) => {
      const { session } = mars({ length: 'long' });
      const site = session.sites[0]!;
      const input: HabitatInput = { activeZone: EXTERIOR, activePosition: site, interacting: true };
      runUntil(session, () => session.evaOpen, STILL);
      if (science) (session as unknown as { mode: string }).mode = 'science';
      const start = hoursIn(session);
      runUntil(session, () => session.state.inventory.samples.length > 0, input, 0.05);
      return hoursIn(session) - start;
    };
    expect(hoursToSample(true)).toBeLessThan(hoursToSample(false) * 0.8);
  });
});

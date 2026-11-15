import { describe, expect, it } from 'vitest';
import { INCIDENT_RULES } from '../../content/incidents';
import { CARE_TASKS, SHIP_LAYOUT, VOYAGE_CONTENT } from '../../content/ship';
import { makeCrew, makeGameState, makeIncident, makeMeters } from '../../test-utils/factories';
import type { PhaseCalendar } from '../clock/schedule';
import type { CrewId } from '../crew/types';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import type { PhaseResult } from '../flow/types';
import { stormTimeline } from '../incidents/timeline';
import type { GameState } from '../state/types';
import { isWalkable, pathLength, pointAlong, route, zoneAt, zoneById, zoneSpot } from '../habitat/layout';
import type { VoyageContent } from './types';
import type { HabitatInput as VoyageInput } from '../habitat/HabitatSession';
import { VoyageSession } from './VoyageSession';

const H = 3_600_000;
const START = '2024-05-01T00:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(START) + hours * H).toISOString();

/** Fases de 3 días; con `long` el primer día se juega a tiempo normal. */
const CALENDAR: PhaseCalendar = {
  windows: {
    cruiseOut: { start: START, end: at(72) },
    mars: { start: at(72), end: at(96) },
    cruiseBack: { start: at(96), end: at(168) },
  },
  playedDays: { short: { cruiseOut: 0, mars: 0, cruiseBack: 0 }, long: { cruiseOut: 1, mars: 1, cruiseBack: 1 } },
  playHoursPerSecond: { cruiseOut: 0.2, mars: 0.2, cruiseBack: 0.2 },
};
const CONTENT: VoyageContent = { ...VOYAGE_CONTENT, calendar: CALENDAR };

const storm = stormTimeline(
  [
    {
      id: 'storm-test',
      warnAt: at(10),
      impactAt: at(20),
      endAt: at(40),
      leadHours: 10,
      warning: { kind: 'rule48h' },
      peakMeanUGyH: 380,
      baselineUGyH: 7,
      capped: false,
      sourceLinks: [],
    },
  ],
  INCIDENT_RULES,
  'https://radlab',
);

const STILL: VoyageInput = { activeZone: null, interacting: false };

function voyage(over: Partial<GameState> = {}, opts: { leg?: 'out' | 'back'; content?: VoyageContent; timeline?: typeof storm } = {}) {
  const bus = new EventBus<GameEvents>();
  const leg = opts.leg ?? 'out';
  const window = CALENDAR.windows[leg === 'out' ? 'cruiseOut' : 'cruiseBack'];
  const session = new VoyageSession({
    leg,
    state: makeGameState({ simDate: window.start, ...over }),
    bus,
    content: opts.content ?? CONTENT,
    timeline: opts.timeline ?? [],
    // Fondo de 15 μGy/h y 380 μGy/h durante la tormenta de prueba.
    doseRate: (date) => ({ date: date.slice(0, 10), uGyH: date >= at(20) && date < at(40) ? 380 : 15, capped: false }),
  });
  return { session, bus };
}

/** Avanza hasta que se cumpla `until` (o se acabe la fase) en pasos de `dt` segundos reales. */
function runUntil(session: VoyageSession, until: () => boolean, input: VoyageInput = STILL, dt = 0.25, maxSteps = 20_000): number {
  let steps = 0;
  while (!until() && !session.outcome && steps < maxSteps) {
    session.update(dt, input);
    steps++;
  }
  return steps * dt;
}

const hoursSince = (session: VoyageSession) => (Date.parse(session.simDate) - Date.parse(START)) / H;
const member = (session: VoyageSession, id: CrewId) => session.state.crew.find((m) => m.id === id)!;

describe('plano de la nave', () => {
  it('la ruta del módulo de mando al refugio pasa por las puertas y nunca atraviesa paredes', () => {
    const from = zoneSpot(zoneById(SHIP_LAYOUT, 'command'));
    for (const blind of [false, true]) {
      const path = route(SHIP_LAYOUT, from, 'shelter', blind);
      for (let d = 0; d <= pathLength(path); d += 0.1) {
        const p = pointAlong(path, d);
        expect(isWalkable(SHIP_LAYOUT, Math.floor(p.x), Math.floor(p.y)), `${p.x},${p.y}`).toBe(true);
      }
      expect(zoneAt(SHIP_LAYOUT, path.at(-1)!)).toBe('shelter');
    }
  });

  it('la ruta a ciegas es más larga que la óptima (§3.3)', () => {
    const from = zoneSpot(zoneById(SHIP_LAYOUT, 'command'));
    expect(pathLength(route(SHIP_LAYOUT, from, 'shelter', true))).toBeGreaterThan(pathLength(route(SHIP_LAYOUT, from, 'shelter')));
  });
});

describe('Voyage: el mundo corre solo', () => {
  it('en avance rápido avanzan el calendario y los medidores, día a día', () => {
    const { session, bus } = voyage({ unlockLevel: 2 });
    const days: string[] = [];
    bus.on('clock:day', ({ simDate }) => days.push(simDate));
    runUntil(session, () => hoursSince(session) >= 48);
    expect(days).toEqual(['2024-05-02', '2024-05-03']);
    expect(session.manual).toBe(false);
    const { oxygenKg } = session.state.meters.lifeSupport;
    // 4 tripulantes × 0,82 kg/día durante 2 días [BVAD].
    expect(oxygenKg).toBeCloseTo(makeMeters().lifeSupport.oxygenKg - 4 * 0.82 * 2, 1);
    expect(member(session, 'vega').doseMSv).toBeGreaterThan(0);
    expect(session.state.rngState).not.toBe(1);
  });

  it('al terminar el calendario de la fase emite phase:completed con el estado de salida', () => {
    const { session, bus } = voyage();
    const results: PhaseResult[] = [];
    bus.on('phase:completed', (r) => results.push(r));
    runUntil(session, () => false);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ phase: 'cruiseOut', outcome: 'completed', state: { simDate: at(72) } });
  });

  it('con la misma semilla la partida es idéntica', () => {
    const a = voyage({ unlockLevel: 4 }).session;
    const b = voyage({ unlockLevel: 4 }).session;
    runUntil(a, () => false);
    runUntil(b, () => false);
    expect(a.state).toEqual(b.state);
  });

  it('continúa una partida guardada desde su fecha', () => {
    const { session } = voyage({ simDate: at(30) });
    expect(session.simDate).toBe(at(30));
  });
});

describe('Voyage: tormenta de radiación', () => {
  /** Miga trasnochó y no hizo ejercicio: reacciona tarde y va por la ruta a ciegas. */
  const tiredMiga = () => makeCrew().map((m) => (m.id === 'miga' ? { ...m, fatigue: 0.9, condition: 0.5 } : m));

  it('frena el reloj, todos van al refugio según su reacción y el aviso deja de frenar al llegar', () => {
    const { session, bus } = voyage({ crew: tiredMiga() }, { timeline: storm });
    const levels: string[] = [];
    bus.on('alert:level', ({ level }) => levels.push(level));
    runUntil(session, () => session.level === 'impact');
    expect(levels).toEqual(['alert', 'impact']);
    expect(session.manual).toBe(true);
    const [decision] = session.pendingDecisions();
    expect(decision!.textKey).toBe('incidents.radiationStorm');

    session.respond(decision!.incident.id, 'goToShelter');
    const arrived: Partial<Record<CrewId, number>> = {};
    let t = 0;
    runUntil(
      session,
      () => {
        for (const m of session.state.crew) if (m.location === 'shelter' && arrived[m.id] === undefined) arrived[m.id] = t;
        t += 0.1;
        return session.level !== 'impact';
      },
      { activeZone: 'shelter', interacting: false },
      0.1,
    );
    // La tripulación descansada llega en pocos segundos; la cansada tarda bastante más (§4.2).
    expect(arrived.brote).toBeLessThan(8);
    expect(arrived.miga).toBeGreaterThan(arrived.brote! + 3);
    expect(session.level).toBe('calm');
    expect(session.state.history.find((e) => e.key === 'hud.log.allInShelter')).toMatchObject({ data: { incidentId: 'storm-test' } });
  });

  it('en el refugio se recibe mucha menos dosis que trabajando', () => {
    const dose = (response: string) => {
      const { session } = voyage({}, { timeline: storm });
      runUntil(session, () => session.level === 'impact');
      const id = session.pendingDecisions()[0]!.incident.id;
      session.respond(id, response);
      const before = member(session, 'brote').doseMSv;
      const zone = response === 'goToShelter' ? 'shelter' : 'command';
      runUntil(session, () => hoursSince(session) >= 40, { activeZone: zone, interacting: false });
      return member(session, 'brote').doseMSv - before;
    };
    expect(dose('goToShelter')).toBeLessThan(dose('keepWorking') * 0.6);
  });

  it('con el modo ayuda los automáticos van solos al refugio con la alarma (§3.3)', () => {
    const { session } = voyage({ helpMode: true }, { timeline: storm });
    runUntil(session, () => session.level === 'impact');
    runUntil(session, () => member(session, 'senda').location === 'shelter', STILL, 0.1, 200);
    expect(member(session, 'senda').location).toBe('shelter');
    expect(member(session, 'vega').location).not.toBe('shelter');
  });
});

describe('Voyage: tareas de la nave', () => {
  it('en la nave gastada de la vuelta las rutinas automáticas ponen a la ingeniera en el depurador y sigue sano', () => {
    const cared = voyage({}, { leg: 'back' }).session;
    runUntil(cared, () => false);
    expect(cared.snapshot().routines.miga.taskId).toBe('scrubber');
    expect(cared.state.systems.scrubber).toBe('green');
  });

  it('el jugador repara el depurador gastado trabajando en su cuarto (a tiempo normal)', () => {
    const { session } = voyage({ length: 'long', systems: { ...makeGameState().systems, scrubber: 'yellow' } });
    expect(session.manual).toBe(true);
    expect(session.taskAt('scrubber')).toMatchObject({ kind: 'task', task: { id: 'scrubber' } });
    runUntil(session, () => session.state.systems.scrubber === 'green', { activeZone: 'scrubber', interacting: true }, 0.25, 400);
    expect(session.state.systems.scrubber).toBe('green');
  });

  it('con el depurador al día, mantener apretado no repite el mantenimiento', () => {
    const { session } = voyage({ length: 'long', systems: { ...makeGameState().systems, scrubber: 'yellow' } });
    runUntil(session, () => session.state.systems.scrubber === 'green', { activeZone: 'scrubber', interacting: true }, 0.25, 400);
    expect(session.taskAt('scrubber')).toMatchObject({ upToDate: true, progress: 1 });
    const fatigue = member(session, 'vega').fatigue;
    runUntil(session, () => false, { activeZone: 'scrubber', interacting: true }, 0.25, 40);
    expect(session.taskAt('scrubber')).toMatchObject({ upToDate: true });
    // No trabaja de más: sin horas de trabajo no se cansa por la tarea.
    expect(member(session, 'vega').fatigue).toBeLessThanOrEqual(fatigue);
  });

  it('una llamada a casa desde la radio levanta el ánimo de toda la tripulación', () => {
    const crew = makeCrew().map((m) => ({ ...m, morale: 0.5 }));
    const { session } = voyage({ length: 'long', crew });
    runUntil(session, () => member(session, 'senda').morale > 0.6, { activeZone: 'radio', interacting: true }, 0.25, 200);
    expect(member(session, 'senda').morale).toBeGreaterThan(0.6);
  });

  it('en la vuelta el ejercicio cuenta doble para la condición física (§4.6)', () => {
    const gain = (leg: 'out' | 'back') => {
      const crew = makeCrew().map((m) => ({ ...m, condition: 0.5 }));
      const { session } = voyage({ crew }, { leg });
      const start = Date.parse(session.simDate);
      runUntil(session, () => Date.parse(session.simDate) - start >= 48 * H);
      return member(session, 'senda').condition - 0.5;
    };
    expect(gain('out')).toBeGreaterThan(0);
    expect(gain('back')).toBeCloseTo(gain('out') * 2, 2);
  });

  it('Tab: el tripulante que deja el jugador queda donde estaba y pasa a ser automático', () => {
    const { session } = voyage({ length: 'long' });
    const spot = zoneSpot(zoneById(SHIP_LAYOUT, 'pantry'));
    session.switchCrew('miga', spot);
    expect(session.state.activeCrewId).toBe('miga');
    expect(session.positionOf('vega')).toEqual(spot);
  });
});

describe('Voyage: falla en cascada', () => {
  it('sin aire entra en emergencia, la partida sigue y se puede beber el escudo de agua', () => {
    const { session, bus } = voyage({ meters: makeMeters({ lifeSupport: { oxygenKg: 0.5, waterL: 300, co2MmHg: 1.5 } }) });
    const entered: string[] = [];
    bus.on('cascade:entered', (e) => entered.push(e.meter));
    runUntil(session, () => entered.length > 0);
    expect(entered).toEqual(['lifeSupport']);
    expect(session.outcome).toBeNull();
    expect(session.sacrifices().map((s) => s.id)).toContain('drinkWaterShield');
    const water = session.state.meters.lifeSupport.waterL;
    session.sacrifice('drinkWaterShield');
    expect(session.state.waterShield).toBe(0);
    expect(session.state.meters.lifeSupport.waterL).toBeGreaterThan(water);
  });

  it('si toda la tripulación queda en reposo, la misión se suspende (tripulación a salvo)', () => {
    const crew = makeCrew().map((m) => ({ ...m, condition: 0.1 }));
    const { session, bus } = voyage({ crew });
    const results: PhaseResult[] = [];
    bus.on('phase:completed', (r) => results.push(r));
    session.update(0.25, STILL);
    expect(results[0]).toMatchObject({ outcome: 'suspended' });
  });
});

describe('Voyage: guardado a mitad de fase y logros', () => {
  it('publica su estado para el guardado manual y retoma sin repetir los incidentes ya disparados', () => {
    const { session, bus } = voyage({}, { timeline: storm });
    const published: GameState[] = [];
    bus.on('phase:progress', (s) => published.push(s));
    runUntil(session, () => session.state.activeIncidents.length > 0);
    const saved = published.at(-1)!;
    expect(saved.habitat?.planner.fired).toContain('storm-test');

    const resumed = voyage(JSON.parse(JSON.stringify(saved)) as GameState, { timeline: storm }).session;
    expect(resumed.state.habitat).toBeUndefined();
    runUntil(resumed, () => hoursSince(resumed) >= 30);
    expect(resumed.state.activeIncidents.filter((i) => i.id === 'storm-test')).toHaveLength(1);
  });

  it('"Refugio a tiempo" y "Cero radiografías extra" si todos esperan la tormenta en el refugio', () => {
    const achievements = (response: string, zone: string) => {
      const { session, bus } = voyage({}, { timeline: storm });
      const results: PhaseResult[] = [];
      bus.on('phase:completed', (r) => results.push(r));
      runUntil(session, () => session.level === 'alert');
      session.respond(session.pendingDecisions()[0]!.incident.id, response);
      runUntil(session, () => false, { activeZone: zone, interacting: false });
      return results[0]!.achievements;
    };
    expect(achievements('goToShelter', 'shelter')).toEqual(expect.arrayContaining(['shelterInTime', 'zeroExtraXrays']));
    expect(achievements('keepWorking', 'command')).toEqual([]);
  });
});

describe('minijuegos de las salas (E)', () => {
  const yellowScrubber = () => ({ length: 'long' as const, systems: { ...makeGameState().systems, scrubber: 'yellow' as const } });

  it('cada sala de la nave abre su minijuego', () => {
    const { session } = voyage(yellowScrubber());
    const games = Object.fromEntries(SHIP_LAYOUT.zones.map((z) => [z.id, session.minigameAt(z.id)?.id ?? null]));
    expect(games).toEqual({
      command: 'stars',
      exercise: 'bike',
      shelter: 'shield',
      radio: 'radio',
      infirmary: 'pulse',
      pantry: 'meal',
      scrubber: 'scrubber',
      recycler: null,
    });
    // El reciclador está al día: no hay nada que hacer ahí hasta que se gaste.
    expect(session.taskAt('recycler')).toMatchObject({ upToDate: true });
  });

  it('ganar el minijuego del depurador lo deja en verde de una vez y cansa como el trabajo a mano', () => {
    const { session } = voyage(yellowScrubber());
    expect(session.finishTask('scrubber')).toBe(true);
    expect(session.state.systems.scrubber).toBe('green');
    expect(member(session, 'vega').fatigue).toBeCloseTo(VOYAGE_CONTENT.wear.maintenanceHours * 0.05, 5);
    expect(session.minigameAt('scrubber')).toBeNull();
  });

  it('el especialista y el modo ayuda juegan más fácil; la reparación improvisada, más difícil', () => {
    const miga = voyage({ ...yellowScrubber(), activeCrewId: 'miga' }).session;
    expect(miga.minigameAt('scrubber')?.setup).toMatchObject({ easy: true });
    expect(voyage(yellowScrubber()).session.minigameAt('scrubber')?.setup.easy).toBe(false);
    expect(voyage({ ...yellowScrubber(), helpMode: true }).session.minigameAt('scrubber')?.setup.easy).toBe(true);
    const improvise = makeIncident({ id: 'f1', definitionId: 'scrubberFailure', status: 'active', responseId: 'improvise', progress: 0 });
    const hard = voyage({ length: 'long', systems: { ...makeGameState().systems, scrubber: 'red' }, activeIncidents: [improvise] }).session;
    expect(hard.minigameAt('scrubber')).toMatchObject({ id: 'scrubber', setup: { hard: true } });
  });

  it('la reparación de un incidente se termina con el minijuego', () => {
    const repair = makeIncident({ id: 'f1', definitionId: 'scrubberFailure', status: 'active', responseId: 'repair', progress: 0.5 });
    const { session, bus } = voyage({ length: 'long', systems: { ...makeGameState().systems, scrubber: 'red' }, activeIncidents: [repair] });
    const resolved: string[] = [];
    bus.on('incident:resolved', (i) => resolved.push(i.id));
    expect(session.taskAt('scrubber')).toMatchObject({ kind: 'incident' });
    expect(session.finishTask('scrubber')).toBe(true);
    expect(resolved).toEqual(['f1']);
    expect(session.state.systems.scrubber).not.toBe('red');
  });

  it('la fuga de un micrometeorito se parcha con su minijuego, en el cuarto de la fuga', () => {
    const leak = makeIncident({ id: 'm1', definitionId: 'micrometeoroid', status: 'active', responseId: 'patchLeak', progress: 0 });
    const { session } = voyage({ length: 'long', activeIncidents: [leak] });
    expect(session.minigameAt(session.leakZone('m1'))?.id).toBe('patch');
  });

  it('los cuidados del día suben el ánimo o la salud de todos y se hacen una vez por día', () => {
    const crew = makeCrew().map((m) => ({ ...m, morale: 0.5, condition: 0.5 }));
    const { session } = voyage({ length: 'long', crew });
    expect(session.finishTask('pantry')).toBe(true);
    expect(session.state.crew.every((m) => m.morale > 0.5)).toBe(true);
    expect(session.taskAt('pantry')).toMatchObject({ upToDate: true });
    expect(session.minigameAt('pantry')).toBeNull();
    expect(session.finishTask('pantry')).toBe(false);
    session.finishTask('infirmary');
    expect(session.state.crew.every((m) => m.condition > 0.5)).toBe(true);
  });

  it('en la cocina: el menú en la mesada, la receta en el recetario y de vuelta en la mesada, cocinar', () => {
    const { session } = voyage({ length: 'long' });
    const stove = zoneSpot(zoneById(SHIP_LAYOUT, 'pantry'));
    const book = CARE_TASKS.cook.recipeAt;
    const middle = { x: (stove.x + book.x) / 2, y: stove.y - 1.2 };
    const open = (at: { x: number; y: number }) => {
      const m = session.minigameAt('pantry', at);
      if (m) session.minigameStarted(m);
      return m?.setup.meal ?? null;
    };
    expect(zoneAt(SHIP_LAYOUT, book)).toBe('pantry');
    expect(session.kitchenAt('pantry', middle)).toMatchObject({ action: null, next: 'menu' });
    const menu = open(stove);
    expect(menu).toMatchObject({ stage: 'menu' });
    expect(session.kitchenAt('pantry', middle)).toMatchObject({ action: null, next: 'recipe' });
    expect(open(book)).toEqual({ dish: menu!.dish, stage: 'recipe' });
    expect(session.kitchenAt('pantry', book)).toMatchObject({ next: 'cook' });
    expect(open(stove)).toEqual({ dish: menu!.dish, stage: 'cook' });
    // Salir sin terminar no borra la receta leída: se puede volver a probar.
    expect(open(stove)).toMatchObject({ stage: 'cook' });
    session.finishTask('pantry');
    expect(session.kitchenAt('pantry', stove)).toBeNull();
  });

  it('la comida del día sale de la semilla de la partida', () => {
    const dishOf = (seed: number) => voyage({ length: 'long', seed }).session.kitchenAt('pantry')!.dish;
    expect(dishOf(5)).toBe(dishOf(5));
    expect(new Set(Array.from({ length: 12 }, (_, seed) => dishOf(seed))).size).toBeGreaterThan(1);
  });

  it('el ejercicio con la bici es el del día de quien juega', () => {
    const crew = makeCrew().map((m) => ({ ...m, condition: 0.5 }));
    const { session } = voyage({ length: 'long', crew });
    session.finishTask('exercise');
    expect(member(session, 'vega').condition).toBeGreaterThan(0.5);
    expect(member(session, 'senda').condition).toBe(0.5);
    expect(session.minigameAt('exercise')).toBeNull();
  });

  it('la llamada del minijuego levanta el ánimo de toda la tripulación al seguir el reloj', () => {
    const crew = makeCrew().map((m) => ({ ...m, morale: 0.5 }));
    const { session } = voyage({ length: 'long', crew });
    expect(session.finishTask('radio')).toBe(true);
    session.update(0.25, STILL);
    expect(member(session, 'senda').morale).toBeGreaterThan(0.6);
    expect(session.taskAt('radio')).toMatchObject({ upToDate: true });
  });

  it('con la radio apagada no se puede llamar', () => {
    const { session } = voyage({ length: 'long' });
    session.setLoadsOff(['radio']);
    expect(session.taskAt('radio')).toMatchObject({ blockedKey: 'hud.task.radioOff' });
    expect(session.minigameAt('radio')).toBeNull();
  });
});

describe('jornadas sin nada que hacer (partidas de ~15 min)', () => {
  it('con tareas del día pendientes la jornada va a tiempo normal', () => {
    const { session } = voyage({ length: 'long', crew: makeGameState().crew.map((m) => ({ ...m, condition: 0.8 })) });
    session.update(0.1, STILL);
    expect(session.hasWork()).toBe(true);
    expect(session.idle).toBe(false);
    expect(session.snapshot()).toMatchObject({ manual: true, idle: false });
  });

  it('sin tareas ni incidentes la jornada corre rápido, pero el jugador sigue manejando a su tripulante', () => {
    const { session } = voyage({ length: 'long' }, { content: { ...CONTENT, tasks: [] } });
    const before = Date.parse(session.simDate);
    session.update(0.1, STILL);
    expect(session.hasWork()).toBe(false);
    expect(session.idle).toBe(true);
    expect(session.snapshot()).toMatchObject({ manual: true, idle: true });
    expect((Date.parse(session.simDate) - before) / H).toBeGreaterThan(0.1 * CALENDAR.playHoursPerSecond.cruiseOut * 5);
  });

  it('una decisión pendiente frena el avance aunque no haya tareas', () => {
    const { session } = voyage(
      { length: 'long', activeIncidents: [makeIncident({ id: 'scrub-1', definitionId: 'scrubberFailure', phase: 'cruiseOut', status: 'active', impactAt: START })] },
      { content: { ...CONTENT, tasks: [] } },
    );
    expect(session.pendingDecisions().length).toBeGreaterThan(0);
    expect(session.hasWork()).toBe(true);
  });
});

describe('enfermería y lista de pendientes', () => {
  it('lista lo que falta hacer: sólo las tareas del día que hacen falta', () => {
    const fit = voyage({ length: 'long' }).session;
    fit.update(0.1, STILL);
    expect(fit.snapshot().todo.some((item) => item.kind === 'task' && item.taskId === 'exercise')).toBe(false);
    const { session } = voyage({ length: 'long', crew: makeGameState().crew.map((m) => ({ ...m, condition: 0.8 })) });
    session.update(0.1, STILL);
    const todo = session.snapshot().todo;
    expect(todo.length).toBeGreaterThan(0);
    expect(todo).toContainEqual(expect.objectContaining({ kind: 'task', taskId: 'exercise' }));
  });

  it('en la enfermería se duerme hasta el día siguiente y se despierta descansado', () => {
    const tired = makeGameState().crew.map((m) => ({ ...m, fatigue: 0.8 }));
    const { session } = voyage({ length: 'long', crew: tired });
    expect(session.canSleep('command')).toBe(false);
    expect(session.sleep('infirmary')).toBe(true);
    expect(session.asleep).toBe(true);
    const day = session.simDate.slice(0, 10);
    runUntil(session, () => !session.asleep, { activeZone: 'infirmary', interacting: false }, 1 / 30);
    expect(session.simDate.slice(0, 10)).not.toBe(day);
    expect(session.state.crew.find((m) => m.id === session.state.activeCrewId)!.fatigue).toBeLessThan(0.8);
  });
});

describe('dificultad de las tareas', () => {
  it('con la práctica el minijuego de una tarea se vuelve más difícil (salvo en modo ayuda)', () => {
    const play = (help: boolean) => {
      const { session } = voyage({ length: 'long', helpMode: help, activeCrewId: 'miga' });
      const setups = [];
      // Otro día: el sistema se volvió a gastar y la tarea de hoy no está hecha.
      const inner = session as unknown as { maintenance: Record<string, { hoursSince: number }>; doneOn: Record<string, string> };
      const wear = () => {
        inner.maintenance.scrubber!.hoursSince = 1e6;
        for (const key of Object.keys(inner.doneOn)) delete inner.doneOn[key];
      };
      for (let i = 0; i < 4; i++) {
        // Se gasta otra vez para que vuelva a hacer falta el mantenimiento.
        wear();
        setups.push(session.minigameAt('scrubber')?.setup);
        session.finishTask('scrubber');
      }
      return setups;
    };
    const normal = play(false);
    expect(normal[0]).toMatchObject({ easy: true });
    expect(normal[2]).toMatchObject({ easy: false });
    expect(normal[3]).toMatchObject({ hard: true });
    expect(play(true)[3]).toMatchObject({ easy: true });
  });
});

describe('más tareas después de cada tormenta y misión suspendida', () => {
  const tasks = (s: VoyageSession) => s.snapshot().todo.filter((i) => i.kind === 'task').length;

  it('cada tormenta vivida suma una tarea del día', () => {
    const { session } = voyage({ length: 'long' }, { timeline: storm });
    session.update(0.05, STILL);
    const before = tasks(session);
    runUntil(session, () => session.level === 'impact', STILL, 0.05);
    session.update(0.05, STILL);
    expect(tasks(session)).toBe(before + 1);
  });

  it('si un tripulante queda sin salud, la misión se suspende (se puede perder)', () => {
    const crew = makeGameState().crew.map((m) => (m.id === 'senda' ? { ...m, condition: 0.01 } : m));
    const { session, bus } = voyage({ crew });
    const results: string[] = [];
    bus.on('phase:completed', (r) => results.push(r.outcome));
    session.update(0.05, STILL);
    expect(session.outcome).toBe('suspended');
    expect(results).toEqual(['suspended']);
  });
});

describe('lo que hace cada tripulante automático', () => {
  it('cuando llega a su cuarto se sabe qué hace (para su globo); el jugador no tiene', () => {
    const { session } = voyage({ length: 'long' });
    runUntil(session, () => session.state.crew.some((m) => session.activityOf(m.id) !== null), STILL, 0.05, 4000);
    const working = session.state.crew.filter((m) => session.activityOf(m.id) !== null);
    expect(working.length).toBeGreaterThan(0);
    for (const m of working) expect(session.activityOf(m.id)).toBe(m.location);
    expect(session.activityOf(session.state.activeCrewId)).toBeNull();
  });
});

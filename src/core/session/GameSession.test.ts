import { describe, expect, it, vi } from 'vitest';
import { makeEnvironment, makeMission } from '../../test-utils/factories';
import { GameSession, type GameSessionOptions } from './GameSession';

const initialResources = { oxygen: 20, water: 40, food: 30, power: 60 };
const create = (over: Partial<GameSessionOptions> = {}) =>
  new GameSession({
    seed: 1,
    crew: 4,
    initialResources,
    missions: [makeMission(), makeMission({ id: 'eva', stationId: 'airlock', exposure: { radiation: 1, debris: 0 } })],
    environment: makeEnvironment(),
    ...over,
  });

describe('GameSession', () => {
  it('una misión de bajo riesgo arranca y se completa trabajando, aplicando su recompensa', () => {
    const session = create();
    session.interact('s1', 0);
    session.interact('s1', 4);
    expect(session.missions.get('m1').status).toBe('completed');
    expect(session.resources.snapshot.oxygen).toBe(25);
  });

  it('el riesgo alto pausa la simulación hasta que el jugador decide', () => {
    const session = create({ environment: makeEnvironment({ radiationRisk: 0.8 }) });
    const required = vi.fn();
    session.bus.on('decision:required', required);
    session.interact('airlock', 0.1);
    expect(required).toHaveBeenCalledOnce();
    expect(session.paused).toBe(true);
    const hours = session.gameHours;
    session.update(10);
    expect(session.gameHours).toBe(hours);
  });

  it('posponer bloquea la misión durante unas horas de juego', () => {
    const session = create({ environment: makeEnvironment({ radiationRisk: 0.8 }), postponeHours: 6, gameHoursPerSecond: 1 });
    session.interact('airlock', 0);
    session.choose('postpone');
    expect(session.isPostponed('eva')).toBe(true);
    session.interact('airlock', 0);
    expect(session.pendingDecision).toBeNull();
    session.update(7);
    session.interact('airlock', 0);
    expect(session.pendingDecision).not.toBeNull();
  });

  it('las tormentas solares degradan la generación eléctrica', () => {
    expect(create({ environment: makeEnvironment({ radiationRisk: 1 }) }).resources.solarEfficiency).toBeCloseTo(0.7);
  });

  it('termina la partida al agotarse el soporte vital', () => {
    const session = create({ gameHoursPerSecond: 24 });
    const over = vi.fn();
    session.bus.on('session:over', over);
    session.update(30);
    expect(over).toHaveBeenCalledWith({ reason: expect.stringContaining('oxygen') });
    expect(session.paused).toBe(true);
  });

  it('con la misma semilla y entradas produce el mismo resultado', () => {
    const play = () => {
      const session = create({ seed: 99, environment: makeEnvironment({ radiationRisk: 0.6 }) });
      session.interact('airlock', 0);
      return session.choose('proceed').success;
    };
    expect(play()).toBe(play());
  });
});

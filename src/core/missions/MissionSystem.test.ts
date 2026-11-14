import { describe, expect, it, vi } from 'vitest';
import { makeMission } from '../../test-utils/factories';
import { EventBus } from '../events/EventBus';
import type { GameEvents } from '../events/GameEvents';
import { MissionSystem } from './MissionSystem';

const setup = () => {
  const bus = new EventBus<GameEvents>();
  return { bus, system: new MissionSystem([makeMission(), makeMission({ id: 'm2', stationId: 's2' })], bus) };
};

describe('MissionSystem', () => {
  it('avanza el progreso con el trabajo y emite al completar', () => {
    const { bus, system } = setup();
    const completed = vi.fn();
    bus.on('mission:completed', completed);
    system.start('m1');
    system.work('m1', 2);
    expect(system.get('m1').progress).toBeCloseTo(0.5);
    system.work('m1', 5);
    expect(system.get('m1').status).toBe('completed');
    expect(completed).toHaveBeenCalledOnce();
  });

  it('no trabaja misiones que no están activas', () => {
    const { system } = setup();
    expect(system.work('m1', 10).progress).toBe(0);
  });

  it('encuentra la misión pendiente de una estación', () => {
    const { system } = setup();
    expect(system.forStation('s2')?.definition.id).toBe('m2');
    system.start('m2');
    system.fail('m2');
    expect(system.forStation('s2')).toBeUndefined();
  });

  it('rechaza ids duplicados, desconocidos y reinicios', () => {
    const bus = new EventBus<GameEvents>();
    expect(() => new MissionSystem([makeMission(), makeMission()], bus)).toThrow();
    const { system } = setup();
    expect(() => system.get('nope')).toThrow();
    system.start('m1');
    expect(() => system.start('m1')).toThrow();
  });
});

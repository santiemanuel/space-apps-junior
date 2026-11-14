import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';

describe('EventBus', () => {
  it('entrega el payload a los suscriptores y permite desuscribirse', () => {
    const bus = new EventBus<{ ping: number }>();
    const listener = vi.fn();
    const off = bus.on('ping', listener);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });
});

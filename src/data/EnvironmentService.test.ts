import { describe, expect, it, vi } from 'vitest';
import { DONKI_ARCHIVE, environmentFromArchive, randomArchiveStart, type DonkiArchive } from './archive';
import { DonkiClient, type FetchFn } from './donki/DonkiClient';
import { loadEnvironment } from './EnvironmentService';

const range = { start: '2026-01-01', end: '2026-03-01' };
const archive: DonkiArchive = {
  flares: {
    source: 'test',
    endpoint: '',
    retrievedAt: '',
    range,
    events: [
      { id: 'f1', beginTime: '2026-01-10T00:00Z', peakTime: '2026-01-10T00:10Z', classType: 'M1.0' },
      { id: 'f2', beginTime: '2026-02-20T00:00Z', peakTime: '2026-02-20T00:10Z', classType: 'X2.0' },
    ],
  },
  particleEvents: {
    source: 'test',
    endpoint: '',
    retrievedAt: '',
    range,
    events: [{ id: 's1', eventTime: '2026-02-21T03:00Z', instruments: [] }],
  },
};
const now = new Date('2026-11-14T00:00:00Z');

describe('archivo DONKI', () => {
  it('filtra los eventos reales de la ventana pedida', () => {
    const env = environmentFromArchive(archive, '2026-02-15', 10);
    expect(env).toMatchObject({ source: 'archive', window: { start: '2026-02-15', end: '2026-02-24' }, radioBlackout: 3 });
    expect(env.flares.map((f) => f.id)).toEqual(['f2']);
    expect(env.particleEvents).toHaveLength(1);
  });

  it('elige ventanas dentro del rango archivado', () => {
    expect(randomArchiveStart(archive, 30, () => 0)).toBe('2026-01-01');
    expect(randomArchiveStart(archive, 30, () => 0.9999)).toBe('2026-01-31');
  });

  it('el archivo incluido en datasets/ tiene datos reales y válidos', () => {
    expect(DONKI_ARCHIVE.flares.events.length).toBeGreaterThan(0);
    expect(DONKI_ARCHIVE.flares.source).toContain('DONKI');
    const env = environmentFromArchive(DONKI_ARCHIVE, DONKI_ARCHIVE.flares.range.start, 400);
    expect(env.flares.length).toBe(DONKI_ARCHIVE.flares.events.length);
  });
});

describe('loadEnvironment', () => {
  it('en modo archive no hace peticiones', async () => {
    const fetchFn = vi.fn<FetchFn>();
    const env = await loadEnvironment({ mode: 'archive', random: () => 0, client: new DonkiClient({ fetchFn }), archive });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(env.source).toBe('archive');
  });

  it('usa datos en vivo de los últimos días cuando DONKI responde', async () => {
    const fetchFn: FetchFn = async (url) =>
      new Response(url.includes('/FLR') ? JSON.stringify([{ flrID: 'f', beginTime: 't', peakTime: 't', classType: 'M5.0' }]) : '');
    const env = await loadEnvironment({ mode: 'live', random: () => 0, client: new DonkiClient({ fetchFn }), now, windowDays: 30 });
    expect(env).toMatchObject({ source: 'live', window: { start: '2026-10-15', end: '2026-11-14' }, radioBlackout: 2 });
  });

  it('si DONKI falla usa el archivo real (nunca lo presenta como en vivo) y notifica', async () => {
    const onError = vi.fn();
    const fetchFn: FetchFn = async () => {
      throw new Error('offline');
    };
    const env = await loadEnvironment({ mode: 'live', random: () => 0, client: new DonkiClient({ fetchFn }), archive, now, onError });
    expect(onError).toHaveBeenCalledOnce();
    expect(env.source).toBe('archive');
  });
});

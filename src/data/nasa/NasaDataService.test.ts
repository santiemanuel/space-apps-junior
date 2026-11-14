import { describe, expect, it, vi } from 'vitest';
import { NasaClient, type FetchFn } from './NasaClient';
import { environmentFromFixtures, loadEnvironment } from './NasaDataService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const now = new Date('2026-11-14T00:00:00Z');

describe('NasaClient', () => {
  it('construye las URLs con fechas y api_key', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json([]));
    await new NasaClient({ apiKey: 'K', fetchFn }).getSolarFlares('2026-10-01', '2026-11-01');
    expect(fetchFn.mock.calls[0]![0]).toBe('https://api.nasa.gov/DONKI/FLR?startDate=2026-10-01&endDate=2026-11-01&api_key=K');
  });

  it('lanza error con respuestas HTTP no exitosas', async () => {
    const client = new NasaClient({ fetchFn: async () => json({}, 429) });
    await expect(client.getNeoFeed('a', 'b')).rejects.toThrow('429');
  });
});

describe('loadEnvironment', () => {
  it('en modo fixtures no hace peticiones', async () => {
    const fetchFn = vi.fn<FetchFn>();
    const env = await loadEnvironment({ mode: 'fixtures', client: new NasaClient({ fetchFn }) });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(env.source).toBe('fixture');
    expect(env.radiationRisk).toBeGreaterThan(0);
  });

  it('usa datos en vivo cuando ambas APIs responden', async () => {
    const fetchFn: FetchFn = async (url) =>
      url.includes('DONKI')
        ? json([{ flrID: 'f', beginTime: 't', peakTime: 't', endTime: 't', classType: 'M1.0' }])
        : json({ element_count: 0, near_earth_objects: {} });
    const env = await loadEnvironment({ mode: 'live', client: new NasaClient({ fetchFn }), now });
    expect(env).toMatchObject({ source: 'live', debrisThreat: 0 });
    expect(env.radiationRisk).toBeCloseTo(0.4, 1);
  });

  it('cae a fixtures si una API falla y notifica el error', async () => {
    const onError = vi.fn();
    const fetchFn: FetchFn = async () => { throw new Error('offline'); };
    const env = await loadEnvironment({ mode: 'live', client: new NasaClient({ fetchFn }), now, onError });
    expect(onError).toHaveBeenCalledTimes(2);
    expect(env).toEqual(environmentFromFixtures());
  });
});

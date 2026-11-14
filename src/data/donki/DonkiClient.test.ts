import { describe, expect, it, vi } from 'vitest';
import { DonkiClient, type FetchFn } from './DonkiClient';

const reply = (body: string, status = 200) => new Response(body, { status });

describe('DonkiClient', () => {
  it('consulta CCMC sin barra final ni API key', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(reply('[]'));
    await new DonkiClient({ fetchFn }).getFlares('2026-10-01', '2026-10-30');
    expect(fetchFn.mock.calls[0]![0]).toBe('https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=2026-10-01&endDate=2026-10-30');
  });

  it('acepta respuestas vacías (sin eventos)', async () => {
    const client = new DonkiClient({ fetchFn: async () => reply('') });
    await expect(client.getSolarParticleEvents('a', 'b')).resolves.toEqual([]);
  });

  it('detecta errores HTTP y los "API Error" que DONKI devuelve como texto', async () => {
    await expect(new DonkiClient({ fetchFn: async () => reply('{}', 404) }).getFlares('a', 'b')).rejects.toThrow('404');
    const rangeError = new DonkiClient({ fetchFn: async () => reply('API Error: Date range cannot exceed 60 days.') });
    await expect(rangeError.getFlares('a', 'b')).rejects.toThrow('60 days');
  });
});

import type { RawDonkiFlare, RawNeoWsFeed } from './types';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface NasaClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Inyectable para tests. */
  fetchFn?: FetchFn;
}

/** Cliente HTTP mínimo para api.nasa.gov. Sólo transporte: sin lógica de juego. */
export class NasaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchFn;

  constructor({ apiKey = 'DEMO_KEY', baseUrl = 'https://api.nasa.gov', timeoutMs = 8000, fetchFn }: NasaClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  getSolarFlares(startDate: string, endDate: string): Promise<RawDonkiFlare[]> {
    return this.get('/DONKI/FLR', { startDate, endDate });
  }

  /** NeoWs limita el rango a 7 días. */
  getNeoFeed(startDate: string, endDate: string): Promise<RawNeoWsFeed> {
    return this.get('/neo/rest/v1/feed', { start_date: startDate, end_date: endDate });
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const query = new URLSearchParams({ ...params, api_key: this.apiKey });
    const response = await this.fetchFn(`${this.baseUrl}${path}?${query}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`NASA API ${path} respondió ${response.status}`);
    return (await response.json()) as T;
  }
}

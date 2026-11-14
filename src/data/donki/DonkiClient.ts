import type { RawFlare, RawSep } from './types';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface DonkiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Inyectable para tests. */
  fetchFn?: FetchFn;
}

/** Máximo de días por consulta que acepta DONKI. */
export const DONKI_MAX_RANGE_DAYS = 60;

/**
 * Cliente de la API pública de DONKI en CCMC (sin API key, con CORS abierto).
 * Se usa CCMC directamente: el proxy de api.nasa.gov añade una barra final y responde 404.
 */
export class DonkiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchFn;

  constructor({ baseUrl = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get', timeoutMs = 10_000, fetchFn }: DonkiClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  getFlares(startDate: string, endDate: string): Promise<RawFlare[]> {
    return this.get('FLR', startDate, endDate);
  }

  getSolarParticleEvents(startDate: string, endDate: string): Promise<RawSep[]> {
    return this.get('SEP', startDate, endDate);
  }

  private async get<T>(type: string, startDate: string, endDate: string): Promise<T[]> {
    const response = await this.fetchFn(`${this.baseUrl}/${type}?startDate=${startDate}&endDate=${endDate}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok || text.startsWith('API Error')) throw new Error(`DONKI ${type} respondió ${response.status}: ${text.slice(0, 100)}`);
    return text.trim() ? (JSON.parse(text) as T[]) : [];
  }
}

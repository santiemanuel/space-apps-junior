// Clima diario real en Marte publicado por la NASA (Curiosity/REMS y Perseverance/MEDA).
import { fetchJson, saveRaw } from '../lib.mjs';

const FEEDS = [
  { id: 'curiosity-rems', category: 'msl', about: 'Curiosity/REMS (CAB, España): temperatura mín./máx., presión, radiación UV, salida y puesta del sol por sol' },
  { id: 'perseverance-meda', category: 'mars2020', about: 'Perseverance/MEDA: temperatura, presión y sol marciano' },
];

export const description = 'NASA Mars Weather — Curiosity y Perseverance';

export async function run() {
  const entries = [];
  for (const { id, category, about } of FEEDS) {
    const url = `https://mars.nasa.gov/rss/api/?feed=weather&category=${category}&feedtype=json`;
    const data = await fetchJson(url);
    entries.push(
      await saveRaw(`mars-weather/${id}.json`, data, {
        source: 'NASA Mars Exploration Program',
        url,
        records: Array.isArray(data?.soles) ? data.soles.length : Array.isArray(data?.sols) ? data.sols.length : undefined,
        format: 'JSON original del feed',
        about,
      }),
    );
  }
  return entries;
}

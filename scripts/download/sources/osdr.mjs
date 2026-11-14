// NASA OSDR: metadatos de estudios de biología espacial y salud de astronautas por tema.
import { fetchJson, saveRaw, sleep } from '../lib.mjs';

const API = 'https://osdr.nasa.gov/osdr/data/search';
const TOPICS = {
  radiation: 'space radiation',
  bone: 'bone loss spaceflight',
  muscle: 'muscle atrophy spaceflight',
  plants: 'plant growth spaceflight',
  food: 'food',
  sleep: 'sleep circadian spaceflight',
  immune: 'immune spaceflight',
  isolation: 'isolation',
};

export const description = 'NASA OSDR — estudios de salud y biología espacial';

export async function run() {
  const entries = [];
  for (const [topic, term] of Object.entries(TOPICS)) {
    const url = `${API}?term=${encodeURIComponent(term)}&type=cgene&size=25`;
    const data = await fetchJson(url);
    entries.push(
      await saveRaw(`osdr/${topic}.json`, data, {
        source: 'NASA Open Science Data Repository (OSDR)',
        url,
        records: data?.hits?.hits?.length ?? 0,
        totalMatches: data?.hits?.total,
        format: 'JSON original de la búsqueda (Elasticsearch); metadatos completos de cada estudio',
        about: `Estudios sobre "${term}"`,
      }),
    );
    await sleep(300);
  }
  return entries;
}

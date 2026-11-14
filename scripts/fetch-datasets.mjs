// Descarga los datasets reales de la NASA que usa el juego y los guarda en datasets/.
// Uso: npm run datasets:fetch [-- --days 365]
// No requiere API key: DONKI (CCMC) y OSDR son públicos.
import { mkdir, writeFile } from 'node:fs/promises';

const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'; // sin barra final: api.nasa.gov la añade y responde 404
const OSDR = 'https://osdr.nasa.gov/osdr/data/search';
const MAX_DONKI_DAYS = 60;
const OSDR_TOPICS = {
  radiation: 'space radiation',
  bone: 'bone loss spaceflight',
  muscle: 'muscle atrophy spaceflight',
  plants: 'plant growth spaceflight',
  sleep: 'circadian spaceflight',
};

const daysArg = process.argv.indexOf('--days');
const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 365;
const root = new URL('../datasets/', import.meta.url);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || text.startsWith('API Error')) throw new Error(`${res.status} ${url}: ${text.slice(0, 120)}`);
  return text.trim() ? JSON.parse(text) : [];
}

async function save(path, data) {
  const url = new URL(path, root);
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`✓ datasets/${path}`);
}

/** DONKI limita cada consulta a 60 días: se pide por tramos. */
async function donki(type, start, end) {
  const events = [];
  for (let from = start; from <= end; from = addDays(from, MAX_DONKI_DAYS)) {
    const to = new Date(Math.min(addDays(from, MAX_DONKI_DAYS - 1).getTime(), end.getTime()));
    events.push(...(await getJson(`${DONKI}/${type}?startDate=${iso(from)}&endDate=${iso(to)}`)));
  }
  return events;
}

const meta = (endpoint, start, end) => ({
  source: 'NASA CCMC — Space Weather Database Of Notifications, Knowledge, Information (DONKI)',
  endpoint,
  retrievedAt: new Date().toISOString(),
  range: { start: iso(start), end: iso(end) },
});

const end = addDays(new Date(), -1);
const start = addDays(end, -days);

const flares = await donki('FLR', start, end);
await save('donki/flr.json', {
  ...meta(`${DONKI}/FLR`, start, end),
  events: flares
    .filter((f) => f.classType)
    .map((f) => ({
      id: f.flrID,
      beginTime: f.beginTime,
      peakTime: f.peakTime,
      endTime: f.endTime,
      classType: f.classType,
      sourceLocation: f.sourceLocation,
      activeRegionNum: f.activeRegionNum,
      link: f.link,
    })),
});

const seps = await donki('SEP', start, end);
await save('donki/sep.json', {
  ...meta(`${DONKI}/SEP`, start, end),
  events: seps.map((s) => ({
    id: s.sepID,
    eventTime: s.eventTime,
    instruments: (s.instruments ?? []).map((i) => i.displayName),
    linkedEvents: (s.linkedEvents ?? []).map((e) => e.activityID),
    link: s.link,
  })),
});

const topics = {};
for (const [topic, term] of Object.entries(OSDR_TOPICS)) {
  const result = await getJson(`${OSDR}?term=${encodeURIComponent(term)}&type=cgene&size=3`);
  topics[topic] = result.hits.hits.map(({ _source: s }) => ({
    accession: s.Accession,
    title: s['Study Title'],
    organism: s.organism,
    url: `https://osdr.nasa.gov/bio/repo/data/studies/${s.Accession}`,
  }));
}
await save('osdr/studies.json', {
  source: 'NASA Open Science Data Repository (OSDR)',
  endpoint: OSDR,
  retrievedAt: new Date().toISOString(),
  query: OSDR_TOPICS,
  topics,
});

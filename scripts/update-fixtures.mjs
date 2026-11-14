// Refresca los fixtures offline con datos reales de la NASA.
// Uso: NASA_API_KEY=tu_clave npm run fixtures:update
import { writeFile } from 'node:fs/promises';

const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY';
const dir = new URL('../src/data/nasa/fixtures/', import.meta.url);
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url.replace(apiKey, '***')}`);
  return res.json();
}

async function save(name, data) {
  await writeFile(new URL(name, dir), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`✓ ${name}`);
}

const tasks = [
  get(`https://api.nasa.gov/DONKI/FLR?startDate=${iso(daysAgo(30))}&endDate=${iso(new Date())}&api_key=${apiKey}`)
    .then((flares) => save('donki-flr.json', flares.map(({ flrID, beginTime, peakTime, endTime, classType, sourceLocation, activeRegionNum }) => ({ flrID, beginTime, peakTime, endTime, classType, sourceLocation, activeRegionNum })))),
  get(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${iso(daysAgo(6))}&end_date=${iso(new Date())}&api_key=${apiKey}`)
    .then((feed) => {
      const near_earth_objects = Object.fromEntries(Object.entries(feed.near_earth_objects).map(([date, list]) => [date, list.slice(0, 3).map((o) => ({
        id: o.id,
        name: o.name,
        estimated_diameter: { meters: o.estimated_diameter.meters },
        is_potentially_hazardous_asteroid: o.is_potentially_hazardous_asteroid,
        close_approach_data: o.close_approach_data.map((c) => ({
          close_approach_date: c.close_approach_date,
          relative_velocity: { kilometers_per_second: c.relative_velocity.kilometers_per_second },
          miss_distance: { lunar: c.miss_distance.lunar, kilometers: c.miss_distance.kilometers },
        })),
      }))]));
      const element_count = Object.values(near_earth_objects).flat().length;
      return save('neows-feed.json', { element_count, near_earth_objects });
    }),
];

const results = await Promise.allSettled(tasks);
for (const r of results) if (r.status === 'rejected') console.error('✗', r.reason.message);
process.exitCode = results.some((r) => r.status === 'rejected') ? 1 : 0;

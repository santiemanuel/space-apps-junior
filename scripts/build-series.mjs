// Series diarias por fecha que usa la simulación (dosis y clima), derivadas de datasets/raw/.
// Uso: node scripts/build-series.mjs (sin red). Escribe datasets/series/*.json.
//
//  - deep-space-dose.json: BioSentinel (BPD), media diaria en μGy/h con tope de 650 (game-design §3.2.1).
//  - mars-cruise-dose.json: TGO Liulin-MO en crucero (2016), media diaria en μGy/h.
//  - mars-surface-dose.json: Curiosity RAD, media diaria en μGy/h.
//  - gale-weather.json: REMS de Curiosity por fecha terrestre, recortado al rango de RAD (2015 → 06/2024).
//    Las mínimas < −90 °C que caen más de 15 °C respecto a la mediana de los 3 soles vecinos a cada lado
//    se tratan como artefacto: se usa esa mediana y se conserva el valor crudo.
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const BIOSENTINEL_CAP = 650;
const OUTLIER_BELOW_C = -90;
const OUTLIER_JUMP_C = 15;

const root = new URL('../datasets/', import.meta.url);
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

async function dailyCsv(path, instrument) {
  const text = await readFile(new URL(path, root), 'utf8');
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
    .filter(([, id, n, , mean]) => (!instrument || id === instrument) && Number(n) > 0 && Number(mean) > 0)
    .map(([date, , , , mean]) => ({ date, mean: Number(mean) }));
}

async function save(name, data) {
  await mkdir(new URL('series/', root), { recursive: true });
  await writeFile(new URL(`series/${name}`, root), `${JSON.stringify(data)}\n`);
  console.log(`✓ datasets/series/${name} (${data.rows.length} días)`);
}

const RADLAB = 'https://visualization.osdr.nasa.gov/radlab/';

const bio = await dailyCsv('raw/radlab/daily/deep-space-biosentinel.csv');
await save('deep-space-dose.json', {
  source: 'NASA OSDR RadLab — BioSentinel BPD (espacio profundo, 1 UA), medias diarias',
  url: RADLAB,
  unit: 'uGy/h',
  rule: `Tope de ${BIOSENTINEL_CAP} μGy/h (game-design §3.2.1); capped=1 marca los días recortados`,
  fields: ['date', 'meanUGyH', 'capped'],
  rows: bio.map((d) => [d.date, round(Math.min(d.mean, BIOSENTINEL_CAP)), d.mean > BIOSENTINEL_CAP ? 1 : 0]),
});

const tgo = await dailyCsv('raw/radlab/daily/mars-cruise-orbit-tgo-liulin.csv', 'Liulin-MO-AB-Cruise');
await save('mars-cruise-dose.json', {
  source: 'NASA OSDR RadLab — ExoMars TGO Liulin-MO (crucero a Marte, 2016), medias diarias',
  url: RADLAB,
  unit: 'uGy/h',
  fields: ['date', 'meanUGyH'],
  rows: tgo.map((d) => [d.date, round(d.mean)]),
});

const rad = await dailyCsv('raw/radlab/daily/mars-surface-curiosity-rad.csv', 'MSL-RAD-Surface');
await save('mars-surface-dose.json', {
  source: 'NASA OSDR RadLab — Curiosity RAD (superficie de Marte, cráter Gale), medias diarias',
  url: RADLAB,
  unit: 'uGy/h',
  fields: ['date', 'meanUGyH'],
  rows: rad.map((d) => [d.date, round(d.mean)]),
});

const rems = JSON.parse(await readFile(new URL('raw/mars-weather/curiosity-rems.json', root), 'utf8'))
  .soles.slice()
  .sort((a, b) => Number(a.sol) - Number(b.sol));
const num = (v) => (v === '--' || v === '' || v == null ? null : Number(v));
const temps = rems.map((s) => num(s.min_temp));
const medianOf = (xs) => {
  const s = xs.filter((x) => x !== null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const [radStart, radEnd] = [rad[0].date, rad.at(-1).date];
const weather = rems
  .map((s, i) => {
    const raw = temps[i];
    const neighbours = medianOf([...temps.slice(Math.max(0, i - 3), i), ...temps.slice(i + 1, i + 4)]);
    const outlier = raw !== null && neighbours !== null && raw < OUTLIER_BELOW_C && neighbours - raw > OUTLIER_JUMP_C;
    return {
      date: s.terrestrial_date,
      sol: Number(s.sol),
      minTempC: outlier ? neighbours : raw,
      rawMinTempC: outlier ? raw : null,
      maxTempC: num(s.max_temp),
      uv: s.local_uv_irradiance_index === '--' ? null : s.local_uv_irradiance_index,
    };
  })
  .filter((w) => w.date >= radStart && w.date <= radEnd && w.minTempC !== null);
await save('gale-weather.json', {
  source: 'NASA Mars Exploration Program / Centro de Astrobiología — Curiosity REMS (cráter Gale), un registro por sol',
  url: 'https://mars.nasa.gov/msl/mission/weather/',
  rule: `Mínimas < ${OUTLIER_BELOW_C} °C aisladas (> ${OUTLIER_JUMP_C} °C bajo la mediana de ±3 soles) se reemplazan por esa mediana; rawMinTempC guarda el valor original`,
  fields: ['date', 'sol', 'minTempC', 'maxTempC', 'uv', 'rawMinTempC'],
  rows: weather.map((w) => [w.date, w.sol, w.minTempC, w.maxTempC, w.uv, w.rawMinTempC]),
});
console.log(`  mínimas ajustadas en el rango: ${weather.filter((w) => w.rawMinTempC !== null).length}`);

// Deriva desde datasets/raw/ (sin red) los datos de eventos que faltaban para S6:
//
//  - storms/radiation-peaks.json: pico a resolución completa de las tormentas con serie de evento en RadLab
//    (BioSentinel en mayo de 2024 y Curiosity el 20/05/2024). Inicio = primera lectura del día de la tormenta por
//    encima de PEAK_FACTOR × la mediana de los días previos del archivo; fondo = esa mediana.
//  - series/van-allen-artemis.json: dosis diaria de los cuatro sensores de Artemis I (16/11 → 11/12/2022). El
//    16/11 es el lanzamiento y el cruce de los cinturones de Van Allen.
//  - notices/donki-notices.json: avisos de DONKI para Control de Misión (llamaradas con nombre, SEP y CME con
//    llegada estimada a Marte), con los datos clave extraídos del texto y el resumen original en inglés.
//
// Uso: node scripts/build-events.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const PEAK_FACTOR = 5;
const SUMMARY_MAX = 240;
const RADLAB = 'https://visualization.osdr.nasa.gov/radlab/';

const root = new URL('../datasets/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const toIso = (t) => `${t.replace(/"/g, '').replace(/Z$/, '')}Z`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function save(path, data, count, indent = 1) {
  await mkdir(new URL(path.slice(0, path.lastIndexOf('/') + 1), root), { recursive: true });
  await writeFile(new URL(path, root), `${JSON.stringify(data, null, indent)}\n`);
  console.log(`✓ datasets/${path} (${count})`);
}

// --- Picos de tormenta a resolución completa ---
const EVENT_FILES = [
  { id: 'peak-deep-space-2024-05', file: '2024-05-gannon-storm_heliocentric.csv', site: 'deepSpace', instrument: 'BPD', mission: 'BioSentinel', stormDay: '2024-05-11' },
  { id: 'peak-mars-2024-05-20', file: '2024-05-20-mars-sep_curiosity.csv', site: 'marsSurface', instrument: 'RAD', mission: 'Curiosity', stormDay: '2024-05-20' },
];
const peaks = [];
for (const e of EVENT_FILES) {
  const readings = (await read(`raw/radlab/events/${e.file}`))
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
    .map(([t, , v]) => ({ t: toIso(t), v: Number(v) }))
    .filter((r) => Number.isFinite(r.v));
  const baseline = median(readings.filter((r) => r.t < e.stormDay).map((r) => r.v));
  const onset = readings.find((r) => r.t >= e.stormDay && r.v > PEAK_FACTOR * baseline);
  const peak = readings.reduce((a, b) => (b.v > a.v ? b : a));
  peaks.push({
    id: e.id,
    site: e.site,
    instrument: e.instrument,
    mission: e.mission,
    onsetAt: onset.t,
    peakAt: peak.t,
    peakUGyH: round(peak.v),
    baselineUGyH: round(baseline, 2),
    file: `raw/radlab/events/${e.file}`,
  });
}
await save(
  'storms/radiation-peaks.json',
  {
    source: 'NASA OSDR RadLab — series de evento a resolución completa. Derivado por scripts/build-events.mjs',
    url: RADLAB,
    rule: `Fondo: mediana de las lecturas previas al día de la tormenta. Inicio: primera lectura de ese día por encima de ${PEAK_FACTOR} × el fondo`,
    peaks,
  },
  `${peaks.length} picos`,
);

// --- Cruce de Van Allen de Artemis I ---
const artemis = (await read('raw/radlab/daily/moon-orbit-lro-crater.csv'))
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => line.split(','))
  .filter(([, id]) => id.startsWith('Artemis-I-'))
  .map(([date, id, n, min, mean, max]) => [date, id.replace('Artemis-I-', ''), Number(n), round(Number(mean), 2), round(Number(max), 1)]);
await save(
  'series/van-allen-artemis.json',
  {
    source: 'NASA OSDR RadLab — Artemis I (Orion): sensores HERA (HSU1, HSU2), EAD (MU01) y M-42 (SN127), estadísticas diarias',
    url: RADLAB,
    unit: 'uGy/h',
    note: 'Lanzamiento el 16/11/2022 a las 06:47 UTC: ese día incluye el cruce de los cinturones de Van Allen',
    launchDate: '2022-11-16',
    fields: ['date', 'instrument', 'n', 'meanUGyH', 'maxUGyH'],
    rows: artemis,
  },
  `${artemis.length} filas`,
);

// --- Avisos de DONKI para Control de Misión ---
const notifications = JSON.parse(await read('raw/donki/notifications.json'));
const field = (body, re) => body.match(re)?.[1]?.trim();
const summaryOf = (body) => {
  const first = (field(body, /## Summary:\s*([\s\S]*?)(?:\n\s*\n|\n##)/) ?? '').replace(/\s+/g, ' ').trim();
  return first.length > SUMMARY_MAX ? `${first.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : first;
};
const notices = [];
for (const n of notifications) {
  const body = n.messageBody ?? '';
  const type = field(body, /## Message Type: (.*)/) ?? '';
  const base = { id: n.messageID, issuedAt: toIso(n.messageIssueTime.replace(/Z$/, '')), url: n.messageURL, summary: summaryOf(body) };
  if (n.messageType === 'FLR' && /Notification - [XM][\d.]+ Flare/.test(type)) {
    const classType = field(body, /Flare intensity: ([XM][\d.]+) class/);
    const peakAt = field(body, /Flare peak time: (\S+?)\.?\s/);
    if (classType && peakAt) notices.push({ ...base, kind: 'flare', params: { classType, peakAt } });
  } else if (n.messageType === 'SEP' && !/Prediction/.test(type) && !/forecast/i.test(base.summary)) {
    const detector = field(body, /detected by ([A-Za-z0-9 ]+?)[.\s]/) ?? field(type, /SEP \((.*)\)/) ?? '';
    const startAt = field(body, /starting at (\S+?)\.?\s/) ?? base.issuedAt;
    notices.push({ ...base, kind: 'sep', params: { detector, startAt } });
  } else if (n.messageType === 'CME' && /CME[^\n]*\([^)]*Mars/.test(type)) {
    const marsAt = field(body, /Mars(?: \([^)]*\))? at (\d{4}-\d\d-\d\dT\d\d:\d\dZ)/);
    const speed = Number(field(body, /Estimated speed: ~?(\d+)/));
    if (marsAt && speed) notices.push({ ...base, kind: 'cmeMars', params: { speedKmS: speed, marsArrivalAt: marsAt, glancing: /Mars \(glancing blow\)/.test(body) } });
  }
}
notices.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
const byKind = Object.fromEntries(['flare', 'sep', 'cmeMars'].map((k) => [k, notices.filter((x) => x.kind === k).length]));
await save(
  'notices/donki-notices.json',
  {
    source: 'NASA CCMC DONKI — notifications (raw/donki/notifications.json). Derivado por scripts/build-events.mjs',
    url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    rule: 'Llamaradas M/X con nombre, eventos SEP detectados (sin predicciones ni pronósticos) y CME con llegada estimada a Marte. summary: primer párrafo del resumen original (inglés)',
    notices,
  },
  JSON.stringify(byKind),
);

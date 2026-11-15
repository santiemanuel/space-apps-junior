// Deriva las tormentas de radiación en espacio profundo a partir de los datos crudos y las guarda en
// datasets/storms/biosentinel-storms.json. Uso: node scripts/build-storms.mjs (sin red).
//
// Para cada tormenta:
//  - días: medias diarias de BioSentinel por encima de STORM_FACTOR × la mediana de los 27 días previos;
//  - impacto: primer evento SEP de DONKI del día en que empieza la subida (es el inicio del pico de dosis);
//  - aviso: primera llamarada M5+ o X de la misma región activa en las 72 h previas al impacto (la detección
//    en DONKI que precede al pico). Sin detección previa, el juego usa 48 h simuladas (game-design §3.1).
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const STORM_FACTOR = 5;
const BASELINE_DAYS = 27;
const WARNING_WINDOW_H = 72;
const FALLBACK_LEAD_H = 48;
const CAP_UGY_H = 650;

const root = new URL('../datasets/', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const HOUR = 3_600_000;
const toMs = (iso) => Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`);
const toIso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const csv = await readFile(new URL('raw/radlab/daily/deep-space-biosentinel.csv', root), 'utf8');
const days = csv
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => line.split(','))
  .map(([date, , n, , mean, max]) => ({ date, n: Number(n), mean: Number(mean), max: Number(max) }))
  .filter((d) => d.n > 0 && d.mean > 0);

const flares = (await readJson('raw/donki/flr.json')).filter((f) => f.classType);
const seps = await readJson('raw/donki/sep.json');
const flareById = new Map(flares.map((f) => [f.flrID, f]));
const isStrong = (f) => /^X|^M[5-9]/.test(f.classType);

// 1. Días de tormenta agrupados (se tolera un día suelto por debajo del umbral).
const stormDays = [];
days.forEach((day, i) => {
  if (i < BASELINE_DAYS) return;
  const baseline = median(days.slice(i - BASELINE_DAYS, i).map((d) => d.mean));
  if (day.mean > STORM_FACTOR * baseline) stormDays.push({ ...day, baseline });
});
const groups = [];
for (const day of stormDays) {
  const last = groups.at(-1)?.at(-1);
  if (last && toMs(day.date) - toMs(last.date) <= 2 * 24 * HOUR) groups.at(-1).push(day);
  else groups.push([day]);
}

// 2. Impacto y aviso de cada tormenta.
const storms = groups.map((group) => {
  const first = group[0];
  const last = group.at(-1);
  const sameDay = seps.filter((s) => s.eventTime.startsWith(first.date)).sort((a, b) => toMs(a.eventTime) - toMs(b.eventTime));
  const prevDay = seps.filter((s) => toMs(s.eventTime) >= toMs(first.date) - 24 * HOUR && toMs(s.eventTime) < toMs(first.date));
  const sep = sameDay[0] ?? prevDay.at(-1) ?? null;
  const impactMs = sep ? toMs(sep.eventTime) : toMs(first.date) + 12 * HOUR;

  const linkedFlare = (sep?.linkedEvents ?? []).map((e) => flareById.get(e.activityID)).find(Boolean) ?? null;
  const region = linkedFlare?.activeRegionNum ?? null;
  const detection =
    flares
      .filter((f) => region !== null && f.activeRegionNum === region && isStrong(f))
      .filter((f) => {
        const t = toMs(f.peakTime ?? f.beginTime);
        return t < impactMs && t >= impactMs - WARNING_WINDOW_H * HOUR;
      })
      .sort((a, b) => toMs(a.peakTime) - toMs(b.peakTime))[0] ??
    (linkedFlare && toMs(linkedFlare.peakTime) < impactMs ? linkedFlare : null);

  const warnMs = detection ? toMs(detection.peakTime ?? detection.beginTime) : impactMs - FALLBACK_LEAD_H * HOUR;
  const peak = group.reduce((a, b) => (b.mean > a.mean ? b : a));
  return {
    id: `storm-${first.date}`,
    warnAt: toIso(warnMs),
    impactAt: toIso(impactMs),
    endAt: toIso(toMs(last.date) + 24 * HOUR),
    leadHours: Math.round((impactMs - warnMs) / HOUR * 10) / 10,
    warning: detection
      ? { kind: 'flare', classType: detection.classType, activeRegion: detection.activeRegionNum, link: detection.link }
      : { kind: 'rule48h' },
    impact: sep
      ? { kind: 'sep', instruments: (sep.instruments ?? []).map((i) => i.displayName), link: sep.link }
      : { kind: 'radlabDay' },
    peakDay: peak.date,
    peakMeanUGyH: Math.round(peak.mean * 10) / 10,
    capped: peak.mean > CAP_UGY_H,
    baselineUGyH: Math.round(first.baseline * 10) / 10,
  };
});

const out = {
  source:
    'NASA OSDR RadLab (BioSentinel/BPD, medias diarias) + NASA CCMC DONKI (FLR, SEP). Derivado por scripts/build-storms.mjs',
  links: {
    radlab: 'https://visualization.osdr.nasa.gov/radlab/',
    donki: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  },
  rules: {
    stormFactor: STORM_FACTOR,
    baselineDays: BASELINE_DAYS,
    warningWindowHours: WARNING_WINDOW_H,
    fallbackLeadHours: FALLBACK_LEAD_H,
    capUGyH: CAP_UGY_H,
  },
  range: { start: days[0].date, end: days.at(-1).date },
  storms,
};

await mkdir(new URL('storms/', root), { recursive: true });
await writeFile(new URL('storms/biosentinel-storms.json', root), `${JSON.stringify(out, null, 2)}\n`);
console.log(`✓ datasets/storms/biosentinel-storms.json (${storms.length} tormentas)`);
for (const s of storms) console.log(s.id, s.warnAt, '→', s.impactAt, `${s.leadHours} h`, s.warning.kind, s.warning.classType ?? '', s.peakMeanUGyH, s.capped ? 'capped' : '');

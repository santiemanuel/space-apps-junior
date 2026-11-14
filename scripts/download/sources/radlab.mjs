// NASA OSDR RadLab: tasas de dosis absorbida (μGy/h) medidas por instrumentos reales.
// Las series completas pesan cientos de MB, así que se guardan estadísticas diarias por instrumento
// y, aparte, muestras a resolución completa de tormentas solares reales.
import { saveRaw, streamCsvRows } from '../lib.mjs';

const API = 'https://visualization.osdr.nasa.gov/radlab/api/'; // con barra final

const SERIES = [
  { id: 'moon-orbit-lro-crater', filter: 'celestial_body=Moon', about: 'Órbita lunar — LRO/CRaTER (NASA)' },
  { id: 'mars-surface-curiosity-rad', filter: 'spacecraft=Curiosity', about: 'Superficie de Marte — Curiosity/RAD (NASA)' },
  { id: 'deep-space-biosentinel', filter: 'trajectory=Heliocentric', about: 'Espacio profundo a 1 UA — BioSentinel (NASA, Artemis I)' },
  { id: 'mars-cruise-orbit-tgo-liulin', filter: 'instrument=Liulin-MO-AB', about: 'Crucero a Marte y órbita marciana — ExoMars TGO/Liulin-MO (ESA/Roscosmos)' },
  // La serie completa de la ISS provoca un 504 en la API: se pide año a año.
  { id: 'iss-dostel', filter: 'instrument=DosTel', years: [2009, new Date().getUTCFullYear()], about: 'Estación Espacial Internacional — DosTel (DLR, módulo Columbus)' },
];

/** Ventanas de tormentas reales para guardar a resolución completa. */
const EVENTS = [
  { id: '2024-05-gannon-storm', start: '2024-05-08', end: '2024-05-15', filters: ['celestial_body=Moon', 'trajectory=Heliocentric', 'instrument=DosTel'],
    about: 'Tormenta solar de mayo de 2024 (llamaradas X y evento SEP), vista desde la Luna, el espacio profundo y la ISS' },
  { id: '2024-05-20-mars-sep', start: '2024-05-17', end: '2024-05-24', filters: ['spacecraft=Curiosity'],
    about: 'Evento SEP del 20 de mayo de 2024 medido en la superficie de Marte por Curiosity/RAD' },
];

export const description = 'NASA OSDR RadLab — dosis de radiación en la Luna, Marte, el espacio profundo y la ISS';

export async function run() {
  const entries = [];
  for (const { id, filter, years, about } of SERIES) {
    const url = `${API}?${filter}&absorbed_dose_rate&format=csv`;
    const urls = years
      ? Array.from({ length: years[1] - years[0] + 1 }, (_, i) => `${url}&timestamp%3E=${years[0] + i}-01-01&timestamp%3C${years[0] + i + 1}-01-01`)
      : [url];
    console.log(`  … ${id} (streaming${years ? `, ${urls.length} tramos anuales` : ''})`);
    const days = new Map();
    let rows = 0;
    try {
      for (const part of urls) for await (const row of streamCsvRows(part)) {
        const value = Number(row.absorbed_dose_rate);
        if (!row.timestamp || !Number.isFinite(value)) continue;
        rows++;
        const key = `${row.timestamp.slice(0, 10)},${row.instrument_id}`;
        const d = days.get(key) ?? { n: 0, sum: 0, min: Infinity, max: -Infinity };
        d.n++;
        d.sum += value;
        d.min = Math.min(d.min, value);
        d.max = Math.max(d.max, value);
        days.set(key, d);
      }
    } catch (error) {
      console.error(`  ✗ ${id}: ${error.message}`);
      continue;
    }
    const lines = [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => `${key},${d.n},${round(d.min)},${round(d.sum / d.n)},${round(d.max)}`);
    entries.push(
      await saveRaw(`radlab/daily/${id}.csv`, `date,instrument_id,n,min_uGy_h,mean_uGy_h,max_uGy_h\n${lines.join('\n')}\n`, {
        source: 'NASA OSDR RadLab',
        url,
        records: lines.length,
        sourceRows: rows,
        format: 'CSV; estadísticas diarias (UTC) de absorbed_dose_rate por instrument_id, en μGy/h',
        about,
      }),
    );
  }

  for (const { id, start, end, filters, about } of EVENTS) {
    for (const filter of filters) {
      const url = `${API}?${filter}&timestamp%3E=${start}&timestamp%3C${end}&absorbed_dose_rate&format=csv`;
      const res = await fetch(url);
      const csv = await res.text();
      const slug = filter.split('=')[1].toLowerCase();
      entries.push(
        await saveRaw(`radlab/events/${id}_${slug}.csv`, csv, {
          source: 'NASA OSDR RadLab',
          url,
          records: Math.max(0, csv.trim().split('\n').length - 1),
          format: 'CSV original de la API, resolución completa (absorbed_dose_rate en μGy/h)',
          about,
        }),
      );
    }
  }
  return entries;
}

const round = (v) => Math.round(v * 10_000) / 10_000;

// NASA CCMC DONKI: eventos de clima espacial tal como los devuelve la API (sin recortar campos).
import { addDays, dateChunks, fetchJson, isoDate, saveRaw, sleep } from '../lib.mjs';

const API = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'; // sin barra final
const START = new Date('2024-01-01T00:00:00Z'); // incluye el máximo solar de 2024 (tormenta de mayo, X9.0 de octubre)

const TYPES = [
  { type: 'FLR', chunkDays: 60, about: 'Llamaradas solares (clase GOES): radiación y apagones de radio' },
  { type: 'SEP', chunkDays: 60, about: 'Eventos de partículas energéticas solares: la principal dosis aguda para astronautas' },
  { type: 'CME', chunkDays: 60, about: 'Eyecciones de masa coronal con sus análisis (velocidad, dirección): sirven como alerta temprana' },
  { type: 'GST', chunkDays: 60, about: 'Tormentas geomagnéticas con índice Kp (efecto en la Tierra)' },
  { type: 'IPS', chunkDays: 60, about: 'Choques interplanetarios: llegada de la perturbación a la Tierra, Marte, sondas' },
  { type: 'HSS', chunkDays: 60, about: 'Corrientes de viento solar rápido' },
  { type: 'MPC', chunkDays: 60, about: 'Cruces de la magnetopausa (la magnetosfera se comprime)' },
  { type: 'RBE', chunkDays: 60, about: 'Aumentos de electrones en los cinturones de radiación' },
  { type: 'notifications', chunkDays: 30, query: '&type=all', about: 'Textos reales de alertas y boletines semanales de los analistas de la NASA' },
];

export const description = 'NASA CCMC DONKI — clima espacial desde 2024';

export async function run() {
  const end = addDays(new Date(), -1);
  const entries = [];
  for (const { type, chunkDays, query = '', about } of TYPES) {
    const records = [];
    for (const [from, to] of dateChunks(START, end, chunkDays)) {
      records.push(...((await fetchJson(`${API}/${type}?startDate=${isoDate(from)}&endDate=${isoDate(to)}${query}`)) ?? []));
      await sleep(300);
    }
    entries.push(
      await saveRaw(`donki/${type.toLowerCase()}.json`, records, {
        source: 'NASA CCMC — DONKI',
        url: `${API}/${type}`,
        query: { startDate: isoDate(START), endDate: isoDate(end), extra: query || undefined },
        records: records.length,
        format: 'JSON array, respuesta original de la API concatenada por tramos',
        about,
      }),
    );
  }
  return entries;
}

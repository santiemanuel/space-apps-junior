// Documentos de referencia de la NASA con los valores de diseño de soporte vital, agua, comida, CO2 y radiación.
import { fetchText, fetchWithRetry, saveRaw } from '../lib.mjs';

const BVAD = 'https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf';

const DOCS = [
  { file: 'bvad-2022.pdf', url: BVAD,
    about: 'Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV2: consumos y producciones por tripulante' },
  { file: 'ochmo-tb-002-eclss.pdf', url: 'https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf',
    about: 'Soporte vital (ECLSS): entradas y salidas por tripulante, reciclaje de agua' },
  { file: 'ochmo-tb-004-carbon-dioxide.pdf', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf',
    about: 'Límites de CO2 (≤ 3 mmHg) y síntomas observados en la ISS' },
  { file: 'ochmo-tb-007-mission-duration.pdf', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-007-mission-duration.pdf',
    about: 'Cómo cambian las necesidades según la duración de la misión' },
  { file: 'ochmo-tb-013-food-and-nutrition.pdf', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-013-food-and-nutrition.pdf',
    about: 'Comida: 3035 kcal por tripulante y día' },
  { file: 'ochmo-tb-020-radiation-protection.pdf', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf',
    about: 'Límites de radiación: 600 mSv de carrera, 250 mSv ante un SPE de referencia' },
  { file: 'ochmo-tb-027-water.pdf', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-027-water.pdf',
    about: 'Agua: 2,5 L por tripulante y día, 240 mL por hora de EVA' },
];

export const description = 'Documentos de referencia NASA (BVAD y NASA-STD-3001)';

export async function run() {
  const entries = [];
  for (const { file, url, about } of DOCS) {
    const bytes = new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer());
    entries.push(await saveRaw(`references/${file}`, bytes, { source: 'NASA', url, format: 'PDF', about }));
  }
  const text = await fetchText(`${BVAD}.txt`);
  entries.push(
    await saveRaw('references/bvad-2022.txt', text, {
      source: 'NASA Technical Reports Server',
      url: `${BVAD}.txt`,
      format: 'Texto completo extraído por NTRS (útil para buscar valores)',
      about: 'Texto del BVAD',
    }),
  );
  return entries;
}

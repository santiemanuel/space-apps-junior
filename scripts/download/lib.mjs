// Utilidades compartidas por los descargadores de datasets/raw/.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const RAW_DIR = join(ROOT, 'datasets', 'raw');
/** Archivos más grandes que esto no se versionan (se listan en datasets/raw/.gitignore). */
export const MAX_VERSIONED_BYTES = 5 * 1024 * 1024;

export const isoDate = (d) => d.toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tramos [inicio, fin] de como mucho `days` días entre dos fechas (ambas incluidas). */
export function dateChunks(start, end, days) {
  const chunks = [];
  for (let from = start; from <= end; from = addDays(from, days)) {
    chunks.push([from, new Date(Math.min(addDays(from, days - 1).getTime(), end.getTime()))]);
  }
  return chunks;
}

export async function fetchWithRetry(url, { retries = 3, timeoutMs = 120_000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'space-apps-dataset-downloader' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (error) {
      if (attempt >= retries) throw new Error(`${url}: ${error.message}`);
      await sleep(1500 * attempt);
    }
  }
}

export async function fetchText(url, options) {
  return (await fetchWithRetry(url, options)).text();
}

export async function fetchJson(url, options) {
  const text = await fetchText(url, options);
  if (text.startsWith('API Error')) throw new Error(`${url}: ${text.slice(0, 120)}`);
  return text.trim() ? JSON.parse(text) : null;
}

/** Recorre un CSV remoto línea a línea sin cargarlo entero en memoria. */
export async function* streamCsvRows(url, options) {
  const res = await fetchWithRetry(url, { timeoutMs: 1_800_000, ...options });
  const decoder = new TextDecoder();
  let buffer = '';
  let header = null;
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const cells = parseCsvLine(line.trim());
      if (!cells.length || (cells.length === 1 && !cells[0])) continue;
      if (!header) header = cells;
      else yield Object.fromEntries(header.map((key, i) => [key, cells[i]]));
    }
  }
  if (buffer.trim() && header) yield Object.fromEntries(header.map((key, i) => [key, parseCsvLine(buffer.trim())[i]]));
}

function parseCsvLine(line) {
  return line ? line.split(',').map((cell) => cell.replace(/^"|"$/g, '')) : [];
}

/**
 * Guarda un archivo en datasets/raw/ y devuelve su entrada de manifiesto.
 * `meta` describe la fuente para el procesamiento posterior.
 */
export async function saveRaw(relPath, content, meta) {
  const path = join(RAW_DIR, relPath);
  await mkdir(dirname(path), { recursive: true });
  const data = typeof content === 'string' || content instanceof Uint8Array ? content : `${JSON.stringify(content, null, 1)}\n`;
  await writeFile(path, data);
  const bytes = typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength;
  const sha256 = createHash('sha256').update(data).digest('hex');
  console.log(`  ✓ ${relative(ROOT, path).split(sep).join('/')} (${(bytes / 1024).toFixed(0)} KB)`);
  return { file: relPath.split(sep).join('/'), bytes, sha256, retrievedAt: new Date().toISOString(), versioned: bytes <= MAX_VERSIONED_BYTES, ...meta };
}

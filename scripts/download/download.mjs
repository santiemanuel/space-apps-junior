// Descarga datasets crudos de la NASA a datasets/raw/ y actualiza datasets/raw/manifest.json.
// Uso: npm run datasets:download [-- donki radlab mars-weather osdr references]
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR } from './lib.mjs';

const SOURCES = ['donki', 'radlab', 'mars-weather', 'osdr', 'references'];
const selected = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const unknown = selected.filter((id) => !SOURCES.includes(id));
if (unknown.length) throw new Error(`Fuentes desconocidas: ${unknown.join(', ')}. Disponibles: ${SOURCES.join(', ')}`);

const manifestPath = join(RAW_DIR, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{"files":[]}'));
const byFile = new Map(manifest.files.map((entry) => [entry.file, entry]));
let failed = false;

for (const id of selected.length ? selected : SOURCES) {
  const source = await import(`./sources/${id}.mjs`);
  console.log(`\n▸ ${id}: ${source.description}`);
  try {
    for (const entry of await source.run()) byFile.set(entry.file, { sourceId: id, ...entry });
  } catch (error) {
    failed = true;
    console.error(`  ✗ ${id}: ${error.message}`);
  }
}

const files = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2)}\n`);
const ignored = files.filter((f) => !f.versioned).map((f) => f.file);
await writeFile(
  join(RAW_DIR, '.gitignore'),
  `# Archivos de más de 5 MB: no se versionan. Se regeneran con npm run datasets:download.\n${ignored.join('\n')}\n`,
);
console.log(`\nManifiesto: ${files.length} archivos (${ignored.length} sin versionar por tamaño).`);
process.exitCode = failed ? 1 : 0;

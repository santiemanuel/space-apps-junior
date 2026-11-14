import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Las capas core/, data/ y content/ deben poder probarse sin motor gráfico. */
const ENGINE_FREE_LAYERS = ['core', 'data', 'content'];

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesIn(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [],
  );

describe('arquitectura', () => {
  it.each(ENGINE_FREE_LAYERS)('src/%s no importa Phaser ni la capa game/', (layer) => {
    for (const file of filesIn(join(import.meta.dirname, layer))) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from ['"]phaser['"]/);
      expect(source, file).not.toMatch(/from ['"](\.\.?\/)+game\//);
    }
  });

  it('sólo src/data/ lee datasets/ (el resto recibe modelos de dominio)', () => {
    const offenders = filesIn(import.meta.dirname)
      .filter((file) => !file.includes(join(import.meta.dirname, 'data')))
      .filter((file) => /from ['"](\.\.\/)+datasets\//.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

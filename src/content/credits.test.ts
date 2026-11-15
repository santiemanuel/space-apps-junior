import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasKey, LOCALES } from '../i18n';
import { CREDIT_SECTIONS, NASA_MEDIA_GUIDELINES } from './credits';

const credits = CREDIT_SECTIONS.flatMap((section) => section.credits);
/** Carpetas de `datasets/` que lee el juego (`raw/` son descargas crudas). */
const DATASET_DIRS = ['donki', 'curated', 'series', 'storms', 'notices'];

describe('créditos', () => {
  it('cada archivo citado existe', () => {
    for (const credit of credits) for (const file of credit.files ?? []) expect(existsSync(file), `${credit.id}: ${file}`).toBe(true);
  });

  it('cada dataset que usa el juego tiene su crédito', () => {
    const cited = new Set(credits.flatMap((credit) => credit.files ?? []));
    for (const dir of DATASET_DIRS) {
      for (const file of readdirSync(`datasets/${dir}`).filter((f) => f.endsWith('.json'))) expect(cited.has(`datasets/${dir}/${file}`), file).toBe(true);
    }
  });

  it.each(LOCALES)('tienen sus textos en %s', (locale) => {
    const keys = [
      ...CREDIT_SECTIONS.map((section) => `menu.credits.section.${section.id}`),
      ...credits.flatMap((credit) => [`menu.credits.${credit.id}.use`, `menu.credits.license.${credit.license}`]),
    ];
    for (const key of keys) expect(hasKey(key, locale), key).toBe(true);
  });

  it('los ids no se repiten', () => {
    expect(new Set(credits.map((credit) => credit.id)).size).toBe(credits.length);
  });

  it('CREDITS.md tiene cada enlace del juego', () => {
    const doc = readFileSync('CREDITS.md', 'utf8');
    for (const url of [...credits.flatMap((credit) => credit.url ?? []), NASA_MEDIA_GUIDELINES]) expect(doc, url).toContain(url);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { formatDate, formatNumber } from './format';
import { setLocale } from './index';

describe('formato de fechas', () => {
  afterEach(() => setLocale('es'));

  it('usa día/mes/año en español y mes/día/año en inglés', () => {
    expect(formatDate('2024-01-15T00:00:00Z', 'es')).toBe('15/01/2024');
    expect(formatDate('2024-01-15T00:00:00Z', 'en')).toBe('01/15/2024');
  });

  it('toma el idioma actual si no se indica', () => {
    setLocale('en');
    expect(formatDate('2024-05-20T00:00:00Z')).toBe('05/20/2024');
  });

  it('no corre la fecha por la zona horaria', () => {
    expect(formatDate('2024-10-10T23:30:00Z', 'es')).toBe('10/10/2024');
  });
});

describe('formato de números', () => {
  it('usa los separadores de cada idioma', () => {
    expect(formatNumber(14393, 'en')).toBe('14,393');
    expect(formatNumber(14393, 'es')).toMatch(/^14.393$/);
    expect(formatNumber(1.75, 'es')).toBe('1,8');
  });
});

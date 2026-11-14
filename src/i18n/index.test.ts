import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREW_ROSTER } from '../content/crew';
import { PHASE_ORDER } from '../core/flow/types';
import { DICTIONARIES, hasKey, LOCALES, setLocale, t, type Namespace } from './index';

const namespaces = Object.keys(DICTIONARIES.es) as Namespace[];

describe('i18n', () => {
  afterEach(() => setLocale('es'));

  it.each(namespaces)('el archivo %s tiene las mismas claves en todos los idiomas', (namespace) => {
    const reference = Object.keys(DICTIONARIES.es[namespace]).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(DICTIONARIES[locale][namespace]).sort(), `${locale}/${namespace}.json`).toEqual(reference);
    }
  });

  it('ningún texto está vacío', () => {
    for (const locale of LOCALES) {
      for (const namespace of namespaces) {
        for (const [key, value] of Object.entries(DICTIONARIES[locale][namespace])) {
          expect(value.trim(), `${locale}/${namespace}.json → ${key}`).not.toBe('');
        }
      }
    }
  });

  it('traduce según el idioma elegido', () => {
    expect(t('common.role.commander')).toBe('Comandante');
    setLocale('en');
    expect(t('common.role.commander')).toBe('Commander');
  });

  it('interpola parámetros y deja visibles los que faltan', () => {
    expect(t('common.dataDate', { date: '20/05/2024' })).toBe('Dato real del 20/05/2024');
    expect(t('common.dataDate')).toBe('Dato real del {date}');
  });

  it('devuelve la clave y avisa si no existe', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('common.noExiste')).toBe('common.noExiste');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('tiene nombre de rol, descripción y nombre de fase para todo el contenido', () => {
    for (const { role } of CREW_ROSTER) {
      expect(hasKey(`common.role.${role}`, 'es')).toBe(true);
      expect(hasKey(`common.role.${role}.description`, 'es')).toBe(true);
    }
    for (const phase of PHASE_ORDER) expect(hasKey(`common.phase.${phase}`, 'es')).toBe(true);
  });
});

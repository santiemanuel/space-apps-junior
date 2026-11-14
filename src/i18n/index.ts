import enCommon from './en/common.json';
import enHud from './en/hud.json';
import enIncidents from './en/incidents.json';
import enManeuvers from './en/maneuvers.json';
import enMars from './en/mars.json';
import enMenu from './en/menu.json';
import enReport from './en/report.json';
import enVoyage from './en/voyage.json';
import esCommon from './es/common.json';
import esHud from './es/hud.json';
import esIncidents from './es/incidents.json';
import esManeuvers from './es/maneuvers.json';
import esMars from './es/mars.json';
import esMenu from './es/menu.json';
import esReport from './es/report.json';
import esVoyage from './es/voyage.json';

export type Locale = 'es' | 'en';
export const LOCALES: readonly Locale[] = ['es', 'en'];
const FALLBACK: Locale = 'es';

type Messages = Record<string, string>;

/**
 * Un archivo por dominio para que los dos frentes no se pisen (docs/plan-de-trabajo.md §3.4):
 * common, menu, maneuvers, report → flujo · voyage, mars, hud, incidents → simulación.
 */
export const DICTIONARIES = {
  es: {
    common: esCommon, menu: esMenu, maneuvers: esManeuvers, report: esReport,
    voyage: esVoyage, mars: esMars, hud: esHud, incidents: esIncidents,
  },
  en: {
    common: enCommon, menu: enMenu, maneuvers: enManeuvers, report: enReport,
    voyage: enVoyage, mars: enMars, hud: enHud, incidents: enIncidents,
  },
} satisfies Record<Locale, Record<string, Messages>>;

export type Namespace = keyof (typeof DICTIONARIES)['es'];
/** Clave completa: `<archivo>.<clave dentro del archivo>`, p. ej. `common.role.commander`. */
export type TranslationKey = `${Namespace}.${string}`;
export type TranslationParams = Record<string, string | number>;

let current: Locale = FALLBACK;

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

function lookup(locale: Locale, key: string): string | undefined {
  const dot = key.indexOf('.');
  const namespace = key.slice(0, dot) as Namespace;
  const messages: Messages | undefined = DICTIONARIES[locale][namespace];
  return messages?.[key.slice(dot + 1)];
}

/**
 * Traduce una clave al idioma actual, con `{param}` interpolados. Si falta en el idioma actual usa
 * el español; si falta en todos devuelve la clave, para que se note en pantalla.
 */
export function t(key: TranslationKey, params: TranslationParams = {}): string {
  const template = lookup(current, key) ?? lookup(FALLBACK, key);
  if (template === undefined) {
    console.warn(`[i18n] falta la clave "${key}"`);
    return key;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}

export function hasKey(key: string, locale: Locale = current): boolean {
  return lookup(locale, key) !== undefined;
}

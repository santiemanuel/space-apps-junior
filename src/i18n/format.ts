import { getLocale, type Locale } from './index';

const DATE_LOCALE: Record<Locale, string> = { es: 'es-AR', en: 'en-US' };

/** Fecha de un dato (ISO 8601) en el formato del idioma: 15/01/2024 · 01/15/2024. Siempre en UTC. */
export function formatDate(iso: string, locale: Locale = getLocale()): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(iso));
}

/** Número con separadores del idioma: 14 393 · 14,393. */
export function formatNumber(value: number, locale: Locale = getLocale(), maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(DATE_LOCALE[locale], { maximumFractionDigits }).format(value);
}

/** Hora local (hh:mm) para "partida guardada a las…". */
export function formatTime(date: Date, locale: Locale = getLocale()): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { hour: '2-digit', minute: '2-digit' }).format(date);
}

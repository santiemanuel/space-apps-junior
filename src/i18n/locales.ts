import { LOCALES, type Locale } from './index';

/** Para valores que vienen de afuera (guardado, URL): ¿es un idioma del juego? */
export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

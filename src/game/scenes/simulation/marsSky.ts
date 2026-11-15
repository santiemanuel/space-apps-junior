import type { MarsSky } from '../../../core/mars/MarsSession';

type Rgb = readonly [number, number, number];

/** Luz ambiente del exterior de Gale: noche azul oscura, mediodía color caramelo (como en las fotos de Mastcam). */
const NIGHT: Rgb = [0x36, 0x3c, 0x62];
/** En Marte el cielo se ve azul alrededor del Sol al salir y al ponerse: el polvo fino desvía el azul hacia adelante. */
const TWILIGHT: Rgb = [0xa0, 0x98, 0xbc];
const DAY: Rgb = [0xe4, 0xd0, 0xb8];
/** Luz filtrada por polvo: más tenue y más ocre. */
const DUSTY: Rgb = [0xa8, 0x82, 0x60];
const STORM: Rgb = [0x6c, 0x58, 0x4c];
/** Hasta esta altura del Sol dura el amanecer (o desde acá empieza el atardecer): ~1 hora de juego. */
const TWILIGHT_SUN = 0.25;

/** Luz del cielo: color de la luz ambiente y brillo (0 de noche, 1 al mediodía con cielo limpio). */
export interface SkyLight {
  ambient: number;
  brightness: number;
}

const mix = (a: Rgb, b: Rgb, k: number): Rgb => {
  const t = Math.min(1, Math.max(0, k));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};
const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (c: Rgb) => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);

/** Color de la luz del exterior según el Sol, el polvo del día (UV real de REMS) y la tormenta. */
export function skyLight({ sun, dust, storm }: MarsSky): SkyLight {
  let day = mix(DAY, DUSTY, (1 - dust) * 0.9);
  let twilight = TWILIGHT;
  if (storm) {
    day = mix(day, STORM, 0.8);
    twilight = mix(TWILIGHT, STORM, 0.6);
  }
  const color = sun <= TWILIGHT_SUN ? mix(NIGHT, twilight, sun / TWILIGHT_SUN) : mix(twilight, day, ((sun - TWILIGHT_SUN) / (1 - TWILIGHT_SUN)) ** 0.6);
  return { ambient: hex(color), brightness: luma(color) / luma(DAY) };
}

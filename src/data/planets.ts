import elements from '../../datasets/curated/planet-elements.json';
import type { OrbitalElements } from '../core/environment/orbits';

type Raw = Record<keyof OrbitalElements, number[]>;
const toElements = (raw: Raw): OrbitalElements =>
  Object.fromEntries(Object.entries(raw).map(([k, [v, rate]]) => [k, [v!, rate!] as const])) as unknown as OrbitalElements;

/** Órbitas aproximadas de la Tierra y Marte (NASA JPL, cita en el JSON). */
export const EARTH_ORBIT = toElements(elements.planets.earthMoonBarycenter);
export const MARS_ORBIT = toElements(elements.planets.mars);
export const ORBITS_SOURCE_URL = elements.url;

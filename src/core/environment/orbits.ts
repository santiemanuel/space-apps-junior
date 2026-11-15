/** Elemento y su tasa por siglo juliano desde J2000 (`[valor, tasa]`). */
type Element = readonly [number, number];

/** Elementos keplerianos aproximados de NASA JPL (datasets/curated/planet-elements.json). */
export interface OrbitalElements {
  a: Element;
  e: Element;
  I: Element;
  L: Element;
  longPeri: Element;
  longNode: Element;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const AU_KM = 149_597_870.7;
const LIGHT_KM_S = 299_792.458;
const J2000_MS = Date.parse('2000-01-01T12:00:00Z');
const CENTURY_MS = 36_525 * 86_400_000;
const RAD = Math.PI / 180;

/** Posición heliocéntrica en la eclíptica de J2000 (UA), con las fórmulas de JPL "Approximate Positions of the Planets". */
export function heliocentric(el: OrbitalElements, date: string): Vec3 {
  const T = (Date.parse(date) - J2000_MS) / CENTURY_MS;
  const at = ([v, rate]: Element) => v + rate * T;
  const a = at(el.a);
  const e = at(el.e);
  const I = at(el.I) * RAD;
  const node = at(el.longNode) * RAD;
  const peri = at(el.longPeri) * RAD;
  const omega = peri - node;
  let M = (at(el.L) * RAD - peri) % (2 * Math.PI);
  if (M > Math.PI) M -= 2 * Math.PI;
  if (M < -Math.PI) M += 2 * Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 20; i++) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [co, so, cn, sn, ci, si] = [Math.cos(omega), Math.sin(omega), Math.cos(node), Math.sin(node), Math.cos(I), Math.sin(I)];
  return {
    x: (co * cn - so * sn * ci) * xp + (-so * cn - co * sn * ci) * yp,
    y: (co * sn + so * cn * ci) * xp + (-so * sn + co * cn * ci) * yp,
    z: so * si * xp + co * si * yp,
  };
}

export const distanceAu = (p: Vec3, q: Vec3): number => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

/** Segundos que tarda la luz (y la radio) en recorrer una distancia en UA. */
export const lightSeconds = (au: number): number => (au * AU_KM) / LIGHT_KM_S;

/** Demora de ida de la señal entre la Tierra y Marte en una fecha. */
export const earthMarsDelaySeconds = (earth: OrbitalElements, mars: OrbitalElements, date: string): number =>
  lightSeconds(distanceAu(heliocentric(earth, date), heliocentric(mars, date)));

/**
 * Demora de ida de la señal entre la Tierra y la nave en viaje. Simplificación [regla]: la nave va en línea recta
 * desde donde estaba el planeta de salida el día que partió hasta donde está el de llegada el día que llega.
 */
export function cruiseDelaySeconds(
  earth: OrbitalElements,
  mars: OrbitalElements,
  window: { start: string; end: string },
  leg: 'out' | 'back',
  date: string,
): number {
  const [from, to] = leg === 'out' ? [heliocentric(earth, window.start), heliocentric(mars, window.end)] : [heliocentric(mars, window.start), heliocentric(earth, window.end)];
  const start = Date.parse(window.start);
  const p = Math.min(1, Math.max(0, (Date.parse(date) - start) / (Date.parse(window.end) - start)));
  const ship = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, z: from.z + (to.z - from.z) * p };
  return lightSeconds(distanceAu(ship, heliocentric(earth, date)));
}

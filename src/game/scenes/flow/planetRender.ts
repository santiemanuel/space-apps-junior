/**
 * Planetas que giran en el menú principal: proyecta un mapa equirectangular (pixel art) sobre una esfera, píxel por
 * píxel y en baja resolución, para que la escena lo amplíe sin suavizar. Sin Phaser, para poder probarlo.
 */

export type Vec3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

export interface PlanetOptions {
  /** Radio del disco en píxeles de arte. */
  radius: number;
  /** Ancho del halo de atmósfera por fuera del disco (px de arte). */
  glow: number;
  mapWidth: number;
  mapHeight: number;
  /** Inclinación del eje (grados): Tierra 23,4 · Marte 25,2. */
  tiltDeg: number;
  /** Dirección hacia el Sol: x a la derecha, y hacia abajo, z hacia la cámara. */
  light: Vec3;
  /** Color del borde iluminado y del halo. */
  atmosphere: Rgb;
}

/** Datos fijos por píxel del lienzo: se calculan una vez y cada cuadro sólo cambia la rotación. */
export interface PlanetLookup {
  /** Lado del lienzo cuadrado: 2 · (radio + halo). */
  size: number;
  mapWidth: number;
  /** Por píxel: inicio de la fila del mapa (`v · mapWidth`), o -1 si está fuera del disco. */
  row: Int32Array;
  /** Longitud del píxel en columnas del mapa, sin la rotación. */
  lon: Float32Array;
  /** Nivel de luz: 0 pleno día … 3 noche (bandas duras, como en pixel art). */
  shade: Uint8Array;
  /** Dentro del disco: cuánto se tiñe de atmósfera (0–255). Fuera: alfa del halo. */
  halo: Uint8Array;
  atmosphere: Rgb;
}

/** Brillo de cada nivel de luz. */
export const SHADE_LEVELS = [1, 0.8, 0.58, 0.22] as const;
/** Lado nocturno: lo poco que se ve tira a azul oscuro. */
const NIGHT: Rgb = [10, 18, 40];
const CLOUD: Rgb = [247, 250, 252];

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function buildPlanetLookup(options: PlanetOptions): PlanetLookup {
  const { radius, glow, mapWidth, mapHeight } = options;
  const size = 2 * (radius + glow);
  const center = size / 2;
  const light = normalize(options.light);
  const tilt = (options.tiltDeg * Math.PI) / 180;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const count = size * size;
  const lookup: PlanetLookup = {
    size,
    mapWidth,
    row: new Int32Array(count).fill(-1),
    lon: new Float32Array(count),
    shade: new Uint8Array(count),
    halo: new Uint8Array(count),
    atmosphere: options.atmosphere,
  };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const p = py * size + px;
      const dx = px + 0.5 - center;
      const dy = py + 0.5 - center;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) {
        const band = Math.floor(distance - radius);
        if (band >= glow) continue;
        // El halo es más fuerte del lado del Sol.
        const facing = Math.max(0.3, (dx * light[0] + dy * light[1]) / distance);
        lookup.halo[p] = Math.round([150, 80, 36, 16][Math.min(band, 3)]! * facing);
        continue;
      }
      const nx = dx / radius;
      const ny = dy / radius;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // Eje inclinado: el polo norte se corre hacia la derecha.
      const tx = nx * cos + ny * sin;
      const ty = -nx * sin + ny * cos;
      const lat = Math.asin(Math.max(-1, Math.min(1, -ty)));
      const lon = Math.atan2(tx, nz);
      const v = Math.min(mapHeight - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * mapHeight)));
      lookup.row[p] = v * mapWidth;
      lookup.lon[p] = (lon / (2 * Math.PI) + 0.5) * mapWidth;
      const day = nx * light[0] + ny * light[1] + nz * light[2];
      lookup.shade[p] = day > 0.45 ? 0 : day > 0.18 ? 1 : day > -0.02 ? 2 : 3;
      lookup.halo[p] = nz < 0.16 ? 130 : nz < 0.3 ? 70 : 0;
    }
  }
  return lookup;
}

const wrap = (value: number, length: number) => ((Math.floor(value) % length) + length) % length;

/**
 * Pinta el planeta en `out` (RGBA del lienzo). `rotation` y `cloudRotation` están en columnas del mapa: al
 * aumentar, la superficie se mueve hacia la derecha, como la Tierra vista con el norte arriba.
 */
export function renderPlanet(
  out: Uint8ClampedArray,
  lookup: PlanetLookup,
  surface: Uint8ClampedArray,
  rotation: number,
  clouds: Uint8ClampedArray | null = null,
  cloudRotation = rotation,
): void {
  const { row, lon, shade, halo, mapWidth, atmosphere } = lookup;
  const [ar, ag, ab] = atmosphere;
  for (let p = 0; p < row.length; p++) {
    const o = p * 4;
    const start = row[p]!;
    if (start < 0) {
      out[o] = ar;
      out[o + 1] = ag;
      out[o + 2] = ab;
      out[o + 3] = halo[p]!;
      continue;
    }
    const s = (start + wrap(lon[p]! - rotation, mapWidth)) * 4;
    let r = surface[s]!;
    let g = surface[s + 1]!;
    let b = surface[s + 2]!;
    if (clouds) {
      const c = (start + wrap(lon[p]! - cloudRotation, mapWidth)) * 4;
      const a = clouds[c + 3]! / 255;
      r += (CLOUD[0] - r) * a;
      g += (CLOUD[1] - g) * a;
      b += (CLOUD[2] - b) * a;
    }
    const level = shade[p]!;
    const k = SHADE_LEVELS[level as 0 | 1 | 2 | 3];
    r *= k;
    g *= k;
    b *= k;
    if (level === 3) {
      r += NIGHT[0];
      g += NIGHT[1];
      b += NIGHT[2];
    }
    // Borde de atmósfera: se nota del lado de día y casi nada de noche.
    const rim = (halo[p]! / 255) * (level === 3 ? 0.25 : 1);
    out[o] = r + (ar - r) * rim;
    out[o + 1] = g + (ag - g) * rim;
    out[o + 2] = b + (ab - b) * rim;
    out[o + 3] = 255;
  }
}

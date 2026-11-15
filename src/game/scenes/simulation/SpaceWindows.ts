import Phaser from 'phaser';
import { Rng } from '../../../core/rng/Rng';
import { planetRadius, sunRadius } from './spaceView';
import { MapDepth, type WallItem } from './TiledMapView';

/** Lo que se ve por las ventanas de la nave: depende de la distancia al Sol y de cuánto falta para llegar. */
export interface SpaceView {
  /** Distancia al Sol (UA). */
  sunDistanceAu: number;
  /** Fracción del tramo recorrida, 0..1. */
  progress: number;
  /** Planeta al que se viaja: el que se ve cada vez más grande. */
  destination: 'mars' | 'earth';
  /** Planeta del que se sale: se ve cada vez más chico. */
  origin: 'mars' | 'earth';
  /** Tormenta de radiación: el Sol encandila (0..1, late). */
  flare: number;
}

/** Qué se ve por cada ventana: el Sol, el planeta de destino, el de salida o sólo estrellas. */
export type PaneView = 'sun' | 'destination' | 'origin' | 'stars';

/** Velocidad (px/s) con la que se corren las estrellas: la nave avanza. */
const STAR_DRIFT = 3;
const ART = 2;

/** Disco en píxeles de arte, con color por anillo y por píxel (para sombras, casquetes y continentes). */
function disc(scene: Phaser.Scene, key: string, r: number, color: (x: number, y: number, d: number) => number | null): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  const size = r * 2 + 1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r, y - r);
      const c = d <= r + 0.3 ? color(x - r, y - r, d) : null;
      if (c !== null) g.fillStyle(c).fillRect(x * ART, y * ART, ART, ART);
    }
  g.generateTexture(key, size * ART, size * ART);
  g.destroy();
  return key;
}

const sunTexture = (scene: Phaser.Scene, r: number) =>
  disc(scene, `space-sun-${r}`, r + 2, (_x, _y, d) => (d <= r - 1 ? 0xfff6cf : d <= r ? 0xffd75e : d <= r + 1 ? 0xffa43a : d <= r + 2 ? 0x8a4a2a : null));

function planetTexture(scene: Phaser.Scene, planet: SpaceView['destination'], r: number): string {
  const rng = new Rng(planet === 'mars' ? 4 : 3);
  const spots = new Set(Array.from({ length: r * 3 }, () => `${Math.round(rng.between(-r, r))},${Math.round(rng.between(-r, r))}`));
  return disc(scene, `space-${planet}-${r}`, r, (x, y, d) => {
    const shade = x + y > r * 0.6 && d > r * 0.4;
    if (planet === 'mars') {
      if (r >= 3 && y <= -r + 1 && Math.abs(x) <= r / 2) return 0xf2e8de;
      return shade ? 0x8f3a22 : spots.has(`${x},${y}`) ? 0xa8462a : 0xd0643a;
    }
    if (spots.has(`${x},${y}`)) return shade ? 0x2d6b34 : 0x4caf50;
    if (r >= 3 && (y === -r + 1 || y === r - 1) && Math.abs(x) <= r / 2) return 0xf4f8ff;
    return shade ? 0x1d4b9a : 0x3a7be0;
  });
}

function starsTexture(scene: Phaser.Scene): string {
  const key = 'space-stars';
  if (scene.textures.exists(key)) return key;
  const rng = new Rng(0x57a2);
  const W = 128;
  const H = 64;
  const g = scene.add.graphics();
  g.fillStyle(0x060818).fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rng.between(0, W / ART)) * ART;
    const y = Math.floor(rng.between(0, H / ART)) * ART;
    g.fillStyle(rng.pick([0x5a6488, 0x8f9bc4, 0xdfe6ff, 0xfff1c4])).fillRect(x, y, ART, ART);
  }
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

interface Pane {
  stars: Phaser.GameObjects.TileSprite;
  body?: Phaser.GameObjects.Image;
  /** Resplandor sobre el vidrio cuando el Sol encandila. */
  glare?: Phaser.GameObjects.Rectangle;
  shows: PaneView;
  /** Centro del cuerpo celeste (px del mundo). */
  cx: number;
  cy: number;
  radius: number;
}

/**
 * Espacio detrás del vidrio de cada ventana (la ventana tiene el vidrio transparente y su rectángulo anotado): un
 * fondo de estrellas que se corre despacio y lo que diga `role` para cada ventana: el Sol (más chico cuanto más
 * lejos, y que encandila en una tormenta de radiación), el planeta de destino (más grande cuanto más cerca) o el de
 * salida (cada vez más chico). Sin `role`, la primera ventana muestra el Sol y la segunda el destino.
 */
export class SpaceWindows {
  private readonly panes: Pane[];

  constructor(private readonly scene: Phaser.Scene, windows: readonly WallItem[], role?: (window: WallItem) => PaneView) {
    const stars = starsTexture(scene);
    this.panes = [...windows]
      .filter((w) => w.glass)
      .sort((a, b) => a.x - b.x || a.bottom - b.bottom)
      .map((w, i) => {
        const g = w.glass!;
        const left = w.x - w.image.width / 2 + g.x;
        const top = w.bottom - w.image.height + g.y;
        const tile = scene.add.tileSprite(left, top, g.w, g.h, stars).setOrigin(0, 0).setDepth(MapDepth.behindDecor).setVertexRoundMode('full');
        tile.tilePositionX = i * 37;
        const shows: PaneView = role ? role(w) : i === 0 ? 'sun' : i === 1 ? 'destination' : 'stars';
        const glare = shows === 'sun' ? scene.add.rectangle(left, top, g.w, g.h, 0xff6a2a, 0).setOrigin(0, 0).setDepth(MapDepth.behindDecor + 0.02).setBlendMode(Phaser.BlendModes.ADD) : undefined;
        return { stars: tile, shows, cx: left + g.w * (shows === 'sun' ? 0.38 : 0.62), cy: top + g.h * 0.48, radius: -1, ...(glare ? { glare } : {}) };
      });
  }

  update(view: SpaceView, dt: number): void {
    for (const pane of this.panes) {
      pane.stars.tilePositionX += STAR_DRIFT * dt;
      if (pane.shows === 'stars') continue;
      pane.glare?.setAlpha(view.flare * 0.45);
      const radius =
        pane.shows === 'sun' ? sunRadius(view.sunDistanceAu) + (view.flare > 0 ? 2 : 0) : planetRadius(pane.shows === 'origin' ? 1 - view.progress : view.progress);
      if (radius === pane.radius) continue;
      pane.radius = radius;
      const key = pane.shows === 'sun' ? sunTexture(this.scene, radius) : planetTexture(this.scene, pane.shows === 'origin' ? view.origin : view.destination, radius);
      pane.body ??= this.scene.add.image(0, 0, key).setDepth(MapDepth.behindDecor + 0.01).setVertexRoundMode('full');
      // Centrado en un píxel de arte entero para que no se vea borroso.
      pane.body.setTexture(key).setPosition(Math.round(pane.cx / ART) * ART, Math.round(pane.cy / ART) * ART);
    }
  }
}

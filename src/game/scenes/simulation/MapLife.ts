import Phaser from 'phaser';
import { Rng } from '../../../core/rng/Rng';
import { depthAt, type MapView, type PlacedProp } from './TiledMapView';

/** Rectángulo dentro de un sprite del atlas (px de mundo, desde su esquina de arriba a la izquierda). */
type Box = readonly [x: number, y: number, w: number, h: number];

/**
 * Partes de los sprites que tienen vida, medidas sobre el atlas (`public/assets/ship|mars/props.png`; los objetos de
 * la nave son los mismos en Marte): pantallas, líquido de los tanques y hojas de las plantas.
 */
const SCREENS: Record<string, readonly Box[]> = {
  console: [[20, 16, 22, 14], [48, 16, 22, 14]],
  monitors: [[26, 16, 42, 24], [10, 48, 30, 20], [52, 48, 32, 20]],
  navtable: [[8, 4, 68, 40]],
  helm: [[28, 10, 34, 26]],
};
const LIQUID: Record<string, readonly Box[]> = {
  tank: [[6, 34, 36, 44]],
  recycler: [[4, 42, 18, 26], [76, 42, 16, 26]],
  pump: [[80, 18, 14, 44]],
};
/** De dónde sale vapor cada tanto (px desde la esquina del sprite). */
const STEAM: Record<string, readonly (readonly [number, number])[]> = {
  tank: [[24, 4]],
  recycler: [[50, 6]],
};
/** Alto (px desde arriba) de las hojas de cada planta: eso se mece; la maceta queda quieta. */
const LEAVES: Record<string, number> = { plant: 46 };

const Tex = { bubble: 'fx-bubble', steam: 'fx-steam' } as const;

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(Tex.bubble)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
  g.generateTexture(Tex.bubble, 2, 2).clear();
  g.fillStyle(0xffffff).fillRect(2, 0, 4, 2).fillRect(0, 2, 8, 4).fillRect(2, 6, 4, 2);
  g.generateTexture(Tex.steam, 8, 8);
  g.destroy();
}

interface Screen {
  glow: Phaser.GameObjects.Rectangle;
  off: Phaser.GameObjects.Rectangle;
  /** Próximo parpadeo y hasta cuándo dura (ms de la escena). */
  next: number;
  until: number;
  phase: number;
}

/**
 * Detalles que hacen que el lugar parezca vivo: pantallas que parpadean (y se apagan en un corte de energía), burbujas
 * en los tanques, vapor que sale cada tanto y plantas que se mecen. Sólo pinta.
 */
export class MapLife {
  private readonly screens: Screen[] = [];
  private readonly steam: { emitter: Phaser.GameObjects.Particles.ParticleEmitter; next: number }[] = [];
  private readonly leaves: { image: Phaser.GameObjects.Image; phase: number }[] = [];
  private readonly rng: Rng;

  constructor(scene: Phaser.Scene, view: MapView, seed: number) {
    makeTextures(scene);
    this.rng = new Rng(seed ^ 0x11fe);
    const corner = (p: PlacedProp) => ({ x: p.x - p.image.width / 2, y: p.bottom - p.image.height });
    for (const prop of view.props) {
      const c = corner(prop);
      const depth = depthAt(prop.bottom) + 0.00001;
      for (const [x, y, w, h] of SCREENS[prop.key] ?? []) {
        this.screens.push({
          glow: scene.add.rectangle(c.x + x, c.y + y, w, h, 0xbfe8ff, 0).setOrigin(0, 0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD),
          off: scene.add.rectangle(c.x + x, c.y + y, w, h, 0x141a2c, 0.9).setOrigin(0, 0).setDepth(depth).setVisible(false),
          next: this.rng.between(1000, 6000),
          until: 0,
          phase: this.rng.next() * Math.PI * 2,
        });
      }
      for (const [x, y, w, h] of LIQUID[prop.key] ?? []) {
        // Burbujas que suben desde el fondo y se terminan antes de llegar arriba del líquido.
        const speed = { min: 14, max: 26 };
        scene.add
          .particles(c.x + x + 3, c.y + y + h - 3, Tex.bubble, {
            x: { min: 0, max: Math.max(1, w - 6) },
            speedY: { min: -speed.max, max: -speed.min },
            speedX: { min: -3, max: 3 },
            lifespan: ((h - 6) / speed.max) * 1000,
            alpha: { start: 0.8, end: 0.3 },
            tint: 0xe6f6ff,
            frequency: 2600 / Math.max(1, w / 6),
          })
          .setDepth(depth);
      }
      for (const [x, y] of STEAM[prop.key] ?? []) {
        const emitter = scene.add
          .particles(c.x + x, c.y + y, Tex.steam, {
            speedY: { min: -26, max: -14 },
            speedX: { min: -6, max: 6 },
            lifespan: 1400,
            scale: { start: 0.6, end: 1.8 },
            alpha: { start: 0.4, end: 0 },
            tint: 0xf2f6ff,
            emitting: false,
          })
          .setDepth(depthAt(prop.bottom) + 0.00002);
        this.steam.push({ emitter, next: this.rng.between(2000, 8000) });
      }
      const top = LEAVES[prop.key];
      if (top !== undefined) {
        // Las hojas son una copia recortada del sprite que gira apenas sobre la base de las hojas; el original queda
        // sólo con la maceta.
        const { image } = prop;
        image.setCrop(0, top, image.width, image.height - top);
        const leaves = scene.add
          .image(prop.x, c.y + top, image.texture.key, image.frame.name)
          .setOrigin(0.5, top / image.height)
          .setCrop(0, 0, image.width, top)
          .setDepth(image.depth);
        if (view.lit) leaves.setLighting(true);
        this.leaves.push({ image: leaves, phase: this.rng.next() * Math.PI * 2 });
      }
    }
  }

  update(time: number, powerOut: boolean): void {
    for (const s of this.screens) {
      s.off.setVisible(powerOut);
      s.glow.setVisible(!powerOut);
      if (powerOut) continue;
      // Brillo que respira apenas y, cada tanto, un parpadeo corto (como una pantalla que se refresca).
      if (time >= s.next) {
        s.until = time + this.rng.between(60, 180);
        s.next = time + this.rng.between(2500, 9000);
      }
      s.glow.setFillStyle(0xbfe8ff, time < s.until ? 0.35 : 0.06 + 0.05 * Math.sin(time / 700 + s.phase));
    }
    for (const s of this.steam) {
      if (time < s.next) continue;
      s.emitter.explode(this.rng.between(3, 6));
      s.next = time + this.rng.between(4000, 11000);
    }
    // Un vaivén lento, como si les llegara el aire de la ventilación.
    for (const l of this.leaves) l.image.setRotation(0.035 * Math.sin(time / 900 + l.phase) + 0.015 * Math.sin(time / 370 + l.phase * 2));
  }
}

import Phaser from 'phaser';
import type { MarsSky } from '../../../core/mars/MarsSession';
import { Rng } from '../../../core/rng/Rng';
import type { PxRect, Walker } from './HabitatFx';
import { MapDepth } from './TiledMapView';

const Tex = { mote: 'fx-mote', cloud: 'fx-cloud', step: 'fx-step', kick: 'fx-kick' } as const;
const DUST_TINT = [0xd8a878, 0xc89060, 0xe8c090] as const;

/** Viento (px/s hacia la derecha) y polvo en el aire, con cielo limpio y en la tormenta. */
const WIND = { calm: 40, storm: 300 } as const;
/** Huellas: cada cuánto se deja una (px caminados) y cuánto tardan en borrarse (ms), más rápido con tormenta. */
const STEPS = { every: 22, fadeMs: 24_000, stormFadeMs: 5_000, max: 160 } as const;
/** Cuánto tarda la calima en aparecer o irse al salir o entrar a la base (s). */
const HAZE_BLEND_S = 0.8;

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(Tex.mote)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
  g.generateTexture(Tex.mote, 2, 2).clear();
  // Nube de polvo: manchón de píxeles de arte con el borde ralo.
  const rng = new Rng(0xd057);
  const [w, h] = [64, 32];
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      const d = ((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2;
      if (d < 1 && rng.next() > d * 0.85) g.fillStyle(0xffffff, d < 0.4 ? 0.9 : 0.5).fillRect(x, y, 2, 2);
    }
  g.generateTexture(Tex.cloud, w, h).clear();
  // Huella de bota: un óvalo chico de píxeles de arte.
  g.fillStyle(0xffffff).fillRect(2, 0, 2, 2).fillRect(0, 2, 6, 4).fillRect(2, 6, 2, 2);
  g.generateTexture(Tex.step, 6, 8).clear();
  g.fillStyle(0xffffff).fillRect(2, 0, 2, 6).fillRect(0, 2, 6, 2);
  g.generateTexture(Tex.kick, 6, 6);
  g.destroy();
}

export interface MarsWeatherState {
  sky: MarsSky;
  /** El jugador está afuera: la calima se ve desde afuera, no desde la base. */
  outside: boolean;
  walkers: readonly Walker[];
}

/**
 * El clima del exterior de Gale: polvo en el aire que lleva el viento, nubes de polvo y calima en la tormenta, polvo
 * que levantan las botas y huellas que se borran (más rápido con viento). Sólo pinta; no toca las reglas.
 */
export class MarsWeatherFx {
  private readonly motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly clouds: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly kicks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly haze: Phaser.Filters.ColorMatrix;
  private readonly steps: { image: Phaser.GameObjects.Image; at: number }[] = [];
  private readonly lastStep = new Map<string, { x: number; y: number; left: boolean }>();
  private outsideBlend = 0;
  private wind: number = WIND.calm;
  private readonly rng: Rng;

  constructor(private readonly scene: Phaser.Scene, interior: PxRect, seed: number) {
    makeTextures(scene);
    this.rng = new Rng(seed ^ 0xd0577);
    const cam = scene.cameras.main;
    const base = new Phaser.Geom.Rectangle(interior.x, interior.y, interior.w, interior.h);
    // El polvo nace en lo que se ve de la cámara, nunca adentro de la base, y se muere si entra.
    const source = {
      getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
        const v = cam.worldView;
        for (let i = 0; i < 6; i++) {
          point.x = v.x - 60 + this.rng.next() * (v.width + 60);
          point.y = v.y + this.rng.next() * v.height;
          if (!base.contains(point.x, point.y)) break;
        }
        return point;
      },
    };
    const deathZone = { type: 'onEnter' as const, source: base };
    this.motes = scene.add
      .particles(0, 0, Tex.mote, {
        emitZone: { type: 'random', source },
        deathZone,
        speedX: { min: WIND.calm * 0.5, max: WIND.calm * 1.5 },
        speedY: { min: -6, max: 10 },
        lifespan: 4000,
        alpha: { start: 0.55, end: 0 },
        tint: [...DUST_TINT],
        frequency: 140,
      })
      .setDepth(MapDepth.lights - 1);
    this.clouds = scene.add
      .particles(0, 0, Tex.cloud, {
        emitZone: { type: 'random', source },
        deathZone,
        speedX: { min: WIND.storm * 0.7, max: WIND.storm * 1.2 },
        speedY: { min: -12, max: 12 },
        scale: { min: 2, max: 4 },
        lifespan: 3200,
        alpha: { start: 0.22, end: 0 },
        tint: [...DUST_TINT],
        frequency: 90,
        emitting: false,
      })
      .setDepth(MapDepth.lights - 1);
    this.kicks = scene.add
      .particles(0, 0, Tex.kick, {
        speed: { min: 10, max: 30 },
        angle: { min: 200, max: 340 },
        lifespan: 500,
        scale: { start: 0.8, end: 1.6 },
        alpha: { start: 0.5, end: 0 },
        tint: [...DUST_TINT],
        emitting: false,
      })
      .setDepth(MapDepth.lights - 1);
    // Calima: la cámara pierde color y contraste cuando el aire tiene polvo (sólo si el jugador está afuera).
    this.haze = cam.filters.external.addColorMatrix();
    this.haze.setActive(false);
  }

  update(state: MarsWeatherState, time: number, dt: number): void {
    const { sky } = state;
    this.outsideBlend = Phaser.Math.Clamp(this.outsideBlend + (state.outside ? 1 : -1) * (dt / HAZE_BLEND_S), 0, 1);
    // Calima por el polvo del día (UV real) y mucha más en la tormenta.
    const dustiness = sky.storm ? 1 : Phaser.Math.Clamp((1 - sky.dust) / 0.55, 0, 1) * 0.45;
    const haze = this.outsideBlend * dustiness;
    this.haze.setActive(haze > 0.01);
    if (haze > 0.01) {
      this.haze.colorMatrix.reset();
      this.haze.colorMatrix.saturate(-0.65);
      this.haze.colorMatrix.contrast(-0.3, true);
      this.haze.colorMatrix.alpha = haze;
    }
    const wind = sky.storm ? WIND.storm : WIND.calm + (WIND.storm - WIND.calm) * dustiness * 0.3;
    if (Math.abs(wind - this.wind) > 4) {
      this.wind = wind;
      this.motes.ops.speedX.loadConfig({ speedX: { min: wind * 0.6, max: wind * 1.4 } });
    }
    this.motes.frequency = sky.storm ? 6 : 140 - 90 * dustiness;
    if (sky.storm !== this.clouds.emitting) {
      if (sky.storm) this.clouds.start();
      else this.clouds.stop();
    }
    this.updateSteps(state.walkers, time, sky.storm);
  }

  /** Huellas y polvo de las botas: cada tantos px caminados, una huella de un pie y del otro, que se va borrando. */
  private updateSteps(walkers: readonly Walker[], time: number, storm: boolean): void {
    for (const w of walkers) {
      const last = this.lastStep.get(w.id);
      const d = last ? Math.hypot(w.x - last.x, w.y - last.y) : Infinity;
      // Sin huella anterior o con un salto (cambio de tripulante, vuelta de adentro): se empieza de nuevo ahí.
      if (!last || d > STEPS.every * 4) {
        this.lastStep.set(w.id, { x: w.x, y: w.y, left: false });
        continue;
      }
      if (d < STEPS.every) continue;
      const side = last.left ? -1 : 1;
      const nx = -Math.sin(w.heading) * 5 * side;
      const ny = Math.cos(w.heading) * 5 * side;
      const image = this.steps.length >= STEPS.max ? this.steps.shift()!.image : this.scene.add.image(0, 0, Tex.step).setTint(0x3e2216).setDepth(MapDepth.floorDecal).setVertexRoundMode('full');
      image.setPosition(Math.round((w.x + nx) / 2) * 2, Math.round((w.y - 2 + ny) / 2) * 2).setAlpha(0.6).setVisible(true);
      this.steps.push({ image, at: time });
      this.kicks.explode(this.rng.between(2, 4), w.x, w.y - 2);
      this.lastStep.set(w.id, { x: w.x, y: w.y, left: !last.left });
    }
    const fade = storm ? STEPS.stormFadeMs : STEPS.fadeMs;
    for (const s of this.steps) {
      const k = 1 - (time - s.at) / fade;
      s.image.setAlpha(Math.max(0, 0.6 * k)).setVisible(k > 0);
    }
  }
}

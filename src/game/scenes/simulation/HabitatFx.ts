import Phaser from 'phaser';
import type { Point } from '../../../core/habitat/layout';
import type { AlertLevel } from '../../../core/meters/types';
import { Rng } from '../../../core/rng/Rng';
import type { SystemStatus } from '../../../core/systems/types';
import { MapDepth, type MapView } from './TiledMapView';

/** Lo que muestran los efectos en cada cuadro: el nivel del reloj, el corte de energía, las fugas y los sistemas. */
export interface HabitatFxState {
  level: AlertLevel;
  /** La energía llegó a cero (falla en cascada): luces apagadas y sólo las de emergencia. */
  powerOut: boolean;
  /** Fugas de aire activas (px). */
  leaks: readonly Point[];
  /** Estado de cada estación con sistema, en el orden de `HabitatFxOptions.stations`. */
  stations: readonly SystemStatus[];
}

export interface HabitatFxOptions {
  /** Máquinas con sistema: donde salen chispas y humo cuando se averían (px, arriba del sprite). */
  stations: readonly Point[];
  /** Nave gastada (viaje de vuelta): cinta, cables, manchas y luces que titilan. */
  worn: boolean;
  seed: number;
}

/** Texturas de los efectos, dibujadas por código en píxeles de arte (2 px). */
const Tex = { glow: 'fx-glow', beam: 'fx-beam', spark: 'fx-spark', smoke: 'fx-smoke', puff: 'fx-puff' } as const;

/** Color y pulso (veces por segundo; nunca más de 3 destellos por segundo) de las luces en cada nivel. */
const LIGHT_MODE: Record<AlertLevel, { tint: number; alpha: number; pulse: number; hz: number }> = {
  calm: { tint: 0xffd27a, alpha: 0.26, pulse: 0, hz: 0 },
  alert: { tint: 0xffb02e, alpha: 0.32, pulse: 0.3, hz: 1 },
  impact: { tint: 0xff4a3a, alpha: 0.32, pulse: 0.4, hz: 2 },
};
const EMERGENCY_TINT = 0xff3030;
/** Una de cada tantas luces queda como luz de emergencia en un corte de energía. */
const EMERGENCY_EVERY = 3;
/** Parte de las luces que titila en la nave gastada. */
const FLICKER_SHARE = 0.3;
const STATUS_TINT: Record<SystemStatus, number> = { green: 0x68d391, yellow: 0xf6c343, red: 0xfc5c5c };

/** Glow escalonado (anillos de opacidad), para que la luz también parezca pixel art. */
function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(Tex.glow)) return;
  const g = scene.add.graphics();
  const R = 32;
  for (const [r, a] of [[32, 0.12], [24, 0.22], [16, 0.38], [9, 0.6]] as const) {
    g.fillStyle(0xffffff, a);
    for (let y = -r; y < r; y += 2) for (let x = -r; x < r; x += 2) if ((x + 1) ** 2 + (y + 1) ** 2 <= r * r) g.fillRect(R + x, R + y, 2, 2);
  }
  g.generateTexture(Tex.glow, R * 2, R * 2).clear();
  // Haz de la alarma: una cuña que se abre desde el centro hacia la derecha, en anillos de opacidad.
  for (const [len, a] of [[72, 0.14], [48, 0.24], [26, 0.4]] as const) {
    g.fillStyle(0xffffff, a);
    for (let x = 0; x < len; x += 2) {
      const half = Math.floor((x * 0.42) / 2) * 2 + 2;
      g.fillRect(72 + x, 24 - half, 2, half * 2);
    }
  }
  g.generateTexture(Tex.beam, 144, 48).clear();
  g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
  g.generateTexture(Tex.spark, 2, 2).clear();
  g.fillStyle(0xffffff).fillRect(2, 0, 4, 8).fillRect(0, 2, 8, 4);
  g.generateTexture(Tex.smoke, 8, 8).clear();
  g.fillStyle(0xffffff).fillRect(2, 0, 2, 6).fillRect(0, 2, 6, 2);
  g.generateTexture(Tex.puff, 6, 6);
  g.destroy();
}

interface Light {
  glow: Phaser.GameObjects.Image;
  emergency: boolean;
  /** Titila (nave gastada): próximo apagón y cuánto dura (ms de la escena). */
  flicker?: { next: number; until: number };
}

interface Station {
  at: Point;
  glow: Phaser.GameObjects.Image;
  sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  nextSpark: number;
  status: SystemStatus | null;
}

/**
 * Efectos del hábitat (nave o base) que dependen del estado: luces que cambian de color con la alerta, alarmas que
 * giran, oscuridad con luces de emergencia en un corte de energía, chispas y humo en las máquinas averiadas, aire
 * que escapa por una fuga y el desgaste del viaje de vuelta. Sólo pinta; el estado lo pasa la escena.
 */
export class HabitatFx {
  private readonly lights: Light[] = [];
  private readonly alarms: { glow: Phaser.GameObjects.Image; beams: Phaser.GameObjects.Image[] }[] = [];
  private readonly stations: Station[];
  private readonly leaks = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly darkness: Phaser.GameObjects.Rectangle;
  private readonly rng: Rng;

  constructor(private readonly scene: Phaser.Scene, view: MapView, options: HabitatFxOptions) {
    makeTextures(scene);
    this.rng = new Rng(options.seed);
    const add = (p: Point, scale: number) =>
      scene.add.image(p.x, p.y, Tex.glow).setBlendMode(Phaser.BlendModes.ADD).setDepth(MapDepth.lights).setScale(scale).setVertexRoundMode('full');
    view.lights.forEach((p, i) => {
      const light: Light = { glow: add(p, 1), emergency: i % EMERGENCY_EVERY === 0 };
      if (options.worn && this.rng.chance(FLICKER_SHARE)) light.flicker = { next: this.rng.between(500, 4000), until: 0 };
      this.lights.push(light);
    });
    for (const item of view.decor) {
      if (item.key !== 'alarm') continue;
      const at = { x: item.x, y: item.bottom - 30 };
      // Dos haces opuestos que giran, como una baliza (sin redondeo de vértices: rotan).
      const beams = [0, Math.PI].map((angle) =>
        scene.add.image(at.x, at.y, Tex.beam).setBlendMode(Phaser.BlendModes.ADD).setDepth(MapDepth.lights).setRotation(angle).setVisible(false),
      );
      this.alarms.push({ glow: add(at, 0.8).setVisible(false), beams });
    }
    this.darkness = scene.add.rectangle(0, 0, view.width, view.height, 0x060a1a, 0.62).setOrigin(0, 0).setDepth(MapDepth.darkness).setVisible(false);
    this.stations = options.stations.map((at) => ({
      at,
      glow: add(at, 0.7).setVisible(false),
      sparks: scene.add
        .particles(at.x, at.y, Tex.spark, {
          speed: { min: 60, max: 150 },
          angle: { min: 200, max: 340 },
          gravityY: 420,
          lifespan: { min: 250, max: 520 },
          tint: [0xfff3a0, 0xffc34d, 0xffffff],
          blendMode: Phaser.BlendModes.ADD,
          emitting: false,
        })
        .setDepth(MapDepth.lights),
      smoke: scene.add
        .particles(at.x, at.y, Tex.smoke, {
          speedY: { min: -40, max: -22 },
          speedX: { min: -10, max: 10 },
          lifespan: 1600,
          scale: { start: 1, end: 2.5 },
          alpha: { start: 0.55, end: 0 },
          tint: 0x5b5468,
          frequency: 180,
          emitting: false,
        })
        .setDepth(MapDepth.lights - 0.5),
      nextSpark: 0,
      status: null,
    }));
    if (options.worn) this.addWear(view);
  }

  update(state: HabitatFxState, time: number): void {
    const mode = LIGHT_MODE[state.level];
    const wave = mode.hz ? 0.5 + 0.5 * Math.sin((time / 1000) * Math.PI * 2 * mode.hz) : 0;
    for (const light of this.lights) {
      let alpha = mode.alpha + mode.pulse * wave;
      let tint = mode.tint;
      if (state.powerOut) {
        alpha = light.emergency ? 0.35 + 0.15 * wave : 0;
        tint = EMERGENCY_TINT;
      }
      if (light.flicker) {
        if (time >= light.flicker.next) {
          light.flicker.until = time + this.rng.between(50, 160);
          light.flicker.next = time + this.rng.between(800, 5000);
        }
        if (time < light.flicker.until) alpha *= 0.15;
      }
      light.glow.setAlpha(alpha).setTint(tint);
    }
    const alarming = state.level !== 'calm' || state.powerOut;
    const urgent = state.level === 'impact' || state.powerOut;
    const tint = urgent ? 0xff3a2a : 0xffa020;
    // Una vuelta por segundo en la alerta y dos en el impacto (como el pulso de las luces).
    const spin = (time / 1000) * Math.PI * 2 * (urgent ? 0.8 : 0.5);
    for (const alarm of this.alarms) {
      alarm.glow.setVisible(alarming);
      for (const beam of alarm.beams) beam.setVisible(alarming);
      if (!alarming) continue;
      alarm.glow.setTint(tint).setAlpha(0.6 + 0.4 * wave).setScale(0.8 + 0.2 * wave);
      alarm.beams.forEach((beam, i) => beam.setTint(tint).setAlpha(0.7).setRotation(spin + i * Math.PI));
    }
    this.darkness.setVisible(state.powerOut);
    this.updateStations(state.stations, time, wave);
    this.updateLeaks(state.leaks);
  }

  private updateStations(statuses: readonly SystemStatus[], time: number, wave: number): void {
    this.stations.forEach((station, i) => {
      const status = statuses[i] ?? 'green';
      if (status !== station.status) {
        station.status = status;
        station.glow.setVisible(status !== 'green').setTint(STATUS_TINT[status]);
        if (status === 'red') station.smoke.start();
        else station.smoke.stop();
      }
      if (status === 'green') return;
      station.glow.setAlpha(0.35 + 0.4 * wave);
      if (time >= station.nextSpark) {
        station.sparks.explode(status === 'red' ? 7 : 4);
        station.nextSpark = time + (status === 'red' ? this.rng.between(350, 900) : this.rng.between(1200, 2600));
      }
    });
  }

  private updateLeaks(points: readonly Point[]): void {
    const keys = new Set(points.map((p) => `${p.x},${p.y}`));
    for (const [key, emitter] of this.leaks) {
      if (keys.has(key)) continue;
      emitter.stop();
      this.scene.time.delayedCall(1200, () => emitter.destroy());
      this.leaks.delete(key);
    }
    for (const p of points) {
      const key = `${p.x},${p.y}`;
      if (this.leaks.has(key)) continue;
      this.leaks.set(
        key,
        this.scene.add
          .particles(p.x, p.y, Tex.puff, {
            speed: { min: 40, max: 110 },
            angle: { min: 0, max: 360 },
            lifespan: 700,
            scale: { start: 1, end: 2 },
            alpha: { start: 0.8, end: 0 },
            tint: 0xe6f4ff,
            frequency: 45,
          })
          .setDepth(MapDepth.lights - 0.5),
      );
    }
  }

  /** Viaje de vuelta: cinta sobre las paredes, cables sueltos, manchas de hollín y de grasa en el piso. */
  private addWear(view: MapView): void {
    const key = view.propsKey;
    const T = 48;
    const faces = [...view.faceTiles];
    const floors = view.floorTiles.filter((t) => !view.props.some((p) => Math.abs(p.x - (t.x + 0.5) * T) < T && Math.abs(p.bottom - (t.y + 0.5) * T) < T));
    for (let i = 0; i < 14 && faces.length; i++) {
      const tile = faces.splice(Math.floor(this.rng.next() * faces.length), 1)[0]!;
      const frame = this.rng.pick(['tape', 'tape', 'cables', 'scorch']);
      this.scene.add.image(tile.x * T + T / 2, tile.y * T + T / 2 + 4, key, frame).setDepth(MapDepth.decor - 0.1).setVertexRoundMode('full');
    }
    for (let i = 0; i < 12 && floors.length; i++) {
      const tile = floors.splice(Math.floor(this.rng.next() * floors.length), 1)[0]!;
      this.scene.add.image(tile.x * T + T / 2, tile.y * T + T / 2, key, this.rng.pick(['grime', 'scorch'])).setDepth(MapDepth.floorDecal).setVertexRoundMode('full');
    }
  }
}

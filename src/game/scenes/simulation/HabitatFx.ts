import Phaser from 'phaser';
import type { Point } from '../../../core/habitat/layout';
import type { AlertLevel } from '../../../core/meters/types';
import { Rng } from '../../../core/rng/Rng';
import type { SystemStatus } from '../../../core/systems/types';
import type { SkyLight } from './marsSky';
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
  /** Lugar con exterior (Marte): la luz del cielo y quienes están afuera, que con poca luz prenden la linterna del casco. */
  outdoor?: { sky: SkyLight; walkers: readonly Walker[] };
}

/** Tripulante en el exterior (px): hacia dónde mira (radianes) y si es el del jugador. */
export interface Walker {
  id: string;
  x: number;
  y: number;
  heading: number;
  active: boolean;
}

/** Rectángulo en px. */
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HabitatFxOptions {
  /** Máquinas con sistema: donde salen chispas y humo cuando se averían (px, arriba del sprite). */
  stations: readonly Point[];
  /** Nave gastada (viaje de vuelta): cinta, cables, manchas y luces que titilan. */
  worn: boolean;
  seed: number;
  /** Cuartos y tramos de pasillo (px): cada uno con su luz de techo, si el mapa recibe luz dinámica. */
  areas: readonly PxRect[];
  /** Lugar con exterior: los rectángulos de la base (sin superponerse), lo único que se oscurece en un corte de energía. */
  interior?: readonly PxRect[];
  /** Balizas del exterior (px, donde va su luz): se encienden cuando oscurece. */
  beacons?: readonly Point[];
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

/**
 * Luz dinámica (si el mapa tiene normal maps): luz ambiente según el estado y luces que le dan relieve a lo que
 * tocan. Phaser ilumina hasta 10 luces por cámara: las más cercanas al centro.
 */
const AMBIENT: Record<AlertLevel | 'powerOut', number> = { calm: 0xc8c8d0, alert: 0xbcb4a8, impact: 0xb0a0a0, powerOut: 0x363050 };
/** Luz de techo de cada cuarto: blanca y pareja; en las alertas toma su color. */
const ROOM_LIGHT = { color: 0xfff0d8, intensity: 0.22, z: 220, reach: 0.85 } as const;
const LAMP_LIGHT = { color: 0xffc46a, intensity: 0.55, radius: 120, z: 50 } as const;
/** Baliza de alarma: una luz que late con el pulso de la alerta (los haces que giran son brillos). */
const ALARM_LIGHT = { radius: 200, intensity: 1.4, z: 60 } as const;
/** Destello de las chispas de una máquina averiada. */
const SPARK_LIGHT = { color: 0xffd27a, radius: 110, intensity: 2.6, z: 30, decayMs: 140 } as const;
/**
 * Objetos que dan luz de color, como en las referencias: el violeta de los cultivos, el cian de la holomesa y las
 * pantallas, y las luces rojas que sólo se prenden en una alerta o un corte. `at`: altura del brillo desde arriba del
 * sprite (fracción); `light`: luz dinámica (radio, intensidad), sólo para las que tiñen el cuarto; `alarm`: sólo en
 * alertas. Sin energía se apagan todas menos las de alarma.
 */
interface GlowSpec {
  color: number;
  at: number;
  scale: number;
  alpha: number;
  light?: { radius: number; intensity: number };
  alarm?: boolean;
}
const GROW = 0xd06bff;
const SCREEN = 0x63c8ff;
const GLOWS: Record<string, GlowSpec> = {
  growcabinet: { color: GROW, at: 0.3, scale: 1.6, alpha: 0.42, light: { radius: 170, intensity: 1.3 } },
  greenhouse: { color: GROW, at: 0.18, scale: 1.3, alpha: 0.36, light: { radius: 130, intensity: 1 } },
  holotable: { color: 0x4fd8ff, at: 0.3, scale: 1.1, alpha: 0.45, light: { radius: 120, intensity: 0.9 } },
  hydrotank: { color: 0x7cf08a, at: 0.45, scale: 0.8, alpha: 0.22 },
  redlight: { color: 0xff3a2a, at: 0.5, scale: 1.1, alpha: 0.7, light: { radius: 150, intensity: 1.3 }, alarm: true },
  warnscreen: { color: 0xff4a3a, at: 0.45, scale: 1.1, alpha: 0.5, alarm: true },
  commsdesk: { color: SCREEN, at: 0.25, scale: 1.1, alpha: 0.2 },
  radar: { color: 0x5ef0a0, at: 0.3, scale: 0.9, alpha: 0.2 },
  wallscreen: { color: SCREEN, at: 0.5, scale: 1, alpha: 0.2 },
  lowconsole: { color: SCREEN, at: 0.35, scale: 1.1, alpha: 0.16 },
  plantmonitor: { color: 0x7cf08a, at: 0.3, scale: 0.7, alpha: 0.2 },
};

/** Con el cielo oscuro las luces de techo suben, para que la base se vea iluminada desde adentro. */
const NIGHT_ROOM_BOOST = 0.9;
/** Brillo de la base sin energía, relativo al mediodía (el de `AMBIENT.powerOut`). */
const POWER_OUT_BRIGHTNESS = 0.24;
/** Las luces de afuera (balizas, cascos) se prenden por debajo de este brillo del cielo y quedan a pleno en `dark`. */
const OUTDOOR_LIGHTS = { on: 0.65, full: 0.25 } as const;
const BEACON_LIGHT = { color: 0xff7a3a, radius: 170, intensity: 1.2, z: 40, hz: 0.5, spinHz: 0.4 } as const;
/** Linterna del casco: un cono hacia donde mira el tripulante; el del jugador lleva además una luz chica alrededor. */
const HELMET_LIGHT = { color: 0xfff2d6, radius: 300, intensity: 1.3, z: 40, inner: 0.6, outer: 1.2, glowRadius: 80, glowIntensity: 0.5 } as const;
/**
 * De dónde sale el cono (px desde los pies): del frente del casco, corrido hacia donde mira. Así el cuerpo queda
 * detrás de la luz y no se ilumina a sí mismo: de espaldas el haz nace arriba de la cabeza (el cuerpo lo tapa) y de
 * frente, delante de los pies.
 */
const HELMET_LAMP = { up: 34, aheadX: 24, aheadY: 40 } as const;
const lampOf = (w: Walker): Point => ({ x: w.x + Math.cos(w.heading) * HELMET_LAMP.aheadX, y: w.y - HELMET_LAMP.up + Math.sin(w.heading) * HELMET_LAMP.aheadY });
/**
 * Sombras arrojadas (además del relieve de los normal maps): la silueta de cada objeto de afuera, en negro, acostada
 * en el piso del lado opuesto a la luz. Cuanto más alto el objeto, más larga (es su silueta estirada), y se alarga
 * al alejarse de la luz como con una linterna baja. `height`: altura de la luz (px); `stretch`: largo mínimo y
 * máximo, en alturas del objeto.
 */
const SHADOW = { color: 0x0a0406, alpha: 0.55, helmetHeight: 60, beaconHeight: 80, stretch: [0.45, 2.2], minAlpha: 0.03 } as const;
/** Objetos que no arrojan sombra: los bloques invisibles y las propias balizas. */
const NO_SHADOW = new Set(['block', 'beacon']);

/** Algo que arroja sombra: el punto donde se apoya (px) y su cuadro del atlas. */
interface Caster {
  x: number;
  y: number;
  frame: string;
}

/** Luz que arroja sombras: dónde está, hasta dónde llega, su altura, su fuerza (0..1) y, si es un cono, hacia dónde. */
interface ShadowSource {
  x: number;
  y: number;
  radius: number;
  height: number;
  strength: number;
  cone?: { rotation: number; inner: number; outer: number };
}

interface Light {
  glow: Phaser.GameObjects.Image;
  /** Luz dinámica de las lámparas (las franjas de pared sólo brillan). */
  light?: Phaser.GameObjects.Light;
  emergency: boolean;
  /** Titila (nave gastada): próximo apagón y cuánto dura (ms de la escena). */
  flicker?: { next: number; until: number };
}

interface Station {
  at: Point;
  glow: Phaser.GameObjects.Image;
  flash?: Phaser.GameObjects.Light;
  flashAt: number;
  sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  nextSpark: number;
  status: SystemStatus | null;
}

/**
 * Efectos del hábitat (nave o base) que dependen del estado: luces que cambian de color con la alerta, alarmas que
 * giran, oscuridad con luces de emergencia en un corte de energía, chispas y humo en las máquinas averiadas, aire
 * que escapa por una fuga y el desgaste del viaje de vuelta; en un lugar con exterior, la luz del cielo (día, noche y
 * tormenta), las balizas y las linternas de los cascos. Sólo pinta; el estado lo pasa la escena.
 */
export class HabitatFx {
  private readonly lights: Light[] = [];
  private readonly alarms: { glow: Phaser.GameObjects.Image; beams: Phaser.GameObjects.Image[]; light?: Phaser.GameObjects.Light }[] = [];
  private readonly roomLights: Phaser.GameObjects.Light[] = [];
  private readonly glows: { glow: Phaser.GameObjects.Image; light?: Phaser.GameObjects.Light; spec: GlowSpec; phase: number }[] = [];
  private readonly stations: Station[];
  private readonly leaks = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly darkness: Phaser.GameObjects.Graphics;
  private readonly beacons: { glow: Phaser.GameObjects.Image; beam: Phaser.GameObjects.Image; light?: Phaser.GameObjects.Light }[] = [];
  /** Linternas de casco, una por tripulante afuera (se crean al hacer falta). */
  private readonly helmets: Phaser.GameObjects.Light[] = [];
  private helmetGlow: Phaser.GameObjects.Light | null = null;
  /** Objetos de afuera que arrojan sombra y las siluetas en uso (se crean al hacer falta). */
  private readonly casters: Caster[] = [];
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly propsKey: string;
  private readonly rng: Rng;

  private readonly lit: boolean;

  constructor(private readonly scene: Phaser.Scene, view: MapView, options: HabitatFxOptions) {
    makeTextures(scene);
    this.rng = new Rng(options.seed);
    this.lit = view.lit;
    this.propsKey = view.propsKey;
    const inside = options.interior;
    if (this.lit && inside) {
      // Sólo lo que está afuera: adentro la luz viene del techo. El apoyo queda un poco arriba del borde del sprite.
      for (const item of [...view.props, ...view.decor.filter((d) => d.key.startsWith('rock'))]) {
        const { x, y, height } = item.image;
        if (NO_SHADOW.has(item.key) || inside.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
        this.casters.push({ x, y: y - Math.min(12, Math.round(height * 0.15)), frame: item.key });
      }
    }
    const lights = scene.lights;
    if (this.lit) {
      lights.enable().setAmbientColor(AMBIENT.calm);
      for (const a of options.areas) {
        const radius = Math.max(a.w, a.h) * ROOM_LIGHT.reach;
        this.roomLights.push(lights.addLight(a.x + a.w / 2, a.y + a.h / 2, radius, ROOM_LIGHT.color, ROOM_LIGHT.intensity, ROOM_LIGHT.z));
      }
    }
    const add = (p: Point, scale: number) =>
      scene.add.image(p.x, p.y, Tex.glow).setBlendMode(Phaser.BlendModes.ADD).setDepth(MapDepth.lights).setScale(scale).setVertexRoundMode('full');
    view.lights.forEach((p, i) => {
      const light: Light = { glow: add(p, p.kind === 'lamp' ? 0.9 : 1), emergency: p.kind === 'lamp' || i % EMERGENCY_EVERY === 0 };
      if (this.lit && p.kind === 'lamp') light.light = lights.addLight(p.x, p.y, LAMP_LIGHT.radius, LAMP_LIGHT.color, LAMP_LIGHT.intensity, LAMP_LIGHT.z);
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
      const light = this.lit ? lights.addLight(at.x, at.y + 30, ALARM_LIGHT.radius, 0xff3a2a, ALARM_LIGHT.intensity, ALARM_LIGHT.z).setVisible(false) : undefined;
      this.alarms.push({ glow: add(at, 0.8).setVisible(false), beams, ...(light ? { light } : {}) });
    }
    for (const item of [...view.props, ...view.decor]) {
      const spec = GLOWS[item.key];
      if (!spec) continue;
      const at = { x: item.x, y: item.bottom - item.image.height * (1 - spec.at) };
      const light = this.lit && spec.light ? lights.addLight(at.x, at.y + 24, spec.light.radius, spec.color, spec.light.intensity, 60) : undefined;
      this.glows.push({ glow: add(at, spec.scale).setTint(spec.color).setAlpha(spec.alpha), ...(light ? { light } : {}), spec, phase: this.rng.between(0, Math.PI * 2) });
    }
    this.darkness = scene.add.graphics().setDepth(MapDepth.darkness).setAlpha(0.62).setVisible(false);
    for (const r of options.interior ?? [{ x: 0, y: 0, w: view.width, h: view.height }]) this.darkness.fillStyle(0x060a1a, 1).fillRect(r.x, r.y, r.w, r.h);
    for (const at of options.beacons ?? []) {
      const light = this.lit ? lights.addLight(at.x, at.y + 24, BEACON_LIGHT.radius, BEACON_LIGHT.color, 0, BEACON_LIGHT.z).setVisible(false) : undefined;
      // Un haz que gira, como un faro (más corto que el de las alarmas).
      const beam = scene.add.image(at.x, at.y, Tex.beam).setBlendMode(Phaser.BlendModes.ADD).setDepth(MapDepth.lights).setScale(0.6).setTint(BEACON_LIGHT.color).setVisible(false);
      this.beacons.push({ glow: add(at, 0.5).setTint(BEACON_LIGHT.color).setVisible(false), beam, ...(light ? { light } : {}) });
    }
    this.stations = options.stations.map((at) => ({
      at,
      glow: add(at, 0.7).setVisible(false),
      ...(this.lit ? { flash: lights.addLight(at.x, at.y, SPARK_LIGHT.radius, SPARK_LIGHT.color, 0, SPARK_LIGHT.z).setVisible(false) } : {}),
      flashAt: -Infinity,
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
      light.light?.setColor(state.powerOut || state.level !== 'calm' ? tint : LAMP_LIGHT.color).setIntensity((alpha / Math.max(0.01, mode.alpha)) * LAMP_LIGHT.intensity * (state.powerOut ? 0.6 : 1));
    }
    if (this.lit) this.updateRoomLights(state, mode, wave);
    const alarming = state.level !== 'calm' || state.powerOut;
    for (const { glow, light, spec, phase } of this.glows) {
      // Las de alarma laten con la alerta; las demás respiran apenas. Sin energía, las pantallas y las luces de cultivo se apagan.
      const on = spec.alarm ? alarming : !state.powerOut;
      const k = spec.alarm ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((time / 1000) * Math.PI * 2 * Math.max(1, mode.hz))) : 0.88 + 0.12 * Math.sin(time / 900 + phase);
      glow.setVisible(on).setAlpha(spec.alpha * k);
      light?.setVisible(on).setIntensity((spec.light?.intensity ?? 0) * k);
    }
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
    for (const alarm of this.alarms) alarm.light?.setVisible(alarming).setColor(tint).setIntensity(ALARM_LIGHT.intensity * (0.35 + 0.65 * wave));
    const sky = this.lit ? state.outdoor?.sky : undefined;
    // Con luz dinámica el corte de energía lo hace la luz ambiente; si no, un velo oscuro. Con exterior, la luz
    // ambiente es la del cielo y el velo oscurece sólo la base, hasta el brillo de un corte (de noche no hace falta).
    if (sky) this.darkness.setVisible(state.powerOut).setAlpha(Phaser.Math.Clamp(1 - POWER_OUT_BRIGHTNESS / sky.brightness, 0, 0.75));
    else this.darkness.setVisible(state.powerOut && !this.lit);
    if (state.outdoor) this.updateOutdoor(state.outdoor, time);
    this.updateStations(state.stations, time, wave);
    this.updateLeaks(state.leaks);
  }

  private updateRoomLights(state: HabitatFxState, mode: (typeof LIGHT_MODE)[AlertLevel], wave: number): void {
    const sky = state.outdoor?.sky;
    this.scene.lights.setAmbientColor(sky ? sky.ambient : state.powerOut ? AMBIENT.powerOut : AMBIENT[state.level]);
    const intensity = ROOM_LIGHT.intensity + (sky ? NIGHT_ROOM_BOOST * Math.max(0, 1 - sky.brightness) : 0);
    for (const light of this.roomLights) {
      light.setVisible(!state.powerOut);
      if (state.level === 'calm') light.setColor(ROOM_LIGHT.color).setIntensity(intensity);
      else light.setColor(mode.tint).setIntensity(intensity * (0.7 + 0.6 * wave));
    }
  }

  /** Luces del exterior que se prenden al oscurecer: las balizas (laten despacio y su haz gira) y las linternas de los cascos. */
  private updateOutdoor({ sky, walkers }: NonNullable<HabitatFxState['outdoor']>, time: number): void {
    const dark = Phaser.Math.Clamp((OUTDOOR_LIGHTS.on - sky.brightness) / (OUTDOOR_LIGHTS.on - OUTDOOR_LIGHTS.full), 0, 1);
    const beat = 0.5 + 0.5 * Math.sin((time / 1000) * Math.PI * 2 * BEACON_LIGHT.hz);
    const sources: ShadowSource[] = [];
    for (const beacon of this.beacons) {
      beacon.glow.setVisible(dark > 0).setAlpha(dark * (0.45 + 0.45 * beat));
      beacon.beam.setVisible(dark > 0).setAlpha(dark * 0.55).setRotation((time / 1000) * Math.PI * 2 * BEACON_LIGHT.spinHz);
      beacon.light?.setVisible(dark > 0).setIntensity(BEACON_LIGHT.intensity * dark * (0.5 + 0.5 * beat));
      if (beacon.light) sources.push({ x: beacon.light.x, y: beacon.light.y, radius: BEACON_LIGHT.radius, height: SHADOW.beaconHeight, strength: dark * (0.5 + 0.5 * beat) });
    }
    if (!this.lit) return;
    const lights = this.scene.lights;
    const on = dark > 0 ? walkers : [];
    while (this.helmets.length < on.length) {
      const h = HELMET_LIGHT;
      this.helmets.push(lights.addLight(0, 0, h.radius, h.color, 0, h.z).setCone(0, h.inner, h.outer));
    }
    this.helmets.forEach((light, i) => {
      const walker = on[i];
      light.setVisible(walker !== undefined);
      if (!walker) return;
      const lamp = lampOf(walker);
      light.setPosition(lamp.x, lamp.y).setConeRotation(walker.heading).setIntensity(HELMET_LIGHT.intensity * dark);
      sources.push({ ...lamp, radius: HELMET_LIGHT.radius, height: SHADOW.helmetHeight, strength: dark, cone: { rotation: walker.heading, inner: HELMET_LIGHT.inner, outer: HELMET_LIGHT.outer } });
    });
    const active = on.find((w) => w.active);
    this.helmetGlow ??= lights.addLight(0, 0, HELMET_LIGHT.glowRadius, HELMET_LIGHT.color, 0, HELMET_LIGHT.z);
    this.helmetGlow.setVisible(active !== undefined);
    if (active) this.helmetGlow.setPosition(active.x, active.y - 30).setIntensity(HELMET_LIGHT.glowIntensity * dark);
    this.castShadows(sources);
  }

  /** Acuesta la silueta de cada objeto alcanzado por una luz, del lado opuesto, más oscura cuanto más luz recibe. */
  private castShadows(sources: readonly ShadowSource[]): void {
    let used = 0;
    for (const s of sources) {
      if (s.strength <= SHADOW.minAlpha) continue;
      for (const c of this.casters) {
        const dx = c.x - s.x;
        const dy = c.y - s.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= s.radius || distance < 4) continue;
        const angle = Math.atan2(dy, dx);
        let light = s.strength * (1 - distance / s.radius);
        if (s.cone) light *= 1 - Phaser.Math.SmoothStep(Math.abs(Phaser.Math.Angle.Wrap(angle - s.cone.rotation)), s.cone.inner / 2, s.cone.outer / 2);
        const alpha = Math.min(SHADOW.alpha, light * 2 * SHADOW.alpha);
        if (alpha <= SHADOW.minAlpha) continue;
        const shadow = (this.shadows[used] ??= this.scene.add
          .image(0, 0, this.propsKey)
          .setOrigin(0.5, 1)
          .setDepth(MapDepth.floorDecal)
          .setTint(SHADOW.color)
          .setTintMode(Phaser.TintModes.FILL));
        used++;
        shadow
          .setFrame(c.frame)
          .setPosition(c.x, c.y)
          .setRotation(angle + Math.PI / 2)
          .setScale(1, Phaser.Math.Clamp(distance / s.height, SHADOW.stretch[0], SHADOW.stretch[1]))
          .setAlpha(alpha)
          .setVisible(true);
      }
    }
    for (let i = used; i < this.shadows.length; i++) this.shadows[i]!.setVisible(false);
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
      if (station.flash) {
        const k = Math.max(0, 1 - (time - station.flashAt) / SPARK_LIGHT.decayMs);
        station.flash.setVisible(k > 0).setIntensity(SPARK_LIGHT.intensity * k);
      }
      if (time >= station.nextSpark) {
        station.flashAt = time;
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

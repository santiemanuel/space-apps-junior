import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import type { ManeuverId } from '../../../core/flow/types';
import { Rng } from '../../../core/rng/Rng';
import { t } from '../../../i18n';
import type { CrewId } from '../../../core/crew/types';
import { CREW_SHEET, crewTextureKey, FlightTextures } from '../../assets';
import { reducedMotion } from '../../ui/ui';

/** La ilustración ocupa toda la pantalla, detrás de la interfaz (los minijuegos van en paneles encima). */
export const ART_VIEW = { x: 0, y: 0, width: 1280, height: 720 } as const;
/** Dónde vive en el mundo: lejos de la interfaz, con su propia cámara. */
const WORLD_Y = 4000;
/** Píxeles de pantalla por píxel de arte de las piezas de vuelo. */
const ART = 4;
/** Suelo del aterrizaje y la reentrada (los despegues usan el de su sitio). */
const PLAIN_GROUND = 610;
const PLAIN_VEHICLE_X = 640;
const CREW_SCALE = 0.75;
/** La cápsula del aterrizaje y la reentrada cuelga de su centro: su base queda esto más abajo (px). */
const CAPSULE_BASE = 34;
/** Rescate en el mar: el barco llega por la izquierda (la derecha es del panel) y el helicóptero queda sobre la cápsula. */
const RESCUE = { shipX: 300, deckRow: 41, heliX: 820, heliY: 230 } as const;

/** Cómo se ve cada maniobra: cielo en franjas (de arriba hacia abajo) y, sin sitio, los fondos dibujados con código. */
interface Look {
  sky: number[];
  mountains: [number, number];
  ground: number;
  ocean?: boolean;
  startsOnGround: boolean;
  mars: boolean;
  sun?: { x: number; y: number; r: number; color: number };
  /**
   * Aterrizaje y reentrada: escenografía generada del lugar donde se baja (suelo de Gale con el monte Sharp al fondo,
   * o el mar abierto) y a qué altura de la pantalla toca la cápsula.
   */
  plain?: { near: string; far?: string; ground: number };
}

const LOOKS: Record<ManeuverId, Look> = {
  ascent: {
    sky: [0x2c3e85, 0x3d4f9c, 0x5a5fae, 0x7f68b4, 0xa8719f, 0xd27f86, 0xeb9a78, 0xf6b979, 0xfbd48a],
    mountains: [0x5a7fa8, 0x3f6b4a],
    ground: 0x4a7c3a,
    startsOnGround: true,
    mars: false,
    sun: { x: 440, y: 480, r: 44, color: 0xfde68a },
  },
  marsAscent: {
    sky: [0x8a5a4a, 0x9e6650, 0xb47458, 0xc68562, 0xd59a72, 0xe2ae84, 0xebc296, 0xf0cfa4],
    mountains: [0xb0764f, 0x8f4a2c],
    ground: 0xa0522d,
    startsOnGround: true,
    mars: true,
    sun: { x: 300, y: 150, r: 14, color: 0xfff4d6 },
  },
  landing: {
    // El cielo de Marte, de ocre arriba a rosado polvoriento en el horizonte.
    sky: [0x8a5a4a, 0xa56a52, 0xbd7c5c, 0xcf9068, 0xdca57a, 0xe6b98e, 0xedc9a0],
    mountains: [0xb0764f, 0x8f4a2c],
    ground: 0xa0522d,
    startsOnGround: false,
    mars: true,
    sun: { x: 250, y: 190, r: 14, color: 0xfff4d6 },
    plain: { near: FlightTextures.galePlain, far: FlightTextures.marsFar, ground: 548 },
  },
  reentry: {
    sky: [0x1f5fa8, 0x2f74bd, 0x4489cf, 0x5e9fdc, 0x7cb6e6, 0x9fd3f5, 0xc4e6fb],
    mountains: [0x5a7fa8, 0x4f7f9f],
    ground: 0x2b6cb0,
    ocean: true,
    startsOnGround: false,
    mars: false,
    sun: { x: 1040, y: 150, r: 26, color: 0xfff4d6 },
    plain: { near: FlightTextures.seaFar, ground: 566 },
  },
};

/**
 * Plataforma de un despegue (medidas en px de pantalla, sacadas de las imágenes de `public/assets/ui/flight/`):
 * suelo, centro de la nave, escotilla, por dónde sube la tripulación y de dónde sale al empezar.
 */
interface Site {
  far: string;
  near: string;
  ground: number;
  vehicleX: number;
  hatchY: number;
  /** Ascensor (Tierra) o escalera (Marte). */
  liftX: number;
  /** Hasta dónde caminan al cruzar a la escotilla. */
  crossTo: number;
  /** Donde aparecen en la escena de entrada (puerta de la combi o de la base). */
  spawnX: number;
  /** Encuadre inicial de la escena de entrada (centro y zoom). */
  intro: { x: number; y: number; zoom: number; seconds: number };
  /** Manguera de combustible: desde dónde y a qué altura. */
  hose: { from: number; to: number; y: number };
}

const SITES: Partial<Record<ManeuverId, Site>> = {
  ascent: {
    far: FlightTextures.earthFar,
    near: FlightTextures.earthNear,
    ground: 604,
    vehicleX: 640,
    hatchY: 256,
    liftX: 438,
    crossTo: 596,
    spawnX: 190,
    intro: { x: 240, y: 520, zoom: 2, seconds: 8 },
    hose: { from: 800, to: 700, y: 560 },
  },
  marsAscent: {
    far: FlightTextures.marsFar,
    near: FlightTextures.marsNear,
    ground: 596,
    vehicleX: 700,
    hatchY: 388,
    liftX: 530,
    crossTo: 640,
    spawnX: 276,
    intro: { x: 330, y: 500, zoom: 2, seconds: 7 },
    hose: { from: 900, to: 842, y: 560 },
  },
};

/** Torre de la Tierra: dónde está, qué parte es el brazo de acceso (px de arte) y la baliza de arriba. */
const TOWER = { left: 248, bodyWidth: 57, arm: { x: 56, y: 28, width: 29, height: 26 }, beacon: { x: 40, y: 1 } } as const;
/** Cohete de la Tierra: filas de la cápsula (arriba) y separación de los propulsores (px de arte). */
const CORE = { capsuleRows: 31, boosterOffset: 22 } as const;
/** Torre de servicio de Marte, a la izquierda de la nave. */
const MAST = { left: 484 } as const;
/** Antena del edificio de control (Tierra), de donde salen las ondas de la prueba de radio. */
const RADIO_SOURCE = { x: 1222, y: 496 } as const;

/** Altura (0..1) hasta la que el motor deja humo: más arriba ya no hay aire que lo sostenga a la vista. */
const SMOKE_UNTIL = 0.55;

/** Lo que la escena le cuenta a la ilustración en cada cuadro. */
export interface ArtFrame {
  /** Abordaje: fracción de la secuencia hecha (la tripulación sube por el ascensor). */
  boarding?: number;
  /** Cuenta regresiva: número a la vista, o null. */
  countdown?: number | null;
  /** Pilotaje: posición de la aguja (−1 … 1): la nave se inclina. */
  steer?: number;
  /** Prueba de radio: hay una luz encendida (o el jugador respondió). */
  radio?: boolean;
  /** Presurizar: la presión está en la franja verde. */
  pressureOk?: boolean;
}

const smooth = (x: number) => {
  const c = Phaser.Math.Clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

/**
 * Ilustración animada de la maniobra a pantalla completa. En los despegues, escenografía pixel art generada (fondo
 * lejano, plataforma, torre, tanques, base) con una escena de entrada (la tripulación llega a la plataforma), los
 * preparativos de la cuenta regresiva (brazo, balizas, agua, chispas) y un despegue con humo, temblor y público.
 * El aterrizaje y la reentrada usan la misma técnica: el llano de Gale con el monte Sharp (o el mar abierto), la
 * cápsula con su escudo, el plasma de la entrada, los paracaídas, el escudo que se suelta, los motores que levantan
 * polvo y, en la Tierra, la salpicadura, el barco y el helicóptero de rescate y la tripulación que sale. Sólo dibuja.
 */
export class FlightArt {
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly look: Look;
  private readonly site: Site | undefined;
  private readonly ground: number;
  private readonly rng = new Rng(7);
  private readonly space: Phaser.GameObjects.Rectangle;
  private readonly stars: Phaser.GameObjects.Graphics;
  private readonly far: Phaser.GameObjects.Container;
  private readonly clouds: Phaser.GameObjects.Container;
  private readonly backGround: Phaser.GameObjects.Container;
  private readonly frontGround: Phaser.GameObjects.Container;
  /**
   * Humo, vapor, agua y polvo: viven en el aire del lugar (se mueven con el suelo, no con la pantalla). Así, cuando
   * la nave sube, lo que quedó atrás baja con el paisaje y sale de cuadro en vez de quedar flotando.
   */
  private readonly smoke: Phaser.GameObjects.Container;
  private readonly vehicle: Phaser.GameObjects.Container;
  private readonly flame: Phaser.GameObjects.Sprite;
  private readonly plasma: Phaser.GameObjects.Arc;
  private readonly speedLines: Phaser.GameObjects.Graphics;
  private readonly waves: Phaser.GameObjects.Graphics;
  private readonly countdownText: Phaser.GameObjects.Text;
  private readonly banner: Phaser.GameObjects.Text;
  private readonly walkers: Phaser.GameObjects.Sprite[] = [];
  private readonly crowd: Phaser.GameObjects.Rectangle[] = [];
  private elevator: Phaser.GameObjects.Rectangle | null = null;
  private arm: Phaser.GameObjects.Image | null = null;
  private beacon: Phaser.GameObjects.Rectangle | null = null;
  private mast: Phaser.GameObjects.Container | null = null;
  private van: Phaser.GameObjects.Image | null = null;
  private statusLight: Phaser.GameObjects.Rectangle | null = null;
  private body: Phaser.GameObjects.Image | null = null;
  private boosters: Phaser.GameObjects.Image[] = [];
  private boosterFlames: Phaser.GameObjects.Sprite[] = [];
  private capsule: Phaser.GameObjects.Image | null = null;
  private parachute: Phaser.GameObjects.Image | null = null;
  private hose: Phaser.GameObjects.Rectangle | null = null;
  /** Plasma de la entrada (onda de choque bajo el escudo y chispas) y tinte de calor de toda la pantalla. */
  private readonly plasmaFx: Phaser.GameObjects.Graphics;
  private readonly heat: Phaser.GameObjects.Rectangle;
  /** Aviso de la radio cortada por el plasma (reentrada). */
  private readonly blackout: Phaser.GameObjects.Text;
  /** Brillos del mar que se mueven. */
  private seaFx: Phaser.GameObjects.Graphics | null = null;
  /** Llamas de los motores de descenso (aterrizaje en Marte). */
  private descentFlames: Phaser.GameObjects.Sprite[] = [];
  /** Rescate en el mar: barco, helicóptero y quienes salen de la cápsula. */
  private ship: Phaser.GameObjects.Image | null = null;
  private helicopter: Phaser.GameObjects.Image | null = null;
  private rescued: { sprite: Phaser.GameObjects.Sprite; bed: Phaser.GameObjects.Graphics | null; from: number; to: number; start: number }[] = [];
  private arrival: Partial<Record<CrewId, 'walk' | 'stretcher'>> = {};
  /** Segundos desde que la cápsula tocó el agua (null antes). */
  private floatingSince: number | null = null;
  private sinceShake = 0;
  /** 0 en el suelo … 1 en el espacio. */
  private altitude: number;
  private climbing = false;
  private separated = false;
  private descending: { to: number; speed: number } | null = null;
  private stage = '';
  /** Preparativos de la cuenta regresiva que ya pasaron. */
  private readonly milestones = new Set<string>();
  /** Lo que pasa al tocar el suelo o el mar (se dispara una vez). */
  private onGround: (() => void) | null = null;
  private sincePuff = 0;
  private sinceSpark = 0;
  private time = 0;
  /** Escena de entrada: segundos transcurridos (null si no hay o ya terminó). */
  private introTime: number | null = null;
  private onIntroDone: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly id: ManeuverId,
  ) {
    this.look = LOOKS[id];
    this.site = SITES[id];
    this.ground = this.site?.ground ?? this.look.plain?.ground ?? PLAIN_GROUND;
    this.altitude = this.look.startsOnGround ? 0 : 1;
    this.camera = scene.cameras.add(ART_VIEW.x, ART_VIEW.y, ART_VIEW.width, ART_VIEW.height).setScroll(0, WORLD_Y);
    // La ilustración se dibuja primero: la interfaz queda encima.
    const cameras = scene.cameras.cameras;
    cameras.splice(cameras.indexOf(this.camera), 1);
    cameras.unshift(this.camera);
    const sky = this.add(scene.add.graphics());
    const band = ART_VIEW.height / this.look.sky.length;
    this.look.sky.forEach((color, i) => sky.fillStyle(color).fillRect(0, Math.floor(i * band), ART_VIEW.width, Math.ceil(band) + 1));
    if (this.look.sun) {
      const { x, y, r, color } = this.look.sun;
      for (let dy = -r; dy <= r; dy += ART) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy) / ART) * ART;
        sky.fillStyle(color).fillRect(x - half, y + dy, half * 2, ART);
      }
    }
    this.space = this.add(scene.add.rectangle(0, 0, ART_VIEW.width, ART_VIEW.height, 0x05070d).setOrigin(0, 0));
    this.stars = this.add(scene.add.graphics());
    for (let i = 0; i < 160; i++) {
      this.stars.fillStyle(0xffffff, this.rng.between(0.3, 1)).fillRect(Math.floor(this.rng.between(0, ART_VIEW.width / ART)) * ART, Math.floor(this.rng.between(0, ART_VIEW.height / ART)) * ART, ART / 2, ART / 2);
    }
    this.far = this.add(scene.add.container(0, 0));
    this.clouds = this.add(scene.add.container(0, 0));
    this.speedLines = this.add(scene.add.graphics());
    this.backGround = this.add(scene.add.container(0, 0));
    this.vehicle = this.add(scene.add.container(this.site?.vehicleX ?? PLAIN_VEHICLE_X, this.look.startsOnGround ? this.ground : 200));
    this.frontGround = this.add(scene.add.container(0, 0));
    this.smoke = this.add(scene.add.container(0, 0));
    this.waves = this.add(scene.add.graphics());
    this.plasma = scene.add.circle(0, 0, 60, 0xf6ad55, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.plasmaFx = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.flame = scene.add.sprite(0, 0, FlightTextures.flame).setScale(ART).setOrigin(0.5, 0).setVisible(false);
    this.vehicle.add([this.plasma, this.plasmaFx, this.flame]);
    this.heat = this.add(scene.add.rectangle(0, 0, ART_VIEW.width, ART_VIEW.height, 0xf6ad55, 0).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD));
    this.blackout = this.add(
      scene.add.text(ART_VIEW.width / 2, 196, '', { fontFamily: 'monospace', fontSize: '22px', color: '#fed7d7', stroke: '#1a202c', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setVisible(false),
    );
    this.countdownText = this.add(
      scene.add.text(ART_VIEW.width / 2, 150, '', { fontFamily: 'monospace', fontSize: '96px', color: '#fbd38d', stroke: '#1a202c', strokeThickness: 8 }).setOrigin(0.5),
    );
    this.banner = this.add(
      scene.add.text(ART_VIEW.width / 2, 120, '', { fontFamily: 'monospace', fontSize: '34px', color: '#ffffff', stroke: '#1a202c', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setAlpha(0),
    );
    if (!scene.anims.exists('flight-flame')) scene.anims.create({ key: 'flight-flame', frames: scene.anims.generateFrameNumbers(FlightTextures.flame), frameRate: 14, repeat: -1 });
    if (!scene.anims.exists('flight-smoke')) scene.anims.create({ key: 'flight-smoke', frames: scene.anims.generateFrameNumbers(FlightTextures.smoke), frameRate: 6 });
    this.flame.play('flight-flame');
    this.buildClouds();
    if (this.site) this.buildSite(this.site);
    else {
      this.buildBackdrop();
      this.buildPlainGround();
    }
    this.buildVehicle();
    this.applyAltitude();
  }

  /** Objeto de la ilustración: en el mundo de la ilustración y oculto para la cámara de la interfaz. */
  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    (object as unknown as { y: number }).y += WORLD_Y;
    this.scene.cameras.main.ignore(object);
    return object;
  }

  /** La cámara de la ilustración no dibuja la interfaz. */
  ignoreUi(objects: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): void {
    this.camera.ignore(objects);
  }

  /** Nubes en bloques de píxel (no en Marte). */
  private buildClouds(): void {
    if (this.look.mars) return;
    const s = this.scene;
    const tint = this.id === 'ascent' ? 0xfde2d0 : 0xffffff;
    for (let i = 0; i < 6; i++) {
      const g = s.add.graphics();
      const w = Math.floor(this.rng.between(10, 22)) * ART;
      g.fillStyle(tint, 0.9).fillRect(0, 0, w, ART * 3).fillRect(ART * 3, -ART * 2, w - ART * 8, ART * 2).fillRect(ART * 6, -ART * 4, Math.max(ART * 4, w / 3), ART * 2);
      g.fillStyle(0xffffff, 0.35).fillRect(ART * 2, ART * 3, w - ART * 4, ART);
      g.setPosition(Math.floor(this.rng.between(0, ART_VIEW.width / ART)) * ART, Math.floor(this.rng.between(15, 60)) * ART);
      this.clouds.add(g);
    }
  }

  // --- Plataformas de despegue ---

  private buildSite(site: Site): void {
    const s = this.scene;
    this.far.add(s.add.image(0, 0, site.far).setOrigin(0, 0).setScale(ART));
    const back: Phaser.GameObjects.GameObject[] = [];
    const front: Phaser.GameObjects.GameObject[] = [s.add.image(0, 0, site.near).setOrigin(0, 0).setScale(ART)];
    if (this.id === 'ascent') {
      const texture = s.textures.get(FlightTextures.launchTower);
      const { arm, bodyWidth } = TOWER;
      if (!texture.has('body')) {
        texture.add('body', 0, 0, 0, bodyWidth, texture.source[0]!.height);
        texture.add('arm', 0, arm.x, arm.y, arm.width, arm.height);
      }
      const top = site.ground - texture.source[0]!.height * ART;
      back.push(s.add.image(TOWER.left, site.ground, FlightTextures.launchTower, 'body').setOrigin(0, 1).setScale(ART));
      this.arm = s.add.image(TOWER.left + arm.x * ART, top + arm.y * ART, FlightTextures.launchTower, 'arm').setOrigin(0, 0).setScale(ART);
      this.beacon = s.add.rectangle(TOWER.left + TOWER.beacon.x * ART, top + TOWER.beacon.y * ART, ART * 3, ART * 2, 0xff3b3b).setOrigin(0, 0).setVisible(false);
      back.push(this.arm, this.beacon, s.add.image(800, site.ground + 6, FlightTextures.fuelTanks).setOrigin(0, 1).setScale(ART));
      this.elevator = s.add.rectangle(site.liftX, site.ground, 52, 80, 0xfbd38d, 0.55).setOrigin(0.5, 1).setStrokeStyle(4, 0x1a202c);
      back.push(this.elevator);
      this.van = s.add.image(-200, site.ground + 2, FlightTextures.van).setOrigin(0, 1).setScale(ART);
      front.push(this.van);
      // Público en primer plano, abajo a la izquierda: festeja desde las balizas.
      const colors = [0xfc8181, 0xf6e05e, 0x68d391, 0x63b3ed, 0xb794f4, 0xf6ad55];
      const skins = [0xf5d0a9, 0xc68642, 0x8d5524, 0xe0ac69];
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 13; i++) {
          const x = 16 + i * 28 + row * 14;
          const y = 668 + row * 20;
          front.push(s.add.rectangle(x, y, 20, 40, colors[(i + row * 3) % colors.length]!).setOrigin(0.5, 0).setStrokeStyle(2, 0x1a202c));
          const head = s.add.rectangle(x, y - 6, 16, 16, skins[(i + row) % skins.length]!).setStrokeStyle(2, 0x1a202c);
          front.push(head);
          this.crowd.push(head);
        }
      }
    } else {
      const mastTexture = s.textures.get(FlightTextures.serviceMast).source[0]!;
      const mast = s.add.container(MAST.left + (mastTexture.width * ART) / 2, site.ground);
      mast.add([
        s.add.image(0, 0, FlightTextures.serviceMast).setOrigin(0.5, 1).setScale(ART),
        s.add.rectangle(site.liftX + 26 - mast.x, site.hatchY - site.ground, site.crossTo - site.liftX - 20, 8, 0xa0aec0).setOrigin(0, 0.5).setStrokeStyle(2, 0x1a202c),
      ]);
      this.mast = mast;
      this.elevator = s.add.rectangle(site.liftX, site.ground, 40, 60, 0x000000, 0).setOrigin(0.5, 1);
      back.push(mast, this.elevator);
    }
    this.backGround.add(back);
    this.frontGround.add(front);
  }

  // --- Aterrizaje y reentrada: fondos con código ---

  /** Montañas lejanas o el monte Sharp. */
  private buildBackdrop(): void {
    const s = this.scene;
    const plain = this.look.plain;
    if (plain && s.textures.exists(plain.near)) {
      // El monte Sharp (Aeolis Mons) y las mesetas de Gale al fondo; en el mar, sólo el cielo y las nubes.
      if (plain.far && s.textures.exists(plain.far)) this.far.add(s.add.image(0, -40, plain.far).setOrigin(0, 0).setScale(ART));
      return;
    }
    const [farColor, nearColor] = this.look.mountains;
    const range = (color: number, base: number, peaks: number, height: number, seed: number) => {
      const r = new Rng(seed);
      const points: number[] = [0, base];
      for (let i = 0; i <= peaks; i++) points.push((i / peaks) * ART_VIEW.width, base - r.between(height * 0.4, height));
      points.push(ART_VIEW.width, base);
      return s.add.polygon(0, 0, points, color).setOrigin(0, 0);
    };
    if (this.look.mars) {
      this.far.add([range(farColor, PLAIN_GROUND - 20, 9, 140, 3), s.add.triangle(900, PLAIN_GROUND - 40, 0, 0, 260, -230, 520, 0, 0x9c5a37).setOrigin(0.5, 1), range(nearColor, PLAIN_GROUND, 6, 70, 5)]);
      for (const [x, r] of [[160, 34], [230, 24]] as const) this.far.add(s.add.arc(x, PLAIN_GROUND - 2, r, 180, 360, false, 0xe2e8f0).setStrokeStyle(3, 0x4a5568));
    } else {
      this.far.add([range(farColor, PLAIN_GROUND - 30, 8, 190, 3), range(nearColor, PLAIN_GROUND, 11, 90, 4)]);
    }
  }

  private buildPlainGround(): void {
    const s = this.scene;
    const plain = this.look.plain;
    if (plain && s.textures.exists(plain.near)) {
      // Detrás de la nave: la cápsula se posa sobre el suelo (o flota en el mar), no queda tapada por él.
      this.backGround.add(s.add.image(0, 0, plain.near).setOrigin(0, 0).setScale(ART));
      if (this.look.ocean) {
        this.seaFx = s.add.graphics();
        this.frontGround.add(this.seaFx);
      }
      return;
    }
    const parts: Phaser.GameObjects.GameObject[] = [s.add.rectangle(0, PLAIN_GROUND, ART_VIEW.width, ART_VIEW.height, this.look.ground).setOrigin(0, 0)];
    if (this.look.ocean) {
      const waves = s.add.graphics();
      for (let x = 0; x < ART_VIEW.width; x += 28) waves.fillStyle(0x90cdf4, 0.6).fillRect(x + (x % 56 ? 0 : 10), PLAIN_GROUND + 14 + (x % 84 ? 0 : 18), 14, 3);
      parts.push(waves);
    } else {
      parts.push(s.add.rectangle(PLAIN_VEHICLE_X, PLAIN_GROUND, 230, 14, 0x718096).setOrigin(0.5, 0));
      for (const x of [90, 380, 1010, 1180]) parts.push(s.add.ellipse(x, PLAIN_GROUND + 18, 40, 20, 0x7b3f20));
    }
    this.frontGround.add(parts);
  }

  private buildVehicle(): void {
    const s = this.scene;
    if (this.id === 'ascent') {
      const texture = s.textures.get(FlightTextures.core);
      const height = texture.source[0]!.height;
      if (!texture.has('capsule')) {
        texture.add('capsule', 0, 0, 0, texture.source[0]!.width, CORE.capsuleRows);
        texture.add('stage', 0, 0, CORE.capsuleRows, texture.source[0]!.width, height - CORE.capsuleRows);
      }
      this.body = s.add.image(0, 0, FlightTextures.core, 'stage').setScale(ART).setOrigin(0.5, 1);
      this.capsule = s.add.image(0, -(height - CORE.capsuleRows) * ART, FlightTextures.core, 'capsule').setScale(ART).setOrigin(0.5, 1);
      this.boosters = [-1, 1].map((side) => s.add.image(side * CORE.boosterOffset * ART, 0, FlightTextures.sideBooster).setScale(ART).setOrigin(0.5, 1));
      this.boosterFlames = this.boosters.map((b) => s.add.sprite(b.x, -4, FlightTextures.flame).setScale(ART * 1.1).setOrigin(0.5, 0).setVisible(false).play('flight-flame'));
      this.vehicle.add(this.boosterFlames);
      this.statusLight = s.add.rectangle(10, (this.site!.hatchY - this.site!.ground), ART * 2, ART * 2, 0x48bb78).setVisible(false);
      this.vehicle.add([...this.boosters, this.body, this.capsule, this.statusLight]);
      this.flame.setY(-4).setScale(ART * 1.6);
    } else if (this.id === 'marsAscent') {
      this.body = s.add.image(0, 0, FlightTextures.ascentVehicle).setScale(ART).setOrigin(0.5, 1);
      this.statusLight = s.add.rectangle(0, this.site!.hatchY - this.site!.ground - 20, ART * 2, ART * 2, 0x48bb78).setVisible(false);
      this.vehicle.add([this.body, this.statusLight]);
      this.flame.setY(-14).setScale(ART * 1.4);
    } else if (this.id === 'landing' && s.textures.exists(FlightTextures.entryCapsule)) {
      // Cápsula de entrada con el escudo térmico abajo; al soltarlo queda el módulo de descenso con sus patas.
      this.capsule = s.add.image(0, CAPSULE_BASE, FlightTextures.entryCapsule).setScale(ART).setOrigin(0.5, 1);
      this.parachute = s.add.image(0, CAPSULE_BASE - this.capsule.height * ART + 16, FlightTextures.chute).setScale(ART).setOrigin(0.5, 1).setVisible(false);
      this.descentFlames = [-28, 28].map((x) => s.add.sprite(x, CAPSULE_BASE - 16, FlightTextures.flame).setScale(ART * 0.7).setOrigin(0.5, 0).setVisible(false).play('flight-flame'));
      this.vehicle.add([this.parachute, ...this.descentFlames, this.capsule]);
      this.flame.setVisible(false);
    } else if (this.id === 'reentry' && s.textures.exists(FlightTextures.seaCapsule)) {
      // La cápsula vuelve sin los flotadores: se inflan recién al tocar el agua (ahí cambia a `seaCapsule`).
      this.capsule = s.add.image(0, CAPSULE_BASE, FlightTextures.returnCapsule).setScale(ART).setOrigin(0.5, 1);
      this.parachute = s.add.image(0, CAPSULE_BASE - this.capsule.height * ART + 20, FlightTextures.chutes).setScale(ART).setOrigin(0.5, 1).setVisible(false);
      this.vehicle.add([this.parachute, this.capsule]);
      this.flame.setVisible(false);
    } else {
      this.capsule = s.add.image(0, 0, FlightTextures.capsule).setScale(ART).setOrigin(0.5, 0.5);
      this.parachute = s.add.image(0, -32, FlightTextures.parachute).setScale(ART).setOrigin(0.5, 1).setVisible(false);
      this.vehicle.add([this.parachute, this.capsule]);
      this.flame.setY(32).setScale(ART * 0.6);
    }
    this.vehicle.sendToBack(this.flame);
    this.boosterFlames.forEach((f) => this.vehicle.sendToBack(f));
    if (!this.site) return;
    CREW_ROSTER.forEach(({ id }, i) => {
      if (!s.textures.exists(crewTextureKey(id))) return;
      this.walkers.push(this.add(s.add.sprite(this.crewStart(i), this.ground, crewTextureKey(id), 0).setOrigin(CREW_SHEET.origin.x, CREW_SHEET.origin.y).setScale(CREW_SCALE)));
    });
  }

  /** Fila de espera al pie del ascensor (o la escalera). */
  private crewStart(i: number): number {
    return this.site!.liftX - 70 - i * 40;
  }

  // --- Escena de entrada ---

  /** Empieza la escena de entrada de los despegues (llegada a la plataforma). Devuelve false si esta maniobra no tiene. */
  playIntro(onDone: () => void): boolean {
    if (!this.site) return false;
    this.introTime = 0;
    this.onIntroDone = onDone;
    this.applyIntro();
    return true;
  }

  /** Salta al final de la escena de entrada. */
  skipIntro(): void {
    if (this.introTime === null || !this.site) return;
    this.introTime = this.site.intro.seconds;
    this.applyIntro();
  }

  get inIntro(): boolean {
    return this.introTime !== null;
  }

  private applyIntro(): void {
    const site = this.site!;
    const time = this.introTime!;
    const { intro } = site;
    const earth = this.id === 'ascent';
    // La combi llega (Tierra); después bajan de a uno y caminan hasta la torre.
    if (this.van) this.van.setX(Phaser.Math.Linear(-200, site.spawnX - 150, smooth(time / 2.4)));
    const exitAt = earth ? 2.6 : 0.6;
    this.walkers.forEach((walker, i) => {
      const start = exitAt + i * 0.35;
      const walk = Phaser.Math.Clamp((time - start) / 2.6, 0, 1);
      walker.setPosition(Phaser.Math.Linear(site.spawnX, this.crewStart(i), walk), WORLD_Y + site.ground).setVisible(time >= start);
      walker.setFrame(walk > 0 && walk < 1 ? 3 + (Math.floor(this.time * 10) % 6) : 0);
    });
    // Cámara: primer plano de la llegada y después se abre a toda la plataforma.
    const open = smooth((time - (earth ? 3.4 : 2.4)) / 3.6);
    const zoom = Phaser.Math.Linear(intro.zoom, 1, open);
    const halfW = ART_VIEW.width / zoom / 2;
    const halfH = ART_VIEW.height / zoom / 2;
    const x = Phaser.Math.Clamp(Phaser.Math.Linear(intro.x, ART_VIEW.width / 2, open), halfW, ART_VIEW.width - halfW);
    const y = Phaser.Math.Clamp(Phaser.Math.Linear(intro.y, ART_VIEW.height / 2, open), halfH, ART_VIEW.height - halfH);
    this.camera.setZoom(zoom).centerOn(x, WORLD_Y + y);
    if (time >= intro.seconds) {
      this.camera.setZoom(1).setScroll(0, WORLD_Y);
      this.introTime = null;
      const done = this.onIntroDone;
      this.onIntroDone = null;
      done?.();
    }
  }

  // --- Etapas ---

  /** Empieza una etapa: prepara lo que se ve (manguera, plasma, motores de descenso, nave nodriza…). */
  setStage(stageId: string): void {
    this.stage = stageId;
    if (stageId === 'fuel' && this.site) {
      const { from, to, y } = this.site.hose;
      this.hose = this.scene.add.rectangle(to, y, from - to, 10, 0x4a5568).setOrigin(0, 0.5).setStrokeStyle(2, 0x1a202c);
      this.backGround.add(this.hose);
      this.body?.setTint(0xdcecff);
    }
    if (stageId === 'pressure') this.statusLight?.setVisible(true).setFillStyle(0xf6e05e);
    if (stageId === 'countdown') {
      this.hose?.setVisible(false);
      this.body?.clearTint();
      this.statusLight?.setFillStyle(0x48bb78);
    }
    if (stageId === 'orbitInsertion') this.showMothership();
    if (stageId === 'entry' || stageId === 'orientShield') {
      this.plasma.setVisible(true).setRadius(stageId === 'entry' ? 64 : 44);
      // La cápsula ya viene bajando: el cielo se aclara de a poco mientras frena.
      this.descending = { to: stageId === 'entry' ? 0.62 : 0.8, speed: 0.045 };
    }
    if (stageId === 'reentry') {
      this.plasma.setVisible(true).setRadius(76);
      // Apagón de radio: el plasma que rodea la cápsula no deja pasar las ondas.
      this.blackout.setText(t('maneuvers.blackout')).setVisible(true);
    }
    if (stageId === 'descentEngines') {
      this.dropParachute();
      if (this.descentFlames.length) this.descentFlames.forEach((flame) => flame.setVisible(true));
      else this.flame.setVisible(true);
      this.descending = { to: 0, speed: 0.07 };
    }
    if (stageId === 'splashdown') this.openParachute();
  }

  /** Preparativo de la cuenta regresiva (brazo, balizas, agua, motores…): se ve y se anuncia. */
  milestone(id: string): void {
    if (this.milestones.has(id)) return;
    this.milestones.add(id);
    const s = this.scene;
    if (id === 'armRetract' && this.arm) s.tweens.add({ targets: this.arm, angle: -78, duration: 1600, ease: 'Sine.InOut' });
    if (id === 'mastRetract' && this.mast) s.tweens.add({ targets: this.mast, angle: -14, x: this.mast.x - 40, duration: 1600, ease: 'Sine.InOut' });
    if (id === 'beacons') this.beacon?.setVisible(true);
    if (id === 'engineStart') {
      this.flame.setVisible(true).setScale(ART * 0.6);
      this.camera.shake(400, 0.003);
    }
    this.flash(t(`maneuvers.milestone.${id}` as Parameters<typeof t>[0]), 26, 230);
  }

  /** Resultado de una etapa: separar propulsores, abrir el paracaídas, encender, tocar suelo… */
  outcome(stageId: string): void {
    if (stageId === 'countdown') this.ignite();
    if (stageId === 'pressure') this.statusLight?.setFillStyle(0x48bb78);
    if (stageId === 'boosterSeparation') this.separateBoosters();
    if (stageId === 'stageSeparation') this.separateStage();
    if (stageId === 'orbitInsertion') this.reachOrbit(true);
    if (stageId === 'parachute') this.openParachute();
    if (stageId === 'heatShieldSeparation') this.dropShield();
    if (stageId === 'entry') this.plasma.setVisible(false);
    if (stageId === 'reentry') {
      this.plasma.setVisible(false);
      this.blackout.setVisible(false);
      this.flash(t('maneuvers.radioBack'), 26, 196);
      this.descending = { to: 0.45, speed: 0.12 };
    }
    if (stageId === 'descentEngines') this.land('touchdown', 0xc56b3a);
    if (stageId === 'splashdown') this.land('splashdown', 0xffffff);
  }

  update(dt: number, frame: ArtFrame): void {
    this.time += dt;
    if (this.introTime !== null) {
      this.introTime += dt;
      this.applyIntro();
    }
    const count = frame.countdown;
    this.countdownText.setText(count === null || count === undefined ? '' : t('maneuvers.game.countdown.number', { n: count }));
    this.countdownText.setFontSize(count !== null && count !== undefined && count <= 10 ? 96 : 64);
    if (frame.boarding !== undefined) this.board(frame.boarding);
    const tilt = (frame.steer ?? 0) * 0.3;
    this.vehicle.setRotation(Phaser.Math.Linear(this.vehicle.rotation, this.altitude > 0.05 || !this.look.startsOnGround ? tilt : 0, Math.min(1, dt * 6)));
    if (this.plasma.visible) this.plasma.setAlpha(0.3 + 0.2 * Math.sin(this.time * 30)).setScale(1 + 0.08 * Math.sin(this.time * 17));
    this.paintPlasma(dt);
    this.paintSea();
    this.updateRescue();
    // Despega despacio y va tomando velocidad.
    if (this.climbing) this.altitude = Math.min(1, this.altitude + dt * (0.025 + 0.1 * this.altitude));
    if (this.descending) this.altitude = Math.max(this.descending.to, this.altitude - dt * this.descending.speed * (this.parachute?.visible ? 0.6 : 1));
    if (this.onGround && this.altitude <= 0.001) {
      const landed = this.onGround;
      this.onGround = null;
      landed();
    }
    for (const cloud of this.clouds.list as Phaser.GameObjects.Graphics[]) cloud.x = ((cloud.x + dt * 8 + 200) % (ART_VIEW.width + 400)) - 200;
    this.beacon?.setAlpha(Math.sin(this.time * 9) > 0 ? 1 : 0.15);
    if (this.statusLight?.visible) this.statusLight.setAlpha(this.stage === 'pressure' && !frame.pressureOk ? (Math.sin(this.time * 14) > 0 ? 1 : 0.3) : 1);
    // El público salta de emoción desde las balizas.
    if (this.milestones.has('beacons') || this.climbing) this.crowd.forEach((head, i) => (head.y = 662 + Math.floor(i / 13) * 20 - Math.abs(Math.sin(this.time * 8 + i)) * 8));
    this.paintRadio(frame.radio === true);
    if (this.milestones.has('engineStart') && !this.climbing) this.flame.setScale(ART * (0.5 + 0.2 * Math.abs(Math.sin(this.time * 25))));
    this.emitEffects(dt);
    this.applyAltitude();
  }

  /** Humo, vapor del combustible frío, agua bajo la plataforma, polvo y chispas. */
  private emitEffects(dt: number): void {
    const x0 = this.site?.vehicleX ?? PLAIN_VEHICLE_X;
    const tint = this.look.mars ? 0xe2b48c : 0xffffff;
    const onPad = this.altitude < 0.3;
    this.sincePuff += dt;
    const water = this.milestones.has('water') && !this.climbing;
    const dust = this.milestones.has('dust') && !this.climbing;
    const puffEvery = this.climbing ? (onPad ? 0.03 : 0.06) : water || dust ? 0.08 : this.stage === 'fuel' || this.stage === 'countdown' || this.stage === 'pressure' || this.stage === 'radioCheck' ? 0.25 : Infinity;
    if (this.sincePuff >= puffEvery) {
      this.sincePuff = 0;
      if (this.climbing) {
        // El humo del motor sale de la tobera donde está ahora (no desde la plataforma) y sólo mientras se ve el
        // paisaje: ya en el espacio no queda humo suelto.
        if (this.altitude < SMOKE_UNTIL && this.flame.visible) {
          const nozzleY = this.vehicle.y - WORLD_Y + 24 * this.vehicle.scaleY - this.worldShift();
          this.puff(this.vehicle.x + this.rng.between(-24, 24) * this.vehicle.scaleX, nozzleY, tint, 2 * this.vehicle.scaleX, 60, 1100);
        }
        if (onPad) this.puff(x0 + this.rng.between(-420, 420), this.ground - this.rng.between(0, 40), tint, 2.6, -30);
      } else if (water) this.puff(x0 + this.rng.between(-110, 110), this.ground + 20, 0xcfe8ff, 1.4, -60);
      else if (dust) this.puff(x0 + this.rng.between(-300, 300), this.ground - 4, 0xd99a6c, 1.6, -18);
      else if (this.stage === 'fuel') this.puff(x0 + this.rng.between(-60, 60), this.ground - this.rng.between(80, 300), 0xeaf4ff, 1, 50);
      else this.puff(x0 + this.rng.between(-70, 70), this.ground - 8, tint, 1.2, -24);
    }
    this.sinceSpark += dt;
    // Motores de frenado cerca del suelo de Marte: el chorro levanta polvo hacia los costados.
    if (this.stage === 'descentEngines' && this.descending && this.altitude > 0.001 && this.altitude < 0.22 && this.sinceSpark > 0.07) {
      this.sinceSpark = 0;
      const side = this.rng.chance(0.5) ? 1 : -1;
      this.puff(PLAIN_VEHICLE_X + side * this.rng.between(40, 220), this.ground - this.rng.between(0, 18), 0xd99a6c, this.rng.between(1.2, 2.2), -30, 1100);
    }
    if (this.milestones.has('engineStart') && !this.climbing && this.sinceSpark > 0.05) {
      this.sinceSpark = 0;
      const spark = this.add(this.scene.add.rectangle(x0 + this.rng.between(-40, 40), this.ground - 6, ART, ART, this.rng.chance(0.5) ? 0xfde68a : 0xf6ad55));
      this.scene.tweens.add({ targets: spark, x: spark.x + this.rng.between(-60, 60), y: spark.y + this.rng.between(-50, 10), alpha: 0, duration: 450, onComplete: () => spark.destroy() });
    }
  }

  /** Ondas de radio desde la antena del control hasta la nave mientras hay una luz encendida. */
  private paintRadio(lit: boolean): void {
    this.waves.clear();
    if (this.stage !== 'radioCheck' || this.altitude > 0) return;
    const target = { x: (this.site?.vehicleX ?? PLAIN_VEHICLE_X) + 70, y: (this.site?.hatchY ?? 300) + 20 };
    for (let k = 0; k < 4; k++) {
      const f = (this.time * 0.8 + k / 4) % 1;
      const x = Phaser.Math.Linear(RADIO_SOURCE.x, target.x, f);
      const y = Phaser.Math.Linear(RADIO_SOURCE.y, target.y, f) - Math.sin(f * Math.PI) * 60;
      this.waves.lineStyle(ART, lit ? 0x9ae6b4 : 0x90cdf4, (lit ? 0.95 : 0.4) * (1 - Math.abs(f - 0.5)));
      this.waves.beginPath().arc(x, WORLD_Y + y, 14 + f * 10, Math.PI * 0.7, Math.PI * 1.3).strokePath();
    }
  }

  /** Abordaje en tres tramos: caminar al ascensor, subir y cruzar hasta la escotilla. */
  private board(progress: number): void {
    const site = this.site;
    if (!site || !this.elevator) return;
    const walk = Phaser.Math.Clamp(progress / 0.3, 0, 1);
    const lift = Phaser.Math.Clamp((progress - 0.3) / 0.45, 0, 1);
    const cross = Phaser.Math.Clamp((progress - 0.75) / 0.25, 0, 1);
    const carY = Phaser.Math.Linear(site.ground, site.hatchY + 4, lift);
    this.elevator.setY(carY);
    this.walkers.forEach((walker, i) => {
      const inCar = site.liftX - 10 + (i % 2) * 20;
      let x = Phaser.Math.Linear(this.crewStart(i), inCar, walk);
      let y = site.ground;
      if (lift > 0) y = carY - 2;
      // Cruzan de a uno.
      const mine = Phaser.Math.Clamp(cross * this.walkers.length - i, 0, 1);
      if (mine > 0) x = Phaser.Math.Linear(inCar, site.crossTo, mine);
      walker.setPosition(x, WORLD_Y + y).setVisible(mine < 1);
      const moving = (walk > 0 && walk < 1) || (mine > 0 && mine < 1) || (lift > 0 && lift < 1 && this.id === 'marsAscent');
      walker.setFrame(moving ? 3 + (Math.floor(this.time * 10) % 6) : 0);
    });
  }

  private ignite(): void {
    this.flame.setVisible(true).setScale(ART * (this.id === 'ascent' ? 1.6 : 1.4));
    this.boosterFlames.forEach((f) => f.setVisible(true));
    this.climbing = true;
    this.camera.shake(2400, 0.008);
    const tint = this.look.mars ? 0xd99a6c : 0xffffff;
    for (let i = 0; i < 36; i++) this.puff((this.site?.vehicleX ?? PLAIN_VEHICLE_X) + this.rng.between(-460, 460), this.ground - this.rng.between(0, 50), tint, this.rng.between(2, 3.2), -40);
    this.flash(t('maneuvers.liftoff'));
  }

  private separateBoosters(): void {
    for (const [i, booster] of this.boosters.entries()) {
      const side = i === 0 ? -1 : 1;
      this.scene.tweens.add({ targets: booster, x: booster.x + side * 160, y: booster.y + 420, angle: side * 70, alpha: 0, duration: 1800, ease: 'Quad.In' });
      this.boosterFlames[i]?.setVisible(false);
    }
  }

  private separateStage(): void {
    if (!this.body || !this.capsule) return;
    this.separated = true;
    this.scene.tweens.add({ targets: this.body, y: 600, alpha: 0, duration: 1800, ease: 'Quad.In' });
    this.scene.tweens.add({ targets: this.vehicle, y: this.vehicle.y + 260, duration: 1000, ease: 'Sine.Out' });
    this.flame.setY(this.capsule.y - 4).setScale(ART * 0.7);
    this.reachOrbit();
  }

  /** Nave nodriza que espera en la órbita de Marte. */
  private showMothership(): void {
    const ship = this.add(this.scene.add.image(1600, 230, FlightTextures.mothership).setScale(ART).setOrigin(0.5, 0.5));
    this.scene.tweens.add({ targets: ship, x: 1110, duration: 3000, ease: 'Sine.Out' });
  }

  private reachOrbit(toMothership = false): void {
    this.scene.time.delayedCall(900, () => {
      this.climbing = false;
      this.altitude = 1;
      this.flame.setVisible(false);
      this.flash(t('maneuvers.orbit'));
      if (toMothership) this.scene.tweens.add({ targets: this.vehicle, x: 740, duration: 2000, ease: 'Sine.InOut' });
    });
  }

  private openParachute(): void {
    if (!this.parachute) return;
    this.parachute.setVisible(true).setAlpha(1).setScale(ART * 0.2);
    this.scene.tweens.add({ targets: this.parachute, scale: ART, duration: 500, ease: 'Back.Out' });
    // El tirón del paracaídas: un sacudón corto y la bajada sigue, más lenta, hasta cerca del suelo.
    if (!reducedMotion()) this.camera.shake(260, 0.004);
    this.descending = { to: this.look.ocean ? 0.1 : 0.2, speed: 0.06 };
  }

  private dropParachute(): void {
    if (!this.parachute?.visible) return;
    const chute = this.parachute;
    this.scene.tweens.add({ targets: chute, x: 300, y: -300, alpha: 0, duration: 1600, onComplete: () => chute.setVisible(false).setAlpha(1).setPosition(0, -32) });
  }

  private dropShield(): void {
    const s = this.scene;
    const generated = this.id === 'landing' && s.textures.exists(FlightTextures.heatShield) && this.capsule?.texture.key === FlightTextures.entryCapsule;
    const piece = s.add.image(0, generated ? CAPSULE_BASE - 16 : 30, generated ? FlightTextures.heatShield : FlightTextures.shield).setScale(ART);
    this.vehicle.add(piece);
    // El escudo se suelta, gira y cae hasta perderse abajo; la cápsula queda con las patas a la vista.
    s.tweens.add({ targets: piece, x: -90, y: 560, angle: -50, duration: 1700, ease: 'Quad.In', onComplete: () => piece.destroy() });
    if (generated) this.capsule!.setTexture(FlightTextures.descentLander);
  }

  private land(bannerKey: 'touchdown' | 'splashdown', tint: number): void {
    this.descending = { to: 0, speed: 1.1 };
    // El cartel, el polvo o la salpicadura salen cuando la cápsula llega abajo (ver `update`).
    this.onGround = () => {
      this.flame.setVisible(false);
      this.descentFlames.forEach((flame) => flame.setVisible(false));
      for (let i = 0; i < 14; i++) this.puff(PLAIN_VEHICLE_X + this.rng.between(-150, 150), this.ground - this.rng.between(0, 24), tint, this.rng.between(1.6, 2.4), -34);
      this.flash(t(`maneuvers.${bannerKey}`));
      if (!reducedMotion()) this.camera.shake(320, 0.006);
      if (bannerKey === 'splashdown') this.splash();
      else this.parachute?.setVisible(false);
    };
  }

  /** Quiénes bajan caminando y quiénes en camilla al volver a la Tierra (según su condición física). */
  setArrival(arrival: Partial<Record<CrewId, 'walk' | 'stretcher'>>): void {
    this.arrival = arrival;
  }

  /**
   * Amerizaje: columnas de agua, los paracaídas que caen al mar, los flotadores que se inflan y, enseguida, el barco
   * y el helicóptero de rescate; después la tripulación sale a la cubierta (caminando o en camilla).
   */
  private splash(): void {
    const s = this.scene;
    this.floatingSince = this.time;
    // Columnas de agua en píxeles grandes, que suben y caen.
    for (let i = 0; i < 9; i++) {
      const x = PLAIN_VEHICLE_X + (i - 4) * 26 + this.rng.between(-6, 6);
      const drop = s.add.rectangle(x, this.ground, ART * 2, ART * this.rng.between(6, 14), i % 2 ? 0xffffff : 0xbee3f8).setOrigin(0.5, 1);
      this.smoke.add(drop);
      s.tweens.add({ targets: drop, y: this.ground - this.rng.between(60, 150) * (1 - Math.abs(i - 4) / 6), duration: 320, ease: 'Quad.Out', yoyo: true, onComplete: () => drop.destroy() });
    }
    // Anillos que se abren en el agua.
    for (const delay of [0, 260]) {
      const ring = s.add.ellipse(PLAIN_VEHICLE_X, this.ground + 6, 120, 18).setStrokeStyle(ART, 0xffffff, 0.9);
      this.smoke.add(ring);
      s.tweens.add({ targets: ring, scaleX: 3.4, scaleY: 2, alpha: 0, delay, duration: 1300, onComplete: () => ring.destroy() });
    }
    const chute = this.parachute;
    if (chute) s.tweens.add({ targets: chute, x: 150, y: chute.y + 150, angle: 60, alpha: 0, duration: 1500, onComplete: () => chute.setVisible(false).setAngle(0).setX(0) });
    if (!s.textures.exists(FlightTextures.rescueShip) || this.capsule?.texture.key !== FlightTextures.returnCapsule) return;
    // Los flotadores naranjas se inflan y mantienen la cápsula derecha.
    s.time.delayedCall(700, () => this.capsule?.setTexture(FlightTextures.seaCapsule));
    const water = this.ground + 10;
    this.ship = s.add.image(-320, water + 22, FlightTextures.rescueShip).setOrigin(0.5, 1).setScale(ART).setFlipX(true);
    this.frontGround.add(this.ship);
    s.tweens.add({ targets: this.ship, x: RESCUE.shipX, delay: 900, duration: 3200, ease: 'Sine.Out', onComplete: () => this.disembark() });
    this.helicopter = s.add.image(ART_VIEW.width + 200, RESCUE.heliY - 60, FlightTextures.helicopter).setOrigin(0.5, 0.5).setScale(ART);
    this.frontGround.add(this.helicopter);
    s.tweens.add({ targets: this.helicopter, x: RESCUE.heliX, y: RESCUE.heliY, delay: 500, duration: 2600, ease: 'Sine.Out' });
    s.time.delayedCall(1400, () => this.flash(t('maneuvers.rescue'), 26, 150));
  }

  /** La tripulación sale a la cubierta del barco: quien llegó en forma camina; quien no, va en camilla. */
  private disembark(): void {
    const s = this.scene;
    if (!this.ship) return;
    const deck = this.ship.y - (this.ship.height - RESCUE.deckRow) * ART;
    const edge = this.ship.x + (this.ship.width * ART) / 2 - 70;
    CREW_ROSTER.forEach(({ id }, i) => {
      if (!s.textures.exists(crewTextureKey(id))) return;
      const stretcher = this.arrival[id] === 'stretcher';
      const sprite = s.add.sprite(edge, deck, crewTextureKey(id), 0).setOrigin(CREW_SHEET.origin.x, CREW_SHEET.origin.y).setScale(CREW_SCALE).setVisible(false);
      let bed: Phaser.GameObjects.Graphics | null = null;
      if (stretcher) {
        // Camilla con ruedas: el tripulante va sentado arriba (se ve de la cintura para arriba) y la empujan.
        bed = s.add.graphics().setVisible(false);
        bed.fillStyle(0x1a202c).fillRect(-26, -22, 52, 12).fillStyle(0xf7fafc).fillRect(-24, -20, 48, 8).fillStyle(0xed8936).fillRect(-24, -14, 48, 2);
        bed.fillStyle(0x1a202c).fillRect(-20, -10, 4, 10).fillRect(16, -10, 4, 10).fillStyle(0x4a5568).fillRect(-22, -4, 8, 4).fillRect(14, -4, 8, 4);
        sprite.setCrop(0, 0, CREW_SHEET.frameWidth, 52).setY(deck - 4);
        this.frontGround.add(bed);
      }
      this.frontGround.add(sprite);
      this.rescued.push({ sprite, bed, from: edge, to: edge - 40 - (CREW_ROSTER.length - 1 - i) * 42, start: this.time + i * 0.9 });
    });
  }

  private updateRescue(): void {
    if (this.floatingSince !== null) {
      // La cápsula se mece en el agua y el barco también, apenas.
      const bob = Math.round(Math.sin((this.time - this.floatingSince) * 2.4) * 1.5) * 2;
      this.capsule?.setY(CAPSULE_BASE + 8 + bob);
      if (this.helicopter) this.helicopter.setScale(ART, ART).setAngle(Math.sin(this.time * 3) * 2);
    }
    for (const r of this.rescued) {
      const k = Phaser.Math.Clamp((this.time - r.start) / 2.2, 0, 1);
      const x = Phaser.Math.Linear(r.from, r.to, k);
      r.sprite.setVisible(this.time >= r.start).setX(x).setFlipX(true);
      if (r.bed) r.bed.setVisible(this.time >= r.start).setPosition(x, this.ship ? this.ship.y - (this.ship.height - RESCUE.deckRow) * ART : r.sprite.y);
      // Hoja de 9 columnas: la fila de costado camina con los cuadros 3 a 8 (como en la escena de entrada).
      else r.sprite.setFrame(k > 0 && k < 1 ? 3 + (Math.floor(this.time * 10) % 6) : 0);
    }
  }

  /** Plasma de la entrada: onda de choque en bandas bajo el escudo, lenguas que suben por los costados y chispas. */
  private paintPlasma(dt: number): void {
    const g = this.plasmaFx.clear();
    const on = this.plasma.visible;
    this.heat.setFillStyle(0xf6ad55, on ? 0.07 + 0.05 * Math.abs(Math.sin(this.time * 19)) : 0);
    if (!on) return;
    const strength = this.plasma.radius / 76;
    const half = (this.capsule?.width ?? 20) * ART * 0.5;
    const base = this.capsule && this.capsule.originY === 1 ? CAPSULE_BASE : 28;
    // Bandas de la onda de choque: blanca pegada al escudo, después amarilla, naranja y roja.
    const bands: [number, number, number][] = [[0xfff4d6, 0.9, 0], [0xfbd38d, 0.75, 1], [0xf6ad55, 0.6, 2], [0xed8936, 0.45, 3], [0xe53e3e, 0.3, 4]];
    for (const [color, alpha, i] of bands) {
      const wobble = Math.round(Math.sin(this.time * 23 + i * 1.7) * 2) * ART;
      const width = (half + 8 + i * 14 * strength) * 2 + wobble;
      g.fillStyle(color, alpha).fillRect(Math.round(-width / 2 / ART) * ART, base - 4 + i * ART * 2, Math.round(width / ART) * ART, ART * 2);
    }
    // Lenguas de plasma que suben por los costados y chispas que quedan atrás (ruido fijo, sin azar).
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const phase = (this.time * (2.2 + (i % 5) * 0.35) + i * 0.37) % 1;
      const x = side * (half + 6 + ((i * 13) % 22) * strength);
      const y = base - phase * (170 + 90 * strength);
      const length = ART * (3 + (i % 4)) * (1 - phase * 0.6);
      g.fillStyle(i % 3 === 0 ? 0xfff4d6 : i % 3 === 1 ? 0xf6ad55 : 0xe53e3e, 0.8 * (1 - phase)).fillRect(Math.round(x / ART) * ART, Math.round(y / ART) * ART, ART, Math.round(length / ART) * ART);
    }
    // El calor sacude la cápsula (no con movimiento reducido).
    this.sinceShake += dt;
    if (this.sinceShake > 0.3 && !reducedMotion()) {
      this.sinceShake = 0;
      this.camera.shake(300, 0.0025 * strength);
    }
  }

  /** Brillos del mar que corren despacio (sólo en la reentrada). */
  private paintSea(): void {
    const g = this.seaFx;
    if (!g) return;
    g.clear();
    for (let i = 0; i < 22; i++) {
      const y = this.ground - 96 + ((i * 37) % 200);
      const x = (((i * 173 + this.time * (10 + (i % 4) * 5)) % (ART_VIEW.width + 80)) + ART_VIEW.width + 80) % (ART_VIEW.width + 80) - 40;
      g.fillStyle(0xffffff, 0.35 + 0.25 * Math.sin(this.time * 2 + i)).fillRect(Math.round(x / ART) * ART, Math.round(y / ART) * ART, ART * (3 + (i % 3)), ART / 2);
    }
  }

  // --- Efectos ---

  /** Cuánto bajó el paisaje en pantalla por la altura de la nave (px). */
  private worldShift(): number {
    return this.altitude * 760;
  }

  /**
   * Bocanada de humo (o vapor, agua, polvo) que se aleja `drift` px hacia abajo (negativo: hacia arriba). `y` es la
   * altura sobre el suelo del lugar (en px de pantalla con la nave en tierra): la bocanada queda en el aire donde
   * nació y baja con el paisaje cuando la nave sube.
   */
  private puff(x: number, y: number, tint: number, scale: number, drift: number, duration = 1500): void {
    const puff = this.scene.add.sprite(x, y, FlightTextures.smoke, 0).setScale(scale * ART).setTint(tint).setAlpha(0.9);
    this.smoke.add(puff);
    puff.play('flight-smoke');
    this.scene.tweens.add({ targets: puff, x: x + this.rng.between(-50, 50), y: y + drift, alpha: 0, duration, onComplete: () => puff.destroy() });
  }

  private flash(text: string, size = 34, y = 120): void {
    this.banner.setText(text).setFontSize(size).setY(WORLD_Y + y).setAlpha(1).setScale(0.6);
    this.scene.tweens.killTweensOf(this.banner);
    this.scene.tweens.add({ targets: this.banner, scale: 1, duration: 300, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: this.banner, alpha: 0, delay: 1700, duration: 500 });
  }

  /** Cielo, estrellas, fondo y nave según la altura: el mundo baja (con paralaje) mientras la nave sube. */
  private applyAltitude(): void {
    const a = this.altitude;
    this.space.setAlpha(Phaser.Math.Clamp((a - 0.25) / 0.6, 0, 1));
    this.stars.setAlpha(Phaser.Math.Clamp((a - 0.45) / 0.4, 0, 1));
    this.backGround.setY(WORLD_Y + this.worldShift());
    this.frontGround.setY(WORLD_Y + this.worldShift());
    // El humo acompaña al paisaje y se desvanece con él antes de llegar al espacio (sin cortes).
    this.smoke.setY(WORLD_Y + this.worldShift()).setAlpha(Phaser.Math.Clamp((SMOKE_UNTIL + 0.1 - a) / 0.2, 0, 1));
    this.far.setY(WORLD_Y + a * 420).setAlpha(Phaser.Math.Clamp((0.8 - a) / 0.3, 0, 1));
    this.clouds.setY(WORLD_Y + a * 600).setAlpha(Phaser.Math.Clamp((0.8 - a) / 0.3, 0, 1));
    if (this.look.startsOnGround) {
      if (!this.separated) this.vehicle.setY(WORLD_Y + this.ground - smooth(a / 0.15) * 240);
      // Se aleja: se achica para que entre entera en pantalla.
      this.vehicle.setScale(Phaser.Math.Linear(1, 0.6, smooth(a / 0.3)));
    } else {
      this.vehicle.setY(WORLD_Y + Phaser.Math.Linear(this.ground - CAPSULE_BASE, this.look.plain ? 380 : 220, Math.min(1, a / 0.45)));
    }
    if (a > 0.02) this.walkers.forEach((w) => w.setAlpha(0));
    this.speedLines.clear();
    const moving = (this.climbing && a > 0.05) || (this.descending && a > this.descending.to + 0.01) || this.plasma.visible;
    if (!moving) return;
    const direction = this.climbing ? 1 : -1;
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(((i * 97 + 31) % ART_VIEW.width) / ART) * ART;
      const y = (((i * 53 + this.time * 520 * direction) % ART_VIEW.height) + ART_VIEW.height) % ART_VIEW.height;
      this.speedLines.fillStyle(0xffffff, 0.25).fillRect(x, Math.floor(y / ART) * ART, ART / 2, 32);
    }
  }
}

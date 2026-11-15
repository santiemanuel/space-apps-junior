import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import type { ManeuverId } from '../../../core/flow/types';
import { Rng } from '../../../core/rng/Rng';
import { t } from '../../../i18n';
import { CREW_SHEET, crewTextureKey, FlightTextures } from '../../assets';

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

/** Cómo se ve cada maniobra: cielo en franjas (de arriba hacia abajo) y, sin sitio, los fondos dibujados con código. */
interface Look {
  sky: number[];
  mountains: [number, number];
  ground: number;
  ocean?: boolean;
  startsOnGround: boolean;
  mars: boolean;
  sun?: { x: number; y: number; r: number; color: number };
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
  landing: { sky: [0xb7794a, 0xc48a5a, 0xd29d6e, 0xdcb183, 0xe8c39a], mountains: [0xb0764f, 0x8f4a2c], ground: 0xa0522d, startsOnGround: false, mars: true },
  reentry: { sky: [0x2b6cb0, 0x3f82c4, 0x5a9bd6, 0x7cb6e6, 0x9fd3f5], mountains: [0x5a7fa8, 0x4f7f9f], ground: 0x2b6cb0, ocean: true, startsOnGround: false, mars: false },
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
 * El aterrizaje y la reentrada usan fondos dibujados con código. Sólo dibuja.
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
    this.ground = this.site?.ground ?? PLAIN_GROUND;
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
    this.waves = this.add(scene.add.graphics());
    this.plasma = scene.add.circle(0, 0, 60, 0xf6ad55, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.flame = scene.add.sprite(0, 0, FlightTextures.flame).setScale(ART).setOrigin(0.5, 0).setVisible(false);
    this.vehicle.add([this.plasma, this.flame]);
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
    if (stageId === 'entry' || stageId === 'orientShield') this.plasma.setVisible(true).setRadius(stageId === 'entry' ? 64 : 44);
    if (stageId === 'reentry') this.plasma.setVisible(true).setRadius(76);
    if (stageId === 'descentEngines') {
      this.dropParachute();
      this.flame.setVisible(true);
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
    if (this.plasma.visible) this.plasma.setAlpha(0.35 + 0.25 * Math.sin(this.time * 30)).setScale(1 + 0.08 * Math.sin(this.time * 17));
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
        this.puff(this.vehicle.x + this.rng.between(-30, 30), this.vehicle.y - WORLD_Y + 40, tint, 2, 140);
        if (onPad) this.puff(x0 + this.rng.between(-420, 420), this.ground - this.rng.between(0, 40), tint, 2.6, -30);
      } else if (water) this.puff(x0 + this.rng.between(-110, 110), this.ground + 20, 0xcfe8ff, 1.4, -60);
      else if (dust) this.puff(x0 + this.rng.between(-300, 300), this.ground - 4, 0xd99a6c, 1.6, -18);
      else if (this.stage === 'fuel') this.puff(x0 + this.rng.between(-60, 60), this.ground - this.rng.between(80, 300), 0xeaf4ff, 1, 50);
      else this.puff(x0 + this.rng.between(-70, 70), this.ground - 8, tint, 1.2, -24);
    }
    this.sinceSpark += dt;
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
    this.parachute.setVisible(true).setScale(ART * 0.2);
    this.scene.tweens.add({ targets: this.parachute, scale: ART, duration: 500, ease: 'Back.Out' });
    this.descending = this.descending ?? { to: 0, speed: 0.06 };
  }

  private dropParachute(): void {
    if (!this.parachute?.visible) return;
    const chute = this.parachute;
    this.scene.tweens.add({ targets: chute, x: 300, y: -300, alpha: 0, duration: 1600, onComplete: () => chute.setVisible(false).setAlpha(1).setPosition(0, -32) });
  }

  private dropShield(): void {
    const piece = this.scene.add.image(0, 30, FlightTextures.shield).setScale(ART);
    this.vehicle.add(piece);
    this.scene.tweens.add({ targets: piece, y: 500, angle: 40, alpha: 0, duration: 1500, ease: 'Quad.In' });
  }

  private land(bannerKey: 'touchdown' | 'splashdown', tint: number): void {
    this.descending = { to: 0, speed: 1.1 };
    // El cartel, el polvo o la salpicadura salen cuando la cápsula llega abajo (ver `update`).
    this.onGround = () => {
      this.flame.setVisible(false);
      this.parachute?.setVisible(bannerKey === 'splashdown');
      for (let i = 0; i < 10; i++) this.puff(PLAIN_VEHICLE_X + this.rng.between(-90, 90), PLAIN_GROUND - 4, tint, 1.8, -24);
      this.flash(t(`maneuvers.${bannerKey}`));
    };
  }

  // --- Efectos ---

  /** Bocanada de humo (o vapor, agua, polvo) que se aleja `drift` px hacia abajo (negativo: hacia arriba). */
  private puff(x: number, y: number, tint: number, scale: number, drift: number): void {
    const puff = this.add(this.scene.add.sprite(x, y, FlightTextures.smoke, 0).setScale(scale * ART).setTint(tint).setAlpha(0.9));
    puff.play('flight-smoke');
    this.scene.tweens.add({ targets: puff, x: x + this.rng.between(-50, 50), y: puff.y + drift, alpha: 0, duration: 1500, onComplete: () => puff.destroy() });
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
    this.backGround.setY(WORLD_Y + a * 760);
    this.frontGround.setY(WORLD_Y + a * 760);
    this.far.setY(WORLD_Y + a * 420).setAlpha(Phaser.Math.Clamp((0.8 - a) / 0.3, 0, 1));
    this.clouds.setY(WORLD_Y + a * 600).setAlpha(Phaser.Math.Clamp((0.8 - a) / 0.3, 0, 1));
    if (this.look.startsOnGround) {
      if (!this.separated) this.vehicle.setY(WORLD_Y + this.ground - smooth(a / 0.15) * 240);
      // Se aleja: se achica para que entre entera en pantalla.
      this.vehicle.setScale(Phaser.Math.Linear(1, 0.6, smooth(a / 0.3)));
    } else {
      this.vehicle.setY(WORLD_Y + Phaser.Math.Linear(PLAIN_GROUND - 34, 220, Math.min(1, a / 0.45)));
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

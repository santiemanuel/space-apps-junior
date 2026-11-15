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
const GROUND = 610;
const VEHICLE_X = 640;
const TOWER_X = VEHICLE_X - 104;
/** Altura de la escotilla sobre el suelo (donde llega el ascensor). */
const HATCH_HEIGHT = { ascent: 176, marsAscent: 116 } as const;

interface Look {
  skyTop: number;
  skyBottom: number;
  mountains: [number, number];
  ground: number;
  ocean?: boolean;
  startsOnGround: boolean;
  mars: boolean;
}

const LOOKS: Record<ManeuverId, Look> = {
  ascent: { skyTop: 0x2b6cb0, skyBottom: 0x9fd3f5, mountains: [0x5a7fa8, 0x3f6b4a], ground: 0x4a7c3a, startsOnGround: true, mars: false },
  marsAscent: { skyTop: 0xb7794a, skyBottom: 0xe8c39a, mountains: [0xb0764f, 0x8f4a2c], ground: 0xa0522d, startsOnGround: true, mars: true },
  landing: { skyTop: 0xb7794a, skyBottom: 0xe8c39a, mountains: [0xb0764f, 0x8f4a2c], ground: 0xa0522d, startsOnGround: false, mars: true },
  reentry: { skyTop: 0x2b6cb0, skyBottom: 0x9fd3f5, mountains: [0x5a7fa8, 0x4f7f9f], ground: 0x2b6cb0, ocean: true, startsOnGround: false, mars: false },
};

/** Lo que la escena le cuenta a la ilustración en cada cuadro. */
export interface ArtFrame {
  /** Abordaje: fracción de la secuencia hecha (la tripulación sube por el ascensor). */
  boarding?: number;
  /** Cuenta regresiva: número a la vista (10 … 0), o null. */
  countdown?: number | null;
  /** Pilotaje: posición de la aguja (−1 … 1): la nave se inclina. */
  steer?: number;
}

/**
 * Ilustración animada de la maniobra a pantalla completa (pixel art de `public/assets/ui/flight/` y fondos dibujados
 * con código): montañas, nubes y público en la Tierra; el monte Sharp y la base en Marte; torre con ascensor,
 * cohete, cuenta regresiva y despegue; cápsula con plasma, paracaídas y aterrizaje. Sólo dibuja.
 */
export class FlightArt {
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly look: Look;
  private readonly rng = new Rng(7);
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly space: Phaser.GameObjects.Rectangle;
  private readonly stars: Phaser.GameObjects.Graphics;
  private readonly far: Phaser.GameObjects.Container;
  private readonly clouds: Phaser.GameObjects.Container;
  private readonly groundLayer: Phaser.GameObjects.Container;
  private readonly vehicle: Phaser.GameObjects.Container;
  private readonly flame: Phaser.GameObjects.Sprite;
  private readonly plasma: Phaser.GameObjects.Arc;
  private readonly speedLines: Phaser.GameObjects.Graphics;
  private readonly countdownText: Phaser.GameObjects.Text;
  private readonly banner: Phaser.GameObjects.Text;
  private readonly walkers: Phaser.GameObjects.Sprite[] = [];
  private readonly crowd: Phaser.GameObjects.Rectangle[] = [];
  private elevator: Phaser.GameObjects.Rectangle | null = null;
  private body: Phaser.GameObjects.Image | null = null;
  private boosters: Phaser.GameObjects.Image[] = [];
  private capsule: Phaser.GameObjects.Image | null = null;
  private parachute: Phaser.GameObjects.Image | null = null;
  private hose: Phaser.GameObjects.Rectangle | null = null;
  /** 0 en el suelo … 1 en el espacio. */
  private altitude: number;
  private climbing = false;
  private descending: { to: number; speed: number } | null = null;
  private stage = '';
  /** Lo que pasa al tocar el suelo o el mar (se dispara una vez). */
  private onGround: (() => void) | null = null;
  private sincePuff = 0;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly id: ManeuverId,
  ) {
    this.look = LOOKS[id];
    this.altitude = this.look.startsOnGround ? 0 : 1;
    this.camera = scene.cameras.add(ART_VIEW.x, ART_VIEW.y, ART_VIEW.width, ART_VIEW.height).setScroll(0, WORLD_Y);
    // La ilustración se dibuja primero: la interfaz queda encima.
    const cameras = scene.cameras.cameras;
    cameras.splice(cameras.indexOf(this.camera), 1);
    cameras.unshift(this.camera);
    this.sky = this.add(scene.add.graphics());
    this.sky.fillGradientStyle(this.look.skyTop, this.look.skyTop, this.look.skyBottom, this.look.skyBottom, 1).fillRect(0, 0, ART_VIEW.width, ART_VIEW.height);
    this.space = this.add(scene.add.rectangle(0, 0, ART_VIEW.width, ART_VIEW.height, 0x05070d).setOrigin(0, 0));
    this.stars = this.add(scene.add.graphics());
    for (let i = 0; i < 160; i++) this.stars.fillStyle(0xffffff, this.rng.between(0.3, 1)).fillRect(Math.floor(this.rng.between(0, ART_VIEW.width)), Math.floor(this.rng.between(0, ART_VIEW.height)), 2, 2);
    this.far = this.add(scene.add.container(0, 0));
    this.clouds = this.add(scene.add.container(0, 0));
    this.speedLines = this.add(scene.add.graphics());
    this.groundLayer = this.add(scene.add.container(0, 0));
    this.vehicle = this.add(scene.add.container(VEHICLE_X, this.look.startsOnGround ? GROUND : 200));
    this.plasma = scene.add.circle(0, 0, 60, 0xf6ad55, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.flame = scene.add.sprite(0, 0, FlightTextures.flame).setScale(ART).setOrigin(0.5, 0).setVisible(false);
    this.vehicle.add([this.plasma, this.flame]);
    this.countdownText = this.add(
      scene.add.text(ART_VIEW.width / 2, 170, '', { fontFamily: 'monospace', fontSize: '96px', color: '#fbd38d', stroke: '#1a202c', strokeThickness: 8 }).setOrigin(0.5),
    );
    this.banner = this.add(
      scene.add.text(ART_VIEW.width / 2, 130, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', stroke: '#1a202c', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0),
    );
    if (!scene.anims.exists('flight-flame')) scene.anims.create({ key: 'flight-flame', frames: scene.anims.generateFrameNumbers(FlightTextures.flame), frameRate: 14, repeat: -1 });
    if (!scene.anims.exists('flight-smoke')) scene.anims.create({ key: 'flight-smoke', frames: scene.anims.generateFrameNumbers(FlightTextures.smoke), frameRate: 6 });
    this.flame.play('flight-flame');
    this.buildBackdrop();
    this.buildGround();
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

  /** Montañas lejanas (o el monte Sharp), nubes y, en Marte, la base a lo lejos. */
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
      // Monte Sharp en el centro del cráter Gale, con capas.
      this.far.add([range(farColor, GROUND - 20, 9, 140, 3), s.add.triangle(900, GROUND - 40, 0, 0, 260, -230, 520, 0, 0x9c5a37).setOrigin(0.5, 1), range(nearColor, GROUND, 6, 70, 5)]);
      for (const [x, r] of [[160, 34], [230, 24]] as const) this.far.add(s.add.arc(x, GROUND - 2, r, 180, 360, false, 0xe2e8f0).setStrokeStyle(3, 0x4a5568));
    } else {
      this.far.add([range(farColor, GROUND - 30, 8, 190, 3), range(nearColor, GROUND, 11, 90, 4)]);
      for (let i = 0; i < 6; i++) {
        const x = this.rng.between(0, ART_VIEW.width);
        const y = this.rng.between(60, 260);
        const cloud = s.add.container(x, y, [0, 1, 2].map((k) => s.add.ellipse(k * 26 - 26, k === 1 ? -10 : 0, 60, 30, 0xffffff, 0.85)));
        this.clouds.add(cloud);
      }
    }
  }

  private buildGround(): void {
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [s.add.rectangle(0, GROUND, ART_VIEW.width, ART_VIEW.height, this.look.ground).setOrigin(0, 0)];
    if (this.look.ocean) {
      const waves = s.add.graphics();
      for (let x = 0; x < ART_VIEW.width; x += 28) waves.fillStyle(0x90cdf4, 0.6).fillRect(x + (x % 56 ? 0 : 10), GROUND + 14 + (x % 84 ? 0 : 18), 14, 3);
      parts.push(waves);
    } else {
      parts.push(s.add.rectangle(VEHICLE_X, GROUND, 230, 14, 0x718096).setOrigin(0.5, 0));
      if (this.look.mars) {
        for (const x of [90, 380, 1010, 1180]) parts.push(s.add.ellipse(x, GROUND + 18, 40, 20, 0x7b3f20));
        parts.push(s.add.rectangle(TOWER_X - 150, GROUND, 70, 50, 0xcbd5e0).setOrigin(0.5, 1).setStrokeStyle(3, 0x1a202c));
      } else {
        // Público detrás de la valla, que saluda en el despegue; reflectores y banderas.
        parts.push(s.add.rectangle(40, GROUND + 6, 380, 6, 0xe2e8f0).setOrigin(0, 0.5));
        const colors = [0xfc8181, 0xf6e05e, 0x68d391, 0x63b3ed, 0xb794f4, 0xf6ad55];
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 22; i++) {
            const x = 50 + i * 17 + (row % 2) * 8;
            const y = GROUND + 18 + row * 14;
            const body = s.add.rectangle(x, y, 10, 12, colors[(i + row * 2) % colors.length]!).setOrigin(0.5, 0);
            const head = s.add.rectangle(x, y - 6, 8, 8, 0xf5d0a9).setOrigin(0.5, 0.5);
            parts.push(body, head);
            this.crowd.push(head);
          }
        }
        for (const x of [1050, 1210]) parts.push(s.add.rectangle(x, GROUND, 8, 150, 0x4a5568).setOrigin(0.5, 1), s.add.rectangle(x, GROUND - 150, 34, 14, 0xfefcbf).setStrokeStyle(2, 0x1a202c));
        parts.push(s.add.rectangle(470, GROUND, 4, 90, 0xa0aec0).setOrigin(0.5, 1), s.add.rectangle(472, GROUND - 90, 34, 22, 0x63b3ed).setOrigin(0, 0));
      }
      // Torre con ascensor (en Marte, una plataforma de acceso) y la pasarela hasta la escotilla.
      if (this.id === 'ascent' || this.id === 'marsAscent') {
        const hatchY = GROUND - HATCH_HEIGHT[this.id];
        if (this.id === 'ascent') parts.push(s.add.image(TOWER_X, GROUND, FlightTextures.tower).setScale(ART * 0.86).setOrigin(0.5, 1));
        else {
          const gantry = s.add.graphics();
          gantry.fillStyle(0x718096).fillRect(TOWER_X - 20, hatchY - 30, 6, HATCH_HEIGHT.marsAscent + 30).fillRect(TOWER_X + 14, hatchY - 30, 6, HATCH_HEIGHT.marsAscent + 30);
          for (let y = hatchY - 20; y < GROUND; y += 22) gantry.lineStyle(3, 0x4a5568).lineBetween(TOWER_X - 17, y, TOWER_X + 17, y + 18);
          parts.push(gantry);
        }
        parts.push(s.add.rectangle(TOWER_X, hatchY, VEHICLE_X - TOWER_X - 14, 6, 0xa0aec0).setOrigin(0, 0.5));
        this.elevator = s.add.rectangle(TOWER_X, GROUND, 34, 40, 0xfbd38d, 0.9).setOrigin(0.5, 1).setStrokeStyle(3, 0x1a202c);
        parts.push(this.elevator);
      }
    }
    this.groundLayer.add(parts);
  }

  private buildVehicle(): void {
    const s = this.scene;
    if (this.id === 'ascent') {
      this.body = s.add.image(0, 0, FlightTextures.rocket).setScale(ART).setOrigin(0.5, 1);
      this.boosters = [-1, 1].map((side) => s.add.image(side * 48, 0, FlightTextures.booster).setScale(ART).setOrigin(0.5, 1).setFlipX(side > 0));
      this.vehicle.add([...this.boosters, this.body]);
      this.flame.setY(-4).setScale(ART * 1.2);
    } else if (this.id === 'marsAscent') {
      this.body = s.add.image(0, 0, FlightTextures.lander).setScale(ART).setOrigin(0.5, 1);
      this.vehicle.add(this.body);
      this.flame.setY(-12);
    } else {
      this.capsule = s.add.image(0, 0, FlightTextures.capsule).setScale(ART).setOrigin(0.5, 0.5);
      this.parachute = s.add.image(0, -32, FlightTextures.parachute).setScale(ART).setOrigin(0.5, 1).setVisible(false);
      this.vehicle.add([this.parachute, this.capsule]);
      this.flame.setY(32).setScale(ART * 0.6);
    }
    this.vehicle.bringToTop(this.flame);
    if (!this.look.startsOnGround) return;
    CREW_ROSTER.forEach(({ id }, i) => {
      if (!s.textures.exists(crewTextureKey(id))) return;
      this.walkers.push(this.add(s.add.sprite(this.crewStart(i), GROUND, crewTextureKey(id), 0).setOrigin(CREW_SHEET.origin.x, CREW_SHEET.origin.y).setScale(0.55)));
    });
  }

  private crewStart(i: number): number {
    return TOWER_X - 170 - i * 34;
  }

  /** Empieza una etapa: prepara lo que se ve (manguera, plasma, motores de descenso…). */
  setStage(stageId: string): void {
    this.stage = stageId;
    if (stageId === 'fuel') {
      const from = this.id === 'ascent' ? TOWER_X : TOWER_X - 150;
      this.hose = this.add(this.scene.add.rectangle(from, GROUND - 40, VEHICLE_X - from - 20, 6, 0x2d3748).setOrigin(0, 0.5));
    }
    if (stageId === 'countdown') this.hose?.setVisible(false);
    if (stageId === 'entry' || stageId === 'orientShield') this.plasma.setVisible(true).setRadius(stageId === 'entry' ? 64 : 44);
    if (stageId === 'reentry') this.plasma.setVisible(true).setRadius(76);
    if (stageId === 'descentEngines') {
      this.dropParachute();
      this.flame.setVisible(true);
      this.descending = { to: 0, speed: 0.07 };
    }
    if (stageId === 'splashdown') this.openParachute();
  }

  /** Resultado de una etapa: separar propulsores, abrir el paracaídas, encender, tocar suelo… */
  outcome(stageId: string): void {
    if (stageId === 'countdown') this.ignite();
    if (stageId === 'boosterSeparation') this.separateBoosters();
    if (stageId === 'stageSeparation') this.separateStage();
    if (stageId === 'orbitInsertion') this.reachOrbit();
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
    this.countdownText.setText(frame.countdown === null || frame.countdown === undefined ? '' : t('maneuvers.game.countdown.number', { n: frame.countdown }));
    if (frame.boarding !== undefined) this.board(frame.boarding);
    const tilt = (frame.steer ?? 0) * 0.3;
    this.vehicle.setRotation(Phaser.Math.Linear(this.vehicle.rotation, this.altitude > 0.05 || !this.look.startsOnGround ? tilt : 0, Math.min(1, dt * 6)));
    if (this.plasma.visible) this.plasma.setAlpha(0.35 + 0.25 * Math.sin(this.time * 30)).setScale(1 + 0.08 * Math.sin(this.time * 17));
    if (this.climbing) this.altitude = Math.min(1, this.altitude + dt * 0.07);
    if (this.descending) this.altitude = Math.max(this.descending.to, this.altitude - dt * this.descending.speed * (this.parachute?.visible ? 0.6 : 1));
    if (this.onGround && this.altitude <= 0.001) {
      const landed = this.onGround;
      this.onGround = null;
      landed();
    }
    for (const cloud of this.clouds.list as Phaser.GameObjects.Container[]) cloud.x = ((cloud.x + dt * 8 + 100) % (ART_VIEW.width + 200)) - 100;
    // El público salta de emoción desde la cuenta regresiva.
    if (this.stage === 'countdown' || this.climbing) this.crowd.forEach((head, i) => (head.y = GROUND + 12 + Math.floor(i / 22) * 14 - Math.abs(Math.sin(this.time * 8 + i)) * 4));
    this.sincePuff += dt;
    const puffEvery = this.climbing ? 0.06 : this.stage === 'fuel' || this.stage === 'countdown' ? 0.3 : Infinity;
    if (this.sincePuff >= puffEvery) {
      this.sincePuff = 0;
      const tint = this.look.mars ? 0xe2b48c : 0xffffff;
      if (this.climbing) this.puff(this.vehicle.x + this.rng.between(-20, 20), this.vehicle.y - WORLD_Y + 60, tint, 1.6);
      else this.puff(VEHICLE_X + this.rng.between(-70, 70), GROUND - 8, tint, 1.2);
    }
    this.applyAltitude();
  }

  // --- Etapas ---

  /** Abordaje en tres tramos: caminar al ascensor, subir y cruzar la pasarela hasta la escotilla. */
  private board(progress: number): void {
    if (!this.elevator || (this.id !== 'ascent' && this.id !== 'marsAscent')) return;
    const hatchY = GROUND - HATCH_HEIGHT[this.id];
    const walk = Phaser.Math.Clamp(progress / 0.3, 0, 1);
    const lift = Phaser.Math.Clamp((progress - 0.3) / 0.45, 0, 1);
    const cross = Phaser.Math.Clamp((progress - 0.75) / 0.25, 0, 1);
    const carY = Phaser.Math.Linear(GROUND, hatchY + 4, lift);
    this.elevator.setY(carY);
    this.walkers.forEach((walker, i) => {
      const inCar = TOWER_X - 9 + (i % 2) * 18;
      let x = Phaser.Math.Linear(this.crewStart(i), inCar, walk);
      let y = GROUND;
      if (lift > 0) y = carY - 2;
      // Cruzan de a uno.
      const mine = Phaser.Math.Clamp(cross * this.walkers.length - i, 0, 1);
      if (mine > 0) x = Phaser.Math.Linear(inCar, VEHICLE_X - 20, mine);
      walker.setPosition(x, WORLD_Y + y).setVisible(mine < 1);
      const moving = (walk > 0 && walk < 1) || (mine > 0 && mine < 1);
      walker.setFrame(moving ? 3 + (Math.floor(this.time * 10) % 6) : 0);
    });
  }

  private ignite(): void {
    this.flame.setVisible(true);
    this.climbing = true;
    this.camera.shake(800, 0.01);
    for (let i = 0; i < 14; i++) this.puff(VEHICLE_X + this.rng.between(-140, 140), GROUND - this.rng.between(0, 24), this.look.mars ? 0xe2b48c : 0xffffff, 2.2);
    this.flash(t('maneuvers.liftoff'));
  }

  private separateBoosters(): void {
    for (const [i, booster] of this.boosters.entries()) {
      const side = i === 0 ? -1 : 1;
      this.scene.tweens.add({ targets: booster, x: booster.x + side * 160, y: booster.y + 420, angle: side * 70, alpha: 0, duration: 1800, ease: 'Quad.In' });
    }
  }

  private separateStage(): void {
    if (!this.body) return;
    this.capsule = this.scene.add.image(0, -200, FlightTextures.capsule).setScale(ART).setOrigin(0.5, 1);
    this.vehicle.add(this.capsule);
    this.scene.tweens.add({ targets: this.body, y: 500, alpha: 0, duration: 1800, ease: 'Quad.In' });
    this.scene.tweens.add({ targets: this.vehicle, y: this.vehicle.y + 200, duration: 1000, ease: 'Sine.Out' });
    this.flame.setY(-192).setScale(ART * 0.5);
    this.reachOrbit();
  }

  private reachOrbit(): void {
    this.scene.time.delayedCall(900, () => {
      this.climbing = false;
      this.altitude = 1;
      this.flame.setVisible(false);
      this.flash(t('maneuvers.orbit'));
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
      for (let i = 0; i < 10; i++) this.puff(VEHICLE_X + this.rng.between(-90, 90), GROUND - 4, tint, 1.8);
      this.flash(t(`maneuvers.${bannerKey}`));
    };
  }

  // --- Efectos ---

  private puff(x: number, y: number, tint: number, scale: number): void {
    const puff = this.add(this.scene.add.sprite(x, y, FlightTextures.smoke, 0).setScale(scale * ART).setTint(tint).setAlpha(0.9));
    puff.play('flight-smoke');
    this.scene.tweens.add({ targets: puff, x: x + this.rng.between(-40, 40), y: puff.y + (this.climbing ? 110 : -24), alpha: 0, duration: 1300, onComplete: () => puff.destroy() });
  }

  private flash(text: string): void {
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.scene.tweens.add({ targets: this.banner, scale: 1, duration: 300, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: this.banner, alpha: 0, delay: 1500, duration: 500 });
  }

  /** Cielo, estrellas, fondo y nave según la altura: el mundo baja (con paralaje) mientras la nave sube. */
  private applyAltitude(): void {
    const a = this.altitude;
    this.space.setAlpha(Phaser.Math.Clamp((a - 0.25) / 0.6, 0, 1));
    this.stars.setAlpha(Phaser.Math.Clamp((a - 0.45) / 0.4, 0, 1));
    this.groundLayer.setY(WORLD_Y + a * 760);
    this.far.setY(WORLD_Y + a * 420).setAlpha(Phaser.Math.Clamp((0.8 - a) / 0.3, 0, 1));
    this.clouds.setY(WORLD_Y + a * 600).setAlpha(Phaser.Math.Clamp((0.8 - a) / 0.3, 0, 1));
    if (this.look.startsOnGround) {
      if (!this.capsule || this.id !== 'ascent') this.vehicle.setY(WORLD_Y + GROUND - Math.min(1, a / 0.15) * 200);
    } else {
      this.vehicle.setY(WORLD_Y + Phaser.Math.Linear(GROUND - 34, 220, Math.min(1, a / 0.45)));
    }
    this.walkers.forEach((w) => w.setAlpha(a > 0.02 ? 0 : 1));
    this.speedLines.clear();
    const moving = this.climbing || (this.descending && a > this.descending.to + 0.01) || this.plasma.visible;
    if (!moving) return;
    const direction = this.climbing ? 1 : -1;
    for (let i = 0; i < 20; i++) {
      const x = (i * 97 + 31) % ART_VIEW.width;
      const y = ((((i * 53 + this.time * 520 * direction) % ART_VIEW.height) + ART_VIEW.height) % ART_VIEW.height);
      this.speedLines.fillStyle(0xffffff, 0.25).fillRect(x, y, 2, 30);
    }
  }
}

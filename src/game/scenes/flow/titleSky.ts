import Phaser from 'phaser';
import { Rng } from '../../../core/rng/Rng';
import { TitleTextures } from '../../assets';
import { buildPlanetLookup, renderPlanet, type PlanetLookup, type PlanetOptions } from './planetRender';

/** Píxeles de pantalla por píxel de arte (el arte del menú se dibuja chico y se amplía sin suavizar). */
const ART = 3;
/** Dirección hacia el Sol, igual para la Tierra y Marte: arriba a la derecha y un poco hacia la cámara. */
const SUN: PlanetOptions['light'] = [0.62, -0.42, 0.66];
/** La Tierra asoma desde la esquina inferior izquierda; Marte, el destino, arriba a la derecha. */
const EARTH = { x: 70, y: 860, radius: 110, glow: 4 } as const;
const MARS = { x: 1130, y: 118, radius: 22, glow: 2 } as const;
/** Ruta de la nave de la Tierra a Marte (curva de Bézier que rodea el menú por abajo y por la derecha). */
const ROUTE = [new Phaser.Math.Vector2(334, 638), new Phaser.Math.Vector2(640, 700), new Phaser.Math.Vector2(1010, 640), new Phaser.Math.Vector2(1085, 185)] as const;
/**
 * CubeSat OPSIS (proyecto de Facundo, referencia sutil): órbita baja, justo por encima de la atmósfera. Cruza el cielo
 * una sola vez por carga de la página, de un borde de la pantalla al otro. Su nombre es propio y no se traduce.
 */
const OPSIS = { name: 'OPSIS', radius: 356, periodSeconds: 20, hoverSlowdown: 0.2, from: -2.6, to: -0.35 } as const;
/** OPSIS cruza una sola vez por carga de la página (volver al menú no la repite). */
let opsisFlown = false;
/** Profundidades: todo el cielo va detrás de la interfaz (que queda en 0). */
const DEPTH = { stars: -60, asteroids: -50, meteors: -40, route: -35, ship: -30, planets: -20, iss: -10 } as const;
/** Cuadros por segundo con que se repintan los planetas (el giro avanza de a un píxel de arte). */
const PLANET_FPS = 20;

interface StarLayer {
  count: number;
  /** Deriva hacia la izquierda (px/s): las capas cercanas se mueven más rápido (paralaje). */
  speed: number;
  scale: number;
  frames: readonly number[];
}

const STAR_LAYERS: readonly StarLayer[] = [
  { count: 90, speed: 2, scale: 2, frames: [0] },
  { count: 40, speed: 5, scale: 2, frames: [0, 1] },
  { count: 14, speed: 9, scale: 2, frames: [1, 2, 3] },
];

/** Lee los píxeles de una textura cargada (los mapas de los planetas). */
function readPixels(scene: Phaser.Scene, key: string): { data: Uint8ClampedArray; width: number; height: number } | null {
  if (!scene.textures.exists(key)) return null;
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(source, 0, 0);
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}

/** Un planeta que gira: proyecta su mapa en un lienzo chico que la escena muestra ampliado. */
class SpinningPlanet {
  private readonly lookup: PlanetLookup;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly pixels: ImageData;
  private rotation = 0;
  private cloudRotation = 0;
  private sinceRender = Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly key: string,
    options: Omit<PlanetOptions, 'mapWidth' | 'mapHeight'>,
    private readonly surface: Uint8ClampedArray,
    mapSize: { width: number; height: number },
    private readonly speed: number,
    private readonly clouds: Uint8ClampedArray | null,
    private readonly cloudSpeed: number,
    x: number,
    y: number,
  ) {
    this.lookup = buildPlanetLookup({ ...options, mapWidth: mapSize.width, mapHeight: mapSize.height });
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.texture = scene.textures.createCanvas(key, this.lookup.size, this.lookup.size)!;
    this.pixels = this.texture.context.createImageData(this.lookup.size, this.lookup.size);
    scene.add.image(x, y, key).setScale(ART).setDepth(DEPTH.planets);
  }

  update(dtSeconds: number): void {
    this.rotation += this.speed * dtSeconds;
    this.cloudRotation += this.cloudSpeed * dtSeconds;
    this.sinceRender += dtSeconds;
    if (this.sinceRender < 1 / PLANET_FPS) return;
    this.sinceRender = 0;
    renderPlanet(this.pixels.data, this.lookup, this.surface, this.rotation, this.clouds, this.cloudRotation);
    this.texture.context.putImageData(this.pixels, 0, 0);
    this.texture.refresh();
  }

  destroy(): void {
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

/**
 * Cielo animado del menú principal: estrellas que titilan con paralaje, la Tierra y Marte girando con sus mapas
 * reales (NASA Blue Marble y Viking), la ISS y el CubeSat OPSIS en órbita, estrellas fugaces, asteroides lejanos y la
 * nave de la misión yendo de la Tierra a Marte. Todo va detrás de la interfaz. Pixel art: docs/pixel-art.md.
 */
export class TitleSky {
  private readonly rng = new Rng(Date.now());
  private readonly planets: SpinningPlanet[] = [];
  private readonly stars: { sprite: Phaser.GameObjects.Sprite; speed: number }[] = [];
  private readonly asteroids: Phaser.GameObjects.Sprite[] = [];
  private opsis: { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; angle: number; hovered: boolean } | null = null;
  private readonly width: number;
  private readonly height: number;

  constructor(private readonly scene: Phaser.Scene) {
    this.width = scene.scale.width;
    this.height = scene.scale.height;
    this.createAnimations();
    this.createStars();
    this.createAsteroids();
    this.createPlanets();
    this.createRoute();
    this.createIss();
    this.createOpsis();
    this.scheduleMeteor();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.planets.forEach((p) => p.destroy()));
  }

  update(dtSeconds: number): void {
    for (const planet of this.planets) planet.update(dtSeconds);
    for (const { sprite, speed } of this.stars) {
      sprite.x -= speed * dtSeconds;
      if (sprite.x < -10) sprite.x += this.width + 20;
    }
    for (const rock of this.asteroids) {
      rock.x -= (rock.getData('speed') as number) * dtSeconds;
      if (rock.x < -40) this.placeAsteroid(rock, this.width + 40);
    }
    this.moveOpsis(dtSeconds);
  }

  private has(key: string): boolean {
    return this.scene.textures.exists(key);
  }

  private createAnimations(): void {
    const { anims } = this.scene;
    const make = (key: string, texture: string, frameRate: number) => {
      if (!this.has(texture) || anims.exists(key)) return;
      anims.create({ key, frames: anims.generateFrameNumbers(texture), frameRate, repeat: -1 });
    };
    make('title-meteor-spin', TitleTextures.meteor, 12);
    make('title-asteroid-tumble', TitleTextures.asteroid, 4);
    make('title-ship-flame', TitleTextures.ship, 8);
  }

  // --- Estrellas ---

  private createStars(): void {
    if (!this.has(TitleTextures.stars)) return;
    const placement = new Rng(2024);
    for (const layer of STAR_LAYERS) {
      for (let i = 0; i < layer.count; i++) {
        const frame = layer.frames[Math.floor(placement.next() * layer.frames.length)]!;
        const sprite = this.scene.add
          .sprite(placement.between(0, this.width), placement.between(0, this.height), TitleTextures.stars, frame)
          .setScale(layer.scale)
          .setDepth(DEPTH.stars)
          .setAlpha(placement.between(0.45, 1));
        this.scene.tweens.add({
          targets: sprite,
          alpha: placement.between(0.15, 0.4),
          duration: placement.between(900, 2600),
          delay: placement.between(0, 2500),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
        this.stars.push({ sprite, speed: layer.speed });
      }
    }
  }

  // --- Asteroides lejanos ---

  private createAsteroids(): void {
    if (!this.has(TitleTextures.asteroid)) return;
    for (let i = 0; i < 3; i++) {
      const rock = this.scene.add.sprite(0, 0, TitleTextures.asteroid).setDepth(DEPTH.asteroids).setAlpha(0.8);
      rock.play({ key: 'title-asteroid-tumble', startFrame: i * 2 });
      this.placeAsteroid(rock, this.rng.between(0, this.width));
      this.asteroids.push(rock);
    }
  }

  private placeAsteroid(rock: Phaser.GameObjects.Sprite, x: number): void {
    const near = this.rng.chance(0.4);
    rock.setPosition(x, this.rng.between(150, 470)).setScale(near ? 2 : 1).setData('speed', this.rng.between(8, 18) * (near ? 1.6 : 1));
    rock.anims.timeScale = this.rng.between(0.6, 1.2);
  }

  // --- Planetas ---

  private createPlanets(): void {
    const earth = readPixels(this.scene, TitleTextures.earthMap);
    const clouds = readPixels(this.scene, TitleTextures.earthClouds);
    if (earth) {
      this.planets.push(
        new SpinningPlanet(
          this.scene,
          'title-earth-canvas',
          { radius: EARTH.radius, glow: EARTH.glow, tiltDeg: 23.4, light: SUN, atmosphere: [144, 205, 244] },
          earth.data,
          earth,
          // Una vuelta cada 2 minutos; las nubes van un poco más rápido que la superficie.
          earth.width / 120,
          clouds && clouds.width === earth.width ? clouds.data : null,
          earth.width / 100,
          EARTH.x,
          EARTH.y,
        ),
      );
    }
    const mars = readPixels(this.scene, TitleTextures.marsMap);
    if (mars) {
      this.planets.push(
        new SpinningPlanet(
          this.scene,
          'title-mars-canvas',
          { radius: MARS.radius, glow: MARS.glow, tiltDeg: 25.2, light: SUN, atmosphere: [251, 211, 141] },
          mars.data,
          mars,
          mars.width / 70,
          null,
          0,
          MARS.x,
          MARS.y,
        ),
      );
    }
  }

  // --- La nave de la misión, de la Tierra a Marte ---

  private createRoute(): void {
    const curve = new Phaser.Curves.CubicBezier(...ROUTE);
    const dots = this.scene.add.graphics().setDepth(DEPTH.route);
    for (const point of curve.getSpacedPoints(70).slice(1, -1)) {
      dots.fillStyle(0x90cdf4, 0.22).fillRect(Math.round(point.x) - 2, Math.round(point.y) - 2, 4, 4);
    }
    if (!this.has(TitleTextures.ship)) return;
    const ship = this.scene.add.sprite(ROUTE[0].x, ROUTE[0].y, TitleTextures.ship).setScale(2).setDepth(DEPTH.ship).setAlpha(0);
    ship.play('title-ship-flame');
    const travel = { t: 0 };
    this.scene.tweens.add({
      targets: travel,
      t: 1,
      duration: 22000,
      delay: 1500,
      repeat: -1,
      repeatDelay: 5000,
      ease: 'Sine.InOut',
      onUpdate: () => {
        const point = curve.getPoint(travel.t);
        const tangent = curve.getTangent(travel.t);
        ship.setPosition(point.x, point.y).setRotation(Math.atan2(tangent.y, tangent.x));
        // Aparece al salir de la órbita y se pierde al llegar a Marte.
        ship.setAlpha(Math.min(1, travel.t * 12, (1 - travel.t) * 10));
      },
    });
  }

  // --- La ISS en órbita sobre la Tierra ---

  private createIss(): void {
    if (!this.has(TitleTextures.iss)) return;
    const orbit = EARTH.radius * ART + 75;
    const iss = this.scene.add.sprite(-100, -100, TitleTextures.iss, 0).setScale(2).setDepth(DEPTH.iss);
    const pass = { angle: -200 };
    const fly = () => {
      pass.angle = -200;
      this.scene.tweens.add({
        targets: pass,
        angle: 15,
        duration: 16000,
        onUpdate: () => {
          const a = Phaser.Math.DegToRad(pass.angle);
          iss.setPosition(EARTH.x + orbit * Math.cos(a), EARTH.y + orbit * Math.sin(a)).setRotation(a + Math.PI / 2);
          // Destello del Sol en los paneles de vez en cuando.
          iss.setFrame(Math.sin(pass.angle / 6) > 0.92 ? 1 : 0);
        },
        onComplete: () => this.scene.time.delayedCall(this.rng.between(6000, 12000), fly),
      });
    };
    this.scene.time.delayedCall(2500, fly);
  }

  // --- CubeSat OPSIS ---

  private createOpsis(): void {
    if (opsisFlown || !this.has(TitleTextures.opsis)) return;
    opsisFlown = true;
    const sprite = this.scene.add.sprite(-50, -50, TitleTextures.opsis, 0).setScale(2).setVisible(false);
    // Zona para el mouse más grande que el dibujo (13 × 9 px de arte): si no, es casi imposible acertarle.
    sprite.setInteractive(new Phaser.Geom.Rectangle(-6, -8, 25, 25), Phaser.Geom.Rectangle.Contains);
    const label = this.scene.add
      .text(0, 0, OPSIS.name, { fontFamily: 'monospace', fontSize: '11px', color: '#90cdf4', backgroundColor: '#05070dcc', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.iss + 1)
      .setVisible(false);
    const opsis = { sprite, label, angle: OPSIS.from, hovered: false };
    // Se mueve sola: el mouse quieto también tiene que "encontrarla" al pasar.
    this.scene.input.setPollAlways();
    sprite.on('pointerover', () => (opsis.hovered = true));
    sprite.on('pointerout', () => (opsis.hovered = false));
    this.scene.time.addEvent({ delay: 700, loop: true, callback: () => sprite.setFrame(sprite.frame.name === '0' ? 1 : 0) });
    // Aparece un rato después de abrir el menú, para que no se pierda entre las animaciones de entrada.
    this.scene.time.delayedCall(6000, () => {
      this.opsis = opsis;
      sprite.setVisible(true);
      this.moveOpsis(0);
    });
  }

  private moveOpsis(dtSeconds: number): void {
    const opsis = this.opsis;
    if (!opsis) return;
    const { sprite, label } = opsis;
    opsis.angle += ((2 * Math.PI) / OPSIS.periodSeconds) * dtSeconds * (opsis.hovered ? OPSIS.hoverSlowdown : 1);
    if (opsis.angle > OPSIS.to) {
      // Terminó su pasada: no vuelve hasta recargar la página.
      sprite.destroy();
      label.destroy();
      this.opsis = null;
      return;
    }
    const x = EARTH.x + OPSIS.radius * Math.cos(opsis.angle);
    const y = EARTH.y + OPSIS.radius * Math.sin(opsis.angle);
    sprite.setPosition(x, y).setDepth(DEPTH.iss - 1);
    label.setPosition(x, y - 12).setVisible(opsis.hovered);
  }

  // --- Estrellas fugaces y meteoritos ---

  private scheduleMeteor(): void {
    this.scene.time.delayedCall(this.rng.between(1200, 4500), () => {
      this.launchMeteor();
      this.scheduleMeteor();
    });
  }

  private launchMeteor(): void {
    if (!this.has(TitleTextures.meteor)) return;
    const big = this.rng.chance(0.2);
    const angle = Phaser.Math.DegToRad(this.rng.between(148, 165));
    const speed = big ? this.rng.between(260, 340) : this.rng.between(420, 640);
    const life = big ? 2600 : 1500;
    const scale = big ? 3 : 2;
    const x = this.rng.between(420, this.width + 60);
    const y = this.rng.between(-30, 170);
    const dx = Math.cos(angle) * speed * (life / 1000);
    const dy = Math.sin(angle) * speed * (life / 1000);

    const parts: Phaser.GameObjects.GameObject[] = [];
    const trail = this.has(TitleTextures.meteorTrail)
      ? this.scene.add
          .image(x, y, TitleTextures.meteorTrail)
          .setOrigin(0, 0.5)
          .setScale(scale)
          .setRotation(angle + Math.PI)
          .setDepth(DEPTH.meteors)
          .setBlendMode(Phaser.BlendModes.ADD)
      : null;
    const head = this.scene.add.sprite(x, y, TitleTextures.meteor).setScale(scale).setDepth(DEPTH.meteors);
    head.play('title-meteor-spin');
    parts.push(head);
    if (trail) parts.push(trail);
    this.scene.tweens.add({ targets: parts, x: `+=${dx}`, y: `+=${dy}`, duration: life, onComplete: () => parts.forEach((p) => p.destroy()) });
    this.scene.tweens.add({ targets: parts, alpha: 0, delay: life * 0.65, duration: life * 0.35 });
  }
}

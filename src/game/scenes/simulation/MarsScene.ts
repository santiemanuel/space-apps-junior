import { GALE_LANDMARKS, GALE_MAP, GALE_TERRAIN, MARS_CONTENT } from '../../../content/gale';
import { INCIDENTS } from '../../../content/incidents';
import { earthMarsDelaySeconds } from '../../../core/environment/orbits';
import { EXTERIOR, exteriorDoorPoint, zoneAt, type Point } from '../../../core/habitat/layout';
import type { SystemId } from '../../../core/systems/types';
import { MarsSession } from '../../../core/mars/MarsSession';
import { Rng } from '../../../core/rng/Rng';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { EARTH_ORBIT, MARS_ORBIT } from '../../../data/planets';
import { seriesFor } from '../../../data/realData';
import { galeWeatherOn } from '../../../data/series';
import { t } from '../../../i18n';
import { TILE } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import Phaser from 'phaser';
import type { PhaseSceneData } from '../sceneData';
import type { HabitatFxOptions, PxRect, Walker } from './HabitatFx';
import { MarsWeatherFx } from './MarsWeatherFx';
import { skyLight, type SkyLight } from './marsSky';
import { SimulationMapScene, toPx, tr } from './SimulationMapScene';
import { depthAt, MapDepth, type MapAssets, type MapView } from './TiledMapView';

/** Paisaje de Gale que se ve por los ventanales de la base (`art/prompts/vista-marte.txt`). */
const VISTA = 'mars-vista';

/**
 * Estancia en el cráter Gale (game-design §4.4): la base, la esclusa y el exterior con los puntos de muestreo.
 * Curiosity, el vecino robot, reporta el clima real del día. Reglas en `MarsSession`.
 */
export class MarsScene extends SimulationMapScene<MarsSession> {
  constructor() {
    super(SceneKeys.Mars, 'mars');
  }

  protected createSession({ state, bus }: PhaseSceneData) {
    const content = MARS_CONTENT;
    const window = content.calendar.windows.mars;
    const session = new MarsSession({
      state,
      bus,
      content,
      timeline: incidentTimeline('mars', window, INCIDENTS, content.incidentRules),
      doseRate: (date) => seriesFor('mars', date).dose,
      weather: galeWeatherOn,
      signalDelaySeconds: (date) => earthMarsDelaySeconds(EARTH_ORBIT, MARS_ORBIT, date),
    });
    return { session, content };
  }

  private curiosityBubble!: Phaser.GameObjects.Text;
  private bubbleDay = '';
  /** Franja del exterior donde está el jugador y las que ya visitó (al entrar a una nueva se cuenta qué es). */
  private strip: string | null = null;
  private visited = new Set<string>();
  private sampleSprites = new Map<string, Phaser.GameObjects.Image>();
  private samplesTaken = 0;
  private weather: MarsWeatherFx | null = null;
  private interior: PxRect | null = null;
  /** Zona del jugador en el cuadro anterior: al cruzar la puerta exterior de la esclusa la vista hace un fundido. */
  private lastZone: string | null = null;
  /** Próxima ráfaga que sacude la cámara en el pico de la tormenta (ms de la escena). */
  private nextGust = 0;
  private readonly gustRng = new Rng(0x6057);
  /** Lo que se ve por los ventanales de la base: el paisaje de Gale, teñido con la luz del cielo. */
  private vistas: Phaser.GameObjects.Image[] = [];

  preload(): void {
    super.preload();
    this.load.image(VISTA, 'assets/mars/vista.png');
  }

  /**
   * Por cada ventana con vidrio, el paisaje de Gale detrás (mesas en el horizonte, como en la referencia del
   * invernadero), recortado al vidrio y corrido según dónde está la ventana para que no se vean todas iguales.
   */
  protected mapCreated(view: MapView): void {
    const source = this.textures.get(VISTA).getSourceImage();
    this.vistas = view.decor.flatMap((w) => {
      if (!w.glass) return [];
      const g = w.glass;
      const left = w.x - w.image.width / 2 + g.x;
      const top = w.bottom - w.image.height + g.y;
      const spareX = Math.max(0, source.width - g.w);
      const cropX = Math.round(((left * 0.37) % (spareX + 1)) / 2) * 2;
      const cropY = Math.round((Math.max(0, source.height - g.h) * 0.55) / 2) * 2;
      const image = this.add.image(left - cropX, top - cropY, VISTA).setOrigin(0, 0).setCrop(cropX, cropY, g.w, g.h).setDepth(MapDepth.behindDecor).setVertexRoundMode('full');
      return [image];
    });
  }

  protected mapAssets(): MapAssets {
    // Tileset: la base (los tiles de la nave en versión cálida) y el suelo de Gale; atlas: los objetos de la nave y
    // los de Marte (public/assets/mars/README.md).
    return {
      key: 'gale',
      map: GALE_MAP,
      tilesetName: 'gale-tiles',
      tilesUrl: 'assets/mars/tiles.png',
      propsUrl: 'assets/mars/props.png',
      propsAtlasUrl: 'assets/mars/props.json',
      doorPanels: { left: 18, right: 22 },
      lightTiles: [11],
      // Bordes en los techos de la base y en los de los cerros, las crestas de duna y el monte Sharp, con colores de
      // la paleta cálida.
      rimTiles: [12, 13, 36, 39, 41],
      rimColors: { outline: 0x2a1a14, light: 0xb07a52 },
      // Bordes biselados de los cuartos, en la paleta cálida de la base.
      bevel: { caps: [12, 13, 14, 15], faces: [8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23], colors: { outline: 0x2a1a14, light: 0xead2b8, base: 0xc09a7e, shadow: 0x86634f } },
      normals: true,
    };
  }

  protected stationProps(): Partial<Record<SystemId, string>> {
    return { scrubber: 'scrubber', moxie: 'moxie', radio: 'radio' };
  }

  /** `&at=<franja>|curiosity`: el jugador arranca afuera, en la franja o junto a Curiosity. */
  protected startPoint(): Point | null {
    const at = this.view.at;
    if (!at) return null;
    if (at === 'curiosity') return { x: GALE_LANDMARKS.curiosity!.x - 1.5, y: GALE_LANDMARKS.curiosity!.y + 1 };
    const strip = GALE_TERRAIN.find((s) => s.id === at);
    const ext = this.layout.exterior;
    if (!strip || !ext) return null;
    // El tile transitable de la franja más cerca de su centro, debajo de la puerta de la esclusa.
    const door = exteriorDoorPoint(ext);
    const target = { x: door.x, y: strip.rect.row + strip.rect.rows / 2 };
    let best: Point | null = null;
    for (let row = strip.rect.row; row < strip.rect.row + strip.rect.rows; row++)
      for (let col = 0; col < this.layout.cols; col++) {
        const p = { x: col + 0.5, y: row + 0.5 };
        if (zoneAt(this.layout, p) !== EXTERIOR) continue;
        if (!best || Math.hypot(p.x - target.x, p.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y)) best = p;
      }
    return best;
  }

  create(): void {
    this.strip = null;
    this.visited = new Set();
    this.weather = null;
    this.lastZone = null;
    super.create();
    // Curiosity, el vecino robot (§4.4, §5.3): estacionado en el canal Gediz Vallis, donde estaba de verdad en mayo
    // de 2024 (src/content/galeTerrain.ts). El sprite (con polvo: está ahí desde 2012) es un objeto del mapa; acá van
    // su nombre y el globo con el dato real del día.
    const { x, y } = toPx(GALE_LANDMARKS.curiosity!);
    this.add.text(x, y + 26, 'Curiosity', { fontFamily: 'monospace', fontSize: '11px', color: '#fbd38d' }).setOrigin(0.5, 0).setDepth(MapDepth.darkness + 2).setResolution(2);
    this.curiosityBubble = this.add
      .text(x, y - 84, '', { fontFamily: 'monospace', fontSize: '11px', color: '#1a202c', backgroundColor: '#fefcbf', padding: { x: 4, y: 2 }, wordWrap: { width: 220 } })
      .setOrigin(0.5, 1)
      .setDepth(MapDepth.darkness + 2)
      .setResolution(2);
    // Cada muestra es una roca de su tipo (el de la franja donde está).
    this.samplesTaken = this.session.state.inventory.samples.length;
    this.sampleSprites = new Map(
      this.session.sites.map((site) => {
        const p = toPx(site);
        const image = this.add.image(p.x, p.y + 10, this.mapView!.propsKey, `sample-${site.rock}`).setOrigin(0.5, 1).setDepth(depthAt(p.y + 10)).setVertexRoundMode('full');
        if (this.mapView!.lit) image.setLighting(true);
        return [site.id, image];
      }),
    );
    // Cartel con el nombre de cada franja del exterior, en el borde norte, debajo de la esclusa.
    const door = exteriorDoorPoint(this.layout.exterior!);
    for (const strip of GALE_TERRAIN.slice(1)) {
      this.add
        .text((door.x + 3) * TILE, strip.rect.row * TILE + 6, tr(`mars.terrain.${strip.id}.name`), { fontFamily: 'monospace', fontSize: '11px', color: '#fefcbf', backgroundColor: '#1a202caa', padding: { x: 4, y: 2 } })
        .setDepth(MapDepth.darkness + 2)
        .setResolution(2);
    }
  }

  /**
   * La base con sus paredes (px): una alrededor de los cuartos y, arriba, el techo y el frente de la pared. En un
   * corte de energía se oscurece sólo esto; afuera sigue la luz del cielo.
   */
  protected fxOutdoor(view: MapView): Pick<HabitatFxOptions, 'interior' | 'beacons'> {
    const rects = [...this.layout.zones.map((z) => z.rect), this.layout.corridor];
    const left = Math.min(...rects.map((r) => r.col)) - 1;
    const right = Math.max(...rects.map((r) => r.col + r.cols));
    const top = Math.min(...rects.map((r) => r.row)) - 2;
    const bottom = Math.max(...rects.map((r) => r.row + r.rows));
    this.interior = { x: left * TILE, y: top * TILE, w: (right - left + 1) * TILE, h: (bottom - top + 1) * TILE };
    return {
      interior: this.interior,
      beacons: view.props.filter((p) => p.key === 'beacon').map((p) => ({ x: p.x, y: p.bottom - p.image.height + 6 })),
    };
  }

  protected minimapMarks(): Point[] {
    return this.session.remainingSites().map(({ site }) => site);
  }

  /** Cielo de ahora, con la tormenta forzada de `&fx=storm`. */
  private get marsSky() {
    const sky = this.session.sky;
    return this.view.fx?.storm ? { ...sky, storm: true } : sky;
  }

  protected renderWeather(walkers: readonly Walker[], activeZone: string | null, time: number, dt: number): void {
    if (!this.interior) return;
    this.weather ??= new MarsWeatherFx(this, this.interior, this.session.state.seed);
    const sky = this.marsSky;
    const outside = activeZone === EXTERIOR;
    this.weather.update({ sky, outside, walkers }, time, dt);
    // Fundido corto al pasar por la puerta exterior de la esclusa, como al bajar el visor del casco.
    const crossed = (this.lastZone === 'airlock' && outside) || (this.lastZone === EXTERIOR && activeZone === 'airlock');
    if (crossed && this.lastZone !== null) {
      const cam = this.cameras.main;
      cam.fadeOut(110, 10, 8, 16);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => cam.fadeIn(260, 10, 8, 16));
    }
    if (activeZone) this.lastZone = activeZone;
    // En el pico de la tormenta, afuera, cada tanto una ráfaga sacude un poco la vista.
    if (sky.storm && outside && time >= this.nextGust) {
      if (this.nextGust > 0) this.cameras.main.shake(500, 0.0025);
      this.nextGust = time + this.gustRng.between(5000, 11000);
    }
  }

  /** Día, noche y tormenta: la luz ambiente del exterior sale del Sol, del polvo real del día y de la tormenta. */
  protected sky(): SkyLight {
    return skyLight(this.marsSky);
  }

  protected outcomeKey(outcome: 'completed' | 'suspended'): string {
    return outcome === 'completed' ? 'mars.outcome.completed' : 'mars.outcome.suspended';
  }

  protected outerDoorClosed(): boolean {
    return !this.session.evaOpen;
  }

  protected renderPlace(): void {
    const s = this.session;
    const { ambient } = skyLight(this.marsSky);
    for (const vista of this.vistas) vista.setTint(ambient);
    if (this.bubbleDay !== s.simDate.slice(0, 10)) {
      this.bubbleDay = s.simDate.slice(0, 10);
      const w = s.weather;
      this.curiosityBubble.setText(t('mars.curiosity.bubble', { min: Math.round(w.minTempC), sky: tr(`mars.uv.${w.uv ?? 'none'}`) }));
    }
    // Al juntar una muestra, un aviso cuenta qué roca es.
    const taken = s.state.inventory.samples;
    if (taken.length > this.samplesTaken) {
      const rock = taken.at(-1)?.rock;
      if (rock) this.showToast(t('mars.rock.collected', { name: tr(`mars.rock.${rock}.name`), fact: tr(`mars.rock.${rock}.fact`) }));
    }
    this.samplesTaken = taken.length;
    const remaining = s.remainingSites();
    for (const [id, image] of this.sampleSprites) image.setVisible(remaining.some((r) => r.site.id === id));
    for (const { site, progress } of remaining) {
      // Anillo a los pies de la roca; el arco azul es lo que lleva juntado el jugador.
      const p = toPx(site);
      this.markers.lineStyle(2, 0xfefcbf, 0.8).strokeEllipse(p.x, p.y + 8, 52, 20);
      if (progress > 0) this.markers.lineStyle(3, 0x63b3ed, 1).beginPath().arc(p.x, p.y + 8, 30, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
    }
  }

  protected placePrompt(position: Point, zone: string | null): string | null {
    const s = this.session;
    if (zone === 'airlock' && !s.evaOpen) return t(s.daylight ? 'mars.task.doorStorm' : 'mars.task.doorNight');
    if (zone !== EXTERIOR) return null;
    this.enterStrip(position);
    const site = s.siteAt(position);
    if (!site) return '';
    return s.manual ? t('mars.task.sample', { kg: site.massKg, value: site.value }) : t('hud.task.fastForward');
  }

  /** Al entrar por primera vez a una franja del exterior, un aviso cuenta qué enseña ese terreno. */
  private enterStrip(position: Point): void {
    const strip = GALE_TERRAIN.find((t) => position.y >= t.rect.row && position.y < t.rect.row + t.rect.rows)?.id ?? null;
    if (strip === this.strip) return;
    this.strip = strip;
    if (!strip || this.visited.has(strip)) return;
    this.visited.add(strip);
    this.showToast(`${tr(`mars.terrain.${strip}.name`)}: ${tr(`mars.terrain.${strip}.fact`)}`);
  }
}

import { GALE_CABLES, GALE_LANDMARKS, GALE_MAP, GALE_TERRAIN, MARS_CONTENT } from '../../../content/gale';
import { INCIDENTS } from '../../../content/incidents';
import { earthMarsDelaySeconds } from '../../../core/environment/orbits';
import { baseFootprint, doorPoint, EXTERIOR, exteriorDoorPoint, zoneAt, zoneById, type Point } from '../../../core/habitat/layout';
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
import { audio } from '../../audio/audio';
import { PLANT_ROCK } from '../../../core/mars/MarsSession';
import type { ZoneMinigame } from '../../../core/habitat/HabitatSession';

/** Paisaje de Gale que se ve por los ventanales de la base (`art/prompts/vista-marte.txt`). */
const VISTA = 'mars-vista';
/** Colores de la red eléctrica: el verde del plano, el amarillo de las cajas de empalme y el rojo de un corte. */
const CABLE = { outline: 0x1a2a12, wire: 0x5fbf3a, light: 0x9be36b, box: 0xf2d24b, cut: 0xfc8181 } as const;

/**
 * Estancia en el cráter Gale (game-design §4.4): la base, la esclusa y el exterior con los puntos de muestreo.
 * Curiosity, el vecino robot, reporta el clima real del día. Reglas en `MarsSession`.
 */
/** Distancia (tiles) desde la que se oyen los motores de Curiosity. */
const ROVER_REACH = 7;

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
  private interior: PxRect[] | null = null;
  /** Muestras guardadas en el depósito en el cuadro anterior (para avisar al dejar más). */
  private stored = 0;
  /** Ya se avisó que empezó el embarque. */
  private departureShown = false;
  /** Zona del jugador en el cuadro anterior: al cruzar la puerta exterior de la esclusa la vista hace un fundido. */
  private lastZone: string | null = null;
  /** Lo juntado de cada roca en el cuadro anterior (si sube, se está juntando). */
  private sampleProgress = new Map<string, number>();
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
    this.drawGrid();
    this.drawShip();
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
      sideDoors: true,
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
    this.leaveKey = this.input.keyboard?.addKey('F') ?? null;
    this.leaveConfirmUntil = 0;
    this.strip = null;
    this.visited = new Set();
    this.weather = null;
    this.lastZone = null;
    this.departureShown = false;
    super.create();
    this.stored = this.session.sampleStorage.stored;
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
   * La base con sus paredes (px), en tramos de una fila que no se superponen: los módulos, los tubos y los módulos
   * sueltos de afuera. En un corte de energía se oscurece sólo esto; afuera sigue la luz del cielo.
   */
  protected fxOutdoor(view: MapView): Pick<HabitatFxOptions, 'interior' | 'beacons'> {
    const base = baseFootprint(this.layout);
    const { cols, rows } = this.layout;
    this.interior = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        if (!base[row * cols + col] || (col > 0 && base[row * cols + col - 1])) continue;
        let end = col;
        while (end + 1 < cols && base[row * cols + end + 1]) end++;
        this.interior.push({ x: col * TILE, y: row * TILE, w: (end - col + 1) * TILE, h: TILE });
      }
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
    // Curiosity: sus motores se oyen al acercarse (a menos de ROVER_REACH tiles).
    const rover = GALE_LANDMARKS.curiosity!;
    const player = walkers.find((w) => w.active);
    const near = player ? Math.hypot(player.x / TILE - rover.x, player.y / TILE - rover.y) : Infinity;
    audio.loop('rover', near < ROVER_REACH ? 'rover' : null, 0.55 * (1 - near / ROVER_REACH));
    // Tormenta de polvo: el viento se oye fuerte afuera y apagado desde adentro.
    audio.loop('weather', this.marsSky.storm ? 'dustStorm' : null, outside ? 0.75 : 0.3);
    this.weather.update({ sky, outside, walkers }, time, dt);
    // Fundido corto al pasar por la puerta exterior de la esclusa, como al bajar el visor del casco.
    const crossed = (this.lastZone === 'airlock' && outside) || (this.lastZone === EXTERIOR && activeZone === 'airlock');
    if (crossed && this.lastZone !== null) {
      audio.sfx(outside ? 'airlockOut' : 'airlockIn', 1, 0.8);
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
    this.renderGrid();
    if (s.departing && !this.departureShown) {
      this.departureShown = true;
      this.showToast(t('mars.departure.start'));
    }
    const { stored } = s.sampleStorage;
    if (stored > this.stored) this.showToast(t('mars.samples.stored', { count: stored - this.stored }));
    this.stored = stored;
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
      if (rock === PLANT_ROCK) this.showToast(t('mars.plant.collected'));
      else if (rock) this.showToast(t('mars.rock.collected', { name: tr(`mars.rock.${rock}.name`), fact: tr(`mars.rock.${rock}.fact`) }));
      audio.sfx('scan');
    }
    // Con todas las rocas, F (dos veces) empieza el embarque sin esperar al último sol.
    if (this.leaveKey && Phaser.Input.Keyboard.JustDown(this.leaveKey) && s.canLeaveEarly) {
      if (this.time.now < this.leaveConfirmUntil && s.leaveEarly()) {
        audio.sfx('departureScheduled');
        this.showToast(t('mars.leave.started'));
      } else {
        this.leaveConfirmUntil = this.time.now + 4000;
        this.showToast(t('mars.leave.confirm'));
      }
    }
    this.samplesTaken = taken.length;
    const remaining = s.remainingSites();
    // Mientras se junta una muestra suena el taladro (la pala en la planta).
    const digging = remaining.find((r) => r.progress > (this.sampleProgress.get(r.site.id) ?? 0));
    audio.loop('drill', digging ? (digging.site.rock === PLANT_ROCK ? 'shovel' : 'drill') : null, 0.6);
    this.sampleProgress = new Map(remaining.map((r) => [r.site.id, r.progress]));
    for (const [id, image] of this.sampleSprites) image.setVisible(remaining.some((r) => r.site.id === id));
    for (const { site, progress } of remaining) {
      // Anillo a los pies de la roca; el arco azul es lo que lleva juntado el jugador.
      const p = toPx(site);
      this.markers.lineStyle(2, 0xfefcbf, 0.8).strokeEllipse(p.x, p.y + 8, 52, 20);
      if (progress > 0) this.markers.lineStyle(3, 0x63b3ed, 1).beginPath().arc(p.x, p.y + 8, 30, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
    }
  }

  protected minigameReward(m: ZoneMinigame): string | null {
    if (m.id !== 'harvest') return null;
    return t(this.session.plantSamplesLeft ? 'hud.minigame.reward.harvest' : 'hud.minigame.reward.harvestFood');
  }

  /** F: empezar la vuelta a casa cuando ya están todas las rocas (hay que apretarla dos veces). */
  private leaveKey: Phaser.Input.Keyboard.Key | null = null;
  private leaveConfirmUntil = 0;

  protected placePrompt(position: Point, zone: string | null): string | null {
    const s = this.session;
    if (zone === 'airlock' && !s.evaOpen) return t(s.daylight ? 'mars.task.doorStorm' : 'mars.task.doorNight');
    const departing = s.departing;
    if (departing) return this.departurePrompt(zone, departing);
    // Junto a un tubo roto sin reparación elegida: hay que dar la vuelta (o elegir repararlo).
    const task = s.taskAt(zone, position);
    if (!task && s.closedPassages().size > 0 && this.nearClosedDoor(position)) return t('mars.task.tubeClosed');
    if (zone === 'energy' && (!task || (task.kind === 'task' && task.upToDate))) return t('mars.task.panel');
    if (zone === 'battery') return t('mars.task.batteryRoom', { kwh: Math.round(s.state.meters.energy.batteryKwh) });
    if (zone !== EXTERIOR) return null;
    this.enterStrip(position);
    if (task) return null;
    const site = s.siteAt(position);
    if (!site) return '';
    return s.manual ? t('mars.task.sample', { kg: site.massKg, value: site.value }) : t('hud.task.fastForward');
  }

  /** Qué hacer en el embarque: buscar la carga en el depósito, llevarla a la nave o esperar a los demás. */
  private departurePrompt(zone: string | null, d: NonNullable<MarsSession['departing']>): string {
    const action = this.session.actionAt(zone);
    if (action) return t(action === 'loadCargo' ? 'mars.task.loadCargo' : 'mars.task.stowCargo');
    if (d.cargo === 'stored') return t(zone === 'ship' ? 'mars.task.cargoFirst' : 'mars.task.goStorage');
    if (d.cargo === 'carried') return t('mars.task.goShip');
    return t('mars.task.boardWait', { aboard: d.aboard, total: d.total });
  }

  /** El jugador está junto a la puerta de un tubo roto. */
  private nearClosedDoor(p: Point): boolean {
    const closed = this.session.closedPassages();
    return this.layout.passages.some(
      (tube) => closed.has(tube.id) && (tube.doorTiles ?? []).some((d) => Math.hypot(d.col + 0.5 - p.x, d.row + 0.5 - p.y) <= MARS_CONTENT.grid.repairReach),
    );
  }

  /**
   * Red eléctrica en el suelo (verde, como en el plano): cada cable con su contorno oscuro y una línea de luz, y las
   * cajas de empalme en amarillo con un rayo. Va debajo de las paredes: los cables entran a los módulos.
   */
  private drawGrid(): void {
    const g = this.add.graphics().setDepth(MapDepth.floorDecal);
    const even = (v: number) => Math.round(v / 2) * 2;
    for (const cable of GALE_CABLES) {
      const pts = cable.points.map((p) => ({ x: even(p.x * TILE), y: even(p.y * TILE) }));
      for (const [width, color] of [[10, CABLE.outline], [6, CABLE.wire], [2, CABLE.light]] as const) {
        g.lineStyle(width, color, 1).beginPath().moveTo(pts[0]!.x, pts[0]!.y);
        for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
        g.strokePath();
      }
    }
    for (const id of ['j1', 'j2']) {
      const { x, y } = toPx(GALE_LANDMARKS[id]!);
      const [bx, by] = [even(x - 14), even(y - 14)];
      g.fillStyle(CABLE.outline).fillRect(bx - 2, by - 2, 32, 32).fillStyle(CABLE.box).fillRect(bx, by, 28, 28).fillStyle(0xfff3a0).fillRect(bx, by, 28, 4);
      // Rayo de 2 px: zigzag de arriba a la derecha hacia abajo a la izquierda.
      g.fillStyle(CABLE.outline);
      for (const [dx, dy] of [[16, 4], [14, 6], [12, 8], [10, 10], [10, 12], [12, 12], [14, 12], [16, 12], [14, 14], [12, 16], [10, 18], [8, 20], [6, 22]]) g.fillRect(bx + dx!, by + dy!, 4, 2);
    }
  }

  /**
   * La nave estacionada (abajo a la izquierda, como en el plano): dos motores detrás de la cabina y patas de
   * aterrizaje. La cabina es el cuarto `ship` del mapa; esto la hace parecer una nave desde afuera.
   */
  private drawShip(): void {
    const { rect } = zoneById(this.layout, 'ship');
    const left = (rect.col - 1) * TILE;
    const top = (rect.row - 2) * TILE;
    const bottom = (rect.row + rect.rows + 1) * TILE;
    const g = this.add.graphics().setDepth(depthAt(bottom - 4));
    for (const y of [top + 30, bottom - 58]) {
      // Motor: cuerpo gris con contorno, tobera hacia atrás y un brillo naranja apagado.
      g.fillStyle(0x1a1420).fillRect(left - 62, y - 2, 66, 32);
      g.fillStyle(0x8d8aa0).fillRect(left - 60, y, 62, 28).fillStyle(0xb8b5c8).fillRect(left - 60, y, 62, 6).fillStyle(0x5d5a70).fillRect(left - 60, y + 22, 62, 6);
      g.fillStyle(0x1a1420).fillRect(left - 74, y + 4, 14, 20).fillStyle(0x3a3448).fillRect(left - 72, y + 6, 10, 16).fillStyle(0xd9792b).fillRect(left - 70, y + 10, 4, 8);
    }
    // Patas de aterrizaje debajo de la cabina.
    for (const x of [left + TILE * 2, left + TILE * (rect.cols - 1)]) g.fillStyle(0x1a1420).fillRect(x - 2, bottom - 8, 8, 14).fillStyle(0x8d8aa0).fillRect(x, bottom - 6, 4, 10).fillStyle(0x1a1420).fillRect(x - 8, bottom + 4, 20, 6);
  }

  /** Cables cortados (rojo que titila con chispas en el corte) y la carga de la batería sobre su puerta. */
  private renderGrid(): void {
    const s = this.session;
    const grid = s.grid;
    const g = this.markers;
    const blink = Math.floor(this.time.now / 250) % 2 === 0;
    for (const id of grid.cutCables) {
      const cable = MARS_CONTENT.grid.cables.find((c) => c.id === id);
      const path = GALE_CABLES.find((c) => c.id === id);
      if (!cable || !path) continue;
      g.lineStyle(4, CABLE.cut, blink ? 0.9 : 0.4).beginPath().moveTo(path.points[0]!.x * TILE, path.points[0]!.y * TILE);
      for (const p of path.points.slice(1)) g.lineTo(p.x * TILE, p.y * TILE);
      g.strokePath();
      const at = toPx(cable.at);
      g.lineStyle(3, 0xfefcbf, 0.9).strokeCircle(at.x, at.y, 16 + (blink ? 4 : 0));
      for (let k = 0; k < 5; k++) {
        const a = (this.time.now / 90 + k * 1.7) % (Math.PI * 2);
        g.fillStyle(0xfff3a0, 0.9).fillRect(Math.round(at.x + Math.cos(a) * 12), Math.round(at.y + Math.sin(a) * 8 - 6), 4, 4);
      }
    }
    // Barra de carga de la batería, sobre la puerta de su módulo: en rojo si no llega a la base.
    const door = toPx(doorPoint(zoneById(this.layout, 'battery')));
    const { batteryKwh, capacityKwh } = s.state.meters.energy;
    const k = capacityKwh > 0 ? batteryKwh / capacityKwh : 0;
    const [bx, by] = [Math.round(door.x - 40), Math.round(door.y + 30)];
    g.fillStyle(0x1a1420, 0.9).fillRect(bx - 2, by - 2, 84, 14).fillStyle(0x2d3748).fillRect(bx, by, 80, 10);
    g.fillStyle(k < 0.25 ? CABLE.cut : CABLE.wire).fillRect(bx, by, Math.round(80 * k), 10);
    if (!grid.batteryLinked) g.lineStyle(2, CABLE.cut, blink ? 1 : 0.4).strokeRect(bx - 3, by - 3, 86, 16);
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

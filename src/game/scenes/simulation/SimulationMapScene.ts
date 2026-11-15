import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { INCIDENTS } from '../../../content/incidents';
import { moveSpeedFactor } from '../../../core/crew/efficiency';
import type { CrewId, CrewMemberState } from '../../../core/crew/types';
import { EventBus } from '../../../core/events/EventBus';
import type { SimulationEvents } from '../../../core/habitat/events';
import type { HabitatSession } from '../../../core/habitat/HabitatSession';
import { doorPoint, EXTERIOR, zoneAt, zoneById, zoneSpot, type Point, type ShipLayout } from '../../../core/habitat/layout';
import type { HabitatContent } from '../../../core/habitat/types';
import { definitionOf } from '../../../core/incidents/planner';
import type { SystemId, SystemStatus } from '../../../core/systems/types';
import { t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { GAME_HEIGHT, TILE } from '../../display';
import { createCrewSprite, type CrewSprite } from '../../entities/CrewSprite';
import { bindCrewSwitch } from '../../input/crewSwitch';
import { createKeyboardControls, type PlayerControls } from '../../input/PlayerControls';
import { SceneKeys, type SceneKey } from '../../sceneKeys';
import type { PhaseSceneData } from '../sceneData';
import { TOAST_Y, VIEW_WIDTH } from './HudScene';
import { toggleOverlay, type MapViewData, type MapViewOptions, type SimulationSceneData } from './simulationData';
import { HabitatFx, type HabitatFxOptions, type Walker } from './HabitatFx';
import { MapLife } from './MapLife';
import { MINIMAP_FRAME, type MinimapFrame } from './Minimap';
import { HUD_ICONS, preloadHudIcons } from '../../hudIcons';
import type { SkyLight } from './marsSky';
import { createMap, preloadMap, type MapAssets, type MapView, type Solid } from './TiledMapView';

/** Escenas superpuestas que se abren con una tecla desde el mapa. */
const OVERLAY_KEYS: readonly [string, SceneKey][] = [
  ['P', SceneKeys.Planning],
  ['C', SceneKeys.MissionControl],
  ['G', SceneKeys.DataPanel],
];
const PLAYER_SPEED = 210;
/** Zoom de la cámara del mapa: cada píxel de arte (2 px de mundo) ocupa 3 px de pantalla (docs/plan-visual.md §3). */
const MAP_ZOOM = 1.5;
/** Qué tan rápido la velocidad que se muestra de los automáticos sigue a la real (1/s): suaviza las esquinas. */
const AUTO_VELOCITY_SMOOTHING = 14;
/**
 * Zona muerta de la cámara (px del mundo): mientras el jugador se mueve adentro no se mueve, y al empujar el borde
 * lo acompaña sin retraso. Así, cuando el jugador frena, la cámara frena en el mismo cuadro.
 */
const CAMERA_DEADZONE = { width: 96, height: 64 } as const;
/**
 * La cámara mira un poco más arriba del jugador (px del mundo): la franja de la misión y los botones tapan el borde
 * de arriba de la vista, y ahí están los ventanales.
 */
const CAMERA_LOOK_UP = 64;
/** Lo que tarda la cámara en ir de un tripulante a otro al cambiar con Tab (s). */
const CAMERA_GLIDE_S = 0.35;
export const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;

/** Color de cada tripulante en el minimapa (el de su traje). */
const CREW_COLOR: Record<CrewId, number> = { vega: 0x63b3ed, miga: 0xf6ad55, brote: 0x68d391, senda: 0xfc8181 };

export const LIGHT: Record<SystemStatus, string> = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' };

export const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
export const toPx = (p: Point) => ({ x: p.x * TILE, y: p.y * TILE });

/**
 * Mapa top-down con la tripulación, común a `Voyage` y `Mars`. Sólo pinta y lee la entrada; las reglas están en
 * la sesión de `src/core/` que crea cada escena. Textos propios en `<namespace>.zone|station|task|outcome.*`.
 */
export abstract class SimulationMapScene<S extends HabitatSession, D extends PhaseSceneData = PhaseSceneData> extends Phaser.Scene {
  protected sceneData!: D;
  protected session!: S;
  protected layout!: ShipLayout;
  protected content!: HabitatContent;
  private controls!: PlayerControls;
  private sprites = new Map<CrewId, CrewSprite>();
  private colliders = new Map<CrewId, Phaser.Physics.Arcade.Collider>();
  private labels = new Map<CrewId, Phaser.GameObjects.Text>();
  private stationBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private stationFrames = new Map<string, Phaser.GameObjects.Rectangle>();
  /** Cartel y barra de cada estación: se ocultan mientras el jugador está en ese cuarto (ahí ve la ayuda). */
  private stationParts = new Map<string, Phaser.GameObjects.GameObject[]>();
  /** Nombre de cada cuarto: se ve sólo mientras el jugador está adentro (el ícono queda siempre). */
  private zoneNames = new Map<string, Phaser.GameObjects.Text>();
  protected markers!: Phaser.GameObjects.Graphics;
  private sim!: EventBus<SimulationEvents>;
  private prompt!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastUntil = 0;
  private ended = false;
  /** Mapa de tiles del lugar y sus efectos. */
  protected mapView: MapView | null = null;
  private fx: HabitatFx | null = null;
  private life: MapLife | null = null;
  private fxStations: SystemId[] = [];
  /** Hacia dónde mira cada tripulante (radianes): la linterna del casco apunta para ahí. */
  private headings = new Map<CrewId, number>();
  /** Viaje de la cámara hacia el tripulante elegido (centro de partida y avance 0..1). */
  private cameraGlide: { x: number; y: number; t: number } | null = null;

  protected constructor(key: SceneKey, private readonly namespace: 'voyage' | 'mars') {
    super(key);
  }

  init(data: D): void {
    this.sceneData = data;
    this.sprites = new Map();
    this.colliders = new Map();
    this.labels = new Map();
    this.stationBars = new Map();
    this.stationFrames = new Map();
    this.stationParts = new Map();
    this.zoneNames = new Map();
    this.ended = false;
    this.mapView = null;
    this.fx = null;
    this.life = null;
    this.headings = new Map();
    this.cameraGlide = null;
  }

  /** Opciones de vista de prueba (zoom y mapa agrandado); vacío en la partida normal. */
  protected get view(): MapViewOptions {
    return (this.sceneData as D & MapViewData).view ?? {};
  }

  /** Deja un objeto fijo en la pantalla, a su tamaño, aunque la cámara tenga zoom. */
  private pin<T extends Phaser.GameObjects.Text>(object: T, x: number, y: number): T {
    const zoom = this.cameras.main.zoom;
    const cx = VIEW_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    return object.setScrollFactor(0).setScale(1 / zoom).setPosition(cx + (x - cx) / zoom, cy + (y - cy) / zoom);
  }

  protected abstract createSession(data: D): { session: S; content: HabitatContent };
  /** Mapa de Tiled del lugar (tiles y objetos). */
  protected abstract mapAssets(): MapAssets;
  /** Para probar: dónde arranca el jugador (tiles), en vez del lugar de su cuarto. */
  protected startPoint(): Point | null {
    return null;
  }
  /** Máquina (sprite del mapa) de cada sistema: ahí salen chispas y humo cuando se avería. */
  protected stationProps(): Partial<Record<SystemId, string>> {
    return {};
  }
  /** Nave o base gastada: cinta, cables y luces que titilan. */
  protected worn(): boolean {
    return false;
  }
  /** Lugar con exterior: el rectángulo de la base y las balizas de afuera, para los efectos. */
  protected fxOutdoor(_view: MapView): Pick<HabitatFxOptions, 'interior' | 'beacons'> {
    return {};
  }
  /** Luz del cielo en este momento, si el lugar tiene exterior. */
  protected sky(): SkyLight | null {
    return null;
  }
  /** Efectos propios del lugar en cada cuadro (el clima de afuera), con quienes están afuera y la zona del jugador. */
  protected renderWeather(_walkers: readonly Walker[], _activeZone: string | null, _time: number, _dt: number): void {}
  /** Para agregar lo propio del lugar cuando el mapa ya está pintado. */
  protected mapCreated(_view: MapView): void {}
  /** Dibujo propio del lugar en cada cuadro (en `markers`, ya limpio). */
  protected renderPlace(): void {}
  /** Texto de ayuda propio del lugar para el tripulante del jugador, o null para el de las tareas. */
  protected placePrompt(_position: Point, _zone: string | null): string | null {
    return null;
  }
  /** La puerta exterior de la esclusa está cerrada (de noche o por una tormenta). */
  protected outerDoorClosed(): boolean {
    return false;
  }
  protected abstract outcomeKey(outcome: 'completed' | 'suspended'): string;

  preload(): void {
    preloadMap(this, this.mapAssets());
    preloadHudIcons(this);
  }

  create(): void {
    ({ session: this.session, content: this.content } = this.createSession(this.sceneData));
    this.layout = this.content.layout;
    this.controls = createKeyboardControls(this);
    const width = this.layout.cols * TILE;
    const height = this.layout.rows * TILE;
    this.physics.world.setBounds(0, 0, width, height);
    // La cámara ocupa sólo la vista del mapa: el tablero (`Hud`) va al lado, sin zoom.
    this.cameras.main.setViewport(0, 0, VIEW_WIDTH, GAME_HEIGHT).setBounds(0, 0, width, height).setZoom(this.view.zoom ?? MAP_ZOOM);
    // Física a paso variable: el jugador avanza en cada cuadro, como los automáticos (a pasos fijos de 1/60 s, en una
    // pantalla de 144 Hz se movía a saltos y se desfasaba del resto).
    this.physics.world.fixedStep = false;
    // Lo que depende de la posición del jugador (cámara, marcadores, ayuda) se ubica después de la física.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this));

    const walls = this.drawMap();
    if (this.mapView) this.createFx(this.mapView);
    const doorBlock = this.outerDoorBlock();
    this.markers = this.add.graphics().setDepth(5);
    const start = this.startPoint();
    for (const m of this.session.state.crew) {
      const p = toPx(start && m.id === this.session.state.activeCrewId ? start : this.session.positionOf(m.id));
      const sprite = createCrewSprite(this, m.id, p.x, p.y);
      // Con luz dinámica los trajes toman relieve con su normal map.
      if (this.mapView?.lit) sprite.sprite.setLighting(true);
      this.sprites.set(m.id, sprite);
      this.colliders.set(m.id, this.physics.add.collider(sprite.sprite, (doorBlock ? [...walls, doorBlock] : walls) as Solid));
      this.labels.set(m.id, this.add.text(p.x, p.y + 6, NAMES[m.id], { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0' }).setOrigin(0.5, 0).setDepth(41).setResolution(2).setVertexRoundMode('full'));
    }
    this.selectActive();
    this.prompt = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fbd38d', backgroundColor: '#1a202ccc', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 0)
      .setDepth(45)
      .setResolution(2)
      .setVertexRoundMode('full');
    this.toast = this.pin(
      this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '14px', color: '#fbd38d', backgroundColor: '#1a202cee', padding: { x: 8, y: 4 }, align: 'center', wordWrap: { width: VIEW_WIDTH - 80 } })
        .setOrigin(0.5, 0)
        .setDepth(60)
        .setVisible(false),
      VIEW_WIDTH / 2,
      TOAST_Y,
    );

    this.listen();
    // Bus propio de la simulación: el tablero y las pantallas superpuestas leen el estado y piden cosas por acá.
    this.sim = new EventBus<SimulationEvents>();
    const detach = this.session.attach(this.sim);
    const overlay: SimulationSceneData = { state: this.session.state, bus: this.sceneData.bus, sim: this.sim, namespace: this.namespace };
    this.scene.launch(SceneKeys.Hud, overlay);
    const keyboard = this.input.keyboard!;
    for (const [key, scene] of OVERLAY_KEYS) keyboard.addKey(key).on('down', () => toggleOverlay(this.scene, scene, overlay, !this.ended));
    // Con cada aviso nuevo se abre la planificación en pausa, para preparar la respuesta (§3.1, §4.4).
    const offAlert = this.sceneData.bus.on('alert:level', ({ level }) => {
      if (level === 'alert' && !this.ended && !this.scene.isActive(SceneKeys.Planning)) this.scene.launch(SceneKeys.Planning, overlay);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offAlert);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      detach();
      for (const key of [SceneKeys.Hud, ...OVERLAY_KEYS.map(([, scene]) => scene)]) this.scene.stop(key);
    });
    bindCrewSwitch(this, this.sceneData.bus, () => this.session.state);
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.session;
    const activeId = s.state.activeCrewId;
    const active = this.sprites.get(activeId)!;
    const member = this.member(activeId);
    const co2 = s.state.meters.lifeSupport.co2MmHg;
    const { x, y } = this.ended || s.paused ? { x: 0, y: 0 } : this.controls.movement();
    const speed = PLAYER_SPEED * moveSpeedFactor(member, co2);
    active.sprite.setVelocity(x * speed, y * speed);
    const activePosition = { x: active.sprite.x / TILE, y: active.sprite.y / TILE };
    const activeZone = zoneAt(this.layout, activePosition);
    if (this.doorBody) this.doorBody.enable = this.outerDoorClosed() && activeZone !== EXTERIOR;

    s.update(dt, { activeZone, activePosition, interacting: this.controls.interactHeld() });

    const choice = this.controls.choiceJustPressed();
    const decision = s.pendingDecisions()[0];
    const option = choice && decision?.options[choice - 1];
    if (option && option.available) s.respond(decision.incident.id, option.response.id);

    this.moveAutoCrew(dt);
    if (this.toast.visible && this.time.now > this.toastUntil) this.toast.setVisible(false);
    if (s.outcome && !this.ended) this.showOutcome(s.outcome);
  }

  protected member(id: CrewId): CrewMemberState {
    return this.session.state.crew.find((m) => m.id === id)!;
  }

  protected showToast(text: string): void {
    this.toast.setText(text).setVisible(true);
    this.toastUntil = this.time.now + 4500;
  }

  private listen(): void {
    const { bus } = this.sceneData;
    const textKey = (definitionId: string) => definitionOf(INCIDENTS, definitionId).textKey;
    const offs = [
      bus.on('crew:switched', ({ crewId }) => {
        const current = this.sprites.get(this.session.state.activeCrewId)!.sprite;
        this.session.switchCrew(crewId, { x: current.x / TILE, y: current.y / TILE });
        this.selectActive(true);
      }),
      bus.on('incident:warned', (i) => this.showToast(tr(`${textKey(i.definitionId)}.alert`))),
      bus.on('incident:started', (i) => {
        this.showToast(tr(`${textKey(i.definitionId)}.impact`));
        // El golpe del micrometeorito sacude la nave.
        if (i.definitionId === 'micrometeoroid') this.cameras.main.shake(380, 0.006);
        // La tormenta de polvo llega con una ráfaga.
        if (i.definitionId === 'dustStorm') this.cameras.main.shake(900, 0.004);
      }),
      bus.on('incident:resolved', (i) => this.showToast(t('hud.toast.resolved', { title: tr(`${textKey(i.definitionId)}.title`) }))),
      bus.on('cascade:entered', (e) => this.showToast(tr(`incidents.cascade.${e.meter}.entered`, { name: e.crewId ? NAMES[e.crewId as CrewId] : '' }))),
      bus.on('realEvent:shown', (e) => this.showToast(t('hud.toast.realEvent', { mission: e.mission, instrument: e.instrument }))),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  private selectActive(glide = false): void {
    const activeId = this.session.state.activeCrewId;
    for (const [id, sprite] of this.sprites) {
      sprite.setSelected(id === activeId);
      // Sólo el del jugador se mueve con la física; los demás los ubica `moveAutoCrew`.
      (sprite.sprite.body as Phaser.Physics.Arcade.Body).moves = id === activeId;
      if (id !== activeId) sprite.sprite.setVelocity(0, 0);
      this.colliders.get(id)!.active = id === activeId;
    }
    // Al cambiar de tripulante la cámara viaja hasta él; al empezar ya está ahí.
    const cam = this.cameras.main;
    if (glide) this.cameraGlide = { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2, t: 0 };
    else this.centerCamera(this.sprites.get(activeId)!.sprite);
  }

  /**
   * Después de la física, con las posiciones finales de este cuadro: lo que acompaña a cada tripulante (anillo,
   * flecha, globo, nombre, ayuda), las puertas, el dibujo del mapa y la cámara. Si se hiciera en `update`, iría un
   * cuadro atrás del jugador y se seguiría moviendo unos píxeles después de que frena.
   */
  private afterPhysics(_time: number, deltaMs: number): void {
    const s = this.session;
    const active = this.sprites.get(s?.state.activeCrewId)?.sprite;
    if (!active) return;
    this.mapView?.update([...this.sprites.values()].map(({ sprite }) => ({ x: sprite.x, y: sprite.y })), deltaMs / 1000);
    for (const m of s.state.crew) {
      const view = this.sprites.get(m.id)!;
      view.sync(m);
      this.labels.get(m.id)!.setPosition(view.sprite.x, view.sprite.y + 6);
    }
    const activePosition = { x: active.x / TILE, y: active.y / TILE };
    this.renderMap(activePosition, zoneAt(this.layout, activePosition), deltaMs / 1000);
    this.followCamera(active, deltaMs);
  }

  /**
   * Sigue al jugador con una zona muerta y deja la cámara siempre en un píxel entero de pantalla: con zoom 1,5, si
   * la cámara queda entre dos píxeles cada objeto redondea por su lado y se ven desfasados unos de otros.
   */
  private followCamera(target: Phaser.GameObjects.Sprite, deltaMs: number): void {
    const cam = this.cameras.main;
    let cx = cam.scrollX + cam.width / 2;
    let cy = cam.scrollY + cam.height / 2;
    const ty = target.y - CAMERA_LOOK_UP;
    if (this.cameraGlide) {
      const glide = this.cameraGlide;
      glide.t = Math.min(1, glide.t + deltaMs / 1000 / CAMERA_GLIDE_S);
      const k = Phaser.Math.Easing.Sine.InOut(glide.t);
      cx = glide.x + (target.x - glide.x) * k;
      cy = glide.y + (ty - glide.y) * k;
      if (glide.t >= 1) this.cameraGlide = null;
    } else {
      const { width: w, height: h } = CAMERA_DEADZONE;
      cx = Phaser.Math.Clamp(cx, target.x - w / 2, target.x + w / 2);
      cy = Phaser.Math.Clamp(cy, ty - h / 2, ty + h / 2);
    }
    this.setCameraCenter(cx, cy);
  }

  private centerCamera(target: { x: number; y: number }): void {
    this.cameraGlide = null;
    this.setCameraCenter(target.x, target.y - CAMERA_LOOK_UP);
  }

  /** Centra la cámara redondeando a píxeles de pantalla (y dentro del mapa). */
  private setCameraCenter(x: number, y: number): void {
    const cam = this.cameras.main;
    const z = cam.zoom;
    cam.scrollX = cam.clampX(Math.round((x - cam.width / 2) * z) / z);
    cam.scrollY = cam.clampY(Math.round((y - cam.height / 2) * z) / z);
  }

  /**
   * Los automáticos van exactamente a la posición que calcula la sesión (que ya los mueve a paso de caminata). No se
   * mueven con la física: Arcade avanza a pasos fijos de 1/60 s y, con una pantalla de otra frecuencia, una
   * velocidad "llegar en este cuadro" los pasaba de largo y volvían (vibraban). La velocidad sólo se guarda,
   * suavizada, para que la animación sepa hacia dónde caminan.
   */
  private moveAutoCrew(dt: number): void {
    for (const [id, view] of this.sprites) {
      if (id === this.session.state.activeCrewId) continue;
      const target = toPx(this.session.positionOf(id));
      const { sprite } = view;
      const dx = target.x - sprite.x;
      const dy = target.y - sprite.y;
      const jump = Math.hypot(dx, dy) > TILE * 2 || dt <= 0;
      sprite.setPosition(target.x, target.y);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      if (jump || Math.hypot(dx, dy) < 0.01) {
        body.velocity.set(0, 0);
        continue;
      }
      const k = 1 - Math.exp(-dt * AUTO_VELOCITY_SMOOTHING);
      body.velocity.set(body.velocity.x + (dx / dt - body.velocity.x) * k, body.velocity.y + (dy / dt - body.velocity.y) * k);
    }
  }

  private doorBody: Phaser.Physics.Arcade.StaticBody | null = null;

  /** Rectángulo (px) de la puerta exterior de la esclusa (de todos sus tiles), si el lugar tiene exterior. */
  private outerDoorRect(): { x: number; y: number; w: number; h: number } | null {
    const ext = this.layout.exterior;
    if (!ext) return null;
    const tiles = [ext.door, ...(ext.doorTiles ?? [])];
    const cols = tiles.map((t) => t.col);
    const rows = tiles.map((t) => t.row);
    const [col, row] = [Math.min(...cols), Math.min(...rows)];
    return { x: col * TILE, y: row * TILE, w: (Math.max(...cols) - col + 1) * TILE, h: (Math.max(...rows) - row + 1) * TILE };
  }

  /** Bloqueo de la puerta exterior de la esclusa, si el lugar tiene exterior. */
  private outerDoorBlock(): Phaser.GameObjects.Zone | null {
    const door = this.outerDoorRect();
    if (!door) return null;
    const zone = this.add.zone(door.x + door.w / 2, door.y + door.h / 2, door.w, door.h);
    this.physics.add.existing(zone, true);
    this.doorBody = zone.body as Phaser.Physics.Arcade.StaticBody;
    return zone;
  }

  /** Pinta el mapa de Tiled y devuelve lo que choca. */
  private drawMap(): Solid[] {
    this.mapView = createMap(this, this.mapAssets());
    const solid = this.mapView.solids;
    const icons = this.textures.exists(HUD_ICONS);
    for (const zone of this.layout.zones) {
      const { col, row } = zone.rect;
      // Ícono del cuarto en su esquina de arriba (×2: un píxel de arte = 2 px, como el mapa); el nombre aparece al
      // lado sólo cuando el jugador está adentro.
      const corner = { x: col * TILE + 22, y: row * TILE + 22 };
      if (icons) this.add.image(corner.x, corner.y, HUD_ICONS, zone.id).setScale(2).setDepth(39).setAlpha(0.9).setVertexRoundMode('full');
      this.zoneNames.set(
        zone.id,
        this.add
          .text(corner.x + (icons ? 22 : -18), corner.y, tr(`${this.namespace}.zone.${zone.id}`), { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0', backgroundColor: '#1a202ccc', padding: { x: 4, y: 2 } })
          .setOrigin(0, 0.5)
          .setDepth(39)
          .setResolution(2)
          .setVisible(!icons),
      );
      const task = this.content.tasks.find((t) => t.zone === zone.id);
      if (!task) continue;
      // Placa de la estación, a los pies de quien trabaja ahí (arriba van la ayuda y los globos): el ícono del cuarto,
      // el borde con el color del semáforo y la barra de avance.
      const spot = toPx(zoneSpot(zone));
      const at = { x: spot.x, y: spot.y + 58 };
      const frame = this.add.rectangle(at.x, at.y, 40, 40, 0x1a202c, 0.85).setStrokeStyle(2, 0x68d391).setDepth(40);
      const label = icons
        ? this.add.image(at.x, at.y, HUD_ICONS, zone.id).setScale(2).setDepth(41).setVertexRoundMode('full')
        : this.add.text(at.x, at.y, tr(`${this.namespace}.station.${task.id}`), { fontFamily: 'monospace', fontSize: '10px', color: '#e2e8f0' }).setOrigin(0.5).setDepth(41).setResolution(2);
      const track = this.add.rectangle(at.x - 20, at.y + 26, 40, 4, 0x2d3748).setOrigin(0, 0.5).setDepth(40);
      const bar = this.add.rectangle(at.x - 20, at.y + 26, 0, 4, 0x63b3ed).setOrigin(0, 0.5).setDepth(41);
      this.stationFrames.set(zone.id, frame);
      this.stationBars.set(zone.id, bar);
      this.stationParts.set(zone.id, [frame, label, track, bar]);
    }
    return solid;
  }

  /** Efectos que dependen del estado (luces, alarmas, averías, fugas, desgaste) y lo propio del lugar. */
  private createFx(view: MapView): void {
    const stations = Object.entries(this.stationProps()) as [SystemId, string][];
    const placed = stations.flatMap(([system, key]) => {
      const prop = view.props.find((p) => p.key === key);
      return prop ? [{ system, at: { x: prop.x, y: prop.bottom - prop.image.height + 18 } }] : [];
    });
    this.fxStations = placed.map((p) => p.system);
    // Una luz de techo por cuarto y por tramo de pasillo (de unos 10 tiles).
    const px = (r: { col: number; row: number; cols: number; rows: number }) => ({ x: r.col * TILE, y: r.row * TILE, w: r.cols * TILE, h: r.rows * TILE });
    const { corridor } = this.layout;
    const segments = Math.max(1, Math.round(corridor.cols / 10));
    const areas = [
      ...this.layout.zones.map((z) => px(z.rect)),
      ...Array.from({ length: segments }, (_, i) => px({ ...corridor, col: corridor.col + (i * corridor.cols) / segments, cols: corridor.cols / segments })),
    ];
    this.fx = new HabitatFx(this, view, { stations: placed.map((p) => p.at), worn: this.worn(), seed: this.session.state.seed, areas, ...this.fxOutdoor(view) });
    this.life = new MapLife(this, view, this.session.state.seed);
    this.mapCreated(view);
  }

  /** Lugar de la fuga de un micrometeorito (px): junto al centro del cuarto afectado. */
  private leakPoint(incidentId: string): Point {
    const p = toPx(zoneSpot(zoneById(this.layout, this.session.leakZone(incidentId))));
    return { x: p.x + 40, y: p.y + 20 };
  }

  private renderMap(activePosition: Point, activeZone: string | null, dt: number): void {
    const s = this.session;

    for (const [zone, frame] of this.stationFrames) {
      const task = this.content.tasks.find((t) => t.zone === zone)!;
      frame.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(task.system ? LIGHT[s.state.systems[task.system]] : LIGHT.green).color);
      this.stationBars.get(zone)!.width = 40 * (s.taskAt(zone)?.progress ?? 0);
      for (const part of this.stationParts.get(zone)!) (part as Phaser.GameObjects.Rectangle).setVisible(zone !== activeZone);
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 200);
    this.markers.clear();
    const leaks = s.state.activeIncidents.filter((i) => i.definitionId === 'micrometeoroid' && i.status === 'active').map((i) => this.leakPoint(i.id));
    for (const p of leaks) this.markers.lineStyle(3, 0xfc8181, pulse).strokeCircle(p.x, p.y, 10 + 4 * pulse);
    const sky = this.sky();
    const walkers = sky ? this.walkers() : [];
    const powerOut = this.view.fx?.powerOut ?? s.cascade.emergencies.some((e) => e.meter === 'energy');
    this.fx?.update(
      {
        level: this.view.fx?.level ?? s.level,
        powerOut,
        leaks,
        stations: this.fxStations.map((system) => s.state.systems[system]),
        ...(sky ? { outdoor: { sky, walkers } } : {}),
      },
      this.time.now,
    );
    this.life?.update(this.time.now, powerOut);
    this.renderWeather(walkers, activeZone, this.time.now, dt);
    const shelter = zoneById(this.layout, this.content.shelterZone);
    const toShelter = this.radiationAlert();
    if (toShelter) {
      this.floorChevrons(shelter);
      const { col, row, cols, rows } = shelter.rect;
      this.markers.lineStyle(3, 0xf6e05e, pulse).strokeRect(col * TILE + 2, row * TILE + 2, cols * TILE - 4, rows * TILE - 4);
      if (activeZone !== shelter.id) this.shelterArrow(activePosition, zoneSpot(shelter), pulse);
    }
    for (const [zone, name] of this.zoneNames) if (this.textures.exists(HUD_ICONS)) name.setVisible(zone === activeZone);
    const v = this.cameras.main.worldView;
    const frame: MinimapFrame = {
      crew: s.state.crew.map((m) => {
        const sprite = this.sprites.get(m.id)!.sprite;
        return { x: sprite.x / TILE, y: sprite.y / TILE, color: CREW_COLOR[m.id], active: m.id === s.state.activeCrewId };
      }),
      marks: this.minimapMarks(),
      shelter: toShelter ? shelter.rect : null,
      view: { x: v.x / TILE, y: v.y / TILE, width: v.width / TILE, height: v.height / TILE },
    };
    this.registry.set(MINIMAP_FRAME, frame);
    const door = this.outerDoorRect();
    if (door && this.outerDoorClosed()) this.markers.fillStyle(0xe53e3e, 0.8).fillRect(door.x + 4, door.y + 4, door.w - 8, door.h - 8);
    this.renderPlace();

    const active = this.sprites.get(s.state.activeCrewId)!.sprite;
    this.prompt.setPosition(active.x, active.y + 22).setText(this.promptText(activePosition, activeZone));
    this.prompt.setVisible(this.prompt.text !== '');
  }

  /**
   * Flechas al refugio: tres chevrones ámbar al lado del jugador, apuntando hacia el refugio, que se encienden en
   * cadena (como las luces de una pista).
   */
  private shelterArrow(from: Point, to: Point, pulse: number): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
    const [px, py] = [-dy, dx];
    const origin = toPx(from);
    const step = Math.floor(this.time.now / 180) % 3;
    for (let i = 0; i < 3; i++) {
      const d = 46 + i * 16;
      const cx = origin.x + dx * d;
      const cy = origin.y - 30 + dy * d;
      const alpha = i === step ? 1 : 0.35 + 0.2 * pulse;
      this.markers.lineStyle(4, 0x1a202c, alpha).beginPath().moveTo(cx - dx * 8 + px * 8, cy - dy * 8 + py * 8).lineTo(cx, cy).lineTo(cx - dx * 8 - px * 8, cy - dy * 8 - py * 8).strokePath();
      this.markers.lineStyle(2, 0xf6e05e, alpha).beginPath().moveTo(cx - dx * 8 + px * 8, cy - dy * 8 + py * 8).lineTo(cx, cy).lineTo(cx - dx * 8 - px * 8, cy - dy * 8 - py * 8).strokePath();
    }
  }

  /**
   * Tormenta de radiación en camino o en curso: hay que ir al refugio. Con `&fx=alert|impact` se fuerza para ver los
   * efectos.
   */
  protected radiationAlert(): boolean {
    const s = this.session;
    if (this.view.fx?.level) return true;
    return s.level !== 'calm' && s.state.activeIncidents.some((i) => i.definitionId === 'radiationStorm');
  }

  /**
   * Flechas en el piso del pasillo hacia la puerta del refugio, como en las referencias: chevrones ámbar que se
   * encienden en cadena desde los dos extremos del pasillo hacia la puerta.
   */
  private floorChevrons(shelter: ReturnType<typeof zoneById>): void {
    const { corridor } = this.layout;
    const door = doorPoint(shelter);
    const cy = (corridor.row + corridor.rows / 2) * TILE;
    const doorX = door.x * TILE;
    const step = Math.floor(this.time.now / 140);
    const g = this.markers;
    for (let col = corridor.col; col < corridor.col + corridor.cols; col++) {
      const cx = (col + 0.5) * TILE;
      const dist = Math.abs(cx - doorX);
      if (dist < TILE * 1.2) continue;
      const dir = cx < doorX ? 1 : -1;
      const n = Math.round(dist / TILE);
      const alpha = (n + step) % 4 === 0 ? 0.95 : 0.3;
      // Un chevrón de 3 píxeles de arte de grosor, con contorno oscuro.
      for (const [color, w, a] of [[0x1a120a, 8, alpha * 0.6], [0xf6ad55, 4, alpha]] as const) {
        g.lineStyle(w, color, a).beginPath().moveTo(cx - dir * 10, cy - 14).lineTo(cx + dir * 6, cy).lineTo(cx - dir * 10, cy + 14).strokePath();
      }
    }
  }

  /** Puntos chicos que el lugar marca en el minimapa (tiles): en Marte, las muestras. */
  protected minimapMarks(): Point[] {
    return [];
  }

  /** Tripulantes en el exterior, con hacia dónde miran (la última dirección en que caminaron). */
  private walkers(): Walker[] {
    const activeId = this.session.state.activeCrewId;
    return [...this.sprites].flatMap(([id, { sprite }]) => {
      const { x: vx, y: vy } = (sprite.body as Phaser.Physics.Arcade.Body).velocity;
      if (Math.hypot(vx, vy) > 1) this.headings.set(id, Math.atan2(vy, vx));
      if (zoneAt(this.layout, { x: sprite.x / TILE, y: sprite.y / TILE }) !== EXTERIOR) return [];
      return [{ id, x: sprite.x, y: sprite.y, heading: this.headings.get(id) ?? Math.PI / 2, active: id === activeId }];
    });
  }

  private promptText(position: Point, zone: string | null): string {
    const s = this.session;
    const member = this.member(s.state.activeCrewId);
    if (member.resting) return t('hud.crew.resting', { name: NAMES[member.id] });
    const place = this.placePrompt(position, zone);
    if (place !== null) return place;
    const task = s.taskAt(zone);
    if (!task) return '';
    if (task.kind === 'task' && task.upToDate) return t('hud.task.upToDate');
    if (!s.manual) return t('hud.task.fastForward');
    return task.kind === 'incident' ? t('hud.task.incident', { title: tr(`${task.textKey}.title`) }) : tr(`${this.namespace}.task.${task.task.id}`);
  }

  private showOutcome(outcome: 'completed' | 'suspended'): void {
    this.ended = true;
    // Terminó la fase: se cierran las pantallas superpuestas para que se vea el mensaje final.
    for (const [, scene] of OVERLAY_KEYS) this.scene.stop(scene);
    this.pin(
      this.add
      .text(0, 0, tr(this.outcomeKey(outcome)), {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e2e8f0',
        backgroundColor: '#1a202cee',
        padding: { x: 16, y: 12 },
        align: 'center',
        wordWrap: { width: VIEW_WIDTH - 120 },
      })
      .setOrigin(0.5)
      .setDepth(70),
      VIEW_WIDTH / 2,
      GAME_HEIGHT / 2,
    );
  }
}

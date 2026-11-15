import { INCIDENTS } from '../../../content/incidents';
import { SHIP_MAP, VOYAGE_CONTENT } from '../../../content/ship';
import { cruiseDelaySeconds } from '../../../core/environment/orbits';
import { VoyageSession } from '../../../core/voyage/VoyageSession';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { EARTH_ORBIT, MARS_ORBIT } from '../../../data/planets';
import { seriesFor } from '../../../data/realData';
import { zoneAt } from '../../../core/habitat/layout';
import { TILE } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import type { VoyageSceneData } from '../sceneData';
import { SimulationMapScene } from './SimulationMapScene';
import { cruiseDistanceAu } from '../../../core/meters/energy';
import type { SystemId } from '../../../core/systems/types';
import { SpaceWindows, type PaneView } from './SpaceWindows';
import { SHIP_BEVEL, type MapAssets, type MapView } from './TiledMapView';

/** Viaje de ida y de vuelta (game-design §4.2, §4.6): la nave con la tripulación. Reglas en `VoyageSession`. */
export class VoyageScene extends SimulationMapScene<VoyageSession, VoyageSceneData> {
  constructor() {
    super(SceneKeys.Voyage, 'voyage');
  }

  protected createSession({ state, bus, leg }: VoyageSceneData) {
    const phase = leg === 'out' ? 'cruiseOut' : 'cruiseBack';
    const content = VOYAGE_CONTENT;
    const window = content.calendar.windows[phase];
    const session = new VoyageSession({
      leg,
      state,
      bus,
      content,
      timeline: incidentTimeline(phase, window, INCIDENTS, content.incidentRules),
      doseRate: (date) => seriesFor(phase, date).dose,
      signalDelaySeconds: (date) => cruiseDelaySeconds(EARTH_ORBIT, MARS_ORBIT, window, leg, date),
    });
    return { session, content };
  }

  private windows: SpaceWindows | null = null;

  protected mapAssets(): MapAssets {
    return {
      key: 'ship',
      map: SHIP_MAP,
      tilesetName: 'ship-tiles',
      tilesUrl: 'assets/ship/tiles.png',
      propsUrl: 'assets/ship/props.png',
      propsAtlasUrl: 'assets/ship/props.json',
      doorPanels: { left: 18, right: 22 },
      lightTiles: [11],
      bevel: { caps: [12, 13, 14, 15], faces: [8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23], colors: SHIP_BEVEL },
      normals: true,
    };
  }

  protected stationProps(): Partial<Record<SystemId, string>> {
    return { scrubber: 'scrubber', waterRecycler: 'recycler', radio: 'radio' };
  }

  /** En la vuelta la nave está gastada (§4.6): cinta adhesiva, cables y luces que parpadean. */
  protected worn(): boolean {
    return this.session.leg === 'back';
  }

  /**
   * Cada ventanal muestra lo suyo, como en las referencias: el mando, el planeta al que vamos; la radio, el planeta del
   * que salimos; el refugio, el Sol (que encandila en una tormenta de radiación).
   */
  protected mapCreated(view: MapView): void {
    const roles: Record<string, PaneView> = { command: 'destination', radio: 'origin', shelter: 'sun' };
    this.windows = new SpaceWindows(this, view.decor, (w) => roles[zoneAt(this.layout, { x: w.x / TILE, y: w.bottom / TILE + 1 }) ?? ''] ?? 'stars');
  }

  protected renderPlace(): void {
    const s = this.session;
    const flare = this.radiationAlert() ? 0.6 + 0.4 * Math.sin(this.time.now / 260) : 0;
    this.windows?.update(
      { sunDistanceAu: cruiseDistanceAu(s.progress, s.leg), progress: s.progress, destination: s.leg === 'out' ? 'mars' : 'earth', origin: s.leg === 'out' ? 'earth' : 'mars', flare },
      this.game.loop.delta / 1000,
    );
  }

  protected outcomeKey(outcome: 'completed' | 'suspended'): string {
    return outcome === 'completed' ? `voyage.outcome.${this.session.leg}` : 'voyage.outcome.suspended';
  }
}

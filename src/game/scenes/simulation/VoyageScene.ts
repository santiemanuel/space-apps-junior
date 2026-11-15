import { INCIDENTS } from '../../../content/incidents';
import { SHIP_MAP, VOYAGE_CONTENT } from '../../../content/ship';
import { cruiseDelaySeconds } from '../../../core/environment/orbits';
import { VoyageSession } from '../../../core/voyage/VoyageSession';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { EARTH_ORBIT, MARS_ORBIT } from '../../../data/planets';
import { seriesFor } from '../../../data/realData';
import { SceneKeys } from '../../sceneKeys';
import type { VoyageSceneData } from '../sceneData';
import { SimulationMapScene } from './SimulationMapScene';
import { cruiseDistanceAu } from '../../../core/meters/energy';
import type { SystemId } from '../../../core/systems/types';
import { SpaceWindows } from './SpaceWindows';
import type { MapAssets, MapView } from './TiledMapView';

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

  protected mapCreated(view: MapView): void {
    this.windows = new SpaceWindows(this, view.decor);
  }

  protected renderPlace(): void {
    const s = this.session;
    this.windows?.update({ sunDistanceAu: cruiseDistanceAu(s.progress, s.leg), progress: s.progress, destination: s.leg === 'out' ? 'mars' : 'earth' }, this.game.loop.delta / 1000);
  }

  protected outcomeKey(outcome: 'completed' | 'suspended'): string {
    return outcome === 'completed' ? `voyage.outcome.${this.session.leg}` : 'voyage.outcome.suspended';
  }
}

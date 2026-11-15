import { INCIDENTS } from '../../../content/incidents';
import { VOYAGE_CONTENT } from '../../../content/ship';
import { cruiseDelaySeconds } from '../../../core/environment/orbits';
import { VoyageSession } from '../../../core/voyage/VoyageSession';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { EARTH_ORBIT, MARS_ORBIT } from '../../../data/planets';
import { seriesFor } from '../../../data/realData';
import { SceneKeys } from '../../sceneKeys';
import type { VoyageSceneData } from '../sceneData';
import { SimulationMapScene } from './SimulationMapScene';

/** Viaje de ida y de vuelta (game-design §4.2, §4.6): la nave con la tripulación. Reglas en `VoyageSession`. */
export class VoyageScene extends SimulationMapScene<VoyageSession, VoyageSceneData> {
  constructor() {
    super(SceneKeys.Voyage, 'voyage');
  }

  protected createSession({ state, bus, leg }: VoyageSceneData) {
    const phase = leg === 'out' ? 'cruiseOut' : 'cruiseBack';
    const window = VOYAGE_CONTENT.calendar.windows[phase];
    const session = new VoyageSession({
      leg,
      state,
      bus,
      content: VOYAGE_CONTENT,
      timeline: incidentTimeline(phase, window, INCIDENTS, VOYAGE_CONTENT.incidentRules),
      doseRate: (date) => seriesFor(phase, date).dose,
      signalDelaySeconds: (date) => cruiseDelaySeconds(EARTH_ORBIT, MARS_ORBIT, window, leg, date),
    });
    return { session, content: VOYAGE_CONTENT };
  }

  protected outcomeKey(outcome: 'completed' | 'suspended'): string {
    return outcome === 'completed' ? `voyage.outcome.${this.session.leg}` : 'voyage.outcome.suspended';
  }
}

import type { NearEarthObject } from '../../../core/environment/types';
import type { RawNeoWsFeed } from '../types';

/** NeoWs feed → NearEarthObject[] (una entrada por objeto, con su aproximación más cercana). */
export function toNearEarthObjects(feed: RawNeoWsFeed): NearEarthObject[] {
  return Object.values(feed.near_earth_objects).flat().flatMap((neo) => {
    const approach = [...neo.close_approach_data]
      .sort((a, b) => Number(a.miss_distance.lunar) - Number(b.miss_distance.lunar))[0];
    if (!approach) return [];
    const { estimated_diameter_min: min, estimated_diameter_max: max } = neo.estimated_diameter.meters;
    return [{
      id: neo.id,
      name: neo.name,
      diameterMeters: (min + max) / 2,
      missDistanceLunar: Number(approach.miss_distance.lunar),
      velocityKmS: Number(approach.relative_velocity.kilometers_per_second),
      hazardous: neo.is_potentially_hazardous_asteroid,
      approachDate: approach.close_approach_date,
    }];
  });
}

/** Formatos crudos de las APIs de la NASA (sólo los campos que usa el juego). */

/** DONKI — Solar Flare (FLR). https://api.nasa.gov  →  DONKI */
export interface RawDonkiFlare {
  flrID: string;
  beginTime: string;
  peakTime: string | null;
  endTime: string | null;
  classType: string | null;
  sourceLocation?: string;
  activeRegionNum?: number | null;
}

/** NeoWs — Feed. https://api.nasa.gov  →  Asteroids NeoWs */
export interface RawNeoWsFeed {
  element_count: number;
  near_earth_objects: Record<string, RawNeo[]>;
}

export interface RawNeo {
  id: string;
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: { meters: { estimated_diameter_min: number; estimated_diameter_max: number } };
  close_approach_data: {
    close_approach_date: string;
    relative_velocity: { kilometers_per_second: string };
    miss_distance: { lunar: string; kilometers: string };
  }[];
}

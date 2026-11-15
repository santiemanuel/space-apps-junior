import type { HabitatContent } from '../habitat/types';

/** Ida o vuelta: el mismo mapa con la nave gastada en la vuelta (§4.6). */
export type VoyageLeg = 'out' | 'back';

/** Contenido de la escena `Voyage`: el de la nave más las diferencias de la vuelta [regla]. */
export interface VoyageContent extends HabitatContent {
  back: {
    /** La nave gastada se desgasta más rápido (§4.6). */
    wearMultiplier: number;
    /** El ejercicio cuenta doble para llegar en forma a 1 g (§4.6). */
    exerciseMultiplier: number;
  };
}

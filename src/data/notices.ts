import noticesDataset from '../../datasets/notices/donki-notices.json';
import type { SpaceWeatherNotice } from '../core/environment/notices';

/** Avisos de DONKI para Control de Misión (2024 → nov. 2026), generados por scripts/build-events.mjs. */
export const DONKI_NOTICES: readonly SpaceWeatherNotice[] = noticesDataset.notices as SpaceWeatherNotice[];

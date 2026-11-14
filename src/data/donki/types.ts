/** Formatos crudos de DONKI (CCMC) — sólo los campos que usa el juego. */
export interface RawFlare {
  flrID: string;
  beginTime: string;
  peakTime: string | null;
  classType: string | null;
  link?: string;
}

export interface RawSep {
  sepID: string;
  eventTime: string;
  instruments?: { displayName: string }[] | null;
  link?: string;
}

/** Formato de los ficheros archivados en datasets/donki/ (generados por scripts/fetch-datasets.mjs). */
export interface ArchivedDataset<E> {
  source: string;
  endpoint: string;
  retrievedAt: string;
  range: { start: string; end: string };
  events: E[];
}

export interface ArchivedFlare {
  id: string;
  peakTime: string | null;
  beginTime: string;
  classType: string;
  link?: string;
}

export interface ArchivedSep {
  id: string;
  eventTime: string;
  instruments: string[];
  link?: string;
}

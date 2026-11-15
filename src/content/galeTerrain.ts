/**
 * Morfología real del cráter Gale (docs/plan-visual.md, Fase 4): cifras verificadas una por una contra su fuente
 * de la NASA (15/11/2026) y las fotos de referencia de cada franja del exterior. Las fotos están guardadas en
 * `docs/gale/` (PIA = número del Photojournal de la NASA; crédito NASA/JPL-Caltech/MSSS para Mastcam y MAHLI,
 * NASA/JPL-Caltech/University of Arizona para HiRISE). El mapa jugable es un corte comprimido y **no a escala**
 * del camino de Curiosity, de norte a sur. Textos para chicos en `mars.terrain.<id>.name|fact`.
 */

export interface GaleSource {
  /** Qué dice la fuente, en pocas palabras. */
  says: string;
  url: string;
}

/** Foto de referencia: `pia` también es el nombre del archivo en `docs/gale/`. */
export interface GalePhoto {
  pia: string;
  instrument: 'HiRISE' | 'Mastcam' | 'MAHLI' | 'render';
  title: string;
  /** Fecha en que se tomó (o se publicó, si es un render). */
  date: string;
  url: string;
}

/** Cifras generales: el mapa del cráter con "estás acá" y la tarjeta del azufre. */
export const GALE_FACTS = {
  craterDiameterKm: {
    value: 154,
    source: { says: 'Gale Crater is 96 miles (154 kilometers) in diameter', url: 'https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/' },
  },
  /** Sobre el piso del cráter. La NASA también lo redondea a "3 millas (5 km)" en textos de 2024. */
  mountSharpHeightKm: {
    value: 5.5,
    source: { says: 'Mount Sharp rises about 3.4 miles (5.5 kilometers) above the floor of Gale Crater (PIA15292)', url: 'https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/' },
  },
  craterAge: {
    value: 'más de 3000 millones de años',
    source: { says: 'a massive impact that excavated Gale Crater more than 3 billion years ago (PIA15292)', url: 'https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/' },
  },
  landing: {
    value: '2012-08-06',
    place: 'Bradbury Landing, en Aeolis Palus',
    source: { says: 'Curiosity landed on Aeolis Palus ... Aug. 5, 2012, PDT (Aug. 6 ... Universal Time) (PIA23412)', url: 'https://www.jpl.nasa.gov/images/pia23412-mid-2019-map-of-nasas-curiosity-rover-mission/' },
  },
  /** Curiosity explora el canal desde febrero de 2024: toda la estancia del juego (15/05 → 04/06/2024) cae ahí. */
  gediz: {
    arrived: '2024-02',
    widthM: 91,
    source: {
      says: 'Gediz Vallis channel, which it began exploring for several months starting in February 2024 ... roughly 300-foot-wide (91-meter-wide) (PIA26241)',
      url: 'https://science.nasa.gov/photojournal/curiositys-route-to-gediz-vallis-channel-rendering/',
    },
  },
  sulfur: {
    date: '2024-05-30',
    sol: 4200,
    rock: 'Convict Lake',
    source: {
      says: 'found inside a rock after NASA\'s Curiosity Mars rover happened to drive over it and crush it on May 30, 2024, the 4,200th Martian day, or sol ... the crystalline material is elemental sulfur (PIA26307); first time this kind of sulfur has been found on the Red Planet',
      url: 'https://www.jpl.nasa.gov/images/pia26307-curiosity-captures-close-up-of-sulfur-crystals/',
    },
    news: 'https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-rover-discovers-a-surprise-in-a-martian-rock/',
  },
} as const satisfies Record<string, { source: GaleSource; [key: string]: unknown }>;

export type GaleStripId = 'plain' | 'lakebed' | 'dunes' | 'buttes' | 'gediz';

/** Franja del exterior: el lugar real que representa, qué se ve y de dónde sale. */
export interface GaleStrip {
  id: GaleStripId;
  /** Lugar real del camino de Curiosity. */
  place: string;
  /** Qué hay que dibujar (para los prompts de la Fase 4). */
  look: string;
  facts: readonly GaleSource[];
  photos: readonly GalePhoto[];
}

/** Franjas del exterior, de norte (la base) a sur (Curiosity, al pie del monte Sharp). */
export const GALE_STRIPS: readonly GaleStrip[] = [
  {
    id: 'plain',
    place: 'Aeolis Palus (Bradbury Landing y los afloramientos Hottah y Link)',
    look: 'Suelo ocre polvoriento con grava; piedritas redondeadas sueltas y losas de conglomerado inclinadas',
    facts: [
      {
        says: 'Some of the clasts are round in shape, leading the science team to conclude they were transported by a vigorous flow of water. The grains are too large to have been moved by wind (PIA16156)',
        url: 'https://www.jpl.nasa.gov/images/pia16156-remnants-of-ancient-streambed-on-mars/',
      },
    ],
    photos: [
      { pia: 'PIA16156', instrument: 'Mastcam', title: 'Remnants of Ancient Streambed on Mars (Hottah)', date: '2012-09-14', url: 'https://www.jpl.nasa.gov/images/pia16156-remnants-of-ancient-streambed-on-mars/' },
      { pia: 'PIA16056', instrument: 'HiRISE', title: 'A Whole New World for Curiosity', date: '2012-08', url: 'https://www.jpl.nasa.gov/images/pia16056-a-whole-new-world-for-curiosity/' },
    ],
  },
  {
    id: 'lakebed',
    place: 'Yellowknife Bay (lutita Sheepbed)',
    look: 'Roca clara en placas planas y agrietadas, con vetas blancas y bolitas (concreciones)',
    facts: [
      {
        says: 'These rocks record superimposed ancient lake and stream deposits that offered past environmental conditions favorable for microbial life (PIA17595)',
        url: 'https://science.nasa.gov/photojournal/view-of-yellowknife-bay-formation-with-drilling-sites/',
      },
      {
        says: 'well-defined veins filled with whitish minerals, interpreted as calcium sulfate (PIA16705)',
        url: 'https://www.jpl.nasa.gov/images/pia16705-veins-in-sheepbed-outcrop/',
      },
    ],
    photos: [
      { pia: 'PIA17595', instrument: 'Mastcam', title: 'View of Yellowknife Bay Formation, with Drilling Sites', date: '2012-12-24', url: 'https://science.nasa.gov/photojournal/view-of-yellowknife-bay-formation-with-drilling-sites/' },
      { pia: 'PIA16705', instrument: 'Mastcam', title: "Veins in 'Sheepbed' Outcrop", date: '2012-12-13', url: 'https://www.jpl.nasa.gov/images/pia16705-veins-in-sheepbed-outcrop/' },
      { pia: 'PIA17080', instrument: 'HiRISE', title: "View From Mars Orbiter Showing Curiosity Rover at 'Shaler' (zona Glenelg, con la roca clara de Yellowknife Bay)", date: '2013-06-27', url: 'https://science.nasa.gov/photojournal/view-from-mars-orbiter-showing-curiosity-rover-at-shaler/' },
    ],
  },
  {
    id: 'dunes',
    place: 'Dunas Bagnold (duna Namib)',
    look: 'Arena muy oscura con ondas de dos tamaños; cara de avalancha empinada del lado del viento',
    facts: [
      {
        says: 'Images taken from orbit have shown that dunes in the Bagnold field move as much as about 3 feet (1 meter) per Earth year (PIA20283)',
        url: 'https://www.jpl.nasa.gov/images/pia20283-mastcam-telephoto-of-a-martian-dunes-downwind-face/',
      },
      {
        says: 'the first close-up investigation ever made of active sand dunes anywhere other than Earth (PIA20755)',
        url: 'https://www.jpl.nasa.gov/images/pia20755-two-sizes-of-ripples-on-surface-of-martian-sand-dune/',
      },
    ],
    photos: [
      { pia: 'PIA20755', instrument: 'Mastcam', title: 'Two Sizes of Ripples on Surface of Martian Sand Dune', date: '2015-12-13', url: 'https://www.jpl.nasa.gov/images/pia20755-two-sizes-of-ripples-on-surface-of-martian-sand-dune/' },
      { pia: 'PIA20283', instrument: 'Mastcam', title: "Mastcam Telephoto of a Martian Dune's Downwind Face", date: '2015-12-21', url: 'https://www.jpl.nasa.gov/images/pia20283-mastcam-telephoto-of-a-martian-dunes-downwind-face/' },
      { pia: 'PIA19930', instrument: 'HiRISE', title: 'Orbital View of Dune That Curiosity Will Visit', date: '2015-11', url: 'https://www.jpl.nasa.gov/images/pia19930-orbital-view-of-dune-that-curiosity-will-visit/' },
    ],
  },
  {
    id: 'buttes',
    place: 'Murray Buttes (paso entre las dunas hacia el monte Sharp)',
    look: 'Mesetas de laderas empinadas con capas de arenisca, rodeadas de roca fracturada en polígonos',
    facts: [
      {
        says: 'The Martian buttes and mesas rising above the surface are eroded remnants of ancient sandstone that originated when winds deposited sand after lower Mount Sharp had formed',
        url: 'https://www.jpl.nasa.gov/news/mars-rover-views-spectacular-layered-rock-formations/',
      },
      {
        says: 'The top of the one on the left is about 26 feet (about 8 meters) above the surrounding plain ... The mesa on the right is about 33 feet (about 10 meters) high (PIA20841)',
        url: 'https://www.jpl.nasa.gov/images/pia20841-martian-mesas-in-murray-buttes-area-sol-1434/',
      },
      {
        says: 'The layers offer a history book of sequential chapters recording environmental conditions when each stratum was deposited (PIA15292)',
        url: 'https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/',
      },
    ],
    photos: [
      { pia: 'PIA20841', instrument: 'Mastcam', title: "Martian Mesas in 'Murray Buttes' Area, Sol 1434", date: '2016-08-18', url: 'https://www.jpl.nasa.gov/images/pia20841-martian-mesas-in-murray-buttes-area-sol-1434/' },
      { pia: 'PIA17587', instrument: 'HiRISE', title: "'Murray Buttes' at Foot of Mount Sharp on Mars", date: '2013-11', url: 'https://www.jpl.nasa.gov/images/pia17587-murray-buttes-at-foot-of-mount-sharp-on-mars/' },
    ],
  },
  {
    id: 'gediz',
    place: 'Canal Gediz Vallis (unidad de sulfatos del monte Sharp)',
    look: 'Cauce de unos 90 m con arena oscura en los bordes y montículos de bloques y escombros en el centro; campo de piedras claras con cristales amarillos de azufre',
    facts: [
      GALE_FACTS.gediz.source,
      GALE_FACTS.sulfur.source,
      {
        says: 'Whereas stones carried by water flows become rounded like river rocks, some of the debris mounds are riddled with more angular rocks that may have been deposited by dry avalanches',
        url: GALE_FACTS.sulfur.news,
      },
    ],
    photos: [
      { pia: 'PIA26410', instrument: 'Mastcam', title: "Curiosity's View Within Gediz Vallis Channel", date: '2024-09-21', url: 'https://science.nasa.gov/photojournal/curiositys-view-within-gediz-vallis-channel/' },
      { pia: 'PIA26309', instrument: 'Mastcam', title: 'Curiosity Views Sulfur Crystals Within a Crushed Rock', date: '2024-06-07', url: 'https://www.jpl.nasa.gov/images/pia26309-curiosity-views-sulfur-crystals-within-a-crushed-rock/' },
      { pia: 'PIA26307', instrument: 'MAHLI', title: 'Curiosity Captures Close-Up of Sulfur Crystals', date: '2024-06-04', url: 'https://www.jpl.nasa.gov/images/pia26307-curiosity-captures-close-up-of-sulfur-crystals/' },
      { pia: 'PIA26245', instrument: 'HiRISE', title: 'HiRISE Spots Curiosity Driving Toward Upper Gediz Vallis', date: '2023-12-29', url: 'https://www.jpl.nasa.gov/images/pia26245-hirise-spots-curiosity-driving-toward-upper-gediz-vallis/' },
      { pia: 'PIA26241', instrument: 'render', title: "Curiosity's Route to Gediz Vallis Channel (Rendering, con datos de HiRISE)", date: '2024-03-29', url: 'https://science.nasa.gov/photojournal/curiositys-route-to-gediz-vallis-channel-rendering/' },
    ],
  },
];

/**
 * Tipo de roca de las muestras de cada franja (docs/plan-visual.md, Fase 4): sprite `sample-<tipo>` del atlas de
 * Marte, nombre y dato para chicos en `mars.rock.<tipo>.name|fact`. Juntar uno de cada tipo da el logro
 * `allRockTypes`; el tipo no cambia el puntaje.
 */
export const GALE_ROCKS: Readonly<Record<GaleStripId, { rock: string; source: GaleSource }>> = {
  plain: { rock: 'conglomerate', source: GALE_STRIPS[0]!.facts[0]! },
  lakebed: { rock: 'mudstone', source: GALE_STRIPS[1]!.facts[0]! },
  dunes: {
    rock: 'basalticSand',
    source: {
      says: 'The basaltic Bagnold sands show subtle variations in mineralogy and chemistry (Recap of the Bagnold Dune Investigation)',
      url: 'https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/',
    },
  },
  buttes: { rock: 'sandstone', source: GALE_STRIPS[3]!.facts[0]! },
  gediz: { rock: 'sulfur', source: GALE_FACTS.sulfur.source },
};

/** Todos los tipos de roca, en el orden de las franjas. */
export const ROCK_TYPES: readonly string[] = GALE_STRIPS.map((s) => GALE_ROCKS[s.id].rock);

/** Lugar del cráter con sus coordenadas (planetocéntricas, grados; latitud negativa = sur). */
export interface GalePlace {
  lat: number;
  lon: number;
  source: GaleSource;
}

/** Lugares que marca el mapa del cráter. */
export const GALE_PLACES = {
  craterCenter: {
    lat: -5.37,
    lon: 137.81,
    source: { says: 'Gale: Center Latitude -5.37°, Center Longitude 137.81°, Diameter 154.08 km (USGS Gazetteer of Planetary Nomenclature)', url: 'https://planetarynames.wr.usgs.gov/Feature/2071' },
  },
  bradbury: {
    lat: -4.5895,
    lon: 137.4417,
    source: { says: 'Curiosity rover landed on Aeolis Palus in northern Gale crater (latitude 4.5895°S, longitude 137.4417°E) on 6 August 2012 (Malin et al. 2017)', url: 'https://doi.org/10.1002/2016ea000252' },
  },
  /** Extremo norte del canal, donde Curiosity lo recorrió en 2024 (el canal sigue 8 km hacia el sur). */
  gediz: {
    lat: -4.775,
    lon: 137.403,
    source: { says: 'Gediz Vallis: Northmost Latitude -4.77°, polygon from 137.39°E -4.77° to 137.43°E -4.91° (USGS Gazetteer of Planetary Nomenclature)', url: 'https://planetarynames.wr.usgs.gov/Feature/15571' },
  },
  mountSharp: {
    lat: -5.08,
    lon: 137.85,
    source: { says: 'Aeolis Mons: Center Latitude -5.08°, Center Longitude 137.85°, Diameter 88.99 km (USGS Gazetteer of Planetary Nomenclature)', url: 'https://planetarynames.wr.usgs.gov/Feature/15000' },
  },
} as const satisfies Record<string, GalePlace>;

/**
 * Mapa del cráter en pixel art (`scripts/art/crater-map.py`): la foto PIA15687 (vista desde arriba, norte arriba)
 * reducida a 200 × 200 píxeles de arte y exportada ×3. Georreferencia: el centro de la elipse de aterrizaje de 2012
 * (4,5965° S, 137,4019° E) cae en `anchor` y su ancho (20 km) da `pxPerKm`. Con eso el borde de 154 km coincide con el
 * del cráter (control en `art/raw/crater-check.png`).
 */
export const GALE_CRATER_VIEW = {
  image: 'assets/mars/crater.png',
  artSize: 200,
  scale: 3,
  anchor: { lat: -4.5965, lon: 137.4019, x: 71.54, y: 45.85 },
  pxPerKm: 1.1846,
  credit: 'NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS (PIA15687)',
  url: 'https://science.nasa.gov/photojournal/destination-gale-crater-in-august-2012/',
} as const;

const KM_PER_DEG_LAT = 59.16;
const KM_PER_DEG_LON = 58.96;

/** Píxel de arte del mapa del cráter de un lugar (lat/lon en grados). */
export function craterPoint(lat: number, lon: number): { x: number; y: number } {
  const { anchor, pxPerKm } = GALE_CRATER_VIEW;
  return { x: anchor.x + (lon - anchor.lon) * KM_PER_DEG_LON * pxPerKm, y: anchor.y + (anchor.lat - lat) * KM_PER_DEG_LAT * pxPerKm };
}

/** Distancia en línea recta (km) entre dos lugares del cráter. */
export const craterKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number =>
  Math.hypot((a.lat - b.lat) * KM_PER_DEG_LAT, (a.lon - b.lon) * KM_PER_DEG_LON);

/** Vista oblicua del monte Sharp dentro del cráter (referencia de dibujo). */
export const GALE_OVERVIEW_PHOTO: GalePhoto = {
  pia: 'PIA15292',
  instrument: 'render',
  title: "'Mount Sharp' Inside Gale Crater, Mars",
  date: '2012-03-28',
  url: 'https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/',
};

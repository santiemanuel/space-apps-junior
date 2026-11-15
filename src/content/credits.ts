/**
 * Créditos del juego (menú principal → Créditos, y `CREDITS.md` en la raíz del repo, con el mismo contenido).
 * Nombres propios, autores y enlaces van tal cual; lo que se traduce (para qué se usa cada cosa, licencias y títulos
 * de sección) está en `menu.credits.*` de `src/i18n/`. `files` dice qué archivos del repo salen de cada fuente: un
 * test comprueba que existen y que cada dataset que usa el juego tiene su crédito.
 */

export type CreditSectionId = 'team' | 'nasaData' | 'nasaImages' | 'aiTools' | 'software';

export type CreditLicense = 'team' | 'publicDomain' | 'credit' | 'terms' | 'mit' | 'apache' | 'gpl' | 'lgpl';

export interface Credit {
  /** Clave de los textos: `menu.credits.<id>.use`. */
  id: string;
  name: string;
  /** Autor, institución o instrumento. */
  by: string;
  url?: string;
  license: CreditLicense;
  /** Archivos del repo que salen de esta fuente (o carpetas, terminadas en `/`). */
  files?: readonly string[];
}

export interface CreditSection {
  id: CreditSectionId;
  credits: readonly Credit[];
}

export const CREDIT_SECTIONS: readonly CreditSection[] = [
  {
    id: 'team',
    credits: [
      { id: 'game', name: 'Hello Mars', by: 'Santiago · Facundo', license: 'team' },
      {
        id: 'challenge',
        name: 'NASA Space Apps Challenge 2026 — Junior Astronaut Mission Trainer',
        by: 'NASA',
        url: 'https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/',
        license: 'terms',
      },
    ],
  },
  {
    id: 'nasaData',
    credits: [
      {
        id: 'donkiFlr',
        name: 'DONKI — Solar Flares (FLR)',
        by: 'NASA Community Coordinated Modeling Center (CCMC), GSFC',
        url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
        license: 'publicDomain',
        files: ['datasets/storms/biosentinel-storms.json', 'datasets/donki/flr.json'],
      },
      {
        id: 'donkiSep',
        name: 'DONKI — Solar Energetic Particles (SEP)',
        by: 'NASA Community Coordinated Modeling Center (CCMC), GSFC',
        url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
        license: 'publicDomain',
        files: ['datasets/storms/biosentinel-storms.json', 'datasets/donki/sep.json'],
      },
      {
        id: 'donkiNotices',
        name: 'DONKI — Notifications',
        by: 'NASA Community Coordinated Modeling Center (CCMC), GSFC',
        url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
        license: 'publicDomain',
        files: ['datasets/notices/donki-notices.json'],
      },
      {
        id: 'biosentinel',
        name: 'RadLab — BioSentinel BPD',
        by: 'NASA Open Science Data Repository (OSDR) · NASA Ames',
        url: 'https://visualization.osdr.nasa.gov/radlab/',
        license: 'publicDomain',
        files: ['datasets/series/deep-space-dose.json', 'datasets/storms/biosentinel-storms.json', 'datasets/storms/radiation-peaks.json'],
      },
      {
        id: 'curiosityRad',
        name: 'RadLab — Curiosity RAD',
        by: 'NASA/JPL-Caltech · Southwest Research Institute (via NASA OSDR RadLab)',
        url: 'https://visualization.osdr.nasa.gov/radlab/',
        license: 'publicDomain',
        files: ['datasets/series/mars-surface-dose.json', 'datasets/storms/radiation-peaks.json'],
      },
      {
        id: 'artemis',
        name: 'RadLab — Artemis I (HERA, EAD, M-42)',
        by: 'NASA · DLR (via NASA OSDR RadLab)',
        url: 'https://visualization.osdr.nasa.gov/radlab/',
        license: 'publicDomain',
        files: ['datasets/series/van-allen-artemis.json'],
      },
      {
        id: 'tgo',
        name: 'RadLab — ExoMars TGO Liulin-MO',
        by: 'ESA · Roscosmos (via NASA OSDR RadLab)',
        url: 'https://visualization.osdr.nasa.gov/radlab/',
        license: 'credit',
        files: ['datasets/series/mars-cruise-dose.json'],
      },
      {
        id: 'rems',
        name: 'Curiosity REMS — Mars Weather',
        by: 'NASA/JPL-Caltech · Centro de Astrobiología (CSIC-INTA)',
        url: 'https://mars.nasa.gov/msl/mission/weather/',
        license: 'publicDomain',
        files: ['datasets/series/gale-weather.json'],
      },
      {
        id: 'radiationDose',
        name: 'Radiation dose and quality factors: Hassler et al. 2014, Zeitlin et al. 2013, Zhang et al. 2020 · NASA OCHMO TB-020',
        by: 'NASA/JPL-Caltech (MSL RAD) · Science · Science Advances · NASA OCHMO',
        url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf',
        license: 'credit',
        files: ['datasets/curated/radiation-dose.json'],
      },
      {
        id: 'bvad',
        name: 'Life Support Baseline Values and Assumptions Document (BVAD)',
        by: 'NASA Johnson Space Center',
        url: 'https://ntrs.nasa.gov/citations/20210024855',
        license: 'publicDomain',
        files: ['datasets/curated/life-support-bvad.json'],
      },
      {
        id: 'std3001',
        name: 'NASA-STD-3001 (OCHMO Technical Briefs TB-004, TB-013, TB-027)',
        by: 'NASA Office of the Chief Health and Medical Officer',
        url: 'https://www.nasa.gov/ochmo/',
        license: 'publicDomain',
        files: ['datasets/curated/nasa-std-3001.json'],
      },
      {
        id: 'osdr',
        name: 'Open Science Data Repository (OSD-992, OSD-615, OSD-177)',
        by: 'NASA Open Science Data Repository (OSDR)',
        url: 'https://osdr.nasa.gov/bio/repo/',
        license: 'publicDomain',
        files: ['datasets/curated/osdr-facts.json'],
      },
      {
        id: 'conjunctions',
        name: 'Mars Solar Conjunction (2015 → 2023)',
        by: 'NASA Jet Propulsion Laboratory',
        url: 'https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/',
        license: 'publicDomain',
        files: ['datasets/curated/mars-conjunctions.json'],
      },
      {
        id: 'planets',
        name: 'Approximate Positions of the Planets',
        by: 'NASA JPL Solar System Dynamics',
        url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
        license: 'publicDomain',
        files: ['datasets/curated/planet-elements.json'],
      },
      {
        id: 'galeFacts',
        name: 'Gale Crater facts (PIA15292, PIA26241, PIA26307…) · USGS Gazetteer of Planetary Nomenclature',
        by: 'NASA/JPL-Caltech · USGS Astrogeology',
        url: 'https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/',
        license: 'publicDomain',
        files: ['src/content/galeTerrain.ts'],
      },
    ],
  },
  {
    id: 'nasaImages',
    credits: [
      {
        id: 'blueMarble',
        name: 'The Blue Marble (2002)',
        by: 'NASA Earth Observatory · Reto Stöckli, NASA GSFC',
        url: 'https://visibleearth.nasa.gov/view.php?id=57752',
        license: 'publicDomain',
        files: ['public/assets/ui/title/earth-map.png'],
      },
      {
        id: 'vikingMdim',
        name: 'Mars Viking MDIM 2.1 Colorized Global Mosaic',
        by: 'USGS Astrogeology · NASA Ames',
        url: 'https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg',
        license: 'publicDomain',
        files: ['public/assets/ui/title/mars-map.png'],
      },
      {
        id: 'galeCrater',
        name: 'PIA15687 — Destination: Gale Crater in August 2012',
        by: 'NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS',
        url: 'https://science.nasa.gov/photojournal/destination-gale-crater-in-august-2012/',
        license: 'credit',
        files: ['public/assets/mars/crater.png'],
      },
      {
        id: 'galePhotos',
        name:
          'PIA15292, PIA16056, PIA16156, PIA16705, PIA17080, PIA17587, PIA17595, PIA19930, PIA20283, PIA20755, PIA20841, ' +
          'PIA26241, PIA26245, PIA26307, PIA26309, PIA26410',
        by: 'NASA/JPL-Caltech/MSSS (Mastcam, MAHLI) · NASA/JPL-Caltech/University of Arizona (HiRISE)',
        url: 'https://science.nasa.gov/photojournal/',
        license: 'publicDomain',
        files: ['docs/referencias/gale/'],
      },
    ],
  },
  {
    id: 'aiTools',
    credits: [
      { id: 'devin', name: 'Devin', by: 'Cognition', url: 'https://devin.ai', license: 'terms' },
      {
        id: 'lyria',
        name: 'Lyria',
        by: 'Google DeepMind',
        url: 'https://deepmind.google/models/lyria/',
        license: 'terms',
        files: ['public/assets/audio/music/'],
      },
      {
        id: 'elevenlabs',
        name: 'ElevenLabs Sound Effects',
        by: 'ElevenLabs',
        url: 'https://elevenlabs.io/sound-effects',
        license: 'terms',
        files: ['public/assets/audio/sfx/'],
      },
      {
        id: 'openaiImage',
        name: 'OpenAI Image 2.5 (via Codex)',
        by: 'OpenAI',
        url: 'https://openai.com',
        license: 'terms',
        files: [
          'public/assets/crew/',
          'public/assets/ship/',
          'public/assets/mars/tiles.png',
          'public/assets/mars/props.png',
          'public/assets/hud/',
          'public/assets/minigames/',
          'public/assets/ui/cargo/',
          'public/assets/ui/flight/',
          'public/assets/ui/flags/',
          'public/assets/ui/title/logo.png',
        ],
      },
      {
        id: 'pixelSnapper',
        name: 'Sprite Fusion Pixel Snapper',
        by: 'Hugo Duprez',
        url: 'https://github.com/Hugo-Dz/spritefusion-pixel-snapper',
        license: 'mit',
        files: ['art/snapped/'],
      },
    ],
  },
  {
    id: 'software',
    credits: [
      { id: 'phaser', name: 'Phaser 4', by: 'Phaser Studio', url: 'https://phaser.io', license: 'mit' },
      { id: 'typescript', name: 'TypeScript', by: 'Microsoft', url: 'https://www.typescriptlang.org', license: 'apache' },
      { id: 'vite', name: 'Vite · Vitest', by: 'VoidZero', url: 'https://vite.dev', license: 'mit' },
      { id: 'tiled', name: 'Tiled Map Editor', by: 'Thorbjørn Lindeijer', url: 'https://www.mapeditor.org', license: 'gpl', files: ['src/content/maps/'] },
      { id: 'ffmpeg', name: 'FFmpeg', by: 'FFmpeg project', url: 'https://ffmpeg.org', license: 'lgpl', files: ['scripts/audio/master-music.mjs'] },
    ],
  },
];

/** Aviso de la NASA sobre el uso de sus datos e imágenes (va al pie de los créditos). */
export const NASA_MEDIA_GUIDELINES = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';

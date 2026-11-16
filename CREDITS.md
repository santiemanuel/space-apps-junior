# Credits — Hello Mars

Hello Mars is a game made for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/)
(*Junior Astronaut Mission Trainer* challenge). These credits are the same ones shown in the game (main menu →
**Credits**); their source is [`src/content/credits.ts`](src/content/credits.ts), and a test
([`src/content/credits.test.ts`](src/content/credits.test.ts)) checks that every link is also here, that every cited
file exists and that every dataset the game uses has its credit.

## Authorship

The code, game design, writing and final assembly belong to the **Hello Mars team** (© 2026):

| Member | Role |
| --- | --- |
| Santiago | Ship and base simulation (`src/core/habitat/`, `Voyage`, `Mars`, dashboard, minigames) |
| Facundo | Mission flow and maneuvers (`src/core/flow/`, `Maneuver`, cargo hold, report) |

The AI tools listed below were used **under the team's direction**: the team wrote the requests (prompts, kept in
`art/prompts/` and `docs/produccion/sonidos-variedad.md`), chose among the results, edited them and integrated them.
The repository's git history shows the work end to end.

## NASA data and how the game uses it

Technical details (how the data is downloaded and processed, derived game rules) in
[`datasets/README.md`](datasets/README.md). Only `src/data/` reads these files.

| Source | Author | Files | Use in the game |
| --- | --- | --- | --- |
| [DONKI — Solar Flares (FLR)](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | NASA CCMC (GSFC) | `datasets/storms/biosentinel-storms.json`, `datasets/donki/flr.json` | The strong flare that announces each 2024 solar storm, and how far in advance the player is warned. |
| DONKI — Solar Energetic Particles (SEP) | NASA CCMC (GSFC) | `datasets/storms/biosentinel-storms.json`, `datasets/donki/sep.json` | The real moment each radiation storm begins, sending the crew to the shelter. |
| DONKI — Notifications | NASA CCMC (GSFC) | `datasets/notices/donki-notices.json` | Mission Control messages: M/X flares, detected particles and CMEs heading to Mars, with their real date. |
| [RadLab](https://visualization.osdr.nasa.gov/radlab/) — BioSentinel BPD | NASA OSDR · NASA Ames | `datasets/series/deep-space-dose.json`, `datasets/storms/biosentinel-storms.json`, `datasets/storms/radiation-peaks.json` | Daily dose during the trips; start, rise and duration of each 2024 solar storm (real peak 653 μGy/h). |
| RadLab — Curiosity RAD | NASA/JPL-Caltech · SwRI | `datasets/series/mars-surface-dose.json`, `datasets/storms/radiation-peaks.json` | Daily dose on the surface of Mars and the real storm of 05/20/2024 at Gale (peak 304 μGy/h). |
| RadLab — Artemis I (HERA, EAD, M-42) | NASA · DLR | `datasets/series/van-allen-artemis.json` | Crossing the Van Allen belts during launch. |
| RadLab — ExoMars TGO Liulin-MO | ESA · Roscosmos | `datasets/series/mars-cruise-dose.json` | Dose on the trip to Mars in free mode (2016 cruise). |
| [Curiosity REMS](https://mars.nasa.gov/msl/mission/weather/) | NASA/JPL-Caltech · CAB (CSIC-INTA) | `datasets/series/gale-weather.json` | Dust and cold for each sol at Gale: solar panel power, heating, dust and extreme-night warnings. |
| [Dose and quality factor](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) (Hassler et al. 2014, Zeitlin et al. 2013, Zhang et al. 2020, NASA OCHMO TB-020) | NASA/JPL-Caltech (MSL RAD) · NASA OCHMO | `datasets/curated/radiation-dose.json` | How harmful radiation is on Mars, in transit and during a storm; NASA's dose limit. |
| [BVAD](https://ntrs.nasa.gov/citations/20210024855) | NASA JSC | `datasets/curated/life-support-bvad.json` | Oxygen, water and food per crew member per day. |
| [NASA-STD-3001](https://www.nasa.gov/ochmo/) (OCHMO TB-004, TB-013, TB-027) | NASA OCHMO | `datasets/curated/nasa-std-3001.json` | Meter limits: CO2, water per day and per walk outside, calories, water recycling, daily exercise. |
| [OSDR](https://osdr.nasa.gov/bio/repo/) (OSD-992, OSD-615, OSD-177) | NASA OSDR | `datasets/curated/osdr-facts.json` | Real science facts about radiation and plants shown when completing missions. |
| [Mars solar conjunction](https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/) (2015 → 2023) | NASA JPL | `datasets/curated/mars-conjunctions.json` | Days without contact with Mission Control on Mars. |
| [Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | NASA JPL SSD | `datasets/curated/planet-elements.json` | Earth–spacecraft–Mars distance by date: Mission Control's signal delay. |
| [Gale Crater facts and names](https://science.nasa.gov/photojournal/mount-sharp-inside-gale-crater-mars/) (PIA15292, PIA26241, PIA26307… and the USGS Gazetteer of Planetary Nomenclature) | NASA/JPL-Caltech · USGS Astrogeology | `src/content/galeTerrain.ts` | Crater size, Mount Sharp, Gediz Vallis, pure sulfur and dunes shown on Mars (each figure with its quote and URL). |

## NASA images

| Image | Author | Game file | Use |
| --- | --- | --- | --- |
| [The Blue Marble (2002)](https://visibleearth.nasa.gov/view.php?id=57752) | NASA Earth Observatory · Reto Stöckli, NASA GSFC | `public/assets/ui/title/earth-map.png` | The Earth spinning on the main menu (reduced to 20 colors). Public domain. |
| [Mars Viking MDIM 2.1](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg) | USGS Astrogeology · NASA Ames | `public/assets/ui/title/mars-map.png` | Mars spinning on the main menu (reduced to 12 colors). Public domain. |
| [PIA15687 — Destination: Gale Crater](https://science.nasa.gov/photojournal/destination-gale-crater-in-august-2012/) | NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS | `public/assets/mars/crater.png` | Gale Crater map with Curiosity's route (V key on Mars). Free use with credit. |
| [Photojournal](https://science.nasa.gov/photojournal/): PIA15292, PIA16056, PIA16156, PIA16705, PIA17080, PIA17587, PIA17595, PIA19930, PIA20283, PIA20755, PIA20841, PIA26241, PIA26245, PIA26307, PIA26309, PIA26410 | NASA/JPL-Caltech/MSSS (Mastcam, MAHLI) · NASA/JPL-Caltech/University of Arizona (HiRISE) | `docs/referencias/gale/` | References for drawing each area outside Gale; not shown in the game. |

The code-hello logo belongs to code-hello; the GitHub mark is a trademark of GitHub, Inc. Both appear in the main menu
(redrawn in pixel art) only as links to the studio's website and to this repository.

Hello Mars is not an official NASA product and is not endorsed by NASA. NASA data and images are used according to
its [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

## AI tools

| Tool | Company | What it did | Files | Process record |
| --- | --- | --- | --- | --- |
| [Devin](https://devin.ai) | Cognition | Coding assistant: code, tools and documentation, directed and reviewed by the team. | — | Git history |
| [Lyria](https://deepmind.google/models/lyria/) | Google DeepMind | Soundtrack: the 12 tracks, one for each moment of the mission; later mastered by the team with `scripts/audio/master-music.mjs`. | `public/assets/audio/music/` | `public/assets/audio/README.md` |
| [ElevenLabs Sound Effects](https://elevenlabs.io/sound-effects) | ElevenLabs | Sound effects and ambiences (doors, alarms, minigames, engines, footsteps…). | `public/assets/audio/sfx/` | `public/assets/audio/README.md`, `docs/produccion/sonidos-variedad.md` |
| [OpenAI Image 2.5](https://openai.com) (via Codex) | OpenAI | Base images: crew, ship, base, objects, icons, logo and launch scenery. | `public/assets/crew/`, `ship/`, `mars/tiles.png`, `mars/props.png`, `hud/`, `minigames/`, `ui/cargo/`, `ui/flight/`, `ui/flags/`, `ui/title/logo.png` | Prompts in `art/prompts/`, originals in `art/raw/`, record in `docs/produccion/pixel-art.md` |
| [Sprite Fusion Pixel Snapper](https://github.com/Hugo-Dz/spritefusion-pixel-snapper) | Hugo Duprez (MIT) | Snaps the generated images to a grid of real pixels and a limited palette. Runs locally (MCP in Docker). | `art/snapped/` | `docs/produccion/pixel-art.md` |

After the Pixel Snapper, the team's scripts (`scripts/art/`) build the tilesets, atlases, crew sheets and normal maps
the game uses.

## Software and libraries

| Software | Author | License | Use |
| --- | --- | --- | --- |
| [Phaser 4](https://phaser.io) | Phaser Studio | MIT | Game engine |
| [TypeScript](https://www.typescriptlang.org) | Microsoft | Apache 2.0 | Game language |
| [Vite · Vitest](https://vite.dev) | VoidZero | MIT | Builds and automated tests |
| [Tiled Map Editor](https://www.mapeditor.org) | Thorbjørn Lindeijer | GPL (the editor; the maps belong to the team) | Ship and base maps (`src/content/maps/`) |
| [FFmpeg](https://ffmpeg.org) | FFmpeg project | LGPL | Music mastering (`scripts/audio/master-music.mjs`) |

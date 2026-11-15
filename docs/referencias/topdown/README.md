# Mission to Mars | Visual references for implementation

**Package version:** 1.0 · **Nature:** concept art and UX references, not final assets.

This package gathers **6 original sheets** and **16 scene crops** taken from four of them, plus `plano-base-marte.png`,
the floor plan of the Gale base that `scripts/maps/build-gale.mjs` follows. The crops are handy for discussing and
planning individual systems, but their resolution is lower: to produce assets they must be recreated at game scale,
not extracted as tiles from these images.

## 1. How to use the package

- `01_laminas_originales/`: the six compositions, unmodified.
- `02_escenas_recortadas/`: four quadrants of each of the first four sheets, identified by number and sector name.
- `plano-base-marte.png`: floor plan of the Mars base.

(The original package also had a `03_documentacion/` folder with a copy of the visual bible and a manifest; it is not
included in this repo. The project's visual bible is [`docs/diseno/biblia-visual.md`](../../diseno/biblia-visual.md).)

Sheets 05 and 06 are **concept boards**, not real game screenshots or importable atlases. Panels 01–04 are **gameplay
mockups**: the generated HUD and texts are illustrative and do not necessarily represent final mechanics, metrics or
copy.

## 2. Consolidated visual rules

### Camera and scale

- Logical reference resolution: **1280 × 720** (FIT scaling).
- World tiled at **48 × 48 px**, per the original bible.
- **Top-down / overhead 2D** camera for every interior module of the ship, the Mars base, the airlock and outdoor
  exploration on the terrain.
- Show **only part of the map** around the active character. Corridors and modules can continue past the edges. Do
  not shrink characters or furniture to fit a whole ship on screen.
- Characters per the bible: source sprites of **176 × 216 px**, shown at about **0.38×** (approx. 67 × 82 px),
  adjusting visually only after testing on-screen legibility.
- An amber marker under the feet identifies the controlled character, plus a top marker when needed. Do not confuse
  the ring with the collision area.
- The camera follows the player with smoothing and world bounds; it can subtly lead in the walking direction. Allow
  stations being used to be fully visible.
- A **side-scroller** is reserved for activities that become clearer with heights, ladders or platforms, for example
  exterior maintenance of an orbital structure. Do not turn ordinary Mars exploration into a platformer.

### Interface

- The map area and interface systems are independent layers. The interface does not move with the camera.
- Per the `Voyage` bible: a **912 px** play area + a **368 px** right panel as a starting point. Validate whether the
  fixed panel is always needed; it can become more compact during exploration.
- Prioritize 3 meters: **energy, air/water and health**, plus crew status, alerts, current goal and a navigation
  minimap.
- At 1280 × 720, use legible text and comfortable click areas, and avoid stacked micro-panels. Values must come from
  the real simulation, **never from the pixels of the concept images**.
- Risks in green/yellow/red **plus** shape/symbol; alerts with an explicit cause and a suggested action.
- **Do not bake text, numbers or typographic logos into the assets.** Spanish/English localization from code.

### Materials and identity

- Ship: lavender greys, tech blue, dark edges, orange and yellow lighting.
- Mars: ochres, rust and dusty pinks; greenhouse with violet light; cyan science indicators.
- Pixel art look with clear shapes, consistent outlines and soft shading. Reduce visual noise in walkable areas.
- Recurring mascots: green frog with a bow, orange character with a monocle, yellow character with goggles, blue one
  with goggles and a quiff, pink one with headphones. **Note:** the narrative bible names four crew members (Vega,
  Miga, Brote, Senda), but the concepts show five mascots and sometimes a human avatar; settle the final cast before
  producing sprites and HUD. (Resolved: the game uses the four crew members.)

## 3. Index of gameplay scenes

| File (in `02_escenas_recortadas/`) | Suggested use | View | Elements to reproduce |
|---|---|---|---|
| `01_01_nave_puente.png` | Bridge during the trip | Top-down | window to Earth, monitors, consoles, interaction, HUD |
| `01_02_nave_emergencia.png` | Environmental incident | Top-down | red lights, alert, shelter/tanks, clear hazard indication |
| `01_03_base_invernadero.png` | Crops and life support | Top-down | rows of plants, grow lights, adjacent machine |
| `01_04_marte_muestras.png` | Sample collection | Top-down | target rocks, rover, tracks, terrain continuing off-screen |
| `02_01_nave_comunicaciones.png` | Radio and console work | Top-down | screens, path to other rooms, command post |
| `02_02_nave_escudo_agua.png` | Radiation alert and shelter | Top-down | blue tanks, alarm signs, route to protection |
| `02_03_base_moxie.png` | Base life and oxygen | Top-down | greenhouse, MOXIE, door/airlock, several stations |
| `02_04_marte_rover.png` | Exploration outing | Top-down | rover, solar panels, rock selection, partial map |
| `03_01_nave_sala_comun.png` | Routine command/communications | Top-down | interaction area, console, adjoining zones |
| `03_02_nave_alerta_radiacion.png` | Emergency state | Top-down | corridor, safe door, signage and red lights |
| `03_03_base_hidroponia.png` | Food production | Top-down | vegetation, tanks, violet lights, distinct equipment |
| `03_04_marte_rocas.png` | EVA sampling | Top-down | highlighted rock, rocky terrain, rover, minimap |
| `04_01_nave_radio.png` | Everyday communications | Top-down | console, astronaut with radio, windows |
| `04_02_nave_tormenta.png` | Urgent storm response | Top-down | route to the shelter, warning icons, active system |
| `04_03_base_sistemas.png` | Repair and farming | Top-down | generator, greenhouse, machinery, exit to Mars |
| `04_04_marte_paneles.png` | Energy and sample management | Top-down | solar panels, rover, scrolling terrain |

### Overview sheets

- `05_catalogo_de_escenas`: outline of locations and mechanics, including side-view orbital maintenance, different ship
  modules and visual resources.
- `06_biblia_visual_ilustrada`: organization of the scenery families, interface and palette; useful for art
  discussions and consistency reviews.

## 4. Mapping to game systems

| Visual family | Bible scenes | Recommended implementation |
|---|---|---|
| Bridge / communications / corridors | `Voyage`, `MissionControl` | walkable tilemap, interaction zones, follow camera, radio UI overlay |
| Infirmary / pantry / exercise | `Voyage` | interactive props, character states and tasks with progress |
| Water / CO₂ / solar emergency | `Voyage`, `Hud` | machine sprites, alert variants, path to the shelter, system state |
| Greenhouse / MOXIE | `Mars` | accessible room, interactive station, working/broken states and changing lights |
| Airlock / outside Mars | `Mars` | transition without a scale break, camera following the player, EVA limits |
| Rover / sampling / panels | `Mars` | pickup objects, points of interest, collision barriers and dust effects |
| Flight maneuvers | `Maneuver` | dedicated timing and control screens: not to be confused with cinematics |
| Side-view maintenance | special proposal / EVA | playable side-scroller level only when verticality adds a real mechanic |
| Planning / data / log | `Planning`, `DataPanel`, `DataCard`, `Report` | UI independent of the map, generated in code; data from real sources |

## 5. Asset production: suggested order

1. **Lock scale and camera:** prototype with 48 px tiles, a ~82 px tall character, side panel and smooth scrolling;
   test at real size on an HD monitor.
2. **Modular tilesets:** floor, walls, doors, windows, corridors, corners and joints, with edges that allow continuity
   while scrolling.
3. **Props per room:** console, bike, scrubber, recycler, beds, pantry, shelter, radio, MOXIE, crops and airlock. Create
   opaque/transparent sprites as needed, and interaction points.
4. **Mars terrain:** tileable sand, stones, cliffs, tracks, rover, panels and sample rocks. Day/night/storm versions; do
   not paste the whole scene as a single image.
5. **Characters and animations:** settle cast and scales; walking in four directions, task, idle, EVA and shelter.
   Prepare a hitbox separate from the art.
6. **UI kit:** meters, boxes, tabs, portraits, alerts, minimap, dialogs and buttons, all with programmatic text.
7. **Damage and ambience states:** light grid, broken machines, flicker, dust, low power and the worn ship on the way
   back.
8. **Specific side-view scenes:** first prototype the need for jumping/ladders/traversal before producing a
   side-scroller tileset.

## 6. Technical integration rules

- Intended destination per the bible: `public/assets/ship/`, `public/assets/mars/`, `public/assets/ui/`,
  `public/assets/characters/` (in the final game, characters are in `public/assets/crew/`).
- Keep separate: `background`, `world_tiles`, `props`, `characters`, `interaction_markers`, `world_fx` and `screen_ui`.
- Each interactive prop should have: `id`, tile position, collision area, interaction point, states and a translatable
  label.
- Indoors, make upper layers transparent when they hide the player.
- The minimap shows the whole world or the explored part, regardless of the area visible to the camera.
- Scale to the monitor with FIT and test UI legibility at 100% and 125%; do not let the concept screen dictate
  collision sizes.
- Colors and numbers drawn on the sheets are not exact data samples or verifiable results.

## 7. What NOT to do

- Do not use the four quadrants of a sheet as a single playable background.
- Do not stretch a screenshot to 1280 × 720 to turn it into a real scene; these are references, not tile renders.
- Do not squeeze the whole map into a single screen or change the character scale between areas.
- Do not make a cinematic for an action that requires player control.
- Do not turn all of Mars into a side-scroller for looks: the main route is top-down.
- Do not automatically extract text from the mockups: write the content from the real UI.
- Do not implement made-up metrics that appear in the images.

## 8. Coverage and limits

These **six** sheets are the latest generated references. The first four yield 16 crops and the other two are summary
boards. **They do not cover every production state** of the bible: the menu, loading, loadout, maneuver stages,
planning, science data, pause, results and several incidents had to be designed separately. That does not mean they
are missing from the document: it means this package's artwork does not specify them at final-screen level.

The visual compositions contain automatically generated text or HUD elements and some character inconsistencies. For
the final game, **the bible's rules and the agreed design decisions** apply, not the accidental details of these
illustrations.

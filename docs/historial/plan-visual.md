# Visual plan — from rectangles to the look of the reference sheets

> **Historical document.** The plan is closed; whatever was left undone was dropped for the released version. Index: [`docs/README.md`](../README.md).

Plan for bringing `Voyage` and `Mars` to the look of the references in [`topdown/`](../referencias/topdown/README.md). It complements [`biblia-visual.md`](../diseno/biblia-visual.md) (which pieces are needed) and [`plan-de-trabajo.md`](plan-de-trabajo.md) (who owns each file). Sound is out of scope for now.

Status: **Phases 0–6 done** (ship, Mars, effects and dashboard). The wrap-up (Phase 7) is missing: [§ 8. Pending items](#8-pending-items-in-order).

---

## 1. Starting point

- `SimulationMapScene.drawMap()` paints everything with rectangles. The only graphic assets are the 4 crew sheets in `public/assets/crew/`.
- The ship is 19 × 15 tiles with 4 × 4 rooms: it fits entirely on screen. Mars is 48 × 15, with a 25 × 13 exterior.
- In the sheets a tile takes about 72–76 screen px and the character about 115 px: about 13 × 10 tiles are visible, not 19 × 15.
- The sheets are concept art: tiles are not cut from them. They show five mascots; the game keeps **Vega, Miga, Brote and Senda** and their current sprites.

## 2. Requirements of the request

| Requirement | How it is met |
|---|---|
| Images created with codex-cli (image generation) | `codex exec --enable image_generation`, with `docs/referencias/ref-nave.png` and a reference crop attached (§4) |
| Transparent background | Real alpha is requested; if it does not come, a magenta background is removed with a script |
| Right resolution | One art pixel = 2 world px, camera zoom 1.5 (§3) |
| Large spaces with a following camera | Enlarged maps and following on both axes (Phase 2) |
| Aligned pixels | Every image goes through the pixel-snapper MCP before being saved |
| Special effects | Particles, lights, shaders and shakes (Phase 5) |
| Real Gale morphology | Exterior as a compressed cut of Curiosity's real route (Phase 4) |

## 3. Scale decisions

| Topic | Decision | Reason |
|---|---|---|
| Art pixel | 1 art pixel = 2 world px: **24 art px per tile** | Gives the level of detail of the sheets; `TILE = 48` is not touched |
| Camera zoom | **1.5** in `Voyage` and `Mars` | Each art pixel ends up as exactly 3 screen px, with the framing of the sheets (12.7 × 10 tiles) |
| Final files | Exported ×2 with nearest neighbour | Respects the multiples-of-48-px convention, without per-sprite scales |
| Crew | Same sheets, about 1.6 tiles tall | See the Phase 0 results |
| Palette | A fixed one per domain (ship, base, Mars), passed to the snapper in `palette` | Consistency between pieces generated separately |

With a generated 1536 × 1024 image and a fake pixel of 4–8 px, between 8 × 5 and 16 × 10 usable tiles come out: each image is **one room or one object**, never a whole map.

## 4. Image production line

1. **Manifest** `scripts/art/manifest.json`: id, prompt, size in tiles, palette, pixel size, states and destination.
2. **Generation** with Codex: a common prompt template (3/4 top-down view, dark outline, no text, transparent background, a single object). The originals stay in `art/raw/`.
3. **Cleanup** with the pixel-snapper. The MCP only sees `C:\code-hello\mcp-snapper\assets`: the image is copied there, `snap_pixels` is called with a fixed palette and pixel size and checked with `pixel_preview`.
4. **Post-processing** (`scripts/art/`, Pillow): binary alpha, cropping, fitting to exact multiples of 24 px, ×2 export and a contact sheet.
5. **Quality check per piece:** no text, silhouette legible at real size, no halo, correct palette. If it fails, it is regenerated with a single change in the prompt.
6. **Record:** the prompt is noted in the `README.md` of each folder in `public/assets/`.
7. **Normal maps:** `python scripts/art/normals.py` generates `<asset>_n.png` with Sprite Fusion's generator ("Sprite Normals", MIT; the same one behind the free `create_normal_map` tool of their MCP), built in Docker (`docker build -t sprite-normals:local scripts/art/normals`) and offline. It works at art resolution: it halves the asset, generates and scales back up ×2. Grid sheets use `--frame-size` so the relief of one cell does not bleed into its neighbour. Rebuilt every time an asset changes.

## 5. Phases

### Phase 0 — Validate scale and tools

1. A grey prototype with enlarged maps and configurable zoom (`&zoom=` and `&layout=large`).
2. Measure the real grid of the crew sheets and try the snapper on one.
3. End-to-end test with 3 pieces (console, water tank, rock): generate, remove background, snapper, see it in the game.
4. Confirm that `codex exec` delivers real transparency.

**Output:** scale and zoom settled, and a screenshot compared with `02_escenas_recortadas/01_01_nave_puente.png`.

### Phase 1 — Production line

Set up and test everything in §4 (manifest, scripts, palettes per domain, contact sheet).

### Phase 2 — Large maps (code)

1. **Layout:** `ShipLayout` accepts rooms of any size, obstacles and an explicit work spot per zone.
2. **Ship:** about 41 × 19 tiles or more, with 9–12 × 6–8 rooms and a 3-tile corridor.
3. **Gale base and exterior:** an exterior of about 70 × 45 with a walkable terrain mask (cliffs, crater, dunes).
4. **Rendering:** `drawMap()` is replaced by layers: background, floor and walls, objects sorted by Y, a semi-transparent upper layer when it hides the player, effects.
5. **Camera:** smooth following on both axes, with a slight lead in the walking direction.
6. **Asset loading:** in the simulation scenes' `preload`, so as not to touch `assets.ts` or `BootScene` (Facundo's).
7. **Rules:** adjust crew speed and sample placement so `fullGame.test.ts` keeps passing.

### Phase 3 — Ship (`public/assets/ship/`)

- **Room pieces:** each room is a floor-plus-walls image with doors in standard positions. It is the realistic way to get the walls with pipes and chamfered corners of the sheets.
- **Objects per room:** command (big window and consoles), exercise (bike), scrubber (machine with pipes), recycler (tanks), infirmary (beds), pantry (shelves and boxes), shelter (blue tanks and hazard stripe), radio (console and antenna).
- **States:** normal, broken and worn for the return; amber and red lights.
- **Windows:** a transparent cutout with stars, Earth and the Sun behind, drawn in code. The Sun shrinks with the real distance.

### Phase 4 — Mars and Gale's real morphology (`public/assets/mars/`)

**Base:** the same pieces in a warm, dusty version, plus a greenhouse with violet light, MOXIE, a two-door airlock, and modules, panels, antenna and beacons seen from outside.

**Exterior:** a compressed, **not to scale** cut of Curiosity's real route, from north to south. Each strip teaches a landform:

| Strip | What is seen | What the kid learns |
|---|---|---|
| Plain (Aeolis Palus) | Ochre ground, rounded pebbles | The round pebbles were polished by an ancient river |
| Lakebed (Yellowknife Bay type) | Light rock in cracked plates | There was a lake here billions of years ago |
| Bagnold Dunes | Dark sand with ripples | The wind still moves the sand |
| Buttes (Murray Buttes) | Layered mesas | Each layer is a page of Mars's history |
| Gediz Vallis channel | Channel with debris and pale rocks | Rocks with yellow sulfur crystals |

- **Real date:** Curiosity has been exploring the Gediz Vallis channel since February 2024 (the whole stay in the game) and found pure sulfur crystals on 05/30/2024 (sol 4200, "Convict Lake" rock; MAHLI photo [PIA26307](https://www.jpl.nasa.gov/images/pia26307-curiosity-captures-close-up-of-sulfur-crystals/) and Mastcam PIA26309). It justifies where it is parked and gives a "This really happened" card.
- **Crater map:** an overview (154 km crater, Mount Sharp 5.5 km above the crater floor in the center, "you are here") making clear that the playable map is compressed.
- **Sources (done, 11/15/2026):** figures verified one by one and HiRISE and Mastcam photos for each strip; quotes in `src/content/galeTerrain.ts` and `datasets/README.md`, photos in `docs/referencias/gale/` (see "Mars progress").
- **Pieces:** tiled ground with variants, modular cliffs and crater rim, rocks in 3 sizes, sample rocks per type, tracks, clean and dusty Curiosity.
- **Rock types** (decided): each sample has a type, a sprite and a fact for kids, plus an achievement for collecting every type; it does not change the score. It touches `core/mars`, i18n and `achievements.ts` (Facundo's).

### Phase 5 — Effects (no sound)

- **Particles:** dust in the air and underfoot, air leak, vapor, sparks, bubbles in the tanks.
- **Light:** additive glow on lamps and the greenhouse, night with clipped lights, a red alarm pulsing at fewer than 3 flashes per second.
- **Shaders:** dust storm, haze and alert tint. Before that, read the Phaser 4 guides in `node_modules/phaser/skills/`.
- **Camera:** shake on micrometeorite and at the storm peak; fade at the airlock.
- **Details:** fading tracks, flickering screens, swaying plants.

### Phase 6 — Dashboard and map interface

- **Dashboard** (`public/assets/hud/`): frame, meter and health icons, small portraits, minimap.
- **On the map:** bubbles with icons, an amber selection frame and arrows to the shelter instead of text signs.
- **Outside this plan:** menu, maneuvers, cards and report (Facundo's; the sheets do not cover them).

### Phase 7 — Wrap-up

- `npm test`, `npm run typecheck` and `npm run build`.
- Compare screenshots against the 16 crops and measure performance.
- Update `AGENTS.md`, `biblia-visual.md` and the asset READMEs.

## 6. Risks

- **Consistency between generated images:** fixed palette, the same references in every call and generation by families.
- **Rules affected by large maps:** caught by `fullGame.test.ts`.
- **Facundo's files:** a crew scale change touches `CrewSprite.ts`; it must be coordinated.

## 7. Decisions made (11/15/2026)

| Topic | Decision |
|---|---|
| Zoom | 1.5, confirmed with the Phase 0 prototype |
| Maps | **Modular tileset** and maps in **Tiled JSON** (`src/content/maps/*.json`): tile layers (floor, walls, upper) and object layers (zones, objects with their collision box). Phaser loads them natively with `TilemapGPULayer`; the `core` rules read the zones from the same file through `src/content/tiledLayout.ts` |
| Crew | The sheets are regenerated as real pixel art, with the current ones as reference, and go through the pixel-snapper. `CrewSprite.ts`, `assets.ts` and `public/assets/crew/` are edited |
| Rock types | In now: each sample has a type, a sprite and a fact for kids, plus an achievement for collecting every type. **It does not change the score** |
| Review | Pause once the whole ship is done, before Mars |

## 8. Pending items (in order)

To resume in a new chat: read `AGENTS.md`, this document and the screenshots in `art/capturas/` (development screenshots were later removed from the repo; they remain in the git history). Start with the first item not done.

1. ~~**Mars — ambience**~~: done (see "Ambience: day, night and storm" in "Mars progress").
2. ~~**Missing effects (Phase 5)**~~: done (see "Phase 5: effects").
3. ~~**Dashboard and interface (Phase 6)**~~: done (see "Phase 6: dashboard and interface").
4. ~~**Rework based on the crops (Phase 7)**~~: done (see "Phase 7: rework based on the reference crops").
5. **Wrap-up:** compare with the remaining crops (infirmary, MOXIE, exterior), measure performance.
6. **New Gale base — its own art** (the base already follows the floor plan, see "New base following plano-base-marte.png"): plastic floor and walls for the tubes (they use the corridor tiles today), door leaves for the side doors (today a gap with a hazard stripe), the parked ship as a sprite (today a tile cabin with engines drawn in code in `MarsScene.drawShip`), fuse boards and battery cells (today monitors and tanks) and dashboard icons for power, workshop, storage, battery and ship (they use other atlas icons today).

Loose details:
- Automatic crew members overlapping in the same room (`SLOTS` positions in `HabitatSession`).
- Confirm on a 144 Hz screen the fix for the jitter and the camera (only tested at 60 Hz).
- `maxLights` (10 per camera) is in `config.ts`, frozen: check whether it is enough on Mars.
- Gale: the strip signs are still text (they are real place names; there is no icon to replace them) and the notice with each strip's fact appears once per visit to the scene. The automatic crew coming back from outside is guided by `exteriorPath`; the player collides with the terrain per tile, so it is worth testing by hand that they do not get stuck at the corners of the buttes.
- Gale assets left for later: transitions between strips (today the edge is a tile step), more variants of the Mount Sharp top (it repeats a lot), leaves for the airlock's outer door (today only the hazard stripe and the red mark), rover tracks (tile 38, unused) and the base windows (not added: there are no `SpaceWindows` on Mars; they would need a Martian sky). The samples are ~1.5 tiles: if they look big, regenerate them smaller.
- The bundle exceeds Vite's 2000 kB warning (2.1 MB; `gale.json` adds ~40 kB).
- Tell Facundo about the new `allRockTypes` achievement in `src/content/achievements.ts` (his) and about `Sample.rock` (optional, it does not change the score or the return cargo). The report and `Loadout` do not show each sample's type yet.
- Tell Facundo about the changes in his crew files (`CrewSprite.ts`, `assets.ts`, `crewAnimations.ts`, `TitleScene.ts`, 80 × 96 sheets with normal maps) and about the icon bubble in `CrewSprite.ts` (Phase 6).
- Old documentation: `biblia-visual.md` (rules table) and `plan-de-trabajo.md` §3.8 still say 176 × 216 frames; the references README mentions `03_documentacion`, which does not exist.
- Decide whether `art/` (~39 MB of originals) is versioned or goes into `.gitignore`.
- Sprite Fusion MCP: optional, not configured (the local Docker generator is used).

---

## Phase 0 results

Done on 11/15/2026. Originals, Codex logs and screenshots in `art/raw/fase0/`.

### Scale and zoom

- **Confirmed: 24 art px per tile and zoom 1.5.** In `capturas/voyage-z1.5.png` the sheet's pieces (a 2-tile console, a 1 × 2 tank) end up with 3 screen-px pixels and the sheets' proportion relative to the crew member (~100 px tall).
- With zoom 1 too much map is visible and everything looks small; with zoom 2 only 9.5 × 7.5 tiles fit.
- Pieces at 48 art px per tile (`b-*`) end up with 1.5 screen-px pixels, uneven: discarded.
- The camera now covers only the map view (912 px) and follows the player on both axes; the dashboard has no zoom. The notice and the final message are pinned to the screen with `pin()`.

### Generation with Codex

- `codex exec --enable image_generation -s workspace-write -i docs/referencias/ref-nave.png - < prompt.txt` works without intervention: it generates, copies to the requested folder and takes 1–2 minutes per run.
- **Transparency: real** (1254 × 1254 RGBA PNG), but the body comes with alpha 250–254 and soft edges. The alpha must be binarized before the snapper (`scripts/art/pre.py`). The magenta background was not needed.
- **One object per image comes out too big:** 105–152 art px (4 to 6 tiles), each image with a different pixel size (8, 11 and 12 px).
- **A 2 × 2 sheet of objects comes out at the right size:** 39–44 art px per object (about 2 tiles), all with the same pixel size. **Rule: generate in sheets of 4 objects of the same family**, asking for "as drawn on a 128 × 128 canvas". The prompts used are in `art/raw/fase0/prompt.txt` and `prompt2.txt`.
- To test in Phase 1: 3 × 3 sheets and large pieces (a whole room).

### Pixel-snapper

- On the generated images it works well with automatic detection and `color_count: 32`: clean outlines, binary alpha, 29–34 colors.
- The output size is not exact: it depends on the detected grid. Fitting to multiples of 24 px is done by `scripts/art/post.py` by padding, never rescaling.
- **It does not work for the crew sheets.** They are not grid pixel art (10 836 colors in one frame, 1 px strokes): the snapper erases the faces and changes the spacing between frames (`crew-snap-compare.png`). The crew stays as is; at zoom 1.5 it sits well with the new pieces, although with a finer stroke. To match them, the sheets must be regenerated (Facundo's), not filtered.

### Tools that remained

| File | What for |
|---|---|
| `scripts/art/pre.py` | Binary alpha and copy to the snapper's folder |
| `scripts/art/post.py` | Cropping (also per cell of a sheet), padding to the grid and ×2 export |
| `scripts/art/capture.mjs` | Screenshot of a scene with headless Chrome, with optional keys. `chrome --screenshot` alone often fails with WebGL |
| `&zoom=`, `&layout=large`, `&props=1` | `?scene=Voyage` and `?scene=Mars` parameters for testing scales |
| `SHIP_LAYOUT_LARGE`, `GALE_LAYOUT_LARGE` | Enlarged test layouts (41 × 19 and 90 × 31 tiles) with `habitatLayout()`; removed when the Tiled maps arrived |
| `prototypeProps.ts`, `public/assets/proto/` | Test pieces; removed when the final assets arrive |

### Decisions that change from the plan

- §4, step 2: the generation unit is the **4-object sheet**, not the single object.
- §3, crew: it does not go through the snapper.
- The enlarged maps are only for testing: the normal game keeps the small layouts until Phase 2.

---

## Ship progress

Done on 11/15/2026. Screenshots of the eight rooms were in `art/capturas/nave-*.png`.

### What remained

- **Tiled map:** `src/content/maps/ship.json` (41 × 20 tiles, 9 × 6 rooms, 2-tile doors). Built by `node scripts/maps/build-ship.mjs` as a starting point; then edited in Tiled (running the script again overwrites manual changes). `src/content/tiledLayout.ts` extracts the rules layout, objects and walls from it; `tiledLayout.test.ts` checks that map and rules match and that no object blocks a work spot.
- **Rendering** (`TiledMapView.ts`): floor in `TilemapGPULayer`, walls in a common layer with tilemap collision, objects from an atlas (`load.atlas`) sorted by their foot, collision boxes in a static group. Zoom 1.5 by default. The GPU layer is only used for the floor: in Phaser 4.2.1 it tints empty tiles, so it does not work for sparse layers.
- **Tileset** `public/assets/ship/tiles.png`: 24 tiles of 48 px (4 floors, 4 special floors, 4 wall fronts, ceilings, grating, space, door frames and door leaves).
- **Objects** `public/assets/ship/props.png` + `.json`: 31 sprites (including the worn ones), listed in `art/manifest.json`.
- **Crew** regenerated as pixel art: 720 × 384 sheets (80 × 96 frames), 36 to 42 art px tall.
- **Rules touched:** the ship is longer, so the player walks at 210 px/s and the crew at 4.5 tiles/s. `ShipZone` allows doors several tiles wide and a work spot of its own.

### What we learned about generation

- **Tiles:** ask for 2 × 2 sheets (not 4 × 4: they come out too detailed) and pass **each tile separately** through the snapper with a fixed `pixel_size` (1254 / 48 = 26.125). Automatic detection fails on plain tiles. The snapper returns 24–28 px per tile: `scripts/art/tiles.py` fixes it by removing repeated lines, without rescaling.
- **Crew:** a whole 9 × 4 sheet at once comes out deformed. One 3 × 3 image per direction works, with the original strip for that direction as reference; the right profile is mirrored. **Animation sheets do not go straight to the snapper:** first `regrid.py` (see Bugs fixed) and then `snap_pixels` with `pixel_size: 8`.
- **Batches:** `scripts/art/batch.sh` runs up to 4 Codex generations at once.

### Full ship (second pass)

- **Sliding doors:** frame and leaves in the tileset (the right leaves are the left ones mirrored). The leaves open when someone approaches, cropping (`setCrop`) as they slide into the wall, in one-art-pixel steps. Variants with a red light for locked doors (Mars airlock).
- **Windows:** `atlas.py` makes the glass transparent and records its rectangle (`frame.customData.glass`). Behind it (`SpaceWindows.ts`) there are drifting stars, the Sun, which shrinks with the leg's real distance (`cruiseDistanceAu`: 6 art px radius near Earth, 4 near Mars), and the destination planet, which grows as it gets closer.
- **Lights and alarms** (`HabitatFx.ts`): stepped additive glow on light strips and lamps; amber with a 1 Hz pulse during alert and red at 2 Hz on impact (never more than 3 flashes per second). The alarms rotate with two beams. During a power cut, darkness and only red emergency lights.
- **Breakdowns:** sparks (yellow) plus smoke (red) at the scrubber, the recycler and the radio, with a glow in the traffic-light color. A micrometeorite leak releases air and the impact shakes the camera.
- **Worn ship** (return): tape, loose cables, soot and grease (`props-desgaste`), and 30 % of the lights flicker.
- **Wall edges:** a one-art-pixel outline and light line where the wall top meets the floor.
- To see it without waiting for it to happen: `?scene=Voyage&fx=alert|impact,powerOut&broken=scrubber,waterRecycler:yellow` and `&leg=back` for the worn ship.

### Bugs fixed

- **Jittering automatic crew members:** they moved with an "arrive this frame" velocity, but Arcade advances in fixed 1/60 s steps; on a 144 Hz screen they overshot and came back. Now the scene places them where the session says (`body.moves = false`) and only keeps a smoothed velocity for the animation.
- **Sprites stretching at rest:** the snapper fits its grid to the generator's irregular "pixels", and each frame of the sheet came out with 2 or 3 columns too many or too few (the helmet in profile measured 21 or 24 art px depending on the frame). Now `scripts/art/regrid.py` resamples each frame on an even grid anchored to its outline before the snapper, `crew.py` repeats the first frame's helmet across the row and idle is a single frame with a blink (1.7 s + 1.5 s still and 0.14 s with eyes closed).
- **Uneven pixels with zoom:** everything on the map uses `setVertexRoundMode('full')`; with zoom 1.5 each art pixel always measures 3 screen px.
- **Everything kept moving after stopping, and out of sync:** Phaser's camera followed the player with a lag (lerp 0.15 per frame) and ended up between two screen pixels, so each object rounded on its own; also the ring, the name and the help were placed before physics (one frame behind) and the player moved in fixed 1/60 s steps. Now the camera is our own (`followCamera`): a 96 × 64 px dead zone without lag (it stops in the same frame as the player), always on a whole screen pixel, and it travels for 0.35 s when switching crew member. Everything that depends on position is placed after physics (`afterPhysics`) and physics runs at a variable step.

### Dynamic lighting (normal maps)

- The tileset, the object atlas and the crew sheets have normal maps; Phaser loads them with `load.image(key, [url, normal])`, `load.atlas({ normalMap })` and `load.spritesheet({ normalMap })`.
- Everything on the map uses `setLighting(true)` (additive glows and texts do not). `HabitatFx` sets the ambient light according to the state, a ceiling light per room and per corridor section, one per lamp, one per alarm (pulsing with the alert) and a flash with the sparks. During a power cut the darkness comes from the ambient light.
- Phaser lights up to 10 lights per camera (`maxLights`, in `config.ts`): it uses the ones closest to the center.
- Why the local generator and not the MCP: the MCP requires logging in (OAuth) to Sprite Fusion and returns each map as an image to save by hand; the CLI does the same in batch, offline and with a repeatable result.

### Left for other phases

- Zone and station signs are still text (Phase 6: icons).
- ~~`GALE_LAYOUT` (Mars) keeps its rectangles until Phase 4~~: it now comes from `gale.json` (see "Mars progress").

---

## Mars progress

Done on 11/15/2026. Screenshots were in `art/capturas/gale-*.png` (`gale-mapa.png` is the overview).

### Sources (before drawing)

- Figures verified against NASA: a **154 km** crater; Mount Sharp **5.5 km** above the crater floor (the plan said ~5; NASA uses both, 5 rounded); a crater more than 3 billion years old; Curiosity at Gediz Vallis **since February 2024** (channel ~91 m wide); pure sulfur on **05/30/2024, sol 4200** (photo PIA26307 is from MAHLI, not Mastcam; the Mastcam one is PIA26309, from 06/07).
- Each strip has its real place, what to draw, the quote and 2–5 photos (HiRISE and Mastcam): `GALE_STRIPS` in `src/content/galeTerrain.ts`. The photos (1600 px, public domain) are in `docs/referencias/gale/` with their README; the figures table, in `datasets/README.md`.
- Kid-friendly texts for each strip in `mars.terrain.<id>.name|fact` (es and en).

### Tiled map

- `src/content/maps/gale.json` (72 × 72 tiles) is built by `node scripts/maps/build-gale.mjs` (it overwrites manual edits). The base is the same 8 rooms of 9 × 6 as the ship plus the **airlock** (6 × 6) in the bottom row, with a door to the corridor and another to the outside, aligned. Outside, from north to south: the Aeolis plain (with the base and loose rocks), the Yellowknife Bay lakebed, the Bagnold dunes (crests that cannot be walked on), the Murray buttes (mesas) and the Gediz Vallis channel between the slopes of Mount Sharp, with boulder mounds, the sulfur field and Curiosity.
- **Terrain mask:** the exterior is the whole map except the border; what cannot be walked on comes from the `paredes` layer and the object boxes (`ExteriorLayout.blocked`). `zoneAt` checks the corridor before the exterior. The outer door is 2 tiles wide (`doorTiles`). The script fails if there is terrain that cannot be reached from the airlock, and `tiledLayout.test.ts` checks it again.
- **Paths:** `exteriorPath` (breadth-first search over tiles plus straight-line shortcuts) guides the automatic crew outside; `route` and `routeToPoint` use it. Samples only fall on walkable terrain; `valuePerTile` dropped to 1 because the exterior is bigger (the farthest still worth ~70) and the crew walks at 4.5 tiles/s as on the ship.
- **Extra layers in `zonas`:** `terrain` rectangles (one strip each, `GALE_TERRAIN`) and `landmark` points (`curiosity`, `GALE_LANDMARKS`).
- **Tileset:** first a temporary one drawn in code; replaced by the assets below.
- **Scene:** `MarsScene` paints the map with `TiledMapView` (wall edges only on the base's ceilings: `rimTiles`), places Curiosity at its point, signs with each strip's name, a notice with the real fact on entering each one and a night veil over the exterior only. `GALE_LAYOUT_LARGE`, `habitatLayout`, `&layout=large` and the rectangle map were removed. To test: `?scene=Mars&at=<strip>|curiosity`.
- Overview without opening the game: `python scripts/maps/preview.py <map.json> <output.png> [scale]`.

### Mars assets

- **Tileset** `public/assets/mars/tiles.png` (48 tiles): the base is the ship tileset with the palette shifted from lavender to toasted beige and dust specks on the floors (`scripts/art/gale-tiles.py`; the shelter's blue floor and the blue and orange lights are kept). The ground is 22 tiles generated with Codex in 6 sheets of 2 × 2 (`gale-*`), with the photos in `docs/referencias/gale/` attached as color and material references; each tile went through the snapper on its own with `pixel_size: 26.125` and was assembled by `tiles.py` (`art/tiles-gale.args`). `gale-tiles.py` also removes the edges that showed as seams when two tiles repeat (`EDGE_FIX`).
- **What we learned:** with "tiles that tile seamlessly" the generator sometimes draws patches over another background (the gravel and the sulfur came out as islands on dark sand); asking for "completely covered ... edge to edge, NO patches" fixed it (`gale-canal`). Check each tile repeated 3 × 3 before accepting it.
- **Objects** (`public/assets/mars/props.*`, group `mars-props` in `art/manifest.json`, which includes the ship's): greenhouse with violet light, golden MOXIE, suit on its rack, dusty crate, clean and dusty solar panels, antenna, beacon, rocks in 3 sizes, angular block, one sample per strip, clean and dusty Curiosity and a sample tube. All came out right in the first batch (5 sheets).
- **Normal maps** for both (`normals.py`); the Gale map now receives dynamic lighting (`normals: true`).
- **Map** (`build-gale.mjs`): greenhouse with 4 planters, MOXIE in its room (it is the machine that sparks when it breaks down), suit and crate in the airlock; outside, 5 solar panels, the antenna, two beacons next to the door, big rocks and blocks as objects with collision (they block their tile) and 60 small and medium stones in `decorado` (they can be walked over). Curiosity (dusty) is an object with collision in the channel.
- **Scene:** each sample is drawn with its strip's rock and a ring at its feet (the blue arc is the progress); the ceiling edges use the warm palette (`rimColors`) and are also on the buttes, the crests and Mount Sharp.
- To test in daytime: `&from=2024-05-16T12&length=long` (`from` accepts an hour; with `length=short` the game started at midnight of the next day).

### Rock types and achievement

- **Types** (one per strip, `GALE_ROCKS` in `src/content/galeTerrain.ts`, with its source): conglomerate (plain), lake mudstone (Yellowknife Bay), basalt sand (Bagnold dunes; NASA calls them "basaltic Bagnold sands"), layered sandstone (Murray buttes) and pure sulfur (Gediz Vallis).
- **Rules:** `MarsContent.samples.rocks` says in which strip each type appears. `sampleSites` spreads the samples across the strips in order (8 samples for 5 types: there is always one of each) and only places them where there is room around to reach them (not stuck to a rock or a slope). Each sample carries `rock` (also in `Sample`, optional for old games, and in the history's `mars.log.sample` entry). **The score does not change.**
- **Achievement** `allRockTypes` ("Rock collector"): collect one of each type on Mars, even if not all of them fit in the ship afterwards (read from the history).
- **Scene:** each sample is drawn with its sprite (`sample-<type>`; the atlas ones were renamed) and when collected a notice says which rock it is and its fact for kids (`mars.rock.<type>.name|fact`, `mars.rock.collected`). Curiosity's bubble is now centered above the rover (it went off screen).
- **Tests:** one sample of each type in its strip with 20 seeds, free room around each one, the achievement, the text keys, and that each source is from NASA, each photo exists in `docs/referencias/gale/` and each type has its sprite (`galeTerrain.test.ts`).

### Crater map and sulfur card

- **Image:** `public/assets/mars/crater.png` comes from a real photo, PIA15687 (top view of Gale, NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS), with `python scripts/art/crater-map.py`: the landing ellipse drawn on the photo is erased, it is reduced to 200 × 200 art pixels with 28 colors and exported ×3 (each art pixel measures 3 screen px, as on the game map).
- **Georeference:** the 2012 ellipse (20 × 7 km, centered at 4.5965° S, 137.4019° E) gives the scale (1.18 art pixels per km) and the anchor. With that, the 154 km rim lands right on the crater's (checked with `--check`, in `art/raw/crater-check.png`). Places have coordinates from cited sources (`GALE_PLACES`: crater center, Mount Sharp and Gediz Vallis from the USGS gazetteer; Bradbury Landing from Malin et al. 2017) and `craterPoint` places them on the image. From the landing site to the north end of Gediz Vallis it is 11 km in a straight line.
- **View** (`CraterView.ts`, drawn by the dashboard on Mars): opens with **V**, and on its own on arriving at Gale; it pauses the clock. It shows the dotted 154 km rim, Mount Sharp (5.5 km high), where Curiosity landed and where it is today, the scale and north, and a ×6 magnifier over the route with the map's five strips in order and a cross blinking on the player's row ("you are here"; the position comes from `SimSnapshot.activePosition`). A text explains that the game shrinks those 11 km.
- **Sulfur card:** `MarsContent.realMoments` (only `SULFUR_EVENT` for now): when the clock passes noon on 05/30/2024, `MarsSession` publishes `realEvent:shown` (the flow opens the "This really happened" card) and logs it in the history only once. Sol 4200, APXS and MAHLI, with the link to PIA26307. The 2024 campaign now has three cards on Mars (storm, dust and sulfur).

### Ambience: day, night and storm

- **Sky** (`MarsSession.sky`): the Sun's height (`sunAt`, the same sine from 6 to 18 used for power), the day's dust (f_dust from real REMS UV) and whether a dust storm is under way. `marsSky.ts` turns it into an ambient light color: dark blue night, bluish sunrise and sunset (on Mars the sky looks blue around the setting Sun), caramel noon; dust dims it and turns it ochre, and the storm even more.
- **Dynamic light** (`HabitatFx`, with `outdoor`): the ambient light is the sky's across the whole map; with a dark sky the base's ceiling lights go up (`NIGHT_ROOM_BOOST`), so at night the base glows and its light spills outside. The fixed night veil was removed from `MarsScene`.
- **Power cut:** with an exterior, only the base rectangle (`interior`) darkens to a power cut's brightness; outside, the sunlight stays. At night no veil is needed.
- **Outdoor lights:** at dusk the beacons next to the airlock turn on (pulsing slowly) and a helmet lamp (cone light, Phaser 4.2's `setCone`) for each crew member outside, pointing where they walk; the player's also has a small light around them. They use few lights: the player's cone is the closest to the camera center and never falls outside the 10 (`maxLights`).
- To test: `&from=2024-05-16T12|T17|T22` (noon, sunset, night), `&fx=storm` (forced storm) and `&fx=powerOut`. Screenshots were in `art/capturas/ambiente/`.

---

## Phase 5: effects

Done on 11/15/2026. Screenshots were in `art/capturas/ambiente/`.

- **Living details** (`MapLife.ts`, on the ship and at the base): screens that breathe and flicker now and then (and turn off in a power cut), bubbles rising in the tanks, vapor coming out of the tanks and the recycler now and then, and the plant's leaves swaying (a cropped copy of the sprite that rotates slightly around the base of the leaves; the pot stays still). The rectangles of screens, liquid and leaves are measured on the atlas (`SCREENS`, `LIQUID`, `LEAVES`): if an object is regenerated, they must be measured again.
- **Outdoor weather** (`MarsWeatherFx.ts`): airborne dust carried by the wind (more on dusty days and much more in the storm), dust clouds crossing the view in the storm, dust kicked up by the boots and fading tracks (24 s; 5 s in a storm). Dust spawns in what is visible and never inside the base.
- **Haze:** an external `ColorMatrix` camera filter (loses color and contrast) according to the day's dust and the storm, only with the player outside (it fades in and out in 0.8 s when crossing the airlock). The pixels stay crisp.
- **Camera:** a shake when the dust storm arrives and gusts every 5–11 s at its peak, with the player outside; a short fade when crossing the airlock's outer door.
- **Beacons:** besides the pulse, a beam that rotates like a lighthouse.
- The greenhouse plants do not sway (they are inside the glass planter).

## Phase 6: dashboard and interface

Done on 11/15/2026.

- **Icons** (`public/assets/hud/icons.*`, 24 icons generated with Codex in 6 sheets of 2 × 2, `scripts/art/icons.py`): all came out right in the first batch. Snapper with a fixed `pixel_size: 19.6` so every sheet has the same pixel size. Constants in `src/game/hudIcons.ts`.
- **Dashboard** (`HudScene`, `PanelColumn`): metal frame with rivets and light strips; segmented bars (phase progress, power, air and water); a row with air, water, food and CO2 as icons and days; spare parts; a health legend with icons; each crew member with their portrait (the front frame of their sheet), name and room, and the four health icons with a traffic-light dot below. `PanelColumn` accepts `icon`, `icons` (with `frame`), `cells`, `bar` and `portrait`; `MissionControl` stays the same.
- **Minimap** (`Minimap.ts`): at the bottom right of the view: layout (floor, walls, outside terrain), crew in their suit colors, the player with a blinking ring, the samples on Mars, the shelter blinking during a radiation storm and the rectangle of what is visible.
- **On the map:** each room with its icon in the corner (the name appears only with the player inside); stations are a plate with the icon, a border in the traffic-light color and the progress bar; the crew bubbles show the icon of the reason (sleep, fitness, CO2, missing Earth; the full text is on the dashboard) and during a radiation storm three amber arrows next to the player point to the shelter.
- New texts: `hud.meter.daysShort|manyDaysShort|co2Short|co2OkShort`, `hud.health.*`, `hud.panel.sparesShort`.
- **Simplified dashboard (11/15/2026):** the dashboard keeps only the essentials: clock and traffic light, three bars (power, air and water, food), the crew with portrait and name (only the health icon that is not green lights up) and the notices. High CO2, missing spare parts and dust on Mars appear only when they are a problem. The detail moved to the **full status** (`StatusView.ts`, I key, pauses the clock): reserves with their days, machines, each crew member's health in bars, outside dose with date and source, Curiosity's weather and every key. It is a view of `HudScene` (like `CraterView`), not a new scene. Screenshots were in `art/capturas/hud/`.
- **Light and shadows (11/15/2026):** the tile grid that showed under the flashlight did not come from the normal maps (the plain's is almost flat) but from `TilemapGPULayer`, which in Phaser 4.2.1 reads the normal map upside down: the floor moved to a common layer. The helmet lamp comes from the front of the helmet, shifted toward where it looks (`HELMET_LAMP`): the body no longer lights itself and, seen from behind, it covers the start of the beam. Outdoor objects cast shadows (`castShadows` in `HabitatFx`): their silhouette in black, lying on the side opposite each flashlight or beacon and longer the taller the object and the farther the light. The crew does not cast shadows yet. Screenshots were in `art/capturas/luz/`.
- The arrows to the shelter were not tested by hand (it needs a real radiation storm in the game).

## Phase 7: rework based on the reference crops

Done on 11/15/2026, using `01_03_base_invernadero`, `02_01_nave_comunicaciones`, `03_01_nave_sala_comun`, `03_02_nave_alerta_radiacion` and sheets 05 and 06 (the side-scroller screens were ignored). Screenshots were in `art/capturas/rework/` (the `antes-*` ones show the previous state).

- **Rooms:** command became the common room (big window, low consoles, curved couch with a holotable); the radio, the communications room (two-screen desk with a chair, radar, wall screen); the shelter, the radiation alert room (big window to the Sun, warning screen, shield tanks and a red light by its door). Rooms with a big window ended up on top (their wall has a ceiling and a front: a window almost 2 tiles tall fits): on the ship the shelter swapped places with CO2 and the radio with water; at Gale, command, gym, shelter and greenhouse are on top, and MOXIE next to the airlock. The Gale greenhouse follows the reference: grow cabinets with violet light, the big window to Gale between them, a plant monitor, a hydroponic tank and two planters.
- **New assets (Codex + pixel-snapper):** `props-comunicaciones`, `props-sala-comun`, `props-ventanas`, `props-invernadero` (with the reference crop attached to each prompt), `tiles-piso2`, `tiles-pared2`, `tiles-relleno` (machinery with orange pipes between rooms and corridor floor), `vista-marte` (landscape behind the base's big windows) and the icons `hud-iconos-botones` and `hud-iconos-objetivo`. All came out right in the first batch. Normal maps rebuilt.
- **What we learned:** a plain floor passed through the snapper leaves the seam on a different side in each tile, and the grating is not readable at 24 px: `scripts/art/tile-fix.py` evens out edges and redraws the grating with the same tile's colors. The big window came out 2 tiles wide; `atlas.py` accepts `stretch` in the manifest (it repeats plain columns and rows without changing the pixel size) and it ended up 4 × 1.8 tiles.
- **Walls:** ceilings carry pipes following the wall (vertical between rooms, horizontal along them) and rooms have a thick beveled border with chamfered corners (`bevel` in `MapAssets`, drawn in code in `TiledMapView` because the geometry has to be exact).
- **Big windows:** each shows what belongs to its room (`SpaceWindows` with `role`): command, the destination planet; the radio, the planet being left behind (big at departure); the shelter, the Sun, which dazzles during a radiation storm. The planet reaches a 14-art-pixel radius. At Gale, the landscape tinted with the sky's light.
- **Light:** glows and colored lights per object (`GLOWS` in `HabitatFx`): violet for the crops, cyan for the holotable and screens, red for the alarm lights (only during alerts). Amber arrows on the corridor floor toward the shelter door during a radiation storm. The camera looks 64 px above the player so the big windows are visible.
- **Dashboard:** the map view went to 21 tiles and the panel to 272 px, in boxes as in the references: minimap (drawn by the dashboard; the map passes it the points through the `registry`, `MINIMAP_FRAME`), meters with how many days they last (and whether power is charging or draining), crew, **today's real data** (measured radiation, signal delay to Earth, distance to the Sun or Curiosity's weather, panels versus consumption, always "archived data") and at the bottom the checkable goal or the red alert box. On the map: the player's crew plate (face, room, four health lights), mission strip at the top center, buttons with icon and key (P, C, G, I, V) and the pending decision card (options with their risk, key and cost). All of that hides when an overlay screen is open.

Pending items of this phase:
- Tell Facundo about the rooms moving and the view width (`VIEW_WIDTH` = 21 tiles).
- The doors are still the old sliding ones: octagonal frames with light columns as in the references are missing (the frame would have to be generated at the exact door size).
- The shelter does not have the hatch with the trefoil on its door (the `shelterhatch` sprite is in the atlas, unused).
- The mascots in the sheets are still unused: the crew stays Vega, Miga, Brote and Senda.
- **Doors, hazard stripe and corridor (11/15/2026, second pass):** `tiles-puerta2` (frame with an orange light bar, or red in the variant, and plain leaves with a slot and cyan light) and `tiles-pasillo2` (lavender-blue plate, plate with a guide line, hazard stripe and shelter floor), generated with the reference crop attached. `tile-fix.py` (formerly `floor-fix.py`) also merges the nearly equal colors of the door leaves and redraws their slot and baseboard, draws the guide line edge to edge and redraws the hazard stripe at 45° with an 8-pixel period so it continues without a break between the two tiles of each door. The guide line now runs along the whole middle row of the corridor.

## Room minigames

Done on 11/15/2026. Screenshots were in `art/capturas/minijuegos/` (`antes-scrubber.png` is the previous state).

- **Before:** E had to be held down for 10–40 s watching a little bar, only in 4 rooms of the ship (6 at Gale); nothing happened in command, infirmary, pantry and shelter.
- **Now:** E opens a minigame in every room (`MinigameView` view of `HudScene`, clock paused). You cannot lose: mistakes only lower the stars. Winning finishes the task at once (it is as tiring as working by hand) and the final card says what was achieved and gives a real fact for kids.

| Room | Minigame | What is learned |
|---|---|---|
| Exercise | Bike: alternate ← →, needle in the green band | Without gravity muscles and bones weaken (2 h of exercise per day on the ISS) |
| Scrubber | Catch the CO2 and let the oxygen through | What the scrubber does with what we exhale |
| Recycler | Turn pipes up to the clean tank, through the filter | The ISS recycles 98 % of its water |
| Radio | Tune the wave and follow it | That day's real signal delay |
| Command | Star tracker: turn the sky until it matches | How a spacecraft knows where it is pointing |
| Infirmary | Take the pulse to the beat | The heart in microgravity |
| Pantry | Build the tray with what works in space | Crumbs, bubbles, liquid salt, tortillas |
| Shelter | Plug gaps with water bags before the particles arrive | Water stops radiation |
| Greenhouse | Water, light or ladybugs depending on what each plant needs | Violet lights and poison-free pest control |
| MOXIE | Keep the temperature near 800 °C | MOXIE (Perseverance) made 122 g of oxygen |
| Airlock | Brush the dust off the seal | Martian dust and leaks |
| Leak (micrometeorite) | Find the hole with the detector and patch it | What micrometeorites are |

- **Rules** (`HabitatSession.minigameAt` and `finishTask`): the incident with work in progress takes priority (by its work category; the micrometeorite, always the leak). Easier in help mode or with the specialist; harder with the improvised repair. Exercise, call home and the **daily care** tasks (`kind: 'care'`: command and shelter +0.05 / +0.03 morale, pantry +0.05 morale, infirmary +0.03 fitness for everyone) are done once a day; the call can be repeated if an isolation is waiting for it.
- **Assets:** 8 sheets of 2 × 2 (`art/prompts/mg-*.txt`), all good in the first batch; automatic snapper with 32 colors; atlas `public/assets/minigames/items` (`atlas.py minigames`) with a normal map, lit by a light that follows what is being touched.
- **Dashboard:** the crew went to 2 × 2 (`half` rows in `PanelColumn`; the health icons go under the name).

---

## New base following plano-base-marte.png

Done on 11/15/2026, on request: the Gale base stops being a rectangle with a corridor and follows the floor plan [`plano-base-marte.png`](../referencias/topdown/plano-base-marte.png). The exterior (strips, dunes, buttes, channel and Curiosity) is the same as before, shifted 26 rows south: the map goes from 72 × 72 to 72 × 98 tiles. Screenshots were in `art/capturas/base-nueva-*.png` and an overview in `art/capturas/gale-base-nueva.png`.

### What remained

- **Modules with their own shape** (polygons in `scripts/maps/build-gale.mjs`, `zone` zones with a `polygon` in Tiled): greenhouse in a dome and radiation shield (`shelter`) in one module; power (`energy`, panels) with MOXIE next to it; central (`command`) with the scrubber corner (`scrubber`, the wrench on the plan); storage (`pantry`, the kitchen with its recipe on the wall screen) and communications (`radio`) attached to the central module; hospital (`infirmary`) and gym (`exercise`) in one module; the workshop (`workshop`) with the airlock in its corner, which leads to the ship.
- **Plastic-insulated tubes** (`tube` in Tiled, `Passage` in `core/habitat/layout.ts`): six, with a door at each end belonging to the tube. Between them are courtyards of Martian ground that can be seen but not walked on (`tiledLayout.withoutCourtyards`).
- **Outside and separate:** storage (`storage`), battery (`battery`) and the parked ship (`ship`, bottom left); reached in a suit from the airlock. Solar panels in two rows to the right of power.
- **Cables** (green, `cable` with a `polyline` and `from`/`to` properties): panels → base (through the greenhouse), panels → junction box 1 → battery, battery → base (through communications), battery → junction box 2 → workshop and → ship → hospital. They are drawn on the ground under the walls (`MarsScene.drawGrid`).
- **Grid paths:** `route`/`routeToPoint` find the shortest path over tiles (rooms, tubes, doors and exterior), avoid furniture (`ShipLayout.obstacles`) and closed tubes, and smooth the route with a margin from the walls. The ship (`Voyage`) uses the same with its corridor as the only `Passage`.

### New rules (all [rule], in `content/gale.ts` and `content/incidents.ts`)

| What | How |
|---|---|
| Broken tube (`tubeBreach`, level 2) | Its doors seal: nobody gets through (blocks in `SimulationMapScene`, routes that avoid it). Repaired with E next to one of its doors (`patch` minigame) |
| Cut cable (`cableCut`, level 3) | The grid looks for another path: each cut section loses 25 % of the sun. With no path from the panels to the base or the battery, nothing charges; if the battery does not reach the base, the battery sits idle and at night power runs short (MOXIE and the greenhouse turn off). Spliced outside, next to the cut (`wires` minigame) |
| Blown fuse (`fuseBlown`, level 2) | Cuts the panels' input: the base lives on the battery. Replaced in the power room (`fuses` minigame), which also has its daily check (`fuseCheck`) |
| Power board | Unplugging systems (e.g. the radio, in extreme cases) can only be done from the power room (`power.panelZone`) |
| Storage | Collected samples are carried by whoever collected them until they enter the storage (saved in `HabitatSave.mars`) |
| Boarding | When the stay's time runs out the phase does not end: the airlock door opens even at night, the automatic crew walks to the ship, the player loads the storage (E) and stows it in the ship (E). With the cargo on board and everyone in the ship, `phase:completed` |

### To test

`?scene=Mars&incident=tubeBreach,cableCut:2,fuseBlown&level=3` (breakdowns already in progress; the number changes which tube or cable),
`&where=storage|ship|battery|energy` (where the player starts) and `&from=2024-06-03T20` (a few hours before boarding).


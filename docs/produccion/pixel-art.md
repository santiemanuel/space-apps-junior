# Pixel art record

All the pixel art created while polishing the interface, with its name, location and how to rebuild it, so any piece
can be replaced without breaking anything. The earlier pieces (ship, Mars, crew, dashboard, minigames) are documented
in the `README.md` of each folder in `public/assets/`.

General rules (see [`biblia-visual.md`](../diseno/biblia-visual.md) §2): PNG with transparency, no text, dark outline
and the interface palette.

## How to replace a piece

1. Save the new PNG with **the same name and in the same folder**.
2. If it is a frame sheet (spritesheet), keep **the size of each frame**. If it changes, update it in
   `src/game/assets.ts` (`TITLE_ASSETS`). `src/game/assets.test.ts` checks that every file exists and that the sheet
   has a whole number of frames.
3. Pieces are drawn small (in "art pixels") and the game scales them up without smoothing. The scale of each one is in
   the table.

---

## Main menu (`Title`)

Animated menu sky: Earth and Mars spinning, the ISS and the OPSIS CubeSat in orbit, shooting stars and meteors, distant
asteroids and the mission spacecraft travelling from Earth to Mars.

- **Folder:** `public/assets/ui/title/`
- **How to rebuild:** `python scripts/art/title-sky.py` (Pillow and numpy; no network). Rebuilds every piece in the
  table.
- **Where it is used:** `src/game/scenes/flow/titleSky.ts` (animations) and `src/game/scenes/flow/planetRender.ts`
  (the spinning planets). Texture keys are in `TitleTextures` (`src/game/assets.ts`).

| Name | File | Size (art px) | Frames | On-screen scale | What it is | Origin |
|---|---|---|---|---|---|---|
| Earth map | `public/assets/ui/title/earth-map.png` | 512 × 256 | — | ×3 (projected on the sphere) | Equirectangular map of Earth reduced to 20 colors | NASA Blue Marble 2002 (public domain) |
| Earth clouds | `public/assets/ui/title/earth-clouds.png` | 512 × 256 | — | ×3 (over Earth) | White clouds at two opacities, in east–west bands; they wrap at the edges and spin a little faster than the surface | Drawn by the script (noise with seed 2024) |
| Mars map | `public/assets/ui/title/mars-map.png` | 128 × 64 | — | ×3 (projected on the sphere) | Equirectangular map of Mars reduced to 12 colors, with a rust tint | USGS / NASA Ames Viking MDIM 2.1 mosaic (public domain) |
| ISS | `public/assets/ui/title/iss.png` | 84 × 21 | 2 of 42 × 21 | ×2 | International Space Station seen from above: truss, 4 pairs of golden solar panels and modules. The second frame has a sun glint on the panels | Drawn by the script |
| Meteor | `public/assets/ui/title/meteor.png` | 52 × 13 | 4 of 13 × 13 | ×2 (×3 for big ones) | Spinning rock with a red-hot leading edge | Drawn by the script |
| Meteor trail | `public/assets/ui/title/meteor-trail.png` | 44 × 7 | — | ×2 or ×3, additive blend | Yellow, orange and red trail that fades out with pixel dithering. The bright end (x = 0) sits against the rock | Drawn by the script |
| Asteroid | `public/assets/ui/title/asteroid.png` | 160 × 20 | 8 of 20 × 20 | ×1 (far) and ×2 (near) | Irregular cratered rock making a full turn over the 8 frames, always lit from the top right | Drawn by the script |
| Mission spacecraft | `public/assets/ui/title/ship.png` | 68 × 11 | 2 of 34 × 11 | ×2 | Nuclear thermal propulsion spacecraft (game-design §2.1) facing right: nozzle with flame, truss, radiators and habitat module. The flame flickers between the two frames | Drawn by the script |
| OPSIS CubeSat | `public/assets/ui/title/opsis.png` | 26 × 9 | 2 of 13 × 9 | ×2 | 3U CubeSat with two solar panels and an antenna; its LED goes from green to red. It crosses the sky once per page load, just above the atmosphere, shows its name, "OPSIS", on mouse hover, and slows down while hovered. A nod to Facundo's OPSIS project | Drawn by the script |
| Stars | `public/assets/ui/title/stars.png` | 28 × 7 | 4 of 7 × 7 | ×2 | Four star sizes, from a dot to a cross-shaped twinkle | Drawn by the script |
| Logo | `public/assets/ui/title/logo.png` | 512 × 512 (128 × 128 art scaled ×4) | — | ×0.5 (each art pixel as 2 × 2 on screen) | "HELLO MARS" on a ribbon over the menu's Mars, with a ring of choice buttons (✔, ⚠, ✖), a lever and an astronaut peeking out: the mission's decisions. Replaces the text title of the menu | Generated with Codex: `python scripts/art/logo-planet.py` (reference Mars, `art/raw/logo/planet-ref.png`) → `scripts/art/gen.sh logo-b art/raw/logo/planet-ref.png` (prompt `art/prompts/logo-b.txt`) → `pre.py` → `snap_pixels` (`color_count: 24`, automatic grid) → `art/snapped/logo-b.png` (centered in 128 × 128) → scaled ×4 without smoothing |
| code-hello logo | `public/assets/ui/title/code-hello.png` | 70 × 36 | — | ×1 | Pixel art version of the code-hello studio mark (italic H with an orbit and a small planet), in the game logo's palette (cream, lavender shading, dark outline). Bottom-right corner of the menu, links to https://www.code-hello.com | Generated with Codex from the official logo (`art/raw/brand/code-hello-logo.png`, from code-hello.com) → `pre.py` → `snap_pixels` (automatic, pixel 23.5, `color_count: 8`) → `art/snapped/brand-code-hello.png` → `python scripts/art/brand-icons.py`. Prompt `art/prompts/brand-code-hello.txt` |
| GitHub mark | `public/assets/ui/title/github.png` | 30 × 30 | — | ×1 | Pixel art version of the GitHub mark (Octocat cut out of a disc), same palette. Next to the code-hello logo, links to the repository | Generated with Codex from `art/raw/brand/github-mark.png` (`mark-github-24.svg` from primer/octicons, rasterized with ImageMagick) → `pre.py` → `snap_pixels` (automatic, pixel 37.5, `color_count: 8`) → `art/snapped/brand-github.png` → `python scripts/art/brand-icons.py`. Prompt `art/prompts/brand-github.txt`. The GitHub mark is a GitHub trademark |

**Not files:** the spinning planets are painted in real time on two canvas textures, `title-earth-canvas`
(228 × 228) and `title-mars-canvas` (48 × 48), from the maps above (20 frames per second, with a day/night terminator,
the real axial tilt and an atmosphere halo).

### Map sources

Copies in `art/raw/title/` so the pieces can be rebuilt offline:

| File | Source | License |
|---|---|---|
| `art/raw/title/blue-marble.jpg` (1280 × 640) | NASA Earth Observatory, *The Blue Marble* (2002), `land_shallow_topo_2048` (Reto Stöckli, NASA GSFC), [Visible Earth 57752](https://visibleearth.nasa.gov/view.php?id=57752), copy from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Land_shallow_topo_2048.jpg) | Public domain |
| `art/raw/title/mars-viking-mdim21.jpg` (1280 × 640) | USGS Astrogeology / NASA Ames, *Mars Viking MDIM 2.1 Colorized Global Mosaic*, copy from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg) | Public domain |

`eoimages.gsfc.nasa.gov` does not respond from some networks; Commons serves the same image at
`https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=1280` (it requires a `User-Agent`).

---

## Flight scenes (`Maneuver`)

Animated illustration of the four maneuvers (launch from Earth, landing on Mars, launch from Mars and return):
platform and tower, crew boarding, countdown, liftoff with flame and smoke, separations, capsule with plasma,
parachutes and splashdown.

- **Folder:** `public/assets/ui/flight/`
- **How to rebuild:** `python scripts/art/flight.py` (Pillow and numpy; no network). Everything is drawn by the
  script.
- **Where it is used:** `src/game/scenes/flow/flightArt.ts` (the illustration, with its own camera) and
  `src/game/scenes/flow/ManeuverScene.ts`. Texture keys in `FlightTextures` (`src/game/assets.ts`).

| Name | File | Size (art px) | Frames | Scale | What it is |
|---|---|---|---|---|---|
| Rocket | `public/assets/ui/flight/rocket.png` | 16 × 56 | — | ×3 | White core stage with orange stripes and the capsule on top (pointing up) |
| Booster | `public/assets/ui/flight/booster.png` | 8 × 38 | — | ×3 | Left side booster; the right one is the same, mirrored |
| Tower | `public/assets/ui/flight/tower.png` | 20 × 74 | — | ×3 | Red launch tower with the crew access arm |
| Flame | `public/assets/ui/flight/flame.png` | 36 × 20 | 3 of 12 × 20 | ×3 (×1.8 on the capsule) | Downward engine flame, flickering |
| Smoke | `public/assets/ui/flight/smoke.png` | 56 × 14 | 4 of 14 × 14 | ×3.6 to ×6 | Puff that grows and lightens; tinted ochre on Mars |
| Capsule | `public/assets/ui/flight/capsule.png` | 20 × 16 | — | ×3 | Crew capsule with the heat shield below |
| Heat shield | `public/assets/ui/flight/shield.png` | 20 × 6 | — | ×3 | The loose shield when it separates |
| Parachute | `public/assets/ui/flight/parachute.png` | 34 × 26 | — | ×3 | Orange-and-white striped parachute with its lines |
| Ascent vehicle | `public/assets/ui/flight/lander.png` | 20 × 40 | — | ×3 | Mars ascent vehicle on its legs, with reddish dust |

### Launch scenery (generated)

Both launches (`ascent` and `marsAscent`) use more detailed scenery generated with codex-cli, based on the mockups in
[`docs/referencias/prototipos-despegue/`](../referencias/prototipos-despegue/README.md). The old rocket, tower,
capsule and ascent vehicle (`rocket.png`, `booster.png`, `tower.png`, `lander.png`) are kept only for landing and
reentry.

- **How to rebuild:** prompts `art/prompts/vuelo-*.txt` → `scripts/art/gen.sh vuelo-<name> <sheet 05> <prototype>` →
  `python scripts/art/pre.py art/raw/vuelo-*.png` → `snap_pixels` (backgrounds with `pixel_size: 5.225`; sheets,
  automatic; 48 colors) → copy to `art/snapped/vuelo-*.png` → `python scripts/art/flight-scenery.py`.
- **Scale:** ×4 like the other flight pieces (the 320 × 180 backgrounds cover the screen).
- The measurements `flightArt.ts` uses (ground, hatch, tower arm, capsule rows) come from these images: if they are
  rebuilt, check `SITES`, `TOWER`, `CORE` and `MAST`.

| Name | File | Size (art px) | What it is |
|---|---|---|---|
| Coast (far) | `earth-far.png` | 320 × 180 | Sea, coast with a lighthouse and domes, hills and palm trees; transparent sky |
| Platform (near) | `earth-near.png` | 320 × 180 | Platform with flame trench, grandstands, walkways, pipes and control building; the surface is at y = 151 |
| Gale (far) | `mars-far.png` | 320 × 180 | Mount Sharp, mesas and dunes |
| Gale base (near) | `mars-near.png` | 320 × 180 | Base with domes and panels, rover, launch pad (surface at y = 149), pipes and rock |
| Core stage | `core.png` | 30 × 114 | Rocket with the capsule on top; split in two (capsule: rows 0–30) for stage separation |
| Booster | `side-booster.png` | 14 × 79 | Side booster (the same on both sides) |
| Tower | `launch-tower.png` | 85 × 125 | Red tower with elevator; the access arm (x 56–85, y 28–54) is cut out separately and retracts at T-45 |
| Ascent vehicle | `ascent-vehicle.png` | 71 × 62 | Mars ascent vehicle on four legs |
| Service tower | `service-mast.png` | 36 × 77 | Tower with ladder and windsock (Mars); tilts away at T-20 |
| Tanks | `fuel-tanks.png` | 59 × 40 | Two frosted spherical tanks (Earth) |
| Mothership | `mothership.png` | 125 × 53 | The spacecraft waiting in Mars orbit, with its hatch open |
| Van | `van.png` | 38 × 25 | Van bringing the crew in the intro scene |

### Landing and reentry scenery (generated)

The landing on Mars (`landing`) and the return to Earth (`reentry`) use the same technique as the launches.

- **How to rebuild:** prompts `art/prompts/vuelo-capsulas.txt`, `vuelo-rescate.txt`, `vuelo-gale-llano.txt` and
  `vuelo-mar-lejos.txt` → `scripts/art/gen.sh vuelo-<name> <sheet 05> <prototype>` → `python scripts/art/pre.py` →
  `snap_pixels` (backgrounds with `pixel_size: 5.225`; sheets, automatic; 48 colors) → copy to
  `art/snapped/vuelo-*.png` → `python scripts/art/flight-scenery.py`.
- **Scale:** ×4. If they are rebuilt, check in `flightArt.ts` the ground of `LOOKS.landing|reentry.plain`,
  `CAPSULE_BASE` and `RESCUE` (row of the ship's deck).
- **Origin:** generated with codex-cli (image generation) for this game. No normal maps (flight scenes do not use
  dynamic lighting).

| Name | File | Size (art px) | What it is |
|---|---|---|---|
| Gale plain | `gale-plain.png` | 320 × 180 | Landing ground (horizon at y ≈ 137); `mars-far.png` (Mount Sharp) goes behind it |
| Open sea | `sea-far.png` | 320 × 180 | Splashdown sea with an islet and clouds on the horizon |
| Entry capsule | `entry-capsule.png` | 37 × 30 | Mars capsule with the heat shield below |
| Descent module | `descent-lander.png` | 41 × 35 | The same without the shield, with legs and braking engines |
| Heat shield | `heat-shield.png` | 29 × 10 | The shield as it is released and falls |
| Parachute | `chute.png` | 63 × 58 | Mars parachute |
| Return capsule | `return-capsule.png` | 33 × 31 | Reentry capsule (made by the script from `sea-capsule.png` without the floats) |
| Capsule at sea | `sea-capsule.png` | 33 × 41 | The same with the orange floats inflated |
| Rescue ship | `rescue-ship.png` | 103 × 54 | Ship arriving at the splashdown; the crew steps onto its deck (row 41) |
| Helicopter | `helicopter.png` | 65 × 26 | Rescue helicopter |
| Three parachutes | `chutes.png` | 79 × 59 | Splashdown parachutes |

**Not files** (drawn in code in `flightArt.ts`): the banded entry plasma, the sparks, the splash, the stretcher, the
gradient sky, the mountains (Mount Sharp on Mars), the clouds, the crowd behind the fence, the floodlights and the flag,
the base domes, the elevator and the walkway, the ground, the sea, the stars and the speed lines.

---

## Return cargo (`Loadout`, grid cargo hold)

Pieces packed into the ship's hold before leaving Mars, like a grid inventory: each one takes up more or less room
depending on its size.

- **Folder:** `public/assets/ui/cargo/`
- **How to rebuild:** `python scripts/art/cargo.py` (Pillow and numpy; no network). Everything is drawn by the script.
- **Where it is used:** `src/game/scenes/flow/cargoGridView.ts`. Texture keys in `CargoTextures`
  (`src/game/assets.ts`).
- **Size rule:** one cell is 16 art pixels. In the hold it is scaled ×3 (48 px per cell) and in the base list ×2. If
  the cell size of a piece changes (`CARGO_GRID` in `src/content/loadouts.ts`), its drawing must be redone at the new
  size.

| Name | File | Size (art px) | Cells | What it is |
|---|---|---|---|---|
| Food crate | `public/assets/ui/cargo/food.png` | 32 × 32 | 2 × 2 | Wooden crate with straps and a painted apple |
| Water tank | `public/assets/ui/cargo/water.png` | 16 × 32 | 1 × 2 | Blue drinking water jug with a drop |
| Shield bag | `public/assets/ui/cargo/shield.png` | 16 × 48 | 1 × 3 | Long water bag for the shelter shield, with the radiation symbol |
| Spare parts box | `public/assets/ui/cargo/spare.png` | 32 × 16 | 2 × 1 | Grey toolbox with a handle |
| Small rock | `public/assets/ui/cargo/rock-1x1.png` | 16 × 16 | 1 × 1 | Mars rock up to 7 kg |
| Medium rock | `public/assets/ui/cargo/rock-1x2.png` | 16 × 32 | 1 × 2 | Mars rock up to 10.5 kg |
| Large rock | `public/assets/ui/cargo/rock-2x2.png` | 32 × 32 | 2 × 2 | Mars rock over 10.5 kg |
| Plant sample | `public/assets/ui/cargo/plant.png` | 16 × 16 | 1 × 1 | Jar with a sprout from the Mars greenhouse |

**Not files:** the hold grid, the piece outlines and the green or red shadow of the piece being carried are drawn in
code.

---

## Far sea for the launch (generated original)

- **Name and location:** `art/raw/vuelo-mar-lejos.png`, far background of the Pacific Ocean in the morning, side view.
- **Size and frames:** 1672 × 941 px, one frame; requested look of a 320 × 180 canvas scaled up. Original not resized or
  re-encoded; game scale not yet assigned.
- **Transparency:** sky with an alpha channel; sea to the bottom edges, a distant island on the left and small clouds
  over the horizon.
- **How to rebuild:** generate a single image with the built-in `image_gen` tool, transparent background and the prompt
  in `art/prompts/vuelo-mar-lejos.txt`; copy the PNG unmodified.
- **Origin:** generated with `image_gen` on 11/15/2026. Original:
  `C:/Users/Santiago/.codex/generated_images/01a1e112-bdeb-7350-95c1-02e4016a189d/exec-58fc72cc-8613-4c1d-9c03-7279150f6c15.png`.

## Language flags (generated original)

- **Name and location:** `art/raw/ui-banderas.png`, sheet of four icons in a 2 × 2 grid: Argentina (Spanish) on the
  left and the United States (English) on the right, repeated in the bottom row.
- **Size and frames:** 1254 × 1254 px, four icons; requested look of a 64 × 64 canvas scaled up. Original not resized
  or re-encoded.
- **Transparency:** PNG with an alpha channel, no background or stands.
- **How to rebuild:** generate a single image with the built-in `image_gen` tool, transparent background and the prompt
  in `art/prompts/ui-banderas.txt`; copy the PNG unmodified.
- **Origin:** generated with `image_gen` (Codex) on 11/15/2026; the first version (Spain and England) was replaced by
  this one.
- **In the game:** `public/assets/ui/flags/es.png` (Argentina, 32 × 27 art px) and `en.png` (United States, 34 × 27),
  one frame each, taken from the top row of the sheet. Shown ×2 in the language row of the options
  (`src/game/scenes/flow/settingsPanel.ts`, main menu and pause); keys from `flagTextureKey` (`src/game/assets.ts`).
- **How they get into the game:** `scripts/art/gen.sh ui-banderas` → `python scripts/art/pre.py art/raw/ui-banderas.png`
  → `snap_pixels` (`color_count: 16`, automatic pixel size: 14; with 19.6 the US stripes come out uneven) →
  `art/snapped/ui-banderas.png` (92 × 94) → `python scripts/art/flags.py`.

## Checklist system icons

- **Name and location:** `art/raw/hud-iconos-sistemas.png` → `art/snapped/hud-iconos-sistemas.png` (69 × 67), 2 × 2
  sheet: engine (`engines`), heat shield (`heatShield`), parachutes (`parachutes`) and solar panel (`solarPanels`).
- **Size and frames:** 1254 × 1254 px original; in the game, four more frames of the `public/assets/hud/icons` atlas
  (24 × 24 art px cells). In the checklist console they are shown ×1.5 (the scrubber and the radio use their rooms'
  icons).
- **How to rebuild:** `scripts/art/gen.sh hud-iconos-sistemas docs/referencias/ref-nave.png art/snapped/hud-iconos-cuartos1.png`
  → `python scripts/art/pre.py art/raw/hud-iconos-sistemas.png` → `snap_pixels` with `pixel_size: 19.6` → copy to
  `art/snapped/` → `python scripts/art/icons.py` (group `hud-icons` in `art/manifest.json`).
- **Origin:** generated with `image_gen` (Codex) on 11/15/2026.
- **In the game:** the Go / No-Go checklist console of the maneuvers (`src/game/scenes/flow/checklistPanel.ts`). The
  console frame, cards, buttons, stamps and start button are drawn in code.

## Favicon (generated original)

- **Name and location:** `art/raw/favicon.png` (generated) → `art/snapped/favicon.png` (41 × 38, a 29 × 32 art px
  drawing) → `public/favicon.ico` (16, 32 and 48 px), `public/favicon-32.png` (32 × 32, 1:1 pixel art) and
  `public/apple-touch-icon.png` (180 × 180, ×5 over the game background `#05070d`).
- **What it is:** the logo's Mars with the astronaut's helmet peeking over the top, without text or buttons, for the
  browser tab. Dark outline so it shows on both light and dark bars.
- **Where it is used:** `index.html` (`<link rel="icon">` and `apple-touch-icon`).
- **How to rebuild:** `scripts/art/gen.sh favicon public/assets/ui/title/logo.png` (prompt `art/prompts/favicon.txt`,
  with the logo as reference) → `python scripts/art/pre.py art/raw/favicon.png` → `snap_pixels` (`color_count: 12`,
  automatic pixel size: 31.5) → `art/snapped/favicon.png` → `python scripts/art/favicon.py` (fails if the drawing does
  not fit in 32 × 32). The 16 px one is downscaled smoothly; the 48 px one is scaled ×3 and then down.
- **Origin:** generated with `image_gen` (Codex) on 11/15/2026.

## Other assets without a file (drawn in code)

So they can be found if they ever need to be replaced with pixel art:

| What | Where the code is |
|---|---|
| Crew status dots (online, away, do not disturb, offline) | `drawPresence` in `src/game/scenes/simulation/PanelColumn.ts` |
| Leaf of the side doors of the Mars base | `src/game/scenes/simulation/TiledMapView.ts` (`sideDoors`) |
| Final report backgrounds (sea and confetti; space, Mars and rescue ship) | `src/game/scenes/flow/reportBackdrop.ts` |
| Sound and music (not images) | `src/game/audio/` (sound effects and the soundtrack are MP3 files in `public/assets/audio/`) |

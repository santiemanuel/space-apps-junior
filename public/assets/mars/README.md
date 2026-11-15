# Mars assets (Gale Crater)

Pixel art generated with Codex (image generation), cleaned with the Pixel Snapper and assembled with the scripts in
`scripts/art/` (docs/historial/plan-visual.md §4). Prompts are in `art/prompts/` and the originals in `art/raw/`. The
real photos attached as color and material references are in `docs/referencias/gale/` (what each strip shows:
`src/content/galeTerrain.ts`).

| File | What it is | How it is built |
|---|---|---|
| `tiles.png` | Tileset of 48 tiles of 48 px. **0–23:** the ship's tiles in a warm, dusty version (palette shifted from lavender to beige with dust specks on the floors; same indices as `ship.json`). **24–45:** Gale ground: plain (24–27), lakebed (28–30), dunes (31–32), polygonal rock (33), channel (34, 43, 44), sulfur field (35, 45), butte top and slope (36–37), rover tracks (38, unused), dune crest and face (39–40), Mount Sharp top and slope (41–42) | `python scripts/art/tiles.py art/snapped/gale-suelo.png $(cat art/tiles-gale.args)` then `python scripts/art/gale-tiles.py`; prompts `gale-llanura` (photo PIA16156), `gale-lago` (PIA17595, PIA16705), `gale-arena` (PIA20755, PIA26309), `gale-canal` (PIA26309, PIA26410), `gale-laderas` (PIA20841, PIA26410), `gale-dunas` (PIA20283) |
| `props.png` + `props.json` | Object atlas: the ship's objects plus the Mars ones (greenhouse, MOXIE, suit on its rack, dusty crate, clean and dusty solar panels, antenna, beacon, small/medium/large rocks, angular block, one sample per strip `sample-<type>`, clean and dusty Curiosity, sample tube) | `python scripts/art/atlas.py mars-props` (list in `art/manifest.json`); prompts `props-marte-base`, `props-marte-afuera`, `props-marte-rocas`, `props-marte-muestras`, `props-marte-curiosity` |
| `crater.png` | Gale Crater map for the "you are here" view (V key): the real photo PIA15687 (NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS) without the landing ellipse, pixelated to 200 × 200 with 28 colors and exported ×3 | `python scripts/art/crater-map.py` (original in `art/raw/PIA15687.jpg`; georeference in `GALE_CRATER_VIEW`) |
| `tiles_n.png`, `props_n.png` | Normal maps for dynamic lighting | `python scripts/art/normals.py public/assets/mars/tiles.png public/assets/mars/props.png` |

The map that uses these assets is `src/content/maps/gale.json` (Tiled, `node scripts/maps/build-gale.mjs`); the
tileset is named `gale-tiles`. If the tileset indices change, update `G` in `build-gale.mjs` and run it again.

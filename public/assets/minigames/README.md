# Room minigame assets

Pixel art generated with Codex (image generation), cleaned with the Pixel Snapper and assembled with the scripts in
`scripts/art/` (docs/historial/plan-visual.md §4 and "Room minigames"). Prompts are in `art/prompts/mg-*.txt` and the
originals in `art/raw/`.

| File | What it is | How it is built |
|---|---|---|
| `items.png` + `items.json` | Atlas of 32 objects (×2: one art pixel = 2 px). Air: `co2`, `o2`, `cartridge`, `drop`. Water: `dirtybag`, `filter`, `cleantank`, `waterbag`. Plants: `plant-ok`, `plant-dry`, `plant-pale`, `plant-bugs`. Tools: `wateringcan`, `growlamp`, `ladybug`, `patch`. Food: `tortilla`, `bread`, `soup`, `soda`, `fruit`, `salt`, `cookie`, `shrimp`. Misc: `heart`, `dust`, `brush`, `star`. Machines: `bike`, `dish`, `stethoscope`, `heater` | 8 sheets of 2 × 2 (`mg-aire`, `mg-agua`, `mg-plantas`, `mg-herramientas`, `mg-comida1`, `mg-comida2`, `mg-varios`, `mg-maquinas`) with `scripts/art/batch.sh`; `pre.py`; `snap_pixels` with automatic detection and `color_count: 32`; `python scripts/art/atlas.py minigames` |
| `items_n.png` | Normal map of the atlas: objects get relief from the light that follows the cursor | `python scripts/art/normals.py public/assets/minigames/items.png` |

The boards (pipes, shelter wall, airlock seal, screens, speedometer and thermometer) are drawn in code in
`src/game/scenes/simulation/minigames/renderers.ts`.

# Ship assets

Pixel art generated with Codex (image generation), cleaned with the Pixel Snapper and assembled with the scripts in
`scripts/art/` (docs/historial/plan-visual.md §4). Prompts are in `art/prompts/` and the originals in `art/raw/`.

| File | What it is | How it is built |
|---|---|---|
| `tiles.png` | Tileset of 24 tiles of 48 px: floors, corridor, hazard stripe, shelter floor, wall fronts, ceilings, grating, space, door frames and door leaves | `python scripts/art/tiles.py public/assets/ship/tiles.png $(cat art/tiles-ship.args)`; prompts `tiles-piso`, `tiles-pasillo`, `tiles-pared`, `tiles-techo`, `tiles-puerta` |
| `props.png` + `props.json` | Object atlas (Phaser JSON hash); the window carries `glass` with the glass rectangle | `python scripts/art/atlas.py ship-props` (list in `art/manifest.json`); prompts `props-*` |
| `tiles_n.png`, `props_n.png` | Normal maps for dynamic lighting | `python scripts/art/normals.py` (Sprite Fusion generator in Docker) |

The map that uses these assets is `src/content/maps/ship.json` (Tiled); the tileset is named `ship-tiles`.

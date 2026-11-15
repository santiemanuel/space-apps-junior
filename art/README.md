# Art sources

Working material for rebuilding the assets in `public/assets/`. The game does not read anything from this folder.

| Folder / file | Content |
| --- | --- |
| `prompts/` | The request for each generated image (`<name>.txt`), used by `scripts/art/gen.sh <name>`. |
| `raw/` | Images as they came out of the generator (and source photos such as `PIA15687.jpg`). Generation `.log` files are not versioned. |
| `snapped/` | The same images after the Pixel Snapper: a real pixel grid and a limited palette. The game assets are made from these. |
| `refs/` | Crew references (front, back and side) passed to the generator. |
| `manifest.json` | Object groups for `scripts/art/atlas.py` and icons for `scripts/art/icons.py`. |
| `tiles-ship.args`, `tiles-gale.args` | Sheets that make up the ship and Gale tilesets (`scripts/art/tiles.py`). |
| `capturas/` | Working screenshots (`scripts/art/capture.mjs`); ignored by git. |

Step-by-step for each asset type: `AGENTS.md` (Verificación section). Piece-by-piece record:
[`docs/produccion/pixel-art.md`](../docs/produccion/pixel-art.md).

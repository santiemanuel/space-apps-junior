# Dashboard and map interface assets

Pixel art generated with Codex (image generation), cleaned with the Pixel Snapper and assembled with the scripts in
`scripts/art/` (docs/historial/plan-visual.md §4). Prompts are in `art/prompts/` and the originals in `art/raw/`.

| File | What it is | How it is built |
|---|---|---|
| `icons.png` + `icons.json` | Atlas of 24 icons in 24 × 24 art-pixel cells, **at art resolution** (the dashboard shows them ×1 and the map ×2). Meters: `energy`, `air`, `water`, `food`, `co2`, `spares`, `radiation`, `samples`. Health and speech bubbles: `condition`, `fatigue`, `morale`, `warning`. Rooms (same name as the zone): `command`, `exercise`, `scrubber`, `recycler`, `infirmary`, `pantry`, `shelter`, `radio`, `greenhouse`, `moxie`, `airlock`; plus `dustStorm`. Maneuver checklist systems (same name as the `SystemId`): `engines`, `heatShield`, `parachutes`, `solarPanels` | `python scripts/art/icons.py` (group `hud-icons` in `art/manifest.json`); prompts `hud-iconos-medidores`, `hud-iconos-recursos`, `hud-iconos-salud`, `hud-iconos-cuartos1`, `hud-iconos-cuartos2`, `hud-iconos-cuartos3`, `hud-iconos-sistemas`. Each sheet went through `snap_pixels` with a fixed `pixel_size: 19.6` (automatic detection gave a different pixel size per sheet) |

The dashboard frame, bars, minimap, crew speech bubble and arrows to the shelter are drawn in code in art pixels
(2 px) with the ship's palette. Portraits are the front frame of the sheets in `public/assets/crew/`, cropped.

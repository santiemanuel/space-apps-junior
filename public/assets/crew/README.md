# Crew sprite sheets

Pixel art regenerated with Codex (image generation) from `docs/referencias/tripulacion/<id>-sprites.png`, which remain
as design references, and cleaned with the Pixel Snapper. Loaded by the `Boot` scene (`src/game/assets.ts`) under the
key `crew-<id>`.

How to rebuild them (docs/historial/plan-visual.md §4): one 3 × 3 frame image per direction
(`art/prompts/crew-<id>-{frente,espalda,izquierda}.txt`, with the original strip for that direction as reference) →
`python scripts/art/regrid.py art/raw/crew-<id>-<direction>.png --height <height>` (resampling on an even grid; art
height: vega 36, miga 39, brote 41, senda 42) → `snap_pixels` with `pixel_size: 8` → `python scripts/art/crew.py <id>`.
The right profile is the mirrored left one; the helmet from the first frame is repeated across the row, and idle is a
single frame with a blink (see `scripts/art/crew.py`).

- PNG with transparency, 720×384 = 9 × 4 frames of 80×96 (40×48 art pixels scaled ×2).
- Rows: front, back, left profile, right profile (idle and walk).
- Feet at y = 94, centered at x = 40: origin (0.5; 94/96).

| File | Crew member | Role |
|---|---|---|
| `vega.png` | Vega | Commander |
| `miga.png` | Miga | Engineer |
| `brote.png` | Brote | Botanist |
| `senda.png` | Senda | Geologist and doctor |

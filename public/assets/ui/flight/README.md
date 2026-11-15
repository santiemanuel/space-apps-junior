# Flight scene assets

Pixel art for the animated illustration in `Maneuver`: rocket, booster, tower, flame, smoke, capsule, heat shield,
parachutes and the Mars ascent vehicle.

- The hand-drawn pieces are rebuilt with `python scripts/art/flight.py`.
- The launch scenery (`earth-*`, `mars-*`, `core`, `side-booster`, `launch-tower`, `ascent-vehicle`, `service-mast`,
  `fuel-tanks`, `mothership`, `van`) is generated: `python scripts/art/flight-scenery.py` from
  `art/snapped/vuelo-*.png`.
- Full record (sizes, frames and scale): [`docs/produccion/pixel-art.md`](../../../../docs/produccion/pixel-art.md).
- Loaded by `Boot` with the `FlightTextures` keys (`src/game/assets.ts`).

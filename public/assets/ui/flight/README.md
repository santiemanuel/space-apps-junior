# Recursos de las escenas de vuelo

Pixel art de la ilustración animada de `Maneuver`: cohete, propulsor, torre, llama, humo, cápsula, escudo térmico,
paracaídas y nave de ascenso de Marte.

- Las piezas dibujadas a mano se rehacen con `python scripts/art/flight.py`.
- La escenografía de los despegues (`earth-*`, `mars-*`, `core`, `side-booster`, `launch-tower`, `ascent-vehicle`,
  `service-mast`, `fuel-tanks`, `mothership`, `van`) es generada: `python scripts/art/flight-scenery.py` desde
  `art/snapped/vuelo-*.png`.
- Registro completo (tamaños, cuadros y escala): [`docs/pixel-art.md`](../../../../docs/pixel-art.md).
- Los carga `Boot` con las claves de `FlightTextures` (`src/game/assets.ts`).

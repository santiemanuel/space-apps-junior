# Recursos de Marte (cráter Gale)

Pixel art generado con codex (imagegen), limpiado con el pixel-snapper y armado con los scripts de `scripts/art/`
(docs/plan-visual.md §4). Los prompts están en `art/prompts/` y los originales en `art/raw/`. Las fotos reales que se
adjuntaron como referencia de color y material están en `docs/gale/` (qué muestra cada franja: `src/content/galeTerrain.ts`).

| Archivo | Qué es | Cómo se arma |
|---|---|---|
| `tiles.png` | Tileset de 48 tiles de 48 px. **0–23:** los de la nave en versión cálida y polvorienta (paleta corrida del lavanda al beige y motas de polvo en los pisos; mismos índices que `ship.json`). **24–45:** suelo de Gale: llanura (24–27), lecho de lago (28–30), dunas (31–32), roca en polígonos (33), canal (34, 43, 44), campo de azufre (35, 45), techo y ladera de cerro (36–37), huellas de rover (38, sin usar), cresta y cara de duna (39–40), techo y ladera del monte Sharp (41–42) | `python scripts/art/tiles.py art/snapped/gale-suelo.png $(cat art/tiles-gale.args)` y después `python scripts/art/gale-tiles.py`; prompts `gale-llanura` (foto PIA16156), `gale-lago` (PIA17595, PIA16705), `gale-arena` (PIA20755, PIA26309), `gale-canal` (PIA26309, PIA26410), `gale-laderas` (PIA20841, PIA26410), `gale-dunas` (PIA20283) |
| `props.png` + `props.json` | Atlas de objetos: los de la nave más los de Marte (invernadero, MOXIE, traje en su soporte, caja con polvo, paneles solares limpio y con polvo, antena, baliza, rocas chica/mediana/grande, bloque anguloso, una muestra por franja `sample-<tipo>`, Curiosity limpio y con polvo, tubo de muestras) | `python scripts/art/atlas.py mars-props` (lista en `art/manifest.json`); prompts `props-marte-base`, `props-marte-afuera`, `props-marte-rocas`, `props-marte-muestras`, `props-marte-curiosity` |
| `crater.png` | Mapa del cráter Gale para la vista con "estás acá" (tecla V): la foto real PIA15687 (NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS) sin la elipse de aterrizaje, pixelada a 200 × 200 con 28 colores y exportada ×3 | `python scripts/art/crater-map.py` (original en `art/raw/PIA15687.jpg`; georreferencia en `GALE_CRATER_VIEW`) |
| `tiles_n.png`, `props_n.png` | Normal maps para la luz dinámica | `python scripts/art/normals.py public/assets/mars/tiles.png public/assets/mars/props.png` |

El mapa que usa estos recursos es `src/content/maps/gale.json` (Tiled, `node scripts/maps/build-gale.mjs`); el tileset
se llama `gale-tiles`. Si cambian los índices del tileset hay que actualizar `G` en `build-gale.mjs` y volver a correrlo.

# Recursos de la nave

Pixel art generado con codex (imagegen), limpiado con el pixel-snapper y armado con los scripts de `scripts/art/`
(docs/plan-visual.md §4). Los prompts están en `art/prompts/` y los originales en `art/raw/`.

| Archivo | Qué es | Cómo se arma |
|---|---|---|
| `tiles.png` | Tileset de 24 tiles de 48 px: pisos, pasillo, franja de peligro, piso del refugio, frentes de pared, techos, rejilla, espacio, marcos y hojas de puerta | `python scripts/art/tiles.py public/assets/ship/tiles.png $(cat art/tiles-ship.args)`; prompts `tiles-piso`, `tiles-pasillo`, `tiles-pared`, `tiles-techo`, `tiles-puerta` |
| `props.png` + `props.json` | Atlas de objetos (Phaser JSON hash); la ventana lleva `glass` con el rectángulo del vidrio | `python scripts/art/atlas.py ship-props` (lista en `art/manifest.json`); prompts `props-*` |
| `tiles_n.png`, `props_n.png` | Normal maps para la luz dinámica | `python scripts/art/normals.py` (generador de Sprite Fusion en Docker) |

El mapa que usa estos recursos es `src/content/maps/ship.json` (Tiled); el tileset se llama `ship-tiles`.

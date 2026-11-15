# Recursos de los minijuegos de las salas

Pixel art generado con codex (imagegen), limpiado con el pixel-snapper y armado con los scripts de `scripts/art/`
(docs/plan-visual.md §4 y "Minijuegos de las salas"). Los prompts están en `art/prompts/mg-*.txt` y los originales en
`art/raw/`.

| Archivo | Qué es | Cómo se arma |
|---|---|---|
| `items.png` + `items.json` | Atlas de 32 objetos (×2: un píxel de arte = 2 px). Aire: `co2`, `o2`, `cartridge`, `drop`. Agua: `dirtybag`, `filter`, `cleantank`, `waterbag`. Plantas: `plant-ok`, `plant-dry`, `plant-pale`, `plant-bugs`. Herramientas: `wateringcan`, `growlamp`, `ladybug`, `patch`. Comida: `tortilla`, `bread`, `soup`, `soda`, `fruit`, `salt`, `cookie`, `shrimp`. Varios: `heart`, `dust`, `brush`, `star`. Máquinas: `bike`, `dish`, `stethoscope`, `heater` | 8 hojas de 2 × 2 (`mg-aire`, `mg-agua`, `mg-plantas`, `mg-herramientas`, `mg-comida1`, `mg-comida2`, `mg-varios`, `mg-maquinas`) con `scripts/art/batch.sh`; `pre.py`; `snap_pixels` con detección automática y `color_count: 32`; `python scripts/art/atlas.py minigames` |
| `items_n.png` | Normal map del atlas: los objetos toman relieve con la luz que sigue al cursor | `python scripts/art/normals.py public/assets/minigames/items.png` |

Los tableros (caños, pared del refugio, sello de la esclusa, pantallas, velocímetro y termómetro) se dibujan por código
en `src/game/scenes/simulation/minigames/renderers.ts`.

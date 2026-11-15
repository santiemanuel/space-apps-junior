# Recursos del tablero y de la interfaz del mapa

Pixel art generado con codex (imagegen), limpiado con el pixel-snapper y armado con los scripts de `scripts/art/`
(docs/plan-visual.md §4). Los prompts están en `art/prompts/` y los originales en `art/raw/`.

| Archivo | Qué es | Cómo se arma |
|---|---|---|
| `icons.png` + `icons.json` | Atlas de 24 íconos en celdas de 24 × 24 px de arte, **a resolución de arte** (el tablero los muestra ×1 y el mapa ×2). Medidores: `energy`, `air`, `water`, `food`, `co2`, `spares`, `radiation`, `samples`. Salud y globos: `condition`, `fatigue`, `morale`, `warning`. Cuartos (mismo nombre que la zona): `command`, `exercise`, `scrubber`, `recycler`, `infirmary`, `pantry`, `shelter`, `radio`, `greenhouse`, `moxie`, `airlock`; y `dustStorm` | `python scripts/art/icons.py` (grupo `hud-icons` de `art/manifest.json`); prompts `hud-iconos-medidores`, `hud-iconos-recursos`, `hud-iconos-salud`, `hud-iconos-cuartos1`, `hud-iconos-cuartos2`, `hud-iconos-cuartos3`. Cada hoja pasó por `snap_pixels` con `pixel_size: 19.6` fijo (con detección automática salían tamaños de píxel distintos por hoja) |

El marco del tablero, las barras, el minimapa, el globo de los tripulantes y las flechas al refugio se dibujan por
código en píxeles de arte (2 px), con la paleta de la nave. Los retratos son el cuadro de frente de las hojas de
`public/assets/crew/`, recortado.

# Hojas de sprites de la tripulación

Pixel art regenerado con codex (imagegen) a partir de `docs/<id>-sprites.png`, que quedan como referencia de
diseño, y pasado por el pixel-snapper. Las carga la escena `Boot` (`src/game/assets.ts`) con la clave `crew-<id>`.

Cómo se rehacen (docs/plan-visual.md §4): una imagen de 3 × 3 cuadros por dirección (`art/prompts/crew-<id>-
{frente,espalda,izquierda}.txt`, con la tira original de esa dirección como referencia) →
`python scripts/art/regrid.py art/raw/crew-<id>-<dirección>.png --height <alto>` (remuestreo con grilla pareja; alto
de arte: vega 36, miga 39, brote 41, senda 42) → `snap_pixels` con `pixel_size: 8` → `python scripts/art/crew.py <id>`.
El perfil derecho es el izquierdo espejado; el casco del primer cuadro se repite en toda la fila y el reposo es un
solo cuadro con parpadeo (ver `scripts/art/crew.py`).

- PNG con transparencia, 720×384 = 9 × 4 cuadros de 80×96 (40×48 px de arte ampliados ×2).
- Filas: frente, espalda, perfil izquierdo, perfil derecho (idle y caminata).
- Pies en y = 94, centrados en x = 40: origen (0,5; 94/96).

| Archivo | Tripulante | Rol |
|---|---|---|
| `vega.png` | Vega | Comandante |
| `miga.png` | Miga | Ingeniera |
| `brote.png` | Brote | Botánico |
| `senda.png` | Senda | Geóloga y médica |

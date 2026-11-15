# Hojas de sprites de la tripulación

Copias de `docs/<id>-sprites.png` (las de `docs/` quedan como referencia). Las carga la escena `Boot`
(`src/game/assets.ts`) con la clave `crew-<id>`.

- PNG con transparencia, 1584×864 = 9 × 4 cuadros de 176×216.
- Filas: frente, espalda, perfil izquierdo, perfil derecho (idle y caminata).
- Pies en y = 208 y centro en x ≈ 88: origen (0,5; 208/216).

| Archivo | Tripulante | Rol |
|---|---|---|
| `vega.png` | Vega | Comandante |
| `miga.png` | Miga | Ingeniera |
| `brote.png` | Brote | Botánico |
| `senda.png` | Senda | Geóloga y médica |

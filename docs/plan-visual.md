# Plan visual — de rectángulos al objetivo de las láminas

Plan para llevar `Voyage` y `Mars` al aspecto de las referencias de
[`mision_a_marte_referencias_topdown/`](mision_a_marte_referencias_topdown/README.md). Complementa a
[`biblia-visual.md`](biblia-visual.md) (qué piezas hacen falta) y a [`plan-de-trabajo.md`](plan-de-trabajo.md)
(quién es dueño de cada archivo). El sonido queda fuera por ahora.

Estado: **Fases 0–3 hechas (nave completa)**; sigue la Fase 4 (Marte). Ver [Avance de la nave](#avance-de-la-nave) (ver [§ Resultados de la Fase 0](#resultados-de-la-fase-0)).

---

## 1. Punto de partida

- `SimulationMapScene.drawMap()` pinta todo con rectángulos. Los únicos recursos gráficos son las 4 hojas de
  tripulantes de `public/assets/crew/`.
- La nave mide 19 × 15 tiles con cuartos de 4 × 4: entra entera en pantalla. Marte mide 48 × 15, con un exterior
  de 25 × 13.
- En las láminas un tile ocupa unos 72–76 px de pantalla y el personaje unos 115 px: se ven unos 13 × 10 tiles,
  no 19 × 15.
- Las láminas son concept art: no se recortan tiles de ahí. Muestran cinco mascotas; el juego sigue con
  **Vega, Miga, Brote y Senda** y sus sprites actuales.

## 2. Requisitos del pedido

| Requisito | Cómo se cumple |
|---|---|
| Imágenes creadas con codex-cli (imagegen) | `codex exec --enable image_generation`, con `docs/ref-nave.png` y un recorte de referencia adjuntos (§4) |
| Fondo transparente | Se pide alfa real; si no llega, fondo magenta y se quita con un script |
| Resolución adecuada | Un píxel de arte = 2 px de mundo, zoom de cámara 1,5 (§3) |
| Espacios grandes con cámara que sigue | Mapas agrandados y seguimiento en los dos ejes (Fase 2) |
| Píxeles alineados | Toda imagen pasa por el MCP pixel-snapper antes de guardarse |
| Efectos especiales | Partículas, luces, shaders y sacudones (Fase 5) |
| Morfología real de Gale | Exterior como corte comprimido del camino real de Curiosity (Fase 4) |

## 3. Decisiones de escala

| Tema | Decisión | Motivo |
|---|---|---|
| Píxel de arte | 1 píxel de arte = 2 px de mundo: **24 px de arte por tile** | Da el nivel de detalle de las láminas; `TILE = 48` no se toca |
| Zoom de cámara | **1,5** en `Voyage` y `Mars` | Cada píxel de arte queda en 3 px de pantalla exactos, con el encuadre de las láminas (12,7 × 10 tiles) |
| Archivos finales | Exportados ×2 con vecino más cercano | Respeta la convención de múltiplos de 48 px, sin escalas por sprite |
| Tripulación | Mismas hojas, a unos 1,6 tiles de alto | Ver los resultados de la Fase 0 |
| Paleta | Una fija por dominio (nave, base, Marte), pasada al snapper en `palette` | Coherencia entre piezas generadas por separado |

Con una imagen generada de 1536 × 1024 y un píxel falso de 4–8 px salen entre 8 × 5 y 16 × 10 tiles útiles: cada
imagen es **un cuarto o un objeto**, nunca un mapa entero.

## 4. Línea de producción de imágenes

1. **Manifiesto** `scripts/art/manifest.json`: id, prompt, tamaño en tiles, paleta, tamaño de píxel, estados y
   destino.
2. **Generación** con codex: plantilla de prompt común (vista cenital 3/4, contorno oscuro, sin texto, fondo
   transparente, un solo objeto). Los originales quedan en `art/raw/`.
3. **Limpieza** con el pixel-snapper. El MCP sólo ve `C:\code-hello\mcp-snapper\assets`: se copia ahí, se llama a
   `snap_pixels` con paleta y tamaño de píxel fijos y se revisa con `pixel_preview`.
4. **Posproceso** (`scripts/art/`, Pillow): alfa binario, recorte, ajuste a múltiplos exactos de 24 px,
   exportación ×2 y hoja de contacto.
5. **Control de calidad por pieza:** sin texto, silueta legible a tamaño real, sin halo, paleta correcta. Si falla,
   se regenera con un solo cambio en el prompt.
6. **Registro:** el prompt se anota en el `README.md` de cada carpeta de `public/assets/`.
7. **Normal maps:** `python scripts/art/normals.py` genera `<recurso>_n.png` con el generador de Sprite Fusion ("Sprite
   Normals", MIT; el mismo de la herramienta gratuita `create_normal_map` de su MCP), compilado en Docker
   (`docker build -t sprite-normals:local scripts/art/normals`) y sin red. Trabaja a resolución de arte: reduce el
   recurso a la mitad, genera y vuelve a ampliar ×2. Las hojas en grilla usan `--frame-size` para que el relieve de
   una celda no se mezcle con el de la vecina. Se rehace cada vez que cambia un recurso.

## 5. Fases

### Fase 0 — Validar escala y herramientas

1. Prototipo en gris con mapas agrandados y zoom configurable (`&zoom=` y `&layout=large`).
2. Medir la grilla real de las hojas de tripulantes y probar el snapper sobre una.
3. Prueba de punta a punta con 3 piezas (consola, tanque de agua, roca): generar, quitar fondo, snapper, verla en
   el juego.
4. Confirmar que `codex exec` entrega transparencia real.

**Salida:** escala y zoom cerrados, y una captura comparada con `02_escenas_recortadas/01_01_nave_puente.png`.

### Fase 1 — Línea de producción

Dejar armado y probado todo lo de §4 (manifiesto, scripts, paletas por dominio, hoja de contacto).

### Fase 2 — Mapas grandes (código)

1. **Plano:** `ShipLayout` acepta cuartos de cualquier tamaño, obstáculos y un punto de trabajo explícito por zona.
2. **Nave:** unos 41 × 19 tiles o más, con cuartos de 9–12 × 6–8 y pasillo de 3.
3. **Base y exterior de Gale:** exterior de unos 70 × 45 con máscara de terreno transitable (acantilados, cráter,
   dunas).
4. **Render:** `drawMap()` se reemplaza por capas: fondo, piso y paredes, objetos ordenados por Y, capa alta
   semitransparente cuando tapa al jugador, efectos.
5. **Cámara:** seguimiento suave en los dos ejes, con leve anticipo en la dirección de marcha.
6. **Carga de recursos:** en el `preload` de las escenas de simulación, para no tocar `assets.ts` ni `BootScene`
   (de Facundo).
7. **Reglas:** ajustar la velocidad de la tripulación y la colocación de muestras para que `fullGame.test.ts`
   siga pasando.

### Fase 3 — Nave (`public/assets/ship/`)

- **Piezas de cuarto:** cada cuarto es una imagen de piso más paredes con puertas en posiciones estándar. Es la
  forma realista de lograr las paredes con caños y esquinas en chaflán de las láminas.
- **Objetos por cuarto:** mando (ventana grande y consolas), ejercicio (bici), depurador (máquina con caños),
  reciclador (tanques), enfermería (camas), despensa (estantes y cajas), refugio (tanques azules y franja de
  peligro), radio (consola y antena).
- **Estados:** normal, averiado y gastado para la vuelta; luces en ámbar y en rojo.
- **Ventanas:** recorte transparente con estrellas, Tierra y Sol detrás, dibujados por código. El Sol se achica
  con la distancia real.

### Fase 4 — Marte y la morfología real de Gale (`public/assets/mars/`)

**Base:** mismas piezas en versión cálida y polvorienta, más invernadero con luz violeta, MOXIE, esclusa de dos
puertas, y módulos, paneles, antena y balizas vistos desde afuera.

**Exterior:** un corte comprimido y **no a escala** del camino real de Curiosity, de norte a sur. Cada franja
enseña una forma del terreno:

| Franja | Qué se ve | Qué aprende el chico |
|---|---|---|
| Llanura (Aeolis Palus) | Suelo ocre, piedritas redondeadas | Las piedras redondas las pulió un río antiguo |
| Lecho de lago (tipo Yellowknife Bay) | Roca clara en placas agrietadas | Acá hubo un lago hace miles de millones de años |
| Dunas Bagnold | Arena oscura con ondas | El viento todavía mueve la arena |
| Cerros testigo (Murray Buttes) | Mesetas con capas | Cada capa es una página de la historia de Marte |
| Canal Gediz Vallis | Cauce con escombros y rocas pálidas | Rocas con cristales amarillos de azufre |

- **Fecha real:** Curiosity estaba en el canal Gediz Vallis durante la estancia del juego y encontró cristales de
  azufre puro el 30/05/2024 (sol 4200; [JPL PIA26307](https://www.jpl.nasa.gov/images/pia26307-curiosity-captures-close-up-of-sulfur-crystals/)).
  Justifica dónde está estacionado y da una tarjeta "Esto pasó de verdad".
- **Mapa del cráter:** una vista general (borde de ~154 km, monte Sharp de ~5 km en el centro, "estás acá") que
  aclare que el mapa jugable está comprimido.
- **Antes de dibujar:** reunir fotos de HiRISE y Mastcam y guardar las citas en `src/content/` y
  `datasets/README.md`. **Las cifras de esta sección faltan verificar una por una contra su fuente.**
- **Piezas:** suelo en mosaico con variantes, acantilados y borde de cráter modulares, rocas en 3 tamaños, rocas
  de muestra por tipo, huellas, Curiosity limpio y con polvo.
- **Opcional:** dar tipo de roca a las muestras (toca `core/mars`).

### Fase 5 — Efectos (sin sonido)

- **Partículas:** polvo en el aire y al pisar, fuga de aire, vapor, chispas, burbujas en los tanques.
- **Luz:** brillo aditivo en lámparas e invernadero, noche con luces recortadas, alarma roja que late a menos de
  3 destellos por segundo.
- **Shaders:** tormenta de polvo, calima y tinte de alerta. Antes, leer las guías de Phaser 4 en
  `node_modules/phaser/skills/`.
- **Cámara:** sacudón en micrometeorito y en el pico de tormenta; fundido en la esclusa.
- **Detalles:** huellas que se borran, pantallas que parpadean, plantas que se mecen.

### Fase 6 — Tablero e interfaz del mapa

- **Tablero** (`public/assets/hud/`): marco, íconos de medidores y de salud, retratos chicos, minimapa.
- **Sobre el mapa:** globos con ícono, marco de selección ámbar y flechas al refugio en lugar de los carteles de
  texto.
- **Fuera de este plan:** menú, maniobras, tarjetas e informe (de Facundo; las láminas no los cubren).

### Fase 7 — Cierre

- `npm test`, `npm run typecheck` y `npm run build`.
- Comparar capturas contra los 16 recortes y medir rendimiento.
- Actualizar `AGENTS.md`, `biblia-visual.md` y los README de recursos.

## 6. Riesgos

- **Coherencia entre imágenes generadas:** paleta fija, las mismas referencias en cada llamada y generación por
  familias.
- **Reglas afectadas por mapas grandes:** lo detecta `fullGame.test.ts`.
- **Archivos de Facundo:** un cambio de escala de la tripulación toca `CrewSprite.ts`; hay que coordinarlo.

## 7. Decisiones tomadas (15/11/2026)

| Tema | Decisión |
|---|---|
| Zoom | 1,5, confirmado con el prototipo de la Fase 0 |
| Mapas | **Tileset modular** y mapas en **Tiled JSON** (`src/content/maps/*.json`): capas de tiles (piso, paredes, alto) y de objetos (zonas, objetos con su caja de colisión). Phaser los carga nativo con `TilemapGPULayer`; las reglas de `core` leen las zonas del mismo archivo a través de `src/content/tiledLayout.ts` |
| Tripulación | Se regeneran las hojas como pixel art real, con las actuales de referencia, y pasan por el pixel-snapper. Se editan `CrewSprite.ts`, `assets.ts` y `public/assets/crew/` |
| Tipos de roca | Entran ahora: cada muestra tiene tipo, sprite y dato para chicos, más un logro por juntar todos los tipos. **No cambia el puntaje** |
| Revisión | Se frena al terminar la nave completa, antes de Marte |

---

## Resultados de la Fase 0

Hecha el 15/11/2026. Originales, registros de codex y capturas en `art/raw/fase0/`.

### Escala y zoom

- **Se confirma: 24 px de arte por tile y zoom 1,5.** En `capturas/voyage-z1.5.png` las piezas de la hoja (consola
  de 2 tiles, tanque de 1 × 2) quedan con píxeles de 3 px de pantalla y la proporción de las láminas respecto del
  tripulante (~100 px de alto).
- Con zoom 1 se ve demasiado mapa y todo queda chico; con zoom 2 entran sólo 9,5 × 7,5 tiles.
- Las piezas a 48 px de arte por tile (`b-*`) quedan con píxeles de 1,5 px de pantalla, desparejos: descartado.
- La cámara ahora ocupa sólo la vista del mapa (912 px) y sigue al jugador en los dos ejes; el tablero queda sin
  zoom. El aviso y el mensaje final se fijan a la pantalla con `pin()`.

### Generación con codex

- `codex exec --enable image_generation -s workspace-write -i docs/ref-nave.png - < prompt.txt` funciona sin
  intervención: genera, copia a la carpeta pedida y tarda 1–2 minutos por corrida.
- **Transparencia: real** (PNG RGBA de 1254 × 1254), pero el cuerpo sale con alfa 250–254 y bordes suaves. Hay que
  binarizar el alfa antes del snapper (`scripts/art/pre.py`). No hizo falta el fondo magenta.
- **Un objeto por imagen sale demasiado grande:** 105–152 px de arte (4 a 6 tiles), y cada imagen con un tamaño
  de píxel distinto (8, 11 y 12 px).
- **Una hoja de 2 × 2 objetos sale al tamaño justo:** 39–44 px de arte por objeto (unos 2 tiles), todos con el
  mismo tamaño de píxel. **Regla: generar por hojas de 4 objetos de la misma familia**, pidiendo "como dibujado en
  un lienzo de 128 × 128". Los prompts usados están en `art/raw/fase0/prompt.txt` y `prompt2.txt`.
- Pendiente de probar en la Fase 1: hojas de 3 × 3 y piezas grandes (un cuarto entero).

### Pixel-snapper

- Sobre las imágenes generadas funciona bien con detección automática y `color_count: 32`: contornos limpios,
  alfa binario, 29–34 colores.
- El tamaño de salida no es exacto: lo decide la grilla detectada. El ajuste a múltiplos de 24 px lo hace
  `scripts/art/post.py` rellenando, nunca reescalando.
- **No sirve para las hojas de tripulantes.** No son pixel art con grilla (10 836 colores en un cuadro, tramos de
  1 px): el snapper borra las caras y cambia la separación entre cuadros (`crew-snap-compare.png`). La tripulación
  queda como está; a zoom 1,5 convive bien con las piezas nuevas, aunque con trazo más fino. Si se quiere
  igualar, hay que regenerar las hojas (de Facundo), no filtrarlas.

### Herramientas que quedaron

| Archivo | Para qué |
|---|---|
| `scripts/art/pre.py` | Alfa binario y copia a la carpeta del snapper |
| `scripts/art/post.py` | Recorte (también por celda de una hoja), relleno a la grilla y exportación ×2 |
| `scripts/art/capture.mjs` | Captura de una escena con Chrome sin ventana, con teclas opcionales. `chrome --screenshot` solo falla seguido con WebGL |
| `&zoom=`, `&layout=large`, `&props=1` | Parámetros de `?scene=Voyage` y `?scene=Mars` para probar escalas |
| `SHIP_LAYOUT_LARGE`, `GALE_LAYOUT_LARGE` | Planos agrandados de prueba (41 × 19 y 90 × 31 tiles) con `habitatLayout()` |
| `prototypeProps.ts`, `public/assets/proto/` | Piezas de prueba; se retiran al llegar los recursos definitivos |

### Decisiones que cambian respecto del plan

- §4, paso 2: la unidad de generación es la **hoja de 4 objetos**, no el objeto suelto.
- §3, tripulación: no pasa por el snapper.
- Los mapas agrandados son sólo de prueba: la partida normal sigue con los planos chicos hasta la Fase 2.

---

## Avance de la nave

Hecho el 15/11/2026. Capturas de los ocho cuartos en `art/capturas/nave-*.png`.

### Qué quedó

- **Mapa en Tiled:** `src/content/maps/ship.json` (41 × 20 tiles, cuartos de 9 × 6, puertas de 2 tiles). Lo arma
  `node scripts/maps/build-ship.mjs` como punto de partida; después se edita en Tiled (correr el script de nuevo
  pisa los cambios a mano). `src/content/tiledLayout.ts` saca de ahí el plano de las reglas, los objetos y las
  paredes; `tiledLayout.test.ts` verifica que mapa y reglas coincidan y que ningún objeto tape un lugar de trabajo.
- **Render** (`TiledMapView.ts`): piso en `TilemapGPULayer`, paredes en capa común con colisión de tilemap, objetos
  desde un atlas (`load.atlas`) ordenados por su pie, cajas de colisión en un grupo estático. Zoom 1,5 por defecto.
  La capa GPU sólo se usa para el piso: en Phaser 4.2.1 tiñe los tiles vacíos, así que no sirve para capas ralas.
- **Tileset** `public/assets/ship/tiles.png`: 16 tiles de 48 px (4 pisos, 4 pisos especiales, 4 frentes de pared,
  techos, rejilla y espacio).
- **Objetos** `public/assets/ship/props.png` + `.json`: 27 sprites, listados en `art/manifest.json`.
- **Tripulación** regenerada como pixel art: hojas de 720 × 384 (cuadros de 80 × 96), de 36 a 42 px de arte de alto.
- **Reglas tocadas:** la nave es más larga, así que el jugador camina a 210 px/s y la tripulación a 4,5 tiles/s.
  `ShipZone` admite puertas de varios tiles y un lugar de trabajo propio.

### Lo aprendido sobre la generación

- **Tiles:** pedir hojas de 2 × 2 (no 4 × 4: salen con demasiado detalle) y pasar por el snapper **cada tile por
  separado** con `pixel_size` fijo (1254 / 48 = 26,125). La detección automática falla con tiles lisos. El
  snapper devuelve 24–28 px por tile: `scripts/art/tiles.py` lo ajusta quitando líneas repetidas, sin reescalar.
- **Tripulación:** una hoja de 9 × 4 de una vez sale deformada. Sirve una imagen de 3 × 3 por dirección, con la
  tira original de esa dirección como referencia; el perfil derecho se espeja. **Las hojas de animación no van
  directo al snapper:** primero `regrid.py` (ver Errores corregidos) y después `snap_pixels` con `pixel_size: 8`.
- **Lotes:** `scripts/art/batch.sh` corre hasta 4 generaciones de codex a la vez.

### Nave completa (segunda pasada)

- **Puertas corredizas:** marco y hojas en el tileset (las hojas derechas son las izquierdas espejadas). Las hojas se
  abren cuando alguien se acerca, recortándose (`setCrop`) a medida que entran en la pared, en pasos de un píxel de
  arte. Variantes con luz roja para puertas trabadas (esclusa de Marte).
- **Ventanas:** `atlas.py` vuelve transparente el vidrio y anota su rectángulo (`frame.customData.glass`). Detrás
  (`SpaceWindows.ts`) hay estrellas que se corren, el Sol, que se achica con la distancia real del tramo
  (`cruiseDistanceAu`: radio 6 px de arte cerca de la Tierra, 4 cerca de Marte), y el planeta de destino, que crece al
  acercarse.
- **Luces y alarmas** (`HabitatFx.ts`): brillo aditivo escalonado en franjas de luz y lámparas; ámbar con pulso de 1 Hz
  en la alerta y rojo de 2 Hz en el impacto (nunca más de 3 destellos por segundo). Las alarmas giran con dos haces.
  En un corte de energía, oscuridad y sólo luces de emergencia rojas.
- **Averías:** chispas (amarillo) y además humo (rojo) en el depurador, el reciclador y la radio, con un brillo del
  color del semáforo. La fuga de un micrometeorito suelta aire y el impacto sacude la cámara.
- **Nave gastada** (vuelta): cinta, cables sueltos, hollín y grasa (`props-desgaste`), y un 30 % de las luces titila.
- **Bordes de pared:** contorno y línea de luz de un píxel de arte donde el techo de la pared toca el piso.
- Para verlo sin esperar a que pase: `?scene=Voyage&fx=alert|impact,powerOut&broken=scrubber,waterRecycler:yellow`
  y `&leg=back` para la nave gastada.

### Errores corregidos

- **Tripulantes automáticos que vibraban:** se movían con una velocidad "llegar en este cuadro", pero Arcade avanza a
  pasos fijos de 1/60 s; con una pantalla de 144 Hz se pasaban de largo y volvían. Ahora la escena los ubica donde
  dice la sesión (`body.moves = false`) y sólo guarda una velocidad suavizada para la animación.
- **Sprites que se estiraban en reposo:** el snapper ajusta su grilla a los "píxeles" irregulares del generador, y en
  cada cuadro de la hoja salían 2 o 3 columnas de más o de menos (el casco de perfil medía 21 o 24 px de arte según el
  cuadro). Ahora `scripts/art/regrid.py` remuestrea cada cuadro con una grilla pareja anclada a su contorno antes del
  snapper, `crew.py` repite el casco del primer cuadro en toda la fila y el reposo es un solo cuadro con parpadeo
  (1,7 s + 1,5 s quieto y 0,14 s con los ojos cerrados).
- **Píxeles desparejos con el zoom:** todo lo del mapa usa `setVertexRoundMode('full')`; con zoom 1,5 cada píxel de
  arte mide siempre 3 px de pantalla.
- **Todo se seguía moviendo después de frenar, y desfasado:** la cámara de Phaser seguía al jugador con retraso
  (lerp 0,15 por cuadro) y quedaba entre dos píxeles de pantalla, así que cada objeto redondeaba por su lado; además
  el anillo, el nombre y la ayuda se ubicaban antes de la física (un cuadro atrás) y el jugador avanzaba a pasos fijos
  de 1/60 s. Ahora la cámara es propia (`followCamera`): zona muerta de 96 × 64 px sin retraso (frena en el mismo
  cuadro que el jugador), siempre en un píxel entero de pantalla, y viaja 0,35 s al cambiar de tripulante. Todo lo
  que depende de la posición se ubica después de la física (`afterPhysics`) y la física va a paso variable.

### Luz dinámica (normal maps)

- Tileset, atlas de objetos y hojas de la tripulación tienen normal map; Phaser los carga con
  `load.image(key, [url, normal])`, `load.atlas({ normalMap })` y `load.spritesheet({ normalMap })`.
- Todo lo del mapa usa `setLighting(true)` (los brillos aditivos y los textos no). `HabitatFx` pone la luz ambiente
  según el estado, una luz de techo por cuarto y por tramo de pasillo, una por lámpara, una por alarma (late con la
  alerta) y un destello con las chispas. En el corte de energía la oscuridad la hace la luz ambiente.
- Phaser ilumina hasta 10 luces por cámara (`maxLights`, en `config.ts`): usa las más cercanas al centro.
- Por qué el generador local y no el MCP: el MCP pide iniciar sesión (OAuth) en Sprite Fusion y devuelve cada mapa
  como imagen para guardar a mano; el CLI hace lo mismo en lote, sin red y con un resultado repetible.

### Queda para otras fases

- Los carteles de zona y de estación siguen siendo texto (Fase 6: íconos).
- `GALE_LAYOUT` (Marte) sigue con rectángulos hasta la Fase 4; `&layout=large` queda sólo para `Mars`.

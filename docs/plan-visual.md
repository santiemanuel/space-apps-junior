# Plan visual — de rectángulos al objetivo de las láminas

Plan para llevar `Voyage` y `Mars` al aspecto de las referencias de
[`mision_a_marte_referencias_topdown/`](mision_a_marte_referencias_topdown/README.md). Complementa a
[`biblia-visual.md`](biblia-visual.md) (qué piezas hacen falta) y a [`plan-de-trabajo.md`](plan-de-trabajo.md)
(quién es dueño de cada archivo). El sonido queda fuera por ahora.

Estado: **Fases 0–6 hechas** (nave, Marte, efectos y tablero). Falta el cierre (Fase 7): [§ 8. Pendientes](#8-pendientes-en-orden).

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

- **Fecha real:** Curiosity explora el canal Gediz Vallis desde febrero de 2024 (toda la estancia del juego) y
  encontró cristales de azufre puro el 30/05/2024 (sol 4200, piedra "Convict Lake"; foto de MAHLI
  [PIA26307](https://www.jpl.nasa.gov/images/pia26307-curiosity-captures-close-up-of-sulfur-crystals/) y de Mastcam
  PIA26309). Justifica dónde está estacionado y da una tarjeta "Esto pasó de verdad".
- **Mapa del cráter:** una vista general (cráter de 154 km, monte Sharp de 5,5 km sobre el piso del cráter en el
  centro, "estás acá") que aclare que el mapa jugable está comprimido.
- **Fuentes (hecho, 15/11/2026):** cifras verificadas una por una y fotos de HiRISE y Mastcam de cada franja; citas en
  `src/content/galeTerrain.ts` y `datasets/README.md`, fotos en `docs/gale/` (ver "Avance de Marte").
- **Piezas:** suelo en mosaico con variantes, acantilados y borde de cráter modulares, rocas en 3 tamaños, rocas
  de muestra por tipo, huellas, Curiosity limpio y con polvo.
- **Tipos de roca** (decidido): cada muestra tiene tipo, sprite y dato para chicos, más un logro por juntar todos los
  tipos; no cambia el puntaje. Toca `core/mars`, i18n y `achievements.ts` (de Facundo).

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

## 8. Pendientes (en orden)

Para retomar en un chat nuevo: leer `AGENTS.md`, este documento y las capturas de `art/capturas/`. Arrancar por el
primer punto que no esté hecho.

1. ~~**Marte — ambiente**~~: hecho (ver "Ambiente: día, noche y tormenta" en "Avance de Marte").
2. ~~**Efectos que faltan (Fase 5)**~~: hechos (ver "Fase 5: efectos").
3. ~~**Tablero e interfaz (Fase 6)**~~: hecho (ver "Fase 6: tablero e interfaz").
4. ~~**Rework según los recortes (Fase 7)**~~: hecho (ver "Fase 7: rework según los recortes de las referencias").
5. **Cierre:** comparar con los recortes que faltan (enfermería, MOXIE, exterior), medir rendimiento.

Detalles sueltos:
- Tripulantes automáticos que quedan encimados en el mismo cuarto (posiciones de `SLOTS` en `HabitatSession`).
- Confirmar en una pantalla de 144 Hz el arreglo de la vibración y de la cámara (sólo se probó a 60 Hz).
- `maxLights` (10 por cámara) está en `config.ts`, congelado: revisar si alcanza en Marte.
- Gale: los carteles de las franjas siguen siendo texto (son nombres de lugares reales; no hay ícono que los reemplace) y el aviso con el dato de cada franja sale una vez
  por visita a la escena. A los automáticos que vuelven desde afuera los guía `exteriorPath`; el jugador choca con
  el terreno por tiles, así que conviene probar a mano que no se trabe en las esquinas de los cerros.
- Recursos de Gale que quedaron para después: transiciones entre franjas (hoy el borde es un escalón de tiles), más
  variantes del techo del monte Sharp (se repite mucho), hojas de la puerta exterior de la esclusa (hoy sólo la franja
  de peligro y la marca roja), huellas de rover (tile 38, sin usar) y las ventanas de la base (no se pusieron: en
  Marte no hay `SpaceWindows`; harían falta con cielo marciano). Las muestras miden ~1,5 tiles: si se ven grandes,
  regenerarlas más chicas.
- El bundle pasa el aviso de 2000 kB de Vite (2,1 MB; `gale.json` suma ~40 kB).
- Avisar a Facundo del logro nuevo `allRockTypes` en `src/content/achievements.ts` (suyo) y de `Sample.rock`
  (opcional, no cambia el puntaje ni la carga de vuelta). El informe y `Loadout` todavía no muestran el tipo de cada
  muestra.
- Avisar a Facundo de los cambios en sus archivos de tripulación (`CrewSprite.ts`, `assets.ts`, `crewAnimations.ts`,
  `TitleScene.ts`, hojas de 80 × 96 con normal maps) y del globo con ícono de `CrewSprite.ts` (Fase 6).
- Documentación vieja: `biblia-visual.md` (tabla de reglas) y `plan-de-trabajo.md` §3.8 todavía dicen cuadros de
  176 × 216; el README de las referencias menciona `03_documentacion`, que no existe.
- Decidir si `art/` (~39 MB de originales) se versiona o va a `.gitignore`.
- MCP de Sprite Fusion: opcional, no configurado (se usa el generador local en Docker).

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
| `SHIP_LAYOUT_LARGE`, `GALE_LAYOUT_LARGE` | Planos agrandados de prueba (41 × 19 y 90 × 31 tiles) con `habitatLayout()`; retirados al llegar los mapas de Tiled |
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
- **Tileset** `public/assets/ship/tiles.png`: 24 tiles de 48 px (4 pisos, 4 pisos especiales, 4 frentes de pared,
  techos, rejilla, espacio, marcos y hojas de puerta).
- **Objetos** `public/assets/ship/props.png` + `.json`: 31 sprites (con los de desgaste), listados en `art/manifest.json`.
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
- ~~`GALE_LAYOUT` (Marte) sigue con rectángulos hasta la Fase 4~~: ya sale de `gale.json` (ver "Avance de Marte").

---

## Avance de Marte

Hecho el 15/11/2026. Capturas en `art/capturas/gale-*.png` (`gale-mapa.png` es la vista general).

### Fuentes (antes de dibujar)

- Cifras verificadas contra la NASA: cráter de **154 km**; monte Sharp de **5,5 km** sobre el piso del cráter (el plan
  decía ~5; la NASA usa las dos, 5 redondeado); cráter de más de 3000 millones de años; Curiosity en Gediz Vallis
  **desde febrero de 2024** (canal de ~91 m de ancho); azufre puro el **30/05/2024, sol 4200** (la foto PIA26307 es de
  MAHLI, no de Mastcam; la de Mastcam es PIA26309, del 07/06).
- Cada franja tiene su lugar real, qué dibujar, la cita y 2–5 fotos (HiRISE y Mastcam): `GALE_STRIPS` en
  `src/content/galeTerrain.ts`. Las fotos (1600 px, dominio público) están en `docs/gale/` con su README; la tabla de
  cifras, en `datasets/README.md`.
- Textos para chicos de cada franja en `mars.terrain.<id>.name|fact` (es y en).

### Mapa en Tiled

- `src/content/maps/gale.json` (72 × 72 tiles) lo arma `node scripts/maps/build-gale.mjs` (pisa lo editado a mano).
  La base son los mismos 8 cuartos de 9 × 6 que la nave más la **esclusa** (6 × 6) en la fila de abajo, con una puerta
  al pasillo y otra al exterior, alineadas. Afuera, de norte a sur: llanura de Aeolis (con la base y rocas sueltas),
  lecho de lago de Yellowknife Bay, dunas Bagnold (crestas que no se pisan), cerros Murray (mesetas) y el canal Gediz
  Vallis entre las laderas del monte Sharp, con montículos de bloques, el campo de azufre y Curiosity.
- **Máscara de terreno:** el exterior es todo el mapa menos el borde; lo que no se pisa sale de la capa `paredes` y de
  las cajas de los objetos (`ExteriorLayout.blocked`). `zoneAt` mira el pasillo antes que el exterior. La puerta
  exterior tiene 2 tiles (`doorTiles`). El script falla si queda terreno al que no se llega desde la esclusa, y
  `tiledLayout.test.ts` lo vuelve a comprobar.
- **Caminos:** `exteriorPath` (búsqueda en anchura por tiles y atajos en línea recta) guía a los automáticos por el
  exterior; `route` y `routeToPoint` lo usan. Las muestras sólo caen en terreno transitable; `valuePerTile` bajó a 1
  porque el exterior es más grande (lo más lejano sigue valiendo ~70) y la tripulación camina a 4,5 tiles/s como en
  la nave.
- **Capas extra en `zonas`:** rectángulos `terrain` (una franja cada uno, `GALE_TERRAIN`) y puntos `landmark`
  (`curiosity`, `GALE_LANDMARKS`).
- **Tileset:** primero fue un provisorio dibujado por código; lo reemplazaron los recursos de abajo.
- **Escena:** `MarsScene` pinta el mapa con `TiledMapView` (los bordes de pared sólo en los techos de la base:
  `rimTiles`), pone a Curiosity en su punto, carteles con el nombre de cada franja, un aviso con el dato real al
  entrar a cada una y un velo de noche sólo sobre el exterior. Se quitaron `GALE_LAYOUT_LARGE`, `habitatLayout`,
  `&layout=large` y el mapa de rectángulos. Para probar: `?scene=Mars&at=<franja>|curiosity`.
- Vista general sin abrir el juego: `python scripts/maps/preview.py <mapa.json> <salida.png> [escala]`.

### Recursos de Marte

- **Tileset** `public/assets/mars/tiles.png` (48 tiles): la base es el tileset de la nave con la paleta corrida del
  lavanda al beige tostado y motas de polvo en los pisos (`scripts/art/gale-tiles.py`; se dejan igual el piso azul del
  refugio y las luces azules y naranjas). El suelo son 22 tiles generados con codex en 6 hojas de 2 × 2 (`gale-*`),
  con las fotos de `docs/gale/` adjuntas como referencia de color y material; cada tile pasó solo por el snapper con
  `pixel_size: 26.125` y lo armó `tiles.py` (`art/tiles-gale.args`). `gale-tiles.py` también borra los bordes que se
  veían como costura al repetir dos tiles (`EDGE_FIX`).
- **Lo aprendido:** con "tiles that tile seamlessly" el generador a veces dibuja manchas sobre otro fondo (la grava y el
  azufre salieron como islas sobre arena oscura); lo arregló pedir "completely covered ... edge to edge, NO patches"
  (`gale-canal`). Revisar cada tile repetido 3 × 3 antes de darlo por bueno.
- **Objetos** (`public/assets/mars/props.*`, grupo `mars-props` de `art/manifest.json`, que incluye los de la nave):
  invernadero con luz violeta, MOXIE dorado, traje en su soporte, caja con polvo, paneles solares limpio y con polvo,
  antena, baliza, rocas en 3 tamaños, bloque anguloso, una muestra por franja, Curiosity limpio y con polvo y un tubo
  de muestras. Todos salieron bien en la primera tanda (5 hojas).
- **Normal maps** de los dos (`normals.py`); el mapa de Gale ya recibe luz dinámica (`normals: true`).
- **Mapa** (`build-gale.mjs`): invernadero con 4 canteros, MOXIE en su cuarto (es la máquina que echa chispas cuando
  se avería), traje y caja en la esclusa; afuera, 5 paneles solares, la antena, dos balizas junto a la puerta, rocas
  grandes y bloques como objetos con colisión (tapan su tile) y 60 piedras chicas y medianas en `decorado` (se pisan).
  Curiosity (con polvo) es un objeto con colisión en el canal.
- **Escena:** cada muestra se dibuja con la roca de su franja y un anillo a los pies (el arco azul es el avance); los
  bordes de los techos usan la paleta cálida (`rimColors`) y también van en los cerros, las crestas y el monte Sharp.
- Para probar de día: `&from=2024-05-16T12&length=long` (`from` acepta una hora; con `length=short` la partida
  arrancó a medianoche del día siguiente).

### Tipos de roca y logro

- **Tipos** (uno por franja, `GALE_ROCKS` en `src/content/galeTerrain.ts`, con su fuente): conglomerado (llanura),
  lutita de lago (Yellowknife Bay), arena de basalto (dunas Bagnold; la NASA las llama "basaltic Bagnold sands"),
  arenisca en capas (cerros Murray) y azufre puro (Gediz Vallis).
- **Reglas:** `MarsContent.samples.rocks` dice en qué franja aparece cada tipo. `sampleSites` reparte las muestras
  entre las franjas en orden (8 muestras para 5 tipos: siempre hay una de cada uno) y sólo las pone donde hay lugar
  alrededor para llegar (no pegadas a una roca o una ladera). Cada muestra lleva `rock` (también en `Sample`, opcional
  para partidas viejas, y en la anotación `mars.log.sample` del historial). **El puntaje no cambia.**
- **Logro** `allRockTypes` ("Coleccionista de rocas"): juntar en Marte una de cada tipo, aunque después no todas
  entren en la nave (se lee del historial).
- **Escena:** cada muestra se dibuja con su sprite (`sample-<tipo>`; se renombraron los del atlas) y al juntarla un
  aviso dice qué roca es y su dato para chicos (`mars.rock.<tipo>.name|fact`, `mars.rock.collected`). El globo de
  Curiosity quedó centrado arriba del rover (se salía de la pantalla).
- **Tests:** una muestra de cada tipo en su franja con 20 semillas, lugar libre alrededor de cada una, el logro, las
  claves de texto, y que cada fuente sea de la NASA, cada foto exista en `docs/gale/` y cada tipo tenga su sprite
  (`galeTerrain.test.ts`).

### Mapa del cráter y tarjeta del azufre

- **Imagen:** `public/assets/mars/crater.png` sale de una foto real, PIA15687 (vista desde arriba de Gale,
  NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS), con `python scripts/art/crater-map.py`: se borra la elipse de aterrizaje
  dibujada en la foto, se reduce a 200 × 200 píxeles de arte con 28 colores y se exporta ×3 (cada píxel de arte mide
  3 px de pantalla, como en el mapa del juego).
- **Georreferencia:** la elipse de 2012 (20 × 7 km, centro en 4,5965° S, 137,4019° E) da la escala (1,18 píxeles de
  arte por km) y el ancla. Con eso el borde de 154 km cae justo sobre el del cráter (control con `--check`, en
  `art/raw/crater-check.png`). Los lugares tienen coordenadas de fuentes citadas (`GALE_PLACES`: centro del cráter,
  monte Sharp y Gediz Vallis del nomenclátor del USGS; Bradbury Landing de Malin et al. 2017) y `craterPoint` los
  ubica en la imagen. Del aterrizaje al extremo norte de Gediz Vallis hay 11 km en línea recta.
- **Vista** (`CraterView.ts`, dibujada por el tablero en Marte): se abre con **V**, y sola al llegar a Gale; pausa el
  reloj. Muestra el borde punteado de 154 km, el monte Sharp (5,5 km de alto), dónde aterrizó Curiosity y dónde está
  hoy, la escala y el norte, y una lupa ×6 sobre el camino con las cinco franjas del mapa en orden y una cruz que
  titila en la fila del jugador ("estás acá"; la posición sale de `SimSnapshot.activePosition`). Un texto aclara que el
  juego encoge esos 11 km.
- **Tarjeta del azufre:** `MarsContent.realMoments` (por ahora sólo `SULFUR_EVENT`): cuando el reloj pasa el mediodía
  del 30/05/2024, `MarsSession` publica `realEvent:shown` (el flujo abre la tarjeta "Esto pasó de verdad") y lo anota
  en el historial una sola vez. Sol 4200, APXS y MAHLI, con el enlace a PIA26307. La campaña 2024 ahora tiene tres
  tarjetas en Marte (tormenta, polvo y azufre).

### Ambiente: día, noche y tormenta

- **Cielo** (`MarsSession.sky`): altura del Sol (`sunAt`, el mismo seno de 6 a 18 que usa la energía), polvo del día
  (f_polvo del UV real de REMS) y si hay una tormenta de polvo en curso. `marsSky.ts` lo pasa a color de luz ambiente:
  noche azul oscura, amanecer y atardecer azulados (en Marte el cielo se ve azul alrededor del Sol al ponerse),
  mediodía caramelo; el polvo la apaga y la vuelve ocre, y la tormenta más.
- **Luz dinámica** (`HabitatFx`, con `outdoor`): la luz ambiente es la del cielo en todo el mapa; con el cielo oscuro las
  luces de techo de la base suben (`NIGHT_ROOM_BOOST`), así de noche la base se ve iluminada desde adentro y la luz se
  derrama afuera. Se quitó el velo fijo de la noche de `MarsScene`.
- **Corte de energía:** con exterior, oscurece sólo el rectángulo de la base (`interior`) hasta el brillo de un corte;
  afuera sigue la luz del Sol. De noche no hace falta velo.
- **Luces de afuera:** al oscurecer se prenden las balizas junto a la esclusa (laten despacio) y una linterna de casco
  (luz en cono, `setCone` de Phaser 4.2) por tripulante afuera, hacia donde camina; el del jugador lleva además una luz
  chica alrededor. Usan pocas luces: el cono del jugador es el más cercano al centro de la cámara y nunca queda afuera
  de las 10 (`maxLights`).
- Para probar: `&from=2024-05-16T12|T17|T22` (mediodía, atardecer, noche), `&fx=storm` (tormenta forzada) y
  `&fx=powerOut`. Capturas en `art/capturas/ambiente/`.

---

## Fase 5: efectos

Hecha el 15/11/2026. Capturas en `art/capturas/ambiente/`.

- **Detalles con vida** (`MapLife.ts`, en la nave y en la base): pantallas que respiran y parpadean cada tanto (y se
  apagan en un corte de energía), burbujas que suben en los tanques, vapor que sale cada tanto de los tanques y del
  reciclador, y las hojas de la planta que se mecen (una copia recortada del sprite que gira apenas sobre la base de
  las hojas; la maceta queda quieta). Los rectángulos de pantallas, líquido y hojas están medidos sobre el atlas
  (`SCREENS`, `LIQUID`, `LEAVES`): si se regenera un objeto, hay que volver a medirlos.
- **Clima de afuera** (`MarsWeatherFx.ts`): polvo en el aire que lleva el viento (más en días con polvo y mucho más en
  la tormenta), nubes de polvo que cruzan la vista en la tormenta, polvo que levantan las botas y huellas que se borran
  (24 s; 5 s con tormenta). El polvo nace en lo que se ve y nunca adentro de la base.
- **Calima:** filtro `ColorMatrix` externo de la cámara (pierde color y contraste) según el polvo del día y la
  tormenta, sólo con el jugador afuera (aparece y se va en 0,8 s al cruzar la esclusa). Los píxeles siguen nítidos.
- **Cámara:** sacudón al llegar la tormenta de polvo y ráfagas cada 5–11 s en su pico, con el jugador afuera; fundido
  corto al cruzar la puerta exterior de la esclusa.
- **Balizas:** además del latido, un haz que gira como un faro.
- Las plantas del invernadero no se mecen (están dentro del cantero con vidrio).

## Fase 6: tablero e interfaz

Hecha el 15/11/2026.

- **Íconos** (`public/assets/hud/icons.*`, 24 íconos generados con codex en 6 hojas de 2 × 2, `scripts/art/icons.py`):
  salieron todos bien en la primera tanda. Snapper con `pixel_size: 19.6` fijo para que todas las hojas tengan el
  mismo tamaño de píxel. Constantes en `src/game/hudIcons.ts`.
- **Tablero** (`HudScene`, `PanelColumn`): marco de metal con remaches y franjas de luz; barras en segmentos (avance de
  la fase, energía, aire y agua); una fila con aire, agua, comida y CO2 en ícono y días; repuestos; leyenda de salud
  con íconos; cada tripulante con su retrato (el cuadro de frente de su hoja), nombre y cuarto, y los cuatro íconos de
  salud con una luz del semáforo debajo. `PanelColumn` acepta `icon`, `icons` (con `frame`), `cells`, `bar` y
  `portrait`; `MissionControl` sigue igual.
- **Minimapa** (`Minimap.ts`): abajo a la derecha de la vista: plano (piso, paredes, terreno de afuera), tripulación
  con el color de su traje, el jugador con un anillo que titila, las muestras en Marte, el refugio titilando en una
  tormenta de radiación y el rectángulo de lo que se ve.
- **Sobre el mapa:** cada cuarto con su ícono en la esquina (el nombre aparece sólo con el jugador adentro); las
  estaciones son una placa con el ícono, el borde del color del semáforo y la barra de avance; los globos de los
  tripulantes muestran el ícono del motivo (sueño, estado físico, CO2, extrañar la Tierra; el texto entero está en el
  tablero) y en una tormenta de radiación tres flechas ámbar al lado del jugador apuntan al refugio.
- Textos nuevos: `hud.meter.daysShort|manyDaysShort|co2Short|co2OkShort`, `hud.health.*`, `hud.panel.sparesShort`.
- **Tablero simplificado (15/11/2026):** el tablero quedó con lo justo: reloj y semáforo, tres barras (energía, aire y
  agua, comida), la tripulación con retrato y nombre (sólo se prende el ícono de salud que no está en verde) y los
  avisos. CO2 alto, falta de repuestos y polvo en Marte aparecen sólo cuando son un problema. El detalle pasó al
  **estado completo** (`StatusView.ts`, tecla I, pausa el reloj): reservas con sus días, máquinas, salud de cada
  tripulante en barras, dosis de afuera con fecha y fuente, tiempo de Curiosity y todas las teclas. Es una vista de
  `HudScene` (como `CraterView`), no una escena nueva. Capturas en `art/capturas/hud/`.
- **Luz y sombras (15/11/2026):** la grilla de tiles que se marcaba bajo la linterna no venía de los normal maps (el
  de la llanura es casi plano) sino de `TilemapGPULayer`, que en Phaser 4.2.1 lee el normal map cabeza abajo: el piso
  pasó a una capa común. La linterna del casco sale del frente del casco, corrida hacia donde mira (`HELMET_LAMP`): el
  cuerpo ya no se ilumina a sí mismo y de espaldas tapa el arranque del haz. Los objetos de afuera arrojan sombra
  (`castShadows` en `HabitatFx`): su silueta en negro, acostada del lado opuesto a cada linterna o baliza y más larga
  cuanto más alto el objeto y más lejos la luz. La tripulación todavía no arroja sombra. Capturas en
  `art/capturas/luz/`.
- No se probaron a mano las flechas al refugio (hace falta una tormenta de radiación real en la partida).

## Fase 7: rework según los recortes de las referencias

Hecha el 15/11/2026, tomando `01_03_base_invernadero`, `02_01_nave_comunicaciones`, `03_01_nave_sala_comun`,
`03_02_nave_alerta_radiacion` y las láminas 05 y 06 (se ignoraron las pantallas de side-scroller). Capturas en
`art/capturas/rework/` (las `antes-*` son del estado anterior).

- **Salas:** el mando pasó a ser la sala común (ventanal, consolas bajas, sillón curvo con holomesa); la radio, la sala
  de comunicaciones (escritorio de dos pantallas con silla, radar, pantalla de pared); el refugio, la sala de la alerta
  de radiación (ventanal al Sol, pantalla de aviso, tanques de escudo y luz roja junto a su puerta). Los cuartos con
  ventanal quedaron arriba (su pared tiene techo y frente: entra un ventanal de casi 2 tiles): en la nave se cambiaron
  de lugar el refugio con el CO2 y la radio con el agua; en Gale, arriba quedaron mando, gimnasio, refugio e
  invernadero, y MOXIE al lado de la esclusa. El invernadero de Gale sigue la referencia: gabinetes de cultivo con luz
  violeta, el ventanal a Gale entre ellos, monitor de plantas, tanque hidropónico y dos canteros.
- **Recursos nuevos (codex + pixel-snapper):** `props-comunicaciones`, `props-sala-comun`, `props-ventanas`,
  `props-invernadero` (con el recorte de referencia adjunto a cada prompt), `tiles-piso2`, `tiles-pared2`,
  `tiles-relleno` (maquinaria con caños naranjas entre cuartos y piso del pasillo), `vista-marte` (paisaje detrás de
  los ventanales de la base) y los íconos `hud-iconos-botones` y `hud-iconos-objetivo`. Todos salieron bien en la
  primera tanda. Normal maps rehechos.
- **Lo aprendido:** el piso liso pasado por el snapper deja la junta en un lado distinto en cada tile y la rejilla no se
  entiende a 24 px: `scripts/art/tile-fix.py` empareja bordes y redibuja la rejilla con los colores del mismo tile. El
  ventanal salió de 2 tiles; `atlas.py` acepta `stretch` en el manifiesto (repite columnas y filas lisas sin cambiar el
  tamaño del píxel) y quedó de 4 × 1,8 tiles.
- **Paredes:** los techos llevan caños que siguen la pared (verticales entre cuartos, horizontales a lo largo) y los
  cuartos un borde grueso biselado con chaflanes en las esquinas (`bevel` en `MapAssets`, dibujado por código en
  `TiledMapView` porque la geometría tiene que ser exacta).
- **Ventanales:** cada uno muestra lo de su cuarto (`SpaceWindows` con `role`): el mando, el planeta de destino; la
  radio, el planeta del que se sale (grande al salir); el refugio, el Sol, que encandila en una tormenta de radiación.
  El planeta llega a 14 píxeles de arte de radio. En Gale, el paisaje teñido con la luz del cielo.
- **Luz:** brillos y luces de color por objeto (`GLOWS` en `HabitatFx`): violeta de los cultivos, cian de la holomesa
  y las pantallas, rojo de las luces de alarma (sólo en alertas). Flechas ámbar en el piso del pasillo hacia la puerta
  del refugio en una tormenta de radiación. La cámara mira 64 px más arriba del jugador para que se vean los ventanales.
- **Tablero:** la vista del mapa pasó a 21 tiles y el panel a 272 px, en cajas como en las referencias: minimapa (lo
  dibuja el tablero; el mapa le pasa los puntos por el `registry`, `MINIMAP_FRAME`), medidores con los días que duran
  (y si la energía carga o gasta), tripulación, **datos reales de hoy** (radiación medida, demora de la señal a la
  Tierra, distancia al Sol o el tiempo de Curiosity, paneles contra gasto, siempre "dato archivado") y abajo el
  objetivo tildable o la caja roja de alerta. Sobre el mapa: placa del tripulante del jugador (cara, cuarto, cuatro
  luces de salud), franja de la misión arriba al centro, botones con ícono y tecla (P, C, G, I, V) y la tarjeta de la
  decisión pendiente (opciones con su riesgo, tecla y coste). Todo eso se esconde con una pantalla superpuesta abierta.

Pendientes de esta fase:
- Avisar a Facundo del cambio de lugar de los cuartos y del ancho de la vista (`VIEW_WIDTH` = 21 tiles).
- Las puertas siguen siendo las corredizas de antes: faltan marcos octogonales con columnas de luz como en las
  referencias (habría que generar el marco del tamaño exacto de la puerta).
- El refugio no tiene la compuerta con el trébol en su puerta (el sprite `shelterhatch` está en el atlas sin usar).
- Las mascotas de las láminas siguen sin usarse: se mantiene la tripulación Vega, Miga, Brote y Senda.
- **Puertas, franja de peligro y pasillo (15/11/2026, segunda pasada):** `tiles-puerta2` (marco con barra de luz
  naranja, o roja en la variante, y hojas lisas con ranura y luz cian) y `tiles-pasillo2` (placa azul lavanda, placa con
  línea guía, franja de peligro y piso del refugio), generados con el recorte de referencia adjunto. `tile-fix.py`
  (antes `floor-fix.py`) también junta los colores casi iguales de las hojas de puerta y les redibuja ranura y zócalo,
  dibuja la línea guía de borde a borde y redibuja la franja de peligro a 45° con período de 8 píxeles para que siga
  sin corte entre los dos tiles de cada puerta. La línea guía ahora recorre toda la fila del medio del pasillo.

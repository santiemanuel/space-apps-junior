# Registro de pixel art

Todo el pixel art creado para el pulido de la interfaz, con su nombre, su ubicación y cómo se rehace, para poder
reemplazar cualquier pieza sin romper nada. Las piezas anteriores (nave, Marte, tripulación, tablero, minijuegos)
están documentadas en el `README.md` de cada carpeta de `public/assets/`.

Reglas generales (ver [`biblia-visual.md`](biblia-visual.md) §2): PNG con transparencia, sin texto, contorno oscuro y
paleta de la interfaz.

## Cómo reemplazar una pieza

1. Guardar el PNG nuevo con **el mismo nombre y en la misma carpeta**.
2. Si es una hoja de cuadros (spritesheet), respetar **el tamaño de cada cuadro**. Si cambia, actualizarlo en
   `src/game/assets.ts` (`TITLE_ASSETS`). `src/game/assets.test.ts` verifica que cada archivo exista y que la hoja tenga
   un número entero de cuadros.
3. Las piezas se dibujan chicas (en "píxeles de arte") y el juego las amplía sin suavizar. La escala de cada una está en
   la tabla.

---

## Menú principal (`Title`)

Cielo animado del menú: la Tierra y Marte girando, la ISS y el CubeSat OPSIS en órbita, estrellas fugaces y meteoritos, asteroides lejanos
y la nave de la misión yendo de la Tierra a Marte.

- **Carpeta:** `public/assets/ui/title/`
- **Cómo se rehace:** `python scripts/art/title-sky.py` (Pillow y numpy; sin red). Rehace todas las piezas de la tabla.
- **Dónde se usa:** `src/game/scenes/flow/titleSky.ts` (animaciones) y `src/game/scenes/flow/planetRender.ts` (los
  planetas que giran). Las claves de textura están en `TitleTextures` (`src/game/assets.ts`).

| Nombre | Archivo | Tamaño (px de arte) | Cuadros | Escala en pantalla | Qué es | Origen |
|---|---|---|---|---|---|---|
| Mapa de la Tierra | `public/assets/ui/title/earth-map.png` | 512 × 256 | — | ×3 (proyectado en la esfera) | Mapa equirectangular de la Tierra reducido a 20 colores | NASA Blue Marble 2002 (dominio público) |
| Nubes de la Tierra | `public/assets/ui/title/earth-clouds.png` | 512 × 256 | — | ×3 (sobre la Tierra) | Nubes blancas en dos opacidades, en franjas de este a oeste; empalman en los bordes y giran un poco más rápido que la superficie | Dibujadas por el script (ruido con semilla 2024) |
| Mapa de Marte | `public/assets/ui/title/mars-map.png` | 128 × 64 | — | ×3 (proyectado en la esfera) | Mapa equirectangular de Marte reducido a 12 colores, con tono óxido | Mosaico Viking MDIM 2.1 de USGS / NASA Ames (dominio público) |
| ISS | `public/assets/ui/title/iss.png` | 84 × 21 | 2 de 42 × 21 | ×2 | Estación Espacial Internacional vista desde arriba: armazón, 4 pares de paneles solares dorados y módulos. El segundo cuadro tiene un destello del Sol en los paneles | Dibujada por el script |
| Meteorito | `public/assets/ui/title/meteor.png` | 52 × 13 | 4 de 13 × 13 | ×2 (×3 los grandes) | Roca que gira con el borde delantero al rojo vivo | Dibujada por el script |
| Estela del meteorito | `public/assets/ui/title/meteor-trail.png` | 44 × 7 | — | ×2 o ×3, mezcla aditiva | Estela amarilla, naranja y roja que se apaga con tramado de píxeles. El extremo brillante (x = 0) va pegado a la roca | Dibujada por el script |
| Asteroide | `public/assets/ui/title/asteroid.png` | 160 × 20 | 8 de 20 × 20 | ×1 (lejos) y ×2 (cerca) | Roca irregular con cráteres que da una vuelta entera en los 8 cuadros, con la luz siempre desde arriba a la derecha | Dibujada por el script |
| Nave de la misión | `public/assets/ui/title/ship.png` | 68 × 11 | 2 de 34 × 11 | ×2 | Nave de propulsión nuclear térmica (game-design §2.1) mirando a la derecha: tobera con llama, armazón, radiadores y módulo habitable. La llama titila entre los dos cuadros | Dibujada por el script |
| CubeSat OPSIS | `public/assets/ui/title/opsis.png` | 26 × 9 | 2 de 13 × 9 | ×2 | CubeSat 3U con dos paneles solares y antena; el LED pasa de verde a rojo. Cruza el cielo una sola vez por carga de la página, justo por encima de la atmósfera, y muestra su nombre, "OPSIS", al pasar el mouse; mientras está bajo el mouse va más lento. Referencia al proyecto OPSIS de Facundo | Dibujado por el script |
| Estrellas | `public/assets/ui/title/stars.png` | 28 × 7 | 4 de 7 × 7 | ×2 | Cuatro tamaños de estrella, de un punto a un destello en cruz | Dibujadas por el script |
| Logotipo | `public/assets/ui/title/logo.png` | 512 × 512 (arte de 128 × 128 ampliado ×4) | — | ×0,5 (cada píxel de arte en 2 × 2 de pantalla) | «HELLO MARS» en una cinta sobre el Marte del menú, con un anillo de botones de elegir (✔, ⚠, ✖), una palanca y un astronauta asomado: las decisiones de la misión. Reemplaza al título en texto del menú | Generado con codex: `python scripts/art/logo-planet.py` (Marte de referencia, `art/raw/logo/planet-ref.png`) → `scripts/art/gen.sh logo-b art/raw/logo/planet-ref.png` (prompt `art/prompts/logo-b.txt`) → `pre.py` → `snap_pixels` (`color_count: 24`, grilla automática) → `art/snapped/logo-b.png` (centrado en 128 × 128) → ampliado ×4 sin suavizar |

**No son archivos:** los planetas que se ven girando se pintan en tiempo real en dos texturas de canvas,
`title-earth-canvas` (228 × 228) y `title-mars-canvas` (48 × 48), a partir de los mapas de arriba (20 cuadros por
segundo, con terminador día/noche, inclinación real del eje y halo de atmósfera).

### Fuentes de los mapas

Copias en `art/raw/title/` para poder rehacer las piezas sin red:

| Archivo | Fuente | Licencia |
|---|---|---|
| `art/raw/title/blue-marble.jpg` (1280 × 640) | NASA Earth Observatory, *The Blue Marble* (2002), `land_shallow_topo_2048` (Reto Stöckli, NASA GSFC), [Visible Earth 57752](https://visibleearth.nasa.gov/view.php?id=57752), copia de [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Land_shallow_topo_2048.jpg) | Dominio público |
| `art/raw/title/mars-viking-mdim21.jpg` (1280 × 640) | USGS Astrogeology / NASA Ames, *Mars Viking MDIM 2.1 Colorized Global Mosaic*, copia de [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg) | Dominio público |

`eoimages.gsfc.nasa.gov` no responde desde algunas redes; Commons sirve la misma imagen con
`https://commons.wikimedia.org/wiki/Special:FilePath/<archivo>?width=1280` (pide un `User-Agent`).

---

## Escenas de vuelo (`Maneuver`)

Ilustración animada de las cuatro maniobras (despegue de la Tierra, aterrizaje en Marte, despegue de Marte y regreso):
plataforma y torre, tripulación abordando, cuenta regresiva, despegue con llama y humo, separaciones, cápsula con
plasma, paracaídas y amerizaje.

- **Carpeta:** `public/assets/ui/flight/`
- **Cómo se rehace:** `python scripts/art/flight.py` (Pillow y numpy; sin red). Todo está dibujado por el script.
- **Dónde se usa:** `src/game/scenes/flow/flightArt.ts` (la ilustración, con su propia cámara) y
  `src/game/scenes/flow/ManeuverScene.ts`. Claves de textura en `FlightTextures` (`src/game/assets.ts`).

| Nombre | Archivo | Tamaño (px de arte) | Cuadros | Escala | Qué es |
|---|---|---|---|---|---|
| Cohete | `public/assets/ui/flight/rocket.png` | 16 × 56 | — | ×3 | Etapa central blanca con franjas naranjas y la cápsula arriba (mira hacia arriba) |
| Propulsor | `public/assets/ui/flight/booster.png` | 8 × 38 | — | ×3 | Propulsor lateral izquierdo; el derecho es el mismo espejado |
| Torre | `public/assets/ui/flight/tower.png` | 20 × 74 | — | ×3 | Torre de lanzamiento roja con el brazo de acceso de la tripulación |
| Llama | `public/assets/ui/flight/flame.png` | 36 × 20 | 3 de 12 × 20 | ×3 (×1,8 en la cápsula) | Llama del motor hacia abajo, titila |
| Humo | `public/assets/ui/flight/smoke.png` | 56 × 14 | 4 de 14 × 14 | ×3,6 a ×6 | Bocanada que crece y se aclara; se tiñe de ocre en Marte |
| Cápsula | `public/assets/ui/flight/capsule.png` | 20 × 16 | — | ×3 | Cápsula de la tripulación con el escudo térmico abajo |
| Escudo térmico | `public/assets/ui/flight/shield.png` | 20 × 6 | — | ×3 | El escudo suelto cuando se separa |
| Paracaídas | `public/assets/ui/flight/parachute.png` | 34 × 26 | — | ×3 | Paracaídas a franjas naranjas y blancas con sus cuerdas |
| Nave de ascenso | `public/assets/ui/flight/lander.png` | 20 × 40 | — | ×3 | Nave de ascenso de Marte sobre sus patas, con polvo rojizo |

### Escenografía de los despegues (generada)

Los dos despegues (`ascent` y `marsAscent`) usan escenografía generada con codex-cli, más detallada, a partir de los
mockups de [`docs/prototipos-despegue/`](prototipos-despegue/README.md). El cohete, la torre, la cápsula y la nave de
ascenso viejos (`rocket.png`, `booster.png`, `tower.png`, `lander.png`) quedan sólo para el aterrizaje y la reentrada.

- **Cómo se rehace:** prompts `art/prompts/vuelo-*.txt` → `scripts/art/gen.sh vuelo-<nombre> <lámina 05> <prototipo>` →
  `python scripts/art/pre.py art/raw/vuelo-*.png` → `snap_pixels` (fondos con `pixel_size: 5.225`; hojas, automático;
  48 colores) → copiar a `art/snapped/vuelo-*.png` → `python scripts/art/flight-scenery.py`.
- **Escala:** ×4 como el resto de las piezas de vuelo (los fondos de 320 × 180 cubren la pantalla).
- Las medidas que usa `flightArt.ts` (suelo, escotilla, brazo de la torre, filas de la cápsula) salen de estas
  imágenes: si se rehacen, revisar `SITES`, `TOWER`, `CORE` y `MAST`.

| Nombre | Archivo | Tamaño (px de arte) | Qué es |
|---|---|---|---|
| Costa (lejos) | `earth-far.png` | 320 × 180 | Mar, costa con faro y domos, colinas y palmeras; cielo transparente |
| Plataforma (cerca) | `earth-near.png` | 320 × 180 | Plataforma con foso de llamas, gradas, pasarelas, caños, edificio de control; la superficie queda en y = 151 |
| Gale (lejos) | `mars-far.png` | 320 × 180 | Monte Sharp, mesetas y dunas |
| Base de Gale (cerca) | `mars-near.png` | 320 × 180 | Base con domos y paneles, rover, plataforma de despegue (superficie en y = 149), caños y roca |
| Etapa central | `core.png` | 30 × 114 | Cohete con la cápsula arriba; se corta en dos (cápsula: filas 0–30) para la separación de etapa |
| Propulsor | `side-booster.png` | 14 × 79 | Propulsor lateral (el mismo a los dos lados) |
| Torre | `launch-tower.png` | 85 × 125 | Torre roja con ascensor; el brazo de acceso (x 56–85, y 28–54) se recorta aparte y se retira en T-45 |
| Nave de ascenso | `ascent-vehicle.png` | 71 × 62 | Nave de ascenso de Marte sobre cuatro patas |
| Torre de servicio | `service-mast.png` | 36 × 77 | Torre con escalera y manga de viento (Marte); se inclina en T-20 |
| Tanques | `fuel-tanks.png` | 59 × 40 | Dos tanques esféricos con escarcha (Tierra) |
| Nave nodriza | `mothership.png` | 125 × 53 | La nave que espera en la órbita de Marte, con la compuerta abierta |
| Combi | `van.png` | 38 × 25 | Combi que trae a la tripulación en la escena de entrada |

### Escenografía del aterrizaje y la reentrada (generada)

El aterrizaje en Marte (`landing`) y la vuelta a la Tierra (`reentry`) usan la misma técnica que los despegues.

- **Cómo se rehace:** prompts `art/prompts/vuelo-capsulas.txt`, `vuelo-rescate.txt`, `vuelo-gale-llano.txt` y
  `vuelo-mar-lejos.txt` → `scripts/art/gen.sh vuelo-<nombre> <lámina 05> <prototipo>` → `python scripts/art/pre.py` →
  `snap_pixels` (fondos con `pixel_size: 5.225`; hojas, automático; 48 colores) → copiar a `art/snapped/vuelo-*.png` →
  `python scripts/art/flight-scenery.py`.
- **Escala:** ×4. Si se rehacen, revisar en `flightArt.ts` el suelo de `LOOKS.landing|reentry.plain`, `CAPSULE_BASE` y
  `RESCUE` (fila de la cubierta del barco).
- **Origen:** generadas con codex-cli (imagegen) para este juego. Sin normal maps (las escenas de vuelo no usan luz dinámica).

| Nombre | Archivo | Tamaño (px de arte) | Qué es |
|---|---|---|---|
| Llano de Gale | `gale-plain.png` | 320 × 180 | Suelo del aterrizaje (horizonte en y ≈ 137); de fondo va `mars-far.png` (monte Sharp) |
| Mar abierto | `sea-far.png` | 320 × 180 | Mar del amerizaje con islote y nubes en el horizonte |
| Cápsula de entrada | `entry-capsule.png` | 37 × 30 | Cápsula de Marte con el escudo térmico abajo |
| Módulo de descenso | `descent-lander.png` | 41 × 35 | La misma sin escudo, con patas y motores de frenado |
| Escudo térmico | `heat-shield.png` | 29 × 10 | El escudo cuando se suelta y cae |
| Paracaídas | `chute.png` | 63 × 58 | Paracaídas de Marte |
| Cápsula de vuelta | `return-capsule.png` | 33 × 31 | Cápsula de la reentrada (sale de `sea-capsule.png` sin los flotadores, la arma el script) |
| Cápsula en el mar | `sea-capsule.png` | 33 × 41 | La misma con los flotadores naranjas inflados |
| Barco de rescate | `rescue-ship.png` | 103 × 54 | Barco que llega al amerizaje; la tripulación sale a su cubierta (fila 41) |
| Helicóptero | `helicopter.png` | 65 × 26 | Helicóptero de rescate |
| Tres paracaídas | `chutes.png` | 79 × 59 | Paracaídas del amerizaje |

**No son archivos** (se dibujan con código en `flightArt.ts`): el plasma de la entrada en bandas, las chispas, la
salpicadura, la camilla, el cielo con degradé, las montañas (en Marte, el monte
Sharp), las nubes, el público detrás de la valla, los reflectores y la bandera, las cúpulas de la base, el ascensor
y la pasarela, el suelo, el mar, las estrellas, las líneas de velocidad y el plasma de la entrada.

---

## Carga de vuelta (`Loadout`, bodega de casilleros)

Piezas que se acomodan en la bodega de la nave antes de salir de Marte, como en un maletín de casilleros: cada una
ocupa más o menos lugar según su tamaño.

- **Carpeta:** `public/assets/ui/cargo/`
- **Cómo se rehace:** `python scripts/art/cargo.py` (Pillow y numpy; sin red). Todo está dibujado por el script.
- **Dónde se usa:** `src/game/scenes/flow/cargoGridView.ts`. Claves de textura en `CargoTextures` (`src/game/assets.ts`).
- **Regla de tamaño:** un casillero mide 16 px de arte. En la bodega se amplía ×3 (48 px por casillero) y en la lista
  de la base ×2. Si cambia el tamaño en casilleros de una pieza (`CARGO_GRID` en `src/content/loadouts.ts`), hay que
  rehacer su dibujo con la medida nueva.

| Nombre | Archivo | Tamaño (px de arte) | Casilleros | Qué es |
|---|---|---|---|---|
| Caja de comida | `public/assets/ui/cargo/food.png` | 32 × 32 | 2 × 2 | Caja de madera con flejes y una manzana pintada |
| Tanque de agua | `public/assets/ui/cargo/water.png` | 16 × 32 | 1 × 2 | Bidón azul de agua para beber, con una gota |
| Bolsa del escudo | `public/assets/ui/cargo/shield.png` | 16 × 48 | 1 × 3 | Bolsa larga de agua para el escudo del refugio, con la marca de radiación |
| Caja de repuestos | `public/assets/ui/cargo/spare.png` | 32 × 16 | 2 × 1 | Caja de herramientas gris con manija |
| Roca chica | `public/assets/ui/cargo/rock-1x1.png` | 16 × 16 | 1 × 1 | Roca de Marte de hasta 7 kg |
| Roca mediana | `public/assets/ui/cargo/rock-1x2.png` | 16 × 32 | 1 × 2 | Roca de Marte de hasta 10,5 kg |
| Roca grande | `public/assets/ui/cargo/rock-2x2.png` | 32 × 32 | 2 × 2 | Roca de Marte de más de 10,5 kg |
| Muestra de plantas | `public/assets/ui/cargo/plant.png` | 16 × 16 | 1 × 1 | Frasco con un brote del invernadero de Marte |

**No son archivos:** la grilla de la bodega, los recuadros de las piezas y la sombra verde o roja de la pieza que se
lleva en la mano se dibujan con código.

---

## Mar lejano para el despegue (original generado)

- **Nombre y ubicación:** `art/raw/vuelo-mar-lejos.png`, fondo lejano del océano Pacífico por la mañana, vista lateral.
- **Tamaño y cuadros:** 1672 × 941 px, un cuadro; estética solicitada de lienzo de 320 × 180 ampliado. Original sin redimensionar ni recodificar; escala de juego aún sin asignar.
- **Transparencia:** cielo con canal alfa; mar hasta los bordes inferiores, isla lejana a la izquierda y nubes pequeñas sobre el horizonte.
- **Cómo se rehace:** generar una sola imagen con la herramienta integrada `image_gen`, fondo transparente y el prompt de `art/prompts/vuelo-mar-lejos.txt`; copiar el PNG sin modificar.
- **Origen:** generado con `image_gen` el 15/11/2026. Original: `C:/Users/Santiago/.codex/generated_images/01a1e112-bdeb-7350-95c1-02e4016a189d/exec-58fc72cc-8613-4c1d-9c03-7279150f6c15.png`.

## Banderas de idioma (original generado)

- **Nombre y ubicación:** `art/raw/ui-banderas.png`, hoja de cuatro íconos en grilla 2 × 2: Argentina (español) a la izquierda y Estados Unidos (inglés) a la derecha, repetidas en la fila inferior.
- **Tamaño y cuadros:** 1254 × 1254 px, cuatro íconos; estética solicitada de lienzo de 64 × 64 ampliado. Original sin redimensionar ni recodificar.
- **Transparencia:** PNG con canal alfa, sin fondo ni soportes.
- **Cómo se rehace:** generar una sola imagen con la herramienta integrada `image_gen`, fondo transparente y el prompt de `art/prompts/ui-banderas.txt`; copiar el PNG sin modificar.
- **Origen:** generado con `image_gen` (codex) el 15/11/2026; la primera versión (España e Inglaterra) se reemplazó por esta.
- **En el juego:** `public/assets/ui/flags/es.png` (Argentina, 32 × 27 px de arte) y `en.png` (Estados Unidos, 34 × 27), un cuadro cada una, sacadas de la fila de arriba de la hoja. Se muestran ×2 en la fila del idioma de las opciones (`src/game/scenes/flow/settingsPanel.ts`, menú principal y pausa); claves con `flagTextureKey` (`src/game/assets.ts`).
- **Cómo se pasan al juego:** `scripts/art/gen.sh ui-banderas` → `python scripts/art/pre.py art/raw/ui-banderas.png` → `snap_pixels` (`color_count: 16`, tamaño de píxel automático: 14; con 19,6 las franjas de Estados Unidos salen desparejas) → `art/snapped/ui-banderas.png` (92 × 94) → `python scripts/art/flags.py`.

## Íconos de los sistemas del checklist

- **Nombre y ubicación:** `art/raw/hud-iconos-sistemas.png` → `art/snapped/hud-iconos-sistemas.png` (69 × 67), hoja 2 × 2: motor (`engines`), escudo térmico (`heatShield`), paracaídas (`parachutes`) y panel solar (`solarPanels`).
- **Tamaño y cuadros:** original de 1254 × 1254 px; en el juego, cuatro cuadros más del atlas `public/assets/hud/icons` (celdas de 24 × 24 px de arte). En la consola del checklist se ven ×1,5 (el depurador y la radio usan los íconos de sus cuartos).
- **Cómo se rehace:** `scripts/art/gen.sh hud-iconos-sistemas docs/ref-nave.png art/snapped/hud-iconos-cuartos1.png` → `python scripts/art/pre.py art/raw/hud-iconos-sistemas.png` → `snap_pixels` con `pixel_size: 19.6` → copiar a `art/snapped/` → `python scripts/art/icons.py` (grupo `hud-icons` de `art/manifest.json`).
- **Origen:** generado con `image_gen` (codex) el 15/11/2026.
- **En el juego:** consola del checklist Go / No-Go de las maniobras (`src/game/scenes/flow/checklistPanel.ts`). El marco de la consola, las tarjetas, los botones, los sellos y el botón de empezar se dibujan con código.

## Favicon (original generado)

- **Nombre y ubicación:** `art/raw/favicon.png` (generado) → `art/snapped/favicon.png` (41 × 38, dibujo de 29 × 32 px de arte) → `public/favicon.ico` (16, 32 y 48 px), `public/favicon-32.png` (32 × 32, pixel art 1:1) y `public/apple-touch-icon.png` (180 × 180, ×5 sobre el fondo del juego `#05070d`).
- **Qué es:** Marte del logo con el casco del astronauta asomado arriba, sin texto ni botones, para la pestaña del navegador. Contorno oscuro para que se vea en barras claras y oscuras.
- **Dónde se usa:** `index.html` (`<link rel="icon">` y `apple-touch-icon`).
- **Cómo se rehace:** `scripts/art/gen.sh favicon public/assets/ui/title/logo.png` (prompt `art/prompts/favicon.txt`, el logo como referencia) → `python scripts/art/pre.py art/raw/favicon.png` → `snap_pixels` (`color_count: 12`, tamaño de píxel automático: 31,5) → `art/snapped/favicon.png` → `python scripts/art/favicon.py` (falla si el dibujo no entra en 32 × 32). El de 16 px se achica suave; el de 48 px sale de ampliar ×3 y achicar.
- **Origen:** generado con `image_gen` (codex) el 15/11/2026.

## Otros recursos sin archivo (dibujados con código)

Para tenerlos ubicados si hay que reemplazarlos por pixel art:

| Qué | Dónde está el código |
|---|---|
| Puntos de estado de la tripulación (en línea, ausente, no molestar, desconectado) | `drawPresence` en `src/game/scenes/simulation/PanelColumn.ts` |
| Hoja de las puertas de costado de la base de Marte | `src/game/scenes/simulation/TiledMapView.ts` (`sideDoors`) |
| Fondos del informe final (mar y papel picado; espacio, Marte y nave de rescate) | `src/game/scenes/flow/reportBackdrop.ts` |
| Sonidos y música (no son imágenes: se generan con código) | `src/game/audio/themes.ts` |

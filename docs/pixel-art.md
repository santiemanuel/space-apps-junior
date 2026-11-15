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

**No son archivos** (se dibujan con código en `flightArt.ts`): el cielo con degradé, las montañas (en Marte, el monte
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

## Otros recursos sin archivo (dibujados con código)

Para tenerlos ubicados si hay que reemplazarlos por pixel art:

| Qué | Dónde está el código |
|---|---|
| Puntos de estado de la tripulación (en línea, ausente, no molestar, desconectado) | `drawPresence` en `src/game/scenes/simulation/PanelColumn.ts` |
| Hoja de las puertas de costado de la base de Marte | `src/game/scenes/simulation/TiledMapView.ts` (`sideDoors`) |
| Fondos del informe final (mar y papel picado; espacio, Marte y nave de rescate) | `src/game/scenes/flow/reportBackdrop.ts` |
| Sonidos y música (no son imágenes: se generan con código) | `src/game/audio/themes.ts` |

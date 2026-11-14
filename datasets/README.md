# Datasets

Datos reales de la NASA que sirven de base para modelar las situaciones críticas del juego.
Están fuera de `src/` porque son **datos de referencia, no código**: se versionan, se citan y se pueden
regenerar o revisar sin tocar la lógica. Sólo `src/data/` los lee y los convierte en modelos de dominio
(lo comprueba `src/architecture.test.ts`).

Elegidos según el desafío [Junior Astronaut Mission Trainer (Space Apps 2026)](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/),
que pide decisiones sobre soporte vital, blindaje contra radiación, energía y comunicaciones, basadas en datos reales.

> **Datos crudos**: `datasets/raw/` contiene descargas completas (DONKI desde 2024, RadLab, clima de Marte,
> OSDR, documentos NASA-STD-3001 y BVAD) pendientes de procesar. Ver [`raw/README.md`](raw/README.md).

## Catálogo (datos que ya usa el juego)

| Archivo | Fuente | Tipo | Situación crítica que modela |
|---|---|---|---|
| `donki/flr.json` | [NASA CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/): llamaradas solares (FLR) | Descargado | Riesgo de radiación y **apagón de radio** (escala NOAA R1–R5 según la clase GOES) |
| `donki/sep.json` | NASA CCMC DONKI: eventos de partículas solares energéticas (SEP) | Descargado | **Tormenta de radiación**: la crisis que obliga a refugiarse o blindarse |
| `curated/radiation-dose.json` | Curiosity RAD (NASA/JPL), Chang'e-4 LND, NASA-STD-3001 | Curado | Dosis de fondo por día en la Luna y en Marte; límites de dosis de la NASA |
| `curated/life-support-bvad.json` | [NASA BVAD](https://ntrs.nasa.gov/citations/20210024855) | Curado | Consumo de O2, agua y comida por tripulante y día |
| `curated/osdr-facts.json` | [NASA OSDR](https://osdr.nasa.gov/bio/repo/) | Curado | Datos científicos reales que se muestran al resolver misiones (OSD-992, OSD-615, OSD-177) |
| `storms/biosentinel-storms.json` | [RadLab](https://visualization.osdr.nasa.gov/radlab/) (BioSentinel, medias diarias) + DONKI (FLR, SEP) de `raw/` | Derivado | **Tormentas de radiación en espacio profundo**: cuándo avisa DONKI, cuándo sube la dosis y cuánto dura. Frena el reloj de misión (game-design §3.1) |
| `series/deep-space-dose.json` | RadLab: BioSentinel BPD, medias diarias (nov. 2022 → nov. 2025) | Derivado | **Dosis en los viajes** (μGy/h por día) con el tope de 650 μGy/h de game-design §3.2.1; `capped` marca los días recortados |
| `series/mars-cruise-dose.json` | RadLab: ExoMars TGO Liulin-MO en crucero (2016) | Derivado | Dosis en crucero para el modo libre |
| `series/mars-surface-dose.json` | RadLab: Curiosity RAD, medias diarias (2015 → 03/06/2024) | Derivado | **Dosis en Marte** (μGy/h por día) |
| `series/gale-weather.json` | [REMS de Curiosity](https://mars.nasa.gov/msl/mission/weather/) por fecha terrestre, recortado al rango de RAD | Derivado | **Polvo** (índice UV → f_polvo) y **frío** (mínima → calefacción) en la base de Gale |
| `curated/mars-conjunctions.json` | NASA JPL (anuncios de cada moratoria de comandos) | Curado | **Conjunción solar**: días sin Control de Misión en Marte (2015, 2017, 2019, 2021, 2023) |
| `curated/nasa-std-3001.json` | NASA-STD-3001 (OCHMO Technical Briefs), BVAD, NASA (ISS) | Curado | Límite de CO2, agua potable y por hora de EVA, kcal diarias, reciclaje de agua y ejercicio diario de los medidores |

**Descargado**: lo genera `npm run datasets:fetch` (año completo, en tramos de 60 días, que es el máximo de DONKI).
**Derivado**: lo generan `node scripts/build-storms.mjs` y `node scripts/build-series.mjs` a partir de `datasets/raw/` (sin red).
**Curado**: valores extraídos a mano de publicaciones, cada uno con su referencia y URL dentro del JSON.

Archivo actual: 13/11/2025 → 13/11/2026, descargado el 14/11/2026. Contiene 407 llamaradas
(16 de clase X y 285 de clase M) y 42 eventos SEP repartidos en 13 días.

## Cómo los usa el juego

- **Medidores** (`series/`, `curated/radiation-dose.json`, `curated/nasa-std-3001.json`): la dosis de cada
  tripulante es `tasa del día × f_blindaje × Q × horas`. Q = 3,05 en Marte (Hassler 2014), 3,8 en crucero
  (Zeitlin 2013) y 1,5 durante un SEP (regla). Si una serie no tiene dato ese día, se usa el último día con dato.
- **Mínimas de REMS bajo −90 °C** (40 soles en todo el archivo, 15 dentro del rango de RAD): todas son caídas
  aisladas de ~30 °C respecto a los soles vecinos (p. ej. 16/05/2024: −98 °C entre dos días de −68 °C), con
  valores cerca de −100 °C. Se tratan como artefacto del sensor: el juego usa la mediana de los 3 soles a cada
  lado y guarda el valor crudo (`rawMinTempC`).
- **Fondo de radiación real en 2024**: BioSentinel da ~7,2 μGy/h fuera de tormentas (≈ 0,65 mSv/día con Q 3,8 y
  sin blindaje), menos que los 1,84 mSv/día de MSL en 2012 (Zeitlin 2013) que usa game-design §2.1. 2024 fue un
  máximo solar, que reduce los rayos cósmicos; además son instrumentos y blindajes distintos.

- **Tormentas y reloj** (`storms/biosentinel-storms.json`):
  - Días de tormenta: media diaria de BioSentinel por encima de 5 × la mediana de los 27 días previos.
  - Impacto: primer evento SEP de DONKI del día en que empieza la subida (en mayo de 2024 coincide con la
    serie por minuto de RadLab: la dosis sube el 11/05 entre las 02 y las 03 UTC; el SEP de GOES >100 MeV es de las 02:10).
  - Aviso: primera llamarada M5+ o X de la región activa del SEP en las 72 h previas. Sin detección previa
    (o antes de 2024, donde no hay DONKI crudo) se usan 48 h simuladas, como pide el diseño.
  - `capped: true` cuando la media diaria supera el tope de 650 μGy/h (§3.2.1).
  - Antelación real de la campaña 2024: 29/01 0,6 h · 09/02 59,6 h · 23/03 4,4 h · **11/05 69 h** (X1.0 de la
    región 13664 el 08/05) · 08/06 35,3 h · 23/07 48 h (regla) · 15/09 48 h (regla) · **09/10 1,9 h** (X1.8 del 09/10).
    Los SEP "inmediatos" avisan con minutos u horas: el reloj garantiza al menos 10 s reales de Alerta.

- **Incidentes de la línea de tiempo** (`src/data/incidentTimeline.ts`, reglas en `src/content/incidents.ts`):
  - Viajes: las tormentas de `storms/` con su antelación real; la tarjeta muestra la media diaria con el tope de 650 μGy/h
    y "N veces lo normal" respecto de `baselineUGyH`.
  - Tormenta en Marte: días de RAD por encima de 5 × la mediana de los 27 días previos (la misma regla que BioSentinel).
    Sin DONKI que la preceda, aviso de 48 h. En la campaña: 20/05/2024 (69,3 μGy/h de media diaria, 14 veces lo normal).
  - Polvo: soles seguidos con UV "Low" en REMS (aviso de 24 h). En la campaña: 28/05/2024.
  - Noche extrema: mínima 4 °C por debajo de la mediana de los 7 soles previos, o por debajo de −85 °C (aviso de 12 h).
    Marca ~5 % de los soles de Gale; en la campaña, el 24/05/2024 (−73 °C contra −69 °C).
  - Conjunción solar: la moratoria completa de `curated/mars-conjunctions.json` (aviso de 72 h).
- **Clima espacial**: en modo `live` se consultan los últimos 30 días de DONKI. Si no hay conexión
  (o en modo `archive`), cada partida toma **una ventana real de 30 días al azar** de este archivo,
  lo que hace que cada partida sea distinta. La interfaz siempre indica si los datos son *en vivo* o
  *real archivado*, con sus fechas.
- **Riesgo de radiación**: llamarada más intensa en escala logarítmica (C1≈10 %, M1≈40 %, X1≈70 %).
  Si hay un evento SEP, el riesgo sube al menos al 70 % (*regla de juego*).
- **Apagón de radio**: nivel NOAA R a partir del flujo de la llamarada más intensa (escala oficial).
- **Dosis de la tripulación**: se acumula a la tasa medida en la superficie lunar (1,37 mSv/día) y se
  compara con el límite de carrera de la NASA (600 mSv) y con radiografías de tórax (0,1 mSv).

## Datasets descartados

| Dataset | Motivo |
|---|---|
| NeoWs (asteroides cercanos) | No aparece en el desafío y no modela ningún problema de una base lunar o marciana |
| RadLab (telemetría de radiación) | Relevante y su API de datos está operativa. Se verificó que una consulta a `https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&...&format=json` devuelve HTTP 200 y 164 lecturas de 2022. No está integrada aún; el API no expuso `Access-Control-Allow-Origin` en esta prueba, así que habría que descargarlo con Node al archivo en vez de llamarlo desde el navegador. |
| DONKI CME / GST | Las CME y las tormentas geomagnéticas afectan sobre todo a la Tierra; para una base sin magnetosfera, FLR y SEP son los datos que importan. Las CME son candidatas para un sistema de *alerta temprana* |
| Mars Trek | Imágenes y terreno: útil si la base se traslada a Marte (cambiar `MISSION_SITE` a `marsSurface`) |

## Notas técnicas

- DONKI se consulta directamente en `https://ccmc.gsfc.nasa.gov/DONKI-API/get/<TIPO>` **sin barra final**:
  el proxy de `api.nasa.gov/DONKI` añade una y puede responder 404. No requiere API key y permite CORS.
- Las respuestas se recortan a los campos que usa el juego. El campo `link` de cada evento enlaza a su ficha en DONKI.
- RadLab usa otra convención: el endpoint de datos es `https://visualization.osdr.nasa.gov/radlab/api/`
  **con barra final**, seguido de filtros como `spacecraft=ISS`, `instrument=DosTel`,
  `timestamp%3E=...` y `format=json`. `/radlab/api/environments` no es una ruta válida y devuelve
  error; el endpoint correcto respondió 200 el 14/11/2026.
- El aviso de APOD / Earth API / Mars Rover no afecta a este proyecto: no utiliza ninguno de esos tres servicios.
  La nueva APOD URL no corrige DONKI ni RadLab.

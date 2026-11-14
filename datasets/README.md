# Datasets

Datos reales de la NASA que sirven de base para modelar las situaciones críticas del juego.
Están fuera de `src/` porque son **datos de referencia, no código**: se versionan, se citan y se pueden
regenerar o revisar sin tocar la lógica. Sólo `src/data/` los lee y los convierte en modelos de dominio
(lo comprueba `src/architecture.test.ts`).

Elegidos según el desafío [Junior Astronaut Mission Trainer (Space Apps 2026)](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/),
que pide decisiones sobre soporte vital, blindaje contra radiación, energía y comunicaciones, basadas en datos reales.

## Catálogo

| Archivo | Fuente | Tipo | Situación crítica que modela |
|---|---|---|---|
| `donki/flr.json` | [NASA CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/): llamaradas solares (FLR) | Descargado | Riesgo de radiación y **apagón de radio** (escala NOAA R1–R5 según la clase GOES) |
| `donki/sep.json` | NASA CCMC DONKI: eventos de partículas solares energéticas (SEP) | Descargado | **Tormenta de radiación**: la crisis que obliga a refugiarse o blindarse |
| `curated/radiation-dose.json` | Curiosity RAD (NASA/JPL), Chang'e-4 LND, NASA-STD-3001 | Curado | Dosis de fondo por día en la Luna y en Marte; límites de dosis de la NASA |
| `curated/life-support-bvad.json` | [NASA BVAD](https://ntrs.nasa.gov/citations/20210024855) | Curado | Consumo de O2, agua y comida por tripulante y día |
| `curated/osdr-facts.json` | [NASA OSDR](https://osdr.nasa.gov/bio/repo/) | Curado | Datos científicos reales que se muestran al resolver misiones (OSD-992, OSD-615, OSD-177) |

**Descargado**: lo genera `npm run datasets:fetch` (año completo, en tramos de 60 días, que es el máximo de DONKI).
**Curado**: valores extraídos a mano de publicaciones, cada uno con su referencia y URL dentro del JSON.

Archivo actual: 13/11/2025 → 13/11/2026, descargado el 14/11/2026. Contiene 407 llamaradas
(16 de clase X y 285 de clase M) y 42 eventos SEP repartidos en 13 días.

## Cómo los usa el juego

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
| RadLab (dosimetría de la ISS) | Recomendado por el desafío, pero su API devolvía error 500 el 14/11/2026. Se usan en su lugar las tasas publicadas de RAD/LND. Candidato a integrar cuando vuelva a funcionar |
| DONKI CME / GST | Las CME y las tormentas geomagnéticas afectan sobre todo a la Tierra; para una base sin magnetosfera, FLR y SEP son los datos que importan. Las CME son candidatas para un sistema de *alerta temprana* |
| Mars Trek | Imágenes y terreno: útil si la base se traslada a Marte (cambiar `MISSION_SITE` a `marsSurface`) |

## Notas técnicas

- DONKI se consulta directamente en `https://ccmc.gsfc.nasa.gov/DONKI-API/get/<TIPO>` **sin barra final**:
  el proxy de `api.nasa.gov/DONKI` añade una y responde 404. No requiere API key y permite CORS.
- Las respuestas se recortan a los campos que usa el juego. El campo `link` de cada evento enlaza a su ficha en DONKI.

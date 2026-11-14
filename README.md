# Space Apps — Base Lunar

Juego top-down 2D (Phaser 4 + TypeScript + Vite) para el desafío
[Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/)
(NASA Space Apps 2026). Diriges una base lunar: el clima espacial **real** (NASA DONKI) decide cuándo
salir es peligroso, y cada decisión tiene un coste en oxígeno, comida o energía.

## Comandos

```bash
npm install
npm run dev             # servidor de desarrollo (http://localhost:5173)
npm test                # tests unitarios (Vitest)
npm run typecheck       # tsc estricto
npm run build           # typecheck + build de producción
npm run datasets:fetch  # vuelve a descargar los datasets reales de DONKI a datasets/
```

`VITE_NASA_DATA_MODE` (en `.env`, ver `.env.example`): `live` consulta DONKI y, si falla, usa el archivo real;
`archive` juega siempre offline. No hace falta API key.

## Controles

- **WASD / flechas**: moverse
- **E / espacio** (mantener) junto a una estación: iniciar y trabajar la misión
- **1 / 2 / 3**: elegir opción en una decisión de riesgo
- **R**: reiniciar al terminar

## Datos de la NASA

Están en [`datasets/`](datasets/README.md), fuera de `src/`, con su catálogo, sus fuentes y los motivos de cada elección.

| Dataset | Efecto en el juego |
|---|---|
| DONKI — llamaradas (FLR) | Riesgo de radiación y apagón de radio (escala NOAA R) |
| DONKI — partículas solares (SEP) | Tormentas de radiación: riesgo ≥ 70 % para salir |
| Curiosity RAD / Chang'e-4 LND + NASA-STD-3001 | Dosis diaria de la tripulación y límite de carrera |
| NASA BVAD | Consumo de O2, agua y comida por tripulante |
| NASA OSDR | Datos científicos reales al resolver misiones |

Por encima del 25 % de riesgo, el jugador elige entre **proceder** (puede fracasar), **blindarse**
(gasta energía) o **posponer** (gasta víveres y espera). Ninguna opción es gratis.

## Arquitectura

```
datasets/        Datos de referencia NASA (JSON versionado + catálogo). Sólo los lee src/data/.
scripts/         fetch-datasets.mjs: regenera datasets/donki/ desde la API
src/
├── core/        Lógica de juego pura (sin Phaser). Testeable en Node.
│   ├── events/      EventBus tipado + catálogo de eventos (GameEvents)
│   ├── rng/         RNG con semilla → partidas reproducibles
│   ├── resources/   Soporte vital y balance energético
│   ├── environment/ Modelo de clima espacial y cálculo de riesgo (escalas GOES / NOAA)
│   ├── missions/    Ciclo de vida de misiones
│   ├── decisions/   Motor de decisiones basado en riesgo
│   └── session/     GameSession: raíz de composición de la lógica (incluye dosis acumulada)
├── data/        Puerta de entrada a datasets/ y a las APIs
│   ├── donki/           DonkiClient (fetch inyectable) + adapters API/archivo → dominio
│   ├── archive.ts       ventanas reales del archivo DONKI
│   ├── EnvironmentService.ts  en vivo con fallback al archivo
│   └── curated.ts       BVAD, dosis y datos OSDR
├── content/     Diseño: misiones, layout de la base, condiciones iniciales y lugar (Luna/Marte)
├── game/        Capa Phaser (vista + entrada). No contiene reglas.
│   ├── scenes/      Boot (carga) · Habitat (mundo) · Hud (UI, decisiones, atribución)
│   ├── entities/    Player, StationView
│   ├── input/       PlayerControls (interfaz) + implementación de teclado
│   └── services.ts  Inyección de dependencias vía registry
└── main.ts      Raíz de composición: conecta datos + lógica + motor
```

**Reglas de dependencia** (verificadas en `src/architecture.test.ts`)
- `core/`, `data/` y `content/` nunca importan `phaser` ni `game/`.
- Sólo `src/data/` importa desde `datasets/`.
- Las escenas reciben `GameSession` por `scene.start(key, { session })` y los servicios por el registry,
  así se pueden montar con dobles de prueba.
- Los sistemas se comunican por `EventBus`. Todo el azar pasa por `Rng` con semilla.

## Añadir contenido o sistemas

- **Nueva misión**: añade una entrada en `src/content/missions.ts` (con su `exposure` a radiación y comunicaciones)
  y una estación en `src/content/habitat.ts`.
- **Base en Marte**: cambia `MISSION_SITE` a `'marsSurface'` en `src/content/startingConditions.ts`.
- **Nuevo dataset**: guárdalo en `datasets/` y documéntalo en su README; tipa el formato y escribe el adapter
  en `src/data/`; amplía `EnvironmentSnapshot` y su cálculo en `core/environment/`.

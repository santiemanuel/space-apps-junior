# Misión a Marte

Juego top-down 2D (Phaser 4 + TypeScript + Vite) para el desafío
[Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/)
(NASA Space Apps 2026), pensado para chicos de 7 a 12 años. La tripulación viaja a Marte, vive unos soles en el
cráter Gale y vuelve a la Tierra, y todo lo que pasa sale de **datos reales de la NASA**: la radiación que midieron
BioSentinel y Curiosity, el polvo y el frío de REMS, las tormentas solares de DONKI y la demora de la señal según
la distancia entre los planetas. El diseño completo está en [`docs/game-design.md`](docs/game-design.md).

## Estado

Los dos frentes de trabajo ([`docs/plan-de-trabajo.md`](docs/plan-de-trabajo.md)) están integrados en
`feat/integracion`:

| Frente | Contenido |
|---|---|
| Simulación (Santiago) | Reloj, medidores, tripulación, cascada, incidentes, datos, `Voyage`, `Mars`, `Hud`, `Planning`, `MissionControl`, `DataPanel` |
| Flujo y maniobras (Facundo) | `Title`, `Loadout`, `Maneuver`, `DataCard`, `Report`, `Pause`, guardado, progresión, sprites animados |

`npm run dev` arranca la misión completa: menú → carga de ida → despegue → viaje → aterrizaje → Gale → carga de
vuelta → despegue de Marte → viaje de vuelta → reentrada → informe. Cada escena también se abre sola con `?scene=`.

## Comandos

```bash
npm install
npm run dev               # servidor de desarrollo (http://localhost:5173)
npm test                  # tests unitarios (Vitest, entorno node)
npm run typecheck         # tsc estricto
npm run build             # typecheck + build de producción
npm run datasets:fetch    # regenera datasets/donki/ desde la API (requiere red)
npm run datasets:download # descargas crudas a datasets/raw/ (RadLab tarda varios minutos)
node scripts/build-storms.mjs   # tormentas de BioSentinel desde datasets/raw/ (sin red)
node scripts/build-events.mjs   # picos de radiación, Van Allen y avisos de DONKI desde datasets/raw/
node scripts/build-series.mjs   # series diarias de dosis y clima de Gale desde datasets/raw/
```

El juego usa sólo datos archivados en `datasets/` y juega offline; las tarjetas muestran la fecha real de cada dato.
El cliente de DONKI en vivo (`src/data/donki/`, `EnvironmentService`, `VITE_NASA_DATA_MODE`) quedó sin conectar al
retirar el prototipo lunar.

### Abrir una escena sola (sólo en `npm run dev`)

`http://localhost:5173/?scene=<Escena>` arranca la escena con un estado de prueba (`makeGameState()`):

| URL | Qué abre |
|---|---|
| `?scene=Voyage` | Viaje de ida (15/01 → 15/05/2024) |
| `?scene=Voyage&leg=back` | Viaje de vuelta, con la nave gastada |
| `?scene=Mars` | Estancia en el cráter Gale (15/05 → 04/06/2024) |
| `?scene=Maneuver&id=landing`, `?scene=Loadout&mode=return`, … | Escenas del flujo |

Parámetros de `Voyage` y `Mars`: `from=AAAA-MM-DD` (fecha de arranque, p. ej. `from=2024-05-07` para la tormenta de
mayo), `help=1` (modo ayuda), `level=1..4` (desbloqueo), `length=long` (más jornadas a tiempo normal). Sólo en `Mars`:
`km=N` (distancia del aterrizaje a la base) y `where=<cuarto>` (dónde arranca el jugador, p. ej. `airlock` o `radio`).

## Controles

En `Voyage` y `Mars`:

- **WASD / flechas**: moverse · **E** (mantener): usar la estación del cuarto (ejercicio, mantenimiento, llamar a casa,
  juntar muestras afuera)
- **Tab**: cambiar de tripulante (saltea a los que están en reposo)
- **1 / 2 / 3** o clic: elegir la respuesta a un incidente, siempre con su coste y su semáforo
- **P**: planificación en pausa (rutinas y tablero de energía) · **C**: Control de Misión · **G**: panel de datos
- **M**: silenciar el monitor de partículas
- **Esc**: pausa (continuar, guardar, guardar y salir, idioma)

En las maniobras: flechas y Enter en el checklist, **Espacio** (o clic) en el momento justo de cada etapa.

## Datos de la NASA

Están en [`datasets/`](datasets/README.md), fuera de `src/`, con su catálogo, sus fuentes y cómo se derivan.

| Dato | Para qué lo usa el juego |
|---|---|
| RadLab: BioSentinel (espacio profundo) y ExoMars TGO (crucero) | Dosis diaria de los viajes; tormentas de radiación con su pico real |
| RadLab: Curiosity RAD (cráter Gale) | Dosis en Marte y la tormenta del 20/05/2024 |
| RadLab: Artemis I | Cruce de los cinturones de Van Allen en el despegue |
| REMS de Curiosity | Polvo (índice UV → paneles solares) y frío (mínima → calefacción) de cada sol |
| CCMC DONKI (llamaradas, SEP, CME, avisos) | Antelación real de las alertas y mensajes de Control de Misión |
| JPL: órbitas aproximadas de los planetas | Distancia Tierra–nave y Tierra–Marte por fecha → demora de la señal |
| JPL: moratorias por conjunción solar | Días sin Control de Misión (modo libre) |
| NASA-STD-3001 y BVAD | O2, agua, comida, CO2, ejercicio y límites de dosis |

Cada evento real abre la tarjeta "Esto pasó de verdad" (`DataCard`) con el reloj en pausa y queda en el informe, que
dibuja la dosis real de cada día de la misión junto a las decisiones. El panel de datos (G) muestra las series
alrededor de la fecha del jugador.

## Arquitectura

```
datasets/        Datos de referencia NASA (JSON versionado + catálogo). Sólo los lee src/data/.
scripts/         Descarga (download/, fetch-datasets.mjs) y derivación sin red (build-*.mjs)
src/
├── core/        Lógica de juego pura (sin Phaser ni i18n). Testeable en Node.
│   ├── clock/       Reloj de misión sobre fechas reales: calma, alerta, impacto y jornadas jugadas
│   ├── meters/      Energía, soporte vital y salud (dosis, condición, cansancio, ánimo, nutrición)
│   ├── crew/        Eficiencia, reacción, rutinas y motivo de la lentitud
│   ├── cascade/     Modos de emergencia, sacrificios y punto de no retorno
│   ├── incidents/   Línea de tiempo real, rango seguro y fallas con semilla
│   ├── habitat/     HabitatSession: motor común de nave y base (plano, tareas, refugio, Control de Misión)
│   │                + SimulationEvents, el bus de las escenas superpuestas
│   ├── voyage/      VoyageSession: luz según la distancia al Sol, nave gastada en la vuelta
│   ├── mars/        MarsSession: sol marciano, polvo, frío, MOXIE, invernadero, EVA y muestras
│   ├── environment/ Series, tormentas, avisos de DONKI y órbitas
│   ├── state/, flow/, systems/, events/   Contratos compartidos (GameState, fases, EventBus, GameEvents)
│   ├── flow/        MissionFlow (fases en orden), partida nueva, menú principal
│   ├── maneuvers/, loadout/, report/   Maniobras, cargas de ida y vuelta, informe y logros
│   ├── save/, progression/   Guardado con versión y niveles de desbloqueo
│   └── rng/         RNG con semilla → partidas reproducibles
├── data/        Puerta de entrada a datasets/ y a las APIs (series, tormentas, línea de tiempo, órbitas, DONKI)
├── content/     Diseño y reglas: campaña 2024, plano de la nave (ship.ts) y de Gale (gale.ts), incidentes,
│                medidores, cascada, tripulación
├── i18n/        Textos en español e inglés por dominio (t('<archivo>.<clave>'))
├── game/        Capa Phaser (vista + entrada). No contiene reglas.
│   ├── scenes/flow/        Boot, Title, Loadout, Maneuver, DataCard, Report, Pause (Facundo)
│   ├── scenes/simulation/  Voyage y Mars (SimulationMapScene) · Hud · Planning · MissionControl · DataPanel
│   ├── entities/, input/   CrewSprite animado, controles de teclado y Tab
│   └── dev/                Arranque directo de escenas con ?scene=
├── fullGame.test.ts   Partida completa en Node (campaña 2024, semilla fija), de la carga de ida al informe
└── main.ts      Crea el juego; BootScene arranca el flujo de misión (FlowDirector)
```

**Reglas** (las verificadas por tests están en `src/architecture.test.ts` y `src/i18n/`):
- `core/`, `data/`, `content/` e `i18n/` nunca importan `phaser` ni `game/`; `core/` no traduce (guarda claves).
- Sólo `src/data/` importa desde `datasets/`.
- Las escenas se hablan por el bus: `GameEvents` entre fases y `SimulationEvents` entre la escena de mapa y las
  superpuestas. Todo el azar pasa por `Rng` con semilla.
- Cada clave de texto existe en `es` y `en`; lenguaje sencillo para 7–12 años.
- Más convenciones (dueños de cada carpeta, archivos congelados, gotchas): [`AGENTS.md`](AGENTS.md).

## Añadir contenido

- **Incidente**: una entrada en `src/content/incidents.ts` con el formato de §3.4 del diseño (disparador, aviso,
  respuestas con coste y semáforo, fuente) y sus textos en `src/i18n/*/incidents.json`.
- **Tarea o cuarto**: en `src/content/ship.ts` (nave) o `src/content/gale.ts` (base), con sus textos en
  `voyage.json` / `mars.json`.
- **Regla de un medidor**: en `src/content/meters.ts` o `cascade.ts`; los valores con norma o dato llevan su cita.
- **Dataset**: guardarlo en `datasets/`, documentarlo en su README (fuente, URL, uso), tiparlo y leerlo en `src/data/`.

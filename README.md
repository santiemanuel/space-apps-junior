# Space Apps — Operaciones Orbitales

Juego top-down 2D (Phaser 4 + TypeScript + Vite) en el que gestionas las tareas de un hábitat espacial.
Datos reales de la NASA determinan el riesgo de cada misión y obligan a tomar decisiones.

## Comandos

```bash
npm install
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm test             # tests unitarios (Vitest)
npm run typecheck    # tsc estricto
npm run build        # typecheck + build de producción
npm run fixtures:update   # refresca los datos offline desde api.nasa.gov
```

Copia `.env.example` a `.env` para usar tu propia clave de https://api.nasa.gov o jugar offline (`VITE_NASA_DATA_MODE=fixtures`).

## Controles

- **WASD / flechas**: moverse
- **E / espacio** (mantener) junto a una estación: iniciar y trabajar la misión
- **1 / 2 / 3**: elegir opción en una decisión de riesgo
- **R**: reiniciar al terminar

## Arquitectura

```
src/
├── core/        Lógica de juego pura (sin Phaser). Testeable en Node.
│   ├── events/      EventBus tipado + catálogo de eventos (GameEvents)
│   ├── rng/         RNG con semilla → partidas reproducibles
│   ├── resources/   Soporte vital: tasas BVAD de NASA, balance energético
│   ├── environment/ Modelo de dominio (llamaradas, NEOs) y cálculo de riesgo
│   ├── missions/    Ciclo de vida de misiones
│   ├── decisions/   Motor de decisiones basado en riesgo
│   └── session/     GameSession: raíz de composición de la lógica
├── data/nasa/   Acceso a datos NASA
│   ├── NasaClient       transporte HTTP (fetch inyectable)
│   ├── adapters/        formato crudo de la API → modelo de dominio
│   ├── fixtures/        datos guardados para jugar offline y para tests
│   └── NasaDataService  datos en vivo con fallback a fixtures
├── content/     Datos de diseño: misiones, layout del hábitat, condiciones iniciales
├── game/        Capa Phaser (vista + entrada). No contiene reglas.
│   ├── scenes/      Boot (carga) · Habitat (mundo) · Hud (UI y decisiones)
│   ├── entities/    Player, StationView
│   ├── input/       PlayerControls (interfaz) + implementación de teclado
│   └── services.ts  Inyección de dependencias vía registry
└── main.ts      Raíz de composición: conecta datos + lógica + motor
```

**Reglas de dependencia**
- `core/`, `data/` y `content/` nunca importan `phaser` ni `game/` (lo verifica `src/architecture.test.ts`).
- Las escenas reciben `GameSession` por `scene.start(key, { session })` y los servicios por el registry,
  así se pueden montar con dobles de prueba.
- Los sistemas se comunican por `EventBus`; p. ej. `MissionSystem` no sabe de recursos: `GameSession` aplica
  la recompensa al recibir `mission:completed`.
- Todo el azar pasa por `Rng` con semilla: una misma semilla con las mismas entradas da siempre la misma partida.

## Datos NASA y su efecto en el juego

| Dataset | Fuente | Efecto en el juego |
|---|---|---|
| DONKI — Solar Flares (FLR) | `api.nasa.gov/DONKI/FLR` | La clase GOES (C/M/X) → riesgo de radiación (log). Afecta EVAs y reduce la eficiencia solar hasta un 30 %. |
| NeoWs — Feed | `api.nasa.gov/neo/rest/v1/feed` | Tamaño × proximidad (distancias lunares) de los NEOs → amenaza de objetos cercanos para misiones exteriores. |
| BVAD (NASA/TP-2015-218570) | Constantes | Consumo de O2, agua y comida por tripulante y día. |

El riesgo de una misión combina las amenazas ponderadas por su `exposure`. Por encima del 25 %,
el jugador elige entre **proceder**, **proceder con blindaje** (consume energía) o **posponer** (consume víveres y bloquea la misión unas horas).

> `fixtures/neows-feed.json` contiene datos reales (nov. 2026). `fixtures/donki-flr.json` es una muestra
> con el esquema de DONKI, porque la API no estaba disponible al crear el proyecto; ejecuta
> `npm run fixtures:update` para sustituirla por datos reales.

## Añadir contenido o sistemas

- **Nueva misión**: añade una entrada en `src/content/missions.ts` y una estación en `src/content/habitat.ts`.
- **Nuevo dataset**: tipa la respuesta en `data/nasa/types.ts`, añade el método en `NasaClient`, crea un adapter
  con su test y amplía `EnvironmentSnapshot` y su cálculo de riesgo en `core/environment/`.
- **Nuevo sistema de reglas**: clase pura en `core/` que reciba el `EventBus`, se conecta en `GameSession`
  y se prueba sin el motor.

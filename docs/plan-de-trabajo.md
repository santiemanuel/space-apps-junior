# Plan de trabajo — Misión a Marte (2 desarrolladores)

Equipo: **Santiago** y **Facundo**.
Base: [`game-design.md`](game-design.md) v4 (en especial §11 "Orden de construcción"), [`README.md`](../README.md) y
[`AGENTS.md`](../AGENTS.md).

Objetivo: que los dos avancen **en paralelo y sin bloquearse**, cada uno con escenas, personajes y etapas que se
pueden probar por separado, y unificar todo en **un pull request de integración** al final.

---

## Índice

1. [Principios del reparto](#1-principios-del-reparto)
2. [Flujo de ramas](#2-flujo-de-ramas)
3. [Etapa 0 — Contratos compartidos (juntos)](#3-etapa-0--contratos-compartidos-juntos)
4. [Mapa de escenas](#4-mapa-de-escenas)
5. [Personajes](#5-personajes)
6. [Santiago — Simulación y mundos abiertos](#6-santiago--simulación-y-mundos-abiertos)
7. [Facundo — Flujo de misión y momentos guiados](#7-facundo--flujo-de-misión-y-momentos-guiados)
8. [Propiedad de archivos](#8-propiedad-de-archivos)
9. [Cómo trabajar sin el otro (dobles de prueba)](#9-cómo-trabajar-sin-el-otro-dobles-de-prueba)
10. [PR de integración](#10-pr-de-integración)
11. [Decisiones y verificaciones pendientes](#11-decisiones-y-verificaciones-pendientes)
12. [Fuera de alcance de este plan](#12-fuera-de-alcance-de-este-plan)

---

## 1. Principios del reparto

- **Por dominio, no por capa.** Cada dev tiene su lógica (`src/core/`), su contenido (`src/content/`) y sus escenas
  (`src/game/`). Así cada uno puede ejecutar y probar su parte de punta a punta.
- **Contratos primero.** Los tipos que cruzan la frontera se acuerdan en la Etapa 0 y no se cambian sin avisar.
- **Archivos calientes congelados.** `main.ts`, `GameEvents.ts`, `sceneKeys.ts`, `config.ts` y `package.json` sólo se
  tocan en la Etapa 0 y en la integración.
- **Reglas del repositorio** (`AGENTS.md`, verificadas por `src/architecture.test.ts`):
  - `src/core/` no importa `phaser` ni `src/game/`.
  - Sólo `src/data/` importa `datasets/`.
  - Todo el azar pasa por `Rng` con semilla.
  - `src/game/` sólo pinta y lee la entrada; las reglas se delegan en la lógica.
  - Tests junto al código (`*.test.ts`); factories en `src/test-utils/`.
  - UI, comentarios y tests en español; lenguaje sencillo para 7–12 años.
  - `EnvironmentSnapshot.source` nunca presenta datos archivados como "en vivo".

| | Santiago | Facundo |
|---|---|---|
| Tema | El mundo que corre solo: tiempo, medidores, tripulación, incidentes, datos reales | El camino del jugador: menús, cargas, maniobras, personajes visibles, tarjetas, informe, guardado |
| Escenas | `Voyage`, `Mars`, `Planning`, `Hud`, `MissionControl`, `DataPanel` | `Boot`, `Title`, `Loadout`, `Maneuver` (×4), `DataCard`, `Report`, `Pause` |
| Secciones del diseño | §3.1–3.7, §4.2, §4.4, §4.6, §7 | §2.1, §3.8, §3.9, §4.0, §4.1, §4.3, §4.5, §4.7, §5, §6, §8 |

---

## 2. Flujo de ramas

```
master
 ├─ feat/contratos          (Etapa 0, juntos)  ──► PR #1 a master
 │
 ├─ feat/simulacion         (Santiago, sale de master tras PR #1)
 ├─ feat/flujo-maniobras    (Facundo,  sale de master tras PR #1)
 │
 └─ feat/integracion        (sale de master; se fusionan ambas ramas) ──► PR final a master
```

- Cada dev puede hacer rebase sobre `master` cuando quiera; no se fusionan las ramas entre sí antes de la integración.
- Si alguien necesita cambiar un contrato o un archivo caliente: PR chico a `master` (`fix/contrato-...`), revisión del
  otro, y ambos hacen rebase.
- Sin commits automáticos de agentes (preferencia de `AGENTS.md`).

---

## 3. Etapa 0 — Contratos compartidos (juntos)

**Estado: completa (PR #1 mergeado; resolución agregada después en `master`).** Al fusionarla, cada uno puede
trabajar sin volver a tocar archivos compartidos.

### 3.1 Tipos de dominio

| Archivo | Contenido | Usado por |
|---|---|---|
| `src/core/flow/types.ts` | `PHASE_ORDER`, `PhaseId`, `ManeuverId`, `GameMode`, `MissionLength`, `UnlockLevel`, `LoadoutProfile`, `PhaseResult` (fase, `completed`/`suspended`, estado completo de salida, logros) | Ambos |
| `src/core/state/types.ts` | `GameState` serializable (JSON puro): `seed`, `rngState`, modo, duración, modo ayuda, nivel, `phase`, `simDate`, `meters`, `crew`, `activeCrewId`, `systems`, `inventory` (comida, repuestos, `Sample[]` con masa), `waterShield` (0–1), `fuel` (0–1), `loadout`, `landingDistanceKm`, `activeIncidents`, `history` (para el informe). Se llama `GameState` para no chocar con `MissionState` del prototipo | Ambos |
| `src/core/meters/types.ts` | `MeterState { energy: { batteryKwh, capacityKwh }, lifeSupport: { oxygenKg, waterL, co2MmHg } }`; `AlertLevel` | Ambos |
| `src/core/crew/types.ts` | `CrewRole`, `CrewId` (`vega`, `miga`, `brote`, `senda`), `CrewMemberState` (fatiga, condición, ánimo, nutrición, dosis, ubicación, tarea, reposo, `slowReasonKey`) | Ambos |
| `src/core/systems/types.ts` | `SYSTEM_IDS` / `SystemId` (depurador, reciclador, radio, paneles, motores, escudo térmico, paracaídas, MOXIE, invernadero, esclusa); `SystemStatus` | Ambos (las maniobras leen; la simulación escribe) |
| `src/core/incidents/types.ts` | `IncidentState`, `CascadeMeter`, `CascadeEmergency`, `CascadeSacrifice` | Santiago produce, ambos leen |
| `src/core/events/RealEvent.ts` | `RealEvent` (fecha, instrumento, misión, agencia, valor, unidad, claves de texto para niños, `sourceUrl`, `capped`) | Santiago produce, Facundo muestra |
| `src/content/crew.ts` | `CREW_ROSTER` (id, nombre, rol) y `STARTING_CREW_ID = 'vega'` | Ambos |
| `src/core/rng/Rng.ts` | Nuevo getter `state`: `new Rng(rng.state)` continúa la misma secuencia (guardado) | Facundo (guardado) |

Regla de evolución: el dueño del dominio puede **agregar** campos opcionales; renombrar, quitar o cambiar el tipo de
un campo requiere un PR chico a `master` revisado por el otro.

### 3.2 Eventos del bus (`src/core/events/GameEvents.ts`)

Declarados todos; los del prototipo se retiran en la integración.

| Evento | Payload | Emite | Escucha |
|---|---|---|---|
| `phase:started` | `{ phase }` | Facundo (flujo) | Santiago (escenas) |
| `phase:completed` | `PhaseResult` | Ambos | Facundo (flujo) |
| `clock:day` | `{ simDate }` | Santiago | Ambos |
| `alert:level` | `{ level: AlertLevel, reasonKey }` | Santiago | Hud, audio |
| `meters:changed` | `MeterState` | Santiago | Hud, guardado |
| `crew:changed` | `CrewMemberState[]` | Santiago | vistas de tripulantes |
| `incident:warned` / `incident:started` / `incident:resolved` | `IncidentState` | Santiago | Hud, DataCard |
| `cascade:entered` / `cascade:sacrifice` / `cascade:noReturn` | `CascadeEmergency` / `CascadeSacrifice` / `{ reasonKey }` | Santiago | Hud, Report |
| `realEvent:shown` | `RealEvent` | Santiago | Facundo (DataCard, Report) |
| `crew:switched` | `{ crewId }` | Facundo (entrada Tab) | Santiago (cámara/control) |
| `maneuver:stage` | `{ maneuverId, stage, hit }` | Facundo | Report |
| `save:requested` / `save:completed` | `{ reason }` / `{ savedAt }` | Facundo | — |

### 3.3 Escenas, datos de escena y registro

- `src/game/sceneKeys.ts`: todas las claves de la [sección 4](#4-mapa-de-escenas) y el tipo `SceneKey`.
- `src/game/scenes/sceneData.ts`: lo que recibe cada escena en `scene.start(key, data)`:
  `PhaseSceneData { state: GameState, bus }` y sus variantes `LoadoutSceneData` (`mode`), `ManeuverSceneData`
  (`maneuverId`), `VoyageSceneData` (`leg`), `ReportSceneData` (`outcome`) y `DataCardSceneData` (`event`, `bus`).
  Las escenas se comunican por `bus`, nunca llamándose entre sí.
- Escenas provisionales (`PlaceholderScene`) para cada clave nueva, ya en su carpeta:
  - `src/game/scenes/flow/` (Facundo): `BootScene`, `TitleScene`, `LoadoutScene`, `ManeuverScene`, `DataCardScene`,
    `ReportScene`, `PauseScene`.
  - `src/game/scenes/simulation/` (Santiago): `VoyageScene`, `MarsScene`, `PlanningScene`, `MissionControlScene`,
    `DataPanelScene`, más el prototipo `HabitatScene` y `HudScene`.
- `src/game/scenes/registry.ts`: `ALL_SCENES = [...flowScenes, ...simulationScenes]` (congelado).
  - `flowScenes.ts` → sólo lo edita Facundo. `simulationScenes.ts` → sólo lo edita Santiago.
- `src/game/config.ts` usa `ALL_SCENES` y no vuelve a cambiar.
- El juego sigue arrancando el prototipo (`Habitat` + `Hud`) hasta la integración.

### 3.4 Traducción

- `src/i18n/index.ts`: `t(key, params?)` con `{param}`, `setLocale`, `getLocale`, `hasKey`; fallback a `es` y aviso en
  consola con la clave visible si falta.
- Claves: `<archivo>.<clave>`, p. ej. `common.role.commander`, `voyage.sceneTitle`.
- Un archivo por dominio y por idioma:

  ```
  src/i18n/es/  common.json  menu.json  maneuvers.json  report.json   ← Facundo
                voyage.json  mars.json  hud.json  incidents.json      ← Santiago
  src/i18n/en/  (mismos archivos)
  ```

- `common.json` ya trae roles con su descripción, nombres de fases y `dataDate`.
- Tests (`src/i18n/index.test.ts`): mismas claves en `es` y `en`, ningún texto vacío, todo rol y fase con texto.
- `src/architecture.test.ts`: `i18n/` no importa Phaser y `core/` no importa `i18n/` (la lógica guarda claves; la
  capa `game/` llama a `t()`).

### 3.5 Factories de prueba (`src/test-utils/factories.ts`)

`makeGameState(over?)`, `makeCrew()`, `makeCrewMember(over?)`, `makeMeters(over?)`, `makeRealEvent(over?)`
(tormenta del 20/05/2024 en Curiosity/RAD), `makeIncident(over?)`, `makePhaseResult(over?)`.
Archivo compartido: sólo se **agregan** funciones.

### 3.6 Vista de tripulantes (`src/game/entities/CrewSprite.ts`)

- Interfaz `CrewSprite { crewId, sprite, sync(state), setSelected(selected), destroy() }` y fábrica
  `createCrewSprite(scene, crewId, x, y)`.
- Versión provisional: círculo teñido por tripulante. Santiago la usa desde ya; Facundo la reemplaza por la animada
  sin cambiar la firma (F2).

### 3.7 Arranque directo de escenas en desarrollo

- Sólo en `npm run dev`: `http://localhost:5173/?scene=<Clave>` abre la escena con `makeGameState()` y un bus nuevo
  (los `phase:completed` se registran en consola). En producción este código no se incluye.
- Parámetros propios: `?scene=Maneuver&id=landing`, `?scene=Loadout&mode=return`, `?scene=Report&outcome=suspended`,
  `?scene=Voyage&leg=back`, `?scene=DataCard`.
- `src/game/dev/devLaunch.ts` (congelado) junta `flowDev.ts` (Facundo) y `simulationDev.ts` (Santiago); cada uno
  agrega ahí los datos que necesitan sus escenas. `null` marca escenas que no se pueden abrir solas.

### 3.8 Resolución, tiles y recursos gráficos

- `src/game/display.ts` (congelado): **1280×720**, tile de **48 px**. La pantalla muestra 26,7 × 15 tiles; los mapas
  más grandes usan cámara con scroll. El prototipo lunar (tiles de 32) queda centrado hasta que se retire.
- Hojas de tripulantes (`docs/*-sprites.png`): PNG con transparencia, 1584×864 = **9 × 4 cuadros de 176×216**.
  Verificado: ningún sprite cruza el borde de su cuadro, los pies están en y = 208 y el centro en x ≈ 88, así que
  sirven directamente como spritesheet con origen (0,5; 208/216). La escala en pantalla la fija Facundo en
  `CrewSprite.ts` (≈ 0,35–0,4 para que midan ~1,6–1,8 tiles).
- Recursos del juego en `public/assets/<dominio>/` (`crew/`, `ui/`, `maneuvers/` → Facundo; `ship/`, `mars/`,
  `hud/` → Santiago). `docs/` queda para referencias.
- Imágenes generadas (p. ej. con codex-cli): pixel art en el estilo de `docs/ref-nave.png`, PNG con transparencia,
  medidas múltiplos de 48 px (tiles y objetos) o 1280×720 (fondos). Se anota el prompt usado en un `README.md` dentro
  de la carpeta del recurso.

### Criterios de aceptación de la Etapa 0

- [x] `npm test`, `npm run typecheck` y `npm run build` en verde.
- [x] El juego actual sigue arrancando; las escenas nuevas son provisionales.
- [x] Asignación de sprites a roles (ver §5.1).
- [x] Resolución y tile (§3.8).
- [x] PR #1 mergeado a `master`; ramas `feat/simulacion` y `feat/flujo-maniobras` creadas.

---

## 4. Mapa de escenas

```
Boot ─► Title ─► Loadout(ida) ─► Maneuver(ascenso + Van Allen) ─► Voyage(ida)
                                                                    │
     Report ◄─ Maneuver(reentrada) ◄─ Voyage(vuelta) ◄─ Maneuver(despegue Marte) ◄─ Loadout(vuelta) ◄─ Mars ◄─ Maneuver(aterrizaje)

Superpuestas en cualquier momento: Hud · Planning · MissionControl · DataPanel · DataCard · Pause
```

| Clave | Qué es | Diseño | Dueño | Datos que usa |
|---|---|---|---|---|
| `Boot` | Carga de recursos (sprites, tiles, audio) | — | Facundo | — |
| `Title` | Idioma, campaña o modo libre, corta o larga, modo ayuda, continuar partida | §2.1, §3.3, §8 | Facundo | progresión guardada |
| `Loadout` | Modo `outbound`: 3 perfiles de carga. Modo `return`: masa de muestras contra suministros | §4.1, §4.5 | Facundo | `GameState.inventory` |
| `Maneuver` | Escena genérica configurada por `ManeuverDefinition` | §4.0 | Facundo | `SystemStatus`, `fuel` |
| `Voyage` | Mapa top-down de la nave, compartido por la ida y la vuelta (`leg: 'out' \| 'back'`) | §4.2, §4.6 | Santiago | RadLab BioSentinel/TGO, DONKI |
| `Mars` | Base en el cráter Gale: interior, esclusa, exterior con puntos de muestreo | §4.4 | Santiago | RAD y REMS de Curiosity |
| `Planning` | Pausa: rutinas por tripulante y tablero de energía (fichas que se arrastran, sin números) | §3.1, §3.2 | Santiago | `GameState` |
| `Hud` | 3 medidores, semáforo, fecha del dato, tinte amarillo de alerta, monitor de partículas | §3.1, §3.6 | Santiago | eventos del bus |
| `MissionControl` | Mensajes, consejos y diagnóstico remoto con cuenta regresiva por la demora | §3.7 | Santiago | distancia por fecha, DONKI notifications |
| `DataPanel` | Gráficas de los datos reales de la fecha actual | §3.8.2 | Santiago | series de `src/data/` |
| `DataCard` | Tarjeta "Esto pasó de verdad" en pausa | §3.8.1 | Facundo | `RealEvent` |
| `Report` | Informe final: 3 estrellas, logros, decisiones contra gráficas reales | §5 | Facundo | historial de la partida |
| `Pause` | Esc: continuar, guardar y salir, idioma | §3.9 | Facundo | — |

---

## 5. Personajes

### 5.1 Tripulación (§3.3)

| Tripulante | Rol | Velocidad | Qué hace | Sprites |
|---|---|---|---|---|
| **Vega** (jugador al inicio) | Comandante | ×1,0 en todo | Cubre cualquier tarea y pide consejos o diagnósticos a Control de Misión | `docs/vega-sprites.png` |
| **Miga** | Ingeniera | ×1,5 en lo suyo | Repara sistemas y fugas, gestiona la energía y corrige la trayectoria | `docs/miga-sprites.png` |
| **Brote** | Botánico | ×1,5 en lo suyo | Cuida el invernadero, la comida y el agua, y controla las plagas | `docs/brote-sprites.png` |
| **Senda** | Geóloga-médica | ×1,5 en lo suyo | Recoge muestras en las salidas, guía el ejercicio y atiende a la tripulación | `docs/senda-sprites.png` |

Plantel en `src/content/crew.ts`; roles y descripciones en `src/i18n/*/common.json`. Las hojas tienen 4 filas
(frente, espalda, perfil izquierdo, perfil derecho) × 9 cuadros (idle y caminata). Referencias de ambiente:
`docs/ref-nave.png` y `docs/miga-sala-orbital.webp`.

### 5.2 Reparto

| Parte | Dueño | Ubicación |
|---|---|---|
| Estado y reglas: eficiencia, reacción (1–6 s), ruta óptima o a ciegas, especialidad ×1,5, rutinas automáticas, reposo en la enfermería, modo ayuda | Santiago | `src/core/crew/` |
| Vista: carga de las hojas, animaciones por dirección, idle, caminata a velocidad proporcional a la eficiencia, burbuja con el motivo ("Ana está cansada: durmió 4 h"), indicador del tripulante activo | Facundo | `src/game/entities/CrewSprite.ts` |
| Entrada: Tab para cambiar de tripulante (emite `crew:switched`) | Facundo | `src/game/input/` |
| Cámara y control del tripulante activo en `Voyage`/`Mars` | Santiago | escenas de simulación |

Contrato (§3.6): la escena mueve `CrewSprite.sprite`; la vista recibe el `CrewMemberState` en `sync()` y no decide nada.

### 5.3 Personajes secundarios

| Personaje | Dónde aparece | Dueño |
|---|---|---|
| Control de Misión (voz y retrato en la consola) | `MissionControl` | Santiago |
| Curiosity, el "vecino robot" que reporta el dato del día | `Mars` (decorado + mensaje diario) | Santiago |
| Narrador de las maniobras y de las tarjetas | `Maneuver`, `DataCard` | Facundo |

---

## 6. Santiago — Simulación y mundos abiertos

Rama: `feat/simulacion`. Todo lo de `src/core/` lleva tests.

### S1 · Reloj de misión — `src/core/clock/`

- Avance en horas de misión reales sobre fechas reales (§3.1).
- Velocidades: Calma (~1 día cada 2 s), Alerta (lenta), Impacto (tiempo normal), Pausa.
- Frenado automático ante avisos del planificador; antelación real DONKI→RadLab, o 48 h simuladas si no hay detección.
- Duraciones por fase según el modo corto o largo (tabla de §2.1) y calendario de la campaña 2024 (§2.2).

**Acepta:** test que simula 120 días y verifica que el reloj se frena el 8/5/2024 antes de la tormenta de mayo.

### S2 · Medidores — `src/core/meters/`

- **Energía:** `P_paneles × 1/r² × f_polvo × f_luz` − consumo; batería con tope; `f_polvo` según el UV de REMS.
- **Soporte vital:** O2 0,82 kg por tripulante y día, CO2 hasta 3 mmHg, agua 2,5 L + EVA, reciclaje de 90–98 %.
- **Salud:** dosis (`tasa × f_blindaje × Q × Δt`) con refugio de 0,2 a 0,6 según el escudo de agua; nutrición
  (3035 kcal); condición física; cansancio; ánimo.
- Dosis para niños: radiografías de tórax (0,1 mSv) y % del límite de carrera (600 mSv).
- Reemplaza el `ResourceModel` actual (4 recursos → 3 medidores + inventario, §9).

**Acepta:** tests de cada fórmula con los valores citados en el diseño.

### S3 · Falla en cascada — `src/core/cascade/`

- Modos de emergencia automáticos por medidor y sacrificios con coste (tabla de §3.5).
- Margen restante ("energía de emergencia: 2 soles").
- Punto de no retorno: toda la tripulación en reposo, o dos medidores agotados por más tiempo que su margen.
- Reemplaza el fin de partida actual por recurso agotado.

**Acepta:** test "beber el escudo de agua" → el refugio pasa a 0,6 → más dosis en la tormenta siguiente.

### S4 · Tripulación — `src/core/crew/`

- `eficiencia = clamp(1 − 0,25·fatiga − 0,25·(1−condición) − 0,15·[CO2>3] − 0,10·(1−ánimo), 0,5, 1)`.
- Reacción, ruta, especialidad, rutinas asignadas en `Planning`, modo ayuda (los automáticos van solos al refugio).
- Texto del motivo de la lentitud (clave de traducción, nunca texto escrito en el código).

### S5 · Planificador de incidentes — `src/core/incidents/`

- Formato único de §3.4: `id, fase, nivel_desbloqueo, disparador, aviso_previo, efecto, respuestas, costes, fuente, clave_texto`.
- Fuentes: línea de tiempo real + rango seguro + fallas con semilla.
- Filtrado por `unlockLevel` (§6). Desgaste extra en `cruiseBack` (§4.6).
- Contenido en `src/content/incidents.ts`: tormenta de radiación, tormenta de polvo, depurador averiado,
  micrometeorito, aislamiento, noche extrema, CO2 alto, plaga, polvo en los sellos, conjunción solar.
- Emite `realEvent:shown` con un `RealEvent` completo para cada evento del dataset.
- Hecho: `core/incidents/` (`definitions.ts` con el formato de §3.4, `timeline.ts`, `planner.ts`), `content/incidents.ts`,
  `data/incidentTimeline.ts`. Los avisos dinámicos llegan al reloj con `MissionClock.addAlert`; el estado del
  planificador (`IncidentPlannerState`) viaja junto al `GameState`, como el de la cascada.

### S6 · Datos — `src/data/`

| Serie | Origen (`datasets/raw/`) | Para |
|---|---|---|
| Van Allen | `radlab/daily/moon-orbit-lro-crater.csv` (Artemis I) | Facundo (ascenso) vía `RealEvent`/serie |
| Dosis en los viajes | `radlab/daily/deep-space-biosentinel.csv` (tope de 650 μGy/h), `mars-cruise-orbit-tgo-liulin.csv` | S2 |
| Tormentas | `radlab/events/2024-05-gannon-storm_heliocentric.csv`, `donki/sep.json`, `flr.json`, `cme.json` | S5 |
| Textos de Control de Misión | `donki/notifications.json` | S9 |
| Dosis en Marte | `radlab/daily/mars-surface-curiosity-rad.csv`, `events/2024-05-20-mars-sep_curiosity.csv` | S2, S8 |
| Polvo y frío | `mars-weather/curiosity-rems.json` | S2, S8 |

- API: `seriesFor(phase, date)` y `eventsBetween(from, to)`.
- Cada serie nueva se documenta en `datasets/README.md` (fuente, URL, uso).
- Cuando se recorta un valor de BioSentinel: `capped: true` en el `RealEvent`.
- Hecho: `src/data/realData.ts` (`seriesFor(phase, date)`, `eventsBetween(from, to, rules)`), `vanAllen.ts`
  (`VAN_ALLEN` con su `RealEvent` para el ascenso), `notices.ts` (`DONKI_NOTICES` + `noticeText`) y picos a
  resolución completa en las tarjetas. Todo sale de `node scripts/build-events.mjs`.

### S7 · Escena `Voyage`

- Mapa top-down: módulo de mando, ejercicio, depurador, reciclador, refugio de agua, radio, despensa (§4.2;
  referencia visual `docs/ref-nave.png`).
- Tareas: ejercicio, depurador, reciclador, llamada a casa. La corrección de trayectoria (minijuego) se deja para el
  nivel 3.
- Tormenta de radiación: alarma, todos al refugio, tiempo de llegada según la reacción de cada tripulante.
- `leg: 'back'`: nave gastada, sólo los repuestos que sobraron, el ejercicio cuenta doble.
- Hecho: `core/voyage/` (`ship.ts` con zonas y rutas óptima o a ciegas, `VoyageSession.ts` que junta reloj, medidores,
  rutinas, cascada e incidentes y publica en el bus), `content/ship.ts` (plano de 19 × 15 tiles, tareas, rutinas por
  defecto, desgaste) y `VoyageScene` con un tablero provisional a la derecha (lo reemplaza `Hud` en S9). El estado de
  la cascada, del planificador y del desgaste viaja con la sesión, como en S3/S5. Provisional hasta F2: Tab emite
  `crew:switched` desde la escena (quitar en la integración). Dev: `?scene=Voyage&leg=back&from=2024-05-07&help=1&level=2&length=long`.

### S8 · Escena `Mars`

- Adaptar `HabitatScene` al cráter Gale (`MISSION_SITE = 'marsSurface'`).
- Ciclo del sol: planificación, día (tareas y EVA), noche (frío real → calefacción).
- Puntos de muestreo ubicados por semilla, con masa y valor según la distancia.
- MOXIE escalado, invernadero, esclusa.
- Entrega a Facundo el `inventory.samples` para `Loadout` en modo `return`.

### S9 · Escenas superpuestas: `Hud`, `Planning`, `MissionControl`, `DataPanel`

- `Hud`: 3 medidores (la salud con 4 íconos), semáforo sin porcentajes, fecha y fuente del dato, tinte amarillo,
  monitor de partículas con clics que se aceleran.
- `Planning`: rutinas y tablero de energía con el mouse.
- `MissionControl`: demora real con cuenta regresiva y bloqueo durante la conjunción solar.
- `DataPanel`: gráficas con la posición del jugador en el tiempo.

### Entregables de Santiago

- [ ] `core/clock`, `meters`, `cascade`, `crew`, `incidents` con tests.
- [ ] Series de `src/data/` documentadas en `datasets/README.md`.
- [ ] `Voyage` jugable (ida y vuelta) y `Mars` jugable con un estado de prueba.
- [ ] `Hud`, `Planning`, `MissionControl`, `DataPanel`.
- [ ] Textos en `voyage/mars/hud/incidents.json` (es + en).

---

## 7. Facundo — Flujo de misión y momentos guiados

Rama: `feat/flujo-maniobras`.

### F1 · Traducción completa — `src/i18n/`

- Selector ES/EN en `Title` y `Pause`.
- Migrar a claves los textos que hoy están escritos en `HudScene` y en `content/missions.ts`.
- Formateo de números y fechas por idioma (`Intl`).

### F2 · Personajes visibles — `src/game/entities/CrewSprite.ts`

- Carga de las 4 hojas en `Boot` (spritesheet, tamaño de cuadro a medir sobre los PNG).
- Animaciones `idle-{dir}` y `walk-{dir}` para las 4 direcciones.
- Burbuja de estado (motivo de la lentitud), marcador del tripulante activo, Tab.
- **Conviene publicar esto primero** como rama o paquete aparte para que Santiago lo vea, aunque se integre al final.

### F3 · Flujo de misión — `src/core/flow/MissionFlow.ts`

- Máquina de estados de las 7 fases: `prep → ascent → cruiseOut → landing → mars → marsAscent → cruiseBack → reentry → report`.
- Aplica el `PhaseResult` al `GameState` y decide la escena siguiente.
- Pura y testeable: test de un recorrido completo con resultados falsos.

### F4 · Motor de maniobras — `src/core/maneuvers/`

- `ManeuverDefinition { id, checklist: SystemId[], stages: { id, zoneWidth, speed }[] }`.
- Checklist Go/No-Go: un sistema en amarillo se puede arreglar antes o arriesgarse.
- Barras por etapa: Espacio en la zona correcta; un sistema amarillo achica la zona (§4.0).
- Un error cuesta combustible, precisión o una corrección extra, y **nunca termina la partida**.
- Resultado: precisión total, combustible restante, `PhaseResult`.

### F5 · Escena `Maneuver` + 4 configuraciones — `src/content/maneuvers.ts`

| Maniobra | Etapas | Particularidad |
|---|---|---|
| Ascenso (§4.1) | Encendido, separación de propulsores, separación de etapa, apagado | Seguido por el cruce de Van Allen: tutorial del medidor de salud con el pico de 14 393 μGy/h de Artemis I |
| Aterrizaje (§4.3) | Entrada (~2000 °C), paracaídas (~Mach 1,7), separación del escudo, motores | Resultado: distancia a la base; dificultad según la precisión, la carga y el polvo del día; mensaje sobre la demora de la señal |
| Despegue de Marte (§4.5) | Checklist de la nave de ascenso, despegue | La precisión define el combustible para correcciones en la vuelta |
| Reentrada (§4.7) | Orientar el escudo, reentrada (calor y apagón de comunicaciones), paracaídas y amerizaje | Final: la tripulación camina o va en camilla según su condición física |

Las cifras marcadas [verificar] en el diseño se muestran como estimación hasta confirmarlas.

### F6 · `Title` y `Loadout`

- `Title`: idioma, campaña 2024 o modo libre (bloqueado hasta el nivel 3), corta o larga, modo ayuda, continuar.
- `Loadout` modo `outbound`: perfiles Escudo de agua / Taller / Equilibrado (bloqueos por nivel, §6), cada uno con su
  efecto explicado y su semáforo.
- `Loadout` modo `return`: límite de masa, muestras contra comida, agua y repuestos; recordatorio de que el agua
  también es blindaje.

### F7 · `DataCard` y `Report`

- `DataCard`: fecha, instrumento y misión, valor traducido ("304 μGy/h: 64 veces lo normal"), frase, enlace a la fuente
  y aviso si el valor está recortado.
- `Report`:
  - 3 estrellas: tripulación sana, dosis controlable baja, muestras traídas a la Tierra.
  - Logros: "Refugio a tiempo", "Como Opportunity", "Cero radiografías extra", "Sobreviviste a la X9.0".
  - Decisiones del jugador junto a las gráficas reales; tarjetas vividas; explicación de la ruta nuclear.
  - En misión suspendida: cadena de decisiones, con el lenguaje "la tripulación está a salvo esperando rescate".

### F8 · Guardado y progresión — `src/core/save/`, `src/core/progression/`

- Serialización completa de `GameState` (incluye `rngState`), con versión del esquema.
- Guardado manual (Esc → Guardar) y autoguardado en cada `phase:completed`.
- Almacenamiento en `localStorage` detrás de una interfaz `SaveStore` inyectable (implementación en `src/game/`).
- Progresión: niveles 1–4, récords, logros.

**Acepta:** test de ida y vuelta: guardar → cargar → mismo estado y misma secuencia del `Rng`.

### Entregables de Facundo

- [ ] `i18n` completo y textos actuales migrados.
- [ ] `createCrewSprite` con los 4 personajes animados y el cambio por Tab.
- [ ] `core/flow`, `maneuvers`, `save`, `progression` con tests.
- [ ] `Title`, `Loadout`, `Maneuver` (4 configuraciones), `DataCard`, `Report`, `Pause`.
- [ ] Textos en `menu/maneuvers/report/common.json` (es + en).

---

## 8. Propiedad de archivos

| Ruta | Dueño |
|---|---|
| `src/core/clock/`, `meters/`, `cascade/`, `crew/`, `incidents/`, `environment/`, `resources/` | Santiago |
| `src/core/flow/` (salvo `types.ts`), `maneuvers/`, `save/`, `progression/` | Facundo |
| `src/data/`, `datasets/`, `scripts/` | Santiago |
| `src/content/habitat.ts`, `ship.ts`, `gale.ts`, `incidents.ts`, `startingConditions.ts`, `campaign.ts`, `meters.ts`, `cascade.ts` | Santiago |
| `src/content/maneuvers.ts`, `loadouts.ts`, `achievements.ts` | Facundo |
| `src/game/scenes/simulation/*`, `simulationScenes.ts` | Santiago |
| `src/game/scenes/flow/*` (incluye `BootScene.ts`), `flowScenes.ts` | Facundo |
| `src/game/entities/CrewSprite.ts`, `src/game/input/`, `src/game/textures.ts`, `src/game/dev/flowDev.ts` | Facundo |
| `src/game/dev/simulationDev.ts` | Santiago |
| `src/game/entities/StationView.ts` | Santiago |
| `src/i18n/*/voyage\|mars\|hud\|incidents.json` | Santiago |
| `src/i18n/*/menu\|maneuvers\|report\|common.json` | Facundo |
| `src/test-utils/factories.ts` | Compartido: sólo se **agregan** funciones, no se modifican las existentes |
| `src/main.ts`, `GameEvents.ts`, `sceneKeys.ts`, `config.ts`, `display.ts`, `registry.ts`, `sceneData.ts`, `devLaunch.ts`, `i18n/index.ts`, `package.json`, `*/types.ts` de la Etapa 0 | **Congelados**: Etapa 0 o integración |

---

## 9. Cómo trabajar sin el otro (dobles de prueba)

| Necesidad | Santiago la resuelve con | Facundo la resuelve con |
|---|---|---|
| Arrancar su escena | Parámetro de URL en dev (`?scene=Voyage`) que arranca la escena con `makeGameState()` | `?scene=Maneuver&id=landing` |
| Personajes | `createCrewSprite` provisional (círculo teñido) | `makeCrew()` con estados variados (cansado, sano, en reposo) |
| Datos reales | Las series reales (son suyas) | `makeRealEvent()` y una serie fija de Artemis I en la factory |
| Fases vecinas | — | Escenas stub que emiten `phase:completed` con `makePhaseResult()` |
| Carga elegida | `makeGameState({ waterShield: 1 })` | — |
| Sistemas en amarillo | — | `makeGameState({ systems: { scrubber: 'yellow' } })` |

El selector `?scene=` ya está implementado (§3.7): cada uno agrega sus datos de prueba en su `*Dev.ts`.

---

## 10. PR de integración

### 10.1 Pasos

1. Ambos hacen rebase de su rama sobre `master` y dejan los tests en verde.
2. Se crea `feat/integracion` desde `master`; se fusiona `feat/flujo-maniobras` y luego `feat/simulacion`.
3. Conexiones:

| Conexión | Quién la hace |
|---|---|
| `main.ts` crea el `GameState` inicial, el `GameSession` real y arranca `MissionFlow` | Facundo |
| `Voyage`/`Mars` ya usan `createCrewSprite`: verificar con la versión animada | Santiago |
| `crew:switched` (Tab) → cámara y control en las escenas de simulación | Santiago |
| `realEvent:shown` → `DataCard` (pausa el reloj) | Facundo |
| `Loadout` → `waterShield`, `inventory` y `spares` iniciales de `Voyage` | Facundo |
| `Mars` → `inventory.samples` → `Loadout(return)` | Santiago |
| Resultado del aterrizaje (distancia) → puntos de muestreo y EVA en `Mars` | Santiago |
| Guardado: serializa reloj, medidores, tripulación e incidentes activos | Facundo |
| `CascadeState` (`src/core/cascade/types.ts`) entra en `GameState` como campo opcional `cascade` para guardarlo; hasta entonces viaja aparte para no tocar los contratos | Santiago (tipo) · Facundo (guardado) |
| Historial de decisiones e incidentes → `Report` | Facundo |
| Desbloqueos de `progression` → filtro del planificador de incidentes | Santiago |

4. Se retiran el prototipo lunar y el código muerto (`ResourceModel` de 4 recursos, decisiones con 1/2/3, fin de
   partida por recurso), y se actualiza `README.md` (hoy dice "Base Lunar").

### 10.2 Criterios de aceptación del PR final

- [ ] `npm test`, `npm run typecheck` y `npm run build` en verde, incluido `src/architecture.test.ts`.
- [ ] Test de partida completa en Node: campaña 2024, modo corto, semilla fija, de `prep` a `report`.
- [ ] Prueba manual en `npm run dev`: las 7 fases en orden, en ES y en EN.
- [ ] Guardar en `Voyage`, recargar la página y continuar con el mismo estado.
- [ ] La tormenta de mayo de 2024 frena el reloj, se tiñe de amarillo y abre su `DataCard`.
- [ ] Un medidor en cero entra en cascada y no termina la partida.
- [ ] `EnvironmentSnapshot.source` dice "archivo" cuando el dato no es en vivo.
- [ ] Ningún texto de UI escrito en el código; todas las claves existen en `es` y `en`.
- [ ] Revisión cruzada: cada uno revisa la parte del otro.

---

## 11. Decisiones y verificaciones pendientes

| Tema | Responsable | Antes de |
|---|---|---|
| ~~Fechas de las conjunciones solares de Marte (§10 del diseño)~~ Hecho: 2015, 2017, 2019, 2021 y 2023 (JPL), en `datasets/curated/mars-conjunctions.json` | Santiago | S5 |
| ~~Antelación real DONKI→RadLab en mayo y octubre de 2024~~ Hecho: mayo 69 h, octubre 1,9 h (ver `datasets/README.md`) | Santiago | S1 |
| ~~Factores Q por fase (Hassler 2014, Zeitlin 2013)~~ Hecho: 3,05 y 3,8, citados en `datasets/curated/radiation-dose.json` | Santiago | S2 |
| ~~Mínimas de REMS por debajo de −90 °C~~ Hecho: son artefactos aislados, se reemplazan por la mediana vecina (ver `datasets/README.md`) | Santiago | S8 |
| Cifras de aterrizaje (Curiosity/Perseverance) y reentrada (Orion/Artemis I) | Facundo | F5 |
| Límites de masa de las cargas de ida y vuelta | Facundo | F6 |
| Pesos de la eficiencia y márgenes de la cascada: ajustar con pruebas con niños | Ambos | Después de la integración |

---

## 12. Fuera de alcance de este plan

Quedan para después del PR de integración:

- Modo largo completo y modo libre con ventanas aleatorias (se dejan preparados, pero bloqueados).
- Niveles de desbloqueo 3 y 4 con todo su contenido (MOXIE, corrección de trayectoria, diagnóstico remoto,
  micrometeorito, polvo en los sellos, escenarios especiales).
- **Audio** (alarmas, clics del monitor de partículas, música): decidido dejarlo para después de la integración.
  Hasta entonces, el monitor de partículas y las alarmas son sólo visuales.
- Pulido visual.
- Balance fino con pruebas de juego.

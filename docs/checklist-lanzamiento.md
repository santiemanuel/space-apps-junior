# Checklist de correcciones antes del lanzamiento

Lista de correcciones pedidas antes de publicar, con las aclaraciones del equipo ya incorporadas. Cada punto dice el
problema, dónde está en el código, qué hacer y cuándo se da por terminado. Marcar `[x]` al cerrar cada uno.

Decisiones tomadas:
- **Dormir "solo":** era el reloj rápido por falta de tareas (`clock.idleBoost`), no un sueño real.
- **Tareas al dormir:** se cancelan, sin efecto (no suman ni restan).
- **Planificación (P):** se saca la pantalla entera (rutinas y energía). La gestión de recursos pasa a una consola en la
  sala de mando. El aviso de tormenta pasa a ser un cartel grande animado, como cuando aparece un jefe.
- **Marte:** 20 soles que duren **10–12 minutos reales**, con tareas de riesgo/recompensa (paneles solares, batería de
  noche).

---

## A. Errores

### [x] A1. Texto cortado en los minijuegos de despegue
- **Problema:** en las pruebas de `Maneuver` (`ascent`, `marsAscent`) algunas consignas, contadores o resultados no
  entran en su caja.
- **Dónde:** `src/game/scenes/flow/ManeuverScene.ts`, `src/core/maneuvers/flightGames.ts`,
  `src/i18n/{es,en}/maneuvers.json`.
- **Qué hacer:**
  - Revisar cada prueba en español y en inglés (el inglés suele ser más largo).
  - Darle a cada texto un ancho máximo (`wordWrap`) y un alto según lo que muestra. Si igual no entra, achicar la letra
    un paso o acortar la frase, sin perder el lenguaje sencillo.
  - Mirar sobre todo la consigna y el progreso de la memoria de flechas, que pasaron al costado.
- **Listo cuando:** las capturas (`scripts/art/capture.mjs`) de cada prueba, en los dos idiomas y en el peor caso
  (fallos, resultado final), no muestran texto cortado ni encimado.

### [x] A2. Humo que queda flotando lejos de la nave después del despegue
- **Problema:** las bocanadas de `puff()` (`flightArt.ts`, ~l. 681) nacen en un punto fijo y se alejan `drift` px.
  Cuando el cohete sube o la cámara se mueve, el humo queda suspendido en el aire, despegado de la nave.
- **Dónde:** `src/game/scenes/flow/flightArt.ts` (humo, vapor, polvo).
- **Qué hacer:**
  - El humo del motor sale de la tobera **en su posición actual**, no desde la del despegue.
  - El humo que queda atrás baja o sale de cuadro y se apaga antes de verse aislado.
  - Cuando la nave sale de cuadro, dejar de crear bocanadas y desvanecer las que quedan, sin cortes.
  - Lo mismo para `marsAscent` (polvo).
- **Listo cuando:** en una secuencia de capturas (`FRAMES=n`) de `?scene=Maneuver&id=ascent` y `&id=marsAscent` no hay
  humo separado de la nave ni de la plataforma.

### [x] A3. Con el avance rápido activado no se puede dormir
- **Causa:** `HabitatSession.canSleep()` exige `this.manual`. Con el avance rápido `manual` es `false`, así que dormir
  queda bloqueado aunque no haya ninguna tarea.
- **Dónde:** `src/core/habitat/HabitatSession.ts` (`canSleep`, `sleep`), `SimulationMapScene.ts` (l. 349).
- **Qué hacer:** dejar dormir también en avance rápido, si se cumplen las demás condiciones (calma, sin emergencias, sin
  decisiones, sin refugio ni embarque). Al dormir manda el ritmo de sueño; al despertar se vuelve al ritmo anterior.
- **Listo cuando:** hay un test en `VoyageSession.test.ts`: con avance rápido y sin tareas, `sleep('infirmary')`
  devuelve `true`.

### [x] A4. El reloj rápido sin tareas parece un "dormir solo"
- **Causa (confirmada):** cuando el jugador no tiene nada que hacer, el reloj se acelera (`clock.idleBoost`, activado
  por `setIdle(!hasWork())` en `HabitatSession.update`). Visto desde afuera parece que la tripulación se durmió sola,
  sin aviso y sin forma de salir.
- **Qué hacer:**
  - Dormir es **siempre** una acción del jugador (Z en la cama). El reloj rápido no puede verse ni sentirse como dormir:
    se muestra como "avance rápido" con un indicador propio (por ejemplo un ícono ⏩ animado y el reloj girando) y el
    jugador sigue moviéndose normalmente.
  - Al dormir de verdad: la pantalla se oscurece hasta negro (o se ve al tripulante en la cama con "Z z z"), la hora
    avanza y se ve el ícono de la tecla para despertar.
  - El jugador puede despertarse cuando quiera con Z o E. Eso es `wake(false)`: sin el descanso completo.
  - Si llega una alerta, una decisión o una emergencia, se despierta solo, con un fundido rápido y la alarma.
- **Listo cuando:** dormir sólo empieza con la tecla, el reloj rápido no se confunde con dormir, se puede salir a mano
  y los despertares automáticos se notan.

### [x] A5. Al dormir se cancelan las tareas activas
- **Decisión:** las tareas del día que quedan pendientes al dormir **se cancelan sin efecto**: no dan estrellas ni
  recompensa y tampoco aplican la consecuencia de no hacerlas.
- **Dónde:** `HabitatSession.sleep()` / `wake()`, `pendingWork()`, `taskNeeded()`.
- **Qué hacer:** al empezar a dormir, cerrar las tareas pendientes del día y dejar constancia en el historial sin
  efectos. Las reparaciones de incidentes y las emergencias no se cancelan (con ellas tampoco se puede dormir, ver
  `canSleep`).
- **Listo cuando:** al despertar, el tablero no muestra tareas del día anterior y un test comprueba que los medidores no
  cambiaron por esas tareas.

### [x] A6. Los automáticos se quedan en el refugio después de la tormenta
- **Problema:** cuando termina la tormenta, los automáticos siguen en la sala del escudo de agua. Puede ser porque la
  próxima alerta está cerca o porque el estado del refugio no se limpia.
- **Dónde:** `HabitatSession` (`shelter`, `checkShelter`, `targetFor`, `planRoutes`, `activityOf`),
  `core/crew/routines.ts`, `CLOCK_RULES.alertGapSeconds` (`core/clock/MissionClock.ts`).
- **Qué hacer:**
  - Reproducir con `?scene=Voyage&fx=impact` y revisar qué devuelve `targetFor` para cada tripulante cuando termina la
    tormenta.
  - Al terminar el impacto, liberar el refugio y devolver a cada uno a su rutina. Si la próxima alerta está cerca,
    que igual hagan una tarea corta en vez de quedarse quietos.
  - Bajar un poco la espera entre incidentes (`alertGapSeconds` o lo que corresponda), ahora que las tareas al azar
    (C1) llenan ese tiempo.
- **Listo cuando:** hay un test en el que, después de una tormenta, ningún automático sigue en `shelter` pasada una hora
  simulada sin una nueva alerta.

---

## B. Interfaz e indicaciones

### [x] B1. Indicador de la cama en la enfermería (tecla Z)
- **Qué hacer:** al entrar a la enfermería, mostrar encima de la cama un ícono animado de la tecla **Z** (que suba y
  baje o titile). Se ve todo el tiempo que el jugador esté en la sala. Si no se puede dormir (alerta, decisión…),
  aparece apagado o con un candado, y al acercarse explica el motivo en pocas palabras.
- **Dónde:** `SimulationMapScene.ts` (`promptText`, hoy arma el texto `hud.sleep.prompt`). Ubicar la cama con un
  `landmark` en `ship.json` y `gale.json` (no con una posición fija en el código).
- **Listo cuando:** se ve en las capturas de la nave y de Gale.

### [x] B2. Cambiar el texto de las salas por un ícono en el centro
- **Problema:** `roomPrompt()` pone un texto debajo del tripulante (`this.prompt`, l. 758) que lo sigue por la sala.
- **Qué hacer:**
  - Sacar ese texto. Poner en el **centro de la sala** (o sobre la máquina o el `spot`) un ícono animado de la tecla
    **E** con el pictograma de la tarea (llave para el mantenimiento, bici para el ejercicio, olla para la cocina,
    gota para el agua…).
  - Estados: pendiente (rebota o titila), al día (tilde verde, quieto), bloqueada (gris con candado), incidente (rojo
    con signo de exclamación).
  - Si hace falta texto, una línea corta sólo cuando el jugador está pegado a la máquina.
  - La cocina (`kitchenAt`) usa un ícono por etapa: menú, recetario, cocinar.
- **Dónde:** `SimulationMapScene.ts`, íconos en `public/assets/hud/` (`scripts/art/icons.py`), `hudIcons.ts`.
- **Listo cuando:** se juega un día completo sin texto pegado al jugador y cada sala se entiende sólo con el ícono.

### [x] B3. Sacar la Planificación (P) entera y crear la consola de recursos en la sala de mando
- **Hoy:** `PlanningScene` junta las rutinas de cada tripulante (barra de 24 h) y el tablero de energía. Las rutinas ya
  son automáticas (`smartRoutines`).
- **Qué hacer:**
  - **Sacar la pantalla completa** y la tecla P (también de las ayudas, tutoriales y textos `hud.planning.*` en `es/` y
    `en/`).
  - Crear una **consola de gestión de recursos en la sala de mando** (`command`; en Marte, en la sala de energía, que ya
    tiene la regla `power.panelBlocked`). Se camina hasta ahí y con E se abre.
  - En la consola se eligen modos o prioridades con **beneficio y costo visibles**, para que se sienta el
    riesgo/recompensa de una misión real. Ejemplos:
    - **Ahorro de energía:** la batería dura más, pero el depurador y el reciclador de agua rinden menos.
    - **Ciencia a fondo:** más avance de la misión y más muestras, pero más consumo y más desgaste de los sistemas.
    - **Soporte vital primero:** aire y agua seguros, pero la ciencia se frena.
    - **Racionar comida o agua:** los víveres rinden más días, pero bajan el ánimo y la forma.
  - Cada opción muestra con íconos y flechas ▲▼ qué sube y qué baja antes de confirmar. Las reglas viven en `src/core/`
    (tests propios) y la consola sólo las dibuja.
  - Mantener el cambio de tripulante con Tab y un indicador mínimo de quién está activo.
- **Ojo:** `scenes/registry.ts` y `sceneKeys.ts` son archivos congelados. Sacar la escena requiere coordinar la
  integración.
- **Listo cuando:** ya no está la tecla P, los recursos se manejan desde la consola, cada opción muestra su
  beneficio y su costo, y siguen pasando `npm test` y `src/fullGame.test.ts`.

### [x] B4. Tormenta de radiación: cartel de "jefe" y consecuencias claras
- **Hoy:** "Seguir trabajando" sólo dice "La tripulación recibe mucha más radiación" (`src/i18n/es/incidents.json`).
- **Qué hacer:**
  - **Cartel grande animado** cuando está por llegar la tormenta, como la presentación de un jefe: texto enorme que entra
    con fuerza ("¡SE ACERCA UNA TORMENTA SOLAR!"), franjas o pantalla teñida, temblor de cámara, alarma y la cuenta
    regresiva hasta el impacto. Dura 2–3 s y no tapa el juego después. Respetar la preferencia de movimiento reducido.
  - Mostrar las dos opciones lado a lado con **qué se gana y qué se arriesga**, con íconos y números simples:
    - **Refugio:** tareas en pausa y nadie sale, pero la dosis queda baja.
    - **Seguir trabajando:** las tareas avanzan, pero la dosis se multiplica por N (en "radiografías").
  - Mientras dura la tormenta afuera del refugio: medidor de dosis en rojo, ícono de radiación sobre cada tripulante
    expuesto y un aviso cuando se pasa un umbral.
  - El informe final deja claro que la estrella de "dosis baja" se perdió por esa decisión.
- **Dónde:** `incidents.json` (es/en), `HudScene` (`bottomRows`, decisiones), `StatusView`, `audio/themes.ts`.
- **Listo cuando:** un chico de 7–12 años puede decir qué gana y qué pierde antes de elegir.

---

## C. Ritmo del viaje y tareas

### [x] C1. Tareas que aparecen al azar pero con motivo
- **Hoy:** las tareas del día rotan por fecha (`taskNeeded`, `DAILY_TASKS`) y crecen con las tormentas vividas.
- **Qué hacer:**
  - Hacer que aparezcan con `Rng` (semilla de la partida, nunca `Math.random`) y siempre con un motivo visible: "el filtro
    de CO₂ se está saturando", "la planta necesita agua", "Brote se siente solo: llamá a casa".
  - Límites para no abrumar: como máximo N tareas activas a la vez y una separación mínima entre apariciones.
  - Cada tarea afecta algo concreto (recursos, salud, ánimo, sistemas) si no se hace a tiempo.
  - Los automáticos también pueden hacerlas, pero **con una demora de reacción** (empiezan X horas después de que la
    tarea aparece), para que el jugador tenga la oportunidad de hacerla antes y llevarse las estrellas.
  - Estas tareas llenan el tiempo entre incidentes (ver A6, espera más corta).
- **Dónde:** `HabitatSession` (`taskNeeded`, `planDay`, `pendingWork`), `core/crew/routines.ts`, `content/ship.ts`,
  `content/gale.ts`.
- **Listo cuando:** hay tests de la frecuencia y de la demora de los automáticos, y `fullGame.test.ts` sigue pasando.

---

## D. Marte

### [x] D1. Estadía en Gale de 10–12 minutos reales
- **Qué hacer:** mantener los 20 soles simulados, pero que duren **10–12 minutos de juego real**. Ajustar el ritmo de
  la fase `mars` (`playHoursPerSecond`, `idleHoursPerSecond` o una regla propia en `CLOCK_RULES`) y medirlo.
- **Listo cuando:** una partida normal en Marte dura entre 10 y 12 minutos (medida con un test o una corrida
  cronometrada) y `fullGame.test.ts` sigue pasando.

### [x] D2. Tareas de Marte con riesgo/recompensa
- **Qué hacer:** sumar tareas **optativas** que pesen en la misión. Hacerlas da algo positivo; no hacerlas tiene un
  costo. Cada una muestra en su ícono o en la consola qué se gana y qué se arriesga.
  - **Limpiar los paneles solares** (salida al exterior): el polvo baja de a poco la generación y limpiar la devuelve
    al máximo. El riesgo es salir (tiempo, dosis, tormenta de polvo), y no limpiar deja menos energía de día.
  - **Preparar la base para la noche** (aislar módulos, bajar cargas, revisar la batería, calentar antes de que caiga el
    sol): la batería se descarga más lento de noche. A cambio cuesta tiempo o frena algo (ciencia, confort). Si no se
    hace, la noche gasta más y hay riesgo de apagón.
  - Otras: salidas extra a buscar muestras, revisar el MOXIE, cuidar el invernadero.
- **Dónde:** `MarsSession`, `content/gale.ts`, minijuegos nuevos en `src/core/minigames/` (cada uno con su estrategia en
  `minigames.test.ts` y su mini tutorial en `minigames/tutorials.ts`).
- **Listo cuando:** cada tarea nueva cambia de verdad la energía o los recursos (con tests) y el jugador lo ve antes
  de elegir.

### [x] D3. Cartel del clima cortado (abajo a la derecha)
- **Problema:** en Marte, el cartel del clima de abajo a la derecha se ve cortado.
- **Dónde:** revisar la fila de Curiosity de `HudScene.realRows` (`hud.panel.curiosityShort`) y el globo de Curiosity de
  `MarsScene` (`curiosityBubble`, `mars.curiosity.bubble`).
- **Qué hacer:** dar ancho máximo y salto de línea, o reordenar lo que muestra para que entre completo en los dos
  idiomas y con temperaturas de tres cifras (por ejemplo −100 °C).
- **Listo cuando:** la captura de `?scene=Mars` en es y en en muestra el cartel completo.

### [x] D4. Textos más grandes mientras se explora Marte
- **Problema:** los avisos que aparecen al recorrer Gale (rocas juntadas, datos del terreno, `showToast`) son chicos y
  duran poco para aprender de ellos.
- **Dónde:** `MarsScene.renderPlace` (`showToast` con `mars.rock.*.fact`, `mars.plant.collected`…), `showToast` en
  `SimulationMapScene`, `landmark` de `gale.json` y `content/galeTerrain.ts`.
- **Qué hacer:** letra más grande, caja legible con contraste y, cuando hay un dato para aprender, un ícono o una foto
  chica. Que duren según el largo del texto y que no se pisen (en cola). Opcional: al pasar por un `landmark`, un cartel
  con su dato.
- **Listo cuando:** los datos se leen cómodos a 1280×720 sin tapar al jugador.

### [x] D5. Bajar y variar el sonido de los pasos en Marte
- **Problema:** `footstepMars` suena repetitivo y agudo.
- **Dónde:** `SimulationMapScene.playSounds` (l. 379, volumen 0.55 y tono 0.94/1.06), `src/game/audio/themes.ts`
  (`paso-marte`).
- **Qué hacer:** bajar el volumen (alrededor de la mitad), hacerlo más grave (sonido de arena y polvo apagado), variar
  apenas el tono y el volumen en cada paso sin usar `Math.random` (por ejemplo, un ciclo fijo de variantes) y espaciar
  un poco los pasos.
- **Listo cuando:** caminar un minuto afuera no cansa y el paso se oye por debajo de la música y los avisos.

---

## E. Carga de la nave (acomodar elementos)

### [x] E1. Contadores visuales y uso del agua
- **Dónde:** `src/game/scenes/flow/cargoGridView.ts`, `src/content/loadouts.ts`.
- **Qué hacer:**
  - Para cada tipo (comida, agua, escudo, repuestos, muestras): una barra o una fila de piezas con **disponible contra
    guardado** ("3 de 4"), con el ícono del recurso.
  - Agua: guía visual de para qué se usa: **beber** (gota con vaso: días de agua) o **escudo** (gota con escudo:
    protección contra la radiación). Mostrar cómo cambia cada uno al mover piezas.
- **Listo cuando:** sin leer párrafos se entiende cuánto falta de cada cosa y para qué sirve el agua cargada.

### [x] E2. Botón de confirmar que avisa el riesgo
- **Hoy:** el botón siempre dice `menu.loadout.return.confirm` (`cargoGridView.ts`, l. 339).
- **Qué hacer:** si falta algo (mínimo de un recurso, escudo bajo, carga incompleta), el botón cambia a **"Aceptar
  riesgos"**, en amarillo o rojo según la gravedad, con una lista corta de lo que falta. Si está todo, vuelve al texto y
  color normales.
- **Listo cuando:** se ven los dos estados en las capturas y las claves están en `es/` y `en/`.

---

## F. Arte de los aterrizajes

### [x] F1. Aterrizaje en Marte y reentrada en la Tierra al nivel de los despegues
- **Hoy:** `landing` y `reentry` usan cielo, montañas y suelo genéricos (`flightArt.ts`, l. 47–48) y un plasma simple
  (l. 468, 502).
- **Qué hacer**, siguiendo el proceso de los despegues (`art/prompts/vuelo-*.txt` → `gen.sh` → `pre.py` →
  `snap_pixels` → `scripts/art/flight-scenery.py`):
  - **Marte:** cápsula con escudo térmico, plasma de entrada, apertura del paracaídas, escudo que se suelta y cae,
    motores de frenado con polvo que se levanta, toque en el suelo y fondo de Gale (monte Aeolis, cielo de Marte).
  - **Tierra:** plasma de reentrada con apagón de radio, paracaídas, amerizaje con salpicadura, barco o helicóptero de
    rescate y salida de la tripulación (caminando o en camilla, según su condición).
  - Efectos: temblor, calor, chispas, nubes que pasan, color del cielo que cambia con la altura.
  - Anotar cada recurso nuevo en `docs/pixel-art.md` y hacer los normal maps si corresponde.
- **Listo cuando:** las secuencias de capturas de `?scene=Maneuver&id=landing` y `&id=reentry` se ven al mismo nivel
  que `ascent`.

---

## Verificación general
- `npm test`, `npm run typecheck`, `npm run build`.
- `src/fullGame.test.ts` (campaña 2024 completa) sigue pasando.
- Toda clave nueva de UI está en `src/i18n/es/` y `src/i18n/en/`.
- Todo azar nuevo pasa por `Rng`.

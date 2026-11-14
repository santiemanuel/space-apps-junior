# Documento de diseño — Misión a Marte

Estado: **borrador v2 para validar** antes de programar (ver el historial al final). Cada número indica su tipo:

- **[dato]**: medido o publicado por la NASA u otra agencia, con su fuente.
- **[norma]**: requisito de NASA-STD-3001 o valor de diseño del BVAD.
- **[regla]**: decisión de juego (equilibrio, simplificación). Se puede ajustar libremente, pero se muestra como estimación, nunca como dato.
- **[verificar]**: hay que confirmarlo antes de usarlo.

---

## 1. Visión

> Llevá a tu tripulación de la Tierra a Marte y de vuelta a casa sana, juntando toda la ciencia que puedas,
> mientras el clima espacial **real** pone a prueba cada decisión.

Pilares, sacados del desafío *Junior Astronaut Mission Trainer*:

1. **Ninguna decisión es gratis.** Toda elección se paga en energía, aire y agua, o salud.
2. **Datos reales visibles.** El jugador ve qué dato de la NASA causó cada evento, con su fecha y su fuente.
3. **Pocos sistemas.** Tres medidores, no seis.
4. **Fallar enseña.** No hay "Game Over" humillante. Cuando un sistema cae, el juego no termina: obliga a **sacrificar otro** para resistir (ver 3.5). El informe final compara tus decisiones con lo que pasó de verdad.
5. **Rejugable.** Distintas fechas reales, cargas, fallas y objetivos.
6. **Mecánica antes que gráficos.** Un juego simple que enseña una restricción real vale más que uno bonito que no.

Público: 7–12 años (objetivo principal: 10). Español sencillo; cada término técnico se explica en contexto la primera vez que aparece.

## 2. Arco de la misión

| Fase | Amenaza principal | Lo que se aprende | Dataset principal |
|---|---|---|---|
| 1. Preparación y despegue | Carga limitada; cinturones de Van Allen | Todo lo que llevás pesa; la Tierra nos protege | RadLab: Artemis I (EAD/HERA) |
| 2. Viaje | **Radiación** (sin atmósfera ni campo magnético) | Tormentas solares, refugio, ejercicio, aislamiento | RadLab: BioSentinel, TGO en crucero; DONKI |
| 3. Aterrizaje | Los "7 minutos de terror" | Estamos solos: la señal tarda más que el aterrizaje | Secuencia EDL de Curiosity/Perseverance |
| 4. Estancia en Marte | **Polvo y frío** | La atmósfera protege de la radiación pero tapa el sol | REMS y RAD de Curiosity (cráter Gale) |

El contraste entre fases es medible: durante la tormenta de mayo de 2024, el espacio profundo registró
**653 μGy/h** (BioSentinel) y la superficie de Marte **304 μGy/h** (Curiosity) [dato, RadLab]. Son instrumentos
distintos, así que la comparación es orientativa.

### 2.1 Modos

| Modo | Fechas | Para qué |
|---|---|---|
| **Campaña "Historia real 2024"** | Un calendario real único (ver 2.2) | Credibilidad: todo pasó de verdad, en orden |
| **Modo libre** | Cada fase toma un período real distinto; la pantalla siempre muestra la fecha del dato | Rejugabilidad |

Duración elegible:

| | Despegue | Viaje (jornadas jugables) | Aterrizaje | Marte (soles) | Total aprox. |
|---|---|---|---|---|---|
| **Corta** | ~4 min | 4 | ~2 min | 10 | ~25 min |
| **Larga** | ~6 min | 8 | ~2 min | 30 (campaña: 19) | ~60 min |

El tiempo entre jornadas de viaje **sí transcurre**, en avance rápido (ver 3.1), con los consumos y la dosis
reales de esos días. Una misión corta juega menos jornadas, pero no hace el viaje más corto.

### 2.2 Calendario de la campaña 2024

Restricción de datos: RAD de Curiosity llega hasta el **03/06/2024** en RadLab, y BioSentinel cubre 2024 completo.

| Fase | Fechas reales | Eventos reales que entran |
|---|---|---|
| Despegue | 15/01/2024 | Cruce de Van Allen: perfil de Artemis I (16/11/2022), indicado como "medido por Artemis I" |
| Viaje | 15/01 → 14/05/2024 | Tormenta solar del 8–14 de mayo (llamaradas X, SEP) en espacio profundo |
| Aterrizaje | 15/05/2024 | Clima real de Gale ese día |
| Marte | 15/05 → 03/06/2024 (19 soles) | **Evento SEP del 20/05/2024** en superficie: la región solar activa sigue amenazando |

El viaje real dura ~7 meses (Curiosity: 254 días) [dato]. La campaña lo **acelera a 4 meses** para que
coincida con los datos, y lo dice en pantalla ("viaje acelerado").

En el modo libre, el viaje usa ventanas de BioSentinel (2022-11 → 2025-11) o de TGO en crucero
(04 → 09/2016), y la estancia usa ventanas de Curiosity (2015 → 06/2024) donde RAD y REMS coinciden.

## 3. Sistemas compartidos

### 3.1 Tiempo

- **Estancia:** un sol ≈ 90 s reales. La mañana es una pausa de planificación sin reloj.
- **Viaje:** una jornada ≈ 2 min. Entre jornadas el calendario corre en **avance rápido interactivo**, no con un salto:
  - Los medidores se animan día a día; nunca saltan de golpe del día 10 al 47.
  - La tripulación sigue sus rutinas solas.
  - El jugador puede **detener el avance** cuando quiera para actuar.
- **El avance se frena solo** ante cada aviso del planificador de incidentes (3.4), en tres niveles:

  | Nivel | Disparador | Velocidad | Señales para el jugador |
  |---|---|---|---|
  | Calma | Sin avisos | Rápida (~1 día cada 2 s) [regla] | Interfaz normal |
  | **Alerta** | Detección real en DONKI: CME, llamarada M/X o una alerta de `notifications` | Lenta | Interfaz teñida de amarillo; el texto de la alerta adaptado; el **monitor de partículas** (clics tipo contador Geiger) acelera; ligeras fluctuaciones de los paneles |
  | **Impacto** | Inicio real del pico de dosis en RadLab | Tiempo normal, con el reloj de la jornada | Alarma y orden de refugio |

- **Antelación del aviso:** el aviso se da con la **diferencia real** entre la detección en DONKI y el pico en RadLab
  para ese evento. Si no hay evento detectado que lo preceda, se usan **48 h simuladas** [regla].
  El jugador ve venir el golpe y decide antes. La crisis se siente anticipada, no como una ventana de error.
- El reloj de simulación avanza en **horas de misión reales**. Los datos se consultan por fecha, así que
  la compresión cambia la velocidad de juego, nunca los valores.

> Nota de rigor: los avisos de DONKI se refieren al entorno de la Tierra. La nave está en otra posición, así que
> la antelación medida es una aproximación y se presenta como "pronóstico", con incertidumbre (3.6).
> Por eso el indicador es un **monitor de partículas** y no estática de radio: las llamaradas cortan la radio
> terrestre de onda corta, pero no la Red de Espacio Profundo (DSN) que usan las naves.

### 3.2 Los tres medidores

Viajan entre fases: lo que pasa en el despegue se arrastra hasta Marte.

#### Energía

```
generación = P_paneles × (1 / r²) × f_polvo × f_luz
consumo    = soporte_vital + calefacción + sistemas asignados (blindaje, MOXIE, invernadero, radio)
batería   += (generación − consumo) × Δt, con tope de capacidad
```

- `1/r²`: la luz solar cae con la distancia al Sol `r` en UA. En Marte (1,52 UA) llega el **43 %** de la luz de la Tierra [dato].
- `f_polvo` (en Marte), a partir del índice UV de REMS como indicador de polvo:
  Very_High/High → 1,0; Moderate → 0,85; Low → 0,45 [regla]. La tormenta de 2018 dejó el UV en "Low" ~60 soles [dato, REMS].
- `calefacción = k × (T_interior − T_mín_REMS)` [regla para `k`; la temperatura es dato].
- Tablero de energía: pocos "enchufes" compartidos entre sistemas. Los chicos arrastran fichas, sin números.

#### Aire y agua

| Variable | Valor | Tipo |
|---|---|---|
| O2 consumido | 0,82 kg por tripulante y día | [norma, BVAD] |
| Límite de CO2 | ≤ 3 mmHg (media de 1 h) | [norma, NASA-STD-3001 V2 6004] |
| Agua potable | 2,5 L por tripulante y día; +240 mL por hora de EVA | [norma, NASA-STD-3001] |
| Reciclaje de agua | 90–98 % según el estado del reciclador | [dato, ISS] |
| MOXIE (fábrica de O2 en Marte) | El real dio ≤ 12 g/h y 122 g en total. En el juego, una versión escalada que consume mucha energía | [dato] + [regla de escala] |

Si el depurador se descuida, el CO2 sube a una tasa fija [regla]. Por encima de 3 mmHg se disparan los dolores de cabeza.

#### Salud de la tripulación (por tripulante)

Combina **dosis**, **condición física** y **cansancio**. Se muestra como una sola barra con tres íconos.

**Dosis:**

```
dosis_mSv += tasa_real_μGy/h(fecha, lugar) × f_blindaje(ubicación) × Q(fase) × Δt_h / 1000
```

| Factor | Valores | Tipo |
|---|---|---|
| `tasa_real` | Serie de RadLab correspondiente a la fase y la fecha | [dato] |
| `Q` (dosis absorbida → equivalente) | Marte: ≈ 3,05 (0,64 mSv / 0,21 mGy, Hassler 2014). Crucero: ≈ 3,8 (Zeitlin 2013). Durante un SEP, Q menor (simplificar a 1,5) | [dato] / [regla] |
| `f_blindaje` | Exterior/EVA 1,0 · Hábitat o nave 0,6 · Refugio: de **0,2** con el escudo de agua lleno a **0,6** vacío, interpolado según el agua del escudo | [regla] |

Para niños: la dosis se muestra en **radiografías de tórax** (0,1 mSv) [dato] y como porcentaje del límite de carrera de **600 mSv** [norma].

Dato para el informe: un viaje de 7 meses suma ~390 mSv solo por el fondo (1,84 mSv/día, Zeitlin 2013) [dato].
Una misión real a Marte se acerca al límite actual de la NASA. Esa parte inevitable se muestra separada de la
parte que el jugador puede controlar.

**Condición física:** baja cada jornada sin ejercicio. Al llegar a Marte (0,38 g [dato]) trabajás más lento [regla]. Base: estudios OSDR de hueso y músculo.

**Cansancio:** sube con el trabajo y el CO2 alto; baja durmiendo. Ánimo: sube al hablar con la Tierra (estudio de aislamiento Mars-500, OSDR).

### 3.3 Tripulación

Tres tripulantes; el jugador cambia con **Tab**:

| Rol | Bonificación | Tareas preferidas |
|---|---|---|
| Ingeniera | Repara ×1,5 | Energía, depurador, fugas, corrección de trayectoria |
| Botánico | Invernadero ×1,5 | Comida, agua, plagas |
| Geóloga-médica | EVA y salud ×1,5 | Muestras, ejercicio, tratar el cansancio |

**Tripulantes automáticos.** La torpeza es un **síntoma de la gestión**, no una regla fija: una tripulación bien
cuidada rinde igual que el jugador.

- Siguen la rutina asignada en la planificación. **No reasignan energía, no toman decisiones de riesgo y no
  atienden tareas que no les asignaste.** Eso es lo que aporta el jugador al tomar el control: adaptarse a lo imprevisto.
- Su rendimiento depende de su propio estado:

  ```
  eficiencia = clamp(1 − 0,25·fatiga − 0,25·(1 − condición) − 0,15·[CO2 > 3 mmHg] − 0,10·(1 − ánimo), 0,5, 1)
  reacción   = 1 s + 5 s × (1 − eficiencia) / 0,5   → de 1 s (bien) a 6 s (agotado)
  ruta       = óptima si eficiencia ≥ 0,8; si no, la más corta a ciegas (puede ser peor)
  ```

  Los pesos son [regla]. Todos los términos están entre 0 y 1 y vienen de la condición física, el cansancio,
  el CO2 y el ánimo (3.2).
- **Ejemplos:** con CO2 bajo, sueño completo y llamadas a casa, una alarma recibe respuesta en ~1 s por la mejor ruta.
  Si sacrificaste el sueño para reparar algo, la misma alarma tarda hasta 6 s. Si la geóloga-médica no hizo ejercicio
  en el viaje, en Marte trabaja más lento.
- **La misma fórmula se aplica al personaje del jugador** en velocidad de trabajo y de movimiento, no en decisiones.
  Es justo: el jugador siente en su propio personaje lo que causó.
- **Base real:** el CO2 alto causa dolor de cabeza y fatiga (OCHMO-TB-004) [dato]. En el estudio de aislamiento
  Mars-500 se registraron cambios en el sueño y la actividad de la tripulación [verificar: Basner et al. 2013, PNAS].
- **La interfaz siempre muestra por qué** un tripulante está lento ("Ana está cansada: durmió 4 h"), para que la
  causa se vea y la frustración apunte a la decisión, no al juego.

### 3.4 Incidentes

Hay dos fuentes, que pasan por un mismo planificador de eventos:

1. **Línea de tiempo real:** eventos del dataset en la fecha simulada. Son fijos para una fecha dada.
2. **Rango seguro:** cada variable tiene un rango (norma o regla). Salir de él dispara un incidente. Más fallas aleatorias con semilla.

Formato de cada incidente (de él salen los datos y los tests):

```
id, fase, disparador, aviso_previo, efecto, respuesta_del_jugador, coste_de_cada_respuesta,
fuente (dataset + fecha | norma), explicación_para_niños (1 frase)
```

### 3.5 Falla en cascada: supervivencia extrema

Un medidor en cero **no termina la misión**. La base o la nave entra en un **modo de emergencia** que obliga a
canibalizar otro sistema. Así se ganan unas jornadas o soles para recuperarse, como en el Apolo 13: el juego no
castiga, te hace elegir qué sacrificar.

| Medidor en cero | Modo de emergencia (automático) | Sacrificios que puede elegir el jugador | Coste del sacrificio |
|---|---|---|---|
| **Energía** | **Soporte vital mínimo:** sin ciencia, calefacción reducida, luces del invernadero apagadas. La salud baja cada hora | Mandar a alguien a **limpiar los paneles** (EVA con polvo y dosis) · Apagar MOXIE · Desconectar el refugio | Dosis y cansancio · Baja el O2 · El refugio pierde eficacia |
| **Aire y agua** | Racionamiento: cansancio acelerado | **Beber el escudo de agua** del refugio · Usar energía extra en MOXIE o el reciclador | El refugio pasa de 0,2 a 0,6 (3.2): **mucha más dosis en la próxima tormenta** · Menos energía |
| **Salud** (de un tripulante) | Queda **en reposo** en la enfermería: no trabaja | La geóloga-médica lo atiende (deja su tarea) · Reducir rutinas de los demás | Menos ciencia · Más cansancio para el resto |

- Cada emergencia se anuncia con una explicación de una frase y muestra **el contador de tiempo de margen** antes de
  que empeore ("energía de emergencia: 2 soles").
- Datos reales de apoyo:
  - Los paneles de Spirit y Opportunity se limpiaban con ráfagas de viento ("eventos de limpieza"), y el polvo de 2018 apagó a Opportunity [dato].
  - El agua como blindaje es un concepto real de diseño de naves [dato].
  - El Apolo 13 sobrevivió reutilizando sistemas del módulo lunar [dato].

**Punto de no retorno.** Solo si **toda** la tripulación queda en reposo a la vez, o si dos medidores llevan
agotados más tiempo que su margen, el Control de Misión declara la emergencia final. La misión termina con el informe,
que muestra **qué cadena de decisiones** llevó hasta ahí. Ningún tripulante muere: el lenguaje es "misión suspendida,
la tripulación está a salvo en el refugio esperando rescate" [regla, pensada para el público de 7–12 años].

### 3.6 Cómo se comunica el riesgo

- **Semáforo y "dados de riesgo"** (de 1 a 3 dados) en lugar de porcentajes.
- **Pronósticos con incertidumbre:** "la tormenta llega entre mañana y pasado". Las predicciones reales de llegada
  de CME tienen errores de horas [verificar: magnitud típica en el CME Scoreboard de CCMC].
- **Regla fija:** cada opción muestra su coste antes de elegirla. Ninguna es gratis.

## 4. Fases en detalle

### Fase 1 — Preparación y despegue

1. **Carga (simplificada).** Se elige uno de tres perfiles [regla]:

   | Perfil | Agua (bebida + blindaje) | Repuestos | Efecto |
   |---|---|---|---|
   | Escudo de agua | +++ | + | Menos dosis en el viaje; las reparaciones se complican |
   | Taller | + | +++ | Más dosis; las fallas se arreglan rápido |
   | Equilibrado | ++ | ++ | Sin extremos |

   El agua como blindaje es un concepto real de diseño de naves [dato: estudios de blindaje con agua de la NASA].

2. **Cuenta regresiva Go / No-Go.** Se recorre la nave y se confirma cada estación. Funciona como tutorial de movimiento y de la tripulación.
3. **Ascenso.** Acciones en el momento justo: separación de etapas y apagado de motores. Un error cuesta un poco de combustible y obliga a una corrección extra en el viaje; no termina la partida.
4. **Cinturones de Van Allen.** Primera dosis, con la curva de Artemis I: pico de **14 393 μGy/h** el 16/11/2022 (EAD) [dato, RadLab]. Sirve de tutorial del medidor de salud.

### Fase 2 — Viaje

Mapa top-down de la nave: módulo de mando, ejercicio, depurador, reciclador, refugio de agua y radio.

| Tarea | Si no se hace | Base |
|---|---|---|
| Ejercicio (1 por tripulante y jornada) | Baja la condición física | [dato] OSDR; la ISS exige ~2 h/día |
| Depurador de CO2 | CO2 > 3 mmHg → cansancio | [norma] |
| Reciclador de agua | Se gastan agua y blindaje | [dato] ISS |
| Corrección de trayectoria (minijuego de puntería) | Aterrizaje más difícil | [dato] Curiosity y Perseverance hicieron varias |
| Llamada a casa | Baja el ánimo | Demora real según la distancia Tierra–Marte de la fecha (de segundos a ~20 min) |

**Incidentes del viaje:**

| Incidente | Disparador | Respuesta | Fuente |
|---|---|---|---|
| Aviso de tormenta solar | CME o llamarada X en DONKI en la fecha | Preparar el refugio y cargar baterías | [dato] DONKI |
| **Tormenta de radiación** | SEP en la fecha, o pico en BioSentinel | Todos al refugio de agua; la tripulación descansada llega en ~1 s, la agotada tarda más (3.3) | [dato] DONKI + RadLab |
| Micrometeorito | Aleatorio con semilla | Encontrar y tapar la fuga | [regla] |
| Depurador averiado | Rango seguro o falla aleatoria | Repararlo (la ingeniera es más rápida) | [norma] |
| Aislamiento | Muchas jornadas sin llamada | Llamada a casa | [dato] Mars-500 |

### Fase 3 — Aterrizaje (básico)

Cuatro etapas con un control simple cada una:
1. Entrada a la atmósfera (escudo térmico a ~2000 °C).
2. Paracaídas a ~Mach 1,7.
3. Separación del escudo.
4. Motores de descenso.

Son los valores de Curiosity y Perseverance [verificar las cifras exactas].

- **Dificultad:** depende de la precisión de la trayectoria, la carga y el polvo real del día.
- **Resultado:** la distancia a la base. Más distancia → más salidas al exterior → más polvo y dosis. Nunca hay "choque" ni muerte.
- **Momento educativo:** "La señal del aterrizaje tarda X minutos en llegar a la Tierra. Cuando se enteren, ya habrás aterrizado."

### Fase 4 — Estancia en Marte

Base en el cráter Gale. Curiosity es el vecino robot que reporta el dato real de cada día.

| Ciclo del sol | Qué pasa |
|---|---|
| Mañana (en pausa) | Pronóstico real (UV/polvo, temperatura), rutinas y tablero de energía |
| Día | Tareas, EVA a puntos de muestreo, cambio de tripulante |
| Noche | Frío real de REMS → calefacción; resumen |

| Incidente | Disparador | Respuesta | Fuente |
|---|---|---|---|
| Tormenta de polvo | UV = Low en REMS | Repartir energía: calor, aire o ciencia; si la energía llega a cero, soporte vital mínimo y limpieza de paneles (3.5) | [dato] REMS (2018) |
| Noche extrema | Mínima real muy baja | Más calefacción o una zona apagada | [dato] REMS |
| **Tormenta de radiación** | Pico real en RAD (20/05/2024) | Refugio; suspender la EVA | [dato] RadLab |
| Conjunción solar | Fechas reales en que el Sol tapa a Marte | Dos semanas sin Control de Misión | [verificar fechas: ¿nov. 2023?] |
| CO2 alto | Depurador o MOXIE descuidados | Reparar o reasignar energía | [norma] |
| Plaga en el invernadero | Poco cuidado | Botánico | [dato] OSD-177 |
| Polvo en los sellos | Muchas EVA | Mantenimiento de la esclusa | [regla] |

## 5. Objetivos, puntuación y final

- **Objetivos:** volver con la tripulación sana, más **ciencia** (muestras en el mapa, experimentos en el viaje).
- **3 estrellas:** tripulación sana · dosis controlable baja · ciencia mínima.
- **Logros:** por ejemplo "Refugio a tiempo", "Como Opportunity: sobreviviste al polvo", "Cero radiografías extra".
- **Informe de misión:** tus decisiones superpuestas a las gráficas reales ("tu tripulación recibió X; Curiosity midió esto el mismo día"), con enlaces a cada fuente.
- **Sin final temprano por un medidor en cero:** se entra en falla en cascada (3.5). La misión solo se suspende en el punto de no retorno, y el informe muestra la cadena de decisiones que llevó hasta ahí.

## 6. Datasets por mecánica

| Mecánica | Archivo |
|---|---|
| Van Allen | `datasets/raw/radlab/daily/moon-orbit-lro-crater.csv` (instrumentos `Artemis-I-*`) |
| Dosis en el viaje | `raw/radlab/daily/deep-space-biosentinel.csv`, `mars-cruise-orbit-tgo-liulin.csv` |
| Tormenta en el viaje | `raw/radlab/events/2024-05-gannon-storm_heliocentric.csv`, `raw/donki/sep.json`, `flr.json`, `cme.json` |
| Textos del Control de Misión | `raw/donki/notifications.json` (adaptados) |
| Dosis en Marte | `raw/radlab/daily/mars-surface-curiosity-rad.csv`, `raw/radlab/events/2024-05-20-mars-sep_curiosity.csv` |
| Polvo y frío | `raw/mars-weather/curiosity-rems.json` |
| Consumos y límites | `raw/references/*.pdf`, `curated/life-support-bvad.json`, `curated/radiation-dose.json` |
| "¿Sabías que…?" | `raw/osdr/*.json` → `curated/osdr-facts.json` |

## 7. Cambios respecto al prototipo actual

- El prototipo usa una **base lunar** y el **apagón de radio** por llamaradas. En Marte la comunicación pasa por la Red de Espacio Profundo (DSN), que no se ve afectada como la radio terrestre. En la campaña, la restricción de comunicación sale de la **demora por distancia** y de la **conjunción solar**.
- Los 4 recursos más la dosis del prototipo pasan a **3 medidores**.
- Las decisiones con las teclas 1/2/3 se pasan al mouse, porque Tab y los números se usan para la tripulación.
- El prototipo termina la partida cuando un recurso se agota: se reemplaza por la falla en cascada (3.5).

## 8. Pendientes de verificar

- [ ] Fechas de las conjunciones solares de Marte (moratoria de comandos de la NASA) en los rangos de datos.
- [ ] Ventana de lanzamiento a Marte 2026 (fechas reales, posible gancho de "desafío actual").
- [ ] Simulaciones WSA-ENLIL de DONKI con impactos en Marte (para eventos en superficie fuera de RAD).
- [ ] Error típico de las predicciones de llegada de CME (CCMC CME Scoreboard).
- [ ] Máximos diarios sospechosos de BioSentinel (p. ej. 8556 μGy/h el 08/06/2024) y mínimas < −90 °C de REMS (40 soles).
- [ ] Cifras del aterrizaje (velocidad de entrada, temperatura del escudo, Mach del paracaídas).
- [ ] Factores Q por fase: confirmar en Hassler 2014 y Zeitlin 2013.
- [ ] Antelación real entre detección en DONKI y pico en RadLab para los eventos de la campaña (p. ej. mayo de 2024).
- [ ] Hallazgos de Mars-500 sobre sueño y actividad (Basner et al. 2013, PNAS).
- [ ] Pesos de la fórmula de eficiencia y márgenes de la falla en cascada: ajustarlos con pruebas de juego con niños.

## 9. Orden de construcción

1. **Núcleo compartido:** reloj de misión por fechas reales con avance rápido y frenado por avisos, los 3 medidores con sus fórmulas, la falla en cascada, el planificador de incidentes (línea de tiempo + rangos seguros) y la tripulación automática con eficiencia según su estado. Todo en `src/core/`, con tests.
2. **Procesamiento de datos:** de `datasets/raw/` a series por fase y fecha (`src/data/`).
3. **Fase 2, viaje:** mapa de la nave, tareas, tormenta con refugio.
4. **Fase 4, estancia:** adaptar el mapa actual a Gale y agregar polvo, frío y MOXIE.
5. **Fase 1, despegue:** carga, Go / No-Go, ascenso, Van Allen.
6. **Fase 3, aterrizaje.**
7. **Informe de misión** con gráficas reales.

## 10. Historial de revisiones

### v2 — revisión según [`Transcripcion_simulador_marciano.md`](Transcripcion_simulador_marciano.md)

| Problema señalado | Cambio | Dónde |
|---|---|---|
| Terminar la misión cuando un medidor llega a cero es un "Game Over disfrazado" que corta la recuperación | **Falla en cascada**: modos de emergencia, sacrificios con coste (beber el escudo de agua, limpiar paneles) y un punto de no retorno solo cuando todo colapsa | 1, 3.5, 4, 5 |
| El salto entre jornadas del viaje hace que las crisis parezcan una ventana de error | **Avance rápido interactivo** que se frena con avisos reales de DONKI, se tiñe de amarillo y deja al jugador prepararse antes del impacto | 2.1, 3.1 |
| Tripulantes al 70 % y con 3–6 s de demora fijos castigan por algo que el jugador no controla | La **eficiencia y la demora dependen del estado** (fatiga, condición física, CO2, ánimo): de 100 % y 1 s a 50 % y 6 s, con la causa siempre visible | 3.3, 4 |

Ajustes propios sobre las sugerencias:
- **"Estática de radio" pasó a ser un monitor de partículas.** Las llamaradas afectan la radio terrestre de onda corta, no la Red de Espacio Profundo, así que la estática daría una idea falsa.
- **Las 48 h de aviso fijas pasaron a ser la antelación real del evento** según los datos, con las 48 h como respaldo cuando no hay detección previa.
- **La fórmula de eficiencia también se aplica al personaje del jugador** (velocidad, no decisiones), para que la regla sea igual para todos.
- **"Te matas tú mismo" pasó a ser "misión suspendida, tripulación a salvo"**, por el público de 7–12 años.

### v1 — borrador inicial

Arco de 4 fases, 3 medidores, campaña 2024 y modo libre, carga simplificada, tripulación automática con rendimiento fijo.


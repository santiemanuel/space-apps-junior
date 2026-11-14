# Documento de diseño — Misión a Marte

Estado: **borrador para validar** antes de programar. Cada número indica su tipo:

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
4. **Fallar enseña.** No hay "Game Over" humillante: la misión termina con un informe que compara tus decisiones con lo que pasó de verdad.
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

El tiempo entre jornadas de viaje **sí transcurre**: se aplican los consumos y la dosis de los días saltados
(ver 3.1). Una misión corta juega menos momentos, pero no hace el viaje más corto.

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
- **Viaje:** una jornada ≈ 2 min. Entre jornadas hay un **salto** ("Día 47 de viaje") que aplica de una vez
  los consumos y la dosis de los días saltados, con los valores reales del dataset para esas fechas.
- El reloj de simulación avanza en **horas de misión reales**. Los datos se consultan por fecha, así que
  la compresión cambia la velocidad de juego, nunca los valores.

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
| `f_blindaje` | Exterior/EVA 1,0 · Hábitat o nave 0,6 · Refugio 0,2 · +agua extra según la carga | [regla] |

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

**Tripulantes automáticos** [regla]:
- Siguen la rutina asignada en la planificación.
- Trabajan al **70 %** de la velocidad del jugador.
- No reasignan energía ni toman decisiones de riesgo.
- Ante una alarma reaccionan con **3–6 s de demora** y van por el camino más corto, no el más inteligente.

El valor de jugar está en **estar donde importa en el momento justo**.

### 3.4 Incidentes

Hay dos fuentes, que pasan por un mismo planificador de eventos:

1. **Línea de tiempo real:** eventos del dataset en la fecha simulada. Son fijos para una fecha dada.
2. **Rango seguro:** cada variable tiene un rango (norma o regla). Salir de él dispara un incidente. Más fallas aleatorias con semilla.

Formato de cada incidente (de él salen los datos y los tests):

```
id, fase, disparador, aviso_previo, efecto, respuesta_del_jugador, coste_de_cada_respuesta,
fuente (dataset + fecha | norma), explicación_para_niños (1 frase)
```

### 3.5 Cómo se comunica el riesgo

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
| **Tormenta de radiación** | SEP en la fecha, o pico en BioSentinel | Todos al refugio de agua; los automáticos llegan tarde | [dato] DONKI + RadLab |
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
| Tormenta de polvo | UV = Low en REMS | Repartir energía: calor, aire o ciencia | [dato] REMS (2018) |
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
- **Final temprano:** si un medidor llega a cero, el Control de Misión ordena volver o refugiarse y la misión termina con el informe. Se presenta como una decisión de seguridad, no como un castigo.

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

## 8. Pendientes de verificar

- [ ] Fechas de las conjunciones solares de Marte (moratoria de comandos de la NASA) en los rangos de datos.
- [ ] Ventana de lanzamiento a Marte 2026 (fechas reales, posible gancho de "desafío actual").
- [ ] Simulaciones WSA-ENLIL de DONKI con impactos en Marte (para eventos en superficie fuera de RAD).
- [ ] Error típico de las predicciones de llegada de CME (CCMC CME Scoreboard).
- [ ] Máximos diarios sospechosos de BioSentinel (p. ej. 8556 μGy/h el 08/06/2024) y mínimas < −90 °C de REMS (40 soles).
- [ ] Cifras del aterrizaje (velocidad de entrada, temperatura del escudo, Mach del paracaídas).
- [ ] Factores Q por fase: confirmar en Hassler 2014 y Zeitlin 2013.

## 9. Orden de construcción

1. **Núcleo compartido:** reloj de misión por fechas reales, los 3 medidores con sus fórmulas, el planificador de incidentes (línea de tiempo + rangos seguros) y la tripulación automática. Todo en `src/core/`, con tests.
2. **Procesamiento de datos:** de `datasets/raw/` a series por fase y fecha (`src/data/`).
3. **Fase 2, viaje:** mapa de la nave, tareas, tormenta con refugio.
4. **Fase 4, estancia:** adaptar el mapa actual a Gale y agregar polvo, frío y MOXIE.
5. **Fase 1, despegue:** carga, Go / No-Go, ascenso, Van Allen.
6. **Fase 3, aterrizaje.**
7. **Informe de misión** con gráficas reales.

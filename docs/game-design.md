# Documento de diseño — Misión a Marte

Estado: **borrador v4 para validar** antes de programar (ver el historial al final). Cada número indica su tipo:

- **[dato]**: medido o publicado por la NASA u otra agencia, con su fuente.
- **[norma]**: requisito de NASA-STD-3001 o valor de diseño del BVAD.
- **[regla]**: decisión de juego (equilibrio, simplificación). Se puede ajustar libremente, pero se muestra como estimación, nunca como dato.
- **[verificar]**: hay que confirmarlo antes de usarlo.

---

## 1. Visión

> Llevá a tu tripulación de la Tierra a Marte y de vuelta a casa sana, con las muestras de Marte a bordo,
> mientras el clima espacial **real** pone a prueba cada decisión.

Pilares, sacados del desafío *Junior Astronaut Mission Trainer*:

1. **Ninguna decisión es gratis.** Toda elección se paga en energía, soporte vital o salud.
2. **Datos reales visibles.** El jugador ve qué dato de la NASA causó cada evento, con su fecha y su fuente (ver 3.8).
3. **Pocos sistemas.** Tres medidores, no seis. Además, la complejidad crece de partida en partida (ver 6).
4. **Fallar enseña.** No hay "Game Over" humillante. Cuando un sistema cae, el juego no termina: obliga a **sacrificar otro** para resistir (ver 3.5). El informe final compara tus decisiones con lo que pasó de verdad.
5. **Rejugable.** Distintas fechas reales, cargas, fallas, objetivos y desbloqueos.
6. **Mecánica antes que gráficos.** Un juego simple que enseña una restricción real vale más que uno bonito que no.

Público: 7–12 años (objetivo principal: 10). Bilingüe **español e inglés** desde el inicio (ver 8).
Plataforma: **PC con teclado y mouse**.

## 2. Arco de la misión

| Fase | Amenaza principal | Lo que se aprende | Dataset principal |
|---|---|---|---|
| 1. Preparación y despegue | Carga limitada; cinturones de Van Allen | Todo lo que llevás pesa; la Tierra nos protege | RadLab: Artemis I (EAD/HERA) |
| 2. Viaje de ida | **Radiación** (sin atmósfera ni campo magnético) | Tormentas solares, refugio, ejercicio, aislamiento | RadLab: BioSentinel, TGO en crucero; DONKI |
| 3. Aterrizaje en Marte | Los "7 minutos de terror" | Estamos solos: la señal tarda más que el aterrizaje | Secuencia EDL de Curiosity/Perseverance |
| 4. Estancia en Marte | **Polvo y frío** | La atmósfera protege de la radiación pero tapa el sol | REMS y RAD de Curiosity (cráter Gale) |
| 5. Despegue de Marte | Masa: muestras contra suministros | Lo que te llevás a casa también pesa | Reglas de carga (4.5) |
| 6. Viaje de vuelta | Radiación con una nave y una tripulación gastadas | Las decisiones de la ida se pagan en la vuelta | RadLab: BioSentinel; DONKI |
| 7. Reentrada a la Tierra | Calor y precisión | Volver también es difícil | Secuencia de reentrada de cápsulas tripuladas [verificar cifras] |

El contraste entre fases es medible: durante la tormenta de mayo de 2024, el espacio profundo registró
**653 μGy/h** (BioSentinel) y la superficie de Marte **304 μGy/h** (Curiosity) [dato, RadLab]. Son instrumentos
distintos, así que la comparación es orientativa.

### 2.1 Modos

| Modo | Fechas | Para qué |
|---|---|---|
| **Campaña "Historia real 2024"** | Un calendario real único (ver 2.2) | Credibilidad: todo pasó de verdad, en orden |
| **Modo libre** | Cada fase toma un período real distinto; la pantalla siempre muestra la fecha del dato | Rejugabilidad |

Duración elegible (con guardado en cualquier momento, ver 3.9):

| | Despegue | Ida (jornadas) | Aterrizaje | Marte (soles jugados) | Despegue de Marte | Vuelta (jornadas) | Reentrada | Total aprox. |
|---|---|---|---|---|---|---|---|---|
| **Corta** | ~4 min | 4 | ~2 min | 10 | ~2 min | 2 | ~2 min | ~35 min |
| **Larga** | ~6 min | 8 | ~2 min | 19–30 | ~3 min | 4 | ~2 min | ~75 min |

- La **vuelta es más corta en jornadas jugables** que la ida, pero la nave y la tripulación llegan gastadas (ver 4.6).
- El tiempo entre jornadas y entre soles **sí transcurre**, en avance rápido (3.1), con los consumos y la dosis
  reales de esos días. Una misión corta juega menos jornadas, pero no acorta el viaje.
- **Ruta: nave de propulsión nuclear térmica (NTP), con tramos de 4 meses y estancia corta.**
  - Es la arquitectura que la NASA estudia para misiones tripuladas: con propulsión nuclear se acortan los viajes y
    se permiten **estancias cortas en la superficie**, en lugar de esperar más de un año en Marte la alineación de
    los planetas para volver ([NASA: *Nuclear Propulsion Could Help Get Humans to Mars Faster*](https://www.nasa.gov/solar-system/nuclear-propulsion-could-help-get-humans-to-mars-faster/)) [dato].
  - Los estudios hablan de tramos de 2–3 meses con reactores grandes; el juego usa **4 meses por tramo** [regla]
    porque es lo que calza con los datos de la campaña 2024.
  - El reactor solo funciona en los encendidos de motor. La energía del hábitat sigue viniendo de los **paneles
    solares**, así que la mecánica de la luz que cae con la distancia (3.2) se mantiene [regla].
- **Por qué importa la ruta:** con la ruta química clásica (~7 meses por tramo) el fondo de radiación de ida y vuelta
  sumaría ~770 mSv (1,84 mSv/día, Zeitlin 2013), más que el límite de carrera de 600 mSv sin que el jugador pudiera
  evitarlo. Con tramos de 4 meses suma ~440 mSv: el límite queda cerca y el blindaje y las tormentas deciden [dato + regla].
  El informe cuenta **esa misma razón** como la que hace que la NASA estudie la propulsión nuclear.
- **Simplificación de fechas:** las fechas de la campaña se eligen por los datos disponibles, no por las ventanas de
  lanzamiento reales (cada ~26 meses). Se aclara en el informe [regla].

### 2.2 Calendario de la campaña 2024

Restricción de datos: RAD de Curiosity llega hasta el **03/06/2024** en RadLab, y BioSentinel cubre 2024 completo.

| Fase | Fechas reales | Eventos reales que entran |
|---|---|---|
| Despegue (nave nuclear, tramo de 4 meses) | 15/01/2024 | Cruce de Van Allen: perfil de Artemis I (16/11/2022), indicado como "medido por Artemis I" |
| Viaje de ida | 15/01 → 14/05/2024 | Tormenta solar del 8–14 de mayo (llamaradas X, SEP) en espacio profundo |
| Aterrizaje | 15/05/2024 | Clima real de Gale ese día |
| Marte | 15/05 → 03/06/2024 (19 soles) | **Evento SEP del 20/05/2024** en superficie |
| Despegue de Marte | 04/06/2024 | — |
| Viaje de vuelta | 04/06 → 10/10/2024 | Período muy activo: 19 llamaradas X, entre ellas **X9.0 del 03/10/2024**, la mayor de 2024; eventos SEP el 08/06, el 09/09 y el **09/10/2024** [dato, DONKI] |
| Reentrada | 10/10/2024 | La tormenta de octubre como clímax final |

En el modo libre, los viajes usan ventanas de BioSentinel (2022-11 → 2025-11) o de TGO en crucero
(04 → 09/2016), y la estancia usa ventanas de Curiosity (2015 → 06/2024) donde RAD y REMS coinciden.

## 3. Sistemas compartidos

### 3.1 Tiempo

- **Viaje (ida y vuelta):** una jornada jugada ≈ 2 min.
- **Marte:** un sol jugado ≈ 90 s.
- **Entre jornadas y entre soles**, el calendario corre en **avance rápido interactivo**, no con un salto:
  - Los medidores se animan día a día; nunca saltan de golpe del día 10 al 47.
  - La tripulación sigue sus rutinas sola.
  - El jugador puede **detener el avance** cuando quiera. Al detenerlo aparece la **pantalla de planificación**
    (rutinas y tablero de energía), en pausa.
- **El avance se frena solo** ante cada aviso del planificador de incidentes (3.4), en tres niveles:

  | Nivel | Disparador | Velocidad | Señales para el jugador |
  |---|---|---|---|
  | Calma | Sin avisos | Rápida (~1 día cada 2 s) [regla] | Interfaz normal |
  | **Alerta** | En el viaje: detección real en DONKI (CME, llamarada M/X, alerta de `notifications`). En Marte: el UV de REMS empieza a bajar (polvo), se anuncia una noche extrema o hay un aviso de radiación | Lenta | Interfaz teñida de amarillo; texto de la alerta adaptado; el **monitor de partículas** (clics tipo contador Geiger) acelera; ligeras fluctuaciones de los paneles |
  | **Impacto** | Inicio real del pico de dosis en RadLab, o el sol de polvo o frío | Tiempo normal | Alarma y orden de refugio o de reparto de energía |

- **Antelación del aviso:** se da con la **diferencia real** entre la detección en DONKI y el pico en RadLab para
  ese evento. Si no hay evento detectado que lo preceda, se usan **48 h simuladas** [regla].
- El reloj de simulación avanza en **horas de misión reales**. Los datos se consultan por fecha, así que
  la compresión cambia la velocidad de juego, nunca los valores.

> Nota de rigor: los avisos de DONKI se refieren al entorno de la Tierra. La nave está en otra posición, así que
> la antelación medida es una aproximación y se presenta como "pronóstico" (3.6).
> Por eso el indicador es un **monitor de partículas** y no estática de radio: las llamaradas cortan la radio
> terrestre de onda corta, pero no la Red de Espacio Profundo (DSN) que usan las naves.

### 3.2 Los tres medidores

Viajan entre las siete fases. Todos los consumos se calculan para **4 tripulantes**.

#### Energía

```
generación = P_paneles × (1 / r²) × f_polvo × f_luz
consumo    = soporte vital + calefacción + sistemas asignados (blindaje, MOXIE, invernadero, radio)
batería   += (generación − consumo) × Δt, con tope de capacidad
```

- `1/r²`: la luz solar cae con la distancia al Sol `r` en UA. En Marte (1,52 UA) llega el **43 %** de la luz de la Tierra [dato].
- `f_polvo` (en Marte), a partir del índice UV de REMS como indicador de polvo:
  Very_High/High → 1,0; Moderate → 0,85; Low → 0,45 [regla]. La tormenta de 2018 dejó el UV en "Low" ~60 soles [dato, REMS].
- `calefacción = k × (T_interior − T_mín_REMS)` [regla para `k`; la temperatura es dato].
- **Tablero de energía:** pocos "enchufes" compartidos entre sistemas. Se arrastran fichas con el mouse, sin números.

#### Soporte vital (aire y agua)

| Variable | Valor | Tipo |
|---|---|---|
| O2 consumido | 0,82 kg por tripulante y día | [norma, BVAD] |
| Límite de CO2 | ≤ 3 mmHg (media de 1 h) | [norma, NASA-STD-3001 V2 6004] |
| Agua potable | 2,5 L por tripulante y día; +240 mL por hora de EVA | [norma, NASA-STD-3001] |
| Reciclaje de agua | 90–98 % según el estado del reciclador | [dato, ISS] |
| MOXIE (fábrica de O2 en Marte) | El real dio ≤ 12 g/h y 122 g en total. En el juego, una versión escalada que consume mucha energía | [dato] + [regla de escala] |

Si el depurador se descuida, el CO2 sube a una tasa fija [regla]. Por encima de 3 mmHg se disparan los dolores de cabeza.

#### Salud (por tripulante)

Combina **dosis**, **condición física**, **nutrición** y **cansancio**. Se muestra como una barra con cuatro íconos.

**Dosis:**

```
dosis_mSv += tasa_real_μGy/h(fecha, lugar) × f_blindaje(ubicación) × Q(fase) × Δt_h / 1000
```

| Factor | Valores | Tipo |
|---|---|---|
| `tasa_real` | Serie de RadLab correspondiente a la fase y la fecha, depurada según 3.2.1 | [dato] |
| `Q` (dosis absorbida → equivalente) | Marte: ≈ 3,05 (0,64 mSv / 0,21 mGy, Hassler 2014). Crucero: ≈ 3,8 (Zeitlin 2013). Durante un SEP, Q menor (simplificar a 1,5) | [dato] / [regla] |
| `f_blindaje` | Exterior/EVA 1,0 · Hábitat o nave 0,6 · Refugio: de **0,2** con el escudo de agua lleno a **0,6** vacío, interpolado según el agua del escudo | [regla] |

##### 3.2.1 Depuración de BioSentinel

Algunos días de BioSentinel tienen medias de miles de μGy/h (2513 el 08/06/2024, 2194 el 09/10/2024, 1204 el
23/03/2024), muy por encima de la tormenta de mayo de 2024 (pico de 653 μGy/h). **Los 11 días con media por encima de 650 μGy/h
coinciden (±1 día) con eventos SEP de DONKI**, así que el momento de la tormenta es real, pero la intensidad no es confiable (posible
saturación o artefacto del instrumento).

**Regla simple:** la serie diaria de BioSentinel se **limita a 650 μGy/h** [regla]. Es el percentil 99 de las medias
diarias y coincide con el pico de mayo de 2024.
- La fecha y la duración de cada tormenta se mantienen; solo se recorta la altura del pico.
- Cuando se recorta un valor, la tarjeta de datos lo dice: "BioSentinel registró un valor extremo que podría ser un
  error del instrumento; el juego usa un tope".

Para niños: la dosis se muestra en **radiografías de tórax** (0,1 mSv) [dato] y como porcentaje del límite de carrera de **600 mSv** [norma].
La parte inevitable del viaje se muestra separada de la parte que el jugador controla (2.1).

**Nutrición (sin medidor propio):** la comida es un **stock del inventario**, no un medidor.
- Cada tripulante necesita **3035 kcal por día** [norma, NASA-STD-3001 V2 7003], unos 1,8 kg de comida envasada [norma, BVAD].
- El stock viene de la carga inicial y, en Marte, del invernadero.
- **Comer menos** (racionar) baja la condición física y el ánimo [regla]. Racionar es un sacrificio posible de la falla en cascada (3.5).

**Condición física:** baja cada jornada sin ejercicio. Al llegar a Marte (0,38 g [dato]) y de vuelta a la Tierra (1 g) trabajás más lento [regla]. Base: estudios OSDR de hueso y músculo.

**Cansancio y ánimo:** el cansancio sube con el trabajo y el CO2 alto y baja durmiendo. El ánimo sube al hablar con la Tierra (estudio de aislamiento Mars-500, OSDR).

### 3.3 Tripulación

Cuatro tripulantes. El jugador empieza como la **comandante** y cambia de tripulante con **Tab**:

| Rol | Velocidad de trabajo | Tareas preferidas |
|---|---|---|
| **Comandante** | ×1,0 en **todas** las tareas | Cualquiera; cubre lo que falte |
| Ingeniera | ×1,5 en lo suyo, ×1,0 en el resto | Energía, depurador, fugas, corrección de trayectoria |
| Botánico | ×1,5 en lo suyo | Comida, invernadero, agua, plagas |
| Geóloga-médica | ×1,5 en lo suyo | Muestras, ejercicio, enfermería |

La velocidad base se multiplica por la eficiencia de cada uno.

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

  Los pesos son [regla]. Todos los términos están entre 0 y 1 y vienen de la salud (3.2) y del CO2.
- **Ejemplos:** con CO2 bajo, sueño completo y llamadas a casa, una alarma recibe respuesta en ~1 s por la mejor ruta.
  Si sacrificaste el sueño para reparar algo, la misma alarma tarda hasta 6 s. Si la geóloga-médica no hizo ejercicio
  en el viaje, en Marte trabaja más lento.
- **La misma fórmula se aplica al personaje del jugador** en velocidad de trabajo y de movimiento, no en decisiones.
- **Base real:** el CO2 alto causa dolor de cabeza y fatiga (OCHMO-TB-004) [dato]. En el estudio Mars-500 se
  registraron cambios en el sueño y la actividad de la tripulación [verificar: Basner et al. 2013, PNAS].
- **La interfaz siempre muestra por qué** un tripulante está lento ("Ana está cansada: durmió 4 h").

**Modo ayuda (opcional, se activa en el menú)** [regla]:
- Los automáticos **reaccionan solos a las crisis**: van al refugio con la alarma, aunque no estuviera en su rutina.
- El Control de Misión ofrece **pistas sin que se las pidas**, sin demora.
- No cambia los datos ni los costes de las decisiones: solo reduce la carga de gestión.

### 3.4 Incidentes

Hay dos fuentes, que pasan por un mismo planificador de eventos:

1. **Línea de tiempo real:** eventos del dataset en la fecha simulada. Son fijos para una fecha dada.
2. **Rango seguro:** cada variable tiene un rango (norma o regla). Salir de él dispara un incidente. Más fallas aleatorias con semilla.

Qué incidentes pueden aparecer depende del **nivel de desbloqueo** del jugador (6).

Formato de cada incidente (de él salen los datos, los textos traducibles y los tests):

```
id, fase, nivel_desbloqueo, disparador, aviso_previo, efecto, respuesta_del_jugador, coste_de_cada_respuesta,
fuente (dataset + fecha | norma), clave_texto_niños (traducible)
```

### 3.5 Falla en cascada: supervivencia extrema

Un medidor en cero **no termina la misión**. La base o la nave entra en un **modo de emergencia** que obliga a
canibalizar otro sistema. Así se ganan unas jornadas o soles para recuperarse, como en el Apolo 13.

| Medidor en cero | Modo de emergencia (automático) | Sacrificios que puede elegir el jugador | Coste del sacrificio |
|---|---|---|---|
| **Energía** | **Soporte vital mínimo:** sin ciencia, calefacción reducida, luces del invernadero apagadas. La salud baja cada hora | Mandar a alguien a **limpiar los paneles** (EVA con polvo y dosis) · Apagar MOXIE · Desconectar el refugio | Dosis y cansancio · Baja el O2 · El refugio pierde eficacia |
| **Soporte vital** | Racionamiento de aire y agua: cansancio acelerado | **Beber el escudo de agua** del refugio · Usar energía extra en MOXIE o el reciclador | El refugio pasa de 0,2 a 0,6 (3.2): **mucha más dosis en la próxima tormenta** · Menos energía |
| **Salud** (de un tripulante) | Queda **en reposo** en la enfermería: no trabaja | La geóloga-médica lo atiende (deja su tarea) · Reducir rutinas de los demás · Darle raciones extra | Menos ciencia · Más cansancio para el resto · Menos comida |
| (Comida agotada, del inventario) | Raciones mínimas: baja la condición física de todos | En Marte: priorizar el invernadero · En la vuelta: **dejar muestras para llevar más comida** (decisión de 4.5) | Energía · Ciencia |

- Cada emergencia se anuncia con una explicación de una frase y muestra **cuánto margen queda** ("energía de emergencia: 2 soles").
- Datos reales de apoyo:
  - Los paneles de Spirit y Opportunity se limpiaban con ráfagas de viento ("eventos de limpieza"), y el polvo de 2018 apagó a Opportunity [dato].
  - El agua como blindaje es un concepto real de diseño de naves [dato].
  - El Apolo 13 sobrevivió reutilizando sistemas del módulo lunar [dato].

**Punto de no retorno.** Solo si **toda** la tripulación queda en reposo a la vez, o si dos medidores llevan agotados
más tiempo que su margen, el Control de Misión declara la emergencia final. La misión termina con el informe, que
muestra **qué cadena de decisiones** llevó hasta ahí. Ningún tripulante muere: el lenguaje es "misión suspendida,
la tripulación está a salvo en el refugio esperando rescate" [regla, pensada para el público de 7–12 años].

### 3.6 Cómo se comunica el riesgo

- **Semáforo** (verde, amarillo, rojo) en cada opción y cada pronóstico. Sin porcentajes en pantalla.
- **Pronósticos con incertidumbre:** "la tormenta llega entre mañana y pasado". Las predicciones reales de llegada
  de CME tienen errores de horas [verificar: magnitud típica en el CME Scoreboard de CCMC].
- **Regla fija:** cada opción muestra su coste antes de elegirla. Ninguna es gratis.

### 3.7 Control de Misión

Ofrece tres cosas, y todo lo que se le pide llega con la **demora real por distancia** de la fecha simulada:
de segundos al principio del viaje a ~20 min en Marte, mostrada con una cuenta regresiva.

| Tipo | Cómo funciona | Coste |
|---|---|---|
| **Mensajes** | Pronósticos con datos reales, ánimo, noticias de casa. Llegan solos | Ninguno |
| **Consejos** | Preguntás qué hacer ante una falla; la respuesta llega después de la demora. Enseña por qué hay que decidir solos | Ninguno, solo el tiempo de espera |
| **Diagnóstico remoto** | Acelera una reparación en curso (×1,5) [regla] cuando llega | Energía de la radio |

- Durante la **conjunción solar** (cuando el Sol queda entre la Tierra y Marte) no hay Control de Misión, solo mensajes guardados [verificar fechas].
- El **comandante** es quien pide consejos y diagnósticos, desde la consola de comunicaciones.

### 3.8 Los datos reales, a la vista

1. **Tarjetas "Esto pasó de verdad"**: cada evento real abre una tarjeta breve, en pausa:
   - Fecha.
   - Instrumento y misión ("Curiosity/RAD, NASA").
   - El valor traducido ("304 μGy/h: 64 veces lo normal").
   - Una frase de explicación.
   - Enlace a la fuente (por ejemplo el `link` del evento en DONKI).
2. **Panel de datos**: una pantalla en la nave y en la base que se puede consultar en cualquier momento. Muestra las
   gráficas de los datos reales de la fecha actual (dosis, UV, temperatura, eventos de DONKI), con la posición del
   jugador marcada en el tiempo.
3. **Informe de misión** al final (5).

### 3.9 Guardado

- **Guardar y salir en cualquier momento** (Esc → Guardar), y autoguardado al cambiar de fase.
- El estado se guarda completo: fecha simulada, medidores, tripulación, inventario, incidentes activos, nivel de
  desbloqueo y **el estado del generador aleatorio con semilla**, para que la partida siga siendo reproducible.

## 4. Fases en detalle

### 4.0 Maniobras: checklist más acciones en el momento justo

Las cuatro maniobras (ascenso, aterrizaje, despegue de Marte, reentrada) comparten un formato:

1. **Checklist Go / No-Go:** recorrer la nave confirmando cada estación. Un sistema en mal estado aparece en amarillo
   y se puede arreglar antes o arriesgarse.
2. **Etapas con acción en el momento justo:** una barra por etapa; se aprieta **Espacio** en la zona correcta.
   Un sistema en amarillo achica la zona [regla].
3. Un error nunca termina la partida: cuesta combustible, precisión o una corrección extra.

### 4.1 Fase 1 — Preparación y despegue

1. **Carga de ida (simplificada).** Se elige uno de tres perfiles [regla]:

   | Perfil | Agua (bebida + blindaje) | Repuestos | Comida | Efecto |
   |---|---|---|---|---|
   | Escudo de agua | +++ | + | ++ | Menos dosis en el viaje; las reparaciones se complican |
   | Taller | + | +++ | ++ | Más dosis; las fallas se arreglan rápido |
   | Equilibrado | ++ | ++ | ++ | Sin extremos |

   El agua como blindaje es un concepto real de diseño de naves [dato].

2. **Maniobra de ascenso (4.0).** Etapas: encendido, separación de propulsores, separación de etapa, apagado de motores.
3. **Cinturones de Van Allen.** Primera dosis, con la curva de Artemis I: pico de **14 393 μGy/h** el 16/11/2022 (EAD) [dato, RadLab]. Sirve de tutorial del medidor de salud.

### 4.2 Fase 2 — Viaje de ida

Mapa top-down de la nave: módulo de mando, ejercicio, depurador, reciclador, refugio de agua, radio y despensa.

| Tarea | Si no se hace | Base |
|---|---|---|
| Ejercicio (1 por tripulante y jornada) | Baja la condición física | [dato] OSDR; la ISS exige ~2 h/día |
| Depurador de CO2 | CO2 > 3 mmHg → cansancio | [norma] |
| Reciclador de agua | Se gastan agua y blindaje | [dato] ISS |
| Corrección de trayectoria (minijuego de puntería) | Aterrizaje más difícil | [dato] Curiosity y Perseverance hicieron varias |
| Llamada a casa | Baja el ánimo | Demora real según la distancia (3.7) |

**Incidentes del viaje:**

| Incidente | Disparador | Respuesta | Fuente |
|---|---|---|---|
| Aviso de tormenta solar | CME o llamarada X en DONKI en la fecha | Preparar el refugio y cargar baterías | [dato] DONKI |
| **Tormenta de radiación** | SEP en la fecha, o pico en BioSentinel | Todos al refugio de agua. La tripulación descansada llega en ~1 s, la agotada tarda más (3.3) | [dato] DONKI + RadLab |
| Micrometeorito | Aleatorio con semilla | Encontrar y tapar la fuga | [regla] |
| Depurador averiado | Rango seguro o falla aleatoria | Repararlo (la ingeniera es más rápida) | [norma] |
| Aislamiento | Muchas jornadas sin llamada | Llamada a casa | [dato] Mars-500 |

En el viaje no se junta ciencia: la recompensa es llegar con la tripulación en forma y con la carga que va a hacer
falta en Marte.

### 4.3 Fase 3 — Aterrizaje en Marte (básico)

Maniobra (4.0) con cuatro etapas:
1. Entrada a la atmósfera (escudo térmico a ~2000 °C).
2. Paracaídas a ~Mach 1,7.
3. Separación del escudo.
4. Motores de descenso.

Son los valores de Curiosity y Perseverance [verificar las cifras exactas].

- **Dificultad:** depende de la precisión de la trayectoria, la carga y el polvo real del día.
- **Resultado:** la distancia a la base. Más distancia → más salidas al exterior → más polvo y dosis. Nunca hay "choque" ni muerte.
- **Momento educativo:** "La señal del aterrizaje tarda X minutos en llegar a la Tierra. Cuando se enteren, ya habrás aterrizado."

### 4.4 Fase 4 — Estancia en Marte

Base en el cráter Gale. Curiosity es el vecino robot que reporta el dato real de cada día.

**Ciencia: muestras en el mapa.**
- Puntos de muestreo en el exterior, ubicados por semilla en cada partida. Cada EVA trae muestras.
- Algunas muestras están más lejos (más dosis y polvo) y valen más.
- Cada muestra tiene **masa**, que pesa en el despegue de Marte (4.5).

| Ciclo del sol | Qué pasa |
|---|---|
| Planificación (en pausa, al detener el avance o tras un aviso) | Pronóstico real (UV/polvo, temperatura), rutinas y tablero de energía |
| Día | Tareas, EVA a puntos de muestreo, cambio de tripulante |
| Noche | Frío real de REMS → calefacción |

Los soles tranquilos pasan en avance rápido (3.1), y se juegan a mano los que traen avisos o los que el jugador detiene.

| Incidente | Disparador | Respuesta | Fuente |
|---|---|---|---|
| Tormenta de polvo | UV = Low en REMS | Repartir energía: calor, aire o ciencia; si la energía llega a cero, soporte vital mínimo y limpieza de paneles (3.5) | [dato] REMS (2018) |
| Noche extrema | Mínima real muy baja | Más calefacción o una zona apagada | [dato] REMS |
| **Tormenta de radiación** | Pico real en RAD (20/05/2024) | Refugio; suspender la EVA | [dato] RadLab |
| Conjunción solar | Fechas reales en que el Sol tapa a Marte | Dos semanas sin Control de Misión | [verificar fechas: ¿nov. 2023?] |
| CO2 alto | Depurador o MOXIE descuidados | Reparar o reasignar energía | [norma] |
| Plaga en el invernadero | Poco cuidado | Botánico | [dato] OSD-177 |
| Polvo en los sellos | Muchas EVA | Mantenimiento de la esclusa | [regla] |

### 4.5 Fase 5 — Despegue de Marte

1. **Carga de vuelta:** la decisión que cierra la estancia. Hay un límite de masa para muestras y suministros [regla].
   - Muchas muestras → más ciencia, pero menos comida, agua y repuestos para la vuelta.
   - Pocas muestras → vuelta más segura, menos estrellas.
   - El agua de la vuelta vuelve a ser **bebida y blindaje**: la tormenta de octubre está esperando en la campaña.
2. **Maniobra (4.0):** checklist de la nave de ascenso y etapas de despegue. La precisión define cuánto combustible
   queda para correcciones en la vuelta.

### 4.6 Fase 6 — Viaje de vuelta

Mismo mapa y tareas que la ida, con tres diferencias para que no se repita:

- **Nave gastada:** más fallas por desgaste (depurador, reciclador) y **solo los repuestos que sobraron** de la ida y de Marte [regla].
- **Tripulación que arrastra su estado:** la condición física de 0,38 g, la dosis acumulada y el cansancio pesan.
- **Clima espacial más agitado en la campaña:** junio–octubre de 2024 fue de los períodos más activos del ciclo solar (2.2) [dato].
- **Preparación para 1 g:** el ejercicio de la vuelta cuenta doble para el estado al aterrizar en la Tierra [regla].

### 4.7 Fase 7 — Reentrada a la Tierra

Maniobra (4.0) con tres etapas: orientar el escudo térmico, reentrada (zona de calor y apagón de comunicaciones),
paracaídas y amerizaje [verificar cifras de cápsulas tripuladas: Orion/Artemis I]. Cierra con la tripulación
caminando o en camilla según su condición física, y da paso al informe de misión.

## 5. Objetivos, puntuación y final

- **Objetivo:** volver con la tripulación sana **y con las muestras de Marte a bordo**. Las muestras cuentan al **volver**, no al recogerlas.
- **3 estrellas:** tripulación sana · dosis controlable baja · muestras traídas a la Tierra.
- **Logros:** por ejemplo "Refugio a tiempo", "Como Opportunity: sobreviviste al polvo", "Cero radiografías extra", "Sobreviviste a la X9.0".
- **Informe de misión:** tus decisiones superpuestas a las gráficas reales ("tu tripulación recibió X; Curiosity midió esto el mismo día"), con enlaces a cada fuente y las tarjetas de datos vividas.
- **Sin final temprano por un medidor en cero:** se entra en falla en cascada (3.5). La misión solo se suspende en el punto de no retorno, y el informe muestra la cadena de decisiones que llevó hasta ahí.

## 6. Progresión entre partidas

La **primera misión** presenta un conjunto reducido de tareas e incidentes; cada misión completada **suma más** [regla].
Así se aprende un sistema por vez y el juego cambia al rejugar.

| Nivel | Se desbloquea al | Tareas nuevas | Incidentes nuevos | Otros desbloqueos |
|---|---|---|---|---|
| 1 | — (primera partida) | Ejercicio, depurador, refugio, muestras, tablero de energía | Tormenta de radiación, tormenta de polvo | Campaña 2024 en modo corto |
| 2 | Terminar 1 misión | Reciclador de agua, invernadero, llamada a casa | Depurador averiado, plaga, aislamiento | Perfil de carga "Taller" |
| 3 | Terminar 2 misiones | MOXIE, corrección de trayectoria, diagnóstico remoto | Micrometeorito, noche extrema, CO2 alto | Modo libre, modo largo |
| 4 | Terminar 3 misiones | Mantenimiento de la esclusa | Polvo en los sellos, conjunción solar | Perfil "Escudo de agua", escenarios especiales |

- La progresión se guarda en el navegador, junto con los récords y los logros. El juego se juega online sin intervención de terceros.

## 7. Datasets por mecánica

| Mecánica | Archivo |
|---|---|
| Van Allen | `datasets/raw/radlab/daily/moon-orbit-lro-crater.csv` (instrumentos `Artemis-I-*`) |
| Dosis en los viajes | `raw/radlab/daily/deep-space-biosentinel.csv`, `mars-cruise-orbit-tgo-liulin.csv` |
| Tormentas en los viajes | `raw/radlab/events/2024-05-gannon-storm_heliocentric.csv`, `raw/donki/sep.json`, `flr.json`, `cme.json` |
| Textos del Control de Misión | `raw/donki/notifications.json` (adaptados y traducidos) |
| Dosis en Marte | `raw/radlab/daily/mars-surface-curiosity-rad.csv`, `raw/radlab/events/2024-05-20-mars-sep_curiosity.csv` |
| Polvo y frío | `raw/mars-weather/curiosity-rems.json` |
| Consumos y límites | `raw/references/*.pdf`, `curated/life-support-bvad.json`, `curated/radiation-dose.json` |
| "¿Sabías que…?" | `raw/osdr/*.json` → `curated/osdr-facts.json` |

## 8. Idiomas y controles

- **Español e inglés** con selector en el menú inicial. Todos los textos (interfaz, incidentes, tarjetas, Control de
  Misión) viven en archivos de traducción por clave, nunca escritos en el código. Los datos curados con texto
  (por ejemplo `osdr-facts.json`) tienen los dos idiomas.
- Las alertas de DONKI están en inglés en su origen: en inglés se muestra el texto original adaptado y en español,
  la traducción adaptada.
- **Controles (PC):** WASD/flechas para moverse · E para interactuar · Tab para cambiar de tripulante ·
  Espacio para la acción en las maniobras · Esc para pausar y guardar · **mouse** para decisiones, el tablero de
  energía y el panel de datos.

## 9. Cambios respecto al prototipo actual

- El prototipo usa una **base lunar** y el **apagón de radio** por llamaradas. En Marte la restricción de comunicación sale de la **demora por distancia** y de la **conjunción solar**.
- Los 4 recursos más la dosis del prototipo pasan a **3 medidores** más el inventario de comida.
- Las decisiones con las teclas 1/2/3 pasan al mouse.
- El prototipo termina la partida cuando un recurso se agota: se reemplaza por la falla en cascada (3.5).
- Los textos de la interfaz, hoy escritos en el código, pasan a archivos de traducción.
- La tripulación pasa de un jugador solo a 4 tripulantes con cambio por Tab.

## 10. Pendientes de verificar

- [ ] Fechas de las conjunciones solares de Marte (moratoria de comandos de la NASA) en los rangos de datos.
- [ ] Ventana de lanzamiento a Marte 2026 (fechas reales, posible gancho de "desafío actual").
- [ ] Simulaciones WSA-ENLIL de DONKI con impactos en Marte (para eventos en superficie fuera de RAD).
- [ ] Error típico de las predicciones de llegada de CME (CCMC CME Scoreboard).
- [ ] Mínimas < −90 °C de REMS (40 soles). (Los máximos de BioSentinel se resolvieron con el tope de 3.2.1.)
- [ ] Cifras del aterrizaje (velocidad de entrada, temperatura del escudo, Mach del paracaídas) y de la reentrada de Orion.
- [ ] Factores Q por fase: confirmar en Hassler 2014 y Zeitlin 2013.
- [x] Antelación real entre detección en DONKI y pico en RadLab para los eventos de la campaña: mayo de 2024, 69 h (X1.0 de la región 13664 el 08/05 → subida en BioSentinel el 11/05); octubre de 2024, 1,9 h (X1.8 del 09/10). Detalle en `datasets/README.md`.
- [ ] Hallazgos de Mars-500 sobre sueño y actividad (Basner et al. 2013, PNAS).
- [ ] Pesos de la fórmula de eficiencia, márgenes de la falla en cascada y límites de masa de las cargas: ajustarlos con pruebas de juego con niños.

## 11. Orden de construcción

1. **Núcleo compartido:**
   - Reloj de misión por fechas reales, con avance rápido y frenado por avisos.
   - Los 3 medidores con sus fórmulas, más el inventario.
   - La falla en cascada.
   - El planificador de incidentes con niveles de desbloqueo.
   - La tripulación de 4 con eficiencia según su estado.
   - Guardado del estado completo.

   Todo en `src/core/`, con tests.
2. **Infraestructura de traducción** (ES/EN) antes de escribir textos nuevos.
3. **Procesamiento de datos:** de `datasets/raw/` a series por fase y fecha (`src/data/`).
4. **Viaje** (ida y vuelta comparten mapa y sistemas): tareas, tormenta con refugio, Control de Misión.
5. **Estancia en Marte:** adaptar el mapa actual a Gale y agregar polvo, frío, MOXIE y muestras.
6. **Maniobras** (formato común 4.0): ascenso, aterrizaje, despegue de Marte, reentrada.
7. **Tarjetas, panel de datos e informe de misión.**
8. **Progresión y desbloqueos.**

## 12. Historial de revisiones

### v4 — ruta, BioSentinel y progresión

| Tema | Cambio | Dónde |
|---|---|---|
| Tramos de viaje de 4 meses que no correspondían a ninguna ruta | **Nave de propulsión nuclear térmica** con estancia corta, la arquitectura que estudia la NASA; se quita el "viaje acelerado" | 2.1, 2.2 |
| Valores extremos de BioSentinel | **Tope de 650 μGy/h** (percentil 99 y pico de mayo de 2024); las fechas de las tormentas se mantienen porque coinciden con SEP de DONKI | 3.2.1 |
| Desbloqueo por docente | **Eliminado:** el juego es online y sin intervención de docentes | 6 |

### v3 — decisiones de diseño tomadas en la sesión de preguntas

| Tema | Decisión | Dónde |
|---|---|---|
| Final de la misión | **Regreso completo:** despegue de Marte, viaje de vuelta más corto en jornadas y reentrada | 1, 2, 4.5–4.7 |
| Jugador | **Comandante** como 4.º tripulante, que hace todo al 100 %; los especialistas, ×1,5 en lo suyo | 3.3 |
| Ciencia | **Muestras en el mapa** de Marte, con masa: cuentan al volver | 4.4, 4.5, 5 |
| Plataforma | **PC con teclado y mouse** | 1, 8 |
| Comida | **Dentro de Salud:** stock de inventario; racionar baja la condición física y el ánimo | 3.2, 3.5 |
| Riesgo | **Semáforo** | 3.6 |
| Dificultad | **Modo ayuda** opcional | 3.3 |
| Idioma | **Español e inglés** desde el inicio | 8 |
| Tiempo en Marte | **Avance rápido** también entre soles | 3.1, 4.4 |
| Guardado | **En cualquier momento**, con el estado del generador aleatorio | 3.9 |
| Control de Misión | **Mensajes, consejos y diagnóstico remoto**, todos con demora real | 3.7 |
| Maniobras | **Checklist más acciones en el momento justo**, formato común | 4.0 |
| Datos visibles | **Tarjetas "Esto pasó" y panel de datos** | 3.8 |
| Progresión | **Desbloqueos:** la primera misión tiene pocas tareas e incidentes y se suman más en cada partida | 6 |

Consecuencias derivadas:
- **Tramos de 4 meses también en el modo libre**, para que la dosis de fondo de ida y vuelta no supere sola el límite de 600 mSv (en la v4 se justifica con la propulsión nuclear).
- **Carga de vuelta:** decisión de masa entre muestras y suministros.
- **Calendario de la vuelta en la campaña:** junio–octubre de 2024, con la X9.0 del 03/10/2024 como clímax antes de la reentrada.

### v2 — revisión según [`Transcripcion_simulador_marciano.md`](Transcripcion_simulador_marciano.md)

| Problema señalado | Cambio | Dónde |
|---|---|---|
| Terminar la misión cuando un medidor llega a cero es un "Game Over disfrazado" que corta la recuperación | **Falla en cascada**: modos de emergencia, sacrificios con coste (beber el escudo de agua, limpiar paneles) y un punto de no retorno solo cuando todo colapsa | 1, 3.5, 5 |
| El salto entre jornadas del viaje hace que las crisis parezcan una ventana de error | **Avance rápido interactivo** que se frena con avisos reales de DONKI, se tiñe de amarillo y deja al jugador prepararse antes del impacto | 2.1, 3.1 |
| Tripulantes al 70 % y con 3–6 s de demora fijos castigan por algo que el jugador no controla | La **eficiencia y la demora dependen del estado** (fatiga, condición física, CO2, ánimo): de 100 % y 1 s a 50 % y 6 s, con la causa siempre visible | 3.3 |

Ajustes propios sobre las sugerencias:
- **"Estática de radio" pasó a ser un monitor de partículas.** Las llamaradas afectan la radio terrestre de onda corta, no la Red de Espacio Profundo, así que la estática daría una idea falsa.
- **Las 48 h de aviso fijas pasaron a ser la antelación real del evento** según los datos, con las 48 h como respaldo cuando no hay detección previa.
- **La fórmula de eficiencia también se aplica al personaje del jugador** (velocidad, no decisiones), para que la regla sea igual para todos.
- **"Te matas tú mismo" pasó a ser "misión suspendida, tripulación a salvo"**, por el público de 7–12 años.

### v1 — borrador inicial

Arco de 4 fases, 3 medidores, campaña 2024 y modo libre, carga simplificada, tripulación automática con rendimiento fijo.

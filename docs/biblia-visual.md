# Biblia visual y catálogo de escenas — Misión a Marte

Documento para dirigir la generación de imágenes (fondos, tilesets, props, íconos, retratos e ilustraciones) y
empezar a pulir la interfaz. Resume el juego completo desde lo que **se ve**: qué pantallas hay, qué pasa en cada
una, qué estados tiene y qué piezas gráficas necesita. Las reglas y los números están en
[`game-design.md`](game-design.md); la arquitectura, en [`plan-de-trabajo.md`](plan-de-trabajo.md).

---

## 1. El juego en una página

**Misión a Marte** es un juego top-down 2D para chicos de **7 a 12 años** (objetivo principal: 10), hecho para el
desafío *Junior Astronaut Mission Trainer* de NASA Space Apps 2026. Se juega en **PC con teclado y mouse**, en
español o inglés.

> Llevá a tu tripulación de la Tierra a Marte y de vuelta a casa sana, con las muestras de Marte a bordo,
> mientras el clima espacial **real** pone a prueba cada decisión.

- Cuatro astronautas viajan en una nave de **propulsión nuclear** (4 meses por tramo), viven unos soles en el
  **cráter Gale** junto a Curiosity y vuelven a la Tierra.
- Todo lo que pasa sale de **datos reales de la NASA**: la radiación que midieron BioSentinel, Curiosity y
  Artemis I, el polvo y el frío de REMS, las tormentas solares de DONKI y la demora de la señal según la distancia.
- Cuando un dato real causa algo, el juego lo muestra en una tarjeta **"Esto pasó de verdad"** con su fecha y su
  fuente.
- **Nadie muere.** Si todo sale mal, la misión se suspende y "la tripulación está a salvo en el refugio esperando
  rescate". Un sistema en cero no termina la partida: obliga a sacrificar otro (falla en cascada, como el Apolo 13).
- Pilares visuales: **claridad antes que detalle**, **semáforo** (verde, amarillo, rojo) para todo riesgo, la
  **causa siempre visible** ("Miga está cansada"), y un tono **cálido y valiente**, nunca de terror.

## 2. Reglas técnicas para las imágenes

| Tema | Regla |
|---|---|
| Pantalla | **1280 × 720**, escala FIT centrada. Todo debe leerse a ese tamaño |
| Grilla | **Tile de 48 px**. Tiles, props y fondos de mapa en **múltiplos de 48 px** |
| Estilo | **Pixel art** como [`ref-nave.png`](ref-nave.png): contornos oscuros, sombreado suave, paleta fría para la nave (grises lavanda, azul, acentos naranja y amarillo), cálida para Marte (ocres, óxido, rosado polvoriento) |
| Formato | **PNG con transparencia** para sprites, props e íconos; fondos opacos |
| Texto | **Ninguna imagen lleva texto**: todo texto de la interfaz se traduce (ES/EN) y se dibuja aparte. Sin letras, números ni logos con palabras en las imágenes |
| Dónde van | Recursos del juego en `public/assets/<dominio>/` (por ejemplo `public/assets/ship/`, `public/assets/mars/`, `public/assets/ui/`). En `docs/` quedan sólo referencias |
| Personajes | Hojas de 9 × 4 cuadros de **176 × 216** (frente, espalda, perfil izquierdo, perfil derecho; reposo y caminata), pies en y = 208. En el mapa se ven a escala 0,38 (≈ 1,7 tiles de alto) |
| Legibilidad | Siluetas claras, contraste alto entre lo que se puede usar y el decorado; nada importante comunicado sólo por color (sumar forma o ícono) |

Paleta de la interfaz actual (se puede refinar, pero conviene partir de acá):

| Uso | Color |
|---|---|
| Fondo general | `#05070d` (casi negro azulado) · paneles `#111827` con borde `#4a5568` |
| Texto | `#e2e8f0` · secundario `#a0aec0` · tenue `#718096` |
| Títulos | `#90cdf4` (celeste) · foco/selección `#fbd38d` (ámbar) |
| Semáforo | verde `#68d391` · amarillo `#f6e05e` · rojo `#fc8181` |
| Datos reales | enlaces y marcas de datos `#63b3ed` (azul) · Marte `#f6ad55` (naranja) |

## 3. Personajes

### 3.1 Tripulación (hojas de sprites ya hechas: `docs/<id>-sprites.png`)

Astronautas chibi con traje blanco, casco redondo con visor celeste y detalles de color propio. Se pueden generar
**retratos** (busto, expresiones) y **poses especiales** que hoy faltan.

| Tripulante | Rol | Especialidad (×1,5) | Personalidad sugerida | Expresiones que hacen falta |
|---|---|---|---|---|
| **Vega** | Comandante (el jugador empieza con ella) | Ninguna: hace todo al 100 % | Serena, decidida, líder | Concentrada, contenta, preocupada, al habla con la Tierra |
| **Miga** | Ingeniera | Energía, depurador de CO2, fugas | Inquieta, ingeniosa, siempre con una llave | Arreglando, cansada, orgullosa |
| **Brote** | Botánico | Comida, invernadero, agua, plagas | Tranquilo, cariñoso con las plantas | Cuidando plantas, preocupado por una plaga, con hambre |
| **Senda** | Geóloga y médica | Muestras, ejercicio, enfermería | Curiosa, aventurera, protectora | Con una muestra, atendiendo a alguien, en EVA |

Estados que se ven en el mapa (hoy con transparencia y burbujas de texto; conviene tener variantes o íconos):
- **Activa** (la que maneja el jugador): anillo ámbar en los pies y flecha encima.
- **En reposo** (enfermería): semitransparente; falta una pose acostada en cama.
- **Lenta** por cansancio, CO2 alto, mala condición física o hambre: burbuja con el motivo; faltan íconos chicos
  (zzz, nube de CO2, músculo, plato vacío).
- **En el refugio** durante una tormenta: falta una pose agachada o abrazando las rodillas.
- **En EVA** (exterior de Marte): mismo traje, idealmente con mochila y polvo en las botas.
- **Llegada a la Tierra**: bajar caminando o en camilla (ilustración del final).

### 3.2 Personajes secundarios

| Personaje | Cómo aparece | Qué falta |
|---|---|---|
| **Curiosity** | Rover estacionado en el exterior de Gale; una burbuja reporta el clima real del día | Sprite del rover en pixel art (hoy son rectángulos), con versión "con polvo" |
| **Control de Misión** | Voz que llega con demora desde la Tierra: mensajes, consejos, diagnóstico | Retrato o ícono (operadora con auriculares, sala de control), y una variante "sin señal" para la conjunción solar |
| **Narrador de las maniobras** | Línea de texto que acompaña cada etapa | Ícono o retrato pequeño (puede ser Control de Misión) |
| **Artemis I, BioSentinel, MOXIE** | Se nombran en las tarjetas de datos | Ilustraciones pequeñas de cada nave o instrumento para las tarjetas |

## 4. Arco de la misión, modos y progresión

### 4.1 Las siete fases (en orden de juego)

| # | Fase | Pantalla | Amenaza | Lo que se aprende | Ambiente visual |
|---|---|---|---|---|---|
| 1 | Preparación y despegue | `Loadout` + `Maneuver` (ascenso) | Carga limitada; cinturones de Van Allen | Todo lo que llevás pesa; la Tierra nos protege | Plataforma de lanzamiento, cielo azul que se vuelve negro, la Tierra abajo |
| 2 | Viaje de ida | `Voyage` | Radiación (tormentas solares) | Refugio, ejercicio, aislamiento | Interior de la nave; ventanas con estrellas y el Sol cada vez más chico |
| 3 | Aterrizaje en Marte | `Maneuver` (aterrizaje) | "Los siete minutos de terror" | La señal tarda más que el aterrizaje | Fuego de reentrada, paracaídas, cráter Gale desde arriba |
| 4 | Estancia en Marte | `Mars` | Polvo y frío | La atmósfera protege de la radiación pero tapa el sol | Base modular, esclusa, exterior ocre con rocas; día, noche y tormenta de polvo |
| 5 | Despegue de Marte | `Loadout` (vuelta) + `Maneuver` | Masa: muestras contra suministros | Lo que te llevás a casa también pesa | Nave de ascenso en el cráter; cajas de muestras |
| 6 | Viaje de vuelta | `Voyage` (vuelta) | Radiación con nave y tripulación gastadas | Las decisiones de la ida se pagan en la vuelta | La misma nave, más gastada (luces que parpadean, cinta adhesiva, cables) |
| 7 | Reentrada a la Tierra | `Maneuver` (reentrada) | Calor y precisión | Volver también es difícil | Cápsula envuelta en plasma, paracaídas, amerizaje en el océano |

Cierra con el **Informe de misión** (`Report`).

### 4.2 Modos y opciones del menú

| Opción | Valores | Qué cambia visualmente |
|---|---|---|
| **Misión** | *Historia real 2024* (campaña: un calendario real único, del 15/01 al 10/10/2024) · *Modo libre* (cada fase con fechas reales distintas; nivel 3) | Fechas en pantalla; en el modo libre puede haber **conjunción solar** (Control de Misión sin señal) |
| **Duración** | Corta (~35 min) · Larga (~75 min; nivel 3) | Más jornadas a tiempo normal |
| **Modo ayuda** | Sí / No | La tripulación corre sola al refugio y Control de Misión da pistas sin que se las pidan |
| **Idioma** | Español / English | Todo el texto |

### 4.3 Progresión entre partidas (niveles de desbloqueo)

| Nivel | Se desbloquea al | Tareas nuevas | Incidentes nuevos | Otros |
|---|---|---|---|---|
| 1 | Primera partida | Ejercicio, depurador, refugio, muestras, tablero de energía | Tormenta de radiación, tormenta de polvo | Campaña 2024, corta |
| 2 | Terminar 1 misión | Reciclador de agua, invernadero, llamada a casa | Depurador averiado, plaga, aislamiento | Perfil de carga "Taller" |
| 3 | Terminar 2 misiones | MOXIE, corrección de trayectoria, diagnóstico remoto | Micrometeorito, noche extrema, CO2 alto | Modo libre, modo largo |
| 4 | Terminar 3 misiones | Mantenimiento de la esclusa | Polvo en los sellos, conjunción solar | Perfil "Escudo de agua", escenarios especiales |

Las opciones bloqueadas se muestran con un candado y el nivel que falta: hace falta un **ícono de candado**.

## 5. Lo que se ve en todas las fases de simulación

### 5.1 Los tres medidores (tablero a la derecha)

| Medidor | Qué representa | Ícono sugerido |
|---|---|---|
| **Energía** | Batería: paneles solares contra consumo (la luz cae con la distancia al Sol; en Marte, el polvo) | Batería / panel solar |
| **Aire y agua** | Oxígeno, agua y CO2 | Burbuja de O2, gota |
| **Salud** (por tripulante) | Cuatro íconos: dosis de radiación, condición física, comida, cansancio | Átomo/radiación, músculo, plato, luna/zzz |

La dosis se muestra para chicos en **radiografías de tórax** y como porcentaje del límite de carrera: hace falta un
**ícono de radiografía**.

### 5.2 Niveles de alerta del reloj

| Nivel | Cuándo | Cómo se ve |
|---|---|---|
| **Calma** | Sin avisos; el calendario avanza rápido | Interfaz normal |
| **Alerta** | Detección real (DONKI), polvo que empieza, noche extrema | **Toda la pantalla teñida de amarillo**, monitor de partículas que late más rápido, aviso arriba |
| **Impacto** | Pico real de radiación, sol de polvo o de frío | Tinte rojo, alarma, orden de refugio; el refugio titila con borde amarillo |

El **monitor de partículas** (tipo contador Geiger) es un indicador clave: un punto que destella con cada "clic".
Merece un diseño propio (aparato de mano o panel con aguja y luz).

### 5.3 Incidentes (cada uno necesita un ícono y, si se puede, una mini-ilustración)

| Incidente | Dónde | Respuestas (siempre con coste y semáforo) |
|---|---|---|
| Tormenta de radiación | Viaje y Marte | Todos al refugio (verde) · Seguir trabajando (rojo) |
| Tormenta de polvo | Marte | Priorizar calor, aire o ciencia |
| Depurador averiado | Viaje y Marte | Reparar con repuesto · Improvisar |
| Micrometeorito (fuga) | Viaje | Tapar la fuga · Sellar el módulo |
| Aislamiento | Viaje y Marte | Llamar a casa |
| Noche extrema | Marte | Más calefacción · Cerrar una zona |
| CO2 alto | Viaje y Marte | Reparar el depurador |
| Plaga en el invernadero | Marte | Que la atienda el botánico |
| Polvo en los sellos | Marte | Mantenimiento de la esclusa |
| Conjunción solar | Modo libre | Dos semanas sin Control de Misión |

### 5.4 Falla en cascada (modo de emergencia)

Cuando un medidor llega a cero, la nave o la base entra en emergencia y el jugador elige un **sacrificio** con
coste: salir a limpiar los paneles, apagar MOXIE, desconectar el refugio, **beber el agua del escudo**, darle más
energía al reciclador o a MOXIE, que Senda atienda al enfermo, hacer menos tareas, raciones extra, priorizar el
invernadero. Visualmente: luces de emergencia, mitad de los sistemas apagados, un banner con el margen que queda
("energía de emergencia: 2 soles"). Cada sacrificio necesita un **ícono**.

## 6. Catálogo de escenas

Para cada escena: cuándo aparece, cómo está compuesta hoy (todo es provisional, con rectángulos y texto), sus
estados y qué imágenes conviene generar. Las ideas de prompt están en inglés para los modelos de imágenes.

### 6.1 Carga (`Boot`)

- **Cuándo:** al abrir el juego. Barra de carga con "Preparando la nave… N %".
- **Generar:** fondo de hangar o de la Tierra vista desde la órbita, con espacio central para la barra; barra de
  carga con forma de tanque de combustible o de cohete que avanza.
- *Prompt:* `pixel art loading screen background, rocket in a launch hangar at night, soft blue lights, empty center area, 1280x720, no text`.

### 6.2 Menú principal (`Title`)

- **Cuándo:** después de la carga y al terminar una misión.
- **Hoy:** título, subtítulo, filas de opciones (Continuar, Nueva misión, Misión, Duración, Modo ayuda, Idioma), la
  descripción de la opción elegida, el nivel y las misiones terminadas.
- **Estados:** con o sin partida guardada (aparece "Continuar misión" con la fase y la fecha); confirmación de
  "Nueva misión" si hay una guardada; opciones bloqueadas con candado.
- **Generar:** ilustración clave del juego (los cuatro astronautas mirando a Marte desde una ventana de la nave, o
  parados en Gale con la Tierra como un punto en el cielo); logo del juego **sin texto** (emblema de misión
  redondo); marco de botones y del panel de opciones; íconos de candado, bandera de idioma, reloj (duración),
  salvavidas (modo ayuda).
- *Prompt:* `pixel art key art, four cute chibi astronauts in white suits with colored accents looking out a spaceship window at Mars, warm and hopeful mood, starry background, 1280x720, no text`.

### 6.3 Carga de ida (`Loadout`, modo ida)

- **Cuándo:** primera fase, en la Tierra.
- **Hoy:** tres tarjetas de perfil (**Escudo de agua**, **Equilibrado**, **Taller**), cada una con niveles de
  agua, repuestos y comida (de + a +++) y dos semáforos de riesgo (radiación, reparaciones). Un dato real al pie.
- **Estados:** perfil seleccionado; perfil bloqueado por nivel.
- **Generar:** fondo de bodega de carga o de la nave abierta en la plataforma; ilustración de cada perfil (tanques
  de agua alrededor del refugio; caja de herramientas y repuestos; mezcla); íconos de agua, repuestos, comida,
  radiación y llave inglesa; "barras" de nivel en forma de cajas apiladas.
- *Prompt:* `pixel art cargo bay of a spaceship, water tanks, toolboxes and food crates neatly stacked, top-down three-quarter view, cool lavender palette, no text`.

### 6.4 Maniobras (`Maneuver`): formato común

Las cuatro maniobras comparten la pantalla:

1. **Checklist Go / No-Go:** una fila por sistema con su luz (verde, amarillo, rojo). Si no está en verde, el
   jugador elige **reparar** (gasta repuestos) o **arriesgarse**.
2. **Etapas:** una barra horizontal por etapa con una **zona de acierto** y una marca que va y vuelve; se aprieta
   Espacio en la zona. Un sistema en amarillo achica la zona. Cada etapa muestra un dato curioso ("el escudo llega a
   unos 2000 °C").
3. **Resultado:** precisión en palabras con semáforo (excelente, buena, con muchas correcciones), combustible que
   queda y el efecto propio de la maniobra.

Arriba siempre: título, línea del narrador y barra de combustible. Hace falta una **ilustración de fondo por etapa**
(es lo que más va a lucir) y piezas comunes: barra de etapa, zona de acierto, marca, íconos de cada sistema
(motores, depurador, radio, paneles, escudo térmico, paracaídas, esclusa, MOXIE, invernadero, reciclador), barra de
combustible.

| Maniobra | Etapas (fondo a generar para cada una) | Resultado que se muestra |
|---|---|---|
| **Ascenso** (fase 1) | Encendido en la plataforma · Separación de propulsores · Separación de etapa · Apagado de motores en órbita | Sigue el cruce de los **cinturones de Van Allen** y su tarjeta de datos (Artemis I) |
| **Aterrizaje** (fase 3) | Entrada a la atmósfera (escudo al rojo) · Paracaídas supersónico · Separación del escudo · Motores de descenso sobre Gale | Distancia a la base en km y la demora de la señal; con polvo real ese día, el narrador avisa que Curiosity ve polvo |
| **Despegue de Marte** (fase 5) | Encendido en el cráter · Inserción en órbita | Combustible para corregir en la vuelta |
| **Reentrada** (fase 7) | Orientar el escudo · Reentrada con plasma y apagón de radio · Paracaídas y amerizaje | Cada tripulante **baja caminando o en camilla** |

- *Prompt (ejemplo):* `pixel art side view of a space capsule entering Mars atmosphere, heat shield glowing orange, plasma trail, dark red sky, dramatic but friendly, 1280x720, no text`.
- Variante **con polvo** para las etapas del aterrizaje (cielo marciano más naranja y opaco).

### 6.5 Viaje de ida y de vuelta (`Voyage`)

- **Cuándo:** fases 2 y 6.
- **Composición:** a la izquierda, el **mapa top-down de la nave** (19 × 15 tiles = 912 × 720 px, la cámara sigue
  al tripulante); a la derecha, el **tablero** (368 px de ancho). Arriba del mapa aparecen avisos tipo "toast".
- **Plano de la nave** (pasillo horizontal en el medio, cuatro cuartos arriba y cuatro abajo, puertas al pasillo):

  | Arriba | Módulo de mando · Ejercicio (bici) · Depurador de CO2 · Reciclador de agua |
  |---|---|
  | **Abajo** | **Camas y enfermería** · Despensa · **Refugio de agua** · Radio |

- **Estaciones** (lo que se usa con E): bici fija, depurador de CO2, reciclador de agua, consola de radio. Cada una
  tiene un marco con la luz de su sistema y una barrita de progreso.
- **Estados del mapa:** calma; alerta (tinte amarillo); impacto (rojo, refugio titilando); fuga por micrometeorito
  (círculo rojo que late en un cuarto); emergencia de energía (luces apagadas); nave gastada en la vuelta.
- **Ventanas:** las estrellas y el Sol cambian con la distancia (el Sol más chico cerca de Marte).
- **Generar:** tileset de la nave en 48 px (piso, paredes, puertas, pasillo, ventanas), props por cuarto (consola de
  mando con pantallas, bici fija, máquina del depurador, reciclador con tanques, camas de enfermería, estantes de
  despensa, **refugio rodeado de tanques de agua**, consola de radio con antena), versión "gastada" de cada prop,
  luces de emergencia, partículas de fuga de aire.
- *Prompt:* `pixel art top-down spaceship interior tileset, 48px tiles, rooms connected by a central corridor, lavender gray metal floor, blue accent lights, matching ref style, PNG transparent props`.

### 6.6 Estancia en Marte (`Mars`)

- **Cuándo:** fase 4.
- **Composición:** mapa de 48 × 15 tiles: la **base** a la izquierda (mismo esquema que la nave), la **esclusa** al
  final del pasillo y el **exterior** a la derecha (25 × 13 tiles de suelo marciano). La cámara sigue al jugador.
- **Plano de la base:**

  | Arriba | Mando · Ejercicio · Depurador de CO2 · **Invernadero** |
  |---|---|
  | **Abajo** | Camas y enfermería · **MOXIE (fábrica de oxígeno)** · Refugio de agua · Radio |

  + **Esclusa** (2 × 3 tiles) entre la base y el exterior. La puerta exterior se bloquea de noche y en tormenta
  (cuadro rojo).
- **Exterior:** puntos de muestreo (círculos dorados; más lejos valen más), Curiosity estacionado con su burbuja del
  clima, rocas, huellas.
- **Ciclo del sol:** día (salidas posibles), **noche** (exterior oscurecido, frío real: calefacción), **tormenta
  de polvo** (cielo naranja opaco, paneles con menos luz), tormenta de radiación (todos al refugio).
- **Generar:** tileset de la base (más cálido y polvoriento que la nave), props (invernadero con plantas bajo luces
  violetas, MOXIE como máquina con tubos, esclusa con dos puertas), tileset del suelo de Gale (arena ocre, rocas,
  piedras con vetas, huellas), paneles solares limpios y con polvo, **Curiosity**, rocas de muestra con brillo,
  overlay de noche, overlay de polvo, partículas de polvo en el aire, monte Sharp en el horizonte para un fondo.
- *Prompt:* `pixel art top-down Mars surface tileset, Gale crater ochre sand, scattered rocks, rover tracks, dusty pink sky tint, 48px tiles, seamless`.

### 6.7 Tablero (`Hud`, a la derecha de `Voyage` y `Mars`)

- Reloj con semáforo, fecha simulada y **fuente del dato del día**; los tres medidores; la salud con cuatro íconos
  por tripulante; decisiones pendientes con su coste y semáforo; emergencias activas; monitor de partículas; ayuda
  de teclas al pie.
- **Generar:** marco del tablero (panel de consola con remaches), íconos de medidores y de salud, botones de
  respuesta con semáforo, retratitos de los cuatro tripulantes (32–48 px), el monitor de partículas.

### 6.8 Planificación (`Planning`, tecla P)

- Pantalla en pausa sobre el mapa: **rutina de cada tripulante** en una barra de 24 cuadritos (dormir azul,
  ejercicio verde, trabajo naranja, libre gris) y el **tablero de energía** con "enchufes": fichas de sistemas que se
  arrastran con el mouse, sin números.
- **Generar:** fichas de sistemas (depurador, reciclador, invernadero, MOXIE, radio, refugio, luces), enchufes
  vacíos y ocupados, fondo de pizarra o tablet.

### 6.9 Control de Misión (`MissionControl`, tecla C)

- Mensajes de la Tierra (pronósticos reales de DONKI adaptados, ánimo, noticias de casa), **consejos** y
  **diagnóstico remoto**; todo llega con la **demora real de la señal** y una cuenta regresiva. Sólo la comandante
  puede pedir, desde la consola de radio. Sin señal en la conjunción solar.
- **Generar:** retrato de Control de Misión, pantalla de mensajes estilo chat retro, ícono de señal viajando entre
  la Tierra y la nave, ilustración del Sol tapando a Marte (conjunción).

### 6.10 Panel de datos (`DataPanel`, tecla G)

- Gráficas de los datos reales alrededor de la fecha del jugador: dosis diaria con sus eventos, y en Marte frío y
  polvo (UV); en el viaje, los avisos de DONKI. La posición del jugador va marcada en el tiempo.
- **Generar:** marco de pantalla de laboratorio, íconos de cada instrumento (BioSentinel, Curiosity RAD, REMS),
  marcadores de evento (llamarada, partículas, CME).

### 6.11 Tarjeta "Esto pasó de verdad" (`DataCard`)

- Se abre sola, con el reloj en pausa, cuando un dato real causa algo: fecha, misión e instrumento ("Artemis I /
  HERA · NASA"), el valor traducido para chicos ("64 veces lo normal"), una frase, el enlace a la fuente y,
  si el valor está recortado, un aviso.
- Eventos reales de la campaña 2024: cruce de Van Allen (Artemis I, 16/11/2022), tormentas en espacio profundo
  (BioSentinel: 29/01, 09/02, 23/03, **11/05**, 08/06, 23/07, 15/09, 09/10/2024), tormenta en Marte (Curiosity,
  **20/05/2024**), polvo (28/05/2024), noche extrema (24/05/2024).
- **Generar:** marco de tarjeta coleccionable (como figurita), **una ilustración por tipo de evento** (cinturones
  de Van Allen alrededor de la Tierra, llamarada solar, nube de partículas llegando a la nave, tormenta de polvo
  sobre Gale, noche helada en Marte, conjunción solar) y una por instrumento o misión (Orion de Artemis I,
  BioSentinel, Curiosity).
- *Prompt:* `pixel art collectible card illustration, solar flare erupting from the Sun and particles streaming toward a small spacecraft, educational, bright, no text`.

### 6.12 Carga de vuelta (`Loadout`, modo vuelta)

- La nave de ascenso tiene un **límite de masa**: filas para muestras, comida, agua para beber, escudo de agua y
  repuestos, con botones − y +, la masa total contra el límite y un semáforo por suministro.
- **Generar:** fondo de la nave de ascenso en el cráter con la bodega abierta; balanza o barra de masa con forma de
  báscula; cajitas de muestras de roca; íconos de cada fila.

### 6.13 Pausa (`Pause`, Esc)

- Continuar, Guardar, Guardar y salir, Idioma; estado del guardado.
- **Generar:** panel de pausa (puede ser la escotilla de la nave), ícono de disquete o de bandera.

### 6.14 Informe de misión (`Report`)

Tres páginas:

1. **Resumen:** las **3 estrellas** (tripulación sana, dosis baja, muestras en la Tierra), los **logros** ("Refugio
   a tiempo", "Como Opportunity", "Cero radiografías extra", "Sobreviviste a la X9.0"), cómo bajó cada tripulante
   (caminando o en camilla) y su dosis en radiografías, las muestras traídas y la distancia del aterrizaje.
2. **Tu misión:** la **dosis real de cada día** (azul en el espacio, naranja en Marte) sobre una línea de tiempo con
   las decisiones y los incidentes, y la lista fecha por fecha.
3. **Datos reales:** las tarjetas vividas con su fuente, y por qué la NASA estudia una nave nuclear.

- **Estados:** misión cumplida (festiva) o **misión suspendida** (tono tranquilo: "la tripulación está a salvo
  esperando rescate"; se ve la cadena de decisiones).
- **Generar:** estrellas grandes (llena y vacía), **medallas de cada logro** (refugio con escudo de agua; rover
  Opportunity con polvo; radiografía tachada; llamarada X9 vencida), ilustración final de la tripulación en la Tierra
  (cápsula en el océano, bote de rescate, saludando) y versión "a salvo esperando rescate" (todos juntos en el
  refugio, tranquilos, con una luz cálida), fondo con confeti espacial.

## 7. Lista de piezas priorizada

| Prioridad | Pieza | Escenas |
|---|---|---|
| 1 | Tileset de la nave (48 px) y props por cuarto, con variante gastada | Voyage |
| 1 | Tileset de la base y del suelo de Gale, Curiosity, paneles, overlays de noche y polvo | Mars |
| 1 | Íconos: medidores, salud (4), sistemas (≈ 10), semáforo, incidentes (10), sacrificios (≈ 10), candado | Hud, Planning, Maneuver, Loadout |
| 2 | Fondos de las 13 etapas de maniobra (+ variante con polvo para el aterrizaje) | Maneuver |
| 2 | Ilustraciones de las tarjetas de datos (≈ 6 eventos + 3 instrumentos) y marco | DataCard, Report |
| 2 | Key art y emblema del menú | Title, Boot |
| 3 | Retratos de los 4 tripulantes y de Control de Misión, con expresiones | Hud, MissionControl, Report |
| 3 | Medallas de logros, estrellas e ilustraciones finales | Report |
| 3 | Marcos de paneles, botones y barras (UI kit en pixel art) | Todas |

## 8. Qué evitar

- Texto dentro de las imágenes (rompe la traducción).
- Imágenes de muerte, heridas, sangre o pánico: el peor final es "a salvo esperando rescate".
- Dibujar datos inventados como si fueran reales (gráficas, números): las cifras las pone el juego desde los datos.
- Sistemas o lugares que el juego no tiene (armas, alienígenas, enemigos): la amenaza es el entorno real.
- Rojo como único indicador: siempre con forma o ícono.

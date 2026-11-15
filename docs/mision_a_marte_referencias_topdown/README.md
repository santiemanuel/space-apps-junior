# Misión a Marte | Referencias visuales para implementación

**Versión del paquete:** 1.0 · **Carácter:** concept art y referencias de UX, no assets finales.

Este paquete reúne **6 láminas originales** y **16 recortes de escenas** procedentes de cuatro de ellas. Incluye además una copia de la biblia visual entregada por el proyecto. Los recortes son prácticos para discutir y planificar sistemas individuales, pero su resolución es menor: para producir assets hay que recrearlos a escala de juego, no extraer tiles de estas capturas.

## 1. Cómo usar el paquete

- `01_laminas_originales/`: las seis composiciones sin modificaciones.
- `02_escenas_recortadas/`: cuatro cuadrantes de cada una de las primeras cuatro láminas, identificados con números y nombre del sector.
- `03_documentacion/biblia_visual_original.md`: especificación funcional y artística recibida.
- `03_documentacion/manifest.json`: índice de archivos y escenas.

Las láminas 05 y 06 son **tableros de concepto**, no capturas reales del juego ni atlas importables. Los paneles 01–04 son **mockups de gameplay**: el HUD y los textos generados son ilustrativos y no necesariamente representan mecánicas, métricas o copy definitivos.

## 2. Reglas visuales consolidadas

### Cámara y escala

- Resolución lógica de referencia: **1280 × 720** (escalado FIT).
- Mundo tileado en **48 × 48 px**, según la biblia original.
- Cámara **top-down / overhead 2D** para todos los módulos interiores de la nave, la base marciana, la esclusa y la exploración exterior sobre el terreno.
- Mostrar **solo una parte del mapa** alrededor del personaje activo. Pasillos y módulos pueden continuar fuera de los bordes. No reducir personajes o mobiliario para mostrar una nave entera.
- Personajes de acuerdo con la biblia: sprites fuente de **176 × 216 px**, representados alrededor de **0,38×** (aprox. 67 × 82 px), ajustando visualmente solo después de probar la legibilidad en pantalla.
- Un indicador ámbar bajo los pies distingue al personaje controlado, más una señal superior cuando sea necesario. No confundir el anillo con el área de colisión.
- La cámara sigue al jugador con suavizado y límites de mundo; se puede anticipar sutilmente en la dirección de marcha. Permitir visualizar por completo estaciones con las que se interactúa.
- Un **side-scroller** queda reservado a actividades que ganan claridad con alturas, escaleras o plataformas, por ejemplo mantenimiento exterior de una estructura orbital. No transformar la exploración marciana ordinaria en plataformas.

### Interfaz

- La zona de mapa y los sistemas de interfaz son capas independientes. La interfaz no se mueve con la cámara.
- Según biblia de `Voyage`: zona de juego de **912 px** + panel derecho de **368 px** como punto de partida. Validar si el panel fijo se necesita siempre; puede compactarse contextualmente durante exploración.
- Priorizar 3 medidores: **energía, aire/agua y salud**, más estados de tripulantes, alertas, objetivo actual y un minimapa de navegación.
- En 1280 × 720, usar texto legible, áreas clicables cómodas y evitar micropaneles apilados. Los valores deben venir de la simulación real, **nunca de los píxeles de las imágenes de concepto**.
- Riesgos en verde/amarillo/rojo **más** forma/símbolo; alertas con causa explícita y acción sugerida.
- **No incrustar textos, cifras ni logos tipográficos en los assets.** Internacionalización español/inglés desde el código.

### Materiales e identidad

- Nave: grises lavanda, azul tecnológico, bordes oscuros, iluminación naranja y amarilla.
- Marte: ocres, óxido y rosas polvorientos; invernadero con luz violeta; indicadores científicos cian.
- Estética de pixel art con formas claras, contornos consistentes y sombreado suave. Reducir el ruido visual en áreas transitables.
- Mascotas recurrentes: rana verde con moño, personaje naranja con monóculo, personaje amarillo con gafas, azul con gafas y copete, rosa con auriculares. **Atención:** la biblia narrativa menciona cuatro tripulantes (Vega, Miga, Brote, Senda), pero los concepts muestran cinco mascotas y a veces un avatar humano; resolver el reparto definitivo antes de producir sprites y HUD.

## 3. Índice de las escenas de gameplay

| Archivo (en `02_escenas_recortadas/`) | Uso sugerido | Vista | Elementos a reproducir |
|---|---|---|---|
| `01_01_nave_puente.png` | Puente de mando durante viaje | Top-down | ventana a la Tierra, monitores, consolas, interacción, HUD |
| `01_02_nave_emergencia.png` | Incidente ambiental | Top-down | luces rojas, alerta, refugio/depósitos, indicación clara del peligro |
| `01_03_base_invernadero.png` | Cultivo y soporte vital | Top-down | hileras de plantas, iluminación de crecimiento, máquina adyacente |
| `01_04_marte_muestras.png` | Recolección de muestras | Top-down | rocas objetivo, rover, huellas, terreno que continúa fuera de pantalla |
| `02_01_nave_comunicaciones.png` | Trabajo con radio y consola | Top-down | pantallas, ruta hacia otras salas, puesto de mando |
| `02_02_nave_escudo_agua.png` | Alerta de radiación y refugio | Top-down | depósitos azules, señales de alarma, trayecto hacia protección |
| `02_03_base_moxie.png` | Vida en la base y oxígeno | Top-down | invernadero, MOXIE, puerta/esclusa, varias estaciones |
| `02_04_marte_rover.png` | Salida de exploración | Top-down | rover, paneles solares, selección de roca, mapa parcial |
| `03_01_nave_sala_comun.png` | Comando/comunicaciones en rutina | Top-down | área de interacción, consola, zonas contiguas |
| `03_02_nave_alerta_radiacion.png` | Estado de emergencia | Top-down | pasillo, puerta segura, señalización y luces rojas |
| `03_03_base_hidroponia.png` | Producción de alimentos | Top-down | vegetación, tanques, luces violetas, equipos diferenciados |
| `03_04_marte_rocas.png` | Muestreo EVA | Top-down | roca resaltada, terreno rocoso, rover, minimapa |
| `04_01_nave_radio.png` | Comunicaciones cotidianas | Top-down | consola, astronauta con radio, ventanas |
| `04_02_nave_tormenta.png` | Respuesta urgente a tormenta | Top-down | ruta hacia refugio, iconografía de advertencia, sistema activo |
| `04_03_base_sistemas.png` | Reparación y cultivo | Top-down | generador, invernadero, maquinaria, salida a Marte |
| `04_04_marte_paneles.png` | Gestión de energía y muestras | Top-down | paneles solares, rover, terreno desplazable |

### Láminas de conjunto

- `05_catalogo_de_escenas`: esquema de localizaciones y mecánicas, incluyendo mantenimiento orbital lateral, distintos módulos de nave y recursos visuales.
- `06_biblia_visual_ilustrada`: organización de las familias de escenarios, interfaz y paleta; útil para conversaciones de arte y revisión de coherencia.

## 4. Mapa de traducción a sistemas del juego

| Familia visual | Escenas de la biblia | Implementación recomendada |
|---|---|---|
| Puente / comunicaciones / pasillos | `Voyage`, `MissionControl` | tilemap navegable, zonas de interacción, cámara de seguimiento, UI de radio superpuesta |
| Enfermería / despensa / ejercicio | `Voyage` | props interactivos, estados del personaje y tareas con progreso |
| Agua / CO₂ / emergencia solar | `Voyage`, `Hud` | sprites de máquinas, variaciones de alerta, camino hasta refugio, estado de sistema |
| Invernadero / MOXIE | `Mars` | sala accesible, estación interactiva, estados operacional/avería y luces cambiantes |
| Esclusa / Marte exterior | `Mars` | transición sin ruptura de escala, cámara que sigue al jugador, límites de EVA |
| Rover / muestreo / paneles | `Mars` | objetos de recogida, puntos de interés, barreras de colisión y efectos de polvo |
| Maniobras de vuelo | `Maneuver` | pantallas específicas de timing y control: no confundir con cinemáticas |
| Mantenimiento lateral | propuesta especial / EVA | nivel side-scroller jugable solo cuando la verticalidad aporte una mecánica real |
| Planificación / datos / registro | `Planning`, `DataPanel`, `DataCard`, `Report` | UI independiente del mapa, generada por código; datos tomados de fuentes reales |

## 5. Producción de assets: orden de trabajo sugerido

1. **Bloquear escala y cámara:** prototipo con tile 48 px, personaje de ~82 px alto, panel lateral y desplazamiento fluido; probar a tamaño real en monitor HD.
2. **Tilesets modulares:** suelo, muros, puertas, ventanas, pasillos, esquinas y juntas, con bordes que permitan continuidad al desplazarse.
3. **Props por sala:** consola, bici, depurador, reciclador, camas, despensa, refugio, radio, MOXIE, cultivos y esclusa. Crear sprites opacos/transparencias según corresponda y puntos de interacción.
4. **Terreno de Marte:** arena tileable, piedras, acantilados, huellas, rover, paneles y rocas de muestras. Versiones de día/noche/tormenta; no pegar el escenario completo como una sola imagen.
5. **Personajes y animaciones:** definir reparto y escalas; caminar en cuatro direcciones, tarea, reposo, EVA y refugio. Preparar hitbox separada del arte.
6. **UI kit:** medidores, cuadros, tabs, retratos, alertas, minimapa, diálogos y botones, todo con texto programático.
7. **Estados de daño y ambiente:** red de luces, máquinas averiadas, parpadeo, polvo, baja energía y retorno con nave gastada.
8. **Escenas lateralizadas concretas:** prototipar primero la necesidad de salto/escalera/travesía antes de producir un tileset side-scroller.

## 6. Reglas de integración técnica

- Destino previsto según biblia: `public/assets/ship/`, `public/assets/mars/`, `public/assets/ui/`, `public/assets/characters/`.
- Mantener por separado: `background`, `world_tiles`, `props`, `characters`, `interaction_markers`, `world_fx` y `screen_ui`.
- Cada prop interactivo debería tener: `id`, posición de tile, zona de colisión, punto de interacción, estados y etiqueta traducible.
- En los interiores, emplear capas altas transparentadas cuando oculten al jugador.
- El minimapa representa el mundo completo o lo explorado, independientemente del área visible por la cámara.
- Escalar al monitor mediante FIT y probar lectura de UI a 100% y 125%; evitar que la pantalla conceptual determine las dimensiones de colisión.
- Los colores y números dibujados en las láminas no son muestras exactas de datos ni resultados validables.

## 7. Qué NO hacer

- No utilizar los cuatro cuadrantes de una lámina como un único fondo jugable.
- No estirar una captura a 1280 × 720 para convertirla en escena real; son referencias, no renders de tiles.
- No comprimir el mapa entero en una única pantalla ni cambiar la escala de personaje de una zona a otra.
- No generar una cinemática para una acción que requiere control del jugador.
- No convertir todo Marte en un side-scroller por estética: el recorrido principal es top-down.
- No extraer automáticamente texto de los mockups: traducir los contenidos desde UI real.
- No implementar métricas inventadas que aparecen en las imágenes.

## 8. Cobertura y límites

Estas **seis** láminas representan las últimas referencias generadas. Las cuatro primeras generan 16 recortes y las otras dos son paneles de síntesis. **No cubren todos los estados de producción** de la biblia: falta diseñar por separado el menú, carga, loadout, etapas de maniobra, planificación, datos científicos, pausa, resultados y varios incidentes. Eso no significa que no existan en el documento: significa que el material gráfico de este paquete no los especifica a nivel de pantalla final.

Las composiciones visuales contienen textos o elementos de HUD generados automáticamente y algunas inconsistencias de personajes. Para el juego final se aplican **las reglas de la biblia y las decisiones de diseño acordadas**, no los detalles accidentales de estas ilustraciones.

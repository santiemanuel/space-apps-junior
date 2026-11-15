# Prototipos — escenas de despegue

Mockups para rehacer la pantalla de `Maneuver` en los dos despegues (`ascent` desde la Tierra y `marsAscent` desde
Gale). Son **concept art**, no recursos del juego: no se recortan piezas de acá ni se copian textos o cifras (los
paneles llevan sólo formas a propósito).

- Generados con codex-cli (`scripts/art/gen.sh`), prompts en `art/prompts/proto-despegue-*.txt`, crudos en `art/raw/`.
- Referencias adjuntas: láminas 05 y 06 de [`mision_a_marte_referencias_topdown/`](../mision_a_marte_referencias_topdown/README.md)
  (paneles side-scroller: «Marte – Exploración», «Mantenimiento exterior», «Vista del cráter Gale») y la captura
  actual de cada paso en `art/capturas/despegue/`.
- Las mascotas de los mockups son genéricas; en el juego siguen Vega, Miga, Brote y Senda con sus sprites.

## Escenas

| Archivo | Momento | Qué tomar |
|---|---|---|
| `01-amanecer.png` | Tierra · amanecer, checklist Go/No-Go | complejo costero, mar y sol bajo, torre roja con brazo de acceso, vapor, tribuna, tripulación caminando a la torre, combi |
| `02-abordaje.png` | Tierra · abordaje | plano cercano: ascensor que sube por la torre, pasarela a la escotilla abierta, flechas grandes como botones |
| `03-combustible.png` | Tierra · carga de combustible | tanques esféricos, caños con escarcha, cascada de vapor criogénico, foso de llamas, medidor de tanque con franja verde |
| `04-cuenta.png` | Tierra · cuenta regresiva al atardecer | brazo retirado, balizas rojas, chispas de ignitores, público con banderitas, anillo de cuenta regresiva arriba |
| `05-ignicion.png` | Tierra · despegue | columna de fuego, humo que cubre todo el suelo, brillo en el agua, tripulación saludando desde el edificio, temblor |
| `06-separacion.png` | Tierra · alta atmósfera | horizonte curvo, separación de propulsores, aguja de pilotaje con franjas rojo/amarillo/verde, retratos de la tripulación |
| `07-marte-base.png` | Marte · mañana en Gale, checklist | monte Sharp, domos y paneles de la base, rover, nave de ascenso con patas sobre la plataforma, manguera de combustible, manga de viento |
| `08-marte-ignicion.png` | Marte · despegue | anillo de polvo rojo con piedras que vuelan, base iluminada por el fuego, tripulación en el mirador |
| `09-marte-orbita.png` | Marte · entrada en órbita | Marte curvo con atmósfera fina, Fobos, la nave nodriza esperando con la compuerta abierta |

## Lo que se lleva al juego

- **Vista lateral detallada** (pixel art a escala 4, como hoy), con escenografía por capas: cielo por momento del día,
  fondo lejano (mar/costa o monte Sharp), plataforma media (torre, tanques, base) y primer plano (barandas, plantas,
  rocas). Los fondos lejanos pueden seguir dibujados con código; torre, tanques, plataforma, nave y base pasan a ser
  imágenes generadas (pipeline de `AGENTS.md`).
- **Panel del minijuego** abajo a la derecha, más grande y con marco (bordes con remaches y luces como en las
  láminas), íconos en lugar de texto donde se pueda y el texto real desde `t()`.
- **Barra superior** con el nombre, el progreso de etapas como puntos y el combustible.

## Secuencia más larga (propuesta)

Pedido: más etapas jugables, momentos cinemáticos y una cuenta regresiva larga, para que el despegue dé anticipación.

**Tierra (`ascent`)**

1. *Cinemático* — amanecer: la cámara recorre el complejo de izquierda a derecha y la tripulación camina hasta la
   torre (se saltea con Espacio).
2. Checklist Go/No-Go.
3. Cargar combustible (vapor que crece mientras se llena).
4. Abordaje (ascensor subiendo y tripulantes cruzando la pasarela).
5. **Nueva:** cerrar la escotilla y presurizar la cabina (mantener la presión en la franja verde).
6. **Nueva:** prueba de radio con el control de la misión (repetir la secuencia de luces).
7. **Cuenta regresiva larga** desde T-60, acelerada a unos 20 s, con hitos narrados y visibles: T-45 se retira el
   brazo de acceso, T-30 balizas y público de pie, T-15 agua del sistema antiruido, T-10 jugable como hoy, T-6
   encendido de motores (chispas), T-0 ignición.
8. *Cinemático* — despegue: humo que cubre el suelo, temblor, el público festeja, la cámara sigue al cohete.
9. Giro hacia la órbita, separación de propulsores y separación de etapa (como hoy).

**Marte (`marsAscent`)**: mismo arco, más corto. Cinemático de la mañana en Gale → checklist → combustible →
abordaje → presurizar → cuenta regresiva desde T-30 → cinemático del despegue con anillo de polvo → entrada en
órbita con la nave nodriza a la vista.

## Lo que quedó en el juego (punto medio)

La interfaz casi no cambió (barra de arriba, checklist y panel del minijuego en el mismo lugar); lo que mejoró es la
ilustración y la secuencia:

- **Escenografía generada** a partir de estos mockups: costa y plataforma con gradas, torre roja con ascensor y brazo,
  tanques con escarcha, cohete más grande con propulsores; en Gale, monte Sharp, base con domos, torre de servicio
  y nave de ascenso. Cielo en franjas de pixel art (amanecer en la Tierra, mañana polvorienta en Marte). Detalle de
  los recursos en [`pixel-art.md`](../pixel-art.md).
- **Escena de entrada** (se saltea con Espacio): primer plano de la llegada (combi en la Tierra, puerta de la base
  en Marte) y la cámara se abre a toda la plataforma.
- **Etapas nuevas:** presurizar la cabina (Tierra y Marte) y prueba de radio con ondas desde el edificio de control
  (Tierra). La de Marte que se llamaba «Sellar la escotilla» ahora es el abordaje.
- **Cuenta regresiva larga:** T-60 en la Tierra y T-30 en Marte, con los preparativos a la vista y anunciados: brazo
  que se retira, balizas y público que festeja, agua bajo la plataforma, chispas y motores que arrancan (en Marte,
  la torre de servicio que se inclina y el polvo).
- **Despegue más largo:** humo que cubre todo el suelo, temblor, llamas en los propulsores, el cohete arranca despacio
  y se achica al alejarse; en Marte aparece la nave nodriza en la entrada en órbita.

Capturas del resultado: `art/capturas/despegue-v2/` (antes: `art/capturas/despegue/`).

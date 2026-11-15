# Sonidos propios por evento · Space Apps Junior

**40 eventos · 72 prompts para ElevenLabs Sound Effects · 15 de noviembre de 2026** · **Estado:** generados e integrados al juego (`public/assets/audio/sfx/`).

Tercera tanda de efectos, después de `sonidos-space-apps.md` (los 36 originales) y de `prompts-sonidos-faltantes.md`
(los 28 «faltantes»), que están fuera del repo; lo que ya está en el juego se lista en
[`public/assets/audio/README.md`](../public/assets/audio/README.md). Sale de revisar el juego: qué minijuegos, maniobras, eventos y pantallas reciclan un sonido
genérico (`paso-correcto`, `paso-incorrecto`, `confirmar`, `abrir-panel`) o no suenan. La **música queda fuera**:
es una tarea aparte.

Cada bloque es autónomo, en inglés y tiene como máximo **450 caracteres**. Las duraciones son objetivos creativos,
no mediciones. Los nombres siguen la convención de las tandas anteriores (`snake_case`; en el juego se copian a
`public/assets/audio/sfx/` en `kebab-case`). La línea **Dónde va** dice qué parte del código lo dispara, para
conectarlo después sin buscar.

## Dirección sonora y uso

- Misma identidad: **instrumentos de exploración cálidos**. La firma **cerámica + vidrio cálido + aire suave** queda
  para la interfaz; los minijuegos suenan al **material de la acción** (filtro, caño, fusible, tierra, tela, agua).
- Que cada minijuego tenga su propio carácter: el jugador debería reconocer la sala con los ojos cerrados. Aciertos
  chicos y táctiles; los errores, un tope acolchado del mismo material (nunca un buzzer).
- Sin música, fanfarrias, arpegios, monedas, 8-bit ni impactos de tráiler. Público de 7–12 años: tensión legible,
  no agresiva.
- **Looping activado** sólo en los clips marcados como loop; arranques y cierres van aparte. Verificar el empalme
  escuchando varias vueltas.
- Clips muy cortos: generar más largo y recortar, con fades de 3–10 ms; no rellenar con silencio.
- Las variantes se guardan en archivos separados (`_01`, `_02`); el juego las alterna para que no canse.

## 1. Lo que hoy suena mal (se corrige con los archivos de esta tanda)

| Evento | Hoy suena | Pasa a sonar |
|---|---|---|
| Depurador: atrapar CO₂ | `contacto-herramienta` | `scrubber_catch` (02) |
| MOXIE funcionando | `contacto-herramienta` | `moxie_oxygen` (05) |
| Sellos de la esclusa: limpiar | `conectar-modulo` | `seal_brush_loop` (15) |
| Invernadero: luz y mariquitas | loop de riego (igual que el agua) | `grow_light_on`, `ladybugs_release` (14) |
| Carga de vuelta: bodega lista | `incidente-resuelto` | `hold_sealed` (36) |
| Informe: cada estrella | `paso-correcto` | `report_star` (40) |

---

## 2. Minijuegos de las salas

### 01. Bici fija: fuera de ritmo

**Nombre base sugerido:** `bike_off_pace`

**Producción e integración:** Una toma: 0,4–0,6 s; 2 variantes. Suena con «muy rápido» o «más rápido»; el pedaleo
sigue con su loop (`exercise_bike_loop`).

**Dónde va:** `MinigameView`, mensajes `tooFast` / `faster` de `BikeGame`.

**Cadena que patina** · `bike_off_pace_01.wav`

```text
A stationary exercise bike briefly loses rhythm: a soft chain slip, a light uneven pedal knock and a short freewheel whirr settling. Gentle, tactile and close, inside a small spacecraft gym. One short event. No crash, squeak, music, voices, beeps or arcade sounds.
```

**Pedal que se frena** · `bike_off_pace_02.wav`

```text
A stationary bike flywheel slows with a soft resistance drag and a muted pedal thud, like a rider pushing too gently. Short, warm and mechanical, close perspective. One clean event with a natural short tail. No squeal, crash, music, voices, beeps or arcade sounds.
```

### 02. Depurador de CO₂

**Nombre base sugerido:** `scrubber_catch`, `scrubber_oxygen_lost`

**Producción e integración:** Dos tomas cortas: 0,25–0,4 s. Atrapar CO₂ (acierto) y atrapar oxígeno por error.
Variar altura de reproducción en código para que la ráfaga de capturas no canse.

**Dónde va:** `MinigameView`, mensajes `caught` / `oxygen` de `ScrubberGame`.

**Filtro atrapa CO₂** · `scrubber_catch.wav`

```text
A small air filter cartridge quickly captures a puff of gas: a soft suction pull, a tiny felt-damped thump and a faint airy settle. Clean, satisfying and compact, heard close inside a spacecraft. One short event. No pop, bubble, beep, music, voices or arcade sounds.
```

**Se escapa el oxígeno** · `scrubber_oxygen_lost.wav`

```text
A small puff of clean air slips out of a filter by mistake: a short soft reversed suction, a gentle hollow whoosh and a muted flap. Mild and forgiving, not alarming. One short event. No buzzer, alarm, beep, music, voices or arcade sounds.
```

### 03. Radio de la sala: sintonizar

**Nombre base sugerido:** `radio_tuning_loop`, `radio_lock`

**Producción e integración:** Loop de estática 4–6 s cuyo volumen el juego baja al acercarse a la señal (no
generar varias intensidades). Una toma de 0,8–1,2 s al enganchar la llamada.

**Dónde va:** `MinigameView` con `RadioGame` (salas): volumen según la distancia del dial; `radio_lock` al ganar.

**Estática del dial** · `radio_tuning_loop.wav`

```text
Soft analog radio static from a spacecraft comms console while a dial searches for a signal: gentle hiss, faint shifting tones and subtle warbles, warm and not piercing. Continuous steady texture for a seamless loop, no start or stop. No voices, words, music, melody or harsh noise bursts.
```

**Señal enganchada** · `radio_lock.wav`

```text
A spacecraft radio locks onto a clear signal: the static quickly thins away, a short warm carrier tone appears and settles with a tiny ceramic click. Clean, reassuring, one compact event. No voices, words, music, melody, arpeggio or arcade reward chime.
```

### 04. MOXIE: calentar

**Nombre base sugerido:** `moxie_heat_loop`

**Producción e integración:** Loop 3–5 s mientras se mantiene E. El juego sube la altura con la temperatura; no
incluir subida dentro del clip.

**Dónde va:** `MinigameView` con `MoxieGame`: activo mientras se mantiene E.

**Calentador** · `moxie_heat_loop.wav`

```text
A compact electric heating element warms inside a small metal machine: a steady low electrical hum, a soft resistive buzz and faint thermal ticking of expanding metal. Controlled and scientific, close perspective. Seamless steady loop, no start or stop. No fire, roar, alarm, music or voices.
```

### 05. MOXIE: oxígeno y recalentamiento

**Nombre base sugerido:** `moxie_oxygen`, `moxie_overheat`

**Producción e integración:** Dos tomas: 0,6–1 s. `moxie_oxygen` cuando separa oxígeno («working»);
`moxie_overheat` al pasarse de 950 °C («hot»).

**Dónde va:** `MinigameView`, mensajes `working` / `hot` de `MoxieGame`.

**Sale oxígeno** · `moxie_oxygen.wav`

```text
A small scientific machine releases a gentle stream of freshly made oxygen: a soft clean gas flow through a thin tube, a light bubbling in a sealed chamber and a quiet valve click. Calm, satisfying and precise. One short event. No music, voices, beeps or arcade reward.
```

**Se pasa de calor** · `moxie_overheat.wav`

```text
A small hot metal machine pauses to protect itself: a soft thermal crack of cooling metal, a short relay clunk and a gentle descending fan whirr. Cautionary but calm, not dangerous. One short event. No alarm, siren, explosion, music, voices or arcade sounds.
```

### 06. Enfermería: tomar el pulso

**Nombre base sugerido:** `heartbeat`, `pulse_monitor_beep`

**Producción e integración:** Latido 0,4–0,6 s, sonando con cada latido que cruza la línea (lo programa el juego).
Bip del monitor 0,15–0,25 s al acertar.

**Dónde va:** `PulseGame`: `heartbeat` en cada latido de la pantalla; `pulse_monitor_beep` con el mensaje `hit`.

**Latido** · `heartbeat.wav`

```text
One soft human heartbeat heard through a medical stethoscope: a warm low double thump, rounded and gentle, close and intimate. Calm and friendly, not scary. One single beat with a short natural decay. No music, voices, monitor beep, horror effect or reverb.
```

**Bip del monitor** · `pulse_monitor_beep.wav`

```text
One short soft medical monitor beep in a small spacecraft infirmary, rounded and warm with a tiny ceramic click attack. Friendly and calm, 0.2 seconds, immediate start and clean decay. No alarm, harsh tone, melody, music or voices.
```

### 07. Fusibles

**Nombre base sugerido:** `fuse_insert`, `electric_spark`

**Producción e integración:** `fuse_insert` 0,3–0,5 s (el acierto). `electric_spark` 0,3–0,5 s, 2 variantes,
para el fusible equivocado y el cable de otro color (minijuego 08).

**Dónde va:** `MinigameView`, mensajes `fixed` / `notBurnt` de `FusesGame` (hoy `interruptor-fisico` y error genérico).

**Fusible que encaja** · `fuse_insert.wav`

```text
A small cylindrical electrical fuse is pushed into a spring-loaded holder and seats firmly: a crisp metal-on-metal click with a tiny ceramic body knock and a faint electric hum appearing. Precise and satisfying, close up. One short event. No spark, buzzer, music or voices.
```

**Chispa corta (1)** · `electric_spark_01.wav`

```text
A tiny harmless electrical spark from a wrong connection: a short soft crackle and a quick dull snap, then silence. Small and cautionary, not dangerous or loud. One short event. No explosion, zap laser, buzzer, alarm, music or voices.
```

**Chispa corta (2)** · `electric_spark_02.wav`

```text
A brief small arc between two loose wire ends: a quick fizzing crackle, a faint ozone-like hiss and a tiny dull pop. Gentle and short, a mistake not a danger. One short event. No explosion, sci-fi zap, buzzer, music or voices.
```

### 08. Empalme de cables

**Nombre base sugerido:** `wire_select`, `wire_splice`

**Producción e integración:** `wire_select` 0,1–0,2 s al moverse entre puntas (muy bajo). `wire_splice` 0,4–0,6 s
al unir. El error usa `electric_spark`.

**Dónde va:** `MinigameView` con `WiresGame`: flechas ↑ ↓ y mensaje `joined` (hoy `conectar-modulo`).

**Elegir punta** · `wire_select.wav`

```text
A tiny soft tap of a rubber-insulated wire end touched by a gloved finger, with a faint flexible cable rustle. Very short, close and quiet. One single event. No click of a button, spark, beep, music or voices.
```

**Unir los cables** · `wire_splice.wav`

```text
Two copper wire ends are twisted and clamped together in a small splice connector: a short metallic twist, a firm crimp click and a soft tape wrap. Practical and satisfying, close outdoor-gear foley. One short event. No spark, beep, music, voices or arcade reward.
```

### 09. Reciclador de agua: girar caños

**Nombre base sugerido:** `pipe_rotate`

**Producción e integración:** Una toma: 0,25–0,4 s; 2 variantes. Cada giro de caño (hoy no suena). El agua al
completar el circuito sigue con `flujo-agua`.

**Dónde va:** `WaterGame`: cada vez que se gira una pieza con E.

**Caño que gira (1)** · `pipe_rotate_01.wav`

```text
A short metal pipe elbow is rotated a quarter turn in its fitting: a smooth metallic scrape and a solid seated clunk. Small, tactile and plumbing-like, close up inside a spacecraft. One short event. No water, squeak, music, voices or arcade sounds.
```

**Caño que gira (2)** · `pipe_rotate_02.wav`

```text
A compact pipe section turns and locks into place with a firm gasket squeeze and a muted hollow metal knock. Tactile and satisfying, close perspective. One short event. No water flow, squeal, music, voices or arcade sounds.
```

### 10. Rastreador de estrellas

**Nombre base sugerido:** `star_tracker_step`, `star_lock`

**Producción e integración:** `star_tracker_step` 0,1–0,2 s por paso de giro (bajo, se repite mucho). `star_lock`
0,6–0,9 s al fijar la constelación.

**Dónde va:** `StarsGame`: cada paso con ← → y mensaje `locked` (hoy acierto genérico); `notYet` usa un error suave.

**Paso del servo** · `star_tracker_step.wav`

```text
One tiny precise servo step of an optical star tracker rotating on a spacecraft: a short soft motor tick with a faint gear whirr. Delicate, quiet and mechanical. One single event, immediate start. No beep, music, voices or arcade sounds.
```

**Constelación fijada** · `star_lock.wav`

```text
An optical star tracker locks onto its target: a smooth servo settles, a soft mechanical latch clicks and a gentle warm glass resonance blooms briefly. Precise, calm and quietly rewarding. One compact event. No melody, arpeggio, fanfare, music or voices.
```

### 11. Parche de la fuga

**Nombre base sugerido:** `leak_detector_beep`, `patch_apply`, `patch_miss`

**Producción e integración:** Detector: un solo bip de 0,08–0,12 s; el juego lo repite más rápido al acercarse a la
fuga (hoy el minijuego dice que «suena» pero es mudo). Parche 0,4–0,6 s. Parche sin fuga 0,3–0,4 s.

**Dónde va:** `PatchGame`: bip según la distancia al agujero; mensajes `patched` / `noLeak`.

**Bip del detector** · `leak_detector_beep.wav`

```text
One short soft electronic detector blip from a handheld leak finder, rounded and warm with a tiny click attack, 0.1 seconds. Clear on small speakers, not shrill. One single blip, clean decay. No melody, alarm, static, music or voices.
```

**Parche que se pega** · `patch_apply.wav`

```text
An adhesive repair patch is pressed firmly onto a curved metal wall: a soft sticky peel, a palm press thump and a short air hiss that stops as the hole seals. Reassuring and tactile, close inside a spacecraft. One short event. No music, voices, beeps or arcade reward.
```

**Parche donde no hay fuga** · `patch_miss.wav`

```text
A repair patch is pressed onto a solid metal wall where nothing leaks: a soft hollow pat and a light sticky sound, no hiss. Mild and slightly unsatisfying, not punishing. One short event. No buzzer, beep, music, voices or arcade sounds.
```

### 12. Cocina: ingredientes

**Nombre base sugerido:** `ingredient_add`, `ingredient_return`

**Producción e integración:** `ingredient_add` 0,3–0,5 s, 2 variantes (bolsita y corte). `ingredient_return`
0,3–0,4 s cuando el ingrediente no sigue y vuelve a su lugar.

**Dónde va:** `MealGame`: mensaje `good` y el error al elegir mal.

**Ingrediente (bolsita)** · `ingredient_add_01.wav`

```text
A small sealed space-food pouch is opened and its contents gently added to a bowl: a soft foil crinkle, a tiny tear and a light food drop. Cozy, close and tactile. One short event. No eating, music, voices, beeps or arcade reward.
```

**Ingrediente (corte)** · `ingredient_add_02.wav`

```text
A few quick gentle knife cuts on a padded cutting board, then the pieces slide into a bowl. Soft, rhythmic and homely kitchen foley in a small spacecraft galley. One short event. No eating, music, voices, beeps or arcade sounds.
```

**Ingrediente que vuelve** · `ingredient_return.wav`

```text
A small food container is set back onto a padded shelf: a soft placement knock and a light rattle of its contents. Neutral and gentle, like changing one's mind. One short event. No buzzer, error tone, music, voices or arcade sounds.
```

### 13. Refugio: bolsas de agua y partículas

**Nombre base sugerido:** `water_bag_place`, `particle_absorbed`, `particle_through`

**Producción e integración:** Bolsa 0,4–0,6 s (`filled`). Partícula frenada 0,2–0,3 s. Partícula que pasa
0,15–0,25 s (suma al dosímetro): muy bajo, se repite.

**Dónde va:** `ShieldGame`: mensajes `filled` / `blocked` y cada partícula que llega al hueco o al agua.

**Bolsa de agua** · `water_bag_place.wav`

```text
A heavy soft water bag is pushed into a wall gap: a dense squishy slosh, a muffled fabric thump and a short settling ripple inside. Satisfying and protective, close up. One short event. No splash spray, music, voices, beeps or arcade sounds.
```

**Partícula frenada** · `particle_absorbed.wav`

```text
A tiny energetic particle is stopped by a thick water shield: a short muted soft plop inside water with a faint fizz. Subtle and reassuring, abstract but physical. One short event. No laser, explosion, music, voices or arcade sounds.
```

**Partícula que pasa** · `particle_through.wav`

```text
One single soft crackle tick of a radiation dosimeter registering a particle, dry and short, 0.15 seconds. Clear but gentle, not frightening. One single tick, clean decay. No continuous Geiger stream, alarm, music or voices.
```

### 14. Invernadero: luz y mariquitas

**Nombre base sugerido:** `grow_light_on`, `ladybugs_release`

**Producción e integración:** 0,6–1 s cada uno. El agua sigue con `plant_water_loop` (sólo para la herramienta 1).

**Dónde va:** `PlantsGame`: mensaje `healthy` según la herramienta usada (2 = luz, 3 = mariquitas).

**Lámpara de cultivo** · `grow_light_on.wav`

```text
A plant grow lamp switches on above a seedling tray: a soft click, a gentle warm electrical hum swelling briefly and a faint glass resonance. Calm, nurturing and close. One short event. No buzzing insects, music, voices, beeps or arcade reward.
```

**Mariquitas** · `ladybugs_release.wav`

```text
A tiny container opens and a few ladybugs flutter out onto leaves: a soft lid pop, delicate wing flutters and light leaf rustles. Charming, natural and gentle. One short event. No loud buzzing, birds, music, voices or arcade sounds.
```

### 15. Esclusa: limpiar los sellos

**Nombre base sugerido:** `seal_brush_loop`, `dust_gust`

**Producción e integración:** Loop de cepillo 2–4 s mientras se mantiene E sobre una mancha. Ráfaga 1–1,5 s cuando
el minijuego trae más polvo (`gust`).

**Dónde va:** `SealsGame` (hoy `conectar-modulo` al limpiar): loop mientras se limpia, `dust_gust` con `gust`.

**Cepillo** · `seal_brush_loop.wav`

```text
A stiff small brush scrubs fine dust off a rubber door seal: steady soft bristle strokes, gritty friction and a faint rubber squeak, close and tactile. Even rhythm for a seamless loop, no start or stop. No music, voices, wind, beeps or arcade sounds.
```

**Ráfaga de polvo** · `dust_gust.wav`

```text
A brief gust of fine Martian dust hits a closed metal door from outside: a soft rushing wind burst and a light sandy patter against the hull, heard from inside. Short and noticeable but calm. One event with a natural fade. No storm loop, thunder, music or voices.
```

### 16. Cosecha del invernadero

**Nombre base sugerido:** `harvest_snip`, `harvest_miss`

**Producción e integración:** 0,25–0,4 s cada uno; el corte con 2 variantes.

**Dónde va:** `HarvestGame`: mensaje `cut` a punto y el corte verde o pasado.

**Corte a punto (1)** · `harvest_snip_01.wav`

```text
Small garden scissors cleanly snip a fresh plant stem: a crisp short blade cut, a tiny leaf rustle and the soft drop of a sprig into a tray. Fresh and satisfying. One short event. No music, voices, beeps or arcade reward.
```

**Corte a punto (2)** · `harvest_snip_02.wav`

```text
A quick clean pruning snip of a juicy green stem, a light crisp snap and leaves brushing as it is lifted. Close, natural and gentle. One short event. No music, voices, beeps or arcade sounds.
```

**Corte fuera de punto** · `harvest_miss.wav`

```text
Scissors cut a limp or unripe plant stem: a dull soft snip and a weak floppy leaf sound, slightly disappointing but gentle. One short event. No buzzer, error tone, music, voices or arcade sounds.
```

---

## 3. Maniobras

### 17. Abordaje: cinturones y traje

**Nombre base sugerido:** `seatbelt_click`, `suit_connect`

**Producción e integración:** Cinturón 0,2–0,3 s, 2 variantes, por cada flecha acertada. Traje 0,8–1,2 s al
terminar la secuencia.

**Dónde va:** `ManeuverScene` con `BoardGame` (`right` y fin de la etapa); hoy sólo suena el acierto genérico.

**Cinturón (1)** · `seatbelt_click_01.wav`

```text
A spacecraft seat harness buckle snaps shut: a firm metal latch click with a soft nylon strap tug. Close, crisp and reassuring. One short event. No music, voices, beeps or arcade sounds.
```

**Cinturón (2)** · `seatbelt_click_02.wav`

```text
A padded seat harness strap is tightened and locked: a quick webbing pull, a ratchet tick and a solid buckle clack. Close and tactile. One short event. No music, voices, beeps or arcade sounds.
```

**Conectar el traje** · `suit_connect.wav`

```text
A spacesuit umbilical hose connects to the seat's life support port: a firm twist-lock click, a short air flow hiss and a soft regulator tone of fresh air arriving. Reassuring and precise. One compact event. No alarm, music, voices or arcade reward.
```

### 18. Checklist: reparar con repuestos

**Nombre base sugerido:** `checklist_repair`

**Producción e integración:** 0,8–1,2 s. Al elegir «Reparar» en un sistema amarillo o rojo (hoy confirmar genérico).

**Dónde va:** `ManeuverScene.decide` con la decisión `repair`.

**Reparación rápida** · `checklist_repair.wav`

```text
A quick spacecraft repair with a spare part: a panel unlatches, a small module slides in and clicks, two short ratchet turns and the panel closes. Efficient and competent, close foley. One compact event. No alarm, music, voices, beeps or arcade reward.
```

### 19. Separación de propulsores

**Nombre base sugerido:** `booster_separation`

**Producción e integración:** 1–1,5 s. Hoy comparte `separar-etapas` con la separación de etapa; debe sonar más
grave y doble (dos propulsores).

**Dónde va:** `ManeuverScene.afterOutcome`, etapa `boosterSeparation`.

**Propulsores** · `booster_separation.wav`

```text
Two side boosters separate from a rocket, heard through the hull: a double deep pyrotechnic thump almost together, a heavy structural shudder and the engine roar briefly thinning as they fall away. Powerful but controlled. One event. No explosion blast, music or voices.
```

### 20. Separación del escudo térmico

**Nombre base sugerido:** `heat_shield_release`

**Producción e integración:** 0,8–1,2 s, más liviano que una separación de etapa.

**Dónde va:** `ManeuverScene.afterOutcome`, etapa `heatShieldSeparation` (aterrizaje en Marte).

**Escudo suelto** · `heat_shield_release.wav`

```text
A spacecraft heat shield is released during descent, heard from inside: a sharp light latch pop, a hollow metallic clang as it detaches and a short airy rush as it drops away. Clear and brief. One event. No explosion, alarm, music or voices.
```

### 21. Barra de timing de vuelo

**Nombre base sugerido:** `flight_confirm`, `flight_miss`

**Producción e integración:** 0,3–0,5 s cada uno. Par propio de cabina para las etapas de apretar a tiempo (hoy
`paso-correcto` / `paso-incorrecto`, los mismos de las salas).

**Dónde va:** `ManeuverScene.press` y el resultado de los minijuegos de vuelo.

**Confirmación de cabina** · `flight_confirm.wav`

```text
A cockpit command is confirmed: a firm toggle guard clicks, a short relay engages and a soft warm indicator tone answers once. Professional, calm and satisfying, inside a spacecraft cabin. One compact event. No melody, fanfare, music, voices or arcade reward.
```

**Corrección de cabina** · `flight_miss.wav`

```text
A cockpit command arrives slightly off: a muted toggle click, a soft thruster correction puff and a low gentle indicator tone. Corrective, not failure. One compact event. No buzzer, alarm, music, voices or arcade sounds.
```

---

## 4. Mundo y eventos

### 22. Tormenta solar: contador Geiger

**Nombre base sugerido:** `geiger_loop`

**Producción e integración:** Loop 4–6 s, crepitar irregular moderado. Mientras hay alerta de radiación y el
jugador no está en el refugio; bajar volumen adentro del refugio.

**Dónde va:** `SimulationMapScene.radiationAlert()` y la zona del jugador.

**Geiger** · `geiger_loop.wav`

```text
A radiation counter clicking irregularly at a moderate rate: dry soft crackling ticks with natural random spacing, heard close inside a spacecraft. Cautionary but not frightening, clear on small speakers. Seamless steady loop, no start or stop. No alarm, music, voices or harsh noise.
```

### 23. Llegar al refugio

**Nombre base sugerido:** `shelter_seal`

**Producción e integración:** 1–1,5 s. Al entrar al refugio durante la alerta (una vez por alerta).

**Dónde va:** `SimulationMapScene`, al pasar a la zona del refugio con `radiationAlert()` activa.

**Refugio sellado** · `shelter_seal.wav`

```text
A thick protective shelter hatch closes and seals: a heavy padded door swing, a firm latch lock and a soft pressure equalizing sigh, then quiet. Safe and reassuring, inside a spacecraft. One event. No alarm, music, voices or arcade sounds.
```

### 24. Falla del depurador

**Nombre base sugerido:** `machine_wind_down`

**Producción e integración:** 1,5–2,5 s. Al empezar el incidente `scrubberFailure`.

**Dónde va:** `SimulationMapScene`, `incident:started` (junto al toast).

**Máquina que se apaga** · `machine_wind_down.wav`

```text
A life support fan machine winds down after a fault: a motor hum descending in pitch, a soft rattle and a final relay click into silence. Noticeable and slightly worrying but calm, inside a spacecraft. One event. No alarm, explosion, music or voices.
```

### 25. Plaga del invernadero

**Nombre base sugerido:** `pest_buzz`

**Producción e integración:** 1,5–2 s. Al empezar `greenhousePest`.

**Dónde va:** `SimulationMapScene`, `incident:started`.

**Pulgones** · `pest_buzz.wav`

```text
A few tiny aphids and small insects busy among plant leaves: light delicate buzzing, soft leaf nibbling and rustling, close in a greenhouse tray. Curious, not creepy. One short event with a natural fade. No large flies, horror effect, music or voices.
```

### 26. Noche extrema

**Nombre base sugerido:** `hull_creak_cold`

**Producción e integración:** 1,5–2,5 s. Al empezar `coldNight` / `extremeNight`.

**Dónde va:** `SimulationMapScene`, `incident:started`.

**Casco con frío** · `hull_creak_cold.wav`

```text
A habitat hull contracts in extreme cold: slow soft metallic creaks, a faint icy wind outside and a low structural groan, heard from inside. Atmospheric and gently tense, not scary. One event with a natural fade. No horror effect, alarm, music or voices.
```

### 27. Conjunción solar

**Nombre base sugerido:** `radio_fade_static`

**Producción e integración:** 2–3 s. Al empezar `solarConjunction`: la comunicación con la Tierra se va apagando.

**Dónde va:** `SimulationMapScene`, `incident:started`.

**Radio que se apaga** · `radio_fade_static.wav`

```text
A distant radio link from Earth fades away: a faint carrier tone weakening into soft static, crackling briefly and dissolving into silence. Quiet, lonely and calm, from a spacecraft comms console. One event. No voices, words, music, melody or alarm.
```

### 28. Cable cortado

**Nombre base sugerido:** `cable_snap`

**Producción e integración:** 0,6–1 s. Al empezar `cableCut` (afuera en Marte).

**Dónde va:** `SimulationMapScene`, `incident:started`.

**Cable cortado** · `cable_snap.wav`

```text
A thick power cable outside a habitat snaps loose: a sharp electrical crackle, a brief arc fizz and a dull heavy cable slap on dusty ground, heard muffled from inside. Clear and brief. One event. No explosion, alarm, music or voices.
```

### 29. Fusible quemado

**Nombre base sugerido:** `fuse_pop`

**Producción e integración:** 0,4–0,6 s. Al empezar `fuseBlown` (antes del apagón, si lo hay).

**Dónde va:** `SimulationMapScene`, `incident:started`.

**Fusible quemado** · `fuse_pop.wav`

```text
An electrical fuse blows inside a wall panel: a sharp small pop, a tiny fizz and a faint burnt crackle, heard from across a room. Brief and noticeable, not scary. One event. No explosion, alarm, power-down hum, music or voices.
```

### 30. Aislamiento

**Nombre base sugerido:** `isolation_hush`

**Producción e integración:** 2–3 s, muy suave. Al empezar `isolation`: la tripulación extraña la Tierra. Nada de
alarma.

**Dónde va:** `SimulationMapScene`, `incident:started`.

**Silencio de la nave** · `isolation_hush.wav`

```text
A quiet lonely moment inside a small spacecraft: the ventilation hum softens, a distant gentle hull tick and a faint airy hush. Introspective and tender, not sad or scary. One event with a long soft fade. No music, melody, voices, alarm or heartbeat.
```

### 31. Nuevo sol

**Nombre base sugerido:** `habitat_morning`

**Producción e integración:** 1–1,5 s. Al empezar cada día (sol en Marte, día en el viaje). Bajo, sin campana
musical.

**Dónde va:** `SimulationMapScene` cuando cambia el día de `simDate`.

**Buenos días del hábitat** · `habitat_morning.wav`

```text
A spacecraft habitat wakes up for a new day: lights powering on with a soft rising hum, a gentle ventilation increase and a warm glass resonance. Bright, calm and welcoming. One event. No bell, melody, chime tune, music, voices or alarm.
```

### 32. Puerta exterior bloqueada

**Nombre base sugerido:** `outer_door_lock`

**Producción e integración:** 0,8–1,2 s. Cuando la puerta exterior de la esclusa se cierra por la noche o una
tormenta (`outerDoorClosed()` pasa a verdadero).

**Dónde va:** `MarsScene` / `SimulationMapScene.outerDoorClosed()`.

**Traba pesada** · `outer_door_lock.wav`

```text
A heavy airlock outer door bolts lock for the night: two deep mechanical bolts slide into place, a firm thud and a soft sealing hiss, heard from inside. Secure and calm. One event. No door swing, alarm, music or voices.
```

### 33. Cargar y guardar en el embarque

**Nombre base sugerido:** `cargo_stow`

**Producción e integración:** 0,6–1 s, 2 variantes. Cada vez que se carga o guarda algo en el embarque final (hoy
no suena).

**Dónde va:** `SimulationMapScene`, `s.doAction(activeZone)`.

**Guardar carga (1)** · `cargo_stow_01.wav`

```text
A padded cargo case is slid into a spacecraft storage rack and strapped: a soft sliding scrape, a firm shelf knock and a quick strap cinch. Practical and tidy. One short event. No music, voices, beeps or arcade sounds.
```

**Guardar carga (2)** · `cargo_stow_02.wav`

```text
A sealed sample container is placed into a foam-lined cargo slot and latched: a soft foam squeeze, a light plastic knock and a crisp latch click. Careful and satisfying. One short event. No music, voices, beeps or arcade sounds.
```

### 34. Salir antes (F)

**Nombre base sugerido:** `departure_scheduled`

**Producción e integración:** 1–1,5 s. Al confirmar el embarque anticipado (hoy confirmar genérico).

**Dónde va:** `MarsScene`, `s.leaveEarly()`.

**Embarque programado** · `departure_scheduled.wav`

```text
A spacecraft departure sequence is armed: a guarded switch flips, a series of soft relays engage one after another and a low steady systems hum rises. Purposeful and anticipating, not alarming. One event. No alarm, countdown voice, melody, music or arcade reward.
```

### 35. Curiosity cerca

**Nombre base sugerido:** `rover_motor_loop`

**Producción e integración:** Loop 3–5 s; el juego sube el volumen al acercarse al rover y lo apaga lejos.

**Dónde va:** `MarsScene`, distancia del jugador a Curiosity.

**Rover** · `rover_motor_loop.wav`

```text
A slow six-wheeled planetary rover driving over rocky dust, heard through a spacesuit: soft electric wheel motors whirring, gentle gravel crunch and a light suspension creak. Steady and calm for a seamless loop, no start or stop. No engine roar, music, voices or beeps.
```

### 36. Carga de vuelta: la bodega

**Nombre base sugerido:** `crate_lift`, `crate_place`, `crate_rotate`, `crate_blocked`, `hold_sealed`

**Producción e integración:** Cuatro tomas de 0,2–0,4 s y `hold_sealed` de 1–1,5 s. Reemplazan `abrir-panel`,
`confirmar`, `cambiar-interruptor`, `accion-invalida` e `incidente-resuelto` en la bodega.

**Dónde va:** `cargoGridView.ts` (levantar, apoyar, girar, no entra, confirmar la carga).

**Levantar cajón** · `crate_lift.wav`

```text
A small padded cargo crate is lifted off a rack: a soft scrape and a light hollow knock of its contents shifting. Close and tactile. One short event. No music, voices, beeps or arcade sounds.
```

**Apoyar cajón** · `crate_place.wav`

```text
A small padded cargo crate is set down into a storage grid slot: a firm soft thud and a short settle of foam. Close and satisfying. One short event. No music, voices, beeps or arcade sounds.
```

**Girar cajón** · `crate_rotate.wav`

```text
A small cargo crate is turned in place on a padded surface: a short soft scrape and a light corner knock. Quick and tactile. One short event. No music, voices, beeps or arcade sounds.
```

**No entra** · `crate_blocked.wav`

```text
A small cargo crate bumps against the edge of a full storage slot and does not fit: a dull soft knock and a slight scrape back. Gentle, not punishing. One short event. No buzzer, error tone, music, voices or arcade sounds.
```

**Bodega sellada** · `hold_sealed.wav`

```text
A spacecraft cargo hold is closed and secured: a padded hatch swings shut, two firm latches lock and a soft pressure seal sighs. Complete and reassuring. One event. No alarm, fanfare, music, voices or arcade reward.
```

### 37. Dato real recibido

**Nombre base sugerido:** `telemetry_received`

**Producción e integración:** 0,6–1 s. Cuando aparece un aviso de dato real (DONKI, Artemis I): hoy sólo hay toast.

**Dónde va:** `SimulationMapScene`, `realEvent:shown`.

**Telemetría** · `telemetry_received.wav`

```text
A data packet arrives at a spacecraft console from a distant mission: a short soft burst of digital chirps, a gentle carrier tone and a quiet ceramic click as it is saved. Curious and scientific. One compact event. No melody, voices, alarm, music or arcade reward.
```

---

## 5. Pantallas

### 38. Planificación: prender y apagar cargas

**Nombre base sugerido:** `power_relay`

**Producción e integración:** 0,2–0,3 s, 2 variantes (encender, apagar). Reemplaza `cambiar-interruptor` en la
pantalla de planificación (P), que es energía real de la base y no un ajuste.

**Dónde va:** `PlanningScene`, al cambiar una carga.

**Relé encendido** · `power_relay_01.wav`

```text
A heavy-duty electrical relay closes on a power panel: a solid clack and a faint electrical hum appearing. Short, crisp and physical. One event. No spark, beep, music or voices.
```

**Relé apagado** · `power_relay_02.wav`

```text
A heavy-duty electrical relay opens on a power panel: a solid clack and a faint hum fading out. Short, crisp and physical. One event. No spark, beep, music or voices.
```

### 39. Control de misión y panel de datos

**Nombre base sugerido:** `comms_panel_open`, `data_screen_open`

**Producción e integración:** 0,4–0,6 s cada uno. Reemplazan `abrir-panel` al abrir Control de misión (C) y el
panel de datos (G); el tablero de estado (I) y el mapa del cráter (V) siguen con `abrir-panel`.

**Dónde va:** `HudScene`, al abrir esas superpuestas.

**Control de misión** · `comms_panel_open.wav`

```text
A spacecraft comms console powers up: a soft switch click, a brief warm radio carrier hum and a faint static breath settling. Friendly and ready. One compact event. No voices, words, melody, music or alarm.
```

**Panel de datos** · `data_screen_open.wav`

```text
A science data screen wakes on a spacecraft console: a gentle display power-on whine, soft digital ticks of data loading and a quiet glass resonance. Curious and precise. One compact event. No melody, voices, music or arcade sounds.
```

### 40. Inicio de misión e informe final

**Nombre base sugerido:** `mission_start`, `report_star`, `achievement_unlock`

**Producción e integración:** `mission_start` 1–1,5 s al empezar una partida desde el título. `report_star`
0,4–0,6 s por cada estrella del informe (el juego sube la altura una por una). `achievement_unlock` 0,8–1,2 s por
cada logro.

**Dónde va:** `TitleScene` (empezar), `ReportScene` (estrellas y logros).

**Empezar la misión** · `mission_start.wav`

```text
A spacecraft mission begins: a main power switch engages, systems hum to life in a smooth rising swell and a soft confirming latch settles. Hopeful and ceremonial but restrained. One event. No melody, fanfare, music, voices or arcade sounds.
```

**Estrella del informe** · `report_star.wav`

```text
A small polished crystal star is set into a ceramic display slot: a gentle click and a warm bright glass resonance that rings briefly. Rewarding and soft. One compact event. No melody, arpeggio, coin, music, voices or arcade sounds.
```

**Logro** · `achievement_unlock.wav`

```text
A commemorative mission patch is pressed onto a fabric board: a soft fabric press, a light velcro grip and a warm glass shimmer. Proud and gentle. One compact event. No fanfare, melody, music, voices or arcade reward.
```

---

## Orden práctico y comprobación

1. Primero lo de la **sección 1**: corrige sonidos que hoy no corresponden a la acción.
2. Después el **detector del parche** (11) y el **Geiger** (22): son información para el jugador, no adorno.
3. Luego los minijuegos de las salas (01–16), probando cada uno dentro del juego: el acierto tiene que poder
   repetirse muchas veces sin cansar. Si cansa, bajar volumen o alternar variantes antes que generar más.
4. Los sonidos de incidentes (24–30) suenan junto con la alarma o sirena existentes: comprobar que no se tapen y
   que el aviso siga entendiéndose.
5. Loops nuevos (estática de radio, calentador, cepillo, Geiger, rover): entrada y salida controladas por el estado
   del juego, nunca reactivados en cada cuadro; se apagan al cambiar de escena o pausar.
6. Guardar cada variante por separado y anotar prompt, fecha y plan de generación. No se generaron ni se escucharon
   audios para este documento.

**Cuenta:** 40 eventos, 72 prompts/archivos propuestos. La música no está incluida (tarea aparte).


# Per-event sounds · Space Apps Junior

**40 events · 72 prompts for ElevenLabs Sound Effects · November 15, 2026** · **Status:** generated and integrated into the game (`public/assets/audio/sfx/`).

Third batch of effects, after `sonidos-space-apps.md` (the original 36) and `prompts-sonidos-faltantes.md` (the 28 "missing" ones), which are outside the repo; what is already in the game is listed in [`public/assets/audio/README.md`](../../public/assets/audio/README.md). It comes from reviewing the game: which minigames, maneuvers, events and screens reuse a generic sound (`paso-correcto`, `paso-incorrecto`, `confirmar`, `abrir-panel`) or make no sound. **Music is out of scope**: it is a separate task.

Each block is self-contained, in English and at most **450 characters**. Durations are creative targets, not measurements. Names follow the convention of the previous batches (`snake_case`; in the game they are copied to `public/assets/audio/sfx/` in `kebab-case`). The **Where it goes** line says which part of the code triggers it, so it can be wired later without searching.

## Sound direction and usage

- Same identity: **warm exploration instruments**. The **ceramic + warm glass + soft air** signature is kept for the interface; minigames sound like the **material of the action** (filter, pipe, fuse, soil, fabric, water).
- Each minigame should have its own character: the player should recognise the room with their eyes closed. Small, tactile successes; errors are a padded stop in the same material (never a buzzer).
- No music, fanfares, arpeggios, coins, 8-bit or trailer hits. Audience aged 7–12: readable tension, not aggressive.
- **Looping on** only for clips marked as loops; starts and endings are separate. Check the seam by listening to several passes.
- Very short clips: generate longer and trim, with 3–10 ms fades; do not pad with silence.
- Variants are saved as separate files (`_01`, `_02`); the game alternates them so they do not get tiresome.

## 1. What sounds wrong today (fixed by the files in this batch)

| Event | Sounds today | Will sound |
|---|---|---|
| Scrubber: catch CO₂ | `contacto-herramienta` | `scrubber_catch` (02) |
| MOXIE working | `contacto-herramienta` | `moxie_oxygen` (05) |
| Airlock seals: clean | `conectar-modulo` | `seal_brush_loop` (15) |
| Greenhouse: light and ladybugs | watering loop (same as water) | `grow_light_on`, `ladybugs_release` (14) |
| Return cargo: hold ready | `incidente-resuelto` | `hold_sealed` (36) |
| Report: each star | `paso-correcto` | `report_star` (40) |

---

## 2. Room minigames

### 01. Exercise bike: off pace

**Suggested base name:** `bike_off_pace`

**Production and integration:** One take: 0.4–0.6 s; 2 variants. Plays with "too fast" or "faster"; pedalling continues with its loop (`exercise_bike_loop`).

**Where it goes:** `MinigameView`, messages `tooFast` / `faster` from `BikeGame`.

**Slipping chain** · `bike_off_pace_01.wav`

```text
A stationary exercise bike briefly loses rhythm: a soft chain slip, a light uneven pedal knock and a short freewheel whirr settling. Gentle, tactile and close, inside a small spacecraft gym. One short event. No crash, squeak, music, voices, beeps or arcade sounds.
```

**Braking pedal** · `bike_off_pace_02.wav`

```text
A stationary bike flywheel slows with a soft resistance drag and a muted pedal thud, like a rider pushing too gently. Short, warm and mechanical, close perspective. One clean event with a natural short tail. No squeal, crash, music, voices, beeps or arcade sounds.
```

### 02. CO₂ scrubber

**Suggested base name:** `scrubber_catch`, `scrubber_oxygen_lost`

**Production and integration:** Two short takes: 0.25–0.4 s. Catching CO₂ (success) and catching oxygen by mistake. Vary playback pitch in code so a burst of catches does not get tiresome.

**Where it goes:** `MinigameView`, messages `caught` / `oxygen` from `ScrubberGame`.

**Filter catches CO₂** · `scrubber_catch.wav`

```text
A small air filter cartridge quickly captures a puff of gas: a soft suction pull, a tiny felt-damped thump and a faint airy settle. Clean, satisfying and compact, heard close inside a spacecraft. One short event. No pop, bubble, beep, music, voices or arcade sounds.
```

**Oxygen escapes** · `scrubber_oxygen_lost.wav`

```text
A small puff of clean air slips out of a filter by mistake: a short soft reversed suction, a gentle hollow whoosh and a muted flap. Mild and forgiving, not alarming. One short event. No buzzer, alarm, beep, music, voices or arcade sounds.
```

### 03. Room radio: tuning

**Suggested base name:** `radio_tuning_loop`, `radio_lock`

**Production and integration:** 4–6 s static loop whose volume the game lowers as the signal gets closer (do not generate several intensities). One 0.8–1.2 s take when the call locks.

**Where it goes:** `MinigameView` with `RadioGame` (rooms): volume by dial distance; `radio_lock` on winning.

**Dial static** · `radio_tuning_loop.wav`

```text
Soft analog radio static from a spacecraft comms console while a dial searches for a signal: gentle hiss, faint shifting tones and subtle warbles, warm and not piercing. Continuous steady texture for a seamless loop, no start or stop. No voices, words, music, melody or harsh noise bursts.
```

**Signal locked** · `radio_lock.wav`

```text
A spacecraft radio locks onto a clear signal: the static quickly thins away, a short warm carrier tone appears and settles with a tiny ceramic click. Clean, reassuring, one compact event. No voices, words, music, melody, arpeggio or arcade reward chime.
```

### 04. MOXIE: heating

**Suggested base name:** `moxie_heat_loop`

**Production and integration:** 3–5 s loop while E is held. The game raises the pitch with the temperature; do not include a rise inside the clip.

**Where it goes:** `MinigameView` with `MoxieGame`: active while E is held.

**Heater** · `moxie_heat_loop.wav`

```text
A compact electric heating element warms inside a small metal machine: a steady low electrical hum, a soft resistive buzz and faint thermal ticking of expanding metal. Controlled and scientific, close perspective. Seamless steady loop, no start or stop. No fire, roar, alarm, music or voices.
```

### 05. MOXIE: oxygen and overheating

**Suggested base name:** `moxie_oxygen`, `moxie_overheat`

**Production and integration:** Two takes: 0.6–1 s. `moxie_oxygen` when it separates oxygen ("working"); `moxie_overheat` when it goes over 950 °C ("hot").

**Where it goes:** `MinigameView`, messages `working` / `hot` from `MoxieGame`.

**Oxygen comes out** · `moxie_oxygen.wav`

```text
A small scientific machine releases a gentle stream of freshly made oxygen: a soft clean gas flow through a thin tube, a light bubbling in a sealed chamber and a quiet valve click. Calm, satisfying and precise. One short event. No music, voices, beeps or arcade reward.
```

**Too hot** · `moxie_overheat.wav`

```text
A small hot metal machine pauses to protect itself: a soft thermal crack of cooling metal, a short relay clunk and a gentle descending fan whirr. Cautionary but calm, not dangerous. One short event. No alarm, siren, explosion, music, voices or arcade sounds.
```

### 06. Infirmary: taking the pulse

**Suggested base name:** `heartbeat`, `pulse_monitor_beep`

**Production and integration:** 0.4–0.6 s heartbeat, playing with each beat that crosses the line (scheduled by the game). 0.15–0.25 s monitor beep on a hit.

**Where it goes:** `PulseGame`: `heartbeat` on each beat on screen; `pulse_monitor_beep` with the `hit` message.

**Heartbeat** · `heartbeat.wav`

```text
One soft human heartbeat heard through a medical stethoscope: a warm low double thump, rounded and gentle, close and intimate. Calm and friendly, not scary. One single beat with a short natural decay. No music, voices, monitor beep, horror effect or reverb.
```

**Monitor beep** · `pulse_monitor_beep.wav`

```text
One short soft medical monitor beep in a small spacecraft infirmary, rounded and warm with a tiny ceramic click attack. Friendly and calm, 0.2 seconds, immediate start and clean decay. No alarm, harsh tone, melody, music or voices.
```

### 07. Fuses

**Suggested base name:** `fuse_insert`, `electric_spark`

**Production and integration:** `fuse_insert` 0.3–0.5 s (the success). `electric_spark` 0.3–0.5 s, 2 variants, for the wrong fuse and the wrong-colored cable (minigame 08).

**Where it goes:** `MinigameView`, messages `fixed` / `notBurnt` from `FusesGame` (at the time `interruptor-fisico` and a generic error).

**Fuse clicks in** · `fuse_insert.wav`

```text
A small cylindrical electrical fuse is pushed into a spring-loaded holder and seats firmly: a crisp metal-on-metal click with a tiny ceramic body knock and a faint electric hum appearing. Precise and satisfying, close up. One short event. No spark, buzzer, music or voices.
```

**Short spark (1)** · `electric_spark_01.wav`

```text
A tiny harmless electrical spark from a wrong connection: a short soft crackle and a quick dull snap, then silence. Small and cautionary, not dangerous or loud. One short event. No explosion, zap laser, buzzer, alarm, music or voices.
```

**Short spark (2)** · `electric_spark_02.wav`

```text
A brief small arc between two loose wire ends: a quick fizzing crackle, a faint ozone-like hiss and a tiny dull pop. Gentle and short, a mistake not a danger. One short event. No explosion, sci-fi zap, buzzer, music or voices.
```

### 08. Cable splicing

**Suggested base name:** `wire_select`, `wire_splice`

**Production and integration:** `wire_select` 0.1–0.2 s when moving between wire ends (very quiet). `wire_splice` 0.4–0.6 s when joining. The error uses `electric_spark`.

**Where it goes:** `MinigameView` with `WiresGame`: ↑ ↓ arrows and the `joined` message (at the time `conectar-modulo`).

**Pick a wire end** · `wire_select.wav`

```text
A tiny soft tap of a rubber-insulated wire end touched by a gloved finger, with a faint flexible cable rustle. Very short, close and quiet. One single event. No click of a button, spark, beep, music or voices.
```

**Join the wires** · `wire_splice.wav`

```text
Two copper wire ends are twisted and clamped together in a small splice connector: a short metallic twist, a firm crimp click and a soft tape wrap. Practical and satisfying, close outdoor-gear foley. One short event. No spark, beep, music, voices or arcade reward.
```

### 09. Water recycler: turning pipes

**Suggested base name:** `pipe_rotate`

**Production and integration:** One take: 0.25–0.4 s; 2 variants. Each pipe turn (silent at the time). The water when the circuit is complete still uses `flujo-agua`.

**Where it goes:** `WaterGame`: every time a piece is turned with E.

**Turning pipe (1)** · `pipe_rotate_01.wav`

```text
A short metal pipe elbow is rotated a quarter turn in its fitting: a smooth metallic scrape and a solid seated clunk. Small, tactile and plumbing-like, close up inside a spacecraft. One short event. No water, squeak, music, voices or arcade sounds.
```

**Turning pipe (2)** · `pipe_rotate_02.wav`

```text
A compact pipe section turns and locks into place with a firm gasket squeeze and a muted hollow metal knock. Tactile and satisfying, close perspective. One short event. No water flow, squeal, music, voices or arcade sounds.
```

### 10. Star tracker

**Suggested base name:** `star_tracker_step`, `star_lock`

**Production and integration:** `star_tracker_step` 0.1–0.2 s per turning step (quiet, repeats a lot). `star_lock` 0.6–0.9 s when the constellation locks.

**Where it goes:** `StarsGame`: each step with ← → and the `locked` message (at the time a generic success); `notYet` uses a soft error.

**Servo step** · `star_tracker_step.wav`

```text
One tiny precise servo step of an optical star tracker rotating on a spacecraft: a short soft motor tick with a faint gear whirr. Delicate, quiet and mechanical. One single event, immediate start. No beep, music, voices or arcade sounds.
```

**Constellation locked** · `star_lock.wav`

```text
An optical star tracker locks onto its target: a smooth servo settles, a soft mechanical latch clicks and a gentle warm glass resonance blooms briefly. Precise, calm and quietly rewarding. One compact event. No melody, arpeggio, fanfare, music or voices.
```

### 11. Leak patch

**Suggested base name:** `leak_detector_beep`, `patch_apply`, `patch_miss`

**Production and integration:** Detector: a single 0.08–0.12 s beep; the game repeats it faster closer to the leak (at the time the minigame said it "beeps" but it was silent). Patch 0.4–0.6 s. Patch with no leak 0.3–0.4 s.

**Where it goes:** `PatchGame`: beep by distance to the hole; messages `patched` / `noLeak`.

**Detector beep** · `leak_detector_beep.wav`

```text
One short soft electronic detector blip from a handheld leak finder, rounded and warm with a tiny click attack, 0.1 seconds. Clear on small speakers, not shrill. One single blip, clean decay. No melody, alarm, static, music or voices.
```

**Patch sticks** · `patch_apply.wav`

```text
An adhesive repair patch is pressed firmly onto a curved metal wall: a soft sticky peel, a palm press thump and a short air hiss that stops as the hole seals. Reassuring and tactile, close inside a spacecraft. One short event. No music, voices, beeps or arcade reward.
```

**Patch where there is no leak** · `patch_miss.wav`

```text
A repair patch is pressed onto a solid metal wall where nothing leaks: a soft hollow pat and a light sticky sound, no hiss. Mild and slightly unsatisfying, not punishing. One short event. No buzzer, beep, music, voices or arcade sounds.
```

### 12. Kitchen: ingredients

**Suggested base name:** `ingredient_add`, `ingredient_return`

**Production and integration:** `ingredient_add` 0.3–0.5 s, 2 variants (pouch and cut). `ingredient_return` 0.3–0.4 s when the ingredient does not belong and goes back to its place.

**Where it goes:** `MealGame`: the `good` message and the error on a wrong pick.

**Ingredient (pouch)** · `ingredient_add_01.wav`

```text
A small sealed space-food pouch is opened and its contents gently added to a bowl: a soft foil crinkle, a tiny tear and a light food drop. Cozy, close and tactile. One short event. No eating, music, voices, beeps or arcade reward.
```

**Ingredient (cut)** · `ingredient_add_02.wav`

```text
A few quick gentle knife cuts on a padded cutting board, then the pieces slide into a bowl. Soft, rhythmic and homely kitchen foley in a small spacecraft galley. One short event. No eating, music, voices, beeps or arcade sounds.
```

**Ingredient goes back** · `ingredient_return.wav`

```text
A small food container is set back onto a padded shelf: a soft placement knock and a light rattle of its contents. Neutral and gentle, like changing one's mind. One short event. No buzzer, error tone, music, voices or arcade sounds.
```

### 13. Shelter: water bags and particles

**Suggested base name:** `water_bag_place`, `particle_absorbed`, `particle_through`

**Production and integration:** Bag 0.4–0.6 s (`filled`). Stopped particle 0.2–0.3 s. Particle getting through 0.15–0.25 s (adds to the dosimeter): very quiet, repeats.

**Where it goes:** `ShieldGame`: messages `filled` / `blocked` and each particle that reaches the gap or the water.

**Water bag** · `water_bag_place.wav`

```text
A heavy soft water bag is pushed into a wall gap: a dense squishy slosh, a muffled fabric thump and a short settling ripple inside. Satisfying and protective, close up. One short event. No splash spray, music, voices, beeps or arcade sounds.
```

**Stopped particle** · `particle_absorbed.wav`

```text
A tiny energetic particle is stopped by a thick water shield: a short muted soft plop inside water with a faint fizz. Subtle and reassuring, abstract but physical. One short event. No laser, explosion, music, voices or arcade sounds.
```

**Particle gets through** · `particle_through.wav`

```text
One single soft crackle tick of a radiation dosimeter registering a particle, dry and short, 0.15 seconds. Clear but gentle, not frightening. One single tick, clean decay. No continuous Geiger stream, alarm, music or voices.
```

### 14. Greenhouse: light and ladybugs

**Suggested base name:** `grow_light_on`, `ladybugs_release`

**Production and integration:** 0.6–1 s each. Water still uses `plant_water_loop` (only for tool 1).

**Where it goes:** `PlantsGame`: the `healthy` message depending on the tool used (2 = light, 3 = ladybugs).

**Grow lamp** · `grow_light_on.wav`

```text
A plant grow lamp switches on above a seedling tray: a soft click, a gentle warm electrical hum swelling briefly and a faint glass resonance. Calm, nurturing and close. One short event. No buzzing insects, music, voices, beeps or arcade reward.
```

**Ladybugs** · `ladybugs_release.wav`

```text
A tiny container opens and a few ladybugs flutter out onto leaves: a soft lid pop, delicate wing flutters and light leaf rustles. Charming, natural and gentle. One short event. No loud buzzing, birds, music, voices or arcade sounds.
```

### 15. Airlock: cleaning the seals

**Suggested base name:** `seal_brush_loop`, `dust_gust`

**Production and integration:** 2–4 s brush loop while E is held over a stain. 1–1.5 s gust when the minigame brings more dust (`gust`).

**Where it goes:** `SealsGame` (at the time `conectar-modulo` when cleaning): loop while cleaning, `dust_gust` with `gust`.

**Brush** · `seal_brush_loop.wav`

```text
A stiff small brush scrubs fine dust off a rubber door seal: steady soft bristle strokes, gritty friction and a faint rubber squeak, close and tactile. Even rhythm for a seamless loop, no start or stop. No music, voices, wind, beeps or arcade sounds.
```

**Dust gust** · `dust_gust.wav`

```text
A brief gust of fine Martian dust hits a closed metal door from outside: a soft rushing wind burst and a light sandy patter against the hull, heard from inside. Short and noticeable but calm. One event with a natural fade. No storm loop, thunder, music or voices.
```

### 16. Greenhouse harvest

**Suggested base name:** `harvest_snip`, `harvest_miss`

**Production and integration:** 0.25–0.4 s each; the cut with 2 variants.

**Where it goes:** `HarvestGame`: the `cut` message when ripe, and the unripe or overripe cut.

**Ripe cut (1)** · `harvest_snip_01.wav`

```text
Small garden scissors cleanly snip a fresh plant stem: a crisp short blade cut, a tiny leaf rustle and the soft drop of a sprig into a tray. Fresh and satisfying. One short event. No music, voices, beeps or arcade reward.
```

**Ripe cut (2)** · `harvest_snip_02.wav`

```text
A quick clean pruning snip of a juicy green stem, a light crisp snap and leaves brushing as it is lifted. Close, natural and gentle. One short event. No music, voices, beeps or arcade sounds.
```

**Off-time cut** · `harvest_miss.wav`

```text
Scissors cut a limp or unripe plant stem: a dull soft snip and a weak floppy leaf sound, slightly disappointing but gentle. One short event. No buzzer, error tone, music, voices or arcade sounds.
```

---

## 3. Maneuvers

### 17. Boarding: seat belts and suit

**Suggested base name:** `seatbelt_click`, `suit_connect`

**Production and integration:** Seat belt 0.2–0.3 s, 2 variants, for each correct arrow. Suit 0.8–1.2 s when the sequence ends.

**Where it goes:** `ManeuverScene` with `BoardGame` (`right` and end of the stage); at the time only the generic success played.

**Seat belt (1)** · `seatbelt_click_01.wav`

```text
A spacecraft seat harness buckle snaps shut: a firm metal latch click with a soft nylon strap tug. Close, crisp and reassuring. One short event. No music, voices, beeps or arcade sounds.
```

**Seat belt (2)** · `seatbelt_click_02.wav`

```text
A padded seat harness strap is tightened and locked: a quick webbing pull, a ratchet tick and a solid buckle clack. Close and tactile. One short event. No music, voices, beeps or arcade sounds.
```

**Connect the suit** · `suit_connect.wav`

```text
A spacesuit umbilical hose connects to the seat's life support port: a firm twist-lock click, a short air flow hiss and a soft regulator tone of fresh air arriving. Reassuring and precise. One compact event. No alarm, music, voices or arcade reward.
```

### 18. Checklist: repair with spare parts

**Suggested base name:** `checklist_repair`

**Production and integration:** 0.8–1.2 s. When choosing "Repair" on a yellow or red system (at the time a generic confirm).

**Where it goes:** `ManeuverScene.decide` with the `repair` decision.

**Quick repair** · `checklist_repair.wav`

```text
A quick spacecraft repair with a spare part: a panel unlatches, a small module slides in and clicks, two short ratchet turns and the panel closes. Efficient and competent, close foley. One compact event. No alarm, music, voices, beeps or arcade reward.
```

### 19. Booster separation

**Suggested base name:** `booster_separation`

**Production and integration:** 1–1.5 s. At the time it shared `separar-etapas` with stage separation; it should sound deeper and doubled (two boosters).

**Where it goes:** `ManeuverScene.afterOutcome`, stage `boosterSeparation`.

**Boosters** · `booster_separation.wav`

```text
Two side boosters separate from a rocket, heard through the hull: a double deep pyrotechnic thump almost together, a heavy structural shudder and the engine roar briefly thinning as they fall away. Powerful but controlled. One event. No explosion blast, music or voices.
```

### 20. Heat shield separation

**Suggested base name:** `heat_shield_release`

**Production and integration:** 0.8–1.2 s, lighter than a stage separation.

**Where it goes:** `ManeuverScene.afterOutcome`, stage `heatShieldSeparation` (landing on Mars).

**Shield released** · `heat_shield_release.wav`

```text
A spacecraft heat shield is released during descent, heard from inside: a sharp light latch pop, a hollow metallic clang as it detaches and a short airy rush as it drops away. Clear and brief. One event. No explosion, alarm, music or voices.
```

### 21. Flight timing bar

**Suggested base name:** `flight_confirm`, `flight_miss`

**Production and integration:** 0.3–0.5 s each. A cockpit pair of its own for the press-on-time stages (at the time `paso-correcto` / `paso-incorrecto`, the same as the rooms).

**Where it goes:** `ManeuverScene.press` and the result of the flight minigames.

**Cockpit confirmation** · `flight_confirm.wav`

```text
A cockpit command is confirmed: a firm toggle guard clicks, a short relay engages and a soft warm indicator tone answers once. Professional, calm and satisfying, inside a spacecraft cabin. One compact event. No melody, fanfare, music, voices or arcade reward.
```

**Cockpit correction** · `flight_miss.wav`

```text
A cockpit command arrives slightly off: a muted toggle click, a soft thruster correction puff and a low gentle indicator tone. Corrective, not failure. One compact event. No buzzer, alarm, music, voices or arcade sounds.
```

---

## 4. World and events

### 22. Solar storm: Geiger counter

**Suggested base name:** `geiger_loop`

**Production and integration:** 4–6 s loop, moderate irregular crackle. While there is a radiation alert and the player is not in the shelter; lower the volume inside the shelter.

**Where it goes:** `SimulationMapScene.radiationAlert()` and the player's zone.

**Geiger** · `geiger_loop.wav`

```text
A radiation counter clicking irregularly at a moderate rate: dry soft crackling ticks with natural random spacing, heard close inside a spacecraft. Cautionary but not frightening, clear on small speakers. Seamless steady loop, no start or stop. No alarm, music, voices or harsh noise.
```

### 23. Reaching the shelter

**Suggested base name:** `shelter_seal`

**Production and integration:** 1–1.5 s. On entering the shelter during the alert (once per alert).

**Where it goes:** `SimulationMapScene`, on moving into the shelter zone with `radiationAlert()` active.

**Shelter sealed** · `shelter_seal.wav`

```text
A thick protective shelter hatch closes and seals: a heavy padded door swing, a firm latch lock and a soft pressure equalizing sigh, then quiet. Safe and reassuring, inside a spacecraft. One event. No alarm, music, voices or arcade sounds.
```

### 24. Scrubber failure

**Suggested base name:** `machine_wind_down`

**Production and integration:** 1.5–2.5 s. When the `scrubberFailure` incident starts.

**Where it goes:** `SimulationMapScene`, `incident:started` (along with the toast).

**Machine winding down** · `machine_wind_down.wav`

```text
A life support fan machine winds down after a fault: a motor hum descending in pitch, a soft rattle and a final relay click into silence. Noticeable and slightly worrying but calm, inside a spacecraft. One event. No alarm, explosion, music or voices.
```

### 25. Greenhouse pest

**Suggested base name:** `pest_buzz`

**Production and integration:** 1.5–2 s. When `greenhousePest` starts.

**Where it goes:** `SimulationMapScene`, `incident:started`.

**Aphids** · `pest_buzz.wav`

```text
A few tiny aphids and small insects busy among plant leaves: light delicate buzzing, soft leaf nibbling and rustling, close in a greenhouse tray. Curious, not creepy. One short event with a natural fade. No large flies, horror effect, music or voices.
```

### 26. Extreme night

**Suggested base name:** `hull_creak_cold`

**Production and integration:** 1.5–2.5 s. When `coldNight` / `extremeNight` starts.

**Where it goes:** `SimulationMapScene`, `incident:started`.

**Cold hull** · `hull_creak_cold.wav`

```text
A habitat hull contracts in extreme cold: slow soft metallic creaks, a faint icy wind outside and a low structural groan, heard from inside. Atmospheric and gently tense, not scary. One event with a natural fade. No horror effect, alarm, music or voices.
```

### 27. Solar conjunction

**Suggested base name:** `radio_fade_static`

**Production and integration:** 2–3 s. When `solarConjunction` starts: communication with Earth fades away.

**Where it goes:** `SimulationMapScene`, `incident:started`.

**Radio fading out** · `radio_fade_static.wav`

```text
A distant radio link from Earth fades away: a faint carrier tone weakening into soft static, crackling briefly and dissolving into silence. Quiet, lonely and calm, from a spacecraft comms console. One event. No voices, words, music, melody or alarm.
```

### 28. Cut cable

**Suggested base name:** `cable_snap`

**Production and integration:** 0.6–1 s. When `cableCut` starts (outside on Mars).

**Where it goes:** `SimulationMapScene`, `incident:started`.

**Cut cable** · `cable_snap.wav`

```text
A thick power cable outside a habitat snaps loose: a sharp electrical crackle, a brief arc fizz and a dull heavy cable slap on dusty ground, heard muffled from inside. Clear and brief. One event. No explosion, alarm, music or voices.
```

### 29. Blown fuse

**Suggested base name:** `fuse_pop`

**Production and integration:** 0.4–0.6 s. When `fuseBlown` starts (before the power cut, if any).

**Where it goes:** `SimulationMapScene`, `incident:started`.

**Blown fuse** · `fuse_pop.wav`

```text
An electrical fuse blows inside a wall panel: a sharp small pop, a tiny fizz and a faint burnt crackle, heard from across a room. Brief and noticeable, not scary. One event. No explosion, alarm, power-down hum, music or voices.
```

### 30. Isolation

**Suggested base name:** `isolation_hush`

**Production and integration:** 2–3 s, very soft. When `isolation` starts: the crew misses Earth. No alarm at all.

**Where it goes:** `SimulationMapScene`, `incident:started`.

**Ship's silence** · `isolation_hush.wav`

```text
A quiet lonely moment inside a small spacecraft: the ventilation hum softens, a distant gentle hull tick and a faint airy hush. Introspective and tender, not sad or scary. One event with a long soft fade. No music, melody, voices, alarm or heartbeat.
```

### 31. New sol

**Suggested base name:** `habitat_morning`

**Production and integration:** 1–1.5 s. At the start of each day (a sol on Mars, a day during the trip). Quiet, no musical chime.

**Where it goes:** `SimulationMapScene` when the day of `simDate` changes.

**Habitat good morning** · `habitat_morning.wav`

```text
A spacecraft habitat wakes up for a new day: lights powering on with a soft rising hum, a gentle ventilation increase and a warm glass resonance. Bright, calm and welcoming. One event. No bell, melody, chime tune, music, voices or alarm.
```

### 32. Outer door locked

**Suggested base name:** `outer_door_lock`

**Production and integration:** 0.8–1.2 s. When the outer airlock door closes for the night or a storm (`outerDoorClosed()` turns true).

**Where it goes:** `MarsScene` / `SimulationMapScene.outerDoorClosed()`.

**Heavy latch** · `outer_door_lock.wav`

```text
A heavy airlock outer door bolts lock for the night: two deep mechanical bolts slide into place, a firm thud and a soft sealing hiss, heard from inside. Secure and calm. One event. No door swing, alarm, music or voices.
```

### 33. Loading and stowing at departure

**Suggested base name:** `cargo_stow`

**Production and integration:** 0.6–1 s, 2 variants. Every time something is loaded or stowed at the final boarding (silent at the time).

**Where it goes:** `SimulationMapScene`, `s.doAction(activeZone)`.

**Stow cargo (1)** · `cargo_stow_01.wav`

```text
A padded cargo case is slid into a spacecraft storage rack and strapped: a soft sliding scrape, a firm shelf knock and a quick strap cinch. Practical and tidy. One short event. No music, voices, beeps or arcade sounds.
```

**Stow cargo (2)** · `cargo_stow_02.wav`

```text
A sealed sample container is placed into a foam-lined cargo slot and latched: a soft foam squeeze, a light plastic knock and a crisp latch click. Careful and satisfying. One short event. No music, voices, beeps or arcade sounds.
```

### 34. Leave early (F)

**Suggested base name:** `departure_scheduled`

**Production and integration:** 1–1.5 s. On confirming early boarding (at the time a generic confirm).

**Where it goes:** `MarsScene`, `s.leaveEarly()`.

**Boarding scheduled** · `departure_scheduled.wav`

```text
A spacecraft departure sequence is armed: a guarded switch flips, a series of soft relays engage one after another and a low steady systems hum rises. Purposeful and anticipating, not alarming. One event. No alarm, countdown voice, melody, music or arcade reward.
```

### 35. Curiosity nearby

**Suggested base name:** `rover_motor_loop`

**Production and integration:** 3–5 s loop; the game raises the volume when approaching the rover and turns it off far away.

**Where it goes:** `MarsScene`, player's distance to Curiosity.

**Rover** · `rover_motor_loop.wav`

```text
A slow six-wheeled planetary rover driving over rocky dust, heard through a spacesuit: soft electric wheel motors whirring, gentle gravel crunch and a light suspension creak. Steady and calm for a seamless loop, no start or stop. No engine roar, music, voices or beeps.
```

### 36. Return cargo: the hold

**Suggested base name:** `crate_lift`, `crate_place`, `crate_rotate`, `crate_blocked`, `hold_sealed`

**Production and integration:** Four 0.2–0.4 s takes and a 1–1.5 s `hold_sealed`. They replace `abrir-panel`, `confirmar`, `cambiar-interruptor`, `accion-invalida` and `incidente-resuelto` in the hold.

**Where it goes:** `cargoGridView.ts` (lift, place, rotate, does not fit, confirm the cargo).

**Lift crate** · `crate_lift.wav`

```text
A small padded cargo crate is lifted off a rack: a soft scrape and a light hollow knock of its contents shifting. Close and tactile. One short event. No music, voices, beeps or arcade sounds.
```

**Place crate** · `crate_place.wav`

```text
A small padded cargo crate is set down into a storage grid slot: a firm soft thud and a short settle of foam. Close and satisfying. One short event. No music, voices, beeps or arcade sounds.
```

**Rotate crate** · `crate_rotate.wav`

```text
A small cargo crate is turned in place on a padded surface: a short soft scrape and a light corner knock. Quick and tactile. One short event. No music, voices, beeps or arcade sounds.
```

**Does not fit** · `crate_blocked.wav`

```text
A small cargo crate bumps against the edge of a full storage slot and does not fit: a dull soft knock and a slight scrape back. Gentle, not punishing. One short event. No buzzer, error tone, music, voices or arcade sounds.
```

**Hold sealed** · `hold_sealed.wav`

```text
A spacecraft cargo hold is closed and secured: a padded hatch swings shut, two firm latches lock and a soft pressure seal sighs. Complete and reassuring. One event. No alarm, fanfare, music, voices or arcade reward.
```

### 37. Real data received

**Suggested base name:** `telemetry_received`

**Production and integration:** 0.6–1 s. When a real-data notice appears (DONKI, Artemis I): at the time there was only a toast.

**Where it goes:** `SimulationMapScene`, `realEvent:shown`.

**Telemetry** · `telemetry_received.wav`

```text
A data packet arrives at a spacecraft console from a distant mission: a short soft burst of digital chirps, a gentle carrier tone and a quiet ceramic click as it is saved. Curious and scientific. One compact event. No melody, voices, alarm, music or arcade reward.
```

---

## 5. Screens

### 38. Planning: switching loads on and off

**Suggested base name:** `power_relay`

**Production and integration:** 0.2–0.3 s, 2 variants (on, off). Replaces `cambiar-interruptor` on the planning screen (P), which is the base's real power and not a setting. (The planning screen was later replaced by the resource console.)

**Where it goes:** `PlanningScene`, when a load changes.

**Relay on** · `power_relay_01.wav`

```text
A heavy-duty electrical relay closes on a power panel: a solid clack and a faint electrical hum appearing. Short, crisp and physical. One event. No spark, beep, music or voices.
```

**Relay off** · `power_relay_02.wav`

```text
A heavy-duty electrical relay opens on a power panel: a solid clack and a faint hum fading out. Short, crisp and physical. One event. No spark, beep, music or voices.
```

### 39. Mission Control and data panel

**Suggested base name:** `comms_panel_open`, `data_screen_open`

**Production and integration:** 0.4–0.6 s each. They replace `abrir-panel` when opening Mission Control (C) and the data panel (G); the status board (I) and the crater map (V) keep `abrir-panel`.

**Where it goes:** `HudScene`, when opening those overlays.

**Mission Control** · `comms_panel_open.wav`

```text
A spacecraft comms console powers up: a soft switch click, a brief warm radio carrier hum and a faint static breath settling. Friendly and ready. One compact event. No voices, words, melody, music or alarm.
```

**Data panel** · `data_screen_open.wav`

```text
A science data screen wakes on a spacecraft console: a gentle display power-on whine, soft digital ticks of data loading and a quiet glass resonance. Curious and precise. One compact event. No melody, voices, music or arcade sounds.
```

### 40. Mission start and final report

**Suggested base name:** `mission_start`, `report_star`, `achievement_unlock`

**Production and integration:** `mission_start` 1–1.5 s when starting a game from the title. `report_star` 0.4–0.6 s for each star in the report (the game raises the pitch one by one). `achievement_unlock` 0.8–1.2 s for each achievement.

**Where it goes:** `TitleScene` (start), `ReportScene` (stars and achievements).

**Start the mission** · `mission_start.wav`

```text
A spacecraft mission begins: a main power switch engages, systems hum to life in a smooth rising swell and a soft confirming latch settles. Hopeful and ceremonial but restrained. One event. No melody, fanfare, music, voices or arcade sounds.
```

**Report star** · `report_star.wav`

```text
A small polished crystal star is set into a ceramic display slot: a gentle click and a warm bright glass resonance that rings briefly. Rewarding and soft. One compact event. No melody, arpeggio, coin, music, voices or arcade sounds.
```

**Achievement** · `achievement_unlock.wav`

```text
A commemorative mission patch is pressed onto a fabric board: a soft fabric press, a light velcro grip and a warm glass shimmer. Proud and gentle. One compact event. No fanfare, melody, music, voices or arcade reward.
```

---

## Practical order and checks

1. First, **section 1**: it fixes sounds that did not match the action.
2. Then the **patch detector** (11) and the **Geiger** (22): they are information for the player, not decoration.
3. Then the room minigames (01–16), testing each one inside the game: the success sound must survive many repeats without getting tiresome. If it does, lower the volume or alternate variants before generating more.
4. Incident sounds (24–30) play along with the existing alarm or siren: check that they do not mask each other and that the warning is still understood.
5. New loops (radio static, heater, brush, Geiger, rover): start and stop controlled by the game state, never retriggered every frame; they stop when changing scenes or pausing.
6. Save each variant separately and note the prompt, date and generation plan. No audio was generated or listened to while writing this document (the sounds were generated and integrated afterwards).

**Count:** 40 events, 72 proposed prompts/files. Music is not included (separate task; see `public/assets/audio/README.md`).


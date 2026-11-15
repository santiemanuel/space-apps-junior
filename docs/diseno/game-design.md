# Game design document — Mission to Mars

Status: **v4, the basis of the game released as Hello Mars** (the final game adjusted some points during development; see the revision history at the end and `docs/historial/`). Working title: *Misión a Marte*. Each number states its type:

- **[data]**: measured or published by NASA or another agency, with its source.
- **[standard]**: a NASA-STD-3001 requirement or a BVAD design value.
- **[rule]**: a game decision (balance, simplification). It can be tuned freely, but it is shown as an estimate, never as data.
- **[verify]**: must be confirmed before use.

---

## 1. Vision

> Take your crew from Earth to Mars and back home healthy, with the Mars samples on board,
> while **real** space weather tests every decision.

Pillars, taken from the *Junior Astronaut Mission Trainer* challenge:

1. **No decision is free.** Every choice is paid for in power, life support or health.
2. **Visible real data.** The player sees which NASA data caused each event, with its date and source (see 3.8).
3. **Few systems.** Three meters, not six. Complexity also grows from game to game (see 6).
4. **Failing teaches.** There is no humiliating "Game Over". When a system goes down, the game does not end: it forces you to **sacrifice another one** to hold on (see 3.5). The final report compares your decisions with what really happened.
5. **Replayable.** Different real dates, cargo, failures, goals and unlocks.
6. **Mechanics before graphics.** A simple game that teaches a real constraint is worth more than a pretty one that does not.

Audience: ages 7–12 (main target: 10). Bilingual **Spanish and English** from the start (see 8).
Platform: **PC with keyboard and mouse**.

## 2. Mission arc

| Phase | Main threat | What is learned | Main dataset |
|---|---|---|---|
| 1. Preparation and launch | Limited cargo; Van Allen belts | Everything you take has weight; Earth protects us | RadLab: Artemis I (EAD/HERA) |
| 2. Outbound trip | **Radiation** (no atmosphere or magnetic field) | Solar storms, shelter, exercise, isolation | RadLab: BioSentinel, TGO in cruise; DONKI |
| 3. Landing on Mars | The "7 minutes of terror" | We are alone: the signal takes longer than the landing | Curiosity/Perseverance EDL sequence |
| 4. Stay on Mars | **Dust and cold** | The atmosphere protects from radiation but blocks the sun | Curiosity REMS and RAD (Gale Crater) |
| 5. Launch from Mars | Mass: samples versus supplies | What you take home also has weight | Cargo rules (4.5) |
| 6. Return trip | Radiation with a worn ship and crew | Outbound decisions are paid for on the way back | RadLab: BioSentinel; DONKI |
| 7. Reentry to Earth | Heat and precision | Coming back is hard too | Orion reentry on Artemis I (NASA) |

The contrast between phases is measurable: during the May 2024 storm, deep space registered **653 μGy/h** (BioSentinel) and the surface of Mars **304 μGy/h** (Curiosity) [data, RadLab]. They are different instruments, so the comparison is only indicative.

### 2.1 Modes

| Mode | Dates | Purpose |
|---|---|---|
| **"Real story 2024" campaign** | A single real calendar (see 2.2) | Credibility: everything really happened, in order |
| **Free mode** | Each phase takes a different real period; the screen always shows the date of the data | Replayability |

Selectable length (with saving at any time, see 3.9):

| | Launch | Outbound (days) | Landing | Mars (sols played) | Mars launch | Return (days) | Reentry | Approx. total |
|---|---|---|---|---|---|---|---|---|
| **Short** | ~1 min | 2 | ~1 min | 5 | ~1 min | 2 | ~1 min | ~15 min |
| **Long** | ~1 min | 6 | ~1 min | 12 | ~1 min | 4 | ~1 min | ~30 min |

- **Length depends on what the player does** [rule]: a day lasts ~1 min (a sol ~50 s) while there is something to do (daily tasks, incidents, decisions, emergencies, shelter, a sample outing). With everything up to date, the rest of the day runs in fast forward (2.5 h per second) and returns to normal time as soon as something comes up. Alerts slow the clock down too (3.1).
- The **return has fewer playable days** than the outbound trip, but the ship and the crew arrive worn (see 4.6).
- Time between days and between sols **does pass**, in fast forward (3.1), with the real consumption and dose of those days. A short mission plays fewer days, but it does not shorten the trip.
- **Route: a nuclear thermal propulsion (NTP) spacecraft, with 4-month legs and a short stay.**
  - This is the architecture NASA is studying for crewed missions: nuclear propulsion shortens the trips and allows **short stays on the surface**, instead of waiting more than a year on Mars for the planets to line up for the return ([NASA: *Nuclear Propulsion Could Help Get Humans to Mars Faster*](https://www.nasa.gov/solar-system/nuclear-propulsion-could-help-get-humans-to-mars-faster/)) [data].
  - Studies talk about 2–3 month legs with large reactors; the game uses **4 months per leg** [rule] because that fits the 2024 campaign data.
  - The reactor only works during engine burns. Habitat power still comes from **solar panels**, so the mechanic of light dropping with distance (3.2) stays [rule].
- **Why the route matters:** with the classic chemical route (~7 months per leg) the background radiation of the round trip would add up to ~770 mSv (1.84 mSv/day, Zeitlin 2013), more than the 600 mSv career limit without the player being able to avoid it. With 4-month legs it adds up to ~440 mSv: the limit is close and shielding and storms decide [data + rule]. The report explains **this same reason** as the one that makes NASA study nuclear propulsion.
- **Date simplification:** campaign dates are chosen by available data, not by real launch windows (every ~26 months). The report makes this clear [rule].

### 2.2 2024 campaign calendar

Data constraint: Curiosity's RAD goes up to **06/03/2024** in RadLab, and BioSentinel covers all of 2024.

| Phase | Real dates | Real events included |
|---|---|---|
| Launch (nuclear spacecraft, 4-month leg) | 01/15/2024 | Van Allen crossing: Artemis I profile (11/16/2022), labelled "measured by Artemis I" |
| Outbound trip | 01/15 → 05/14/2024 | Solar storm of May 8–14 (X flares, SEP) in deep space |
| Landing | 05/15/2024 | Real Gale weather that day |
| Mars | 05/15 → 06/03/2024 (19 sols) | **SEP event of 05/20/2024** on the surface |
| Launch from Mars | 06/04/2024 | — |
| Return trip | 06/04 → 10/10/2024 | A very active period: 19 X flares, including the **X9.0 of 10/03/2024**, the largest of 2024; SEP events on 06/08, 09/09 and **10/09/2024** [data, DONKI] |
| Reentry | 10/10/2024 | The October storm as the final climax |

In free mode, the trips use BioSentinel windows (2022-11 → 2025-11) or TGO in cruise (04 → 09/2016), and the stay uses Curiosity windows (2015 → 06/2024) where RAD and REMS overlap.

## 3. Shared systems

### 3.1 Time

- **Trip (outbound and return):** one played day ≈ 1 min while there is something to do.
- **Mars:** one played sol ≈ 50 s while there is something to do.
- **Day with nothing to do** (daily tasks done, no incidents, decisions, emergencies or shelter): runs fast (2.5 h per second) until something appears [rule]. The dashboard says so ("All up to date") and, if something is missing, lists what needs doing. Each day asks for 2 daily tasks plus one more for each storm lived through, up to 4.
- **Between days and between sols**, the calendar runs in **interactive fast forward**, not with a jump:
  - The meters animate day by day; they never jump straight from day 10 to day 47.
  - The crew follows its routines on its own.
  - The player can **stop the fast forward** at any time. Stopping it shows the **planning screen** (routines and power board), paused.
- **Fast forward slows down by itself** at each warning from the incident scheduler (3.4), in three levels:

  | Level | Trigger | Speed | Signals for the player |
  |---|---|---|---|
  | Calm | No warnings | Fast (1.75 days per second) [rule] | Normal interface |
  | **Alert** | During the trip: a real detection in DONKI (CME, M/X flare, `notifications` alert). On Mars: REMS UV starts dropping (dust), an extreme night is announced or there is a radiation warning | Slow | Interface tinted yellow; adapted alert text; the **particle monitor** (Geiger-counter clicks) speeds up; slight panel fluctuations |
  | **Impact** | Real start of the dose peak in RadLab, or the dust or cold sol | Normal time | Alarm and order to shelter or to share out power |

- **Warning lead time:** given by the **real difference** between the DONKI detection and the RadLab peak for that event. If no detected event precedes it, **48 simulated hours** are used [rule].
- The simulation clock advances in **real mission hours**. Data is looked up by date, so compression changes the game speed, never the values.

> Note on rigor: DONKI warnings refer to Earth's environment. The spacecraft is elsewhere, so
> the measured lead time is an approximation and is presented as a "forecast" (3.6).
> That is why the indicator is a **particle monitor** and not radio static: flares cut terrestrial
> shortwave radio, but not the Deep Space Network (DSN) spacecraft use.

### 3.2 The three meters

They carry over across the seven phases. All consumption is calculated for **4 crew members**.

#### Power

```
generation = P_panels × (1 / r²) × f_dust × f_light
consumption = life support + heating + assigned systems (shielding, MOXIE, greenhouse, radio)
battery    += (generation − consumption) × Δt, capped at capacity
```

- `1/r²`: sunlight drops with the distance to the Sun `r` in AU. At Mars (1.52 AU) **43 %** of Earth's light arrives [data].
- `f_dust` (on Mars), from the REMS UV index as a dust indicator: Very_High/High → 1.0; Moderate → 0.85; Low → 0.45 [rule]. The 2018 storm kept the UV at "Low" for ~60 sols [data, REMS].
- `heating = k × (T_inside − T_min_REMS)` [rule for `k`; the temperature is data].
- **Power board:** a few "sockets" shared between systems. Chips are dragged with the mouse, without numbers.

#### Life support (air and water)

| Variable | Value | Type |
|---|---|---|
| O2 consumed | 0.82 kg per crew member per day | [standard, BVAD] |
| CO2 limit | ≤ 3 mmHg (1 h average) | [standard, NASA-STD-3001 V2 6004] |
| Drinking water | 2.5 L per crew member per day; +240 mL per EVA hour | [standard, NASA-STD-3001] |
| Water recycling | 90–98 % depending on the recycler's state | [data, ISS] |
| MOXIE (O2 factory on Mars) | The real one produced ≤ 12 g/h and 122 g in total. In the game, a scaled-up version that uses a lot of power | [data] + [scaling rule] |

If the scrubber is neglected, CO2 rises at a fixed rate [rule]. Above 3 mmHg, headaches set in.

#### Health (per crew member)

Combines **dose**, **fitness**, **nutrition** and **tiredness**. Shown as a bar with four icons.

**Dose:**

```
dose_mSv += real_rate_μGy/h(date, place) × f_shielding(location) × Q(phase) × Δt_h / 1000
```

| Factor | Values | Type |
|---|---|---|
| `real_rate` | RadLab series for the phase and date, cleaned according to 3.2.1 | [data] |
| `Q` (absorbed dose → equivalent) | Mars: ≈ 3.05 (0.64 mSv / 0.21 mGy, Hassler 2014). Cruise: ≈ 3.8 (Zeitlin 2013). During an SEP, a lower Q (simplified to 1.5) | [data] / [rule] |
| `f_shielding` | Outside/EVA 1.0 · Habitat or ship 0.6 · Shelter: from **0.2** with a full water shield to **0.6** empty, interpolated by the shield water | [rule] |

##### 3.2.1 BioSentinel cleanup

Some BioSentinel days have means of thousands of μGy/h (2513 on 06/08/2024, 2194 on 10/09/2024, 1204 on 03/23/2024), far above the May 2024 storm (653 μGy/h peak). **The 11 days with a mean above 650 μGy/h match (±1 day) DONKI SEP events**, so the timing of the storm is real, but the intensity is not reliable (possible instrument saturation or artifact).

**Simple rule:** the BioSentinel daily series is **capped at 650 μGy/h** [rule]. It is the 99th percentile of the daily means and matches the May 2024 peak.
- The date and duration of each storm are kept; only the height of the peak is clipped.
- When a value is clipped, the data card says so: "BioSentinel recorded an extreme value that could be an instrument error; the game uses a cap".

For kids: the dose is shown in **chest X-rays** (0.1 mSv) [data] and as a percentage of the **600 mSv** career limit [standard].
The unavoidable part of the trip is shown separately from the part the player controls (2.1).

**Nutrition (no meter of its own):** food is an **inventory stock**, not a meter.
- Each crew member needs **3035 kcal per day** [standard, NASA-STD-3001 V2 7003], about 1.8 kg of packaged food [standard, BVAD].
- The stock comes from the initial cargo and, on Mars, from the greenhouse.
- **Eating less** (rationing) lowers fitness and morale [rule]. Rationing is a possible cascading-failure sacrifice (3.5).

**Fitness:** drops each day without exercise. On reaching Mars (0.38 g [data]) and back on Earth (1 g) you work more slowly [rule]. Basis: OSDR bone and muscle studies.

**Tiredness and morale:** tiredness rises with work and high CO2 and drops with sleep. Morale rises when talking to Earth (Mars-500 isolation study, OSDR).

### 3.3 Crew

Four crew members. The player starts as the **commander** and switches crew member with **Tab**:

| Role | Work speed | Preferred tasks |
|---|---|---|
| **Commander** | ×1.0 on **every** task | Anything; covers whatever is missing |
| Engineer | ×1.5 on her own tasks, ×1.0 on the rest | Power, scrubber, leaks, trajectory correction |
| Botanist | ×1.5 on his own tasks | Food, greenhouse, water, pests |
| Geologist-doctor | ×1.5 on her own tasks | Samples, exercise, infirmary |

The base speed is multiplied by each one's efficiency.

**Automatic crew members.** Clumsiness is a **symptom of management**, not a fixed rule: a well-cared-for crew performs as well as the player.

- They follow the routine assigned in planning. **They do not reassign power, do not make risky decisions and do not handle tasks you did not assign.** That is what the player brings by taking control: adapting to the unexpected.
- Their performance depends on their own state:

  ```
  efficiency = clamp(1 − 0.25·fatigue − 0.25·(1 − fitness) − 0.15·[CO2 > 3 mmHg] − 0.10·(1 − morale), 0.5, 1)
  reaction   = 1 s + 5 s × (1 − efficiency) / 0.5   → from 1 s (fine) to 6 s (exhausted)
  route      = optimal if efficiency ≥ 0.8; otherwise the blind shortest one (can be worse)
  ```

  The weights are [rule]. Every term is between 0 and 1 and comes from health (3.2) and CO2.
- **Examples:** with low CO2, full sleep and calls home, an alarm gets an answer in ~1 s by the best route. If you sacrificed sleep to repair something, the same alarm takes up to 6 s. If the geologist-doctor did not exercise during the trip, she works more slowly on Mars.
- **The same formula applies to the player's character** for work and movement speed, not for decisions.
- **Real basis:** high CO2 causes headaches and fatigue (OCHMO-TB-004) [data]. The Mars-500 study recorded changes in the crew's sleep and activity [verify: Basner et al. 2013, PNAS].
- **The interface always shows why** a crew member is slow ("Ana is tired: she slept 4 h").

**Help mode (optional, turned on in the menu)** [rule]:
- The automatic crew **react to crises on their own**: they go to the shelter with the alarm, even if it was not in their routine.
- Mission Control offers **hints without being asked**, with no delay.
- It does not change the data or the costs of decisions: it only reduces the management load.

### 3.4 Incidents

There are two sources, which go through the same event scheduler:

1. **Real timeline:** dataset events on the simulated date. They are fixed for a given date.
2. **Safe range:** each variable has a range (standard or rule). Leaving it triggers an incident. Plus seeded random failures.

Which incidents can appear depends on the player's **unlock level** (6).

Format of each incident (the data, translatable texts and tests come from it):

```
id, phase, unlock_level, trigger, warning, effect, player_response, cost_of_each_response,
source (dataset + date | standard), kids_text_key (translatable)
```

### 3.5 Cascading failure: extreme survival

A meter at zero **does not end the mission**. The base or ship enters an **emergency mode** that forces cannibalizing another system. That buys a few days or sols to recover, as on Apollo 13.

| Meter at zero | Emergency mode (automatic) | Sacrifices the player can choose | Cost of the sacrifice |
|---|---|---|---|
| **Power** | **Minimum life support:** no science, reduced heating, greenhouse lights off. Health drops every hour | Send someone to **clean the panels** (EVA with dust and dose) · Turn off MOXIE · Disconnect the shelter | Dose and tiredness · O2 drops · The shelter loses effectiveness |
| **Life support** | Air and water rationing: faster tiredness | **Drink the shelter's water shield** · Use extra power on MOXIE or the recycler | The shelter goes from 0.2 to 0.6 (3.2): **much more dose in the next storm** · Less power |
| **Health** (of a crew member) | They **rest** in the infirmary: no work | The geologist-doctor treats them (leaving her task) · Reduce the others' routines · Give them extra rations | Less science · More tiredness for the rest · Less food |
| (Food used up, from the inventory) | Minimum rations: everyone's fitness drops | On Mars: prioritize the greenhouse · On the way back: **leave samples behind to carry more food** (decision in 4.5) | Power · Science |

- Each emergency is announced with a one-sentence explanation and shows **how much margin is left** ("emergency power: 2 sols").
- Supporting real data:
  - Spirit's and Opportunity's panels were cleaned by gusts of wind ("cleaning events"), and the 2018 dust shut Opportunity down [data].
  - Water as shielding is a real spacecraft design concept [data].
  - Apollo 13 survived by reusing the lunar module's systems [data].

**Point of no return.** Only if the **whole** crew is resting at once, or if two meters have been depleted longer than their margin, does Mission Control declare the final emergency. The mission ends with the report, which shows **which chain of decisions** led there. No crew member dies: the wording is "mission suspended, the crew is safe in the shelter waiting for rescue" [rule, designed for the 7–12 audience].

### 3.6 How risk is communicated

- **Traffic light** (green, yellow, red) on every option and every forecast. No percentages on screen.
- **Forecasts with uncertainty:** "the storm arrives between tomorrow and the day after". Real CME arrival predictions have errors of hours [verify: typical magnitude in CCMC's CME Scoreboard].
- **Fixed rule:** each option shows its cost before choosing it. None is free.

### 3.7 Mission Control

It offers three things, and everything requested arrives with the **real distance delay** for the simulated date: from seconds at the start of the trip to ~20 min at Mars, shown with a countdown.

| Type | How it works | Cost |
|---|---|---|
| **Messages** | Forecasts with real data, encouragement, news from home. They arrive on their own | None |
| **Advice** | You ask what to do about a failure; the answer arrives after the delay. Teaches why you have to decide on your own | None, only the waiting time |
| **Remote diagnostics** | Speeds up an ongoing repair (×1.5) [rule] when it arrives | Radio power |

- During **solar conjunction** (when the Sun sits between Earth and Mars) there is no Mission Control, only stored messages. Real dates: NASA's command moratoriums of 2015, 2017, 2019, 2021 and 2023 (`datasets/curated/mars-conjunctions.json`) [data]. The 2024 campaign has none: the next one is in January 2026.
- The **commander** is the one who asks for advice and diagnostics, from the communications console.

### 3.8 Real data, in plain sight

1. **"This really happened" cards**: each real event opens a short card, paused:
   - Date.
   - Instrument and mission ("Curiosity/RAD, NASA").
   - The translated value ("304 μGy/h: 64 times normal").
   - A sentence of explanation.
   - Link to the source (for example the event's `link` in DONKI).
2. **Data panel**: a screen on the ship and at the base that can be checked at any time. It shows charts of the real data for the current date (dose, UV, temperature, DONKI events), with the player's position marked in time.
3. **Mission report** at the end (5).

### 3.9 Saving

- **Save and quit at any time** (Esc → Save), and autosave on each phase change.
- The full state is saved: simulated date, meters, crew, inventory, active incidents, unlock level and **the state of the seeded random generator**, so the game remains reproducible.

## 4. Phases in detail

### 4.0 Maneuvers: checklist plus well-timed actions

The four maneuvers (ascent, landing, launch from Mars, reentry) share a format:

1. **Go / No-Go checklist:** go through the ship confirming each station. A system in bad shape appears in yellow and can be fixed first, or you can take the risk.
2. **Stages with a well-timed action:** one bar per stage; press **Space** in the right zone. A yellow system shrinks the zone [rule].
3. A mistake never ends the game: it costs fuel, precision or an extra correction.
4. **Flight scene** (~30 s to 1 min): an animated illustration shows boarding, the T-10 countdown and liftoff (or entry, parachutes and landing), and each stage is a minigame: load fuel (release in the band), board (arrow sequence), countdown (press right at zero), steer (keep the needle in the zone) or press at the right moment. Fuel is spent according to how well each one goes [rule].

### 4.1 Phase 1 — Preparation and launch

1. **Outbound cargo (simplified).** One of three profiles is chosen [rule]:

   | Profile | Water (drinking + shielding) | Spare parts | Food | Effect |
   |---|---|---|---|---|
   | Water shield | +++ | + | ++ | Less dose during the trip; repairs get harder |
   | Workshop | + | +++ | ++ | More dose; failures are fixed quickly |
   | Balanced | ++ | ++ | ++ | No extremes |

   Water as shielding is a real spacecraft design concept [data].

2. **Ascent maneuver (4.0).** Stages: ignition, booster separation, stage separation, engine cutoff.
3. **Van Allen belts.** First dose, with the Artemis I curve: a **14 393 μGy/h** peak on 11/16/2022 (EAD) [data, RadLab]. It works as a tutorial for the health meter.

### 4.2 Phase 2 — Outbound trip

Top-down map of the ship: command module, exercise, scrubber, recycler, water shelter, radio and pantry.

| Task | If not done | Basis |
|---|---|---|
| Exercise (1 per crew member per day) | Fitness drops | [data] OSDR; the ISS requires ~2 h/day |
| CO2 scrubber | CO2 > 3 mmHg → tiredness | [standard] |
| Water recycler | Water and shielding get used up | [data] ISS |
| Trajectory correction (aiming minigame) | Harder landing | [data] Curiosity and Perseverance made several |
| Call home | Morale drops | Real delay according to distance (3.7) |

**Trip incidents:**

| Incident | Trigger | Response | Source |
|---|---|---|---|
| Solar storm warning | CME or X flare in DONKI on the date | Prepare the shelter and charge the batteries | [data] DONKI |
| **Radiation storm** | SEP on the date, or a BioSentinel peak | Everyone to the water shelter. A rested crew gets there in ~1 s, an exhausted one takes longer (3.3) | [data] DONKI + RadLab |
| Micrometeorite | Seeded random | Find and patch the leak | [rule] |
| Broken scrubber | Safe range or random failure | Repair it (the engineer is faster) | [standard] |
| Isolation | Many days without a call | Call home | [data] Mars-500 |

No science is collected during the trip: the reward is arriving with a fit crew and the cargo that will be needed on Mars.

### 4.3 Phase 3 — Landing on Mars (basic)

Maneuver (4.0) with four stages:
1. Atmospheric entry at ~20 000 km/h (heat shield at ~1300 °C at peak heating).
2. Supersonic parachute at ~11 km altitude and ~1500 km/h.
3. Shield separation.
4. Descent engines.

These are Perseverance's values (2021) according to NASA ([deceleration](https://www.nasa.gov/image-article/perseverance-rover-decelerates-martian-atmosphere/),
[parachute](https://www.nasa.gov/image-article/perseverance-deploys-parachute/)) [data].

- **Difficulty:** depends on trajectory precision, cargo and the day's real dust.
- **Result:** the distance to the base. More distance → more outings → more dust and dose. There is never a "crash" or death.
- **Teaching moment:** "The landing signal takes X minutes to reach Earth. By the time they find out, you will already have landed."

### 4.4 Phase 4 — Stay on Mars

Base in Gale Crater. Curiosity is the robot neighbour that reports each day's real data.

**Science: samples on the map.**
- Sampling points outside, placed by seed in each game. Each EVA brings back samples.
- Some samples are farther away (more dose and dust) and are worth more.
- Each sample has **mass**, which counts in the launch from Mars (4.5).

| Sol cycle | What happens |
|---|---|
| Planning (paused, when stopping fast forward or after a warning) | Real forecast (UV/dust, temperature), routines and power board |
| Day | Tasks, EVA to sampling points, crew switching |
| Night | Real REMS cold → heating |

Quiet sols pass in fast forward (3.1), and the ones with warnings, or the ones the player stops, are played by hand.

| Incident | Trigger | Response | Source |
|---|---|---|---|
| Dust storm | UV = Low in REMS | Share out power: heat, air or science; if power reaches zero, minimum life support and panel cleaning (3.5) | [data] REMS (2018) |
| Extreme night | Very low real minimum | More heating or a zone turned off | [data] REMS |
| **Radiation storm** | Real RAD peak (05/20/2024) | Shelter; suspend the EVA | [data] RadLab |
| Solar conjunction | Real dates when the Sun hides Mars | Two weeks without Mission Control | [data] NASA JPL (e.g. 11/11–25/2023); free mode only |
| High CO2 | Neglected scrubber or MOXIE | Repair or reassign power | [standard] |
| Greenhouse pest | Little care | Botanist | [data] OSD-177 |
| Dust in the seals | Many EVAs | Airlock maintenance | [rule] |

### 4.5 Phase 5 — Launch from Mars

1. **Return cargo:** the decision that closes the stay. The ship's hold is an 8 × 6 grid (like a grid inventory): each piece takes up room according to its size, can be rotated, and whatever does not fit stays on Mars [rule]. The recommended load takes 42 of the 48 cells; there is a button to pack automatically.
   - Many samples → more science, but less food, water and spare parts for the way back.
   - Few samples → a safer return, fewer stars.
   - The return water is again **drinking and shielding**: the October storm is waiting in the campaign.
   - The greenhouse **plant samples** are loaded too: at most one per sol, with the harvest minigame (cut each plant when it is ripe). If the greenhouse needs care, the plants are healed first.
   - With **all the rocks collected** boarding can start without waiting for the last sol (F key, twice).
2. **Maneuver (4.0):** ascent vehicle checklist and launch stages. Precision decides how much fuel is left for corrections on the way back.

### 4.6 Phase 6 — Return trip

Same map and tasks as the outbound trip, with three differences so it does not repeat:

- **Worn ship:** more wear failures (scrubber, recycler) and **only the spare parts left over** from the outbound trip and Mars [rule].
- **Crew carrying their state:** fitness from 0.38 g, the accumulated dose and tiredness weigh in.
- **Stormier space weather in the campaign:** June–October 2024 was one of the most active periods of the solar cycle (2.2) [data].
- **Preparing for 1 g:** exercise on the way back counts double for the crew's condition when landing on Earth [rule].

### 4.7 Phase 7 — Reentry to Earth

Maneuver (4.0) with three stages: point the heat shield, reentry (heat zone and communications blackout), parachutes and splashdown. Orion figures on Artemis I: ~40 000 km/h, ~2800 °C, the plasma cuts communications for a while and the parachutes slow it to under 32 km/h ([press kit](https://www.nasa.gov/artemis-i-press-kit/)) [data]. It ends with the crew walking or on a stretcher according to their fitness, and leads into the mission report.

## 5. Goals, scoring and ending

- **Goal:** come back with a healthy crew **and with the Mars samples on board**. Samples count on **returning**, not when collected.
- **3 stars:** healthy crew · low controllable dose · samples brought to Earth.
- **Achievements:** for example "Shelter in time", "Like Opportunity: you survived the dust", "Zero extra X-rays", "You survived the X9.0".
- **Mission report:** your decisions over the real charts ("your crew received X; Curiosity measured this on the same day"), with links to each source and the data cards experienced.
- **No early ending for a meter at zero:** it goes into cascading failure (3.5). The mission is only suspended at the point of no return, and the report shows the chain of decisions that led there.

## 6. Progression between games

The **first mission** introduces a reduced set of tasks and incidents; each completed mission **adds more** [rule].
That way one system is learned at a time and the game changes on replay.

| Level | Unlocked when | New tasks | New incidents | Other unlocks |
|---|---|---|---|---|
| 1 | — (first game) | Exercise, scrubber, shelter, samples, power board | Radiation storm, dust storm | 2024 campaign in short mode |
| 2 | Finishing 1 mission | Water recycler, greenhouse, call home | Broken scrubber, pest, isolation | "Workshop" cargo profile |
| 3 | Finishing 2 missions | MOXIE, trajectory correction, remote diagnostics | Micrometeorite, extreme night, high CO2 | Free mode, long mode |
| 4 | Finishing 3 missions | Airlock maintenance | Dust in the seals, solar conjunction | "Water shield" profile, special scenarios |

- Progression is saved in the browser, along with records and achievements. The game is played online with no third-party involvement.

## 7. Datasets by mechanic

| Mechanic | File |
|---|---|
| Van Allen | `datasets/raw/radlab/daily/moon-orbit-lro-crater.csv` (`Artemis-I-*` instruments) |
| Dose during the trips | `raw/radlab/daily/deep-space-biosentinel.csv`, `mars-cruise-orbit-tgo-liulin.csv` |
| Storms during the trips | `raw/radlab/events/2024-05-gannon-storm_heliocentric.csv`, `raw/donki/sep.json`, `flr.json`, `cme.json` |
| Mission Control texts | `raw/donki/notifications.json` (adapted and translated) |
| Dose on Mars | `raw/radlab/daily/mars-surface-curiosity-rad.csv`, `raw/radlab/events/2024-05-20-mars-sep_curiosity.csv` |
| Dust and cold | `raw/mars-weather/curiosity-rems.json` |
| Consumption and limits | `raw/references/*.pdf`, `curated/life-support-bvad.json`, `curated/radiation-dose.json` |
| "Did you know…?" | `raw/osdr/*.json` → `curated/osdr-facts.json` |

## 8. Languages and controls

- **Spanish and English** with a selector in the start menu. All texts (interface, incidents, cards, Mission Control) live in translation files by key, never written in the code. Curated data with text (for example `osdr-facts.json`) has both languages.
- DONKI alerts are in English at the source: in English the adapted original text is shown, and in Spanish the adapted translation.
- **Controls (PC):** WASD/arrows to move · E to interact · Tab to switch crew member · Space for the maneuver action · Esc to pause and save · **mouse** for decisions, the power board and the data panel.

## 9. Changes from the original prototype

- The prototype used a **lunar base** and **radio blackouts** from flares. On Mars, the communication constraint comes from the **distance delay** and **solar conjunction**.
- The prototype's 4 resources plus dose become **3 meters** plus the food inventory.
- Decisions with the 1/2/3 keys move to the mouse.
- The prototype ended the game when a resource ran out: replaced by cascading failure (3.5).
- Interface texts, written in the code at the time, move to translation files.
- The crew goes from a single player to 4 crew members switched with Tab.

## 10. Items to verify

- [x] Dates of the Mars solar conjunctions: moratoriums of 2015, 2017, 2019, 2021 and 2023 according to JPL (`datasets/curated/mars-conjunctions.json`). None falls during the stay of the 2024 campaign.
- [ ] 2026 Mars launch window (real dates, possible "current challenge" hook).
- [ ] DONKI WSA-ENLIL simulations with impacts at Mars (for surface events outside RAD).
- [ ] Typical error of CME arrival predictions (CCMC CME Scoreboard).
- [x] REMS minimums < −90 °C (40 sols): isolated drops of ~30 °C, treated as artifacts (see `datasets/README.md`). (The BioSentinel maxima were resolved with the cap in 3.2.1.)
- [x] Landing and reentry figures: Perseverance (~20 000 km/h, shield ~1300 °C, parachute at ~1500 km/h and 11 km) and Orion on Artemis I (~40 000 km/h, ~2800 °C, under 32 km/h at splashdown), with their sources in 4.3, 4.7 and `src/content/maneuvers.ts`.
- [x] Q factors by phase: Mars 3.05 (0.64 mSv / 0.21 mGy, Hassler 2014); cruise 3.8 (1.84 mSv / 0.48 mGy, Zeitlin 2013).
- [x] Real lead time between DONKI detection and RadLab peak for the campaign events: May 2024, 69 h (X1.0 from region 13664 on 05/08 → rise in BioSentinel on 05/11); October 2024, 1.9 h (X1.8 on 10/09). Details in `datasets/README.md`.
- [ ] Mars-500 findings on sleep and activity (Basner et al. 2013, PNAS).
- [ ] Weights of the efficiency formula, cascading-failure margins and cargo mass limits: tune them with playtests with kids.

## 11. Build order

1. **Shared core:**
   - Mission clock on real dates, with fast forward and slowdown on warnings.
   - The 3 meters with their formulas, plus the inventory.
   - Cascading failure.
   - The incident scheduler with unlock levels.
   - The crew of 4 with efficiency based on their state.
   - Saving the full state.

   All in `src/core/`, with tests.
2. **Translation infrastructure** (ES/EN) before writing new texts.
3. **Data processing:** from `datasets/raw/` to series by phase and date (`src/data/`).
4. **Trip** (outbound and return share map and systems): tasks, storm with shelter, Mission Control.
5. **Stay on Mars:** adapt the current map to Gale and add dust, cold, MOXIE and samples.
6. **Maneuvers** (common 4.0 format): ascent, landing, launch from Mars, reentry.
7. **Cards, data panel and mission report.**
8. **Progression and unlocks.**

## 12. Revision history

### v4 — route, BioSentinel and progression

| Topic | Change | Where |
|---|---|---|
| 4-month trip legs that did not match any route | **Nuclear thermal propulsion spacecraft** with a short stay, the architecture NASA is studying; the "accelerated trip" is removed | 2.1, 2.2 |
| Extreme BioSentinel values | **650 μGy/h cap** (99th percentile and May 2024 peak); storm dates are kept because they match DONKI SEPs | 3.2.1 |
| Unlock by teacher | **Removed:** the game is online and without teacher involvement | 6 |

### v3 — design decisions made in the Q&A session

| Topic | Decision | Where |
|---|---|---|
| End of the mission | **Full return:** launch from Mars, a return trip with fewer days, and reentry | 1, 2, 4.5–4.7 |
| Player | **Commander** as the 4th crew member, doing everything at 100 %; the specialists, ×1.5 on their own tasks | 3.3 |
| Science | **Samples on the map** of Mars, with mass: they count on returning | 4.4, 4.5, 5 |
| Platform | **PC with keyboard and mouse** | 1, 8 |
| Food | **Inside Health:** inventory stock; rationing lowers fitness and morale | 3.2, 3.5 |
| Risk | **Traffic light** | 3.6 |
| Difficulty | Optional **help mode** | 3.3 |
| Language | **Spanish and English** from the start | 8 |
| Time on Mars | **Fast forward** between sols too | 3.1, 4.4 |
| Saving | **At any time**, with the random generator state | 3.9 |
| Mission Control | **Messages, advice and remote diagnostics**, all with real delay | 3.7 |
| Maneuvers | **Checklist plus well-timed actions**, a common format | 4.0 |
| Visible data | **"This happened" cards and data panel** | 3.8 |
| Progression | **Unlocks:** the first mission has few tasks and incidents and more are added each game | 6 |

Derived consequences:
- **4-month legs in free mode too**, so the round trip's background dose does not exceed the 600 mSv limit on its own (in v4 this is justified by nuclear propulsion).
- **Return cargo:** a mass decision between samples and supplies.
- **Return calendar in the campaign:** June–October 2024, with the X9.0 of 10/03/2024 as the climax before reentry.

### v2 — review based on `Transcripcion_simulador_marciano.md` (review document, outside the repo)

| Issue raised | Change | Where |
|---|---|---|
| Ending the mission when a meter reaches zero is a "disguised Game Over" that cuts off recovery | **Cascading failure**: emergency modes, sacrifices with a cost (drink the water shield, clean panels) and a point of no return only when everything collapses | 1, 3.5, 5 |
| The jump between trip days makes crises feel like an error window | **Interactive fast forward** that slows down with real DONKI warnings, tints yellow and lets the player prepare before the impact | 2.1, 3.1 |
| Crew members at a fixed 70 % with a fixed 3–6 s delay punish something the player does not control | **Efficiency and delay depend on state** (fatigue, fitness, CO2, morale): from 100 % and 1 s to 50 % and 6 s, with the cause always visible | 3.3 |

Our own adjustments to the suggestions:
- **"Radio static" became a particle monitor.** Flares affect terrestrial shortwave radio, not the Deep Space Network, so static would give a false idea.
- **The fixed 48 h warning became the event's real lead time** according to the data, with 48 h as a fallback when there is no prior detection.
- **The efficiency formula also applies to the player's character** (speed, not decisions), so the rule is the same for everyone.
- **"You kill yourself" became "mission suspended, crew safe"**, because of the 7–12 audience.

### v1 — initial draft

4-phase arc, 3 meters, 2024 campaign and free mode, simplified cargo, automatic crew with fixed performance.

---

## Appendix: automatic crew members [rule]

- Daily routines are not planned by hand: each crew member works in their specialty and takes care of themselves (sleeps more if tired, exercises more if weak, calls home more if sad).
- **They repair on their own.** When the player chooses how to respond to a breakdown, the crew member who does it best goes (their specialist, if they can get there): they walk to the room, the broken tube or the cut cable and work. The player can go help with the minigame to finish sooner, but does not have to: a repair with someone assigned does not slow the clock. A bubble over their head shows the icon of what they are doing and, on the dashboard, their status (online, away, do not disturb, offline).
- At the final boarding on Mars, repairs continue even if the calendar is over, so a broken tube does not keep anyone from reaching the ship.

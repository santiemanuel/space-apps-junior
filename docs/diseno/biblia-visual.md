# Visual bible and scene catalogue — Mission to Mars

Document for directing image generation (backgrounds, tilesets, props, icons, portraits and illustrations) and starting to polish the interface. It summarizes the whole game from what **is seen**: which screens exist, what happens in each, which states they have and which graphic pieces they need. Rules and numbers are in [`game-design.md`](game-design.md); the architecture in [`plan-de-trabajo.md`](../historial/plan-de-trabajo.md). (Written before the art was produced, under the working title *Misión a Marte*; the game shipped as **Hello Mars**.)

---

## 1. The game on one page

**Mission to Mars** is a 2D top-down game for kids aged **7 to 12** (main target: 10), made for the *Junior Astronaut Mission Trainer* challenge of NASA Space Apps 2026. It is played on **PC with keyboard and mouse**, in Spanish or English.

> Take your crew from Earth to Mars and back home healthy, with the Mars samples on board,
> while **real** space weather tests every decision.

- Four astronauts travel in a **nuclear propulsion** spacecraft (4 months per leg), live a few sols in **Gale Crater** next to Curiosity and return to Earth.
- Everything that happens comes from **real NASA data**: the radiation measured by BioSentinel, Curiosity and Artemis I, the dust and cold from REMS, the solar storms from DONKI and the signal delay given by the distance.
- When real data causes something, the game shows it on a **"This really happened"** card with its date and source.
- **Nobody dies.** If everything goes wrong, the mission is suspended and "the crew is safe in the shelter waiting for rescue". A system at zero does not end the game: it forces sacrificing another one (cascading failure, like Apollo 13).
- Visual pillars: **clarity before detail**, a **traffic light** (green, yellow, red) for every risk, the **cause always visible** ("Miga is tired"), and a **warm and brave** tone, never horror.

## 2. Technical rules for the images

| Topic | Rule |
|---|---|
| Screen | **1280 × 720**, centered FIT scaling. Everything must read at that size |
| Grid | **48 px tile**. Tiles, props and map backgrounds in **multiples of 48 px** |
| Style | **Pixel art** like [`ref-nave.png`](../referencias/ref-nave.png): dark outlines, soft shading, a cool palette for the ship (lavender greys, blue, orange and yellow accents), warm for Mars (ochres, rust, dusty pink) |
| Format | **PNG with transparency** for sprites, props and icons; opaque backgrounds |
| Text | **No image contains text**: all interface text is translated (ES/EN) and drawn separately. No letters, numbers or logos with words in the images |
| Where they go | Game assets in `public/assets/<domain>/` (for example `public/assets/ship/`, `public/assets/mars/`, `public/assets/ui/`). `docs/` keeps only references |
| Characters | Sheets of 9 × 4 frames of **176 × 216** (front, back, left profile, right profile; idle and walk), feet at y = 208. On the map they are shown at scale 0.38 (≈ 1.7 tiles tall) |
| Legibility | Clear silhouettes, high contrast between what can be used and the decoration; nothing important communicated by color alone (add shape or icon) |

Current interface palette (can be refined, but it is a good starting point):

| Use | Color |
|---|---|
| General background | `#05070d` (bluish near-black) · panels `#111827` with border `#4a5568` |
| Text | `#e2e8f0` · secondary `#a0aec0` · dim `#718096` |
| Titles | `#90cdf4` (light blue) · focus/selection `#fbd38d` (amber) |
| Traffic light | green `#68d391` · yellow `#f6e05e` · red `#fc8181` |
| Real data | links and data marks `#63b3ed` (blue) · Mars `#f6ad55` (orange) |

## 3. Characters

### 3.1 Crew (sprite sheets already made: `docs/referencias/tripulacion/<id>-sprites.png`)

Chibi astronauts in white suits, a round helmet with a light-blue visor and details in their own color. **Portraits** (bust, expressions) and **special poses** that are missing today can be generated.

| Crew member | Role | Specialty (×1.5) | Suggested personality | Expressions needed |
|---|---|---|---|---|
| **Vega** | Commander (the player starts with her) | None: does everything at 100 % | Calm, determined, leader | Focused, happy, worried, talking to Earth |
| **Miga** | Engineer | Power, CO2 scrubber, leaks | Restless, clever, always holding a wrench | Fixing, tired, proud |
| **Brote** | Botanist | Food, greenhouse, water, pests | Calm, caring with plants | Tending plants, worried about a pest, hungry |
| **Senda** | Geologist and doctor | Samples, exercise, infirmary | Curious, adventurous, protective | With a sample, treating someone, on EVA |

States seen on the map (today with transparency and text bubbles; variants or icons would help):
- **Active** (the one the player controls): amber ring at the feet and an arrow above.
- **Resting** (infirmary): semi-transparent; a pose lying in bed is missing.
- **Slow** because of tiredness, high CO2, poor fitness or hunger: a bubble with the reason; small icons are missing (zzz, CO2 cloud, muscle, empty plate).
- **In the shelter** during a storm: a crouching or knees-hugging pose is missing.
- **On EVA** (outside on Mars): same suit, ideally with a backpack and dust on the boots.
- **Arrival on Earth**: walking out or on a stretcher (ending illustration).

### 3.2 Secondary characters

| Character | How it appears | What is missing |
|---|---|---|
| **Curiosity** | Rover parked outside at Gale; a bubble reports the day's real weather | Pixel art rover sprite (rectangles today), with a "dusty" version |
| **Mission Control** | A voice arriving from Earth with a delay: messages, advice, diagnostics | Portrait or icon (operator with a headset, control room), and a "no signal" variant for solar conjunction |
| **Maneuver narrator** | Line of text accompanying each stage | Small icon or portrait (can be Mission Control) |
| **Artemis I, BioSentinel, MOXIE** | Named on the data cards | Small illustrations of each spacecraft or instrument for the cards |

## 4. Mission arc, modes and progression

### 4.1 The seven phases (in play order)

| # | Phase | Screen | Threat | What is learned | Visual mood |
|---|---|---|---|---|---|
| 1 | Preparation and launch | `Loadout` + `Maneuver` (ascent) | Limited cargo; Van Allen belts | Everything you take has weight; Earth protects us | Launch pad, blue sky turning black, Earth below |
| 2 | Outbound trip | `Voyage` | Radiation (solar storms) | Shelter, exercise, isolation | Ship interior; windows with stars and an ever smaller Sun |
| 3 | Landing on Mars | `Maneuver` (landing) | "The seven minutes of terror" | The signal takes longer than the landing | Reentry fire, parachutes, Gale Crater from above |
| 4 | Stay on Mars | `Mars` | Dust and cold | The atmosphere protects from radiation but blocks the sun | Modular base, airlock, ochre exterior with rocks; day, night and dust storm |
| 5 | Launch from Mars | `Loadout` (return) + `Maneuver` | Mass: samples versus supplies | What you take home also has weight | Ascent vehicle in the crater; sample boxes |
| 6 | Return trip | `Voyage` (return) | Radiation with a worn ship and crew | Outbound decisions are paid for on the way back | The same ship, more worn (flickering lights, duct tape, cables) |
| 7 | Reentry to Earth | `Maneuver` (reentry) | Heat and precision | Coming back is hard too | Capsule wrapped in plasma, parachutes, splashdown in the ocean |

It ends with the **Mission report** (`Report`).

### 4.2 Menu modes and options

| Option | Values | What changes visually |
|---|---|---|
| **Mission** | *Real story 2024* (campaign: a single real calendar, from 01/15 to 10/10/2024) · *Free mode* (each phase with different real dates; level 3) | Dates on screen; in free mode there can be **solar conjunction** (Mission Control without signal) |
| **Length** | Short (~35 min) · Long (~75 min; level 3) | More days at normal speed |
| **Help mode** | Yes / No | The crew runs to the shelter on its own and Mission Control gives hints without being asked |
| **Language** | Español / English | All text |

### 4.3 Progression between games (unlock levels)

| Level | Unlocked when | New tasks | New incidents | Other |
|---|---|---|---|---|
| 1 | First game | Exercise, scrubber, shelter, samples, power board | Radiation storm, dust storm | 2024 campaign, short |
| 2 | Finishing 1 mission | Water recycler, greenhouse, call home | Broken scrubber, pest, isolation | "Workshop" cargo profile |
| 3 | Finishing 2 missions | MOXIE, trajectory correction, remote diagnostics | Micrometeorite, extreme night, high CO2 | Free mode, long mode |
| 4 | Finishing 3 missions | Airlock maintenance | Dust in the seals, solar conjunction | "Water shield" profile, special scenarios |

Locked options are shown with a padlock and the missing level: a **padlock icon** is needed.

## 5. What is seen in every simulation phase

### 5.1 The three meters (dashboard on the right)

| Meter | What it represents | Suggested icon |
|---|---|---|
| **Power** | Battery: solar panels versus consumption (light drops with distance from the Sun; on Mars, dust) | Battery / solar panel |
| **Air and water** | Oxygen, water and CO2 | O2 bubble, drop |
| **Health** (per crew member) | Four icons: radiation dose, fitness, food, tiredness | Atom/radiation, muscle, plate, moon/zzz |

For kids, the dose is shown in **chest X-rays** and as a percentage of the career limit: an **X-ray icon** is needed.

### 5.2 Clock alert levels

| Level | When | How it looks |
|---|---|---|
| **Calm** | No warnings; the calendar moves fast | Normal interface |
| **Alert** | Real detection (DONKI), dust starting, extreme night | **The whole screen tinted yellow**, the particle monitor beats faster, a notice at the top |
| **Impact** | Real radiation peak, dust or cold sol | Red tint, alarm, order to shelter; the shelter flashes with a yellow border |

The **particle monitor** (Geiger counter style) is a key indicator: a dot that flashes with every "click". It deserves its own design (handheld device or panel with a needle and a light).

### 5.3 Incidents (each needs an icon and, if possible, a mini illustration)

| Incident | Where | Responses (always with cost and traffic light) |
|---|---|---|
| Radiation storm | Trip and Mars | Everyone to the shelter (green) · Keep working (red) |
| Dust storm | Mars | Prioritize heat, air or science |
| Broken scrubber | Trip and Mars | Repair with a spare · Improvise |
| Micrometeorite (leak) | Trip | Patch the leak · Seal the module |
| Isolation | Trip and Mars | Call home |
| Extreme night | Mars | More heating · Close a zone |
| High CO2 | Trip and Mars | Repair the scrubber |
| Greenhouse pest | Mars | Let the botanist handle it |
| Dust in the seals | Mars | Airlock maintenance |
| Solar conjunction | Free mode | Two weeks without Mission Control |

### 5.4 Cascading failure (emergency mode)

When a meter reaches zero, the ship or base enters emergency and the player chooses a **sacrifice** with a cost: go out to clean the panels, turn off MOXIE, disconnect the shelter, **drink the shield water**, give more power to the recycler or MOXIE, have Senda treat the sick crew member, do fewer tasks, extra rations, prioritize the greenhouse. Visually: emergency lights, half the systems off, a banner with the remaining margin ("emergency power: 2 sols"). Each sacrifice needs an **icon**.

## 6. Scene catalogue

For each scene: when it appears, how it is composed today (all provisional, with rectangles and text), its states and which images should be generated. Prompt ideas are in English for the image models.

### 6.1 Loading (`Boot`)

- **When:** on opening the game. Loading bar with "Preparing the ship… N %".
- **Generate:** a hangar background or Earth seen from orbit, with central space for the bar; a loading bar shaped like a fuel tank or an advancing rocket.
- *Prompt:* `pixel art loading screen background, rocket in a launch hangar at night, soft blue lights, empty center area, 1280x720, no text`.

### 6.2 Main menu (`Title`)

- **When:** after loading and at the end of a mission.
- **Today:** title, subtitle, option rows (Continue, New mission, Mission, Length, Help mode, Language), the description of the selected option, the level and the completed missions.
- **States:** with or without a saved game ("Continue mission" appears with the phase and date); confirmation of "New mission" if there is a saved one; locked options with a padlock.
- **Generate:** key art for the game (the four astronauts looking at Mars from a ship window, or standing at Gale with Earth as a dot in the sky); a game logo **without text** (round mission emblem); frames for the buttons and the options panel; icons for padlock, language flag, clock (length), lifebuoy (help mode).
- *Prompt:* `pixel art key art, four cute chibi astronauts in white suits with colored accents looking out a spaceship window at Mars, warm and hopeful mood, starry background, 1280x720, no text`.

### 6.3 Outbound cargo (`Loadout`, outbound mode)

- **When:** first phase, on Earth.
- **Today:** three profile cards (**Water shield**, **Balanced**, **Workshop**), each with water, spare parts and food levels (from + to +++) and two risk traffic lights (radiation, repairs). A real fact at the bottom.
- **States:** selected profile; profile locked by level.
- **Generate:** a cargo bay background or the open ship on the pad; an illustration of each profile (water tanks around the shelter; toolbox and spare parts; a mix); icons for water, spare parts, food, radiation and wrench; level "bars" shaped like stacked boxes.
- *Prompt:* `pixel art cargo bay of a spaceship, water tanks, toolboxes and food crates neatly stacked, top-down three-quarter view, cool lavender palette, no text`.

### 6.4 Maneuvers (`Maneuver`): common format

The four maneuvers share the screen:

1. **Go / No-Go checklist:** one row per system with its light (green, yellow, red). If it is not green, the player chooses to **repair** (spends spare parts) or **take the risk**.
2. **Stages:** a horizontal bar per stage with a **hit zone** and a marker going back and forth; press Space in the zone. A yellow system shrinks the zone. Each stage shows a fun fact ("the shield reaches about 2000 °C").
3. **Result:** precision in words with a traffic light (excellent, good, with many corrections), remaining fuel and the maneuver's own effect.

Always at the top: title, narrator line and fuel bar. An **illustration background per stage** is needed (it is what will shine the most) plus common pieces: stage bar, hit zone, marker, an icon for each system (engines, scrubber, radio, panels, heat shield, parachutes, airlock, MOXIE, greenhouse, recycler), fuel bar.

| Maneuver | Stages (background to generate for each) | Result shown |
|---|---|---|
| **Ascent** (phase 1) | Ignition on the pad · Booster separation · Stage separation · Engine cutoff in orbit | Followed by the **Van Allen belts** crossing and its data card (Artemis I) |
| **Landing** (phase 3) | Atmospheric entry (shield glowing red) · Supersonic parachute · Shield separation · Descent engines over Gale | Distance to the base in km and the signal delay; with real dust that day, the narrator warns that Curiosity sees dust |
| **Launch from Mars** (phase 5) | Ignition in the crater · Orbit insertion | Fuel to correct course on the way back |
| **Reentry** (phase 7) | Point the shield · Reentry with plasma and radio blackout · Parachutes and splashdown | Each crew member **walks out or leaves on a stretcher** |

- *Prompt (example):* `pixel art side view of a space capsule entering Mars atmosphere, heat shield glowing orange, plasma trail, dark red sky, dramatic but friendly, 1280x720, no text`.
- **Dusty** variant for the landing stages (more orange, hazy Martian sky).

### 6.5 Outbound and return trip (`Voyage`)

- **When:** phases 2 and 6.
- **Composition:** on the left, the **top-down map of the ship** (19 × 15 tiles = 912 × 720 px, the camera follows the crew member); on the right, the **dashboard** (368 px wide). "Toast" notices appear above the map.
- **Ship layout** (horizontal corridor in the middle, four rooms above and four below, doors to the corridor):

  | Top | Command module · Exercise (bike) · CO2 scrubber · Water recycler |
  |---|---|
  | **Bottom** | **Beds and infirmary** · Pantry · **Water shelter** · Radio |

- **Stations** (what is used with E): exercise bike, CO2 scrubber, water recycler, radio console. Each has a frame with its system's light and a small progress bar.
- **Map states:** calm; alert (yellow tint); impact (red, shelter flashing); micrometeorite leak (pulsing red circle in a room); power emergency (lights off); worn ship on the way back.
- **Windows:** the stars and the Sun change with distance (the Sun smaller near Mars).
- **Generate:** 48 px ship tileset (floor, walls, doors, corridor, windows), props per room (command console with screens, exercise bike, scrubber machine, recycler with tanks, infirmary beds, pantry shelves, **shelter surrounded by water tanks**, radio console with antenna), a "worn" version of each prop, emergency lights, air leak particles.
- *Prompt:* `pixel art top-down spaceship interior tileset, 48px tiles, rooms connected by a central corridor, lavender gray metal floor, blue accent lights, matching ref style, PNG transparent props`.

### 6.6 Stay on Mars (`Mars`)

- **When:** phase 4.
- **Composition:** a 48 × 15 tile map: the **base** on the left (same layout as the ship), the **airlock** at the end of the corridor and the **outside** on the right (25 × 13 tiles of Martian ground). The camera follows the player.
- **Base layout:**

  | Top | Command · Exercise · CO2 scrubber · **Greenhouse** |
  |---|---|
  | **Bottom** | Beds and infirmary · **MOXIE (oxygen factory)** · Water shelter · Radio |

  + **Airlock** (2 × 3 tiles) between the base and the outside. The outer door locks at night and in storms (red square).
- **Outside:** sampling points (golden circles; farther ones are worth more), Curiosity parked with its weather bubble, rocks, tracks.
- **Sol cycle:** day (outings possible), **night** (darkened outside, real cold: heating), **dust storm** (hazy orange sky, panels getting less light), radiation storm (everyone to the shelter).
- **Generate:** base tileset (warmer and dustier than the ship), props (greenhouse with plants under violet lights, MOXIE as a machine with tubes, airlock with two doors), Gale ground tileset (ochre sand, rocks, veined stones, tracks), clean and dusty solar panels, **Curiosity**, glinting sample rocks, night overlay, dust overlay, airborne dust particles, Mount Sharp on the horizon for a background.
- *Prompt:* `pixel art top-down Mars surface tileset, Gale crater ochre sand, scattered rocks, rover tracks, dusty pink sky tint, 48px tiles, seamless`.

### 6.7 Dashboard (`Hud`, to the right of `Voyage` and `Mars`)

- Clock with traffic light, simulated date and **the day's data source**; the three meters; health with four icons per crew member; pending decisions with their cost and traffic light; active emergencies; particle monitor; key help at the bottom.
- **Generate:** dashboard frame (riveted console panel), meter and health icons, response buttons with traffic lights, small portraits of the four crew members (32–48 px), the particle monitor.

### 6.8 Planning (`Planning`, P key)

- Paused screen over the map: **each crew member's routine** in a 24-cell bar (sleep blue, exercise green, work orange, free grey) and the **power board** with "sockets": system chips dragged with the mouse, without numbers. (In the shipped game this screen was replaced by the resource console in the command room.)
- **Generate:** system chips (scrubber, recycler, greenhouse, MOXIE, radio, shelter, lights), empty and occupied sockets, a blackboard or tablet background.

### 6.9 Mission Control (`MissionControl`, C key)

- Messages from Earth (adapted real DONKI forecasts, encouragement, news from home), **advice** and **remote diagnostics**; everything arrives with the **real signal delay** and a countdown. Only the commander can request it, from the radio console. No signal during solar conjunction.
- **Generate:** Mission Control portrait, retro chat-style message screen, an icon of the signal travelling between Earth and the ship, an illustration of the Sun hiding Mars (conjunction).

### 6.10 Data panel (`DataPanel`, G key)

- Charts of the real data around the player's date: daily dose with its events, and on Mars cold and dust (UV); during the trip, the DONKI notices. The player's position is marked in time.
- **Generate:** a lab screen frame, icons for each instrument (BioSentinel, Curiosity RAD, REMS), event markers (flare, particles, CME).

### 6.11 "This really happened" card (`DataCard`)

- Opens on its own, with the clock paused, when real data causes something: date, mission and instrument ("Artemis I / HERA · NASA"), the value translated for kids ("64 times normal"), a sentence, the link to the source and, if the value is capped, a notice.
- Real events of the 2024 campaign: Van Allen crossing (Artemis I, 11/16/2022), deep-space storms (BioSentinel: 01/29, 02/09, 03/23, **05/11**, 06/08, 07/23, 09/15, 10/09/2024), storm on Mars (Curiosity, **05/20/2024**), dust (05/28/2024), extreme night (05/24/2024).
- **Generate:** a collectible card frame (like a trading card), **one illustration per event type** (Van Allen belts around Earth, solar flare, particle cloud reaching the ship, dust storm over Gale, freezing night on Mars, solar conjunction) and one per instrument or mission (Artemis I's Orion, BioSentinel, Curiosity).
- *Prompt:* `pixel art collectible card illustration, solar flare erupting from the Sun and particles streaming toward a small spacecraft, educational, bright, no text`.

### 6.12 Return cargo (`Loadout`, return mode)

- The ascent vehicle has a **mass limit**: rows for samples, food, drinking water, water shield and spare parts, with − and + buttons, the total mass against the limit and a traffic light per supply. (In the shipped game this became a grid cargo hold.)
- **Generate:** background of the ascent vehicle in the crater with its hold open; a balance or mass bar shaped like a scale; small rock sample boxes; icons for each row.

### 6.13 Pause (`Pause`, Esc)

- Continue, Save, Save and quit, Language; save status.
- **Generate:** pause panel (it can be the ship's hatch), a floppy disk or flag icon.

### 6.14 Mission report (`Report`)

Three pages:

1. **Summary:** the **3 stars** (healthy crew, low dose, samples on Earth), the **achievements** ("Shelter in time", "Like Opportunity", "Zero extra X-rays", "You survived the X9.0"), how each crew member came out (walking or on a stretcher) and their dose in X-rays, the samples brought back and the landing distance.
2. **Your mission:** the **real dose for each day** (blue in space, orange on Mars) over a timeline with the decisions and incidents, and the date-by-date list.
3. **Real data:** the cards experienced with their source, and why NASA is studying a nuclear spacecraft.

- **States:** mission accomplished (festive) or **mission suspended** (calm tone: "the crew is safe waiting for rescue"; the chain of decisions is shown).
- **Generate:** big stars (full and empty), **medals for each achievement** (shelter with water shield; dusty Opportunity rover; crossed-out X-ray; defeated X9 flare), a final illustration of the crew on Earth (capsule in the ocean, rescue boat, waving) and a "safe waiting for rescue" version (everyone together in the shelter, calm, with a warm light), a background with space confetti.

## 7. Prioritized list of pieces

| Priority | Piece | Scenes |
|---|---|---|
| 1 | Ship tileset (48 px) and props per room, with a worn variant | Voyage |
| 1 | Base and Gale ground tileset, Curiosity, panels, night and dust overlays | Mars |
| 1 | Icons: meters, health (4), systems (≈ 10), traffic light, incidents (10), sacrifices (≈ 10), padlock | Hud, Planning, Maneuver, Loadout |
| 2 | Backgrounds for the 13 maneuver stages (+ dusty variant for landing) | Maneuver |
| 2 | Data card illustrations (≈ 6 events + 3 instruments) and frame | DataCard, Report |
| 2 | Key art and menu emblem | Title, Boot |
| 3 | Portraits of the 4 crew members and Mission Control, with expressions | Hud, MissionControl, Report |
| 3 | Achievement medals, stars and ending illustrations | Report |
| 3 | Panel frames, buttons and bars (pixel art UI kit) | All |

## 8. What to avoid

- Text inside the images (it breaks translation).
- Images of death, injuries, blood or panic: the worst ending is "safe waiting for rescue".
- Drawing made-up data as if it were real (charts, numbers): the game puts the figures in from the data.
- Systems or places the game does not have (weapons, aliens, enemies): the threat is the real environment.
- Red as the only indicator: always with a shape or icon.

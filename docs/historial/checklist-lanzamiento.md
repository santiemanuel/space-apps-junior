# Pre-release fixes checklist

> **Historical document.** Every item is closed. Index: [`docs/README.md`](../README.md).

List of fixes requested before release, with the team's clarifications already included. Each item states the problem, where it is in the code, what to do and when it counts as done. Mark `[x]` when closing each one.

Decisions made:
- **Sleeping "on its own":** it was the fast clock when there were no tasks (`clock.idleBoost`), not real sleep.
- **Tasks when sleeping:** they are cancelled, with no effect (they neither add nor subtract).
- **Planning (P):** the whole screen is removed (routines and power). Resource management moves to a console in the command room. The storm warning becomes a big animated banner, like when a boss appears.
- **Mars:** 20 sols lasting **10–12 real minutes**, with risk/reward tasks (solar panels, night battery).

---

## A. Bugs

### [x] A1. Cut-off text in the launch minigames
- **Problem:** in the `Maneuver` stages (`ascent`, `marsAscent`) some instructions, counters or results do not fit in their box.
- **Where:** `src/game/scenes/flow/ManeuverScene.ts`, `src/core/maneuvers/flightGames.ts`, `src/i18n/{es,en}/maneuvers.json`.
- **What to do:**
  - Check each stage in Spanish and in English (English is usually longer).
  - Give each text a maximum width (`wordWrap`) and a height according to what it shows. If it still does not fit, make the font one step smaller or shorten the sentence, without losing the simple language.
  - Look especially at the instruction and progress of the arrow memory game, which moved to the side.
- **Done when:** the screenshots (`scripts/art/capture.mjs`) of each stage, in both languages and in the worst case (failures, final result), show no cut-off or overlapping text.

### [x] A2. Smoke left floating far from the rocket after liftoff
- **Problem:** the `puff()` puffs (`flightArt.ts`, ~l. 681) start at a fixed point and drift `drift` px away. When the rocket climbs or the camera moves, the smoke stays suspended in the air, detached from the rocket.
- **Where:** `src/game/scenes/flow/flightArt.ts` (smoke, vapor, dust).
- **What to do:**
  - Engine smoke comes out of the nozzle **at its current position**, not the liftoff one.
  - Smoke left behind sinks or leaves the frame and fades out before it looks isolated.
  - When the rocket leaves the frame, stop creating puffs and fade out the remaining ones, without cuts.
  - The same for `marsAscent` (dust).
- **Done when:** in a screenshot sequence (`FRAMES=n`) of `?scene=Maneuver&id=ascent` and `&id=marsAscent` there is no smoke detached from the rocket or the platform.

### [x] A3. Cannot sleep with fast forward on
- **Cause:** `HabitatSession.canSleep()` requires `this.manual`. With fast forward, `manual` is `false`, so sleeping is blocked even when there are no tasks.
- **Where:** `src/core/habitat/HabitatSession.ts` (`canSleep`, `sleep`), `SimulationMapScene.ts` (l. 349).
- **What to do:** allow sleeping in fast forward too, if the other conditions are met (calm, no emergencies, no decisions, no shelter or boarding). While sleeping, the sleep pace rules; on waking up the previous pace returns.
- **Done when:** there is a test in `VoyageSession.test.ts`: with fast forward and no tasks, `sleep('infirmary')` returns `true`.

### [x] A4. The fast clock without tasks looks like "sleeping on its own"
- **Cause (confirmed):** when the player has nothing to do, the clock speeds up (`clock.idleBoost`, turned on by `setIdle(!hasWork())` in `HabitatSession.update`). From the outside it looks like the crew fell asleep on its own, without warning and with no way out.
- **What to do:**
  - Sleeping is **always** a player action (Z in bed). The fast clock must not look or feel like sleeping: it is shown as "fast forward" with its own indicator (for example an animated ⏩ icon and the clock spinning) and the player keeps moving normally.
  - When really sleeping: the screen fades to black (or the crew member is shown in bed with "Z z z"), time advances and the wake-up key icon is shown.
  - The player can wake up whenever they want with Z or E. That is `wake(false)`: without the full rest.
  - If an alert, a decision or an emergency arrives, they wake up on their own, with a quick fade and the alarm.
- **Done when:** sleeping only starts with the key, the fast clock is not confused with sleeping, you can wake up by hand and automatic wake-ups are noticeable.

### [x] A5. Active tasks are cancelled when sleeping
- **Decision:** the day's tasks still pending when going to sleep **are cancelled with no effect**: they give no stars or reward and do not apply the consequence of not doing them either.
- **Where:** `HabitatSession.sleep()` / `wake()`, `pendingWork()`, `taskNeeded()`.
- **What to do:** when starting to sleep, close the day's pending tasks and record it in the history with no effects. Incident repairs and emergencies are not cancelled (you cannot sleep with them anyway, see `canSleep`).
- **Done when:** on waking up, the dashboard shows no tasks from the previous day and a test checks that the meters did not change because of those tasks.

### [x] A6. The automatic crew stays in the shelter after the storm
- **Problem:** when the storm ends, the automatic crew stays in the water shield room. It may be because the next alert is close or because the shelter state is not cleared.
- **Where:** `HabitatSession` (`shelter`, `checkShelter`, `targetFor`, `planRoutes`, `activityOf`), `core/crew/routines.ts`, `CLOCK_RULES.alertGapSeconds` (`core/clock/MissionClock.ts`).
- **What to do:**
  - Reproduce with `?scene=Voyage&fx=impact` and check what `targetFor` returns for each crew member when the storm ends.
  - When the impact ends, release the shelter and send each one back to their routine. If the next alert is close, have them do a short task anyway instead of standing still.
  - Lower the wait between incidents a little (`alertGapSeconds` or whatever applies), now that random tasks (C1) fill that time.
- **Done when:** there is a test where, after a storm, no automatic crew member is still in `shelter` after one simulated hour without a new alert.

---

## B. Interface and guidance

### [x] B1. Bed indicator in the infirmary (Z key)
- **What to do:** on entering the infirmary, show an animated **Z** key icon above the bed (bobbing or blinking). It is visible the whole time the player is in the room. If sleeping is not possible (alert, decision…), it appears dimmed or with a padlock, and on approaching it explains the reason in a few words.
- **Where:** `SimulationMapScene.ts` (`promptText`, which builds the `hud.sleep.prompt` text today). Place the bed with a `landmark` in `ship.json` and `gale.json` (not with a fixed position in the code).
- **Done when:** it is visible in the ship and Gale screenshots.

### [x] B2. Replace the room text with an icon in the center
- **Problem:** `roomPrompt()` puts a text under the crew member (`this.prompt`, l. 758) that follows them around the room.
- **What to do:**
  - Remove that text. Put an animated **E** key icon with the task's pictogram (wrench for maintenance, bike for exercise, pot for the kitchen, drop for water…) in the **center of the room** (or over the machine or the `spot`).
  - States: pending (bouncing or blinking), up to date (green check, still), blocked (grey with a padlock), incident (red with an exclamation mark).
  - If text is needed, a short line only when the player is right next to the machine.
  - The kitchen (`kitchenAt`) uses one icon per step: menu, recipe book, cook.
- **Where:** `SimulationMapScene.ts`, icons in `public/assets/hud/` (`scripts/art/icons.py`), `hudIcons.ts`.
- **Done when:** a full day is played without text attached to the player and every room is understood from the icon alone.

### [x] B3. Remove Planning (P) entirely and create the resource console in the command room
- **Today:** `PlanningScene` combines each crew member's routines (24 h bar) and the power board. Routines are already automatic (`smartRoutines`).
- **What to do:**
  - **Remove the whole screen** and the P key (also from the help, tutorials and `hud.planning.*` texts in `es/` and `en/`).
  - Create a **resource management console in the command room** (`command`; on Mars, in the power room, which already has the `power.panelBlocked` rule). You walk there and open it with E.
  - On the console you choose modes or priorities with a **visible benefit and cost**, so the risk/reward of a real mission is felt. Examples:
    - **Power saving:** the battery lasts longer, but the scrubber and the water recycler perform worse.
    - **Full science:** more mission progress and more samples, but more consumption and more system wear.
    - **Life support first:** safe air and water, but science slows down.
    - **Ration food or water:** supplies last more days, but morale and fitness drop.
  - Each option shows with icons and ▲▼ arrows what goes up and what goes down before confirming. The rules live in `src/core/` (with their own tests) and the console only draws them.
  - Keep crew switching with Tab and a minimal indicator of who is active.
- **Note:** `scenes/registry.ts` and `sceneKeys.ts` are frozen files. Removing the scene requires coordinating the integration.
- **Done when:** the P key is gone, resources are managed from the console, each option shows its benefit and cost, and `npm test` and `src/fullGame.test.ts` still pass.

### [x] B4. Radiation storm: "boss" banner and clear consequences
- **Today:** "Keep working" only says "The crew gets much more radiation" (`src/i18n/es/incidents.json`).
- **What to do:**
  - **Big animated banner** when the storm is about to arrive, like a boss introduction: huge text that comes in hard ("A SOLAR STORM IS COMING!"), stripes or a tinted screen, camera shake, alarm and the countdown to impact. It lasts 2–3 s and does not cover the game afterwards. Respect the reduced-motion preference.
  - Show the two options side by side with **what you gain and what you risk**, with icons and simple numbers:
    - **Shelter:** tasks paused and nobody goes out, but the dose stays low.
    - **Keep working:** tasks progress, but the dose is multiplied by N (in "X-rays").
  - While the storm lasts outside the shelter: dose meter in red, a radiation icon over each exposed crew member and a notice when a threshold is crossed.
  - The final report makes clear that the "low dose" star was lost because of that decision.
- **Where:** `incidents.json` (es/en), `HudScene` (`bottomRows`, decisions), `StatusView`, `audio/themes.ts`.
- **Done when:** a 7–12 year old can say what they gain and what they lose before choosing.

---

## C. Trip pacing and tasks

### [x] C1. Tasks that appear at random but with a reason
- **Today:** the day's tasks rotate by date (`taskNeeded`, `DAILY_TASKS`) and grow with the storms lived through.
- **What to do:**
  - Make them appear with `Rng` (the game's seed, never `Math.random`) and always with a visible reason: "the CO₂ filter is getting saturated", "the plant needs water", "Brote feels lonely: call home".
  - Limits so it is not overwhelming: at most N active tasks at once and a minimum gap between appearances.
  - Each task affects something concrete (resources, health, morale, systems) if not done in time.
  - The automatic crew can do them too, but **with a reaction delay** (they start X hours after the task appears), so the player has the chance to do it first and earn the stars.
  - These tasks fill the time between incidents (see A6, shorter wait).
- **Where:** `HabitatSession` (`taskNeeded`, `planDay`, `pendingWork`), `core/crew/routines.ts`, `content/ship.ts`, `content/gale.ts`.
- **Done when:** there are tests for the frequency and for the automatic crew's delay, and `fullGame.test.ts` still passes.

---

## D. Mars

### [x] D1. A 10–12 real-minute stay at Gale
- **What to do:** keep the 20 simulated sols, but make them last **10–12 minutes of real play**. Adjust the pace of the `mars` phase (`playHoursPerSecond`, `idleHoursPerSecond` or a rule of its own in `CLOCK_RULES`) and measure it.
- **Done when:** a normal game on Mars lasts between 10 and 12 minutes (measured with a test or a timed run) and `fullGame.test.ts` still passes.

### [x] D2. Mars tasks with risk/reward
- **What to do:** add **optional** tasks that matter for the mission. Doing them gives something positive; not doing them has a cost. Each one shows on its icon or on the console what is gained and what is risked.
  - **Clean the solar panels** (outing): dust slowly lowers generation and cleaning brings it back to the maximum. The risk is going out (time, dose, dust storm), and not cleaning leaves less power during the day.
  - **Get the base ready for the night** (insulate modules, lower loads, check the battery, heat up before sunset): the battery drains more slowly at night. In exchange it costs time or slows something down (science, comfort). If not done, the night uses more and there is a risk of a power cut.
  - Others: extra outings to look for samples, checking MOXIE, tending the greenhouse.
- **Where:** `MarsSession`, `content/gale.ts`, new minigames in `src/core/minigames/` (each with its strategy in `minigames.test.ts` and its mini tutorial in `minigames/tutorials.ts`).
- **Done when:** each new task really changes power or resources (with tests) and the player sees it before choosing.

### [x] D3. Cut-off weather sign (bottom right)
- **Problem:** on Mars, the weather sign at the bottom right appears cut off.
- **Where:** check the Curiosity row in `HudScene.realRows` (`hud.panel.curiosityShort`) and Curiosity's bubble in `MarsScene` (`curiosityBubble`, `mars.curiosity.bubble`).
- **What to do:** give it a maximum width and line wrapping, or reorder what it shows so it fits completely in both languages and with three-digit temperatures (for example −100 °C).
- **Done when:** the `?scene=Mars` screenshot in es and en shows the full sign.

### [x] D4. Bigger texts while exploring Mars
- **Problem:** the notices that appear while walking around Gale (collected rocks, terrain facts, `showToast`) are small and do not last long enough to learn from them.
- **Where:** `MarsScene.renderPlace` (`showToast` with `mars.rock.*.fact`, `mars.plant.collected`…), `showToast` in `SimulationMapScene`, `landmark` in `gale.json` and `content/galeTerrain.ts`.
- **What to do:** a bigger font, a legible high-contrast box and, when there is a fact to learn, a small icon or photo. Make them last according to the text length and not overlap (queued). Optional: when passing a `landmark`, a sign with its fact.
- **Done when:** the facts are comfortable to read at 1280×720 without covering the player.

### [x] D5. Lower and vary the footstep sound on Mars
- **Problem:** `footstepMars` sounds repetitive and shrill.
- **Where:** `SimulationMapScene.playSounds` (l. 379, volume 0.55 and pitch 0.94/1.06), `src/game/audio/themes.ts` (`paso-marte`).
- **What to do:** lower the volume (to about half), make it deeper (a muffled sand-and-dust sound), vary the pitch and volume slightly on each step without using `Math.random` (for example, a fixed cycle of variants) and space the steps out a little.
- **Done when:** walking outside for a minute is not tiresome and the footstep sits below the music and the notices.

---

## E. Ship cargo (packing items)

### [x] E1. Visual counters and water use
- **Where:** `src/game/scenes/flow/cargoGridView.ts`, `src/content/loadouts.ts`.
- **What to do:**
  - For each type (food, water, shield, spare parts, samples): a bar or a row of pieces with **available versus stowed** ("3 of 4"), with the resource icon.
  - Water: a visual guide to what it is used for: **drinking** (drop with a glass: days of water) or **shield** (drop with a shield: radiation protection). Show how each one changes when moving pieces.
- **Done when:** without reading paragraphs it is clear how much of each thing is missing and what the loaded water is for.

### [x] E2. Confirm button that warns about risk
- **Today:** the button always says `menu.loadout.return.confirm` (`cargoGridView.ts`, l. 339).
- **What to do:** if something is missing (a resource minimum, low shield, incomplete cargo), the button changes to **"Accept risks"**, in yellow or red depending on severity, with a short list of what is missing. If everything is there, it goes back to the normal text and color.
- **Done when:** both states show in the screenshots and the keys are in `es/` and `en/`.

---

## F. Landing art

### [x] F1. Landing on Mars and reentry to Earth at the level of the launches
- **Today:** `landing` and `reentry` use a generic sky, mountains and ground (`flightArt.ts`, l. 47–48) and a simple plasma (l. 468, 502).
- **What to do**, following the launch process (`art/prompts/vuelo-*.txt` → `gen.sh` → `pre.py` → `snap_pixels` → `scripts/art/flight-scenery.py`):
  - **Mars:** capsule with heat shield, entry plasma, parachute opening, shield released and falling, braking engines with dust rising, touchdown and a Gale background (Aeolis Mons, Mars sky).
  - **Earth:** reentry plasma with radio blackout, parachutes, splashdown with a splash, rescue ship or helicopter and the crew coming out (walking or on a stretcher, depending on their condition).
  - Effects: shaking, heat, sparks, passing clouds, sky color changing with altitude.
  - Record each new asset in `docs/produccion/pixel-art.md` and make the normal maps if needed.
- **Done when:** the screenshot sequences of `?scene=Maneuver&id=landing` and `&id=reentry` look at the same level as `ascent`.

---

## General verification
- `npm test`, `npm run typecheck`, `npm run build`.
- `src/fullGame.test.ts` (full 2024 campaign) still passes.
- Every new UI key is in `src/i18n/es/` and `src/i18n/en/`.
- All new randomness goes through `Rng`.

# Work plan — Mission to Mars (2 developers)

> **Historical document.** The work is finished and integrated; it is kept as a record. Index: [`docs/README.md`](../README.md).

Team: **Santiago** and **Facundo**.
Basis: [`game-design.md`](../diseno/game-design.md) v4 (especially §11 "Build order"), [`README.md`](../../README.md) and
[`AGENTS.md`](../../AGENTS.md).

Goal: that both move forward **in parallel and without blocking each other**, each with scenes, characters and stages that can be tested separately, and merge everything in **one integration pull request** at the end.

---

## Contents

1. [Split principles](#1-split-principles)
2. [Branch flow](#2-branch-flow)
3. [Stage 0 — Shared contracts (together)](#3-stage-0--shared-contracts-together)
4. [Scene map](#4-scene-map)
5. [Characters](#5-characters)
6. [Santiago — Simulation and open worlds](#6-santiago--simulation-and-open-worlds)
7. [Facundo — Mission flow and guided moments](#7-facundo--mission-flow-and-guided-moments)
8. [File ownership](#8-file-ownership)
9. [Working without the other (test doubles)](#9-working-without-the-other-test-doubles)
10. [Integration PR](#10-integration-pr)
11. [Pending decisions and checks](#11-pending-decisions-and-checks)
12. [Out of scope for this plan](#12-out-of-scope-for-this-plan)

---

## 1. Split principles

- **By domain, not by layer.** Each dev has their logic (`src/core/`), their content (`src/content/`) and their scenes (`src/game/`). That way each one can run and test their part end to end.
- **Contracts first.** The types that cross the boundary are agreed in Stage 0 and are not changed without notice.
- **Hot files frozen.** `main.ts`, `GameEvents.ts`, `sceneKeys.ts`, `config.ts` and `package.json` are only touched in Stage 0 and during integration.
- **Repository rules** (`AGENTS.md`, checked by `src/architecture.test.ts`):
  - `src/core/` does not import `phaser` or `src/game/`.
  - Only `src/data/` imports `datasets/`.
  - All randomness goes through a seeded `Rng`.
  - `src/game/` only draws and reads input; rules are delegated to the logic.
  - Tests next to the code (`*.test.ts`); factories in `src/test-utils/`.
  - UI, comments and tests in Spanish; simple language for ages 7–12.
  - `EnvironmentSnapshot.source` never presents archived data as "live".

| | Santiago | Facundo |
|---|---|---|
| Topic | The world that runs on its own: time, meters, crew, incidents, real data | The player's path: menus, cargo, maneuvers, visible characters, cards, report, saving |
| Scenes | `Voyage`, `Mars`, `Planning`, `Hud`, `MissionControl`, `DataPanel` | `Boot`, `Title`, `Loadout`, `Maneuver` (×4), `DataCard`, `Report`, `Pause` |
| Design sections | §3.1–3.7, §4.2, §4.4, §4.6, §7 | §2.1, §3.8, §3.9, §4.0, §4.1, §4.3, §4.5, §4.7, §5, §6, §8 |

---

## 2. Branch flow

```
master
 ├─ feat/contratos          (Stage 0, together)  ──► PR #1 to master
 │
 ├─ feat/simulacion         (Santiago, branches off master after PR #1)
 ├─ feat/flujo-maniobras    (Facundo,  branches off master after PR #1)
 │
 └─ feat/integracion        (branches off master; both branches are merged) ──► final PR to master
```

- Each dev can rebase onto `master` whenever they want; the branches are not merged with each other before integration.
- If someone needs to change a contract or a hot file: a small PR to `master` (`fix/contrato-...`), reviewed by the other, and both rebase.
- No automatic commits by agents (preference in `AGENTS.md`).

---

## 3. Stage 0 — Shared contracts (together)

**Status: complete (PR #1 merged; resolution added later on `master`).** Once merged, each one can work without touching shared files again.

### 3.1 Domain types

| File | Content | Used by |
|---|---|---|
| `src/core/flow/types.ts` | `PHASE_ORDER`, `PhaseId`, `ManeuverId`, `GameMode`, `MissionLength`, `UnlockLevel`, `LoadoutProfile`, `PhaseResult` (phase, `completed`/`suspended`, full output state, achievements) | Both |
| `src/core/state/types.ts` | Serializable `GameState` (pure JSON): `seed`, `rngState`, mode, length, help mode, level, `phase`, `simDate`, `meters`, `crew`, `activeCrewId`, `systems`, `inventory` (food, spare parts, `Sample[]` with mass), `waterShield` (0–1), `fuel` (0–1), `loadout`, `landingDistanceKm`, `activeIncidents`, `history` (for the report). It is called `GameState` so it does not clash with the prototype's `MissionState` | Both |
| `src/core/meters/types.ts` | `MeterState { energy: { batteryKwh, capacityKwh }, lifeSupport: { oxygenKg, waterL, co2MmHg } }`; `AlertLevel` | Both |
| `src/core/crew/types.ts` | `CrewRole`, `CrewId` (`vega`, `miga`, `brote`, `senda`), `CrewMemberState` (fatigue, fitness, morale, nutrition, dose, location, task, rest, `slowReasonKey`) | Both |
| `src/core/systems/types.ts` | `SYSTEM_IDS` / `SystemId` (scrubber, recycler, radio, panels, engines, heat shield, parachutes, MOXIE, greenhouse, airlock); `SystemStatus` | Both (maneuvers read; the simulation writes) |
| `src/core/incidents/types.ts` | `IncidentState`, `CascadeMeter`, `CascadeEmergency`, `CascadeSacrifice` | Santiago produces, both read |
| `src/core/events/RealEvent.ts` | `RealEvent` (date, instrument, mission, agency, value, unit, kids' text keys, `sourceUrl`, `capped`) | Santiago produces, Facundo shows |
| `src/content/crew.ts` | `CREW_ROSTER` (id, name, role) and `STARTING_CREW_ID = 'vega'` | Both |
| `src/core/rng/Rng.ts` | New `state` getter: `new Rng(rng.state)` continues the same sequence (saving) | Facundo (saving) |

Evolution rule: the domain owner can **add** optional fields; renaming, removing or changing the type of a field requires a small PR to `master` reviewed by the other.

### 3.2 Bus events (`src/core/events/GameEvents.ts`)

All declared; the prototype's ones are removed during integration.

| Event | Payload | Emits | Listens |
|---|---|---|---|
| `phase:started` | `{ phase }` | Facundo (flow) | Santiago (scenes) |
| `phase:completed` | `PhaseResult` | Both | Facundo (flow) |
| `clock:day` | `{ simDate }` | Santiago | Ambos |
| `alert:level` | `{ level: AlertLevel, reasonKey }` | Santiago | Hud, audio |
| `meters:changed` | `MeterState` | Santiago | Hud, saving |
| `crew:changed` | `CrewMemberState[]` | Santiago | crew views |
| `incident:warned` / `incident:started` / `incident:resolved` | `IncidentState` | Santiago | Hud, DataCard |
| `cascade:entered` / `cascade:sacrifice` / `cascade:noReturn` | `CascadeEmergency` / `CascadeSacrifice` / `{ reasonKey }` | Santiago | Hud, Report |
| `realEvent:shown` | `RealEvent` | Santiago | Facundo (DataCard, Report) |
| `crew:switched` | `{ crewId }` | Facundo (Tab input) | Santiago (camera/control) |
| `maneuver:stage` | `{ maneuverId, stage, hit }` | Facundo | Report |
| `save:requested` / `save:completed` | `{ reason }` / `{ savedAt }` | Facundo | — |

### 3.3 Scenes, scene data and registry

- `src/game/sceneKeys.ts`: every key from [section 4](#4-scene-map) and the `SceneKey` type.
- `src/game/scenes/sceneData.ts`: what each scene receives in `scene.start(key, data)`: `PhaseSceneData { state: GameState, bus }` and its variants `LoadoutSceneData` (`mode`), `ManeuverSceneData` (`maneuverId`), `VoyageSceneData` (`leg`), `ReportSceneData` (`outcome`) and `DataCardSceneData` (`event`, `bus`). Scenes communicate through `bus`, never by calling each other.
- Placeholder scenes (`PlaceholderScene`) for each new key, already in their folder:
  - `src/game/scenes/flow/` (Facundo): `BootScene`, `TitleScene`, `LoadoutScene`, `ManeuverScene`, `DataCardScene`, `ReportScene`, `PauseScene`.
  - `src/game/scenes/simulation/` (Santiago): `VoyageScene`, `MarsScene`, `PlanningScene`, `MissionControlScene`, `DataPanelScene`, plus the prototype's `HabitatScene` and `HudScene`.
- `src/game/scenes/registry.ts`: `ALL_SCENES = [...flowScenes, ...simulationScenes]` (frozen).
  - `flowScenes.ts` → only Facundo edits it. `simulationScenes.ts` → only Santiago edits it.
- `src/game/config.ts` uses `ALL_SCENES` and does not change again.
- The game keeps starting the prototype (`Habitat` + `Hud`) until integration.

### 3.4 Translation

- `src/i18n/index.ts`: `t(key, params?)` with `{param}`, `setLocale`, `getLocale`, `hasKey`; falls back to `es` and warns in the console with the key visible if missing.
- Keys: `<file>.<key>`, e.g. `common.role.commander`, `voyage.sceneTitle`.
- One file per domain and per language:

  ```
  src/i18n/es/  common.json  menu.json  maneuvers.json  report.json   ← Facundo
                voyage.json  mars.json  hud.json  incidents.json      ← Santiago
  src/i18n/en/  (same files)
  ```

- `common.json` already has roles with their description, phase names and `dataDate`.
- Tests (`src/i18n/index.test.ts`): same keys in `es` and `en`, no empty text, every role and phase has text.
- `src/architecture.test.ts`: `i18n/` does not import Phaser and `core/` does not import `i18n/` (the logic stores keys; the `game/` layer calls `t()`).

### 3.5 Test factories (`src/test-utils/factories.ts`)

`makeGameState(over?)`, `makeCrew()`, `makeCrewMember(over?)`, `makeMeters(over?)`, `makeRealEvent(over?)` (the 05/20/2024 storm on Curiosity/RAD), `makeIncident(over?)`, `makePhaseResult(over?)`. Shared file: functions are only **added**.

### 3.6 Crew view (`src/game/entities/CrewSprite.ts`)

- Interface `CrewSprite { crewId, sprite, sync(state), setSelected(selected), destroy() }` and factory `createCrewSprite(scene, crewId, x, y)`.
- Placeholder version: a circle tinted per crew member. Santiago uses it right away; Facundo replaces it with the animated one without changing the signature (F2).

### 3.7 Launching scenes directly in development

- Only in `npm run dev`: `http://localhost:5173/?scene=<Key>` opens the scene with `makeGameState()` and a new bus (`phase:completed` events are logged to the console). This code is not included in production.
- Own parameters: `?scene=Maneuver&id=landing`, `?scene=Loadout&mode=return`, `?scene=Report&outcome=suspended`, `?scene=Voyage&leg=back`, `?scene=DataCard`.
- `src/game/dev/devLaunch.ts` (frozen) combines `flowDev.ts` (Facundo) and `simulationDev.ts` (Santiago); each one adds there the data their scenes need. `null` marks scenes that cannot be opened on their own.

### 3.8 Resolution, tiles and graphic assets

- `src/game/display.ts` (frozen): **1280×720**, **48 px** tile. The screen shows 26.7 × 15 tiles; larger maps use a scrolling camera. The lunar prototype (32 px tiles) stays centered until it is removed.
- Crew sheets (`docs/referencias/tripulacion/*-sprites.png`): PNG with transparency, 1584×864 = **9 × 4 frames of 176×216**. Verified: no sprite crosses its frame's edge, the feet are at y = 208 and the center at x ≈ 88, so they work directly as a spritesheet with origin (0.5; 208/216). The on-screen scale is set by Facundo in `CrewSprite.ts` (≈ 0.35–0.4 so they are ~1.6–1.8 tiles tall).
- Game assets in `public/assets/<domain>/` (`crew/`, `ui/`, `maneuvers/` → Facundo; `ship/`, `mars/`, `hud/` → Santiago). `docs/` is for references.
- Generated images (e.g. with codex-cli): pixel art in the style of `docs/referencias/ref-nave.png`, PNG with transparency, sizes in multiples of 48 px (tiles and objects) or 1280×720 (backgrounds). The prompt used is noted in a `README.md` inside the asset's folder.

### Stage 0 acceptance criteria

- [x] `npm test`, `npm run typecheck` and `npm run build` green.
- [x] The current game still starts; the new scenes are placeholders.
- [x] Sprites assigned to roles (see §5.1).
- [x] Resolution and tile (§3.8).
- [x] PR #1 merged to `master`; `feat/simulacion` and `feat/flujo-maniobras` branches created.

---

## 4. Scene map

```
Boot ─► Title ─► Loadout(outbound) ─► Maneuver(ascent + Van Allen) ─► Voyage(outbound)
                                                                    │
     Report ◄─ Maneuver(reentry) ◄─ Voyage(return) ◄─ Maneuver(Mars launch) ◄─ Loadout(return) ◄─ Mars ◄─ Maneuver(landing)

Overlays at any time: Hud · Planning · MissionControl · DataPanel · DataCard · Pause
```

| Key | What it is | Design | Owner | Data it uses |
|---|---|---|---|---|
| `Boot` | Asset loading (sprites, tiles, audio) | — | Facundo | — |
| `Title` | Language, campaign or free mode, short or long, help mode, continue game | §2.1, §3.3, §8 | Facundo | saved progression |
| `Loadout` | `outbound` mode: 3 cargo profiles. `return` mode: sample mass versus supplies | §4.1, §4.5 | Facundo | `GameState.inventory` |
| `Maneuver` | Generic scene configured by `ManeuverDefinition` | §4.0 | Facundo | `SystemStatus`, `fuel` |
| `Voyage` | Top-down map of the ship, shared by the outbound and return trips (`leg: 'out' \| 'back'`) | §4.2, §4.6 | Santiago | RadLab BioSentinel/TGO, DONKI |
| `Mars` | Base in Gale Crater: interior, airlock, exterior with sampling points | §4.4 | Santiago | Curiosity RAD and REMS |
| `Planning` | Pause: routines per crew member and power board (dragged chips, no numbers) | §3.1, §3.2 | Santiago | `GameState` |
| `Hud` | 3 meters, traffic light, data date, yellow alert tint, particle monitor | §3.1, §3.6 | Santiago | bus events |
| `MissionControl` | Messages, advice and remote diagnostics with a countdown for the delay | §3.7 | Santiago | distance by date, DONKI notifications |
| `DataPanel` | Charts of the real data for the current date | §3.8.2 | Santiago | `src/data/` series |
| `DataCard` | "This really happened" card, paused | §3.8.1 | Facundo | `RealEvent` |
| `Report` | Final report: 3 stars, achievements, decisions against real charts | §5 | Facundo | game history |
| `Pause` | Esc: continue, save and quit, language | §3.9 | Facundo | — |

---

## 5. Characters

### 5.1 Crew (§3.3)

| Crew member | Role | Speed | What they do | Sprites |
|---|---|---|---|---|
| **Vega** (player at the start) | Commander | ×1.0 on everything | Covers any task and asks Mission Control for advice or diagnostics | `docs/referencias/tripulacion/vega-sprites.png` |
| **Miga** | Engineer | ×1.5 on her own tasks | Repairs systems and leaks, manages power and corrects the trajectory | `docs/referencias/tripulacion/miga-sprites.png` |
| **Brote** | Botanist | ×1.5 on his own tasks | Tends the greenhouse, food and water, and controls pests | `docs/referencias/tripulacion/brote-sprites.png` |
| **Senda** | Geologist-doctor | ×1.5 on her own tasks | Collects samples on outings, guides exercise and cares for the crew | `docs/referencias/tripulacion/senda-sprites.png` |

Roster in `src/content/crew.ts`; roles and descriptions in `src/i18n/*/common.json`. The sheets have 4 rows (front, back, left profile, right profile) × 9 frames (idle and walk). Mood references: `docs/referencias/ref-nave.png` and `docs/referencias/tripulacion/miga-sala-orbital.webp`.

### 5.2 Split

| Part | Owner | Location |
|---|---|---|
| State and rules: efficiency, reaction (1–6 s), optimal or blind route, ×1.5 specialty, automatic routines, rest in the infirmary, help mode | Santiago | `src/core/crew/` |
| View: loading the sheets, animations per direction, idle, walking at a speed proportional to efficiency, bubble with the reason ("Ana is tired: she slept 4 h"), active crew member indicator | Facundo | `src/game/entities/CrewSprite.ts` |
| Input: Tab to switch crew member (emits `crew:switched`) | Facundo | `src/game/input/` |
| Camera and control of the active crew member in `Voyage`/`Mars` | Santiago | simulation scenes |

Contract (§3.6): the scene moves `CrewSprite.sprite`; the view receives the `CrewMemberState` in `sync()` and decides nothing.

### 5.3 Secondary characters

| Character | Where it appears | Owner |
|---|---|---|
| Mission Control (voice and portrait on the console) | `MissionControl` | Santiago |
| Curiosity, the "robot neighbour" that reports the day's data | `Mars` (scenery + daily message) | Santiago |
| Narrator of the maneuvers and the cards | `Maneuver`, `DataCard` | Facundo |

---

## 6. Santiago — Simulation and open worlds

Branch: `feat/simulacion`. Everything in `src/core/` has tests.

### S1 · Mission clock — `src/core/clock/`

- Advances in real mission hours over real dates (§3.1).
- Speeds: Calm (~1 day every 2 s), Alert (slow), Impact (normal time), Pause.
- Automatic slowdown on scheduler warnings; real DONKI→RadLab lead time, or 48 simulated hours if there is no detection.
- Lengths per phase according to short or long mode (table in §2.1) and the 2024 campaign calendar (§2.2).

**Accept:** a test that simulates 120 days and checks the clock slows down on 5/8/2024 before the May storm.

### S2 · Meters — `src/core/meters/`

- **Power:** `P_panels × 1/r² × f_dust × f_light` − consumption; capped battery; `f_dust` from REMS UV.
- **Life support:** O2 0.82 kg per crew member per day, CO2 up to 3 mmHg, water 2.5 L + EVA, 90–98 % recycling.
- **Health:** dose (`rate × f_shielding × Q × Δt`) with a shelter from 0.2 to 0.6 depending on the water shield; nutrition (3035 kcal); fitness; tiredness; morale.
- Dose for kids: chest X-rays (0.1 mSv) and % of the career limit (600 mSv).
- Replaces the current `ResourceModel` (4 resources → 3 meters + inventory, §9).

**Accept:** tests of each formula with the values cited in the design.

### S3 · Cascading failure — `src/core/cascade/`

- Automatic emergency modes per meter and sacrifices with a cost (table in §3.5).
- Remaining margin ("emergency power: 2 sols").
- Point of no return: the whole crew resting, or two meters depleted longer than their margin.
- Replaces the current game over when a resource runs out.

**Accept:** test "drink the water shield" → the shelter goes to 0.6 → more dose in the next storm.

### S4 · Crew — `src/core/crew/`

- `efficiency = clamp(1 − 0.25·fatigue − 0.25·(1−fitness) − 0.15·[CO2>3] − 0.10·(1−morale), 0.5, 1)`.
- Reaction, route, specialty, routines assigned in `Planning`, help mode (the automatic crew goes to the shelter on its own).
- Text for the reason of slowness (a translation key, never text written in the code).

### S5 · Incident scheduler — `src/core/incidents/`

- Single format from §3.4: `id, phase, unlock_level, trigger, warning, effect, responses, costs, source, text_key`.
- Sources: real timeline + safe range + seeded failures.
- Filtered by `unlockLevel` (§6). Extra wear in `cruiseBack` (§4.6).
- Content in `src/content/incidents.ts`: radiation storm, dust storm, broken scrubber, micrometeorite, isolation, extreme night, high CO2, pest, dust in the seals, solar conjunction.
- Emits `realEvent:shown` with a full `RealEvent` for each dataset event.
- Done: `core/incidents/` (`definitions.ts` with the §3.4 format, `timeline.ts`, `planner.ts`), `content/incidents.ts`, `data/incidentTimeline.ts`. Dynamic warnings reach the clock with `MissionClock.addAlert`; the scheduler state (`IncidentPlannerState`) travels with the `GameState`, like the cascade's.

### S6 · Data — `src/data/`

| Series | Origin (`datasets/raw/`) | For |
|---|---|---|
| Van Allen | `radlab/daily/moon-orbit-lro-crater.csv` (Artemis I) | Facundo (ascent) via `RealEvent`/series |
| Dose during the trips | `radlab/daily/deep-space-biosentinel.csv` (650 μGy/h cap), `mars-cruise-orbit-tgo-liulin.csv` | S2 |
| Storms | `radlab/events/2024-05-gannon-storm_heliocentric.csv`, `donki/sep.json`, `flr.json`, `cme.json` | S5 |
| Mission Control texts | `donki/notifications.json` | S9 |
| Dose on Mars | `radlab/daily/mars-surface-curiosity-rad.csv`, `events/2024-05-20-mars-sep_curiosity.csv` | S2, S8 |
| Dust and cold | `mars-weather/curiosity-rems.json` | S2, S8 |

- API: `seriesFor(phase, date)` and `eventsBetween(from, to)`.
- Each new series is documented in `datasets/README.md` (source, URL, use).
- When a BioSentinel value is clipped: `capped: true` in the `RealEvent`.
- Done: `src/data/realData.ts` (`seriesFor(phase, date)`, `eventsBetween(from, to, rules)`), `vanAllen.ts` (`VAN_ALLEN` with its `RealEvent` for the ascent), `notices.ts` (`DONKI_NOTICES` + `noticeText`) and full-resolution peaks on the cards. All of it comes from `node scripts/build-events.mjs`.

### S7 · `Voyage` scene

- Top-down map: command module, exercise, scrubber, recycler, water shelter, radio, pantry (§4.2; visual reference `docs/referencias/ref-nave.png`).
- Tasks: exercise, scrubber, recycler, call home. Trajectory correction (minigame) is left for level 3.
- Radiation storm: alarm, everyone to the shelter, arrival time according to each crew member's reaction.
- `leg: 'back'`: worn ship, only the leftover spare parts, exercise counts double.
- Done: `core/voyage/` (`ship.ts` with zones and optimal or blind routes, `VoyageSession.ts` combining clock, meters, routines, cascade and incidents and publishing on the bus), `content/ship.ts` (19 × 15 tile layout, tasks, default routines, wear) and `VoyageScene` with a temporary dashboard on the right (replaced by `Hud` in S9). The cascade, scheduler and wear state travels with the session, as in S3/S5. Temporary until F2: Tab emits `crew:switched` from the scene (remove during integration). Dev: `?scene=Voyage&leg=back&from=2024-05-07&help=1&level=2&length=long`.

### S8 · `Mars` scene

- Adapt `HabitatScene` to Gale Crater (`MISSION_SITE = 'marsSurface'`).
- Sol cycle: planning, day (tasks and EVA), night (real cold → heating).
- Sampling points placed by seed, with mass and value according to distance.
- Scaled MOXIE, greenhouse, airlock.
- Hands Facundo the `inventory.samples` for `Loadout` in `return` mode.
- Done: the `Voyage` engine moved to `core/habitat/` (`HabitatSession` + `layout.ts`, with airlock and exterior) and `Voyage` and `Mars` are subclasses. `core/mars/MarsSession.ts`: Martian sunlight (day from 6 to 18 h UTC, an approximation), dust from REMS UV, heating with the real minimum, MOXIE, greenhouse, daytime EVA with unshielded dose and seeded sampling points (farther if the landing was far). `content/gale.ts` and `MarsScene` (48 × 15 tile map with camera). `GALE_POWER` went to 100 kW at 1 AU and 160 kWh so it is enough with a clear sky and one night. Samples end up in the `PhaseResult`'s `inventory.samples`. Dev: `?scene=Mars&km=6&where=airlock&from=2024-05-20`. `HabitatScene` (lunar prototype) stays until integration.

### S9 · Overlay scenes: `Hud`, `Planning`, `MissionControl`, `DataPanel`

- `Hud`: 3 meters (health with 4 icons), traffic light without percentages, data date and source, yellow tint, particle monitor with clicks that speed up.
- `Planning`: routines and power board with the mouse.
- `MissionControl`: real delay with a countdown and blocked during solar conjunction.
- `DataPanel`: charts with the player's position in time.
- Done: overlays talk to the session through their own bus, `SimulationEvents` (`core/habitat/events.ts`): `sim:snapshot` every frame and requests `sim:pause|respond|sacrifice|routines|loads|ask`. It does not touch `GameEvents.ts`; it can be merged during integration. Map scenes launch `Hud` and open `Planning` (P, paused), `MissionControl` (C, the clock keeps running) and `DataPanel` (G, paused). `HudScene` keeps the lunar prototype dashboard if `Boot` opens it with `{ session }`. Signal delay with JPL's approximate orbits (`datasets/curated/planet-elements.json`); advice and remote diagnostics (×1.5) are requested by the commander from the radio. The particle monitor sounds with Web Audio (M mutes).
- After S9: planning opens on its own with each new warning; the board has as many sockets as today's sun allows (`power.socketKw`; with "Low" dust at Gale none are left); Mission Control adds news from home every 3 days; Curiosity is parked outside with the day's data; the dashboard flickers during Alert.

### Santiago's deliverables

- [x] `core/clock`, `meters`, `cascade`, `crew`, `incidents` with tests.
- [x] `src/data/` series documented in `datasets/README.md`.
- [x] Playable `Voyage` (outbound and return) and playable `Mars` with a test state.
- [x] `Hud`, `Planning`, `MissionControl`, `DataPanel`.
- [x] Texts in `voyage/mars/hud/incidents.json` (es + en).

---

## 7. Facundo — Mission flow and guided moments

Branch: `feat/flujo-maniobras`.

### F1 · Full translation — `src/i18n/`

- ES/EN selector in `Title` and `Pause`.
- Move the texts currently written in `HudScene` and `content/missions.ts` to keys.
- Number and date formatting per language (`Intl`).
- Done: ES/EN selector in `Title` and `Pause` (remembered in the browser), `i18n/format.ts` (dates, numbers and times with `Intl`) and `i18n/locales.ts`. Pending: the texts in `HudScene` and `content/missions.ts` (prototype removed during integration).

### F2 · Visible characters — `src/game/entities/CrewSprite.ts`

- Load the 4 sheets in `Boot` (spritesheet, frame size to be measured on the PNGs).
- `idle-{dir}` and `walk-{dir}` animations for the 4 directions.
- Status bubble (reason for slowness), active crew member marker, Tab.
- **Best published first** as a separate branch or package so Santiago can see it, even if it is integrated at the end.
- Done: `entities/CrewSprite.ts` (same signature) + `entities/crewAnimations.ts`: `crew-<id>` sheets loaded in `Boot` (`src/game/assets.ts`, files in `public/assets/crew/`), `idle-*`/`walk-*` in 4 directions, pace according to speed, bubble with `slowReasonKey`, arrow and ring for the active one, physics body at the feet. Tab: `input/crewSwitch.ts` (`bindCrewSwitch`, skips those who are resting); during integration it replaces the temporary Tab in `VoyageScene`.

### F3 · Mission flow — `src/core/flow/MissionFlow.ts`

- State machine of the 7 phases: `prep → ascent → cruiseOut → landing → mars → marsAscent → cruiseBack → reentry → report`.
- Applies the `PhaseResult` to the `GameState` and decides the next scene.
- Pure and testable: a test of a full run with fake results.
- Done: `core/flow/MissionFlow.ts` (`stepFor`, `complete`, `recordRealEvent`; the Mars launch has two steps and a game saved in between resumes where it left off) and `game/scenes/flow/FlowDirector.ts`, which connects it through the bus: it starts each scene (`phaseScenes.ts`), emits `phase:started`, autosaves on each `phase:completed`, opens `DataCard` on `realEvent:shown` (queued, pausing what is running), `Pause` with Esc, and at the end updates the progression.

### F4 · Maneuver engine — `src/core/maneuvers/`

- `ManeuverDefinition { id, checklist: SystemId[], stages: { id, zoneWidth, speed }[] }`.
- Go/No-Go checklist: a yellow system can be fixed first or you can take the risk.
- Bars per stage: Space in the right zone; a yellow system shrinks the zone (§4.0).
- A mistake costs fuel, precision or an extra correction, and **never ends the game**.
- Result: total precision, remaining fuel, `PhaseResult`.
- Done: `core/maneuvers/` (`ManeuverRun`: checklist with repair or take the risk, seeded zones, a marker going back and forth, mistakes that cost fuel, `toPhaseResult()` with history).

### F5 · `Maneuver` scene + 4 configurations — `src/content/maneuvers.ts`

| Maneuver | Stages | Particularity |
|---|---|---|
| Ascent (§4.1) | Ignition, booster separation, stage separation, cutoff | Followed by the Van Allen crossing: health meter tutorial with the Artemis I peak of 14 393 μGy/h |
| Landing (§4.3) | Entry (~2000 °C), parachute (~Mach 1.7), shield separation, engines | Result: distance to the base; difficulty according to precision, cargo and the day's dust; message about the signal delay |
| Launch from Mars (§4.5) | Ascent vehicle checklist, liftoff | Precision decides the fuel for corrections on the way back |
| Reentry (§4.7) | Point the shield, reentry (heat and communications blackout), parachutes and splashdown | Ending: the crew walks or leaves on a stretcher according to their fitness |

Figures marked [verify] in the design are shown as estimates until confirmed.
- Done: `content/maneuvers.ts` (4 maneuvers, `MANEUVER_RULES`, landing difficulty by fuel and cargo, a temporary `VAN_ALLEN_EVENT` until `VAN_ALLEN` from `src/data/` is used) and `ManeuverScene`. Dev: `?scene=Maneuver&id=landing&yellow=heatShield&red=parachutes`. The day's real dust (REMS) is added during integration.

### F6 · `Title` and `Loadout`

- `Title`: language, 2024 campaign or free mode (locked until level 3), short or long, help mode, continue.
- `Loadout` `outbound` mode: Water shield / Workshop / Balanced profiles (locked by level, §6), each with its effect explained and its traffic light.
- `Loadout` `return` mode: mass limit, samples versus food, water and spare parts; a reminder that water is also shielding.
- Done: `TitleScene` (+ `core/flow/titleMenu.ts`, `core/flow/newGame.ts`, `content/missionStart.ts`) and `LoadoutScene` (+ `core/loadout/loadout.ts`, `content/loadouts.ts`). Return limit: 1660 kg [rule] (see §11). Dev: `?scene=Title&level=3&save=1`, `?scene=Loadout&level=4`, `?scene=Loadout&mode=return`.

### F7 · `DataCard` and `Report`

- `DataCard`: date, instrument and mission, translated value ("304 μGy/h: 64 times normal"), a sentence, link to the source and a notice if the value is clipped.
- `Report`:
  - 3 stars: healthy crew, low controllable dose, samples brought to Earth.
  - Achievements: "Shelter in time", "Like Opportunity", "Zero extra X-rays", "You survived the X9.0".
  - Player decisions next to the real charts; cards experienced; explanation of the nuclear route.
  - In a suspended mission: the chain of decisions, with the wording "the crew is safe waiting for rescue".
- Done: `DataCardScene`, `ReportScene` (3 pages) + `core/report/report.ts` and `content/achievements.ts`. The achievements that depend on the simulation ("Shelter in time", "Zero extra X-rays") arrive in `PhaseResult.achievements` and are saved in `GameState.achievements` (new optional field). The report's real charts are added during integration with `seriesFor()`; for now there is a timeline with the decisions and the cards experienced. Dev: `?scene=Report&outcome=suspended`.

### F8 · Saving and progression — `src/core/save/`, `src/core/progression/`

- Full serialization of `GameState` (including `rngState`), with a schema version.
- Manual save (Esc → Save) and autosave on each `phase:completed`.
- Storage in `localStorage` behind an injectable `SaveStore` interface (implementation in `src/game/`).
- Progression: levels 1–4, records, achievements.

**Accept:** round-trip test: save → load → same state and same `Rng` sequence.
- Done: `core/save/` (`SaveStore`, `MemorySaveStore`, game/progression/settings with versions) and `game/storage/browserSaveStore.ts`; `core/progression/` (levels, `UNLOCK_AT`, `recordMissionEnd`). `PauseScene`: continue, save, save and quit, language. While a simulation phase runs, the state from the start of the phase plus the cards experienced is saved: during integration, `Voyage`/`Mars` must publish their state for manual saving.

### Facundo's deliverables

- [x] Full `i18n` and current texts migrated (checked during integration: in `src/game/` only proper names like "Curiosity" remain).
- [x] `createCrewSprite` with the 4 animated characters and Tab switching.
- [x] `core/flow`, `maneuvers`, `save`, `progression` with tests.
- [x] `Title`, `Loadout`, `Maneuver` (4 configuraciones), `DataCard`, `Report`, `Pause`.
- [x] Texts in `menu/maneuvers/report/common.json` (es + en).

---

## 8. File ownership

| Path | Owner |
|---|---|
| `src/core/clock/`, `meters/`, `cascade/`, `crew/`, `incidents/`, `environment/`, `resources/` | Santiago |
| `src/core/flow/` (except `types.ts`), `maneuvers/`, `save/`, `progression/` | Facundo |
| `src/data/`, `datasets/`, `scripts/` | Santiago |
| `src/content/habitat.ts`, `ship.ts`, `gale.ts`, `incidents.ts`, `startingConditions.ts`, `campaign.ts`, `meters.ts`, `cascade.ts` | Santiago |
| `src/content/maneuvers.ts`, `loadouts.ts`, `achievements.ts` | Facundo |
| `src/game/scenes/simulation/*`, `simulationScenes.ts` | Santiago |
| `src/game/scenes/flow/*` (incluye `BootScene.ts`), `flowScenes.ts` | Facundo |
| `src/game/entities/CrewSprite.ts`, `src/game/input/`, `src/game/textures.ts`, `src/game/dev/flowDev.ts` | Facundo |
| `src/core/loadout/`, `report/`, `src/content/missionStart.ts`, `src/game/assets.ts`, `src/game/ui/`, `src/game/storage/`, `public/assets/crew/` | Facundo |
| `src/game/dev/simulationDev.ts` | Santiago |
| `src/game/entities/StationView.ts` | Santiago |
| `src/i18n/*/voyage\|mars\|hud\|incidents.json` | Santiago |
| `src/i18n/*/menu\|maneuvers\|report\|common.json` | Facundo |
| `src/test-utils/factories.ts` | Shared: functions are only **added**, existing ones are not modified |
| `src/main.ts`, `GameEvents.ts`, `sceneKeys.ts`, `config.ts`, `display.ts`, `registry.ts`, `sceneData.ts`, `devLaunch.ts`, `i18n/index.ts`, `package.json`, Stage 0 `*/types.ts` | **Frozen**: Stage 0 or integration |

---

## 9. Working without the other (test doubles)

| Need | Santiago solves it with | Facundo solves it with |
|---|---|---|
| Starting their scene | A dev URL parameter (`?scene=Voyage`) that starts the scene with `makeGameState()` | `?scene=Maneuver&id=landing` |
| Characters | Temporary `createCrewSprite` (tinted circle) | `makeCrew()` with varied states (tired, healthy, resting) |
| Real data | The real series (they are his) | `makeRealEvent()` and a fixed Artemis I series in the factory |
| Neighbouring phases | — | Stub scenes that emit `phase:completed` with `makePhaseResult()` |
| Chosen cargo | `makeGameState({ waterShield: 1 })` | — |
| Yellow systems | — | `makeGameState({ systems: { scrubber: 'yellow' } })` |

The `?scene=` selector is already implemented (§3.7): each one adds their test data in their `*Dev.ts`.

---

## 10. Integration PR

### 10.1 Steps

1. Both rebase their branch onto `master` and leave the tests green.
2. `feat/integracion` is created from `master`; `feat/flujo-maniobras` is merged and then `feat/simulacion`.
3. Connections:

| Connection | Who does it |
|---|---|
| `main.ts` creates the initial `GameState`, the real `GameSession` and starts `MissionFlow` | Facundo |
| `Voyage`/`Mars` already use `createCrewSprite`: check with the animated version | Santiago |
| `crew:switched` (Tab) → camera and control in the simulation scenes | Santiago |
| `realEvent:shown` → `DataCard` (pauses the clock) | Facundo |
| `Loadout` → initial `waterShield`, `inventory` and `spares` for `Voyage` | Facundo |
| `Mars` → `inventory.samples` → `Loadout(return)` | Santiago |
| Landing result (distance) → sampling points and EVA in `Mars` | Santiago |
| Saving: serializes clock, meters, crew and active incidents | Facundo |
| `CascadeState` (`src/core/cascade/types.ts`) enters `GameState` as an optional `cascade` field so it can be saved; until then it travels separately so the contracts are not touched | Santiago (type) · Facundo (saving) |
| Decision and incident history → `Report` | Facundo |
| `progression` unlocks → incident scheduler filter | Santiago |

4. The lunar prototype and dead code are removed (4-resource `ResourceModel`, 1/2/3 decisions, game over by resource), and `README.md` is updated (it said "Lunar Base" at the time).

**Done in `feat/integracion`:**
- `main.ts` only creates the game: `BootScene` starts `FlowDirector`, `Title` creates the `GameState` with `createNewGame` and each phase builds its session (`VoyageSession`, `MarsSession`, `ManeuverRun`). `GameSession` was removed with the prototype.
- Tab: `SimulationMapScene` uses `bindCrewSwitch` (skips those who are resting).
- `realEvent:shown` → `DataCard` with the scenes paused (the clock does not advance). The Van Allen card is `VAN_ALLEN` from `src/data/` (HERA, Artemis I). The scheduler logs each card with all its data (`realEventLogEntry`) and `MissionFlow` does not repeat it.
- Landing: the difficulty adds the day's real dust (REMS UV at Gale, the same factor as the panels) and the narrator warns about it. The distance already reached `Mars` through `GameState.landingDistanceKm`.
- Cargo: `MISSION_START` carries the O2 for the whole mission (+10 %); each place has its own battery (`HabitatPower.capacityKwh`: on arriving at Gale the base's, charged, is used; on the way back, the ship's).
- Saving mid-phase: `Voyage`/`Mars` publish `phase:progress` with `GameState.habitat` (scheduler and cascade, instead of the planned `cascade` field) and `MissionFlow.progress()` saves it; on resuming, incidents already triggered are not repeated.
- Simulation achievements in `PhaseResult.achievements`: "Shelter in time" (everyone in the shelter before the impact) and "Zero extra X-rays" (in the storms nobody got more than 0.1 mSv above what the shelter gives).
- `Report`: translates the keys the simulation logs, shows each incident once and draws the real dose for each day (`dailyDoses`) over the timeline.
- Progression → scheduler: it already worked through `GameState.unlockLevel`.
- Removed: `core/session|resources|missions|decisions`, `HabitatScene`, `PrototypeHud`, `Player`, `StationView`, `services.ts`, `content/missions|startingConditions|habitat` and the prototype events in `GameEvents`. The live DONKI client (`src/data/donki/`, `EnvironmentService`) remains unwired: decide whether to remove it.

### 10.2 Final PR acceptance criteria

- [x] `npm test`, `npm run typecheck` and `npm run build` green, including `src/architecture.test.ts`.
- [x] Full game test in Node: 2024 campaign, short mode, fixed seed, from `prep` to `report` (`src/fullGame.test.ts`).
- [x] A meter at zero enters the cascade and does not end the game (`VoyageSession.test.ts`, "without air it enters emergency").
- [x] Archived data is never presented as live: the dashboard says "Real archived data from <date> · <source>" and each card shows the date of the data. (Replaces the `EnvironmentSnapshot.source` criterion, which only the lunar prototype used.)
- [x] No UI text written in the code; every key exists in `es` and `en`.
- [x] Cross review: each one reviews the other's part (confirmed by Santiago and Facundo; the `AGENTS.md` conventions were also reviewed across the whole codebase).

Manual tests postponed by team decision until after merging into `master` (covered in Node by `src/fullGame.test.ts`; left for the first play session):

- [ ] Manual test in `npm run dev`: the 7 phases in order, in ES and EN.
- [ ] Save in `Voyage`, reload the page and continue with the same state.
- [ ] The May 2024 storm slows the clock, tints yellow and opens its `DataCard`.

---

## 11. Pending decisions and checks

| Topic | Responsible | Before |
|---|---|---|
| ~~Dates of the Mars solar conjunctions (§10 of the design)~~ Done: 2015, 2017, 2019, 2021 and 2023 (JPL), in `datasets/curated/mars-conjunctions.json` | Santiago | S5 |
| ~~Real DONKI→RadLab lead time in May and October 2024~~ Done: May 69 h, October 1.9 h (see `datasets/README.md`) | Santiago | S1 |
| ~~Q factors per phase (Hassler 2014, Zeitlin 2013)~~ Done: 3.05 and 3.8, cited in `datasets/curated/radiation-dose.json` | Santiago | S2 |
| ~~REMS minimums below −90 °C~~ Done: they are isolated artifacts, replaced by the neighbouring median (see `datasets/README.md`) | Santiago | S8 |
| ~~Landing (Curiosity/Perseverance) and reentry (Orion/Artemis I) figures~~ Done: Perseverance and Orion with NASA sources in `src/content/maneuvers.ts` and game-design §4.3, §4.7 | Facundo | F5 |
| ~~Mass limits for the outbound and return cargo~~ Done: the three outbound profiles weigh 2700 kg; the return has 1660 kg and Gale samples weigh 4–14 kg, so with the recommended load 3 or 4 of 8 fit (`src/content/loadouts.test.ts`) | Facundo | F6 |
| Efficiency weights and cascade margins: tune with playtests with kids | Both | After integration |

---

## 12. Out of scope for this plan

Left for after the integration PR:

- Full long mode and free mode with random windows (left prepared, but locked).
- Unlock levels 3 and 4 with all their content (MOXIE, trajectory correction, remote diagnostics, micrometeorite, dust in the seals, special scenarios).
- **Audio** (alarms, particle monitor clicks, music): decided to leave it for after integration. Until then, the particle monitor and the alarms are visual only. (Audio was added later.)
- Visual polish.
- Fine balancing with playtests.

# Documentation

Working documents for **Hello Mars** (working title: *Misión a Marte*, "Mission to Mars"). The code does not depend on
anything here: this is the design, the records of how each asset was made, the closed plans and the reference images.
Folder names are in Spanish, like the codebase.

## `capturas/` — screenshots

Game screenshots used by the repo's `README.md` (rebuilt with `scripts/art/capture.mjs`).

## `diseno/` — what the game is

| Document | Content |
| --- | --- |
| [`game-design.md`](diseno/game-design.md) | Game design document: rules, meters, incidents, maneuvers, the 2024 campaign and the source of every number. |
| [`biblia-visual.md`](diseno/biblia-visual.md) | Visual bible: screens, palette, pixel art style and scene catalogue. |

## `produccion/` — how each asset was made

| Document | Content |
| --- | --- |
| [`pixel-art.md`](produccion/pixel-art.md) | Record of every pixel art piece: file, size, frames, scale, how to rebuild it and its origin. |
| [`sonidos-variedad.md`](produccion/sonidos-variedad.md) | Prompts and criteria for the sound effects generated with ElevenLabs. |

Other records live next to what they describe: every folder in `public/assets/` has its own `README.md`, the music is
explained in [`public/assets/audio/README.md`](../public/assets/audio/README.md) and the data in
[`datasets/README.md`](../datasets/README.md). Credits and licenses: [`CREDITS.md`](../CREDITS.md).

## `historial/` — closed plans

Kept as a record of how the game was built; every item in them is done or was dropped.

| Document | Content |
| --- | --- |
| [`plan-de-trabajo.md`](historial/plan-de-trabajo.md) | Work split between Santiago (simulation) and Facundo (flow and maneuvers), stages and integration. |
| [`plan-visual.md`](historial/plan-visual.md) | Plan for going from rectangles to the final art of the ship and Gale, with its decisions. |
| [`checklist-lanzamiento.md`](historial/checklist-lanzamiento.md) | Fixes made before release, with the team's decisions. |

## `referencias/` — reference images (not game assets)

| Folder | Content |
| --- | --- |
| [`topdown/`](referencias/topdown/README.md) | Concept art and UX sheets, and the floor plan of the Gale base (`plano-base-marte.png`, read by `scripts/maps/build-gale.mjs`). |
| [`prototipos-despegue/`](referencias/prototipos-despegue/README.md) | Mockups of the launch scenes. |
| [`gale/`](referencias/gale/README.md) | NASA Photojournal photos used to draw the outside of Gale. |
| [`tripulacion/`](referencias/tripulacion/) | Reference designs for Vega, Miga, Brote and Senda. |
| [`ref-nave.png`](referencias/ref-nave.png) | Style reference for the ship interior. |

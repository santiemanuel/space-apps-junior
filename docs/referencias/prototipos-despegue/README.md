# Prototypes — launch scenes

Mockups used to rework the `Maneuver` screen for both launches (`ascent` from Earth and `marsAscent` from Gale). They
are **concept art**, not game assets: no pieces are cut from here and no text or figures are copied (the panels
deliberately contain only shapes).

- Generated with codex-cli (`scripts/art/gen.sh`), prompts in `art/prompts/proto-despegue-*.txt`, raw output in
  `art/raw/`.
- Attached references: sheets 05 and 06 from [`topdown/`](../topdown/README.md) (side-scroller panels: "Mars –
  Exploration", "Exterior maintenance", "Gale Crater view") and a screenshot of each step of the game at the time
  (development screenshots were removed from the repo; they remain in the git history under `art/capturas/despegue/`).
- The mascots in the mockups are generic; in the game the crew is still Vega, Miga, Brote and Senda with their sprites.

## Scenes

| File | Moment | What to take |
|---|---|---|
| `01-amanecer.png` | Earth · dawn, Go/No-Go checklist | coastal complex, sea and low sun, red tower with access arm, steam, grandstand, crew walking to the tower, van |
| `02-abordaje.png` | Earth · boarding | close shot: elevator going up the tower, walkway to the open hatch, big arrows as buttons |
| `03-combustible.png` | Earth · fuelling | spherical tanks, frosted pipes, cascade of cryogenic vapor, flame trench, tank gauge with a green band |
| `04-cuenta.png` | Earth · countdown at sunset | retracted arm, red beacons, igniter sparks, crowd with little flags, countdown ring at the top |
| `05-ignicion.png` | Earth · liftoff | column of fire, smoke covering the whole ground, glow on the water, crew waving from the building, shaking |
| `06-separacion.png` | Earth · upper atmosphere | curved horizon, booster separation, steering needle with red/yellow/green bands, crew portraits |
| `07-marte-base.png` | Mars · morning at Gale, checklist | Mount Sharp, base domes and panels, rover, legged ascent vehicle on the pad, fuel hose, windsock |
| `08-marte-ignicion.png` | Mars · liftoff | ring of red dust with flying stones, base lit by the fire, crew at the lookout |
| `09-marte-orbita.png` | Mars · orbit insertion | curved Mars with a thin atmosphere, Phobos, the mothership waiting with its hatch open |

## What goes into the game

- **Detailed side view** (pixel art at scale 4, as before), with layered scenery: sky by time of day, far background
  (sea/coast or Mount Sharp), middle platform (tower, tanks, base) and foreground (railings, plants, rocks). Far
  backgrounds can stay code-drawn; tower, tanks, platform, spacecraft and base become generated images (pipeline in
  `AGENTS.md`).
- **Minigame panel** at the bottom right, larger and framed (riveted edges and lights as in the sheets), icons instead
  of text where possible and real text from `t()`.
- **Top bar** with the name, stage progress as dots and the fuel.

## Longer sequence (proposal)

Request: more playable stages, cinematic moments and a long countdown, so the launch builds anticipation.

**Earth (`ascent`)**

1. *Cinematic* — dawn: the camera pans across the complex from left to right and the crew walks to the tower (skip
   with Space).
2. Go/No-Go checklist.
3. Load the fuel (vapor grows as it fills).
4. Boarding (elevator going up and crew crossing the walkway).
5. **New:** close the hatch and pressurize the cabin (keep the pressure in the green band).
6. **New:** radio check with mission control (repeat the light sequence).
7. **Long countdown** from T-60, sped up to about 20 s, with narrated and visible milestones: T-45 the access arm
   retracts, T-30 beacons and crowd standing, T-15 sound suppression water, T-10 playable as before, T-6 engine start
   (sparks), T-0 ignition.
8. *Cinematic* — liftoff: smoke covering the ground, shaking, the crowd cheers, the camera follows the rocket.
9. Turn toward orbit, booster separation and stage separation (as before).

**Mars (`marsAscent`)**: same arc, shorter. Morning cinematic at Gale → checklist → fuel → boarding → pressurize →
countdown from T-30 → liftoff cinematic with a dust ring → orbit insertion with the mothership in view.

## What ended up in the game (middle ground)

The interface barely changed (top bar, checklist and minigame panel in the same place); what improved is the
illustration and the sequence:

- **Generated scenery** based on these mockups: coast and platform with grandstands, red tower with elevator and arm,
  frosted tanks, a bigger rocket with boosters; at Gale, Mount Sharp, a domed base, a service tower and the ascent
  vehicle. Sky in pixel art bands (dawn on Earth, dusty morning on Mars). Asset details in
  [`pixel-art.md`](../../produccion/pixel-art.md).
- **Intro scene** (skip with Space): close-up of the arrival (van on Earth, base door on Mars), then the camera opens
  up to the whole platform.
- **New stages:** pressurize the cabin (Earth and Mars) and radio check with waves from the control building (Earth).
  The Mars stage formerly called "Seal the hatch" is now boarding.
- **Long countdown:** T-60 on Earth and T-30 on Mars, with the preparations visible and announced: retracting arm,
  beacons and cheering crowd, water under the platform, sparks and engines starting (on Mars, the service tower
  tilting away and the dust).
- **Longer liftoff:** smoke covering the whole ground, shaking, flames in the boosters, the rocket starts slowly and
  shrinks as it moves away; on Mars the mothership appears at orbit insertion.

Screenshots of the result were in `art/capturas/despegue-v2/` (before: `art/capturas/despegue/`); they remain in the
git history.

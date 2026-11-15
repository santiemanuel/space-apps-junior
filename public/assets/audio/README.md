# Sound

Game sound effects and ambiences as MP3 (`sfx/`), generated with ElevenLabs Sound Effects from the project's sound
bible ("warm exploration instruments": ceramic, warm glass and filtered air; no chiptune). The soundtrack is in
`music/` (see below).

- Which file each effect uses: `SFX` and `LOOPS` in `src/game/audio/themes.ts` (a test checks they exist).
- Second batch ("missing" sounds, English names in kebab-case): launch (fuel, pressurize, radio tones, engines at
  T-6, roar, service arm, pad water, crowd, docking, touchdown, plasma), base (airlock, micrometeorite, power cut, air
  leak, storm, drill and shovel, crew switch) and minigames (bike, kitchen, watering).
- Played by `src/game/audio/audio.ts` (Web Audio): downloaded and decoded on the first click or key press.
- `alarma-tormenta.mp3` (5 s, provided by the team, not generated with ElevenLabs): the solar storm alarm, looping
  from the warning until the storm ends (`LOOPS.stormAlarm`, started by `HudScene`); while it plays, storm messages do
  not repeat `alarma`/`sirena`.
- Loops per channel (`audio.loop(channel, id)`), with a fade; several channels play at once. Ambiences (20 s):
  `ambiente-cabina` (ship and base), `sala-equipos` (rooms with machines), `casco-marte` (outside on Mars).
- Third batch ("variety", [`docs/produccion/sonidos-variedad.md`](../../../docs/produccion/sonidos-variedad.md)): a
  sound of its own for each room minigame (wired by `src/game/scenes/simulation/minigames/sounds.ts`, which reads each
  game's state), each maneuver, each incident and each screen (cargo hold, planning, panels, title, report).

## Music (`music/`)

Soundtrack provided by the team (12 tracks, one for each moment of the mission, generated with Lyria). The originals
are not in the repo; they are mastered with `node scripts/audio/master-music.mjs <folder>`: even loudness at
−16.5 LUFS (linear gain), 22 Hz high-pass, −2 dBFS limiter, silence trimming, MP3 160 kbps 48 kHz without cover art.
The script measures the ending of each track and writes its loop point to `src/game/audio/musicTracks.json`.

| Track | Moment (`MUSIC` in `themes.ts`) | Mix |
| --- | --- | --- |
| `main-menu` | Title | 0 dB, 2.5 s fade-in |
| `loadout` / `mars-loadout` | Outbound / return cargo hold | −4 dB |
| `maneuver-ascent-earth` | Launch from Earth (`ascent`) | −3 dB |
| `maneuver-landing-mars` | Landing on Mars (`landing`) | −3 dB |
| `maneuver-ascent-mars` | Launch from Mars (`marsAscent`) | −3 dB |
| `maneuver-landing-earth` | Reentry to Earth (`reentry`) | −3 dB |
| `voyage-mars` / `voyage-earth` | Outbound / return trip | −6 / −5 dB, 4 s fade-in |
| `mars-base` | Gale base | −6 dB, 4 s fade-in |
| `mission-complete` / `mission-suspended` | Final report | 0 / −1 dB, enter after the mission stinger |

In the game: track changes use an equal-power crossfade (the outgoing track takes 1.8 s), each track loops by
crossfading into its own beginning, the music ducks under stingers, alarms and achievements (`MUSIC_DUCK`), and it is
low-pass filtered while the pause menu or a card is open. A limiter on the output keeps the mix from clipping.

# datasets/raw — Raw NASA downloads

Starting material for **later processing**, which decides which variables the game uses and how to show them to kids
around 10 without losing the link to the real data. The game does not read anything in this folder directly: when a
variable is adopted, it is processed into `datasets/curated/` or `datasets/donki/` (or the other processed folders) and
documented in `datasets/README.md`.

```bash
npm run datasets:download                 # everything
npm run datasets:download -- donki radlab # only some sources
```

`manifest.json` records every file: exact URL and query, download date, number of records, size, SHA-256 and whether it
is versioned. Files over 5 MB are not pushed to git (listed in `.gitignore`); they are regenerated with the command
above.

## Sources and candidate variables

| Folder | Source | What it contains | Candidate variables for the game |
|---|---|---|---|
| `donki/` | NASA CCMC DONKI, 2024 → today | Original API responses for FLR, SEP, CME, GST, IPS, HSS, MPC, RBE and `notifications` | Flares (GOES class → R1–R5 radio blackout), particle storms (SEP) as radiation crises, CMEs as an **early warning** (speed, estimated arrival time), Kp of geomagnetic storms, **real alert texts** written by NASA analysts |
| `radlab/daily/` | NASA OSDR RadLab | Daily statistics (n, min, mean, max) of absorbed dose in μGy/h, per instrument | **Real** background dose by place: lunar orbit (LRO/CRaTER), Mars surface (Curiosity/RAD), deep space (BioSentinel), Mars cruise and orbit (TGO/Liulin-MO), ISS (DosTel). Useful to compare places and scale shielding |
| `radlab/events/` | NASA OSDR RadLab | **Full-resolution** series of two real storms (May 2024) | Chart of the **real radiation peak** during a storm: a crisis that can be relived in the game |
| `mars-weather/` | NASA Mars Exploration Program | Daily weather from Curiosity/REMS (~4700 sols) and Perseverance/MEDA | Min/max temperature, pressure, UV index, opacity, sunrise and sunset: the "weather report" of a Mars base |
| `osdr/` | NASA OSDR | Full metadata of up to 25 studies per topic (radiation, bone, muscle, plants, food, sleep, immune system, isolation) | "Did you know…?" facts and health consequences based on real studies, with a link to each study |
| `references/` | NASA BVAD and NASA-STD-3001 (OCHMO) | PDFs, plus the full BVAD text | Design values per crew member: O2 consumed, CO2 produced and its limit (≤ 3 mmHg), water (2.5 L/day, 240 mL per EVA hour), food (3035 kcal/day), radiation limits (600 mSv career, 250 mSv per SPE) |

## Processing notes

- **Units**: RadLab gives absorbed dose in **μGy/h** (gray). The curated references use dose equivalent in
  **mSv/day** (sievert). They are not interchangeable without a quality factor: any conversion must be documented.
- **RadLab**: the full series weigh hundreds of MB (TGO ~270 MB, BioSentinel ~100 MB), so they are stored aggregated by
  day. The ISS series is requested year by year because the full query returns 504. The API sends no CORS headers: it
  must be downloaded with Node, not from the browser.
- **DONKI**: each event has a `link` to its public page, useful for linking from the game to the source. The
  `notifications` texts are in English and use technical jargon: if shown, they should come with a simple explanation.
- **Mars weather**: values come as text (`"-71"`, `"--"` when there is no data).
- **OSDR**: the search returns very technical studies (genomics, cell cultures). The ones with a message kids can
  understand must be picked by hand.

## First review of the download (11/14/2026)

| Daily series | Range | Daily median | Notes |
|---|---|---|---|
| Mars surface (Curiosity/RAD) | 2015 → Jun 2024 | 8.3 μGy/h (≈ 0.2 mGy/day, matches Hassler et al. 2014) | SEP event of 05/20/2024: 304 μGy/h peak, about 64 times the usual value |
| Lunar orbit (`celestial_body=Moon`) | 2009 → Jun 2024 | 11.1 μGy/h | Includes CRaTER **and the Artemis I instruments** (EAD, HERA). The extreme maximum is Artemis I crossing the Van Allen belts: split by `instrument_id` |
| ISS (DosTel1/2) | 2009 → Nov 2024 | 24.8 μGy/h | The daily mean includes passes through the South Atlantic Anomaly |
| Deep space (BioSentinel) | Nov 2022 → Nov 2025 | 6.8 μGy/h | Some very high daily maxima need checking before use |
| Mars cruise and orbit (TGO) | 2016 → 2023 | 15.7 μGy/h | `instrument_id` tells cruise (`-Cruise`) from orbit (`-Orbit`) |

May 2024 storm at full resolution: ISS, 527 μGy/h peak (median 4.5); deep space, 653 μGy/h; lunar orbit (hourly
resolution), 3152 μGy/h.

DONKI 2024 → Nov 2026: 1941 flares (85 X-class; the largest, X9.0 on 10/03/2024), 214 SEP events, 62 geomagnetic storms
(max Kp 9) and 2572 notifications (alerts and weekly reports).

# Main menu assets

Pixel art for the animated sky in `Title`: Earth and Mars maps for the spinning planets, clouds, ISS, OPSIS CubeSat,
meteor and trail, asteroid, mission spacecraft and stars.

- Rebuilt with `python scripts/art/title-sky.py` (sources in `art/raw/title/`).
- Full record (sizes, frames, scale, origin and licenses): [`docs/produccion/pixel-art.md`](../../../../docs/produccion/pixel-art.md).
- `code-hello.png` and `github.png` (bottom-right links of the menu): `python scripts/art/brand-icons.py`. The code-hello logo is pixel art generated with Codex from the official logo (`art/snapped/brand-code-hello.png`); the GitHub mark is the official one, unmodified (`art/raw/brand/github-mark.svg`).
- Loaded by `Boot` with the `TitleTextures` keys (`src/game/assets.ts`).

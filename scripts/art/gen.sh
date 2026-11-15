#!/usr/bin/env bash
# Genera una imagen con codex (imagegen) a partir de art/prompts/<nombre>.txt y la deja en art/raw/<nombre>.png.
# Uso: scripts/art/gen.sh <nombre> [imagen de referencia...]   (por defecto, docs/ref-nave.png)
set -euo pipefail
name="$1"; shift
refs=("$@"); [ ${#refs[@]} -eq 0 ] && refs=(docs/ref-nave.png)
args=(); for r in "${refs[@]}"; do args+=(-i "$r"); done
{
  echo "Use the built-in image generation tool (image_gen) to create ONE image. Do not write code to draw it and do not use any CLI/API fallback."
  echo
  cat "art/prompts/$name.txt"
  echo
  echo "After generating, copy the resulting PNG unchanged (do not re-encode or resize) from the generated images folder into art/raw/ of this workspace with the file name $name.png (overwrite if it exists). Print the source path."
} | codex exec --enable image_generation -s workspace-write --skip-git-repo-check "${args[@]}" - > "art/raw/$name.log" 2>&1
ls -la "art/raw/$name.png"

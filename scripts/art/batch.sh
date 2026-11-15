#!/usr/bin/env bash
# Lanza varias generaciones en paralelo: cada argumento es "nombre[:referencia extra]". Hasta 4 a la vez.
running=0
for job in "$@"; do
  name="${job%%:*}"; ref="${job#*:}"
  if [ "$ref" != "$job" ]; then scripts/art/gen.sh "$name" docs/referencias/ref-nave.png "$ref" & else scripts/art/gen.sh "$name" & fi
  running=$((running + 1))
  if [ $running -ge 4 ]; then wait -n; running=$((running - 1)); fi
done
wait

# Generador de normal maps de Sprite Fusion ("Sprite Normals", MIT): el mismo que usa la herramienta gratuita
# `create_normal_map` de su MCP. Se compila en un contenedor para no instalar Rust; corre sin red.
# Construir: docker build -t sprite-normals:local scripts/art/normals
FROM rust:1.85-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
# Commit fijo (20/10/2026) para que el resultado sea siempre el mismo.
ARG COMMIT=d14b06726cabab09c68a403ce2e684a52efbfe4c
RUN git clone https://github.com/Hugo-Dz/spritefusion-sprite-normals /src \
  && cd /src && git checkout "$COMMIT" && cargo build --release --locked

FROM debian:bookworm-slim
COPY --from=build /src/target/release/spritefusion-sprite-normals /usr/local/bin/
WORKDIR /work
ENTRYPOINT ["spritefusion-sprite-normals"]

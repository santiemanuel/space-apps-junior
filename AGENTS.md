# AGENTS.md

## Stack
Phaser 4.2 · TypeScript 7 (strict) · Vite 8 · Vitest 5. Versiones fijadas exactas en package.json.

## Verificación
- `npm test` — tests unitarios (Vitest, entorno node)
- `npm run typecheck` — tsc
- `npm run build` — typecheck + build de producción
- `npm run dev` — servidor en http://localhost:5173 (`?scene=Voyage`, `?scene=Maneuver&id=landing`… abre una escena sola con `makeGameState()`; `Voyage` y `Mars` aceptan `&from=AAAA-MM-DD&help=1&level=N&length=long`, más `&leg=back` y `&km=N&where=<zona>`)
- Vista del mapa (docs/plan-visual.md): `?scene=Voyage&where=<zona>&zoom=2` (zoom por defecto 1,5), efectos forzados `&fx=alert|impact,powerOut&broken=scrubber,waterRecycler:yellow&battery=0`, `?scene=Mars&layout=large`; captura sin ventana con `[FRAMES=n INTERVAL=ms] node scripts/art/capture.mjs "<url>" <salida.png> [espera ms] [teclas "d:1500,Tab:60"]`
- Imágenes generadas: prompt en `art/prompts/<nombre>.txt` → `scripts/art/gen.sh <nombre> [referencias]` (o `batch.sh`) → `python scripts/art/pre.py art/raw/<nombre>.png` → `snap_pixels` del MCP pixel-snapper → copiar a `art/snapped/` → `tiles.py` (tileset, la lista de hojas está en `art/tiles-ship.args`), `atlas.py <grupo de art/manifest.json>` (objetos). Tripulantes: `regrid.py art/raw/crew-<id>-<dir>.png --height N` → `snap_pixels` con `pixel_size: 8` → `crew.py <id>`
- `python scripts/art/normals.py [recurso...]` — normal maps (`<recurso>_n.png`) de tilesets, atlas y tripulantes; requiere `docker build -t sprite-normals:local scripts/art/normals` una vez. Rehacerlos cada vez que cambia un recurso
- `node scripts/maps/build-ship.mjs` — regenera `src/content/maps/ship.json` (pisa lo editado a mano en Tiled)
- `npm run datasets:fetch` — regenera `datasets/donki/` (lo que usa el juego; requiere red)
- `npm run datasets:download [-- fuente...]` — descargas crudas a `datasets/raw/` + `manifest.json` (RadLab tarda varios minutos)
- `node scripts/build-storms.mjs` — regenera `datasets/storms/biosentinel-storms.json` desde `datasets/raw/` (sin red)
- `node scripts/build-events.mjs` — regenera `datasets/storms/radiation-peaks.json`, `series/van-allen-artemis.json` y `notices/donki-notices.json` desde `datasets/raw/`
- `node scripts/build-series.mjs` — regenera `datasets/series/` (dosis diaria y clima de Gale) desde `datasets/raw/`

## Convenciones
- La lógica de juego vive en `src/core/` y no puede importar `phaser` ni `src/game/`. `Voyage` y `Mars` comparten el motor `core/habitat/HabitatSession` (y la escena base `SimulationMapScene`).
- Sólo `src/data/` importa `datasets/` (ambas reglas en `src/architecture.test.ts`).
- Cada dataset nuevo se documenta en `datasets/README.md` (fuente, URL, uso en el juego). Los valores curados llevan su cita dentro del JSON.
- Nunca presentar datos archivados como "en vivo": `EnvironmentSnapshot.source` debe reflejarlo.
- Los tests van junto al código (`*.test.ts`); las factories compartidas están en `src/test-utils/`.
- La capa Phaser (`src/game/`) sólo pinta y lee la entrada; las reglas viven en `src/core/` (`MissionFlow`, `VoyageSession`/`MarsSession`, `ManeuverRun`…). `FlowDirector` conecta las fases por el bus.
- Todo el azar pasa por `Rng` (con semilla), nunca por `Math.random`.
- Idioma de UI, comentarios y tests: español. Público objetivo: niños de 7–12 años (lenguaje sencillo en la UI).
- Trabajo en paralelo (Santiago: simulación · Facundo: flujo y maniobras): ver `docs/plan-de-trabajo.md` §8 para los dueños de cada carpeta. Archivos congelados fuera de la Etapa 0 y la integración: `main.ts`, `display.ts`, `GameEvents.ts`, `sceneKeys.ts`, `config.ts`, `scenes/registry.ts`, `scenes/sceneData.ts`, `dev/devLaunch.ts`, `i18n/index.ts`, `package.json` y los `types.ts` de contratos.
- Superpuestas de la simulación (`Hud`, `Planning`, `MissionControl`, `DataPanel`): reciben `SimulationSceneData` (`PhaseSceneData` + `sim`, el bus `SimulationEvents` de `core/habitat/events.ts`) y se abren desde `Voyage`/`Mars` con P, C y G; no se abren solas con `?scene=`.
- Los mapas de `Voyage` (y luego `Mars`) son JSON de Tiled en `src/content/maps/`: capas `piso`, `paredes`, `zonas`, `objetos`, `decorado`. `src/content/tiledLayout.ts` saca de ahí el plano de las reglas; `TiledMapView.ts` lo pinta.
- Escenas nuevas: en `src/game/scenes/flow/` o `simulation/` y registradas en `flowScenes.ts` o `simulationScenes.ts`; reciben `PhaseSceneData` (`state` + `bus`) y se hablan sólo por el bus.
- Textos de UI con `t('<archivo>.<clave>')` de `src/i18n/`; cada clave en `es/` y `en/` (lo verifica un test). `src/core/` no traduce: guarda claves.
- El estado completo de partida es `GameState` (JSON puro). A mitad de `Voyage`/`Mars` lleva además `habitat` (planificador y cascada) y se publica con `phase:progress` para el guardado manual.
- `src/fullGame.test.ts` juega la campaña 2024 completa en Node: si cambia una regla que rompe el arco de la misión, falla ahí.
- Pantalla 1280×720 y tile de 48 px (`src/game/display.ts`). Recursos del juego en `public/assets/<dominio>/`; `docs/` sólo referencias. Imágenes generadas: pixel art como `docs/ref-nave.png`, PNG transparente, múltiplos de 48 px.
- Tripulación: Vega (comandante, jugador al inicio), Miga (ingeniera), Brote (botánico), Senda (geóloga-médica); diseño de referencia en `docs/*-sprites.png`; hojas del juego en `public/assets/crew/` (pixel art, 9×4 cuadros de 72×88, pies en y=86).
- Phaser incluye guías para agentes en `node_modules/phaser/skills/` (p. ej. `v3-to-v4-migration`).

## Gotchas
- DONKI: usar `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR` **sin barra final**; `api.nasa.gov/DONKI/...` responde 404. Máximo 60 días por consulta; los errores llegan como texto `API Error: ...` (a veces con HTTP 200/400).
- RadLab data API: usar `https://visualization.osdr.nasa.gov/radlab/api/` con barra final y query parameters; `/api/environments` devuelve error (ruta no existente). Confirmado HTTP 200 con query ISS/DosTel el 14/11/2026. Verificar CORS antes de llamarlo desde navegador; se recomienda archivar con Node.
- Los avisos de APOD, Earth imagery/GIBS y Mars Rover no aplican salvo que se integre uno de esos servicios; el juego actual no los usa.
- En Windows, curl a algunos dominios NASA necesita `--ssl-no-revoke` o `-k`.
- Vite 8 usa Rolldown: `build.rollupOptions.output.manualChunks` sólo acepta la forma de función.
- Imágenes con codex: generar hojas de 2 × 2 objetos o tiles (un objeto solo sale 2–3 veces más grande de lo que sirve); el alfa llega en 250–254, hay que binarizarlo. El pixel-snapper sólo ve `C:\code-hello\mcp-snapper\assets`; con tiles lisos su detección automática falla: un tile por vez con `pixel_size` fijo.
- No pasar hojas de animación generadas directo al pixel-snapper: su grilla adaptativa cambia el ancho de cada cuadro y el personaje "respira". Usar `scripts/art/regrid.py` antes.
- Los tripulantes automáticos no se mueven con la física (Arcade va a pasos fijos de 1/60 s y vibraban en pantallas de 144 Hz): `moveAutoCrew` los ubica y `body.moves` es `false` salvo para el del jugador.
- Cámara de `Voyage`/`Mars`: no usar `startFollow` (con zoom 1,5 deja la cámara entre píxeles y todo se desfasa); la mueve `followCamera` en un píxel entero de pantalla. Lo que sigue a un sprite se ubica en `afterPhysics` (POST_UPDATE), no en `update`.
- `TilemapGPULayer` (Phaser 4.2.1) tiñe los tiles vacíos: usarla sólo en capas que llenan todo el mapa (el piso).
- `chrome --headless --screenshot` saca capturas negras con WebGL muy seguido: usar `scripts/art/capture.mjs`.
- Los heredocs muy largos en exec pueden truncarse: para archivos grandes usar la herramienta de escritura.
- En exec, las comillas invertidas dentro de `node -e "..."` las interpreta bash: para código con template strings usar la herramienta de edición o de escritura.

## Preferencias del usuario
- No hacer commits automáticos: dejar los cambios sin commitear salvo que el usuario lo pida explícitamente.

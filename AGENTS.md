# AGENTS.md

## Stack
Phaser 4.2 · TypeScript 7 (strict) · Vite 8 · Vitest 5. Versiones fijadas exactas en package.json.

## Verificación
- `npm test` — tests unitarios (Vitest, entorno node)
- `npm run typecheck` — tsc
- `npm run build` — typecheck + build de producción
- `npm run dev` — servidor en http://localhost:5173 (`?scene=Voyage`, `?scene=Maneuver&id=landing`… abre una escena sola con `makeGameState()`)
- `npm run datasets:fetch` — regenera `datasets/donki/` (lo que usa el juego; requiere red)
- `npm run datasets:download [-- fuente...]` — descargas crudas a `datasets/raw/` + `manifest.json` (RadLab tarda varios minutos)
- `node scripts/build-storms.mjs` — regenera `datasets/storms/biosentinel-storms.json` desde `datasets/raw/` (sin red)
- `node scripts/build-series.mjs` — regenera `datasets/series/` (dosis diaria y clima de Gale) desde `datasets/raw/`

## Convenciones
- La lógica de juego vive en `src/core/` y no puede importar `phaser` ni `src/game/`.
- Sólo `src/data/` importa `datasets/` (ambas reglas en `src/architecture.test.ts`).
- Cada dataset nuevo se documenta en `datasets/README.md` (fuente, URL, uso en el juego). Los valores curados llevan su cita dentro del JSON.
- Nunca presentar datos archivados como "en vivo": `EnvironmentSnapshot.source` debe reflejarlo.
- Los tests van junto al código (`*.test.ts`); las factories compartidas están en `src/test-utils/`.
- La capa Phaser (`src/game/`) sólo pinta y lee la entrada; las reglas se delegan en `GameSession`.
- Todo el azar pasa por `Rng` (con semilla), nunca por `Math.random`.
- Idioma de UI, comentarios y tests: español. Público objetivo: niños de 7–12 años (lenguaje sencillo en la UI).
- Trabajo en paralelo (Santiago: simulación · Facundo: flujo y maniobras): ver `docs/plan-de-trabajo.md` §8 para los dueños de cada carpeta. Archivos congelados fuera de la Etapa 0 y la integración: `main.ts`, `display.ts`, `GameEvents.ts`, `sceneKeys.ts`, `config.ts`, `scenes/registry.ts`, `scenes/sceneData.ts`, `dev/devLaunch.ts`, `i18n/index.ts`, `package.json` y los `types.ts` de contratos.
- Escenas nuevas: en `src/game/scenes/flow/` o `simulation/` y registradas en `flowScenes.ts` o `simulationScenes.ts`; reciben `PhaseSceneData` (`state` + `bus`) y se hablan sólo por el bus.
- Textos de UI con `t('<archivo>.<clave>')` de `src/i18n/`; cada clave en `es/` y `en/` (lo verifica un test). `src/core/` no traduce: guarda claves.
- El estado completo de partida es `GameState` (JSON puro); `MissionState` es el de una tarea del prototipo.
- Pantalla 1280×720 y tile de 48 px (`src/game/display.ts`). Recursos del juego en `public/assets/<dominio>/`; `docs/` sólo referencias. Imágenes generadas: pixel art como `docs/ref-nave.png`, PNG transparente, múltiplos de 48 px.
- Tripulación: Vega (comandante, jugador al inicio), Miga (ingeniera), Brote (botánico), Senda (geóloga-médica); sprites en `docs/*-sprites.png` (9×4 cuadros de 176×216, pies en y=208).
- Phaser incluye guías para agentes en `node_modules/phaser/skills/` (p. ej. `v3-to-v4-migration`).

## Gotchas
- DONKI: usar `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR` **sin barra final**; `api.nasa.gov/DONKI/...` responde 404. Máximo 60 días por consulta; los errores llegan como texto `API Error: ...` (a veces con HTTP 200/400).
- RadLab data API: usar `https://visualization.osdr.nasa.gov/radlab/api/` con barra final y query parameters; `/api/environments` devuelve error (ruta no existente). Confirmado HTTP 200 con query ISS/DosTel el 14/11/2026. Verificar CORS antes de llamarlo desde navegador; se recomienda archivar con Node.
- Los avisos de APOD, Earth imagery/GIBS y Mars Rover no aplican salvo que se integre uno de esos servicios; el juego actual no los usa.
- En Windows, curl a algunos dominios NASA necesita `--ssl-no-revoke` o `-k`.
- Vite 8 usa Rolldown: `build.rollupOptions.output.manualChunks` sólo acepta la forma de función.
- Los heredocs muy largos en exec pueden truncarse: para archivos grandes usar la herramienta de escritura.

## Preferencias del usuario
- No hacer commits automáticos: dejar los cambios sin commitear salvo que el usuario lo pida explícitamente.

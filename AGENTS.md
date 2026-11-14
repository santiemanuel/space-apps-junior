# AGENTS.md

## Stack
Phaser 4.2 · TypeScript 7 (strict) · Vite 8 · Vitest 5. Versiones fijadas exactas en package.json.

## Verificación
- `npm test` — tests unitarios (Vitest, entorno node)
- `npm run typecheck` — tsc
- `npm run build` — typecheck + build de producción
- `npm run dev` — servidor en http://localhost:5173
- `npm run datasets:fetch` — regenera `datasets/donki/` (lo que usa el juego; requiere red)
- `npm run datasets:download [-- fuente...]` — descargas crudas a `datasets/raw/` + `manifest.json` (RadLab tarda varios minutos)

## Convenciones
- La lógica de juego vive en `src/core/` y no puede importar `phaser` ni `src/game/`.
- Sólo `src/data/` importa `datasets/` (ambas reglas en `src/architecture.test.ts`).
- Cada dataset nuevo se documenta en `datasets/README.md` (fuente, URL, uso en el juego). Los valores curados llevan su cita dentro del JSON.
- Nunca presentar datos archivados como "en vivo": `EnvironmentSnapshot.source` debe reflejarlo.
- Los tests van junto al código (`*.test.ts`); las factories compartidas están en `src/test-utils/`.
- La capa Phaser (`src/game/`) sólo pinta y lee la entrada; las reglas se delegan en `GameSession`.
- Todo el azar pasa por `Rng` (con semilla), nunca por `Math.random`.
- Idioma de UI, comentarios y tests: español. Público objetivo: niños de 7–12 años (lenguaje sencillo en la UI).
- Phaser incluye guías para agentes en `node_modules/phaser/skills/` (p. ej. `v3-to-v4-migration`).

## Gotchas
- DONKI: usar `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR` **sin barra final**; `api.nasa.gov/DONKI/...` responde 404. Máximo 60 días por consulta; los errores llegan como texto `API Error: ...` (a veces con HTTP 200/400).
- RadLab data API: usar `https://visualization.osdr.nasa.gov/radlab/api/` con barra final y query parameters; `/api/environments` devuelve error (ruta no existente). Confirmado HTTP 200 con query ISS/DosTel el 14/11/2026. Verificar CORS antes de llamarlo desde navegador; se recomienda archivar con Node.
- Los avisos de APOD, Earth imagery/GIBS y Mars Rover no aplican salvo que se integre uno de esos servicios; el juego actual no los usa.
- En Windows, curl a algunos dominios NASA necesita `--ssl-no-revoke` o `-k`.
- Vite 8 usa Rolldown: `build.rollupOptions.output.manualChunks` sólo acepta la forma de función.
- Los heredocs muy largos en exec pueden truncarse: para archivos grandes usar la herramienta de escritura.

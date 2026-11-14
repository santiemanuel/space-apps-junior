# AGENTS.md

## Stack
Phaser 4.2 · TypeScript 7 (strict) · Vite 8 · Vitest 5. Versiones fijadas exactas en package.json.

## Verificación
- `npm test` — tests unitarios (Vitest, entorno node)
- `npm run typecheck` — tsc
- `npm run build` — typecheck + build de producción
- `npm run dev` — servidor en http://localhost:5173

## Convenciones
- La lógica de juego vive en `src/core/` y no puede importar `phaser` ni `src/game/` (lo comprueba `src/architecture.test.ts`).
- Los tests van junto al código (`*.test.ts`); las factories compartidas están en `src/test-utils/`.
- La capa Phaser (`src/game/`) sólo pinta y lee la entrada; las reglas se delegan en `GameSession`.
- Todo el azar pasa por `Rng` (con semilla), nunca por `Math.random`.
- Idioma de UI, comentarios y tests: español.
- Phaser incluye guías para agentes en `node_modules/phaser/skills/` (p. ej. `v3-to-v4-migration`).
- Vite 8 usa Rolldown: `build.rollupOptions.output.manualChunks` sólo acepta la forma de función.
- DONKI vía `api.nasa.gov/DONKI/FLR` puede devolver 404; el juego cae a fixtures automáticamente.

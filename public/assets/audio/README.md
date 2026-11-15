# Sonidos

Efectos y ambientes del juego en MP3 (`sfx/`), generados con ElevenLabs Sound Effects a partir de la biblia de
sonido del proyecto («instrumentos de exploración cálidos»: cerámica, vidrio cálido y aire filtrado; sin chiptune).
La música sigue siendo chiptune generada por código (`src/game/audio/themes.ts`).

- Qué archivo usa cada efecto: `SFX` y `LOOPS` en `src/game/audio/themes.ts` (un test verifica que existan).
- Segunda tanda («faltantes», nombres en inglés pasados a kebab-case): despegue (combustible, presurizar, tonos de
  radio, motores en T-6, rugido, brazo de servicio, agua de la plataforma, público, acople, toque de suelo, plasma),
  base (esclusa, micrometeorito, apagón, fuga de aire, tormenta, taladro y pala, cambio de tripulante) y minijuegos
  (bici, cocina, riego).
- Los reproduce `src/game/audio/audio.ts` (Web Audio): se bajan y decodifican al primer clic o tecla.
- `alarma-tormenta.mp3` (5 s, provisto por el equipo, no generado con ElevenLabs): alarma de la tormenta solar, en
  loop desde el aviso hasta que termina (`LOOPS.stormAlarm`, la pone `HudScene`); mientras suena, los avisos de la
  tormenta no repiten `alarma`/`sirena`.
- Loops por canal (`audio.loop(canal, id)`), con fundido; varios canales suenan a la vez. Ambientes (20 s): `ambiente-cabina` (nave y base), `sala-equipos` (salas con máquinas),
  `casco-marte` (afuera en Marte).
- Tercera tanda («variedad», [`docs/sonidos-variedad.md`](../../../docs/sonidos-variedad.md)): un sonido propio por
  minijuego de las salas (los conecta `src/game/scenes/simulation/minigames/sounds.ts`, que lee el estado de cada
  juego), por maniobra, por incidente y por pantalla (bodega, planificación, paneles, título, informe).

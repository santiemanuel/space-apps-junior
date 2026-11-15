Original prompt: Al minijuego de memoria de flechas en el despegue, sacale el minitutorial de las teclas porque ya se mostró en un minijuego anterior y acá solo distrae.

- Se omite la ayuda animada de teclas en la prueba de memoria de radio; las luces de la secuencia siguen visibles.
- Verificado: `npm run typecheck` pasó. Captura revisada en el servidor existente de http://localhost:5173: abordaje conserva la ayuda y radio la omite, con las cuatro luces visibles.
- El cliente Playwright de la guía no está instalado; se usó el capturador Chrome/CDP del proyecto. Sin pendientes.

- Pedido siguiente: disponer las flechas de memoria como el teclado (← ↓ →, con ↑ sobre ↓), tanto en la secuencia de colores como en la respuesta.
- Se comparte esa disposición en ambas fases; progreso y consigna pasan al costado para dejar espacio a las dos filas.
- Verificado: `npm run typecheck` pasó. Capturas revisadas al mostrar colores y al responder: ← ↓ → en una fila y ↑ sobre ↓. Secuencia completada con eventos reales de teclado, 4/4 aciertos y precisión 1. Sin pendientes.

- Pedido siguiente: sonido al pasar el mouse por opciones del menú principal y transiciones de highlight en pausa como en el principal.
- Menú principal: reutiliza `hover`. Pausa: barra y acento que se deslizan en 140 ms con `Cubic.Out`, filas completas para mouse y foco con teclado, alternativa sin movimiento según la preferencia del sistema.
- Verificado: `npm run typecheck` pasó. Chrome/CDP en el servidor existente: cinco hovers del principal disparan cinco sonidos con audio habilitado; pausa desliza la barra, permite guardar y navegar con mouse/teclado, bloquea el foco detrás de Ajustes y vuelve correctamente. Movimiento reducido cambia el foco sin tweens. Capturas revisadas, sin errores de consola. Sin pendientes.

- Pedido siguiente: aplicar el mismo comportamiento en Opciones. Barra y acento con deslizamiento de 140 ms, «Volver» dentro del mismo highlight y fila completa; se evita el doble sonido de hover al entrar a las flechas.
- Verificado: `npm run typecheck` pasó. Chrome/CDP desde principal y pausa: un solo hover al entrar a una flecha, volumen e idioma cambian, foco llega a «Volver», Esc y clic en la fila cierran y permiten reabrir; movimiento reducido sin tweens. Capturas revisadas de ambos accesos. Sin pendientes.

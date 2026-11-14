# Transcripción: Supervivencia extrema en un simulador marciano

Duración del archivo: 9 min 34 s. Transcripción automática con Whisper, con correcciones ortográficas mínimas. No se asignan nombres ni voces porque no se verificó la diarización. El nombre técnico poco claro al final se marca entre corchetes. Las afirmaciones científicas se transcriben, no se validan.

## 00:00

Imagina estar a millones de kilómetros de la Tierra y tener que ordenarle a tu tripulación beberse el escudo de agua anti-radiación de la nave para no morir de sed. Este es el resumen de las decisiones imposibles que veremos hoy en este documento de diseño para un simulador de supervivencia en Marte. Y bueno, te digo que este material tiene una premisa súper, súper sólida al basarse en la regla de que ninguna decisión es gratis, pero hay áreas clave en el flujo de consecuencias que debemos afinar para no romper la inmersión, así que pasemos directo a la primera revisión. La penalización abrupta de finalizar la misión cuando un solo medidor llega a cero

## 00:30

interrumpe la oportunidad de aprendizaje sobre la resiliencia y la gestión de crisis. Y a ver, si analizamos la regla actual del diseño, nos topamos con una debilidad importante. El documento dicta que si, no sé, la energía, el aire o la salud llegan a cero, el control de misión en la Tierra ordena un final temprano y seguro. Y te sacan del juego. Es un game over disfrazado. Exacto. El autor aclara que esto no busca ser un castigo cruel, pero en un juego de gestión de recursos, un final sin oportunidad de recuperación se

## 01:00

siente como chocar contra un muro de ladrillos. Corta en seco el flujo entre la decisión y la consecuencia real. Totalmente. Frustra al jugador porque no lo dejas reaccionar. Sí, porque igual que en misiones reales tipo el Apolo 13, la verdadera jugabilidad debería estar en tener la oportunidad de sacrificar un sistema para salvar otro en el último maldito segundo. ¿Sabes? Claro, es como si al pisar un bache muy fuerte en la ruta, el auto apaga el motor automáticamente por seguridad en lugar de dejarte conducir

## 01:30

lentamente y sufriendo hasta el mecánico. Tal cual. Pero entonces, ¿cómo mantenemos el rigor de los datos de la NASA que use el autor sin que el equilibrio castiga el jugador al primer error grave? Digo, no queremos que sea fácil tampoco. No, para nada. La sugerencia de mejora aquí es reemplazar ese final abrupto por un estado de falla en cascada o digamos una supervivencia extrema. En lugar de terminar la misión, el agotamiento de un medidor debería forzar al jugador a canibalizar los otros. Uf, me gusta eso. Suena tenso.

## 02:00

Super tenso. Te crea decisiones muchísimo más pesadas antes de llegar a un punto de no retorno absoluto. Mira, te doy un ejemplo concreto. A ver. Si la energía llega a cero, justo durante una tormenta de polvo en Marte, el sistema de la base entra en un modo de soporte vital. O sea, el jugador ya no puede hacer ciencia ni siquiera calefaccionar bien los módulos. Lo cual drena rápidamente la salud de los astronautas, imagino. Exactamente. Pero le da al jugador unos soles, unos días marcianos, para reasignar prioridades o mandar a alguien a limpiar paneles antes de morir.

## 02:30

Claro. Y oye, si el aire y el agua fallan, podrías permitir que la tripulación consuma el agua que usan como blindaje contra la radiación en los muros, ¿no? Sí, esa es una dinámica increíble. Solucionas la sed inmediatamente, pero claro, se te dispara la dosis de radiación recibida. O sea, la consecuencia es producto de una decisión drástica tuya, y así respetas a ese pilar de que ninguna decisión es gratis. Exacto. El juego no te mata. Te matas tú mismo, tratando de sobrevivir.

## 03:00

Wow, sí. Aunque esto me hace pensar, este, si yo tomo esa decisión extrema y agoto mi escudo de agua, voy a estar aterrada esperando que pase una tormenta solar. Al borde de la silla. Literal. Pero eso nos lleva a pensar en cómo se experimenta el paso del tiempo en el juego, o sea, antes de que golpea la crisis. ¿Cómo mantienes esa tensión durante un viaje espacial tan largo? Porque eso me preocupa de la segunda fase del documento. El diseño actual del salto temporal, durante la fase de viaje, corre el riesgo de diluir la tensión narrativa al presentar las crisis espaciales como interrupciones

## 03:30

matemáticas repentinas. Sí, es súper anticlimático. Bastante. Si nos enfocamos en esa fase 2, el viaje, el documento dice que el tiempo entre jornadas transcurre mediante un salto, aplica de golpe los consumos y la radiación de los días que te saltaste. A nivel de código es súper eficiente. Claro, pero arruina el ritmo por completo. Si tú ves cómo los números pasan mágicamente del día 10 al día 47 y de repente, ¡pum!, un evento de partículas solares, la crisis se siente como si te saltara una ventana de error en Excel.

## 04:00

Sí, cero inmersivo. No se siente como una amenaza real en el espacio profundo. Falta construcción de tensión. Pero, a ver, el diseño especifica que el viaje de cuatro meses debe acelerarse, ¿no? Para coincidir con la ventana de los datos reales. ¿Tipo la tormenta de mayo de 2024? Sí, y el autor es muy claro con eso. Entonces, si ralentizamos el viaje para crear tensión, no convertimos la simulación en algo tedioso y frustrante. Digo, es mucho tiempo real. Es un buen punto. Pero la sugerencia de mejora no es eliminar la aceleración.

## 04:30

Lo que tenemos que rediseñar es la desaceleración. Ah, OK. ¿Cómo funcionaría eso? Sugiero transformar el salto temporal en una mecánica de avance rápido e interactivo. Tipo un fast forward de toda la vida, pero que se interrumpa dinámicamente usando el sistema de pronósticos con incertidumbre que ya tienen en el documento. Para que el jugador vea venir el golpe. Exacto. Esto te permite construir anticipación. Por ejemplo, mientras el calendario avanza rapidísimo, la interfaz de pronto podría teñirse de amarillo mostrando

## 05:00

alertas del sistema DONKI de la NASA. Wow, eso te pone en alerta de inmediato. Sí, y el reloj se ralentiza automáticamente dos días antes del impacto real de la eyección de masa coronal. Así le das al jugador 48 horas simuladas para reaccionar y prepararse. Y me imagino que también puedes meter detalles audiovisuales, tipo implementar un medidor visual de ruido de estática en la radio, o ver fluctuaciones leves en los paneles solares a medida que se acerca la fecha. Sí, sí, indicadores visuales de que el clima espacial

## 05:30

está empeorando. Y así el jugador decide proactivamente detener lo que están haciendo y enviar a la tripulación al refugio antes de que el evento solar los golpe con todo. Y la crisis se siente merecida, o al menos inevitable, pero anticipada. Totalmente. Pero, claro, una vez que el jugador da la orden de correr al refugio, la ejecución depende de la tripulación en el juego. Y aquí es donde este flujo de la decisión choca con una regla muy particular sobre los tripulantes automáticos. La implementación de tripulantes automáticos que responden tarde por defecto genera una consecuencia artificial que castiga al jugador por variables

## 06:00

fuera de su control estratégico. Es que esa regla me volvió loca cuando la leí. Es muy frustrante. Si ponemos la lupa ahí, el documento dice que los tripulantes automáticos trabajan siempre al 70% de la velocidad. Toman el camino más largo y encima reaccionan con 3 a 6 segundos de demora ante un alarma. Y supuestamente esto es para darle valor a cuando tú microgestionas al personaje, ¿no? Ese es el argumento del diseñador, sí. Pero la verdad es que se está disparando en el pie. El pilar principal de este juego es que fallar enseña.

## 06:30

Claro, y si yo armo una rutina perfecta, pero la misión fracasa porque un botánico automático tardó 6 segundos en caminar hacia el refugio por una mala programación intencional. Exacto. La lección que aprendes no es sobre el clima espacial. Es sobre que la inteligencia artificial del juego es mala y te odia. Es una frustración súper injusta. Sí, es que si yo soy líder de una misión en la tierra, no asumo que mis astronautas van a caminar por el pasillo más largo durante un incendio. A menos que estén exhaustos o intoxicados por el CO2,

## 07:00

claro. La ineficiencia debería ser un síntoma. No la regla base. Le diste al clavo. Es exactamente la sugerencia de mejora. Proponemos vincular directamente la eficiencia y la latencia de respuesta de los tripulantes automáticos a los medidores de salud, cansancio y el nivel de CO2. Ah, claro. Así todo está conectado. De este modo, el comportamiento torpe de la tripulación se convierte en una consecuencia orgánica. Es directa de tus propias decisiones de gestión. Por ejemplo, si has mantenido los niveles de CO2 bajitos por debajo de 3 milímetros de mercurio.

## 07:30

Y si los has dejado dormir bien y programas llamadas a la tierra que les suben el ánimo, digamos. Exacto. Entonces los tripulantes reaccionan en un segundo a la alarma y toman rutas óptimas al refugio. Recompensas la buena gestión. Pero si el jugador sobreexplotó a la tripulación saltándose las horas de sueño para reparar algo, entonces ahí sí se aplica la demora de seis segundos. Ahí se aplica el castigo y el camino ineficiente porque refleja una fatiga cognitiva real. Y ojo que esto está súper respaldado por los estudios

## 08:00

de aislamiento Mars 500, que el mismo documento cita. Claro, donde documentaron que el cansancio te vuelve errático. Totalmente. Y mira, incluso en lugar de ese 70% fijo de velocidad, podemos hacer que varíe del 100 al 50% según la condición física de cada rol. O sea, si la geóloga médica no hizo su rutina de ejercicio, se vuelve lenta, porque la gravedad cero le afectó a los músculos. Exacto. Y así es que cada falla sea verdaderamente responsabilidad tuya como jugador. Te da rabia contigo mismo, no con el juego.

## 08:30

Bueno, creo que ahí tenemos un rediseño espectacular de las mecánicas. Para hacer una recapitulación super breve de nuestro análisis de hoy, vimos tres puntos clave. Así es. Primero, sustituir ese fin de partida abrupto por estados de falla en cascada que exigen sacrificios heroicos, como vaciar el agua. Segundo, transformar los saltos temporales fríos en avances rápidos que se ralentizan con advertencias climáticas para construir tensión. Y tercero, vincular toda esa torpeza de los tripulantes automáticos a los medidores de fatiga y ánimo,

## 09:00

en lugar de penalizar el jugador arbitrariamente. Y la verdad hay que decirlo. La ambición de este documento es fantástica. El uso que le dan a los datasets científicos reales de la NASA, como [nombre poco claro: posiblemente RAD Lab], los sensores REMS, es simplemente excelente. Solo necesitan ajustar estas tuercas. Sí, es un proyecto lindísimo. Por eso invitamos cálidamente al diseñador a implementar estos cambios para pulir el flujo de consecuencias. Nos encantaría recibir la próxima iteración del documento para darle una nueva revisión en el futuro. Así que a iterar esos sistemas y muchísimas gracias por

## 09:30

acompañarnos en el análisis de hoy. Nos escuchamos en la próxima.

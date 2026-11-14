# datasets/raw — Descargas crudas de la NASA

Material de partida para el **procesamiento posterior**, que decidirá qué variables usa el juego y cómo
mostrarlas a niños de ~10 años sin perder el vínculo con el dato real. Nada de esta carpeta lo lee
el juego directamente: cuando una variable se adopte, se procesará a `datasets/curated/` o a
`datasets/donki/` y se documentará en `datasets/README.md`.

```bash
npm run datasets:download                 # todo
npm run datasets:download -- donki radlab # sólo algunas fuentes
```

`manifest.json` registra cada archivo: URL y consulta exactas, fecha de descarga, número de registros,
tamaño, SHA-256 y si se versiona. Los archivos de más de 5 MB no se suben a git (los lista `.gitignore`);
se regeneran con el comando anterior.

## Fuentes y variables candidatas

| Carpeta | Fuente | Qué contiene | Variables candidatas para el juego |
|---|---|---|---|
| `donki/` | NASA CCMC DONKI, 2024 → hoy | Respuesta original de la API para FLR, SEP, CME, GST, IPS, HSS, MPC, RBE y `notifications` | Llamaradas (clase GOES → apagón de radio R1–R5), tormentas de partículas (SEP) como crisis de radiación, CME como **alerta temprana** (velocidad, hora estimada de llegada), Kp de tormentas geomagnéticas, **textos reales de alertas** escritos por analistas de la NASA |
| `radlab/daily/` | NASA OSDR RadLab | Estadísticas diarias (n, mín., media, máx.) de dosis absorbida en μGy/h, por instrumento | Dosis de fondo **real** según el lugar: órbita lunar (LRO/CRaTER), superficie de Marte (Curiosity/RAD), espacio profundo (BioSentinel), crucero y órbita de Marte (TGO/Liulin-MO), ISS (DosTel). Sirve para comparar lugares y escalar el blindaje |
| `radlab/events/` | NASA OSDR RadLab | Series a **resolución completa** de dos tormentas reales (mayo de 2024) | Gráfica del **pico real** de radiación durante una tormenta: la crisis que se puede revivir en el juego |
| `mars-weather/` | NASA Mars Exploration Program | Clima diario de Curiosity/REMS (~4700 soles) y Perseverance/MEDA | Temperatura mín./máx., presión, índice UV, opacidad, salida y puesta del sol: el «parte meteorológico» de una base en Marte |
| `osdr/` | NASA OSDR | Metadatos completos de hasta 25 estudios por tema (radiación, hueso, músculo, plantas, comida, sueño, sistema inmune, aislamiento) | «¿Sabías que…?» y consecuencias de salud basadas en estudios reales, con enlace a cada estudio |
| `references/` | NASA BVAD y NASA-STD-3001 (OCHMO) | PDFs, más el texto completo del BVAD | Valores de diseño por tripulante: O2 consumido, CO2 producido y su límite (≤ 3 mmHg), agua (2,5 L/día, 240 mL por hora de EVA), comida (3035 kcal/día), límites de radiación (600 mSv de carrera, 250 mSv por SPE) |

## Notas para el procesamiento

- **Unidades**: RadLab da dosis absorbida en **μGy/h** (gray). Las referencias curadas usan dosis
  equivalente en **mSv/día** (sievert). No son intercambiables sin un factor de calidad: hay que documentar
  cualquier conversión.
- **RadLab**: las series completas pesan cientos de MB (TGO ~270 MB, BioSentinel ~100 MB), por eso se
  guardan agregadas por día. La serie de la ISS se pide año a año porque la consulta completa da 504.
  La API no envía cabeceras CORS: hay que descargarla con Node, no desde el navegador.
- **DONKI**: cada evento lleva `link` a su ficha pública, útil para enlazar desde el juego a la fuente.
  Los textos de `notifications` están en inglés y usan jerga técnica: si se muestran, conviene acompañarlos
  de una explicación sencilla.
- **Mars weather**: los valores vienen como texto (`"-71"`, `"--"` cuando no hay dato).
- **OSDR**: la búsqueda devuelve estudios muy técnicos (genómica, cultivos celulares). Hay que filtrar a mano
  los que tengan un mensaje comprensible para niños.

## Primera revisión de la descarga (14/11/2026)

| Serie diaria | Rango | Mediana diaria | Observaciones |
|---|---|---|---|
| Superficie de Marte (Curiosity/RAD) | 2015 → jun. 2024 | 8,3 μGy/h (≈ 0,2 mGy/día, coincide con Hassler et al. 2014) | Evento SEP del 20/05/2024: pico de 304 μGy/h, unas 64 veces el valor habitual |
| Órbita lunar (`celestial_body=Moon`) | 2009 → jun. 2024 | 11,1 μGy/h | Incluye CRaTER **y los instrumentos de Artemis I** (EAD, HERA). El máximo extremo corresponde al paso de Artemis I por los cinturones de Van Allen: separar por `instrument_id` |
| ISS (DosTel1/2) | 2009 → nov. 2024 | 24,8 μGy/h | La media diaria incluye los pasos por la Anomalía del Atlántico Sur |
| Espacio profundo (BioSentinel) | nov. 2022 → nov. 2025 | 6,8 μGy/h | Hay máximos diarios muy altos que hay que revisar antes de usarlos |
| Crucero y órbita de Marte (TGO) | 2016 → 2023 | 15,7 μGy/h | `instrument_id` distingue crucero (`-Cruise`) de órbita (`-Orbit`) |

Tormenta de mayo de 2024 a resolución completa: ISS, pico de 527 μGy/h (mediana de 4,5); espacio profundo,
653 μGy/h; órbita lunar (resolución horaria), 3152 μGy/h.

DONKI 2024 → nov. 2026: 1941 llamaradas (85 de clase X; la mayor, X9.0 del 03/10/2024), 214 eventos SEP,
62 tormentas geomagnéticas (Kp máximo 9) y 2572 notificaciones (alertas e informes semanales).

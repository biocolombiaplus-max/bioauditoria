# Interfaz BIOsoft ↔ Equipos de Laboratorio (Módulo LIS)

## Divina Misericordia — 2 equipos observados directamente en sitio (vía AnyDesk)

### Mindray BC-760 (hematología) — con LabXpert ya instalado

- **Es LIS sobre RED, en modo "el equipo es el servidor" (al revés de lo
  más común).** En su pantalla de Comunicación el equipo trae SU PROPIA
  IP fija (`10.0.0.12`, máscara `255.255.255.0`, puerta de enlace
  `10.0.0.254`), protocolo **HL7**, puerto **5100**, y un selector "Canal
  de datos" que solo ofrece **"labXpert"** (sin otras opciones ni campo
  para un segundo destino). Nunca aparece un campo "IP host LIS"/"Servidor"
  como en el BS-220 — porque aquí es el equipo el que escucha, no el que
  marca hacia afuera.
- Esto significa: **para este equipo hay que usar `index-hl7.js` en
  `"modo": "cliente"`** (ver sección "Modo cliente" más abajo), apuntando
  a `ipEquipo: "10.0.0.12"`, `puerto: 5100` — NO el modo servidor por
  defecto que sí sirve para el BS-220.
- Se investigó a fondo si LabXpert (ya instalado y funcionando con este
  equipo) tiene alguna forma de REENVIAR los resultados a un segundo LIS
  externo, para no desconectar lo que el cliente ya usa — se revisaron
  las pestañas "Conexión instrum", "Conf. comunicación" (incluyendo
  "C LIS/HIS bi", que resultó ser sobre RECIBIR órdenes, no sobre enviar
  resultados) y "Otros", sin encontrar un campo de IP/puerto para un
  tercer sistema. **Validar primero con `capturar-hl7.js cliente 10.0.0.12
  5100`** (con LabXpert corriendo normal al mismo tiempo) si el equipo
  acepta una SEGUNDA conexión HL7 simultánea — si la rechaza, hay que
  coordinar con el distribuidor (Labotech) antes de seguir.
- **Aún no existe mapeo de parámetros para el BC-760** — se construye con
  el `.log` real que genere `capturar-hl7.js`, igual que cualquier equipo
  nuevo. Al ser hematología (un solo panel), parte de
  `mapeo-generico-hl7-template.js`, no de la versión multiexamen.
- **Se buscó documentación pública antes de construir ese mapeo, sin
  éxito — no inventes códigos a partir de esto.** No se encontró el
  manual de operación ni el apéndice de comunicación LIS del BC-760/BC-780
  (los manuales públicos que sí aparecen son de otros modelos — BS-200,
  BS-360E, BC-5380, Yumizen H550 — y sus códigos NO se pueden asumir
  iguales). Un dato curioso y contradictorio encontrado: un proveedor de
  terceros (LisBridge) describe que "el BC-760 típicamente se conecta por
  ASTM E1394 (serial o TCP/IP)" y que su propio puente lo convierte a HL7
  — lo cual choca con lo que SÍ se vio de primera mano en la pantalla real
  del equipo en Divina Misericordia ("Protoc comuni: HL7"). Ante esa
  contradicción, confía en lo observado directamente en el equipo, no en
  la descripción genérica de un tercero. Tampoco se confirmó por este
  medio si el BC-760 es de diferencial de 3 o 5 poblaciones (la ficha
  técnica sugiere 5 partes, pero es una inferencia, no un dato confirmado)
  — verifica ambas cosas con la captura real antes de construir el mapeo.

### Total Care 200 (química, marca genérica "TotalCare"/Bio Suministros Katy)

- **Es ASTM/LIS sobre RED, en modo "el equipo es el cliente" (lo más
  común).** En su propio software (menú Procesamiento de datos ->
  Exportar datos) trae "Modo de: TCP/IP", "Servidor IP" y "Puerto"
  (`8087` de fábrica, apuntando a `127.0.0.1` — hay que cambiarlo),
  "Formato de codificación: ASCII" (coincide con ASTM, no con HL7), y
  checkboxes "Transporte en tiempo real" / "Conectar automáticamente".
- Esto significa: **usar `index-tcp.js` en modo "servidor" (el valor por
  defecto)** — justo el gap que no existía en este proyecto hasta ahora
  (solo había `capturar-tcp.js` para probar, sin una versión que
  escribiera de verdad en BIOsoft). Pon en el equipo la IP de la
  computadora donde corra `index-tcp.js` y el mismo puerto de tu
  `config-tcp.json`.
- **Tampoco existe mapeo todavía** — es un equipo de química (multi-examen,
  cada prueba es un examId separado en BIOsoft), así que parte de
  `mapeo-generico-multiexamen-template.js`. Primero confirma el formato
  real con `capturar-tcp.js servidor <puerto>`.
- **No se encontró ningún manual público de este equipo.** "Total Care
  200"/"SHY-200-KZ" (distribuido por Bio Suministros Katy) parece ser una
  marca genérica/OEM china sin documentación técnica indexada — no hay
  ningún atajo aquí, el mapeo depende 100% de la captura real.

## Investigación pública sobre 3 equipos concretos (Dymind DF52, Dirui CS-T240, Maglumi 800)

Antes de una visita real a un cliente con estos tres equipos, se buscó
documentación pública sobre su interfaz de comunicación. Esto es lo que
se encontró — basado en documentación de terceros e información general
del fabricante, **no verificado contra los equipos físicos**:

- **Dymind DF52 (y familia DF5x/DH5x de hematología):** la documentación
  pública de Dymind indica que estos equipos usan **HL7 v2.3.1 sobre TCP**
  (conexión persistente), NO el protocolo ASTM E1394. Para este equipo usa
  `capturar-hl7.js`, no `capturar.js`/`capturar-tcp.js`.
- **Dirui CS-T240:** la documentación indica integración LIS/EMR
  bidireccional "vía interfaces estándar", con opciones de red y USB — no
  se encontró confirmación pública de si además tiene salida serial RS-232
  clásica (ASTM) o si es exclusivamente por red. Prueba primero
  `capturar.js` (serial) por ser lo más común en analizadores de química
  de esta gama; si no aparece nada, prueba `capturar-tcp.js` (red).
- **Maglumi 800:** la documentación indica soporte de **ambos** — RS-232 y
  TCP/IP, usando protocolo **ASTM E1394**. Este es el más alineado con lo
  que ya está construido: prueba `capturar-tcp.js` (o `capturar.js` si
  tiene puerto serial).

### Mindray BS-220 (Química) — observado directamente en un equipo real en sitio

A diferencia de los 3 equipos de arriba (solo documentación pública), esto
sí se leyó directamente de la pantalla del equipo (menú **Sistema →
LIS**) de un BS-220 real:

- **Es LIS sobre RED (TCP/IP), no serial.** La pantalla tiene "Habilitar
  LIS", "IP host LIS" y "Puerto" (ej. `5150` de fábrica) — **el equipo se
  conecta COMO CLIENTE** a esa IP:puerto, nunca al revés. Esto confirma lo
  que ya sugería la documentación pública de Mindray para la familia
  BS-200/BS-220/BS-120/BS-130/BS-180 (HL7 v2.3.1 sobre TCP) — usa
  `capturar-hl7.js`/`index-hl7.js`, NO `capturar.js`/`index.js` (los de
  puerto serial). El campo "IP host LIS" venía con `127.0.0.1` de fábrica
  — hay que cambiarlo a la IP de la computadora donde corra este
  middleware (nunca dejarlo en `127.0.0.1`, salvo que el middleware
  corriera en la misma computadora embebida del equipo, que no es el caso).
- **"Enviar result tras cada muestra" activado** = envío automático (no
  hace falta un botón "enviar" por muestra) — igual que "Auto Send" en
  otros equipos.
- **"Correspondencia de test" (Test → "Cód en LIS") es la mejor noticia de
  los 4 equipos investigados hasta ahora:** el propio operador puede
  escribir en el equipo QUÉ código usará cada prueba. Lista completa
  observada en el equipo real (con scroll): GLUCOSA, CREATININA,
  COLESTEROL, TRIGLICERIDOS, ACIDO URICO, PROTEINA TOTAL, ALBUMINA, TGO,
  TGP, CALCIO, FOSFORO, ALP, LDH, B. Total, B. Directa, AMILASA MR, CK NAC,
  CK MB, PROT-U, K, Na, Cl, MAGNESIO, HDL-C, GGT, P.C.R, UREA CINETICA,
  Hierro, Albúmina Orina, GLOBULINA, VLDL, B INDIRECTA, L.D.L-C. Esto
  elimina casi toda la incertidumbre de "¿qué código interno usa este
  equipo?" — en vez de averiguarlo, **se lo decimos al cliente**: ver
  `mindray-bs220-hl7-map.js`, ya construido con un código corto por cada
  prueba mapeable (ej. "GLU" para Glucosa) listo para copiar en esa
  pantalla. De esa lista, 4 pruebas quedan A PROPÓSITO sin mapear por
  ahora (ver los comentarios del propio archivo):
  - **GLOBULINA** y **L.D.L-C**: BIOsoft ya las calcula solas (fórmulas a
    partir de Proteína Total/Albúmina y de Colesterol/HDL/Triglicéridos)
    — mapearlas sería redundante y podría pisar ese cálculo.
  - **VLDL**: no existe un examen equivalente en el catálogo de BIOsoft.
  - **PROT-U** y **UREA CINETICA**: hay una duda real de unidades/definición
    (¿es una concentración puntual o un total de 24h? ¿reporta Urea o
    BUN, que no son el mismo número?) que hay que resolver con el cliente
    antes de mapearlas — mapear a ciegas podría marcar un valor normal
    como anormal o viceversa.
- **Es un equipo de QUÍMICA, no de un solo panel** (a diferencia del BC-10,
  que es un hemograma completo en un solo examen): cada prueba que corre
  es un examen SEPARADO en el catálogo de BIOsoft (QUI-001, QUI-004,
  etc.), así que `mindray-bs220-hl7-map.js` usa el contrato MULTI-EXAMEN
  (ver `mapeo-generico-hl7-multiexamen-template.js` y la sección
  "Mapeo multi-examen" más abajo) — un mensaje que traiga varios
  resultados a la vez se reparte automáticamente entre los examId que
  correspondan.

**Lo que TODAVÍA no está confirmado (aun con el equipo real observado):**
1. Si el protocolo de fondo, detrás de esa pantalla "LIS", es HL7 v2.3.1
   "de verdad" (segmentos MSH/PID/OBR/OBX con framing MLLP) o una variante
   simplificada propia de este equipo — solo una captura real con
   `capturar-hl7.js` lo confirma. Si no muestra nada reconocible, prueba
   `capturar-tcp.js` con la misma IP/puerto para ver los bytes crudos tal
   cual llegan, sea cual sea el formato real.
2. En qué campo exacto del mensaje aparece el "Cód en LIS" que se escriba
   en esa pantalla — se asume que es la parte antes del "^" en OBX-3 (lo
   más común en HL7), pero hay que comprobarlo con la captura real antes
   de un resultado de un paciente.
3. De dónde saca el equipo el número de orden/muestra que llega en PID-3
   (`extraerNumeroOrden()` en `index-hl7.js`) — confirmar que el operador
   escanea/digita ahí el mismo número de orden que imprime el sticker de
   BIOsoft.

### Medonic M32 (Boule Diagnostics) — observado directamente en un equipo real en sitio

A diferencia de los 3 anteriores (solo documentación pública), esto sí se
leyó directamente de la pantalla táctil de un Medonic M32 real (menú
Setup Menu 1 → Serial Setup → "Serial Output Setup A/B"):

- **"Send with Ack." está marcado [X]:** el equipo espera una confirmación
  (ACK) después de enviar cada trama — esto es justo el comportamiento del
  handshake ENQ/ACK/NAK/EOT de ASTM E1394 que `astm.js` ya implementa
  automáticamente. Buena señal de que `capturar.js`/`index.js` (sin
  modificar el parser) es el punto de partida correcto para este equipo.
- **"HW Handshake" está marcado [X]:** el equipo espera control de flujo
  por hardware (líneas RTS/CTS), que por defecto este middleware NO
  activaba. Se agregó soporte opcional (`rtscts` en `config.json`, o
  `rtscts` como tercer argumento de `capturar.js`) — actívalo si el
  equipo transmite con esta opción encendida y no aparece nada en la
  captura, ya antes de intentar apagar "HW Handshake" en el equipo (que
  puede no ser deseable si así lo dejó el técnico del fabricante).
- **"Baud Rate" muestra un índice numérico (ej. "1"), no los baudios
  reales** (ej. "9600") — es un menú por posición, no el valor directo.
  Hay que tocar ese botón para ver qué valores cicla y anotar cuál está
  seleccionado, o confirmarlo en el manual técnico del M32.
- **"Manual Send Mode" / "Auto Send Mode":** el equipo puede enviar cada
  resultado a pedido (manual, con un botón "enviar"/"imprimir" en su
  pantalla) o automáticamente al terminar cada muestra. Para el primer
  piloto con `capturar.js` cualquiera de los dos sirve (basta con
  disparar el envío manualmente después de correr una muestra); para uso
  diario sin intervención, "Auto Send" es preferible si el equipo lo
  soporta bien.
- **"Select USB VID&PID"** sugiere que el M32 se conecta por **USB**
  (apareciendo como un puerto COM virtual en Windows, típicamente con
  chipset FTDI/CP210x/CH340/PL2303), no por DB9 serial clásico — puede
  necesitar el driver USB-a-serial correspondiente instalado en el
  computador antes de que aparezca en el Administrador de Dispositivos.

**No hay todavía un mapeo de parámetros construido para el Medonic M32**
(`medonic-m32-map.js` no existe aún) — se construye con el archivo `.log`
real que genere `capturar.js`, siguiendo el mismo proceso que cualquier
equipo nuevo (ver la sección "❌ NO validado" más abajo).

**Esto NO reemplaza la prueba real** — es la mejor pista disponible antes
de llegar al sitio, para saber qué herramienta probar primero en cada
equipo y ahorrar tiempo en la visita.


Middleware de referencia que conecta un analizador de laboratorio (química,
hematología, inmunoensayo/quimioluminiscencia, etc.) directamente con
BIOsoft, para que los resultados lleguen automáticamente en vez de
digitarse a mano. El protocolo de comunicación que habla — **ASTM E1394
por puerto serial** — es un estándar de la industria, no algo exclusivo
de una marca: es el mismo protocolo (o una variante muy cercana) que usan
la mayoría de analizadores de gama media que traen salida "LIS" o "host",
incluyendo los que BIOsoft ya soporta pedir conectar:

- **Mindray** (hematología BC-10, y línea de química — mismo protocolo)
- **Dirui** CS-T240 (química)
- **Dymind** DF52 (hematología)
- **Maglumi** 800 (inmunoensayo / quimioluminiscencia)
- **Rayto** (química y hematología)
- **Medonic M32** (Boule Diagnostics, hematología — ver hallazgos concretos de este equipo más abajo)

## ⚠️ Estado del proyecto: piloto, no producción

Este código se construyó **sin acceso a ninguno de estos equipos
físicos**. Antes de usarlo con pacientes reales, es indispensable un
piloto de validación por cada equipo. Aquí está exactamente qué sí y qué
no está probado:

### ✅ Validado (con pruebas automáticas, `npm test`)
- El protocolo de bajo nivel ASTM E1394 (handshake ENQ/ACK/NAK/EOT, armado
  y verificación de checksum, reensamblado de tramas) — es el estándar de
  la industria, no algo específico de una marca. Probado incluso con el
  peor caso: datos llegando **1 byte a la vez** (fragmentación extrema de
  puerto serial), y con un checksum corrupto a propósito para confirmar
  que se detecta y se pide reenvío (NAK). Esta parte es la misma para
  cualquiera de los equipos de la lista de arriba.
- **Mapeo multi-examen** (`agruparPorExamen()` en `index.js` e
  `index-hl7.js`): un analizador de QUÍMICA (ej. Mindray BS-220) puede
  reportar varios parámetros por muestra, cada uno un examen SEPARADO en
  el catálogo de BIOsoft — a diferencia de un hemograma, donde todo el
  panel es un solo examen. Un mapeo "multi-examen" (ver
  `mapeo-generico-multiexamen-template.js` /
  `mapeo-generico-hl7-multiexamen-template.js`, y `mindray-bs220-hl7-map.js`
  ya construido) agrupa los resultados de un mismo mensaje por examId y
  escribe una actualización de Firestore por cada uno — probado con datos
  sintéticos, incluyendo el caso de un examen con más de un parámetro
  (Bilirrubinas: BT + BD). Un mapeo "clásico" de un solo panel (BC-10,
  Dymind) sigue funcionando exactamente igual que antes, sin tocarse — es
  compatibilidad hacia atrás, no un reemplazo.
- La escritura en BIOsoft/Firestore replica exactamente el mismo contrato
  de datos que usa la app web (`biosoft/js/store.js::recibirResultadoEquipo`):
  nunca deja un resultado como "preliminar" ni "validado" automáticamente,
  siempre como borrador (`en_proceso`), pendiente de que un bacteriólogo
  lo revise y confirme desde BIOsoft. Esto es intencional y **no debe
  cambiarse** — un dato mal recibido no debe poder llegarle a un paciente
  sin que una persona lo haya visto. Esto tampoco cambia según el equipo.
- **Deduplicación y control de antigüedad** (`test/dedup-y-antiguedad.test.js`,
  `test/resguardos-firestore-writer.test.js`): un mismo mensaje reenviado
  por el equipo (ej. el ACK no llegó a tiempo y reintenta) no se vuelve a
  procesar — en HL7 se detecta por el Message Control ID (MSH-10); en ASTM,
  que no trae un identificador de este tipo confiable entre marcas, por una
  huella del propio contenido del mensaje. Además, `recibirResultadoEquipo`
  rechaza (y deja registrado en Trazabilidad, visible desde BIOsoft) un
  resultado para un examen ya "preliminar", "validado" o "remitido", y una
  orden de más de 96 horas de antigüedad — para que un mensaje repetido o
  atascado en el buffer del equipo nunca pueda reescribir en silencio una
  orden que el paciente ya recibió. Es el resguardo equivalente, sin
  interfaz bidireccional (host query), a lo que los LIS grandes logran
  dejando que el propio equipo solo pueda resultar lo que el LIS le
  confirmó como pendiente del día.

### ❌ NO validado — requiere el equipo real, uno por uno
1. **Formato exacto de los mensajes de CADA equipo.** El estándar ASTM
   define el layout general de registros (H/P/O/R/L con campos
   `|`-delimitados), pero cada fabricante — y a veces cada modelo — tiene
   pequeñas variaciones en qué campo usa para qué. **Antes de usarlo en
   serio con cualquier marca:** enciende el equipo con `verboso: true` en
   `config.json`, corre una muestra de control, y compara los mensajes
   que aparecen en consola contra lo que `astm.js` espera.
2. **El mapeo de parámetros por equipo.** Solo existe un mapeo YA
   construido: `mindray-bc10-map.js` (Mindray BC-10, hematología) — y
   sigue siendo una plantilla de mejor esfuerzo, no confirmada contra el
   equipo real (ver limitación 3 más abajo). Para Dirui CS-T240, Dymind
   DF52, Maglumi 800, Rayto o la línea de química de Mindray **no existe
   todavía un archivo de mapeo** — hay que construirlo siguiendo el mismo
   patrón, usando `mapeo-generico-template.js` como punto de partida, y
   llenando los códigos reales que confirmes en el punto 1 (con el
   manual del equipo y/o una captura real de sus mensajes). No hay
   códigos "inventados" para estas marcas en este repositorio — sería
   peligroso pretender que sí funcionan sin haberlos visto nunca.
3. **Mindray BC-10 es un analizador de 3 poblaciones**, no de 5. Reporta
   linfocitos y granulocitos agrupados, pero **no mide monocitos,
   eosinófilos ni basófilos por separado** — esos parámetros del hemograma
   de BIOsoft quedarán vacíos y se siguen digitando a mano si el
   laboratorio los necesita (extendido de sangre periférica). Esto no es
   una limitación del middleware: es una limitación real de ese equipo.
   Verifica las poblaciones que sí reporta cada equipo nuevo (Dymind DF52,
   Rayto hematología, etc.) contra su propia ficha técnica antes de asumir
   que reporta lo mismo que BIOsoft espera.
4. **Puerto/velocidad exactos** (`puertoSerial`, `baudRate` en `config.json`)
   — depende de cómo esté configurada la comunicación en el menú de cada
   equipo, y varía de uno a otro.
5. **Cómo llega el número de orden al equipo.** El middleware asume que el
   "Sample ID" que transmite el equipo es el mismo número de orden que
   BIOsoft ya imprime en el sticker de la muestra — es decir, que el
   operador escanea o digita ese mismo número en el equipo antes de
   procesar la muestra. Si tu flujo de trabajo es distinto, hay que
   ajustar `extraerNumeroOrden()` en `index.js`.

**En resumen: no le digas a un cliente "conecta y ya" hasta correr el
punto 1 con SU equipo real (sea cual sea la marca) y confirmar que los
números que llegan a BIOsoft coinciden con lo que el equipo mostró en su
propia pantalla. Cada marca/modelo nuevo necesita su propio piloto de
validación, aunque reutilice todo el resto de este middleware.**

## Modo servidor vs. modo cliente (importante, léelo antes de instalar)

Un equipo de red se conecta de una de estas dos formas — **no hay una
sola convención entre marcas, hay que confirmarlo en cada equipo**:

- **Modo servidor** (`"modo": "servidor"`, o simplemente no pongas el
  campo — es el valor por defecto, compatible con toda configuración
  vieja): esta computadora escucha, **el equipo se conecta a ella como
  cliente**. Reconócelo porque el equipo trae un campo tipo "IP host
  LIS"/"Servidor IP"/"Host" donde TÚ escribes la IP de esta computadora
  (ej. Mindray BS-220, Total Care 200).
- **Modo cliente** (`"modo": "cliente"`, + `"ipEquipo": "..."`): al
  revés — **esta computadora se conecta HACIA el equipo**. Reconócelo
  porque el equipo trae SU PROPIA IP fija configurada (máscara, puerta de
  enlace) y NINGÚN campo para apuntar a un servidor externo — todo lo que
  configuras ahí es la identidad de red del equipo mismo, nunca un
  destino (ej. Mindray BC-760).

Si no sabes cuál es el tuyo, usa primero `capturar.js`/`capturar-tcp.js`/
`capturar-hl7.js` (no necesitan usuario ni clave de BIOsoft) en modo
servidor; si no aparece nada ahí, prueba el mismo archivo en modo
cliente apuntando a la IP del equipo. Una vez confirmado, usa el mismo
`"modo"` en tu `config*.json` real (`index.js`/`index-tcp.js`/
`index-hl7.js`) — estos SÍ reintentan solos la conexión si se corta
(cada 10 segundos) en modo cliente, cosa que las herramientas de solo
captura no necesitan hacer.

## Cómo funciona (arquitectura)

```
Analizador de laboratorio  --(cable serial, protocolo ASTM E1394)-->  Esta
(Mindray, Dirui, Dymind,                                          computadora
Maglumi, Rayto, u otro                                          (este middleware)
compatible con ASTM E1394)                                            |
                                                                       | Firebase Auth
                                                                       | (mismo usuario/clave
                                                                       |  que cualquier
                                                                       |  bacteriólogo)
                                                                       v
                                                               Firestore (BIOsoft)
                                                               tenants/{id}/orders/{orden}
                                                                       |
                                                                       v
                                                         BIOsoft (navegador) — el
                                                         bacteriólogo ve el resultado
                                                         como "borrador, recibido del
                                                         equipo" y lo revisa/valida
```

No se necesita backend nuevo ni claves de administrador de Firebase: el
middleware inicia sesión como un usuario BIOsoft normal (ver paso 2 abajo),
así que respeta exactamente los mismos permisos que ya tiene ese usuario.
Esto es igual sin importar la marca del equipo — lo único que cambia por
equipo es el archivo de mapeo de parámetros (punto 2 de la sección
anterior).

## Paso 0 — Primera prueba en sitio (recomendado, antes de instalar nada más)

Antes de configurar `config.json` ni tocar BIOsoft, usa `capturar.js`: no
necesita usuario ni clave de BIOsoft, solo abre el puerto serial y muestra
(y guarda en un archivo `.log`) exactamente lo que transmite el equipo.
Es la forma más rápida y de menor riesgo de confirmar, frente al cliente,
si la conexión funciona:

```
npm install
node capturar.js                # sin argumentos: lista los puertos disponibles
node capturar.js COM3           # Windows — reemplaza COM3 por el puerto real
node capturar.js /dev/ttyUSB0 9600   # Linux/Mac, con baudios explícitos
```

Corre una muestra de control en el equipo real y observa la consola. Si
aparecen mensajes con pinta de tabla de resultados (parámetro, valor,
unidad), la conexión funciona — guarda el archivo `.log` que se genera,
con eso se construye el mapeo definitivo de esa marca/modelo.

## Practicar SIN el equipo real (antes de tu primera visita a un cliente)

`simulador-equipo.js` se conecta a `capturar-tcp.js` y envía un mensaje
ASTM de práctica (con datos inventados, no de ningún equipo real) — así
puedes ver el flujo completo funcionando en tu propio computador, sin
necesitar el analizador físico. Ideal para familiarizarte con la
herramienta el día antes de una visita.

Dos terminales abiertas en esta carpeta:
```
Terminal 1:  node capturar-tcp.js servidor 5000
Terminal 2:  node simulador-equipo.js
```
En la Terminal 1 debería aparecer un "MENSAJE COMPLETO" con datos de
ejemplo — así sabes exactamente qué esperar cuando sí sea el equipo real.

## Instalación

1. **En BIOsoft:** Configuración del Laboratorio → "Equipos Conectados" →
   "Conectar un Equipo". Escribe la marca/modelo real (ej. "Dirui CS-T240",
   "Dymind DF52", "Maglumi 800", "Rayto RT-XXXX", "Mindray BS-XXX"). Anota
   el `tenantId` y el `examId` que te muestra.
2. **En BIOsoft:** Usuarios del Laboratorio → Nuevo Usuario → rol
   Bacteriólogo(a), asignado **solo** a la sección correspondiente (ej.
   Hematología o Química). Este usuario es exclusivamente para el
   middleware, no para una persona.
3. En esta carpeta, según cómo se conecte TU equipo (ver la sección de
   investigación por marca/modelo más arriba para saber cuál probar
   primero):
   - **Puerto serial / ASTM** (BC-10, y probablemente Dirui/Rayto/Maglumi):
     ```
     npm install
     cp config.example.json config.json
     ```
     Completa `config.json` con los datos de los pasos 1 y 2, y el puerto
     serial donde está conectado el equipo.
   - **Red / ASTM sobre TCP** (Maglumi 800, Total Care 200, u otro equipo
     con salida de red que use el mismo formato ASTM que el de puerto
     serial — ver "Modo servidor vs. modo cliente" arriba para saber cuál
     usar):
     ```
     npm install
     cp config-tcp.example.json config-tcp.json
     ```
     Completa ese archivo con los datos de los pasos 1 y 2, el `"modo"` y
     el puerto/IP correspondientes. `npm run start:tcp` (o
     `node index-tcp.js config-tcp.json`) para iniciarlo.
   - **Red / HL7 sobre TCP** (Mindray BS-220/BC-760, Dymind DF52 — el
     equipo tiene una pantalla "LIS"/"Comunicación" con IP/Puerto en vez
     de un puerto serial; ver "Modo servidor vs. modo cliente" arriba):
     ```
     npm install
     cp config-bs220.example.json config-bs220.json    # o config-hl7.example.json para otra marca HL7
     ```
     Completa ese archivo con los datos de los pasos 1 y 2, y el `"modo"`
     correspondiente. En modo servidor (el más común), en el equipo
     cambia "IP host LIS" por la IP de ESTA computadora (la imprime
     `capturar-hl7.js` al arrancar) y "Puerto" por el mismo puerto del
     archivo de configuración; en modo cliente, deja la red del equipo
     tal como está y solo completa `ipEquipo`/`puerto` en el archivo.
4. **Si tu equipo es un Mindray BC-10:** ya tienes un mapeo de referencia
   (`mindray-bc10-map.js`). **Si es un Mindray BS-220:** ya tienes
   `mindray-bs220-hl7-map.js`, con los códigos que debes pedirle al cliente
   escribir en "Correspondencia de test" en el equipo (ver la sección
   "Mindray BS-220" más arriba). En ambos casos, aún así valida el punto 1
   de "❌ NO validado" antes de confiar en un resultado real.
   **Si tu equipo es otra marca** (Dirui, Dymind, Maglumi, Rayto, u otra):
   copia `mapeo-generico-template.js` (ASTM, un solo panel — ej.
   hematología), `mapeo-generico-multiexamen-template.js` (ASTM, varios
   exámenes por mensaje — ej. química) o la versión `-hl7-` de cualquiera
   de los dos (si el equipo es de red/HL7) a un archivo nuevo (ej.
   `dirui-cst240-map.js`), llena los códigos reales de esa marca siguiendo
   las instrucciones del propio archivo, y apunta `archivoMapeo` en tu
   `config*.json` a ese mapeo.
5. `npm test` — confirma que el parser ASTM, la agrupación multi-examen y
   los mapeos de ejemplo pasan las pruebas automáticas (esto no requiere
   ningún equipo conectado).
6. `npm start` (equipo serial/ASTM, usa `config.json`) o
   `node index-hl7.js config-bs220.json` (equipo de red/HL7 — cambia el
   nombre del archivo si no es un BS-220) — deja el middleware corriendo.
   Corre una muestra de control en el equipo real y observa la consola con
   `verboso: true` (ASTM) o los mensajes `[BIOsoft-HL7] ...` en consola.

## Archivos

**Puerto serial / ASTM E1394:**
- `astm.js` — protocolo ASTM E1394 de bajo nivel (framing, checksum,
  ENQ/ACK/NAK/EOT). Genérico, válido para cualquier equipo serial.
- `capturar.js` — herramienta de solo captura (Paso 0), sin necesitar
  usuario/clave de BIOsoft.
- `mindray-bc10-map.js` — mapeo de un solo panel (Mindray BC-10,
  hematología) a códigos de BIOsoft (⚠️ plantilla de mejor esfuerzo, ver
  limitaciones arriba).
- `mapeo-generico-template.js` — plantilla para el mapeo de un equipo de
  UN SOLO panel (ej. otro hematológico), sin códigos inventados.
- `mapeo-generico-multiexamen-template.js` — plantilla para un equipo que
  reporta VARIOS exámenes distintos por mensaje (ej. química) — ver
  "Mapeo multi-examen" arriba.
- `index.js` — punto de entrada: abre el puerto serial y conecta todo lo
  anterior. Se ajusta según qué archivo de mapeo uses (`archivoMapeo` en
  `config.json`).

**Red / ASTM sobre TCP:**
- `capturar-tcp.js` — herramienta de solo captura (Paso 0) para equipos de
  red que hablan ASTM, en modo servidor o cliente (ver "Modo servidor vs.
  modo cliente" arriba).
- `index-tcp.js` — punto de entrada de producción para estos equipos:
  reutiliza exactamente la misma lógica de mapeo/deduplicación/escritura
  en Firestore que `index.js` (se la pide con `require`, no la duplica),
  solo cambia el transporte (socket TCP en vez de puerto serial). Soporta
  `"modo": "servidor"` (por defecto) o `"modo": "cliente"` + `"ipEquipo"`,
  con reintento automático cada 10s si la conexión se cae en modo cliente.

**Red / HL7 sobre TCP:**
- `capturar-hl7.js` — herramienta de solo captura (Paso 0) para equipos de
  red, sin necesitar usuario/clave de BIOsoft. Soporta modo servidor o
  cliente.
- `mindray-bs220-hl7-map.js` — mapeo multi-examen del Mindray BS-220
  (química) a códigos de BIOsoft, usando los códigos LIS que se le piden
  al cliente escribir en "Correspondencia de test" en el equipo (ver
  "Mindray BS-220" arriba).
- `mapeo-generico-hl7-template.js` — plantilla para un equipo HL7 de UN
  SOLO panel (ej. Dymind DF52, Mindray BC-760, hematología).
- `mapeo-generico-hl7-multiexamen-template.js` — plantilla para un equipo
  HL7 que reporta VARIOS exámenes distintos por mensaje (ej. otra química).
- `index-hl7.js` — punto de entrada para equipos de red: por defecto
  escucha por TCP (modo servidor, el equipo se conecta como cliente);
  soporta también `"modo": "cliente"` + `"ipEquipo"` para equipos que son
  ELLOS el servidor (ej. Mindray BC-760 — ver más arriba), con reintento
  automático cada 10s si la conexión se cae. Se ajusta según qué archivo
  de mapeo uses (`archivoMapeo` en `config-hl7.json`/`config-bs220.json`).

**Comunes a ambos:**
- `firestore-writer.js` — autenticación y escritura en Firestore,
  replicando el contrato de `store.js`. Genérico, no cambia por equipo ni
  por protocolo.
- `test/` — pruebas automáticas con datos sintéticos (no capturados de
  ningún equipo real), incluyendo la agrupación multi-examen
  (`agrupacion-multiexamen.test.js`) y el mapeo del BS-220
  (`mindray-bs220-hl7-map.test.js`).

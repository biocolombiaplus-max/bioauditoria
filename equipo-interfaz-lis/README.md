# Interfaz BIOsoft ↔ Equipos de Laboratorio (Módulo LIS)

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
- La escritura en BIOsoft/Firestore replica exactamente el mismo contrato
  de datos que usa la app web (`biosoft/js/store.js::recibirResultadoEquipo`):
  nunca deja un resultado como "preliminar" ni "validado" automáticamente,
  siempre como borrador (`en_proceso`), pendiente de que un bacteriólogo
  lo revise y confirme desde BIOsoft. Esto es intencional y **no debe
  cambiarse** — un dato mal recibido no debe poder llegarle a un paciente
  sin que una persona lo haya visto. Esto tampoco cambia según el equipo.

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

## Instalación

1. **En BIOsoft:** Configuración del Laboratorio → "Equipos Conectados" →
   "Conectar un Equipo". Escribe la marca/modelo real (ej. "Dirui CS-T240",
   "Dymind DF52", "Maglumi 800", "Rayto RT-XXXX", "Mindray BS-XXX"). Anota
   el `tenantId` y el `examId` que te muestra.
2. **En BIOsoft:** Usuarios del Laboratorio → Nuevo Usuario → rol
   Bacteriólogo(a), asignado **solo** a la sección correspondiente (ej.
   Hematología o Química). Este usuario es exclusivamente para el
   middleware, no para una persona.
3. En esta carpeta:
   ```
   npm install
   cp config.example.json config.json
   ```
   Completa `config.json` con los datos de los pasos 1 y 2, y el puerto
   serial donde está conectado el equipo.
4. **Si tu equipo es un Mindray BC-10:** ya tienes un mapeo de referencia
   (`mindray-bc10-map.js`) — aún así, valida el punto 1 de la sección de
   arriba antes de confiar en él.
   **Si tu equipo es otra marca** (Dirui, Dymind, Maglumi, Rayto, Mindray
   química, u otra): copia `mapeo-generico-template.js` a un archivo nuevo
   (ej. `dirui-cst240-map.js`), llena los códigos reales de esa marca
   siguiendo las instrucciones del propio archivo, y apunta `index.js` a
   ese mapeo en vez de `mindray-bc10-map.js`.
5. `npm test` — confirma que el parser ASTM y el mapeo de ejemplo pasan
   las pruebas automáticas (esto no requiere ningún equipo conectado).
6. `npm start` — deja el middleware corriendo, escuchando el puerto
   serial. Corre una muestra de control en el equipo real y observa la
   consola con `verboso: true`.

## Archivos

- `astm.js` — protocolo ASTM E1394 de bajo nivel (framing, checksum,
  ENQ/ACK/NAK/EOT). Genérico, válido para cualquier equipo de la lista.
- `mindray-bc10-map.js` — mapeo de parámetros del Mindray BC-10 a códigos
  de BIOsoft (⚠️ plantilla de mejor esfuerzo, ver limitaciones arriba).
- `mapeo-generico-template.js` — plantilla comentada para construir el
  mapeo de cualquier OTRA marca/modelo, sin códigos inventados.
- `firestore-writer.js` — autenticación y escritura en Firestore,
  replicando el contrato de `store.js`. Genérico, no cambia por equipo.
- `index.js` — punto de entrada: abre el puerto serial y conecta todo lo
  anterior. Se ajusta según qué archivo de mapeo uses (paso 4 arriba).
- `test/` — pruebas automáticas con datos sintéticos (no capturados de
  ningún equipo real).

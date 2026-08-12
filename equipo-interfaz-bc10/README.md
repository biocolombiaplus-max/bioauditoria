# Interfaz BIOsoft ↔ Mindray BC-10

Middleware de referencia que conecta un analizador de hematología Mindray
BC-10 (u otro equipo que hable ASTM E1394 por puerto serial) directamente
con BIOsoft, para que los resultados lleguen automáticamente en vez de
digitarse a mano.

## ⚠️ Estado del proyecto: piloto, no producción

Este código se construyó **sin acceso a un equipo BC-10 físico**. Antes de
usarlo con pacientes reales, es indispensable un piloto de validación.
Aquí está exactamente qué sí y qué no está probado:

### ✅ Validado (con pruebas automáticas, `npm test`)
- El protocolo de bajo nivel ASTM E1394 (handshake ENQ/ACK/NAK/EOT, armado
  y verificación de checksum, reensamblado de tramas) — es el estándar de
  la industria, no algo específico de Mindray. Probado incluso con el
  peor caso: datos llegando **1 byte a la vez** (fragmentación extrema de
  puerto serial), y con un checksum corrupto a propósito para confirmar
  que se detecta y se pide reenvío (NAK).
- La escritura en BIOsoft/Firestore replica exactamente el mismo contrato
  de datos que usa la app web (`biosoft/js/store.js::recibirResultadoEquipo`):
  nunca deja un resultado como "preliminar" ni "validado" automáticamente,
  siempre como borrador (`en_proceso`), pendiente de que un bacteriólogo
  lo revise y confirme desde BIOsoft. Esto es intencional y **no debe
  cambiarse** — un dato mal recibido no debe poder llegarle a un paciente
  sin que una persona lo haya visto.

### ❌ NO validado — requiere el equipo real
1. **Formato exacto de los mensajes del BC-10.** Este middleware asume el
   layout de registros que describe el estándar ASTM (H/P/O/R/L con campos
   `|`-delimitados), pero cada fabricante tiene pequeñas variaciones.
   **Antes de usarlo en serio:** enciende el equipo con `verboso: true`
   en `config.json`, corre una muestra de control, y compara los mensajes
   que aparecen en consola contra lo que `astm.js` espera.
2. **Los códigos de cada parámetro** (`mindray-bc10-map.js`). Los nombres
   de campo (`^^^WBC`, `^^^HGB`, etc.) son genéricos de la industria — hay
   que confirmarlos contra los mensajes reales del punto 1 y ajustar el
   mapa si difieren.
3. **El BC-10 es un analizador de 3 poblaciones**, no de 5. Reporta
   linfocitos y granulocitos agrupados, pero **no mide monocitos,
   eosinófilos ni basófilos por separado** — esos parámetros del hemograma
   de BIOsoft quedarán vacíos y se siguen digitando a mano si el
   laboratorio los necesita (extendido de sangre periférica). Esto no es
   una limitación del middleware: es una limitación real del equipo.
4. **Puerto/velocidad exactos** (`puertoSerial`, `baudRate` en `config.json`)
   — depende de cómo esté configurada la comunicación en el menú del BC-10.
5. **Cómo llega el número de orden al equipo.** El middleware asume que el
   "Sample ID" que transmite el BC-10 es el mismo número de orden que
   BIOsoft ya imprime en el sticker de la muestra — es decir, que el
   operador escanea o digita ese mismo número en el equipo antes de
   procesar la muestra. Si tu flujo de trabajo es distinto, hay que
   ajustar `extraerNumeroOrden()` en `index.js`.

**En resumen: no le digas a un cliente "conecta y ya" hasta correr el
punto 1 con su equipo real y confirmar que los números que llegan a
BIOsoft coinciden con lo que el equipo mostró en su propia pantalla.**

## Cómo funciona (arquitectura)

```
Mindray BC-10  --(cable serial, protocolo ASTM E1394)-->  Esta computadora
                                                             (este middleware)
                                                                  |
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

## Instalación

1. **En BIOsoft:** Configuración del Laboratorio → "Equipos Conectados" →
   "Conectar un Equipo". Anota el `tenantId` y el `examId` que te muestra.
2. **En BIOsoft:** Usuarios del Laboratorio → Nuevo Usuario → rol
   Bacteriólogo(a), asignado **solo** a la sección correspondiente (ej.
   Hematología). Este usuario es exclusivamente para el middleware, no
   para una persona.
3. En esta carpeta:
   ```
   npm install
   cp config.example.json config.json
   ```
   Completa `config.json` con los datos de los pasos 1 y 2, y el puerto
   serial donde está conectado el equipo.
4. `npm test` — confirma que el parser ASTM y el mapeo pasan las pruebas
   automáticas (esto no requiere el equipo conectado).
5. `npm start` — deja el middleware corriendo, escuchando el puerto
   serial. Corre una muestra de control en el BC-10 y observa la consola.

## Archivos

- `astm.js` — protocolo ASTM E1394 de bajo nivel (framing, checksum, ENQ/ACK/NAK/EOT).
- `mindray-bc10-map.js` — mapeo de parámetros del equipo a códigos de BIOsoft (⚠️ plantilla, ver arriba).
- `firestore-writer.js` — autenticación y escritura en Firestore, replicando el contrato de `store.js`.
- `index.js` — punto de entrada: abre el puerto serial y conecta todo lo anterior.
- `test/` — pruebas automáticas con datos sintéticos (no capturados del equipo real).

/* Interfaz BIOsoft <-> equipo de laboratorio (módulo LIS) — punto de
 * entrada del middleware. Sirve para cualquier analizador que hable ASTM
 * E1394 (Mindray, Dirui, Dymind, Maglumi, Rayto, u otro compatible) — lo
 * único que cambia de un equipo a otro es el archivo de mapeo de
 * parámetros (ver "archivoMapeo" en config.json).
 *
 * Flujo: abre el puerto serial donde está conectado el equipo -> reensambla
 * los mensajes ASTM que transmite -> extrae el número de orden (el mismo
 * que el sticker/código de barras que imprime BIOsoft, escaneado como
 * "Sample ID" en el equipo) -> mapea los resultados a los códigos de
 * BIOsoft -> los escribe en Firestore como borrador, listos para que un
 * bacteriólogo los revise y valide desde BIOsoft.
 *
 * ⚠️ Antes de usarlo con pacientes reales, lee README.md — hay pasos de
 * validación con el equipo físico que este archivo NO puede garantizar
 * por sí solo (código exacto del "Sample ID", baudrate real, mapeo de
 * parámetros real del equipo, etc.), y son distintos para cada marca.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");
const astm = require("./astm");
const { crearClienteBiosoft, iniciarSesion, recibirResultadoEquipo } = require("./firestore-writer");

/* El nombre del archivo de configuración se puede pasar como argumento,
 * para poder tener un archivo por equipo (ej. config-dirui.json,
 * config-maglumi.json) y correr varios middlewares al mismo tiempo, cada
 * uno en su propia terminal, sin que se pisen entre sí:
 *   node index.js config-dirui.json
 * Si no se pasa nada, usa "config.json" (comportamiento de antes). */
function cargarConfig() {
  const nombreArchivo = process.argv[2] || "config.json";
  const configPath = path.join(__dirname, nombreArchivo);
  if (!fs.existsSync(configPath)) {
    console.error(`No existe ${nombreArchivo}. Copia config.example.json a ese nombre y complétalo con tus datos (ver README.md).`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

/* Qué archivo de mapeo usar depende del equipo real que se esté
 * conectando (ver "archivoMapeo" en config.json). Por defecto usa el
 * único mapeo ya construido (Mindray BC-10) — para cualquier otra marca
 * (Dirui, Dymind, Maglumi, Rayto, Mindray química, etc.) hay que crear su
 * propio archivo a partir de mapeo-generico-template.js y apuntar aquí. */
function cargarMapeo(config) {
  const nombreArchivo = config.archivoMapeo || "mindray-bc10-map";
  return require("./" + nombreArchivo);
}

/** El "Sample ID" suele venir en el registro O (orden), campo 3 (índice 2:
 * O|seq|SampleID|...). Si tu BC-10 lo pone en otro campo, ajusta aquí —
 * es justamente el tipo de detalle que hay que confirmar con el equipo
 * real (ver README). */
function extraerNumeroOrden(registros) {
  const o = registros.find((r) => r.tipo === "O");
  if (!o) return null;
  return (o.campos[2] || "").trim() || null;
}

/* Un mapeo "clásico" de un solo panel por archivo (ej. mindray-bc10-map.js:
 * TODO el hemograma es un único examen de BIOsoft, HEM-001) devuelve
 * {valores, ignorados} y expone mapeo.EXAM_ID_BIOSOFT — sirve para
 * cualquier equipo donde el equipo físico y el examId de BIOsoft son 1 a 1.
 *
 * Un analizador de QUÍMICA (ej. Mindray BS-220) no encaja en ese molde: un
 * solo mensaje del equipo puede traer resultados de VARIOS parámetros (ej.
 * Glucosa, Colesterol, Creatinina) y CADA UNO es un examen SEPARADO en el
 * catálogo de BIOsoft (a diferencia del hemograma, que es un único examen
 * con varios parámetros adentro) — ver catalog.js, sección "quimica": cada
 * QUI-XXX es su propio examen. Para estos casos, el mapeo devuelve en su
 * lugar {porExamen: {examId: {codigo: valor, ...}, ...}, ignorados} (ver
 * mapeo-generico-multiexamen-template.js) y esta función escribe UNA
 * actualización de Firestore POR CADA examId presente en el mensaje, en
 * vez de una sola con mapeo.EXAM_ID_BIOSOFT fijo.
 *
 * agruparPorExamen() normaliza ambas formas a un solo objeto
 * {examId: {codigo: valor}} para que procesarMensaje() no tenga que saber
 * cuál de los dos estilos de mapeo está usando — así un mapeo clásico
 * (BC-10) sigue funcionando exactamente igual que antes, sin tocarlo. */
function agruparPorExamen(resultadoMapeo, examIdLegacy) {
  if (resultadoMapeo.porExamen) return resultadoMapeo.porExamen;
  if (!examIdLegacy) return {};
  return { [examIdLegacy]: resultadoMapeo.valores || {} };
}

async function procesarMensaje(config, mapeo, db, registros) {
  const numeroOrden = extraerNumeroOrden(registros);
  if (!numeroOrden) {
    console.warn("[BIOsoft-LIS] Mensaje recibido sin Sample ID/número de orden reconocible — se ignora. Registros:", JSON.stringify(registros));
    return;
  }
  const registrosR = registros.filter((r) => r.tipo === "R");
  const resultadoMapeo = mapeo.mapearResultados(registrosR);
  const ignorados = resultadoMapeo.ignorados || [];
  if (ignorados.length) {
    console.warn(`[BIOsoft-LIS] Orden ${numeroOrden}: ${ignorados.length} campo(s) del equipo no reconocido(s), se ignoraron:`, ignorados.join(", "));
  }

  const porExamen = agruparPorExamen(resultadoMapeo, mapeo.EXAM_ID_BIOSOFT);
  const examIds = Object.keys(porExamen).filter((examId) => Object.keys(porExamen[examId] || {}).length);
  if (!examIds.length) {
    console.warn(`[BIOsoft-LIS] Orden ${numeroOrden}: no se reconoció ningún valor mapeable — no se escribe nada.`);
    return;
  }

  for (const examId of examIds) {
    const valores = porExamen[examId];
    console.log(`[BIOsoft-LIS] Orden ${numeroOrden}, examen ${examId}: enviando ${Object.keys(valores).length} valor(es) a BIOsoft ->`, valores);
    const resultado = await recibirResultadoEquipo(db, {
      tenantId: config.tenantId, numeroOrden, examId, valoresPorCodigo: valores, equipoNombre: config.nombreEquipo
    });
    if (resultado.ok) console.log(`[BIOsoft-LIS] Orden ${numeroOrden}, examen ${examId}: guardado como borrador en BIOsoft. Pendiente de revisión por un bacteriólogo.`);
    else console.error(`[BIOsoft-LIS] Orden ${numeroOrden}, examen ${examId}: NO se pudo guardar -> ${resultado.error}`);
  }
}

async function main() {
  const config = cargarConfig();
  const mapeo = cargarMapeo(config);
  console.log(`[BIOsoft-LIS] Usando mapeo de parámetros: ${config.archivoMapeo || "mindray-bc10-map"}`);

  console.log("[BIOsoft-LIS] Conectando con BIOsoft...");
  const { auth, db } = crearClienteBiosoft();
  await iniciarSesion(auth, config.usuarioEmail, config.usuarioPassword);
  console.log("[BIOsoft-LIS] Sesión iniciada como", config.usuarioEmail);

  console.log(`[BIOsoft-LIS] Abriendo puerto serial ${config.puertoSerial} (${config.baudRate} baudios${config.rtscts ? ", RTS/CTS activado" : ""})...`);
  const port = new SerialPort({ path: config.puertoSerial, baudRate: config.baudRate || 9600, dataBits: 8, parity: "none", stopBits: 1, rtscts: !!config.rtscts });

  const receiver = astm.createReceiver({
    onControl: (byte) => port.write(Buffer.from([byte])),
    onFrame: (f) => { if (config.verboso) console.log("[BIOsoft-LIS] Trama recibida:", f.frameNumber, JSON.stringify(f.texto)); },
    onMessage: (registros) => {
      procesarMensaje(config, mapeo, db, registros).catch((e) => console.error("[BIOsoft-LIS] Error procesando mensaje:", e));
    },
    onError: (e) => console.error("[BIOsoft-LIS] Error de protocolo:", e.message)
  });

  port.on("data", (chunk) => receiver.feed(chunk));
  port.on("error", (e) => console.error("[BIOsoft-LIS] Error de puerto serial:", e.message));
  port.on("open", () => console.log("[BIOsoft-LIS] Puerto serial abierto. Esperando transmisiones del equipo..."));
}

// Solo arranca de verdad (abre puerto serial, inicia sesión en Firebase)
// cuando se ejecuta directamente con "node index.js" — al hacer require()
// desde una prueba automática (ver test/index-agrupacion.test.js) esto se
// salta, para poder probar extraerNumeroOrden()/agruparPorExamen() sin
// necesitar un puerto serial real ni credenciales de BIOsoft.
if (require.main === module) {
  main().catch((e) => {
    console.error("[BIOsoft-LIS] Error fatal al iniciar:", e);
    process.exit(1);
  });
}

module.exports = { extraerNumeroOrden, agruparPorExamen, procesarMensaje, cargarMapeo };

/* Interfaz BIOsoft <-> Mindray BC-10 — punto de entrada del middleware.
 *
 * Flujo: abre el puerto serial donde está conectado el BC-10 -> reensambla
 * los mensajes ASTM que transmite -> extrae el número de orden (el mismo
 * que el sticker/código de barras que imprime BIOsoft, escaneado como
 * "Sample ID" en el equipo) -> mapea los resultados a los códigos de
 * BIOsoft -> los escribe en Firestore como borrador, listos para que un
 * bacteriólogo los revise y valide desde BIOsoft.
 *
 * ⚠️ Antes de usarlo con pacientes reales, lee README.md — hay pasos de
 * validación con el equipo físico que este archivo NO puede garantizar
 * por sí solo (código exacto del "Sample ID", baudrate real, etc.).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");
const astm = require("./astm");
const { EXAM_ID_BIOSOFT, mapearResultados } = require("./mindray-bc10-map");
const { crearClienteBiosoft, iniciarSesion, recibirResultadoEquipo } = require("./firestore-writer");

function cargarConfig() {
  const configPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error('No existe config.json. Copia config.example.json a config.json y complétalo con tus datos (ver README.md).');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
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

async function procesarMensaje(config, db, registros) {
  const numeroOrden = extraerNumeroOrden(registros);
  if (!numeroOrden) {
    console.warn("[BIOsoft-BC10] Mensaje recibido sin Sample ID/número de orden reconocible — se ignora. Registros:", JSON.stringify(registros));
    return;
  }
  const registrosR = registros.filter((r) => r.tipo === "R");
  const { valores, ignorados } = mapearResultados(registrosR);
  if (ignorados.length) {
    console.warn(`[BIOsoft-BC10] Orden ${numeroOrden}: ${ignorados.length} campo(s) del equipo no reconocido(s), se ignoraron:`, ignorados.join(", "));
  }
  if (!Object.keys(valores).length) {
    console.warn(`[BIOsoft-BC10] Orden ${numeroOrden}: no se reconoció ningún valor mapeable — no se escribe nada.`);
    return;
  }

  console.log(`[BIOsoft-BC10] Orden ${numeroOrden}: enviando ${Object.keys(valores).length} valor(es) a BIOsoft ->`, valores);
  const resultado = await recibirResultadoEquipo(db, {
    tenantId: config.tenantId, numeroOrden, examId: EXAM_ID_BIOSOFT,
    valoresPorCodigo: valores, equipoNombre: config.nombreEquipo
  });
  if (resultado.ok) console.log(`[BIOsoft-BC10] Orden ${numeroOrden}: guardado como borrador en BIOsoft. Pendiente de revisión por un bacteriólogo.`);
  else console.error(`[BIOsoft-BC10] Orden ${numeroOrden}: NO se pudo guardar -> ${resultado.error}`);
}

async function main() {
  const config = cargarConfig();

  console.log("[BIOsoft-BC10] Conectando con BIOsoft...");
  const { auth, db } = crearClienteBiosoft();
  await iniciarSesion(auth, config.usuarioEmail, config.usuarioPassword);
  console.log("[BIOsoft-BC10] Sesión iniciada como", config.usuarioEmail);

  console.log(`[BIOsoft-BC10] Abriendo puerto serial ${config.puertoSerial} (${config.baudRate} baudios)...`);
  const port = new SerialPort({ path: config.puertoSerial, baudRate: config.baudRate || 9600, dataBits: 8, parity: "none", stopBits: 1 });

  const receiver = astm.createReceiver({
    onControl: (byte) => port.write(Buffer.from([byte])),
    onFrame: (f) => { if (config.verboso) console.log("[BIOsoft-BC10] Trama recibida:", f.frameNumber, JSON.stringify(f.texto)); },
    onMessage: (registros) => {
      procesarMensaje(config, db, registros).catch((e) => console.error("[BIOsoft-BC10] Error procesando mensaje:", e));
    },
    onError: (e) => console.error("[BIOsoft-BC10] Error de protocolo:", e.message)
  });

  port.on("data", (chunk) => receiver.feed(chunk));
  port.on("error", (e) => console.error("[BIOsoft-BC10] Error de puerto serial:", e.message));
  port.on("open", () => console.log("[BIOsoft-BC10] Puerto serial abierto. Esperando transmisiones del equipo..."));
}

main().catch((e) => {
  console.error("[BIOsoft-BC10] Error fatal al iniciar:", e);
  process.exit(1);
});

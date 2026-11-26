/* Interfaz BIOsoft <-> equipo de laboratorio que habla ASTM E1394 por RED
 * (TCP/Ethernet) en vez de cable serial — hermano de index.js (serial) e
 * index-hl7.js (HL7/MLLP). Reutiliza EXACTAMENTE la misma lógica de
 * mapeo/deduplicación/escritura en Firestore que index.js (se la pide con
 * require("./index.js") en vez de copiarla) — lo único que cambia es el
 * transporte: un socket TCP en vez de un SerialPort. astm.js (el parser de
 * bajo nivel) es el mismo para los dos, ya que el protocolo ASTM es
 * idéntico, solo cambia por dónde viajan los bytes.
 *
 * Dos modos de conexión, igual que capturar-tcp.js (úsalo primero, sin
 * credenciales de BIOsoft, para confirmar cuál modo usa tu equipo real):
 *   - "servidor" (config.modo = "servidor", el más común): esta
 *     computadora escucha, el equipo se conecta a ella — confirmado así,
 *     por ejemplo, en un analizador de química "Total Care 200" (pantalla
 *     Procesamiento de datos -> Exportar datos -> Modo TCP/IP, con campos
 *     "Servidor IP" y "Puerto": el EQUIPO es el que inicia la conexión
 *     hacia esa IP/puerto, nunca al revés).
 *   - "cliente" (config.modo = "cliente", + config.ipEquipo): esta
 *     computadora se conecta HACIA el equipo (su propia IP fija).
 *
 * ⚠️ Antes de usarlo con pacientes reales, lee README.md.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const net = require("net");
const astm = require("./astm");
const { extraerNumeroOrden, agruparPorExamen, procesarMensaje, cargarMapeo } = require("./index.js");
const { crearClienteBiosoft, iniciarSesion } = require("./firestore-writer");

function cargarConfig() {
  const nombreArchivo = process.argv[2] || "config-tcp.json";
  const configPath = path.join(__dirname, nombreArchivo);
  if (!fs.existsSync(configPath)) {
    console.error(`No existe ${nombreArchivo}. Copia config-tcp.example.json a ese nombre y complétalo con tus datos (ver README.md).`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function wireSocket(config, mapeo, db, socket, etiqueta) {
  const receiver = astm.createReceiver({
    onControl: (byte) => socket.write(Buffer.from([byte])),
    onFrame: (f) => { if (config.verboso) console.log(`[BIOsoft-LIS-TCP][${etiqueta}] Trama recibida:`, f.frameNumber, JSON.stringify(f.texto)); },
    onMessage: (registros) => {
      procesarMensaje(config, mapeo, db, registros).catch((e) => console.error("[BIOsoft-LIS-TCP] Error procesando mensaje:", e));
    },
    onError: (e) => console.error(`[BIOsoft-LIS-TCP][${etiqueta}] Error de protocolo:`, e.message)
  });
  socket.on("data", (chunk) => receiver.feed(chunk));
  socket.on("error", (e) => console.error(`[BIOsoft-LIS-TCP][${etiqueta}] Error de socket:`, e.message));
  socket.on("close", () => console.log(`[BIOsoft-LIS-TCP][${etiqueta}] Conexión cerrada.`));
}

/* Mismo razonamiento que abrirConexion() en index-hl7.js: en modo
 * servidor, el equipo vuelve a conectarse solo cuando quiera; en modo
 * cliente, si la conexión se cae (reinicio del equipo, corte de red), hay
 * que reintentar NOSOTROS, o el middleware queda corriendo pero sordo. */
function abrirConexion(config, onSocket) {
  const puerto = config.puerto || 5000;
  if (config.modo === "cliente") {
    if (!config.ipEquipo) { console.error('[BIOsoft-LIS-TCP] config.modo es "cliente" pero falta "ipEquipo" en la configuración.'); process.exit(1); }
    console.log(`[BIOsoft-LIS-TCP] Modo cliente: conectando a ${config.ipEquipo}:${puerto}...`);
    const socket = net.createConnection({ host: config.ipEquipo, port: puerto }, () => {
      console.log(`[BIOsoft-LIS-TCP] Conectado a ${config.ipEquipo}:${puerto}. Esperando transmisiones del equipo...`);
    });
    onSocket(socket, "Cliente");
    socket.on("error", (e) => console.error(`[BIOsoft-LIS-TCP] No se pudo conectar a ${config.ipEquipo}:${puerto} -> ${e.message}`));
    socket.on("close", () => {
      console.warn("[BIOsoft-LIS-TCP] Conexión con el equipo cerrada — reintentando en 10 segundos...");
      setTimeout(() => abrirConexion(config, onSocket), 10000);
    });
  } else {
    const server = net.createServer((socket) => {
      console.log(`[BIOsoft-LIS-TCP] Equipo conectado desde ${socket.remoteAddress}:${socket.remotePort}`);
      onSocket(socket, `Servidor:${puerto}`);
    });
    server.listen(puerto, () => {
      console.log(`[BIOsoft-LIS-TCP] Escuchando en el puerto ${puerto}. Configura esta IP y este puerto como "Servidor IP"/"Puerto" en el equipo.`);
    });
    server.on("error", (e) => console.error("[BIOsoft-LIS-TCP] Error al escuchar:", e.message));
  }
}

async function main() {
  const config = cargarConfig();
  const mapeo = cargarMapeo(config);
  console.log(`[BIOsoft-LIS-TCP] Usando mapeo de parámetros: ${config.archivoMapeo || "mindray-bc10-map"}`);
  console.log(`[BIOsoft-LIS-TCP] Modo de conexión: ${config.modo === "cliente" ? "cliente (nos conectamos al equipo)" : "servidor (el equipo se conecta a nosotros)"}`);

  console.log("[BIOsoft-LIS-TCP] Conectando con BIOsoft...");
  const { auth, db } = crearClienteBiosoft();
  await iniciarSesion(auth, config.usuarioEmail, config.usuarioPassword);
  console.log("[BIOsoft-LIS-TCP] Sesión iniciada como", config.usuarioEmail);

  abrirConexion(config, (socket, etiqueta) => wireSocket(config, mapeo, db, socket, etiqueta));
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[BIOsoft-LIS-TCP] Error fatal al iniciar:", e);
    process.exit(1);
  });
}

module.exports = { extraerNumeroOrden, agruparPorExamen, procesarMensaje, cargarMapeo };

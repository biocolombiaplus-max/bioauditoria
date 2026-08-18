/* BIOsoft — Herramienta de SOLO CAPTURA para equipos que hablan HL7 (en vez
 * de ASTM E1394) sobre TCP/IP — construida específicamente porque la
 * documentación pública de los analizadores de hematología Dymind (familia
 * DF5x/DH5x) indica que usan HL7 v2.3.1 sobre una conexión TCP persistente,
 * NO el protocolo ASTM que usan capturar.js / capturar-tcp.js.
 *
 * ⚠️ Esto se construyó a partir de documentación PÚBLICA sobre el protocolo
 * HL7 de equipos Dymind en general, encontrada por internet — NO se probó
 * contra un Dymind DF52 físico. El framing MLLP (VT ... FS CR) y la
 * estructura de segmentos HL7 (MSH|PID|OBR|OBX) son el estándar genérico
 * de la industria, pero los campos exactos que use tu equipo hay que
 * confirmarlos con la captura real, igual que con ASTM.
 *
 * Uso (dos modos, prueba primero "servidor" — es lo más común para HL7,
 * el equipo se conecta a un "servidor LIS" configurado con tu IP):
 *   node capturar-hl7.js servidor 5001
 *   node capturar-hl7.js cliente <ip-del-equipo> <puerto>
 *
 * Responde automáticamente con un ACK genérico de HL7 (MSA|AA) — varios
 * equipos esperan esa confirmación antes de seguir enviando o de marcar el
 * envío como exitoso en su propia pantalla.
 */
"use strict";
const net = require("net");
const fs = require("fs");
const path = require("path");

const VT = 0x0b, FS = 0x1c, CR = 0x0d;

const modo = process.argv[2];
const nombreArchivoLog = "captura_hl7_" + new Date().toISOString().replace(/[:.]/g, "-") + ".log";
const rutaLog = path.join(__dirname, nombreArchivoLog);
const streamLog = fs.createWriteStream(rutaLog, { flags: "a" });

function log(linea) {
  console.log(linea);
  streamLog.write(linea + "\n");
}

function ipsLocales() {
  const os = require("os");
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.values(ifaces).forEach((lista) => {
    (lista || []).forEach((i) => { if (i.family === "IPv4" && !i.internal) ips.push(i.address); });
  });
  return ips;
}

/** Arma el ACK genérico de HL7 (MSA|AA = "Application Accept"), envuelto
 * en el mismo framing MLLP que usa el mensaje original. controlId es el
 * MSH-10 (ID de control del mensaje) del mensaje que se está confirmando. */
function construirACK(controlIdOriginal) {
  const ahora = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const msh = `MSH|^~\\&|BIOSOFT|BIOSOFT|||${ahora}||ACK|ACK${Date.now()}|P|2.3.1`;
  const msa = `MSA|AA|${controlIdOriginal || ""}`;
  const cuerpo = [msh, msa].join(String.fromCharCode(CR));
  return Buffer.concat([Buffer.from([VT]), Buffer.from(cuerpo, "utf8"), Buffer.from([FS, CR])]);
}

/** Receptor con buffer interno para el framing MLLP: VT <mensaje> FS CR.
 * Igual de tolerante a fragmentación que el receptor ASTM (astm.js). */
function crearReceptorHL7(onMensaje) {
  let buffer = Buffer.alloc(0);
  function feed(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const inicio = buffer.indexOf(VT);
      if (inicio === -1) { if (buffer.length > 0) buffer = Buffer.alloc(0); return; }
      const finFS = buffer.indexOf(FS, inicio);
      if (finFS === -1) return; // mensaje incompleto todavía, espera más bytes
      const texto = buffer.slice(inicio + 1, finFS).toString("utf8");
      buffer = buffer.slice(finFS + 2); // salta FS + CR
      onMensaje(texto);
    }
  }
  return { feed };
}

function wireReceiver(socket, etiqueta) {
  let mensajesRecibidos = 0;
  const receptor = crearReceptorHL7((texto) => {
    mensajesRecibidos++;
    const segmentos = texto.split(/[\r\n]+/).filter(Boolean);
    log(`\n========== MENSAJE HL7 COMPLETO #${mensajesRecibidos} ==========`);
    let controlId = "";
    segmentos.forEach((seg) => {
      const campos = seg.split("|");
      log(`  [${campos[0]}] ${campos.join(" | ")}`);
      if (campos[0] === "MSH" && campos[9]) controlId = campos[9];
    });
    log("=========================================\n");
    log(">> Si esto se ve parecido a segmentos con datos del paciente (PID) y resultados (OBX), ¡la conexión funciona! Guarda este .log y compártelo.\n");
    socket.write(construirACK(controlId));
    log(`[${etiqueta}] ACK enviado de vuelta al equipo (confirmación de recepción).`);
  });
  socket.on("data", (chunk) => {
    log(`[${etiqueta}][Bytes crudos] ${chunk.length} byte(s): ${chunk.toString("hex")}`);
    receptor.feed(chunk);
  });
  socket.on("error", (e) => log(`[${etiqueta}] ERROR de socket: ${e.message}`));
  socket.on("close", () => log(`[${etiqueta}] Conexión cerrada por el otro lado.`));
}

if (modo === "servidor") {
  // Igual que capturar-tcp.js: acepta uno o varios puertos separados por
  // coma, para escuchar en varios a la vez si no sabes cuál usa el equipo.
  const puertos = (process.argv[3] || "5001").split(",").map((p) => parseInt(p.trim(), 10)).filter(Boolean);
  puertos.forEach((puerto) => {
    const server = net.createServer((socket) => {
      log(`[Captura HL7] Equipo conectado desde ${socket.remoteAddress}:${socket.remotePort} (puerto local ${puerto})`);
      wireReceiver(socket, `Servidor:${puerto}`);
    });
    server.listen(puerto, () => log(`[Captura HL7] Escuchando en el puerto ${puerto}.`));
    server.on("error", (e) => log(`[Captura HL7] ERROR al escuchar en ${puerto}: ${e.message} (¿otro programa ya está usando ese puerto?)`));
  });
  log(`[Captura HL7] IP(s) de esta computadora, para configurar en el equipo: ${ipsLocales().join(", ") || "(no se detectó ninguna red activa)"}`);
  log(`[Captura HL7] Puerto(s) escuchando: ${puertos.join(", ")}. Configura esa IP y CUALQUIERA de esos puertos como "servidor LIS"/"Host" en el equipo, y corre una muestra.\n`);
} else if (modo === "cliente") {
  const ip = process.argv[3];
  const puerto = parseInt(process.argv[4], 10) || 5001;
  if (!ip) { console.log("Uso: node capturar-hl7.js cliente <ip-del-equipo> <puerto>"); process.exit(1); }
  const socket = net.createConnection({ host: ip, port: puerto }, () => {
    log(`[Captura HL7] Conectado a ${ip}:${puerto}. Ahora corre una muestra en el equipo.\n`);
  });
  wireReceiver(socket, "Cliente");
  socket.on("error", (e) => log(`[Captura HL7] No se pudo conectar a ${ip}:${puerto} -> ${e.message}`));
} else {
  console.log("Uso:");
  console.log("  node capturar-hl7.js servidor [puerto]      (por defecto 5001 — el equipo se conecta a esta computadora, lo más común para HL7)");
  console.log("  node capturar-hl7.js cliente <ip> <puerto>  (esta computadora se conecta al equipo)");
}

process.on("SIGINT", () => {
  log("\n[Captura HL7] Terminado. Revisa/comparte el archivo: " + nombreArchivoLog);
  process.exit(0);
});

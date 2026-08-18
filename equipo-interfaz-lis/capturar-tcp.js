/* BIOsoft — Herramienta de SOLO CAPTURA por RED (TCP/Ethernet), hermana de
 * capturar.js (que es para cable serial/USB-serial). Úsala cuando el
 * equipo se conecta por cable de red (puerto RJ45) en vez de un cable
 * serial (puerto DB9) — algunos equipos más modernos (ej. analizadores de
 * inmunoensayo/quimioluminiscencia) suelen ofrecer esta opción además o
 * en vez de la serial.
 *
 * El protocolo ASTM E1394 (framing, checksum, ENQ/ACK/NAK/EOT) es el mismo
 * que por cable serial — lo único que cambia es el "transporte" (bytes por
 * un socket de red en vez de por un puerto serial). Reutiliza exactamente
 * el mismo astm.js ya probado.
 *
 * ⚠️ No hay una única forma de que un equipo hable por red — depende de
 * cómo lo implementó el fabricante. Prueba los dos modos:
 *
 *   MODO SERVIDOR (lo más común): esta computadora espera la conexión,
 *   el equipo se conecta a ella. Necesitas la IP de esta computadora y
 *   configurarla en el equipo como "IP del LIS/servidor".
 *     node capturar-tcp.js servidor 5000
 *
 *   MODO CLIENTE: el equipo espera conexiones y esta computadora se
 *   conecta a él. Necesitas la IP y el puerto que tenga configurado el
 *   equipo (ver su menú de red).
 *     node capturar-tcp.js cliente 192.168.1.50 5000
 */
"use strict";
const net = require("net");
const fs = require("fs");
const path = require("path");
const astm = require("./astm");

const modo = process.argv[2]; // "servidor" | "cliente"
const nombreArchivoLog = "captura_tcp_" + new Date().toISOString().replace(/[:.]/g, "-") + ".log";
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

function wireReceiver(socket, etiqueta) {
  let mensajesRecibidos = 0;
  const receiver = astm.createReceiver({
    onControl: (byte) => socket.write(Buffer.from([byte])),
    onFrame: (f) => log(`[${etiqueta}][Trama ${f.frameNumber}] ${JSON.stringify(f.texto)}`),
    onMessage: (registros) => {
      mensajesRecibidos++;
      log(`\n========== MENSAJE COMPLETO #${mensajesRecibidos} ==========`);
      registros.forEach((r) => log(`  [${r.tipo}] ${r.campos.join(" | ")}`));
      log("=========================================\n");
      log(">> Si esto se ve parecido a una tabla de resultados (parámetro, valor, unidad), la conexión funciona. Guarda este .log y compártelo.\n");
    },
    onError: (e) => log(`[${etiqueta}] Aviso de protocolo: ${e.message}`)
  });
  socket.on("data", (chunk) => {
    log(`[${etiqueta}][Bytes crudos] ${chunk.length} byte(s): ${chunk.toString("hex")}`);
    receiver.feed(chunk);
  });
  socket.on("error", (e) => log(`[${etiqueta}] ERROR de socket: ${e.message}`));
  socket.on("close", () => log(`[${etiqueta}] Conexión cerrada por el otro lado.`));
}

if (modo === "servidor") {
  const puerto = parseInt(process.argv[3], 10) || 5000;
  const server = net.createServer((socket) => {
    log(`[Captura TCP] Equipo conectado desde ${socket.remoteAddress}:${socket.remotePort}`);
    wireReceiver(socket, "Servidor");
  });
  server.listen(puerto, () => {
    log(`[Captura TCP] Escuchando en el puerto ${puerto}.`);
    log(`[Captura TCP] IP(s) de esta computadora, para configurar en el equipo: ${ipsLocales().join(", ") || "(no se detectó ninguna red activa)"}`);
    log(`[Captura TCP] Ahora configura esa IP y el puerto ${puerto} como "servidor LIS" en el equipo, y corre una muestra.\n`);
  });
  server.on("error", (e) => log(`[Captura TCP] ERROR al escuchar: ${e.message} (¿otro programa ya está usando ese puerto?)`));
} else if (modo === "cliente") {
  const ip = process.argv[3];
  const puerto = parseInt(process.argv[4], 10) || 5000;
  if (!ip) { console.log("Uso: node capturar-tcp.js cliente <ip-del-equipo> <puerto>"); process.exit(1); }
  const socket = net.createConnection({ host: ip, port: puerto }, () => {
    log(`[Captura TCP] Conectado a ${ip}:${puerto}. Ahora corre una muestra en el equipo.\n`);
  });
  wireReceiver(socket, "Cliente");
  socket.on("error", (e) => log(`[Captura TCP] No se pudo conectar a ${ip}:${puerto} -> ${e.message}`));
} else {
  console.log("Uso:");
  console.log("  node capturar-tcp.js servidor [puerto]           (por defecto 5000 — el equipo se conecta a esta computadora)");
  console.log("  node capturar-tcp.js cliente <ip> <puerto>       (esta computadora se conecta al equipo)");
  console.log("\nSi no sabes cuál modo usa tu equipo, prueba primero 'servidor' — es el más común.");
}

process.on("SIGINT", () => {
  log("\n[Captura TCP] Terminado. Revisa/comparte el archivo: " + nombreArchivoLog);
  process.exit(0);
});

/* BIOsoft — Herramienta de SOLO CAPTURA para la primera prueba con un
 * equipo real, en sitio, con el cliente presente.
 *
 * A diferencia de index.js (que ya intenta escribir en BIOsoft), esta
 * herramienta NO necesita usuario/clave de BIOsoft ni conexión a
 * internet — solo abre el puerto serial, escucha lo que transmite el
 * equipo, y muestra/guarda TAL CUAL lo que llega. Es el primer paso
 * honesto: antes de prometer que el dato llega a BIOsoft, hay que
 * confirmar que el equipo transmite algo reconocible.
 *
 * Uso:
 *   node capturar.js                    (lista los puertos disponibles)
 *   node capturar.js COM3               (Windows, 9600 baudios por defecto)
 *   node capturar.js /dev/ttyUSB0 9600  (Linux/Mac, con baudios explícitos)
 */
"use strict";
const { SerialPort } = require("serialport");
const fs = require("fs");
const path = require("path");
const astm = require("./astm");

const puerto = process.argv[2];
const baudRate = parseInt(process.argv[3], 10) || 9600;

const nombreArchivoLog = "captura_" + new Date().toISOString().replace(/[:.]/g, "-") + ".log";
const rutaLog = path.join(__dirname, nombreArchivoLog);
const streamLog = fs.createWriteStream(rutaLog, { flags: "a" });

function log(linea) {
  console.log(linea);
  streamLog.write(linea + "\n");
}

async function listarPuertos() {
  const puertos = await SerialPort.list();
  if (!puertos.length) {
    console.log("\nNo se detectó ningún puerto serial. Revisa que:");
    console.log("  1. El cable del equipo esté conectado a esta computadora.");
    console.log("  2. Si es un cable USB-a-serial, tenga el driver instalado (Windows suele pedirlo la primera vez).");
    console.log("  3. El equipo esté encendido.\n");
    return;
  }
  console.log("\nPuertos seriales disponibles en esta computadora:");
  puertos.forEach((p) => {
    console.log(`  - ${p.path}${p.manufacturer ? "  (" + p.manufacturer + ")" : ""}`);
  });
  console.log("\nEjecuta de nuevo así: node capturar.js " + puertos[0].path + "\n");
}

if (!puerto) {
  listarPuertos();
} else {
  log(`[Captura] Abriendo ${puerto} a ${baudRate} baudios...`);
  log(`[Captura] Todo lo que llegue se guarda también en: ${nombreArchivoLog}`);

  const port = new SerialPort({ path: puerto, baudRate, dataBits: 8, parity: "none", stopBits: 1 });

  let mensajesRecibidos = 0;

  const receiver = astm.createReceiver({
    onControl: (byte) => port.write(Buffer.from([byte])),
    onFrame: (f) => {
      log(`[Trama ${f.frameNumber}] ${JSON.stringify(f.texto)}`);
    },
    onMessage: (registros) => {
      mensajesRecibidos++;
      log(`\n========== MENSAJE COMPLETO #${mensajesRecibidos} ==========`);
      registros.forEach((r) => {
        log(`  [${r.tipo}] ${r.campos.join(" | ")}`);
      });
      log("=========================================\n");
      log(">> Si esto se ve parecido a una tabla de resultados (nombre del parámetro, valor, unidad), ¡vamos muy bien! Guarda este archivo .log y compártelo para construir el mapeo definitivo.\n");
    },
    onError: (e) => {
      log(`[Captura] Aviso de protocolo (puede ser normal si el equipo está a mitad de otra transmisión): ${e.message}`);
    }
  });

  port.on("data", (chunk) => {
    log(`[Bytes crudos] ${chunk.length} byte(s): ${chunk.toString("hex")}`);
    receiver.feed(chunk);
  });

  port.on("error", (e) => {
    log(`[Captura] ERROR de puerto serial: ${e.message}`);
    log("Revisa: ¿el puerto es el correcto? ¿otro programa lo tiene abierto? ¿los baudios coinciden con el equipo?");
  });

  port.on("open", () => {
    log(`[Captura] Puerto abierto correctamente. Esperando transmisión del equipo...`);
    log(`[Captura] Ahora ve al equipo y corre una muestra de control (o cualquier muestra) para que transmita.\n`);
  });

  process.on("SIGINT", () => {
    log(`\n[Captura] Terminado. Total de mensajes completos recibidos: ${mensajesRecibidos}.`);
    log(`[Captura] Revisa/comparte el archivo: ${nombreArchivoLog}`);
    process.exit(0);
  });
}

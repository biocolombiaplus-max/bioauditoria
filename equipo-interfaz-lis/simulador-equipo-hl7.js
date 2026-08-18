/* Simulador de práctica para capturar-hl7.js — datos INVENTADOS, formato
 * genérico HL7 v2.3.1 (ORU^R01, resultado de laboratorio), solo para
 * practicar la herramienta antes de tener el equipo real. */
"use strict";
const net = require("net");

const puerto = parseInt(process.argv[2], 10) || 5001;
const VT = 0x0b, FS = 0x1c, CR = 0x0d;

const ahora = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const segmentos = [
  `MSH|^~\\&|SIMULADOR|LAB|BIOSOFT|LAB|${ahora}||ORU^R01|MSG${Date.now()}|P|2.3.1`,
  "PID|1||PRACTICA-001||PACIENTE^PRUEBA",
  "OBR|1|PRACTICA-001||^^^HEM",
  "OBX|1|NM|WBC^Leucocitos||7.1|10*3/uL|N|||F",
  "OBX|2|NM|HGB^Hemoglobina||14.2|g/dL|N|||F",
  "OBX|3|NM|PLT^Plaquetas||260|10*3/uL|N|||F"
];
const mensaje = segmentos.join(String.fromCharCode(CR));
const trama = Buffer.concat([Buffer.from([VT]), Buffer.from(mensaje, "utf8"), Buffer.from([FS, CR])]);

console.log(`[Simulador HL7] Conectando a localhost:${puerto}...`);
const socket = net.createConnection({ host: "127.0.0.1", port: puerto }, () => {
  console.log("[Simulador HL7] Conectado. Enviando mensaje de práctica...");
  socket.write(trama);
});
socket.on("data", (chunk) => {
  console.log("[Simulador HL7] Respuesta (ACK) recibida del receptor:", JSON.stringify(chunk.toString("utf8")));
  socket.end();
});
socket.on("error", (e) => console.error(`[Simulador HL7] No se pudo conectar -> ${e.message}. ¿Corriste antes "node capturar-hl7.js servidor ${puerto}"?`));

/* BIOsoft — SIMULADOR de un equipo transmitiendo, solo para practicar con
 * capturar-tcp.js ANTES de estar frente al equipo real (ej. hoy, en tu
 * propio computador, sin el analizador conectado).
 *
 * ⚠️ Los datos que envía este simulador son INVENTADOS a propósito, para
 * practicar — NO representan el formato real de ningún equipo (Dymind,
 * Dirui, Maglumi, ni ningún otro). Sirven para: (1) confirmar que sabes
 * usar la herramienta y leer su salida, y (2) demostrar que el protocolo
 * ASTM E1394 en sí funciona de punta a punta. La primera vez que importa
 * de verdad es mañana, con el equipo real.
 *
 * Cómo practicar (dos terminales abiertas en esta misma carpeta):
 *
 *   Terminal 1:  node capturar-tcp.js servidor 5000
 *   Terminal 2:  node simulador-equipo.js
 *
 * En la Terminal 1 debería aparecer un "MENSAJE COMPLETO" con datos de
 * ejemplo, igual que se vería con un equipo real transmitiendo.
 */
"use strict";
const net = require("net");
const astm = require("./astm");

const puerto = parseInt(process.argv[2], 10) || 5000;

// Mensaje ASTM sintético (inventado), con la forma típica de un panel de
// química básica — H (encabezado), P (paciente), O (orden), varios R
// (resultado), L (terminador). Un registro por línea, separadas por CR.
const registros = [
  "H|\\^&|||SIMULADOR^1.0|||||||P|LIS2-A2|" + new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14),
  "P|1||PRACTICA-001||||||||||||||||||||||",
  "O|1|PRACTICA-001||^^^QUIM|R||||||||||||||||||F",
  "R|1|^^^GLU|95|mg/dL||N||F||||",
  "R|2|^^^CREA|0.9|mg/dL||N||F||||",
  "R|3|^^^UREA|28|mg/dL||N||F||||",
  "L|1|N"
].join(String.fromCharCode(0x0d));

function construirTransmision() {
  const MAX = 60;
  const partes = [];
  for (let i = 0; i < registros.length; i += MAX) partes.push(registros.slice(i, i + MAX));
  const bytes = [Buffer.from([astm.ENQ])];
  partes.forEach((texto, i) => bytes.push(astm.buildFrame(i, texto, i === partes.length - 1)));
  bytes.push(Buffer.from([astm.EOT]));
  return Buffer.concat(bytes);
}

console.log(`[Simulador] Conectando a localhost:${puerto} (donde debe estar corriendo "node capturar-tcp.js servidor ${puerto}")...`);
const socket = net.createConnection({ host: "127.0.0.1", port: puerto }, () => {
  console.log("[Simulador] Conectado. Enviando mensaje de práctica en 1 segundo...");
  setTimeout(() => {
    socket.write(construirTransmision());
    console.log("[Simulador] Mensaje enviado. Revisa la otra terminal (capturar-tcp.js) — ahí debería aparecer el 'MENSAJE COMPLETO'.");
    setTimeout(() => socket.end(), 1000);
  }, 1000);
});

socket.on("error", (e) => {
  console.error(`[Simulador] No se pudo conectar -> ${e.message}`);
  console.error(`[Simulador] ¿Ya tienes corriendo, en otra terminal, "node capturar-tcp.js servidor ${puerto}"? Ábrela primero.`);
});

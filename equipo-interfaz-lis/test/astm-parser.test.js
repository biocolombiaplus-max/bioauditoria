/* Prueba del parser ASTM con un mensaje SINTÉTICO (construido a mano,
 * siguiendo el estándar E1394), NO capturado de un Mindray BC-10 real.
 * Esto valida que la lógica de tramas/checksum/reensamblado es correcta
 * en general — no reemplaza probar con el equipo físico (ver README). */
"use strict";
const assert = require("assert");
const { ENQ, EOT, ACK, buildFrame, createReceiver } = require("../astm");

function correr(nombre, fn) {
  try { fn(); console.log("OK  -", nombre); }
  catch (e) { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; }
}

// Mensaje ASTM sintético típico de un hemograma: H (header), P (paciente),
// O (orden), varios R (resultado), L (terminador) — un registro por línea,
// separadas por CR, tal como exige el estándar dentro del texto de trama.
const registrosEsperados = [
  "H|\\^&|||BC-10^1.0|||||||P|LIS2-A2|20260812120000",
  "P|1||20260005||||||||||||||||||||||",
  "O|1|20260005||^^^CBC|R||20260812120000|||||||||||||||||F",
  "R|1|^^^HB|14.2|g/dL||N||F||||20260812120005",
  "R|2|^^^HTO|42|%||N||F||||20260812120005",
  "R|3|^^^LEU|7.1|10^3/uL||N||F||||20260812120005",
  "L|1|N"
].join(String.fromCharCode(0x0d));

function construirTransmision() {
  // Parte el texto en tramas de ~60 caracteres, como haría un equipo real
  // al respetar un tamaño máximo de trama serial.
  const partes = [];
  const MAX = 60;
  for (let i = 0; i < registrosEsperados.length; i += MAX) partes.push(registrosEsperados.slice(i, i + MAX));

  const bytes = [Buffer.from([ENQ])];
  partes.forEach((texto, i) => bytes.push(buildFrame(i, texto, i === partes.length - 1)));
  bytes.push(Buffer.from([EOT]));
  return Buffer.concat(bytes);
}

correr("reensambla un mensaje entregado de una sola vez", () => {
  const transmision = construirTransmision();
  let mensajeRecibido = null;
  const controles = [];
  const receiver = createReceiver({
    onControl: (c) => controles.push(c),
    onMessage: (registros) => { mensajeRecibido = registros; },
    onError: (e) => { throw e; }
  });
  receiver.feed(transmision);

  assert.ok(mensajeRecibido, "debió llamar onMessage");
  assert.strictEqual(mensajeRecibido.length, 7, "debió reconocer 7 registros");
  assert.strictEqual(mensajeRecibido[0].tipo, "H");
  assert.strictEqual(mensajeRecibido[3].tipo, "R");
  assert.strictEqual(mensajeRecibido[3].campos[2], "^^^HB");
  assert.strictEqual(mensajeRecibido[3].campos[3], "14.2");
  assert.ok(controles.every((c) => c === ACK), "todas las tramas válidas deben responder ACK");
});

correr("reensambla el MISMO mensaje aunque llegue byte por byte (peor caso serial)", () => {
  const transmision = construirTransmision();
  let mensajeRecibido = null;
  const receiver = createReceiver({
    onMessage: (registros) => { mensajeRecibido = registros; },
    onError: (e) => { throw e; }
  });
  for (const byte of transmision) receiver.feed(Buffer.from([byte]));

  assert.ok(mensajeRecibido, "debió reensamblar el mensaje pese a llegar 1 byte a la vez");
  assert.strictEqual(mensajeRecibido.length, 7);
  assert.strictEqual(mensajeRecibido[4].campos[2], "^^^HTO");
  assert.strictEqual(mensajeRecibido[4].campos[3], "42");
});

correr("detecta un checksum corrupto y pide reenvío (NAK)", () => {
  const transmision = construirTransmision();
  // Corrompe un byte de datos dentro de la primera trama (después del STX+frameNumber),
  // dejando el checksum tal como estaba — debe fallar la verificación.
  const corrupta = Buffer.from(transmision);
  corrupta[3] = corrupta[3] === 0x41 ? 0x42 : 0x41;

  const controles = [];
  let error = null;
  const receiver = createReceiver({
    onControl: (c) => controles.push(c),
    onError: (e) => { error = e; }
  });
  receiver.feed(corrupta);

  assert.ok(error, "debió reportar un error de checksum");
  assert.ok(controles.includes(0x15), "debió responder NAK (0x15) para la trama corrupta");
});

if (process.exitCode) {
  console.error("\nHay pruebas fallidas.");
  process.exit(1);
} else {
  console.log("\nTodas las pruebas del parser ASTM pasaron (con datos sintéticos).");
}

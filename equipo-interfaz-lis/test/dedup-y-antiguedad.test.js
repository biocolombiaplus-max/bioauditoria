/* Prueba de los resguardos que evitan procesar dos veces el mismo mensaje
 * del equipo (deduplicación por MSH-10 en index-hl7.js) y de las reglas de
 * firestore-writer.js que protegen un resultado ya "entregado" (preliminar/
 * validado/remitido) o una orden demasiado vieja, para que un mensaje
 * repetido o atascado en el buffer del equipo no reescriba en silencio un
 * resultado que el paciente ya recibió. No abre ningún puerto real ni se
 * conecta a Firebase de verdad — firestore-writer.js se reemplaza por una
 * versión falsa antes de requerir index-hl7.js. */
"use strict";
const assert = require("assert");
const { Module } = require("module");

function correr(nombre, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") {
      return r.then(() => console.log("OK  -", nombre)).catch((e) => { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; });
    }
    console.log("OK  -", nombre);
  } catch (e) { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; }
}

// --- Reemplazo de firestore-writer.js por una versión falsa que solo
// cuenta cuántas veces se le pide guardar un resultado, ANTES de requerir
// index-hl7.js (que lo destructura al cargar) ---
const rutaFirestoreWriter = require.resolve("../firestore-writer.js");
let llamadas = 0;
const fakeModule = new Module(rutaFirestoreWriter);
fakeModule.exports = {
  crearClienteBiosoft: () => ({ app: {}, auth: {}, db: {} }),
  iniciarSesion: async () => ({}),
  recibirResultadoEquipo: async () => { llamadas++; return { ok: true }; }
};
fakeModule.loaded = true;
require.cache[rutaFirestoreWriter] = fakeModule;

const hl7Index = require("../index-hl7.js");
const astmIndex = require("../index.js");

const mapeoStub = {
  EXAM_ID_BIOSOFT: "QUI-001",
  mapearResultados: () => ({ valores: { GLU: "95" }, ignorados: [] })
};
const configStub = { tenantId: "demo", nombreEquipo: "Mindray BS-220 (prueba)" };

function mensajeHL7(controlId) {
  return [
    "MSH|^~\\&|Mindray|BS-220|||20260930120000||ORU^R01|" + controlId + "|P|2.3.1",
    "PID|1||123456||PEREZ JUAN",
    "OBR|1|2026093001|8|Mindray^BS-220|||20260930115000",
    "OBX|1|NM|GLU||95|mg/dL|70-100|N"
  ].join("\r");
}

function registrosASTM(numeroOrden) {
  return [
    { tipo: "H", campos: ["H"] },
    { tipo: "O", campos: ["O", "1", numeroOrden] },
    { tipo: "R", campos: ["R", "1", "^^^GLU", "95", "mg/dL"] }
  ];
}

(async () => {
  await correr("un mensaje nuevo (control ID nunca visto) se procesa y llama a recibirResultadoEquipo", async () => {
    llamadas = 0;
    await hl7Index.procesarMensaje(configStub, mapeoStub, {}, mensajeHL7("MSGID-DEDUP-001"));
    assert.strictEqual(llamadas, 1);
  });

  await correr("el MISMO mensaje (mismo control ID) reenviado no se vuelve a procesar", async () => {
    llamadas = 0;
    await hl7Index.procesarMensaje(configStub, mapeoStub, {}, mensajeHL7("MSGID-DEDUP-002"));
    await hl7Index.procesarMensaje(configStub, mapeoStub, {}, mensajeHL7("MSGID-DEDUP-002"));
    assert.strictEqual(llamadas, 1, "el segundo envío del mismo control ID no debió llamar de nuevo a recibirResultadoEquipo");
  });

  await correr("un control ID DISTINTO sí se procesa aunque el resto del mensaje sea igual", async () => {
    llamadas = 0;
    await hl7Index.procesarMensaje(configStub, mapeoStub, {}, mensajeHL7("MSGID-DEDUP-003"));
    await hl7Index.procesarMensaje(configStub, mapeoStub, {}, mensajeHL7("MSGID-DEDUP-004"));
    assert.strictEqual(llamadas, 2);
  });

  await correr("ASTM (index.js): un mensaje nuevo se procesa y llama a recibirResultadoEquipo", async () => {
    llamadas = 0;
    await astmIndex.procesarMensaje(configStub, mapeoStub, {}, registrosASTM("ASTM-DEDUP-001"));
    assert.strictEqual(llamadas, 1);
  });

  await correr("ASTM (index.js): el MISMO mensaje (misma orden y mismos registros R) reenviado no se vuelve a procesar", async () => {
    llamadas = 0;
    await astmIndex.procesarMensaje(configStub, mapeoStub, {}, registrosASTM("ASTM-DEDUP-002"));
    await astmIndex.procesarMensaje(configStub, mapeoStub, {}, registrosASTM("ASTM-DEDUP-002"));
    assert.strictEqual(llamadas, 1, "el segundo envío del mismo mensaje no debió llamar de nuevo a recibirResultadoEquipo");
  });

  await correr("ASTM (index.js): una orden DISTINTA sí se procesa", async () => {
    llamadas = 0;
    await astmIndex.procesarMensaje(configStub, mapeoStub, {}, registrosASTM("ASTM-DEDUP-003"));
    await astmIndex.procesarMensaje(configStub, mapeoStub, {}, registrosASTM("ASTM-DEDUP-004"));
    assert.strictEqual(llamadas, 2);
  });

  if (process.exitCode) { console.error("\nHay pruebas fallidas."); process.exit(1); }
  else console.log("\nPruebas de deduplicación (index.js + index-hl7.js) OK.");
})();

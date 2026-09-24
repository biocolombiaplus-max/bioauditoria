/* Prueba del mapeo multi-examen del Mindray BS-220 con segmentos OBX
 * SINTÉTICOS (construidos a mano, con los códigos LIS que este mismo
 * archivo le pide al cliente escribir en "Correspondencia de test" en el
 * equipo real — ver README.md), NO capturados de un BS-220 físico. */
"use strict";
const assert = require("assert");
const { mapearResultados, MAPEO } = require("../mindray-bs220-hl7-map");

function correr(nombre, fn) {
  try { fn(); console.log("OK  -", nombre); }
  catch (e) { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; }
}

function obx(codigoLis, valor) {
  return ["OBX", "1", "NM", codigoLis + "^Nombre", "", valor, "mg/dL", "", "", "", "F"];
}

correr("agrupa varios exámenes distintos de un mismo mensaje, cada uno bajo su propio examId", () => {
  const segmentosOBX = [obx("GLU", "95"), obx("CREA", "0.9"), obx("COLT", "180")];
  const { porExamen, ignorados } = mapearResultados(segmentosOBX);
  assert.deepStrictEqual(porExamen["QUI-001"], { GLU: "95" });
  assert.deepStrictEqual(porExamen["QUI-008"], { CREA: "0.9" });
  assert.deepStrictEqual(porExamen["QUI-004"], { COLT: "180" });
  assert.deepStrictEqual(ignorados, []);
});

correr("agrupa dos parámetros del MISMO examen (Bilirrubinas: BT + BD) bajo un solo examId", () => {
  const segmentosOBX = [obx("BT", "0.8"), obx("BD", "0.2")];
  const { porExamen } = mapearResultados(segmentosOBX);
  assert.deepStrictEqual(porExamen["QUI-011"], { BT: "0.8", BD: "0.2" });
});

correr("avisa de un código LIS no reconocido, sin inventar nada", () => {
  const segmentosOBX = [obx("GLU", "95"), obx("CODIGO_NUEVO", "1")];
  const { porExamen, ignorados } = mapearResultados(segmentosOBX);
  assert.deepStrictEqual(porExamen["QUI-001"], { GLU: "95" });
  assert.deepStrictEqual(ignorados, ["CODIGO_NUEVO"]);
});

correr("todos los códigos de MAPEO apuntan a un examId no vacío (sanity check del archivo)", () => {
  Object.keys(MAPEO).forEach((codigoLis) => {
    const m = MAPEO[codigoLis];
    assert.ok(m.examId && m.examId.indexOf("QUI-") === 0, `${codigoLis} -> examId inválido: ${m.examId}`);
    assert.ok(m.codigo, `${codigoLis} -> falta codigo`);
  });
});

if (process.exitCode) { console.error("\nHay pruebas fallidas."); process.exit(1); }
else console.log("\nPruebas del mapeo Mindray BS-220 (HL7) OK.");

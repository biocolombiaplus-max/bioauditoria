/* Prueba de agruparPorExamen() en index.js (ASTM) e index-hl7.js (HL7):
 * confirma que un mapeo "clásico" de un solo panel (ej. BC-10) sigue
 * funcionando exactamente igual que antes (compatibilidad hacia atrás), y
 * que un mapeo "multi-examen" (ej. química) agrupa correctamente varios
 * exámenes distintos de un mismo mensaje. No abre ningún puerto real ni
 * se conecta a Firebase — solo prueba la función pura. */
"use strict";
const assert = require("assert");
const astmIndex = require("../index.js");
const hl7Index = require("../index-hl7.js");

function correr(nombre, fn) {
  try { fn(); console.log("OK  -", nombre); }
  catch (e) { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; }
}

[
  { nombre: "index.js (ASTM)", agruparPorExamen: astmIndex.agruparPorExamen },
  { nombre: "index-hl7.js (HL7)", agruparPorExamen: hl7Index.agruparPorExamen }
].forEach(({ nombre, agruparPorExamen }) => {
  correr(`${nombre}: un mapeo clásico ({valores, ignorados} + EXAM_ID_BIOSOFT) sigue funcionando igual (compatibilidad con BC-10/Dymind)`, () => {
    const resultadoMapeoClasico = { valores: { HB: "14.2", LEU: "7.1" }, ignorados: [] };
    const porExamen = agruparPorExamen(resultadoMapeoClasico, "HEM-001");
    assert.deepStrictEqual(porExamen, { "HEM-001": { HB: "14.2", LEU: "7.1" } });
  });

  correr(`${nombre}: un mapeo multi-examen ({porExamen}) se usa tal cual, ignorando EXAM_ID_BIOSOFT (que ni siquiera existe en ese mapeo)`, () => {
    const resultadoMapeoMultiExamen = {
      porExamen: { "QUI-001": { GLU: "95" }, "QUI-004": { COLT: "180" } },
      ignorados: []
    };
    const porExamen = agruparPorExamen(resultadoMapeoMultiExamen, undefined);
    assert.deepStrictEqual(porExamen, { "QUI-001": { GLU: "95" }, "QUI-004": { COLT: "180" } });
  });

  correr(`${nombre}: sin EXAM_ID_BIOSOFT y sin porExamen, no inventa nada (devuelve vacío)`, () => {
    const porExamen = agruparPorExamen({ valores: { GLU: "95" }, ignorados: [] }, undefined);
    assert.deepStrictEqual(porExamen, {});
  });
});

if (process.exitCode) { console.error("\nHay pruebas fallidas."); process.exit(1); }
else console.log("\nPruebas de agrupación multi-examen (ASTM + HL7) OK.");

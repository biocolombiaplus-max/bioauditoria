"use strict";
const assert = require("assert");
const { mapearResultados } = require("../mindray-bc10-map");

function correr(nombre, fn) {
  try { fn(); console.log("OK  -", nombre); }
  catch (e) { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; }
}

correr("mapea campos conocidos y avisa de los que no reconoce", () => {
  const registros = [
    { tipo: "R", campos: ["R", "1", "^^^HGB", "14.2", "g/dL"] },
    { tipo: "R", campos: ["R", "2", "^^^WBC", "7.1", "10^3/uL"] },
    { tipo: "R", campos: ["R", "3", "^^^ALGO_NUEVO", "99", "?"] }
  ];
  const { valores, ignorados } = mapearResultados(registros);
  assert.strictEqual(valores.HB, "14.2");
  assert.strictEqual(valores.LEU, "7.1");
  assert.strictEqual(valores.MONO, undefined, "no debe inventar MONO");
  assert.deepStrictEqual(ignorados, ["^^^ALGO_NUEVO"]);
});

if (process.exitCode) { console.error("\nHay pruebas fallidas."); process.exit(1); }
else console.log("\nPruebas de mapeo OK.");

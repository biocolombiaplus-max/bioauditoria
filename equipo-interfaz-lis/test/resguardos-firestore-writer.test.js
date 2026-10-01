/* Prueba de los resguardos de recibirResultadoEquipo() en firestore-writer.js:
 * rechaza un examen ya "entregado" (preliminar/validado/remitido) y rechaza
 * una orden demasiado vieja, para que un mensaje repetido o atascado del
 * equipo no reescriba en silencio un resultado que el paciente ya recibió.
 * No se conecta a Firebase de verdad: se reemplazan collection/query/where/
 * getDocs/doc/setDoc de "firebase/firestore" por versiones en memoria,
 * simulando una sola orden ya guardada. */
"use strict";
const assert = require("assert");
const { Module } = require("module");

function correr(nombre, fn) {
  return fn().then(() => console.log("OK  -", nombre)).catch((e) => { console.error("FAIL -", nombre, "->", e.message); process.exitCode = 1; });
}

// --- Firestore falso: una sola colección de "documentos" en memoria por
// path, suficiente para lo que usa firestore-writer.js (query por
// numeroOrden + lectura/escritura por id). ---
function crearFirestoreFalso(ordenesSeed) {
  const docs = {}; // path -> data
  Object.keys(ordenesSeed).forEach((id) => { docs["tenants/demo/orders/" + id] = ordenesSeed[id]; });
  const auditorias = [];
  return {
    docs, auditorias,
    collection: (db, ...partes) => ({ __path: partes.join("/") }),
    query: (col, whereClause) => ({ __col: col, __where: whereClause }),
    where: (campo, op, valor) => ({ campo, op, valor }),
    getDocs: async (q) => {
      const prefijo = q.__col.__path + "/";
      const encontrados = Object.keys(docs)
        .filter((path) => path.startsWith(prefijo) && docs[path][q.__where.campo] === q.__where.valor)
        .map((path) => ({ id: path.slice(prefijo.length), data: () => docs[path] }));
      return { empty: encontrados.length === 0, docs: encontrados };
    },
    doc: (db, ...partes) => ({ __path: partes.join("/") }),
    setDoc: async (ref, data) => {
      docs[ref.__path] = data;
      if (ref.__path.includes("/auditLog/")) auditorias.push(data);
    }
  };
}

function cargarFirestoreWriterConFake(fake) {
  const rutaFirebaseFirestore = require.resolve("firebase/firestore");
  const rutaFirebaseApp = require.resolve("firebase/app");
  const rutaFirebaseAuth = require.resolve("firebase/auth");
  const rutaFirestoreWriter = require.resolve("../firestore-writer.js");
  [rutaFirebaseFirestore, rutaFirebaseApp, rutaFirebaseAuth, rutaFirestoreWriter].forEach((p) => delete require.cache[p]);

  const modFirestore = new Module(rutaFirebaseFirestore);
  modFirestore.exports = {
    getFirestore: () => ({}), collection: fake.collection, query: fake.query, where: fake.where,
    getDocs: fake.getDocs, doc: fake.doc, setDoc: fake.setDoc
  };
  modFirestore.loaded = true;
  require.cache[rutaFirebaseFirestore] = modFirestore;

  const modApp = new Module(rutaFirebaseApp);
  modApp.exports = { initializeApp: () => ({}) };
  modApp.loaded = true;
  require.cache[rutaFirebaseApp] = modApp;

  const modAuth = new Module(rutaFirebaseAuth);
  modAuth.exports = { getAuth: () => ({}), signInWithEmailAndPassword: async () => ({ user: {} }) };
  modAuth.loaded = true;
  require.cache[rutaFirebaseAuth] = modAuth;

  return require("../firestore-writer.js");
}

(async () => {
  await correr("rechaza un examen que ya está \"preliminar\" (no lo sobrescribe)", async () => {
    const fake = crearFirestoreFalso({
      ord1: { numeroOrden: "2026093001", fechaOrden: new Date().toISOString(), examenes: [{ examId: "QUI-001", estado: "preliminar" }] }
    });
    const fw = cargarFirestoreWriterConFake(fake);
    const r = await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026093001", examId: "QUI-001", valoresPorCodigo: { GLU: "999" }, equipoNombre: "Test"
    });
    assert.strictEqual(r.ok, false);
    assert.ok(/preliminar/.test(r.error), "el error debe mencionar el estado preliminar");
    assert.strictEqual(fake.docs["tenants/demo/orders/ord1"].examenes[0].estado, "preliminar", "no debió cambiar el estado");
    assert.strictEqual(fake.auditorias.length, 1);
    assert.strictEqual(fake.auditorias[0].accion, "REJECT_DEVICE_RESULT");
  });

  await correr("rechaza una orden de más de 96 horas de antigüedad", async () => {
    const fechaVieja = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(); // 10 días atrás
    const fake = crearFirestoreFalso({
      ord2: { numeroOrden: "2026091501", fechaOrden: fechaVieja, examenes: [{ examId: "QUI-001", estado: "en_proceso" }] }
    });
    const fw = cargarFirestoreWriterConFake(fake);
    const r = await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026091501", examId: "QUI-001", valoresPorCodigo: { GLU: "95" }, equipoNombre: "Test"
    });
    assert.strictEqual(r.ok, false);
    assert.ok(/horas/.test(r.error), "el error debe mencionar la antigüedad en horas");
    assert.strictEqual(fake.docs["tenants/demo/orders/ord2"].examenes[0].estado, "en_proceso", "no debió cambiar el estado");
  });

  await correr("SÍ acepta una orden reciente y sin cerrar (caso normal, no debe romperse)", async () => {
    const fake = crearFirestoreFalso({
      ord3: { numeroOrden: "2026093002", fechaOrden: new Date().toISOString(), examenes: [{ examId: "QUI-001", estado: "en_proceso" }] }
    });
    const fw = cargarFirestoreWriterConFake(fake);
    const r = await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026093002", examId: "QUI-001", valoresPorCodigo: { GLU: "95" }, equipoNombre: "Test"
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(fake.docs["tenants/demo/orders/ord3"].examenes[0].estado, "en_proceso");
    assert.strictEqual(fake.docs["tenants/demo/orders/ord3"].examenes[0].valores[0].valor, "95");
  });

  await correr("un panel que llega en VARIOS mensajes separados (ej. Electrolitos: Na, luego K, luego Cl) no se borra entre sí", async () => {
    const fake = crearFirestoreFalso({
      ord4: { numeroOrden: "2026100101", fechaOrden: new Date().toISOString(), examenes: [{ examId: "GAS-002", estado: "en_proceso" }] }
    });
    const fw = cargarFirestoreWriterConFake(fake);
    await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026100101", examId: "GAS-002", valoresPorCodigo: { NA: "140" }, equipoNombre: "Test"
    });
    await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026100101", examId: "GAS-002", valoresPorCodigo: { K: "4.00" }, equipoNombre: "Test"
    });
    const r3 = await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026100101", examId: "GAS-002", valoresPorCodigo: { CL: "104.00" }, equipoNombre: "Test"
    });
    assert.strictEqual(r3.ok, true);
    const valoresFinales = fake.docs["tenants/demo/orders/ord4"].examenes[0].valores;
    const mapa = {};
    valoresFinales.forEach((v) => { mapa[v.codigo] = v.valor; });
    assert.deepStrictEqual(mapa, { NA: "140", K: "4.00", CL: "104.00" }, "los 3 parámetros deben quedar presentes — ninguno se debió borrar al llegar el siguiente");
  });

  await correr("un parámetro reenviado CORRIGE solo ese valor, sin tocar los demás del mismo panel", async () => {
    const fake = crearFirestoreFalso({
      ord5: { numeroOrden: "2026100102", fechaOrden: new Date().toISOString(), examenes: [{ examId: "GAS-002", estado: "en_proceso" }] }
    });
    const fw = cargarFirestoreWriterConFake(fake);
    await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026100102", examId: "GAS-002", valoresPorCodigo: { NA: "140" }, equipoNombre: "Test"
    });
    await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026100102", examId: "GAS-002", valoresPorCodigo: { K: "4.00" }, equipoNombre: "Test"
    });
    // El equipo reenvía K corregido (ej. repitió la lectura)
    await fw.recibirResultadoEquipo(fw.crearClienteBiosoft().db, {
      tenantId: "demo", numeroOrden: "2026100102", examId: "GAS-002", valoresPorCodigo: { K: "4.20" }, equipoNombre: "Test"
    });
    const valoresFinales = fake.docs["tenants/demo/orders/ord5"].examenes[0].valores;
    const mapa = {};
    valoresFinales.forEach((v) => { mapa[v.codigo] = v.valor; });
    assert.deepStrictEqual(mapa, { NA: "140", K: "4.20" }, "K debe quedar con el valor corregido, NA no debió tocarse, y no debe haber un K duplicado");
  });

  if (process.exitCode) { console.error("\nHay pruebas fallidas."); process.exit(1); }
  else console.log("\nPruebas de resguardos de firestore-writer.js OK.");
})();

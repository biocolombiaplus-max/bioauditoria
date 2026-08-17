/* Interfaz BIOsoft — Escritura en Firestore, replicando EXACTAMENTE el mismo
 * contrato de datos que usa el navegador (biosoft/js/store.js:
 * recibirResultadoEquipo / saveOrder / addAudit), para que un resultado
 * recibido del equipo se vea en BIOsoft idéntico a como si un humano lo
 * hubiera guardado como borrador.
 *
 * Se autentica como un usuario BIOsoft normal (Bacteriólogo/a dedicado al
 * equipo, creado en "Usuarios del Laboratorio" — ver README.md) usando el
 * mismo Firebase Auth que usa la app web. Esto es intencional: así se
 * reutilizan, sin cambios, las mismas reglas de seguridad de Firestore que
 * ya protegen los datos de cada laboratorio — no hace falta backend nuevo
 * ni una clave de administrador de Firebase en la computadora del equipo.
 */
"use strict";
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, collection, query, where, getDocs, doc, setDoc } = require("firebase/firestore");

// Misma configuración pública que biosoft/js/firebase-config.js — no es
// secreta (la seguridad real la dan las Reglas de Firestore), así que es
// seguro que viva también en esta computadora.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD3GrNA36sy4iCszTuPN5Ol2H3KTNbyUQM",
  authDomain: "biosoft-produccion.firebaseapp.com",
  projectId: "biosoft-produccion",
  storageBucket: "biosoft-produccion.firebasestorage.app",
  messagingSenderId: "806962064823",
  appId: "1:806962064823:web:27225d45915585d087cc32"
};

function crearClienteBiosoft() {
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

async function iniciarSesion(auth, email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

async function buscarOrdenPorNumero(db, tenantId, numeroOrden) {
  const col = collection(db, "tenants", tenantId, "orders");
  const q = query(col, where("numeroOrden", "==", String(numeroOrden)));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, data: snap.docs[0].data() };
}

function nowISO() { return new Date().toISOString(); }

/**
 * Replica store.js::recibirResultadoEquipo del lado del middleware: busca
 * la orden por número, ubica el examen por examId, y si NO está ya
 * validado/remitido, escribe los valores recibidos dejándolo en estado
 * "en_proceso" (borrador) — NUNCA "preliminar" ni "validado": eso lo
 * decide siempre un bacteriólogo humano desde BIOsoft, con su clic.
 */
async function recibirResultadoEquipo(db, { tenantId, numeroOrden, examId, valoresPorCodigo, equipoNombre }) {
  const encontrada = await buscarOrdenPorNumero(db, tenantId, numeroOrden);
  if (!encontrada) return { ok: false, error: `No se encontró la orden ${numeroOrden} en este laboratorio.` };

  const order = encontrada.data;
  const ex = (order.examenes || []).find((e) => e.examId === examId);
  if (!ex) return { ok: false, error: `La orden ${numeroOrden} no tiene el examen ${examId}.` };
  if (ex.estado === "validado" || ex.estado === "remitido") {
    return { ok: false, error: `El examen ya está "${ex.estado}"; no se sobrescribe automáticamente.` };
  }

  ex.valores = Object.keys(valoresPorCodigo).map((codigo) => ({ codigo, valor: String(valoresPorCodigo[codigo]) }));
  ex.estado = "en_proceso";
  ex.recibidoDeEquipo = true;
  ex.equipoOrigen = equipoNombre || "Equipo conectado";
  ex.ingresadoPor = equipoNombre || "Interfaz de equipo";
  ex.fechaIngreso = nowISO();

  // Escritura del documento COMPLETO (igual que saveOrder en store.js) —
  // Firestore no permite reemplazar un elemento puntual dentro de un array
  // por índice, así que se reescribe el arreglo "examenes" entero ya
  // modificado, dentro del documento completo de la orden.
  await setDoc(doc(db, "tenants", tenantId, "orders", encontrada.id), order);

  // Mismo formato de id que BIO_STORE.uid("log") en store.js, para que la
  // pantalla de Trazabilidad de BIOsoft lo muestre igual que un registro
  // generado desde el navegador (ahí sí espera un campo "id" en los datos,
  // no solo la clave del documento de Firestore).
  const auditId = "log_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  await setDoc(doc(db, "tenants", tenantId, "auditLog", auditId), {
    id: auditId, tenantId, fecha: nowISO(), usuario: equipoNombre || "Interfaz de equipo", rol: "equipo",
    accion: "RECEIVE_DEVICE_RESULT", entidad: "resultado", entidadId: `${encontrada.id}:${examId}`,
    detalle: `Resultado recibido automáticamente del equipo ${equipoNombre || "conectado"} para la orden ${numeroOrden}. Queda como borrador, pendiente de revisión y validación por un bacteriólogo.`
  });

  return { ok: true };
}

module.exports = { crearClienteBiosoft, iniciarSesion, buscarOrdenPorNumero, recibirResultadoEquipo };

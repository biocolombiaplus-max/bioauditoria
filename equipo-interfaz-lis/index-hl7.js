/* Interfaz BIOsoft <-> equipo HL7 (ej. Dymind DF52) — punto de entrada del
 * middleware para equipos que hablan HL7/MLLP en vez de ASTM E1394 (ver
 * index.js para la versión ASTM). Misma filosofía: nunca deja un resultado
 * como "preliminar" ni "validado" automáticamente, siempre como borrador
 * ("en_proceso"), pendiente de que un bacteriólogo lo revise desde BIOsoft.
 *
 * ⚠️ Antes de usarlo con pacientes reales, lee README.md. El framing MLLP
 * y la estructura de segmentos HL7 son el estándar de la industria, pero
 * el mapeo de parámetros (mapeo-generico-hl7-template.js) y de dónde sale
 * el número de orden (función extraerNumeroOrden abajo) son suposiciones
 * de mejor esfuerzo — CONFÍRMALAS con capturar-hl7.js antes de confiar en
 * esto para un resultado real de un paciente.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const net = require("net");
const { crearClienteBiosoft, iniciarSesion, recibirResultadoEquipo } = require("./firestore-writer");

const VT = 0x0b, FS = 0x1c, CR = 0x0d;

function cargarConfig() {
  const configPath = path.join(__dirname, "config-hl7.json");
  if (!fs.existsSync(configPath)) {
    console.error('No existe config-hl7.json. Copia config-hl7.example.json a config-hl7.json y complétalo con tus datos (ver README.md).');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function cargarMapeo(config) {
  const nombreArchivo = config.archivoMapeo || "mapeo-generico-hl7-template";
  return require("./" + nombreArchivo);
}

function construirACK(controlIdOriginal) {
  const ahora = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const msh = `MSH|^~\\&|BIOSOFT|BIOSOFT|||${ahora}||ACK|ACK${Date.now()}|P|2.3.1`;
  const msa = `MSA|AA|${controlIdOriginal || ""}`;
  const cuerpo = [msh, msa].join(String.fromCharCode(CR));
  return Buffer.concat([Buffer.from([VT]), Buffer.from(cuerpo, "utf8"), Buffer.from([FS, CR])]);
}

function crearReceptorHL7(onMensaje) {
  let buffer = Buffer.alloc(0);
  function feed(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const inicio = buffer.indexOf(VT);
      if (inicio === -1) { if (buffer.length > 0) buffer = Buffer.alloc(0); return; }
      const finFS = buffer.indexOf(FS, inicio);
      if (finFS === -1) return;
      const texto = buffer.slice(inicio + 1, finFS).toString("utf8");
      buffer = buffer.slice(finFS + 2);
      onMensaje(texto);
    }
  }
  return { feed };
}

/** El número de orden suele venir en PID-3 (identificador del paciente/
 * muestra) — si tu equipo lo pone en otro segmento/campo (ej. OBR-2, el
 * "Placer Order Number"), ajusta aquí. Es justo el tipo de detalle que hay
 * que confirmar con la captura real (ver README). */
function extraerNumeroOrden(segmentos) {
  const pid = segmentos.find((s) => s[0] === "PID");
  if (pid && pid[3]) return pid[3];
  const obr = segmentos.find((s) => s[0] === "OBR");
  if (obr && obr[2]) return obr[2];
  return null;
}

async function procesarMensaje(config, mapeo, db, texto) {
  const segmentos = texto.split(/[\r\n]+/).filter(Boolean).map((s) => s.split("|"));
  let controlId = "";
  const msh = segmentos.find((s) => s[0] === "MSH");
  if (msh && msh[9]) controlId = msh[9];

  const numeroOrden = extraerNumeroOrden(segmentos);
  if (!numeroOrden) {
    console.warn("[BIOsoft-HL7] Mensaje recibido sin número de orden reconocible en PID-3/OBR-2 — se ignora. Segmentos:", JSON.stringify(segmentos));
    return controlId;
  }

  const segmentosOBX = segmentos.filter((s) => s[0] === "OBX");
  const { valores, ignorados } = mapeo.mapearResultados(segmentosOBX);
  if (ignorados.length) {
    console.warn(`[BIOsoft-HL7] Orden ${numeroOrden}: ${ignorados.length} campo(s) del equipo no reconocido(s), se ignoraron:`, ignorados.join(", "));
  }
  if (!Object.keys(valores).length) {
    console.warn(`[BIOsoft-HL7] Orden ${numeroOrden}: no se reconoció ningún valor mapeable — no se escribe nada.`);
    return controlId;
  }

  console.log(`[BIOsoft-HL7] Orden ${numeroOrden}: enviando ${Object.keys(valores).length} valor(es) a BIOsoft ->`, valores);
  const resultado = await recibirResultadoEquipo(db, {
    tenantId: config.tenantId, numeroOrden, examId: mapeo.EXAM_ID_BIOSOFT,
    valoresPorCodigo: valores, equipoNombre: config.nombreEquipo
  });
  if (resultado.ok) console.log(`[BIOsoft-HL7] Orden ${numeroOrden}: guardado como borrador en BIOsoft. Pendiente de revisión por un bacteriólogo.`);
  else console.error(`[BIOsoft-HL7] Orden ${numeroOrden}: NO se pudo guardar -> ${resultado.error}`);

  return controlId;
}

function wireSocket(config, mapeo, db, socket) {
  const receptor = crearReceptorHL7((texto) => {
    procesarMensaje(config, mapeo, db, texto)
      .then((controlId) => { socket.write(construirACK(controlId)); })
      .catch((e) => console.error("[BIOsoft-HL7] Error procesando mensaje:", e));
  });
  socket.on("data", (chunk) => receptor.feed(chunk));
  socket.on("error", (e) => console.error("[BIOsoft-HL7] Error de socket:", e.message));
  socket.on("close", () => console.log("[BIOsoft-HL7] Conexión cerrada por el equipo."));
}

async function main() {
  const config = cargarConfig();
  const mapeo = cargarMapeo(config);
  console.log(`[BIOsoft-HL7] Usando mapeo de parámetros: ${config.archivoMapeo || "mapeo-generico-hl7-template"}`);

  console.log("[BIOsoft-HL7] Conectando con BIOsoft...");
  const { auth, db } = crearClienteBiosoft();
  await iniciarSesion(auth, config.usuarioEmail, config.usuarioPassword);
  console.log("[BIOsoft-HL7] Sesión iniciada como", config.usuarioEmail);

  const puerto = config.puerto || 5001;
  const server = net.createServer((socket) => {
    console.log(`[BIOsoft-HL7] Equipo conectado desde ${socket.remoteAddress}:${socket.remotePort}`);
    wireSocket(config, mapeo, db, socket);
  });
  server.listen(puerto, () => {
    console.log(`[BIOsoft-HL7] Escuchando en el puerto ${puerto}. Configura esta IP y este puerto como "servidor LIS" en el equipo.`);
  });
  server.on("error", (e) => console.error("[BIOsoft-HL7] Error al escuchar:", e.message));
}

main().catch((e) => {
  console.error("[BIOsoft-HL7] Error fatal al iniciar:", e);
  process.exit(1);
});

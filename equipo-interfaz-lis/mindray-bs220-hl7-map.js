/* Interfaz BIOsoft — Mapeo de parámetros: Mindray BS-220 (Química
 * Sanguínea) -> BIOsoft, vía LIS/HL7 sobre TCP-IP.
 *
 * A diferencia de mindray-bc10-map.js (hematología, ASTM por serial, un
 * solo examen HEM-001 con varios parámetros adentro), el BS-220 real
 * observado en sitio tiene una pantalla propia "Sistema → LIS" con:
 *   - "Habilitar LIS" + "IP host LIS" + "Puerto" (el EQUIPO se conecta
 *     COMO CLIENTE a esa IP:puerto — no tiene salida serial en este menú),
 *   - "Enviar result tras cada muestra" (envío automático, sin botón manual),
 *   - una tabla "Correspondencia de test" (Test -> "Cód en LIS") donde EL
 *     PROPIO OPERADOR escribe qué código usará cada prueba al hablar con
 *     el LIS.
 * Esa tabla es una ventaja enorme: en vez de adivinar el código interno de
 * fábrica de cada prueba, LE DECIMOS AL CLIENTE QUÉ ESCRIBIR — los códigos
 * de la columna izquierda de MAPEO abajo son justo eso, no algo que haya
 * que descubrir con una captura. Ver README.md, sección "Mindray BS-220",
 * para la lista exacta a copiar en esa pantalla.
 *
 * ⚠️ Lo que SÍ sigue sin confirmar contra el equipo real (ver README.md):
 * 1. Si el protocolo de fondo es HL7 v2.3.1 "de verdad" (segmentos
 *    MSH/PID/OBR/OBX, framing MLLP VT...FS CR) o una variante simplificada
 *    propia de este equipo — la pantalla "LIS" con IP+puerto+"Modo
 *    bidireccional" es consistente con HL7, pero solo una captura real con
 *    capturar-hl7.js lo confirma. Si capturar-hl7.js no muestra nada
 *    reconocible, prueba capturar-tcp.js (misma IP/puerto) para ver los
 *    bytes crudos tal cual llegan, sea cual sea el formato.
 * 2. En qué campo exacto del mensaje aparece el "Cód en LIS" que se
 *    escriba en la tabla del equipo — se asume que es la parte antes del
 *    "^" en OBX-3 (lo más común en HL7), pero SIEMPRE compruébalo con la
 *    captura real antes de confiar en un resultado de un paciente.
 * 3. De dónde saca el equipo el "número de orden" que llega en PID-3 (ver
 *    extraerNumeroOrden() en index-hl7.js) — hay que confirmar que el
 *    operador escanea/digita ahí el mismo número de orden que imprime el
 *    sticker de BIOsoft.
 *
 * Cambia "IP host LIS" en el equipo por la IP de la computadora donde
 * corra este middleware (NUNCA 127.0.0.1, salvo que este middleware corra
 * en la misma computadora embebida del equipo, que no es lo normal) — ver
 * capturar-hl7.js, que imprime la IP correcta a usar.
 */
"use strict";

/** código LIS (el mismo que se escriba en "Cód en LIS" en el equipo) ->
 * { examId: examen de BIOsoft (catalog.js), codigo: código del parámetro
 * DENTRO de ese examen, factor: multiplicador opcional }. */
const MAPEO = {
  "GLU": { examId: "QUI-001", codigo: "GLU", factor: 1 }, // GLUCOSA
  "CREA": { examId: "QUI-008", codigo: "CREA", factor: 1 }, // CREATININA
  "COLT": { examId: "QUI-004", codigo: "COLT", factor: 1 }, // COLESTEROL
  "TGD": { examId: "QUI-007", codigo: "TGD", factor: 1 }, // TRIGLICERIDOS
  "AURI": { examId: "QUI-010", codigo: "AURI", factor: 1 }, // ACIDO URICO
  "PT": { examId: "QUI-012", codigo: "PT_", factor: 1 }, // PROTEINA TOTAL
  "ALB": { examId: "QUI-012", codigo: "ALB", factor: 1 }, // ALBUMINA
  "AST": { examId: "QUI-013", codigo: "AST", factor: 1 }, // TGO
  "ALT": { examId: "QUI-014", codigo: "ALT", factor: 1 }, // TGP
  "CA": { examId: "QUI-023", codigo: "CA", factor: 1 }, // CALCIO
  "FOS": { examId: "QUI-024", codigo: "P", factor: 1 }, // FOSFORO
  "ALP": { examId: "QUI-015", codigo: "FA", factor: 1 }, // ALP (Fosfatasa Alcalina)
  "LDH": { examId: "QUI-019", codigo: "LDH", factor: 1 }, // LDH
  "BT": { examId: "QUI-011", codigo: "BT", factor: 1 }, // B. Total
  "BD": { examId: "QUI-011", codigo: "BD", factor: 1 }, // B. Directa
  "AMIL": { examId: "QUI-017", codigo: "AMIL", factor: 1 }, // AMILASA MR
  "CPK": { examId: "QUI-020", codigo: "CPK", factor: 1 }, // CK NAC (CPK Total)
  "CPKMB": { examId: "QUI-021", codigo: "CPKMB", factor: 1 } // CK MB
  // El equipo también podría mostrar más pruebas al hacer scroll en
  // "Correspondencia de test" (la lista capturada llegaba hasta "CK MB") —
  // si el BS-220 real del cliente ofrece alguna más, agrégala aquí con el
  // mismo patrón, usando el examId/código de catalog.js que corresponda.
};

/** Recibe los segmentos OBX ya separados en arreglos de campos (por "|") y
 * devuelve {porExamen: {examId: {codigo: valor}}, ignorados} — el
 * contrato multi-examen que espera index-hl7.js (ver agruparPorExamen()). */
function mapearResultados(segmentosOBX) {
  const porExamen = {};
  const ignorados = [];
  for (const campos of segmentosOBX) {
    const idCampo = (campos[3] || "").split("^")[0];
    const valorCrudo = campos[5];
    const m = MAPEO[idCampo];
    if (!m) { ignorados.push(idCampo); continue; }
    const n = parseFloat(valorCrudo);
    const valor = isNaN(n) ? valorCrudo : String(n * m.factor);
    if (!porExamen[m.examId]) porExamen[m.examId] = {};
    porExamen[m.examId][m.codigo] = valor;
  }
  return { porExamen, ignorados };
}

module.exports = { MAPEO, mapearResultados };

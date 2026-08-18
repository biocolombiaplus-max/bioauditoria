/* Interfaz BIOsoft — PLANTILLA de mapeo de parámetros para un equipo que
 * habla HL7 (ej. Dymind DF52 y otros analizadores de la familia Dymind
 * DF5x/DH5x, según su documentación pública — ver README.md).
 *
 * ⚠️ Igual que mapeo-generico-template.js (la versión ASTM): este archivo
 * NO tiene códigos reales de ningún equipo — a propósito. Complétalo con
 * los códigos EXACTOS que veas en los segmentos OBX de tu captura real
 * (con capturar-hl7.js, buscando líneas "[OBX] ...").
 *
 * En HL7, cada resultado viene en un segmento OBX así:
 *   OBX|1|NM|WBC^Leucocitos||7.1|10*3/uL|N|||F
 *        |   |________________|  |  |_____|
 *        |   OBX-3: código^nombre |  OBX-6: unidades
 *        OBX-2: tipo de dato       OBX-5: valor
 *
 * El código que importa es la parte ANTES del "^" en OBX-3 (ej. "WBC").
 */
"use strict";

/** código HL7 (parte antes del "^" en OBX-3, ej. "WBC") -> { codigo: código
 * de BIOsoft, factor: multiplicador opcional }. Reemplaza por los códigos
 * reales de tu equipo — está vacío a propósito. */
const MAPEO_EJEMPLO = {
  // "WBC": { codigo: "LEU", factor: 1 },
  // ejemplo (NO USAR TAL CUAL, es solo ilustrativo):
  // "HGB": { codigo: "HB", factor: 1 },
};

/** examId de BIOsoft (catalog.js) al que corresponde este panel del
 * equipo — ej. "HEM-001" para hemograma. */
const EXAM_ID_BIOSOFT = "CAMBIA-ESTE-EXAM-ID";

/** Recibe los segmentos OBX ya separados en arreglos de campos (por "|") y
 * devuelve {valores, ignorados}, igual que la versión ASTM. No necesita
 * cambios: solo llena MAPEO_EJEMPLO arriba. */
function mapearResultados(segmentosOBX) {
  const valores = {};
  const ignorados = [];
  for (const campos of segmentosOBX) {
    const idCampo = (campos[3] || "").split("^")[0];
    const valorCrudo = campos[5];
    const mapeo = MAPEO_EJEMPLO[idCampo];
    if (!mapeo) { ignorados.push(idCampo); continue; }
    const n = parseFloat(valorCrudo);
    valores[mapeo.codigo] = isNaN(n) ? valorCrudo : String(n * mapeo.factor);
  }
  return { valores, ignorados };
}

module.exports = { MAPEO_EJEMPLO, EXAM_ID_BIOSOFT, mapearResultados };

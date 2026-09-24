/* Interfaz BIOsoft — PLANTILLA de mapeo MULTI-EXAMEN (HL7) para un
 * analizador de QUÍMICA que habla HL7/MLLP sobre TCP (ver
 * mapeo-generico-hl7-template.js para un equipo de un solo panel, ej.
 * hematología, y mapeo-generico-multiexamen-template.js para la versión
 * ASTM de esta misma idea).
 *
 * Usa esta plantilla si tu equipo reporta VARIOS parámetros por muestra
 * (Glucosa, Colesterol, Creatinina...) y cada uno es un examen SEPARADO en
 * el catálogo de BIOsoft (QUI-001, QUI-004, QUI-008, etc.) — a diferencia
 * de un hemograma, que es un único examen con varios parámetros adentro.
 *
 * En HL7, cada resultado viene en un segmento OBX así:
 *   OBX|1|NM|GLU^Glucosa||95|mg/dL|70-100|N|||F
 *        |   |___________|  |  |_____|
 *        |   OBX-3: código  |  OBX-6: unidades
 *        OBX-2: tipo de dato OBX-5: valor
 * El código que importa es la parte ANTES del "^" en OBX-3 (ej. "GLU").
 *
 * ⚠️ Este archivo NO tiene códigos reales de ningún equipo — a propósito.
 * Complétalo así:
 * 1. Si el equipo tiene una pantalla de "Correspondencia de test" / "Test
 *    Mapping" (algunos equipos de química la traen, para asignar el código
 *    que cada prueba usará al hablar con el LIS): ANOTA ahí mismo los
 *    códigos que decidas usar (ver más abajo, sección "Códigos sugeridos")
 *    — así controlas tú el código, sin necesitar averiguar el que el
 *    fabricante trae por defecto.
 * 2. Si no la tiene, o para confirmar que de verdad llegan como escribiste:
 *    conecta el equipo real con capturar-hl7.js y corre una muestra de
 *    control — compara los códigos que aparecen en las líneas "[OBX] ..."
 *    de la consola/log contra lo que esperas.
 * 3. Llena MAPEO abajo con esos códigos confirmados, apuntando cada uno al
 *    examId Y código de parámetro correspondiente en BIOsoft (ver
 *    biosoft/js/catalog.js, sección "quimica").
 * 4. Si un examen de BIOsoft tiene más de un parámetro (ej. QUI-011
 *    "Bilirrubinas Total y Directa" = BT + BD + BI), y el equipo reporta
 *    los tres, mapea los tres códigos OBX correspondientes al MISMO
 *    examId — index-hl7.js los agrupa automáticamente.
 */
"use strict";

/** código HL7 (parte antes del "^" en OBX-3) -> { examId: examen de
 * BIOsoft (catalog.js), codigo: código del parámetro DENTRO de ese examen,
 * factor: multiplicador opcional }. Vacío/comentado a propósito. */
const MAPEO = {
  // "CODIGO_LIS": { examId: "QUI-XXX", codigo: "CODIGO_EN_BIOSOFT", factor: 1 },
  // ejemplo (NO USAR TAL CUAL, es solo ilustrativo):
  // "GLU": { examId: "QUI-001", codigo: "GLU", factor: 1 },
};

/** Recibe los segmentos OBX ya separados en arreglos de campos (por "|") y
 * devuelve {porExamen: {examId: {codigo: valor}}, ignorados} — el
 * contrato multi-examen que espera index-hl7.js. */
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

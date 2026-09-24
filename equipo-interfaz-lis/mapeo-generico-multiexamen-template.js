/* Interfaz BIOsoft — PLANTILLA de mapeo MULTI-EXAMEN para un analizador de
 * QUÍMICA (o cualquier equipo donde un solo mensaje puede traer resultados
 * de VARIOS parámetros que son exámenes SEPARADOS en el catálogo de
 * BIOsoft — a diferencia de un hemograma, donde todo el panel es UN solo
 * examen; ver mapeo-generico-template.js para ese caso).
 *
 * Usa esta plantilla si tu equipo es, por ejemplo, un analizador de química
 * sanguínea (Mindray BS-XXX, Dirui CS-T240, Rayto, etc.) que procesa varias
 * pruebas por muestra (Glucosa, Colesterol, Creatinina...), cada una con su
 * propio examId en catalog.js (QUI-001, QUI-004, QUI-008, etc.).
 *
 * ⚠️ Este archivo NO tiene códigos reales de ninguna marca — a propósito.
 * No existe forma honesta de "adivinar" los códigos ASTM exactos de un
 * equipo sin haberlo visto transmitir. Complétalo así:
 *
 * 1. Conecta el equipo real con `verboso: true` en config.json y corre una
 *    muestra de control (o busca "protocolo de comunicación"/"host
 *    interface" en el manual técnico del equipo — muchos fabricantes sí lo
 *    documentan).
 * 2. Observa en consola los registros "R" que llegan — el 3er campo
 *    (separado por `|`) es el código de cada parámetro, ej. "^^^GLU" o
 *    "^^^CHOL". Copia el código EXACTO que veas, letra por letra.
 * 3. Llena MAPEO abajo con esos códigos reales, apuntando cada uno al
 *    examId Y código de parámetro correspondiente en BIOsoft (los ves en
 *    biosoft/js/catalog.js: cada examen de química tiene su propio
 *    "parametros: [num(\"CODIGO\", ...)]" — ej. QUI-004 "Colesterol Total"
 *    usa el código "COLT").
 * 4. Cambia el nombre de este archivo (ej. "dirui-cst240-map.js") y ponlo
 *    en "archivoMapeo" dentro de config.json.
 * 5. Si un examen de BIOsoft tiene más de un parámetro (ej. QUI-011
 *    "Bilirrubinas Total y Directa" = BT + BD + BI), y tu equipo reporta
 *    los tres, mapea las tres líneas ASTM correspondientes al MISMO
 *    examId — index.js las agrupa automáticamente y las escribe juntas.
 * 6. Si el equipo reporta un parámetro que BIOsoft no tiene en su
 *    catálogo, NO inventes un examId ni un código — déjalo sin mapear y
 *    coméntalo, igual que se hace con MONO/EOS/BASO en mindray-bc10-map.js
 *    para un hematológico de 3 poblaciones.
 */
"use strict";

/** campoASTM (tal como aparece en el 3er campo `|` del registro R) ->
 * { examId: examen de BIOsoft al que pertenece este parámetro (catalog.js),
 *   codigo: código del parámetro DENTRO de ese examen,
 *   factor: multiplicador opcional si las unidades del equipo no coinciden
 *   1 a 1 con las de BIOsoft }. Reemplaza este objeto de ejemplo por los
 * códigos reales de tu equipo — está vacío/comentado a propósito. */
const MAPEO = {
  // "^^^CODIGO_REAL_DEL_EQUIPO": { examId: "QUI-XXX", codigo: "CODIGO_EN_BIOSOFT", factor: 1 },
  // ejemplo (NO USAR TAL CUAL, es solo ilustrativo):
  // "^^^GLU": { examId: "QUI-001", codigo: "GLU", factor: 1 },
};

/** Convierte los registros "R" ya parseados por astm.js en
 * {porExamen: {examId: {codigo: valor, ...}, ...}, ignorados: [...]} —
 * el contrato que index.js espera de un mapeo multi-examen (ver
 * agruparPorExamen() en index.js). Esta función NO necesita cambios: solo
 * llena MAPEO arriba. */
function mapearResultados(registrosR) {
  const porExamen = {};
  const ignorados = [];
  for (const r of registrosR) {
    const campoASTM = r.campos[2]; // R|seq|^^^TEST|valor|unidades|...
    const valorCrudo = r.campos[3];
    const m = MAPEO[campoASTM];
    if (!m) { ignorados.push(campoASTM); continue; }
    const n = parseFloat(valorCrudo);
    const valor = isNaN(n) ? valorCrudo : String(n * m.factor);
    if (!porExamen[m.examId]) porExamen[m.examId] = {};
    porExamen[m.examId][m.codigo] = valor;
  }
  return { porExamen, ignorados };
}

module.exports = { MAPEO, mapearResultados };

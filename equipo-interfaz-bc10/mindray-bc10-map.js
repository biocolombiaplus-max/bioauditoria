/* Interfaz BIOsoft — Mapeo de parámetros: Mindray BC-10 (ASTM) -> BIOsoft.
 *
 * ⚠️ PLANTILLA SIN VERIFICAR CONTRA EL EQUIPO REAL — ver README.md.
 *
 * El BC-10 es un analizador de 3 poblaciones (3-part diff): reporta
 * LYM% (linfocitos), MID%/MXD% (mezcla de monocitos+eosinófilos+basófilos)
 * y GRAN% (granulocitos, aproxima neutrófilos) — NO reporta monocitos,
 * eosinófilos ni basófilos por separado como sí lo hace un analizador de
 * 5 poblaciones. Por eso, en el mapeo de abajo:
 *   - HB, HTO, LEU, PLT, VCM, HCM, CHCM, RDW: parámetros "core" que
 *     prácticamente todo analizador de hematología reporta — mapeo de
 *     bajo riesgo, pero AÚN ASÍ sin confirmar contra el equipo real.
 *   - NEUT se aproxima desde GRAN% y LINF desde LYM% — son aproximaciones
 *     clínicamente razonables pero no idénticas a un recuento de 5 partes.
 *   - MONO, EOS, BASO: el BC-10 NO los mide individualmente. Se dejan
 *     comentados a propósito — NO inventes un valor para ellos. Si tu
 *     laboratorio los necesita, se digitan manualmente como siempre
 *     (extendido de sangre periférica u otro método).
 *
 * Los nombres de campo de la columna izquierda (ej. "^^^WBC") son los que
 * suelen aparecer en mensajes ASTM de hematología en general — DEBEN
 * confirmarse contra los mensajes reales que transmita tu BC-10 (ver
 * README.md, sección "Cómo capturar y confirmar los códigos reales").
 */
"use strict";

/** campoASTM (tal como aparece en el 3er campo `|` del registro R, ej.
 * "^^^WBC") -> { codigo: código del parámetro en BIOsoft (catalog.js,
 * examen HEM-001), factor: multiplicador opcional si las unidades no
 * coinciden 1 a 1 (ej. equipo en x10^9/L y BIOsoft en x10³/µL, que son
 * numéricamente iguales, factor 1) }. */
const MAPEO_HEM001 = {
  "^^^WBC": { codigo: "LEU", factor: 1 },
  "^^^HGB": { codigo: "HB", factor: 1 },
  "^^^HCT": { codigo: "HTO", factor: 1 },
  "^^^PLT": { codigo: "PLT", factor: 1 },
  "^^^MCV": { codigo: "VCM", factor: 1 },
  "^^^MCH": { codigo: "HCM", factor: 1 },
  "^^^MCHC": { codigo: "CHCM", factor: 1 },
  "^^^RDW": { codigo: "RDW", factor: 1 },
  // Aproximaciones de 3 poblaciones -> 5 poblaciones (ver aviso arriba):
  "^^^LYM%": { codigo: "LINF", factor: 1, aproximado: true },
  "^^^GRAN%": { codigo: "NEUT", factor: 1, aproximado: true }
  // "^^^MID%" / "^^^MXD%" (monocitos+eosinófilos+basófilos combinados) NO
  // se mapea a MONO/EOS/BASO por separado — sería inventar un dato que el
  // equipo no está midiendo individualmente.
};

/** examId de BIOsoft (catalog.js) al que corresponde este panel del equipo. */
const EXAM_ID_BIOSOFT = "HEM-001";

/** Convierte los registros "R" ya parseados por astm.js en el objeto
 * {codigo: valor} que espera BIO_STORE.recibirResultadoEquipo /
 * el escritor de Firestore (firestore-writer.js). Los campos que no están
 * en MAPEO_HEM001 se ignoran (con una advertencia en consola) en vez de
 * fallar todo el mensaje — así un campo nuevo/inesperado no bloquea el
 * resto de valores que sí se reconocen. */
function mapearResultados(registrosR) {
  const valores = {};
  const ignorados = [];
  for (const r of registrosR) {
    const campoASTM = r.campos[2]; // R|seq|^^^TEST|valor|unidades|...
    const valorCrudo = r.campos[3];
    const mapeo = MAPEO_HEM001[campoASTM];
    if (!mapeo) { ignorados.push(campoASTM); continue; }
    const n = parseFloat(valorCrudo);
    valores[mapeo.codigo] = isNaN(n) ? valorCrudo : String(n * mapeo.factor);
  }
  return { valores, ignorados };
}

module.exports = { MAPEO_HEM001, EXAM_ID_BIOSOFT, mapearResultados };

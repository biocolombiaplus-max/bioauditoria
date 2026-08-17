/* Interfaz BIOsoft — PLANTILLA de mapeo de parámetros para un equipo NUEVO
 * (Dirui CS-T240, Dymind DF52, Maglumi 800, Rayto, Mindray química, o
 * cualquier otro analizador que hable ASTM E1394).
 *
 * ⚠️ Este archivo NO tiene códigos reales de ninguna marca — a propósito.
 * No existe forma honesta de "adivinar" los códigos ASTM exactos de un
 * equipo sin haberlo visto transmitir. Complétalo así:
 *
 * 1. Conecta el equipo real con `verboso: true` en config.json y corre
 *    una muestra de control (o usa el manual del equipo si documenta su
 *    salida ASTM/host — muchos fabricantes sí lo hacen, busca "protocolo
 *    de comunicación" o "host interface" en el manual técnico).
 * 2. Observa en consola los registros "R" que llegan — el 3er campo
 *    (separado por `|`) es el código de cada parámetro, ej. "^^^GLU" o
 *    "^^^WBC". Copia el código EXACTO que veas, letra por letra.
 * 3. Llena MAPEO_EJEMPLO abajo con esos códigos reales, apuntando cada
 *    uno al código de parámetro correspondiente en BIOsoft (los ves en
 *    biosoft/js/catalog.js, dentro de la definición de cada examen —
 *    ej. examen "QUI-001" usa el código "GLU" para glucosa).
 * 4. Cambia el nombre de este archivo (ej. "dirui-cst240-map.js") y
 *    ponlo en "archivoMapeo" dentro de config.json.
 * 5. Si el equipo reporta un parámetro que BIOsoft no puede recibir por
 *    separado (como pasa con MONO/EOS/BASO en un analizador de 3
 *    poblaciones — ver mindray-bc10-map.js), NO inventes un valor: déjalo
 *    sin mapear y coméntalo, igual que se hizo ahí.
 */
"use strict";

/** campoASTM (tal como aparece en el 3er campo `|` del registro R) ->
 * { codigo: código del parámetro en BIOsoft, factor: multiplicador
 * opcional si las unidades del equipo no coinciden 1 a 1 con las de
 * BIOsoft }. Reemplaza este objeto de ejemplo por los códigos reales de
 * tu equipo — está vacío/comentado a propósito. */
const MAPEO_EJEMPLO = {
  // "^^^CODIGO_REAL_DEL_EQUIPO": { codigo: "CODIGO_EN_BIOSOFT", factor: 1 },
  // ejemplo (NO USAR TAL CUAL, es solo ilustrativo):
  // "^^^GLU": { codigo: "GLU", factor: 1 },
};

/** examId de BIOsoft (catalog.js) al que corresponde este panel del
 * equipo — ej. "QUI-001" para química básica, "HEM-001" para hemograma.
 * Cambia esto según el examen real que reporte tu equipo. */
const EXAM_ID_BIOSOFT = "CAMBIA-ESTE-EXAM-ID";

/** Convierte los registros "R" ya parseados por astm.js en el objeto
 * {codigo: valor} que espera BIO_STORE.recibirResultadoEquipo /
 * firestore-writer.js. Los campos que no están en MAPEO_EJEMPLO se
 * ignoran (con una advertencia en consola) en vez de fallar todo el
 * mensaje — así un campo nuevo/inesperado no bloquea el resto de
 * valores que sí se reconocen. Esta función NO necesita cambios: solo
 * llena MAPEO_EJEMPLO arriba. */
function mapearResultados(registrosR) {
  const valores = {};
  const ignorados = [];
  for (const r of registrosR) {
    const campoASTM = r.campos[2]; // R|seq|^^^TEST|valor|unidades|...
    const valorCrudo = r.campos[3];
    const mapeo = MAPEO_EJEMPLO[campoASTM];
    if (!mapeo) { ignorados.push(campoASTM); continue; }
    const n = parseFloat(valorCrudo);
    valores[mapeo.codigo] = isNaN(n) ? valorCrudo : String(n * mapeo.factor);
  }
  return { valores, ignorados };
}

module.exports = { MAPEO_EJEMPLO, EXAM_ID_BIOSOFT, mapearResultados };

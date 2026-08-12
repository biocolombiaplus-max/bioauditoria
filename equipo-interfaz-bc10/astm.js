/* Interfaz BIOsoft — Capa de protocolo ASTM E1394-97 (bajo nivel, serial).
 *
 * Esta parte del código implementa el ESTÁNDAR de la industria (no algo
 * específico de Mindray): el "handshake" ENQ/ACK/NAK, el armado/verificación
 * de checksum de cada trama, la reconstrucción de tramas aunque lleguen
 * fragmentadas por el puerto serial, y el particionado del texto ya
 * reensamblado en registros (H/P/O/R/C/L). Es la misma lógica de bajo nivel
 * que usan la gran mayoría de analizadores de laboratorio que hablan
 * ASTM E1394 / LIS2-A2 por puerto serial — no es específica de Mindray.
 *
 * Lo que esta capa NO puede garantizar sin probarse contra un equipo real:
 * si el Mindray BC-10 respeta el estándar al pie de la letra (algunos
 * fabricantes tienen pequeñas variaciones) y los tiempos de espera exactos
 * que tolera antes de reintentar. Ver README.md, sección "Qué falta
 * validar con el equipo real".
 */
"use strict";

const ENQ = 0x05, ACK = 0x06, NAK = 0x15, STX = 0x02, ETX = 0x03, ETB = 0x17, EOT = 0x04, CR = 0x0d, LF = 0x0a;

/** Suma de bytes mod 256, como exige ASTM, expresada en 2 dígitos hex mayúscula. */
function checksum(bytes) {
  let sum = 0;
  for (const b of bytes) sum = (sum + b) % 256;
  return sum.toString(16).toUpperCase().padStart(2, "0");
}

/** Arma una trama STX...checksum CRLF lista para enviar. BIOsoft no necesita
 * transmitir datos al equipo (el BC-10 solo envía resultados), pero se deja
 * disponible por si se necesita para otro analizador que sí requiera
 * confirmaciones a nivel de aplicación. */
function buildFrame(frameNumber, text, isLast) {
  const control = isLast ? ETX : ETB;
  const body = Buffer.concat([Buffer.from(String(frameNumber % 8)), Buffer.from(text, "ascii"), Buffer.from([control])]);
  const cs = checksum(body);
  return Buffer.concat([Buffer.from([STX]), body, Buffer.from([CR, LF]), Buffer.from(cs, "ascii"), Buffer.from([CR, LF])]);
}

/** Divide el texto de un registro ASTM en sus campos separados por "|".
 * El primer campo es el tipo de registro (H, P, O, R, C, Q, L). */
function splitFields(record) {
  return record.split("|");
}

/** Reensambla el texto acumulado de todas las tramas de un mensaje en
 * registros individuales (separados por CR) y los devuelve ya divididos
 * en campos, con su tipo (H/P/O/R/C/Q/L) identificado. */
function parseRecords(textoAcumulado) {
  return textoAcumulado
    .split(String.fromCharCode(CR))
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const campos = splitFields(linea);
      return { tipo: campos[0], campos };
    });
}

/**
 * Receptor con buffer interno: se le van entregando chunks de bytes tal
 * cual llegan del puerto serial (que pueden partir una trama en cualquier
 * punto — un solo byte a la vez, en el peor caso) y va reconociendo:
 *   ENQ         -> onControl(ACK) — siempre acepta, BIOsoft nunca está "ocupado"
 *   trama STX…  -> valida checksum; onControl(ACK) si es válida, onControl(NAK) si no
 *                  (una trama inválida NO se descarta de por sí — se vuelve a pedir)
 *   EOT         -> onMessage(registros) con todo lo acumulado en la transmisión,
 *                  ya separado en registros H/P/O/R/C/L
 * onControl recibe el byte (ACK o NAK) que el llamador debe escribir de
 * vuelta al puerto serial para que el equipo continúe la transmisión.
 */
function createReceiver({ onControl, onMessage, onError, onFrame }) {
  let buffer = Buffer.alloc(0);
  let textoAcumulado = "";

  function tryConsume() {
    while (buffer.length > 0) {
      const primero = buffer[0];

      if (primero === ENQ) {
        buffer = buffer.slice(1);
        textoAcumulado = "";
        onControl && onControl(ACK);
        continue;
      }

      if (primero === EOT) {
        buffer = buffer.slice(1);
        if (textoAcumulado) {
          try {
            const registros = parseRecords(textoAcumulado);
            onMessage && onMessage(registros);
          } catch (e) {
            onError && onError(e);
          }
        }
        textoAcumulado = "";
        continue;
      }

      if (primero === STX) {
        // Busca el byte de control (ETB o ETX) que cierra el cuerpo de la trama.
        let ctrlIdx = -1;
        for (let i = 1; i < buffer.length; i++) {
          if (buffer[i] === ETB || buffer[i] === ETX) { ctrlIdx = i; break; }
        }
        if (ctrlIdx === -1) return; // trama incompleta todavía — espera más bytes
        // Después del byte de control vienen: CR LF <2 chars checksum> CR LF
        const bytesNecesarios = ctrlIdx + 1 + 6;
        if (buffer.length < bytesNecesarios) return; // aún no llegó el checksum completo

        const cuerpo = buffer.slice(1, ctrlIdx + 1); // frameNumber + texto + control
        const csRecibido = buffer.slice(ctrlIdx + 3, ctrlIdx + 5).toString("ascii").toUpperCase();
        const csCalculado = checksum(cuerpo);
        const frameNumber = String.fromCharCode(cuerpo[0]);
        const texto = cuerpo.slice(1, cuerpo.length - 1).toString("ascii");

        buffer = buffer.slice(bytesNecesarios);

        if (csRecibido !== csCalculado) {
          onControl && onControl(NAK);
          onError && onError(new Error("Checksum inválido en trama " + frameNumber + " (recibido " + csRecibido + ", calculado " + csCalculado + ")"));
          continue;
        }
        textoAcumulado += texto;
        onFrame && onFrame({ frameNumber, texto, esUltima: buffer[ctrlIdx] === ETX });
        onControl && onControl(ACK);
        continue;
      }

      // Byte suelto que no reconocemos (ruido de línea, CR/LF entre tramas, etc.) — se descarta.
      buffer = buffer.slice(1);
    }
  }

  function feed(chunk) {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    tryConsume();
  }

  return { feed };
}

module.exports = { ENQ, ACK, NAK, STX, ETX, ETB, EOT, CR, LF, checksum, buildFrame, splitFields, parseRecords, createReceiver };

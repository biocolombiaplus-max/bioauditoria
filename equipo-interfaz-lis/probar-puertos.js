/* BIOsoft — Escáner automático de puerto/baudios para cable SERIAL.
 * Antes de usar capturar.js con un puerto y velocidad adivinados, esta
 * herramienta prueba automáticamente las combinaciones más comunes y te
 * dice cuáles muestran actividad (bytes llegando) — así no pierdes tiempo
 * probando una por una a mano frente al cliente.
 *
 * Uso:
 *   node probar-puertos.js            (lista los puertos disponibles)
 *   node probar-puertos.js COM3       (prueba TODOS los baudios comunes en ese puerto)
 *
 * IMPORTANTE: en el equipo real, ve corriendo una muestra de control de
 * forma REPETIDA mientras este script prueba — como no sabemos el momento
 * exacto en que el equipo transmite, entre más veces la corras mientras
 * el script prueba, más chance de que coincida con el baudios correcto.
 */
"use strict";
const { SerialPort } = require("serialport");

const puerto = process.argv[2];

// Los baudios más comunes en equipos de laboratorio con salida ASTM/serial,
// de más a menos frecuente.
const BAUDIOS_COMUNES = [9600, 19200, 38400, 4800, 57600, 115200, 2400, 1200];
const MS_POR_PRUEBA = 4000;

async function listarPuertos() {
  const puertos = await SerialPort.list();
  if (!puertos.length) {
    console.log("\nNo se detectó ningún puerto serial. Revisa que:");
    console.log("  1. El cable del equipo esté conectado a esta computadora.");
    console.log("  2. Si es un cable USB-a-serial, tenga el driver instalado.");
    console.log("  3. El equipo esté encendido.\n");
    return;
  }
  console.log("\nPuertos seriales disponibles:");
  puertos.forEach((p) => console.log(`  - ${p.path}${p.manufacturer ? "  (" + p.manufacturer + ")" : ""}`));
  console.log("\nEjecuta: node probar-puertos.js " + puertos[0].path + "\n");
}

const ENQ = 0x05;

function probarBaudRate(path, baudRate) {
  return new Promise((resolve) => {
    let bytesRecibidos = 0;
    let vioENQ = false; // el byte de inicio real de una transmisión ASTM — verlo
    // es una señal MUCHO más confiable de "esta es la velocidad correcta"
    // que solo contar bytes, porque a la velocidad incorrecta también
    // suelen llegar bytes (corrompidos/ruido), pero ver un ENQ limpio casi
    // nunca pasa por casualidad.
    let yaResolvio = false;
    function resolverUnaVez(resultado) {
      if (yaResolvio) return;
      yaResolvio = true;
      resolve(resultado);
    }
    let port;
    try {
      port = new SerialPort({ path, baudRate, dataBits: 8, parity: "none", stopBits: 1 });
    } catch (e) {
      resolverUnaVez({ baudRate, error: e.message, bytes: 0 });
      return;
    }
    // Un error al ABRIR el puerto (nombre mal escrito, puerto ocupado por
    // otro programa, cable desconectado) es un problema distinto a "no
    // llegaron datos con ESTOS baudios" — se reporta aparte y de inmediato,
    // sin esperar los 4 segundos completos ni seguir probando en vano.
    port.on("error", (e) => resolverUnaVez({ baudRate, error: e.message, bytes: 0 }));
    port.on("data", (chunk) => {
      bytesRecibidos += chunk.length;
      if (chunk.includes(ENQ)) vioENQ = true;
    });
    setTimeout(() => {
      if (yaResolvio) return;
      port.close(() => resolverUnaVez({ baudRate, bytes: bytesRecibidos, vioENQ }));
    }, MS_POR_PRUEBA);
  });
}

async function main() {
  if (!puerto) { await listarPuertos(); return; }

  console.log(`\nProbando ${BAUDIOS_COMUNES.length} velocidades comunes en ${puerto}, ${MS_POR_PRUEBA / 1000}s cada una (~${Math.round(BAUDIOS_COMUNES.length * MS_POR_PRUEBA / 1000)}s en total).`);
  console.log("👉 Ve corriendo una muestra de control en el equipo, repetidas veces, mientras esto corre.\n");

  const resultados = [];
  for (const baudRate of BAUDIOS_COMUNES) {
    process.stdout.write(`  Probando ${baudRate} baudios... `);
    const r = await probarBaudRate(puerto, baudRate);
    if (r.error) {
      console.log(`❌ el puerto no se pudo abrir (${r.error})`);
      console.log(`\nSe detiene aquí — si el puerto mismo no abre, no tiene caso seguir probando velocidades.`);
      console.log(`Revisa: ¿escribiste bien "${puerto}"? ¿otro programa (como capturar.js) ya lo tiene abierto? ¿el cable sigue conectado?\n`);
      return;
    }
    if (r.vioENQ) console.log(`¡${r.bytes} byte(s), con ENQ (inicio ASTM) reconocido! 🎯🎯 Esta es casi seguro la velocidad correcta.`);
    else console.log(r.bytes > 0 ? `${r.bytes} byte(s) recibidos, pero sin el patrón ASTM reconocible (puede ser ruido o la velocidad incorrecta)` : "sin actividad");
    resultados.push(r);
  }

  const conENQ = resultados.filter((r) => r.vioENQ);
  const conActividad = resultados.filter((r) => r.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  console.log("\n========== RESULTADO ==========");
  if (conENQ.length) {
    console.log("✅ Velocidad(es) con el patrón ASTM (ENQ) reconocido — usa esta con confianza:");
    conENQ.forEach((r) => console.log(`  🎯 ${r.baudRate} baudios`));
    console.log(`\nUsa así: node capturar.js ${puerto} ${conENQ[0].baudRate}`);
  } else if (conActividad.length) {
    console.log("Hubo actividad, pero sin el patrón ASTM claro (puede ser ruido, o el equipo habla otro protocolo como HL7 — ver capturar-hl7.js):");
    conActividad.forEach((r) => console.log(`  ⚠️ ${r.baudRate} baudios — ${r.bytes} byte(s), sin ENQ`));
    console.log(`\nPrueba de todas formas con el que tenga más bytes: node capturar.js ${puerto} ${conActividad[0].baudRate}`);
  } else {
    console.log("❌ Ninguna velocidad mostró actividad. Revisa:");
    console.log("  - ¿El equipo está encendido y con el modo 'Host'/'LIS'/'Comunicación' activado?");
    console.log("  - ¿El cable está bien conectado (y no es un cable de solo carga, si es USB)?");
    console.log("  - ¿Corriste una muestra de control MIENTRAS este script probaba?");
    console.log("  - Si nada de esto ayuda, puede que este equipo no use cable serial — prueba con capturar-tcp.js o capturar-hl7.js (ver README.md).");
  }
  console.log("================================\n");
}

main();

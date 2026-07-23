/* BIOsoft — Control de Calidad: catálogo de analitos y motor de reglas de
   Westgard. Este motor es un sistema experto determinístico (el mismo
   enfoque que usan Bio-Rad Unity y otros software de control de calidad
   reales) — no depende de ningún servicio externo de IA generativa. */
(function (global) {
  "use strict";

  var ANALITOS = {
    quimica: [
      { codigo: "GLU", nombre: "Glucosa", unidad: "mg/dL" },
      { codigo: "COLT", nombre: "Colesterol Total", unidad: "mg/dL" },
      { codigo: "HDL", nombre: "Colesterol HDL", unidad: "mg/dL" },
      { codigo: "LDL", nombre: "Colesterol LDL", unidad: "mg/dL" },
      { codigo: "TGD", nombre: "Triglicéridos", unidad: "mg/dL" },
      { codigo: "CREA", nombre: "Creatinina", unidad: "mg/dL" },
      { codigo: "BUN", nombre: "Nitrógeno Ureico (BUN)", unidad: "mg/dL" },
      { codigo: "AUR", nombre: "Ácido Úrico", unidad: "mg/dL" }
    ],
    hematologia: [
      { codigo: "HB", nombre: "Hemoglobina", unidad: "g/dL" },
      { codigo: "HTO", nombre: "Hematocrito", unidad: "%" },
      { codigo: "LEU", nombre: "Leucocitos", unidad: "x10³/µL" },
      { codigo: "PLT", nombre: "Plaquetas", unidad: "x10³/µL" },
      { codigo: "VCM", nombre: "VCM", unidad: "fL" },
      { codigo: "HCM", nombre: "HCM", unidad: "pg" },
      { codigo: "CHCM", nombre: "CHCM", unidad: "g/dL" }
    ]
  };

  var NIVELES = ["Normal", "Patológico Bajo", "Patológico Alto"];

  var RECOMENDACIONES = {
    "1_2s": "Aviso (1-2s): un punto superó 2 DS. Todavía no rechaces el resultado, pero revisa las demás reglas con este mismo dato antes de liberar pacientes.",
    "1_3s": "Rechazo (1-3s) — posible ERROR ALEATORIO: un punto superó 3 DS. Revisa burbujas de aire, coágulos, mezcla del control o un vial mal reconstituido, y repite con un vial nuevo.",
    "2_2s": "Rechazo (2-2s) — posible ERROR SISTEMÁTICO: dos puntos consecutivos del mismo lado superaron 2 DS. Revisa la calibración del equipo y el vencimiento del lote de reactivos/control.",
    "R_4s": "Rechazo (R-4s) — posible ERROR ALEATORIO: el rango entre dos puntos consecutivos superó 4 DS. Verifica la precisión (imprecisión) del equipo y repite la medición.",
    "4_1s": "Rechazo (4-1s) — posible ERROR SISTEMÁTICO (deriva leve): cuatro puntos seguidos del mismo lado superaron 1 DS. Puede haber deriva de calibración o deterioro progresivo del reactivo.",
    "10x": "Rechazo (10x) — CORRIMIENTO sostenido: diez puntos seguidos cayeron del mismo lado de la media. Revisa si hubo cambio de lote sin recalibrar o una deriva no detectada del equipo."
  };

  var RECHAZO = { "1_3s": true, "2_2s": true, "R_4s": true, "4_1s": true, "10x": true };

  /* valores: arreglo de números en orden cronológico (el último es el dato
     nuevo a evaluar). media/ds: valores objetivo del lote de control.
     Devuelve { z, reglas: [...códigos violados...], estado: "control"|"aviso"|"rechazo", recomendaciones: [...] } */
  function evaluar(valores, media, ds) {
    if (!ds || ds <= 0) return { z: null, reglas: [], estado: "control", recomendaciones: ["Define la media y la desviación estándar (DS) del control para poder evaluar las reglas de Westgard."] };
    var n = valores.length;
    var z = function (v) { return (v - media) / ds; };
    var actual = valores[n - 1];
    var zActual = z(actual);
    var reglas = [];

    if (Math.abs(zActual) > 2) reglas.push("1_2s");
    if (Math.abs(zActual) > 3) reglas.push("1_3s");

    if (n >= 2) {
      var zPrev = z(valores[n - 2]);
      if ((zActual > 2 && zPrev > 2) || (zActual < -2 && zPrev < -2)) reglas.push("2_2s");
      if (Math.abs(zActual - zPrev) > 4) reglas.push("R_4s");
    }

    if (n >= 4) {
      var ult4 = valores.slice(n - 4).map(z);
      if (ult4.every(function (x) { return x > 1; }) || ult4.every(function (x) { return x < -1; })) reglas.push("4_1s");
    }

    if (n >= 10) {
      var ult10 = valores.slice(n - 10).map(z);
      if (ult10.every(function (x) { return x > 0; }) || ult10.every(function (x) { return x < 0; })) reglas.push("10x");
    }

    var hayRechazo = reglas.some(function (r) { return RECHAZO[r]; });
    var estado = hayRechazo ? "rechazo" : (reglas.indexOf("1_2s") !== -1 ? "aviso" : "control");
    var recomendaciones = reglas.length
      ? reglas.map(function (r) { return RECOMENDACIONES[r]; })
      : ["✅ Dentro de control. Ninguna regla de Westgard se violó con este dato."];

    return { z: zActual, reglas: reglas, estado: estado, recomendaciones: recomendaciones };
  }

  global.BIO_QC = { ANALITOS: ANALITOS, NIVELES: NIVELES, evaluar: evaluar };
})(window);

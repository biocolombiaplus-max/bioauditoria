/* BIOsoft — Actualización automática de la tasa de cambio oficial del
   Banco Central de Venezuela (BCV), para laboratorios de Venezuela que
   activaron "Actualizar automáticamente" en Cotizador → "Tu moneda y la
   tasa de cambio del día" (ver tenant.monedaAdicional.automatico).

   Se dispara UNA vez por sesión, justo al entrar a la aplicación (ver
   showApp() en router.js) — nunca más de una vez por día por laboratorio:
   si la tasa guardada ya es de hoy, no hace nada. NUNCA bloquea ni rompe
   nada si falla (sin internet, el servicio de terceros caído, una
   respuesta inesperada, etc.) — simplemente se queda con la última tasa
   conocida hasta que la próxima sesión (de cualquier usuario de ese
   laboratorio) lo vuelva a intentar.

   El BCV no publica una API propia de uso público — se usa dolarapi.com,
   un servicio gratuito, sin llave de acceso, ampliamente usado en la
   comunidad de desarrolladores de Venezuela, que replica la tasa OFICIAL
   que el BCV publica cada día hábil (nunca la tasa paralela/del mercado
   negro). El laboratorio puede desactivar esto cuando quiera y volver a
   digitar la tasa a mano desde el mismo lugar. */
(function (global) {
  "use strict";

  var URL_TASA_BCV = "https://ve.dolarapi.com/v1/dolares/oficial";
  var MONEDAS_DURAS = ["USD", "EUR"];

  function hoyISO() {
    var h = new Date();
    return h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0") + "-" + String(h.getDate()).padStart(2, "0");
  }

  // Pide la tasa oficial BCV (bolívares por 1 dólar) — rechaza la promesa
  // si la respuesta no trae un número usable, para que el llamador nunca
  // guarde "0" ni "NaN" como si fuera una tasa real.
  function obtenerTasaBCV() {
    return fetch(URL_TASA_BCV).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      var tasa = Number(data && (data.promedio || data.venta || data.compra));
      if (!tasa || !isFinite(tasa) || tasa <= 0) throw new Error("La respuesta del servicio de tasa no trajo un valor válido.");
      return tasa;
    });
  }

  // La moneda adicional siempre guarda la MISMA cifra que publica el BCV
  // (bolívares por 1 dólar — ver el comentario de convertirMonedaAdicional
  // en catalog.js), pero su "codigo" debe ser la moneda que NO sea la base
  // del laboratorio: si el laboratorio tiene sus precios en dólares, la
  // adicional es VES; si los tiene en bolívares, la adicional es USD.
  function codigoAdicionalBCV(tenant) {
    var base = (tenant && tenant.monedaBase) || "USD";
    return base === "VES" ? "USD" : "VES";
  }

  function actualizarSiCorresponde() {
    try {
      var session = global.BIO_AUTH && global.BIO_AUTH.getSession();
      if (!session || session.rol === "superadmin" || session.rol === "aliado") return;
      var tenant = global.BIO_AUTH.currentTenant();
      if (!tenant || tenant.pais !== "VE") return;
      var moneda = tenant.monedaAdicional;
      if (!moneda || !moneda.automatico) return;
      if (moneda.fecha === hoyISO()) return; // ya está al día, no hay nada que hacer
      obtenerTasaBCV().then(function (tasa) {
        var nuevaMoneda = { codigo: codigoAdicionalBCV(tenant), tasa: tasa, fecha: hoyISO(), actualizada: new Date().toISOString(), automatico: true };
        tenant.monedaAdicional = nuevaMoneda;
        global.BIO_STORE.updateTenant(tenant.id, { monedaAdicional: nuevaMoneda });
      }).catch(function (err) {
        console.warn("BIOsoft: no se pudo actualizar la tasa BCV automáticamente ->", err);
      });
    } catch (err) {
      console.warn("BIOsoft: error inesperado al intentar actualizar la tasa BCV ->", err);
    }
  }

  global.BIO_TASA_BCV = { actualizarSiCorresponde: actualizarSiCorresponde, obtenerTasaBCV: obtenerTasaBCV, codigoAdicionalBCV: codigoAdicionalBCV };
})(window);

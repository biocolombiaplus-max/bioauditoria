/* BIOsoft — Captura de WhatsApp antes de "Ver Demo Gratis", COMPARTIDA entre
   index.html (landing completa) y app.html (pantalla de login/acceso rápido
   a la demo, #btn-demo-quick) — hay DOS puntos de entrada distintos a la
   demo, y un visitante puede llegar directo a cualquiera de los dos sin
   pasar por el otro, así que ambos necesitan pedir el WhatsApp antes de
   dejar entrar. Antes esta lógica (lista de países, detección de país,
   guardado en el CRM) solo existía dentro de index.html — app.html tenía su
   propio botón de demo que entraba directo, sin pedir ni guardar nada, y
   esos visitantes se perdían por completo para el CRM/remarketing (bug real
   reportado: "le doy Ver Demo y no pide WhatsApp").

   Este archivo SOLO expone datos y funciones puras (lista de países,
   detección, armado del lead, guardado en Firestore) — cada página sigue
   dibujando su propio modal con su propio sistema visual (index.html usa
   lpModal/clases .lp-*, app.html usa U.openModal/clases .field, .btn, que
   ya vienen de ui.js y css/styles.css), para no forzarlas a verse idénticas
   ni depender una de la otra. */
(function (global) {
  "use strict";

  // "digitos": largo típico del número local (sin indicativo) para ese
  // país — se usa para el placeholder de ejemplo y para avisar si el
  // número escrito parece incompleto (nunca bloquea del todo: un dato de
  // origen real vale más que una validación perfecta).
  var PAISES = [
    { nombre: "Colombia", cod: "CO", dial: "57", bandera: "🇨🇴", digitos: 10, ejemplo: "300 123 4567" },
    { nombre: "Venezuela", cod: "VE", dial: "58", bandera: "🇻🇪", digitos: 10, ejemplo: "414 123 4567" },
    { nombre: "Ecuador", cod: "EC", dial: "593", bandera: "🇪🇨", digitos: 9, ejemplo: "99 123 4567" },
    { nombre: "México", cod: "MX", dial: "52", bandera: "🇲🇽", digitos: 10, ejemplo: "55 1234 5678" },
    { nombre: "Perú", cod: "PE", dial: "51", bandera: "🇵🇪", digitos: 9, ejemplo: "912 345 678" },
    { nombre: "Chile", cod: "CL", dial: "56", bandera: "🇨🇱", digitos: 9, ejemplo: "9 1234 5678" },
    { nombre: "Argentina", cod: "AR", dial: "54", bandera: "🇦🇷", digitos: 10, ejemplo: "11 1234 5678" },
    { nombre: "Panamá", cod: "PA", dial: "507", bandera: "🇵🇦", digitos: 8, ejemplo: "6123 4567" },
    { nombre: "República Dominicana", cod: "DO", dial: "1", bandera: "🇩🇴", digitos: 10, ejemplo: "809 123 4567" },
    { nombre: "Costa Rica", cod: "CR", dial: "506", bandera: "🇨🇷", digitos: 8, ejemplo: "8123 4567" },
    { nombre: "Guatemala", cod: "GT", dial: "502", bandera: "🇬🇹", digitos: 8, ejemplo: "5123 4567" },
    { nombre: "Honduras", cod: "HN", dial: "504", bandera: "🇭🇳", digitos: 8, ejemplo: "9123 4567" },
    { nombre: "El Salvador", cod: "SV", dial: "503", bandera: "🇸🇻", digitos: 8, ejemplo: "7123 4567" },
    { nombre: "Nicaragua", cod: "NI", dial: "505", bandera: "🇳🇮", digitos: 8, ejemplo: "8123 4567" },
    { nombre: "Bolivia", cod: "BO", dial: "591", bandera: "🇧🇴", digitos: 8, ejemplo: "7123 4567" },
    { nombre: "Paraguay", cod: "PY", dial: "595", bandera: "🇵🇾", digitos: 9, ejemplo: "981 123 456" },
    { nombre: "Uruguay", cod: "UY", dial: "598", bandera: "🇺🇾", digitos: 8, ejemplo: "9123 4567" },
    { nombre: "España", cod: "ES", dial: "34", bandera: "🇪🇸", digitos: 9, ejemplo: "612 345 678" },
    { nombre: "Estados Unidos", cod: "US", dial: "1", bandera: "🇺🇸", digitos: 10, ejemplo: "305 123 4567" },
    { nombre: "Puerto Rico", cod: "PR", dial: "1", bandera: "🇵🇷", digitos: 10, ejemplo: "787 123 4567" }
  ];

  var TIMEZONE_A_PAIS = {
    "America/Bogota": "CO", "America/Caracas": "VE", "America/Guayaquil": "EC",
    "America/Mexico_City": "MX", "America/Tijuana": "MX", "America/Cancun": "MX", "America/Monterrey": "MX", "America/Merida": "MX",
    "America/Lima": "PE", "America/Santiago": "CL", "America/Punta_Arenas": "CL",
    "America/Argentina/Buenos_Aires": "AR", "America/Argentina/Cordoba": "AR", "America/Argentina/Mendoza": "AR",
    "America/Panama": "PA", "America/Santo_Domingo": "DO", "America/Costa_Rica": "CR",
    "America/Guatemala": "GT", "America/Tegucigalpa": "HN", "America/El_Salvador": "SV",
    "America/Managua": "NI", "America/La_Paz": "BO", "America/Asuncion": "PY", "America/Montevideo": "UY",
    "Europe/Madrid": "ES", "America/Puerto_Rico": "PR",
    "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US"
  };

  // Adivina el país del visitante SOLO con lo que el propio navegador ya
  // sabe (zona horaria del sistema operativo, y de respaldo el idioma) —
  // sin ningún servicio externo de geolocalización: no pide permiso, no
  // depende de internet, nunca falla por bloqueador de terceros. Es una
  // sugerencia inicial nada más — el visitante igual puede elegir
  // cualquier otro país en el selector.
  function indicePaisSugerido() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      var codTz = TIMEZONE_A_PAIS[tz];
      if (codTz) {
        var iTz = PAISES.findIndex(function (p) { return p.cod === codTz; });
        if (iTz !== -1) return iTz;
      }
    } catch (e) {}
    try {
      var region = (navigator.language || "").split("-")[1];
      if (region) {
        var iLang = PAISES.findIndex(function (p) { return p.cod === region.toUpperCase(); });
        if (iLang !== -1) return iLang;
      }
    } catch (e) {}
    return 0; // Colombia
  }

  // Igual que en el resto de BIOsoft (ver numeroWhatsapp/leerTelefonoCompuesto
  // en js/ui.js): un "0" inicial en el número LOCAL es el prefijo de marcado
  // nacional (ej. Venezuela 0414…, Ecuador 099…) — se quita antes de anteponer
  // el indicativo del país elegido, para no dejar un número con un dígito de
  // más (ej. "58"+"04141234567" en vez de "58"+"4141234567", inválido).
  function digitosLocales(valorInput) {
    var d = (valorInput || "").replace(/\D/g, "");
    if (d.length > 1 && d.charAt(0) === "0") d = d.slice(1);
    return d;
  }

  // null si el largo parece razonable para el país, o un mensaje de error
  // listo para mostrar si parece claramente corto/largo.
  function validar(pais, soloDigitos) {
    if (soloDigitos.length < pais.digitos - 1 || soloDigitos.length > pais.digitos + 1) {
      return "Ese número no parece completo para " + pais.nombre + " — se esperan alrededor de " + pais.digitos + " dígitos (ej: " + pais.ejemplo + ").";
    }
    return null;
  }

  var WA_KEY = "biosoft_demo_wa_dado";
  function yaDado() {
    try { return localStorage.getItem(WA_KEY) === "1"; } catch (e) { return false; }
  }
  function marcarDado() {
    try { localStorage.setItem(WA_KEY, "1"); } catch (e) {}
  }

  // Guarda (o actualiza) el lead en crmClientes — mismo id determinístico a
  // partir del número para que dos visitas de la misma persona (desde
  // index.html y luego desde app.html, o dos veces desde cualquiera) nunca
  // dupliquen el lead: la segunda escritura cae sobre el mismo documento.
  // NUNCA lanza / nunca bloquea la entrada a la demo si falla (sin
  // internet, bloqueador, etc.) — quien llama debe seguir adelante igual.
  function guardarLead(pais, whatsappCompleto, origenDetalle) {
    if (!global.BIO_FB || !global.BIO_FB.db) return Promise.resolve();
    var leadId = "lead-demoweb-" + whatsappCompleto.replace(/\D/g, "");
    var doc = {
      id: leadId, estado: "nuevo", creadoEn: new Date().toISOString(),
      origen: "demo_web",
      origenDetalle: origenDetalle || {},
      laboratorio: { pais: pais.cod },
      contacto: { whatsapp: whatsappCompleto }
    };
    return global.BIO_FB.db.collection("crmClientes").doc(leadId).set(doc).then(function () {
      if (global.BIO_LANDING_TRACKER && typeof global.BIO_LANDING_TRACKER.trackLead === "function") {
        global.BIO_LANDING_TRACKER.trackLead(leadId);
      }
    }).catch(function (err) { console.warn("BIOsoft: no se pudo registrar el lead de demo ->", err); });
  }

  global.BIO_DEMO_WA = {
    paises: PAISES,
    indicePaisSugerido: indicePaisSugerido,
    digitosLocales: digitosLocales,
    validar: validar,
    yaDado: yaDado,
    marcarDado: marcarDado,
    guardarLead: guardarLead
  };
})(window);

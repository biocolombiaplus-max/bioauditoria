/* BIOsoft — Seguimiento propio de visitantes de la landing (index.html) y
   del formulario público de activación (activar.html), para el panel de
   superadmin "Rendimiento de Campañas". No depende de la API de Meta Ads
   (eso exigiría un token de Business Manager y un backend para no
   exponerlo) — en vez de eso, BIOsoft arma su PROPIA analítica de primera
   mano en Firestore (colección landingVisitantes), escrita directo desde
   el navegador, sin servidor intermedio. Es el mismo criterio que ya usa
   activar.js para guardar origenDetalle.utmSource en cada lead que SÍ
   llega a dejar sus datos (crmClientes) — esto además captura a quienes
   NO llegan a dejarlos, para poder calcular el embudo completo y saber a
   quién vale la pena hacerle remarketing. Nunca bloquea ni rompe la
   página si algo falla (sin Firebase, sin conexión, bloqueador de
   anuncios, etc. — todo se atrapa en silencio). */
(function (global) {
  "use strict";

  var VID_KEY = "biosoft_lvid";
  var PERFIL_KEY = "biosoft_lvid_perfil";
  var SESSION_KEY = "biosoft_lvid_sesion";
  // Mismo orden de "qué tan lejos llegó" que usa el panel para no retroceder
  // nunca una etapa ya alcanzada (ej. si vuelve a visitar la portada después
  // de haber escrito por WhatsApp, sigue contando como "contacto").
  var RANK = { visita: 0, precios: 1, demo: 2, contacto: 3, lead: 4 };

  function randomId() {
    try {
      var bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    } catch (e) {
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
  }
  function vid() {
    try {
      var v = localStorage.getItem(VID_KEY);
      if (!v || !/^[a-f0-9]{24}$/.test(v)) { v = randomId(); localStorage.setItem(VID_KEY, v); }
      return v;
    } catch (e) { return randomId(); }
  }

  // Las visitas del propio equipo de BIOsoft (probando la landing, QA, el
  // superadmin revisando el panel, bots de Facebook/Google que precargan la
  // página al compartir el enlace) no deben inflar las estadísticas.
  function esBot() {
    return typeof navigator === "undefined" || navigator.webdriver || /bot|crawler|spider|facebookexternalhit|preview|whatsapp/i.test(navigator.userAgent);
  }

  // Mismo criterio de atribución que ya usa activar.js (utm_source) y que
  // badgeOrigen() en views-crm.js ya sabe leer — aquí se aplica también a
  // quien NUNCA llega a dejar sus datos, para poder calcular el embudo
  // completo por fuente (ver detectSource).
  function detectarFuente() {
    var params = new URLSearchParams(global.location.search);
    var utm = (params.get("utm_source") || "").toLowerCase();
    var medium = (params.get("utm_medium") || "").toLowerCase();
    var campana = [params.get("utm_campaign"), params.get("utm_content")].filter(Boolean).join(" · ").slice(0, 120);
    var pagado = /paid|cpc|ads/.test(medium);
    if (utm) {
      if (/^(fb|facebook|meta)/.test(utm)) return { source: pagado ? "Meta Ads" : "Facebook", campaign: campana };
      if (/^(ig|instagram)/.test(utm)) return { source: pagado ? "Meta Ads" : "Instagram", campaign: campana };
      if (/google/.test(utm)) return { source: pagado ? "Google Ads" : "Google", campaign: campana };
      if (/whatsapp|wa/.test(utm)) return { source: "WhatsApp", campaign: campana };
      if (/tiktok/.test(utm)) return { source: "TikTok", campaign: campana };
      return { source: utm.slice(0, 40), campaign: campana };
    }
    if (params.get("fbclid")) return { source: "Facebook / Instagram", campaign: campana };
    if (params.get("gclid")) return { source: "Google Ads", campaign: campana };
    var host = "";
    try { host = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { host = ""; }
    if (!host || host === global.location.hostname) return { source: "Directo", campaign: campana };
    if (/facebook|fb\./.test(host)) return { source: "Facebook", campaign: campana };
    if (/instagram/.test(host)) return { source: "Instagram", campaign: campana };
    if (/google/.test(host)) return { source: "Google", campaign: campana };
    if (/whatsapp|wa\.me/.test(host)) return { source: "WhatsApp", campaign: campana };
    if (/tiktok/.test(host)) return { source: "TikTok", campaign: campana };
    return { source: host.replace(/^www\./, "").slice(0, 40), campaign: campana };
  }

  function detectarDispositivo() {
    var ua = navigator.userAgent;
    if (/iPhone|iPod/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android" : "Tablet Android";
    if (/Mac OS X/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows";
    return "Computador";
  }

  function coleccion() {
    if (!global.BIO_FB || !global.BIO_FB.db) return null;
    return global.BIO_FB.db.collection("landingVisitantes");
  }

  var pendiente = null;
  function subir(perfil) {
    var ref = coleccion();
    if (!ref) return;
    if (pendiente) clearTimeout(pendiente);
    // Igual que el perfil de visitante de cualquier tienda en línea seria:
    // se agrupan varios cambios seguidos (ej. cargar la página + subir de
    // etapa casi al instante) en una sola escritura, en vez de una por
    // cada evento.
    pendiente = setTimeout(function () {
      pendiente = null;
      try {
        var datos = {
          firstSeen: perfil.firstSeen || Date.now(),
          visits: Math.max(1, perfil.visits || 1),
          pageviews: Math.max(1, perfil.pageviews || 1),
          landing: perfil.landing || "",
          lastPath: perfil.lastPath || "",
          source: perfil.source || "Directo",
          campaign: perfil.campaign || "",
          device: perfil.device || "",
          stage: perfil.stage || "visita",
          stageAt: perfil.stageAt || Date.now(),
          leadId: perfil.leadId || "",
          lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        };
        ref.doc(vid()).set(datos, { merge: true }).catch(function () {});
      } catch (e) {}
    }, 500);
  }

  var cache = null;
  function cargarPerfil() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(PERFIL_KEY) || "{}"); } catch (e) { cache = {}; }
    return cache;
  }
  function guardarPerfil(p) {
    cache = p;
    try { localStorage.setItem(PERFIL_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function subirEtapaSiCorresponde(p, etapa) {
    if (RANK[etapa] > RANK[p.stage || "visita"]) { p.stage = etapa; p.stageAt = Date.now(); }
  }

  // Se llama una vez por página (index.html y activar.html) apenas carga.
  function trackPageview() {
    if (esBot()) return;
    var p = cargarPerfil();
    var nuevaSesion = false;
    try {
      nuevaSesion = !sessionStorage.getItem(SESSION_KEY);
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {}
    if (nuevaSesion) {
      var fc = detectarFuente();
      p.visits = (p.visits || 0) + 1;
      p.source = fc.source;
      p.campaign = fc.campaign;
      if (!p.landing) p.landing = global.location.pathname.slice(0, 120);
      p.device = detectarDispositivo();
    }
    if (!p.firstSeen) p.firstSeen = Date.now();
    p.pageviews = (p.pageviews || 0) + 1;
    p.lastPath = global.location.pathname.slice(0, 120);
    if (!p.stage) p.stage = "visita";
    guardarPerfil(p);
    subir(p);
  }

  // Marca que el visitante llegó a una etapa del embudo (ver RANK arriba) —
  // nunca retrocede una ya alcanzada.
  function trackEtapa(etapa) {
    if (esBot() || !RANK.hasOwnProperty(etapa)) return;
    var p = cargarPerfil();
    subirEtapaSiCorresponde(p, etapa);
    guardarPerfil(p);
    subir(p);
  }

  // Se llama desde activar.js apenas el formulario público crea el lead en
  // crmClientes — así el panel de superadmin puede cruzar, por el mismo
  // vid, quién llegó hasta dejar sus datos (y con qué leadId, para abrirlo
  // directo desde el panel de visitantes).
  function trackLead(leadId) {
    if (esBot()) return;
    var p = cargarPerfil();
    subirEtapaSiCorresponde(p, "lead");
    if (leadId) p.leadId = leadId;
    guardarPerfil(p);
    subir(p);
  }

  global.BIO_LANDING_TRACKER = { trackPageview: trackPageview, trackEtapa: trackEtapa, trackLead: trackLead };
})(window);

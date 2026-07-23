/* BIOsoft — Visita guiada (product tour) para primeros usuarios: resalta con
   un "spotlight" cada sección del menú y explica brevemente qué hace, igual
   que los onboardings de los grandes software. Se muestra una sola vez por
   navegador (localStorage) y puede reabrirse desde el botón "❔ Tour". */
(function (global) {
  "use strict";

  var STORAGE_KEY = "bio_tour_seen_v1";
  var MOBILE_BREAKPOINT = 900;

  var DESCRIPCIONES = {
    dashboard: "Tu resumen del día: pacientes, órdenes y pendientes de un vistazo.",
    pacientes: "Registra y administra todos los pacientes de tu laboratorio.",
    ordenes: "Crea órdenes de laboratorio y asigna los exámenes a realizar.",
    resultados: "Aquí los bacteriólogos capturan y validan los resultados.",
    "hojas-trabajo": "Genera hojas de trabajo diarias, imprimibles o en pantalla.",
    reportes: "Envía los informes en PDF por WhatsApp o correo, en un clic.",
    productividad: "Consulta la productividad mensual de tu laboratorio.",
    calidad: "Control de Calidad con Inteligencia Artificial: detecta errores antes de liberar resultados.",
    cotizador: "Cotiza exámenes y envía la cotización por WhatsApp o correo en segundos.",
    marketing: "Remarketing con IA y creador de imágenes premium para tus redes sociales.",
    inventario: "Controla tus reactivos e insumos: consumo por examen, kardex y costos, en tiempo real.",
    usuarios: "Administra los usuarios y bacteriólogos de tu laboratorio.",
    catalogo: "Personaliza los valores de referencia de cada examen.",
    config: "Configura el nombre, logo, colores y datos de tu laboratorio.",
    auditoria: "Trazabilidad completa: quién hizo qué y cuándo.",
    crm: "Gestiona tus clientes y leads del CRM de BIOsoft.",
    tenants: "Administra los laboratorios que usan BIOsoft."
  };

  var overlay, spotlight, tooltip, modalWrap, steps, idx, onResize;

  function haVistoTour() {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch (e) { return true; }
  }
  function marcarVisto() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
  }
  function isMobile() { return window.innerWidth <= MOBILE_BREAKPOINT; }
  function abrirSidebarMobile(abrir) {
    var inner = document.getElementById("app-inner");
    if (inner) inner.classList.toggle("sidebar-open", abrir);
  }

  function buildSteps() {
    var list = [];
    list.push({ tipo: "modal", titulo: "👋 ¡Bienvenido a BIOsoft!", texto: "Te mostramos en menos de un minuto cómo funciona todo. ¿Empezamos?", boton: "Comenzar Tour 🚀" });
    list.push({ tipo: "spot", target: "#content", titulo: "Panel Principal", texto: DESCRIPCIONES.dashboard, mobile: false });
    document.querySelectorAll(".sidebar-nav .nav-link").forEach(function (a) {
      var route = a.dataset.route;
      var label = a.querySelector("span") ? a.querySelector("span").textContent.trim() : a.textContent.trim();
      list.push({ tipo: "spot", target: '.nav-link[data-route="' + route + '"]', titulo: label, texto: DESCRIPCIONES[route] || "Explora esta sección.", mobile: true });
    });
    var buyCta = document.getElementById("topbar-buy-cta");
    if (buyCta && !buyCta.classList.contains("hidden")) {
      list.push({ tipo: "spot", target: "#topbar-buy-cta", titulo: "Adquirir BIOsoft", texto: "Cuando quieras activarlo para tu laboratorio, este botón te escribe directo por WhatsApp.", mobile: false });
    }
    list.push({ tipo: "spot", target: "#user-chip", titulo: "Tu usuario", texto: "Aquí ves tu nombre, tu rol y puedes cerrar sesión cuando quieras.", mobile: false });
    list.push({ tipo: "modal", titulo: "🚀 ¡Listo para explorar!", texto: "Ya conoces lo esencial. Explora con confianza — este es un ambiente 100% de prueba y los datos se restablecen en tu navegador. Puedes repetir este tour cuando quieras desde el botón ❔ Tour.", boton: "Empezar a explorar" });
    return list;
  }

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "tour-overlay hidden";
    overlay.innerHTML =
      '<div class="tour-spotlight" id="tour-spotlight"></div>' +
      '<div class="tour-tooltip" id="tour-tooltip"></div>' +
      '<div class="tour-modal-wrap" id="tour-modal-wrap"></div>';
    document.body.appendChild(overlay);
    spotlight = overlay.querySelector("#tour-spotlight");
    tooltip = overlay.querySelector("#tour-tooltip");
    modalWrap = overlay.querySelector("#tour-modal-wrap");
  }

  function posicionarSpot(target) {
    var el = document.querySelector(target);
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    var r = el.getBoundingClientRect();
    var pad = 8;
    spotlight.style.left = (r.left - pad) + "px";
    spotlight.style.top = (r.top - pad) + "px";
    spotlight.style.width = (r.width + pad * 2) + "px";
    spotlight.style.height = (r.height + pad * 2) + "px";
    return { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2, bottom: r.bottom + pad, right: r.right + pad };
  }

  function posicionarTooltip(rect) {
    var tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var top, left;
    if (rect.bottom + th + 16 < vh) top = rect.bottom + 14;
    else if (rect.top - th - 16 > 0) top = rect.top - th - 14;
    else top = Math.max(12, (vh - th) / 2);
    left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(12, Math.min(left, vw - tw - 12));
    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  function render() {
    var step = steps[idx];
    if (step.tipo === "modal") {
      spotlight.style.display = "none";
      tooltip.style.display = "none";
      modalWrap.style.display = "flex";
      modalWrap.innerHTML =
        '<div class="tour-modal-card">' +
        "<h3>" + step.titulo + "</h3><p>" + step.texto + "</p>" +
        '<div class="tour-modal-actions">' +
        (idx > 0 ? '<button type="button" class="btn btn-ghost btn-sm" id="tour-skip">Saltar tour</button>' : "") +
        '<button type="button" class="btn btn-primary" id="tour-next">' + step.boton + "</button>" +
        "</div></div>";
      modalWrap.querySelector("#tour-next").addEventListener("click", siguiente);
      var skipBtn = modalWrap.querySelector("#tour-skip");
      if (skipBtn) skipBtn.addEventListener("click", finalizar);
      return;
    }

    modalWrap.style.display = "none";
    if (isMobile()) abrirSidebarMobile(!!step.mobile);

    requestAnimationFrame(function () {
      setTimeout(function () {
        var rect = posicionarSpot(step.target);
        if (!rect) { siguiente(); return; }
        spotlight.style.display = "block";
        tooltip.style.display = "block";
        var esc = global.BIO_UI ? global.BIO_UI.esc : function (s) { return s; };
        tooltip.innerHTML =
          '<div class="tour-tooltip-step">Paso ' + (idx) + " de " + (steps.length - 1) + "</div>" +
          "<h4>" + esc(step.titulo) + "</h4><p>" + esc(step.texto) + "</p>" +
          '<div class="tour-tooltip-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="tour-skip">Saltar</button>' +
          (idx > 1 ? '<button type="button" class="btn btn-outline btn-sm" id="tour-prev">← Atrás</button>' : "") +
          '<button type="button" class="btn btn-primary btn-sm" id="tour-next">' + (idx === steps.length - 1 ? "Finalizar" : "Siguiente →") + "</button>" +
          "</div>";
        posicionarTooltip(rect);
        tooltip.querySelector("#tour-next").addEventListener("click", siguiente);
        tooltip.querySelector("#tour-skip").addEventListener("click", finalizar);
        var prevBtn = tooltip.querySelector("#tour-prev");
        if (prevBtn) prevBtn.addEventListener("click", anterior);
      }, isMobile() ? 260 : 0);
    });
  }

  function siguiente() {
    idx++;
    if (idx >= steps.length) { finalizar(); return; }
    render();
  }
  function anterior() {
    idx = Math.max(0, idx - 1);
    render();
  }
  function finalizar() {
    marcarVisto();
    abrirSidebarMobile(false);
    if (overlay) overlay.classList.add("hidden");
    if (onResize) window.removeEventListener("resize", onResize);
  }

  function iniciar() {
    ensureDom();
    steps = buildSteps();
    if (steps.length <= 2) return; // sin nav visible (rol sin permisos aún), no forzar tour
    idx = 0;
    overlay.classList.remove("hidden");
    onResize = function () { if (steps[idx] && steps[idx].tipo === "spot") render(); };
    window.addEventListener("resize", onResize);
    render();
  }

  function autoIniciar() {
    if (haVistoTour()) return;
    setTimeout(iniciar, 700);
  }

  global.BIO_TOUR = {
    start: iniciar,
    autoStart: autoIniciar,
    reset: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
  };
})(window);

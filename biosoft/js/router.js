/* BIOsoft — Shell de la aplicación, navegación y arranque */
(function (global) {
  "use strict";

  var NAV = {
    superadmin: [
      { sec: "BIOSOFT", items: [
        { route: "crm", label: "Clientes (CRM)", icon: "send" },
        { route: "tenants", label: "Laboratorios Cliente", icon: "building" },
        { route: "dashboard", label: "Resumen Global", icon: "home" }
      ]}
    ],
    admin: [
      { sec: "GENERAL", items: [{ route: "dashboard", label: "Panel Principal", icon: "home" }] },
      { sec: "OPERACIÓN", items: [
        { route: "pacientes", label: "Pacientes", icon: "users" },
        { route: "ordenes", label: "Órdenes de Laboratorio", icon: "clipboard" },
        { route: "resultados", label: "Resultados", icon: "flask" },
        { route: "hojas-trabajo", label: "Hojas de Trabajo", icon: "printer" },
        { route: "reportes", label: "Reportes y Envíos", icon: "send" },
        { route: "productividad", label: "Productividad Mensual", icon: "activity" },
        { route: "calidad", label: "Control de Calidad", icon: "shield" },
        { route: "cotizador", label: "Cotizaciones", icon: "file" }
      ]},
      { sec: "ADMINISTRACIÓN", items: [
        { route: "usuarios", label: "Usuarios y Bacteriólogos", icon: "users" },
        { route: "catalogo", label: "Valores de Referencia", icon: "flask" },
        { route: "config", label: "Configuración del Laboratorio", icon: "settings" },
        { route: "auditoria", label: "Trazabilidad", icon: "history" }
      ]}
    ],
    bacteriologo: [
      { sec: "GENERAL", items: [{ route: "dashboard", label: "Panel Principal", icon: "home" }] },
      { sec: "OPERACIÓN", items: [
        { route: "resultados", label: "Bandeja de Resultados", icon: "flask" },
        { route: "hojas-trabajo", label: "Hojas de Trabajo", icon: "printer" },
        { route: "calidad", label: "Control de Calidad", icon: "shield" }
      ]}
    ],
    recepcion: [
      { sec: "GENERAL", items: [{ route: "dashboard", label: "Panel Principal", icon: "home" }] },
      { sec: "OPERACIÓN", items: [
        { route: "pacientes", label: "Pacientes", icon: "users" },
        { route: "ordenes", label: "Órdenes de Laboratorio", icon: "clipboard" },
        { route: "hojas-trabajo", label: "Hojas de Trabajo", icon: "printer" },
        { route: "reportes", label: "Reportes y Envíos", icon: "send" },
        { route: "cotizador", label: "Cotizaciones", icon: "file" }
      ]}
    ]
  };

  var ROLE_LABEL = { superadmin: "Super Administrador BIOsoft", admin: "Administrador de Laboratorio", bacteriologo: "Bacteriólogo(a)", recepcion: "Recepción / Toma de Muestras" };

  var WA_NUMBER = "573505457420";
  function waLink(mensaje) { return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(mensaje); }

  function iniciales(nombre) {
    return (nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
  }

  function renderShell() {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    BIO_UI.applyTenantTheme(tenant);

    var esDemo = !!(tenant && tenant.id === "demo");
    document.getElementById("demo-banner").classList.toggle("hidden", !esDemo);
    var mensajeCompra = "Hola, ya vi la demo de BIOsoft y estoy interesado(a) en adquirirla para mi laboratorio. ¿Me ayudas con la activación?";
    var waFloat = document.getElementById("wa-float-demo");
    waFloat.classList.toggle("hidden", !esDemo);
    var buyCta = document.getElementById("topbar-buy-cta");
    buyCta.classList.toggle("hidden", !esDemo);
    if (esDemo) {
      waFloat.href = waLink(mensajeCompra);
      buyCta.href = waLink(mensajeCompra);
    }

    var sidebar = document.getElementById("sidebar");
    var brandName = tenant ? tenant.nombre : "BIOsoft";
    var brandSub = session.rol === "superadmin" ? "Consola de Socios" : "Sistema de Gestión de Laboratorio";
    sidebar.innerHTML =
      '<div class="sidebar-brand">' +
        (tenant && tenant.logoDataUrl ? '<img src="' + tenant.logoDataUrl + '"/>' : (!tenant ? '<img src="assets/logo-biosoft.png"/>' : '<div class="avatar" style="border-radius:8px">' + iniciales(brandName) + '</div>')) +
        '<div><div class="name">' + BIO_UI.esc(brandName) + '</div><div class="sub">' + brandSub + '</div></div>' +
      '</div>' +
      '<nav class="sidebar-nav" id="sidebar-nav"></nav>' +
      '<div class="sidebar-foot">BIOsoft™ · Impulsado por BIOMarketing<br/>Cumplimiento normativo CO · VE · EC</div>';

    var navHost = document.getElementById("sidebar-nav");
    var groups = NAV[session.rol] || [];
    var html = "";
    groups.forEach(function (g) {
      html += '<div class="sidebar-section-title">' + g.sec + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="nav-link" data-route="' + it.route + '">' + BIO_UI.icon(it.icon) + '<span>' + it.label + '</span></a>';
      });
    });
    navHost.innerHTML = html;
    navHost.querySelectorAll(".nav-link").forEach(function (a) {
      a.addEventListener("click", function () {
        location.hash = "#/" + a.dataset.route;
        document.getElementById("app-inner").classList.remove("sidebar-open");
      });
    });

    document.getElementById("user-chip-name").textContent = session.nombre;
    document.getElementById("user-chip-role").textContent = ROLE_LABEL[session.rol] || session.rol;
    var avatarEl = document.getElementById("user-avatar");
    if (session.fotoUrl) {
      avatarEl.innerHTML = '<img src="' + session.fotoUrl + '" alt="' + BIO_UI.esc(session.nombre) + '"/>';
    } else {
      avatarEl.textContent = iniciales(session.nombre);
    }
  }

  var ROUTE_TITLES = {
    dashboard: "Panel Principal", pacientes: "Pacientes", ordenes: "Órdenes de Laboratorio",
    resultados: "Resultados de Laboratorio", "hojas-trabajo": "Hojas de Trabajo Diarias",
    reportes: "Reportes y Envío de Resultados", usuarios: "Usuarios y Bacteriólogos",
    config: "Configuración del Laboratorio", auditoria: "Trazabilidad y Auditoría", tenants: "Laboratorios Cliente",
    catalogo: "Valores de Referencia del Catálogo", productividad: "Productividad Mensual", crm: "Clientes (CRM)",
    calidad: "Control de Calidad", cotizador: "Cotizador de Exámenes"
  };

  var ALLOWED_ROUTES = {
    superadmin: ["crm", "tenants", "dashboard"],
    admin: ["dashboard", "pacientes", "ordenes", "resultados", "hojas-trabajo", "reportes", "productividad", "calidad", "cotizador", "usuarios", "config", "auditoria", "catalogo"],
    bacteriologo: ["dashboard", "resultados", "hojas-trabajo", "calidad"],
    recepcion: ["dashboard", "pacientes", "ordenes", "hojas-trabajo", "reportes", "cotizador"]
  };

  function currentRoute() {
    var h = location.hash.replace(/^#\//, "").split("/");
    return { name: h[0] || "dashboard", param: h[1] };
  }

  function renderRoute() {
    var session = BIO_AUTH.getSession();
    if (!session) { showLogin(); return; }
    var r = currentRoute();
    var allowed = ALLOWED_ROUTES[session.rol] || [];
    if (allowed.indexOf(r.name) === -1) { r.name = allowed[0]; location.hash = "#/" + r.name; }

    document.querySelectorAll(".nav-link").forEach(function (a) { a.classList.toggle("active", a.dataset.route === r.name); });
    document.getElementById("topbar-title").textContent = ROUTE_TITLES[r.name] || "BIOsoft";

    var content = document.getElementById("content");
    content.innerHTML = "";
    var renderer = BIO_VIEWS[r.name];
    if (renderer) renderer(content, r.param);
    else content.innerHTML = '<div class="card">Módulo no encontrado.</div>';
  }

  function showLogin() {
    document.getElementById("app-shell").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("demo-banner").classList.add("hidden");
  }
  function showApp() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");
    renderShell();
    renderRoute();
  }

  function boot() {
    BIO_STORE.seedIfEmpty();
    BIO_STORE.onRealtimeChange(function () { renderRoute(); });
    wireLogin();
    document.getElementById("burger").addEventListener("click", function () {
      document.getElementById("app-inner").classList.toggle("sidebar-open");
    });
    document.getElementById("sidebar-backdrop").addEventListener("click", function () {
      document.getElementById("app-inner").classList.remove("sidebar-open");
    });
    document.getElementById("sidebar-close").addEventListener("click", function () {
      document.getElementById("app-inner").classList.remove("sidebar-open");
    });
    document.getElementById("user-chip").addEventListener("click", function () {
      var s = BIO_AUTH.getSession();
      BIO_UI.openModal(
        '<h3 class="modal-title">' + BIO_UI.esc(s.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:2px">' + (ROLE_LABEL[s.rol] || s.rol) + '</p>' +
        '<div class="field" style="margin-top:16px"><button class="btn btn-outline btn-block" id="btn-logout">' + BIO_UI.icon("logout") + ' Cerrar sesión</button></div>'
      ).querySelector("#btn-logout").addEventListener("click", function () {
        BIO_AUTH.logout();
        location.hash = "";
        document.querySelectorAll(".modal").forEach(function (m) { m.remove(); });
        showLogin();
      });
    });
    window.addEventListener("hashchange", renderRoute);
    if (BIO_AUTH.getSession()) {
      BIO_AUTH.rehydrate().then(function (ok) { if (ok) showApp(); else showLogin(); });
    } else showLogin();
  }

  function wireLogin() {
    var form = document.getElementById("login-form");
    var toggleBtn = document.getElementById("btn-toggle-login");
    var existingBlock = document.getElementById("existing-login-block");
    toggleBtn.addEventListener("click", function () {
      var abierto = !existingBlock.classList.contains("hidden");
      existingBlock.classList.toggle("hidden");
      toggleBtn.textContent = abierto ? "¿Ya adquiriste BIOsoft para tu laboratorio? Inicia sesión aquí →" : "← Ocultar inicio de sesión";
      if (!abierto) existingBlock.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    var tabs = document.querySelectorAll(".role-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.getElementById("login-username").value = tab.dataset.user;
        document.getElementById("login-password").value = tab.dataset.pass;
      });
    });
    document.getElementById("btn-demo-quick").addEventListener("click", function () {
      document.getElementById("login-username").value = "admin.demo";
      document.getElementById("login-password").value = "Demo2026*";
      form.requestSubmit();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var u = document.getElementById("login-username").value.trim();
      var p = document.getElementById("login-password").value;
      var errBox = document.getElementById("login-error");
      var submitBtn = form.querySelector('button[type="submit"]');
      var textoOriginal = submitBtn.textContent;
      submitBtn.disabled = true; submitBtn.textContent = "Ingresando…";
      BIO_AUTH.login(u, p).then(function (res) {
        submitBtn.disabled = false; submitBtn.textContent = textoOriginal;
        if (!res.ok) { errBox.textContent = res.error; errBox.classList.remove("hidden"); return; }
        errBox.classList.add("hidden");
        form.reset();
        location.hash = res.session.rol === "superadmin" ? "#/crm" : "#/dashboard";
        showApp();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", boot);

  global.BIO_ROUTER = { renderShell: renderShell, renderRoute: renderRoute, showApp: showApp, showLogin: showLogin };
})(window);

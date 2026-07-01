/* BIOsoft — Vistas de Administración: Usuarios, Configuración, Auditoría y Laboratorios Cliente (superadmin) */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;
  var ROL_LABEL = { admin: "Administrador", bacteriologo: "Bacteriólogo(a)", recepcion: "Recepción" };

  // ------------------------------------------------------------------
  // USUARIOS
  // ------------------------------------------------------------------
  window.BIO_VIEWS.usuarios = function (root) {
    var session = BIO_AUTH.getSession();

    function build() {
      var users = S.listUsers(session.tenantId);
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Usuarios del Laboratorio (' + users.length + ')</h3>' +
        '<button class="btn btn-primary" id="btn-new-user">' + U.icon("plus") + ' Nuevo Usuario</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Secciones Asignadas</th><th>Estado</th><th></th></tr></thead><tbody>' +
        users.map(rowHtml).join("") + "</tbody></table></div></div>";
      document.getElementById("btn-new-user").addEventListener("click", function () { openForm(null); });
      root.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openForm(users.filter(function (u) { return u.id === b.dataset.edit; })[0]); }); });
      root.querySelectorAll("[data-toggle]").forEach(function (b) { b.addEventListener("click", function () {
        var u = users.filter(function (x) { return x.id === b.dataset.toggle; })[0];
        S.updateUser(u.id, { activo: !u.activo });
        S.addAudit(session.tenantId, session.nombre, session.rol, "TOGGLE_USER", "usuario", u.id, (u.activo ? "Desactivó" : "Activó") + " al usuario " + u.nombre + ".");
        build();
      }); });
    }

    function rowHtml(u) {
      return "<tr><td>" + U.esc(u.nombre) + "</td><td>" + U.esc(u.username) + "</td><td>" + (ROL_LABEL[u.rol] || u.rol) + "</td>" +
        "<td>" + (u.secciones && u.secciones.length ? u.secciones.map(function (s) { return C.seccionNombre(s); }).join(", ") : "—") + "</td>" +
        "<td>" + (u.activo ? '<span class="badge badge-validado">Activo</span>' : '<span class="badge badge-pendiente">Inactivo</span>') + "</td>" +
        '<td><div class="flex gap-2"><button class="btn btn-ghost btn-sm" data-edit="' + u.id + '">' + U.icon("edit") + " Editar</button>" +
        '<button class="btn btn-outline btn-sm" data-toggle="' + u.id + '">' + (u.activo ? "Desactivar" : "Activar") + "</button></div></td></tr>";
    }

    function openForm(user) {
      var isEdit = !!user;
      user = user || { rol: "bacteriologo", secciones: [], activo: true };
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Usuario" : "Nuevo Usuario") + '</h3>' +
        '<form id="user-form">' +
          '<div class="form-grid">' +
            F.inp("nombre", "Nombre Completo", user.nombre, true) +
            F.inp("username", "Usuario (login)", user.username, true) +
            F.inp("password", "Contraseña", user.password, !isEdit, "text") +
            F.sel("rol", "Rol", ["admin", "bacteriologo", "recepcion"].map(function (r) { return '<option value="' + r + '" ' + (r === user.rol ? "selected" : "") + ">" + ROL_LABEL[r] + "</option>"; }).join("")) +
          "</div>" +
          '<div id="secciones-box" class="field"></div>' +
          '<div class="flex gap-2 justify-between" style="margin-top:6px">' +
            '<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button>" +
          "</div>" +
        "</form>", { lg: true }
      );
      function renderSecciones() {
        var rol = wrap.querySelector("#f_rol").value;
        var box = wrap.querySelector("#secciones-box");
        if (rol !== "bacteriologo") { box.innerHTML = ""; return; }
        box.innerHTML = "<label>Secciones que puede capturar y validar</label><div class='form-grid'>" +
          C.SECCIONES.map(function (s) {
            var checked = (user.secciones || []).indexOf(s.id) !== -1;
            return '<div class="checkbox-row"><input type="checkbox" data-sec="' + s.id + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + s.nombre + "</label></div>";
          }).join("") + "</div>";
      }
      wrap.querySelector("#f_rol").addEventListener("change", renderSecciones);
      renderSecciones();

      wrap.querySelector("#user-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        var secciones = Array.prototype.slice.call(wrap.querySelectorAll("[data-sec]:checked")).map(function (c) { return c.dataset.sec; });
        var data = { nombre: g("nombre"), username: g("username"), rol: g("rol"), secciones: secciones, tenantId: session.tenantId, activo: true };
        var pass = g("password");
        if (pass) data.password = pass;
        if (!data.nombre || !data.username || (!isEdit && !pass)) { U.toast("Completa nombre, usuario y contraseña.", "error"); return; }
        if (isEdit) {
          S.updateUser(user.id, data);
          S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_USER", "usuario", user.id, "Actualizó al usuario " + data.nombre + ".");
        } else {
          if (S.findUser(data.username)) { U.toast("Ese nombre de usuario ya existe.", "error"); return; }
          var created = S.createUser(data);
          S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_USER", "usuario", created.id, "Creó al usuario " + data.nombre + " (" + ROL_LABEL[data.rol] + ").");
        }
        U.toast("Usuario guardado.", "success");
        U.closeModal(wrap);
        build();
      });
    }
    build();
  };

  // ------------------------------------------------------------------
  // CONFIGURACIÓN DEL LABORATORIO
  // ------------------------------------------------------------------
  window.BIO_VIEWS.config = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = S.getTenant(session.tenantId);
    var logoTemp = tenant.logoDataUrl;

    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">Identidad y Datos del Laboratorio</h3></div>' +
      '<form id="cfg-form">' +
        '<div class="form-grid">' +
          F.inp("nombre", "Nombre del Laboratorio", tenant.nombre, true) +
          F.inp("nit", "NIT / RIF / RUC", tenant.nit) +
          F.sel("pais", "País", ["CO", "VE", "EC"].map(function (p) { return '<option value="' + p + '" ' + (p === tenant.pais ? "selected" : "") + ">" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>"; }).join("")) +
          F.inp("direccion", "Dirección", tenant.direccion) +
          F.inp("telefonos", "Teléfonos", tenant.telefonos) +
          F.inp("email", "Correo Electrónico", tenant.email) +
          F.inp("sitioWeb", "Sitio Web", tenant.sitioWeb) +
          F.inp("resolucionHabilitacion", "Resolución de Habilitación", tenant.resolucionHabilitacion) +
          F.inp("codigoREPS", "Código REPS / Registro Sanitario", tenant.codigoREPS) +
          F.sel("nivel", "Nivel de Complejidad", [1, 2].map(function (n) { return '<option value="' + n + '" ' + (n === tenant.nivel ? "selected" : "") + ">Nivel " + n + "</option>"; }).join("")) +
          F.inp("bactNombre", "Bacteriólogo(a) Responsable", tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.nombre : "") +
          F.inp("bactRegistro", "Registro Profesional", tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.registro : "") +
        "</div>" +
        '<fieldset><legend>Marca e Identidad Visual</legend>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Color Primario</label><input type="color" id="f_colorPrimario" value="' + (tenant.colorPrimario || "#0b6e4f") + '"/></div>' +
          '<div class="field"><label>Color Secundario</label><input type="color" id="f_colorSecundario" value="' + (tenant.colorSecundario || "#0f172a") + '"/></div>' +
          '<div class="field"><label>Logo del Laboratorio</label><input type="file" id="f_logo" accept="image/*"/></div>' +
        "</div>" +
        '<div id="logo-preview" style="margin-top:8px">' + (logoTemp ? '<img src="' + logoTemp + '" style="height:52px;border-radius:8px"/>' : '<span class="text-muted">Sin logo cargado</span>') + "</div>" +
        "</fieldset>" +
        '<fieldset><legend>Seguridad — Clave de Administrador para Correcciones</legend>' +
        '<p class="text-muted" style="margin-top:0">Esta clave se solicita cuando un bacteriólogo necesita corregir un resultado ya validado, garantizando trazabilidad y control.</p>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Clave Actual</label><input type="password" id="f_claveActual"/></div>' +
          '<div class="field"><label>Nueva Clave de Administrador</label><input type="password" id="f_claveNueva"/></div>' +
        "</div></fieldset>" +
        '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Configuración</button>" +
      "</form></div>";

    document.getElementById("f_logo").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        logoTemp = ev.target.result;
        document.getElementById("logo-preview").innerHTML = '<img src="' + logoTemp + '" style="height:52px;border-radius:8px"/>';
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("cfg-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { return document.getElementById("f_" + id).value.trim(); };
      tenant.nombre = g("nombre"); tenant.nit = g("nit"); tenant.pais = g("pais"); tenant.direccion = g("direccion");
      tenant.telefonos = g("telefonos"); tenant.email = g("email"); tenant.sitioWeb = g("sitioWeb");
      tenant.resolucionHabilitacion = g("resolucionHabilitacion"); tenant.codigoREPS = g("codigoREPS"); tenant.nivel = parseInt(g("nivel"), 10);
      tenant.bacteriologoResponsable = { nombre: g("bactNombre"), registro: g("bactRegistro") };
      tenant.colorPrimario = document.getElementById("f_colorPrimario").value;
      tenant.colorSecundario = document.getElementById("f_colorSecundario").value;
      tenant.logoDataUrl = logoTemp;

      var claveActual = g("claveActual"), claveNueva = g("claveNueva");
      if (claveNueva) {
        if (claveActual !== tenant.claveAdmin) { U.toast("La clave actual de administrador no coincide.", "error"); return; }
        tenant.claveAdmin = claveNueva;
        S.addAudit(session.tenantId, session.nombre, session.rol, "CHANGE_ADMIN_PASSWORD", "laboratorio", tenant.id, "Cambió la clave de administrador del laboratorio.");
      }

      S.saveTenant(tenant);
      S.addAudit(session.tenantId, session.nombre, session.rol, "CONFIG_CHANGE", "laboratorio", tenant.id, "Actualizó la configuración e identidad visual del laboratorio.");
      BIO_UI.applyTenantTheme(tenant);
      BIO_ROUTER.renderShell();
      U.toast("Configuración guardada.", "success");
    });
  };

  // ------------------------------------------------------------------
  // AUDITORÍA / TRAZABILIDAD
  // ------------------------------------------------------------------
  window.BIO_VIEWS.auditoria = function (root) {
    var session = BIO_AUTH.getSession();
    var filtro = "";
    function build() {
      var log = S.listAudit(session.tenantId).filter(function (a) {
        if (!filtro) return true;
        var f = filtro.toLowerCase();
        return (a.usuario || "").toLowerCase().indexOf(f) !== -1 || (a.accion || "").toLowerCase().indexOf(f) !== -1 || (a.detalle || "").toLowerCase().indexOf(f) !== -1;
      });
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Trazabilidad de Acciones (' + log.length + ')</h3>' +
        '<input id="aud-search" placeholder="Buscar por usuario, acción o detalle…" style="width:280px" value="' + U.esc(filtro) + '"/></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Fecha y Hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' +
        (log.length ? log.map(function (a) {
          return "<tr><td>" + U.fmtFecha(a.fecha) + "</td><td>" + U.esc(a.usuario) + "</td><td>" + (ROL_LABEL[a.rol] || a.rol) + "</td><td><code>" + a.accion + "</code></td><td>" + U.esc(a.detalle) + "</td></tr>";
        }).join("") : '<tr><td colspan="5" class="text-muted">Sin registros.</td></tr>') +
        "</tbody></table></div></div>";
      document.getElementById("aud-search").addEventListener("input", function (e) { filtro = e.target.value; build(); });
    }
    build();
  };

  // ------------------------------------------------------------------
  // LABORATORIOS CLIENTE (SUPERADMIN — CONSOLA BIOSOFT)
  // ------------------------------------------------------------------
  window.BIO_VIEWS.tenants = function (root) {
    function build() {
      var tenants = S.listTenants();
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Laboratorios Cliente (' + tenants.length + ')</h3>' +
        '<button class="btn btn-primary" id="btn-new-tenant">' + U.icon("plus") + ' Crear Nuevo Laboratorio</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Laboratorio</th><th>País</th><th>Nivel</th><th>Usuarios</th><th>Pacientes</th><th>Órdenes</th></tr></thead><tbody>' +
        tenants.map(function (t) {
          return "<tr><td><b>" + U.esc(t.nombre) + "</b><div class='text-muted' style='font-size:11px'>NIT " + U.esc(t.nit || "—") + "</div></td><td>" + t.pais + "</td><td>" + t.nivel + "</td>" +
            "<td>" + S.listUsers(t.id).length + "</td><td>" + S.listPatients(t.id).length + "</td><td>" + S.listOrders(t.id).length + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
      document.getElementById("btn-new-tenant").addEventListener("click", openNewTenant);
    }

    function openNewTenant() {
      var wrap = U.openModal(
        '<h3 class="modal-title">Crear Nuevo Laboratorio Cliente</h3>' +
        '<form id="tenant-form">' +
          '<div class="form-grid">' +
            F.inp("nombre", "Nombre del Laboratorio", "", true) +
            F.inp("nit", "NIT / RIF / RUC", "") +
            F.sel("pais", "País", ["CO", "VE", "EC"].map(function (p) { return "<option value='" + p + "'>" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>"; }).join("")) +
            F.inp("direccion", "Dirección", "") + F.inp("telefonos", "Teléfonos", "") + F.inp("email", "Correo Electrónico", "") +
            F.sel("nivel", "Nivel", [1, 2].map(function (n) { return "<option value='" + n + "'>Nivel " + n + "</option>"; }).join("")) +
          "</div>" +
          '<fieldset><legend>Usuario Administrador Inicial</legend><div class="form-grid">' +
            F.inp("adminNombre", "Nombre del Administrador", "", true) + F.inp("adminUser", "Usuario", "", true) + F.inp("adminPass", "Contraseña", "", true) +
          "</div></fieldset>" +
          '<div class="flex gap-2 justify-between"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Crear Laboratorio</button></div>" +
        "</form>", { lg: true }
      );
      wrap.querySelector("#tenant-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        if (!g("nombre") || !g("adminUser") || !g("adminPass")) { U.toast("Completa los campos obligatorios.", "error"); return; }
        if (S.findUser(g("adminUser"))) { U.toast("Ese usuario administrador ya existe.", "error"); return; }
        var tenant = S.createTenant({ nombre: g("nombre"), nit: g("nit"), pais: g("pais"), direccion: g("direccion"), telefonos: g("telefonos"), email: g("email"), nivel: parseInt(g("nivel"), 10) });
        S.createUser({ tenantId: tenant.id, username: g("adminUser"), password: g("adminPass"), nombre: g("adminNombre"), rol: "admin", secciones: [] });
        S.addAudit(tenant.id, "Soporte BIOsoft", "superadmin", "CREATE_TENANT", "laboratorio", tenant.id, "Se creó el laboratorio cliente " + tenant.nombre + ".");
        U.toast("Laboratorio creado. Clave de administrador para correcciones: " + tenant.claveAdmin, "success");
        U.closeModal(wrap);
        build();
      });
    }
    build();
  };
})();

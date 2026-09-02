/* BIOsoft — Vistas de Administración: Usuarios, Configuración, Auditoría y Laboratorios Cliente (superadmin) */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;

  // El nombre del identificador tributario (NIT/RIF/RUC) cambia según el
  // país elegido en el formulario — actualiza la etiqueta del campo y su
  // placeholder (ej. "V-12345678" para Venezuela) en vivo.
  function actualizarLabelDocumento(wrap, paisFieldId, nitFieldId) {
    var pais = wrap.querySelector("#f_" + paisFieldId).value;
    var input = wrap.querySelector("#f_" + nitFieldId);
    var label = input.parentElement.querySelector("label");
    if (label) label.textContent = C.documentoTributarioLabel(pais);
    input.placeholder = pais === "VE" ? "V-12345678" : "";
  }

  // ------------------------------------------------------------------
  // USUARIOS
  // ------------------------------------------------------------------
  window.BIO_VIEWS.usuarios = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant;

    function build() {
      var users = S.listUsers(session.tenantId);
      tenant = S.getTenant(session.tenantId);
      var activos = users.filter(function (u) { return u.activo; }).length;
      var limite = tenant && tenant.maxUsuarios;
      var alLimite = !!(limite && activos >= limite);
      var contadorTxt = limite ? activos + " de " + limite + " según tu plan" : String(users.length);
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Usuarios del Laboratorio (' + contadorTxt + ')</h3>' +
        '<button class="btn btn-primary" id="btn-new-user">' + U.icon("plus") + ' Nuevo Usuario</button></div>' +
        (alLimite ? '<p class="text-muted" style="margin:0 0 14px;font-size:12.5px">🔒 Alcanzaste el límite de usuarios activos de tu plan actual. Desactiva a alguien para liberar un cupo, o escríbenos para subir de plan.</p>' : "") +
        '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Secciones Asignadas</th><th>Estado</th><th></th></tr></thead><tbody>' +
        users.map(rowHtml).join("") + "</tbody></table></div></div>";
      document.getElementById("btn-new-user").addEventListener("click", function () {
        var activosAhora = S.listUsers(session.tenantId).filter(function (u) { return u.activo; }).length;
        if (limite && activosAhora >= limite) { abrirLimiteAlcanzado(limite, tenant); return; }
        openForm(null);
      });
      root.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openForm(users.filter(function (u) { return u.id === b.dataset.edit; })[0]); }); });
      root.querySelectorAll("[data-toggle]").forEach(function (b) { b.addEventListener("click", function () {
        var u = users.filter(function (x) { return x.id === b.dataset.toggle; })[0];
        S.updateUser(u.id, { activo: !u.activo });
        S.addAudit(session.tenantId, session.nombre, session.rol, "TOGGLE_USER", "usuario", u.id, (u.activo ? "Desactivó" : "Activó") + " al usuario " + u.nombre + ".");
        build();
      }); });

      // Llega aquí desde el botón "🔑 Acceso de Aliado" de una tarjeta de
      // convenio (Cotizaciones → 🤝 Convenios): abre directo el formulario
      // de Nuevo Usuario con el rol y el convenio ya preseleccionados, para
      // no obligar al admin a repetir la búsqueda del convenio.
      var convenioPrefill;
      try { convenioPrefill = sessionStorage.getItem("bio_prefill_aliado_convenio"); } catch (e) { convenioPrefill = null; }
      if (convenioPrefill) {
        try { sessionStorage.removeItem("bio_prefill_aliado_convenio"); } catch (e) {}
        openForm(null, convenioPrefill);
      }
    }

    function abrirLimiteAlcanzado(limite, tenant) {
      var msg = "Hola 👋 mi laboratorio " + (tenant && tenant.nombre ? tenant.nombre : "") + " ya llegó al límite de " + limite + " usuario(s) activo(s) de nuestro plan actual y necesitamos agregar más. ¿Me ayudan a subir de plan?";
      U.openModal(
        '<h3 class="modal-title">Llegaste al límite de tu plan</h3>' +
        '<p class="text-muted">Tu plan actual permite hasta <b>' + limite + ' usuario(s) activo(s)</b>. Para agregar uno nuevo, desactiva a alguien que ya no lo use, o solicita subir de plan.</p>' +
        '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Entendido</button>' +
        '<a class="btn btn-whatsapp" href="https://wa.me/573505457420?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">' + U.icon("send") + " Solicitar más usuarios</a></div>"
      );
    }

    function rowHtml(u) {
      var contacto = [u.numeroDocumento ? "Doc. " + u.numeroDocumento : "", u.telefonoContacto || "", u.correoContacto || ""].filter(Boolean).join(" · ");
      var convenioDelAliado = u.rol === "aliado" && u.convenioId ? S.cotizador.listConvenios(tenant.id).filter(function (c) { return c.id === u.convenioId; })[0] : null;
      return "<tr><td><b>" + U.esc(u.nombre) + "</b>" + (contacto ? "<div class='text-muted' style='font-size:11px'>" + U.esc(contacto) + "</div>" : "") + "</td><td>" + U.esc(u.username) + "</td><td>" + U.esc(C.rolLabel(u.rol, tenant && tenant.pais)) + "</td>" +
        "<td>" + (u.rol === "aliado" ? (convenioDelAliado ? "🤝 " + U.esc(convenioDelAliado.nombre) : '<span class="text-danger">⚠ Sin convenio asignado</span>') : u.rol === "bacteriologo" ? (u.secciones && u.secciones.length ? u.secciones.map(function (s) { return C.seccionNombre(s, tenant); }).join(", ") : "—") : "") +
        (u.puedeGestionarRemisiones ? ' <span class="badge badge-preliminar" title="Puede gestionar remisiones a laboratorio de referencia">Remisiones</span>' : "") +
        (u.permisosExtra && u.permisosExtra.length ? u.permisosExtra.map(function (r) {
          var p = C.PERMISOS_EXTRA_BACTERIOLOGO.concat(C.PERMISOS_EXTRA_RECEPCION).filter(function (x) { return x.route === r; })[0];
          return p ? ' <span class="badge badge-preliminar" title="Permiso adicional">' + U.esc(p.label) + "</span>" : "";
        }).join("") : "") +
        "</td>" +
        "<td>" + (u.activo ? '<span class="badge badge-validado">Activo</span>' : '<span class="badge badge-pendiente">Inactivo</span>') + "</td>" +
        '<td><div class="flex gap-2"><button class="btn btn-ghost btn-sm" data-edit="' + u.id + '">' + U.icon("edit") + " Editar</button>" +
        '<button class="btn btn-outline btn-sm" data-toggle="' + u.id + '">' + (u.activo ? "Desactivar" : "Activar") + "</button></div></td></tr>";
    }

    function openForm(user, convenioPrefillId) {
      var isEdit = !!user;
      user = user || (convenioPrefillId ? { rol: "aliado", secciones: [], activo: true, convenioId: convenioPrefillId } : { rol: "bacteriologo", secciones: [], activo: true });
      var firmaTemp = user.firmaDataUrl || "";
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Usuario" : "Nuevo Usuario") + '</h3>' +
        '<form id="user-form">' +
          '<div class="form-grid">' +
            F.inp("nombre", "Nombre Completo", user.nombre, true) +
            F.inp("numeroDocumento", "Número de Documento de Identidad", user.numeroDocumento, false) +
            F.inp("correoContacto", "Correo Electrónico", user.correoContacto, false, "email") +
            F.inp("telefonoContacto", "Teléfono / WhatsApp", user.telefonoContacto, false) +
            F.inp("username", "Usuario (login)", user.username, true) +
            F.inp("password", "Contraseña", user.password, !isEdit, "text") +
            F.sel("rol", "Rol", ["admin", "bacteriologo", "recepcion", "aliado"].map(function (r) { return '<option value="' + r + '" ' + (r === user.rol ? "selected" : "") + ">" + U.esc(C.rolLabel(r, tenant && tenant.pais)) + "</option>"; }).join("")) +
          "</div>" +
          '<div id="secciones-box" class="field"></div>' +
          '<div id="permisos-extra-box" class="field"></div>' +
          '<div id="convenio-aliado-box" class="field"></div>' +
          '<div id="firma-box"></div>' +
          '<div class="flex gap-2 justify-between" style="margin-top:6px">' +
            '<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button>" +
          "</div>" +
        "</form>", { lg: true }
      );
      function renderSecciones() {
        var rol = wrap.querySelector("#f_rol").value;
        var box = wrap.querySelector("#secciones-box");
        // Un Auxiliar/Asistente ya NO se limita por sección (ver
        // views-results.js -> puedeEditar): con el permiso adicional
        // "Resultados" marcado abajo, captura cualquier examen de
        // cualquier sección — nunca valida/firma. Solo el Bacteriólogo(a)/
        // Bioanalista sigue usando este checklist, para asignarle
        // puntualmente en qué secciones captura y valida.
        if (rol !== "bacteriologo") { box.innerHTML = ""; return; }
        box.innerHTML = "<label>Secciones que puede capturar y validar</label><div class='form-grid'>" +
          C.seccionesEfectivas(tenant).map(function (s) {
            var checked = (user.secciones || []).indexOf(s.id) !== -1;
            return '<div class="checkbox-row"><input type="checkbox" data-sec="' + s.id + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + s.nombre + "</label></div>";
          }).join("") + "</div>" +
          '<div class="checkbox-row" style="margin-top:10px"><input type="checkbox" id="f_puedeGestionarRemisiones" ' + (user.puedeGestionarRemisiones ? "checked" : "") + '/><label style="margin:0" for="f_puedeGestionarRemisiones">Puede gestionar remisiones a laboratorio de referencia (generar Hoja de Remisión, marcar exámenes remitidos y cargar los resultados externos)</label></div>';
      }
      // Además de sus secciones, un Bacteriólogo(a)/Bioanalista puede recibir
      // acceso a pantallas que normalmente son de Recepción/Administración
      // (crear pacientes, crear órdenes, facturación, etc.) — útil en
      // laboratorios pequeños donde la misma persona hace de todo. Se puede
      // agregar o quitar en cualquier momento editando al usuario; "usuarios",
      // "config" y "auditoría" nunca aparecen aquí, se quedan solo para
      // Administrador.
      function renderPermisosExtra() {
        var rol = wrap.querySelector("#f_rol").value;
        var box = wrap.querySelector("#permisos-extra-box");
        var catalogo = rol === "bacteriologo" ? C.PERMISOS_EXTRA_BACTERIOLOGO : rol === "recepcion" ? C.PERMISOS_EXTRA_RECEPCION : null;
        if (!catalogo) { box.innerHTML = ""; return; }
        var disponibles = catalogo.filter(function (p) { return !p.soloCO || (tenant && tenant.pais === "CO"); });
        box.innerHTML = "<label>Permisos adicionales (además de sus secciones)</label><div class='form-grid'>" +
          disponibles.map(function (p) {
            var checked = (user.permisosExtra || []).indexOf(p.route) !== -1;
            return '<div class="checkbox-row"><input type="checkbox" data-permextra="' + p.route + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + U.esc(p.label) + "</label></div>";
          }).join("") + "</div>" +
          '<p class="text-muted" style="margin:6px 0 0;font-size:12px">Marca solo lo que necesite este usuario en concreto — puedes agregar o quitar cualquiera de estos permisos después, editándolo de nuevo.</p>';
      }
      // Un usuario "aliado" no es personal del laboratorio: es el acceso de
      // solo consulta que se le entrega a una empresa/convenio (ver
      // "🤝 Convenios" en Cotizaciones) para que vea SOLO los resultados
      // ligados a ese convenio — nunca a ningún otro paciente ni orden. Por
      // eso, en vez de secciones/permisos extra, aquí solo se le asigna A
      // CUÁL convenio queda ligado; firestore.rules impide que vea nada más
      // aunque intente escribir directo a Firestore.
      function renderConvenioAliado() {
        var rol = wrap.querySelector("#f_rol").value;
        var box = wrap.querySelector("#convenio-aliado-box");
        if (rol !== "aliado") { box.innerHTML = ""; return; }
        var convenios = S.cotizador.listConvenios(tenant.id).filter(function (c) { return c.activo; });
        if (!convenios.length) {
          box.innerHTML = '<p class="text-danger" style="font-size:13px">Aún no has creado ningún convenio activo. Ve primero a Cotizaciones → 🤝 Convenios y crea el convenio de esta empresa antes de darle su acceso.</p>';
          return;
        }
        box.innerHTML = "<label>Convenio / Empresa Aliada (solo verá resultados de este convenio)</label><select id='f_convenioId'>" +
          '<option value="">Selecciona el convenio…</option>' +
          convenios.map(function (c) { return '<option value="' + c.id + '" ' + (c.id === user.convenioId ? "selected" : "") + '>' + U.esc(c.nombre) + "</option>"; }).join("") +
          "</select>";
      }
      function renderFirma() {
        var rol = wrap.querySelector("#f_rol").value;
        var box = wrap.querySelector("#firma-box");
        if (rol !== "bacteriologo" && rol !== "admin") { box.innerHTML = ""; return; }
        box.innerHTML =
          '<fieldset><legend>Firma y Registro Profesional</legend>' +
          '<p class="text-muted" style="margin-top:0;font-size:12.5px">Esta firma se imprimirá en los informes de resultados que este usuario valide, junto con su registro profesional, según lo exige la normativa de habilitación.</p>' +
          '<div class="form-grid">' +
            F.inp("registroProfesional", "Registro Profesional (Tarjeta Profesional)", user.registroProfesional, false) +
            '<div class="field"><label>Firma Escaneada (imagen)</label><input type="file" id="f_firmaFile" accept="image/*"/></div>' +
          "</div>" +
          '<div id="firma-preview" style="margin-top:8px">' + (firmaTemp ? '<img src="' + firmaTemp + '" style="height:60px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:4px"/>' : '<span class="text-muted">Sin firma cargada</span>') + "</div>" +
          "</fieldset>";
        wrap.querySelector("#f_firmaFile").addEventListener("change", function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            firmaTemp = ev.target.result;
            wrap.querySelector("#firma-preview").innerHTML = '<img src="' + firmaTemp + '" style="height:60px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:4px"/>';
          };
          reader.readAsDataURL(file);
        });
      }
      wrap.querySelector("#f_rol").addEventListener("change", function () { renderSecciones(); renderPermisosExtra(); renderConvenioAliado(); renderFirma(); });
      renderSecciones();
      renderPermisosExtra();
      renderConvenioAliado();
      renderFirma();

      wrap.querySelector("#user-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        var secciones = Array.prototype.slice.call(wrap.querySelectorAll("[data-sec]:checked")).map(function (c) { return c.dataset.sec; });
        var chkRemisiones = wrap.querySelector("#f_puedeGestionarRemisiones");
        var data = {
          nombre: g("nombre"), numeroDocumento: g("numeroDocumento"), correoContacto: g("correoContacto"), telefonoContacto: g("telefonoContacto"),
          username: g("username"), rol: g("rol"), secciones: secciones, tenantId: session.tenantId, activo: true,
          puedeGestionarRemisiones: false
        };
        if (data.rol === "bacteriologo" && chkRemisiones) data.puedeGestionarRemisiones = chkRemisiones.checked;
        if (data.rol === "bacteriologo" || data.rol === "recepcion") {
          data.permisosExtra = Array.prototype.slice.call(wrap.querySelectorAll("[data-permextra]:checked")).map(function (c) { return c.dataset.permextra; });
        } else {
          data.permisosExtra = [];
        }
        if (data.rol === "aliado") {
          var selConvenio = wrap.querySelector("#f_convenioId");
          data.convenioId = selConvenio ? selConvenio.value : "";
        } else {
          data.convenioId = "";
        }
        var pass = g("password");
        if (pass) data.password = pass;
        if (data.rol === "bacteriologo" || data.rol === "admin") {
          data.registroProfesional = g("registroProfesional");
          data.firmaDataUrl = firmaTemp;
        }
        if (!data.nombre || !data.username || (!isEdit && !pass)) { U.toast("Completa nombre, usuario y contraseña.", "error"); return; }
        if (data.rol === "aliado" && !data.convenioId) {
          U.toast("Selecciona a qué convenio/empresa queda ligado este acceso.", "error");
          return;
        }
        if (!isEdit) {
          var tenantAhora = S.getTenant(session.tenantId);
          var limiteAhora = tenantAhora && tenantAhora.maxUsuarios;
          var activosAhora2 = S.listUsers(session.tenantId).filter(function (u) { return u.activo; }).length;
          if (limiteAhora && activosAhora2 >= limiteAhora) {
            U.toast("Alcanzaste el límite de " + limiteAhora + " usuario(s) de tu plan actual.", "error");
            return;
          }
        }
        var esReal = S.isRealMode();

        if (isEdit) {
          if (esReal) delete data.password; // el cambio de clave de una cuenta real se hace por Firebase, no aquí
          S.updateUser(user.id, data);
          S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_USER", "usuario", user.id, "Actualizó al usuario " + data.nombre + ".");
          U.toast("Usuario guardado.", "success");
          U.closeModal(wrap);
          build();
          return;
        }

        if (esReal) {
          if (data.username.indexOf("@") === -1) { U.toast("En un laboratorio real, el usuario debe ser un correo electrónico válido.", "error"); return; }
          if (pass.length < 6) { U.toast("La contraseña debe tener al menos 6 caracteres.", "error"); return; }
          var submitBtn = wrap.querySelector('button[type="submit"]');
          submitBtn.disabled = true; submitBtn.textContent = "Creando…";
          S.provisionRealAccount({ tenantId: session.tenantId, userData: data }).then(function (res) {
            // No hace falta reflejarlo aquí a mano: el listener de Firestore ya
            // está escuchando esta colección y lo agrega solo en cuanto llega.
            U.toast("Usuario guardado.", "success");
            U.closeModal(wrap);
            build();
          }).catch(function (err) {
            submitBtn.disabled = false; submitBtn.textContent = "Guardar";
            var msg = (err && err.code === "auth/email-already-in-use") ? "Ese correo ya tiene una cuenta." : (err && err.message) || "No se pudo crear el usuario.";
            U.toast(msg, "error");
          });
          return;
        }

        if (S.findUser(data.username)) { U.toast("Ese nombre de usuario ya existe.", "error"); return; }
        var created = S.createUser(data);
        S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_USER", "usuario", created.id, "Creó al usuario " + data.nombre + " (" + C.rolLabel(data.rol, tenant && tenant.pais) + ").");
        U.toast("Usuario guardado.", "success");
        U.closeModal(wrap);
        build();
      });
    }
    build();
  };

  // ------------------------------------------------------------------
  // VALORES DE REFERENCIA DEL CATÁLOGO (personalizables por laboratorio)
  // ------------------------------------------------------------------
  // Cambia la posición de un examen dentro de su sección, dentro de la
  // preferencia de orden GLOBAL del laboratorio (tenant.ordenExamenes). La
  // primera vez que se reordena algo, se parte del orden natural del
  // catálogo para que el resto de exámenes no salte de posición sin razón.
  function moverExamen(tenant, examId, direccion) {
    var todos = C.examenesEfectivos(tenant);
    var orden = (tenant.ordenExamenes && tenant.ordenExamenes.length) ? tenant.ordenExamenes.slice() : todos.map(function (e) { return e.id; });
    todos.forEach(function (e) { if (orden.indexOf(e.id) === -1) orden.push(e.id); });
    var porId = {};
    todos.forEach(function (e) { porId[e.id] = e; });
    var seccionId = porId[examId].seccion;
    var idsSeccion = orden.filter(function (id) { var ex = porId[id]; return ex && ex.seccion === seccionId; });
    var pos = idsSeccion.indexOf(examId);
    var destino = pos + direccion;
    if (destino < 0 || destino >= idsSeccion.length) return orden;
    var otroId = idsSeccion[destino];
    var i1 = orden.indexOf(examId), i2 = orden.indexOf(otroId);
    var tmp = orden[i1]; orden[i1] = orden[i2]; orden[i2] = tmp;
    return orden;
  }

  window.BIO_VIEWS.catalogo = function (root) {
    var session = BIO_AUTH.getSession();
    var filtroSeccion = "todas";
    var busqueda = "";
    var tenant;

    // El buscador y el filtro de sección viven en un "shell" que se
    // renderiza una sola vez (build()) — antes, cada letra tecleada en
    // "cat-busqueda" volvía a armar TODA la pantalla (root.innerHTML)
    // incluyendo el propio campo de búsqueda, que se recreaba vacío y sin
    // foco a mitad de tecleo: se sentía como que el buscador "se bloquea
    // o se sale" con cada letra (bug real reportado). Ahora, teclear en
    // el buscador solo vuelve a pintar la tabla de resultados
    // (renderTabla(), que reemplaza únicamente "#cat-tabla-wrap") — el
    // campo de búsqueda nunca se toca mientras se escribe en él.
    function renderTabla() {
      var exams = C.examenesEfectivos(tenant).filter(function (e) {
        var okSec = filtroSeccion === "todas" || e.seccion === filtroSeccion;
        var okBusq = !busqueda || U.normalizar(e.nombre).indexOf(U.normalizar(busqueda)) !== -1 || e.cups.indexOf(busqueda) !== -1;
        return okSec && okBusq;
      });
      // El orden de exámenes solo tiene sentido dentro de una sección
      // específica (así se agrupan en el PDF y en captura de resultados),
      // por eso las flechas de mover solo aparecen con una sección elegida.
      var permiteOrdenar = filtroSeccion !== "todas" && !busqueda;
      if (permiteOrdenar) exams = C.ordenarPorExamen(exams, tenant, function (e) { return e.id; });
      document.getElementById("cat-tabla-wrap").innerHTML =
        '<div class="table-wrap"><table><thead><tr>' + (permiteOrdenar ? "<th></th>" : "") + '<th>Examen</th><th>Sección</th><th># Parámetros</th><th>Estado</th><th></th></tr></thead><tbody>' +
        (exams.length ? exams.map(function (e, i) { return rowHtml(e, i, exams.length, permiteOrdenar); }).join("") : '<tr><td colspan="' + (permiteOrdenar ? 6 : 5) + '" class="text-muted">Sin resultados.</td></tr>') +
        "</tbody></table></div>";

      root.querySelectorAll("[data-editexam]").forEach(function (b) { b.addEventListener("click", function () { openExamEditor(b.dataset.editexam, build); }); });
      root.querySelectorAll("[data-eliminarexam]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("¿Eliminar este examen propio del laboratorio? Esta acción no se puede deshacer.")) return;
          C.eliminarExamenPersonalizado(tenant, b.dataset.eliminarexam);
          S.updateTenant(tenant.id, { examenesPersonalizados: tenant.examenesPersonalizados, examCustom: tenant.examCustom || {}, ordenExamenes: tenant.ordenExamenes || [] });
          S.addAudit(session.tenantId, session.nombre, session.rol, "DELETE_EXAM", "catalogo", b.dataset.eliminarexam, "Eliminó un examen propio del catálogo del laboratorio.");
          U.toast("Examen eliminado.", "success");
          renderTabla();
        });
      });
      root.querySelectorAll("[data-mover]").forEach(function (b) {
        b.addEventListener("click", function () {
          var nuevoOrden = moverExamen(tenant, b.dataset.mover, parseInt(b.dataset.dir, 10));
          S.updateTenant(tenant.id, { ordenExamenes: nuevoOrden });
          renderTabla();
        });
      });
      root.querySelectorAll("[data-restablecerexam]").forEach(function (b) {
        b.addEventListener("click", function () {
          restablecerExamenConfirmando(b.dataset.restablecerexam, renderTabla);
        });
      });
      root.querySelectorAll("[data-ocultarexam]").forEach(function (b) {
        b.addEventListener("click", function () {
          var ex = C.examenPorId(b.dataset.ocultarexam);
          if (!confirm('¿Dejar de ofrecer "' + (ex ? ex.nombre : b.dataset.ocultarexam) + '" en órdenes y cotizaciones nuevas de tu laboratorio? Las órdenes que ya lo tengan no se afectan — puedes volver a ofrecerlo cuando quieras con "Mostrar".')) return;
          C.ocultarExamenFabrica(tenant, b.dataset.ocultarexam);
          S.updateTenant(tenant.id, { examenesOcultos: tenant.examenesOcultos });
          S.addAudit(session.tenantId, session.nombre, session.rol, "HIDE_EXAM", "catalogo", b.dataset.ocultarexam, "Dejó de ofrecer el examen " + (ex ? ex.nombre : b.dataset.ocultarexam) + ".");
          U.toast("Ya no se ofrecerá este examen en órdenes/cotizaciones nuevas.", "success");
          renderTabla();
        });
      });
      root.querySelectorAll("[data-mostrarexam]").forEach(function (b) {
        b.addEventListener("click", function () {
          var ex = C.examenPorId(b.dataset.mostrarexam);
          C.mostrarExamenFabrica(tenant, b.dataset.mostrarexam);
          S.updateTenant(tenant.id, { examenesOcultos: tenant.examenesOcultos });
          S.addAudit(session.tenantId, session.nombre, session.rol, "SHOW_EXAM", "catalogo", b.dataset.mostrarexam, "Volvió a ofrecer el examen " + (ex ? ex.nombre : b.dataset.mostrarexam) + ".");
          U.toast("Examen disponible de nuevo.", "success");
          renderTabla();
        });
      });
    }

    function build() {
      tenant = S.getTenant(session.tenantId);
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Valores de Referencia del Catálogo</h3>' +
        '<button class="btn btn-primary btn-sm" id="btn-nuevo-examen">' + U.icon("plus") + " Agregar Examen Nuevo</button></div>" +
        '<p class="text-muted" style="margin-top:0">Cada laboratorio puede usar equipos o metodologías distintas, por lo que los valores normales pueden variar. Ajusta aquí los rangos de tu laboratorio sin afectar el catálogo general de BIOsoft; los cambios se aplican de inmediato en la captura de resultados y en los informes. Elige una sección específica para poder ordenar tus exámenes como los trabajas normalmente. Si tu laboratorio procesa una prueba que el catálogo no trae, agrégala con "Agregar Examen Nuevo".</p>' +
        '<div class="flex gap-2 wrap" style="margin-bottom:14px">' +
        '<input id="cat-busqueda" placeholder="Buscar examen por nombre o código CUPS…" style="max-width:320px" value="' + U.esc(busqueda) + '"/>' +
        '<select id="cat-seccion"><option value="todas">Todas las secciones</option>' + C.seccionesEfectivas(tenant).map(function (s) { return '<option value="' + s.id + '" ' + (s.id === filtroSeccion ? "selected" : "") + ">" + s.nombre + "</option>"; }).join("") + "</select>" +
        '<button class="btn btn-outline btn-sm" id="btn-nueva-categoria">' + U.icon("plus") + " Nueva Categoría</button>" +
        (filtroSeccion !== "todas" && (tenant.seccionesPersonalizadas || []).some(function (s) { return s.id === filtroSeccion; }) ?
          '<button class="btn btn-ghost btn-sm" id="btn-eliminar-categoria" title="Eliminar esta categoría">' + U.icon("trash") + " Eliminar Categoría</button>" : "") +
        "</div>" +
        '<div id="cat-tabla-wrap"></div></div>';

      document.getElementById("cat-busqueda").addEventListener("input", function (e) { busqueda = e.target.value; renderTabla(); });
      document.getElementById("cat-seccion").addEventListener("change", function (e) { filtroSeccion = e.target.value; build(); });
      document.getElementById("btn-nuevo-examen").addEventListener("click", function () { abrirCrearExamen(tenant, build); });
      document.getElementById("btn-nueva-categoria").addEventListener("click", function () { abrirCrearCategoria(tenant, build); });
      var btnEliminarCategoria = document.getElementById("btn-eliminar-categoria");
      if (btnEliminarCategoria) btnEliminarCategoria.addEventListener("click", function () {
        if (!confirm("¿Eliminar esta categoría? Solo se puede si ya no tiene exámenes propios asignados.")) return;
        var enUso = C.eliminarSeccionPersonalizada(tenant, filtroSeccion);
        if (enUso) { U.toast("No se puede eliminar: todavía tiene " + enUso + " examen(es) propio(s) asignados. Muévelos o elimínalos primero.", "error"); return; }
        S.updateTenant(tenant.id, { seccionesPersonalizadas: tenant.seccionesPersonalizadas || [] });
        S.addAudit(session.tenantId, session.nombre, session.rol, "DELETE_SECTION", "catalogo", filtroSeccion, "Eliminó una categoría propia del catálogo.");
        U.toast("Categoría eliminada.", "success");
        filtroSeccion = "todas";
        build();
      });
      renderTabla();
    }

    // Deja un examen de fábrica exactamente como viene de BIOsoft, por si
    // alguna personalización (campo agregado/oculto, rango, banda por
    // género/edad) quedó mal armada y está dando problemas — sin tener que
    // ir quitando override por override a mano. Se usa tanto desde la lista
    // como desde dentro del editor de un examen.
    function restablecerExamenConfirmando(examId, alTerminar) {
      var ex = C.examenPorId(examId) || C.examenPersonalizadoPorId(examId, tenant);
      if (!confirm('¿Restablecer "' + (ex ? ex.nombre : examId) + '" a los valores originales de fábrica de BIOsoft? Se pierden el nombre, método, campos agregados/ocultados, orden, rangos y bandas que le hayas configurado a este examen en tu laboratorio — no afecta las órdenes ya guardadas.')) return;
      C.restablecerExamenAFabrica(tenant, examId);
      S.updateTenant(tenant.id, { examCustom: tenant.examCustom || {}, refOverrides: tenant.refOverrides || {}, refRangos: tenant.refRangos || {}, refBandas: tenant.refBandas || {} });
      S.addAudit(session.tenantId, session.nombre, session.rol, "RESET_EXAM_TO_FACTORY", "catalogo", examId, "Restableció el examen " + (ex ? ex.nombre : examId) + " a los valores originales de fábrica.");
      U.toast("Examen restablecido a valores de fábrica.", "success");
      alTerminar();
    }

    function rowHtml(e, i, total, permiteOrdenar) {
      var personalizado = C.tieneOverride(e.id, tenant);
      var propio = C.esExamenPropio(e.id, tenant);
      var oculto = !propio && C.examenOculto(tenant, e.id);
      return "<tr>" +
        (permiteOrdenar ? "<td><div class='flex gap-2'>" +
          '<button class="btn btn-ghost btn-sm" data-mover="' + e.id + '" data-dir="-1" ' + (i === 0 ? "disabled" : "") + ' title="Subir">▲</button>' +
          '<button class="btn btn-ghost btn-sm" data-mover="' + e.id + '" data-dir="1" ' + (i === total - 1 ? "disabled" : "") + ' title="Bajar">▼</button>' +
          "</div></td>" : "") +
        "<td>" + U.esc(e.nombre) + "<div class='text-muted' style='font-size:11px'>" + (e.cups ? "CUPS " + U.esc(e.cups) : "Sin CUPS") + "</div></td><td>" + C.seccionNombre(e.seccion, tenant) + "</td><td>" + e.parametros.length + "</td>" +
        "<td>" + (oculto ? '<span class="badge badge-suspendido">No ofrecido</span>' : propio ? '<span class="badge badge-validado">Examen propio</span>' : personalizado ? '<span class="badge badge-preliminar">Personalizado</span>' : '<span class="text-muted">Valores de fábrica</span>') + "</td>" +
        '<td><div class="flex gap-2 wrap"><button class="btn btn-outline btn-sm" data-editexam="' + e.id + '">' + U.icon("edit") + " Editar</button>" +
        (propio ? '<button class="btn btn-ghost btn-sm" data-eliminarexam="' + e.id + '" title="Eliminar este examen propio">' + U.icon("trash") + "</button>" : "") +
        (!propio && personalizado ? '<button class="btn btn-ghost btn-sm" data-restablecerexam="' + e.id + '" title="Restablecer este examen a los valores originales de fábrica de BIOsoft">' + U.icon("history") + " Restablecer</button>" : "") +
        (!propio ? (oculto ?
          '<button class="btn btn-ghost btn-sm" data-mostrarexam="' + e.id + '" title="Volver a ofrecer este examen en órdenes y cotizaciones nuevas">' + U.icon("eye") + " Mostrar</button>" :
          '<button class="btn btn-ghost btn-sm" data-ocultarexam="' + e.id + '" title="Dejar de ofrecer este examen en órdenes y cotizaciones nuevas (las órdenes ya creadas con él no se afectan)">' + U.icon("eye-off") + " No Ofrecer</button>") : "") +
        "</div></td></tr>";
    }
    build();
  };

  function abrirCrearCategoria(tenant, onDone) {
    var session = BIO_AUTH.getSession();
    var wrap = U.openModal(
      '<h3 class="modal-title">Nueva Categoría</h3>' +
      '<p class="text-muted" style="margin-top:0">Crea una categoría propia para agrupar exámenes que no encajan en las secciones del catálogo (Hematología, Química Sanguínea, etc.). Queda disponible de inmediato para asignar exámenes, órdenes, usuarios e informes, igual que las demás.</p>' +
      '<form id="categoria-form">' +
      F.inp("nombre", "Nombre de la Categoría", "", true) +
      '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Crear Categoría</button></div>" +
      "</form>"
    );
    wrap.querySelector("#categoria-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nombre = wrap.querySelector("#f_nombre").value.trim();
      if (!nombre) { U.toast("Ponle un nombre a la categoría.", "error"); return; }
      var yaExiste = C.seccionesEfectivas(tenant).some(function (s) { return U.normalizar(s.nombre) === U.normalizar(nombre); });
      if (yaExiste) { U.toast("Ya existe una categoría con ese nombre.", "error"); return; }
      var nueva = C.crearSeccionPersonalizada(tenant, nombre);
      S.updateTenant(tenant.id, { seccionesPersonalizadas: tenant.seccionesPersonalizadas });
      S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_SECTION", "catalogo", nueva.id, 'Agregó la categoría propia "' + nombre + '" al catálogo del laboratorio.');
      U.toast("Categoría creada. Ya puedes agregarle exámenes.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  function abrirCrearExamen(tenant, onDone) {
    var session = BIO_AUTH.getSession();
    var wrap = U.openModal(
      '<h3 class="modal-title">Agregar Examen Nuevo</h3>' +
      '<p class="text-muted" style="margin-top:0">Crea un examen que tu laboratorio procesa y que el catálogo de BIOsoft no trae. Después de guardarlo podrás agregarle todos los parámetros y valores de referencia que necesites.</p>' +
      '<form id="nuevo-examen-form"><div class="form-grid">' +
      F.inp("nombre", "Nombre del Examen", "", true) +
      F.sel("seccion", "Sección", C.seccionesEfectivas(tenant).map(function (s) { return "<option value='" + s.id + "'>" + s.nombre + "</option>"; }).join("")) +
      F.inp("cups", "Código CUPS (opcional)", "") +
      F.sel("nivel", "Nivel de Complejidad", [1, 2].map(function (n) { return "<option value='" + n + "'>Nivel " + n + "</option>"; }).join("")) +
      F.inp("muestra", "Tipo de Muestra (opcional)", "") +
      F.inp("metodo", "Método / Técnica (opcional, ej: ELISA, Electroquimioluminiscencia)", "") +
      F.sel("tubo", "Tubo de Recolección", Object.keys(C.TUBOS).map(function (k) { return "<option value='" + k + "'>" + C.TUBOS[k].nombre + "</option>"; }).join("")) +
      "</div>" +
      '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Crear y Agregar Parámetros</button></div>" +
      "</form>"
    );
    wrap.querySelector("#nuevo-examen-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
      var nombre = g("nombre");
      if (!nombre) { U.toast("Ponle un nombre al examen.", "error"); return; }
      var nuevo = C.crearExamenPersonalizado(tenant, {
        nombre: nombre, seccion: g("seccion"), cups: g("cups"), nivel: parseInt(g("nivel"), 10) || 1,
        muestra: g("muestra"), metodo: g("metodo"), tubo: g("tubo")
      });
      S.updateTenant(tenant.id, { examenesPersonalizados: tenant.examenesPersonalizados });
      S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_EXAM", "catalogo", nuevo.id, 'Agregó el examen propio "' + nombre + '" al catálogo del laboratorio.');
      U.toast("Examen creado. Ahora agrega sus parámetros.", "success");
      U.closeModal(wrap);
      openExamEditor(nuevo.id, onDone);
    });
  }

  // Encuentra la definición "de origen" de un parámetro: la del catálogo
  // global si es un campo de fábrica, o la definición con la que se creó si
  // es un campo personalizado (para poder compararla y ofrecer
  // "Restablecer" también en los campos que el laboratorio agregó).
  function origenDeCampo(exCat, custom, codigo) {
    var deFabrica = exCat.parametros.filter(function (x) { return x.codigo === codigo; })[0];
    if (deFabrica) return deFabrica;
    return (custom.personalizados || []).filter(function (x) { return x.codigo === codigo; })[0];
  }

  function openExamEditor(examId, onDone) {
    var session = BIO_AUTH.getSession();
    var tenant = S.getTenant(session.tenantId);
    var propio = C.esExamenPropio(examId, tenant);
    var exCat = C.examenPorId(examId) || C.examenPersonalizadoPorId(examId, tenant);
    // Un examen propio guardado sin ningún parámetro (se creó y se cerró
    // este mismo editor antes de agregarle campos) no debe impedir volver a
    // abrirlo para completarlo — se normaliza aquí en vez de romper.
    if (exCat && !Array.isArray(exCat.parametros)) exCat = Object.assign({}, exCat, { parametros: [] });
    var efectivo = C.examenEfectivo(examId, tenant);
    var custom = (tenant.examCustom && tenant.examCustom[examId]) || {};
    var ocultos = (custom.ocultos || []).map(function (codigo) {
      var deFabrica = exCat.parametros.filter(function (p) { return p.codigo === codigo; })[0];
      return deFabrica ? { codigo: codigo, nombre: deFabrica.nombre } : null;
    }).filter(Boolean);

    function reabrir() { U.closeModal(wrap); onDone(); openExamEditor(examId, onDone); }

    function paramRow(p, idx, total) {
      var esDeFabrica = exCat.parametros.some(function (x) { return x.codigo === p.codigo; });
      var base = origenDeCampo(exCat, custom, p.codigo);
      var moverHtml = '<div class="flex gap-1">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-mover-campo="' + p.codigo + '" data-dir="-1" ' + (idx === 0 ? "disabled" : "") + ' title="Subir">▲</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-mover-campo="' + p.codigo + '" data-dir="1" ' + (idx === total - 1 ? "disabled" : "") + ' title="Bajar">▼</button>' +
        "</div>";
      var quitarHtml = '<button type="button" class="btn btn-ghost btn-sm" data-quitar-campo="' + p.codigo + '">' + (esDeFabrica ? "Quitar" : "Eliminar") + "</button>";
      var codigoHtml = ' <code style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-size:10px;color:var(--text-muted);font-family:monospace" title="Código de este parámetro — úsalo en fórmulas de Valor Calculado">' + U.esc(p.codigo) + "</code>";
      var nombreHtml = U.esc(p.nombre) + codigoHtml + (esDeFabrica ? "" : ' <span class="badge badge-preliminar" style="font-size:9px">Personalizado</span>');

      if (p.tipo === "numerico") {
        var overNum = base && (p.min !== base.min || p.max !== base.max || p.refText !== base.refText);
        var conBandas = C.tieneBandas(tenant, examId, p.codigo);
        var bandasHtml = '<button type="button" class="btn btn-ghost btn-sm" data-bandas="' + p.codigo + '" title="Definir rangos distintos por género y/o edad">🚻 ' + (conBandas ? "Rangos (activo)" : "Por género/edad") + "</button>";
        var conRangos = C.tieneRangosInterpretacion(tenant, examId, p.codigo);
        var rangosHtml = '<button type="button" class="btn btn-ghost btn-sm" data-rangos="' + p.codigo + '" title="Definir varios tramos de valor con su propia interpretación (ej. Normal / Prediabetes / Diabetes)">📊 ' + (conRangos ? "Interpretación (activa)" : "Rangos de Interpretación") + "</button>";
        var calculadoHtml = '<button type="button" class="btn btn-ghost btn-sm" data-calculado="' + p.codigo + '" title="Calcularlo automáticamente a partir de otros parámetros, en vez de digitarlo a mano">🧮 ' + (p.calculado ? "Calculado (activo)" : "Valor Calculado") + "</button>";
        return '<tr data-prow="' + p.codigo + '">' +
          "<td>" + moverHtml + "</td>" +
          "<td>" + nombreHtml + '<div class="text-muted" style="font-size:11px">' + (p.unidad || "") + (p.calculado ? ' · <span title="' + U.esc(p.formula || "") + '">🧮 Calculado</span>' : "") + "</div></td>" +
          '<td><input type="number" step="any" data-min value="' + p.min + '" style="width:90px" title="' + (conRangos ? "Se usa solo si un resultado no cae en ninguno de los rangos de interpretación" : "") + '"/></td>' +
          '<td><input type="number" step="any" data-max value="' + p.max + '" style="width:90px" title="' + (conRangos ? "Se usa solo si un resultado no cae en ninguno de los rangos de interpretación" : "") + '"/></td>' +
          '<td><input data-reftext value="' + U.esc(p.refText) + '" ' + (conRangos ? "disabled title='Se genera automáticamente a partir de los rangos de interpretación'" : "") + "/></td>" +
          '<td class="text-muted" style="font-size:11px">' + (esDeFabrica ? "Fábrica: " + base.min + " - " + base.max : "—") + "</td>" +
          "<td><div class='flex gap-1 wrap'>" + (overNum ? '<button type="button" class="btn btn-ghost btn-sm" data-reset="' + p.codigo + '">Restablecer</button>' : "") + bandasHtml + rangosHtml + calculadoHtml + quitarHtml + "</div></td></tr>";
      }
      if (p.tipo === "cualitativo" || p.tipo === "descriptivo") {
        var overCual = base && (p.normal !== base.normal || p.refText !== base.refText);
        return '<tr data-prow="' + p.codigo + '">' +
          "<td>" + moverHtml + "</td>" +
          "<td>" + nombreHtml + "</td>" +
          '<td colspan="2">' +
          (p.tipo === "cualitativo"
            ? '<label class="text-muted" style="font-size:11px">Valor normal</label><select data-normal>' + p.opciones.map(function (o) { return "<option " + (o === p.normal ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select>"
            : '<span class="text-muted" style="font-size:11px">Campo descriptivo (sin interpretación automática)</span>') +
          "</td>" +
          '<td><input data-reftext value="' + U.esc(p.refText) + '"/></td>' +
          '<td class="text-muted" style="font-size:11px">' + (esDeFabrica ? "Fábrica: " + U.esc(base.normal || "—") : "—") + "</td>" +
          "<td><div class='flex gap-1 wrap'>" + (overCual ? '<button type="button" class="btn btn-ghost btn-sm" data-reset="' + p.codigo + '">Restablecer</button>' : "") + quitarHtml + "</div></td></tr>";
      }
      if (p.tipo === "panel") {
        var etiquetaPanel = p.panelTipo === "alergia" ? "Panel de selección — Alergia (IgE por alérgeno, Clase/Interpretación automática)" : "Panel de selección — Antibiograma (Sensible/Intermedio/Resistente)";
        return '<tr data-prow="' + p.codigo + '">' +
          "<td>" + moverHtml + "</td>" +
          "<td>" + nombreHtml + '</td><td colspan="3" class="text-muted">' + etiquetaPanel + "</td>" +
          "<td>" + quitarHtml + "</td></tr>";
      }
      return '<tr data-prow="' + p.codigo + '">' +
        "<td>" + moverHtml + "</td>" +
        "<td>" + nombreHtml + '</td><td colspan="3" class="text-muted">Campo de texto libre (sin valores de referencia numéricos)</td>' +
        "<td>" + quitarHtml + "</td></tr>";
    }

    var wrap = U.openModal(
      '<h3 class="modal-title">Valores de Referencia — ' + U.esc(exCat.nombre) + '</h3>' +
      '<p class="text-muted" style="margin-top:0">' + (exCat.cups ? "CUPS " + U.esc(exCat.cups) + " — " : "") + "reordena los campos con ▲▼, quita los que no uses o agrega uno propio, tal como lo trabajas en tu laboratorio.</p>" +
      '<div class="form-grid" style="max-width:640px">' +
      '<div class="field"><label>Nombre del examen (como lo usa tu laboratorio)</label>' +
      '<input id="cat-nombre-examen" value="' + U.esc(efectivo.nombre) + '"/></div>' +
      '<div class="field"><label>Método / Técnica (opcional)</label>' +
      '<input id="cat-metodo-examen" placeholder="Ej: ELISA, Electroquimioluminiscencia…" value="' + U.esc(efectivo.metodo || "") + '"/></div>' +
      (!propio ? F.sel("cat_seccion", "Sección", C.seccionesEfectivas(tenant).map(function (s) { return "<option value='" + s.id + "' " + (s.id === efectivo.seccion ? "selected" : "") + ">" + s.nombre + "</option>"; }).join("")) : "") +
      (!propio ? F.sel("cat_tubo", "Tubo de Recolección", Object.keys(C.TUBOS).map(function (k) { return "<option value='" + k + "' " + (k === efectivo.tubo ? "selected" : "") + ">" + C.TUBOS[k].nombre + "</option>"; }).join("")) : "") +
      "</div>" +
      (efectivo.nombre !== exCat.nombre ? '<p class="text-muted" style="margin:2px 0 12px;font-size:12px">Nombre de fábrica: ' + U.esc(exCat.nombre) + ' — <button type="button" class="btn btn-ghost btn-sm" id="btn-restablecer-nombre" style="padding:2px 6px">Restablecer</button></p>' : "") +
      (!propio && efectivo.seccion !== exCat.seccion ? '<p class="text-muted" style="margin:2px 0 12px;font-size:12px">Sección de fábrica: ' + U.esc(C.seccionNombre(exCat.seccion)) + ' — <button type="button" class="btn btn-ghost btn-sm" id="btn-restablecer-seccion" style="padding:2px 6px">Restablecer</button></p>' +
        '<p class="text-muted" style="margin:2px 0 12px;font-size:11.5px">Las órdenes ya creadas con este examen no se afectan — guardan su propia sección. Solo las órdenes nuevas usarán la sección recategorizada.</p>' : "") +
      (!propio && efectivo.tubo !== exCat.tubo ? '<p class="text-muted" style="margin:2px 0 12px;font-size:12px">Tubo de fábrica: ' + U.esc(C.TUBOS[exCat.tubo] ? C.TUBOS[exCat.tubo].nombre : exCat.tubo) + ' — <button type="button" class="btn btn-ghost btn-sm" id="btn-restablecer-tubo" style="padding:2px 6px">Restablecer</button></p>' : "") +
      (propio ? '<fieldset style="margin:10px 0"><legend>Datos del examen propio</legend><div class="form-grid">' +
        F.sel("propio_seccion", "Sección", C.seccionesEfectivas(tenant).map(function (s) { return "<option value='" + s.id + "' " + (s.id === exCat.seccion ? "selected" : "") + ">" + s.nombre + "</option>"; }).join("")) +
        F.inp("propio_cups", "Código CUPS (opcional)", exCat.cups || "") +
        F.inp("propio_muestra", "Tipo de Muestra (opcional)", exCat.muestra || "") +
        F.sel("propio_tubo", "Tubo de Recolección", Object.keys(C.TUBOS).map(function (k) { return "<option value='" + k + "' " + (k === exCat.tubo ? "selected" : "") + ">" + C.TUBOS[k].nombre + "</option>"; }).join("")) +
        "</div></fieldset>" : "") +
      '<div class="table-wrap"><table><thead><tr><th></th><th>Parámetro</th><th>Mínimo</th><th>Máximo</th><th>Texto de referencia</th><th>Original</th><th></th></tr></thead><tbody>' +
      efectivo.parametros.map(function (p, idx) { return paramRow(p, idx, efectivo.parametros.length); }).join("") +
      "</tbody></table></div>" +
      (ocultos.length ? '<div style="margin-top:10px"><p class="text-muted" style="margin:0 0 6px;font-size:12.5px">Campos ocultos en tu laboratorio:</p><div class="flex gap-2 wrap">' +
        ocultos.map(function (o) { return '<span class="chip">' + U.esc(o.nombre) + ' <button type="button" class="btn btn-ghost btn-sm" data-mostrar-campo="' + o.codigo + '" style="padding:2px 6px">Mostrar de nuevo</button></span>'; }).join("") +
        "</div></div>" : "") +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-agregar-campo" style="margin-top:12px">' + U.icon("plus") + " Agregar Campo Personalizado</button>" +
      '<div class="flex gap-2 justify-between wrap" style="margin-top:14px">' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-ghost" data-modal-close>Cerrar</button>' +
      (!propio && C.tieneOverride(examId, tenant) ? '<button type="button" class="btn btn-ghost text-danger" id="btn-restablecer-todo">' + U.icon("history") + " Restablecer Todo a Fábrica</button>" : "") +
      "</div>" +
      '<button class="btn btn-primary" id="cat-guardar">' + U.icon("check") + " Guardar Cambios</button></div>",
      { lg: true }
    );

    var btnRestablecerTodo = wrap.querySelector("#btn-restablecer-todo");
    if (btnRestablecerTodo) btnRestablecerTodo.addEventListener("click", function () {
      if (!confirm('¿Restablecer "' + exCat.nombre + '" a los valores originales de fábrica de BIOsoft? Se pierden el nombre, método, campos agregados/ocultados, orden, rangos y bandas que le hayas configurado a este examen en tu laboratorio — no afecta las órdenes ya guardadas.')) return;
      C.restablecerExamenAFabrica(tenant, examId);
      S.updateTenant(tenant.id, { examCustom: tenant.examCustom || {}, refOverrides: tenant.refOverrides || {}, refRangos: tenant.refRangos || {}, refBandas: tenant.refBandas || {} });
      S.addAudit(session.tenantId, session.nombre, session.rol, "RESET_EXAM_TO_FACTORY", "catalogo", examId, "Restableció el examen " + exCat.nombre + " a los valores originales de fábrica.");
      U.toast("Examen restablecido a valores de fábrica.", "success");
      U.closeModal(wrap);
      onDone();
    });

    wrap.querySelectorAll("[data-reset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        C.clearOverride(tenant, examId, btn.dataset.reset);
        S.updateTenant(tenant.id, { refOverrides: tenant.refOverrides || {} });
        S.addAudit(session.tenantId, session.nombre, session.rol, "RESET_REF_RANGE", "catalogo", examId + ":" + btn.dataset.reset, "Restableció el valor de referencia de fábrica de " + btn.dataset.reset + " en " + exCat.nombre + ".");
        U.toast("Restablecido a valores de fábrica.", "success");
        reabrir();
      });
    });

    wrap.querySelectorAll("[data-mover-campo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var codigo = btn.dataset.moverCampo;
        var dir = parseInt(btn.dataset.dir, 10);
        var codigos = efectivo.parametros.map(function (p) { return p.codigo; });
        var pos = codigos.indexOf(codigo);
        var destino = pos + dir;
        if (destino < 0 || destino >= codigos.length) return;
        var tmp = codigos[pos]; codigos[pos] = codigos[destino]; codigos[destino] = tmp;
        C.ordenarCampos(tenant, examId, codigos);
        S.updateTenant(tenant.id, { examCustom: tenant.examCustom });
        reabrir();
      });
    });

    wrap.querySelectorAll("[data-quitar-campo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var codigo = btn.dataset.quitarCampo;
        var esDeFabrica = exCat.parametros.some(function (p) { return p.codigo === codigo; });
        if (esDeFabrica) C.ocultarCampo(tenant, examId, codigo); else C.quitarCampoPersonalizado(tenant, examId, codigo);
        S.updateTenant(tenant.id, { examCustom: tenant.examCustom, refOverrides: tenant.refOverrides || {} });
        S.addAudit(session.tenantId, session.nombre, session.rol, "HIDE_EXAM_FIELD", "catalogo", examId + ":" + codigo, (esDeFabrica ? "Ocultó" : "Eliminó") + " el campo " + codigo + " en " + exCat.nombre + ".");
        U.toast(esDeFabrica ? "Campo ocultado para tu laboratorio." : "Campo eliminado.", "success");
        reabrir();
      });
    });

    wrap.querySelectorAll("[data-mostrar-campo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        C.mostrarCampo(tenant, examId, btn.dataset.mostrarCampo);
        S.updateTenant(tenant.id, { examCustom: tenant.examCustom });
        reabrir();
      });
    });

    var btnRestablecerNombre = wrap.querySelector("#btn-restablecer-nombre");
    if (btnRestablecerNombre) btnRestablecerNombre.addEventListener("click", function () { wrap.querySelector("#cat-nombre-examen").value = exCat.nombre; });

    var btnRestablecerSeccion = wrap.querySelector("#btn-restablecer-seccion");
    if (btnRestablecerSeccion) btnRestablecerSeccion.addEventListener("click", function () { wrap.querySelector("#f_cat_seccion").value = exCat.seccion; });

    var btnRestablecerTubo = wrap.querySelector("#btn-restablecer-tubo");
    if (btnRestablecerTubo) btnRestablecerTubo.addEventListener("click", function () { wrap.querySelector("#f_cat_tubo").value = exCat.tubo; });

    wrap.querySelectorAll("[data-bandas]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = efectivo.parametros.filter(function (pp) { return pp.codigo === btn.dataset.bandas; })[0];
        abrirBandasParametro(tenant, examId, exCat, p, reabrir);
      });
    });

    wrap.querySelectorAll("[data-rangos]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = efectivo.parametros.filter(function (pp) { return pp.codigo === btn.dataset.rangos; })[0];
        abrirRangosInterpretacion(tenant, examId, exCat, p, reabrir);
      });
    });

    wrap.querySelectorAll("[data-calculado]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = efectivo.parametros.filter(function (pp) { return pp.codigo === btn.dataset.calculado; })[0];
        abrirCalculadoParametro(tenant, examId, p, reabrir);
      });
    });

    wrap.querySelector("#btn-agregar-campo").addEventListener("click", function () { abrirAgregarCampo(tenant, examId, exCat, reabrir); });

    wrap.querySelector("#cat-guardar").addEventListener("click", function () {
      var nuevoNombre = wrap.querySelector("#cat-nombre-examen").value.trim();
      var nombreCambio = nuevoNombre && nuevoNombre !== exCat.nombre;
      if (nuevoNombre === exCat.nombre) C.renombrarExamen(tenant, examId, ""); else C.renombrarExamen(tenant, examId, nuevoNombre);
      var nuevoMetodo = wrap.querySelector("#cat-metodo-examen").value.trim();
      C.cambiarMetodoExamen(tenant, examId, nuevoMetodo === exCat.metodo ? "" : nuevoMetodo);
      var seccionCambio = false;
      var tuboCambio = false;
      if (!propio) {
        var seccionSel = wrap.querySelector("#f_cat_seccion");
        if (seccionSel) {
          var nuevaSeccion = seccionSel.value;
          seccionCambio = nuevaSeccion !== efectivo.seccion;
          C.cambiarSeccionExamen(tenant, examId, nuevaSeccion);
        }
        var tuboSel = wrap.querySelector("#f_cat_tubo");
        if (tuboSel) {
          var nuevoTubo = tuboSel.value;
          tuboCambio = nuevoTubo !== efectivo.tubo;
          C.cambiarTuboExamen(tenant, examId, nuevoTubo);
        }
      }
      if (propio) {
        C.actualizarExamenPersonalizado(tenant, examId, {
          seccion: wrap.querySelector("#f_propio_seccion").value,
          cups: wrap.querySelector("#f_propio_cups").value.trim(),
          muestra: wrap.querySelector("#f_propio_muestra").value.trim(),
          tubo: wrap.querySelector("#f_propio_tubo").value
        });
      }
      var cambios = 0;
      efectivo.parametros.forEach(function (p) {
        var row = wrap.querySelector('[data-prow="' + p.codigo + '"]');
        if (!row) return;
        var base = origenDeCampo(exCat, custom, p.codigo);
        if (p.tipo === "numerico") {
          var min = parseFloat(row.querySelector("[data-min]").value);
          var max = parseFloat(row.querySelector("[data-max]").value);
          var conRangosGuardado = C.tieneRangosInterpretacion(tenant, examId, p.codigo);
          // Con rangos de interpretación activos, el texto de referencia se
          // genera solo a partir de esos rangos (el campo queda deshabilitado
          // en pantalla) — no se guarda como override aparte para no dejar un
          // texto "congelado" que sobreviva si luego se quitan los rangos.
          var refText = conRangosGuardado ? (base ? base.refText : "") : row.querySelector("[data-reftext]").value.trim();
          if (isNaN(min) || isNaN(max)) return;
          // "p" ya trae calculado/formula tal como quedaron tras el modal
          // 🧮 Valor Calculado (si se usó) — hay que conservarlos aquí,
          // porque setOverride() reemplaza TODO el override del
          // parámetro de una vez, no solo lo que cambió en esta tabla.
          var calcIgualBase = !p.calculado === !(base && base.calculado) && (p.formula || "") === ((base && base.formula) || "");
          if (base && min === base.min && max === base.max && refText === base.refText && calcIgualBase) { C.clearOverride(tenant, examId, p.codigo); return; }
          C.setOverride(tenant, examId, p.codigo, { min: min, max: max, refText: refText || (min + " - " + max + " " + (p.unidad || "")), calculado: !!p.calculado, formula: p.formula || "" });
          cambios++;
        } else if (p.tipo === "cualitativo") {
          var normalSel = row.querySelector("[data-normal]");
          var refText2 = row.querySelector("[data-reftext]").value.trim();
          var normal = normalSel ? normalSel.value : p.normal;
          if (base && normal === base.normal && refText2 === base.refText) { C.clearOverride(tenant, examId, p.codigo); return; }
          C.setOverride(tenant, examId, p.codigo, { normal: normal, refText: refText2 || ("Normal: " + normal) });
          cambios++;
        } else if (p.tipo === "descriptivo") {
          var refText3 = row.querySelector("[data-reftext]").value.trim();
          if (base && refText3 === base.refText) { C.clearOverride(tenant, examId, p.codigo); return; }
          C.setOverride(tenant, examId, p.codigo, { refText: refText3 });
          cambios++;
        }
      });
      S.updateTenant(tenant.id, { refOverrides: tenant.refOverrides || {}, examCustom: tenant.examCustom || {} });
      if (nombreCambio) S.addAudit(session.tenantId, session.nombre, session.rol, "RENAME_EXAM", "catalogo", examId, "Renombró " + exCat.nombre + ' a "' + nuevoNombre + '" para su laboratorio.');
      if (seccionCambio) S.addAudit(session.tenantId, session.nombre, session.rol, "RECATEGORIZE_EXAM", "catalogo", examId, "Recategorizó " + exCat.nombre + " a la sección " + C.seccionNombre(wrap.querySelector("#f_cat_seccion").value, tenant) + " para su laboratorio.");
      if (tuboCambio) S.addAudit(session.tenantId, session.nombre, session.rol, "CHANGE_EXAM_TUBE", "catalogo", examId, "Cambió el tubo de recolección de " + exCat.nombre + " a " + (C.TUBOS[wrap.querySelector("#f_cat_tubo").value] || {}).nombre + " para su laboratorio.");
      S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_REF_RANGE", "catalogo", examId, "Actualizó valores de referencia de " + exCat.nombre + " (" + cambios + " parámetro(s) personalizado(s)).");
      U.toast("Cambios guardados para tu laboratorio.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  // -------------------------------------------------------------------
  // RANGOS DE REFERENCIA POR GÉNERO/EDAD — modal secundario, uno por
  // parámetro numérico, para no complicar la tabla principal de valores de
  // referencia. Las bandas se combinan (la más específica gana) al capturar
  // o imprimir resultados de un paciente concreto; ver C.parametroParaPaciente.
  // -------------------------------------------------------------------
  function abrirBandasParametro(tenant, examId, exCat, param, onDone) {
    var session = BIO_AUTH.getSession();
    var bandas = C.getBandas(tenant, examId, param.codigo).map(function (b) { return Object.assign({}, b); });

    function bandaRow(b, idx) {
      return '<tr data-brow="' + idx + '">' +
        '<td><input data-b-etiqueta value="' + U.esc(b.etiqueta || "") + '" placeholder="Ej: Fase Folicular" style="min-width:120px"/></td>' +
        '<td><select data-b-genero style="min-width:100px">' +
        '<option value="ambos" ' + (b.genero === "ambos" || !b.genero ? "selected" : "") + '>Ambos</option>' +
        '<option value="Femenino" ' + (b.genero === "Femenino" ? "selected" : "") + '>Femenino</option>' +
        '<option value="Masculino" ' + (b.genero === "Masculino" ? "selected" : "") + '>Masculino</option>' +
        "</select></td>" +
        '<td><input type="number" step="any" min="0" data-b-edadmin placeholder="Sin mínimo" value="' + (b.edadMinAnios != null ? b.edadMinAnios : "") + '" style="width:80px"/></td>' +
        '<td><input type="number" step="any" min="0" data-b-edadmax placeholder="Sin máximo" value="' + (b.edadMaxAnios != null ? b.edadMaxAnios : "") + '" style="width:80px"/></td>' +
        '<td><input type="number" step="any" data-b-min value="' + b.min + '" style="width:80px"/></td>' +
        '<td><input type="number" step="any" data-b-max value="' + b.max + '" style="width:80px"/></td>' +
        '<td><input data-b-reftext value="' + U.esc(b.refText || "") + '" placeholder="Opcional"/></td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-b-quitar="' + idx + '">Quitar</button></td></tr>';
    }

    function renderTabla() {
      wrap.querySelector("#bandas-tbody").innerHTML = bandas.length
        ? bandas.map(bandaRow).join("")
        : '<tr><td colspan="8" class="text-muted">Aún no hay rangos por género/edad — mientras no agregues ninguno, se sigue usando el rango general (' + param.min + " - " + param.max + ").</td></tr>";
      wrap.querySelectorAll("[data-b-quitar]").forEach(function (btn) {
        btn.addEventListener("click", function () { bandas.splice(parseInt(btn.dataset.bQuitar, 10), 1); renderTabla(); });
      });
    }

    var wrap = U.openModal(
      '<h3 class="modal-title">Rangos por Género/Edad — ' + U.esc(param.nombre) + ' (' + U.esc(exCat.nombre) + ')</h3>' +
      '<p class="text-muted" style="margin-top:0">Define aquí rangos distintos según el sexo y/o la edad del paciente (ej. Hemoglobina distinta en hombres y mujeres), o según una categoría que no se pueda saber solo con esos datos (ej. las fases del ciclo menstrual: Folicular, Ovulación, Lútea, Postmenopausia). Al capturar o imprimir un resultado se usa el rango más específico que calce con el paciente; si hay varios que calzan igual (como las fases, que aplican a cualquier mujer adulta) quien capture el resultado podrá elegir cuál corresponde — por eso conviene ponerle una Etiqueta a cada uno en ese caso. Si ninguno calza, se usa el rango general de siempre (' + param.min + " - " + param.max + " " + (param.unidad || "") + ').</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Etiqueta</th><th>Género</th><th>Edad mín. (años)</th><th>Edad máx. (años)</th><th>Mínimo</th><th>Máximo</th><th>Texto de referencia</th><th></th></tr></thead><tbody id="bandas-tbody"></tbody></table></div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-agregar-banda" style="margin-top:12px">' + U.icon("plus") + " Agregar Rango</button>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="bandas-guardar">' + U.icon("check") + " Guardar Rangos</button></div>",
      { lg: true }
    );
    renderTabla();

    wrap.querySelector("#btn-agregar-banda").addEventListener("click", function () {
      bandas.push({ etiqueta: "", genero: "ambos", edadMinAnios: null, edadMaxAnios: null, min: param.min, max: param.max, refText: "" });
      renderTabla();
    });

    wrap.querySelector("#bandas-guardar").addEventListener("click", function () {
      var filas = wrap.querySelectorAll("[data-brow]");
      var nuevasBandas = [];
      var error = false;
      filas.forEach(function (row) {
        var min = parseFloat(row.querySelector("[data-b-min]").value);
        var max = parseFloat(row.querySelector("[data-b-max]").value);
        if (isNaN(min) || isNaN(max)) { error = true; return; }
        var edadMinVal = row.querySelector("[data-b-edadmin]").value;
        var edadMaxVal = row.querySelector("[data-b-edadmax]").value;
        nuevasBandas.push({
          etiqueta: row.querySelector("[data-b-etiqueta]").value.trim(),
          genero: row.querySelector("[data-b-genero]").value,
          edadMinAnios: edadMinVal === "" ? null : parseFloat(edadMinVal),
          edadMaxAnios: edadMaxVal === "" ? null : parseFloat(edadMaxVal),
          min: min, max: max,
          refText: row.querySelector("[data-b-reftext]").value.trim()
        });
      });
      if (error) { U.toast("Revisa que cada rango tenga un mínimo y un máximo válidos.", "error"); return; }
      // Dos rangos son ambiguos si un mismo paciente puede calzar con AMBOS
      // a la vez — no solo cuando el género y la edad son idénticos, sino
      // cada vez que se solapan (ej. uno "Masculino sin edad" y otro "Ambos
      // 18-99 años" también compiten por el mismo paciente). Sin esta
      // verificación más amplia, es fácil terminar con dos rangos que
      // aplican al mismo paciente sin darse cuenta, y en la captura de
      // resultados aparece un genérico "Opción 1 / Opción 2" en vez de algo
      // que se entienda — por eso aquí si se solapan, se exige Etiqueta.
      function generosSuperpuestos(a, b) {
        if (!a || a === "ambos" || !b || b === "ambos") return true;
        return a === b;
      }
      function edadesSuperpuestas(aMin, aMax, bMin, bMax) {
        var loA = aMin == null ? -Infinity : aMin, hiA = aMax == null ? Infinity : aMax;
        var loB = bMin == null ? -Infinity : bMin, hiB = bMax == null ? Infinity : bMax;
        return loA <= hiB && loB <= hiA;
      }
      var ambiguos = nuevasBandas.some(function (a, i) {
        return !a.etiqueta && nuevasBandas.some(function (b, j) {
          return i !== j && generosSuperpuestos(a.genero, b.genero) && edadesSuperpuestas(a.edadMinAnios, a.edadMaxAnios, b.edadMinAnios, b.edadMaxAnios);
        });
      });
      if (ambiguos) { U.toast("Dos o más rangos pueden aplicarle al mismo paciente (se solapan en género y/o edad) — ponles una Etiqueta a cada uno para poder distinguirlos al capturar (ej. Fase Folicular, Fase Lútea…). Si en realidad no necesitas dos rangos distintos, quita uno.", "error"); return; }
      C.setBandas(tenant, examId, param.codigo, nuevasBandas);
      S.updateTenant(tenant.id, { refBandas: tenant.refBandas || {} });
      S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_REF_BANDAS", "catalogo", examId + ":" + param.codigo,
        nuevasBandas.length ? "Definió " + nuevasBandas.length + " rango(s) por género/edad para " + param.nombre + " en " + exCat.nombre + "." : "Quitó los rangos por género/edad de " + param.nombre + " en " + exCat.nombre + ".");
      U.toast(nuevasBandas.length ? "Rangos guardados." : "Rangos por género/edad eliminados — se usa el rango general.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  // -------------------------------------------------------------------
  // RANGOS DE INTERPRETACIÓN — divide el eje del RESULTADO en tramos con
  // su propia etiqueta (ej. HbA1c: <5.7% "Normal", 5.7-6.4% "Prediabetes",
  // ≥6.5% "Diabetes"). No dependen del paciente, solo del valor capturado.
  // ver C.calcularFlag / C.tieneRangosInterpretacion.
  // -------------------------------------------------------------------
  function abrirRangosInterpretacion(tenant, examId, exCat, param, onDone) {
    var session = BIO_AUTH.getSession();
    var rangos = C.getRangosInterpretacion(tenant, examId, param.codigo).map(function (r) { return Object.assign({}, r); });

    function rangoRow(r, idx) {
      return '<tr data-rrow="' + idx + '">' +
        '<td><input data-r-etiqueta value="' + U.esc(r.etiqueta || "") + '" placeholder="Ej: Normal, Prediabetes…" style="min-width:130px"/></td>' +
        '<td><input type="number" step="any" data-r-min placeholder="Sin mínimo" value="' + (r.min != null ? r.min : "") + '" style="width:80px"/></td>' +
        '<td><input type="number" step="any" data-r-max placeholder="Sin máximo" value="' + (r.max != null ? r.max : "") + '" style="width:80px"/></td>' +
        '<td><label class="checkbox-row" style="margin:0"><input type="checkbox" data-r-normal ' + (r.esNormal ? "checked" : "") + '/> Normal</label></td>' +
        '<td><input data-r-reftext value="' + U.esc(r.refText || "") + '" placeholder="Opcional"/></td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-r-quitar="' + idx + '">Quitar</button></td></tr>';
    }

    function renderTabla() {
      wrap.querySelector("#rangos-tbody").innerHTML = rangos.length
        ? rangos.map(rangoRow).join("")
        : '<tr><td colspan="6" class="text-muted">Aún no hay rangos de interpretación — mientras no agregues ninguno, se sigue usando el rango general (' + param.min + " - " + param.max + ").</td></tr>";
      wrap.querySelectorAll("[data-r-quitar]").forEach(function (btn) {
        btn.addEventListener("click", function () { rangos.splice(parseInt(btn.dataset.rQuitar, 10), 1); renderTabla(); });
      });
    }

    var wrap = U.openModal(
      '<h3 class="modal-title">Rangos de Interpretación — ' + U.esc(param.nombre) + ' (' + U.esc(exCat.nombre) + ')</h3>' +
      '<p class="text-muted" style="margin-top:0">Divide los valores posibles en tramos con su propia etiqueta (ej. Normal / Prediabetes / Diabetes), en vez del simple Bajo/Normal/Alto. Deja el mínimo o el máximo en blanco para "sin límite" (ej. "≥6.5"). Marca "Normal" en el tramo que NO debe resaltarse como alerta. Si un resultado no cae en ningún tramo, se usa el rango general de siempre (' + param.min + " - " + param.max + " " + (param.unidad || "") + ').</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Etiqueta</th><th>Mínimo</th><th>Máximo</th><th>¿Es normal?</th><th>Texto de referencia</th><th></th></tr></thead><tbody id="rangos-tbody"></tbody></table></div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-agregar-rango" style="margin-top:12px">' + U.icon("plus") + " Agregar Tramo</button>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rangos-guardar">' + U.icon("check") + " Guardar Rangos</button></div>",
      { lg: true }
    );
    renderTabla();

    wrap.querySelector("#btn-agregar-rango").addEventListener("click", function () {
      rangos.push({ etiqueta: "", min: null, max: null, esNormal: rangos.length === 0, refText: "" });
      renderTabla();
    });

    wrap.querySelector("#rangos-guardar").addEventListener("click", function () {
      var filas = wrap.querySelectorAll("[data-rrow]");
      var nuevosRangos = [];
      var error = "";
      filas.forEach(function (row) {
        var etiqueta = row.querySelector("[data-r-etiqueta]").value.trim();
        var minVal = row.querySelector("[data-r-min]").value;
        var maxVal = row.querySelector("[data-r-max]").value;
        if (!etiqueta) { error = "Ponle una etiqueta a cada tramo."; return; }
        if (minVal === "" && maxVal === "") { error = "Cada tramo necesita al menos un mínimo o un máximo."; return; }
        nuevosRangos.push({
          etiqueta: etiqueta,
          min: minVal === "" ? null : parseFloat(minVal),
          max: maxVal === "" ? null : parseFloat(maxVal),
          esNormal: row.querySelector("[data-r-normal]").checked,
          refText: row.querySelector("[data-r-reftext]").value.trim()
        });
      });
      if (error) { U.toast(error, "error"); return; }
      C.setRangosInterpretacion(tenant, examId, param.codigo, nuevosRangos);
      S.updateTenant(tenant.id, { refRangos: tenant.refRangos || {} });
      S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_REF_RANGOS", "catalogo", examId + ":" + param.codigo,
        nuevosRangos.length ? "Definió " + nuevosRangos.length + " rango(s) de interpretación para " + param.nombre + " en " + exCat.nombre + "." : "Quitó los rangos de interpretación de " + param.nombre + " en " + exCat.nombre + ".");
      U.toast(nuevosRangos.length ? "Rangos de interpretación guardados." : "Rangos de interpretación eliminados — se usa el rango general.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  // -------------------------------------------------------------------
  // VALOR CALCULADO — en vez de digitarlo a mano, el parámetro se calcula
  // automáticamente a partir de otros parámetros ya capturados en la
  // misma orden (ej. LDL por la fórmula de Friedewald a partir de
  // Colesterol Total, HDL y Triglicéridos, aunque sean de exámenes
  // distintos — ver captura de resultados en views-results.js, que es
  // donde de verdad se evalúa la fórmula con C.evaluarFormula()). Aquí
  // solo se activa/desactiva y se guarda el texto de la fórmula.
  // -------------------------------------------------------------------
  function abrirCalculadoParametro(tenant, examId, param, onDone) {
    var session = BIO_AUTH.getSession();
    var wrap = U.openModal(
      '<h3 class="modal-title">🧮 Valor Calculado — ' + U.esc(param.nombre) + '</h3>' +
      '<p class="text-muted" style="margin-top:0">En vez de digitarlo a mano, este valor se calcula solo a partir de otros parámetros ya capturados en la misma orden — usa el código de cada parámetro como si fuera una variable. Ej. para el LDL por la fórmula de Friedewald: <code>COLT - HDL - (TGD/5)</code>.</p>' +
      '<div class="checkbox-row"><input type="checkbox" id="f_calc_activo" ' + (param.calculado ? "checked" : "") + '/><label style="margin:0" for="f_calc_activo">Este parámetro se calcula automáticamente</label></div>' +
      '<div class="field" style="margin-top:10px"><label>Fórmula</label><input id="f_calc_formula" value="' + U.esc(param.formula || "") + '" placeholder="Ej: COLT - HDL - (TGD/5)"/></div>' +
      '<p class="text-muted" style="margin:4px 0 0;font-size:12px">Operaciones permitidas: + − × ÷ y paréntesis. Usa los códigos de los parámetros (los ves en la tabla de valores de referencia de cada examen) como si fueran letras — puede referenciar parámetros de OTROS exámenes de la misma orden, no solo de este.</p>' +
      '<div class="flex gap-2 justify-between" style="margin-top:16px">' +
      '<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
      '<button type="button" class="btn btn-primary" id="btn-guardar-calculado">' + U.icon("check") + " Guardar</button>" +
      "</div>"
    );
    wrap.querySelector("#btn-guardar-calculado").addEventListener("click", function () {
      var activo = wrap.querySelector("#f_calc_activo").checked;
      var formulaTexto = wrap.querySelector("#f_calc_formula").value.trim();
      if (activo) {
        var vars = C.variablesDeFormula(formulaTexto);
        if (!formulaTexto || !vars.length) { U.toast("Escribe una fórmula que use al menos un código de parámetro.", "error"); return; }
        try {
          var fake = {}; vars.forEach(function (v) { fake[v] = 1; });
          C.evaluarFormula(formulaTexto, fake);
        } catch (e) {
          U.toast("Fórmula inválida — revísala (" + e.message + ").", "error");
          return;
        }
      }
      C.setOverride(tenant, examId, param.codigo, { min: param.min, max: param.max, refText: param.refText, calculado: activo, formula: activo ? formulaTexto : "" });
      S.updateTenant(tenant.id, { refOverrides: tenant.refOverrides || {} });
      S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_PARAM_CALCULADO", "catalogo", examId + ":" + param.codigo,
        activo ? "Activó el cálculo automático de " + param.nombre + " con la fórmula: " + formulaTexto : "Desactivó el cálculo automático de " + param.nombre + ".");
      U.toast("Guardado.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  function abrirAgregarCampo(tenant, examId, exCat, onSaved) {
    var wrap = U.openModal(
      '<h3 class="modal-title">Agregar Campo Personalizado — ' + U.esc(exCat.nombre) + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Este campo solo se agrega a tu laboratorio, sin afectar el catálogo general de BIOsoft.</p>' +
      '<form id="campo-form">' +
      F.inp("nombre", "Nombre del Campo", "", true) +
      F.sel("tipo", "Tipo de Campo", '<option value="numerico">Numérico (con rango de referencia)</option><option value="cualitativo">Cualitativo (opciones, ej: Positivo/Negativo)</option><option value="descriptivo">Descriptivo (texto libre)</option><option value="panel_antibiograma">Panel de selección — Antibiograma (elegir antibióticos y su Sensible/Intermedio/Resistente)</option><option value="panel_alergia">Panel de selección — Alergia (elegir alérgenos e IgE con Clase/Interpretación automática)</option>') +
      '<div id="campo-extra"></div>' +
      '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Agregar Campo</button></div>" +
      "</form>"
    );

    function renderExtra() {
      var tipo = wrap.querySelector("#f_tipo").value;
      var box = wrap.querySelector("#campo-extra");
      if (tipo === "numerico") {
        box.innerHTML = F.inp("unidad", "Unidad (ej: mg/dL)", "") +
          '<div class="form-grid">' + F.inp("min", "Mínimo", "0") + F.inp("max", "Máximo", "0") + "</div>" +
          F.inp("reftext", "Texto de Referencia (opcional)", "");
      } else if (tipo === "cualitativo") {
        box.innerHTML = F.inp("opciones", "Opciones separadas por coma (ej: Negativo, Positivo)", "Negativo, Positivo", true) +
          F.inp("reftext", "Texto de Referencia (opcional)", "");
      } else if (tipo === "panel_antibiograma" || tipo === "panel_alergia") {
        box.innerHTML = '<p class="text-muted" style="font-size:12.5px">' +
          (tipo === "panel_antibiograma"
            ? "El bacteriólogo elegirá, al capturar cada resultado, qué antibióticos aplican al germen aislado (de un catálogo que también puede ampliar sobre la marcha) y marcará Sensible/Intermedio/Resistente para cada uno."
            : "El bacteriólogo elegirá, al capturar cada resultado, qué alérgenos se probaron (de un catálogo que también puede ampliar sobre la marcha); la Clase y la Interpretación (Positivo/Negativo) se calculan automáticamente según la concentración de IgE.") +
          "</p>" + F.inp("reftext", "Texto de Referencia o instrucción (opcional)", "");
      } else {
        box.innerHTML = F.inp("reftext", "Texto de Referencia o instrucción (opcional)", "");
      }
    }
    wrap.querySelector("#f_tipo").addEventListener("change", renderExtra);
    renderExtra();

    wrap.querySelector("#campo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { var el = wrap.querySelector("#f_" + id); return el ? el.value.trim() : ""; };
      var nombre = g("nombre");
      if (!nombre) { U.toast("Ponle un nombre al campo.", "error"); return; }
      var tipo = g("tipo");
      var codigo = "PERS_" + U.normalizar(nombre).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) + "_" + Date.now().toString(36).slice(-4).toUpperCase();
      var nuevo = { codigo: codigo, nombre: nombre, tipo: tipo };
      if (tipo === "numerico") {
        var min = parseFloat(g("min")), max = parseFloat(g("max"));
        if (isNaN(min) || isNaN(max)) { U.toast("Ingresa un mínimo y un máximo válidos.", "error"); return; }
        nuevo.unidad = g("unidad"); nuevo.min = min; nuevo.max = max;
        nuevo.refText = g("reftext") || (min + " - " + max + " " + (nuevo.unidad || ""));
      } else if (tipo === "cualitativo") {
        var opciones = g("opciones").split(",").map(function (o) { return o.trim(); }).filter(Boolean);
        if (opciones.length < 2) { U.toast("Ingresa al menos 2 opciones separadas por coma.", "error"); return; }
        nuevo.opciones = opciones; nuevo.normal = opciones[0];
        nuevo.refText = g("reftext") || ("Normal: " + opciones[0]);
      } else if (tipo === "panel_antibiograma" || tipo === "panel_alergia") {
        nuevo.tipo = "panel";
        nuevo.panelTipo = tipo === "panel_alergia" ? "alergia" : "antibiograma";
        nuevo.refText = g("reftext") || "";
      } else {
        nuevo.refText = g("reftext") || "";
      }
      var session = BIO_AUTH.getSession();
      C.agregarCampoPersonalizado(tenant, examId, nuevo);
      S.updateTenant(tenant.id, { examCustom: tenant.examCustom });
      S.addAudit(session.tenantId, session.nombre, session.rol, "ADD_EXAM_FIELD", "catalogo", examId + ":" + codigo, 'Agregó el campo personalizado "' + nombre + '" en ' + exCat.nombre + ".");
      U.toast("Campo agregado.", "success");
      U.closeModal(wrap);
      onSaved();
    });
  }

  // ------------------------------------------------------------------
  // EQUIPOS CONECTADOS — módulo LIS: interfaz con analizadores (Mindray,
  // Dirui, Dymind, Maglumi, Rayto, u otro compatible con ASTM E1394) que
  // envían resultados directamente a BIOsoft. Se cobra $10 USD/mes por cada
  // equipo conectado (los primeros 5 son gratis como oferta de lanzamiento
  // al activarse, sin importar el plan — ver BIO_PLANES.PROMOCION_LANZAMIENTO).
  // ------------------------------------------------------------------
  function equiposCardHtml(tenant) {
    var plan = BIO_PLANES.porId(tenant.planId);
    var incluido = !!(plan && plan.interfazEquiposIncluida);
    var costo = BIO_PLANES.INTERFAZ_EQUIPOS;
    var equipos = tenant.equiposConectados || [];
    return '<div class="card"><div class="card-header"><h3 class="card-title">🔌 Equipos Conectados</h3></div>' +
      '<p class="text-muted" style="margin-top:0">Conecta analizadores de laboratorio (ej. equipos de hematología) para que envíen resultados directamente a BIOsoft, sin digitarlos a mano. ' +
      (incluido
        ? "Tu plan (" + U.esc(plan.nombre) + ") incluye la conexión de equipos sin costo adicional."
        : "Cada equipo conectado tiene un costo adicional de $" + costo.costoPorEquipoUsd + " USD/mes (≈ $" + costo.costoPorEquipoCopFmt + " COP) sobre tu plan actual.") +
      "</p>" +
      (equipos.length
        ? '<div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Examen asociado</th><th>Estado</th><th>Clave de interfaz</th><th></th></tr></thead><tbody>' +
          equipos.map(function (e) {
            var exCat = C.examenPorId(e.examId) || C.examenPersonalizadoPorId(e.examId, tenant);
            return "<tr><td>" + U.esc(e.nombre) + '<div class="text-muted" style="font-size:11px">' + U.esc(e.marcaModelo || "") + "</div></td>" +
              "<td>" + (exCat ? U.esc(exCat.nombre) : "—") + "</td>" +
              "<td>" + (e.activo ? '<span class="badge badge-validado">Activo</span>' : '<span class="badge badge-suspendido">Inactivo</span>') + "</td>" +
              "<td><code style='font-size:11px'>" + U.esc(e.claveInterfaz) + "</code></td>" +
              '<td><button type="button" class="btn btn-ghost btn-sm" data-quitar-equipo="' + e.id + '">Eliminar</button></td></tr>';
          }).join("") + "</tbody></table></div>"
        : '<p class="text-muted" style="font-size:12.5px">Aún no tienes equipos conectados.</p>') +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-agregar-equipo" style="margin-top:10px">' + U.icon("plus") + " Conectar un Equipo</button>" +
      "</div>";
  }

  function wireEquiposCard(tenant, reabrir) {
    var btnAgregar = document.getElementById("btn-agregar-equipo");
    if (btnAgregar) btnAgregar.addEventListener("click", function () { abrirAgregarEquipo(tenant, reabrir); });
    document.querySelectorAll("[data-quitar-equipo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var session = BIO_AUTH.getSession();
        var equipo = (tenant.equiposConectados || []).filter(function (e) { return e.id === btn.dataset.quitarEquipo; })[0];
        S.eliminarEquipoConectado(tenant, btn.dataset.quitarEquipo);
        S.updateTenant(tenant.id, { equiposConectados: tenant.equiposConectados });
        if (equipo) S.addAudit(session.tenantId, session.nombre, session.rol, "REMOVE_DEVICE", "catalogo", equipo.id, 'Eliminó el equipo conectado "' + equipo.nombre + '".');
        U.toast("Equipo eliminado.", "success");
        reabrir();
      });
    });
  }

  function abrirAgregarEquipo(tenant, onSaved) {
    var seccionesConExamenes = C.seccionesEfectivas(tenant);
    function examenesDeSeccion(seccionId) {
      return C.examenesEfectivos(tenant).filter(function (e) { return e.seccion === seccionId; });
    }
    var wrap = U.openModal(
      '<h3 class="modal-title">Conectar un Equipo</h3>' +
      '<p class="text-muted" style="margin-top:0">Registra el equipo para obtener su clave de interfaz — la usarás al configurar el programa (middleware) que conecta el equipo físico con BIOsoft. Esto NO instala nada automáticamente: es el primer paso para dar de alta el equipo. BIOsoft trae un módulo LIS genérico (protocolo ASTM E1394) que puede conectar prácticamente cualquier equipo de laboratorio con salida LIS/host — la lista de marca/modelo es solo una sugerencia, puedes escribir cualquier otra.</p>' +
      '<form id="equipo-form">' +
      F.inp("nombre", "Nombre del Equipo (ej: Mindray BC-10 — Hematología)", "", true) +
      '<div class="field"><label>Marca / Modelo (opcional)</label><input id="f_marcaModelo" list="equipos-sugeridos" placeholder="Ej. Mindray BC-10"/>' +
      '<datalist id="equipos-sugeridos">' +
      ["Mindray BC-10 (Hematología)", "Mindray BC-700 / serie touch (Hematología)", "Mindray BS-XXX (Química)", "Mindray CL-900i (Inmunoensayo/Quimioluminiscencia)", "Dirui CS-T240 (Química)", "Dymind DF52 (Hematología)", "Maglumi 800 (Inmunoensayo)", "TotalCare (Química)", "Rayto (Química)", "Rayto (Hematología)"]
        .map(function (o) { return "<option value='" + o + "'></option>"; }).join("") +
      "</datalist></div>" +
      F.sel("seccion", "Sección", seccionesConExamenes.map(function (s) { return "<option value='" + s.id + "'>" + s.nombre + "</option>"; }).join("")) +
      '<div id="equipo-examen-box"></div>' +
      '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Conectar y Generar Clave</button></div>" +
      "</form>"
    );
    function renderExamenBox() {
      var seccionId = wrap.querySelector("#f_seccion").value;
      var examenes = examenesDeSeccion(seccionId);
      wrap.querySelector("#equipo-examen-box").innerHTML = F.sel("examen", "Examen que reporta este equipo", examenes.map(function (e) { return "<option value='" + e.id + "'>" + U.esc(e.nombre) + "</option>"; }).join(""));
    }
    wrap.querySelector("#f_seccion").addEventListener("change", renderExamenBox);
    renderExamenBox();

    wrap.querySelector("#equipo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { var el = wrap.querySelector("#f_" + id); return el ? el.value.trim() : ""; };
      var nombre = g("nombre");
      if (!nombre) { U.toast("Ponle un nombre al equipo.", "error"); return; }
      var examId = wrap.querySelector("#f_examen") ? wrap.querySelector("#f_examen").value : "";
      var session = BIO_AUTH.getSession();
      var nuevo = S.agregarEquipoConectado(tenant, { nombre: nombre, marcaModelo: g("marcaModelo"), seccion: g("seccion"), examId: examId });
      S.updateTenant(tenant.id, { equiposConectados: tenant.equiposConectados });
      S.addAudit(session.tenantId, session.nombre, session.rol, "ADD_DEVICE", "catalogo", nuevo.id, 'Conectó el equipo "' + nombre + '".');
      U.closeModal(wrap);
      mostrarClaveEquipo(nuevo, onSaved);
    });
  }

  /* Pantalla final tras registrar el equipo: muestra la clave de interfaz
     UNA VEZ de forma prominente (como una API key), con los datos exactos
     que hay que llevar al archivo de configuración del middleware. */
  function mostrarClaveEquipo(equipo, onSaved) {
    var session = BIO_AUTH.getSession();
    var wrap = U.openModal(
      '<h3 class="modal-title">' + U.icon("check") + " Equipo conectado: " + U.esc(equipo.nombre) + "</h3>" +
      '<p class="text-muted" style="margin-top:0">Guarda esta clave — la necesitas para configurar el middleware del equipo (ver el archivo <code>equipo-interfaz-lis/config.example.json</code> del repositorio).</p>' +
      '<div class="card" style="background:var(--surface-2);box-shadow:none">' +
      '<div class="field"><label>ID del Laboratorio (tenantId)</label><input readonly value="' + U.esc(session.tenantId) + '" onclick="this.select()"/></div>' +
      '<div class="field"><label>ID del Equipo</label><input readonly value="' + U.esc(equipo.id) + '" onclick="this.select()"/></div>' +
      '<div class="field"><label>Clave de Interfaz</label><input readonly value="' + U.esc(equipo.claveInterfaz) + '" onclick="this.select()"/></div>' +
      '<div class="field"><label>Examen Asociado (examId)</label><input readonly value="' + U.esc(equipo.examId) + '" onclick="this.select()"/></div>' +
      "</div>" +
      '<p class="text-muted" style="font-size:12.5px;margin-top:10px">Además necesitas crear, en "Usuarios del Laboratorio", un usuario Bacteriólogo(a) dedicado exclusivamente al equipo (ej. "Interfaz BC-10"), asignado a la sección correspondiente — esas credenciales (correo y contraseña) son las que el middleware usa para conectarse de forma segura, con los mismos permisos que ya tiene cualquier bacteriólogo tuyo.</p>' +
      '<div class="flex gap-2 justify-between" style="margin-top:10px"><button type="button" class="btn btn-primary" data-modal-close>Entendido</button></div>'
    );
    wrap.querySelector("[data-modal-close]").addEventListener("click", function () { onSaved(); });
  }

  // ------------------------------------------------------------------
  // PERFILES DE IMPRESORA / TAMAÑO DE ETIQUETA (para stickers de muestra)
  // ------------------------------------------------------------------
  function perfilesEtiquetaCardHtml(tenant) {
    var perfiles = tenant.perfilesEtiqueta || [];
    return '<div class="card"><div class="card-header"><h3 class="card-title">🏷️ Impresoras y Tamaños de Etiqueta</h3></div>' +
      '<p class="text-muted" style="margin-top:0">Guarda aquí las impresoras/tamaños de sticker que uses (puede haber varias — una por área, por ejemplo). Al imprimir stickers de una orden, eliges cuál usar; el que marques como predeterminado sale seleccionado de una vez.</p>' +
      (perfiles.length
        ? '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Tamaño</th><th>Predeterminado</th><th></th></tr></thead><tbody>' +
          perfiles.map(function (p) {
            return "<tr><td>" + U.esc(p.nombre) + "</td><td>" + p.anchoMm + " x " + p.altoMm + " mm</td>" +
              "<td>" + (p.predeterminado ? '<span class="badge badge-validado">Sí</span>' : "—") + "</td>" +
              '<td><button type="button" class="btn btn-ghost btn-sm" data-quitar-perfil-etiqueta="' + p.id + '">Eliminar</button></td></tr>';
          }).join("") + "</tbody></table></div>"
        : '<p class="text-muted" style="font-size:12.5px">Aún no has agregado ninguna — se está usando el tamaño estándar de BIOsoft (9 x 3,8 cm) mientras tanto.</p>') +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-agregar-perfil-etiqueta" style="margin-top:10px">' + U.icon("plus") + " Agregar Impresora / Tamaño</button>" +
      "</div>";
  }

  function wirePerfilesEtiquetaCard(tenant, reabrir) {
    var btnAgregar = document.getElementById("btn-agregar-perfil-etiqueta");
    if (btnAgregar) btnAgregar.addEventListener("click", function () { abrirAgregarPerfilEtiqueta(tenant, reabrir); });
    document.querySelectorAll("[data-quitar-perfil-etiqueta]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var session = BIO_AUTH.getSession();
        var perfil = (tenant.perfilesEtiqueta || []).filter(function (p) { return p.id === btn.dataset.quitarPerfilEtiqueta; })[0];
        S.eliminarPerfilEtiqueta(tenant, btn.dataset.quitarPerfilEtiqueta);
        S.updateTenant(tenant.id, { perfilesEtiqueta: tenant.perfilesEtiqueta });
        if (perfil) S.addAudit(session.tenantId, session.nombre, session.rol, "REMOVE_LABEL_PROFILE", "catalogo", perfil.id, 'Eliminó el perfil de etiqueta "' + perfil.nombre + '".');
        U.toast("Perfil eliminado.", "success");
        reabrir();
      });
    });
  }

  function abrirAgregarPerfilEtiqueta(tenant, onSaved) {
    var sugeridos = C.TAMANOS_ETIQUETA_SUGERIDOS;
    var wrap = U.openModal(
      '<h3 class="modal-title">Agregar Impresora / Tamaño de Etiqueta</h3>' +
      '<p class="text-muted" style="margin-top:0">BIOsoft genera el sticker ya ajustado a esta medida exacta y lo manda a imprimir por el navegador — funciona con cualquier impresora de etiquetas que ya tengas instalada en Windows (Xprinter, Zebra, TSC, etc.), solo necesitas el tamaño correcto de tu rollo.</p>' +
      '<form id="perfil-etiqueta-form">' +
      '<div class="field"><label>Nombre del perfil (ej. "Impresora de Recepción — Xprinter")</label><input id="f_nombrePerfil" list="impresoras-sugeridas" required/>' +
      '<datalist id="impresoras-sugeridas">' + C.IMPRESORAS_ETIQUETA_SUGERIDAS.map(function (o) { return "<option value='" + o + "'></option>"; }).join("") + "</datalist></div>" +
      '<div class="field"><label>Tamaño de la etiqueta</label><select id="f_tamanoPreset">' +
      sugeridos.map(function (t, i) { return "<option value='" + i + "'>" + U.esc(t.nombre) + " — " + t.anchoMm + " x " + t.altoMm + " mm</option>"; }).join("") +
      "<option value='personalizado'>Personalizado (otra medida)</option>" +
      "</select></div>" +
      '<div class="form-grid hidden" id="tamano-custom-box">' +
      '<div class="field"><label>Ancho (mm)</label><input type="number" id="f_anchoMm" min="10" step="0.1"/></div>' +
      '<div class="field"><label>Alto (mm)</label><input type="number" id="f_altoMm" min="10" step="0.1"/></div>' +
      "</div>" +
      '<div class="checkbox-row" style="margin-top:8px"><input type="checkbox" id="f_predeterminado"/><label style="margin:0" for="f_predeterminado">Usar como predeterminada</label></div>' +
      '<p class="text-muted" style="margin:6px 0 0;font-size:12px">Etiquetas muy pequeñas (menos de 2,5 cm de alto) imprimen menos información — solo N° de orden, paciente, tubo y código de barras — para que el texto siga siendo legible.</p>' +
      '<div class="flex gap-2 justify-between" style="margin-top:10px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button></div>" +
      "</form>"
    );
    wrap.querySelector("#f_tamanoPreset").addEventListener("change", function () {
      wrap.querySelector("#tamano-custom-box").classList.toggle("hidden", this.value !== "personalizado");
    });
    wrap.querySelector("#perfil-etiqueta-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nombre = wrap.querySelector("#f_nombrePerfil").value.trim();
      if (!nombre) { U.toast("Ponle un nombre al perfil.", "error"); return; }
      var presetVal = wrap.querySelector("#f_tamanoPreset").value;
      var anchoMm, altoMm;
      if (presetVal === "personalizado") {
        anchoMm = parseFloat(wrap.querySelector("#f_anchoMm").value);
        altoMm = parseFloat(wrap.querySelector("#f_altoMm").value);
        if (!anchoMm || !altoMm) { U.toast("Indica el ancho y el alto en milímetros.", "error"); return; }
      } else {
        var preset = sugeridos[parseInt(presetVal, 10)];
        anchoMm = preset.anchoMm; altoMm = preset.altoMm;
      }
      var session = BIO_AUTH.getSession();
      var nuevo = S.agregarPerfilEtiqueta(tenant, { nombre: nombre, anchoMm: anchoMm, altoMm: altoMm, predeterminado: wrap.querySelector("#f_predeterminado").checked });
      S.updateTenant(tenant.id, { perfilesEtiqueta: tenant.perfilesEtiqueta });
      S.addAudit(session.tenantId, session.nombre, session.rol, "ADD_LABEL_PROFILE", "catalogo", nuevo.id, 'Agregó el perfil de etiqueta "' + nombre + '" (' + anchoMm + " x " + altoMm + " mm).");
      U.toast("Perfil agregado.", "success");
      U.closeModal(wrap);
      onSaved();
    });
  }

  // ------------------------------------------------------------------
  // CONFIGURACIÓN DEL LABORATORIO
  // ------------------------------------------------------------------
  window.BIO_VIEWS.config = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = S.getTenant(session.tenantId);
    var logoTemp = tenant.logoDataUrl;
    var logo2Temp = tenant.logoSecundarioDataUrl;
    var campos = tenant.camposReporte || {};

    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">📘 Manual de Usuario del Sistema</h3></div>' +
      '<p class="text-muted" style="margin-top:0">Guía paso a paso de cada módulo, con el logo y los colores de ' + U.esc(tenant.nombre || "tu laboratorio") + '. Ideal para capacitar a tu equipo o enviarla a un colaborador nuevo.</p>' +
      '<div class="flex gap-2 wrap">' +
      '<button type="button" class="btn btn-outline" id="btn-manual-descargar">' + U.icon("download") + ' Descargar PDF</button>' +
      '<button type="button" class="btn btn-primary" id="btn-manual-enviar">' + U.icon("send") + ' Enviar por WhatsApp o Correo</button>' +
      "</div></div>" +
      equiposCardHtml(tenant) +
      perfilesEtiquetaCardHtml(tenant) +
      '<div class="card"><div class="card-header"><h3 class="card-title">Identidad y Datos del Laboratorio</h3></div>' +
      '<form id="cfg-form">' +
        '<div class="form-grid">' +
          F.inp("nombre", "Nombre del Laboratorio", tenant.nombre, true) +
          F.inp("slogan", "Eslogan (aparece bajo el nombre en el encabezado de los resultados)", tenant.slogan) +
          F.inp("nit", "NIT / RIF / RUC", tenant.nit) +
          F.sel("pais", "País", ["CO", "VE", "EC"].map(function (p) { return '<option value="' + p + '" ' + (p === tenant.pais ? "selected" : "") + ">" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>"; }).join("")) +
          F.inp("direccion", "Dirección", tenant.direccion) +
          F.inp("telefonos", "Teléfonos", tenant.telefonos) +
          F.inp("email", "Correo del Laboratorio (aparece en reportes y documentos)", tenant.email) +
          F.inp("sitioWeb", "Sitio Web", tenant.sitioWeb) +
          F.inp("resolucionHabilitacion", "Resolución de Habilitación", tenant.resolucionHabilitacion) +
          F.inp("codigoREPS", "Código REPS / Registro Sanitario", tenant.codigoREPS) +
          F.sel("nivel", "Nivel de Complejidad", [1, 2].map(function (n) { return '<option value="' + n + '" ' + (n === tenant.nivel ? "selected" : "") + ">Nivel " + n + "</option>"; }).join("")) +
          F.inp("bactNombre", "Bacteriólogo(a) Responsable", tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.nombre : "") +
          F.inp("bactRegistro", "Registro Profesional", tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.registro : "") +
        "</div>" +
        '<p class="text-muted" style="margin:2px 0 14px;font-size:12.5px">💡 El "Correo del Laboratorio" es el que verán los pacientes en los reportes y documentos — puede ser distinto del correo personal con el que cada usuario (administrador, ' + U.esc(C.rolLabel("bacteriologo", tenant.pais)) + ', etc.) inicia sesión. Para cambiar el correo de ingreso de un usuario, ve a "Usuarios del Laboratorio" → Editar.</p>' +
        '<fieldset><legend>Marca e Identidad Visual</legend>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Color Primario</label><input type="color" id="f_colorPrimario" value="' + (tenant.colorPrimario || "#f97316") + '"/></div>' +
          '<div class="field"><label>Color Secundario (fondo del menú)</label><input type="color" id="f_colorSecundario" value="' + (tenant.colorSecundario || "#2e1065") + '"/></div>' +
          '<div class="field"><label>Color del Texto del Menú</label>' +
            '<div class="flex gap-2" style="align-items:center">' +
              '<input type="color" id="f_colorTextoMenu" value="' + (tenant.colorTextoMenu || U.contrastColor(tenant.colorSecundario || "#2e1065")) + '"/>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="btn-texto-auto">Automático</button>' +
            "</div>" +
          "</div>" +
          '<div class="field"><label>Color de Títulos</label>' +
            '<div class="flex gap-2" style="align-items:center">' +
              '<input type="color" id="f_colorTitulos" value="' + (tenant.colorTitulos || tenant.colorSecundario || "#2e1065") + '"/>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="btn-titulos-auto">Automático</button>' +
            "</div>" +
          "</div>" +
          '<div class="field"><label>Color de Subtítulos</label>' +
            '<div class="flex gap-2" style="align-items:center">' +
              '<input type="color" id="f_colorSubtitulos" value="' + (tenant.colorSubtitulos || tenant.colorPrimario || "#f97316") + '"/>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="btn-subtitulos-auto">Automático</button>' +
            "</div>" +
          "</div>" +
          '<div class="field"><label>Logo del Laboratorio</label><input type="file" id="f_logo" accept="image/*"/></div>' +
          '<div class="field"><label>Logo Secundario (opcional)</label><input type="file" id="f_logo2" accept="image/*"/></div>' +
          '<div class="field"><label>Tipografía del Reporte</label><select id="f_fuenteReporte">' +
            '<option value="helvetica"' + (!tenant.fuenteReporte || tenant.fuenteReporte === "helvetica" ? " selected" : "") + '>Helvetica (moderna, sin serifa)</option>' +
            '<option value="times"' + (tenant.fuenteReporte === "times" ? " selected" : "") + '>Times (clásica, con serifa)</option>' +
            '<option value="courier"' + (tenant.fuenteReporte === "courier" ? " selected" : "") + '>Courier (monoespaciada, tipo consola)</option>' +
          "</select></div>" +
          '<div class="field"><label>Tamaño de Letra del Reporte</label><select id="f_tamanoFuenteReporte">' +
            '<option value="7"' + (tenant.tamanoFuenteReporte === 7 ? " selected" : "") + '>Pequeña</option>' +
            '<option value="8"' + (!tenant.tamanoFuenteReporte || tenant.tamanoFuenteReporte === 8 ? " selected" : "") + '>Normal</option>' +
            '<option value="9"' + (tenant.tamanoFuenteReporte === 9 ? " selected" : "") + '>Grande</option>' +
            '<option value="10"' + (tenant.tamanoFuenteReporte === 10 ? " selected" : "") + '>Muy grande</option>' +
          "</select></div>" +
        "</div>" +
        '<p class="text-muted" style="margin:6px 0 0;font-size:12.5px">Ajusta aquí el color del texto del menú, de los títulos de cada sección (como "Identidad y Datos del Laboratorio") y de los subtítulos de cada recuadro (como "Marca e Identidad Visual") — todo se actualiza al instante en esta misma pantalla para que veas cómo queda antes de guardar.</p>' +
        '<div class="flex gap-2 wrap" style="margin-top:8px">' +
        '<div><div class="text-muted" style="font-size:11px;margin-bottom:2px">Logo</div><div id="logo-preview">' + (logoTemp ? '<img src="' + logoTemp + '" style="height:52px;border-radius:8px"/>' : '<span class="text-muted">Sin logo cargado</span>') + "</div></div>" +
        '<div><div class="text-muted" style="font-size:11px;margin-bottom:2px">Logo secundario</div><div id="logo2-preview">' + (logo2Temp ? '<img src="' + logo2Temp + '" style="height:52px;border-radius:8px"/>' : '<span class="text-muted">Sin logo secundario</span>') + "</div></div>" +
        "</div>" +
        '<p class="text-muted" style="margin:8px 0 0;font-size:12.5px">El logo secundario es opcional — úsalo si tu laboratorio trabaja con un aliado (ej. otro laboratorio que procesa la muestra) y necesitas que su logo también aparezca en tus reportes, cotizaciones y recibos, junto al tuyo.</p>' +
        "</fieldset>" +
        '<fieldset><legend>Operación</legend>' +
        '<div class="checkbox-row"><input type="checkbox" id="f_mostrarPrecioOrden" ' + (tenant.mostrarPrecioOrden ? "checked" : "") + '/><label style="margin:0" for="f_mostrarPrecioOrden">Permitir indicar el valor a cobrar al crear una orden</label></div>' +
        '<p class="text-muted" style="margin:4px 0 12px;font-size:12.5px">Actívalo si en tu laboratorio la persona que recibe al paciente (Recepción, un Bacteriólogo(a) o cualquiera que registre la orden) también le informa cuánto debe pagar en ese momento. Se queda desactivado por defecto — actívalo solo si lo necesitas.</p>' +
        '<div class="checkbox-row"><input type="checkbox" id="f_reportarCIM" ' + (tenant.reportarCIM ? "checked" : "") + '/><label style="margin:0" for="f_reportarCIM">Reportar Concentración Inhibitoria Mínima (CIM) en antibiogramas</label></div>' +
        '<p class="text-muted" style="margin:4px 0 0;font-size:12.5px">Actívalo solo si tu laboratorio determina la CIM (µg/mL) de cada antibiótico, además de Sensible/Intermedio/Resistente — agrega un campo opcional de CIM en la captura y el informe de todos los antibiogramas (Urocultivo, Hemocultivo, cultivos de secreción, Coprocultivo, etc.). Se queda desactivado por defecto, ya que muchos laboratorios trabajan solo con disco-difusión.</p>' +
        "</fieldset>" +
        '<fieldset><legend>Diseño del Reporte de Resultados</legend>' +
        '<div class="checkbox-row"><input type="checkbox" id="f_logoGrandeReporte" ' + (tenant.logoGrandeReporte ? "checked" : "") + '/><label style="margin:0" for="f_logoGrandeReporte">Mostrar tu logo grande y centrado en el encabezado del informe, como un membrete</label></div>' +
        '<p class="text-muted" style="margin:4px 0 12px;font-size:12.5px">En vez del logo chico a la izquierda, tu logo sale grande y centrado arriba de la página, con el nombre de tu laboratorio también centrado debajo — un encabezado tipo membrete. Necesitas tener un logo cargado arriba para que se vea.</p>' +
        '<div id="logo-grande-opciones" class="hidden" style="margin:0 0 12px;padding-left:2px">' +
        '<div class="checkbox-row"><input type="checkbox" id="f_logoAnchoCompleto" ' + (tenant.logoAnchoCompleto ? "checked" : "") + '/><label style="margin:0" for="f_logoAnchoCompleto">Que el logo ocupe todo el ancho de la hoja (en vez de un cuadro chico)</label></div>' +
        '<p class="text-muted" style="margin:4px 0 10px;font-size:12.5px">Para que se vea bien grande y nítido, sube un logo horizontal (más ancho que alto — como el que ya usas en tus recibos de papel), en formato PNG con fondo transparente si lo tienes. El sistema respeta las proporciones reales del archivo: no importa el tamaño exacto en píxeles, solo que sea horizontal para aprovechar bien el ancho.</p>' +
        '<div id="logo-ancho-pct-row" class="hidden field" style="margin:0 0 12px">' +
        '<label for="f_logoAnchoPorcentaje">Tamaño del logo: <span id="logo-ancho-pct-valor">' + (tenant.logoAnchoPorcentaje || 55) + '</span>% del ancho de la hoja</label>' +
        '<input type="range" id="f_logoAnchoPorcentaje" min="20" max="100" step="5" value="' + (tenant.logoAnchoPorcentaje || 55) + '" style="width:100%"/>' +
        '<p class="text-muted" style="margin:4px 0 0;font-size:12.5px">Ajusta el deslizante para agrandar o achicar el logo directamente. La altura se ajusta sola según las proporciones de tu archivo.</p>' +
        "</div>" +
        '<div class="checkbox-row"><input type="checkbox" id="f_ocultarNombreEncabezado" ' + (tenant.ocultarNombreEncabezado ? "checked" : "") + '/><label style="margin:0" for="f_ocultarNombreEncabezado">Ocultar el nombre del laboratorio en el encabezado (úsalo solo si tu logo ya trae el nombre escrito, para no repetirlo)</label></div>' +
        "</div>" +
        '<div class="checkbox-row"><input type="checkbox" id="f_bandaSeccionSinColor" ' + (tenant.bandaSeccionSinColor ? "checked" : "") + '/><label style="margin:0" for="f_bandaSeccionSinColor">Barras de sección del informe sin color (solo texto en negrita con una línea fina)</label></div>' +
        '<p class="text-muted" style="margin:4px 0 12px;font-size:12.5px">Por defecto, cada sección del informe (ej. "ENDOCRINOLOGÍA") sale en una barra sólida con tu color de marca. Actívalo si prefieres un estilo más neutro/minimalista, sin ese bloque de color.</p>' +
        '<div class="field" style="margin:4px 0 6px"><label style="margin-bottom:4px">Datos adicionales que se muestran en el reporte del paciente</label>' +
        '<div class="checkbox-row"><input type="checkbox" id="f_campoEdadSexo" ' + (campos.edadSexo !== false ? "checked" : "") + '/><label style="margin:0" for="f_campoEdadSexo">Edad / Sexo</label></div>' +
        (tenant.pais === "CO" ? '<div class="checkbox-row"><input type="checkbox" id="f_campoEps" ' + (campos.eps !== false ? "checked" : "") + '/><label style="margin:0" for="f_campoEps">EPS / Asegurador</label></div>' : "") +
        '<div class="checkbox-row"><input type="checkbox" id="f_campoMedico" ' + (campos.medico !== false ? "checked" : "") + '/><label style="margin:0" for="f_campoMedico">Médico Remitente</label></div>' +
        '<div class="checkbox-row"><input type="checkbox" id="f_campoProcedencia" ' + (campos.procedencia !== false ? "checked" : "") + '/><label style="margin:0" for="f_campoProcedencia">Procedencia</label></div>' +
        '<p class="text-muted" style="margin:4px 0 0;font-size:12.5px">El nombre, documento, N° de orden y fecha siempre aparecen — son los datos básicos de identificación de cualquier informe. Desmarca aquí solo los que no necesites.</p>' +
        "</div>" +
        '<div class="field"><label>Pie de página personalizado (aparece justo antes de la firma en cada informe)</label><textarea id="f_piePaginaPersonalizado" rows="2" placeholder="Ej: Nuestro laboratorio garantiza la calidad de sus análisis y el cumplimiento del sistema de control de calidad.">' + U.esc(tenant.piePaginaPersonalizado || "") + "</textarea></div>" +
        '<p class="text-muted" style="margin:4px 0 0;font-size:12.5px">Déjalo vacío si no quieres ningún texto adicional — el pie de página estándar de BIOsoft se sigue mostrando siempre, con o sin este texto.</p>' +
        "</fieldset>" +
        '<fieldset><legend>Seguridad — Clave de Administrador para Correcciones</legend>' +
        '<p class="text-muted" style="margin-top:0">Esta clave se solicita cuando un bacteriólogo necesita corregir un resultado ya validado, garantizando trazabilidad y control.</p>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Clave Actual</label><input type="password" id="f_claveActual"/></div>' +
          '<div class="field"><label>Nueva Clave de Administrador</label><input type="password" id="f_claveNueva"/></div>' +
        "</div></fieldset>" +
        '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Configuración</button>" +
      "</form></div>";

    wireEquiposCard(tenant, function () { window.BIO_VIEWS.config(root); });
    wirePerfilesEtiquetaCard(tenant, function () { window.BIO_VIEWS.config(root); });

    actualizarLabelDocumento(document, "pais", "nit");
    document.getElementById("f_pais").addEventListener("change", function () { actualizarLabelDocumento(document, "pais", "nit"); });

    document.getElementById("btn-manual-descargar").addEventListener("click", function (e) {
      var btn = e.currentTarget;
      var htmlOriginal = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = "Generando…";
      BIO_PDF_MANUAL.buildManualPDF(tenant).then(function (bytes) {
        U.downloadBytes(bytes, "Manual_de_Usuario_" + (tenant.nombre || "BIOsoft").replace(/\s+/g, "_") + ".pdf");
        U.toast("Manual descargado.", "success");
      }).finally(function () { btn.disabled = false; btn.innerHTML = htmlOriginal; });
    });
    document.getElementById("btn-manual-enviar").addEventListener("click", function () { abrirEnviarManual(tenant); });

    function previewTema() {
      U.applyTenantTheme({
        colorPrimario: document.getElementById("f_colorPrimario").value,
        colorSecundario: document.getElementById("f_colorSecundario").value,
        colorTextoMenu: document.getElementById("f_colorTextoMenu").value,
        colorTitulos: document.getElementById("f_colorTitulos").value,
        colorSubtitulos: document.getElementById("f_colorSubtitulos").value
      });
    }
    ["f_colorPrimario", "f_colorSecundario", "f_colorTextoMenu", "f_colorTitulos", "f_colorSubtitulos"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", previewTema);
    });
    document.getElementById("btn-texto-auto").addEventListener("click", function () {
      document.getElementById("f_colorTextoMenu").value = U.contrastColor(document.getElementById("f_colorSecundario").value);
      previewTema();
    });
    document.getElementById("btn-titulos-auto").addEventListener("click", function () {
      document.getElementById("f_colorTitulos").value = document.getElementById("f_colorSecundario").value;
      previewTema();
    });
    document.getElementById("btn-subtitulos-auto").addEventListener("click", function () {
      document.getElementById("f_colorSubtitulos").value = document.getElementById("f_colorPrimario").value;
      previewTema();
    });

    function refrescarOpcionesLogoGrande() {
      document.getElementById("logo-grande-opciones").classList.toggle("hidden", !document.getElementById("f_logoGrandeReporte").checked);
      document.getElementById("logo-ancho-pct-row").classList.toggle("hidden", !document.getElementById("f_logoAnchoCompleto").checked);
    }
    refrescarOpcionesLogoGrande();
    document.getElementById("f_logoGrandeReporte").addEventListener("change", refrescarOpcionesLogoGrande);
    document.getElementById("f_logoAnchoCompleto").addEventListener("change", refrescarOpcionesLogoGrande);
    document.getElementById("f_logoAnchoPorcentaje").addEventListener("input", function (e) {
      document.getElementById("logo-ancho-pct-valor").textContent = e.target.value;
    });

    document.getElementById("f_logo").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      // Se redimensiona a máximo 300px de lado antes de guardarlo: una foto
      // de celular sin comprimir puede pesar varios MB y el guardado en el
      // servidor falla en silencio (Firestore no admite documentos de más
      // de 1 MiB) — sin este ajuste, el logo nuevo se ve en la pantalla
      // actual pero al recargar reaparece el logo anterior porque nunca se
      // llegó a guardar de verdad.
      U.redimensionarImagen(file, 300).then(function (dataUrl) {
        logoTemp = dataUrl;
        document.getElementById("logo-preview").innerHTML = '<img src="' + logoTemp + '" style="height:52px;border-radius:8px"/>';
      }).catch(function () {
        U.toast("No se pudo procesar la imagen. Intenta con otro archivo.", "error");
      });
    });

    document.getElementById("f_logo2").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      U.redimensionarImagen(file, 300).then(function (dataUrl) {
        logo2Temp = dataUrl;
        document.getElementById("logo2-preview").innerHTML = '<img src="' + logo2Temp + '" style="height:52px;border-radius:8px"/>';
      }).catch(function () {
        U.toast("No se pudo procesar la imagen. Intenta con otro archivo.", "error");
      });
    });

    document.getElementById("cfg-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { return document.getElementById("f_" + id).value.trim(); };
      tenant.nombre = g("nombre"); tenant.slogan = g("slogan"); tenant.nit = C.normalizarDocumentoTributario(g("nit"), g("pais")); tenant.pais = g("pais"); tenant.direccion = g("direccion");
      tenant.telefonos = g("telefonos"); tenant.email = g("email"); tenant.sitioWeb = g("sitioWeb");
      tenant.resolucionHabilitacion = g("resolucionHabilitacion"); tenant.codigoREPS = g("codigoREPS"); tenant.nivel = parseInt(g("nivel"), 10);
      tenant.bacteriologoResponsable = { nombre: g("bactNombre"), registro: g("bactRegistro") };
      tenant.mostrarPrecioOrden = document.getElementById("f_mostrarPrecioOrden").checked;
      tenant.reportarCIM = document.getElementById("f_reportarCIM").checked;
      tenant.logoGrandeReporte = document.getElementById("f_logoGrandeReporte").checked;
      tenant.logoAnchoCompleto = document.getElementById("f_logoAnchoCompleto").checked;
      tenant.logoAnchoPorcentaje = parseInt(document.getElementById("f_logoAnchoPorcentaje").value, 10);
      tenant.ocultarNombreEncabezado = document.getElementById("f_ocultarNombreEncabezado").checked;
      tenant.bandaSeccionSinColor = document.getElementById("f_bandaSeccionSinColor").checked;
      var campoEpsEl = document.getElementById("f_campoEps");
      tenant.camposReporte = {
        edadSexo: document.getElementById("f_campoEdadSexo").checked,
        eps: campoEpsEl ? campoEpsEl.checked : (campos.eps !== false),
        medico: document.getElementById("f_campoMedico").checked,
        procedencia: document.getElementById("f_campoProcedencia").checked
      };
      tenant.piePaginaPersonalizado = g("piePaginaPersonalizado");
      tenant.colorPrimario = document.getElementById("f_colorPrimario").value;
      tenant.colorSecundario = document.getElementById("f_colorSecundario").value;
      tenant.colorTextoMenu = document.getElementById("f_colorTextoMenu").value;
      tenant.colorTitulos = document.getElementById("f_colorTitulos").value;
      tenant.colorSubtitulos = document.getElementById("f_colorSubtitulos").value;
      tenant.logoDataUrl = logoTemp;
      tenant.logoSecundarioDataUrl = logo2Temp;
      tenant.fuenteReporte = document.getElementById("f_fuenteReporte").value;
      tenant.tamanoFuenteReporte = parseInt(document.getElementById("f_tamanoFuenteReporte").value, 10) || 8;

      var claveActual = g("claveActual"), claveNueva = g("claveNueva");
      if (claveNueva) {
        if (claveActual !== tenant.claveAdmin) { U.toast("La clave actual de administrador no coincide.", "error"); return; }
        tenant.claveAdmin = claveNueva;
        S.addAudit(session.tenantId, session.nombre, session.rol, "CHANGE_ADMIN_PASSWORD", "laboratorio", tenant.id, "Cambió la clave de administrador del laboratorio.");
      }

      var submitBtn = document.querySelector("#cfg-form button[type=submit]");
      var textoOriginal = submitBtn.textContent;
      submitBtn.disabled = true; submitBtn.textContent = "Guardando…";

      // El logo (y el logo secundario) se "sanan" aquí antes de guardar,
      // aunque no se haya tocado el archivo en este guardado — un logo
      // viejo cargado antes de que existiera la compresión automática al
      // subir la imagen se quedaba pesado para siempre, y cualquier
      // guardado posterior de Configuración (aunque fuera solo para
      // cambiar un checkbox) lo mandaba tal cual, arriesgándose a superar
      // el límite de 1 MiB por documento de Firestore y tumbar TODO el
      // guardado sin aviso.
      Promise.all([
        U.recomprimirDataUrlSiHaceFalta(logoTemp, 300, 400000),
        U.recomprimirDataUrlSiHaceFalta(logo2Temp, 300, 400000)
      ]).then(function (logosListos) {
        tenant.logoDataUrl = logosListos[0];
        tenant.logoSecundarioDataUrl = logosListos[1];

        var patch = {
          nombre: tenant.nombre, slogan: tenant.slogan, nit: tenant.nit, pais: tenant.pais, direccion: tenant.direccion,
          telefonos: tenant.telefonos, email: tenant.email, sitioWeb: tenant.sitioWeb,
          resolucionHabilitacion: tenant.resolucionHabilitacion, codigoREPS: tenant.codigoREPS, nivel: tenant.nivel,
          bacteriologoResponsable: tenant.bacteriologoResponsable, mostrarPrecioOrden: tenant.mostrarPrecioOrden, reportarCIM: tenant.reportarCIM,
          logoGrandeReporte: tenant.logoGrandeReporte, logoAnchoCompleto: tenant.logoAnchoCompleto, logoAnchoPorcentaje: tenant.logoAnchoPorcentaje, ocultarNombreEncabezado: tenant.ocultarNombreEncabezado,
          bandaSeccionSinColor: tenant.bandaSeccionSinColor,
          camposReporte: tenant.camposReporte, fuenteReporte: tenant.fuenteReporte, tamanoFuenteReporte: tenant.tamanoFuenteReporte,
          piePaginaPersonalizado: tenant.piePaginaPersonalizado,
          colorPrimario: tenant.colorPrimario, colorSecundario: tenant.colorSecundario, colorTextoMenu: tenant.colorTextoMenu,
          colorTitulos: tenant.colorTitulos, colorSubtitulos: tenant.colorSubtitulos, logoDataUrl: tenant.logoDataUrl,
          logoSecundarioDataUrl: tenant.logoSecundarioDataUrl
        };
        if (claveNueva) patch.claveAdmin = tenant.claveAdmin;
        var resultado = S.updateTenant(tenant.id, patch);
        S.addAudit(session.tenantId, session.nombre, session.rol, "CONFIG_CHANGE", "laboratorio", tenant.id, "Actualizó la configuración e identidad visual del laboratorio.");
        BIO_UI.applyTenantTheme(tenant);
        BIO_ROUTER.renderShell();
        // El toast de "Guardado" ya no se muestra a ciegas: espera a que la
        // escritura a Firestore de verdad se confirme (ver _fbPromise en
        // store.js). Antes, si esa escritura fallaba, el mensaje decía
        // "guardado" igual y el cambio se perdía apenas se recargaba la
        // página, sin ninguna pista de qué había pasado.
        //
        // PERO esa promesa de Firestore solo resuelve cuando el servidor
        // confirma la escritura — si el navegador está sin buena conexión,
        // Firestore la deja en su cola local y la promesa puede quedarse
        // pendiente indefinidamente (no falla, simplemente nunca se
        // resuelve), dejando el botón en "Guardando…" para siempre. Por
        // eso aquí se limita la ESPERA (no la escritura en sí, que sigue
        // su curso en segundo plano y Firestore la reintentará solo) a 8
        // segundos, para que el botón siempre vuelva a responder.
        var yaResolvio = false;
        var promesaFirestore = resultado._fbPromise || Promise.resolve();
        // Se engancha por separado (no como parte de la carrera) para que,
        // si el timeout gana la carrera y luego esta promesa igual
        // termina rechazada más tarde, no quede como "unhandled promise
        // rejection" en la consola — ya nadie más la va a escuchar.
        promesaFirestore.then(function () { yaResolvio = true; }, function () {});
        var promesaConLimite = Promise.race([
          promesaFirestore,
          new Promise(function (resolve) { setTimeout(resolve, 8000); })
        ]);
        return promesaConLimite.then(function () {
          submitBtn.disabled = false; submitBtn.textContent = textoOriginal;
          if (yaResolvio) {
            U.toast("Configuración guardada.", "success");
          } else {
            U.toast("Los cambios quedaron guardados en este dispositivo. Sigue intentando confirmar con el servidor — si tarda mucho, revisa tu conexión a internet y vuelve a guardar.", "success");
          }
        }).catch(function (err) {
          submitBtn.disabled = false; submitBtn.textContent = textoOriginal;
          var msg = err && err.message && /longer than|exceeds the maximum|too large/i.test(err.message)
            ? "El logo que subiste es muy pesado y no se pudo guardar — usa una imagen más liviana (menos de 1 MB) y vuelve a intentar."
            : "No se pudo guardar en el servidor" + (err && err.code ? " (código: " + err.code + ")" : "") + ". Los cambios quedaron solo en este dispositivo — inténtalo de nuevo con conexión estable.";
          U.toast(msg, "error");
        });
      }).catch(function (err) {
        // Red de seguridad final: si algo revienta de forma síncrona en
        // cualquier punto de esta cadena (antes de llegar siquiera al
        // límite de 8 segundos), el botón igual se libera en vez de
        // quedarse en "Guardando…" para siempre sin ninguna pista.
        console.error("BIOsoft: error inesperado guardando Configuración ->", err);
        submitBtn.disabled = false; submitBtn.textContent = textoOriginal;
        U.toast("Ocurrió un error inesperado al guardar" + (err && err.message ? " (" + err.message + ")" : "") + ". Inténtalo de nuevo.", "error");
      });
    });
  };

  function abrirEnviarManual(tenant) {
    var mensajeDefault = "Hola 👋 Te comparto el Manual de Usuario de BIOsoft de " + (tenant.nombre || "nuestro laboratorio") + ". Ahí encuentras el paso a paso de cada módulo del sistema. Cualquier duda, aquí estamos.";
    var wrap = U.openModal(
      '<h3 class="modal-title">Enviar Manual de Usuario</h3>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Correo del destinatario</label><input id="man-email" type="email" placeholder="colaborador@correo.com"/></div>' +
      '<div class="field"><label>WhatsApp del destinatario</label><input id="man-whatsapp" placeholder="Ej: 3001234567"/></div>' +
      "</div>" +
      '<div class="field"><label>Mensaje</label><textarea id="man-msg">' + U.esc(mensajeDefault) + "</textarea></div>" +
      '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="man-go">' + U.icon("download") + " 1. Descargar PDF</button></div>" +
      '<div id="man-step2" class="hidden" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">' +
      '<p style="margin:0 0 4px"><b>2. Elige dónde enviarlo</b></p>' +
      '<p class="text-muted" style="margin:0 0 4px;font-size:12.5px">Se abrirá el correo o WhatsApp ya redactado — solo adjunta el PDF que acabas de descargar antes de darle enviar.</p>' +
      U.emailProviderButtonsHtml("man") +
      '<a class="btn btn-whatsapp btn-block" id="man-wa" target="_blank" rel="noopener" style="margin-top:8px">' + U.icon("send") + " Enviar por WhatsApp</a>" +
      "</div>"
    );
    wrap.querySelector("#man-go").addEventListener("click", function (e) {
      var email = wrap.querySelector("#man-email").value.trim();
      var whatsapp = wrap.querySelector("#man-whatsapp").value.trim();
      var msg = wrap.querySelector("#man-msg").value;
      if (!email && !whatsapp) { U.toast("Ingresa un correo o un número de WhatsApp.", "error"); return; }
      var btn = e.currentTarget;
      var htmlOriginal = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = "Generando…";
      BIO_PDF_MANUAL.buildManualPDF(tenant).then(function (bytes) {
      U.downloadBytes(bytes, "Manual_de_Usuario_" + (tenant.nombre || "BIOsoft").replace(/\s+/g, "_") + ".pdf");
      var asunto = "Manual de Usuario — " + (tenant.nombre || "BIOsoft");
      var cuerpo = msg + "\n\n(Adjunte el archivo PDF que se acaba de descargar a su equipo)";
      wrap.querySelector("#man-step2").classList.remove("hidden");
      U.wireEmailProviderButtons(wrap, "man", email, asunto, cuerpo);
      var waBtn = wrap.querySelector("#man-wa");
      if (whatsapp) {
        var numero = whatsapp.replace(/\D/g, "");
        if (numero.length === 10 && numero.charAt(0) === "3") numero = "57" + numero;
        waBtn.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg + "\n\n(Adjunte el PDF que se acaba de descargar antes de enviar)");
      } else {
        waBtn.classList.add("hidden");
      }
      U.toast("PDF descargado. Elige por dónde enviarlo.", "success");
      }).finally(function () { btn.disabled = false; btn.innerHTML = htmlOriginal; });
    });
  }

  // ------------------------------------------------------------------
  // AUDITORÍA / TRAZABILIDAD
  // ------------------------------------------------------------------
  window.BIO_VIEWS.auditoria = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = S.getTenant(session.tenantId);
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
          return "<tr><td>" + U.fmtFecha(a.fecha) + "</td><td>" + U.esc(a.usuario) + "</td><td>" + U.esc(a.rol === "sistema" || a.rol === "superadmin" ? a.rol : C.rolLabel(a.rol, tenant && tenant.pais)) + "</td><td><code>" + a.accion + "</code></td><td>" + U.esc(a.detalle) + "</td></tr>";
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
    var tenants = [];
    var cargando = true;
    var unsubTenants = null;

    function cargar() {
      S.tenantsGlobal.list().then(function (list) {
        tenants = list;
        cargando = false;
        build();
      }).catch(function (err) {
        cargando = false;
        console.error("BIOsoft: no se pudieron cargar los laboratorios cliente ->", err.code, err.message);
        root.innerHTML = '<div class="card"><p class="text-muted">No se pudieron cargar los laboratorios cliente: ' + U.esc(err.message || String(err)) + (err.code ? " — código: " + U.esc(err.code) : "") + '</p></div>';
      });
    }

    function build() {
      if (cargando) { root.innerHTML = '<div class="card"><p class="text-muted">Cargando laboratorios…</p></div>'; return; }
      var tenantsVEconRifSinFormato = tenants.filter(function (t) { return t.pais === "VE" && t.nit && C.normalizarDocumentoTributario(t.nit, "VE") !== t.nit; });
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Laboratorios Cliente (' + tenants.length + ')</h3>' +
        '<div class="flex gap-2 wrap">' +
        (tenantsVEconRifSinFormato.length ? '<button class="btn btn-outline btn-sm" id="btn-corregir-rif" title="Anteponer el prefijo V- a los RIF de Venezuela que aún no lo tienen">🔧 Corregir Formato RIF (' + tenantsVEconRifSinFormato.length + ")</button>" : "") +
        '<button class="btn btn-outline" id="btn-enlace-autoregistro" title="Envíaselo a un laboratorio que quiera empezar — llena sus propios datos y crea su cuenta solo, sin que tú tengas que crearla">' + U.icon("send") + ' Enlace de Auto-Registro</button>' +
        '<button class="btn btn-primary" id="btn-new-tenant">' + U.icon("plus") + ' Crear Nuevo Laboratorio</button>' +
        "</div></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Laboratorio</th><th>País</th><th>Plan</th><th>Estado de Pago</th><th>Próximo Pago</th><th>Usuarios</th><th></th></tr></thead><tbody>' +
        (tenants.length ? tenants.map(function (t) {
          var plan = BIO_PLANES.porId(t.planId);
          var usuariosActivos = t._usuarios || 0;
          var limite = t.maxUsuarios;
          var usuariosTxt = limite ? usuariosActivos + " / " + limite : String(usuariosActivos);
          var sobreLimite = limite && usuariosActivos > limite;
          var estado = BIO_PLANES.estadoCuenta(t);
          var estadoInfo = BIO_PLANES.ESTADOS_CUENTA[estado];
          var necesitaRecordatorio = estado === "vencido" || estado === "por_vencer";
          var necesitaRecordatorioPrueba = estado === "en_prueba" || estado === "prueba_vencida";
          var diasPruebaTxt = estado === "en_prueba" ? " (" + BIO_PLANES.diasRestantes(t.fechaFinPrueba) + " día(s) restante(s))" : "";
          return "<tr><td><b>" + U.esc(t.nombre) + "</b><div class='text-muted' style='font-size:11px'>" + U.esc(C.documentoTributarioLabel(t.pais)) + " " + U.esc(t.nit || "—") + "</div></td><td>" + t.pais + "</td>" +
            "<td>" + (plan ? U.esc(plan.nombre) : '<span class="text-muted">Sin asignar</span>') + "</td>" +
            "<td><span class='badge " + estadoInfo.badge + "'>" + estadoInfo.label + diasPruebaTxt + "</span>" +
            (necesitaRecordatorio ? ' <button class="btn btn-ghost btn-sm" data-recordar-pago="' + t.id + '" title="Recordar pago por WhatsApp">' + U.icon("send") + "</button>" : "") +
            (necesitaRecordatorioPrueba ? ' <button class="btn btn-ghost btn-sm" data-recordar-prueba="' + t.id + '" title="Recordar por WhatsApp que elija un plan">' + U.icon("send") + "</button>" : "") + "</td>" +
            "<td>" + (t.esPruebaGratis ? (t.fechaFinPrueba ? U.fmtFechaCorta(t.fechaFinPrueba) : "—") : (t.fechaProximoPago ? U.fmtFechaCorta(t.fechaProximoPago) : "—")) + "</td>" +
            "<td>" + (sobreLimite ? '<span class="badge badge-urgente">' + usuariosTxt + '</span>' : usuariosTxt) + "</td>" +
            '<td><div class="flex gap-2 wrap">' +
            '<button class="btn btn-ghost btn-sm" data-editar-plan="' + t.id + '">' + U.icon("edit") + " Plan</button>" +
            '<button class="btn btn-ghost btn-sm" data-editar-datos="' + t.id + '">' + U.icon("edit") + " Datos</button>" +
            '<button class="btn btn-outline btn-sm" data-enviar-contrato="' + t.id + '">' + U.icon("file") + " Contrato</button>" +
            '<button class="btn btn-outline btn-sm" data-enviar-manual="' + t.id + '">' + U.icon("send") + " Manual</button>" +
            '<button class="btn btn-outline btn-sm" data-reenviar-acceso="' + t.id + '" title="Recordar el link de ingreso y el usuario al administrador">' + U.icon("send") + " Reenviar Acceso</button>" +
            '<button class="btn btn-ghost btn-sm" data-diagnostico-acceso="' + t.id + '" title="Revisar si algún usuario quedó con el enlace de acceso roto (puede entrar con la contraseña correcta y aun así el sistema no lo reconoce)">🔍 Diagnóstico</button>' +
            '<button class="btn btn-ghost btn-sm" data-reparar-permisos="' + t.id + '" title="Dar de un clic a todos los auxiliares el permiso de Resultados, y a todos los bacteriólogos/bioanalistas todas las secciones y permisos adicionales — para laboratorios que reportan fallas de acceso de su personal">🔧 Permisos</button>' +
            '<button class="btn btn-ghost btn-sm" data-sync-crm="' + t.id + '" title="Crear/vincular este laboratorio en el CRM">' + U.icon("send") + " CRM</button>" +
            "</div></td></tr>";
        }).join("") : '<tr><td colspan="7" class="text-muted">Aún no hay laboratorios cliente creados.</td></tr>') + "</tbody></table></div></div>";
      document.getElementById("btn-new-tenant").addEventListener("click", openNewTenant);
      document.getElementById("btn-enlace-autoregistro").addEventListener("click", abrirEnlaceAutoRegistro);
      var btnCorregirRif = document.getElementById("btn-corregir-rif");
      if (btnCorregirRif) {
        btnCorregirRif.addEventListener("click", function () {
          btnCorregirRif.disabled = true;
          tenantsVEconRifSinFormato.forEach(function (t) {
            var nitCorregido = C.normalizarDocumentoTributario(t.nit, "VE");
            S.updateTenant(t.id, { nit: nitCorregido });
          });
          U.toast(tenantsVEconRifSinFormato.length + " laboratorio(s) de Venezuela corregido(s) al formato RIF (V-…).", "success");
          cargar();
        });
      }
      root.querySelectorAll("[data-editar-plan]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirEditarPlan(tenants.filter(function (t) { return t.id === b.dataset.editarPlan; })[0]);
        });
      });
      root.querySelectorAll("[data-editar-datos]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirEditarDatos(tenants.filter(function (t) { return t.id === b.dataset.editarDatos; })[0]);
        });
      });
      root.querySelectorAll("[data-reenviar-acceso]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirReenviarAcceso(tenants.filter(function (t) { return t.id === b.dataset.reenviarAcceso; })[0]);
        });
      });
      root.querySelectorAll("[data-diagnostico-acceso]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirDiagnosticoAcceso(tenants.filter(function (t) { return t.id === b.dataset.diagnosticoAcceso; })[0]);
        });
      });
      root.querySelectorAll("[data-reparar-permisos]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirRepararPermisos(tenants.filter(function (t) { return t.id === b.dataset.repararPermisos; })[0]);
        });
      });
      root.querySelectorAll("[data-enviar-contrato]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirEnviarContrato(tenants.filter(function (t) { return t.id === b.dataset.enviarContrato; })[0]);
        });
      });
      root.querySelectorAll("[data-enviar-manual]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirEnviarManual(tenants.filter(function (t) { return t.id === b.dataset.enviarManual; })[0]);
        });
      });
      root.querySelectorAll("[data-recordar-pago]").forEach(function (b) {
        b.addEventListener("click", function () {
          recordarPagoPorWhatsapp(tenants.filter(function (t) { return t.id === b.dataset.recordarPago; })[0]);
        });
      });
      root.querySelectorAll("[data-recordar-prueba]").forEach(function (b) {
        b.addEventListener("click", function () {
          abrirRecordarPrueba(tenants.filter(function (t) { return t.id === b.dataset.recordarPrueba; })[0]);
        });
      });
      root.querySelectorAll("[data-sync-crm]").forEach(function (b) {
        b.addEventListener("click", function () {
          var tenant = tenants.filter(function (t) { return t.id === b.dataset.syncCrm; })[0];
          b.disabled = true;
          sincronizarConCRM(tenant).then(function (r) {
            U.toast(r.creado ? "Cliente creado en el CRM." : "Este laboratorio ya está en el CRM.", "success");
          }).catch(function (err) {
            U.toast("No se pudo sincronizar con el CRM: " + err.message, "error");
          }).finally(function () { b.disabled = false; });
        });
      });
    }

    function recordarPagoPorWhatsapp(tenant) {
      var plan = BIO_PLANES.porId(tenant.planId);
      var numero = (tenant.telefonos || "").replace(/\D/g, "");
      if (!numero) { U.toast("Este laboratorio no tiene un número de WhatsApp registrado.", "error"); return; }
      var msg = "Hola 👋 Te escribimos de BIOsoft: la mensualidad de " + (plan ? "tu Plan " + plan.nombre : "tu plan") + " en " + tenant.nombre +
        (tenant.fechaProximoPago ? " vence el " + U.fmtFechaCorta(tenant.fechaProximoPago) : " está próxima a vencer") + ". ¿Te ayudamos a coordinar el pago?";
      window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(msg), "_blank");
    }

    // BIOsoft es 100% del lado del cliente (sin backend propio) — no existe
    // hoy un "cronómetro" que mande el correo solo, sin que nadie lo revise,
    // exactamente al minuto en que se cumplen los 3 días. Este botón es la
    // forma real de cumplir esa promesa: un clic, desde este panel, manda
    // AMBOS canales (WhatsApp + correo) ya redactados — pensado para
    // revisarlo aquí todos los días y recordarle a quien esté por vencer o
    // ya haya vencido su prueba que elija un plan.
    function abrirRecordarPrueba(tenant) {
      var estado = BIO_PLANES.estadoCuenta(tenant);
      var dias = tenant.fechaFinPrueba ? BIO_PLANES.diasRestantes(tenant.fechaFinPrueba) : null;
      var numero = (tenant.telefonos || "").replace(/\D/g, "");
      var mensaje = estado === "prueba_vencida"
        ? "Hola 👋 Te escribimos de BIOsoft: la prueba gratis de " + tenant.nombre + " ya terminó. Si te gustó cómo funciona con tus propios datos, elige un plan y seguimos sin perder nada de lo que ya cargaste. ¿Cuál plan te sirve más?"
        : "Hola 👋 Te escribimos de BIOsoft: la prueba gratis de " + tenant.nombre + " termina en " + dias + " día(s). Cuéntanos qué te pareció y, si quieres continuar, elige un plan para no perder lo que ya cargaste. ¿Te ayudamos a elegir?";
      var wrap = U.openModal(
        '<h3 class="modal-title">Recordar prueba a ' + U.esc(tenant.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">' + (estado === "prueba_vencida" ? "Su prueba gratis ya venció." : "Su prueba gratis termina en " + dias + " día(s).") + " Envía el mensaje por WhatsApp y/o por correo — ambos ya redactados, listos para mandar.</p>" +
        '<div class="field"><label>Mensaje</label><textarea id="rp-msg">' + U.esc(mensaje) + "</textarea></div>" +
        (numero ? '<a class="btn btn-whatsapp btn-block" id="rp-wa" target="_blank" rel="noopener">' + U.icon("send") + " Enviar por WhatsApp</a>" : '<p class="text-muted" style="font-size:12.5px">Este laboratorio no tiene un número de WhatsApp registrado.</p>') +
        (tenant.email ? U.emailProviderButtonsHtml("rp-mail") : '<p class="text-muted" style="font-size:12.5px">Este laboratorio no tiene un correo registrado.</p>') +
        '<div class="flex justify-between" style="margin-top:14px"><button type="button" class="btn btn-ghost" data-modal-close>Cerrar</button><span></span></div>'
      );
      var msgBox = wrap.querySelector("#rp-msg");
      var waBtn = wrap.querySelector("#rp-wa");
      if (waBtn) {
        var actualizarWaHref = function () { waBtn.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msgBox.value); };
        actualizarWaHref();
        msgBox.addEventListener("input", actualizarWaHref);
      }
      if (tenant.email) {
        var asunto = "Tu prueba gratis de BIOsoft " + (estado === "prueba_vencida" ? "ya terminó" : "está por terminar");
        ["gmail", "outlook", "mailto"].forEach(function (proveedor) {
          var btn = wrap.querySelector("#rp-mail-" + proveedor);
          if (btn) btn.addEventListener("click", function () { window.open(U.emailLinks(tenant.email, asunto, msgBox.value)[proveedor], "_blank"); });
        });
      }
    }

    function abrirEditarPlan(tenant) {
      var wrap = U.openModal(
        '<h3 class="modal-title">Plan de ' + U.esc(tenant.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Este límite controla cuántos usuarios puede crear el laboratorio desde su propio panel. Cámbialo cuando el cliente suba (o baje) de plan.</p>' +
        '<form id="plan-form">' +
        F.sel("planId", "Plan Contratado", [""].concat(BIO_PLANES.PLANES.map(function (p) { return p.id; })).map(function (id) {
          var p = BIO_PLANES.porId(id);
          return "<option value='" + id + "' " + (id === (tenant.planId || "") ? "selected" : "") + ">" + (p ? p.nombre + " (" + p.usuarios + ")" : "— Sin asignar —") + "</option>";
        }).join("")) +
        '<div class="field"><label>Límite de usuarios (se ajusta solo según el plan, o edítalo manual)</label><input type="number" id="f_maxUsuarios" min="1" value="' + (tenant.maxUsuarios || "") + '"/></div>' +
        '<fieldset><legend>Facturación y Fechas de Pago</legend><div class="form-grid">' +
        '<div class="field"><label>Fecha de inicio del plan</label><input type="date" id="f_fechaInicioPlan" value="' + (tenant.fechaInicioPlan || "") + '"/></div>' +
        '<div class="field"><label>Próxima fecha de pago (corte)</label><input type="date" id="f_fechaProximoPago" value="' + (tenant.fechaProximoPago || "") + '"/></div>' +
        '<div class="field"><label>Ciclo de cobro habitual (días)</label><input type="number" id="f_cicloCobroDias" min="1" value="' + (tenant.cicloCobroDias || 30) + '"/></div>' +
        '<div class="field"><label>Meses de membresía gratis (si aplica)</label><input type="number" id="f_mesesMembresiaGratis" min="1" value="' + (tenant.mesesMembresiaGratis || "") + '"/></div>' +
        '<div class="field"><label>Meses de cortesía sin cobro (regalo)</label><input type="number" id="f_mesesCortesia" min="0" value="' + (tenant.mesesCortesia || "") + '"/></div>' +
        "</div>" +
        '<p class="text-muted" style="margin:2px 0 8px;font-size:12px">Estas fechas se fijan automáticamente según lo elegido la primera vez que envíes el contrato, pero puedes ajustarlas manualmente aquí.</p>' +
        '<div class="field"><label class="flex gap-2" style="align-items:center;font-weight:400"><input type="checkbox" id="f_suspendido" ' + (tenant.suspendido ? "checked" : "") + ' style="width:auto"/> Suspender acceso del laboratorio (bloquea el ingreso por falta de pago)</label></div>' +
        "</fieldset>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button></div>" +
        "</form>"
      );
      wrap.querySelector("#f_planId").addEventListener("change", function () {
        var p = BIO_PLANES.porId(this.value);
        wrap.querySelector("#f_maxUsuarios").value = p ? p.limiteUsuarios : "";
      });
      wrap.querySelector("#plan-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var planId = wrap.querySelector("#f_planId").value;
        var maxUsuarios = parseInt(wrap.querySelector("#f_maxUsuarios").value, 10);
        var estabaSuspendido = !!tenant.suspendido;
        var quedaSuspendido = wrap.querySelector("#f_suspendido").checked;
        tenant.planId = planId || null;
        tenant.maxUsuarios = maxUsuarios || null;
        tenant.fechaInicioPlan = wrap.querySelector("#f_fechaInicioPlan").value || null;
        tenant.fechaProximoPago = wrap.querySelector("#f_fechaProximoPago").value || null;
        tenant.cicloCobroDias = parseInt(wrap.querySelector("#f_cicloCobroDias").value, 10) || 30;
        tenant.mesesMembresiaGratis = parseInt(wrap.querySelector("#f_mesesMembresiaGratis").value, 10) || null;
        tenant.mesesCortesia = parseInt(wrap.querySelector("#f_mesesCortesia").value, 10) || null;
        tenant.suspendido = quedaSuspendido;
        if (quedaSuspendido && !estabaSuspendido) tenant.fechaSuspension = new Date().toISOString().slice(0, 10);
        if (!quedaSuspendido) tenant.fechaSuspension = null;
        // BIO_PLANES.estadoCuenta() revisa esPruebaGratis ANTES que
        // fechaProximoPago — si un laboratorio empezó con prueba gratis y
        // el superadmin le asigna un plan real aquí, hay que apagar esa
        // bandera; si no, el badge seguía mostrando "Prueba vencida" para
        // siempre según la fecha de fin de prueba (ya vieja), sin importar
        // qué plan o fecha de pago se le asignara después — el estado de
        // cuenta nunca se "actualizaba" a los ojos del cliente (bug real
        // reportado: cliente cambió de plan y guardó, pero seguía
        // apareciendo "Prueba vencida"). Solo se apaga al asignar un plan
        // real — dejar el plan en blanco no la vuelve a prender.
        if (planId) tenant.esPruebaGratis = false;
        S.updateTenant(tenant.id, {
          planId: tenant.planId, maxUsuarios: tenant.maxUsuarios, fechaInicioPlan: tenant.fechaInicioPlan,
          fechaProximoPago: tenant.fechaProximoPago, cicloCobroDias: tenant.cicloCobroDias,
          mesesMembresiaGratis: tenant.mesesMembresiaGratis, mesesCortesia: tenant.mesesCortesia,
          suspendido: tenant.suspendido, fechaSuspension: tenant.fechaSuspension, esPruebaGratis: tenant.esPruebaGratis
        });
        U.toast("Plan actualizado.", "success");
        U.closeModal(wrap);
      });
    }

    function abrirEditarDatos(tenant) {
      var wrap = U.openModal(
        '<h3 class="modal-title">Datos de ' + U.esc(tenant.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Corrige aquí cualquier dato del registro. Al guardar, la próxima vez que generes el contrato saldrá con la información actualizada.</p>' +
        '<form id="datos-form"><div class="form-grid">' +
        F.inp("nombre", "Nombre del Laboratorio", tenant.nombre || "", true) +
        F.inp("nit", "NIT / RIF / RUC", tenant.nit || "") +
        F.sel("pais", "País", ["CO", "VE", "EC"].map(function (p) {
          return "<option value='" + p + "' " + (p === tenant.pais ? "selected" : "") + ">" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>";
        }).join("")) +
        F.inp("direccion", "Dirección", tenant.direccion || "") +
        F.inp("telefonos", "Teléfonos (WhatsApp)", tenant.telefonos || "") +
        F.inp("telefonoFijo", "Teléfono Fijo", tenant.telefonoFijo || "") +
        F.inp("email", "Correo del Laboratorio (aparece en reportes y documentos)", tenant.email || "") +
        F.inp("contactoNombre", "Nombre del Contacto", tenant.contactoNombre || "") +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button></div>" +
        "</form>"
      );
      actualizarLabelDocumento(wrap, "pais", "nit");
      wrap.querySelector("#f_pais").addEventListener("change", function () { actualizarLabelDocumento(wrap, "pais", "nit"); });
      wrap.querySelector("#datos-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        if (!g("nombre")) { U.toast("El nombre del laboratorio es obligatorio.", "error"); return; }
        tenant.nombre = g("nombre");
        tenant.nit = C.normalizarDocumentoTributario(g("nit"), g("pais"));
        tenant.pais = g("pais");
        tenant.direccion = g("direccion");
        tenant.telefonos = g("telefonos");
        tenant.telefonoFijo = g("telefonoFijo");
        tenant.email = g("email");
        tenant.contactoNombre = g("contactoNombre");
        S.updateTenant(tenant.id, {
          nombre: tenant.nombre, nit: tenant.nit, pais: tenant.pais, direccion: tenant.direccion,
          telefonos: tenant.telefonos, telefonoFijo: tenant.telefonoFijo, email: tenant.email, contactoNombre: tenant.contactoNombre
        });
        U.toast("Datos actualizados. Ya puedes volver a generar el contrato.", "success");
        U.closeModal(wrap);
      });
    }

    // Crea el registro en el CRM (crmClientes) vinculado a este laboratorio si
    // todavía no existe uno — evita duplicados comprobando por tenantId antes
    // de crear. El estado de pago (fechas, suspensión) sigue viviendo SOLO en
    // el laboratorio: el CRM lo lee en vivo desde ahí (ver views-crm.js), así
    // que aquí no se copian esos campos, solo la identidad del cliente.
    function sincronizarConCRM(tenant) {
      return S.crm.list().then(function (clientes) {
        var yaExiste = clientes.filter(function (c) { return c.tenantId === tenant.id; })[0];
        if (yaExiste) return { creado: false };
        return S.crm.create({
          origen: "laboratorio_cliente",
          estado: "activo",
          tenantId: tenant.id,
          laboratorio: { nombre: tenant.nombre, nit: tenant.nit, ciudad: tenant.direccion || "", pais: tenant.pais },
          contacto: { nombre: tenant.contactoNombre || tenant.nombre, whatsapp: tenant.telefonos, correo: tenant.email },
          planId: tenant.planId || "",
          seccionesIds: [],
          notas: "Sincronizado automáticamente desde Laboratorios Cliente."
        }).then(function () { return { creado: true }; });
      });
    }

    function tenantParaDocs(tenant) {
      return {
        laboratorio: { nombre: tenant.nombre, nit: tenant.nit, pais: tenant.pais, ciudad: tenant.direccion || "" },
        contacto: { nombre: tenant.contactoNombre || tenant.nombre, whatsapp: tenant.telefonos, correo: tenant.email },
        seccionesTexto: "según la configuración de tu laboratorio"
      };
    }

    function abrirEnviarContrato(tenant) {
      var plan = BIO_PLANES.porId(tenant.planId);
      if (!plan) { U.toast('Asigna primero un plan a este laboratorio (botón "Plan").', "error"); return; }
      var modalidadActual = tenant.modalidadPago === "semestral" || tenant.modalidadPago === "sin_implementacion" ? tenant.modalidadPago : "mensual";
      var cicloDiasActual = tenant.cicloCobroDias || 30;
      var mesesMembresiaActual = tenant.mesesMembresiaGratis || 6;
      var mesesCortesiaActual = tenant.mesesCortesia || 0;
      var fechaInicioActual = tenant.fechaInicioPlan || new Date().toISOString().slice(0, 10);
      function construirMensaje(modalidad, ciclo, mesesMembresia, mesesCortesia) {
        return "Hola 👋 Te comparto el contrato de prestación de servicios de BIOsoft para " + (tenant.nombre || "tu laboratorio") +
          ", Plan " + plan.nombre + ". " + (modalidad === "semestral"
            ? "Tienes membresía gratis por " + mesesMembresia + " meses de una vez."
            : modalidad === "sin_implementacion"
            ? "No pagas cuota de implementación, solo tu mensualidad."
            : "El cobro es cada " + ciclo + " días calendario.") +
          (mesesCortesia > 0 ? " Además, te regalamos " + mesesCortesia + " mes(es) sin cobro de mensualidad." : "") +
          " Cualquier duda, aquí estamos.";
      }
      var mensajeDefault = construirMensaje(modalidadActual, cicloDiasActual, mesesMembresiaActual, mesesCortesiaActual);
      var wrap = U.openModal(
        '<h3 class="modal-title">Enviar Contrato — ' + U.esc(tenant.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Plan: <b>' + U.esc(plan.nombre) + '</b> (' + U.esc(plan.usuarios) + ').</p>' +
        '<div class="form-grid">' +
        '<div class="field"><label>Modalidad de pago</label><select id="con-modalidad">' +
        '<option value="mensual" ' + (modalidadActual === "mensual" ? "selected" : "") + '>Mes a mes (implementación fraccionada)</option>' +
        '<option value="sin_implementacion" ' + (modalidadActual === "sin_implementacion" ? "selected" : "") + '>Sin cobro de implementación (mensualidad normal desde el inicio)</option>' +
        '<option value="semestral" ' + (modalidadActual === "semestral" ? "selected" : "") + '>Membresía gratis de una vez (sin implementación)</option>' +
        "</select></div>" +
        '<div class="field"><label>Fecha de inicio de cobro</label><input type="date" id="con-fecha-inicio" value="' + fechaInicioActual + '"/></div>' +
        '<div class="field ' + (modalidadActual === "semestral" ? "hidden" : "") + '" id="con-ciclo-box"><label>Ciclo de cobro (días)</label><input type="number" id="con-ciclo" min="1" value="' + cicloDiasActual + '"/></div>' +
        '<div class="field ' + (modalidadActual === "semestral" ? "" : "hidden") + '" id="con-meses-box"><label>Meses de membresía gratis</label><input type="number" id="con-meses" min="1" value="' + mesesMembresiaActual + '"/></div>' +
        '<div class="field"><label>Meses de cortesía sin cobro (regalo)</label><input type="number" id="con-meses-cortesia" min="0" value="' + mesesCortesiaActual + '"/></div>' +
        '<div class="field"><label>Correo del destinatario</label><input id="con-email" type="email" value="' + U.esc(tenant.email || "") + '"/></div>' +
        '<div class="field"><label>WhatsApp del destinatario</label><input id="con-whatsapp" value="' + U.esc(tenant.telefonos || "") + '"/></div>' +
        "</div>" +
        '<p class="text-muted" style="margin:2px 0 10px;font-size:12px">La fecha de inicio de cobro no tiene que ser hoy — si la implementación toma unos días, ponla más adelante para que el cliente no pierda esos días de uso gratis. Las "Meses de cortesía" retrasan el primer cobro sin afectar la modalidad elegida.</p>' +
        '<div class="field"><label>Mensaje</label><textarea id="con-msg">' + U.esc(mensajeDefault) + "</textarea></div>" +
        '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="con-go">' + U.icon("download") + " 1. Generar y Descargar</button></div>" +
        '<div id="con-step2" class="hidden" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">' +
        '<p style="margin:0 0 4px"><b>2. Elige dónde enviarlo</b></p>' +
        '<p class="text-muted" style="margin:0 0 4px;font-size:12.5px">Se abrirá el correo o WhatsApp ya redactado — solo adjunta el PDF que acabas de descargar antes de darle enviar.</p>' +
        U.emailProviderButtonsHtml("con") +
        '<a class="btn btn-whatsapp btn-block" id="con-wa" target="_blank" rel="noopener" style="margin-top:8px">' + U.icon("send") + " Enviar por WhatsApp</a>" +
        "</div>",
        { lg: true }
      );
      var msgEditadoManualmente = false;
      wrap.querySelector("#con-msg").addEventListener("input", function () {
        msgEditadoManualmente = this.value !== construirMensaje(
          wrap.querySelector("#con-modalidad").value,
          parseInt(wrap.querySelector("#con-ciclo").value, 10) || 30,
          parseInt(wrap.querySelector("#con-meses").value, 10) || 6,
          parseInt(wrap.querySelector("#con-meses-cortesia").value, 10) || 0
        );
      });
      function actualizarMensajePreview() {
        if (msgEditadoManualmente) return;
        wrap.querySelector("#con-msg").value = construirMensaje(
          wrap.querySelector("#con-modalidad").value,
          parseInt(wrap.querySelector("#con-ciclo").value, 10) || 30,
          parseInt(wrap.querySelector("#con-meses").value, 10) || 6,
          parseInt(wrap.querySelector("#con-meses-cortesia").value, 10) || 0
        );
      }
      wrap.querySelector("#con-modalidad").addEventListener("change", function () {
        var esSemestral = this.value === "semestral";
        wrap.querySelector("#con-ciclo-box").classList.toggle("hidden", esSemestral);
        wrap.querySelector("#con-meses-box").classList.toggle("hidden", !esSemestral);
        actualizarMensajePreview();
      });
      ["#con-ciclo", "#con-meses", "#con-meses-cortesia"].forEach(function (sel) {
        wrap.querySelector(sel).addEventListener("input", actualizarMensajePreview);
      });
      wrap.querySelector("#con-go").addEventListener("click", function (e) {
        var email = wrap.querySelector("#con-email").value.trim();
        var whatsapp = wrap.querySelector("#con-whatsapp").value.trim();
        var msg = wrap.querySelector("#con-msg").value;
        var modalidadElegida = wrap.querySelector("#con-modalidad").value;
        var fechaInicioElegida = wrap.querySelector("#con-fecha-inicio").value || new Date().toISOString().slice(0, 10);
        var cicloElegido = parseInt(wrap.querySelector("#con-ciclo").value, 10) || 30;
        var mesesElegidos = parseInt(wrap.querySelector("#con-meses").value, 10) || 6;
        var mesesCortesiaElegidos = parseInt(wrap.querySelector("#con-meses-cortesia").value, 10) || 0;
        if (!email && !whatsapp) { U.toast("Ingresa un correo o un número de WhatsApp.", "error"); return; }
        var btn = e.currentTarget;
        var htmlOriginal = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = "Generando…";
        try {
          var opts = { cicloCobroDias: cicloElegido, mesesMembresia: mesesElegidos, mesesCortesia: mesesCortesiaElegidos };
          var bytes = BIO_PDF_CRM.buildContratoPDF(tenantParaDocs(tenant), plan, modalidadElegida, opts);
          U.downloadBytes(bytes, "Contrato_BIOsoft_" + (tenant.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf");
          var inicio = new Date(fechaInicioElegida + "T12:00:00");
          var diasHastaProximoPago = mesesCortesiaElegidos > 0 ? mesesCortesiaElegidos * 30 : (modalidadElegida === "semestral" ? mesesElegidos * 30 : cicloElegido);
          tenant.fechaInicioPlan = fechaInicioElegida;
          tenant.fechaProximoPago = new Date(inicio.getTime() + diasHastaProximoPago * 864e5).toISOString().slice(0, 10);
          tenant.modalidadPago = modalidadElegida;
          tenant.cicloCobroDias = cicloElegido;
          tenant.mesesCortesia = mesesCortesiaElegidos || null;
          if (modalidadElegida === "semestral") tenant.mesesMembresiaGratis = mesesElegidos;
          var patchContrato = {
            fechaInicioPlan: tenant.fechaInicioPlan, fechaProximoPago: tenant.fechaProximoPago,
            modalidadPago: tenant.modalidadPago, cicloCobroDias: tenant.cicloCobroDias, mesesCortesia: tenant.mesesCortesia
          };
          if (modalidadElegida === "semestral") patchContrato.mesesMembresiaGratis = tenant.mesesMembresiaGratis;
          S.updateTenant(tenant.id, patchContrato);
          var asunto = "Contrato de Servicios — BIOsoft (" + plan.nombre + ")";
          var cuerpo = msg + "\n\n(Adjunte el archivo PDF que se acaba de descargar a su equipo)";
          wrap.querySelector("#con-step2").classList.remove("hidden");
          U.wireEmailProviderButtons(wrap, "con", email, asunto, cuerpo);
          var waBtn = wrap.querySelector("#con-wa");
          if (whatsapp) {
            var numero = whatsapp.replace(/\D/g, "");
            if (numero.length === 10 && numero.charAt(0) === "3") numero = "57" + numero;
            waBtn.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg + "\n\n(Adjunte el PDF que se acaba de descargar antes de enviar)");
          } else {
            waBtn.classList.add("hidden");
          }
          U.toast("Contrato generado. Elige por dónde enviarlo.", "success");
        } finally {
          btn.disabled = false; btn.innerHTML = htmlOriginal;
        }
      });
    }

    // Mensaje de bienvenida con el link de ingreso, las credenciales del
    // administrador y cómo instalar el ícono en escritorio/celular — para que
    // el administrador pueda empezar a usar BIOsoft por primera vez sin
    // tener que pedirnos nada más.
    function appLoginUrl() {
      return location.origin + location.pathname;
    }
    function instruccionesInstalacion() {
      return "💻 Para acceder más rápido desde el computador (queda como un programa en tu escritorio):\n" +
        "1. Abre el link de ingreso en Chrome o Edge.\n" +
        "2. Haz clic en el ícono de instalar (⊕) que aparece al final de la barra de direcciones, o en el menú ⋮ elige \"Instalar BIOsoft\".\n" +
        "3. Listo — queda un ícono de BIOsoft en tu escritorio.\n\n" +
        "📱 Para poner el ícono en la pantalla de inicio de tu celular:\n" +
        "• Android (Chrome): abre el link, toca el menú ⋮ y elige \"Agregar a pantalla de inicio\".\n" +
        "• iPhone (Safari): abre el link, toca el botón compartir 📤 y elige \"Agregar a pantalla de inicio\".";
    }
    function mensajeBienvenida(tenant, credenciales) {
      var url = appLoginUrl();
      return "Hola 👋 ¡Bienvenido a BIOsoft! Tu laboratorio \"" + (tenant.nombre || "") + "\" ya está listo para usarse.\n\n" +
        "🔗 Link de ingreso: " + url + "\n" +
        "👤 Usuario: " + credenciales.username + "\n" +
        "🔑 Contraseña: " + credenciales.password + "\n" +
        "🛡️ Clave de administrador (para autorizar correcciones de resultados): " + (tenant.claveAdmin || "") + "\n\n" +
        "Guarda este mensaje — lo necesitarás cada vez que quieras ingresar.\n\n" +
        instruccionesInstalacion() + "\n\n" +
        "Cualquier duda, aquí estamos para ayudarte. ¡Éxitos con tu laboratorio! 🚀";
    }
    function mensajeRecordatorioAcceso(tenant, username) {
      var url = appLoginUrl();
      return "Hola 👋 Te recordamos tus datos de acceso a BIOsoft para \"" + (tenant.nombre || "") + "\".\n\n" +
        "🔗 Link de ingreso: " + url + "\n" +
        "👤 Usuario: " + username + "\n\n" +
        "🔒 Por tu seguridad no guardamos tu contraseña. Si no la recuerdas, entra al link de arriba y usa la opción \"¿Olvidaste tu contraseña?\" para crear una nueva en segundos (o pídenos que te enviemos el enlace directo).\n" +
        "🛡️ Clave de administrador (para autorizar correcciones de resultados): " + (tenant.claveAdmin || "") + "\n\n" +
        instruccionesInstalacion() + "\n\n" +
        "Cualquier duda, aquí estamos para ayudarte. 🚀";
    }

    // Modal genérico de "componer y enviar" un mensaje de texto por correo o
    // WhatsApp, reutilizado por la bienvenida al crear el laboratorio y por
    // el recordatorio de acceso — evita duplicar el cableado de los botones
    // de correo/WhatsApp (que deben leer el mensaje ACTUAL del textarea, no
    // uno fijo del momento en que se abrió el modal).
    function abrirEnviarMensajeTexto(opts) {
      var wrap = U.openModal(
        '<h3 class="modal-title">' + opts.titulo + '</h3>' +
        '<p class="text-muted" style="margin-top:0">' + opts.descripcion + '</p>' +
        '<div class="form-grid">' +
        '<div class="field"><label>Correo del destinatario</label><input id="txt-email" type="email" value="' + U.esc(opts.tenant.email || "") + '"/></div>' +
        '<div class="field"><label>WhatsApp del destinatario</label><input id="txt-whatsapp" value="' + U.esc(opts.tenant.telefonos || "") + '"/></div>' +
        "</div>" +
        '<div class="field"><label>Mensaje</label><textarea id="txt-msg" rows="14">' + U.esc(opts.mensaje) + "</textarea></div>" +
        (opts.botonExtraHtml || "") +
        U.emailProviderButtonsHtml("txt") +
        '<a class="btn btn-whatsapp btn-block" id="txt-wa" target="_blank" rel="noopener" style="margin-top:8px">' + U.icon("send") + " Enviar por WhatsApp</a>" +
        '<div class="flex justify-between" style="margin-top:16px"><span></span><button type="button" class="btn btn-primary" id="txt-continuar">' + U.icon("check") + " " + (opts.botonContinuarLabel || "Listo") + "</button></div>",
        { lg: true }
      );
      if (opts.wireExtra) opts.wireExtra(wrap);
      // Se conectan los botones de correo directamente (en vez de usar
      // U.wireEmailProviderButtons, que fija el cuerpo del mensaje una sola
      // vez) para que siempre tomen el correo y el mensaje actuales del
      // formulario, por si el usuario los edita antes de enviar.
      ["gmail", "outlook", "mailto"].forEach(function (prov) {
        wrap.querySelector("#txt-" + prov).addEventListener("click", function () {
          var links = U.emailLinks(wrap.querySelector("#txt-email").value.trim(), opts.asuntoCorreo, wrap.querySelector("#txt-msg").value);
          window.open(links[prov], "_blank");
        });
      });
      var waBtn = wrap.querySelector("#txt-wa");
      function actualizarWhatsapp() {
        var whatsapp = wrap.querySelector("#txt-whatsapp").value.trim();
        if (!whatsapp) { waBtn.classList.add("hidden"); return; }
        var numero = whatsapp.replace(/\D/g, "");
        if (numero.length === 10 && numero.charAt(0) === "3") numero = "57" + numero;
        waBtn.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(wrap.querySelector("#txt-msg").value);
        waBtn.classList.remove("hidden");
      }
      actualizarWhatsapp();
      wrap.querySelector("#txt-msg").addEventListener("input", actualizarWhatsapp);
      wrap.querySelector("#txt-whatsapp").addEventListener("input", actualizarWhatsapp);
      wrap.querySelector("#txt-continuar").addEventListener("click", function () {
        U.closeModal(wrap);
        if (opts.alContinuar) opts.alContinuar();
      });
      return wrap;
    }

    function abrirBienvenidaLaboratorio(tenant, credenciales, alContinuar) {
      abrirEnviarMensajeTexto({
        titulo: "🎉 Enviar bienvenida a " + U.esc(tenant.nombre),
        descripcion: "Envíale al administrador el link de ingreso, sus credenciales y cómo dejar BIOsoft instalado en su computador y celular.",
        tenant: tenant,
        mensaje: mensajeBienvenida(tenant, credenciales),
        asuntoCorreo: "Bienvenido a BIOsoft — Datos de ingreso de " + (tenant.nombre || ""),
        botonContinuarLabel: "Listo, continuar",
        alContinuar: alContinuar
      });
    }

    // Reenvía el link de ingreso al administrador de un laboratorio YA
    // creado — por ejemplo cuando olvidó dónde entrar o perdió el mensaje
    // original. La contraseña real nunca se guarda (Firebase Auth), así que
    // el mensaje lo remite a "¿Olvidaste tu contraseña?" e incluye un botón
    // para disparar directamente el correo de restablecimiento.
    function abrirReenviarAcceso(tenant) {
      U.toast("Buscando el usuario administrador…", "success");
      S.tenantsGlobal.listUsuarios(tenant.id).then(function (usuarios) {
        var admin = usuarios.filter(function (u) { return u.rol === "admin"; })[0];
        if (!admin) { abrirCrearAdministrador(tenant, usuarios); return; }
        abrirEnviarMensajeTexto({
          titulo: "🔁 Reenviar acceso a " + U.esc(tenant.nombre),
          descripcion: "Le recordamos al administrador (" + U.esc(admin.nombre || admin.username) + ") el link de ingreso y su usuario. Si no recuerda la contraseña, puedes enviarle de una vez el enlace para crear una nueva.",
          tenant: tenant,
          mensaje: mensajeRecordatorioAcceso(tenant, admin.username),
          asuntoCorreo: "Recordatorio de acceso a BIOsoft — " + (tenant.nombre || ""),
          botonContinuarLabel: "Listo",
          botonExtraHtml: '<button type="button" class="btn btn-outline btn-block" id="txt-reset-pass" style="margin-bottom:10px">🔑 Enviar enlace para restablecer contraseña (' + U.esc(admin.username) + ")</button>",
          wireExtra: function (wrap) {
            wrap.querySelector("#txt-reset-pass").addEventListener("click", function (e) {
              var btn = e.currentTarget;
              btn.disabled = true;
              BIO_AUTH.recuperarContrasena(admin.username).then(function (res) {
                btn.disabled = false;
                U.toast(res.ok ? "Enlace de restablecimiento enviado a " + admin.username + "." : res.error, res.ok ? "success" : "error");
              });
            });
          }
        });
      }).catch(function (err) {
        U.toast("No se pudo cargar el usuario administrador: " + (err.message || err), "error");
      });
    }

    // Un usuario puede tener su cuenta de Firebase Auth funcionando
    // perfectamente (la contraseña es correcta, incluso después de un
    // restablecimiento) y aun así el sistema le diga "usuario no encontrado
    // o inactivo" — porque falta, además, el documento que enlaza esa
    // cuenta con este laboratorio. Esta herramienta detecta ese caso
    // exacto por usuario, y permite repararlo con un clic.
    function abrirDiagnosticoAcceso(tenant) {
      var wrapCargando = U.openModal('<h3 class="modal-title">🔍 Diagnóstico de Acceso — ' + U.esc(tenant.nombre) + '</h3><p class="text-muted">Revisando el enlace de acceso de cada usuario…</p>');
      function cargarYMostrar() {
        S.tenantsGlobal.diagnosticarAcceso(tenant.id).then(function (resultados) {
          U.closeModal(wrapCargando);
          var wrap = U.openModal(
            '<h3 class="modal-title">🔍 Diagnóstico de Acceso — ' + U.esc(tenant.nombre) + '</h3>' +
            '<p class="text-muted" style="margin-top:0">Si un usuario ya cambió su contraseña (incluso con el enlace de restablecimiento) y el sistema le sigue diciendo "usuario no encontrado o inactivo", casi siempre es porque le falta este enlace — no un problema con su contraseña.</p>' +
            '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Activo</th><th>Enlace de acceso</th><th></th></tr></thead><tbody>' +
            resultados.map(function (r, i) {
              var estadoTxt = r.estado === "ok" ? "<span class='badge badge-validado'>✓ En orden</span>"
                : r.estado === "otro_tenant" ? "<span class='badge badge-urgente'>⚠️ Apunta a otro laboratorio</span>"
                : "<span class='badge badge-urgente'>❌ Falta el perfil de acceso</span>";
              return "<tr><td>" + U.esc(r.usuario.username) + "</td><td>" + U.esc(r.usuario.nombre || "—") + "</td><td>" + (r.usuario.activo === false ? "❌ Inactivo" : "✓ Activo") + "</td><td>" + estadoTxt + "</td>" +
                "<td>" + (r.estado !== "ok" ? "<button class='btn btn-outline btn-sm' data-reparar='" + i + "'>🔧 Reparar</button>" : "") + "</td></tr>";
            }).join("") + "</tbody></table></div>" +
            (resultados.length ? "" : '<p class="text-muted">Este laboratorio no tiene usuarios todavía.</p>') +
            '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>',
            { lg: true }
          );
          wrap.querySelectorAll("[data-reparar]").forEach(function (b) {
            b.addEventListener("click", function () {
              var r = resultados[Number(b.dataset.reparar)];
              b.disabled = true; b.textContent = "Reparando…";
              S.tenantsGlobal.repararPerfilAcceso(tenant.id, r.usuario).then(function () {
                U.toast(r.usuario.nombre + " ya puede entrar con su usuario y contraseña actuales.", "success");
                U.closeModal(wrap);
                wrapCargando = U.openModal('<h3 class="modal-title">🔍 Diagnóstico de Acceso — ' + U.esc(tenant.nombre) + '</h3><p class="text-muted">Actualizando…</p>');
                cargarYMostrar();
              }).catch(function (err) {
                b.disabled = false; b.textContent = "🔧 Reparar";
                U.toast("No se pudo reparar: " + (err.message || err), "error");
              });
            });
          });
        }).catch(function (err) {
          U.closeModal(wrapCargando);
          U.toast("No se pudo cargar el diagnóstico: " + (err.message || err), "error");
        });
      }
      cargarYMostrar();
    }

    // Cuando un laboratorio reporta que su personal tiene fallas de acceso
    // (típicamente: "a los auxiliares no les aparece el paciente para
    // ingresar resultados"), en vez de pedirle que edite usuario por
    // usuario, este botón corrige de un clic los permisos operativos de
    // TODO su personal — ver store.js -> repararPermisosOperativos.
    function abrirRepararPermisos(tenant) {
      var wrap = U.openModal(
        '<h3 class="modal-title">🔧 Reparar Permisos Operativos — ' + U.esc(tenant.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Esto va a dejar así, de una vez, a TODO el personal de este laboratorio:</p>' +
        '<ul style="margin:0 0 12px;padding-left:20px;font-size:13.5px;color:var(--text-muted)">' +
        '<li>Todo <b>Auxiliar/Asistente</b> (Recepción) queda con el permiso de <b>Resultados</b> (puede crear pacientes, crear órdenes e ingresar resultados en borrador o preliminar — nunca validar/firmar).</li>' +
        '<li>Todo <b>Bacteriólogo(a)/Bioanalista</b> queda con <b>todas las secciones</b> y <b>todos los permisos adicionales</b> (puede crear pacientes, crear órdenes, ingresar resultados y validar/firmar).</li>' +
        "</ul>" +
        '<p class="text-muted" style="font-size:13.5px">No toca contraseñas, firmas ni ningún otro dato de los usuarios — solo estos permisos.</p>' +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button class="btn btn-ghost" data-modal-close>Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-confirmar-reparar">' + U.icon("check") + " Reparar Ahora</button></div>"
      );
      wrap.querySelector("#btn-confirmar-reparar").addEventListener("click", function (e) {
        var btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "Reparando…";
        S.tenantsGlobal.repararPermisosOperativos(tenant.id).then(function (res) {
          U.closeModal(wrap);
          U.toast(res.reparados ? "Listo: se corrigieron los permisos de " + res.reparados + " usuario(s)." : "Todo el personal ya tenía los permisos correctos — no había nada que corregir.", "success");
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = "Reparar Ahora";
          U.toast("No se pudo reparar: " + (err.message || err), "error");
        });
      });
    }

    // Crea un usuario administrador para un laboratorio YA existente que se
    // quedó sin ninguno (ej. se borró por error, o nunca se creó). No toca
    // ni reemplaza el documento del laboratorio ni a sus demás usuarios: solo
    // agrega el usuario nuevo (misma ruta que usa Crear Nuevo Laboratorio,
    // pero pasando el tenantId existente en vez de crear uno desde cero).
    function abrirCrearAdministrador(tenant, usuariosExistentes) {
      usuariosExistentes = usuariosExistentes || [];
      var sugerido = usuariosExistentes.length === 1 ? usuariosExistentes[0] : null;
      var wrap = U.openModal(
        '<h3 class="modal-title">Restablecer Administrador de ' + U.esc(tenant.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Este laboratorio no tiene ningún usuario con rol de administrador. Crea uno para restablecer el acceso — si en este laboratorio solo hay una persona, puede ser la misma que ya usa el sistema como ' + U.esc(C.rolLabel("bacteriologo", tenant.pais)) + ', usando su correo personal como usuario de ingreso. Si ese correo ya es su cuenta actual, te ofreceremos darle también el rol de Administrador en vez de crear una cuenta nueva.</p>' +
        '<form id="crear-admin-form"><div class="form-grid">' +
          F.inp("nombre", "Nombre completo", (sugerido && sugerido.nombre) || "", true) +
          F.inp("user", "Correo electrónico (usuario de ingreso)", (sugerido && sugerido.username) || "", true, "email") +
          F.inp("pass", "Contraseña (mínimo 6 caracteres, solo si es una cuenta nueva)", "", false) +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Crear Administrador</button></div>" +
        "</form>"
      );
      wrap.querySelector("#crear-admin-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        var existente = usuariosExistentes.filter(function (u) { return (u.username || "").toLowerCase() === g("user").toLowerCase(); })[0];
        if (!g("nombre") || !g("user")) { U.toast("Completa el nombre y el correo.", "error"); return; }
        if (g("user").indexOf("@") === -1) { U.toast("El usuario debe ser un correo electrónico válido.", "error"); return; }
        if (!existente && (!g("pass") || g("pass").length < 6)) { U.toast("La contraseña debe tener al menos 6 caracteres.", "error"); return; }
        var submitBtn = wrap.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = existente ? "Actualizando…" : "Creando…";

        // Si ese correo ya es la cuenta de alguien más en ESTE mismo laboratorio
        // (típicamente la única bacterióloga en un plan de un solo usuario), no
        // tiene caso intentar crear una cuenta nueva con el mismo correo — se
        // le da directamente también el rol de Administrador a esa cuenta.
        if (existente) {
          S.tenantsGlobal.promoverUsuarioAAdmin(tenant.id, existente.id).then(function () {
            U.toast(existente.nombre + " ahora también tiene acceso como Administrador, con la misma cuenta y contraseña que ya usaba.", "success");
            U.closeModal(wrap);
            cargar();
          }).catch(function (err) {
            submitBtn.disabled = false; submitBtn.textContent = "Crear Administrador";
            U.toast((err && err.message) || "No se pudo actualizar el usuario.", "error");
          });
          return;
        }

        S.provisionRealAccount({
          tenantId: tenant.id,
          userData: { username: g("user"), password: g("pass"), nombre: g("nombre"), rol: "admin", secciones: [] }
        }).then(function () {
          U.toast("Administrador creado. Ya puede ingresar con ese correo y esa contraseña.", "success");
          U.closeModal(wrap);
          cargar();
        }).catch(function (err) {
          submitBtn.disabled = false; submitBtn.textContent = "Crear Administrador";
          var msg = (err && err.code === "auth/email-already-in-use")
            ? "Ese correo ya tiene una cuenta en otro laboratorio distinto a este. Usa un correo diferente para el administrador de " + U.esc(tenant.nombre) + "."
            : (err && err.message) || "No se pudo crear el administrador.";
          U.toast(msg, "error");
        });
      });
    }

    // Para no tener que crear cada laboratorio nuevo a mano (rellenando su
    // formulario uno por uno): este botón da un enlace y un mensaje listos
    // para enviarle a un laboratorio que quiera empezar, para que llene sus
    // propios datos y cree su cuenta él mismo — el mismo formulario público
    // de autoactivación (activar.html) que ya usa la landing y el CRM
    // (ver abrirEnviarEnlaceRegistro en views-crm.js), pero aquí sin
    // necesitar tener antes un contacto cargado en el CRM: sirve para
    // cualquier prospecto, aunque todavía no esté registrado en ningún
    // lado.
    function abrirEnlaceAutoRegistro() {
      var link = "https://bioauditoria.com/biosoft/activar.html";
      var mensaje = "Hola 👋 Te comparto el enlace para activar tu BIOsoft — lo activas tú mismo, con tus propios datos, en menos de 5 minutos:\n\n" +
        link + "\n\n" +
        "Completa los datos de tu laboratorio, crea tu usuario y contraseña, y tu BIOsoft queda funcionando al instante. Luego, desde Configuración, ajustas tu logo y colores con calma. Cualquier duda mientras lo llenas, aquí estamos.";
      var wrap = U.openModal(
        '<h3 class="modal-title">Enlace de Auto-Registro</h3>' +
        '<p class="text-muted" style="margin-top:0">Envíaselo a un laboratorio que quiera empezar: completa sus propios datos, crea su usuario y contraseña, y su BIOsoft queda activo al instante — sin que tengas que crear nada tú.</p>' +
        '<div class="field"><label>Enlace</label><input id="ar-link" value="' + U.esc(link) + '" readonly/></div>' +
        '<div class="field"><label>Mensaje sugerido (puedes editarlo antes de enviarlo)</label><textarea id="ar-mensaje" rows="6">' + U.esc(mensaje) + "</textarea></div>" +
        '<div class="flex gap-2 wrap" style="margin-top:6px">' +
        '<button class="btn btn-outline btn-sm" id="btn-copiar-link">' + U.icon("clipboard") + " Copiar Enlace</button>" +
        '<button class="btn btn-outline btn-sm" id="btn-copiar-mensaje">' + U.icon("clipboard") + " Copiar Mensaje</button>" +
        '<button class="btn btn-whatsapp btn-sm" id="btn-enviar-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" +
        "</div>" +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrap.querySelector("#btn-copiar-link").addEventListener("click", function () {
        navigator.clipboard.writeText(link).then(function () { U.toast("Enlace copiado.", "success"); }).catch(function () { U.toast("No se pudo copiar. Selecciónalo manualmente.", "error"); });
      });
      wrap.querySelector("#btn-copiar-mensaje").addEventListener("click", function () {
        var texto = wrap.querySelector("#ar-mensaje").value;
        navigator.clipboard.writeText(texto).then(function () { U.toast("Mensaje copiado.", "success"); }).catch(function () { U.toast("No se pudo copiar. Selecciónalo manualmente.", "error"); });
      });
      wrap.querySelector("#btn-enviar-wa").addEventListener("click", function () {
        var texto = wrap.querySelector("#ar-mensaje").value;
        window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
      });
    }

    function openNewTenant() {
      var wrap = U.openModal(
        '<h3 class="modal-title">Crear Nuevo Laboratorio Cliente</h3>' +
        '<p class="text-muted" style="margin-top:0">Esto crea una cuenta real, accesible desde cualquier dispositivo (no es una cuenta demo).</p>' +
        '<form id="tenant-form">' +
          '<div class="form-grid">' +
            F.inp("nombre", "Nombre del Laboratorio", "", true) +
            F.inp("nit", "NIT / RIF / RUC", "") +
            F.sel("pais", "País", ["CO", "VE", "EC"].map(function (p) { return "<option value='" + p + "'>" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>"; }).join("")) +
            F.inp("direccion", "Dirección", "") + F.inp("telefonos", "Teléfonos", "") + F.inp("telefonoFijo", "Teléfono Fijo", "") +
            F.inp("email", "Correo del Laboratorio (aparece en reportes y documentos)", "") +
            F.sel("nivel", "Nivel", [1, 2].map(function (n) { return "<option value='" + n + "'>Nivel " + n + "</option>"; }).join("")) +
            F.sel("planId", "Plan Contratado", BIO_PLANES.PLANES.map(function (p) { return "<option value='" + p.id + "'>" + p.nombre + " (" + p.usuarios + ")</option>"; }).join("")) +
          "</div>" +
          '<fieldset><legend>Usuario Administrador Inicial</legend><div class="form-grid">' +
            F.inp("adminNombre", "Nombre del Administrador", "", true) + F.inp("adminUser", "Correo electrónico (será su usuario de ingreso — puede ser su correo personal)", "", true, "email") + F.inp("adminPass", "Contraseña (mínimo 6 caracteres)", "", true) +
          "</div>" +
          '<p class="text-muted" style="margin:2px 0 0;font-size:12.5px">💡 El correo de ingreso del administrador puede ser distinto al "Correo del Laboratorio": el de ingreso es personal y privado, mientras que el del laboratorio es el que verán los pacientes en los reportes.</p>' +
          "</fieldset>" +
          '<fieldset><legend>Facturación</legend><div class="form-grid">' +
            F.sel("tipoContratacion", "Tipo de contratación", "<option value='prueba_gratis'>🎁 Prueba gratis (" + BIO_PLANES.DIAS_PRUEBA_GRATIS + " días, sin tarjeta ni plan)</option><option value='mensual'>Pago mes a mes (implementación fraccionada)</option><option value='membresia_gratis'>Membresía gratis de una vez (sin implementación)</option>") +
            '<div class="field hidden" id="nt-ciclo-box"><label>Ciclo de cobro (días)</label><input type="number" id="f_cicloCobroDias" min="1" value="30"/></div>' +
            '<div class="field hidden" id="nt-meses-box"><label>Meses de membresía gratis</label><input type="number" id="f_mesesMembresia" min="1" value="6"/></div>' +
          "</div>" +
          '<p class="text-muted" id="nt-prueba-nota" style="margin:2px 0 0;font-size:12.5px">💡 El laboratorio queda activo de inmediato con sus propios datos reales. A los ' + BIO_PLANES.DIAS_PRUEBA_GRATIS + ' días, el sistema deja de dejarlos operar hasta que elijan un plan — desde "Laboratorios Cliente" puedes recordarles por WhatsApp que elijan uno antes de que termine.</p>' +
          "</fieldset>" +
          '<div class="flex gap-2 justify-between"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Crear Laboratorio</button></div>" +
        "</form>", { lg: true }
      );
      actualizarLabelDocumento(wrap, "pais", "nit");
      wrap.querySelector("#f_pais").addEventListener("change", function () { actualizarLabelDocumento(wrap, "pais", "nit"); });
      wrap.querySelector("#f_tipoContratacion").addEventListener("change", function () {
        var esPrueba = this.value === "prueba_gratis";
        var esMembresia = this.value === "membresia_gratis";
        wrap.querySelector("#nt-ciclo-box").classList.toggle("hidden", esMembresia || esPrueba);
        wrap.querySelector("#nt-meses-box").classList.toggle("hidden", !esMembresia);
        wrap.querySelector("#nt-prueba-nota").classList.toggle("hidden", !esPrueba);
      });
      wrap.querySelector("#nt-prueba-nota").classList.remove("hidden");
      wrap.querySelector("#tenant-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        wrap.querySelector("#f_nit").value = C.normalizarDocumentoTributario(g("nit"), g("pais"));
        if (!g("nombre") || !g("adminUser") || !g("adminPass")) { U.toast("Completa los campos obligatorios.", "error"); return; }
        if (g("adminUser").indexOf("@") === -1) { U.toast("El usuario del administrador debe ser un correo electrónico válido.", "error"); return; }
        if (g("adminPass").length < 6) { U.toast("La contraseña debe tener al menos 6 caracteres.", "error"); return; }
        var submitBtn = wrap.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = "Creando…";
        var planElegido = BIO_PLANES.porId(g("planId"));
        var tipoContratacion = g("tipoContratacion");
        var esMembresia = tipoContratacion === "membresia_gratis";
        var esPrueba = tipoContratacion === "prueba_gratis";
        var cicloCobroDias = parseInt(g("cicloCobroDias"), 10) || 30;
        var mesesMembresia = parseInt(g("mesesMembresia"), 10) || 6;
        var hoy = new Date();
        var finPrueba = new Date(hoy.getTime() + BIO_PLANES.DIAS_PRUEBA_GRATIS * 864e5);
        S.provisionRealAccount({
          tenantData: {
            nombre: g("nombre"), nit: g("nit"), pais: g("pais"), direccion: g("direccion"), telefonos: g("telefonos"), telefonoFijo: g("telefonoFijo"), email: g("email"), nivel: parseInt(g("nivel"), 10),
            contactoNombre: g("adminNombre"),
            planId: planElegido ? planElegido.id : null, maxUsuarios: planElegido ? planElegido.limiteUsuarios : null,
            cicloCobroDias: (esMembresia || esPrueba) ? null : cicloCobroDias, mesesMembresiaGratis: esMembresia ? mesesMembresia : null,
            esPruebaGratis: esPrueba,
            fechaInicioPrueba: esPrueba ? hoy.toISOString().slice(0, 10) : null,
            fechaFinPrueba: esPrueba ? finPrueba.toISOString().slice(0, 10) : null
          },
          userData: { username: g("adminUser"), password: g("adminPass"), nombre: g("adminNombre"), rol: "admin", secciones: [] }
        }).then(function (res) {
          U.toast(esPrueba
            ? "Laboratorio creado en prueba gratis de " + BIO_PLANES.DIAS_PRUEBA_GRATIS + " días. Clave de administrador para correcciones: " + res.tenant.claveAdmin
            : "Laboratorio creado. Clave de administrador para correcciones: " + res.tenant.claveAdmin, "success");
          U.closeModal(wrap);
          cargar();
          sincronizarConCRM(res.tenant).catch(function (err) { console.error("BIOsoft: no se pudo sincronizar con el CRM ->", err); });
          abrirBienvenidaLaboratorio(res.tenant, { username: g("adminUser"), password: g("adminPass") }, function () {
            if (planElegido && !esPrueba) abrirEnviarContrato(res.tenant);
          });
        }).catch(function (err) {
          submitBtn.disabled = false; submitBtn.textContent = "Crear Laboratorio";
          var msg = (err && err.code === "auth/email-already-in-use") ? "Ese correo ya tiene una cuenta." : (err && err.message) || "No se pudo crear el laboratorio.";
          U.toast(msg, "error");
        });
      });
    }
    cargar();
    unsubTenants = S.tenantsGlobal.watch(function () { cargar(); });
  };
})();

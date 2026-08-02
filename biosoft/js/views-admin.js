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
      return "<tr><td><b>" + U.esc(u.nombre) + "</b>" + (contacto ? "<div class='text-muted' style='font-size:11px'>" + U.esc(contacto) + "</div>" : "") + "</td><td>" + U.esc(u.username) + "</td><td>" + U.esc(C.rolLabel(u.rol, tenant && tenant.pais)) + "</td>" +
        "<td>" + (u.secciones && u.secciones.length ? u.secciones.map(function (s) { return C.seccionNombre(s); }).join(", ") : "—") + "</td>" +
        "<td>" + (u.activo ? '<span class="badge badge-validado">Activo</span>' : '<span class="badge badge-pendiente">Inactivo</span>') + "</td>" +
        '<td><div class="flex gap-2"><button class="btn btn-ghost btn-sm" data-edit="' + u.id + '">' + U.icon("edit") + " Editar</button>" +
        '<button class="btn btn-outline btn-sm" data-toggle="' + u.id + '">' + (u.activo ? "Desactivar" : "Activar") + "</button></div></td></tr>";
    }

    function openForm(user) {
      var isEdit = !!user;
      user = user || { rol: "bacteriologo", secciones: [], activo: true };
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
            F.sel("rol", "Rol", ["admin", "bacteriologo", "recepcion"].map(function (r) { return '<option value="' + r + '" ' + (r === user.rol ? "selected" : "") + ">" + U.esc(C.rolLabel(r, tenant && tenant.pais)) + "</option>"; }).join("")) +
          "</div>" +
          '<div id="secciones-box" class="field"></div>' +
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
        if (rol !== "bacteriologo") { box.innerHTML = ""; return; }
        box.innerHTML = "<label>Secciones que puede capturar y validar</label><div class='form-grid'>" +
          C.SECCIONES.map(function (s) {
            var checked = (user.secciones || []).indexOf(s.id) !== -1;
            return '<div class="checkbox-row"><input type="checkbox" data-sec="' + s.id + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + s.nombre + "</label></div>";
          }).join("") + "</div>";
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
      wrap.querySelector("#f_rol").addEventListener("change", function () { renderSecciones(); renderFirma(); });
      renderSecciones();
      renderFirma();

      wrap.querySelector("#user-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        var secciones = Array.prototype.slice.call(wrap.querySelectorAll("[data-sec]:checked")).map(function (c) { return c.dataset.sec; });
        var data = {
          nombre: g("nombre"), numeroDocumento: g("numeroDocumento"), correoContacto: g("correoContacto"), telefonoContacto: g("telefonoContacto"),
          username: g("username"), rol: g("rol"), secciones: secciones, tenantId: session.tenantId, activo: true
        };
        var pass = g("password");
        if (pass) data.password = pass;
        if (data.rol === "bacteriologo" || data.rol === "admin") {
          data.registroProfesional = g("registroProfesional");
          data.firmaDataUrl = firmaTemp;
        }
        if (!data.nombre || !data.username || (!isEdit && !pass)) { U.toast("Completa nombre, usuario y contraseña.", "error"); return; }
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
    var orden = (tenant.ordenExamenes && tenant.ordenExamenes.length) ? tenant.ordenExamenes.slice() : C.EXAMENES.map(function (e) { return e.id; });
    C.EXAMENES.forEach(function (e) { if (orden.indexOf(e.id) === -1) orden.push(e.id); });
    var seccionId = C.examenPorId(examId).seccion;
    var idsSeccion = orden.filter(function (id) { var ex = C.examenPorId(id); return ex && ex.seccion === seccionId; });
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

    function build() {
      tenant = S.getTenant(session.tenantId);
      var exams = C.EXAMENES.filter(function (e) {
        var okSec = filtroSeccion === "todas" || e.seccion === filtroSeccion;
        var okBusq = !busqueda || U.normalizar(e.nombre).indexOf(U.normalizar(busqueda)) !== -1 || e.cups.indexOf(busqueda) !== -1;
        return okSec && okBusq;
      });
      // El orden de exámenes solo tiene sentido dentro de una sección
      // específica (así se agrupan en el PDF y en captura de resultados),
      // por eso las flechas de mover solo aparecen con una sección elegida.
      var permiteOrdenar = filtroSeccion !== "todas" && !busqueda;
      if (permiteOrdenar) exams = C.ordenarPorExamen(exams, tenant, function (e) { return e.id; });
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Valores de Referencia del Catálogo</h3></div>' +
        '<p class="text-muted" style="margin-top:0">Cada laboratorio puede usar equipos o metodologías distintas, por lo que los valores normales pueden variar. Ajusta aquí los rangos de tu laboratorio sin afectar el catálogo general de BIOsoft; los cambios se aplican de inmediato en la captura de resultados y en los informes. Elige una sección específica para poder ordenar tus exámenes como los trabajas normalmente.</p>' +
        '<div class="flex gap-2 wrap" style="margin-bottom:14px">' +
        '<input id="cat-busqueda" placeholder="Buscar examen por nombre o código CUPS…" style="max-width:320px" value="' + U.esc(busqueda) + '"/>' +
        '<select id="cat-seccion"><option value="todas">Todas las secciones</option>' + C.SECCIONES.map(function (s) { return '<option value="' + s.id + '" ' + (s.id === filtroSeccion ? "selected" : "") + ">" + s.nombre + "</option>"; }).join("") + "</select>" +
        "</div>" +
        '<div class="table-wrap"><table><thead><tr>' + (permiteOrdenar ? "<th></th>" : "") + '<th>Examen</th><th>Sección</th><th># Parámetros</th><th>Estado</th><th></th></tr></thead><tbody>' +
        (exams.length ? exams.map(function (e, i) { return rowHtml(e, i, exams.length, permiteOrdenar); }).join("") : '<tr><td colspan="' + (permiteOrdenar ? 6 : 5) + '" class="text-muted">Sin resultados.</td></tr>') +
        "</tbody></table></div></div>";

      document.getElementById("cat-busqueda").addEventListener("input", function (e) { busqueda = e.target.value; build(); });
      document.getElementById("cat-seccion").addEventListener("change", function (e) { filtroSeccion = e.target.value; build(); });
      root.querySelectorAll("[data-editexam]").forEach(function (b) { b.addEventListener("click", function () { openExamEditor(b.dataset.editexam, build); }); });
      root.querySelectorAll("[data-mover]").forEach(function (b) {
        b.addEventListener("click", function () {
          var nuevoOrden = moverExamen(tenant, b.dataset.mover, parseInt(b.dataset.dir, 10));
          S.updateTenant(tenant.id, { ordenExamenes: nuevoOrden });
          build();
        });
      });
    }

    function rowHtml(e, i, total, permiteOrdenar) {
      var personalizado = C.tieneOverride(e.id, tenant);
      return "<tr>" +
        (permiteOrdenar ? "<td><div class='flex gap-2'>" +
          '<button class="btn btn-ghost btn-sm" data-mover="' + e.id + '" data-dir="-1" ' + (i === 0 ? "disabled" : "") + ' title="Subir">▲</button>' +
          '<button class="btn btn-ghost btn-sm" data-mover="' + e.id + '" data-dir="1" ' + (i === total - 1 ? "disabled" : "") + ' title="Bajar">▼</button>' +
          "</div></td>" : "") +
        "<td>" + U.esc(e.nombre) + "<div class='text-muted' style='font-size:11px'>CUPS " + e.cups + "</div></td><td>" + C.seccionNombre(e.seccion) + "</td><td>" + e.parametros.length + "</td>" +
        "<td>" + (personalizado ? '<span class="badge badge-preliminar">Personalizado</span>' : '<span class="text-muted">Valores de fábrica</span>') + "</td>" +
        '<td><button class="btn btn-outline btn-sm" data-editexam="' + e.id + '">' + U.icon("edit") + " Editar</button></td></tr>";
    }
    build();
  };

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
    var exCat = C.examenPorId(examId);
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
      var nombreHtml = U.esc(p.nombre) + (esDeFabrica ? "" : ' <span class="badge badge-preliminar" style="font-size:9px">Personalizado</span>');

      if (p.tipo === "numerico") {
        var overNum = base && (p.min !== base.min || p.max !== base.max || p.refText !== base.refText);
        return '<tr data-prow="' + p.codigo + '">' +
          "<td>" + moverHtml + "</td>" +
          "<td>" + nombreHtml + '<div class="text-muted" style="font-size:11px">' + (p.unidad || "") + "</div></td>" +
          '<td><input type="number" step="any" data-min value="' + p.min + '" style="width:90px"/></td>' +
          '<td><input type="number" step="any" data-max value="' + p.max + '" style="width:90px"/></td>' +
          '<td><input data-reftext value="' + U.esc(p.refText) + '"/></td>' +
          '<td class="text-muted" style="font-size:11px">' + (esDeFabrica ? "Fábrica: " + base.min + " - " + base.max : "—") + "</td>" +
          "<td><div class='flex gap-1 wrap'>" + (overNum ? '<button type="button" class="btn btn-ghost btn-sm" data-reset="' + p.codigo + '">Restablecer</button>' : "") + quitarHtml + "</div></td></tr>";
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
      return '<tr data-prow="' + p.codigo + '">' +
        "<td>" + moverHtml + "</td>" +
        "<td>" + nombreHtml + '</td><td colspan="3" class="text-muted">Campo de texto libre (sin valores de referencia numéricos)</td>' +
        "<td>" + quitarHtml + "</td></tr>";
    }

    var wrap = U.openModal(
      '<h3 class="modal-title">Valores de Referencia — ' + U.esc(exCat.nombre) + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Sección: ' + C.seccionNombre(exCat.seccion) + " · CUPS " + exCat.cups + " — reordena los campos con ▲▼, quita los que no uses o agrega uno propio, tal como lo trabajas en tu laboratorio.</p>" +
      '<div class="table-wrap"><table><thead><tr><th></th><th>Parámetro</th><th>Mínimo</th><th>Máximo</th><th>Texto de referencia</th><th>Original</th><th></th></tr></thead><tbody>' +
      efectivo.parametros.map(function (p, idx) { return paramRow(p, idx, efectivo.parametros.length); }).join("") +
      "</tbody></table></div>" +
      (ocultos.length ? '<div style="margin-top:10px"><p class="text-muted" style="margin:0 0 6px;font-size:12.5px">Campos ocultos en tu laboratorio:</p><div class="flex gap-2 wrap">' +
        ocultos.map(function (o) { return '<span class="chip">' + U.esc(o.nombre) + ' <button type="button" class="btn btn-ghost btn-sm" data-mostrar-campo="' + o.codigo + '" style="padding:2px 6px">Mostrar de nuevo</button></span>'; }).join("") +
        "</div></div>" : "") +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-agregar-campo" style="margin-top:12px">' + U.icon("plus") + " Agregar Campo Personalizado</button>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cerrar</button><button class="btn btn-primary" id="cat-guardar">' + U.icon("check") + " Guardar Cambios</button></div>",
      { lg: true }
    );

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

    wrap.querySelector("#btn-agregar-campo").addEventListener("click", function () { abrirAgregarCampo(tenant, examId, exCat, reabrir); });

    wrap.querySelector("#cat-guardar").addEventListener("click", function () {
      var cambios = 0;
      efectivo.parametros.forEach(function (p) {
        var row = wrap.querySelector('[data-prow="' + p.codigo + '"]');
        if (!row) return;
        var base = origenDeCampo(exCat, custom, p.codigo);
        if (p.tipo === "numerico") {
          var min = parseFloat(row.querySelector("[data-min]").value);
          var max = parseFloat(row.querySelector("[data-max]").value);
          var refText = row.querySelector("[data-reftext]").value.trim();
          if (isNaN(min) || isNaN(max)) return;
          if (base && min === base.min && max === base.max && refText === base.refText) { C.clearOverride(tenant, examId, p.codigo); return; }
          C.setOverride(tenant, examId, p.codigo, { min: min, max: max, refText: refText || (min + " - " + max + " " + (p.unidad || "")) });
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
      S.updateTenant(tenant.id, { refOverrides: tenant.refOverrides || {} });
      S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_REF_RANGE", "catalogo", examId, "Actualizó valores de referencia de " + exCat.nombre + " (" + cambios + " parámetro(s) personalizado(s)).");
      U.toast("Valores de referencia guardados para tu laboratorio.", "success");
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
      F.sel("tipo", "Tipo de Campo", '<option value="numerico">Numérico (con rango de referencia)</option><option value="cualitativo">Cualitativo (opciones, ej: Positivo/Negativo)</option><option value="descriptivo">Descriptivo (texto libre)</option>') +
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
  // CONFIGURACIÓN DEL LABORATORIO
  // ------------------------------------------------------------------
  window.BIO_VIEWS.config = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = S.getTenant(session.tenantId);
    var logoTemp = tenant.logoDataUrl;

    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">📘 Manual de Usuario del Sistema</h3></div>' +
      '<p class="text-muted" style="margin-top:0">Guía paso a paso de cada módulo, con el logo y los colores de ' + U.esc(tenant.nombre || "tu laboratorio") + '. Ideal para capacitar a tu equipo o enviarla a un colaborador nuevo.</p>' +
      '<div class="flex gap-2 wrap">' +
      '<button type="button" class="btn btn-outline" id="btn-manual-descargar">' + U.icon("download") + ' Descargar PDF</button>' +
      '<button type="button" class="btn btn-primary" id="btn-manual-enviar">' + U.icon("send") + ' Enviar por WhatsApp o Correo</button>' +
      "</div></div>" +
      '<div class="card"><div class="card-header"><h3 class="card-title">Identidad y Datos del Laboratorio</h3></div>' +
      '<form id="cfg-form">' +
        '<div class="form-grid">' +
          F.inp("nombre", "Nombre del Laboratorio", tenant.nombre, true) +
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
        "</div>" +
        '<p class="text-muted" style="margin:6px 0 0;font-size:12.5px">Ajusta aquí el color del texto del menú, de los títulos de cada sección (como "Identidad y Datos del Laboratorio") y de los subtítulos de cada recuadro (como "Marca e Identidad Visual") — todo se actualiza al instante en esta misma pantalla para que veas cómo queda antes de guardar.</p>' +
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
      tenant.nombre = g("nombre"); tenant.nit = C.normalizarDocumentoTributario(g("nit"), g("pais")); tenant.pais = g("pais"); tenant.direccion = g("direccion");
      tenant.telefonos = g("telefonos"); tenant.email = g("email"); tenant.sitioWeb = g("sitioWeb");
      tenant.resolucionHabilitacion = g("resolucionHabilitacion"); tenant.codigoREPS = g("codigoREPS"); tenant.nivel = parseInt(g("nivel"), 10);
      tenant.bacteriologoResponsable = { nombre: g("bactNombre"), registro: g("bactRegistro") };
      tenant.colorPrimario = document.getElementById("f_colorPrimario").value;
      tenant.colorSecundario = document.getElementById("f_colorSecundario").value;
      tenant.colorTextoMenu = document.getElementById("f_colorTextoMenu").value;
      tenant.colorTitulos = document.getElementById("f_colorTitulos").value;
      tenant.colorSubtitulos = document.getElementById("f_colorSubtitulos").value;
      tenant.logoDataUrl = logoTemp;

      var claveActual = g("claveActual"), claveNueva = g("claveNueva");
      if (claveNueva) {
        if (claveActual !== tenant.claveAdmin) { U.toast("La clave actual de administrador no coincide.", "error"); return; }
        tenant.claveAdmin = claveNueva;
        S.addAudit(session.tenantId, session.nombre, session.rol, "CHANGE_ADMIN_PASSWORD", "laboratorio", tenant.id, "Cambió la clave de administrador del laboratorio.");
      }

      var patch = {
        nombre: tenant.nombre, nit: tenant.nit, pais: tenant.pais, direccion: tenant.direccion,
        telefonos: tenant.telefonos, email: tenant.email, sitioWeb: tenant.sitioWeb,
        resolucionHabilitacion: tenant.resolucionHabilitacion, codigoREPS: tenant.codigoREPS, nivel: tenant.nivel,
        bacteriologoResponsable: tenant.bacteriologoResponsable,
        colorPrimario: tenant.colorPrimario, colorSecundario: tenant.colorSecundario, colorTextoMenu: tenant.colorTextoMenu,
        colorTitulos: tenant.colorTitulos, colorSubtitulos: tenant.colorSubtitulos, logoDataUrl: tenant.logoDataUrl
      };
      if (claveNueva) patch.claveAdmin = tenant.claveAdmin;
      S.updateTenant(tenant.id, patch);
      S.addAudit(session.tenantId, session.nombre, session.rol, "CONFIG_CHANGE", "laboratorio", tenant.id, "Actualizó la configuración e identidad visual del laboratorio.");
      BIO_UI.applyTenantTheme(tenant);
      BIO_ROUTER.renderShell();
      U.toast("Configuración guardada.", "success");
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
          return "<tr><td><b>" + U.esc(t.nombre) + "</b><div class='text-muted' style='font-size:11px'>" + U.esc(C.documentoTributarioLabel(t.pais)) + " " + U.esc(t.nit || "—") + "</div></td><td>" + t.pais + "</td>" +
            "<td>" + (plan ? U.esc(plan.nombre) : '<span class="text-muted">Sin asignar</span>') + "</td>" +
            "<td><span class='badge " + estadoInfo.badge + "'>" + estadoInfo.label + "</span>" +
            (necesitaRecordatorio ? ' <button class="btn btn-ghost btn-sm" data-recordar-pago="' + t.id + '" title="Recordar pago por WhatsApp">' + U.icon("send") + "</button>" : "") + "</td>" +
            "<td>" + (t.fechaProximoPago ? U.fmtFechaCorta(t.fechaProximoPago) : "—") + "</td>" +
            "<td>" + (sobreLimite ? '<span class="badge badge-urgente">' + usuariosTxt + '</span>' : usuariosTxt) + "</td>" +
            '<td><div class="flex gap-2 wrap">' +
            '<button class="btn btn-ghost btn-sm" data-editar-plan="' + t.id + '">' + U.icon("edit") + " Plan</button>" +
            '<button class="btn btn-ghost btn-sm" data-editar-datos="' + t.id + '">' + U.icon("edit") + " Datos</button>" +
            '<button class="btn btn-outline btn-sm" data-enviar-contrato="' + t.id + '">' + U.icon("file") + " Contrato</button>" +
            '<button class="btn btn-outline btn-sm" data-enviar-manual="' + t.id + '">' + U.icon("send") + " Manual</button>" +
            '<button class="btn btn-outline btn-sm" data-reenviar-acceso="' + t.id + '" title="Recordar el link de ingreso y el usuario al administrador">' + U.icon("send") + " Reenviar Acceso</button>" +
            '<button class="btn btn-ghost btn-sm" data-sync-crm="' + t.id + '" title="Crear/vincular este laboratorio en el CRM">' + U.icon("send") + " CRM</button>" +
            "</div></td></tr>";
        }).join("") : '<tr><td colspan="7" class="text-muted">Aún no hay laboratorios cliente creados.</td></tr>') + "</tbody></table></div></div>";
      document.getElementById("btn-new-tenant").addEventListener("click", openNewTenant);
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
        S.updateTenant(tenant.id, {
          planId: tenant.planId, maxUsuarios: tenant.maxUsuarios, fechaInicioPlan: tenant.fechaInicioPlan,
          fechaProximoPago: tenant.fechaProximoPago, cicloCobroDias: tenant.cicloCobroDias,
          mesesMembresiaGratis: tenant.mesesMembresiaGratis, mesesCortesia: tenant.mesesCortesia,
          suspendido: tenant.suspendido, fechaSuspension: tenant.fechaSuspension
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
            F.sel("tipoContratacion", "Tipo de contratación", "<option value='mensual'>Pago mes a mes (implementación fraccionada)</option><option value='membresia_gratis'>Membresía gratis de una vez (sin implementación)</option>") +
            '<div class="field" id="nt-ciclo-box"><label>Ciclo de cobro (días)</label><input type="number" id="f_cicloCobroDias" min="1" value="30"/></div>' +
            '<div class="field hidden" id="nt-meses-box"><label>Meses de membresía gratis</label><input type="number" id="f_mesesMembresia" min="1" value="6"/></div>' +
          "</div></fieldset>" +
          '<div class="flex gap-2 justify-between"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Crear Laboratorio</button></div>" +
        "</form>", { lg: true }
      );
      actualizarLabelDocumento(wrap, "pais", "nit");
      wrap.querySelector("#f_pais").addEventListener("change", function () { actualizarLabelDocumento(wrap, "pais", "nit"); });
      wrap.querySelector("#f_tipoContratacion").addEventListener("change", function () {
        var esMembresia = this.value === "membresia_gratis";
        wrap.querySelector("#nt-ciclo-box").classList.toggle("hidden", esMembresia);
        wrap.querySelector("#nt-meses-box").classList.toggle("hidden", !esMembresia);
      });
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
        var esMembresia = g("tipoContratacion") === "membresia_gratis";
        var cicloCobroDias = parseInt(g("cicloCobroDias"), 10) || 30;
        var mesesMembresia = parseInt(g("mesesMembresia"), 10) || 6;
        S.provisionRealAccount({
          tenantData: {
            nombre: g("nombre"), nit: g("nit"), pais: g("pais"), direccion: g("direccion"), telefonos: g("telefonos"), telefonoFijo: g("telefonoFijo"), email: g("email"), nivel: parseInt(g("nivel"), 10),
            contactoNombre: g("adminNombre"),
            planId: planElegido ? planElegido.id : null, maxUsuarios: planElegido ? planElegido.limiteUsuarios : null,
            cicloCobroDias: esMembresia ? null : cicloCobroDias, mesesMembresiaGratis: esMembresia ? mesesMembresia : null
          },
          userData: { username: g("adminUser"), password: g("adminPass"), nombre: g("adminNombre"), rol: "admin", secciones: [] }
        }).then(function (res) {
          U.toast("Laboratorio creado. Clave de administrador para correcciones: " + res.tenant.claveAdmin, "success");
          U.closeModal(wrap);
          cargar();
          sincronizarConCRM(res.tenant).catch(function (err) { console.error("BIOsoft: no se pudo sincronizar con el CRM ->", err); });
          abrirBienvenidaLaboratorio(res.tenant, { username: g("adminUser"), password: g("adminPass") }, function () {
            if (planElegido) abrirEnviarContrato(res.tenant);
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

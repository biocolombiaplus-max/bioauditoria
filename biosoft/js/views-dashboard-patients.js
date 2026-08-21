/* BIOsoft — Vistas: Dashboard y Pacientes */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  // ------------------------------------------------------------------
  // DASHBOARD
  // ------------------------------------------------------------------
  window.BIO_VIEWS.dashboard = function (root) {
    var session = BIO_AUTH.getSession();

    if (session.rol === "superadmin") {
      buildSuperadminDashboard(root);
      return;
    }

    var tenantId = session.tenantId;
    var tenant = S.getTenant(tenantId);
    var patients = S.listPatients(tenantId);
    var orders = S.listOrders(tenantId);
    var todayStr = new Date().toISOString().slice(0, 10);
    var ordersToday = orders.filter(function (o) { return o.fechaOrden.slice(0, 10) === todayStr; });

    var pendItems = [];
    orders.forEach(function (o) {
      o.examenes.forEach(function (ex) {
        if (ex.estado === "pendiente" || ex.estado === "en_proceso") {
          if (session.rol !== "bacteriologo" || session.secciones.indexOf(ex.seccion) !== -1) {
            pendItems.push({ order: o, ex: ex });
          }
        }
      });
    });
    var validadosHoy = 0;
    orders.forEach(function (o) { o.examenes.forEach(function (ex) { if (ex.estado === "validado" && ex.fechaValidacion && ex.fechaValidacion.slice(0, 10) === todayStr) validadosHoy++; }); });

    var html = '<div class="kpi-grid">';
    if (session.rol !== "bacteriologo") {
      html += kpi(patients.length, "Pacientes Registrados") + kpi(ordersToday.length, "Órdenes de Hoy");
    }
    html += kpi(pendItems.length, session.rol === "bacteriologo" ? "Pendientes en Mis Secciones" : "Exámenes Pendientes por Validar") + kpi(validadosHoy, "Validados Hoy");
    html += "</div>";

    html += '<div class="card">' +
      '<div class="card-header"><h3 class="card-title">' + (session.rol === "bacteriologo" ? "Mi bandeja de trabajo" : "Órdenes recientes") + '</h3>' +
      '<a class="btn btn-outline btn-sm" data-route="resultados">Ir a Resultados</a></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Examen</th><th>Sección</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>';

    var rows = session.rol === "bacteriologo" ? pendItems.slice(0, 8) : orders.slice(0, 8).map(function (o) { return { order: o, ex: o.examenes[0] }; });
    if (!rows.length) html += '<tr><td colspan="6" class="text-muted">Sin registros por ahora.</td></tr>';
    rows.forEach(function (r) {
      var pac = S.getPatient(r.order.patientId);
      html += "<tr><td>" + r.order.numeroOrden + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + (r.ex ? U.esc(C.examenEfectivo(r.ex.examId, tenant).nombre) : "Varios") + "</td><td>" + (r.ex ? C.seccionNombre(r.ex.seccion, tenant) : "") + "</td><td>" + badgeEstado(r.order.estadoGeneral) + "</td><td>" + U.fmtFechaCorta(r.order.fechaOrden) + "</td></tr>";
    });
    html += "</tbody></table></div></div>";

    root.innerHTML = html;
    root.querySelectorAll("[data-route]").forEach(function (a) { a.addEventListener("click", function () { location.hash = "#/" + a.dataset.route; }); });
  };

  function buildSuperadminDashboard(root) {
    var tenants = [];
    var cargando = true;
    root.innerHTML = '<div class="card"><p class="text-muted">Cargando resumen…</p></div>';

    function cargar() {
      S.tenantsGlobal.list().then(function (list) {
        tenants = list;
        cargando = false;
        render();
      }).catch(function (err) {
        cargando = false;
        console.error("BIOsoft: no se pudo cargar el resumen global ->", err.code, err.message);
        root.innerHTML = '<div class="card"><p class="text-muted">No se pudo cargar el resumen: ' + U.esc(err.message || String(err)) + '</p></div>';
      });
    }

    function render() {
      if (cargando) return;
      var porEstado = { activo: [], por_vencer: [], vencido: [], suspendido: [], sin_fecha: [] };
      tenants.forEach(function (t) {
        var e = BIO_PLANES.estadoCuenta(t);
        (porEstado[e] || porEstado.sin_fecha).push(t);
      });
      var totalPacientes = tenants.reduce(function (a, t) { return a + (t._pacientes || 0); }, 0);
      var totalOrdenes = tenants.reduce(function (a, t) { return a + (t._ordenes || 0); }, 0);
      var urgentes = porEstado.vencido.concat(porEstado.por_vencer);

      root.innerHTML =
        '<div class="kpi-grid">' +
          kpi(tenants.length, "Laboratorios Cliente") +
          kpi(totalPacientes, "Pacientes (todos los clientes)") +
          kpi(totalOrdenes, "Órdenes Totales") +
          kpi(porEstado.suspendido.length, "Suspendidos") +
        '</div>' +
        '<div class="kpi-grid">' +
          kpi(porEstado.activo.length, "Al Día") +
          kpi(porEstado.por_vencer.length, "Por Vencer (≤" + BIO_PLANES.DIAS_AVISO_VENCIMIENTO + " días)") +
          kpi(porEstado.vencido.length, "Vencidos") +
          kpi(porEstado.sin_fecha.length, "Sin Fecha de Pago") +
        '</div>' +
        (urgentes.length ?
          '<div class="card"><div class="card-header"><h3 class="card-title">⚠️ Requieren seguimiento de pago (' + urgentes.length + ')</h3>' +
          '<a class="btn btn-outline btn-sm" data-route="tenants">Ir a Laboratorios Cliente</a></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Laboratorio</th><th>Plan</th><th>Estado</th><th>Próximo pago</th><th></th></tr></thead><tbody>' +
          urgentes.map(function (t) {
            var plan = BIO_PLANES.porId(t.planId);
            var info = BIO_PLANES.ESTADOS_CUENTA[BIO_PLANES.estadoCuenta(t)];
            return "<tr><td><b>" + U.esc(t.nombre) + "</b></td><td>" + (plan ? U.esc(plan.nombre) : "—") + "</td>" +
              "<td><span class='badge " + info.badge + "'>" + info.label + "</span></td>" +
              "<td>" + (t.fechaProximoPago ? U.fmtFechaCorta(t.fechaProximoPago) : "—") + "</td>" +
              "<td><button class='btn btn-whatsapp btn-sm' data-recordar='" + t.id + "'>" + U.icon("send") + " Recordar</button></td></tr>";
          }).join("") + "</tbody></table></div></div>"
          : '<div class="card"><h3 class="card-title">✅ Todos tus laboratorios cliente están al día con el pago</h3></div>') +
        '<div class="card"><div class="card-header"><h3 class="card-title">Bienvenido a la consola de BIOsoft</h3></div>' +
        '<p class="text-muted">Desde <b>Laboratorios Cliente</b> puedes crear un nuevo laboratorio, asignar su plan, enviarle el contrato y el manual de usuario, y hacer seguimiento a sus fechas de pago.</p></div>';

      root.querySelectorAll("[data-route]").forEach(function (a) { a.addEventListener("click", function () { location.hash = "#/" + a.dataset.route; }); });
      root.querySelectorAll("[data-recordar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var t = tenants.filter(function (x) { return x.id === b.dataset.recordar; })[0];
          var plan = BIO_PLANES.porId(t.planId);
          var numero = (t.telefonos || "").replace(/\D/g, "");
          if (!numero) { U.toast("Este laboratorio no tiene un número de WhatsApp registrado.", "error"); return; }
          var msg = "Hola 👋 Te escribimos de BIOsoft: la mensualidad de " + (plan ? "tu Plan " + plan.nombre : "tu plan") + " en " + t.nombre +
            (t.fechaProximoPago ? " vence el " + U.fmtFechaCorta(t.fechaProximoPago) : " está próxima a vencer") + ". ¿Te ayudamos a coordinar el pago?";
          window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(msg), "_blank");
        });
      });
    }

    cargar();
  }

  function kpi(value, label) {
    return '<div class="kpi"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + label + '</div></div>';
  }

  function badgeEstado(estado) {
    var labels = { pendiente: "Pendiente", parcial: "Parcial", preliminar: "Preliminar", validado: "Validado", remitido: "Remitido" };
    var clases = { remitido: "enviado" };
    return '<span class="badge badge-' + (clases[estado] || estado) + '">' + (labels[estado] || estado) + "</span>";
  }
  window.BIO_badgeEstado = badgeEstado;

  // ------------------------------------------------------------------
  // PACIENTES
  // ------------------------------------------------------------------
  window.BIO_VIEWS.pacientes = function (root) {
    var session = BIO_AUTH.getSession();
    renderList("");

    function renderList(filter) {
      var patients = S.listPatients(session.tenantId).filter(function (p) {
        if (!filter) return true;
        var f = filter.toLowerCase();
        return U.nombreCompleto(p).toLowerCase().indexOf(f) !== -1 || p.numeroDocumento.indexOf(f) !== -1;
      });
      root.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3 class="card-title">Pacientes (' + patients.length + ')</h3>' +
          '<div class="flex gap-2"><input id="pac-search" placeholder="Buscar por nombre o documento…" style="width:260px" value="' + U.esc(filter) + '"/>' +
          '<button class="btn btn-primary" id="btn-new-pac">' + U.icon("plus") + ' Nuevo Paciente</button></div></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Nombre</th><th>Edad</th><th>Sexo</th><th>EPS / Seguro</th><th>Ciudad</th><th>Acciones</th></tr></thead><tbody>' +
          (patients.length ? patients.map(rowPatient).join("") : '<tr><td colspan="7" class="text-muted">No hay pacientes registrados. Crea el primero con "Nuevo Paciente".</td></tr>') +
          "</tbody></table></div></div>";

      document.getElementById("btn-new-pac").addEventListener("click", function () { openPatientForm(null, renderList); });
      document.getElementById("pac-search").addEventListener("input", function (e) { renderList(e.target.value); });
      root.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openPatientForm(S.getPatient(b.dataset.edit), function () { renderList(filter); }); }); });
      root.querySelectorAll("[data-neworden]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/ordenes/nueva-" + b.dataset.neworden; }); });
    }

    function rowPatient(p) {
      return "<tr><td>" + p.tipoDocumento + " " + U.esc(p.numeroDocumento) + "</td><td>" + U.esc(U.nombreCompleto(p)) + "</td><td>" + U.calcEdad(p.fechaNacimiento) + "</td><td>" + p.sexo + "</td><td>" + (p.pais === "CO" ? U.esc(p.eps || "—") : "—") + "</td><td>" + U.esc(p.ciudad || "—") + "</td>" +
        '<td><div class="flex gap-2"><button class="btn btn-ghost btn-sm" data-edit="' + p.id + '">' + U.icon("edit") + " Editar</button>" +
        (session.rol !== "bacteriologo" || BIO_AUTH.tienePermisoExtra("ordenes") ? '<button class="btn btn-outline btn-sm" data-neworden="' + p.id + '">' + U.icon("plus") + " Orden</button>" : "") +
        "</div></td></tr>";
    }
  };

  function openPatientForm(patient, onSaved) {
    var session = BIO_AUTH.getSession();
    var isEdit = !!patient;
    // Para un paciente nuevo, el país por defecto es el del propio
    // laboratorio (un laboratorio en Venezuela normalmente registra
    // pacientes venezolanos) — solo si es uno de los que este formulario
    // maneja (CO/VE/EC); cualquier otro país de tenant cae a Colombia, que
    // sigue siendo el valor por defecto de siempre.
    var tenant = BIO_AUTH.currentTenant();
    var paisPorDefecto = tenant && ["CO", "VE", "EC"].indexOf(tenant.pais) !== -1 ? tenant.pais : "CO";
    // El tipo de documento y el tipo de afiliación por defecto también
    // dependen del país: "CC"/"Contributivo" no existen en las listas de
    // Venezuela ni Ecuador, así que se toma el primero de la lista de cada
    // país (la cédula local y la afiliación más común, respectivamente).
    var tipoDocumentoPorDefecto = (C.TIPOS_DOCUMENTO[paisPorDefecto] || [])[0];
    var tipoAfiliacionPorDefecto = (C.TIPOS_AFILIACION[paisPorDefecto] || [])[0];
    // El campo de celular arranca con el indicativo del país del
    // laboratorio (ej. "+58 " en Venezuela) — así, cuando más adelante se
    // envíe un resultado por WhatsApp, el número ya trae el indicativo
    // correcto sin que quien registra el paciente tenga que acordarse de
    // escribirlo a mano.
    patient = patient || {
      pais: paisPorDefecto, tipoDocumento: tipoDocumentoPorDefecto ? tipoDocumentoPorDefecto.v : "CC",
      sexo: "Femenino", tipoAfiliacion: tipoAfiliacionPorDefecto || "Contributivo", procedencia: "Ambulatorio",
      celular: "+" + U.indicativoPais(paisPorDefecto) + " "
    };

    var docOptions = function (pais, current) {
      return (C.TIPOS_DOCUMENTO[pais] || []).map(function (d) { return '<option value="' + d.v + '" ' + (d.v === current ? "selected" : "") + ">" + d.t + "</option>"; }).join("");
    };
    var afilOptions = function (pais, current) {
      return (C.TIPOS_AFILIACION[pais] || []).map(function (a) { return '<option ' + (a === current ? "selected" : "") + ">" + a + "</option>"; }).join("");
    };
    var epsOptions = function (current) {
      return C.EPS_COLOMBIA.map(function (e) { return '<option ' + (e === current ? "selected" : "") + ">" + e + "</option>"; }).join("");
    };

    var wrap = U.openModal(
      '<h3 class="modal-title">' + (isEdit ? "Editar Paciente" : "Nuevo Paciente") + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Registro completo según normativa de habilitación (Colombia / Venezuela / Ecuador).</p>' +
      '<div id="pac-existente-banner" class="hidden" style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px"></div>' +
      '<form id="pac-form">' +
        '<fieldset><legend>País e Identificación</legend><div class="form-grid">' +
          sel("pais", "País", ["CO", "VE", "EC"].map(function (p) { return '<option value="' + p + '" ' + (p === patient.pais ? "selected" : "") + ">" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>"; }).join("")) +
          sel("tipoDocumento", "Tipo de Documento", docOptions(patient.pais, patient.tipoDocumento)) +
          inp("numeroDocumento", "Número de Documento", patient.numeroDocumento, true) +
          inp("fechaNacimiento", "Fecha de Nacimiento", patient.fechaNacimiento, true, "date") +
          sel("sexo", "Sexo Biológico", ["Femenino", "Masculino", "Indeterminado"].map(function (s) { return '<option ' + (s === patient.sexo ? "selected" : "") + ">" + s + "</option>"; }).join("")) +
        "</div></fieldset>" +
        '<fieldset><legend>Nombres</legend><div class="form-grid">' +
          inp("primerNombre", "Primer Nombre", patient.primerNombre, true) + inp("segundoNombre", "Segundo Nombre", patient.segundoNombre) +
          inp("primerApellido", "Primer Apellido", patient.primerApellido, true) + inp("segundoApellido", "Segundo Apellido", patient.segundoApellido) +
        "</div></fieldset>" +
        '<fieldset><legend>Contacto</legend><div class="form-grid">' +
          inp("direccion", "Dirección de Residencia", patient.direccion) + inp("ciudad", "Ciudad / Municipio", patient.ciudad) +
          inp("telefono", "Teléfono Fijo", patient.telefono) + inp("celular", "Celular", patient.celular) +
          inp("email", "Correo Electrónico", patient.email, false, "email") +
        "</div>" +
        '<div class="form-grid" id="co-rips-fields" style="display:' + (patient.pais === "CO" ? "grid" : "none") + '">' +
          sel("zonaResidencial", "Zona de Residencia (RIPS)", C.RIPS_ZONA_RESIDENCIAL.map(function (z) { return '<option value="' + z.v + '" ' + (z.v === patient.zonaResidencial ? "selected" : "") + ">" + z.t + "</option>"; }).join("")) +
          '<div class="field"><label>Código DANE del Municipio (RIPS)</label><input list="dane-list" id="f_codigoMunicipioDane" value="' + U.esc(patient.codigoMunicipioDane || "") + '" placeholder="Ej. 11001 = Bogotá D.C."/><datalist id="dane-list">' +
            C.MUNICIPIOS_DANE_COMUNES.map(function (m) { return '<option value="' + m.cod + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          '</datalist></div>' +
        "</div></fieldset>" +
        '<fieldset><legend>Aseguramiento y Remisión</legend><div class="form-grid">' +
          sel("tipoAfiliacion", "Tipo de Afiliación", afilOptions(patient.pais, patient.tipoAfiliacion)) +
          '<div class="field" id="eps-field" style="display:' + (patient.pais === "CO" ? "block" : "none") + '"><label>EPS / Asegurador / Entidad Responsable de Pago</label><input list="eps-list" id="f_eps" value="' + U.esc(patient.eps || "") + '"/><datalist id="eps-list">' + epsOptions() + "</datalist></div>" +
          inp("medicoRemitente", "Médico que Remite", patient.medicoRemitente) +
          sel("procedencia", "Procedencia", C.PROCEDENCIAS.map(function (p) { return '<option ' + (p === patient.procedencia ? "selected" : "") + ">" + p + "</option>"; }).join("")) +
          inp("ocupacion", "Ocupación", patient.ocupacion) +
        "</div></fieldset>" +
        '<fieldset><legend>Observaciones</legend><textarea id="f_observaciones">' + U.esc(patient.observaciones || "") + "</textarea></fieldset>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px">' +
          '<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Paciente</button>" +
        "</div>" +
      "</form>",
      { lg: true }
    );

    function refreshDependentSelects() {
      var pais = wrap.querySelector("#f_pais").value;
      wrap.querySelector("#f_tipoDocumento").innerHTML = docOptions(pais, patient.tipoDocumento);
      wrap.querySelector("#f_tipoAfiliacion").innerHTML = afilOptions(pais, patient.tipoAfiliacion);
      wrap.querySelector("#co-rips-fields").style.display = pais === "CO" ? "grid" : "none";
      // La EPS es una figura exclusivamente colombiana — para pacientes de
      // otros países ni se pide ni se guarda, para no confundir con un
      // concepto que no aplica ahí.
      var epsField = wrap.querySelector("#eps-field");
      epsField.style.display = pais === "CO" ? "block" : "none";
      if (pais !== "CO") wrap.querySelector("#f_eps").value = "";
      // Si el celular todavía es solo el indicativo (nadie escribió un
      // número encima), lo actualiza al indicativo del país recién elegido
      // — pero nunca toca un número que la persona ya empezó a digitar.
      if (!isEdit) {
        var celInput = wrap.querySelector("#f_celular");
        if (/^\+\d+\s*$/.test(celInput.value.trim())) celInput.value = "+" + U.indicativoPais(pais) + " ";
      }
    }
    wrap.querySelector("#f_pais").addEventListener("change", refreshDependentSelects);

    // Si el paciente ya asistió antes, no hace falta volver a digitar todo:
    // al escribir un número de documento que ya existe en este laboratorio,
    // se precargan sus datos y, al guardar, se actualiza ese mismo registro
    // en vez de crear uno duplicado. Solo aplica en "Nuevo Paciente" — al
    // editar uno ya abierto, esto no se activa.
    var pacienteExistenteId = null;
    function buscarPacienteExistente() {
      if (isEdit) return;
      var tipoDoc = wrap.querySelector("#f_tipoDocumento").value;
      var numDoc = wrap.querySelector("#f_numeroDocumento").value.trim();
      var banner = wrap.querySelector("#pac-existente-banner");
      if (!numDoc) { pacienteExistenteId = null; banner.classList.add("hidden"); return; }
      var encontrado = S.listPatients(session.tenantId).filter(function (p) { return p.numeroDocumento === numDoc && p.tipoDocumento === tipoDoc; })[0];
      if (!encontrado) { pacienteExistenteId = null; banner.classList.add("hidden"); return; }
      pacienteExistenteId = encontrado.id;
      var campos = ["pais", "tipoDocumento", "fechaNacimiento", "sexo", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "direccion", "ciudad", "telefono", "celular", "email", "tipoAfiliacion", "eps", "medicoRemitente", "procedencia", "ocupacion",
        "observaciones", "zonaResidencial", "codigoMunicipioDane"];
      campos.forEach(function (c) {
        var el = wrap.querySelector("#f_" + c);
        if (el && encontrado[c] != null) el.value = encontrado[c];
      });
      refreshDependentSelects();
      wrap.querySelector("#f_tipoDocumento").value = tipoDoc;
      wrap.querySelector("#f_tipoAfiliacion").value = encontrado.tipoAfiliacion || "";
      banner.classList.remove("hidden");
      banner.innerHTML = "✅ <b>" + U.esc(U.nombreCompleto(encontrado)) + "</b> ya está registrado(a) — se cargaron sus datos. Si guardas, se actualiza este mismo registro (no se crea uno duplicado). Revisa que sea la misma persona antes de guardar.";
    }
    wrap.querySelector("#f_numeroDocumento").addEventListener("blur", buscarPacienteExistente);
    wrap.querySelector("#f_tipoDocumento").addEventListener("change", buscarPacienteExistente);

    wrap.querySelector("#pac-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
      var data = {
        tenantId: session.tenantId, pais: g("pais"), tipoDocumento: g("tipoDocumento"), numeroDocumento: g("numeroDocumento"),
        primerNombre: g("primerNombre"), segundoNombre: g("segundoNombre"), primerApellido: g("primerApellido"), segundoApellido: g("segundoApellido"),
        fechaNacimiento: g("fechaNacimiento"), sexo: g("sexo"), direccion: g("direccion"), ciudad: g("ciudad"), telefono: g("telefono"),
        celular: g("celular"), email: g("email"), tipoAfiliacion: g("tipoAfiliacion"), eps: g("eps"), medicoRemitente: g("medicoRemitente"),
        procedencia: g("procedencia"), ocupacion: g("ocupacion"), observaciones: g("observaciones"),
        zonaResidencial: g("zonaResidencial"), codigoMunicipioDane: g("codigoMunicipioDane")
      };
      if (!data.numeroDocumento || !data.primerNombre || !data.primerApellido || !data.fechaNacimiento) {
        U.toast("Completa los campos obligatorios: documento, primer nombre, primer apellido y fecha de nacimiento.", "error");
        return;
      }
      if (isEdit || pacienteExistenteId) {
        var idAActualizar = isEdit ? patient.id : pacienteExistenteId;
        S.updatePatient(idAActualizar, data);
        S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_PATIENT", "paciente", idAActualizar, "Actualizó datos del paciente " + U.nombreCompleto(data));
        U.toast(pacienteExistenteId && !isEdit ? "Ya estaba registrado(a) — se actualizaron sus datos." : "Paciente actualizado.", "success");
        U.closeModal(wrap);
        onSaved();
      } else {
        var created = S.createPatient(Object.assign(data, { creadoPor: session.username }));
        S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_PATIENT", "paciente", created.id, "Registró al paciente " + U.nombreCompleto(data));
        U.toast("Paciente registrado.", "success");
        U.closeModal(wrap);
        onSaved();
        if (created.email) ofrecerCorreoRegistro(created);
      }
    });
  }
  window.BIO_openPatientForm = openPatientForm;

  function ofrecerCorreoRegistro(patient) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var asunto = "Confirmación de Registro — " + tenant.nombre;
    var cuerpo =
      "Estimado(a) " + U.nombreCompleto(patient) + ",\n\n" +
      "Le confirmamos que su registro en " + tenant.nombre + " se realizó exitosamente el " + U.fmtFechaCorta(patient.creadoEn) + ".\n\n" +
      "Datos registrados:\n" +
      "- Documento: " + patient.tipoDocumento + " " + patient.numeroDocumento + "\n" +
      (patient.pais === "CO" ? "- EPS / Asegurador: " + (patient.eps || "Particular") + "\n" : "") +
      "- Médico remitente: " + (patient.medicoRemitente || "—") + "\n\n" +
      "Si su información es correcta, no necesita hacer nada más. Si detecta algún error, por favor respóndanos a este correo o comuníquese con nosotros.\n\n" +
      "Gracias por confiar en " + tenant.nombre + " para el cuidado de su salud.\n\n" +
      "Atentamente,\n" + tenant.nombre + "\n" +
      (tenant.direccion || "") + (tenant.telefonos ? " · " + tenant.telefonos : "") + "\n" +
      (tenant.email || "") + (tenant.sitioWeb ? " · " + tenant.sitioWeb : "");

    var wrap = U.openModal(
      '<h3 class="modal-title">' + U.icon("send") + " Enviar Correo de Confirmación de Registro</h3>" +
      '<p class="text-muted">Elige con qué correo enviar este mensaje profesional ya redactado para <b>' + U.esc(patient.email) + "</b>, confirmando el registro de " + U.esc(U.nombreCompleto(patient)) + " en " + U.esc(tenant.nombre) + ".</p>" +
      '<div class="card" style="background:var(--surface-2);box-shadow:none;font-size:12.5px;white-space:pre-wrap;max-height:260px;overflow-y:auto">' + U.esc(cuerpo) + "</div>" +
      U.emailProviderButtonsHtml("regmail") +
      '<div class="flex gap-2 justify-between" style="margin-top:14px">' +
      '<button class="btn btn-ghost" data-modal-close>Omitir</button>' +
      "</div>",
      { lg: true }
    );
    U.wireEmailProviderButtons(wrap, "regmail", patient.email, asunto, cuerpo);
    wrap.querySelectorAll('[id^="regmail-"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.addAudit(session.tenantId, session.nombre, session.rol, "SEND_REGISTRATION_EMAIL", "paciente", patient.id, "Envió correo de confirmación de registro a " + patient.email + ".");
        U.toast("Correo abierto para enviar la confirmación.", "success");
        U.closeModal(wrap);
      });
    });
  }

  function inp(id, label, value, required, type) {
    return '<div class="field"><label>' + label + (required ? ' *' : '') + '</label><input id="f_' + id + '" type="' + (type || "text") + '" value="' + U.esc(value || "") + '" ' + (type === "number" ? 'step="any"' : "") + " " + (required ? "required" : "") + "/></div>";
  }
  function sel(id, label, optionsHtml) {
    return '<div class="field"><label>' + label + '</label><select id="f_' + id + '">' + optionsHtml + "</select></div>";
  }
  window.BIO_formHelpers = { inp: inp, sel: sel };
})();

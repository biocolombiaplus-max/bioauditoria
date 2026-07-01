/* BIOsoft — Vistas: Órdenes de Laboratorio */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;

  window.BIO_VIEWS.ordenes = function (root, param) {
    if (param && (param === "nueva" || param.indexOf("nueva-") === 0)) {
      var prefillId = param.indexOf("nueva-") === 0 ? param.replace("nueva-", "") : null;
      return renderNewOrder(root, prefillId);
    }
    if (param) return renderOrderDetail(root, param);
    renderList(root);
  };

  function renderList(root) {
    var session = BIO_AUTH.getSession();
    var orders = S.listOrders(session.tenantId);
    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">Órdenes de Laboratorio (' + orders.length + ')</h3>' +
      '<button class="btn btn-primary" id="btn-new-ord">' + U.icon("plus") + ' Nueva Orden</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Fecha</th><th>Prioridad</th><th># Exámenes</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (orders.length ? orders.map(rowOrder).join("") : '<tr><td colspan="7" class="text-muted">No hay órdenes registradas.</td></tr>') +
      "</tbody></table></div></div>";
    document.getElementById("btn-new-ord").addEventListener("click", function () { location.hash = "#/ordenes/nueva"; });
    root.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/ordenes/" + b.dataset.view; }); });
  }

  function rowOrder(o) {
    var pac = S.getPatient(o.patientId);
    return "<tr><td><b>" + o.numeroOrden + "</b></td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + U.fmtFecha(o.fechaOrden) + "</td>" +
      '<td><span class="badge badge-' + (o.prioridad === "Urgente" ? "urgente" : "rutina") + '">' + o.prioridad + "</span></td>" +
      "<td>" + o.examenes.length + "</td><td>" + window.BIO_badgeEstado(o.estadoGeneral) + '</td><td><button class="btn btn-outline btn-sm" data-view="' + o.id + '">Ver</button></td></tr>';
  }

  function renderNewOrder(root, prefillId) {
    var session = BIO_AUTH.getSession();
    var patients = S.listPatients(session.tenantId);
    var selectedExams = []; // {examId}
    var activeSection = C.SECCIONES[0].id;
    var searchTerm = "";

    root.innerHTML =
      '<div class="card">' +
        '<div class="card-header"><h3 class="card-title">Nueva Orden de Laboratorio</h3>' +
        '<a class="btn btn-ghost btn-sm" id="btn-cancel">Cancelar</a></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Paciente *</label><select id="f_patient">' +
            '<option value="">Selecciona un paciente…</option>' +
            patients.map(function (p) { return '<option value="' + p.id + '" ' + (p.id === prefillId ? "selected" : "") + ">" + p.tipoDocumento + " " + p.numeroDocumento + " — " + U.esc(U.nombreCompleto(p)) + "</option>"; }).join("") +
          "</select></div>" +
          F.sel("prioridad", "Prioridad", C.PRIORIDADES.map(function (p) { return "<option>" + p + "</option>"; }).join("")) +
          F.inp("medicoRemitente", "Médico Remitente", "") +
          F.sel("procedencia", "Procedencia", C.PROCEDENCIAS.map(function (p) { return "<option>" + p + "</option>"; }).join("")) +
          F.inp("diagnostico", "Diagnóstico / Motivo", "") +
        "</div>" +
        '<div style="margin:6px 0 10px"><a class="btn btn-outline btn-sm" id="btn-new-patient-inline">' + U.icon("plus") + ' Registrar paciente nuevo</a></div>' +
      "</div>" +

      '<div class="card" style="margin-top:16px">' +
        '<div class="card-header"><h3 class="card-title">Selección de Exámenes</h3><span class="text-muted" id="sel-count">0 seleccionados</span></div>' +
        '<div class="field" style="margin-bottom:12px"><input id="exam-search" placeholder="Buscar examen por nombre o código CUPS en todas las secciones…"/></div>' +
        '<div class="exam-picker">' +
          '<div class="exam-picker-sections" id="sec-list"></div>' +
          '<div class="exam-picker-list" id="exam-list"></div>' +
        "</div>" +
        '<p class="text-muted" style="font-size:11.5px;margin:10px 0 0">' + U.esc(C.CATALOG_DISCLAIMER) + "</p>" +
        '<div class="flex wrap gap-2" id="chips" style="margin-top:14px"></div>' +
      "</div>" +

      '<div class="flex justify-between" style="margin-top:16px">' +
        '<div></div><button class="btn btn-primary" id="btn-save-order">' + U.icon("check") + " Crear Orden</button>" +
      "</div>";

    document.getElementById("btn-cancel").addEventListener("click", function () { location.hash = "#/ordenes"; });
    document.getElementById("btn-new-patient-inline").addEventListener("click", function () {
      window.BIO_openPatientForm(null, function () { location.hash = "#/ordenes/nueva"; BIO_ROUTER.renderRoute(); });
    });
    document.getElementById("exam-search").addEventListener("input", function (e) { searchTerm = e.target.value; renderSections(); renderExams(); });

    function renderSections() {
      document.getElementById("sec-list").innerHTML = C.SECCIONES.map(function (s) {
        var count = selectedExams.filter(function (id) { return C.examenPorId(id).seccion === s.id; }).length;
        return '<div class="sec-item ' + (!searchTerm && s.id === activeSection ? "active" : "") + '" data-sec="' + s.id + '">' + s.nombre + (count ? ' <span class="badge badge-validado" style="margin-left:4px">' + count + "</span>" : "") + "</div>";
      }).join("");
      document.querySelectorAll(".sec-item").forEach(function (el) {
        el.addEventListener("click", function () {
          activeSection = el.dataset.sec; searchTerm = ""; document.getElementById("exam-search").value = "";
          renderSections(); renderExams();
        });
      });
    }

    function renderExams() {
      var term = U.normalizar(searchTerm.trim());
      var pool = term
        ? C.EXAMENES.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : C.EXAMENES.filter(function (e) { return e.seccion === activeSection; });
      var allChecked = pool.length > 0 && pool.every(function (e) { return selectedExams.indexOf(e.id) !== -1; });

      var rowsHtml = pool.map(function (e) {
        var checked = selectedExams.indexOf(e.id) !== -1;
        var tubo = C.tuboInfo(e.tubo);
        return '<label class="exam-row"><input type="checkbox" data-exam="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + C.seccionNombre(e.seccion) + "</span>" : "") + "</div>" +
          '<div class="meta"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + tubo.color + ';margin-right:5px;vertical-align:middle"></span>CUPS ' + e.cups + " · Nivel " + e.nivel + " · " + U.esc(tubo.nombre) + "</div></div></label>";
      }).join("") || '<p class="text-muted" style="padding:14px">Sin resultados para tu búsqueda.</p>';

      document.getElementById("exam-list").innerHTML =
        '<div class="flex justify-between items-center" style="padding:4px 10px 10px">' +
        '<span class="text-muted" style="font-size:11.5px">' + pool.length + " examen(es)</span>" +
        (pool.length ? '<button class="btn btn-ghost btn-sm" id="btn-select-all">' + (allChecked ? "Quitar todos" : "Seleccionar todos") + "</button>" : "") +
        "</div>" + rowsHtml;

      document.querySelectorAll("[data-exam]").forEach(function (chk) {
        chk.addEventListener("change", function () {
          var id = chk.dataset.exam;
          if (chk.checked) selectedExams.push(id); else selectedExams = selectedExams.filter(function (x) { return x !== id; });
          renderChips(); renderSections();
        });
      });
      var btnAll = document.getElementById("btn-select-all");
      if (btnAll) btnAll.addEventListener("click", function () {
        if (allChecked) selectedExams = selectedExams.filter(function (id) { return !pool.some(function (e) { return e.id === id; }); });
        else pool.forEach(function (e) { if (selectedExams.indexOf(e.id) === -1) selectedExams.push(e.id); });
        renderExams(); renderChips(); renderSections();
      });
    }

    function renderChips() {
      document.getElementById("sel-count").textContent = selectedExams.length + " seleccionados";
      document.getElementById("chips").innerHTML = selectedExams.map(function (id) {
        var e = C.examenPorId(id);
        return '<span class="chip">' + U.esc(e.nombre) + ' <button data-remove="' + id + '">' + U.icon("x") + "</button></span>";
      }).join("");
      document.querySelectorAll("[data-remove]").forEach(function (b) {
        b.addEventListener("click", function () {
          selectedExams = selectedExams.filter(function (x) { return x !== b.dataset.remove; });
          renderChips(); renderExams(); renderSections();
        });
      });
    }
    renderSections(); renderExams(); renderChips();

    document.getElementById("btn-save-order").addEventListener("click", function () {
      var patientId = document.getElementById("f_patient").value;
      if (!patientId) { U.toast("Selecciona un paciente.", "error"); return; }
      if (!selectedExams.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
      var order = {
        tenantId: session.tenantId,
        numeroOrden: S.nextOrderNumber(session.tenantId),
        patientId: patientId,
        fechaOrden: new Date().toISOString(),
        prioridad: document.getElementById("f_prioridad").value,
        procedencia: document.getElementById("f_procedencia").value,
        medicoRemitente: document.getElementById("f_medicoRemitente").value,
        diagnostico: document.getElementById("f_diagnostico").value,
        examenes: selectedExams.map(function (id) {
          var exCat = C.examenPorId(id);
          return {
            examId: id, seccion: exCat.seccion, estado: "pendiente", valores: [], observaciones: "",
            validadoPor: "", validadoPorUserId: "", fechaValidacion: "", ingresadoPor: "", fechaIngreso: "", version: 1, correcciones: [],
            remitido: false, laboratorioRemision: "", pdfRemitidoDataUrl: "", pdfRemitidoNombre: ""
          };
        }),
        estadoGeneral: "pendiente", creadoPor: session.username
      };
      var created = S.createOrder(order);
      S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_ORDER", "orden", created.id, "Creó la orden " + created.numeroOrden + " con " + selectedExams.length + " examen(es).");
      U.toast("Orden " + created.numeroOrden + " creada.", "success");
      ofrecerStickers(created);
    });
  }

  function ofrecerStickers(order) {
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_AUTH.currentTenant();
    var wrap = U.openModal(
      '<h3 class="modal-title">Orden ' + order.numeroOrden + " creada</h3>" +
      '<p class="text-muted">¿Deseas imprimir ahora los stickers para rotular los tubos de esta orden?</p>' +
      '<div class="flex gap-2 justify-between">' +
      '<button class="btn btn-ghost" id="btn-skip">Continuar sin imprimir</button>' +
      '<button class="btn btn-primary" id="btn-stickers-now">' + U.icon("printer") + " Imprimir Stickers</button></div>"
    );
    wrap.querySelector("#btn-skip").addEventListener("click", function () { U.closeModal(wrap); location.hash = "#/ordenes/" + order.id; });
    wrap.querySelector("#btn-stickers-now").addEventListener("click", function () {
      U.closeModal(wrap);
      window.BIO_PDF.previewStickers(order, pac, tenant);
      location.hash = "#/ordenes/" + order.id;
    });
  }

  function renderOrderDetail(root, orderId) {
    var session = BIO_AUTH.getSession();
    var order = S.getOrder(orderId);
    if (!order) { root.innerHTML = '<div class="card">Orden no encontrada.</div>'; return; }
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_STORE.getTenant(order.tenantId);

    root.innerHTML =
      '<div class="card">' +
        '<div class="card-header"><h3 class="card-title">Orden ' + order.numeroOrden + " — " + window.BIO_badgeEstado(order.estadoGeneral) + '</h3>' +
        '<div class="flex gap-2 wrap"><a class="btn btn-ghost btn-sm" id="btn-back">Volver</a>' +
        '<button class="btn btn-outline btn-sm" id="btn-stickers">' + U.icon("printer") + " Imprimir Stickers</button>" +
        '<button class="btn btn-outline btn-sm" id="btn-preview">' + U.icon("file") + " Ver / Descargar PDF</button></div></div>" +
        '<div class="form-grid">' +
          field("Paciente", pac ? U.nombreCompleto(pac) + " (" + pac.tipoDocumento + " " + pac.numeroDocumento + ")" : "—") +
          field("Edad / Sexo", (pac ? U.calcEdad(pac.fechaNacimiento) : "—") + " · " + (pac ? pac.sexo : "")) +
          field("EPS / Seguro", pac ? (pac.eps || "—") : "—") +
          field("Médico Remitente", order.medicoRemitente || "—") +
          field("Procedencia", order.procedencia) +
          field("Prioridad", order.prioridad) +
          field("Fecha de Orden", U.fmtFecha(order.fechaOrden)) +
          field("Diagnóstico", order.diagnostico || "—") +
        "</div></div>" +

      '<div class="card" style="margin-top:16px"><div class="card-header"><h3 class="card-title">Exámenes de la Orden</h3></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Examen</th><th>Sección</th><th>Tubo</th><th>Estado</th><th>Validado / Remitido por</th><th>Fecha</th><th></th></tr></thead><tbody>' +
        order.examenes.map(function (ex, idx) {
          var exCat = C.examenPorId(ex.examId);
          var tubo = C.tuboInfo(exCat.tubo);
          return "<tr><td>" + U.esc(exCat.nombre) + "</td><td>" + C.seccionNombre(ex.seccion) + "</td>" +
            '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + tubo.color + ';margin-right:5px;vertical-align:middle"></span>' + U.esc(tubo.nombre) + "</td>" +
            "<td>" + window.BIO_badgeEstado(ex.estado === "en_proceso" ? "pendiente" : ex.estado) + "</td>" +
            "<td>" + (ex.validadoPor || "—") + "</td><td>" + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + "</td>" +
            '<td><button class="btn btn-outline btn-sm" data-goresult="' + idx + '">Ir a captura</button></td></tr>';
        }).join("") +
        "</tbody></table></div></div>";

    document.getElementById("btn-back").addEventListener("click", function () { location.hash = "#/ordenes"; });
    document.getElementById("btn-preview").addEventListener("click", function () { window.BIO_PDF.previewOrModal(order, pac, tenant); });
    document.getElementById("btn-stickers").addEventListener("click", function () { window.BIO_PDF.previewStickers(order, pac, tenant); });
    root.querySelectorAll("[data-goresult]").forEach(function (b) {
      b.addEventListener("click", function () { location.hash = "#/resultados/" + order.id; });
    });
  }

  function field(label, value) {
    return '<div class="field"><label>' + label + "</label><div style='padding:9px 0;font-weight:600'>" + U.esc(value) + "</div></div>";
  }
})();

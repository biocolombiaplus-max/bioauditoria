/* BIOsoft — Vistas: Órdenes de Laboratorio */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;
  function fmtMoneda(n) { return "$" + Math.round(n || 0).toLocaleString("es-CO"); }
  function fmtMonedaEquiv(tenant, n) {
    var extra = C.fmtMonedaAdicional(tenant, n || 0);
    return extra ? ' <span class="text-muted" style="font-size:11px">(' + extra + ')</span>' : "";
  }

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
    var tenant = BIO_AUTH.currentTenant();
    var orders = S.listOrders(session.tenantId);
    var conPrecio = !!(tenant && tenant.mostrarPrecioOrden);
    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">Órdenes de Laboratorio (' + orders.length + ')</h3>' +
      '<button class="btn btn-primary" id="btn-new-ord">' + U.icon("plus") + ' Nueva Orden</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Fecha</th><th>Prioridad</th><th># Exámenes</th>' + (conPrecio ? "<th>Valor a Cobrar</th>" : "") + '<th>Estado</th><th></th></tr></thead><tbody>' +
      (orders.length ? orders.map(function (o) { return rowOrder(o, conPrecio, tenant); }).join("") : '<tr><td colspan="' + (conPrecio ? 8 : 7) + '" class="text-muted">No hay órdenes registradas.</td></tr>') +
      "</tbody></table></div></div>";
    document.getElementById("btn-new-ord").addEventListener("click", function () { location.hash = "#/ordenes/nueva"; });
    root.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/ordenes/" + b.dataset.view; }); });
  }

  function rowOrder(o, conPrecio, tenant) {
    var pac = S.getPatient(o.patientId);
    return "<tr><td><b>" + o.numeroOrden + "</b></td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + U.fmtFecha(o.fechaOrden) + "</td>" +
      '<td><span class="badge badge-' + (o.prioridad === "Urgente" ? "urgente" : "rutina") + '">' + o.prioridad + "</span></td>" +
      "<td>" + o.examenes.length + "</td>" + (conPrecio ? "<td>" + (o.valorCobrar ? fmtMoneda(o.valorCobrar) + fmtMonedaEquiv(tenant, o.valorCobrar) : "—") + "</td>" : "") +
      "<td>" + window.BIO_badgeEstado(o.estadoGeneral) + '</td><td><button class="btn btn-outline btn-sm" data-view="' + o.id + '">Ver</button></td></tr>';
  }

  function renderNewOrder(root, prefillId) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var examenes = C.examenesEfectivos(tenant);
    var secciones = C.seccionesEfectivas(tenant);
    var patients = S.listPatients(session.tenantId);
    var selectedExams = []; // {examId}
    var activeSection = secciones[0].id;
    var searchTerm = "";
    // Precios ya configurados por el laboratorio (Cotizador → Lista de
    // Precios), para sugerir el "Valor a Cobrar" automáticamente según los
    // exámenes que se van marcando, en vez de dejarlo siempre en blanco para
    // digitarlo a mano. Sigue siendo editable: si quien registra la orden lo
    // cambia manualmente, ya no se vuelve a recalcular solo.
    var preciosPorId = {};
    if (tenant.mostrarPrecioOrden) {
      S.cotizador.listPrecios(session.tenantId).forEach(function (p) { preciosPorId[p.examId] = p.precio; });
    }
    var precioEditadoManualmente = false;

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
          (tenant.pais === "CO" ? F.inp("numAutorizacion", "N° de Autorización (si aplica, para RIPS)", "") + F.inp("diagnosticoCIE10", "Código CIE-10 (opcional, para RIPS)", "") : "") +
          (tenant.mostrarPrecioOrden ? '<div class="field"><label>Valor a Cobrar</label><input id="f_valorCobrar" type="number" step="any" value=""/>' +
            '<span class="text-muted" style="font-size:11px" id="valorCobrar-hint">Se calcula solo según los exámenes que selecciones — puedes ajustarlo a mano.</span>' +
            '<span class="text-muted" style="font-size:11px;display:block" id="valorCobrar-equiv"></span></div>' : "") +
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

      '<div style="height:64px"></div>' +
      '<div class="barra-acciones-flotante">' +
        '<button class="btn btn-ghost" id="btn-cancel-bottom">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-save-order">' + U.icon("check") + " Crear Orden</button>" +
      "</div>";

    document.getElementById("btn-cancel").addEventListener("click", function () { location.hash = "#/ordenes"; });
    document.getElementById("btn-cancel-bottom").addEventListener("click", function () { location.hash = "#/ordenes"; });
    document.getElementById("btn-new-patient-inline").addEventListener("click", function () {
      window.BIO_openPatientForm(null, function () { location.hash = "#/ordenes/nueva"; BIO_ROUTER.renderRoute(); });
    });
    document.getElementById("exam-search").addEventListener("input", function (e) { searchTerm = e.target.value; renderSections(); renderExams(); });

    function renderSections() {
      document.getElementById("sec-list").innerHTML = secciones.map(function (s) {
        var count = selectedExams.filter(function (id) { return C.examenEfectivo(id, tenant).seccion === s.id; }).length;
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
        ? examenes.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : examenes.filter(function (e) { return e.seccion === activeSection; });
      var allChecked = pool.length > 0 && pool.every(function (e) { return selectedExams.indexOf(e.id) !== -1; });

      var rowsHtml = pool.map(function (e) {
        var checked = selectedExams.indexOf(e.id) !== -1;
        var tubo = C.tuboInfo(e.tubo);
        return '<label class="exam-row"><input type="checkbox" data-exam="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + C.seccionNombre(e.seccion, tenant) + "</span>" : "") + "</div>" +
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
          renderChips(); renderSections(); sugerirValorCobrar();
        });
      });
      var btnAll = document.getElementById("btn-select-all");
      if (btnAll) btnAll.addEventListener("click", function () {
        if (allChecked) selectedExams = selectedExams.filter(function (id) { return !pool.some(function (e) { return e.id === id; }); });
        else pool.forEach(function (e) { if (selectedExams.indexOf(e.id) === -1) selectedExams.push(e.id); });
        renderExams(); renderChips(); renderSections(); sugerirValorCobrar();
      });
    }

    function sugerirValorCobrar() {
      if (!tenant.mostrarPrecioOrden) return;
      var equiv = document.getElementById("valorCobrar-equiv");
      if (precioEditadoManualmente) {
        if (equiv) equiv.textContent = C.fmtMonedaAdicional(tenant, parseFloat(document.getElementById("f_valorCobrar").value) || 0);
        return;
      }
      var input = document.getElementById("f_valorCobrar");
      if (!input) return;
      var total = selectedExams.reduce(function (sum, id) { return sum + (preciosPorId[id] || 0); }, 0);
      input.value = total || "";
      if (equiv) equiv.textContent = C.fmtMonedaAdicional(tenant, total);
    }

    function renderChips() {
      document.getElementById("sel-count").textContent = selectedExams.length + " seleccionados";
      document.getElementById("chips").innerHTML = selectedExams.map(function (id) {
        var e = C.examenEfectivo(id, tenant);
        return '<span class="chip">' + U.esc(e.nombre) + ' <button data-remove="' + id + '">' + U.icon("x") + "</button></span>";
      }).join("");
      document.querySelectorAll("[data-remove]").forEach(function (b) {
        b.addEventListener("click", function () {
          selectedExams = selectedExams.filter(function (x) { return x !== b.dataset.remove; });
          renderChips(); renderExams(); renderSections(); sugerirValorCobrar();
        });
      });
    }
    renderSections(); renderExams(); renderChips();
    if (tenant.mostrarPrecioOrden) {
      document.getElementById("f_valorCobrar").addEventListener("input", function (e) {
        precioEditadoManualmente = true;
        var hint = document.getElementById("valorCobrar-hint");
        if (hint) hint.textContent = "Ajustado manualmente.";
        var equiv = document.getElementById("valorCobrar-equiv");
        if (equiv) equiv.textContent = C.fmtMonedaAdicional(tenant, parseFloat(e.target.value) || 0);
      });
      sugerirValorCobrar();
    }

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
        numAutorizacion: tenant.pais === "CO" ? document.getElementById("f_numAutorizacion").value : "",
        diagnosticoCIE10: tenant.pais === "CO" ? document.getElementById("f_diagnosticoCIE10").value : "",
        valorCobrar: tenant.mostrarPrecioOrden ? (parseFloat(document.getElementById("f_valorCobrar").value) || 0) : null,
        examenes: selectedExams.map(function (id) {
          var exCat = C.examenEfectivo(id, tenant);
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
      (puedeReciboOrden(tenant) ? '<button class="btn btn-outline btn-block" id="btn-recibo-orden" style="margin-bottom:12px">' + U.icon("send") + " Recibo de Pago (confirmar y enviar)</button>" : "") +
      '<div class="flex gap-2 justify-between">' +
      '<button class="btn btn-ghost" id="btn-skip">Continuar sin imprimir</button>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-outline btn-sm" id="btn-stickers-preview" title="Ver antes de imprimir o elegir otra impresora">Vista previa</button>' +
      '<button class="btn btn-primary" id="btn-stickers-now">' + U.icon("printer") + " Imprimir Stickers</button>" +
      "</div></div>"
    );
    if (puedeReciboOrden(tenant)) wrap.querySelector("#btn-recibo-orden").addEventListener("click", function () { U.closeModal(wrap); abrirReciboOrden(order, tenant); });
    wrap.querySelector("#btn-skip").addEventListener("click", function () { U.closeModal(wrap); location.hash = "#/ordenes/" + order.id; });
    wrap.querySelector("#btn-stickers-preview").addEventListener("click", function () {
      U.closeModal(wrap);
      window.BIO_PDF.previewStickers(order, pac, tenant);
      location.hash = "#/ordenes/" + order.id;
    });
    wrap.querySelector("#btn-stickers-now").addEventListener("click", function () {
      U.closeModal(wrap);
      window.BIO_PDF.imprimirStickersRapido(order, pac, tenant);
      location.hash = "#/ordenes/" + order.id;
    });
  }

  // -------------------------------------------------------------------
  // RECIBO DE PAGO DE LA ORDEN — sobre todo para laboratorios de
  // Venezuela, que cobran con un equivalente en bolívares según la tasa
  // del día (tenant.monedaAdicional). Antes de generar/enviar el recibo
  // siempre se pide confirmar que el cliente ya pagó, para no emitir un
  // recibo sin respaldo.
  // -------------------------------------------------------------------
  function puedeReciboOrden(tenant) {
    return !!tenant && tenant.pais === "VE" && !!tenant.mostrarPrecioOrden;
  }

  function abrirReciboOrden(order, tenant, onDone) {
    var pac = S.getPatient(order.patientId);
    var precios = {};
    S.cotizador.listPrecios(order.tenantId).forEach(function (p) { precios[p.examId] = p.precio; });

    function generarYEnviar(pago) {
      var bytes = BIO_PDF_RECIBO_ORDEN.buildReciboOrdenPDF(order, pac, tenant, pago, precios);
      U.downloadBytes(bytes, "Recibo_Orden_" + order.numeroOrden + ".pdf");
      U.toast("Recibo generado y descargado.", "success");
      var monto = pago.monto != null ? pago.monto : order.valorCobrar;
      var extra = C.fmtMonedaAdicional(tenant, monto);
      var mensaje = "Hola " + (pac ? U.nombreCompleto(pac).split(" ")[0] : "") + " 👋 Adjunto el recibo de pago de tu orden " + order.numeroOrden + " en " + tenant.nombre + " por " + fmtMoneda(monto) + (extra ? " (" + extra + ")" : "") + ". ¡Gracias por tu confianza!";
      var wrapEnvio = U.openModal(
        '<h3 class="modal-title">Recibo listo</h3>' +
        '<p class="text-muted" style="margin-top:0">Ya se descargó el PDF. Adjúntalo antes de enviar por el canal que elijas, o imprímelo directamente.</p>' +
        '<div class="flex gap-2 wrap">' +
        '<button class="btn btn-outline btn-sm" id="rec-ord-print">' + U.icon("printer") + " Imprimir</button>" +
        (pac && pac.celular ? '<button class="btn btn-whatsapp btn-sm" id="rec-ord-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" : "") +
        "</div>" +
        (pac && pac.email ? U.emailProviderButtonsHtml("rec-ord-mail") : '<p class="text-muted" style="font-size:12px;margin-top:10px">Este paciente no tiene correo ni WhatsApp guardados para enviarlo directo — descarga e imprime, o agrégalos a su ficha.</p>') +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrapEnvio.querySelector("#rec-ord-print").addEventListener("click", function () {
        var blob = new Blob([bytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var w = window.open(url, "_blank");
        if (w) w.addEventListener("load", function () { w.print(); });
      });
      var btnWa = wrapEnvio.querySelector("#rec-ord-wa");
      if (btnWa) btnWa.addEventListener("click", function () {
        var numero = U.numeroWhatsapp(pac.celular, tenant.pais);
        window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje), "_blank");
      });
      if (pac && pac.email) U.wireEmailProviderButtons(wrapEnvio, "rec-ord-mail", pac.email, "Recibo de pago — " + tenant.nombre, mensaje);
      if (onDone) onDone();
    }

    if (order.pago) { generarYEnviar(order.pago); return; }

    var wrapConfirm = U.openModal(
      '<h3 class="modal-title">Recibo de Pago — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Antes de generar el recibo, confirma que el cliente ya realizó el pago.</p>' +
      '<div class="field"><label>Método de Pago</label><select id="rec-ord-metodo">' +
      Object.keys(BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL).map(function (k) { return '<option value="' + k + '">' + BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[k] + "</option>"; }).join("") +
      "</select></div>" +
      '<label class="checkbox-row" style="margin-top:10px"><input type="checkbox" id="rec-ord-confirmo"/> Confirmo que el cliente ya pagó ' + fmtMoneda(order.valorCobrar) + fmtMonedaEquiv(tenant, order.valorCobrar) + "</label>" +
      '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rec-ord-confirmar" disabled>Confirmar Pago y Generar Recibo</button></div>'
    );
    var chk = wrapConfirm.querySelector("#rec-ord-confirmo");
    var btnConfirmar = wrapConfirm.querySelector("#rec-ord-confirmar");
    chk.addEventListener("change", function () { btnConfirmar.disabled = !chk.checked; });
    btnConfirmar.addEventListener("click", function () {
      var session = BIO_AUTH.getSession();
      var pago = { fecha: new Date().toISOString(), metodoPago: wrapConfirm.querySelector("#rec-ord-metodo").value, monto: order.valorCobrar, confirmadoPor: session.nombre };
      order.pago = pago;
      S.saveOrder(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "CONFIRMAR_PAGO_ORDEN", "orden", order.id, "Confirmó el pago de la orden " + order.numeroOrden + " y generó el recibo.");
      U.closeModal(wrapConfirm);
      generarYEnviar(pago);
    });
  }

  // Solo un Administrador o un Bacteriólogo con el permiso explícito puede
  // generar y enviar Hojas de Remisión — se activa por usuario desde
  // "Usuarios del Laboratorio" (ver views-admin.js), para no dar este
  // manejo a todo el equipo por defecto.
  function puedeGestionarRemision(session) {
    return session.rol === "admin" || session.rol === "superadmin" || !!session.puedeGestionarRemisiones;
  }

  function renderOrderDetail(root, orderId) {
    var session = BIO_AUTH.getSession();
    var order = S.getOrder(orderId);
    if (!order) { root.innerHTML = '<div class="card">Orden no encontrada.</div>'; return; }
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_STORE.getTenant(order.tenantId);

    function build() {
      var remisiones = order.remisiones || [];
      root.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3 class="card-title">Orden ' + order.numeroOrden + " — " + window.BIO_badgeEstado(order.estadoGeneral) + '</h3>' +
          '<div class="flex gap-2 wrap"><a class="btn btn-ghost btn-sm" id="btn-back">Volver</a>' +
          '<button class="btn btn-outline btn-sm" id="btn-stickers">' + U.icon("printer") + " Imprimir Stickers</button>" +
          '<button class="btn btn-ghost btn-sm" id="btn-stickers-preview" title="Ver antes de imprimir o elegir otra impresora">Vista previa de stickers</button>' +
          '<button class="btn btn-outline btn-sm" id="btn-preview">' + U.icon("file") + " Ver / Descargar PDF</button>" +
          (puedeGestionarRemision(session) ? '<button class="btn btn-outline btn-sm" id="btn-remision">' + U.icon("send") + " Hoja de Remisión</button>" : "") +
          (puedeReciboOrden(tenant) ? '<button class="btn btn-outline btn-sm" id="btn-recibo-orden">' + U.icon("send") + (order.pago ? " Reenviar Recibo de Pago" : " Recibo de Pago") + "</button>" : "") +
          (tenant.pais === "CO" ? '<button class="btn btn-outline btn-sm" id="btn-consentimiento">' + U.icon("file") + " Consentimiento Informado</button>" : "") +
          "</div></div>" +
          '<div class="form-grid">' +
            field("Paciente", pac ? U.nombreCompleto(pac) + " (" + pac.tipoDocumento + " " + pac.numeroDocumento + ")" : "—") +
            field("Edad / Sexo", (pac ? U.calcEdad(pac.fechaNacimiento) : "—") + " · " + (pac ? pac.sexo : "")) +
            (pac && pac.pais === "CO" ? field("EPS / Seguro", pac.eps || "—") : "") +
            field("Médico Remitente", order.medicoRemitente || "—") +
            field("Procedencia", order.procedencia) +
            field("Prioridad", order.prioridad) +
            field("Fecha de Orden", U.fmtFecha(order.fechaOrden)) +
            field("Diagnóstico", order.diagnostico || "—") +
            (tenant.mostrarPrecioOrden ? fieldHtml("Valor a Cobrar", order.valorCobrar ? U.esc(fmtMoneda(order.valorCobrar)) + fmtMonedaEquiv(tenant, order.valorCobrar) : "—") : "") +
            (puedeReciboOrden(tenant) ? field("Estado de Pago", order.pago ? "✓ Pagado (" + (BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[order.pago.metodoPago] || order.pago.metodoPago) + ") — " + U.fmtFecha(order.pago.fecha) : "Pendiente de confirmar") : "") +
          "</div></div>" +

        '<div class="card" style="margin-top:16px"><div class="card-header"><h3 class="card-title">Exámenes de la Orden</h3></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Examen</th><th>Sección</th><th>Tubo</th><th>Estado</th><th>Validado / Remitido por</th><th>Fecha</th><th></th></tr></thead><tbody>' +
          order.examenes.map(function (ex, idx) {
            var exCat = C.examenEfectivo(ex.examId, tenant);
            var tubo = C.tuboInfo(exCat.tubo);
            return "<tr><td>" + U.esc(exCat.nombre) + "</td><td>" + C.seccionNombre(ex.seccion, tenant) + "</td>" +
              '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + tubo.color + ';margin-right:5px;vertical-align:middle"></span>' + U.esc(tubo.nombre) + "</td>" +
              "<td>" + window.BIO_badgeEstado(ex.estado === "en_proceso" ? "pendiente" : ex.estado) + "</td>" +
              "<td>" + (ex.validadoPor || "—") + "</td><td>" + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + "</td>" +
              '<td><button class="btn btn-outline btn-sm" data-goresult="' + idx + '">Ir a captura</button></td></tr>';
          }).join("") +
          "</tbody></table></div></div>" +

        (remisiones.length ? '<div class="card" style="margin-top:16px"><div class="card-header"><h3 class="card-title">Hojas de Remisión Generadas (' + remisiones.length + ')</h3></div>' +
          '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Laboratorio de Referencia</th><th># Exámenes</th><th>Generó</th><th></th></tr></thead><tbody>' +
          remisiones.map(function (r, i) {
            return "<tr><td>" + U.esc(r.numero) + "</td><td>" + U.fmtFecha(r.fecha) + "</td><td>" + U.esc(r.laboratorioDestino.nombre) + "</td><td>" + r.examenes.length + "</td><td>" + U.esc(r.generadoPor || "—") + "</td>" +
              '<td><button class="btn btn-ghost btn-sm" data-redescargar-remision="' + i + '">' + U.icon("download") + " PDF</button></td></tr>";
          }).join("") + "</tbody></table></div></div>" : "");

      document.getElementById("btn-back").addEventListener("click", function () { location.hash = "#/ordenes"; });
      document.getElementById("btn-preview").addEventListener("click", function () { window.BIO_PDF.previewOrModal(order, pac, tenant); });
      document.getElementById("btn-stickers").addEventListener("click", function () { window.BIO_PDF.imprimirStickersRapido(order, pac, tenant); });
      document.getElementById("btn-stickers-preview").addEventListener("click", function () { window.BIO_PDF.previewStickers(order, pac, tenant); });
      var btnRemision = document.getElementById("btn-remision");
      if (btnRemision) btnRemision.addEventListener("click", function () { abrirGenerarRemision(order, pac, tenant, build); });
      var btnReciboOrden = document.getElementById("btn-recibo-orden");
      if (btnReciboOrden) btnReciboOrden.addEventListener("click", function () { abrirReciboOrden(order, tenant, build); });
      var btnConsentimiento = document.getElementById("btn-consentimiento");
      if (btnConsentimiento) btnConsentimiento.addEventListener("click", function () { window.BIO_VIEWS_CONSENTIMIENTOS.abrir(order, pac, tenant, build); });
      root.querySelectorAll("[data-goresult]").forEach(function (b) {
        b.addEventListener("click", function () { location.hash = "#/resultados/" + order.id; });
      });
      root.querySelectorAll("[data-redescargar-remision]").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = remisiones[parseInt(b.dataset.redescargarRemision, 10)];
          var bytes = BIO_PDF_REMISION.buildHojaRemisionPDF(Object.assign({}, r, { fecha: new Date(r.fecha) }), tenant);
          U.downloadBytes(bytes, "Hoja_Remision_" + r.numero + ".pdf");
        });
      });
    }
    build();
  }

  // -------------------------------------------------------------------
  // HOJA DE REMISIÓN A LABORATORIO DE REFERENCIA
  // -------------------------------------------------------------------
  function abrirGenerarRemision(order, pac, tenant, onDone) {
    var session = BIO_AUTH.getSession();
    var examenesInfo = order.examenes.map(function (ex, idx) {
      var exCat = C.examenEfectivo(ex.examId, tenant);
      var tubo = C.tuboInfo(exCat.tubo);
      return { idx: idx, ex: ex, exCat: exCat, tubo: tubo };
    });

    var wrap = U.openModal(
      '<h3 class="modal-title">Generar Hoja de Remisión — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Para exámenes que tu laboratorio solo toma la muestra y remite a un laboratorio externo. Genera un documento profesional de trazabilidad (con cadena de custodia y código de verificación) para enviar junto con la muestra, o por correo/WhatsApp.</p>' +
      '<div class="field"><label>Selecciona los exámenes a remitir</label><div class="form-grid">' +
      examenesInfo.map(function (info) {
        var checked = info.ex.estado === "remitido";
        return '<div class="checkbox-row"><input type="checkbox" data-remex="' + info.idx + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + U.esc(info.exCat.nombre) + "</label></div>";
      }).join("") + "</div></div>" +
      '<fieldset><legend>Laboratorio de Referencia (destino)</legend><div class="form-grid">' +
      F.inp("labNombre", "Nombre del Laboratorio", "", true) +
      F.inp("labDireccion", "Dirección", "") +
      F.inp("labTelefono", "Teléfono / WhatsApp del laboratorio", "") +
      "</div></fieldset>" +
      '<div class="checkbox-row" style="margin:10px 0"><input type="checkbox" id="rem-incluir-valores"/><label style="margin:0" for="rem-incluir-valores">Incluir el valor de cada examen (funciona como recibo, para control de costos de remisión)</label></div>' +
      '<div id="rem-valores-box"></div>' +
      '<div class="field"><label>Observaciones (opcional)</label><textarea id="rem-observaciones" placeholder="Ej: Muestra refrigerada, prioridad urgente…"></textarea></div>' +
      '<fieldset><legend>Enviar por (opcional)</legend><div class="form-grid">' +
      F.inp("remCorreo", "Correo del laboratorio de referencia", "", false, "email") +
      F.inp("remWhatsapp", "WhatsApp del laboratorio de referencia", "") +
      "</div></fieldset>" +
      '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="button" class="btn btn-primary" id="rem-generar">' + U.icon("file") + " 1. Generar PDF</button></div>" +
      '<div id="rem-step2" class="hidden" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">' +
      '<p style="margin:0 0 4px"><b>2. Elige dónde enviarlo</b></p>' +
      U.emailProviderButtonsHtml("rem") +
      '<a class="btn btn-whatsapp btn-block" id="rem-wa" target="_blank" rel="noopener" style="margin-top:8px">' + U.icon("send") + " Enviar por WhatsApp</a>" +
      "</div>",
      { lg: true }
    );

    function renderValoresBox() {
      var incluir = wrap.querySelector("#rem-incluir-valores").checked;
      var box = wrap.querySelector("#rem-valores-box");
      if (!incluir) { box.innerHTML = ""; return; }
      var seleccionados = Array.prototype.slice.call(wrap.querySelectorAll("[data-remex]:checked")).map(function (c) { return parseInt(c.dataset.remex, 10); });
      if (!seleccionados.length) { box.innerHTML = '<p class="text-muted" style="font-size:12.5px">Selecciona primero los exámenes a remitir.</p>'; return; }
      box.innerHTML = '<div class="field"><label>Valor de cada examen (COP)</label><div class="form-grid">' +
        seleccionados.map(function (idx) {
          var info = examenesInfo[idx];
          return '<div class="field"><label style="font-weight:400">' + U.esc(info.exCat.nombre) + '</label><input type="number" min="0" step="1000" data-remval="' + idx + '" value="0"/></div>';
        }).join("") + "</div></div>";
    }
    wrap.querySelector("#rem-incluir-valores").addEventListener("change", renderValoresBox);
    wrap.querySelectorAll("[data-remex]").forEach(function (chk) { chk.addEventListener("change", renderValoresBox); });

    wrap.querySelector("#rem-generar").addEventListener("click", function () {
      var seleccionados = Array.prototype.slice.call(wrap.querySelectorAll("[data-remex]:checked")).map(function (c) { return parseInt(c.dataset.remex, 10); });
      if (!seleccionados.length) { U.toast("Selecciona al menos un examen a remitir.", "error"); return; }
      var labNombre = wrap.querySelector("#f_labNombre").value.trim();
      if (!labNombre) { U.toast("Ingresa el nombre del laboratorio de referencia.", "error"); return; }
      var incluirValores = wrap.querySelector("#rem-incluir-valores").checked;

      var examenesRemision = seleccionados.map(function (idx) {
        var info = examenesInfo[idx];
        var valInput = wrap.querySelector('[data-remval="' + idx + '"]');
        return {
          examId: info.ex.examId, nombre: info.exCat.nombre, cups: info.exCat.cups,
          seccionNombre: C.seccionNombre(info.ex.seccion, tenant), muestra: info.exCat.muestra, tuboNombre: info.tubo.nombre,
          valor: incluirValores && valInput ? (parseFloat(valInput.value) || 0) : 0
        };
      });

      var fecha = new Date();
      var numero = BIO_PDF_REMISION.numeroRemision(fecha, order.id);
      var remision = {
        numero: numero, fecha: fecha,
        laboratorioDestino: { nombre: labNombre, direccion: wrap.querySelector("#f_labDireccion").value.trim(), telefono: wrap.querySelector("#f_labTelefono").value.trim() },
        paciente: { nombre: pac ? U.nombreCompleto(pac) : "—", tipoDocumento: pac ? pac.tipoDocumento : "", numeroDocumento: pac ? pac.numeroDocumento : "", edadTexto: pac ? U.calcEdad(pac.fechaNacimiento) : "", sexo: pac ? pac.sexo : "" },
        numeroOrden: order.numeroOrden, medicoRemitente: order.medicoRemitente, procedencia: order.procedencia,
        examenes: examenesRemision, incluirValores: incluirValores,
        observaciones: wrap.querySelector("#rem-observaciones").value.trim()
      };

      var bytes = BIO_PDF_REMISION.buildHojaRemisionPDF(remision, tenant);
      U.downloadBytes(bytes, "Hoja_Remision_" + numero + ".pdf");

      order.remisiones = order.remisiones || [];
      order.remisiones.push(Object.assign({}, remision, { fecha: fecha.toISOString(), generadoPor: session.nombre }));
      S.saveOrder(order);
      S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_REMISION", "orden", order.id,
        "Generó la Hoja de Remisión " + numero + " a " + labNombre + " (" + examenesRemision.length + " examen(es), Orden " + order.numeroOrden + ").");

      var correo = wrap.querySelector("#f_remCorreo").value.trim();
      var whatsapp = wrap.querySelector("#f_remWhatsapp").value.trim();
      var mensaje = "Hola 👋 Adjuntamos la Hoja de Remisión N° " + numero + " de " + tenant.nombre + " (Orden " + order.numeroOrden + ", paciente " + (pac ? U.nombreCompleto(pac) : "—") + ") con " + examenesRemision.length + " examen(es). Quedamos atentos a los resultados.";
      wrap.querySelector("#rem-step2").classList.remove("hidden");
      U.wireEmailProviderButtons(wrap, "rem", correo, "Hoja de Remisión " + numero + " — " + tenant.nombre, mensaje + "\n\n(Adjunte el PDF que se acaba de descargar)");
      var waBtn = wrap.querySelector("#rem-wa");
      if (whatsapp) {
        waBtn.href = "https://wa.me/" + whatsapp.replace(/\D/g, "") + "?text=" + encodeURIComponent(mensaje + "\n\n(Adjunte el PDF que se acaba de descargar antes de enviar)");
      } else {
        waBtn.classList.add("hidden");
      }
      U.toast("Hoja de Remisión generada y descargada.", "success");
      onDone();
    });
  }

  function field(label, value) {
    return '<div class="field"><label>' + label + "</label><div style='padding:9px 0;font-weight:600'>" + U.esc(value) + "</div></div>";
  }
  function fieldHtml(label, html) {
    return '<div class="field"><label>' + label + "</label><div style='padding:9px 0;font-weight:600'>" + html + "</div></div>";
  }

  // Se expone para que views-results.js (la Bandeja de Resultados, donde
  // realmente trabaja el bacteriólogo) también pueda ofrecer "Hoja de
  // Remisión" sin duplicar el modal — la ruta "ordenes" no está permitida
  // para el rol bacteriologo, así que ese es su único punto de acceso real.
  window.BIO_REMISION = { puedeGestionar: puedeGestionarRemision, abrir: abrirGenerarRemision };
})();

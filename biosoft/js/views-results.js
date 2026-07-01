/* BIOsoft — Vistas: Captura, validación, remisión a laboratorio externo y corrección de resultados */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  window.BIO_VIEWS.resultados = function (root, param) {
    if (param) return renderCaptura(root, param);
    renderBandeja(root);
  };

  function puedeEditar(session, seccion) {
    if (session.rol === "admin" || session.rol === "superadmin") return true;
    return session.secciones.indexOf(seccion) !== -1;
  }

  function tuboChip(tuboKey) {
    var t = C.tuboInfo(tuboKey);
    return '<span class="chip" style="background:#fff"><span style="width:10px;height:10px;border-radius:50%;background:' + t.color + ';display:inline-block"></span>' + U.esc(t.nombre) + "</span>";
  }

  function renderBandeja(root) {
    var session = BIO_AUTH.getSession();
    var orders = S.listOrders(session.tenantId);
    var filtroEstado = "todos";
    var filtroSeccion = "todas";

    function build() {
      var rows = [];
      orders.forEach(function (o) {
        o.examenes.forEach(function (ex, idx) {
          if (!puedeEditar(session, ex.seccion) && session.rol === "bacteriologo") return;
          rows.push({ order: o, ex: ex, idx: idx });
        });
      });
      rows = rows.filter(function (r) {
        var okEstado = filtroEstado === "todos" || r.ex.estado === filtroEstado || (filtroEstado === "pendiente" && r.ex.estado === "en_proceso");
        var okSec = filtroSeccion === "todas" || r.ex.seccion === filtroSeccion;
        return okEstado && okSec;
      });
      rows.sort(function (a, b) {
        var pr = { Urgente: 0, Rutina: 1 };
        return (pr[a.order.prioridad] - pr[b.order.prioridad]) || a.order.fechaOrden.localeCompare(b.order.fechaOrden);
      });

      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Bandeja de Resultados</h3>' +
        '<div class="flex gap-2 wrap">' +
        '<select id="f-estado"><option value="todos">Todos los estados</option><option value="pendiente">Pendientes</option><option value="preliminar">Preliminares</option><option value="validado">Validados</option><option value="remitido">Remitidos</option></select>' +
        '<select id="f-seccion"><option value="todas">Todas las secciones</option>' + C.SECCIONES.map(function (s) { return '<option value="' + s.id + '">' + s.nombre + "</option>"; }).join("") + "</select>" +
        "</div></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>N° Orden</th><th>Paciente</th><th>Examen</th><th>Sección</th><th>Estado</th><th></th></tr></thead><tbody>' +
        (rows.length ? rows.map(rowHtml).join("") : '<tr><td colspan="7" class="text-muted">No hay exámenes que coincidan con el filtro.</td></tr>') +
        "</tbody></table></div></div>";

      document.getElementById("f-estado").value = filtroEstado;
      document.getElementById("f-seccion").value = filtroSeccion;
      document.getElementById("f-estado").addEventListener("change", function (e) { filtroEstado = e.target.value; build(); });
      document.getElementById("f-seccion").addEventListener("change", function (e) { filtroSeccion = e.target.value; build(); });
      root.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/resultados/" + b.dataset.go; }); });
    }

    function rowHtml(r) {
      var pac = S.getPatient(r.order.patientId);
      var exCat = C.examenPorId(r.ex.examId);
      return "<tr><td>" + '<span class="badge badge-' + (r.order.prioridad === "Urgente" ? "urgente" : "rutina") + '">' + r.order.prioridad + "</span></td>" +
        "<td>" + r.order.numeroOrden + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + U.esc(exCat.nombre) + "</td><td>" + C.seccionNombre(r.ex.seccion) + "</td>" +
        "<td>" + window.BIO_badgeEstado(r.ex.estado === "en_proceso" ? "pendiente" : r.ex.estado) + '</td><td><button class="btn btn-outline btn-sm" data-go="' + r.order.id + '">Abrir</button></td></tr>';
    }
    build();
  }

  function renderCaptura(root, orderId) {
    var session = BIO_AUTH.getSession();
    var order = S.getOrder(orderId);
    if (!order) { root.innerHTML = '<div class="card">Orden no encontrada.</div>'; return; }
    var pac = S.getPatient(order.patientId);

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Orden ' + order.numeroOrden + " · " + (pac ? U.esc(U.nombreCompleto(pac)) : "") + '</h3>' +
        '<a class="btn btn-ghost btn-sm" id="btn-back">Volver a la bandeja</a></div>' +
        '<p class="text-muted" style="margin:0">' + (pac ? U.calcEdad(pac.fechaNacimiento) + " · " + pac.sexo + " · " + (pac.eps || "Particular") : "") + " · Médico remitente: " + U.esc(order.medicoRemitente || "—") + "</p></div>" +
        '<div id="exam-cards" style="margin-top:16px"></div>';
      document.getElementById("btn-back").addEventListener("click", function () { location.hash = "#/resultados"; });

      var host = document.getElementById("exam-cards");
      order.examenes.forEach(function (ex, idx) { host.appendChild(buildExamCard(ex, idx)); });
    }

    function buildExamCard(ex, idx) {
      var exCat = C.examenPorId(ex.examId);
      var editable = puedeEditar(session, ex.seccion);
      var locked = ex.estado === "validado" || ex.estado === "remitido";
      var modoRemision = !!ex.remitido;
      var pdfPendienteDataUrl = "";
      var pdfPendienteNombre = "";
      var card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "14px";

      var valuesMap = {};
      ex.valores.forEach(function (v) { valuesMap[v.codigo] = v.valor; });

      function headerHtml() {
        return '<div class="card-header"><div><h3 class="card-title">' + U.esc(exCat.nombre) + '</h3>' +
          '<span class="text-muted" style="font-size:12px">' + C.seccionNombre(ex.seccion) + " · CUPS " + exCat.cups + " · Muestra: " + U.esc(exCat.muestra) + "</span>" +
          '<div style="margin-top:6px">' + tuboChip(exCat.tubo) + "</div></div>" +
          window.BIO_badgeEstado(ex.estado === "en_proceso" ? "pendiente" : ex.estado) + "</div>";
      }

      function renderReadOnlyRemitido() {
        card.innerHTML = headerHtml() +
          '<div class="card" style="background:var(--surface-2);box-shadow:none">' +
          '<p style="margin:0"><b>Examen remitido a laboratorio de referencia</b></p>' +
          '<p class="text-muted" style="margin:4px 0">Laboratorio: <b>' + U.esc(ex.laboratorioRemision || "—") + "</b> · Recibido: " + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + " · Registrado por: " + U.esc(ex.validadoPor || "—") + "</p>" +
          '<div class="flex gap-2 wrap" style="margin-top:8px">' +
          (ex.pdfRemitidoDataUrl ? '<button class="btn btn-outline btn-sm" data-action="verpdf">' + U.icon("file") + " Ver PDF Remitido</button>" : "") +
          (editable ? '<button class="btn btn-danger btn-sm" data-action="corregir">' + U.icon("lock") + " Reemplazar PDF (requiere clave admin)</button>" : "") +
          "</div></div>" +
          (ex.correcciones && ex.correcciones.length ? '<p class="text-muted" style="font-size:12px;margin-top:8px">' + U.icon("history") + " Este examen tiene " + ex.correcciones.length + " corrección(es) registrada(s) en la trazabilidad." : "");

        var bv = card.querySelector('[data-action="verpdf"]');
        if (bv) bv.addEventListener("click", function () { U.openDataUrlInNewTab(ex.pdfRemitidoDataUrl); });
        var bc = card.querySelector('[data-action="corregir"]');
        if (bc) bc.addEventListener("click", function () { abrirCorreccion(ex, exCat, order, build); });
      }

      function renderFormularioRemision() {
        card.innerHTML = headerHtml() +
          '<p class="text-muted">Marca este examen como remitido cuando se envía a procesar en un laboratorio externo más especializado. El PDF que subas aquí será el que se le entregue al paciente para este examen, conforme a la Resolución 3100.</p>' +
          (editable ? '<div class="checkbox-row" style="margin-bottom:12px"><input type="checkbox" id="chk-remitido" checked/><label style="margin:0" for="chk-remitido">Este examen se remite a un laboratorio externo</label></div>' : "") +
          '<div class="form-grid">' +
          '<div class="field"><label>Laboratorio de Referencia *</label><input id="f-labref" value="' + U.esc(ex.laboratorioRemision || "") + '" placeholder="Ej: Laboratorio Especializado XYZ"/></div>' +
          '<div class="field"><label>PDF del Informe Remitido *</label><input type="file" id="f-pdfref" accept="application/pdf"/></div>' +
          "</div>" +
          '<div id="pdfref-preview" class="text-muted" style="font-size:12.5px">' + (ex.pdfRemitidoNombre ? "Archivo actual: " + U.esc(ex.pdfRemitidoNombre) : "Sin archivo cargado") + "</div>" +
          '<div class="flex gap-2 wrap" style="margin-top:12px">' +
          '<button class="btn btn-primary btn-sm" data-action="guardar-remision">' + U.icon("check") + " Guardar Remisión</button>" +
          "</div>";

        var chk = card.querySelector("#chk-remitido");
        if (chk) chk.addEventListener("change", function () { if (!chk.checked) { modoRemision = false; renderCapturaNormal(); } });
        card.querySelector("#f-pdfref").addEventListener("change", function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            pdfPendienteDataUrl = ev.target.result;
            pdfPendienteNombre = file.name;
            card.querySelector("#pdfref-preview").textContent = "Archivo seleccionado: " + file.name;
          };
          reader.readAsDataURL(file);
        });
        card.querySelector('[data-action="guardar-remision"]').addEventListener("click", function () {
          var lab = card.querySelector("#f-labref").value.trim();
          var pdf = pdfPendienteDataUrl || ex.pdfRemitidoDataUrl;
          var pdfNombre = pdfPendienteNombre || ex.pdfRemitidoNombre;
          if (!lab) { U.toast("Indica el nombre del laboratorio de referencia.", "error"); return; }
          if (!pdf) { U.toast("Adjunta el PDF del informe remitido.", "error"); return; }
          ex.remitido = true; ex.laboratorioRemision = lab; ex.pdfRemitidoDataUrl = pdf; ex.pdfRemitidoNombre = pdfNombre;
          ex.estado = "remitido"; ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId; ex.fechaValidacion = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          S.addAudit(session.tenantId, session.nombre, session.rol, "MARK_REFERRED_EXAM", "resultado", order.id + ":" + ex.examId, "Registró remisión de " + exCat.nombre + " al laboratorio " + lab + " (Orden " + order.numeroOrden + ").");
          U.toast("Remisión registrada.", "success");
          card.replaceWith(buildExamCard(ex, idx));
        });
      }

      function renderCapturaNormal() {
        var rowsHtml = exCat.parametros.map(function (p) {
          var val = valuesMap[p.codigo] || "";
          var flag = C.calcularFlag(p, val);
          var inputHtml;
          if (p.tipo === "numerico") {
            inputHtml = '<input type="number" step="any" data-param="' + p.codigo + '" value="' + U.esc(val) + '" ' + (!editable ? "disabled" : "") + "/>";
          } else if (p.tipo === "cualitativo" || p.tipo === "descriptivo") {
            inputHtml = '<select data-param="' + p.codigo + '" ' + (!editable ? "disabled" : "") + '><option value="">— Seleccionar —</option>' +
              p.opciones.map(function (o) { return '<option ' + (o === val ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select>";
          } else {
            inputHtml = '<textarea data-param="' + p.codigo + '" ' + (!editable ? "disabled" : "") + ">" + U.esc(val) + "</textarea>";
          }
          return "<tr><td>" + U.esc(p.nombre) + "</td><td style='min-width:160px'>" + inputHtml + "</td><td>" + (p.unidad || "—") + "</td><td>" + U.esc(p.refText) + '</td><td class="flag-cell" data-flagfor="' + p.codigo + '">' +
            (flag ? '<span class="flag-' + flag.toLowerCase() + '">' + flag + "</span>" : "") + "</td></tr>";
        }).join("");

        card.innerHTML = headerHtml() +
          (!editable ? '<p class="text-muted">Esta sección no está asignada a tu usuario. Solo lectura.</p>' : "") +
          (editable ? '<div class="checkbox-row" style="margin-bottom:12px"><input type="checkbox" id="chk-remitido"/><label style="margin:0" for="chk-remitido">Este examen se remite a un laboratorio externo (no se procesa en este laboratorio)</label></div>' : "") +
          '<div class="table-wrap"><table><thead><tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Valor de referencia</th><th>Interpretación</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" +
          '<div class="field" style="margin-top:12px"><label>Observaciones del examen</label><textarea data-obs ' + (!editable ? "disabled" : "") + ">" + U.esc(ex.observaciones || "") + "</textarea></div>" +
          '<div class="flex gap-2 wrap" style="margin-top:10px">' +
          (editable ? '<button class="btn btn-outline btn-sm" data-action="borrador">Guardar borrador</button>' : "") +
          (editable ? '<button class="btn btn-outline btn-sm" data-action="preliminar">Guardar como preliminar</button>' : "") +
          (editable ? '<button class="btn btn-primary btn-sm" data-action="validar">' + U.icon("check") + " Validar y Firmar</button>" : "") +
          "</div>";

        var chk = card.querySelector("#chk-remitido");
        if (chk) chk.addEventListener("change", function () { if (chk.checked) { modoRemision = true; renderFormularioRemision(); } });

        card.querySelectorAll("[data-param]").forEach(function (inputEl) {
          inputEl.addEventListener("input", function () {
            var p = exCat.parametros.filter(function (pp) { return pp.codigo === inputEl.dataset.param; })[0];
            var flag = C.calcularFlag(p, inputEl.value);
            var cell = card.querySelector('[data-flagfor="' + p.codigo + '"]');
            cell.innerHTML = flag ? '<span class="flag-' + flag.toLowerCase() + '">' + flag + "</span>" : "";
          });
        });

        function collectValues() {
          return exCat.parametros.map(function (p) {
            var el = card.querySelector('[data-param="' + p.codigo + '"]');
            return { codigo: p.codigo, valor: el ? el.value : "" };
          });
        }
        function allFilled(vals) { return vals.every(function (v) { return v.valor !== ""; }); }

        var btnBorrador = card.querySelector('[data-action="borrador"]');
        if (btnBorrador) btnBorrador.addEventListener("click", function () {
          ex.valores = collectValues();
          ex.observaciones = card.querySelector("[data-obs]").value;
          ex.estado = "en_proceso";
          ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          S.addAudit(session.tenantId, session.nombre, session.rol, "SAVE_DRAFT_RESULT", "resultado", order.id + ":" + ex.examId, "Guardó borrador de " + exCat.nombre + " (Orden " + order.numeroOrden + ").");
          U.toast("Borrador guardado.", "success");
        });

        var btnPrelim = card.querySelector('[data-action="preliminar"]');
        if (btnPrelim) btnPrelim.addEventListener("click", function () {
          var vals = collectValues();
          if (!allFilled(vals)) { U.toast("Completa todos los parámetros antes de guardar como preliminar.", "error"); return; }
          ex.valores = vals; ex.observaciones = card.querySelector("[data-obs]").value; ex.estado = "preliminar";
          ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          S.addAudit(session.tenantId, session.nombre, session.rol, "SAVE_PRELIMINARY", "resultado", order.id + ":" + ex.examId, "Marcó como preliminar " + exCat.nombre + " (Orden " + order.numeroOrden + ").");
          U.toast("Guardado como resultado preliminar. Puede enviarse desde Reportes.", "success");
          card.replaceWith(buildExamCard(ex, idx));
        });

        var btnValidar = card.querySelector('[data-action="validar"]');
        if (btnValidar) btnValidar.addEventListener("click", function () {
          var vals = collectValues();
          if (!allFilled(vals)) { U.toast("Completa todos los parámetros antes de validar.", "error"); return; }
          confirmValidation(function () {
            ex.valores = vals; ex.observaciones = card.querySelector("[data-obs]").value;
            ex.estado = "validado"; ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId; ex.fechaValidacion = S.nowISO();
            if (!ex.ingresadoPor) { ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO(); }
            S.recalcEstadoGeneral(order); S.saveOrder(order);
            S.addAudit(session.tenantId, session.nombre, session.rol, "VALIDATE_RESULT", "resultado", order.id + ":" + ex.examId, "Validó y firmó " + exCat.nombre + " (Orden " + order.numeroOrden + ").");
            U.toast("Resultado validado y firmado.", "success");
            card.replaceWith(buildExamCard(ex, idx));
          });
        });
      }

      function renderCapturaNormalReadOnly() {
        var rowsHtml = exCat.parametros.map(function (p) {
          var val = valuesMap[p.codigo] || "";
          var flag = C.calcularFlag(p, val);
          return "<tr><td>" + U.esc(p.nombre) + "</td><td><b>" + U.esc(val) + "</b></td><td>" + (p.unidad || "—") + "</td><td>" + U.esc(p.refText) + '</td><td>' +
            (flag ? '<span class="flag-' + flag.toLowerCase() + '">' + flag + "</span>" : "") + "</td></tr>";
        }).join("");
        card.innerHTML = headerHtml() +
          '<div class="table-wrap"><table><thead><tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Valor de referencia</th><th>Interpretación</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" +
          (ex.observaciones ? '<p style="margin-top:10px"><b>Observaciones:</b> ' + U.esc(ex.observaciones) + "</p>" : "") +
          '<p class="text-muted" style="font-size:12px;margin-top:8px">Validado por ' + U.esc(ex.validadoPor || "—") + " el " + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + "</p>" +
          (ex.correcciones && ex.correcciones.length ? '<p class="text-muted" style="font-size:12px">' + U.icon("history") + " Este resultado tiene " + ex.correcciones.length + " corrección(es) registrada(s) en la trazabilidad." : "") +
          '<div class="flex gap-2 wrap" style="margin-top:10px">' +
          (editable ? '<button class="btn btn-danger btn-sm" data-action="corregir">' + U.icon("lock") + " Corregir (requiere clave admin)</button>" : "") +
          "</div>";
        var bc = card.querySelector('[data-action="corregir"]');
        if (bc) bc.addEventListener("click", function () { abrirCorreccion(ex, exCat, order, build); });
      }

      if (ex.estado === "remitido") renderReadOnlyRemitido();
      else if (locked) renderCapturaNormalReadOnly();
      else if (modoRemision) renderFormularioRemision();
      else renderCapturaNormal();

      return card;
    }

    function confirmValidation(onOk) {
      var wrap = U.openModal(
        '<h3 class="modal-title">Confirmar Validación</h3>' +
        '<p class="text-muted">Al validar, usted certifica con su usuario y clave (' + U.esc(BIO_AUTH.getSession().nombre) + ') que revisó y aprueba estos resultados. Esta acción queda registrada con fecha y hora en la trazabilidad, y su firma se incluirá en el informe.</p>' +
        '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="btn-ok-validate">' + U.icon("check") + " Confirmar y Firmar</button></div>"
      );
      wrap.querySelector("#btn-ok-validate").addEventListener("click", function () { U.closeModal(wrap); onOk(); });
    }

    build();
  }

  function abrirCorreccion(ex, exCat, order, onDone) {
    var session = BIO_AUTH.getSession();
    var esRemision = ex.estado === "remitido";
    var wrap = U.openModal(
      '<h3 class="modal-title">' + U.icon("lock") + (esRemision ? " Reemplazar PDF Remitido</h3>" : " Corrección de Resultado Validado</h3>") +
      '<p class="text-muted">' + (esRemision ? "Este examen fue remitido a un laboratorio externo. " : "El resultado <b>" + U.esc(exCat.nombre) + "</b> ya fue validado. ") + "Para modificarlo se requiere la clave de administrador del laboratorio y el motivo, dejando trazabilidad completa (usuario, fecha y hora).</p>" +
      '<div class="field"><label>Clave de administrador *</label><input type="password" id="c-clave"/></div>' +
      '<div class="field"><label>Motivo de la corrección *</label><textarea id="c-motivo" placeholder="Ej: Error de digitación, se corrige según repetición de la prueba."></textarea></div>' +
      '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-danger" id="c-continuar">Verificar y Continuar</button></div>'
    );
    wrap.querySelector("#c-continuar").addEventListener("click", function () {
      var clave = wrap.querySelector("#c-clave").value;
      var motivo = wrap.querySelector("#c-motivo").value.trim();
      if (!motivo) { U.toast("Describe el motivo de la corrección.", "error"); return; }
      if (!BIO_AUTH.verificarClaveAdmin(clave)) { U.toast("Clave de administrador incorrecta.", "error"); return; }
      U.closeModal(wrap);
      if (esRemision) abrirEdicionRemision(ex, exCat, order, motivo, onDone);
      else abrirEdicionCorreccion(ex, exCat, order, motivo, onDone);
    });
  }

  function abrirEdicionRemision(ex, exCat, order, motivo, onDone) {
    var session = BIO_AUTH.getSession();
    var labAnterior = ex.laboratorioRemision;
    var pdfAnteriorNombre = ex.pdfRemitidoNombre;
    var pdfNuevo = "", pdfNuevoNombre = "";
    var wrap = U.openModal(
      '<h3 class="modal-title">Reemplazar PDF Remitido — ' + U.esc(exCat.nombre) + '</h3>' +
      '<div class="field"><label>Laboratorio de Referencia</label><input id="r-lab" value="' + U.esc(ex.laboratorioRemision || "") + '"/></div>' +
      '<div class="field"><label>Nuevo PDF *</label><input type="file" id="r-pdf" accept="application/pdf"/></div>' +
      '<div class="flex gap-2 justify-between" style="margin-top:10px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="r-guardar">' + U.icon("check") + " Guardar Reemplazo</button></div>"
    );
    wrap.querySelector("#r-pdf").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) { pdfNuevo = ev.target.result; pdfNuevoNombre = file.name; };
      reader.readAsDataURL(file);
    });
    wrap.querySelector("#r-guardar").addEventListener("click", function () {
      if (!pdfNuevo) { U.toast("Selecciona el nuevo PDF.", "error"); return; }
      var labNuevo = wrap.querySelector("#r-lab").value.trim();
      ex.correcciones = ex.correcciones || [];
      ex.correcciones.push({
        fecha: S.nowISO(), usuario: session.nombre, rol: session.rol, motivo: motivo,
        valoresAnteriores: [{ codigo: "PDF", valor: pdfAnteriorNombre || "—" }, { codigo: "LABORATORIO", valor: labAnterior || "—" }],
        valoresNuevos: [{ codigo: "PDF", valor: pdfNuevoNombre }, { codigo: "LABORATORIO", valor: labNuevo }]
      });
      ex.laboratorioRemision = labNuevo; ex.pdfRemitidoDataUrl = pdfNuevo; ex.pdfRemitidoNombre = pdfNuevoNombre;
      ex.version = (ex.version || 1) + 1;
      ex.fechaValidacion = S.nowISO(); ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId;
      S.recalcEstadoGeneral(order); S.saveOrder(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "CORRECT_REFERRED_EXAM", "resultado", order.id + ":" + ex.examId,
        "Reemplazó el PDF remitido de " + exCat.nombre + " (Orden " + order.numeroOrden + "). Motivo: " + motivo);
      U.toast("PDF remitido actualizado y trazabilidad registrada.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  function abrirEdicionCorreccion(ex, exCat, order, motivo, onDone) {
    var session = BIO_AUTH.getSession();
    var valoresAnteriores = ex.valores.slice();
    var rowsHtml = exCat.parametros.map(function (p) {
      var current = (ex.valores.filter(function (v) { return v.codigo === p.codigo; })[0] || {}).valor || "";
      var inputHtml = (p.tipo === "cualitativo" || p.tipo === "descriptivo")
        ? '<select data-cparam="' + p.codigo + '">' + p.opciones.map(function (o) { return '<option ' + (o === current ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select>"
        : '<input data-cparam="' + p.codigo + '" value="' + U.esc(current) + '"/>';
      return "<tr><td>" + U.esc(p.nombre) + "</td><td>" + inputHtml + "</td><td>" + (p.unidad || "") + "</td></tr>";
    }).join("");

    var wrap = U.openModal(
      '<h3 class="modal-title">Editar Valores — ' + U.esc(exCat.nombre) + '</h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Parámetro</th><th>Nuevo valor</th><th>Unidad</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="c-guardar">' + U.icon("check") + " Guardar Corrección y Re-validar</button></div>",
      { lg: true }
    );
    wrap.querySelector("#c-guardar").addEventListener("click", function () {
      var nuevos = exCat.parametros.map(function (p) {
        var el = wrap.querySelector('[data-cparam="' + p.codigo + '"]');
        return { codigo: p.codigo, valor: el.value };
      });
      ex.correcciones = ex.correcciones || [];
      ex.correcciones.push({
        fecha: S.nowISO(), usuario: session.nombre, rol: session.rol, motivo: motivo,
        valoresAnteriores: valoresAnteriores, valoresNuevos: nuevos
      });
      ex.valores = nuevos;
      ex.version = (ex.version || 1) + 1;
      ex.fechaValidacion = S.nowISO();
      ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId;
      ex.estado = "validado";
      S.recalcEstadoGeneral(order); S.saveOrder(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "CORRECT_VALIDATED_RESULT", "resultado", order.id + ":" + ex.examId,
        "Corrigió resultado validado de " + exCat.nombre + " (Orden " + order.numeroOrden + "). Motivo: " + motivo,
        { valoresAnteriores: valoresAnteriores, valoresNuevos: nuevos });
      U.toast("Corrección registrada y trazabilidad actualizada.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }
})();

/* BIOsoft — Vista: Reportes y Envío de Resultados */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;

  window.BIO_VIEWS.reportes = function (root) {
    var session = BIO_AUTH.getSession();

    function build() {
      var orders = S.listOrders(session.tenantId).filter(function (o) {
        return o.examenes.some(function (ex) { return ex.estado === "validado" || ex.estado === "remitido" || ex.estado === "preliminar"; });
      });

      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Órdenes Listas para Reportar (' + orders.length + ')</h3></div>' +
        '<p class="text-muted" style="margin-top:0">Desde aquí puedes descargar el PDF profesional o enviarlo por correo al paciente/médico remitente. El envío de correo en este entorno de demostración se simula: se registra la trazabilidad y se abre tu cliente de correo con el mensaje listo, adjuntando manualmente el PDF descargado.</p>' +
        '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Estado</th><th>Enviado</th><th>Acciones</th></tr></thead><tbody>' +
        (orders.length ? orders.map(rowHtml).join("") : '<tr><td colspan="5" class="text-muted">Aún no hay resultados validados o preliminares para reportar.</td></tr>') +
        "</tbody></table></div></div>";

      root.querySelectorAll("[data-pdf]").forEach(function (b) { b.addEventListener("click", function () {
        var o = S.getOrder(b.dataset.pdf); window.BIO_PDF.previewOrModal(o, S.getPatient(o.patientId), BIO_AUTH.currentTenant());
      }); });
      root.querySelectorAll("[data-send]").forEach(function (b) { b.addEventListener("click", function () { openSendModal(S.getOrder(b.dataset.send), build); }); });
    }

    function rowHtml(o) {
      var pac = S.getPatient(o.patientId);
      return "<tr><td><b>" + o.numeroOrden + "</b></td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + window.BIO_badgeEstado(o.estadoGeneral) + "</td>" +
        "<td>" + (o.enviado ? '<span class="badge badge-enviado">Enviado ' + U.fmtFechaCorta(o.fechaEnvio) + "</span>" : '<span class="text-muted">No enviado</span>') + "</td>" +
        '<td><div class="flex gap-2 wrap"><button class="btn btn-outline btn-sm" data-pdf="' + o.id + '">' + U.icon("file") + " Ver / Descargar</button>" +
        '<button class="btn btn-primary btn-sm" data-send="' + o.id + '">' + U.icon("send") + " Enviar por Correo</button></div></td></tr>";
    }
    build();
  };

  function openSendModal(order, onDone) {
    var session = BIO_AUTH.getSession();
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_AUTH.currentTenant();
    var hasValidado = order.examenes.some(function (ex) { return ex.estado === "validado" || ex.estado === "remitido"; });
    var hasPreliminar = order.examenes.some(function (ex) { return ex.estado === "preliminar"; });

    var wrap = U.openModal(
      '<h3 class="modal-title">Enviar Resultados — Orden ' + order.numeroOrden + '</h3>' +
      '<div class="field"><label>Correo electrónico del destinatario</label><input id="send-email" type="email" value="' + U.esc(pac.email || "") + '"/></div>' +
      '<div class="field"><label>Tipo de envío</label><select id="send-tipo">' +
        (hasValidado ? '<option value="final">Informe Final (resultados validados)</option>' : "") +
        (hasPreliminar ? '<option value="preliminar">Informe Preliminar (resultados anticipados)</option>' : "") +
      "</select></div>" +
      '<div class="field"><label>Mensaje</label><textarea id="send-msg">Estimado(a) ' + U.esc(U.nombreCompleto(pac)) + ',\n\nAdjuntamos sus resultados de laboratorio correspondientes a la orden ' + order.numeroOrden + '.\n\n' + U.esc(tenant.nombre) + "</textarea></div>" +
      '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="send-go">' + U.icon("send") + " Descargar PDF y Abrir Correo</button></div>"
    );
    wrap.querySelector("#send-go").addEventListener("click", async function () {
      var email = wrap.querySelector("#send-email").value.trim();
      var tipo = wrap.querySelector("#send-tipo").value;
      var msg = wrap.querySelector("#send-msg").value;
      if (!email) { U.toast("Ingresa un correo electrónico válido.", "error"); return; }
      var btn = wrap.querySelector("#send-go");
      btn.disabled = true; btn.textContent = "Generando PDF…";
      var bytes = await window.BIO_PDF.buildResultadosPDF(order, pac, tenant, tipo);
      U.downloadBytes(bytes, "Resultados_" + order.numeroOrden + "_" + (tipo === "final" ? "Final" : "Preliminar") + ".pdf");
      order.enviado = true; order.fechaEnvio = S.nowISO();
      S.saveOrder(order);
      S.addAudit(session.tenantId, session.nombre, session.rol, "SEND_REPORT", "orden", order.id, "Envió el informe (" + tipo + ") de la orden " + order.numeroOrden + " a " + email + ".");
      var mailto = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent("Resultados de Laboratorio - Orden " + order.numeroOrden + " - " + tenant.nombre) + "&body=" + encodeURIComponent(msg + "\n\n(Adjunte el archivo PDF que se acaba de descargar a su equipo)");
      window.open(mailto, "_blank");
      U.toast("PDF descargado y cliente de correo abierto. Adjunta el archivo antes de enviar.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }
})();

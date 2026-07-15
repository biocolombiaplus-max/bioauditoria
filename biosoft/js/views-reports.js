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
        '<p class="text-muted" style="margin-top:0">Desde aquí puedes descargar el PDF profesional o enviarlo por correo al paciente/médico remitente. El envío abre Gmail, Outlook/Hotmail o tu correo predeterminado ya redactado — solo debes adjuntar el PDF que se descarga automáticamente.</p>' +
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
      '<div class="form-grid">' +
      '<div class="field"><label>Correo electrónico del destinatario</label><input id="send-email" type="email" value="' + U.esc(pac.email || "") + '"/></div>' +
      '<div class="field"><label>WhatsApp del paciente</label><input id="send-whatsapp" value="' + U.esc(pac.celular || "") + '"/></div>' +
      "</div>" +
      '<div class="field"><label>Tipo de envío</label><select id="send-tipo">' +
        (hasValidado ? '<option value="final">Informe Final (resultados validados)</option>' : "") +
        (hasPreliminar ? '<option value="preliminar">Informe Preliminar (resultados anticipados)</option>' : "") +
      "</select></div>" +
      '<div class="field"><label>Mensaje</label><textarea id="send-msg">Estimado(a) ' + U.esc(U.nombreCompleto(pac)) + ',\n\nAdjuntamos sus resultados de laboratorio correspondientes a la orden ' + order.numeroOrden + '.\n\n' + U.esc(tenant.nombre) + "</textarea></div>" +
      '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="send-go">' + U.icon("download") + " 1. Descargar PDF</button></div>" +
      '<div id="send-step2" class="hidden" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">' +
      '<p style="margin:0 0 4px"><b>2. Elige dónde enviarlo</b></p>' +
      '<p class="text-muted" style="margin:0 0 4px;font-size:12.5px">Se abrirá el correo o WhatsApp ya redactado — solo adjunta el PDF que acabas de descargar antes de darle enviar.</p>' +
      U.emailProviderButtonsHtml("send") +
      '<a class="btn btn-whatsapp btn-block" id="send-wa" target="_blank" rel="noopener" style="margin-top:8px">' + U.icon("send") + " Enviar por WhatsApp</a>" +
      "</div>"
    );
    wrap.querySelector("#send-go").addEventListener("click", async function () {
      var email = wrap.querySelector("#send-email").value.trim();
      var whatsapp = wrap.querySelector("#send-whatsapp").value.trim();
      var tipo = wrap.querySelector("#send-tipo").value;
      var msg = wrap.querySelector("#send-msg").value;
      if (!email && !whatsapp) { U.toast("Ingresa un correo o un número de WhatsApp.", "error"); return; }
      var btn = wrap.querySelector("#send-go");
      btn.disabled = true; btn.textContent = "Generando PDF…";
      var bytes = await window.BIO_PDF.buildResultadosPDF(order, pac, tenant, tipo);
      U.downloadBytes(bytes, "Resultados_" + order.numeroOrden + "_" + (tipo === "final" ? "Final" : "Preliminar") + ".pdf");
      order.enviado = true; order.fechaEnvio = S.nowISO();
      S.saveOrder(order);
      S.addAudit(session.tenantId, session.nombre, session.rol, "SEND_REPORT", "orden", order.id, "Envió el informe (" + tipo + ") de la orden " + order.numeroOrden + " a " + (email || whatsapp) + ".");
      btn.disabled = false; btn.textContent = "PDF descargado ✓";
      var asunto = "Resultados de Laboratorio - Orden " + order.numeroOrden + " - " + tenant.nombre;
      var cuerpo = msg + "\n\n(Adjunte el archivo PDF que se acaba de descargar a su equipo)";
      wrap.querySelector("#send-step2").classList.remove("hidden");
      U.wireEmailProviderButtons(wrap, "send", email, asunto, cuerpo);
      var waBtn = wrap.querySelector("#send-wa");
      if (whatsapp) {
        var numero = whatsapp.replace(/\D/g, "");
        if (numero.length === 10 && numero.charAt(0) === "3") numero = "57" + numero;
        waBtn.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg + "\n\n(Adjunte el PDF que se acaba de descargar antes de enviar)");
      } else {
        waBtn.classList.add("hidden");
      }
      U.toast("PDF descargado. Elige por dónde enviarlo.", "success");
      onDone();
    });
  }
})();

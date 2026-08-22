/* BIOsoft — Consentimientos Informados para toma de muestras de laboratorio
   clínico (Resolución 3100 de 2019, Colombia). Se abre desde el detalle de
   una Orden: permite generar el documento, firmarlo ahí mismo con el dedo
   en el dispositivo del laboratorio, o enviar un enlace para que el
   paciente lo firme por su cuenta desde su propio celular. */
(function () {
  "use strict";
  window.BIO_VIEWS_CONSENTIMIENTOS = window.BIO_VIEWS_CONSENTIMIENTOS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, T = BIO_CONSENTIMIENTO_TEXTO;
  var RELACION_OPCIONES = [
    { v: "paciente", l: "El propio paciente" },
    { v: "representante", l: "Representante Legal / Padre-Madre (menor de edad)" },
    { v: "testigo", l: "Testigo a Ruego (el paciente no puede firmar)" }
  ];

  function linkFirmar(tenantId, consentId) {
    var base = location.href.replace(/app\.html.*$/, "");
    return base + "firmar.html?t=" + encodeURIComponent(tenantId) + "&c=" + encodeURIComponent(consentId);
  }

  function estadoBadge(c) {
    return c.estado === "firmado" ? '<span class="badge badge-validado">✓ Firmado</span>' : '<span class="badge badge-pendiente">Pendiente de firma</span>';
  }

  window.BIO_VIEWS_CONSENTIMIENTOS.abrir = function (order, pac, tenant, onDone) {
    var session = BIO_AUTH.getSession();
    var lista = S.consentimientos.listPorOrden(tenant.id, order.id);

    function build() {
      lista = S.consentimientos.listPorOrden(tenant.id, order.id);
      var wrap = U.openModal(
        '<h3 class="modal-title">Consentimiento Informado — Orden ' + order.numeroOrden + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Documento conforme a la Resolución 3100 de 2019, para los procesos de toma de muestra que lo requieran.</p>' +
        (lista.length ? '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Procedimiento</th><th>Estado</th><th></th></tr></thead><tbody>' +
          lista.map(function (c, i) {
            return "<tr><td>" + U.fmtFecha(c.creadoEn) + "</td><td>" + (T.PROCEDIMIENTOS[c.procedimiento] || c.procedimiento) + "</td><td>" + estadoBadge(c) + "</td>" +
              "<td><div class='flex gap-2 wrap'>" +
              (c.estado === "firmado" ? "<button class='btn btn-outline btn-sm' data-descargar='" + i + "'>" + U.icon("download") + " PDF</button>" : "<button class='btn btn-outline btn-sm' data-reenviar='" + i + "'>" + U.icon("send") + " Reenviar enlace</button>") +
              "</div></td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="text-muted">Aún no se ha generado ningún consentimiento para esta orden.</p>') +
        '<button class="btn btn-primary" id="btn-nuevo-consentimiento" style="margin-top:14px">' + U.icon("plus") + " Nuevo Consentimiento</button>" +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>',
        { lg: true }
      );
      wrap.querySelectorAll("[data-descargar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var c = lista[Number(b.dataset.descargar)];
          var bytes = BIO_PDF_CONSENTIMIENTO.buildConsentimientoPDF(c);
          U.downloadBytes(bytes, "Consentimiento_" + order.numeroOrden + ".pdf");
        });
      });
      wrap.querySelectorAll("[data-reenviar]").forEach(function (b) {
        b.addEventListener("click", function () { U.closeModal(wrap); abrirEnvioEnlace(lista[Number(b.dataset.reenviar)]); });
      });
      wrap.querySelector("#btn-nuevo-consentimiento").addEventListener("click", function () { U.closeModal(wrap); abrirNuevo(); });
    }

    function poolExamenes() {
      return order.examenes.map(function (ex) { return C.examenEfectivo(ex.examId, tenant); });
    }

    // Los datos del tenant/paciente/orden se copian dentro del propio
    // registro de consentimiento (en vez de referenciarlos por id) para que
    // la página pública de firma remota (firmar.html) pueda mostrarlos y
    // generar el PDF sin necesitar permisos para leer esas otras
    // colecciones — solo puede leer este único documento. Ver
    // firestore.rules.
    function datosBase(procedimiento, examenesSel) {
      return {
        tenantId: tenant.id, orderId: order.id, patientId: pac ? pac.id : "", creadoPor: session.username,
        procedimiento: procedimiento, examenes: examenesSel,
        numeroOrden: order.numeroOrden,
        tenantNombre: tenant.nombre, tenantNit: tenant.nit, tenantPais: tenant.pais, tenantDireccion: tenant.direccion,
        tenantTelefonos: tenant.telefonos, tenantCodigoREPS: tenant.codigoREPS, tenantLogoDataUrl: tenant.logoDataUrl, tenantColorPrimario: tenant.colorPrimario,
        pacienteNombre: pac ? U.nombreCompleto(pac) : "", pacienteDocumento: pac ? (pac.tipoDocumento + " " + pac.numeroDocumento) : ""
      };
    }

    function abrirNuevo() {
      var examenes = poolExamenes();
      var wrap = U.openModal(
        '<h3 class="modal-title">Nuevo Consentimiento Informado</h3>' +
        '<div class="field"><label>Procedimiento de toma de muestra</label><select id="f_procedimiento">' +
        Object.keys(T.PROCEDIMIENTOS).map(function (k) { return "<option value='" + k + "'>" + T.PROCEDIMIENTOS[k] + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Exámenes que cubre este consentimiento</label><div class="form-grid">' +
        examenes.map(function (e) { return '<div class="checkbox-row"><input type="checkbox" checked data-consent-exam="' + e.id + '"/><label style="margin:0">' + U.esc(e.nombre) + "</label></div>"; }).join("") +
        "</div></div>" +
        '<div class="flex gap-2 wrap" style="margin-top:16px">' +
        '<button class="btn btn-primary" id="btn-firmar-aqui">' + U.icon("check") + " Firmar Aquí Ahora</button>" +
        '<button class="btn btn-outline" id="btn-enviar-lejos">' + U.icon("send") + " Enviar Enlace para Firmar a Distancia</button>" +
        "</div>" +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button></div>',
        { lg: true }
      );
      function examenesSeleccionados() {
        return wrap.querySelectorAll("[data-consent-exam]:checked").length
          ? examenes.filter(function (e) { return wrap.querySelector('[data-consent-exam="' + e.id + '"]').checked; }).map(function (e) { return { examId: e.id, nombre: e.nombre }; })
          : [];
      }
      wrap.querySelector("#btn-firmar-aqui").addEventListener("click", function () {
        var sel = examenesSeleccionados();
        if (!sel.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
        var procedimiento = wrap.querySelector("#f_procedimiento").value;
        U.closeModal(wrap);
        var c = S.consentimientos.create(datosBase(procedimiento, sel));
        abrirFirmaAqui(c);
      });
      wrap.querySelector("#btn-enviar-lejos").addEventListener("click", function () {
        var sel = examenesSeleccionados();
        if (!sel.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
        var procedimiento = wrap.querySelector("#f_procedimiento").value;
        U.closeModal(wrap);
        var c = S.consentimientos.create(datosBase(procedimiento, sel));
        abrirEnvioEnlace(c);
      });
    }

    function abrirFirmaAqui(c) {
      var texto = T.buildTextoConsentimiento(tenant.nombre, c.procedimiento, c.examenes.map(function (e) { return e.nombre; }));
      var wrap = U.openModal(
        '<h3 class="modal-title">' + U.esc(texto.titulo) + '</h3>' +
        '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:var(--surface-2);font-size:12px;line-height:1.5;margin-bottom:14px">' +
        texto.parrafos.map(function (p) { return "<p style='margin:0 0 8px'>" + U.esc(p) + "</p>"; }).join("") +
        "</div>" +
        '<fieldset><legend>Firma del Paciente / Representante Legal</legend>' +
        '<div class="form-grid">' +
        '<div class="field"><label>¿Quién firma?</label><select id="f_relacion">' + RELACION_OPCIONES.map(function (o) { return "<option value='" + o.v + "'>" + o.l + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>Nombre de quien firma</label><input id="f_nombreFirmante" value="' + (pac ? U.esc(U.nombreCompleto(pac)) : "") + '"/></div>' +
        '<div class="field"><label>Documento de quien firma</label><input id="f_documentoFirmante" value="' + (pac ? U.esc(pac.tipoDocumento + " " + pac.numeroDocumento) : "") + '"/></div>' +
        "</div>" +
        '<p class="text-muted" style="font-size:12px;margin:4px 0">Entrega el dispositivo al paciente (o a su representante) para que firme con el dedo en el recuadro:</p>' +
        '<canvas id="firma-paciente" style="width:100%;height:130px;border:1.5px dashed var(--border);border-radius:8px;background:#fff;touch-action:none"></canvas>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="btn-limpiar-paciente" style="margin-top:6px">Limpiar firma</button>' +
        "</fieldset>" +
        '<fieldset style="margin-top:10px"><legend>Firma de quien toma la muestra (opcional)</legend>' +
        '<div class="field"><label>Nombre</label><input id="f_nombreProfesional" value="' + U.esc(session.nombre) + '"/></div>' +
        '<canvas id="firma-profesional" style="width:100%;height:90px;border:1.5px dashed var(--border);border-radius:8px;background:#fff;touch-action:none"></canvas>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="btn-limpiar-profesional" style="margin-top:6px">Limpiar firma</button>' +
        "</fieldset>" +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="btn-guardar-firma">' + U.icon("check") + " Guardar y Generar PDF</button></div>",
        { lg: true }
      );
      var padPaciente = BIO_FIRMA_PAD.crear(wrap.querySelector("#firma-paciente"));
      var padProfesional = BIO_FIRMA_PAD.crear(wrap.querySelector("#firma-profesional"));
      wrap.querySelector("#btn-limpiar-paciente").addEventListener("click", function () { padPaciente.limpiar(); });
      wrap.querySelector("#btn-limpiar-profesional").addEventListener("click", function () { padProfesional.limpiar(); });
      wrap.querySelector("#btn-guardar-firma").addEventListener("click", function () {
        if (padPaciente.estaVacia()) { U.toast("Falta la firma del paciente o su representante.", "error"); return; }
        var actualizado = S.consentimientos.update(c.id, {
          estado: "firmado",
          firmaPacienteDataUrl: padPaciente.toDataURL(),
          nombreFirmante: wrap.querySelector("#f_nombreFirmante").value.trim(),
          documentoFirmante: wrap.querySelector("#f_documentoFirmante").value.trim(),
          relacionFirmante: wrap.querySelector("#f_relacion").value,
          fechaFirma: S.nowISO(),
          firmaProfesionalDataUrl: padProfesional.estaVacia() ? "" : padProfesional.toDataURL(),
          nombreProfesional: wrap.querySelector("#f_nombreProfesional").value.trim()
        });
        S.addAudit(tenant.id, session.nombre, session.rol, "FIRMAR_CONSENTIMIENTO", "consentimiento", c.id, "Firmó el consentimiento informado de la orden " + order.numeroOrden + " en el dispositivo del laboratorio.");
        var bytes = BIO_PDF_CONSENTIMIENTO.buildConsentimientoPDF(actualizado);
        U.downloadBytes(bytes, "Consentimiento_" + order.numeroOrden + ".pdf");
        U.toast("Consentimiento firmado y descargado.", "success");
        U.closeModal(wrap);
        if (onDone) onDone();
        build();
      });
    }

    function abrirEnvioEnlace(c) {
      var link = linkFirmar(tenant.id, c.id);
      var mensaje = "Hola" + (pac ? " " + U.nombreCompleto(pac).split(" ")[0] : "") + " 👋 " + tenant.nombre + " te envía el Consentimiento Informado para la toma de tu muestra de laboratorio. Por favor ábrelo y fírmalo desde tu celular antes de tu cita: " + link;
      var wrap = U.openModal(
        '<h3 class="modal-title">Enviar Consentimiento para Firmar a Distancia</h3>' +
        '<p class="text-muted" style="margin-top:0">Se generó un enlace único y seguro — el paciente lo abre en su propio celular, sin necesidad de instalar nada ni iniciar sesión, y firma con el dedo directamente en la pantalla.</p>' +
        '<div class="field"><label>Enlace de firma</label><input id="link-firma" value="' + U.esc(link) + '" readonly/></div>' +
        '<div class="flex gap-2 wrap" style="margin-top:10px">' +
        '<button class="btn btn-outline btn-sm" id="btn-copiar-link">' + U.icon("check") + " Copiar Enlace</button>" +
        (pac && pac.celular ? '<button class="btn btn-whatsapp btn-sm" id="btn-enviar-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" : "") +
        "</div>" +
        (pac && pac.email ? U.emailProviderButtonsHtml("cons-mail") : "") +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrap.querySelector("#btn-copiar-link").addEventListener("click", function () {
        navigator.clipboard.writeText(link).then(function () { U.toast("Enlace copiado.", "success"); }).catch(function () { U.toast("No se pudo copiar. Selecciónalo manualmente.", "error"); });
      });
      var btnWa = wrap.querySelector("#btn-enviar-wa");
      if (btnWa) btnWa.addEventListener("click", function () {
        window.open("https://wa.me/" + U.numeroWhatsapp(pac.celular, tenant.pais) + "?text=" + encodeURIComponent(mensaje), "_blank");
      });
      if (pac && pac.email) U.wireEmailProviderButtons(wrap, "cons-mail", pac.email, "Consentimiento Informado — " + tenant.nombre, mensaje);
      wrap.querySelector("[data-modal-close]").addEventListener("click", build);
    }

    build();
  };
})();

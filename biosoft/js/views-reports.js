/* BIOsoft — Vista: Reportes y Envío de Resultados */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;

  window.BIO_VIEWS.reportes = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var vista = "envios";

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Reportes</h3>' +
        '<div class="crm-view-toggle">' +
        '<button type="button" class="' + (vista === "envios" ? "active" : "") + '" data-vista="envios">📤 Envío de Resultados</button>' +
        '<button type="button" class="' + (vista === "admin" ? "active" : "") + '" data-vista="admin">📊 Reportes Administrativos</button>' +
        "</div></div>" +
        (vista === "envios" ? buildEnviosHtml() : buildAdminHtml()) +
        "</div>";
      root.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { vista = b.dataset.vista; build(); }); });
      if (vista === "envios") wireEnvios(); else wireAdmin();
    }

    // ---------------------------------------------------------------------
    // ENVÍO DE RESULTADOS (comportamiento original de este módulo)
    // ---------------------------------------------------------------------
    function buildEnviosHtml() {
      var orders = S.listOrders(tenantId).filter(function (o) {
        return o.examenes.some(function (ex) { return ex.estado === "validado" || ex.estado === "remitido" || ex.estado === "preliminar"; });
      });
      return '<h4 style="margin-top:14px">Órdenes Listas para Reportar (' + orders.length + ")</h4>" +
        '<p class="text-muted" style="margin-top:0">Desde aquí puedes descargar el PDF profesional o enviarlo por correo al paciente/médico remitente. El envío abre Gmail, Outlook/Hotmail o tu correo predeterminado ya redactado — solo debes adjuntar el PDF que se descarga automáticamente.</p>' +
        '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Estado</th><th>Enviado</th><th>Acciones</th></tr></thead><tbody>' +
        (orders.length ? orders.map(rowHtml).join("") : '<tr><td colspan="5" class="text-muted">Aún no hay resultados validados o preliminares para reportar.</td></tr>') +
        "</tbody></table></div>";
    }

    function wireEnvios() {
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
        '<button class="btn btn-primary btn-sm" data-send="' + o.id + '">' + U.icon("send") + " Enviar Resultados</button></div></td></tr>";
    }

    // ---------------------------------------------------------------------
    // REPORTES ADMINISTRATIVOS (inventario y reactivos)
    // ---------------------------------------------------------------------
    function primerDiaMes() {
      var d = new Date(); d.setDate(1);
      return d.toISOString().slice(0, 10);
    }
    function hoyISO() { return new Date().toISOString().slice(0, 10); }

    function buildAdminHtml() {
      var insumos = S.inventario.listInsumos(tenantId);
      return '<div class="lp-grid" style="margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">' +
        '<div class="lp-feature">' +
        '<div class="lp-ic">💊</div><h3>Gasto de Reactivos</h3>' +
        '<p>Consumo y costo de reactivos e insumos en un periodo, por examen realizado.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-gasto-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-gasto-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        '<button class="btn btn-primary btn-block" id="btn-rep-gasto">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">📦</div><h3>Inventario Valorizado</h3>' +
        '<p>Stock actual de todos tus insumos, valorizado a costo, con alertas de stock bajo y vencimiento.</p>' +
        '<button class="btn btn-primary btn-block" id="btn-rep-valorizado" style="margin-top:34px">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">📋</div><h3>Kardex por Insumo</h3>' +
        '<p>Historial completo de movimientos de un insumo específico, para auditorías.</p>' +
        '<div class="field" style="margin:10px 0"><label>Insumo</label><select id="rep-kardex-insumo">' +
        (insumos.length ? insumos.map(function (i) { return "<option value='" + i.id + "'>" + U.esc(i.nombre) + "</option>"; }).join("") : "<option value=''>No hay insumos registrados</option>") +
        "</select></div>" +
        '<button class="btn btn-primary btn-block" id="btn-rep-kardex" ' + (insumos.length ? "" : "disabled") + ">" + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">🧾</div><h3>Cartera de Clientes</h3>' +
        '<p>Valor total, abonado y saldo pendiente de las órdenes del periodo — general, o agrupado por Aliado (Convenio) o por Paciente.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-cartera-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-cartera-hasta" value="' + hoyISO() + '"/></div>' +
        '</div>' +
        '<div class="field" style="margin:0 0 10px"><label>Agrupar por</label><select id="rep-cartera-agrupar">' +
        '<option value="aliado">Aliado (Convenio)</option>' +
        '<option value="paciente">Paciente</option>' +
        '<option value="general">Detalle general (sin agrupar)</option>' +
        "</select></div>" +
        '<button class="btn btn-primary btn-block" id="btn-rep-cartera">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        "</div>";
    }

    function wireAdmin() {
      var tenant = BIO_AUTH.currentTenant();
      var btnGasto = document.getElementById("btn-rep-gasto");
      if (btnGasto) btnGasto.addEventListener("click", function () {
        var desde = document.getElementById("rep-gasto-desde").value;
        var hasta = document.getElementById("rep-gasto-hasta").value;
        var insumos = S.inventario.listInsumos(tenantId);
        var insumosPorId = {}; insumos.forEach(function (i) { insumosPorId[i.id] = i; });
        var movimientos = S.inventario.listKardex(tenantId).filter(function (m) { return m.fecha.slice(0, 10) >= desde && m.fecha.slice(0, 10) <= hasta; });
        var bytes = BIO_PDF_INVENTARIO.buildGastoReactivosPDF(movimientos, insumosPorId, tenant, desde, hasta);
        U.downloadBytes(bytes, "Gasto_Reactivos_" + desde + "_a_" + hasta + ".pdf");
        U.toast("Reporte de gasto de reactivos descargado.", "success");
      });
      var btnValorizado = document.getElementById("btn-rep-valorizado");
      if (btnValorizado) btnValorizado.addEventListener("click", function () {
        var insumos = S.inventario.listInsumos(tenantId);
        var bytes = BIO_PDF_INVENTARIO.buildInventarioValorizadoPDF(insumos, tenant);
        U.downloadBytes(bytes, "Inventario_Valorizado_" + hoyISO() + ".pdf");
        U.toast("Reporte de inventario valorizado descargado.", "success");
      });
      var btnKardex = document.getElementById("btn-rep-kardex");
      if (btnKardex) btnKardex.addEventListener("click", function () {
        var insumoId = document.getElementById("rep-kardex-insumo").value;
        if (!insumoId) return;
        var insumo = S.inventario.getInsumo(insumoId);
        var movimientos = S.inventario.listKardex(tenantId, insumoId);
        var bytes = BIO_PDF_INVENTARIO.buildKardexInsumoPDF(insumo, movimientos, tenant);
        U.downloadBytes(bytes, "Kardex_" + insumo.nombre.replace(/\s+/g, "_") + ".pdf");
        U.toast("Kardex descargado.", "success");
      });
      var btnCartera = document.getElementById("btn-rep-cartera");
      if (btnCartera) btnCartera.addEventListener("click", function () {
        if (!tenant.mostrarPrecioOrden) {
          U.toast('Activa "Mostrar precio en la orden" en Configuración del Laboratorio para poder generar este reporte.', "error");
          return;
        }
        var desde = document.getElementById("rep-cartera-desde").value;
        var hasta = document.getElementById("rep-cartera-hasta").value;
        var agrupacion = document.getElementById("rep-cartera-agrupar").value;
        var orders = S.listOrders(tenantId).filter(function (o) {
          var fecha = (o.fechaOrden || "").slice(0, 10);
          return fecha >= desde && fecha <= hasta && o.valorCobrar != null;
        });
        // "Abonado" hoy solo refleja el estado binario del Recibo de Pago
        // (order.pago: pagada la orden completa, o pendiente) — BIOsoft aún
        // no lleva abonos parciales por orden. Si el laboratorio necesita
        // registrar pagos parciales en el tiempo, es una funcionalidad
        // aparte por construir; este reporte usa lo que ya existe hoy.
        var filas = orders.map(function (o) {
          var pac = S.getPatient(o.patientId);
          var valorTotal = o.valorCobrar || 0;
          var valorAbonado = o.pago ? valorTotal : 0;
          return {
            numeroOrden: o.numeroOrden,
            fecha: o.fechaOrden,
            paciente: pac ? U.nombreCompleto(pac) : "—",
            aliado: o.convenioNombre || "Particulares",
            valorTotal: valorTotal,
            valorAbonado: valorAbonado,
            saldoPendiente: valorTotal - valorAbonado
          };
        }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var bytes = BIO_PDF_CARTERA.buildCarteraPDF(filas, tenant, desde, hasta, agrupacion);
        U.downloadBytes(bytes, "Cartera_" + desde + "_a_" + hasta + ".pdf");
        U.toast("Reporte de cartera descargado.", "success");
      });
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
      '<div class="field"><label>Correo electrónico del destinatario</label><input id="send-email" type="email" value="' + U.esc(pac.email || "") + '" autocomplete="off"/></div>' +
      '<div class="field"><label>WhatsApp del paciente</label><input id="send-whatsapp" value="' + U.esc(pac.celular || "") + '" autocomplete="off"/></div>' +
      "</div>" +
      // Ya vienen precargados del registro del paciente (arriba) — este
      // aviso solo aparece si al paciente le falta guardar el correo y/o el
      // WhatsApp, para poder agregarlo aquí mismo sin salir de la pantalla.
      '<div id="send-sin-contacto" class="' + (pac.email && pac.celular ? "hidden" : "") + '" style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
      '<span>Este paciente no tiene ' + (!pac.email && !pac.celular ? "correo ni WhatsApp guardados" : !pac.email ? "correo guardado" : "WhatsApp guardado") + ' — puedes escribirlo arriba solo para este envío, o agregarlo a su ficha para que quede precargado la próxima vez.</span>' +
      '<button type="button" class="btn btn-outline btn-sm" id="send-agregar-contacto" style="flex-shrink:0">Agregar a su ficha</button>' +
      "</div>" +
      '<div class="field"><label>Tipo de envío</label><select id="send-tipo">' +
        (hasValidado ? '<option value="final">Informe Final (resultados validados)</option>' : "") +
        (hasPreliminar ? '<option value="preliminar">Informe Preliminar (resultados anticipados)</option>' : "") +
      "</select></div>" +
      '<div class="field"><label>Mensaje</label><textarea id="send-msg">Estimado(a) ' + U.esc(U.nombreCompleto(pac)) + ',\n\nAdjuntamos sus resultados de laboratorio correspondientes a la orden ' + order.numeroOrden + '.\n\n' + U.esc(tenant.nombre) + "</textarea></div>" +
      '<p class="text-muted" style="margin:0 0 10px;font-size:12.5px">Un solo clic: se descarga el PDF y se abre WhatsApp o tu correo ya redactado — solo adjunta el archivo que se acaba de descargar antes de darle enviar (ningún navegador permite adjuntarlo automáticamente).</p>' +
      '<button type="button" class="btn btn-whatsapp btn-block" id="send-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" +
      '<div class="flex gap-2 wrap" style="margin-top:8px">' +
      '<button type="button" class="btn btn-outline btn-sm" id="send-gmail">📧 Enviar por Gmail</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="send-outlook">📧 Enviar por Outlook / Hotmail</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="send-mailto">Mi correo predeterminado</button>' +
      "</div>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">' +
      '<button class="btn btn-ghost" data-modal-close>Cancelar</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="send-solo-descargar">' + U.icon("download") + " Solo descargar PDF</button>" +
      "</div>"
    );

    var btnAgregarContacto = wrap.querySelector("#send-agregar-contacto");
    if (btnAgregarContacto) {
      btnAgregarContacto.addEventListener("click", function () {
        window.BIO_openPatientForm(pac, function () {
          // Al guardar, se refresca el paciente y se precargan los campos
          // de este mismo modal (sin cerrarlo, para no perder el mensaje
          // que ya se haya escrito) en vez de exigir volver a abrir "Enviar
          // Resultados" desde cero.
          pac = S.getPatient(order.patientId);
          wrap.querySelector("#send-email").value = pac.email || "";
          wrap.querySelector("#send-whatsapp").value = pac.celular || "";
          wrap.querySelector("#send-sin-contacto").classList.toggle("hidden", !!(pac.email && pac.celular));
          U.toast("Datos de contacto actualizados.", "success");
        });
      });
    }

    // Los tres botones de canal (WhatsApp/Gmail/Outlook/correo predeterminado)
    // y el de "solo descargar" hacen lo mismo primero: generan y descargan
    // el PDF una única vez (nunca dos veces, gracias a pdfCache) — no hace
    // falta que el cliente descargue aparte antes de poder enviar. Adjuntar
    // el archivo al mensaje sigue siendo manual porque ningún navegador
    // permite adjuntarlo automáticamente desde un enlace de WhatsApp/correo.
    var pdfCache = null;
    function obtenerPdf() {
      if (pdfCache) return Promise.resolve(pdfCache);
      var tipo = wrap.querySelector("#send-tipo").value;
      return window.BIO_PDF.buildResultadosPDF(order, pac, tenant, tipo).then(function (bytes) {
        pdfCache = bytes;
        U.downloadBytes(bytes, "Resultados_" + order.numeroOrden + "_" + (tipo === "final" ? "Final" : "Preliminar") + ".pdf");
        order.enviado = true; order.fechaEnvio = S.nowISO();
        S.saveOrder(order);
        return bytes;
      });
    }
    function registrarEnvio(destino) {
      var tipo = wrap.querySelector("#send-tipo").value;
      S.addAudit(session.tenantId, session.nombre, session.rol, "SEND_REPORT", "orden", order.id, "Envió el informe (" + tipo + ") de la orden " + order.numeroOrden + " a " + destino + ".");
      onDone();
    }
    function conBotonOcupado(btn, tarea) {
      var htmlOriginal = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = "Generando PDF…";
      return tarea().finally(function () { btn.disabled = false; btn.innerHTML = htmlOriginal; });
    }

    wrap.querySelector("#send-wa").addEventListener("click", function (e) {
      var whatsapp = wrap.querySelector("#send-whatsapp").value.trim();
      if (!whatsapp) { U.toast("Ingresa el WhatsApp del paciente.", "error"); return; }
      // La pestaña se abre EN BLANCO aquí mismo, de forma síncrona dentro del
      // clic (para que el navegador no la bloquee como pop-up no solicitado)
      // y solo se le asigna la URL de WhatsApp una vez el PDF ya se generó y
      // descargó — si se abriera después del await, Chrome suele bloquearla
      // en silencio porque ya no la reconoce como originada por un clic.
      var pestana = window.open("", "_blank");
      conBotonOcupado(e.currentTarget, function () {
        return obtenerPdf().then(function () {
          var msg = wrap.querySelector("#send-msg").value;
          var numero = U.numeroWhatsapp(whatsapp, tenant.pais);
          // El recordatorio de "adjunta el PDF" es para quien está
          // enviando (ya va en el texto de ayuda de esta pantalla) — no
          // debe ir dentro del mensaje que de verdad recibe el paciente
          // (bug real reportado: se veía textual en el WhatsApp del
          // paciente).
          var url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg);
          if (pestana) pestana.location.href = url; else window.open(url, "_blank");
          registrarEnvio(whatsapp);
          U.toast("PDF descargado y WhatsApp abierto — adjunta el archivo antes de enviar.", "success");
        }).catch(function (err) {
          if (pestana) pestana.close();
          throw err;
        });
      });
    });

    [
      { id: "send-gmail", buildUrl: function (links) { return links.gmail; } },
      { id: "send-outlook", buildUrl: function (links) { return links.outlook; } },
      { id: "send-mailto", buildUrl: function (links) { return links.mailto; } }
    ].forEach(function (canal) {
      wrap.querySelector("#" + canal.id).addEventListener("click", function (e) {
        var correo = wrap.querySelector("#send-email").value.trim();
        if (!correo) { U.toast("Ingresa el correo del destinatario.", "error"); return; }
        var pestana = window.open("", "_blank");
        conBotonOcupado(e.currentTarget, function () {
          return obtenerPdf().then(function () {
            var asunto = "Resultados de Laboratorio - Orden " + order.numeroOrden + " - " + tenant.nombre;
            var cuerpo = wrap.querySelector("#send-msg").value;
            var url = canal.buildUrl(U.emailLinks(correo, asunto, cuerpo));
            if (pestana) pestana.location.href = url; else window.open(url, "_blank");
            registrarEnvio(correo);
            U.toast("PDF descargado y correo abierto — adjunta el archivo antes de enviar.", "success");
          }).catch(function (err) {
            if (pestana) pestana.close();
            throw err;
          });
        });
      });
    });

    wrap.querySelector("#send-solo-descargar").addEventListener("click", function (e) {
      conBotonOcupado(e.currentTarget, function () {
        return obtenerPdf().then(function () { U.toast("PDF descargado.", "success"); });
      });
    });
  }
})();

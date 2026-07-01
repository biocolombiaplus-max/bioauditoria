/* BIOsoft — Vista: Hojas de Trabajo Diarias (impresión y diligenciamiento en pantalla) */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  window.BIO_VIEWS["hojas-trabajo"] = function (root) {
    var session = BIO_AUTH.getSession();
    var seccionesDisponibles = session.rol === "bacteriologo" && session.secciones.length ? C.SECCIONES.filter(function (s) { return session.secciones.indexOf(s.id) !== -1; }) : C.SECCIONES;
    var fecha = new Date().toISOString().slice(0, 10);
    var seccion = seccionesDisponibles[0] ? seccionesDisponibles[0].id : "hematologia";
    var modoPantalla = false;

    function itemsFor(fecha, seccion) {
      var orders = S.listOrders(session.tenantId);
      var out = [];
      orders.forEach(function (o) {
        if (o.fechaOrden.slice(0, 10) !== fecha) return;
        o.examenes.forEach(function (ex, idx) {
          if (ex.seccion === seccion && ex.estado !== "validado") out.push({ order: o, ex: ex, idx: idx });
        });
      });
      return out;
    }

    function build() {
      var tenant = BIO_AUTH.currentTenant();
      var items = itemsFor(fecha, seccion);
      root.innerHTML =
        '<div class="card no-print"><div class="card-header"><h3 class="card-title">Generar Hoja de Trabajo</h3></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Fecha</label><input type="date" id="hw-fecha" value="' + fecha + '"/></div>' +
          '<div class="field"><label>Sección del Laboratorio</label><select id="hw-seccion">' + seccionesDisponibles.map(function (s) { return '<option value="' + s.id + '" ' + (s.id === seccion ? "selected" : "") + ">" + s.nombre + "</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label>Modo</label><div class="checkbox-row" style="margin-top:9px"><input type="checkbox" id="hw-modo" ' + (modoPantalla ? "checked" : "") + '/><label style="margin:0" for="hw-modo">Diligenciar en pantalla (en vez de imprimir en papel)</label></div></div>' +
        "</div>" +
        '<div class="flex gap-2"><button class="btn btn-outline" id="hw-print">' + U.icon("printer") + ' Imprimir Hoja</button></div></div>' +
        '<div class="card print-sheet" id="hw-sheet" style="margin-top:16px"></div>';

      var sheet = document.getElementById("hw-sheet");
      var seccionNombre = C.seccionNombre(seccion);
      var header =
        '<div class="report-header"><div>' +
          '<div class="report-lab-name">' + U.esc(tenant.nombre) + '</div>' +
          '<div class="report-lab-meta">NIT ' + U.esc(tenant.nit) + " · " + U.esc(tenant.direccion) + "<br/>" + U.esc(tenant.telefonos) + " · " + U.esc(tenant.email) + "</div></div>" +
          (tenant.logoDataUrl ? '<img src="' + tenant.logoDataUrl + '"/>' : "") +
        "</div>" +
        "<h2 style='margin:14px 0 2px'>Hoja de Trabajo Diaria</h2>" +
        "<p class='text-muted' style='margin:0 0 16px'>Sección: <b>" + seccionNombre + "</b> · Fecha: <b>" + U.fmtFechaCorta(fecha + "T00:00:00") + "</b> · Generada por: " + U.esc(session.nombre) + "</p>";

      if (!items.length) {
        sheet.innerHTML = header + '<p class="text-muted">No hay exámenes pendientes de esta sección para la fecha seleccionada.</p>';
      } else if (!modoPantalla) {
        sheet.innerHTML = header +
          '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Edad/Sexo</th><th>Examen</th>' +
          '<th>Resultado(s)</th><th>Observaciones</th></tr></thead><tbody>' +
          items.map(function (it) {
            var pac = S.getPatient(it.order.patientId);
            var exCat = C.examenEfectivo(it.ex.examId, tenant);
            return "<tr><td>" + it.order.numeroOrden + (it.order.prioridad === "Urgente" ? ' <span class="badge badge-urgente">URG</span>' : "") + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + (pac ? U.calcEdad(pac.fechaNacimiento) + "/" + pac.sexo[0] : "") + "</td><td>" + U.esc(exCat.nombre) + '<div class="text-muted" style="font-size:11px">' + exCat.parametros.map(function (p) { return p.nombre; }).join(", ") + "</div></td>" +
              '<td style="min-width:160px;border-left:1px dashed #cbd5e1">&nbsp;</td><td style="min-width:140px">&nbsp;</td></tr>';
          }).join("") + "</tbody></table></div>" +
          '<p style="margin-top:26px" class="text-muted">Firma del Bacteriólogo(a) responsable: _______________________________</p>';
      } else {
        sheet.innerHTML = header + '<div id="hw-cards"></div>' +
          '<div class="flex justify-between no-print" style="margin-top:14px"><div></div><button class="btn btn-primary" id="hw-guardar">' + U.icon("check") + " Guardar todo como borrador</button></div>";
        var host = sheet.querySelector("#hw-cards");
        items.forEach(function (it) {
          var pac = S.getPatient(it.order.patientId);
          var exCat = C.examenEfectivo(it.ex.examId, tenant);
          var valuesMap = {};
          it.ex.valores.forEach(function (v) { valuesMap[v.codigo] = v.valor; });
          var div = document.createElement("div");
          div.style.borderTop = "1px solid var(--border)";
          div.style.padding = "12px 0";
          div.innerHTML = "<b>" + it.order.numeroOrden + " — " + (pac ? U.esc(U.nombreCompleto(pac)) : "") + "</b> · " + U.esc(exCat.nombre) +
            '<div class="form-grid" style="margin-top:8px">' +
            exCat.parametros.map(function (p) {
              var val = valuesMap[p.codigo] || "";
              var inputHtml = p.tipo === "cualitativo"
                ? '<select data-hwparam="' + it.order.id + "|" + it.idx + "|" + p.codigo + '"><option value="">—</option>' + p.opciones.map(function (o) { return '<option ' + (o === val ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select>"
                : '<input data-hwparam="' + it.order.id + "|" + it.idx + "|" + p.codigo + '" value="' + U.esc(val) + '"/>';
              return '<div class="field"><label>' + p.nombre + " (" + (p.unidad || "-") + ")</label>" + inputHtml + "</div>";
            }).join("") + "</div>";
          host.appendChild(div);
        });
      }

      document.getElementById("hw-fecha").addEventListener("change", function (e) { fecha = e.target.value; build(); });
      document.getElementById("hw-seccion").addEventListener("change", function (e) { seccion = e.target.value; build(); });
      document.getElementById("hw-modo").addEventListener("change", function (e) { modoPantalla = e.target.checked; build(); });
      document.getElementById("hw-print").addEventListener("click", function () { window.print(); });
      var btnGuardar = document.getElementById("hw-guardar");
      if (btnGuardar) btnGuardar.addEventListener("click", function () {
        var count = 0;
        document.querySelectorAll("[data-hwparam]").forEach(function (el) {
          var parts = el.dataset.hwparam.split("|");
          var order = S.getOrder(parts[0]);
          var ex = order.examenes[parseInt(parts[1], 10)];
          if (!el.value) return;
          var v = ex.valores.filter(function (x) { return x.codigo === parts[2]; })[0];
          if (v) v.valor = el.value; else ex.valores.push({ codigo: parts[2], valor: el.value });
          if (ex.estado === "pendiente") ex.estado = "en_proceso";
          ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          count++;
        });
        S.addAudit(session.tenantId, session.nombre, session.rol, "BULK_SAVE_WORKSHEET", "hoja_trabajo", seccion, "Guardó " + count + " valor(es) desde la hoja de trabajo en pantalla de la sección " + C.seccionNombre(seccion) + ".");
        U.toast("Se guardaron los valores diligenciados como borrador.", "success");
        build();
      });
    }
    build();
  };
})();

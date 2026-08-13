/* BIOsoft — Vista: Facturación y RIPS (SOLO Colombia).
   Esta pantalla solo se muestra a laboratorios con tenant.pais === "CO"
   (ver router.js). Cubre dos cosas, con honestidad sobre lo que BIOsoft sí
   hace y lo que queda en manos del laboratorio:
     1) RIPS: arma y descarga el JSON (Resolución 2275/2023) listo para subir
        a la plataforma de MinSalud, que es quien valida y asigna el CUV.
     2) Facturación electrónica DIAN: BIOsoft NO es un facturador electrónico
        certificado por la DIAN. Aquí se prepara el borrador de la factura
        (FV) y se guarda el proveedor tecnológico autorizado que cada
        laboratorio ya tenga o elija, listo para una futura integración. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  function fmtMoneda(n) { return "$" + Math.round(n || 0).toLocaleString("es-CO"); }
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function primerDiaMesISO() {
    var d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  }

  window.BIO_VIEWS.facturacion = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();

    var st = { desde: primerDiaMesISO(), hasta: hoyISO(), ordenesEncontradas: [], seleccion: {} };

    root.innerHTML =
      '<div class="card">' +
        '<div class="card-header"><h3 class="card-title">🇨🇴 Facturación y RIPS</h3></div>' +
        '<p class="text-muted" style="margin-top:0">Módulo exclusivo para laboratorios en Colombia. ' + U.esc(C.RIPS_DISCLAIMER) + '</p>' +
        '<p class="text-muted" style="font-size:12.5px">Importante sobre la factura electrónica: BIOsoft <b>no es un facturador electrónico certificado por la DIAN</b>. Aquí preparas los datos y eliges tu proveedor tecnológico autorizado; la emisión legal de la factura la hace ese proveedor (o el facturador gratuito de la DIAN).</p>' +
      "</div>" +

      '<div class="card" id="card-rips">' +
        '<div class="card-header"><h3 class="card-title">RIPS — Registro Individual de Prestación de Servicios de Salud</h3></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Desde</label><input type="date" id="f_rips_desde" value="' + st.desde + '"/></div>' +
          '<div class="field"><label>Hasta</label><input type="date" id="f_rips_hasta" value="' + st.hasta + '"/></div>' +
        "</div>" +
        '<button type="button" class="btn btn-outline" id="btn-buscar-ordenes">' + U.icon("search") + ' Buscar Órdenes en el Rango</button>' +
        '<div id="rips-resultado" style="margin-top:14px"></div>' +
        '<h4 style="margin:20px 0 8px">Historial de RIPS Generados</h4>' +
        '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Rango</th><th>Usuarios</th><th>Procedimientos</th><th></th></tr></thead><tbody id="rips-historial"></tbody></table></div>' +
      "</div>" +

      '<div class="card" id="card-proveedor">' +
        '<div class="card-header"><h3 class="card-title">Facturación Electrónica — Proveedor Autorizado por la DIAN</h3></div>' +
        '<p class="text-muted" style="margin-top:0">Para emitir facturas electrónicas válidas ante la DIAN necesitas un proveedor tecnológico autorizado (o el facturador gratuito de la DIAN). Elige aquí el que ya tengas o vayas a contratar — cada laboratorio cliente de BIOsoft puede elegir uno distinto, esto no afecta a los demás.</p>' +
        '<form id="form-proveedor">' +
          '<div class="form-grid">' +
            '<div class="field"><label>Proveedor</label><select id="f_proveedorId">' +
              C.PROVEEDORES_FACTURACION_CO.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.nombre) + "</option>"; }).join("") +
            "</select></div>" +
            '<div class="field"><label>Resolución de Facturación DIAN (si ya la tienes)</label><input id="f_resolucionDian" placeholder="Ej. Resolución 000123 de 2025"/></div>' +
            '<div class="field"><label>Rango de Numeración Autorizado</label><input id="f_rangoNumeracion" placeholder="Ej. FE-1 a FE-5000"/></div>' +
          "</div>" +
          '<div class="field"><label>Notas</label><textarea id="f_notasProveedor" placeholder="Usuario/cuenta del proveedor, contacto, etc. (opcional)"></textarea></div>' +
          '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Proveedor</button>" +
        "</form>" +
        '<p id="proveedor-actual" class="text-muted" style="margin-top:10px;font-size:12.5px"></p>' +
      "</div>" +

      '<div class="card" id="card-fv">' +
        '<div class="card-header"><h3 class="card-title">Factura de Venta (FV) — Borrador Interno</h3></div>' +
        '<p class="text-muted" style="margin-top:0">Arma el detalle de una factura a partir de una orden ya creada (paciente, exámenes y precios de tu lista de precios). <b>Esto es un borrador interno, no un documento electrónico válido ante la DIAN</b> hasta que lo emitas con tu proveedor autorizado. La mayoría de servicios de laboratorio clínico están excluidos de IVA (Art. 476 Num. 1 del Estatuto Tributario), por eso el IVA queda en $0 — ajústalo si tu caso es distinto.</p>' +
        '<div class="form-grid">' +
          '<div class="field"><label>N° de Orden</label><input id="f_fv_orden" placeholder="Ej. 20260001"/></div>' +
          '<button type="button" class="btn btn-outline" id="btn-cargar-orden" style="align-self:end">Cargar Orden</button>' +
        "</div>" +
        '<div id="fv-detalle" style="margin-top:10px"></div>' +
        '<h4 style="margin:20px 0 8px">Historial de Facturas (Borrador)</h4>' +
        '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Paciente</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody id="fv-historial"></tbody></table></div>' +
      "</div>";

    // ---------------- RIPS ----------------
    function renderHistorialRips() {
      var lista = S.facturacion.listRipsGenerados(tenant.id);
      document.getElementById("rips-historial").innerHTML = lista.length
        ? lista.map(function (r) {
            return "<tr><td>" + U.fmtFecha(r.generadoEn) + "</td><td>" + U.esc(r.desde) + " a " + U.esc(r.hasta) + "</td><td>" + r.cantidadUsuarios + "</td><td>" + r.cantidadProcedimientos + "</td>" +
              '<td><button class="btn btn-outline btn-sm" data-descargar-rips="' + r.id + '">' + U.icon("download") + " Descargar</button></td></tr>";
          }).join("")
        : '<tr><td colspan="5" class="text-muted">Aún no has generado ningún RIPS.</td></tr>';
      document.querySelectorAll("[data-descargar-rips]").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = lista.filter(function (x) { return x.id === b.dataset.descargarRips; })[0];
          if (!r) return;
          U.downloadBytes(JSON.stringify(r.json, null, 2), "RIPS_" + tenant.nombre.replace(/\s+/g, "_") + "_" + r.desde + "_a_" + r.hasta + ".json", "application/json");
        });
      });
    }

    document.getElementById("btn-buscar-ordenes").addEventListener("click", function () {
      st.desde = document.getElementById("f_rips_desde").value;
      st.hasta = document.getElementById("f_rips_hasta").value;
      if (!st.desde || !st.hasta) { U.toast("Selecciona el rango de fechas.", "error"); return; }
      var todas = S.listOrders(tenant.id);
      st.ordenesEncontradas = todas.filter(function (o) {
        var f = (o.fechaOrden || "").slice(0, 10);
        return f >= st.desde && f <= st.hasta;
      });
      st.seleccion = {};
      st.ordenesEncontradas.forEach(function (o) { st.seleccion[o.id] = true; });
      renderResultadoRips();
    });

    function renderResultadoRips() {
      var host = document.getElementById("rips-resultado");
      if (!st.ordenesEncontradas.length) {
        host.innerHTML = '<p class="text-muted">No se encontraron órdenes en ese rango de fechas.</p>';
        return;
      }
      host.innerHTML =
        '<div class="table-wrap" style="max-height:320px;overflow-y:auto"><table><thead><tr><th></th><th>N° Orden</th><th>Paciente</th><th>Fecha</th><th># Exámenes</th></tr></thead><tbody>' +
        st.ordenesEncontradas.map(function (o) {
          var pac = S.getPatient(o.patientId);
          return '<tr><td><input type="checkbox" data-sel-orden="' + o.id + '" ' + (st.seleccion[o.id] ? "checked" : "") + '/></td>' +
            "<td>" + o.numeroOrden + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + U.fmtFecha(o.fechaOrden) + "</td><td>" + o.examenes.length + "</td></tr>";
        }).join("") +
        "</tbody></table></div>" +
        '<button type="button" class="btn btn-primary" id="btn-generar-rips" style="margin-top:12px">' + U.icon("check") + " Generar RIPS JSON de las Órdenes Seleccionadas</button>";
      host.querySelectorAll("[data-sel-orden]").forEach(function (chk) {
        chk.addEventListener("change", function () { st.seleccion[chk.dataset.selOrden] = chk.checked; });
      });
      document.getElementById("btn-generar-rips").addEventListener("click", function () {
        var seleccionadas = st.ordenesEncontradas.filter(function (o) { return st.seleccion[o.id]; });
        if (!seleccionadas.length) { U.toast("Selecciona al menos una orden.", "error"); return; }
        var json = BIO_RIPS.generarRipsParaOrdenes(tenant, seleccionadas);
        var cantidadProcedimientos = BIO_RIPS.contarProcedimientos(json);
        var registro = S.facturacion.guardarRipsGenerado(tenant.id, {
          desde: st.desde, hasta: st.hasta, cantidadUsuarios: json.usuarios.length, cantidadProcedimientos: cantidadProcedimientos,
          ordenesIncluidas: seleccionadas.map(function (o) { return o.numeroOrden; }), generadoPor: session.username, json: json
        });
        S.addAudit(tenant.id, session.nombre, session.rol, "GENERATE_RIPS", "rips", registro.id, "Generó un RIPS con " + json.usuarios.length + " usuario(s) y " + cantidadProcedimientos + " procedimiento(s) (" + st.desde + " a " + st.hasta + ").");
        U.downloadBytes(JSON.stringify(json, null, 2), "RIPS_" + tenant.nombre.replace(/\s+/g, "_") + "_" + st.desde + "_a_" + st.hasta + ".json", "application/json");
        U.toast("RIPS generado y descargado: " + json.usuarios.length + " usuario(s), " + cantidadProcedimientos + " procedimiento(s).", "success");
        renderHistorialRips();
      });
    }

    renderHistorialRips();

    // ---------------- Proveedor de Facturación Electrónica ----------------
    function pintarProveedorActual() {
      var fe = tenant.facturacionElectronica;
      var box = document.getElementById("proveedor-actual");
      if (!fe || !fe.proveedorId) { box.textContent = "Aún no has configurado un proveedor de facturación electrónica."; return; }
      var prov = C.PROVEEDORES_FACTURACION_CO.filter(function (p) { return p.id === fe.proveedorId; })[0];
      box.innerHTML = "✅ Proveedor configurado: <b>" + U.esc(prov ? prov.nombre : fe.proveedorId) + "</b>" + (fe.resolucionDian ? " · Resolución: " + U.esc(fe.resolucionDian) : "") + (fe.rangoNumeracion ? " · Numeración: " + U.esc(fe.rangoNumeracion) : "");
    }
    (function precargarProveedor() {
      var fe = tenant.facturacionElectronica;
      if (fe) {
        if (fe.proveedorId) document.getElementById("f_proveedorId").value = fe.proveedorId;
        document.getElementById("f_resolucionDian").value = fe.resolucionDian || "";
        document.getElementById("f_rangoNumeracion").value = fe.rangoNumeracion || "";
        document.getElementById("f_notasProveedor").value = fe.notas || "";
      }
      pintarProveedorActual();
    })();
    document.getElementById("form-proveedor").addEventListener("submit", function (e) {
      e.preventDefault();
      var datos = {
        proveedorId: document.getElementById("f_proveedorId").value,
        resolucionDian: document.getElementById("f_resolucionDian").value.trim(),
        rangoNumeracion: document.getElementById("f_rangoNumeracion").value.trim(),
        notas: document.getElementById("f_notasProveedor").value.trim(),
        actualizadoEn: S.nowISO(), actualizadoPor: session.username
      };
      tenant = S.facturacion.setProveedorFacturacion(tenant.id, datos);
      S.addAudit(tenant.id, session.nombre, session.rol, "SET_PROVEEDOR_FACTURACION", "tenant", tenant.id, "Configuró el proveedor de facturación electrónica: " + datos.proveedorId + ".");
      U.toast("Proveedor de facturación guardado.", "success");
      pintarProveedorActual();
    });

    // ---------------- Factura de Venta (borrador) ----------------
    var ordenCargada = null;
    function renderHistorialFv() {
      var lista = S.facturacion.listFacturasGeneradas(tenant.id);
      document.getElementById("fv-historial").innerHTML = lista.length
        ? lista.map(function (f) {
            return "<tr><td>" + f.numero + "</td><td>" + U.fmtFecha(f.generadoEn) + "</td><td>" + U.esc(f.pacienteNombre) + "</td><td>" + fmtMoneda(f.total) + "</td><td><span class='badge'>" + U.esc(f.estado) + "</span></td>" +
              '<td><button class="btn btn-outline btn-sm" data-descargar-fv="' + f.id + '">' + U.icon("download") + " JSON</button></td></tr>";
          }).join("")
        : '<tr><td colspan="6" class="text-muted">Aún no has generado ninguna factura borrador.</td></tr>';
      document.querySelectorAll("[data-descargar-fv]").forEach(function (b) {
        b.addEventListener("click", function () {
          var f = lista.filter(function (x) { return x.id === b.dataset.descargarFv; })[0];
          if (!f) return;
          U.downloadBytes(JSON.stringify(f, null, 2), "FV_borrador_" + f.numero + ".json", "application/json");
        });
      });
    }
    renderHistorialFv();

    document.getElementById("btn-cargar-orden").addEventListener("click", function () {
      var numero = document.getElementById("f_fv_orden").value.trim();
      if (!numero) { U.toast("Escribe el número de orden.", "error"); return; }
      var order = S.getOrderByNumero(tenant.id, numero);
      if (!order) { U.toast("No se encontró la orden " + numero + ".", "error"); return; }
      ordenCargada = order;
      renderDetalleFv();
    });

    function renderDetalleFv() {
      var host = document.getElementById("fv-detalle");
      var pac = S.getPatient(ordenCargada.patientId);
      var precios = {};
      S.cotizador.listPrecios(tenant.id).forEach(function (p) { precios[p.examId] = p.precio; });
      var items = ordenCargada.examenes.map(function (ex) {
        var exCat = C.examenEfectivo(ex.examId, tenant);
        return { examId: ex.examId, nombre: exCat ? exCat.nombre : ex.examId, cups: exCat ? exCat.cups : "", precio: precios[ex.examId] || 0 };
      });
      var subtotal = items.reduce(function (a, it) { return a + it.precio; }, 0);
      host.innerHTML =
        '<p><b>Paciente:</b> ' + (pac ? U.esc(U.nombreCompleto(pac)) + " — " + pac.tipoDocumento + " " + U.esc(pac.numeroDocumento) : "—") + "</p>" +
        '<div class="table-wrap"><table><thead><tr><th>Examen</th><th>CUPS</th><th>Valor</th></tr></thead><tbody>' +
        items.map(function (it) { return "<tr><td>" + U.esc(it.nombre) + "</td><td>" + U.esc(it.cups) + "</td><td>" + fmtMoneda(it.precio) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
        '<p style="text-align:right;margin-top:8px">Subtotal: <b>' + fmtMoneda(subtotal) + '</b><br/>IVA (servicios de salud exentos): <b>$0</b><br/>Total: <b>' + fmtMoneda(subtotal) + "</b></p>" +
        '<button type="button" class="btn btn-primary" id="btn-generar-fv">' + U.icon("check") + " Generar Factura (Borrador)</button>";
      document.getElementById("btn-generar-fv").addEventListener("click", function () {
        var numero = S.facturacion.nextNumeroFactura(tenant.id);
        var registro = S.facturacion.guardarFacturaGenerada(tenant.id, {
          numero: numero, numeroOrden: ordenCargada.numeroOrden, patientId: ordenCargada.patientId,
          pacienteNombre: pac ? U.nombreCompleto(pac) : "—", pacienteDocumento: pac ? (pac.tipoDocumento + " " + pac.numeroDocumento) : "",
          items: items, subtotal: subtotal, iva: 0, total: subtotal,
          estado: "Borrador (no emitida ante la DIAN)", generadoPor: session.username
        });
        S.addAudit(tenant.id, session.nombre, session.rol, "GENERATE_FV_BORRADOR", "factura", registro.id, "Generó el borrador de factura N° " + numero + " para la orden " + ordenCargada.numeroOrden + ".");
        U.toast("Factura borrador N° " + numero + " generada. Recuerda emitirla con tu proveedor autorizado para que sea válida ante la DIAN.", "success");
        renderHistorialFv();
      });
    }
  };
})();

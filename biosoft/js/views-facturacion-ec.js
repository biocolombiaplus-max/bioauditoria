/* BIOsoft — Vista: Facturación (SOLO Ecuador).
   Mismo espíritu honesto que views-facturacion.js (Colombia): BIOsoft NO
   es un facturador electrónico autorizado por el SRI, y no habla directo
   con ningún proveedor por API todavía. Esta pantalla arma un borrador
   completo — cliente, exámenes, valores, IVA, forma de pago — con
   exactamente los datos que CUALQUIER proveedor autorizado por el SRI
   (Contífico, Nubox Ecuador, el facturador gratuito del SRI, etc.) va a
   pedir para emitir el comprobante real, y los deja listos para copiar,
   descargar en CSV o guardar como registro interno — así funciona sin
   depender de la integración puntual de ningún proveedor específico.
   Reutiliza el mismo namespace S.facturacion.* que ya usa Colombia para
   guardar el proveedor elegido y el historial de borradores (son
   genéricos, no tienen nada específico de Colombia adentro) — separado
   por tenantId, así que nunca se mezcla con los datos de un laboratorio
   colombiano. */
(function () {
  "use strict";
  window.BIO_VIEWS_FACTURACION_EC = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

    // Ecuador factura en dólares — siempre con dos decimales, a diferencia
    // del peso colombiano que normalmente no los necesita.
    function fmtMoneda(n) {
      n = n || 0;
      return "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    var TIPOS_IDENTIFICACION_SRI = [
      { id: "05", nombre: "Cédula" },
      { id: "04", nombre: "RUC" },
      { id: "06", nombre: "Pasaporte" },
      { id: "07", nombre: "Consumidor Final" },
      { id: "08", nombre: "Identificación del Exterior" }
    ];
    var FORMAS_PAGO_SRI = ["Efectivo", "Tarjeta de Débito", "Tarjeta de Crédito", "Transferencia Bancaria", "Otro"];

    var fe = tenant.facturacionElectronica || {};

    // ------------------------------------------------------------------
    // Checklist de preparación — de un vistazo, qué falta configurar
    // antes de poder facturar de verdad con un proveedor autorizado.
    // ------------------------------------------------------------------
    function itemsChecklist() {
      return [
        { ok: !!tenant.nit, texto: "RUC del laboratorio" },
        { ok: !!fe.tieneFirmaElectronica, texto: "Firma electrónica vigente" },
        { ok: !!(fe.proveedorId && fe.proveedorId !== "ninguno"), texto: "Proveedor autorizado elegido" },
        { ok: !!(fe.establecimiento && fe.puntoEmision), texto: "Numeración configurada" }
      ];
    }

    function render() {
      var items = itemsChecklist();
      var listos = items.filter(function (i) { return i.ok; }).length;

      root.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3 class="card-title">🇪🇨 Facturación — Ecuador</h3>' +
          '<span class="badge ' + (listos === items.length ? "badge-validado" : "badge-pendiente") + '">' + listos + "/" + items.length + " lista" + (listos === items.length ? "" : " para configurar") + "</span></div>" +
          '<p class="text-muted" style="margin-top:0">Prepara aquí toda la información de cada factura — cliente, exámenes, valores, IVA, forma de pago — lista para emitirla con el proveedor autorizado por el SRI que ya tengas o vayas a contratar. <b>BIOsoft no está certificado por el SRI</b>, así que esto es un borrador interno, no un comprobante electrónico válido hasta que lo generes ahí.</p>' +
          '<div class="flex wrap gap-2" style="margin-top:6px">' +
          items.map(function (i) { return '<span class="chip">' + (i.ok ? "✅" : "⬜") + " " + U.esc(i.texto) + "</span>"; }).join("") +
          "</div>" +
          (!tenant.nit ? '<p class="text-muted" style="margin:10px 0 0;font-size:12.5px">💡 Configura el RUC del laboratorio desde <a href="#/config">Configuración del Laboratorio</a>.</p>' : "") +
        "</div>" +

        '<div class="card" id="card-proveedor">' +
          '<div class="card-header"><h3 class="card-title">Proveedor Autorizado por el SRI</h3></div>' +
          '<p class="text-muted" style="margin-top:0">Para emitir comprobantes electrónicos válidos ante el SRI necesitas un proveedor tecnológico autorizado (o el facturador gratuito del propio SRI) con tu firma electrónica cargada. Elige aquí el que ya tengas o vayas a contratar — cada laboratorio cliente de BIOsoft puede elegir uno distinto.</p>' +
          '<form id="form-proveedor-ec">' +
            '<div class="form-grid">' +
              '<div class="field"><label>Proveedor</label><select id="f_ec_proveedorId">' +
                C.PROVEEDORES_FACTURACION_EC.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.nombre) + "</option>"; }).join("") +
              "</select></div>" +
              '<div class="field"><label>Establecimiento</label><input id="f_ec_establecimiento" placeholder="001" maxlength="3"/></div>' +
              '<div class="field"><label>Punto de Emisión</label><input id="f_ec_puntoEmision" placeholder="001" maxlength="3"/></div>' +
            "</div>" +
            '<div class="checkbox-row" style="margin:4px 0 10px"><input type="checkbox" id="f_ec_tieneFirma"/><label style="margin:0" for="f_ec_tieneFirma">Ya tengo firma electrónica vigente cargada en mi proveedor</label></div>' +
            '<div class="field"><label>Notas</label><textarea id="f_ec_notas" placeholder="Usuario/cuenta del proveedor, contacto, etc. (opcional)"></textarea></div>' +
            '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Proveedor</button>" +
          "</form>" +
          '<p id="ec-proveedor-actual" class="text-muted" style="margin-top:10px;font-size:12.5px"></p>' +
        "</div>" +

        '<div class="card" id="card-fv-ec">' +
          '<div class="card-header"><h3 class="card-title">Factura (Borrador) desde una Orden</h3></div>' +
          '<p class="text-muted" style="margin-top:0">Arma el detalle de una factura a partir de una orden ya creada. <b>Esto es un borrador interno</b>, no un comprobante electrónico autorizado, hasta que lo emitas con tu proveedor — pero trae todos los datos listos para copiar y pegar directo en el formulario de cualquiera de ellos, o para exportarlos en CSV si tu proveedor permite carga masiva.</p>' +
          '<div class="form-grid">' +
            '<div class="field"><label>N° de Orden</label><input id="f_ec_orden" placeholder="Ej. 2026090701"/></div>' +
            '<button type="button" class="btn btn-outline" id="btn-ec-cargar-orden" style="align-self:end">Cargar Orden</button>' +
          "</div>" +
          '<div id="ec-fv-detalle" style="margin-top:10px"></div>' +
          '<h4 style="margin:20px 0 8px">Historial de Facturas (Borrador)</h4>' +
          '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody id="ec-fv-historial"></tbody></table></div>' +
        "</div>";

      wire();
    }

    function wire() {
      // ---------------- Proveedor ----------------
      function pintarProveedorActual() {
        var box = document.getElementById("ec-proveedor-actual");
        if (!fe || !fe.proveedorId) { box.textContent = "Aún no has configurado un proveedor de facturación electrónica."; return; }
        var prov = C.PROVEEDORES_FACTURACION_EC.filter(function (p) { return p.id === fe.proveedorId; })[0];
        box.innerHTML = "✅ Proveedor configurado: <b>" + U.esc(prov ? prov.nombre : fe.proveedorId) + "</b>" +
          (fe.establecimiento && fe.puntoEmision ? " · Numeración: " + U.esc(fe.establecimiento) + "-" + U.esc(fe.puntoEmision) + "-XXXXXXXXX" : "");
      }
      if (fe.proveedorId) document.getElementById("f_ec_proveedorId").value = fe.proveedorId;
      document.getElementById("f_ec_establecimiento").value = fe.establecimiento || "001";
      document.getElementById("f_ec_puntoEmision").value = fe.puntoEmision || "001";
      document.getElementById("f_ec_tieneFirma").checked = !!fe.tieneFirmaElectronica;
      document.getElementById("f_ec_notas").value = fe.notas || "";
      pintarProveedorActual();

      document.getElementById("form-proveedor-ec").addEventListener("submit", function (e) {
        e.preventDefault();
        var establecimiento = document.getElementById("f_ec_establecimiento").value.trim() || "001";
        var puntoEmision = document.getElementById("f_ec_puntoEmision").value.trim() || "001";
        if (!/^\d{1,3}$/.test(establecimiento) || !/^\d{1,3}$/.test(puntoEmision)) {
          U.toast("Establecimiento y Punto de Emisión deben ser numéricos (hasta 3 dígitos, ej. 001).", "error"); return;
        }
        var datos = {
          proveedorId: document.getElementById("f_ec_proveedorId").value,
          establecimiento: establecimiento.padStart ? establecimiento.padStart(3, "0") : establecimiento,
          puntoEmision: puntoEmision.padStart ? puntoEmision.padStart(3, "0") : puntoEmision,
          tieneFirmaElectronica: document.getElementById("f_ec_tieneFirma").checked,
          notas: document.getElementById("f_ec_notas").value.trim(),
          actualizadoEn: S.nowISO(), actualizadoPor: session.username
        };
        tenant = S.facturacion.setProveedorFacturacion(tenant.id, datos);
        fe = tenant.facturacionElectronica || {};
        S.addAudit(tenant.id, session.nombre, session.rol, "SET_PROVEEDOR_FACTURACION_EC", "tenant", tenant.id, "Configuró el proveedor de facturación electrónica (Ecuador): " + datos.proveedorId + ".");
        U.toast("Proveedor de facturación guardado.", "success");
        render();
      });

      // ---------------- Historial ----------------
      function renderHistorial() {
        var lista = S.facturacion.listFacturasGeneradas(tenant.id);
        document.getElementById("ec-fv-historial").innerHTML = lista.length
          ? lista.map(function (f) {
              return "<tr><td>" + U.esc(f.numero) + "</td><td>" + U.fmtFecha(f.generadoEn) + "</td><td>" + U.esc(f.pacienteNombre) + "</td><td>" + fmtMoneda(f.total) + "</td><td><span class='badge'>" + U.esc(f.estado) + "</span></td>" +
                '<td><div class="flex gap-1 wrap"><button class="btn btn-ghost btn-sm" data-ec-copiar="' + f.id + '">' + U.icon("clipboard") + " Copiar</button>" +
                '<button class="btn btn-ghost btn-sm" data-ec-descargar="' + f.id + '">' + U.icon("download") + " JSON</button></div></td></tr>";
            }).join("")
          : '<tr><td colspan="6" class="text-muted">Aún no has generado ninguna factura borrador.</td></tr>';
        document.querySelectorAll("[data-ec-descargar]").forEach(function (b) {
          b.addEventListener("click", function () {
            var f = lista.filter(function (x) { return x.id === b.dataset.ecDescargar; })[0];
            if (!f) return;
            U.downloadBytes(JSON.stringify(f, null, 2), "Factura_borrador_" + f.numero + ".json", "application/json");
          });
        });
        document.querySelectorAll("[data-ec-copiar]").forEach(function (b) {
          b.addEventListener("click", function () {
            var f = lista.filter(function (x) { return x.id === b.dataset.ecCopiar; })[0];
            if (!f) return;
            copiarFacturaAlPortapapeles(f);
          });
        });
      }
      renderHistorial();

      // ---------------- Factura (borrador) ----------------
      var ordenCargada = null;
      document.getElementById("btn-ec-cargar-orden").addEventListener("click", function () {
        var numero = document.getElementById("f_ec_orden").value.trim();
        if (!numero) { U.toast("Escribe el número de orden.", "error"); return; }
        var order = S.getOrderByNumero(tenant.id, numero);
        if (!order) { U.toast("No se encontró la orden " + numero + ".", "error"); return; }
        ordenCargada = order;
        renderDetalleFv();
      });

      function textoFormateadoFactura(datos) {
        var lineas = [
          "FACTURA (BORRADOR) — " + tenant.nombre + (tenant.nit ? " — RUC " + tenant.nit : ""),
          "N° " + datos.numero,
          "",
          "Cliente: " + datos.pacienteNombre,
          "Identificación (" + datos.tipoIdentificacionNombre + "): " + datos.pacienteDocumento,
          datos.pacienteEmail ? "Correo: " + datos.pacienteEmail : "",
          "",
          "Detalle:"
        ].filter(Boolean);
        datos.items.forEach(function (it) { lineas.push("  " + it.nombre + " — " + fmtMoneda(it.precio)); });
        lineas.push("");
        lineas.push("Subtotal: " + fmtMoneda(datos.subtotal));
        lineas.push("IVA (" + datos.ivaPorcentaje + "%): " + fmtMoneda(datos.ivaValor));
        lineas.push("TOTAL: " + fmtMoneda(datos.total));
        lineas.push("Forma de pago: " + datos.formaPago);
        return lineas.join("\n");
      }
      function copiarFacturaAlPortapapeles(datos) {
        var texto = textoFormateadoFactura(datos);
        navigator.clipboard.writeText(texto).then(function () {
          U.toast("Datos copiados — pégalos directo en el formulario de tu proveedor.", "success");
        }).catch(function () {
          U.toast("No se pudo copiar. Selecciona el texto manualmente.", "error");
        });
      }
      function descargarCsvFactura(datos) {
        var filas = [["Examen", "Valor"]];
        datos.items.forEach(function (it) { filas.push([it.nombre, it.precio.toFixed(2)]); });
        filas.push(["Subtotal", datos.subtotal.toFixed(2)]);
        filas.push(["IVA (" + datos.ivaPorcentaje + "%)", datos.ivaValor.toFixed(2)]);
        filas.push(["Total", datos.total.toFixed(2)]);
        var csv = filas.map(function (fila) {
          return fila.map(function (celda) { return '"' + String(celda).replace(/"/g, '""') + '"'; }).join(",");
        }).join("\n");
        U.downloadBytes(csv, "Factura_borrador_" + datos.numero + ".csv", "text/csv");
      }

      function renderDetalleFv() {
        var host = document.getElementById("ec-fv-detalle");
        var pac = S.getPatient(ordenCargada.patientId);
        var precios = {};
        S.cotizador.listPrecios(tenant.id).forEach(function (p) { precios[p.examId] = p.precio; });
        var items = ordenCargada.examenes.map(function (ex) {
          var exCat = C.examenEfectivo(ex.examId, tenant);
          return { examId: ex.examId, nombre: exCat ? exCat.nombre : ex.examId, precio: precios[ex.examId] || 0 };
        });
        var subtotal = items.reduce(function (a, it) { return a + it.precio; }, 0);
        var tipoIdSugerido = pac ? "05" : "07";

        host.innerHTML =
          '<div class="form-grid">' +
            '<div class="field"><label>Tipo de Identificación</label><select id="f_ec_tipoId">' +
              TIPOS_IDENTIFICACION_SRI.map(function (t) { return '<option value="' + t.id + '" ' + (t.id === tipoIdSugerido ? "selected" : "") + ">" + t.nombre + "</option>"; }).join("") +
            "</select></div>" +
            '<div class="field"><label>Cliente</label><input id="f_ec_cliente" value="' + (pac ? U.esc(U.nombreCompleto(pac)) : "") + '" placeholder="Nombre o razón social"/></div>' +
            '<div class="field"><label>N° de Identificación</label><input id="f_ec_identificacion" value="' + (pac ? U.esc(pac.numeroDocumento) : "") + '"/></div>' +
            '<div class="field"><label>Correo (para enviar el comprobante)</label><input type="email" id="f_ec_correoCliente" value="' + (pac && pac.correo ? U.esc(pac.correo) : "") + '"/></div>' +
          "</div>" +
          '<div class="table-wrap"><table><thead><tr><th>Examen</th><th>Valor</th></tr></thead><tbody>' +
          items.map(function (it) { return "<tr><td>" + U.esc(it.nombre) + "</td><td>" + fmtMoneda(it.precio) + "</td></tr>"; }).join("") +
          "</tbody></table></div>" +
          '<div class="form-grid" style="margin-top:10px">' +
            '<div class="field"><label>IVA (%)</label><input type="number" id="f_ec_ivaPct" value="0" min="0" max="100" step="any"/></div>' +
            '<div class="field"><label>Forma de Pago</label><select id="f_ec_formaPago">' + FORMAS_PAGO_SRI.map(function (fp) { return "<option>" + fp + "</option>"; }).join("") + "</select></div>" +
          "</div>" +
          '<p class="text-muted" style="margin:4px 0 10px;font-size:12px">Muchos servicios de laboratorio clínico pueden tener tarifa 0% de IVA en Ecuador — confírmalo con tu contador antes de emitir, y ajusta el porcentaje si tu caso es distinto.</p>' +
          '<p id="ec-fv-totales" style="text-align:right;font-size:14px"></p>' +
          '<button type="button" class="btn btn-primary" id="btn-ec-generar-fv">' + U.icon("check") + " Generar Factura (Borrador)</button>" +
          '<div id="ec-fv-acciones" style="margin-top:12px"></div>';

        function actualizarTotales() {
          var ivaPct = parseFloat(document.getElementById("f_ec_ivaPct").value) || 0;
          var ivaValor = subtotal * (ivaPct / 100);
          document.getElementById("ec-fv-totales").innerHTML = "Subtotal: <b>" + fmtMoneda(subtotal) + "</b> &nbsp;·&nbsp; IVA (" + ivaPct + "%): <b>" + fmtMoneda(ivaValor) + "</b> &nbsp;·&nbsp; Total: <b>" + fmtMoneda(subtotal + ivaValor) + "</b>";
        }
        document.getElementById("f_ec_ivaPct").addEventListener("input", actualizarTotales);
        actualizarTotales();

        function nextSecuencialEC() {
          var lista = S.facturacion.listFacturasGeneradas(tenant.id);
          var max = 0;
          lista.forEach(function (f) {
            var partes = String(f.numero || "").split("-");
            var sec = parseInt(partes[partes.length - 1], 10);
            if (!isNaN(sec) && sec > max) max = sec;
          });
          return max + 1;
        }

        document.getElementById("btn-ec-generar-fv").addEventListener("click", function () {
          var establecimiento = fe.establecimiento || "001";
          var puntoEmision = fe.puntoEmision || "001";
          var secuencial = String(nextSecuencialEC());
          while (secuencial.length < 9) secuencial = "0" + secuencial;
          var numero = establecimiento + "-" + puntoEmision + "-" + secuencial;

          var ivaPct = parseFloat(document.getElementById("f_ec_ivaPct").value) || 0;
          var ivaValor = subtotal * (ivaPct / 100);
          var tipoIdSel = document.getElementById("f_ec_tipoId");
          var tipoIdNombre = TIPOS_IDENTIFICACION_SRI.filter(function (t) { return t.id === tipoIdSel.value; })[0];

          var datos = {
            numero: numero, numeroOrden: ordenCargada.numeroOrden, patientId: ordenCargada.patientId,
            pacienteNombre: document.getElementById("f_ec_cliente").value.trim() || "Consumidor Final",
            pacienteDocumento: document.getElementById("f_ec_identificacion").value.trim() || "9999999999999",
            pacienteEmail: document.getElementById("f_ec_correoCliente").value.trim(),
            tipoIdentificacion: tipoIdSel.value, tipoIdentificacionNombre: tipoIdNombre ? tipoIdNombre.nombre : "",
            items: items, subtotal: subtotal, ivaPorcentaje: ivaPct, ivaValor: ivaValor, total: subtotal + ivaValor,
            formaPago: document.getElementById("f_ec_formaPago").value,
            estado: "Borrador (no emitida ante el SRI)", generadoPor: session.username
          };
          var registro = S.facturacion.guardarFacturaGenerada(tenant.id, datos);
          S.addAudit(tenant.id, session.nombre, session.rol, "GENERATE_FV_BORRADOR_EC", "factura", registro.id, "Generó el borrador de factura N° " + numero + " para la orden " + ordenCargada.numeroOrden + ".");
          U.toast("Factura borrador " + numero + " generada. Recuerda emitirla con tu proveedor autorizado para que sea válida ante el SRI.", "success");

          document.getElementById("ec-fv-acciones").innerHTML =
            '<div class="flex gap-2 wrap">' +
            '<button type="button" class="btn btn-outline btn-sm" id="btn-ec-copiar-nueva">' + U.icon("clipboard") + " Copiar Datos" + "</button>" +
            '<button type="button" class="btn btn-outline btn-sm" id="btn-ec-csv-nueva">' + U.icon("download") + " Descargar CSV" + "</button>" +
            "</div>";
          document.getElementById("btn-ec-copiar-nueva").addEventListener("click", function () { copiarFacturaAlPortapapeles(registro); });
          document.getElementById("btn-ec-csv-nueva").addEventListener("click", function () { descargarCsvFactura(registro); });
          renderHistorial();
        });
      }
    }

    render();
  };
})();

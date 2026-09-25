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
    function haceNDias(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
    function enNDias(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

    function buildAdminHtml() {
      var tenant = BIO_AUTH.currentTenant();
      var insumos = S.inventario.listInsumos(tenantId);
      var conveniosActivos = S.cotizador.listConvenios(tenantId).filter(function (c) { return c.activo; });
      var medicosRemitentes = S.medicos.list(tenantId);
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
        '<div class="lp-ic">⏳</div><h3>Vencimientos de Inventario</h3>' +
        '<p>Insumos con fecha de vencimiento entre un rango de fechas — ya vencidos y por vencer, con lote, stock y valor en riesgo, ordenados del más próximo a vencer (FEFO).</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-venc-desde" value="' + haceNDias(30) + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-venc-hasta" value="' + enNDias(90) + '"/></div>' +
        "</div>" +
        '<button class="btn btn-primary btn-block" id="btn-rep-venc">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">🧾</div><h3>Cartera de Clientes</h3>' +
        '<p>Valor total, abonado y saldo pendiente de las órdenes del periodo — general, de un convenio en particular, o agrupado por Aliado (Convenio) o por Paciente. Si hay más de una moneda de pago en el resultado, se separa un bloque por cada una.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-cartera-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-cartera-hasta" value="' + hoyISO() + '"/></div>' +
        '</div>' +
        (conveniosActivos.length ?
          '<div class="field" style="margin:0 0 10px"><label>Convenio (opcional)</label><select id="rep-cartera-convenio"><option value="">Todos los convenios y particulares</option>' +
          conveniosActivos.map(function (c) { return '<option value="' + c.id + '">' + U.esc(c.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        (tenant.pais === "VE" ?
          '<div class="field" style="margin:0 0 10px"><label>Moneda (opcional)</label><select id="rep-cartera-moneda"><option value="">Todas las monedas</option>' +
          BIO_CATALOG.MONEDAS_PAGO.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        '<div class="field" style="margin:0 0 10px"><label>Agrupar por</label><select id="rep-cartera-agrupar">' +
        '<option value="aliado">Aliado (Convenio)</option>' +
        '<option value="paciente">Paciente</option>' +
        '<option value="general">Detalle general (sin agrupar)</option>' +
        "</select></div>" +
        '<button class="btn btn-primary btn-block" id="btn-rep-cartera">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">📋</div><h3>Relación de Órdenes y Exámenes</h3>' +
        '<p>Detallado por paciente y por examen entre fechas: N° de orden, documento, paciente, fecha, edad, sexo y cada examen con su valor — con total por orden y total general del listado. Se puede filtrar a un solo convenio, o ver todos con una columna de Convenio/Aliado.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-relacion-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-relacion-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        (conveniosActivos.length ?
          '<div class="field" style="margin:0 0 10px"><label>Convenio (opcional)</label><select id="rep-relacion-convenio"><option value="">Todos los convenios y particulares</option>' +
          conveniosActivos.map(function (c) { return '<option value="' + c.id + '">' + U.esc(c.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        '<button class="btn btn-primary btn-block" id="btn-rep-relacion">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">💵</div><h3>Cierre de Caja</h3>' +
        '<p>Cuánto dinero entró realmente en el periodo (pagos confirmados, no cargos a crédito de convenio), separado por moneda de pago y, dentro de cada una, por método de pago — para cuadrar caja.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-caja-desde" value="' + hoyISO() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-caja-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        (tenant.pais === "VE" ?
          '<div class="field" style="margin:0 0 10px"><label>Moneda (opcional)</label><select id="rep-caja-moneda"><option value="">Todas las monedas</option>' +
          BIO_CATALOG.MONEDAS_PAGO.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        '<button class="btn btn-primary btn-block" id="btn-rep-caja">' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">🩺</div><h3>Comisiones a Médicos Remitentes</h3>' +
        '<p>Cuánto se le debe pagar a cada médico remitente en un periodo, según su tarifa configurada (fija por orden, fija por examen, o % del valor) — agrupado por médico, con el detalle de cada orden que remitió.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-comisiones-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-comisiones-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        (medicosRemitentes.length ?
          '<div class="field" style="margin:0 0 10px"><label>Médico (opcional)</label><select id="rep-comisiones-medico"><option value="">Todos los médicos</option>' +
          medicosRemitentes.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          "</select></div>" :
          '<p class="text-muted" style="font-size:12px">Aún no has registrado ningún médico remitente — hazlo en Administración → Médicos Remitentes.</p>') +
        '<button class="btn btn-primary btn-block" id="btn-rep-comisiones" ' + (medicosRemitentes.length ? "" : "disabled") + '>' + U.icon("download") + " Generar PDF</button>" +
        "</div>" +
        "</div>";
    }

    function wireAdmin() {
      var tenant = BIO_AUTH.currentTenant();
      var conveniosActivos = S.cotizador.listConvenios(tenantId).filter(function (c) { return c.activo; });
      var medicosRemitentes = S.medicos.list(tenantId);
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
      var btnVenc = document.getElementById("btn-rep-venc");
      if (btnVenc) btnVenc.addEventListener("click", function () {
        var desde = document.getElementById("rep-venc-desde").value;
        var hasta = document.getElementById("rep-venc-hasta").value;
        var insumosVenc = S.inventario.listInsumos(tenantId).filter(function (i) {
          return i.fechaVencimiento && i.fechaVencimiento >= desde && i.fechaVencimiento <= hasta;
        });
        var bytesVenc = BIO_PDF_INVENTARIO.buildVencimientosPDF(insumosVenc, tenant, desde, hasta);
        U.downloadBytes(bytesVenc, "Vencimientos_Inventario_" + desde + "_a_" + hasta + ".pdf");
        U.toast("Reporte de vencimientos descargado.", "success");
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
        var elConvenioCartera = document.getElementById("rep-cartera-convenio");
        var convenioIdCartera = elConvenioCartera ? elConvenioCartera.value : "";
        var elMonedaCartera = document.getElementById("rep-cartera-moneda");
        var monedaIdCartera = elMonedaCartera ? elMonedaCartera.value : "";
        var orders = S.listOrders(tenantId).filter(function (o) {
          var fecha = (o.fechaOrden || "").slice(0, 10);
          if (convenioIdCartera && o.convenioId !== convenioIdCartera) return false;
          if (monedaIdCartera && o.monedaPago !== monedaIdCartera) return false;
          return fecha >= desde && fecha <= hasta && o.valorCobrar != null;
        });
        // "Abonado" hoy solo refleja el estado binario del Recibo de Pago
        // (order.pago: pagada la orden completa, o pendiente) — BIOsoft aún
        // no lleva abonos parciales por orden. Si el laboratorio necesita
        // registrar pagos parciales en el tiempo, es una funcionalidad
        // aparte por construir; este reporte usa lo que ya existe hoy.
        // "moneda" se toma de cómo se creó la orden (order.monedaPago, el
        // selector de "Moneda de Pago" en Nueva Orden — ver catalog.js);
        // si la orden no tiene una moneda propia (laboratorios fuera de
        // Venezuela, o VE sin especificarla) se asume la moneda base del
        // laboratorio, igual que en Cierre de Caja.
        var filas = orders.map(function (o) {
          var pac = S.getPatient(o.patientId);
          var valorTotal = o.valorCobrar || 0;
          // Un cargo 100% a crédito de convenio (sin copago) NO cuenta como
          // abonado: nadie ha pagado nada todavía, así que queda como saldo
          // pendiente hasta que se le cobre al convenio — igual que en
          // Cartera por Convenio (ver calcularCartera() en views-cotizador.js).
          var valorAbonado = !o.pago ? 0 : BIO_CATALOG.totalAbonado(o);
          return {
            numeroOrden: o.numeroOrden,
            fecha: o.fechaOrden,
            paciente: pac ? U.nombreCompleto(pac) : "—",
            aliado: o.convenioNombre || "Particulares",
            moneda: o.monedaPago ? BIO_CATALOG.monedaPagoLabel(o.monedaPago) : BIO_CATALOG.monedaBaseLabel(tenant),
            valorTotal: valorTotal,
            valorAbonado: valorAbonado,
            saldoPendiente: valorTotal - valorAbonado
          };
        }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var convenioFiltro = convenioIdCartera ? conveniosActivos.filter(function (c) { return c.id === convenioIdCartera; })[0] : null;
        var monedaFiltroLabel = monedaIdCartera ? BIO_CATALOG.monedaPagoLabel(monedaIdCartera) : "";
        var bytes = BIO_PDF_CARTERA.buildCarteraPDF(filas, tenant, desde, hasta, agrupacion, convenioFiltro ? convenioFiltro.nombre : "", monedaFiltroLabel);
        var sufijoConvenio = convenioFiltro ? "_" + convenioFiltro.nombre.replace(/\s+/g, "_") : "";
        var sufijoMoneda = monedaIdCartera ? "_" + monedaIdCartera : "";
        U.downloadBytes(bytes, "Cartera_" + desde + "_a_" + hasta + sufijoConvenio + sufijoMoneda + ".pdf");
        U.toast("Reporte de cartera descargado.", "success");
      });
      var btnRelacion = document.getElementById("btn-rep-relacion");
      if (btnRelacion) btnRelacion.addEventListener("click", function () {
        var desde = document.getElementById("rep-relacion-desde").value;
        var hasta = document.getElementById("rep-relacion-hasta").value;
        // Cada examen se valora con la Lista de Precios (o la tarifa
        // especial del convenio de esa orden, si tiene una) — las órdenes
        // no guardan un precio por examen individual, así que esto es el
        // mejor cálculo disponible, igual que la sugerencia automática de
        // "Valor a Cobrar" al crear la orden.
        var preciosPorId = {};
        S.cotizador.listPrecios(tenantId).forEach(function (p) { preciosPorId[p.examId] = p.precio; });
        var convenios = S.cotizador.listConvenios(tenantId);
        var convenioPreciosPorConvenio = {};
        function preciosDeConvenio(convenioId) {
          if (!convenioPreciosPorConvenio[convenioId]) {
            var mapa = {};
            S.cotizador.listConvenioPrecios(tenantId, convenioId).forEach(function (p) { mapa[p.examId] = p; });
            convenioPreciosPorConvenio[convenioId] = mapa;
          }
          return convenioPreciosPorConvenio[convenioId];
        }
        function valorExamen(examId, convenioId) {
          var base = preciosPorId[examId] || 0;
          if (!convenioId) return base;
          var convenio = convenios.filter(function (c) { return c.id === convenioId; })[0];
          if (!convenio) return base;
          var especial = preciosDeConvenio(convenioId)[examId];
          if (especial) return especial.modo === "fijo" ? especial.valor : Math.max(0, base * (1 - especial.valor / 100));
          if (convenio.descuentoGeneral > 0) return Math.max(0, base * (1 - convenio.descuentoGeneral / 100));
          return base;
        }
        var elConvenioRelacion = document.getElementById("rep-relacion-convenio");
        var convenioIdRelacion = elConvenioRelacion ? elConvenioRelacion.value : "";
        var ordenes = S.listOrders(tenantId).filter(function (o) {
          var fecha = (o.fechaOrden || "").slice(0, 10);
          if (convenioIdRelacion && o.convenioId !== convenioIdRelacion) return false;
          return fecha >= desde && fecha <= hasta && o.examenes && o.examenes.length;
        }).map(function (o) {
          var pac = S.getPatient(o.patientId);
          return {
            numeroOrden: o.numeroOrden,
            documento: pac ? pac.tipoDocumento + " " + pac.numeroDocumento : "—",
            paciente: pac ? U.nombreCompleto(pac) : "—",
            fecha: o.fechaOrden,
            edad: pac ? U.edadTexto(pac) : "—",
            sexo: pac ? pac.sexo : "—",
            aliado: o.convenioNombre || "Particulares",
            examenes: o.examenes.map(function (ex) {
              var exCat = BIO_CATALOG.examenEfectivo(ex.examId, tenant);
              return { nombre: exCat ? exCat.nombre : ex.examId, valor: valorExamen(ex.examId, o.convenioId) };
            })
          };
        }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var convenioFiltroRelacion = convenioIdRelacion ? convenios.filter(function (c) { return c.id === convenioIdRelacion; })[0] : null;
        var bytesRelacion = BIO_PDF_RELACION_ORDENES.buildRelacionOrdenesPDF(ordenes, tenant, desde, hasta, convenioFiltroRelacion ? convenioFiltroRelacion.nombre : "");
        var sufijoConvenioRelacion = convenioFiltroRelacion ? "_" + convenioFiltroRelacion.nombre.replace(/\s+/g, "_") : "";
        U.downloadBytes(bytesRelacion, "Relacion_Ordenes_Examenes_" + desde + "_a_" + hasta + sufijoConvenioRelacion + ".pdf");
        U.toast("Relación de órdenes y exámenes descargada.", "success");
      });
      var btnCaja = document.getElementById("btn-rep-caja");
      if (btnCaja) btnCaja.addEventListener("click", function () {
        var desde = document.getElementById("rep-caja-desde").value;
        var hasta = document.getElementById("rep-caja-hasta").value;
        var elMoneda = document.getElementById("rep-caja-moneda");
        var monedaFiltroId = elMoneda ? elMoneda.value : "";
        // "Dinero realmente recibido": order.abonos SOLO contiene efectivo
        // que de verdad entró a caja (nunca la parte de un cargo 100% a
        // crédito de convenio — ver views-orders.js) — cada abono es un
        // ingreso independiente, en SU PROPIA fecha, así que un pago hecho
        // en varias partes (ver "Agregar Abono") aparece cada vez en el
        // cierre del día en que realmente se recibió, no todo amontonado
        // en la fecha del primer pago.
        var filas = [];
        S.listOrders(tenantId).forEach(function (o) {
          var esCopago = !!(o.pago && o.pago.tieneCopago);
          (o.abonos || []).forEach(function (abono) {
            var fechaAbono = (abono.fecha || "").slice(0, 10);
            if (fechaAbono < desde || fechaAbono > hasta) return;
            var moneda = o.monedaPago ? BIO_CATALOG.monedaPagoLabel(o.monedaPago) : BIO_CATALOG.monedaBaseLabel(tenant);
            if (monedaFiltroId && o.monedaPago !== monedaFiltroId) return;
            var pac = S.getPatient(o.patientId);
            filas.push({
              numeroOrden: o.numeroOrden,
              fecha: abono.fecha,
              paciente: pac ? U.nombreCompleto(pac) : "—",
              metodoPago: esCopago ? "Copago (" + (BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[abono.metodoPago] || abono.metodoPago) + ")" : (BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[abono.metodoPago] || abono.metodoPago || "—"),
              moneda: moneda,
              monto: abono.monto
            });
          });
        });
        filas.sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var monedaFiltroLabel = monedaFiltroId ? BIO_CATALOG.monedaPagoLabel(monedaFiltroId) : "";
        var bytesCaja = BIO_PDF_CIERRE_CAJA.buildCierreCajaPDF(filas, tenant, desde, hasta, monedaFiltroLabel);
        var sufijoMoneda = monedaFiltroLabel ? "_" + monedaFiltroId : "";
        U.downloadBytes(bytesCaja, "Cierre_Caja_" + desde + "_a_" + hasta + sufijoMoneda + ".pdf");
        U.toast("Cierre de caja descargado.", "success");
      });
      var btnComisiones = document.getElementById("btn-rep-comisiones");
      if (btnComisiones) btnComisiones.addEventListener("click", function () {
        var desde = document.getElementById("rep-comisiones-desde").value;
        var hasta = document.getElementById("rep-comisiones-hasta").value;
        var elMedico = document.getElementById("rep-comisiones-medico");
        var medicoIdFiltro = elMedico ? elMedico.value : "";
        var medicosPorId = {};
        medicosRemitentes.forEach(function (m) { medicosPorId[m.id] = m; });
        // Solo cuentan las órdenes que quedaron ligadas a un médico
        // REGISTRADO (order.medicoRemitenteId, ver "Médico Remitente" en
        // Nueva Orden) — un nombre escrito a mano, sin elegir del
        // catálogo, no tiene una tarifa configurada con la que calcular
        // ninguna comisión.
        var filas = [];
        S.listOrders(tenantId).filter(function (o) {
          var fecha = (o.fechaOrden || "").slice(0, 10);
          if (!o.medicoRemitenteId || !medicosPorId[o.medicoRemitenteId]) return false;
          if (medicoIdFiltro && o.medicoRemitenteId !== medicoIdFiltro) return false;
          return fecha >= desde && fecha <= hasta;
        }).forEach(function (o) {
          var medico = medicosPorId[o.medicoRemitenteId];
          var pac = S.getPatient(o.patientId);
          var numExamenes = o.examenes ? o.examenes.length : 0;
          // Si el médico tiene tarifas especiales configuradas para
          // exámenes puntuales (ver "Tarifas Especiales" en Médicos
          // Remitentes), esos exámenes se pagan a su valor especial y el
          // resto sigue con la tarifa fija de siempre.
          var tarifasEspecialesPorExamen = {};
          if (medico.tipoTarifa === "fijo_examen") {
            S.medicos.listTarifasExamen(tenantId, medico.id).forEach(function (t) { tarifasEspecialesPorExamen[t.examId] = t.valorTarifa; });
          }
          var comision = medico.tipoTarifa === "porcentaje" ? (o.valorCobrar || 0) * ((medico.valorTarifa || 0) / 100)
            : medico.tipoTarifa === "fijo_examen" ? (o.examenes || []).reduce(function (sum, ex) {
                var especial = tarifasEspecialesPorExamen[ex.examId];
                return sum + (especial !== undefined ? especial : (medico.valorTarifa || 0));
              }, 0)
            : (medico.valorTarifa || 0);
          filas.push({
            numeroOrden: o.numeroOrden, fecha: o.fechaOrden, paciente: pac ? U.nombreCompleto(pac) : "—",
            medicoId: o.medicoRemitenteId, medicoNombre: medico.nombre,
            numExamenes: numExamenes, valorCobrar: o.valorCobrar || 0, comision: Math.round(comision)
          });
        });
        filas.sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var medicoFiltroLabel = medicoIdFiltro && medicosPorId[medicoIdFiltro] ? medicosPorId[medicoIdFiltro].nombre : "";
        var bytesComisiones = BIO_PDF_COMISIONES_MEDICOS.buildComisionesMedicosPDF(filas, medicosPorId, tenant, desde, hasta, medicoFiltroLabel);
        var sufijoMedico = medicoFiltroLabel ? "_" + medicoFiltroLabel.replace(/\s+/g, "_") : "";
        U.downloadBytes(bytesComisiones, "Comisiones_Medicos_" + desde + "_a_" + hasta + sufijoMedico + ".pdf");
        U.toast("Reporte de comisiones descargado.", "success");
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
      (U.botonCompartirPDFHtml("send-compartir") ? '<div style="margin-top:8px">' + U.botonCompartirPDFHtml("send-compartir") + '<p class="text-muted" style="margin:4px 0 0;font-size:11.5px">En celular: abre el menú de compartir con el PDF ya adjunto — puedes elegir WhatsApp ahí mismo.</p></div>' : "") +
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
    var pdfFilenameCache = null;
    function obtenerPdf() {
      if (pdfCache) return Promise.resolve(pdfCache);
      var tipo = wrap.querySelector("#send-tipo").value;
      return window.BIO_PDF.buildResultadosPDF(order, pac, tenant, tipo).then(function (bytes) {
        pdfCache = bytes;
        var nombreArchivo = window.BIO_PDF.nombreParaArchivo(pac);
        pdfFilenameCache = "Resultados_" + order.numeroOrden + (nombreArchivo ? "_" + nombreArchivo : "") + "_" + (tipo === "final" ? "Final" : "Preliminar") + ".pdf";
        U.downloadBytes(bytes, pdfFilenameCache);
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

    var btnCompartir = wrap.querySelector("#send-compartir");
    if (btnCompartir) {
      btnCompartir.addEventListener("click", function (e) {
        conBotonOcupado(e.currentTarget, function () {
          return obtenerPdf().then(function (bytes) {
            U.compartirPDF(bytes, pdfFilenameCache, wrap.querySelector("#send-msg").value);
            registrarEnvio("compartir (PDF adjunto)");
          });
        });
      });
    }

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

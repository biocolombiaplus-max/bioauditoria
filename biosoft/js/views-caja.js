/* BIOsoft — Vista: Caja (apertura, movimientos de caja menor y cierre con
   arqueo). Único módulo visible para el rol "cajero" (ver router.js): ese
   usuario puede abrir/cerrar la caja, cobrar órdenes con saldo pendiente
   (reusando BIO_ORDER_PAGOS, expuesto por views-orders.js) y registrar
   ingresos/egresos manuales de caja menor — nunca ve pacientes, resultados
   clínicos, catálogo ni configuración. El Administrador también puede
   entrar aquí para supervisar/operar la caja de cualquier sede.

   El dinero recibido por pagos de órdenes NUNCA se guarda dentro del turno
   de caja — sigue viviendo en order.pago/order.abonos, igual que siempre
   (ver pdf-cierre-caja.js). Un turno de caja solo guarda la base inicial
   con la que se abrió, los movimientos manuales (que no vienen de ninguna
   orden, ej. un domicilio pagado en efectivo) y el resultado del arqueo al
   cerrar — lo "esperado en efectivo" se calcula sumando ambas fuentes cada
   vez que se necesita, nunca se duplica el dato. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  function fmtMoneda(n) {
    n = n || 0;
    var dec = Math.round(n) === n ? 0 : 2;
    return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
  }
  var METODO_PAGO_LABEL = window.BIO_PDF_RECIBO_ORDEN ? window.BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL : {};

  window.BIO_VIEWS.caja = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    // Un cajero/admin con sede asignada siempre opera SU sede, sin poder
    // elegir otra (igual que el resto del aislamiento por sede — ver
    // BIO_AUTH.sedeRestringida). Un Administrador sin sede asignada, en un
    // laboratorio con Multisede, elige con cuál caja trabajar; si el
    // laboratorio no usa Multisede, hay una sola caja para todo el
    // laboratorio (sedeId siempre "").
    var puedeElegirSede = !!(tenant && tenant.multisede) && !BIO_AUTH.sedeRestringida();
    var sedeId = BIO_AUTH.sedeRestringida() ? session.sedeId : "";

    function sedesDisponibles() {
      return C.sedesEfectivas(tenant).filter(function (s) { return s.activa !== false; });
    }

    // Todos los pagos (abonos) realmente recibidos en órdenes de esta sede
    // entre "desde" y "hasta" (ISO completos) — la MISMA fuente de verdad
    // que ya usa "Cierre de Caja" en Reportes Administrativos (ver
    // views-reports.js), aquí acotada a la ventana exacta de un turno.
    function pagosOrdenesEnVentana(desde, hasta) {
      var filas = [];
      var ordenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenant.id));
      if (sedeId) ordenes = ordenes.filter(function (o) { return (o.sedeId || "") === sedeId; });
      ordenes.forEach(function (o) {
        (o.abonos || []).forEach(function (abono) {
          if (abono.fecha < desde || (hasta && abono.fecha > hasta)) return;
          var pac = S.getPatient(o.patientId);
          filas.push({
            numeroOrden: o.numeroOrden, fecha: abono.fecha, paciente: pac ? U.nombreCompleto(pac) : "—",
            metodoPago: METODO_PAGO_LABEL[abono.metodoPago] || abono.metodoPago || "—",
            moneda: o.monedaPago ? C.monedaPagoLabel(o.monedaPago) : C.monedaBaseLabel(tenant),
            monto: abono.monto
          });
        });
      });
      return filas;
    }

    function resumenTurno(turno) {
      var filas = pagosOrdenesEnVentana(turno.fechaApertura, turno.fechaCierre || new Date().toISOString());
      var porMetodo = {};
      filas.forEach(function (f) { porMetodo[f.metodoPago] = (porMetodo[f.metodoPago] || 0) + f.monto; });
      var efectivoOrdenes = 0;
      Object.keys(porMetodo).forEach(function (m) { if (m === (METODO_PAGO_LABEL.efectivo || "Efectivo")) efectivoOrdenes = porMetodo[m]; });
      var ingresosManual = 0, egresosManual = 0;
      (turno.movimientos || []).forEach(function (m) { if (m.tipo === "ingreso") ingresosManual += m.monto; else egresosManual += m.monto; });
      var esperado = (turno.baseInicial || 0) + efectivoOrdenes + ingresosManual - egresosManual;
      return { filas: filas, porMetodo: porMetodo, efectivoOrdenes: efectivoOrdenes, ingresosManual: ingresosManual, egresosManual: egresosManual, esperado: esperado };
    }

    function ordenesConCobroPendiente() {
      if (!tenant.mostrarPrecioOrden) return [];
      var ordenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenant.id));
      if (sedeId) ordenes = ordenes.filter(function (o) { return (o.sedeId || "") === sedeId; });
      return ordenes.filter(function (o) {
        if (!o.valorCobrar) return false;
        if (!o.pago) return true;
        var esCreditoPuro = o.pago.esCredito && !o.pago.tieneCopago;
        if (esCreditoPuro) return false; // a cargo del convenio, no se cobra en caja
        return C.saldoPendienteOrden(o) > 0.009;
      }).sort(function (a, b) { return (a.fechaOrden || "").localeCompare(b.fechaOrden || ""); });
    }

    function build() {
      var turno = S.caja.turnoAbierto(tenant.id, sedeId);
      root.innerHTML =
        '<div class="card">' +
        '<div class="card-header"><h3 class="card-title">' + U.icon("wallet") + " Caja" + "</h3>" +
        (puedeElegirSede ? sedeSelectorHtml() : "") +
        "</div>" +
        (turno ? htmlTurnoAbierto(turno) : htmlTurnoCerrado()) +
        "</div>" +
        (turno && tenant.mostrarPrecioOrden ? htmlCobrosPendientes() : "") +
        htmlHistorial();

      wireEvents(turno);
    }

    function sedeSelectorHtml() {
      return '<div class="field" style="max-width:260px;margin-bottom:0"><select id="caja-sede">' +
        '<option value="">Caja General (sin sede)</option>' +
        sedesDisponibles().map(function (s) { return '<option value="' + s.id + '" ' + (s.id === sedeId ? "selected" : "") + ">" + U.esc(s.nombre) + "</option>"; }).join("") +
        "</select></div>";
    }

    function htmlTurnoCerrado() {
      return '<div style="text-align:center;padding:36px 18px">' +
        '<div style="font-size:14px;color:var(--text-muted);margin-bottom:14px">La caja' + (sedeId ? " de esta sede" : "") + ' está cerrada.</div>' +
        '<button class="btn btn-primary" id="btn-abrir-caja">' + U.icon("plus") + " Abrir Caja</button>" +
        "</div>";
    }

    function htmlTurnoAbierto(turno) {
      var r = resumenTurno(turno);
      return '<p class="text-muted" style="margin:0 0 14px">Abierta por <b>' + U.esc(turno.abiertoPor) + "</b> desde " + new Date(turno.fechaApertura).toLocaleString("es-CO") + "</p>" +
        '<div class="kpi-grid" style="margin-bottom:16px">' +
        kpi(fmtMoneda(turno.baseInicial), "Base Inicial") +
        kpi(fmtMoneda(r.efectivoOrdenes), "Efectivo de Órdenes") +
        kpi(fmtMoneda(r.ingresosManual - r.egresosManual), "Movimientos Manuales (neto)") +
        kpi(fmtMoneda(r.esperado), "Esperado en Caja Ahora") +
        "</div>" +
        (Object.keys(r.porMetodo).length ? '<p class="text-muted" style="margin:0 0 14px;font-size:12.5px">Recibido en el turno por método: ' +
          Object.keys(r.porMetodo).map(function (m) { return "<b>" + U.esc(m) + "</b> " + fmtMoneda(r.porMetodo[m]); }).join("   ·   ") + "</p>" : "") +
        '<div class="flex gap-2 wrap" style="margin-bottom:18px">' +
        '<button class="btn btn-outline btn-sm" id="btn-mov-ingreso">' + U.icon("plus") + " Ingreso Manual</button>" +
        '<button class="btn btn-outline btn-sm" id="btn-mov-egreso">' + U.icon("plus") + " Egreso Manual</button>" +
        '<button class="btn btn-primary btn-sm" id="btn-cerrar-caja" style="margin-left:auto">' + U.icon("check") + " Cerrar Caja</button>" +
        "</div>" +
        '<h4 style="margin-bottom:8px">Movimientos de Caja Menor</h4>' +
        '<div class="table-wrap"><table><thead><tr><th>Hora</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Usuario</th></tr></thead><tbody>' +
        ((turno.movimientos || []).length
          ? turno.movimientos.slice().reverse().map(function (m) {
              return "<tr><td>" + new Date(m.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) + "</td>" +
                "<td>" + (m.tipo === "ingreso" ? '<span class="badge badge-validado">Ingreso</span>' : '<span class="badge badge-pendiente">Egreso</span>') + "</td>" +
                "<td>" + U.esc(m.concepto || "—") + "</td><td>" + fmtMoneda(m.monto) + "</td><td>" + U.esc(m.usuario || "—") + "</td></tr>";
            }).join("")
          : '<tr><td colspan="5" class="text-muted">Sin movimientos manuales todavía.</td></tr>') +
        "</tbody></table></div>";
    }

    function kpi(valor, etiqueta) {
      return '<div class="kpi"><div class="kpi-value">' + valor + '</div><div class="kpi-label">' + etiqueta + "</div></div>";
    }

    function htmlCobrosPendientes() {
      var ordenes = ordenesConCobroPendiente();
      return '<div class="card"><div class="card-header"><h3 class="card-title">Cobros Pendientes (' + ordenes.length + ")</h3></div>" +
        '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Valor Total</th><th>Saldo Pendiente</th><th></th></tr></thead><tbody>' +
        (ordenes.length ? ordenes.map(rowCobro).join("") : '<tr><td colspan="5" class="text-muted">No hay órdenes con saldo pendiente por cobrar.</td></tr>') +
        "</tbody></table></div></div>";
    }

    function rowCobro(o) {
      var pac = S.getPatient(o.patientId);
      var saldo = o.pago ? C.saldoPendienteOrden(o) : o.valorCobrar;
      var esPagoNuevo = !o.pago;
      return "<tr><td><b>" + o.numeroOrden + "</b></td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td>" +
        "<td>" + fmtMoneda(o.valorCobrar) + "</td><td>" + fmtMoneda(saldo) + "</td>" +
        '<td><button class="btn btn-primary btn-sm" data-cobrar="' + o.id + '">' + U.icon("check") + (esPagoNuevo ? " Registrar Pago" : " Agregar Abono") + "</button></td></tr>";
    }

    function htmlHistorial() {
      var turnos = S.caja.listTurnos(tenant.id, sedeId).filter(function (t) { return t.estado === "cerrada"; }).slice(0, 20);
      return '<div class="card"><div class="card-header"><h3 class="card-title">Historial de Cierres</h3></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Apertura</th><th>Cierre</th><th>Abierta/Cerrada por</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>' +
        (turnos.length ? turnos.map(rowHistorial).join("") : '<tr><td colspan="6" class="text-muted">Todavía no hay ningún cierre de caja registrado.</td></tr>') +
        "</tbody></table></div></div>";
    }

    function rowHistorial(t) {
      var dif = t.diferencia || 0;
      var badge = Math.abs(dif) < 0.01 ? '<span class="badge badge-validado">Cuadrada</span>'
        : dif > 0 ? '<span class="badge badge-preliminar">Sobrante ' + fmtMoneda(dif) + "</span>"
        : '<span class="badge badge-pendiente">Faltante ' + fmtMoneda(Math.abs(dif)) + "</span>";
      return "<tr><td>" + new Date(t.fechaApertura).toLocaleString("es-CO") + "</td><td>" + new Date(t.fechaCierre).toLocaleString("es-CO") + "</td>" +
        "<td>" + U.esc(t.abiertoPor) + " / " + U.esc(t.cerradoPor) + "</td>" +
        "<td>" + fmtMoneda(t.montoEsperadoEfectivo) + "</td><td>" + fmtMoneda(t.montoContado) + "</td><td>" + badge + "</td></tr>";
    }

    function wireEvents(turno) {
      var selSede = document.getElementById("caja-sede");
      if (selSede) selSede.addEventListener("change", function () { sedeId = selSede.value; build(); });

      var btnAbrir = document.getElementById("btn-abrir-caja");
      if (btnAbrir) btnAbrir.addEventListener("click", abrirModalApertura);

      var btnIngreso = document.getElementById("btn-mov-ingreso");
      if (btnIngreso) btnIngreso.addEventListener("click", function () { abrirModalMovimiento(turno, "ingreso"); });
      var btnEgreso = document.getElementById("btn-mov-egreso");
      if (btnEgreso) btnEgreso.addEventListener("click", function () { abrirModalMovimiento(turno, "egreso"); });

      var btnCerrar = document.getElementById("btn-cerrar-caja");
      if (btnCerrar) btnCerrar.addEventListener("click", function () { abrirModalCierre(turno); });

      root.querySelectorAll("[data-cobrar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var o = S.getOrder(b.dataset.cobrar);
          if (!o) return;
          if (!o.pago) window.BIO_ORDER_PAGOS.abrirReciboOrden(o, tenant, build);
          else window.BIO_ORDER_PAGOS.abrirAgregarAbono(o, tenant, build);
        });
      });
    }

    function abrirModalApertura() {
      var wrap = U.openModal(
        '<h3 class="modal-title">Abrir Caja</h3>' +
        '<p class="text-muted" style="margin-top:0">Cuenta el efectivo que vas a dejar en la caja para empezar el turno (vueltos/cambio).</p>' +
        '<div class="field"><label>Base Inicial (efectivo)</label><input type="text" inputmode="decimal" id="ap-base" value="0"/></div>' +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="ap-confirmar">Abrir Caja</button></div>'
      );
      wrap.querySelector("#ap-confirmar").addEventListener("click", function () {
        var base = U.parseMonto(wrap.querySelector("#ap-base").value) || 0;
        var res = S.caja.abrirTurno(tenant.id, sedeId, session.nombre, session.userId || session.id, base);
        if (res.error) { U.toast(res.error, "error"); return; }
        S.addAudit(session.tenantId, session.nombre, session.rol, "ABRIR_CAJA", "caja", res.turno.id,
          "Abrió la caja" + (sedeId ? " de " + (C.sedePorId(tenant, sedeId) ? C.sedePorId(tenant, sedeId).nombre : sedeId) : "") + " con una base de " + fmtMoneda(base) + ".");
        U.closeModal(wrap);
        U.toast("Caja abierta.", "success");
        build();
      });
    }

    function abrirModalMovimiento(turno, tipo) {
      var titulo = tipo === "ingreso" ? "Ingreso Manual de Caja" : "Egreso Manual de Caja (Caja Menor)";
      var wrap = U.openModal(
        '<h3 class="modal-title">' + titulo + "</h3>" +
        '<p class="text-muted" style="margin-top:0">' + (tipo === "ingreso" ? "Dinero que entró a caja y que NO viene del pago de una orden (ej. venta de un producto suelto)." : "Dinero que salió de caja en efectivo (ej. un domicilio, papelería, un gasto menor).") + "</p>" +
        '<div class="field"><label>Concepto</label><input type="text" id="mv-concepto" placeholder="Ej. Domicilio de papelería"/></div>' +
        '<div class="field"><label>Monto</label><input type="text" inputmode="decimal" id="mv-monto" value="0"/></div>' +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="mv-confirmar">Registrar</button></div>'
      );
      wrap.querySelector("#mv-confirmar").addEventListener("click", function () {
        var concepto = wrap.querySelector("#mv-concepto").value.trim();
        var monto = U.parseMonto(wrap.querySelector("#mv-monto").value) || 0;
        if (!concepto) { U.toast("Escribe el concepto del movimiento.", "error"); return; }
        if (monto <= 0) { U.toast("El monto debe ser mayor a cero.", "error"); return; }
        S.caja.agregarMovimiento(turno.id, { tipo: tipo, concepto: concepto, monto: monto, usuario: session.nombre });
        S.addAudit(session.tenantId, session.nombre, session.rol, tipo === "ingreso" ? "CAJA_INGRESO_MANUAL" : "CAJA_EGRESO_MANUAL", "caja", turno.id,
          (tipo === "ingreso" ? "Registró un ingreso manual de " : "Registró un egreso manual de ") + fmtMoneda(monto) + " en caja (" + concepto + ").");
        U.closeModal(wrap);
        U.toast("Movimiento registrado.", "success");
        build();
      });
    }

    function abrirModalCierre(turno) {
      var r = resumenTurno(turno);
      var wrap = U.openModal(
        '<h3 class="modal-title">Cerrar Caja — Arqueo</h3>' +
        '<div class="table-wrap" style="margin-bottom:12px"><table><tbody>' +
        "<tr><td>Base Inicial</td><td style='text-align:right'>" + fmtMoneda(turno.baseInicial) + "</td></tr>" +
        "<tr><td>+ Efectivo recibido en órdenes</td><td style='text-align:right'>" + fmtMoneda(r.efectivoOrdenes) + "</td></tr>" +
        "<tr><td>+ Ingresos manuales</td><td style='text-align:right'>" + fmtMoneda(r.ingresosManual) + "</td></tr>" +
        "<tr><td>− Egresos manuales</td><td style='text-align:right'>" + fmtMoneda(r.egresosManual) + "</td></tr>" +
        "<tr style='font-weight:700'><td>= Esperado en Efectivo</td><td style='text-align:right'>" + fmtMoneda(r.esperado) + "</td></tr>" +
        "</tbody></table></div>" +
        (Object.keys(r.porMetodo).length ? '<p class="text-muted" style="margin:0 0 12px;font-size:12.5px">Recibido por otros métodos (no afecta el efectivo): ' +
          Object.keys(r.porMetodo).filter(function (m) { return m !== (METODO_PAGO_LABEL.efectivo || "Efectivo"); }).map(function (m) { return "<b>" + U.esc(m) + "</b> " + fmtMoneda(r.porMetodo[m]); }).join("   ·   ") + "</p>" : "") +
        '<div class="field"><label>Monto Contado en Efectivo (conteo físico)</label><input type="text" inputmode="decimal" id="ci-contado" value="' + r.esperado + '"/></div>' +
        '<p id="ci-diferencia" class="text-muted" style="margin:-6px 0 10px;font-weight:700"></p>' +
        '<div class="field"><label>Observaciones (opcional)</label><textarea id="ci-observaciones" rows="2" placeholder="Ej. Faltante por vuelto mal dado en la mañana"></textarea></div>' +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="ci-confirmar">Cerrar Caja y Descargar PDF</button></div>',
        { lg: true }
      );
      var inpContado = wrap.querySelector("#ci-contado");
      var elDif = wrap.querySelector("#ci-diferencia");
      function actualizarDiferencia() {
        var contado = U.parseMonto(inpContado.value) || 0;
        var dif = Math.round((contado - r.esperado) * 100) / 100;
        if (Math.abs(dif) < 0.01) { elDif.textContent = "La caja cuadra exacto."; elDif.style.color = "var(--success, #0b8a4a)"; }
        else if (dif > 0) { elDif.textContent = "Sobrante de " + fmtMoneda(dif) + "."; elDif.style.color = "var(--warning, #c97d0d)"; }
        else { elDif.textContent = "Faltante de " + fmtMoneda(Math.abs(dif)) + "."; elDif.style.color = "var(--danger, #b91c1c)"; }
      }
      inpContado.addEventListener("input", actualizarDiferencia);
      actualizarDiferencia();

      wrap.querySelector("#ci-confirmar").addEventListener("click", function () {
        var contado = U.parseMonto(inpContado.value) || 0;
        var observaciones = wrap.querySelector("#ci-observaciones").value.trim();
        var cerrado = S.caja.cerrarTurno(turno.id, {
          usuario: session.nombre, usuarioId: session.userId || session.id, montoContado: contado,
          montoEsperadoEfectivo: r.esperado, desglosePorMetodoPago: r.porMetodo, observaciones: observaciones
        });
        if (!cerrado) { U.toast("No se pudo cerrar la caja — intenta de nuevo.", "error"); return; }
        S.addAudit(session.tenantId, session.nombre, session.rol, "CERRAR_CAJA", "caja", turno.id,
          "Cerró la caja — esperado " + fmtMoneda(r.esperado) + ", contado " + fmtMoneda(contado) + (cerrado.diferencia ? ", diferencia " + fmtMoneda(cerrado.diferencia) : ", sin diferencia") + ".");
        var bytes = window.BIO_PDF_CIERRE_CAJA.buildCierreCajaPDF(r.filas, tenant, turno.fechaApertura, turno.fechaCierre);
        U.downloadBytes(bytes, "Cierre_Caja_" + new Date(turno.fechaCierre).toISOString().slice(0, 10) + ".pdf");
        U.closeModal(wrap);
        U.toast("Caja cerrada.", "success");
        build();
      });
    }

    build();
  };
})();

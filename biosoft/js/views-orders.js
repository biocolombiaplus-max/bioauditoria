/* BIOsoft — Vistas: Órdenes de Laboratorio */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;
  // Con decimales cuando el precio los tiene (típico en dólares, ej.
  // "$4,50") pero sin ",00" de sobra en precios redondos.
  function fmtMoneda(n) {
    n = n || 0;
    var dec = Math.round(n) === n ? 0 : 2;
    return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
  }
  function fmtMonedaEquiv(tenant, n) {
    var extra = C.fmtMonedaAdicional(tenant, n || 0);
    return extra ? ' <span class="text-muted" style="font-size:11px">(' + extra + ')</span>' : "";
  }

  window.BIO_VIEWS.ordenes = function (root, param) {
    if (param && (param === "nueva" || param.indexOf("nueva-") === 0)) {
      var prefillId = param.indexOf("nueva-") === 0 ? param.replace("nueva-", "") : null;
      return renderNewOrder(root, prefillId);
    }
    if (param) return renderOrderDetail(root, param);
    renderList(root);
  };

  function renderList(root) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var orders = S.listOrders(session.tenantId);
    var conPrecio = !!(tenant && tenant.mostrarPrecioOrden);
    // El estado de pago (Pagado / Pago pendiente) solo aplica donde se
    // genera Recibo de Pago (ver puedeReciboOrden más abajo) — así el
    // laboratorio ve de un vistazo, sin entrar a cada orden, cuáles
    // órdenes con cobro ya se pagaron y cuáles siguen pendientes, con un
    // botón directo para registrar el pago apenas el cliente pague — igual
    // que ya funciona en Cotizaciones (pestaña Historial).
    var conEstadoPago = conPrecio && puedeReciboOrden(tenant);
    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">Órdenes de Laboratorio (' + orders.length + ')</h3>' +
      '<button class="btn btn-primary" id="btn-new-ord">' + U.icon("plus") + ' Nueva Orden</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Fecha</th><th>Prioridad</th><th># Exámenes</th>' + (conPrecio ? "<th>Valor a Cobrar</th>" : "") + (conEstadoPago ? "<th>Pago</th>" : "") + '<th>Estado</th><th></th></tr></thead><tbody>' +
      (orders.length ? orders.map(function (o) { return rowOrder(o, conPrecio, conEstadoPago, tenant); }).join("") : '<tr><td colspan="' + (7 + (conPrecio ? 1 : 0) + (conEstadoPago ? 1 : 0)) + '" class="text-muted">No hay órdenes registradas.</td></tr>') +
      "</tbody></table></div></div>";
    document.getElementById("btn-new-ord").addEventListener("click", function () { location.hash = "#/ordenes/nueva"; });
    root.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/ordenes/" + b.dataset.view; }); });
    root.querySelectorAll("[data-registrar-pago-orden]").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = orders.filter(function (x) { return x.id === b.dataset.registrarPagoOrden; })[0];
        if (o) abrirReciboOrden(o, tenant, function () { renderList(root); });
      });
    });
    root.querySelectorAll("[data-reenviar-recibo-orden]").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = orders.filter(function (x) { return x.id === b.dataset.reenviarReciboOrden; })[0];
        if (o) abrirReciboOrden(o, tenant, function () { renderList(root); });
      });
    });
    root.querySelectorAll("[data-agregar-abono-orden]").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = orders.filter(function (x) { return x.id === b.dataset.agregarAbonoOrden; })[0];
        if (o) abrirAgregarAbono(o, tenant, function () { renderList(root); });
      });
    });
    // Para cuando una orden se creó de más por error (ej. dos veces
    // seguidas para el mismo paciente) — borra la orden completa, sin
    // dejar ningún rastro "cancelado" a la vista. No toca al paciente ni
    // a ningún otro dato.
    root.querySelectorAll("[data-eliminar-orden]").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = orders.filter(function (x) { return x.id === b.dataset.eliminarOrden; })[0];
        if (!o) return;
        var pac = S.getPatient(o.patientId);
        if (!confirm('¿Eliminar la orden ' + o.numeroOrden + " de " + (pac ? U.nombreCompleto(pac) : "este paciente") + "? Esta acción no se puede deshacer.")) return;
        S.deleteOrder(o.id);
        var session2 = BIO_AUTH.getSession();
        S.addAudit(session2.tenantId, session2.nombre, session2.rol, "DELETE_ORDER", "orden", o.id, "Eliminó la orden " + o.numeroOrden + ".");
        U.toast("Orden eliminada.", "success");
        renderList(root);
      });
    });
  }

  function rowOrder(o, conPrecio, conEstadoPago, tenant) {
    var pac = S.getPatient(o.patientId);
    var celdaPago = "";
    if (conEstadoPago) {
      if (!o.valorCobrar) {
        celdaPago = "<td>—</td>";
      } else if (o.pago) {
        var saldoFila = C.saldoPendienteOrden(o);
        var esCreditoFila = o.pago.esCredito && !o.pago.tieneCopago;
        celdaPago = saldoFila > 0
          ? '<td><span class="badge badge-parcial">Parcial — Saldo ' + fmtMoneda(saldoFila) + '</span> <button class="btn btn-ghost btn-sm" style="margin-top:4px" data-agregar-abono-orden="' + o.id + '">' + U.icon("plus") + " Agregar Abono</button></td>"
          : esCreditoFila
          ? '<td><span class="badge badge-pendiente">🤝 A Crédito — Pendiente del Convenio</span> <button class="btn btn-ghost btn-sm" style="margin-top:4px" data-reenviar-recibo-orden="' + o.id + '" title="Reenviar el recibo de pago">' + U.icon("send") + " Recibo</button></td>"
          : '<td><span class="badge badge-validado">Pagado</span> <button class="btn btn-ghost btn-sm" style="margin-top:4px" data-reenviar-recibo-orden="' + o.id + '" title="Reenviar el recibo de pago">' + U.icon("send") + " Recibo</button></td>";
      } else {
        celdaPago = '<td><span class="badge badge-pendiente">Pago pendiente</span> <button class="btn btn-outline btn-sm" style="margin-top:4px" data-registrar-pago-orden="' + o.id + '">' + U.icon("check") + " Registrar Pago</button></td>";
      }
    }
    return "<tr><td><b>" + o.numeroOrden + "</b>" + (o.convenioNombre ? '<div class="text-muted" style="font-size:11px">🤝 ' + U.esc(o.convenioNombre) + "</div>" : "") + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + U.fmtFecha(o.fechaOrden) + "</td>" +
      '<td><span class="badge badge-' + (o.prioridad === "Urgente" ? "urgente" : "rutina") + '">' + o.prioridad + "</span></td>" +
      "<td>" + o.examenes.length + "</td>" + (conPrecio ? "<td>" + (o.valorCobrar ? fmtMoneda(o.valorCobrar) + fmtMonedaEquiv(tenant, o.valorCobrar) + (o.monedaPago ? ' <span class="text-muted" style="font-size:11px">· ' + o.monedaPago + "</span>" : "") : "—") + "</td>" : "") + celdaPago +
      "<td>" + window.BIO_badgeEstado(o.estadoGeneral) + '</td><td class="flex gap-2 wrap"><button class="btn btn-outline btn-sm" data-view="' + o.id + '">Ver</button>' +
      '<button class="btn btn-ghost btn-sm" data-eliminar-orden="' + o.id + '" title="Eliminar esta orden (ej. se creó de más por error)">' + U.icon("trash") + "</button></td></tr>";
  }

  // Paquetes de exámenes (ej. "Perfil Lipídico"): se crean en Cotizaciones
  // → "📦 Paquetes" — aquí solo se seleccionan y se EXPANDEN a sus exámenes
  // individuales al crear la orden (ver btn-save-order más abajo), porque
  // una orden necesita un renglón real por examen para captura de
  // resultados, permisos por sección y validación — un paquete es solo un
  // atajo de selección + precio con descuento, no puede quedar como un
  // solo "examen" opaco en la orden como sí se permite en una cotización.
  var SECCION_PAQUETES_ORDEN = { id: "paquetes-virtual", nombre: "📦 Paquetes" };

  function renderNewOrder(root, prefillId) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var examenes = C.examenesDisponibles(tenant);
    var paquetes = S.cotizador.listPaquetes(session.tenantId).filter(function (p) { return p.activo !== false && p.examenesIds && p.examenesIds.length; });
    var seccionesReales = C.seccionesEfectivas(tenant);
    // Un paquete puede quedar "exclusivo" de un convenio en particular (se
    // define en Cotizaciones → 📦 Paquetes) — aquí solo debe verse cuando
    // ESE convenio esté seleccionado como convenio de la orden, nunca sin
    // convenio ni con otro. Un paquete sin convenio asignado es general y
    // siempre se ve, igual que antes.
    function paquetesVisibles() {
      return paquetes.filter(function (p) { return !p.convenioId || p.convenioId === convenioIdSel; });
    }
    function seccionesActuales() {
      return paquetesVisibles().length ? [SECCION_PAQUETES_ORDEN].concat(seccionesReales) : seccionesReales;
    }
    var patients = S.listPatients(session.tenantId);
    var selectedExams = []; // {examId}
    var selectedPaquetes = []; // {paqueteId}
    var seccionesInicio = seccionesActuales();
    var activeSection = seccionesInicio.length ? seccionesInicio[0].id : null;
    var searchTerm = "";
    // Precios ya configurados por el laboratorio (Cotizador → Lista de
    // Precios), para sugerir el "Valor a Cobrar" automáticamente según los
    // exámenes que se van marcando, en vez de dejarlo siempre en blanco para
    // digitarlo a mano. Sigue siendo editable: si quien registra la orden lo
    // cambia manualmente, ya no se vuelve a recalcular solo.
    var preciosPorId = {};
    if (tenant.mostrarPrecioOrden) {
      S.cotizador.listPrecios(session.tenantId).forEach(function (p) { preciosPorId[p.examId] = p.precio; });
    }
    var precioEditadoManualmente = false;
    // Convenio/aliado (empresa con precios especiales — ver "🤝 Convenios"
    // en Cotizaciones): opcional, para dejar la orden ligada a esa empresa.
    // Sirve tanto para sugerir el "Valor a Cobrar" con su precio especial
    // como para que, si más adelante se le crea un acceso de solo consulta
    // a esa empresa (rol "aliado"), esta orden aparezca en su portal.
    // Médicos Remitentes registrados (ver "Médicos Remitentes" en
    // Administración) — quedan disponibles para elegir aquí, pero nunca
    // obligan: quien registra la orden siempre puede escribir un nombre
    // libre para un médico que aún no está registrado. Solo cuando se
    // elige uno del catálogo la orden queda ligada a él (order.
    // medicoRemitenteId) para poder calcular su comisión más adelante en
    // "Comisiones a Médicos Remitentes" (Reportes Administrativos).
    var medicosRemitentes = S.medicos.list(session.tenantId).filter(function (m) { return m.activo !== false; });
    var convenios = S.cotizador.listConvenios(session.tenantId).filter(function (c) { return c.activo; });
    var convenioPreciosPorConvenio = {};
    convenios.forEach(function (cv) {
      var mapa = {};
      S.cotizador.listConvenioPrecios(session.tenantId, cv.id).forEach(function (p) { mapa[p.examId] = p; });
      convenioPreciosPorConvenio[cv.id] = mapa;
    });
    var convenioIdSel = "";
    function precioConConvenio(examId) {
      var base = preciosPorId[examId] || 0;
      if (!convenioIdSel) return base;
      var convenio = convenios.filter(function (c) { return c.id === convenioIdSel; })[0];
      if (!convenio) return base;
      var especial = (convenioPreciosPorConvenio[convenioIdSel] || {})[examId];
      if (especial) return especial.modo === "fijo" ? especial.valor : Math.max(0, base * (1 - especial.valor / 100));
      if (convenio.descuentoGeneral > 0) return Math.max(0, base * (1 - convenio.descuentoGeneral / 100));
      return base;
    }
    // Igual que precioConConvenio(), pero para un PAQUETE: el descuento/
    // recargo general del convenio no se le aplica solo (ya trae su propio
    // precio total curado por el laboratorio), pero una tarifa exclusiva
    // puntual definida para ESE paquete en ESE convenio (Cotizador →
    // Convenios → 💲 Precios Especiales) sí tiene prioridad.
    function precioPaqueteConConvenio(paqueteId) {
      var paquete = paquetes.filter(function (p) { return p.id === paqueteId; })[0];
      var base = paquete ? (paquete.precio || 0) : 0;
      if (!convenioIdSel) return base;
      var especial = (convenioPreciosPorConvenio[convenioIdSel] || {})[paqueteId];
      if (!especial) return base;
      return especial.modo === "fijo" ? especial.valor : Math.max(0, base * (1 - especial.valor / 100));
    }

    root.innerHTML =
      '<div class="card">' +
        '<div class="card-header"><h3 class="card-title">Nueva Orden de Laboratorio</h3>' +
        '<a class="btn btn-ghost btn-sm" id="btn-cancel">Cancelar</a></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Paciente *</label><select id="f_patient">' +
            '<option value="">Selecciona un paciente…</option>' +
            patients.map(function (p) { return '<option value="' + p.id + '" ' + (p.id === prefillId ? "selected" : "") + ">" + p.tipoDocumento + " " + p.numeroDocumento + " — " + U.esc(U.nombreCompleto(p)) + "</option>"; }).join("") +
          "</select></div>" +
          F.sel("prioridad", "Prioridad", C.PRIORIDADES.map(function (p) { return "<option>" + p + "</option>"; }).join("")) +
          '<div class="field"><label>Médico Remitente</label><select id="f_medicoRemitenteId">' +
            '<option value="">✏️ Escribir un nombre (no registrado)</option>' +
            medicosRemitentes.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
            "</select>" +
            '<input id="f_medicoRemitenteTexto" placeholder="Nombre del médico" style="margin-top:6px"/></div>' +
          F.sel("procedencia", "Procedencia", C.PROCEDENCIAS.map(function (p) { return "<option>" + p + "</option>"; }).join("")) +
          F.inp("diagnostico", "Diagnóstico / Motivo", "") +
          (tenant.pais === "CO" ? F.inp("numAutorizacion", "N° de Autorización (si aplica, para RIPS)", "") + F.inp("diagnosticoCIE10", "Código CIE-10 (opcional, para RIPS)", "") : "") +
          (convenios.length ? '<div class="field"><label>Convenio / Empresa Aliada (opcional)</label><select id="f_convenio"><option value="">Sin convenio (particular)</option>' +
            convenios.map(function (c) { return '<option value="' + c.id + '">' + U.esc(c.nombre) + "</option>"; }).join("") + "</select></div>" : "") +
          // Solo tiene sentido para una orden de convenio: si el paciente
          // paga de contado, sigue el flujo normal de siempre (Recibo de
          // Pago pide confirmar cuánto pagó). Si es a crédito, la orden
          // queda marcada como cargo al convenio desde ya — sin pedir pago
          // al paciente — y aparece como PENDIENTE en Cartera por Convenio
          // y demás reportes, hasta que se le cobre al convenio.
          (convenios.length && tenant.mostrarPrecioOrden ? '<div class="field" id="campo-forma-pago-convenio" style="display:none"><label>Forma de Pago del Convenio</label><select id="f_formaPagoConvenio">' +
            '<option value="contado">Contado (el paciente paga ahora)</option>' +
            '<option value="credito">Crédito (queda pendiente — se le cobra al convenio después)</option>' +
            "</select></div>" : "") +
          (tenant.mostrarPrecioOrden ? '<div class="field"><label>Valor a Cobrar</label><input id="f_valorCobrar" type="number" step="any" value=""/>' +
            '<span class="text-muted" style="font-size:11px" id="valorCobrar-hint">Se calcula solo según los exámenes que selecciones — puedes ajustarlo a mano.</span>' +
            '<span class="text-muted" style="font-size:11px;display:block" id="valorCobrar-equiv"></span></div>' : "") +
          // Solo Venezuela: ahí es normal que, según el paciente, el cobro
          // termine en bolívares, dólares o pesos colombianos (frontera) —
          // se deja elegir por orden para poder cuadrar caja al final del
          // día, sin depender de la moneda base con la que el laboratorio
          // tiene cargados sus precios (tenant.monedaBase). Por defecto se
          // preselecciona según esa moneda base cuando coincide con USD o
          // COP; cualquier otro caso (Bs/VES/EUR/sin configurar) cae en
          // bolívares, la moneda oficial del país.
          (tenant.pais === "VE" && tenant.mostrarPrecioOrden ? F.sel("monedaPago", "Moneda de Pago",
            C.MONEDAS_PAGO.map(function (m) {
              var base = C.monedaBaseLabel(tenant);
              var sugerida = (base === "USD" || base === "COP") ? base : "VES";
              return '<option value="' + m.id + '" ' + (m.id === sugerida ? "selected" : "") + ">" + m.nombre + "</option>";
            }).join("")) : "") +
        "</div>" +
        '<div style="margin:6px 0 10px"><a class="btn btn-outline btn-sm" id="btn-new-patient-inline">' + U.icon("plus") + ' Registrar paciente nuevo</a></div>' +
      "</div>" +

      '<div class="card" style="margin-top:16px">' +
        '<div class="card-header"><h3 class="card-title">Selección de Exámenes</h3><span class="text-muted" id="sel-count">0 seleccionados</span></div>' +
        '<div class="field" style="margin-bottom:12px"><input id="exam-search" placeholder="Buscar examen por nombre o código CUPS en todas las secciones…"/></div>' +
        '<div class="exam-picker">' +
          '<div class="exam-picker-sections" id="sec-list"></div>' +
          '<div class="exam-picker-list" id="exam-list"></div>' +
        "</div>" +
        '<p class="text-muted" style="font-size:11.5px;margin:10px 0 0">' + U.esc(C.CATALOG_DISCLAIMER) + "</p>" +
        '<div class="flex wrap gap-2" id="chips" style="margin-top:14px"></div>' +
      "</div>" +

      '<div style="height:64px"></div>' +
      '<div class="barra-acciones-flotante">' +
        '<button class="btn btn-ghost" id="btn-cancel-bottom">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-save-order">' + U.icon("check") + " Crear Orden</button>" +
      "</div>";

    document.getElementById("btn-cancel").addEventListener("click", function () { location.hash = "#/ordenes"; });
    document.getElementById("btn-cancel-bottom").addEventListener("click", function () { location.hash = "#/ordenes"; });
    document.getElementById("btn-new-patient-inline").addEventListener("click", function () {
      window.BIO_openPatientForm(null, function () { location.hash = "#/ordenes/nueva"; BIO_ROUTER.renderRoute(); });
    });
    document.getElementById("exam-search").addEventListener("input", function (e) { searchTerm = e.target.value; renderSections(); renderExams(); });

    var selMedicoRemitente = document.getElementById("f_medicoRemitenteId");
    var inpMedicoRemitenteTexto = document.getElementById("f_medicoRemitenteTexto");
    function actualizarCampoMedicoRemitente() { inpMedicoRemitenteTexto.style.display = selMedicoRemitente.value ? "none" : ""; }
    selMedicoRemitente.addEventListener("change", actualizarCampoMedicoRemitente);
    actualizarCampoMedicoRemitente();

    function renderSections() {
      document.getElementById("sec-list").innerHTML = seccionesActuales().map(function (s) {
        var count = s.id === SECCION_PAQUETES_ORDEN.id ? selectedPaquetes.length : selectedExams.filter(function (id) { return C.examenEfectivo(id, tenant).seccion === s.id; }).length;
        return '<div class="sec-item ' + (!searchTerm && s.id === activeSection ? "active" : "") + '" data-sec="' + s.id + '">' + s.nombre + (count ? ' <span class="badge badge-validado" style="margin-left:4px">' + count + "</span>" : "") + "</div>";
      }).join("");
      document.querySelectorAll(".sec-item").forEach(function (el) {
        el.addEventListener("click", function () {
          activeSection = el.dataset.sec; searchTerm = ""; document.getElementById("exam-search").value = "";
          renderSections(); renderExams();
        });
      });
    }

    function renderExams() {
      var term = U.normalizar(searchTerm.trim());
      // "📦 Paquetes" es una sección propia con su propia lista de
      // casillas (una por paquete, no por examen) — no se mezcla con la
      // búsqueda general de exámenes individuales, igual que en el
      // Cotizador.
      if (!term && activeSection === SECCION_PAQUETES_ORDEN.id) {
        var visibles = paquetesVisibles();
        document.getElementById("exam-list").innerHTML = visibles.length ? visibles.map(function (p) {
          var checked = selectedPaquetes.indexOf(p.id) !== -1;
          var cant = p.examenesIds.length;
          var incluidos = p.examenesIds.map(function (id) { var e = C.examenPorId(id) || C.examenEfectivo(id, tenant); return e ? e.nombre : null; }).filter(Boolean).join(", ");
          var precioRegular = p.precio || 0;
          var precio = precioPaqueteConConvenio(p.id);
          var tieneDescuento = convenioIdSel && precio !== precioRegular;
          return '<label class="exam-row"><input type="checkbox" data-paquete="' + p.id + '" ' + (checked ? "checked" : "") + '/>' +
            '<div class="grow"><div>' + U.esc(p.nombre) + "</div>" +
            '<div class="meta">' + cant + " examen" + (cant === 1 ? "" : "es") + " incluido" + (cant === 1 ? "" : "s") + (incluidos ? " — " + U.esc(incluidos) : "") + "</div></div>" +
            (tenant.mostrarPrecioOrden ? '<div style="text-align:right;white-space:nowrap">' +
              (tieneDescuento ? '<div class="text-muted" style="font-size:11px;text-decoration:line-through">' + fmtMoneda(precioRegular) + "</div>" : "") +
              '<div style="font-weight:700;font-size:13px;' + (tieneDescuento ? "color:var(--brand-primary)" : "") + '">' + (precio ? fmtMoneda(precio) : '<span class="text-muted">Sin precio</span>') + "</div>" +
              "</div>" : "") +
            "</label>";
        }).join("") : '<p class="text-muted" style="padding:14px">Aún no has creado ningún paquete. Ve a Cotizaciones → "📦 Paquetes" para crear el primero.</p>';
        document.querySelectorAll("[data-paquete]").forEach(function (chk) {
          chk.addEventListener("change", function () {
            var id = chk.dataset.paquete;
            if (chk.checked) selectedPaquetes.push(id); else selectedPaquetes = selectedPaquetes.filter(function (x) { return x !== id; });
            renderChips(); renderSections(); sugerirValorCobrar();
          });
        });
        return;
      }
      var pool = term
        ? examenes.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : examenes.filter(function (e) { return e.seccion === activeSection; });
      var allChecked = pool.length > 0 && pool.every(function (e) { return selectedExams.indexOf(e.id) !== -1; });

      var rowsHtml = pool.map(function (e) {
        var checked = selectedExams.indexOf(e.id) !== -1;
        var tubo = C.tuboInfo(e.tubo);
        return '<label class="exam-row"><input type="checkbox" data-exam="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + C.seccionNombre(e.seccion, tenant) + "</span>" : "") + "</div>" +
          '<div class="meta"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + tubo.color + ';margin-right:5px;vertical-align:middle"></span>CUPS ' + e.cups + " · Nivel " + e.nivel + " · " + U.esc(tubo.nombre) + "</div></div></label>";
      }).join("") || '<p class="text-muted" style="padding:14px">Sin resultados para tu búsqueda.</p>';

      document.getElementById("exam-list").innerHTML =
        '<div class="flex justify-between items-center" style="padding:4px 10px 10px">' +
        '<span class="text-muted" style="font-size:11.5px">' + pool.length + " examen(es)</span>" +
        (pool.length ? '<button class="btn btn-ghost btn-sm" id="btn-select-all">' + (allChecked ? "Quitar todos" : "Seleccionar todos") + "</button>" : "") +
        "</div>" + rowsHtml;

      document.querySelectorAll("[data-exam]").forEach(function (chk) {
        chk.addEventListener("change", function () {
          var id = chk.dataset.exam;
          if (chk.checked) selectedExams.push(id); else selectedExams = selectedExams.filter(function (x) { return x !== id; });
          renderChips(); renderSections(); sugerirValorCobrar();
        });
      });
      var btnAll = document.getElementById("btn-select-all");
      if (btnAll) btnAll.addEventListener("click", function () {
        if (allChecked) selectedExams = selectedExams.filter(function (id) { return !pool.some(function (e) { return e.id === id; }); });
        else pool.forEach(function (e) { if (selectedExams.indexOf(e.id) === -1) selectedExams.push(e.id); });
        renderExams(); renderChips(); renderSections(); sugerirValorCobrar();
      });
    }

    function sugerirValorCobrar() {
      if (!tenant.mostrarPrecioOrden) return;
      var equiv = document.getElementById("valorCobrar-equiv");
      if (precioEditadoManualmente) {
        if (equiv) equiv.textContent = C.fmtMonedaAdicional(tenant, parseFloat(document.getElementById("f_valorCobrar").value) || 0);
        return;
      }
      var input = document.getElementById("f_valorCobrar");
      if (!input) return;
      // El precio de un paquete es el precio TOTAL que se le fijó al
      // crearlo (con su descuento ya incluido) — no la suma de sus
      // exámenes individuales, igual que en el Cotizador — salvo que el
      // convenio seleccionado tenga una tarifa exclusiva puntual para ese
      // paquete (ver precioPaqueteConConvenio).
      var totalPaquetes = selectedPaquetes.reduce(function (sum, id) { return sum + precioPaqueteConConvenio(id); }, 0);
      // Un examen ya cubierto por un paquete seleccionado no se vuelve a
      // sumar por separado, aunque también esté marcado a mano — su costo
      // ya está incluido en el precio del paquete.
      var idsEnPaquetes = {};
      selectedPaquetes.forEach(function (id) {
        var p = paquetes.filter(function (x) { return x.id === id; })[0];
        if (p) p.examenesIds.forEach(function (exId) { idsEnPaquetes[exId] = true; });
      });
      var total = selectedExams.filter(function (id) { return !idsEnPaquetes[id]; }).reduce(function (sum, id) { return sum + precioConConvenio(id); }, 0) + totalPaquetes;
      input.value = total || "";
      if (equiv) equiv.textContent = C.fmtMonedaAdicional(tenant, total);
    }

    function renderChips() {
      document.getElementById("sel-count").textContent = (selectedExams.length + selectedPaquetes.length) + " seleccionados";
      var chipsExamenes = selectedExams.map(function (id) {
        var e = C.examenEfectivo(id, tenant);
        return '<span class="chip">' + U.esc(e.nombre) + ' <button data-remove="' + id + '">' + U.icon("x") + "</button></span>";
      });
      var chipsPaquetes = selectedPaquetes.map(function (id) {
        var p = paquetes.filter(function (x) { return x.id === id; })[0];
        return '<span class="chip" style="border-color:var(--brand-primary)">📦 ' + U.esc(p ? p.nombre : id) + ' <button data-remove-paquete="' + id + '">' + U.icon("x") + "</button></span>";
      });
      document.getElementById("chips").innerHTML = chipsPaquetes.join("") + chipsExamenes.join("");
      document.querySelectorAll("[data-remove]").forEach(function (b) {
        b.addEventListener("click", function () {
          selectedExams = selectedExams.filter(function (x) { return x !== b.dataset.remove; });
          renderChips(); renderExams(); renderSections(); sugerirValorCobrar();
        });
      });
      document.querySelectorAll("[data-remove-paquete]").forEach(function (b) {
        b.addEventListener("click", function () {
          selectedPaquetes = selectedPaquetes.filter(function (x) { return x !== b.dataset.removePaquete; });
          renderChips(); renderExams(); renderSections(); sugerirValorCobrar();
        });
      });
    }
    var campoFormaPagoConvenio = document.getElementById("campo-forma-pago-convenio");
    function actualizarCampoFormaPagoConvenio() { if (campoFormaPagoConvenio) campoFormaPagoConvenio.style.display = convenioIdSel ? "" : "none"; }
    var selConvenioEl = document.getElementById("f_convenio");
    if (selConvenioEl) {
      selConvenioEl.addEventListener("change", function (e) {
        convenioIdSel = e.target.value;
        actualizarCampoFormaPagoConvenio();
        precioEditadoManualmente = false;
        // Un paquete exclusivo de OTRO convenio (o de ninguno, si venía
        // marcado antes de elegir convenio) deja de ser válido al cambiar
        // de convenio — se quita de la selección para no dejar en la
        // orden un paquete que ya no debería verse ni cobrarse así.
        var idsVisibles = paquetesVisibles().map(function (p) { return p.id; });
        selectedPaquetes = selectedPaquetes.filter(function (id) { return idsVisibles.indexOf(id) !== -1; });
        if (activeSection === SECCION_PAQUETES_ORDEN.id && !idsVisibles.length) {
          activeSection = seccionesReales.length ? seccionesReales[0].id : null;
        }
        renderSections();
        renderExams();
        renderChips();
        sugerirValorCobrar();
      });
    }
    renderSections(); renderExams(); renderChips();
    if (tenant.mostrarPrecioOrden) {
      document.getElementById("f_valorCobrar").addEventListener("input", function (e) {
        precioEditadoManualmente = true;
        var hint = document.getElementById("valorCobrar-hint");
        if (hint) hint.textContent = "Ajustado manualmente.";
        var equiv = document.getElementById("valorCobrar-equiv");
        if (equiv) equiv.textContent = C.fmtMonedaAdicional(tenant, parseFloat(e.target.value) || 0);
      });
      sugerirValorCobrar();
    }

    document.getElementById("btn-save-order").addEventListener("click", function () {
      var patientId = document.getElementById("f_patient").value;
      if (!patientId) { U.toast("Selecciona un paciente.", "error"); return; }
      if (!selectedExams.length && !selectedPaquetes.length) { U.toast("Selecciona al menos un examen o paquete.", "error"); return; }
      // Un paquete no es un "examen" real del catálogo — es un atajo de
      // selección (varios exámenes con un precio con descuento). La orden
      // necesita un renglón real por examen para poder capturar
      // resultados, así que aquí se EXPANDE cada paquete elegido a sus
      // exámenes individuales, sin duplicar uno que ya esté incluido a
      // mano o en dos paquetes distintos.
      var idsExamenesFinal = selectedExams.slice();
      selectedPaquetes.forEach(function (paqId) {
        var p = paquetes.filter(function (x) { return x.id === paqId; })[0];
        if (!p) return;
        p.examenesIds.forEach(function (exId) { if (idsExamenesFinal.indexOf(exId) === -1) idsExamenesFinal.push(exId); });
      });
      var pacSel = S.getPatient(patientId);
      var convenioSel = convenioIdSel ? convenios.filter(function (c) { return c.id === convenioIdSel; })[0] : null;
      var formaPagoConvenioEl = document.getElementById("f_formaPagoConvenio");
      var esCreditoConvenio = !!(convenioIdSel && formaPagoConvenioEl && formaPagoConvenioEl.value === "credito");
      var medicoRemitenteSel = selMedicoRemitente.value ? medicosRemitentes.filter(function (m) { return m.id === selMedicoRemitente.value; })[0] : null;
      var order = {
        tenantId: session.tenantId,
        numeroOrden: S.nextOrderNumber(session.tenantId),
        patientId: patientId,
        // Copia mínima de los datos del paciente que necesita el PDF de
        // resultados (ver pdf.js -> buildResultadosPDF), para que un acceso
        // de "aliado" (solo consulta de un convenio) pueda ver y descargar
        // el resultado sin que sus reglas de Firestore necesiten darle
        // lectura de la colección patients completa (ver firestore.rules).
        pacienteSnap: pacSel ? {
          primerNombre: pacSel.primerNombre, segundoNombre: pacSel.segundoNombre, primerApellido: pacSel.primerApellido, segundoApellido: pacSel.segundoApellido,
          tipoDocumento: pacSel.tipoDocumento, numeroDocumento: pacSel.numeroDocumento, fechaNacimiento: pacSel.fechaNacimiento, sexo: pacSel.sexo, pais: pacSel.pais, eps: pacSel.eps || ""
        } : null,
        convenioId: convenioIdSel || "",
        convenioNombre: convenioSel ? convenioSel.nombre : "",
        fechaOrden: new Date().toISOString(),
        prioridad: document.getElementById("f_prioridad").value,
        procedencia: document.getElementById("f_procedencia").value,
        medicoRemitente: medicoRemitenteSel ? medicoRemitenteSel.nombre : document.getElementById("f_medicoRemitenteTexto").value.trim(),
        medicoRemitenteId: selMedicoRemitente.value || "",
        diagnostico: document.getElementById("f_diagnostico").value,
        numAutorizacion: tenant.pais === "CO" ? document.getElementById("f_numAutorizacion").value : "",
        diagnosticoCIE10: tenant.pais === "CO" ? document.getElementById("f_diagnosticoCIE10").value : "",
        valorCobrar: tenant.mostrarPrecioOrden ? (parseFloat(document.getElementById("f_valorCobrar").value) || 0) : null,
        monedaPago: (tenant.pais === "VE" && tenant.mostrarPrecioOrden) ? document.getElementById("f_monedaPago").value : "",
        examenes: idsExamenesFinal.map(function (id) {
          var exCat = C.examenEfectivo(id, tenant);
          return {
            examId: id, seccion: exCat.seccion, estado: "pendiente", valores: [], observaciones: "",
            validadoPor: "", validadoPorUserId: "", fechaValidacion: "", ingresadoPor: "", fechaIngreso: "", version: 1, correcciones: [],
            remitido: false, laboratorioRemision: "", pdfRemitidoDataUrl: "", pdfRemitidoNombre: ""
          };
        }),
        estadoGeneral: "pendiente", creadoPor: session.username
      };
      // A crédito de convenio: se marca el pago desde ya (sin pedirle nada
      // al paciente) para que "Recibo de Pago" genere directo el cargo a
      // convenio de una vez, y para que el saldo quede como PENDIENTE en
      // Cartera por Convenio y demás reportes hasta que se le cobre al
      // convenio — ver calcularCartera() en views-cotizador.js.
      if (esCreditoConvenio) {
        order.pago = { fecha: order.fechaOrden, monto: order.valorCobrar || 0, confirmadoPor: session.nombre, esCredito: true };
      }
      var created = S.createOrder(order);
      var detallePaquetes = selectedPaquetes.length ? " (incluye " + selectedPaquetes.length + " paquete(s))" : "";
      S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_ORDER", "orden", created.id, "Creó la orden " + created.numeroOrden + " con " + idsExamenesFinal.length + " examen(es)" + detallePaquetes +
        (esCreditoConvenio ? " a crédito del convenio " + (convenioSel ? convenioSel.nombre : "—") + "." : "."));
      U.toast("Orden " + created.numeroOrden + " creada.", "success");
      ofrecerStickers(created);
    });
  }

  function ofrecerStickers(order) {
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_AUTH.currentTenant();
    var wrap = U.openModal(
      '<h3 class="modal-title">Orden ' + order.numeroOrden + " creada</h3>" +
      '<p class="text-muted">¿Deseas imprimir ahora los stickers para rotular los tubos de esta orden?</p>' +
      (puedeReciboOrden(tenant) ? '<button class="btn btn-outline btn-block" id="btn-recibo-orden" style="margin-bottom:12px">' + U.icon("send") + " Recibo de Pago (confirmar y enviar)</button>" : "") +
      '<div class="flex gap-2 justify-between">' +
      '<button class="btn btn-ghost" id="btn-skip">Continuar sin imprimir</button>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-outline btn-sm" id="btn-stickers-preview" title="Ver antes de imprimir o elegir otra impresora">Vista previa</button>' +
      '<button class="btn btn-primary" id="btn-stickers-now">' + U.icon("printer") + " Imprimir Stickers</button>" +
      "</div></div>"
    );
    // Las otras 3 opciones de este modal (Continuar sin imprimir, Vista
    // previa, Imprimir Stickers) SÍ llevaban a la orden recién creada
    // (#/ordenes/:id) apenas se hacía clic — esta era la única que se
    // quedaba sin navegar a ningún lado. La orden en sí quedaba bien
    // creada (por eso el recibo se generaba perfecto), pero como el
    // usuario seguía viendo detrás la MISMA pantalla de "Nueva Orden"
    // (con el buscador de exámenes vacío), parecía que la orden nunca
    // había terminado de crearse — bug real reportado. Se agrega la
    // misma navegación que ya tienen las otras 3 opciones.
    if (puedeReciboOrden(tenant)) wrap.querySelector("#btn-recibo-orden").addEventListener("click", function () {
      U.closeModal(wrap);
      abrirReciboOrden(order, tenant);
      location.hash = "#/ordenes/" + order.id;
    });
    wrap.querySelector("#btn-skip").addEventListener("click", function () { U.closeModal(wrap); location.hash = "#/ordenes/" + order.id; });
    wrap.querySelector("#btn-stickers-preview").addEventListener("click", function () {
      U.closeModal(wrap);
      window.BIO_PDF.previewStickers(order, pac, tenant);
      location.hash = "#/ordenes/" + order.id;
    });
    wrap.querySelector("#btn-stickers-now").addEventListener("click", function () {
      U.closeModal(wrap);
      window.BIO_PDF.imprimirStickersRapido(order, pac, tenant);
      location.hash = "#/ordenes/" + order.id;
    });
  }

  // -------------------------------------------------------------------
  // RECIBO DE PAGO DE LA ORDEN — nació pensado sobre todo para laboratorios
  // de Venezuela, que cobran con un equivalente en bolívares según la tasa
  // del día (tenant.monedaAdicional), pero el PDF en sí (pdf-recibo-orden.js)
  // no tiene nada específico de ningún país — solo necesita que el
  // laboratorio use "Valor a Cobrar" en sus órdenes. Se generalizó a
  // cualquier país (antes exigía tenant.pais === "VE") a pedido de un
  // laboratorio de Colombia que también lo necesitaba. Antes de generar/
  // enviar el recibo siempre se pide confirmar que el cliente ya pagó,
  // para no emitir un recibo sin respaldo.
  // -------------------------------------------------------------------
  function puedeReciboOrden(tenant) {
    return !!tenant && !!tenant.mostrarPrecioOrden;
  }

  /* "Factura Estilo Clásico" (Configuración → Operación → Formato de
     Factura / Recibo): antes de generarla la PRIMERA vez para una orden,
     se abre este formulario para revisar/ajustar el código, precio y
     cantidad de cada examen (por si hay que facturar más de una unidad
     de un mismo examen — ej. dos pacientes atendidos con el mismo
     paquete, como pasa en la práctica en algunos laboratorios), y agregar
     descuento, impuesto y observaciones libres — igual que armar una
     factura de venta tradicional. Lo que quede aquí se guarda en
     order.facturaClasica para que reenviar la factura más adelante no
     vuelva a pedir todo esto (ver abrirReciboOrden). */
  function abrirEditorFacturaClasica(order, pac, tenant, precios, onListo) {
    var numeroSugerido = S.facturacion.nextNumeroFactura(order.tenantId);
    var filas = order.examenes.map(function (ex) {
      var exCat = C.examenEfectivo(ex.examId, tenant);
      return { examId: ex.examId, codigo: exCat ? exCat.cups : "", descripcion: exCat ? exCat.nombre : ex.examId, precio: precios[ex.examId] || 0, cantidad: 1 };
    });

    function filaHtml(f, i) {
      return "<tr><td>" + U.esc(f.codigo || "—") + "</td><td>" + U.esc(f.descripcion) + "</td>" +
        '<td><input type="number" step="any" min="0" class="fc-precio" data-i="' + i + '" value="' + f.precio + '" style="width:95px"/></td>' +
        '<td><input type="number" step="1" min="0" class="fc-cant" data-i="' + i + '" value="' + f.cantidad + '" style="width:60px"/></td>' +
        '<td class="fc-importe" data-i="' + i + '" style="text-align:right">' + fmtMoneda(f.precio * f.cantidad) + "</td></tr>";
    }

    var wrap = U.openModal(
      '<h3 class="modal-title">Factura — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Revisa el código, precio y cantidad de cada examen antes de generar la factura. Esto solo se pide una vez por orden — al reenviarla se reutiliza lo que armes aquí.</p>' +
      '<div class="field" style="max-width:180px"><label>N° de Factura</label><input id="fc-numero" type="number" min="1" value="' + numeroSugerido + '"/></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Precio</th><th>Cant.</th><th>Importe</th></tr></thead><tbody id="fc-tbody">' +
      filas.map(filaHtml).join("") + "</tbody></table></div>" +
      '<div class="form-grid" style="margin-top:12px">' +
      '<div class="field"><label>Descuento</label><input id="fc-descuento" type="number" step="any" min="0" value="0"/></div>' +
      '<div class="field"><label>Impuesto</label><input id="fc-impuesto" type="number" step="any" min="0" value="0"/></div>' +
      '<div class="field"><label>Abono</label><input id="fc-abono" type="number" step="any" min="0" value="' + (order.valorCobrar || 0) + '"/></div>' +
      "</div>" +
      '<div class="field"><label>Observaciones</label><textarea id="fc-observaciones" rows="2" placeholder="Ej. 2do paciente atendido: Nombre — Documento"></textarea></div>' +
      '<p id="fc-totales" class="text-muted" style="text-align:right;font-weight:700;margin-top:10px"></p>' +
      '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="fc-generar">Generar Factura</button></div>'
    );

    function recalcular() {
      var subtotal = filas.reduce(function (a, f) { return a + f.precio * f.cantidad; }, 0);
      var descuento = parseFloat(document.getElementById("fc-descuento").value) || 0;
      var impuesto = parseFloat(document.getElementById("fc-impuesto").value) || 0;
      var total = Math.max(0, subtotal - descuento + impuesto);
      document.getElementById("fc-totales").textContent = "Subtotal: " + fmtMoneda(subtotal) + "   ·   Total a Pagar: " + fmtMoneda(total);
      filas.forEach(function (f, i) {
        var el = wrap.querySelector('.fc-importe[data-i="' + i + '"]');
        if (el) el.textContent = fmtMoneda(f.precio * f.cantidad);
      });
    }
    wrap.querySelectorAll(".fc-precio").forEach(function (inp) {
      inp.addEventListener("input", function () { filas[this.dataset.i].precio = parseFloat(this.value) || 0; recalcular(); });
    });
    wrap.querySelectorAll(".fc-cant").forEach(function (inp) {
      inp.addEventListener("input", function () { filas[this.dataset.i].cantidad = parseFloat(this.value) || 0; recalcular(); });
    });
    wrap.querySelector("#fc-descuento").addEventListener("input", recalcular);
    wrap.querySelector("#fc-impuesto").addEventListener("input", recalcular);
    recalcular();

    wrap.querySelector("#fc-generar").addEventListener("click", function () {
      var session = BIO_AUTH.getSession();
      var numeroFinal = parseInt(document.getElementById("fc-numero").value, 10) || numeroSugerido;
      var descuento = parseFloat(document.getElementById("fc-descuento").value) || 0;
      var impuesto = parseFloat(document.getElementById("fc-impuesto").value) || 0;
      var subtotal = filas.reduce(function (a, f) { return a + f.precio * f.cantidad; }, 0);
      var factura = {
        numero: numeroFinal, fecha: new Date().toISOString(),
        filas: filas.map(function (f) { return { codigo: f.codigo, descripcion: f.descripcion, precio: f.precio, cantidad: f.cantidad }; }),
        descuento: descuento, impuesto: impuesto,
        abono: parseFloat(document.getElementById("fc-abono").value) || 0,
        observaciones: document.getElementById("fc-observaciones").value.trim()
      };
      S.facturacion.guardarFacturaGenerada(order.tenantId, {
        numero: numeroFinal, numeroOrden: order.numeroOrden, patientId: order.patientId,
        pacienteNombre: pac ? U.nombreCompleto(pac) : "—", total: Math.max(0, subtotal - descuento + impuesto),
        estilo: "clasica", generadoPor: session.username
      });
      S.addAudit(order.tenantId, session.nombre, session.rol, "GENERATE_FACTURA_CLASICA", "orden", order.id, "Generó la Factura Clásica N° " + numeroFinal + " para la orden " + order.numeroOrden + ".");
      U.closeModal(wrap);
      onListo(factura);
    });
  }

  async function abrirReciboOrden(order, tenant, onDone) {
    var pac = S.getPatient(order.patientId);
    var precios = {};
    S.cotizador.listPrecios(order.tenantId).forEach(function (p) { precios[p.examId] = p.precio; });
    var formatoClasico = tenant.formatoFactura === "clasica";

    async function generarYEnviar(pago) {
      var esFacturaClasica = formatoClasico && order.facturaClasica;
      var bytes = esFacturaClasica
        ? await BIO_PDF_FACTURA_CLASICA.buildFacturaClasicaPDF(order, pac, tenant, order.facturaClasica)
        : await BIO_PDF_RECIBO_ORDEN.buildReciboOrdenPDF(order, pac, tenant, pago, precios);
      var nombreArchivo = (esFacturaClasica ? "Factura_" : "Recibo_") + "Orden_" + order.numeroOrden + ".pdf";
      U.downloadBytes(bytes, nombreArchivo);
      U.toast((esFacturaClasica ? "Factura" : "Recibo") + " generado y descargado.", "success");
      // Con Factura Estilo Clásico el monto que de verdad cobra la factura
      // (con su propio descuento/impuesto) puede no ser igual al Valor a
      // Cobrar de la orden — se usa el Total a Pagar real de la factura
      // para que el mensaje de envío no diga un monto distinto al del PDF.
      var monto = esFacturaClasica
        ? Math.max(0, order.facturaClasica.filas.reduce(function (a, f) { return a + f.precio * f.cantidad; }, 0) - (order.facturaClasica.descuento || 0) + (order.facturaClasica.impuesto || 0))
        : (pago.monto != null ? pago.monto : order.valorCobrar);
      var extra = C.fmtMonedaAdicional(tenant, monto);
      var mensaje = "Hola " + (pac ? U.nombreCompleto(pac).split(" ")[0] : "") + " 👋 Adjunto " + (esFacturaClasica ? "la factura" : "el recibo de pago") + " de tu orden " + order.numeroOrden + " en " + tenant.nombre + " por " + fmtMoneda(monto) + (extra ? " (" + extra + ")" : "") + ". ¡Gracias por tu confianza!";
      var wrapEnvio = U.openModal(
        '<h3 class="modal-title">' + (esFacturaClasica ? "Factura lista" : "Recibo listo") + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Ya se descargó el PDF. Adjúntalo antes de enviar por el canal que elijas, o imprímelo directamente.</p>' +
        '<div class="flex gap-2 wrap">' +
        '<button class="btn btn-outline btn-sm" id="rec-ord-print">' + U.icon("printer") + " Imprimir</button>" +
        (pac && pac.celular ? '<button class="btn btn-whatsapp btn-sm" id="rec-ord-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" : "") +
        U.botonCompartirPDFHtml("rec-ord-compartir") +
        "</div>" +
        (pac && pac.email ? U.emailProviderButtonsHtml("rec-ord-mail") : '<p class="text-muted" style="font-size:12px;margin-top:10px">Este paciente no tiene correo ni WhatsApp guardados para enviarlo directo — descarga e imprime, o agrégalos a su ficha.</p>') +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrapEnvio.querySelector("#rec-ord-print").addEventListener("click", function () {
        var blob = new Blob([bytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var w = window.open(url, "_blank");
        if (w) w.addEventListener("load", function () { w.print(); });
      });
      var btnWa = wrapEnvio.querySelector("#rec-ord-wa");
      if (btnWa) btnWa.addEventListener("click", function () {
        var numero = U.numeroWhatsapp(pac.celular, tenant.pais);
        window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje), "_blank");
      });
      var btnCompartir = wrapEnvio.querySelector("#rec-ord-compartir");
      if (btnCompartir) btnCompartir.addEventListener("click", function () { U.compartirPDF(bytes, nombreArchivo, mensaje); });
      if (pac && pac.email) U.wireEmailProviderButtons(wrapEnvio, "rec-ord-mail", pac.email, (esFacturaClasica ? "Factura" : "Recibo de pago") + " — " + tenant.nombre, mensaje);
      if (onDone) onDone();
    }

    // Con Factura Estilo Clásico, antes de generar (pagado ya o recién
    // confirmado) hace falta armar la factura (código/precio/cantidad de
    // cada examen, descuento, impuesto, observaciones) — pero solo la
    // PRIMERA vez para esta orden; si ya se armó antes (order.facturaClasica),
    // se reutiliza tal cual, igual que order.pago ya se reutiliza siempre.
    function continuarConPago(pago) {
      if (formatoClasico && !order.facturaClasica) {
        abrirEditorFacturaClasica(order, pac, tenant, precios, function (factura) {
          order.facturaClasica = factura;
          S.saveOrder(order);
          generarYEnviar(pago);
        });
        return;
      }
      generarYEnviar(pago);
    }

    if (order.pago) { await continuarConPago(order.pago); return; }

    // Con "Recibo de Pago detallado" activo, una orden que pertenece a un
    // convenio se trata como lo que es — un cargo a crédito, no un pago
    // recibido en el momento — así que no tiene sentido pedir "¿ya pagó?"
    // ni un método de pago; se genera directo el cargo a la cuenta del
    // convenio. Sin esta opción (o para órdenes particulares), el flujo de
    // siempre sigue igual.
    var esCargoConvenio = !!(tenant.reciboConvenioComoCredito && order.convenioId);
    // Si el convenio de esta orden tiene copago activado (ver "Nuevo
    // Convenio / Tarifa" -> "Este convenio maneja copago"), el paciente sí
    // paga una parte de su bolsillo — solo esa parte necesita método de
    // pago y confirmación; el resto sigue yendo a crédito del convenio
    // exactamente igual que antes.
    var convenio = order.convenioId ? S.cotizador.listConvenios(order.tenantId).filter(function (c) { return c.id === order.convenioId; })[0] : null;
    var valorCopago = esCargoConvenio ? C.calcularCopago(convenio, order.valorCobrar) : 0;
    var tieneCopago = valorCopago > 0;
    var valorConvenio = order.valorCobrar - valorCopago;
    // El paciente puede pagar menos de lo que debe (abono parcial) — el
    // monto a pagar (valorCopago o el valor completo) sale prellenado,
    // pero es editable. Si lo que se recibe es menor, la orden queda
    // "Parcial" con un saldo pendiente que se puede ir completando
    // después con "Agregar Abono" (ver el botón en el detalle de la
    // orden), en vez de forzar a elegir entre "pagó todo" o "no pagó
    // nada" — así funciona un sistema financiero de verdad.
    var montoDebido = tieneCopago ? valorCopago : order.valorCobrar;
    var wrapConfirm = U.openModal(
      tieneCopago
        ? '<h3 class="modal-title">Copago — Orden ' + order.numeroOrden + '</h3>' +
          '<p class="text-muted" style="margin-top:0">El convenio <b>' + U.esc(order.convenioNombre || "—") + "</b> maneja copago: el paciente paga <b>" + fmtMoneda(valorCopago) + fmtMonedaEquiv(tenant, valorCopago) + "</b> y el resto (<b>" + fmtMoneda(valorConvenio) + fmtMonedaEquiv(tenant, valorConvenio) + "</b>) queda a crédito del convenio.</p>" +
          '<div class="field"><label>Método de Pago del Copago</label><select id="rec-ord-metodo">' +
          Object.keys(BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL).map(function (k) { return '<option value="' + k + '">' + BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[k] + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field"><label>Monto Recibido del Copago</label><input type="number" step="any" min="0" id="rec-ord-monto" value="' + valorCopago + '"/>' +
          '<span class="text-muted" style="font-size:11px" id="rec-ord-monto-hint"></span></div>' +
          '<label class="checkbox-row" style="margin-top:10px"><input type="checkbox" id="rec-ord-confirmo"/> Confirmo que el paciente pagó lo indicado arriba y se genera el cargo a crédito del resto al convenio ' + U.esc(order.convenioNombre || "—") + "</label>" +
          '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rec-ord-confirmar" disabled>Confirmar y Generar Recibo</button></div>'
        : esCargoConvenio
        ? '<h3 class="modal-title">Cargo a Convenio — Orden ' + order.numeroOrden + '</h3>' +
          '<p class="text-muted" style="margin-top:0">Esta orden pertenece al convenio <b>' + U.esc(order.convenioNombre || "—") + "</b> — todo convenio se maneja a crédito, así que este recibo queda como cargo a su cuenta, sin método de pago ni confirmación de pago recibido.</p>" +
          '<label class="checkbox-row" style="margin-top:10px"><input type="checkbox" id="rec-ord-confirmo"/> Confirmo generar el cargo a crédito de ' + fmtMoneda(order.valorCobrar) + fmtMonedaEquiv(tenant, order.valorCobrar) + " al convenio " + U.esc(order.convenioNombre || "—") + "</label>" +
          '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rec-ord-confirmar" disabled>Generar Cargo a Convenio</button></div>'
        : '<h3 class="modal-title">Recibo de Pago — Orden ' + order.numeroOrden + '</h3>' +
          '<p class="text-muted" style="margin-top:0">Antes de generar el recibo, confirma cuánto pagó el cliente. Si paga menos del valor total, la orden queda con saldo pendiente y podrás agregar el resto más adelante desde "Agregar Abono".</p>' +
          '<div class="field"><label>Método de Pago</label><select id="rec-ord-metodo">' +
          Object.keys(BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL).map(function (k) { return '<option value="' + k + '">' + BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[k] + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field"><label>Monto Recibido (Valor Total: ' + fmtMoneda(order.valorCobrar) + fmtMonedaEquiv(tenant, order.valorCobrar) + ')</label><input type="number" step="any" min="0" id="rec-ord-monto" value="' + order.valorCobrar + '"/>' +
          '<span class="text-muted" style="font-size:11px" id="rec-ord-monto-hint"></span></div>' +
          '<label class="checkbox-row" style="margin-top:10px"><input type="checkbox" id="rec-ord-confirmo"/> Confirmo que el cliente pagó el monto indicado arriba</label>' +
          '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rec-ord-confirmar" disabled>Confirmar Pago y Generar Recibo</button></div>'
    );
    var chk = wrapConfirm.querySelector("#rec-ord-confirmo");
    var btnConfirmar = wrapConfirm.querySelector("#rec-ord-confirmar");
    chk.addEventListener("change", function () { btnConfirmar.disabled = !chk.checked; });
    var inpMonto = wrapConfirm.querySelector("#rec-ord-monto");
    var hintMonto = wrapConfirm.querySelector("#rec-ord-monto-hint");
    if (inpMonto) {
      var actualizarHintMonto = function () {
        var v = parseFloat(inpMonto.value) || 0;
        if (v <= 0) { hintMonto.textContent = "Escribe cuánto pagó realmente."; hintMonto.style.color = "var(--danger, #b91c1c)"; }
        else if (v < montoDebido) { hintMonto.textContent = "Abono parcial — queda un saldo pendiente de " + fmtMoneda(montoDebido - v) + fmtMonedaEquiv(tenant, montoDebido - v) + "."; hintMonto.style.color = "var(--warning, #c97d0d)"; }
        else { hintMonto.textContent = "Pago completo."; hintMonto.style.color = ""; }
      };
      inpMonto.addEventListener("input", actualizarHintMonto);
      actualizarHintMonto();
    }
    btnConfirmar.addEventListener("click", async function () {
      var session = BIO_AUTH.getSession();
      var montoRecibido = inpMonto ? (parseFloat(inpMonto.value) || 0) : order.valorCobrar;
      var pago = tieneCopago
        ? { fecha: new Date().toISOString(), metodoPago: wrapConfirm.querySelector("#rec-ord-metodo").value, monto: montoRecibido, valorCopago: valorCopago, valorConvenio: valorConvenio, tieneCopago: true, esCredito: true, confirmadoPor: session.nombre }
        : esCargoConvenio
        ? { fecha: new Date().toISOString(), monto: order.valorCobrar, confirmadoPor: session.nombre, esCredito: true }
        : { fecha: new Date().toISOString(), metodoPago: wrapConfirm.querySelector("#rec-ord-metodo").value, monto: montoRecibido, confirmadoPor: session.nombre };
      order.pago = pago;
      // El primer abono es este mismo pago recién confirmado — de aquí en
      // adelante order.abonos es la fuente de verdad de cuánto se ha
      // recibido en total (ver C.totalAbonado), sin importar si se pagó
      // de una sola vez o en varias partes. Un cargo 100% a crédito de
      // convenio (sin copago) no genera ningún abono: ese día no entró
      // nada de efectivo, todo queda pendiente de cobrarle al convenio.
      if (!esCargoConvenio || tieneCopago) {
        order.abonos = [{ id: S.uid("abono"), fecha: pago.fecha, monto: montoRecibido, metodoPago: pago.metodoPago, confirmadoPor: session.nombre }];
      }
      S.saveOrder(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "CONFIRMAR_PAGO_ORDEN", "orden", order.id,
        tieneCopago ? "Confirmó un pago de " + fmtMoneda(montoRecibido) + " del copago (" + fmtMoneda(valorCopago) + " en total) y generó el cargo a crédito de " + fmtMoneda(valorConvenio) + " al convenio " + (order.convenioNombre || "—") + " para la orden " + order.numeroOrden + "."
        : esCargoConvenio ? "Generó el cargo a crédito del convenio " + (order.convenioNombre || "—") + " para la orden " + order.numeroOrden + "."
        : "Confirmó un pago de " + fmtMoneda(montoRecibido) + " de la orden " + order.numeroOrden + (montoRecibido < order.valorCobrar ? " (abono parcial)" : "") + " y generó el recibo.");
      U.closeModal(wrapConfirm);
      continuarConPago(pago);
    });
  }

  /* Agregar un abono adicional a una orden que ya quedó con saldo
     pendiente (ver "Monto Recibido" en abrirReciboOrden, más arriba) —
     así es como un sistema financiero de verdad maneja pagos en cuotas:
     cada abono queda registrado con su propia fecha, monto y método, se
     suma al historial (order.abonos) y se entrega un recibo actualizado
     mostrando cuánto se ha pagado en total y cuánto sigue faltando, para
     que el cliente lo entienda de un vistazo. */
  function abrirAgregarAbono(order, tenant, onDone) {
    var pac = S.getPatient(order.patientId);
    var saldo = C.saldoPendienteOrden(order);
    var wrap = U.openModal(
      '<h3 class="modal-title">Agregar Abono — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Saldo pendiente actual: <b>' + fmtMoneda(saldo) + fmtMonedaEquiv(tenant, saldo) + '</b>.</p>' +
      '<div class="field"><label>Método de Pago</label><select id="ab-metodo">' +
      Object.keys(BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL).map(function (k) { return '<option value="' + k + '">' + BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[k] + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label>Monto del Abono</label><input type="number" step="any" min="0.01" max="' + saldo + '" id="ab-monto" value="' + saldo + '"/>' +
      '<span class="text-muted" style="font-size:11px" id="ab-monto-hint"></span></div>' +
      '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="ab-confirmar">Registrar Abono y Generar Recibo</button></div>'
    );
    var inpMonto = wrap.querySelector("#ab-monto");
    var hint = wrap.querySelector("#ab-monto-hint");
    var btnConfirmar = wrap.querySelector("#ab-confirmar");
    function actualizarHint() {
      var v = parseFloat(inpMonto.value) || 0;
      if (v <= 0) { hint.textContent = "Escribe cuánto abonó el cliente."; hint.style.color = "var(--danger, #b91c1c)"; btnConfirmar.disabled = true; }
      else if (v > saldo + 0.009) { hint.textContent = "No puede ser mayor al saldo pendiente (" + fmtMoneda(saldo) + ")."; hint.style.color = "var(--danger, #b91c1c)"; btnConfirmar.disabled = true; }
      else if (v < saldo) { hint.textContent = "Quedará un nuevo saldo pendiente de " + fmtMoneda(saldo - v) + "."; hint.style.color = "var(--warning, #c97d0d)"; btnConfirmar.disabled = false; }
      else { hint.textContent = "Con este abono la orden queda totalmente pagada."; hint.style.color = ""; btnConfirmar.disabled = false; }
    }
    inpMonto.addEventListener("input", actualizarHint);
    actualizarHint();
    btnConfirmar.addEventListener("click", async function () {
      var session = BIO_AUTH.getSession();
      var monto = parseFloat(inpMonto.value) || 0;
      if (monto <= 0 || monto > saldo + 0.009) return;
      var metodoPago = wrap.querySelector("#ab-metodo").value;
      var fecha = new Date().toISOString();
      order.abonos = order.abonos || [];
      order.abonos.push({ id: S.uid("abono"), fecha: fecha, monto: monto, metodoPago: metodoPago, confirmadoPor: session.nombre });
      S.saveOrder(order);
      var nuevoSaldo = C.saldoPendienteOrden(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "AGREGAR_ABONO_ORDEN", "orden", order.id,
        "Registró un abono de " + fmtMoneda(monto) + " para la orden " + order.numeroOrden + " (" + (nuevoSaldo > 0 ? "saldo pendiente: " + fmtMoneda(nuevoSaldo) : "queda totalmente pagada") + ").");
      U.closeModal(wrap);
      var precios = {};
      S.cotizador.listPrecios(order.tenantId).forEach(function (p) { precios[p.examId] = p.precio; });
      var bytes = await BIO_PDF_RECIBO_ORDEN.buildReciboOrdenPDF(order, pac, tenant, order.pago, precios);
      U.downloadBytes(bytes, "Recibo_Abono_Orden_" + order.numeroOrden + ".pdf");
      U.toast("Abono registrado" + (nuevoSaldo > 0 ? " — saldo pendiente: " + fmtMoneda(nuevoSaldo) : " — orden totalmente pagada") + ".", "success");
      var extra = C.fmtMonedaAdicional(tenant, monto);
      var mensaje = "Hola " + (pac ? U.nombreCompleto(pac).split(" ")[0] : "") + " 👋 Adjunto el recibo de tu abono de " + fmtMoneda(monto) + (extra ? " (" + extra + ")" : "") + " a la orden " + order.numeroOrden + " en " + tenant.nombre + "." + (nuevoSaldo > 0 ? " Saldo pendiente: " + fmtMoneda(nuevoSaldo) + fmtMonedaEquiv(tenant, nuevoSaldo) + "." : " ¡Con esto tu orden queda totalmente pagada!");
      var wrapEnvio = U.openModal(
        '<h3 class="modal-title">Recibo de abono listo</h3>' +
        '<p class="text-muted" style="margin-top:0">Ya se descargó el PDF. Adjúntalo antes de enviar por el canal que elijas, o imprímelo directamente.</p>' +
        '<div class="flex gap-2 wrap">' +
        '<button class="btn btn-outline btn-sm" id="ab-print">' + U.icon("printer") + " Imprimir</button>" +
        (pac && pac.celular ? '<button class="btn btn-whatsapp btn-sm" id="ab-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" : "") +
        U.botonCompartirPDFHtml("ab-compartir") +
        "</div>" +
        (pac && pac.email ? U.emailProviderButtonsHtml("ab-mail") : '<p class="text-muted" style="font-size:12px;margin-top:10px">Este paciente no tiene correo ni WhatsApp guardados para enviarlo directo — descarga e imprime, o agrégalos a su ficha.</p>') +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrapEnvio.querySelector("#ab-print").addEventListener("click", function () {
        var blob = new Blob([bytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var w = window.open(url, "_blank");
        if (w) w.addEventListener("load", function () { w.print(); });
      });
      var btnWa = wrapEnvio.querySelector("#ab-wa");
      if (btnWa) btnWa.addEventListener("click", function () {
        var numero = U.numeroWhatsapp(pac.celular, tenant.pais);
        window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje), "_blank");
      });
      var btnCompartirAbono = wrapEnvio.querySelector("#ab-compartir");
      if (btnCompartirAbono) btnCompartirAbono.addEventListener("click", function () { U.compartirPDF(bytes, "Recibo_Abono_Orden_" + order.numeroOrden + ".pdf", mensaje); });
      if (pac && pac.email) U.wireEmailProviderButtons(wrapEnvio, "ab-mail", pac.email, "Recibo de abono — " + tenant.nombre, mensaje);
      if (onDone) onDone();
    });
  }

  // Solo un Administrador o un Bacteriólogo con el permiso explícito puede
  // generar y enviar Hojas de Remisión — se activa por usuario desde
  // "Usuarios del Laboratorio" (ver views-admin.js), para no dar este
  // manejo a todo el equipo por defecto.
  function puedeGestionarRemision(session) {
    return session.rol === "admin" || session.rol === "superadmin" || !!session.puedeGestionarRemisiones;
  }

  function renderOrderDetail(root, orderId, intento) {
    intento = intento || 0;
    var session = BIO_AUTH.getSession();
    var order = S.getOrder(orderId);
    if (!order) {
      // Reintenta un rato antes de declarar "no encontrada": justo después
      // de crear una orden (ej. al elegir "Continuar sin imprimir" en el
      // modal de stickers, que navega directo a #/ordenes/:id), la copia
      // local (realCache) en modo real puede tardar un instante en reflejar
      // el dato recién escrito a Firestore — sin este reintento, ese
      // instante se veía como un error permanente ("Orden no encontrada",
      // bug real reportado por un auxiliar justo al terminar de crear una
      // orden) aunque la orden sí existiera, obligando a recargar la
      // página a mano para verla.
      if (intento < 10) {
        setTimeout(function () {
          if (document.getElementById("content") !== root) return; // se navegó a otra pantalla mientras tanto
          if (location.hash !== "#/ordenes/" + orderId) return;
          renderOrderDetail(root, orderId, intento + 1);
        }, 300);
        root.innerHTML = '<div class="card"><p class="text-muted">Cargando la orden…</p></div>';
        return;
      }
      root.innerHTML = '<div class="card">Orden no encontrada.</div>';
      return;
    }
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_STORE.getTenant(order.tenantId);

    function build() {
      var remisiones = order.remisiones || [];
      var saldoOrden = C.saldoPendienteOrden(order);
      root.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3 class="card-title">Orden ' + order.numeroOrden + " — " + window.BIO_badgeEstado(order.estadoGeneral) + '</h3>' +
          '<div class="flex gap-2 wrap"><a class="btn btn-ghost btn-sm" id="btn-back">Volver</a>' +
          '<button class="btn btn-primary btn-sm" id="btn-agregar-examenes">' + U.icon("plus") + " Agregar Exámenes</button>" +
          '<button class="btn btn-outline btn-sm" id="btn-stickers">' + U.icon("printer") + " Imprimir Stickers</button>" +
          '<button class="btn btn-ghost btn-sm" id="btn-stickers-preview" title="Ver antes de imprimir o elegir otra impresora">Vista previa de stickers</button>' +
          '<button class="btn btn-outline btn-sm" id="btn-preview">' + U.icon("file") + " Ver / Descargar PDF</button>" +
          (puedeGestionarRemision(session) ? '<button class="btn btn-outline btn-sm" id="btn-remision">' + U.icon("send") + " Hoja de Remisión</button>" : "") +
          (puedeReciboOrden(tenant) ? '<button class="btn btn-outline btn-sm" id="btn-recibo-orden">' + U.icon("send") + (order.pago ? " Reenviar Recibo de Pago" : " Recibo de Pago") + "</button>" : "") +
          (puedeReciboOrden(tenant) && order.pago && saldoOrden > 0 ? '<button class="btn btn-primary btn-sm" id="btn-agregar-abono">' + U.icon("plus") + " Agregar Abono</button>" : "") +
          (tenant.pais === "CO" ? '<button class="btn btn-outline btn-sm" id="btn-consentimiento">' + U.icon("file") + " Consentimiento Informado</button>" : "") +
          (tenant.pais === "CO" ? '<button class="btn btn-primary btn-sm" id="btn-firmar-consentimiento-aqui">' + U.icon("check") + " Firmar Consentimiento Aquí</button>" : "") +
          "</div></div>" +
          '<div class="form-grid">' +
            field("Paciente", pac ? U.nombreCompleto(pac) + " (" + pac.tipoDocumento + " " + pac.numeroDocumento + ")" : "—") +
            field("Edad / Sexo", (pac ? U.edadTexto(pac) : "—") + " · " + (pac ? pac.sexo : "")) +
            (pac && pac.pais === "CO" ? field("EPS / Seguro", pac.eps || "—") : "") +
            field("Médico Remitente", order.medicoRemitente || "—") +
            field("Procedencia", order.procedencia) +
            field("Prioridad", order.prioridad) +
            field("Fecha de Orden", U.fmtFecha(order.fechaOrden)) +
            field("Diagnóstico", order.diagnostico || "—") +
            (tenant.mostrarPrecioOrden ? fieldHtml("Valor a Cobrar", order.valorCobrar ? U.esc(fmtMoneda(order.valorCobrar)) + fmtMonedaEquiv(tenant, order.valorCobrar) : "—") : "") +
            (order.monedaPago ? field("Moneda de Pago", C.monedaPagoLabel(order.monedaPago)) : "") +
            (puedeReciboOrden(tenant) ? field("Estado de Pago", !order.pago ? "Pendiente de confirmar"
              : (order.pago.esCredito && !order.pago.tieneCopago) ? "🤝 A Crédito de Convenio — Pendiente de cobrar a " + (order.convenioNombre || "—")
              : saldoOrden > 0 ? "Parcial — Abonado " + fmtMoneda(C.totalAbonado(order)) + " de " + fmtMoneda(C.montoAdeudarPaciente(order)) + " — Saldo " + fmtMoneda(saldoOrden)
              : "✓ Pagado (" + (BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[order.pago.metodoPago] || order.pago.metodoPago) + ") — " + U.fmtFecha(order.pago.fecha)) : "") +
          "</div></div>" +

        '<div class="card" style="margin-top:16px"><div class="card-header"><h3 class="card-title">Exámenes de la Orden</h3></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Examen</th><th>Sección</th><th>Tubo</th><th>Estado</th><th>Validado / Remitido por</th><th>Fecha</th><th></th></tr></thead><tbody>' +
          order.examenes.map(function (ex, idx) {
            var exCat = C.examenEfectivo(ex.examId, tenant);
            var tubo = C.tuboInfo(exCat.tubo);
            return "<tr><td>" + U.esc(exCat.nombre) + "</td><td>" + C.seccionNombre(ex.seccion, tenant) + "</td>" +
              '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + tubo.color + ';margin-right:5px;vertical-align:middle"></span>' + U.esc(tubo.nombre) + "</td>" +
              "<td>" + window.BIO_badgeEstado(ex.estado === "en_proceso" ? "pendiente" : ex.estado) + "</td>" +
              "<td>" + (ex.validadoPor || "—") + "</td><td>" + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + "</td>" +
              '<td><div class="flex gap-1 wrap"><button class="btn btn-outline btn-sm" data-goresult="' + idx + '">Ir a captura</button>' +
              (order.examenes.length > 1 ? '<button class="btn btn-ghost btn-sm" data-quitar-examen="' + idx + '" title="Quitar este examen de la orden">' + U.icon("trash") + "</button>" : "") +
              "</div></td></tr>";
          }).join("") +
          "</tbody></table></div></div>" +

        (remisiones.length ? '<div class="card" style="margin-top:16px"><div class="card-header"><h3 class="card-title">Hojas de Remisión Generadas (' + remisiones.length + ')</h3></div>' +
          '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Laboratorio de Referencia</th><th># Exámenes</th><th>Generó</th><th></th></tr></thead><tbody>' +
          remisiones.map(function (r, i) {
            return "<tr><td>" + U.esc(r.numero) + "</td><td>" + U.fmtFecha(r.fecha) + "</td><td>" + U.esc(r.laboratorioDestino.nombre) + "</td><td>" + r.examenes.length + "</td><td>" + U.esc(r.generadoPor || "—") + "</td>" +
              '<td><button class="btn btn-ghost btn-sm" data-redescargar-remision="' + i + '">' + U.icon("download") + " PDF</button></td></tr>";
          }).join("") + "</tbody></table></div></div>" : "");

      document.getElementById("btn-back").addEventListener("click", function () { location.hash = "#/ordenes"; });
      document.getElementById("btn-agregar-examenes").addEventListener("click", function () { abrirAgregarExamenesOrden(order, pac, tenant, build); });
      document.getElementById("btn-preview").addEventListener("click", function () { window.BIO_PDF.previewOrModal(order, pac, tenant); });
      document.getElementById("btn-stickers").addEventListener("click", function () { window.BIO_PDF.imprimirStickersRapido(order, pac, tenant); });
      document.getElementById("btn-stickers-preview").addEventListener("click", function () { window.BIO_PDF.previewStickers(order, pac, tenant); });
      var btnRemision = document.getElementById("btn-remision");
      if (btnRemision) btnRemision.addEventListener("click", function () { abrirGenerarRemision(order, pac, tenant, build); });
      var btnReciboOrden = document.getElementById("btn-recibo-orden");
      if (btnReciboOrden) btnReciboOrden.addEventListener("click", function () { abrirReciboOrden(order, tenant, build); });
      var btnAgregarAbono = document.getElementById("btn-agregar-abono");
      if (btnAgregarAbono) btnAgregarAbono.addEventListener("click", function () { abrirAgregarAbono(order, tenant, build); });
      var btnConsentimiento = document.getElementById("btn-consentimiento");
      if (btnConsentimiento) btnConsentimiento.addEventListener("click", function () { window.BIO_VIEWS_CONSENTIMIENTOS.abrir(order, pac, tenant, build); });
      var btnFirmarConsentimientoAqui = document.getElementById("btn-firmar-consentimiento-aqui");
      if (btnFirmarConsentimientoAqui) btnFirmarConsentimientoAqui.addEventListener("click", function () { window.BIO_VIEWS_CONSENTIMIENTOS.abrirFirmarAqui(order, pac, tenant, build); });
      root.querySelectorAll("[data-goresult]").forEach(function (b) {
        b.addEventListener("click", function () { location.hash = "#/resultados/" + order.id; });
      });
      root.querySelectorAll("[data-quitar-examen]").forEach(function (b) {
        b.addEventListener("click", function () {
          var idx = parseInt(b.dataset.quitarExamen, 10);
          var ex = order.examenes[idx];
          var exCat = C.examenEfectivo(ex.examId, tenant);
          abrirQuitarExamen(order, ex, exCat, idx, build);
        });
      });
      root.querySelectorAll("[data-redescargar-remision]").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = remisiones[parseInt(b.dataset.redescargarRemision, 10)];
          var bytes = BIO_PDF_REMISION.buildHojaRemisionPDF(Object.assign({}, r, { fecha: new Date(r.fecha) }), tenant);
          U.downloadBytes(bytes, "Hoja_Remision_" + r.numero + ".pdf");
        });
      });
    }
    build();
  }

  // -------------------------------------------------------------------
  // AGREGAR EXÁMENES A UNA ORDEN YA EXISTENTE — para cuando el médico pide
  // un examen adicional después de creada la orden (incluso ya validada):
  // se agregan como renglones NUEVOS, pendientes de captura, sin tocar ni
  // reabrir los exámenes que ya están validados/remitidos. La orden vuelve
  // a quedar "parcial" hasta que también se capture y valide lo nuevo —
  // recalcEstadoGeneral() ya maneja esa mezcla de estados sola.
  // -------------------------------------------------------------------
  function abrirAgregarExamenesOrden(order, pac, tenant, onDone) {
    var session = BIO_AUTH.getSession();
    var examenes = C.examenesDisponibles(tenant);
    var idsExistentes = {};
    order.examenes.forEach(function (ex) { idsExistentes[ex.examId] = true; });
    var precios = {};
    S.cotizador.listPrecios(tenant.id).forEach(function (p) { precios[p.examId] = p.precio; });
    var seleccionados = [];
    var searchTerm = "";

    var wrap = U.openModal(
      '<h3 class="modal-title">Agregar Exámenes — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted" style="margin-top:0">' + (pac ? U.esc(U.nombreCompleto(pac)) + " — " : "") + 'se agregan como exámenes nuevos, pendientes de captura, sin tocar los que ya están validados o remitidos en esta orden.</p>' +
      '<input id="agex-buscar" placeholder="Buscar examen por nombre o CUPS…" style="margin-bottom:10px"/>' +
      '<div id="agex-lista" style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px"></div>' +
      '<div class="flex gap-2 justify-between" style="margin-top:14px;align-items:center">' +
      '<span id="agex-contador" class="text-muted" style="font-size:12.5px">0 seleccionados</span>' +
      '<div class="flex gap-2"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
      '<button type="button" class="btn btn-primary" id="agex-guardar">' + U.icon("check") + " Agregar a la Orden</button></div></div>",
      { lg: true }
    );

    function renderLista() {
      var term = U.normalizar(searchTerm.trim());
      var disponibles = examenes.filter(function (e) { return !idsExistentes[e.id]; });
      var pool = term ? disponibles.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || (e.cups || "").indexOf(term) !== -1; }) : disponibles;
      var porSeccion = {};
      pool.forEach(function (e) { (porSeccion[e.seccion] = porSeccion[e.seccion] || []).push(e); });
      var seccionesConExamenes = C.seccionesEfectivas(tenant).filter(function (s) { return porSeccion[s.id] && porSeccion[s.id].length; });
      var html = seccionesConExamenes.map(function (s) {
        return '<div style="margin-bottom:2px"><div style="font-weight:700;font-size:11.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.02em;padding:8px 8px 2px">' + U.esc(s.nombre) + "</div>" +
          porSeccion[s.id].map(function (e) {
            var checked = seleccionados.indexOf(e.id) !== -1;
            return '<label class="exam-row"><input type="checkbox" data-agex="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
              '<div class="grow"><div>' + U.esc(e.nombre) + '</div><div class="meta">CUPS ' + U.esc(e.cups || "—") + "</div></div>" +
              (tenant.mostrarPrecioOrden && precios[e.id] ? '<div style="font-weight:700;font-size:13px;white-space:nowrap">' + fmtMoneda(precios[e.id]) + "</div>" : "") +
              "</label>";
          }).join("") + "</div>";
      }).join("");
      wrap.querySelector("#agex-lista").innerHTML = html || '<p class="text-muted" style="padding:14px;margin:0">' + (disponibles.length ? "Sin resultados para esa búsqueda." : "Ya están todos los exámenes del catálogo agregados a esta orden.") + "</p>";
      wrap.querySelectorAll("[data-agex]").forEach(function (chk) {
        chk.addEventListener("change", function () {
          var id = chk.dataset.agex;
          if (chk.checked) seleccionados.push(id); else seleccionados = seleccionados.filter(function (x) { return x !== id; });
          actualizarContador();
        });
      });
    }
    function actualizarContador() {
      wrap.querySelector("#agex-contador").textContent = seleccionados.length + " seleccionado" + (seleccionados.length === 1 ? "" : "s");
    }
    wrap.querySelector("#agex-buscar").addEventListener("input", function (e) { searchTerm = e.target.value; renderLista(); });
    renderLista();

    wrap.querySelector("#agex-guardar").addEventListener("click", function () {
      if (!seleccionados.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
      var totalAgregado = 0;
      seleccionados.forEach(function (id) {
        var exCat = C.examenEfectivo(id, tenant);
        order.examenes.push({
          examId: id, seccion: exCat.seccion, estado: "pendiente", valores: [], observaciones: "",
          validadoPor: "", validadoPorUserId: "", fechaValidacion: "", ingresadoPor: "", fechaIngreso: "", version: 1, correcciones: [],
          remitido: false, laboratorioRemision: "", pdfRemitidoDataUrl: "", pdfRemitidoNombre: ""
        });
        totalAgregado += precios[id] || 0;
      });
      // El precio de lista se suma directo al valor a cobrar como
      // sugerencia — si esta orden tiene un descuento de convenio, el
      // laboratorio puede ajustarlo a mano desde aquí mismo (el campo
      // sigue siendo editable), igual que ya pasa hoy con "Nueva Orden".
      if (tenant.mostrarPrecioOrden && totalAgregado) order.valorCobrar = (order.valorCobrar || 0) + totalAgregado;
      S.recalcEstadoGeneral(order);
      S.saveOrder(order);
      var detallePrecio = totalAgregado ? " (+" + fmtMoneda(totalAgregado) + " al valor a cobrar, precio de lista)" : "";
      S.addAudit(session.tenantId, session.nombre, session.rol, "ADD_EXAMS_TO_ORDER", "orden", order.id,
        "Agregó " + seleccionados.length + " examen(es) nuevo(s) a la orden " + order.numeroOrden + detallePrecio + ".");
      U.toast(seleccionados.length + " examen(es) agregado(s) a la orden.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  // -------------------------------------------------------------------
  // QUITAR UN EXAMEN DE UNA ORDEN — el complemento de "Agregar Exámenes":
  // corregir una orden con un examen de más (agregado por error, el
  // paciente no lo pidió, etc.), no solo agregar. Un examen aún sin
  // resultado se quita con solo confirmar; uno ya validado o remitido
  // exige la misma clave de administrador + motivo que ya usa la
  // corrección de resultados, para no borrar un resultado finalizado sin
  // dejar rastro.
  // -------------------------------------------------------------------
  function abrirQuitarExamen(order, ex, exCat, idx, onDone) {
    var session = BIO_AUTH.getSession();
    var esFinal = ex.estado === "validado" || ex.estado === "remitido";
    var wrap = U.openModal(
      '<h3 class="modal-title">' + U.icon("trash") + " Quitar Examen — " + U.esc(exCat.nombre) + "</h3>" +
      '<p class="text-muted">' + (esFinal
        ? "Este examen ya está <b>" + ex.estado + "</b>. Quitar un resultado finalizado es una acción sensible — requiere la clave de administrador del laboratorio y el motivo, dejando trazabilidad completa (usuario, fecha y hora)."
        : "Se va a quitar <b>" + U.esc(exCat.nombre) + "</b> de la orden " + order.numeroOrden + ". Esta acción no se puede deshacer.") + "</p>" +
      (ex.reactivosDescontados ? '<p class="text-muted" style="font-size:12px">⚠️ El inventario de reactivos de este examen ya se descontó — al quitarlo, ese descuento NO se revierte automáticamente; ajústalo a mano en Inventario si hace falta.</p>' : "") +
      (esFinal ? '<div class="field"><label>Clave de administrador *</label><input type="password" id="qe-clave"/></div>' : "") +
      '<div class="field"><label>Motivo *</label><textarea id="qe-motivo" placeholder="Ej: Examen agregado por error, el paciente no lo solicitó."></textarea></div>' +
      '<div class="flex gap-2 justify-between" style="margin-top:10px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-danger" id="qe-confirmar">' + U.icon("trash") + " Quitar Examen</button></div>"
    );
    wrap.querySelector("#qe-confirmar").addEventListener("click", function () {
      var motivo = wrap.querySelector("#qe-motivo").value.trim();
      if (!motivo) { U.toast("Describe el motivo.", "error"); return; }
      if (esFinal) {
        var clave = wrap.querySelector("#qe-clave").value;
        if (!BIO_AUTH.verificarClaveAdmin(clave)) { U.toast("Clave de administrador incorrecta.", "error"); return; }
      }
      order.examenes.splice(idx, 1);
      S.recalcEstadoGeneral(order);
      S.saveOrder(order);
      S.addAudit(session.tenantId, session.nombre, session.rol, "REMOVE_EXAM_FROM_ORDER", "orden", order.id,
        'Quitó el examen "' + exCat.nombre + '" (estaba ' + ex.estado + ") de la orden " + order.numeroOrden + ". Motivo: " + motivo);
      U.toast("Examen quitado de la orden.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  // -------------------------------------------------------------------
  // HOJA DE REMISIÓN A LABORATORIO DE REFERENCIA
  // -------------------------------------------------------------------
  function abrirGenerarRemision(order, pac, tenant, onDone) {
    var session = BIO_AUTH.getSession();
    var examenesInfo = order.examenes.map(function (ex, idx) {
      var exCat = C.examenEfectivo(ex.examId, tenant);
      var tubo = C.tuboInfo(exCat.tubo);
      return { idx: idx, ex: ex, exCat: exCat, tubo: tubo };
    });

    var wrap = U.openModal(
      '<h3 class="modal-title">Generar Hoja de Remisión — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Para exámenes que tu laboratorio solo toma la muestra y remite a un laboratorio externo. Genera un documento profesional de trazabilidad (con cadena de custodia y código de verificación) para enviar junto con la muestra, o por correo/WhatsApp.</p>' +
      '<div class="field"><label>Selecciona los exámenes a remitir</label><div class="form-grid">' +
      examenesInfo.map(function (info) {
        var checked = info.ex.estado === "remitido";
        return '<div class="checkbox-row"><input type="checkbox" data-remex="' + info.idx + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + U.esc(info.exCat.nombre) + "</label></div>";
      }).join("") + "</div></div>" +
      '<fieldset><legend>Laboratorio de Referencia (destino)</legend><div class="form-grid">' +
      F.inp("labNombre", "Nombre del Laboratorio", "", true) +
      F.inp("labDireccion", "Dirección", "") +
      F.inp("labTelefono", "Teléfono / WhatsApp del laboratorio", "") +
      "</div></fieldset>" +
      '<div class="checkbox-row" style="margin:10px 0"><input type="checkbox" id="rem-incluir-valores"/><label style="margin:0" for="rem-incluir-valores">Incluir el valor de cada examen (funciona como recibo, para control de costos de remisión)</label></div>' +
      '<div id="rem-valores-box"></div>' +
      '<div class="field"><label>Observaciones (opcional)</label><textarea id="rem-observaciones" placeholder="Ej: Muestra refrigerada, prioridad urgente…"></textarea></div>' +
      '<fieldset><legend>Enviar por (opcional)</legend><div class="form-grid">' +
      F.inp("remCorreo", "Correo del laboratorio de referencia", "", false, "email") +
      F.inp("remWhatsapp", "WhatsApp del laboratorio de referencia", "") +
      "</div></fieldset>" +
      '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="button" class="btn btn-primary" id="rem-generar">' + U.icon("file") + " 1. Generar PDF</button></div>" +
      '<div id="rem-step2" class="hidden" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">' +
      '<p style="margin:0 0 4px"><b>2. Elige dónde enviarlo</b></p>' +
      U.emailProviderButtonsHtml("rem") +
      '<a class="btn btn-whatsapp btn-block" id="rem-wa" target="_blank" rel="noopener" style="margin-top:8px">' + U.icon("send") + " Enviar por WhatsApp</a>" +
      (U.botonCompartirPDFHtml("rem-compartir") ? '<div style="margin-top:8px">' + U.botonCompartirPDFHtml("rem-compartir") + "</div>" : "") +
      "</div>",
      { lg: true }
    );

    function renderValoresBox() {
      var incluir = wrap.querySelector("#rem-incluir-valores").checked;
      var box = wrap.querySelector("#rem-valores-box");
      if (!incluir) { box.innerHTML = ""; return; }
      var seleccionados = Array.prototype.slice.call(wrap.querySelectorAll("[data-remex]:checked")).map(function (c) { return parseInt(c.dataset.remex, 10); });
      if (!seleccionados.length) { box.innerHTML = '<p class="text-muted" style="font-size:12.5px">Selecciona primero los exámenes a remitir.</p>'; return; }
      box.innerHTML = '<div class="field"><label>Valor de cada examen (' + U.esc(C.monedaBaseLabel(tenant)) + ')</label><div class="form-grid">' +
        seleccionados.map(function (idx) {
          var info = examenesInfo[idx];
          return '<div class="field"><label style="font-weight:400">' + U.esc(info.exCat.nombre) + '</label><input type="number" min="0" step="1000" data-remval="' + idx + '" value="0"/></div>';
        }).join("") + "</div></div>";
    }
    wrap.querySelector("#rem-incluir-valores").addEventListener("change", renderValoresBox);
    wrap.querySelectorAll("[data-remex]").forEach(function (chk) { chk.addEventListener("change", renderValoresBox); });

    wrap.querySelector("#rem-generar").addEventListener("click", function () {
      var seleccionados = Array.prototype.slice.call(wrap.querySelectorAll("[data-remex]:checked")).map(function (c) { return parseInt(c.dataset.remex, 10); });
      if (!seleccionados.length) { U.toast("Selecciona al menos un examen a remitir.", "error"); return; }
      var labNombre = wrap.querySelector("#f_labNombre").value.trim();
      if (!labNombre) { U.toast("Ingresa el nombre del laboratorio de referencia.", "error"); return; }
      var incluirValores = wrap.querySelector("#rem-incluir-valores").checked;

      var examenesRemision = seleccionados.map(function (idx) {
        var info = examenesInfo[idx];
        var valInput = wrap.querySelector('[data-remval="' + idx + '"]');
        return {
          examId: info.ex.examId, nombre: info.exCat.nombre, cups: info.exCat.cups,
          seccionNombre: C.seccionNombre(info.ex.seccion, tenant), muestra: info.exCat.muestra, tuboNombre: info.tubo.nombre,
          valor: incluirValores && valInput ? (parseFloat(valInput.value) || 0) : 0
        };
      });

      var fecha = new Date();
      var numero = BIO_PDF_REMISION.numeroRemision(fecha, order.id);
      var remision = {
        numero: numero, fecha: fecha,
        laboratorioDestino: { nombre: labNombre, direccion: wrap.querySelector("#f_labDireccion").value.trim(), telefono: wrap.querySelector("#f_labTelefono").value.trim() },
        paciente: { nombre: pac ? U.nombreCompleto(pac) : "—", tipoDocumento: pac ? pac.tipoDocumento : "", numeroDocumento: pac ? pac.numeroDocumento : "", edadTexto: pac ? U.edadTexto(pac) : "", sexo: pac ? pac.sexo : "", fechaNacimiento: pac ? pac.fechaNacimiento : "" },
        numeroOrden: order.numeroOrden, medicoRemitente: order.medicoRemitente, procedencia: order.procedencia,
        examenes: examenesRemision, incluirValores: incluirValores,
        observaciones: wrap.querySelector("#rem-observaciones").value.trim()
      };

      var bytes = BIO_PDF_REMISION.buildHojaRemisionPDF(remision, tenant);
      U.downloadBytes(bytes, "Hoja_Remision_" + numero + ".pdf");

      order.remisiones = order.remisiones || [];
      order.remisiones.push(Object.assign({}, remision, { fecha: fecha.toISOString(), generadoPor: session.nombre }));
      S.saveOrder(order);
      S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_REMISION", "orden", order.id,
        "Generó la Hoja de Remisión " + numero + " a " + labNombre + " (" + examenesRemision.length + " examen(es), Orden " + order.numeroOrden + ").");

      var correo = wrap.querySelector("#f_remCorreo").value.trim();
      var whatsapp = wrap.querySelector("#f_remWhatsapp").value.trim();
      var mensaje = "Hola 👋 Adjuntamos la Hoja de Remisión N° " + numero + " de " + tenant.nombre + " (Orden " + order.numeroOrden + ", paciente " + (pac ? U.nombreCompleto(pac) : "—") + ") con " + examenesRemision.length + " examen(es). Quedamos atentos a los resultados.";
      wrap.querySelector("#rem-step2").classList.remove("hidden");
      U.wireEmailProviderButtons(wrap, "rem", correo, "Hoja de Remisión " + numero + " — " + tenant.nombre, mensaje + "\n\n(Adjunte el PDF que se acaba de descargar)");
      var waBtn = wrap.querySelector("#rem-wa");
      if (whatsapp) {
        waBtn.href = "https://wa.me/" + whatsapp.replace(/\D/g, "") + "?text=" + encodeURIComponent(mensaje + "\n\n(Adjunte el PDF que se acaba de descargar antes de enviar)");
      } else {
        waBtn.classList.add("hidden");
      }
      var btnCompartirRem = wrap.querySelector("#rem-compartir");
      if (btnCompartirRem) btnCompartirRem.addEventListener("click", function () { U.compartirPDF(bytes, "Hoja_Remision_" + numero + ".pdf", mensaje); });
      U.toast("Hoja de Remisión generada y descargada.", "success");
      onDone();
    });
  }

  function field(label, value) {
    return '<div class="field"><label>' + label + "</label><div style='padding:9px 0;font-weight:600'>" + U.esc(value) + "</div></div>";
  }
  function fieldHtml(label, html) {
    return '<div class="field"><label>' + label + "</label><div style='padding:9px 0;font-weight:600'>" + html + "</div></div>";
  }

  // Se expone para que views-results.js (la Bandeja de Resultados, donde
  // realmente trabaja el bacteriólogo) también pueda ofrecer "Hoja de
  // Remisión" sin duplicar el modal — la ruta "ordenes" no está permitida
  // para el rol bacteriologo, así que ese es su único punto de acceso real.
  window.BIO_REMISION = { puedeGestionar: puedeGestionarRemision, abrir: abrirGenerarRemision };
})();

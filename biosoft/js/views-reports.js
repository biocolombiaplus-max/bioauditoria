/* BIOsoft — Vista: Reportes y Envío de Resultados */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;
  function fmtMoneda(n) { return BIO_PDF_CARTERA.fmtMoneda(n); }

  // Buscador de "Envío de Resultados" por nombre/cédula del paciente (o N°
  // de orden, de paso) — a nivel de módulo para que el término escrito
  // sobreviva entre un re-render y otro (ej. al enviar un resultado desde
  // la misma lista), mismo patrón que ordenesSearchTerm en views-orders.js.
  var enviosSearchTerm = "";

  // Uint8Array -> base64, en trozos para no reventar la pila con
  // String.fromCharCode.apply en un PDF grande (varias páginas con muchos
  // exámenes) — usado solo para publicar el resultado en resultadosPublicos
  // (ver publicarResultadoPublico), nunca para el PDF que se descarga/adjunta
  // normalmente.
  function bytesABase64(bytes) {
    var binario = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(binario);
  }

  // Publica (o actualiza) el PDF de esta orden en la colección pública
  // resultadosPublicos/{codigo} para que el paciente lo consulte desde la
  // Página Web real del laboratorio (ver sitio-web.js) — solo si la Página
  // Web está activada y esta orden sí generó código de consulta al crearse.
  // Compartida entre el envío manual (openSendModal, más abajo) y la
  // publicación automática al validar un examen (ver publicarAutomaticamenteSiCorresponde,
  // usada desde views-results.js). Nunca bloquea el flujo que la llama si
  // falla (sin internet, PDF grande, etc.).
  function publicarResultadoPublico(order, pac, tenant, bytes) {
    if (!(tenant.paginaWeb && tenant.paginaWeb.activo && order.codigoConsulta)) return Promise.resolve();
    var pdfBase64 = bytesABase64(bytes);
    // Firestore limita cada documento a 1 MB — un informe con MUCHOS
    // exámenes/páginas podría acercarse a ese límite codificado en base64
    // (~33% más pesado que el PDF original). Se deja un margen amplio en
    // vez de dejar que la escritura falle sola.
    if (pdfBase64.length >= 900000) {
      console.warn("BIOsoft: el PDF de esta orden es demasiado grande para publicarlo en la Página Web (límite de Firestore).");
      return Promise.resolve();
    }
    // Historial de resultados anteriores del MISMO paciente, ya publicados
    // con su propio código — nunca se arma buscando por número de documento
    // (eso permitiría enumerar resultados de otro paciente con la llave de
    // API, que no es secreta), solo con órdenes que YA tiene este
    // laboratorio en memoria. Son referencias livianas ({codigo,
    // numeroOrden, fechaOrden}, sin el PDF) para que sitio-web.js muestre el
    // más reciente resaltado y el resto en orden cronológico, y descargue
    // cada PDF puntual solo cuando el paciente pida verlo.
    var otrasOrdenesPaciente = S.listOrders(order.tenantId).filter(function (o) {
      return o.patientId === order.patientId && o.id !== order.id && o.codigoConsulta && o.enviado;
    });
    var historialParaEsta = otrasOrdenesPaciente.map(function (o) {
      return { codigo: o.codigoConsulta, numeroOrden: o.numeroOrden, fechaOrden: o.fechaOrden };
    });
    return S.resultadosPublicos.set(order.codigoConsulta, {
      tenantId: order.tenantId, numeroDocumento: pac ? pac.numeroDocumento : "",
      nombrePaciente: pac ? U.nombreCompleto(pac) : "", numeroOrden: order.numeroOrden, fechaOrden: order.fechaOrden,
      pdfDataUrl: "data:application/pdf;base64," + pdfBase64,
      // Resumen por examen (listo/pendiente) y estado general de la orden —
      // para que el portal público (sitio-web.js) le muestre al paciente,
      // SIN tener que abrir el PDF, cuáles exámenes ya están y cuáles
      // siguen en proceso (ej. cultivos, que tardan varios días). El PDF
      // en sí ya trae el mismo aviso de "Informe Parcial" (ver pdf.js).
      estadoGeneral: order.estadoGeneral,
      examenes: order.examenes.map(function (ex) {
        return { nombre: BIO_CATALOG.examenEfectivo(ex.examId, tenant).nombre, listo: ex.estado === "validado" || ex.estado === "remitido" };
      }),
      historial: historialParaEsta
    }).then(function () {
      // Propagación en ambos sentidos: cada resultado anterior también
      // queda enterado de este nuevo, para que el paciente vea el
      // historial completo sin importar con cuál código de los suyos
      // entre a consultar.
      var entradaNueva = { codigo: order.codigoConsulta, numeroOrden: order.numeroOrden, fechaOrden: order.fechaOrden };
      otrasOrdenesPaciente.forEach(function (o) { S.resultadosPublicos.agregarHistorial(o.codigoConsulta, entradaNueva); });
      // Seguimiento de envíos (ver celdaCanales en la lista de Reportes): la
      // publicación en la Página Web cuenta como un canal más, para
      // distinguirla de un envío activo (WhatsApp/correo) donde de verdad se
      // le avisó al paciente, de uno donde el resultado solo quedó
      // disponible para que él lo busque por su cuenta.
      order.canalesEnvio = order.canalesEnvio || [];
      order.canalesEnvio.push({ canal: "Página Web", destino: order.codigoConsulta, fecha: S.nowISO() });
      S.saveOrder(order);
    });
  }

  // Publicación AUTOMÁTICA, sin ningún clic manual en Reportes: se llama
  // desde views-results.js justo después de validar/remitir/corregir un
  // examen, para que el paciente vea de inmediato lo que ya está listo (y
  // lo que sigue pendiente) sin que el laboratorio tenga que acordarse de
  // "Enviar Resultados" — igual que los laboratorios de referencia grandes.
  // Siempre usa modo "final" (solo exámenes validados/remitidos cuentan
  // como listos): un examen en mero borrador/preliminar nunca se publica
  // solo, eso sigue siendo una decisión manual del laboratorio.
  function publicarAutomaticamenteSiCorresponde(order) {
    // Siempre devuelve una Promesa real (nunca "undefined") — quien la llama
    // (el botón "Actualizar en la Página Web" y el disparo automático al
    // validar) le encadena .then()/.catch() sin condición, y undefined.then
    // revienta de forma silenciosa, dejando el botón pegado en "Publicando…"
    // para siempre sin ningún aviso (bug real: el botón no hacía nada
    // visible al hacer clic).
    var tenant = BIO_AUTH.currentTenant();
    if (!(tenant && tenant.paginaWeb && tenant.paginaWeb.activo && order.codigoConsulta)) return Promise.resolve();
    if (!order.examenes.some(function (ex) { return ex.estado === "validado" || ex.estado === "remitido"; })) return Promise.resolve();
    var pac = S.getPatient(order.patientId);
    // No atrapa el error aquí adentro: cada quien que la llame decide cómo
    // avisar (un toast visible desde un botón manual, o un simple
    // console.warn silencioso desde el disparador automático — ver las
    // llamadas en views-results.js y en el botón "Actualizar" de
    // views-orders.js).
    return window.BIO_PDF.buildResultadosPDF(order, pac, tenant, "final").then(function (bytes) {
      order.enviado = true; order.fechaEnvio = order.fechaEnvio || S.nowISO();
      S.saveOrder(order);
      return publicarResultadoPublico(order, pac, tenant, bytes);
    });
  }

  window.BIO_REPORTS = { publicarAutomaticamenteSiCorresponde: publicarAutomaticamenteSiCorresponde };

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
      var todasLasOrdenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
        return o.examenes.some(function (ex) { return ex.estado === "validado" || ex.estado === "remitido" || ex.estado === "preliminar"; });
      });
      // Carga los pacientes UNA vez en un mapa por id, en vez de llamar
      // S.getPatient() por cada orden en cada tecla, para que la búsqueda
      // se sienta instantánea incluso con muchas órdenes (mismo patrón que
      // el buscador de Órdenes de Laboratorio en views-orders.js).
      var pacientesPorId = {};
      S.listPatients(tenantId).forEach(function (p) { pacientesPorId[p.id] = p; });
      var term = U.normalizar(enviosSearchTerm.trim());
      var orders = !term ? todasLasOrdenes : todasLasOrdenes.filter(function (o) {
        var pac = pacientesPorId[o.patientId];
        var nombre = pac ? U.normalizar(U.nombreCompleto(pac)) : "";
        var documento = pac ? U.normalizar(String(pac.numeroDocumento || "")) : "";
        return nombre.indexOf(term) !== -1 || documento.indexOf(term) !== -1 || U.normalizar(o.numeroOrden || "").indexOf(term) !== -1;
      });
      return '<h4 style="margin-top:14px">Órdenes Listas para Reportar (' + orders.length + (term ? " de " + todasLasOrdenes.length : "") + ")</h4>" +
        '<p class="text-muted" style="margin-top:0">Desde aquí puedes descargar el PDF profesional o enviarlo por correo al paciente/médico remitente. El envío abre Gmail, Outlook/Hotmail o tu correo predeterminado ya redactado — solo debes adjuntar el PDF que se descarga automáticamente.</p>' +
        '<div class="field" style="max-width:340px"><input type="text" id="env-buscar" placeholder="🔎 Buscar por nombre o documento del paciente…" value="' + U.esc(enviosSearchTerm) + '"/></div>' +
        '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Estado</th><th>Enviado</th><th>Acciones</th></tr></thead><tbody>' +
        (orders.length ? orders.map(function (o) { return rowHtml(o, pacientesPorId[o.patientId]); }).join("") : '<tr><td colspan="5" class="text-muted">' + (term ? "Ningún resultado coincide con tu búsqueda." : "Aún no hay resultados validados o preliminares para reportar.") + "</td></tr>") +
        "</tbody></table></div>";
    }

    function wireEnvios() {
      root.querySelectorAll("[data-pdf]").forEach(function (b) { b.addEventListener("click", function () {
        var o = S.getOrder(b.dataset.pdf); window.BIO_PDF.previewOrModal(o, S.getPatient(o.patientId), BIO_AUTH.currentTenant());
      }); });
      root.querySelectorAll("[data-send]").forEach(function (b) { b.addEventListener("click", function () { openSendModal(S.getOrder(b.dataset.send), build); }); });
      var inputBuscar = document.getElementById("env-buscar");
      if (inputBuscar) {
        inputBuscar.addEventListener("input", function (e) {
          enviosSearchTerm = e.target.value;
          build();
        });
        // El foco se pierde en cada re-render (innerHTML rehace el input
        // desde cero) — se lo devolvemos y dejamos el cursor al final, para
        // poder seguir escribiendo sin que cada tecla obligue a hacer clic
        // de nuevo (mismo ajuste que el buscador de Órdenes de Laboratorio).
        inputBuscar.focus();
        inputBuscar.setSelectionRange(inputBuscar.value.length, inputBuscar.value.length);
      }
    }

    // Seguimiento de a quién se le envió el resultado y por cuál canal (ver
    // order.canalesEnvio, que va acumulando una entrada por cada envío real
    // — WhatsApp, correo, o la publicación automática/manual en la Página
    // Web — sin pisar los anteriores). Antes solo existía un único
    // "enviado sí/no" genérico, que no decía SI de verdad se le avisó al
    // paciente por algún canal o si solo quedó publicado en el portal para
    // que él mismo lo busque — con varios canales mezclados, el laboratorio
    // no tenía forma de saber a quién todavía le falta un seguimiento real.
    function celdaCanales(o) {
      if (o.canalesEnvio && o.canalesEnvio.length) {
        var porCanal = {};
        o.canalesEnvio.forEach(function (c) { if (!porCanal[c.canal] || c.fecha > porCanal[c.canal]) porCanal[c.canal] = c.fecha; });
        return '<div class="flex gap-1 wrap">' + Object.keys(porCanal).map(function (canal) {
          return '<span class="badge badge-enviado" title="' + U.esc(U.fmtFecha(porCanal[canal])) + '">✓ ' + U.esc(canal) + " · " + U.fmtFechaCorta(porCanal[canal]) + "</span>";
        }).join("") + "</div>";
      }
      // Compatibilidad con órdenes enviadas ANTES de que existiera el
      // seguimiento por canal: solo se sabe que sí se envió algo, pero no por
      // dónde ni distinguiéndolo de la publicación automática.
      if (o.enviado) return '<span class="badge badge-enviado">Enviado ' + U.fmtFechaCorta(o.fechaEnvio) + "</span>";
      return '<span class="chip" style="background:#fef3c7;color:#92400e">⏳ Pendiente de enviar</span>';
    }
    function rowHtml(o, pac) {
      return "<tr><td><b>" + o.numeroOrden + "</b></td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + window.BIO_badgeEstado(o.estadoGeneral) + "</td>" +
        "<td>" + celdaCanales(o) + "</td>" +
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
        '<div class="lp-ic">📑</div><h3>Facturación Detallada</h3>' +
        '<p>Un renglón por orden facturada entre fechas, con los datos del paciente (documento, nombre, edad, sexo), los exámenes, el valor facturado, lo abonado, el saldo y el método de pago — para contabilidad. Descárgalo en PDF o en Excel.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-facturacion-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-facturacion-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        (conveniosActivos.length ?
          '<div class="field" style="margin:0 0 10px"><label>Convenio (opcional)</label><select id="rep-facturacion-convenio"><option value="">Todos los convenios y particulares</option>' +
          conveniosActivos.map(function (c) { return '<option value="' + c.id + '">' + U.esc(c.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        (tenant.pais === "VE" ?
          '<div class="field" style="margin:0 0 10px"><label>Moneda (opcional)</label><select id="rep-facturacion-moneda"><option value="">Todas las monedas</option>' +
          BIO_CATALOG.MONEDAS_PAGO.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        '<div id="facturacion-resumen" style="margin:0 0 10px"></div>' +
        '<div class="flex gap-2"><button class="btn btn-primary" style="flex:1" id="btn-rep-facturacion-pdf">' + U.icon("download") + " PDF</button>" +
        '<button class="btn btn-outline" style="flex:1" id="btn-rep-facturacion-excel">' + U.icon("download") + " Excel</button></div>" +
        "</div>" +
        '<div class="lp-feature">' +
        '<div class="lp-ic">🧮</div><h3>Recibos Generados</h3>' +
        '<p>Igual que Facturación Detallada, pero solo las órdenes a las que ya se les generó su Recibo de Pago entre fechas (filtra por la fecha del recibo, no de la orden) — con su N° de Recibo, monto, método de pago y datos del paciente. Útil para cuadrar contra los recibos físicos o enviados.</p>' +
        '<div class="form-grid" style="margin:10px 0">' +
        '<div class="field"><label>Desde</label><input type="date" id="rep-recibos-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="rep-recibos-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        (conveniosActivos.length ?
          '<div class="field" style="margin:0 0 10px"><label>Convenio (opcional)</label><select id="rep-recibos-convenio"><option value="">Todos los convenios y particulares</option>' +
          conveniosActivos.map(function (c) { return '<option value="' + c.id + '">' + U.esc(c.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        (tenant.pais === "VE" ?
          '<div class="field" style="margin:0 0 10px"><label>Moneda (opcional)</label><select id="rep-recibos-moneda"><option value="">Todas las monedas</option>' +
          BIO_CATALOG.MONEDAS_PAGO.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          "</select></div>" : "") +
        '<div id="recibos-resumen" style="margin:0 0 10px"></div>' +
        '<div class="flex gap-2"><button class="btn btn-primary" style="flex:1" id="btn-rep-recibos-pdf">' + U.icon("download") + " PDF</button>" +
        '<button class="btn btn-outline" style="flex:1" id="btn-rep-recibos-excel">' + U.icon("download") + " Excel</button></div>" +
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
        "</div>" +
        buildEstadisticasExamenHtml(tenant);
    }

    // -------------------------------------------------------------------
    // ESTADÍSTICAS POR EXAMEN — volumen, tendencia, ingresos y desglose por
    // aliado de UN examen específico entre fechas. Va aparte del grid de
    // tarjetas de arriba (ocupa todo el ancho) porque trae una gráfica.
    // -------------------------------------------------------------------
    function buildEstadisticasExamenHtml(tenant) {
      var examenes = BIO_CATALOG.examenesEfectivos(tenant).slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
      return '<div style="margin-top:28px;padding-top:22px;border-top:1px solid var(--border)">' +
        '<div class="flex gap-2" style="align-items:center;margin-bottom:4px"><span style="font-size:19px">📈</span><h3 style="margin:0">Estadísticas por Examen</h3></div>' +
        '<p class="text-muted" style="margin:4px 0 14px">Elige un examen y un periodo para ver cuántas veces se realizó, su tendencia, lo que generó en ingresos y de dónde vienen esas órdenes.</p>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
        '<div class="field" style="grid-column:span 2"><label>Examen</label><select id="stat-examen">' +
        examenes.map(function (e) { return '<option value="' + e.id + '">' + U.esc(e.nombre) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Desde</label><input type="date" id="stat-desde" value="' + primerDiaMes() + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="stat-hasta" value="' + hoyISO() + '"/></div>' +
        "</div>" +
        '<button class="btn btn-primary" id="btn-stat-ver">' + U.icon("trending") + " Ver Estadísticas</button>" +
        '<div id="stat-resultado" style="margin-top:4px"></div>' +
        "</div>";
    }

    function kpi(value, label) {
      return '<div class="kpi"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + label + '</div></div>';
    }

    // Igual lógica que valorExamen() en el botón de Relación de Órdenes y
    // Exámenes (tarifa especial del convenio si la tiene, si no su
    // descuento general, si no el precio de lista) — repetida aquí en vez
    // de compartida porque cada reporte arma su propio cálculo de forma
    // independiente (mismo patrón que el resto de este archivo).
    function valorExamenEnConvenio(tenantId, examId, convenioId, preciosPorId, convenios, cachePorConvenio) {
      var base = preciosPorId[examId] || 0;
      if (!convenioId) return base;
      var convenio = convenios.filter(function (c) { return c.id === convenioId; })[0];
      if (!convenio) return base;
      if (!cachePorConvenio[convenioId]) {
        var mapa = {};
        S.cotizador.listConvenioPrecios(tenantId, convenioId).forEach(function (p) { mapa[p.examId] = p; });
        cachePorConvenio[convenioId] = mapa;
      }
      var especial = cachePorConvenio[convenioId][examId];
      if (especial) return especial.modo === "fijo" ? especial.valor : Math.max(0, base * (1 - especial.valor / 100));
      if (convenio.descuentoGeneral > 0) return Math.max(0, base * (1 - convenio.descuentoGeneral / 100));
      return base;
    }

    function calcularEstadisticasExamen(tenantId, examId, desde, hasta) {
      var ordenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
        var fecha = (o.fechaOrden || "").slice(0, 10);
        return fecha >= desde && fecha <= hasta;
      });
      var preciosPorId = {}; S.cotizador.listPrecios(tenantId).forEach(function (p) { preciosPorId[p.examId] = p.precio; });
      var convenios = S.cotizador.listConvenios(tenantId);
      var cachePorConvenio = {};
      var porDia = {}, porAliado = {};
      var total = 0, totalIngresos = 0, sumaDiasEntrega = 0, countEntrega = 0;
      ordenes.forEach(function (o) {
        (o.examenes || []).forEach(function (ex) {
          if (ex.examId !== examId) return;
          total++;
          var fecha = (o.fechaOrden || "").slice(0, 10);
          porDia[fecha] = (porDia[fecha] || 0) + 1;
          var aliado = o.convenioNombre || "Particulares";
          porAliado[aliado] = (porAliado[aliado] || 0) + 1;
          totalIngresos += valorExamenEnConvenio(tenantId, examId, o.convenioId, preciosPorId, convenios, cachePorConvenio);
          if ((ex.estado === "validado" || ex.estado === "remitido") && ex.fechaValidacion) {
            var dias = (new Date(ex.fechaValidacion) - new Date(o.fechaOrden)) / 86400000;
            if (dias >= 0) { sumaDiasEntrega += dias; countEntrega++; }
          }
        });
      });
      var rango = construirBucketsEstadisticas(porDia, desde, hasta);
      var totalDiasPeriodo = Math.max(1, Math.round((new Date(hasta) - new Date(desde)) / 86400000) + 1);
      var promedioDias = countEntrega ? sumaDiasEntrega / countEntrega : null;
      return {
        total: total, totalIngresos: totalIngresos, porAliado: porAliado,
        promedioDiario: total / totalDiasPeriodo,
        entregaTexto: promedioDias == null ? "—" : (promedioDias < 1 ? (promedioDias * 24).toFixed(1) + " horas" : promedioDias.toFixed(1) + " días"),
        buckets: rango.buckets, granularidad: rango.granularidad
      };
    }

    // Agrupa el conteo diario en los mismos buckets que se van a graficar:
    // uno por día si el periodo cabe cómodo en pantalla (≤62 días), o uno
    // por semana si es más largo — para que la gráfica nunca intente dibujar
    // cientos de puntos ilegibles en un rango de varios meses/años.
    function construirBucketsEstadisticas(porDia, desde, hasta) {
      var msDia = 86400000;
      var dIni = new Date(desde + "T00:00:00");
      var dFin = new Date(hasta + "T00:00:00");
      var totalDias = Math.max(1, Math.round((dFin - dIni) / msDia) + 1);
      var granularidad = totalDias <= 62 ? "dia" : "semana";
      var buckets = [];
      if (granularidad === "dia") {
        for (var i = 0; i < totalDias; i++) {
          var iso = new Date(dIni.getTime() + i * msDia).toISOString().slice(0, 10);
          buckets.push({ label: U.fmtFechaCorta(iso), count: porDia[iso] || 0 });
        }
      } else {
        var cursor = new Date(dIni);
        while (cursor <= dFin) {
          var finSemana = new Date(Math.min(cursor.getTime() + 6 * msDia, dFin.getTime()));
          var suma = 0;
          for (var dd = new Date(cursor); dd <= finSemana; dd = new Date(dd.getTime() + msDia)) {
            suma += porDia[dd.toISOString().slice(0, 10)] || 0;
          }
          buckets.push({ label: U.fmtFechaCorta(cursor.toISOString().slice(0, 10)) + "–" + U.fmtFechaCorta(finSemana.toISOString().slice(0, 10)), count: suma });
          cursor = new Date(finSemana.getTime() + msDia);
        }
      }
      return { buckets: buckets, granularidad: granularidad };
    }

    // Gráfica de líneas en SVG puro (sin ninguna librería): un punto por
    // bucket, área sombreada degradada, y una "banda" invisible por punto
    // (ver wireChartHover) que cubre exactamente hasta la mitad de camino
    // con sus vecinos — así el mouse puede estar en cualquier parte de esa
    // franja y siempre resalta el punto más cercano, sin huecos ni que dos
    // bandas se encimen.
    function buildTrendChartSvg(buckets) {
      var w = 600, h = 180, padL = 34, padR = 10, padT = 10, padB = 22;
      var innerW = w - padL - padR, innerH = h - padT - padB;
      var n = buckets.length;
      var maxVal = Math.max.apply(null, buckets.map(function (b) { return b.count; }).concat([1]));
      var stepX = n > 1 ? innerW / (n - 1) : 0;
      var puntos = buckets.map(function (b, i) {
        return { x: padL + (n > 1 ? stepX * i : innerW / 2), y: padT + innerH - (b.count / maxVal) * innerH, count: b.count, label: b.label };
      });
      var linePath = puntos.map(function (p, i) { return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
      var baseY = (padT + innerH).toFixed(1);
      var areaPath = linePath + " L" + puntos[n - 1].x.toFixed(1) + "," + baseY + " L" + puntos[0].x.toFixed(1) + "," + baseY + " Z";
      var gridYs = [0, 0.5, 1];
      var gridHtml = gridYs.map(function (f) {
        var y = (padT + innerH - f * innerH).toFixed(1);
        return '<line class="stat-chart-grid" x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y + '" y2="' + y + '"/>' +
          '<text class="stat-chart-axis-label" x="' + (padL - 6) + '" y="' + (parseFloat(y) + 3).toFixed(1) + '" text-anchor="end">' + Math.round(f * maxVal) + "</text>";
      }).join("");
      var idxEtiquetas = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
      var xLabelsHtml = idxEtiquetas.map(function (i) {
        return '<text class="stat-chart-axis-label" x="' + puntos[i].x.toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">' + U.esc(puntos[i].label) + "</text>";
      }).join("");
      var hoverRectsHtml = puntos.map(function (p, i) {
        var left = i === 0 ? padL : (puntos[i - 1].x + p.x) / 2;
        var right = i === n - 1 ? padL + innerW : (p.x + puntos[i + 1].x) / 2;
        return '<rect data-stat-hover="' + i + '" x="' + left.toFixed(1) + '" y="' + padT + '" width="' + (right - left).toFixed(1) + '" height="' + innerH + '" fill="transparent"/>';
      }).join("");
      var svg = '<svg class="stat-chart-svg" viewBox="0 0 ' + w + " " + h + '">' +
        '<defs><linearGradient id="stat-area-grad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" style="stop-color:var(--brand-primary);stop-opacity:.35"/>' +
        '<stop offset="100%" style="stop-color:var(--brand-primary);stop-opacity:0"/>' +
        "</linearGradient></defs>" +
        gridHtml + xLabelsHtml +
        '<path class="stat-chart-area" d="' + areaPath + '"/>' +
        '<path class="stat-chart-line" d="' + linePath + '"/>' +
        '<line class="stat-chart-crosshair" id="stat-crosshair" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + innerH) + '"/>' +
        '<circle id="stat-hover-dot" class="stat-chart-dot" r="4" opacity="0"/>' +
        hoverRectsHtml +
        "</svg>";
      return { svg: svg, puntos: puntos, w: w, h: h };
    }

    function wireTrendChartHover(wrap, chart) {
      var tooltip = wrap.querySelector(".stat-tooltip");
      var crosshair = wrap.querySelector("#stat-crosshair");
      var hoverDot = wrap.querySelector("#stat-hover-dot");
      function mostrar(i) {
        var p = chart.puntos[i];
        crosshair.setAttribute("x1", p.x); crosshair.setAttribute("x2", p.x); crosshair.style.opacity = 1;
        hoverDot.setAttribute("cx", p.x); hoverDot.setAttribute("cy", p.y); hoverDot.style.opacity = 1;
        tooltip.style.opacity = 1;
        tooltip.textContent = p.label + ": " + p.count;
        tooltip.style.left = (p.x / chart.w * 100) + "%";
        tooltip.style.top = (p.y / chart.h * 100) + "%";
      }
      function ocultar() { crosshair.style.opacity = 0; hoverDot.style.opacity = 0; tooltip.style.opacity = 0; }
      wrap.querySelectorAll("[data-stat-hover]").forEach(function (rect) {
        rect.addEventListener("mouseenter", function () { mostrar(parseInt(rect.dataset.statHover, 10)); });
      });
      wrap.querySelector(".stat-chart-svg").addEventListener("mouseleave", ocultar);
    }

    function htmlResultadoEstadisticas(stats, tenant) {
      if (!stats.total) return '<p class="text-muted" style="margin-top:10px">No se realizó este examen en el periodo elegido.</p>';
      var kpisHtml = '<div class="kpi-grid" style="margin-top:14px">' +
        kpi(stats.total, "Total Realizados") +
        kpi(stats.promedioDiario.toFixed(1), "Promedio por Día") +
        (tenant.mostrarPrecioOrden ? kpi(fmtMoneda(stats.totalIngresos), "Ingresos Generados") : "") +
        kpi(stats.entregaTexto, "Tiempo Promedio de Entrega") +
        "</div>";
      var chartHtml = '<h4 style="margin:18px 0 4px">Volumen ' + (stats.granularidad === "dia" ? "diario" : "semanal") + '</h4>' +
        '<div class="stat-chart-wrap" id="stat-chart-wrap">' + buildTrendChartSvg(stats.buckets).svg + '<div class="stat-tooltip"></div></div>';
      var aliados = Object.keys(stats.porAliado).sort(function (a, b) { return stats.porAliado[b] - stats.porAliado[a]; });
      var maxAliado = Math.max.apply(null, aliados.map(function (a) { return stats.porAliado[a]; }).concat([1]));
      var barsHtml = aliados.length > 1 ? '<h4 style="margin:18px 0 10px">Por Aliado / Convenio</h4><div class="prod-bars">' +
        aliados.map(function (a) {
          var pct = Math.round(stats.porAliado[a] / maxAliado * 100);
          return '<div class="prod-bar-row"><div class="prod-bar-label">' + U.esc(a) + '</div><div class="prod-bar-track"><div class="prod-bar-fill" style="width:' + pct + '%"></div></div><div class="prod-bar-count">' + stats.porAliado[a] + "</div></div>";
        }).join("") + "</div>" : "";
      return kpisHtml + chartHtml + barsHtml;
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
        var orders = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
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
        var ordenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
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
      // -------------------------------------------------------------------
      // Resumen en vivo (Total Facturado / Abonado / Saldo) debajo de los
      // filtros de Facturación Detallada y Recibos Generados — se
      // actualiza solo al cambiar fechas/convenio/moneda, sin tener que
      // descargar nada para ver el total del periodo.
      // -------------------------------------------------------------------
      function htmlResumenTotales(filas) {
        if (!filas.length) return '<p class="text-muted" style="font-size:12px;margin:0">Sin resultados en ese periodo.</p>';
        var total = filas.reduce(function (a, f) { return a + f.valorTotal; }, 0);
        var abonado = filas.reduce(function (a, f) { return a + f.valorAbonado; }, 0);
        var saldo = total - abonado;
        return '<div class="flex gap-2 wrap">' +
          '<span class="chip" style="background:#f0fdf4;color:#15803d">Total Facturado: <b>' + fmtMoneda(total) + "</b></span>" +
          '<span class="chip" style="background:#eff6ff;color:#1d4ed8">Abonado: <b>' + fmtMoneda(abonado) + "</b></span>" +
          '<span class="chip" style="background:' + (saldo > 0 ? "#fef2f2" : "#f0fdf4") + ";color:" + (saldo > 0 ? "#b91c1c" : "#15803d") + '">Saldo: <b>' + fmtMoneda(saldo) + "</b></span>" +
          "</div>" +
          '<p class="text-muted" style="font-size:11px;margin:4px 0 0">' + filas.length + " orden(es) en el periodo.</p>";
      }
      function wireResumenLive(camposIds, divId, datosFn) {
        var div = document.getElementById(divId);
        if (!div) return;
        function actualizar() { div.innerHTML = htmlResumenTotales(datosFn().filas); }
        camposIds.forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "input", actualizar);
        });
        actualizar();
      }
      // -------------------------------------------------------------------
      // FACTURACIÓN DETALLADA — un renglón por orden, con los datos del
      // paciente y los valores facturados (comparte el mismo cálculo de
      // "abonado/saldo" que Cartera de Clientes, para que ambos reportes
      // siempre cuadren entre sí).
      // -------------------------------------------------------------------
      function datosFacturacion() {
        var desde = document.getElementById("rep-facturacion-desde").value;
        var hasta = document.getElementById("rep-facturacion-hasta").value;
        var elConvenio = document.getElementById("rep-facturacion-convenio");
        var convenioId = elConvenio ? elConvenio.value : "";
        var elMoneda = document.getElementById("rep-facturacion-moneda");
        var monedaId = elMoneda ? elMoneda.value : "";
        var ordenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
          var fecha = (o.fechaOrden || "").slice(0, 10);
          if (convenioId && o.convenioId !== convenioId) return false;
          if (monedaId && o.monedaPago !== monedaId) return false;
          return fecha >= desde && fecha <= hasta && o.valorCobrar != null;
        });
        var filas = ordenes.map(function (o) {
          var pac = S.getPatient(o.patientId);
          var valorTotal = o.valorCobrar || 0;
          var valorAbonado = !o.pago ? 0 : BIO_CATALOG.totalAbonado(o);
          var metodosUsados = {};
          (o.abonos || []).forEach(function (a) { metodosUsados[BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[a.metodoPago] || a.metodoPago || "—"] = true; });
          return {
            numeroOrden: o.numeroOrden,
            fecha: o.fechaOrden,
            documento: pac ? (pac.tipoDocumento || "") + " " + pac.numeroDocumento : "—",
            paciente: pac ? U.nombreCompleto(pac) : "—",
            edad: pac ? U.edadTexto(pac) : "—",
            sexo: pac ? pac.sexo : "—",
            aliado: o.convenioNombre || "Particulares",
            examenes: (o.examenes || []).map(function (ex) { var exCat = BIO_CATALOG.examenEfectivo(ex.examId, tenant); return exCat ? exCat.nombre : ex.examId; }).join(", "),
            moneda: o.monedaPago ? BIO_CATALOG.monedaPagoLabel(o.monedaPago) : BIO_CATALOG.monedaBaseLabel(tenant),
            metodoPago: Object.keys(metodosUsados).join(", ") || "—",
            valorTotal: valorTotal,
            valorAbonado: valorAbonado,
            saldoPendiente: valorTotal - valorAbonado
          };
        }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var convenioFiltro = convenioId ? conveniosActivos.filter(function (c) { return c.id === convenioId; })[0] : null;
        return { filas: filas, desde: desde, hasta: hasta, convenioFiltro: convenioFiltro, monedaFiltroId: monedaId, monedaFiltroLabel: monedaId ? BIO_CATALOG.monedaPagoLabel(monedaId) : "" };
      }
      wireResumenLive(["rep-facturacion-desde", "rep-facturacion-hasta", "rep-facturacion-convenio", "rep-facturacion-moneda"], "facturacion-resumen", datosFacturacion);
      var btnFacturacionPdf = document.getElementById("btn-rep-facturacion-pdf");
      if (btnFacturacionPdf) btnFacturacionPdf.addEventListener("click", function () {
        var d = datosFacturacion();
        var bytes = BIO_PDF_FACTURACION.buildFacturacionDetalladaPDF(d.filas, tenant, d.desde, d.hasta, d.convenioFiltro ? d.convenioFiltro.nombre : "", d.monedaFiltroLabel);
        var sufijoConvenio = d.convenioFiltro ? "_" + d.convenioFiltro.nombre.replace(/\s+/g, "_") : "";
        var sufijoMoneda = d.monedaFiltroId ? "_" + d.monedaFiltroId : "";
        U.downloadBytes(bytes, "Facturacion_Detallada_" + d.desde + "_a_" + d.hasta + sufijoConvenio + sufijoMoneda + ".pdf");
        U.toast("Reporte de facturación descargado.", "success");
      });
      var btnFacturacionExcel = document.getElementById("btn-rep-facturacion-excel");
      if (btnFacturacionExcel) btnFacturacionExcel.addEventListener("click", function () {
        var d = datosFacturacion();
        if (!d.filas.length) { U.toast("No hay órdenes facturadas en ese periodo.", "error"); return; }
        var filasExcel = d.filas.map(function (f) {
          return {
            "N° Orden": f.numeroOrden, Fecha: U.fmtFechaCorta(f.fecha), Documento: f.documento, Paciente: f.paciente,
            Edad: f.edad, Sexo: f.sexo, "Aliado/Convenio": f.aliado, "Exámenes Facturados": f.examenes,
            Moneda: f.moneda, "Método de Pago": f.metodoPago,
            "Valor Facturado": f.valorTotal, Abonado: f.valorAbonado, "Saldo Pendiente": f.saldoPendiente
          };
        });
        var totalFacturado = d.filas.reduce(function (a, f) { return a + f.valorTotal; }, 0);
        var totalAbonadoExcel = d.filas.reduce(function (a, f) { return a + f.valorAbonado; }, 0);
        var totalSaldoExcel = d.filas.reduce(function (a, f) { return a + f.saldoPendiente; }, 0);
        filasExcel.push({
          "N° Orden": "", Fecha: "", Documento: "TOTAL GENERAL DEL PERIODO", Paciente: "", Edad: "", Sexo: "",
          "Aliado/Convenio": "", "Exámenes Facturados": "", Moneda: "", "Método de Pago": "",
          "Valor Facturado": totalFacturado, Abonado: totalAbonadoExcel, "Saldo Pendiente": totalSaldoExcel
        });
        var ws = XLSX.utils.json_to_sheet(filasExcel);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Facturación");
        var sufijoConvenioExcel = d.convenioFiltro ? "_" + d.convenioFiltro.nombre.replace(/\s+/g, "_") : "";
        var sufijoMonedaExcel = d.monedaFiltroId ? "_" + d.monedaFiltroId : "";
        XLSX.writeFile(wb, "Facturacion_Detallada_" + d.desde + "_a_" + d.hasta + sufijoConvenioExcel + sufijoMonedaExcel + ".xlsx");
        U.toast("Reporte de facturación descargado en Excel.", "success");
      });
      // -------------------------------------------------------------------
      // RECIBOS GENERADOS — igual que Facturación Detallada, pero solo las
      // órdenes a las que YA se les generó su Recibo de Pago (order.pago
      // existe), filtrando por la fecha del recibo (order.pago.fecha) y no
      // por la fecha de la orden — una orden puede crearse un día y
      // pagarse/recibirse días después.
      // -------------------------------------------------------------------
      function datosRecibos() {
        var desde = document.getElementById("rep-recibos-desde").value;
        var hasta = document.getElementById("rep-recibos-hasta").value;
        var elConvenio = document.getElementById("rep-recibos-convenio");
        var convenioId = elConvenio ? elConvenio.value : "";
        var elMoneda = document.getElementById("rep-recibos-moneda");
        var monedaId = elMoneda ? elMoneda.value : "";
        var ordenes = BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
          if (!o.pago) return false;
          var fechaRecibo = (o.pago.fecha || "").slice(0, 10);
          if (convenioId && o.convenioId !== convenioId) return false;
          if (monedaId && o.monedaPago !== monedaId) return false;
          return fechaRecibo >= desde && fechaRecibo <= hasta;
        });
        var filas = ordenes.map(function (o) {
          var pac = S.getPatient(o.patientId);
          var valorTotal = o.pago.monto != null ? o.pago.monto : (o.valorCobrar || 0);
          var valorAbonado = BIO_CATALOG.totalAbonado(o);
          var metodosUsados = {};
          (o.abonos || []).forEach(function (a) { metodosUsados[BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[a.metodoPago] || a.metodoPago || "—"] = true; });
          var metodoPago = (o.pago.esCredito && !o.pago.tieneCopago) ? "Crédito de Convenio" : (Object.keys(metodosUsados).join(", ") || (BIO_PDF_RECIBO_ORDEN.METODO_PAGO_LABEL[o.pago.metodoPago] || o.pago.metodoPago || "—"));
          return {
            numeroOrden: o.numeroOrden,
            numeroRecibo: BIO_PDF_RECIBO_ORDEN.numeroRecibo(o),
            fecha: o.pago.fecha,
            documento: pac ? (pac.tipoDocumento || "") + " " + pac.numeroDocumento : "—",
            paciente: pac ? U.nombreCompleto(pac) : "—",
            edad: pac ? U.edadTexto(pac) : "—",
            sexo: pac ? pac.sexo : "—",
            aliado: o.convenioNombre || "Particulares",
            examenes: (o.examenes || []).map(function (ex) { var exCat = BIO_CATALOG.examenEfectivo(ex.examId, tenant); return exCat ? exCat.nombre : ex.examId; }).join(", "),
            moneda: o.monedaPago ? BIO_CATALOG.monedaPagoLabel(o.monedaPago) : BIO_CATALOG.monedaBaseLabel(tenant),
            metodoPago: metodoPago,
            valorTotal: valorTotal,
            valorAbonado: valorAbonado,
            saldoPendiente: valorTotal - valorAbonado
          };
        }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        var convenioFiltro = convenioId ? conveniosActivos.filter(function (c) { return c.id === convenioId; })[0] : null;
        return { filas: filas, desde: desde, hasta: hasta, convenioFiltro: convenioFiltro, monedaFiltroId: monedaId, monedaFiltroLabel: monedaId ? BIO_CATALOG.monedaPagoLabel(monedaId) : "" };
      }
      wireResumenLive(["rep-recibos-desde", "rep-recibos-hasta", "rep-recibos-convenio", "rep-recibos-moneda"], "recibos-resumen", datosRecibos);
      var btnRecibosPdf = document.getElementById("btn-rep-recibos-pdf");
      if (btnRecibosPdf) btnRecibosPdf.addEventListener("click", function () {
        var d = datosRecibos();
        var bytes = BIO_PDF_FACTURACION.buildRecibosGeneradosPDF(d.filas, tenant, d.desde, d.hasta, d.convenioFiltro ? d.convenioFiltro.nombre : "", d.monedaFiltroLabel);
        var sufijoConvenio = d.convenioFiltro ? "_" + d.convenioFiltro.nombre.replace(/\s+/g, "_") : "";
        var sufijoMoneda = d.monedaFiltroId ? "_" + d.monedaFiltroId : "";
        U.downloadBytes(bytes, "Recibos_Generados_" + d.desde + "_a_" + d.hasta + sufijoConvenio + sufijoMoneda + ".pdf");
        U.toast("Reporte de recibos generados descargado.", "success");
      });
      var btnRecibosExcel = document.getElementById("btn-rep-recibos-excel");
      if (btnRecibosExcel) btnRecibosExcel.addEventListener("click", function () {
        var d = datosRecibos();
        if (!d.filas.length) { U.toast("No hay recibos generados en ese periodo.", "error"); return; }
        var filasExcel = d.filas.map(function (f) {
          return {
            "N° Orden": f.numeroOrden, "N° Recibo": f.numeroRecibo, Fecha: U.fmtFechaCorta(f.fecha), Documento: f.documento, Paciente: f.paciente,
            Edad: f.edad, Sexo: f.sexo, "Aliado/Convenio": f.aliado, "Exámenes Facturados": f.examenes,
            Moneda: f.moneda, "Método de Pago": f.metodoPago,
            "Valor Facturado": f.valorTotal, Abonado: f.valorAbonado, "Saldo Pendiente": f.saldoPendiente
          };
        });
        var totalFacturadoRecibos = d.filas.reduce(function (a, f) { return a + f.valorTotal; }, 0);
        var totalAbonadoRecibos = d.filas.reduce(function (a, f) { return a + f.valorAbonado; }, 0);
        var totalSaldoRecibos = d.filas.reduce(function (a, f) { return a + f.saldoPendiente; }, 0);
        filasExcel.push({
          "N° Orden": "", "N° Recibo": "", Fecha: "", Documento: "TOTAL GENERAL DEL PERIODO", Paciente: "", Edad: "", Sexo: "",
          "Aliado/Convenio": "", "Exámenes Facturados": "", Moneda: "", "Método de Pago": "",
          "Valor Facturado": totalFacturadoRecibos, Abonado: totalAbonadoRecibos, "Saldo Pendiente": totalSaldoRecibos
        });
        var ws = XLSX.utils.json_to_sheet(filasExcel);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recibos");
        var sufijoConvenioExcel = d.convenioFiltro ? "_" + d.convenioFiltro.nombre.replace(/\s+/g, "_") : "";
        var sufijoMonedaExcel = d.monedaFiltroId ? "_" + d.monedaFiltroId : "";
        XLSX.writeFile(wb, "Recibos_Generados_" + d.desde + "_a_" + d.hasta + sufijoConvenioExcel + sufijoMonedaExcel + ".xlsx");
        U.toast("Reporte de recibos descargado en Excel.", "success");
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
        BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).forEach(function (o) {
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
        BIO_AUTH.filtrarPorSedeActual(S.listOrders(tenantId)).filter(function (o) {
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
      var btnStatVer = document.getElementById("btn-stat-ver");
      if (btnStatVer) btnStatVer.addEventListener("click", function () {
        var examId = document.getElementById("stat-examen").value;
        var desde = document.getElementById("stat-desde").value;
        var hasta = document.getElementById("stat-hasta").value;
        if (!examId || !desde || !hasta || desde > hasta) { U.toast("Elige un examen y un rango de fechas válido.", "error"); return; }
        var stats = calcularEstadisticasExamen(tenantId, examId, desde, hasta);
        var contenedor = document.getElementById("stat-resultado");
        contenedor.innerHTML = htmlResultadoEstadisticas(stats, tenant);
        if (stats.total) wireTrendChartHover(contenedor, buildTrendChartSvg(stats.buckets));
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
      // "Compartir con PDF Adjunto" (Web Share API) solo existe en los
      // navegadores/dispositivos que lo soportan — en los que no (ej.
      // computador de escritorio con Firefox, o Chrome/Edge cuando el
      // equipo no tiene WhatsApp Desktop instalado para recibirlo desde el
      // panel de compartir del sistema), antes esta pantalla se quedaba
      // SIN ningún botón de WhatsApp. "Enviar por WhatsApp" (wa.me, con el
      // mensaje ya escrito) queda siempre visible como respaldo — el mismo
      // patrón que ya usan Recibo de Pago, Contrato, Licencia y Cotización
      // — para que WhatsApp esté disponible sin importar el navegador.
      (U.soportaCompartirArchivos()
        ? '<p class="text-muted" style="margin:0 0 10px;font-size:12.5px">Un solo clic: se descarga el PDF y se abre el menú para compartirlo con el archivo ya adjunto — puedes elegir WhatsApp ahí mismo.</p>' +
          U.botonCompartirPDFHtml("send-compartir", "btn-whatsapp btn-block") +
          '<button type="button" class="btn btn-outline btn-sm btn-block" id="send-wa" style="margin-top:8px">' + U.icon("send") + " ¿No aparece WhatsApp arriba? Ábrelo tú mismo(a)</button>"
        : '<p class="text-muted" style="margin:0 0 10px;font-size:12.5px">Se descarga el PDF y se abre WhatsApp con el mensaje ya escrito — solo adjunta el PDF que se acaba de descargar antes de enviar.</p>' +
          '<button type="button" class="btn btn-whatsapp btn-block" id="send-wa">' + U.icon("send") + " Enviar por WhatsApp</button>"
      ) +
      '<div class="flex gap-2 wrap" style="margin-top:8px">' +
      '<button type="button" class="btn btn-outline btn-sm" id="send-gmail">📧 Enviar por Gmail</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="send-outlook">📧 Enviar por Outlook / Hotmail</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="send-mailto">Mi correo predeterminado</button>' +
      "</div>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">' +
      '<button class="btn btn-ghost" data-modal-close>Cancelar</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="send-solo-descargar">' + U.icon("download") + " Solo descargar PDF</button>" +
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
        // Publica este PDF para que el paciente lo descargue solo desde la
        // Página Web real del laboratorio (ver "Página Web" en
        // Configuración) — nunca bloquea el envío normal si falla (sin
        // internet, PDF grande, etc.): el paciente igual recibe su
        // resultado por el canal que se eligió aquí.
        publicarResultadoPublico(order, pac, tenant, bytes).catch(function (err) { console.warn("BIOsoft: no se pudo publicar el resultado en la Página Web ->", err); });
        return bytes;
      });
    }
    function registrarEnvio(destino, canal) {
      var tipo = wrap.querySelector("#send-tipo").value;
      S.addAudit(session.tenantId, session.nombre, session.rol, "SEND_REPORT", "orden", order.id, "Envió el informe (" + tipo + ") de la orden " + order.numeroOrden + " a " + destino + ".");
      // Seguimiento de a quién se le envió y por cuál canal (ver celdaCanales
      // en la lista de Reportes) — se acumula, nunca se pisa, para poder ver
      // TODOS los canales por los que ha recibido su resultado este paciente.
      order.canalesEnvio = order.canalesEnvio || [];
      order.canalesEnvio.push({ canal: canal, destino: destino, fecha: S.nowISO(), tipo: tipo });
      S.saveOrder(order);
      onDone();
    }
    function conBotonOcupado(btn, tarea) {
      var htmlOriginal = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = "Generando PDF…";
      return tarea().finally(function () { btn.disabled = false; btn.innerHTML = htmlOriginal; });
    }

    var btnCompartir = wrap.querySelector("#send-compartir");
    if (btnCompartir) {
      btnCompartir.addEventListener("click", function (e) {
        conBotonOcupado(e.currentTarget, function () {
          return obtenerPdf().then(function (bytes) {
            U.compartirPDF(bytes, pdfFilenameCache, wrap.querySelector("#send-msg").value);
            registrarEnvio("compartir (PDF adjunto)", "Compartir");
          });
        });
      });
    }

    var btnWa = wrap.querySelector("#send-wa");
    if (btnWa) {
      btnWa.addEventListener("click", function (e) {
        var numero = U.numeroWhatsapp(wrap.querySelector("#send-whatsapp").value, tenant.pais);
        if (!numero) { U.toast("Ingresa el WhatsApp del paciente.", "error"); return; }
        // Igual que los botones de correo: se abre la pestaña en blanco DE
        // UNA VEZ, de forma síncrona con el clic — si se abriera recién
        // dentro del .then() de obtenerPdf() (que genera el PDF de forma
        // asíncrona), varios navegadores la bloquean por "popup" al no
        // verla como resultado directo de la acción del usuario.
        var pestana = window.open("", "_blank");
        conBotonOcupado(e.currentTarget, function () {
          return obtenerPdf().then(function () {
            var url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(wrap.querySelector("#send-msg").value);
            if (pestana) pestana.location.href = url; else window.open(url, "_blank");
            registrarEnvio("WhatsApp (" + numero + ")", "WhatsApp");
          }).catch(function (err) {
            if (pestana) pestana.close();
            throw err;
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
            registrarEnvio(correo, "Correo");
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

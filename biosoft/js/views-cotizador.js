/* BIOsoft — Cotizador de exámenes: lista de precios (manual o por Excel),
   selección rápida de exámenes y envío de la cotización por WhatsApp o correo. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;
  var WA_NUMBER_GENERICO = "573505457420";
  var METODO_PAGO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta Débito/Crédito", otro: "Otro" };

  function waLinkTo(numero, mensaje) {
    var n = (numero || "").replace(/\D/g, "");
    return "https://wa.me/" + (n || WA_NUMBER_GENERICO) + "?text=" + encodeURIComponent(mensaje);
  }
  function fmtMoneda(n) { return BIO_PDF_COTIZACION.fmtMoneda(n); }
  function fmtFechaCorta(iso) {
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
  }

  // Exámenes de referencia propios de un laboratorio (ej. tarifas de un
  // laboratorio externo que el catálogo global de BIOsoft no incluye) se
  // agrupan en esta sección "virtual", que solo aparece cuando el laboratorio
  // tiene al menos un examen personalizado propio.
  var SECCION_REF_EXT = { id: "ref-externa", nombre: "Enviados a Referencia (tu lista)" };

  window.BIO_VIEWS.cotizador = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var tenant;
    var vista = "nueva";
    var precios = {}; // examId -> precio
    var cotizaciones = [];
    var customExams = []; // exámenes propios del laboratorio, fuera del catálogo global
    var convenios = [];
    var convenioPreciosPorConvenio = {}; // convenioId -> { examId -> {modo, valor} }
    var examenesReferencia = []; // catálogo independiente: exámenes remitidos a un laboratorio de referencia (ver "🔬 Lab. Referencia")
    var refSearchTerm = "";

    var TIPOS_CONVENIO = ["Laboratorio de Referencia", "Laboratorio de Contrarreferencia", "Cliente Institucional", "Otro"];

    function precioDe(examId) { return precios[examId] || 0; }

    // Resuelve el precio final de un examen para un convenio dado (o el
    // precio regular si convenioId es "" / null): un precio especial fijado
    // para ESE examen puntual tiene prioridad sobre el descuento general del
    // convenio, que a su vez tiene prioridad sobre el precio regular.
    function precioConConvenio(examId, convenioId) {
      var base = precioDe(examId);
      if (!convenioId) return base;
      var convenio = convenios.filter(function (c) { return c.id === convenioId; })[0];
      if (!convenio) return base;
      var especial = (convenioPreciosPorConvenio[convenioId] || {})[examId];
      if (especial) {
        return especial.modo === "fijo" ? especial.valor : Math.max(0, base * (1 - especial.valor / 100));
      }
      if (convenio.descuentoGeneral > 0) return Math.max(0, base * (1 - convenio.descuentoGeneral / 100));
      return base;
    }
    function fmtMonedaExtra(monto) {
      var extra = C.fmtMonedaAdicional(tenant, monto);
      return extra ? ' <span class="text-muted" style="font-weight:400;font-size:12px">(' + extra + ')</span>' : "";
    }
    function textoMonedaExtra(monto) {
      var extra = C.fmtMonedaAdicional(tenant, monto);
      return extra ? " (" + extra + ")" : "";
    }

    function poolExamenes() {
      return C.examenesEfectivos(tenant).concat(customExams.map(function (ce) {
        return { id: ce.id, nombre: ce.nombre, cups: ce.cups, seccion: SECCION_REF_EXT.id };
      }));
    }
    function seccionesDisponibles() {
      var base = C.seccionesEfectivas(tenant);
      return customExams.length ? base.concat([SECCION_REF_EXT]) : base;
    }
    function resolverExamen(id) {
      return C.examenEfectivo(id, tenant) || poolExamenes().filter(function (e) { return e.id === id; })[0] || null;
    }
    function resolverSeccionNombre(seccionId) {
      return seccionId === SECCION_REF_EXT.id ? SECCION_REF_EXT.nombre : C.seccionNombre(seccionId, tenant);
    }

    function cargar() {
      tenant = S.getTenant(tenantId);
      var lista = S.cotizador.listPrecios(tenantId);
      precios = {};
      lista.forEach(function (p) { precios[p.examId] = p.precio; });
      cotizaciones = S.cotizador.listCotizaciones(tenantId);
      customExams = S.cotizador.listExamenesPersonalizados(tenantId);
      convenios = S.cotizador.listConvenios(tenantId);
      convenioPreciosPorConvenio = {};
      convenios.forEach(function (cv) {
        var mapa = {};
        S.cotizador.listConvenioPrecios(tenantId, cv.id).forEach(function (p) { mapa[p.examId] = p; });
        convenioPreciosPorConvenio[cv.id] = mapa;
      });
      examenesReferencia = S.cotizador.listExamenesReferencia(tenantId);
      build();
    }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Cotizador de Exámenes</h3>' +
        '<div class="crm-view-toggle">' +
        '<button type="button" class="' + (vista === "nueva" ? "active" : "") + '" data-vista="nueva">🧾 Nueva Cotización</button>' +
        '<button type="button" class="' + (vista === "recibo" ? "active" : "") + '" data-vista="recibo">💵 Recibo Directo</button>' +
        '<button type="button" class="' + (vista === "precios" ? "active" : "") + '" data-vista="precios">💲 Lista de Precios</button>' +
        '<button type="button" class="' + (vista === "convenios" ? "active" : "") + '" data-vista="convenios">🤝 Convenios</button>' +
        '<button type="button" class="' + (vista === "labref" ? "active" : "") + '" data-vista="labref">🔬 Lab. Referencia</button>' +
        '<button type="button" class="' + (vista === "historial" ? "active" : "") + '" data-vista="historial">🕓 Historial</button>' +
        "</div></div>" +
        (vista === "nueva" ? buildNuevaHtml() : vista === "recibo" ? buildReciboDirectoHtml() : vista === "precios" ? buildPreciosHtml() : vista === "convenios" ? buildConveniosHtml() : vista === "labref" ? buildLabReferenciaHtml() : buildHistorialHtml()) +
        "</div>";
      root.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { vista = b.dataset.vista; build(); }); });
      if (vista === "nueva") wireNueva(); else if (vista === "recibo") wireReciboDirecto(); else if (vista === "precios") wirePrecios(); else if (vista === "convenios") wireConvenios(); else if (vista === "labref") wireLabReferencia(); else wireHistorial();
    }

    // ---------------------------------------------------------------------
    // SELECTOR DE EXÁMENES — compartido entre "Nueva Cotización" y "Recibo
    // Directo": cada pestaña tiene su propio estado de selección/búsqueda
    // (pickerNueva / pickerRecibo) pero reutilizan el mismo render.
    // ---------------------------------------------------------------------
    function crearPickerState() { return { selected: [], activeSection: C.SECCIONES[0].id, searchTerm: "", convenioId: "" }; }
    var pickerNueva = crearPickerState();
    var pickerRecibo = crearPickerState();

    function convenioSelectHtml(prefix, st) {
      var activos = convenios.filter(function (c) { return c.activo; });
      if (!activos.length) return "";
      return '<div class="field" style="margin:12px 0"><label>Convenio / Precio especial (opcional)</label><select id="' + prefix + '-convenio">' +
        '<option value="">Precio Regular (sin convenio)</option>' +
        activos.map(function (c) { return '<option value="' + c.id + '" ' + (c.id === st.convenioId ? "selected" : "") + '>' + U.esc(c.nombre) + " — " + U.esc(c.tipo) + "</option>"; }).join("") +
        "</select></div>";
    }

    function pickerHtml(prefix) {
      var st = prefix === "cot" ? pickerNueva : pickerRecibo;
      return convenioSelectHtml(prefix, st) +
        '<div class="field" style="margin:12px 0"><input id="' + prefix + '-exam-search" placeholder="Buscar examen por nombre o código CUPS en todas las secciones…"/></div>' +
        '<div class="exam-picker">' +
        '<div class="exam-picker-sections" id="' + prefix + '-sec-list"></div>' +
        '<div class="exam-picker-list" id="' + prefix + '-exam-list"></div>' +
        "</div>" +
        '<div class="flex justify-between items-center" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">' +
        '<span style="font-size:14px">Exámenes seleccionados: <b id="' + prefix + '-count">0</b></span>' +
        '<span style="font-size:18px;font-weight:800;color:var(--brand-primary)">Total: <span id="' + prefix + '-total">' + fmtMoneda(0) + "</span></span>" +
        "</div>";
    }

    function wirePicker(prefix, st) {
      document.getElementById(prefix + "-exam-search").addEventListener("input", function (e) { st.searchTerm = e.target.value; renderPickerSecciones(prefix, st); renderPickerExams(prefix, st); });
      var selConvenio = document.getElementById(prefix + "-convenio");
      if (selConvenio) {
        selConvenio.addEventListener("change", function (e) {
          st.convenioId = e.target.value;
          renderPickerExams(prefix, st);
          actualizarPickerTotales(prefix, st);
        });
      }
      renderPickerSecciones(prefix, st);
      renderPickerExams(prefix, st);
    }

    function renderPickerSecciones(prefix, st) {
      document.getElementById(prefix + "-sec-list").innerHTML = seccionesDisponibles().map(function (s) {
        var count = st.selected.filter(function (id) { return resolverExamen(id).seccion === s.id; }).length;
        return '<div class="sec-item ' + (!st.searchTerm && s.id === st.activeSection ? "active" : "") + '" data-sec="' + s.id + '">' + s.nombre + (count ? ' <span class="badge badge-validado" style="margin-left:4px">' + count + "</span>" : "") + "</div>";
      }).join("");
      document.querySelectorAll("#" + prefix + "-sec-list .sec-item").forEach(function (el) {
        el.addEventListener("click", function () {
          st.activeSection = el.dataset.sec; st.searchTerm = ""; document.getElementById(prefix + "-exam-search").value = "";
          renderPickerSecciones(prefix, st); renderPickerExams(prefix, st);
        });
      });
    }

    function renderPickerExams(prefix, st) {
      var term = U.normalizar(st.searchTerm.trim());
      var todos = poolExamenes();
      var pool = term
        ? todos.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : todos.filter(function (e) { return e.seccion === st.activeSection; });

      document.getElementById(prefix + "-exam-list").innerHTML = pool.map(function (e) {
        var checked = st.selected.indexOf(e.id) !== -1;
        var precioRegular = precioDe(e.id);
        var precio = precioConConvenio(e.id, st.convenioId);
        var tieneDescuento = st.convenioId && precio !== precioRegular;
        return '<label class="exam-row"><input type="checkbox" data-picker-prefix="' + prefix + '" data-picker-exam="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + resolverSeccionNombre(e.seccion) + "</span>" : "") + "</div>" +
          '<div class="meta">CUPS ' + e.cups + "</div></div>" +
          '<div style="text-align:right;white-space:nowrap">' +
          (tieneDescuento ? '<div class="text-muted" style="font-size:11px;text-decoration:line-through">' + fmtMoneda(precioRegular) + "</div>" : "") +
          '<div style="font-weight:700;font-size:13px;' + (tieneDescuento ? "color:var(--brand-primary)" : "") + '">' + (precio ? fmtMoneda(precio) : '<span class="text-muted">Sin precio</span>') + "</div>" +
          "</div></label>";
      }).join("") || '<p class="text-muted" style="padding:14px">Sin resultados para tu búsqueda.</p>';

      document.querySelectorAll('[data-picker-prefix="' + prefix + '"]').forEach(function (chk) {
        chk.addEventListener("change", function () {
          var id = chk.dataset.pickerExam;
          if (chk.checked) st.selected.push(id); else st.selected = st.selected.filter(function (x) { return x !== id; });
          actualizarPickerTotales(prefix, st); renderPickerSecciones(prefix, st);
        });
      });
    }

    function actualizarPickerTotales(prefix, st) {
      var total = st.selected.reduce(function (a, id) { return a + precioConConvenio(id, st.convenioId); }, 0);
      document.getElementById(prefix + "-count").textContent = st.selected.length;
      document.getElementById(prefix + "-total").innerHTML = fmtMoneda(total) + fmtMonedaExtra(total);
    }

    function examenesSeleccionados(st) {
      return st.selected.map(function (id) {
        var e = resolverExamen(id);
        return { examId: id, nombre: e.nombre, seccion: e.seccion, seccionNombre: resolverSeccionNombre(e.seccion), precio: precioConConvenio(id, st.convenioId) };
      });
    }

    function convenioAplicado(st) {
      if (!st.convenioId) return null;
      var c = convenios.filter(function (x) { return x.id === st.convenioId; })[0];
      return c ? { id: c.id, nombre: c.nombre, tipo: c.tipo } : null;
    }

    // ---------------------------------------------------------------------
    // NUEVA COTIZACIÓN
    // ---------------------------------------------------------------------
    function buildNuevaHtml() {
      return '<div class="form-grid" style="margin-top:14px">' +
        '<div class="field"><label>Nombre del Cliente</label><input id="cot-cliente-nombre"/></div>' +
        '<div class="field"><label>WhatsApp (con indicativo)</label><input id="cot-cliente-wa" placeholder="573001234567"/></div>' +
        '<div class="field"><label>Correo Electrónico</label><input id="cot-cliente-correo" type="email"/></div>' +
        "</div>" +
        pickerHtml("cot") +
        '<button class="btn btn-primary btn-block" id="btn-generar-cot" style="margin-top:14px">' + U.icon("file") + " Generar Cotización</button>";
    }

    function wireNueva() {
      wirePicker("cot", pickerNueva);
      document.getElementById("btn-generar-cot").addEventListener("click", generarCotizacion);
    }

    function generarCotizacion() {
      if (!pickerNueva.selected.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
      var nombre = document.getElementById("cot-cliente-nombre").value.trim();
      var whatsapp = document.getElementById("cot-cliente-wa").value.trim();
      var correo = document.getElementById("cot-cliente-correo").value.trim();
      var tenant = S.getTenant(tenantId);
      var examenes = examenesSeleccionados(pickerNueva);
      var total = examenes.reduce(function (a, e) { return a + e.precio; }, 0);
      var cot = S.cotizador.createCotizacion({
        tenantId: tenantId, cliente: { nombre: nombre, whatsapp: whatsapp, correo: correo }, examenes: examenes, total: total, convenio: convenioAplicado(pickerNueva)
      });
      var bytes = BIO_PDF_COTIZACION.buildCotizacionPDF(cot, tenant);
      var nombreArchivo = "Cotizacion_" + (nombre || "Cliente").replace(/\s+/g, "_") + ".pdf";
      U.downloadBytes(bytes, nombreArchivo);
      var mensaje = "Hola " + (nombre ? nombre.split(" ")[0] : "") + " 👋 Aquí tienes la cotización de " + tenant.nombre + " por " + fmtMoneda(total) + textoMonedaExtra(total) + ". Cualquier duda, quedamos atentos.";
      U.toast("Cotización generada y descargada.", "success");
      var wrap = U.openModal(
        '<h3 class="modal-title">Cotización lista — ' + fmtMoneda(total) + fmtMonedaExtra(total) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Ya se descargó el PDF. Ahora elige por dónde enviarlo.</p>' +
        '<button class="btn btn-whatsapp btn-block" id="cot-send-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" +
        (correo ? U.emailProviderButtonsHtml("cot-mail") : "") +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrap.querySelector("#cot-send-wa").addEventListener("click", function () { window.open(waLinkTo(whatsapp, mensaje), "_blank"); });
      if (correo) U.wireEmailProviderButtons(wrap, "cot-mail", correo, "Cotización de exámenes — " + tenant.nombre, mensaje);

      pickerNueva.selected = []; cargar();
    }

    // ---------------------------------------------------------------------
    // RECIBO DIRECTO — para cuando el cliente ya pagó y necesita su recibo
    // sin haber hecho antes una cotización formal (evita el trámite de
    // cotizar primero cuando ya se sabe qué se le va a cobrar).
    // ---------------------------------------------------------------------
    function buildReciboDirectoHtml() {
      var usuarios = S.listUsers(tenantId).filter(function (u) { return u.activo; });
      var hoy = new Date().toISOString().slice(0, 10);
      return '<p class="text-muted" style="margin-top:14px">Genera y envía el recibo de pago de una vez, cuando el cliente ya pagó y no hace falta una cotización previa.</p>' +
        '<div class="form-grid">' +
        '<div class="field"><label>Nombre del Cliente</label><input id="rec-cliente-nombre"/></div>' +
        '<div class="field"><label>WhatsApp (con indicativo)</label><input id="rec-cliente-wa" placeholder="573001234567"/></div>' +
        '<div class="field"><label>Correo Electrónico</label><input id="rec-cliente-correo" type="email"/></div>' +
        "</div>" +
        pickerHtml("rec") +
        '<fieldset style="margin-top:14px"><legend>Datos del Pago</legend><div class="form-grid">' +
        '<div class="field"><label>Método de Pago</label><select id="rec-metodoPago">' +
        Object.keys(METODO_PAGO_LABEL).map(function (k) { return '<option value="' + k + '">' + METODO_PAGO_LABEL[k] + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Fecha de Pago</label><input type="date" id="rec-fechaPago" value="' + hoy + '"/></div>' +
        '<div class="field"><label>Atendido por (vendedor)</label><select id="rec-vendedor">' +
        (usuarios.length ? usuarios.map(function (u) { return '<option value="' + U.esc(u.nombre) + '" ' + (u.nombre === session.nombre ? "selected" : "") + ">" + U.esc(u.nombre) + "</option>"; }).join("") : '<option value="' + U.esc(session.nombre) + '">' + U.esc(session.nombre) + "</option>") +
        "</select></div>" +
        "</div></fieldset>" +
        '<button class="btn btn-primary btn-block" id="btn-generar-recibo" style="margin-top:14px">' + U.icon("check") + " Generar y Enviar Recibo</button>";
    }

    function wireReciboDirecto() {
      wirePicker("rec", pickerRecibo);
      document.getElementById("btn-generar-recibo").addEventListener("click", generarReciboDirecto);
    }

    function generarReciboDirecto() {
      if (!pickerRecibo.selected.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
      var nombre = document.getElementById("rec-cliente-nombre").value.trim();
      var whatsapp = document.getElementById("rec-cliente-wa").value.trim();
      var correo = document.getElementById("rec-cliente-correo").value.trim();
      var metodoPago = document.getElementById("rec-metodoPago").value;
      var fechaPago = document.getElementById("rec-fechaPago").value || new Date().toISOString().slice(0, 10);
      var vendedorNombre = document.getElementById("rec-vendedor").value;
      var examenes = examenesSeleccionados(pickerRecibo);
      var total = examenes.reduce(function (a, e) { return a + e.precio; }, 0);
      var cot = S.cotizador.createCotizacion({
        tenantId: tenantId, cliente: { nombre: nombre, whatsapp: whatsapp, correo: correo }, examenes: examenes, total: total, convenio: convenioAplicado(pickerRecibo),
        estado: "pagada", pago: { fecha: fechaPago, monto: total, metodoPago: metodoPago, vendedorNombre: vendedorNombre }
      });
      S.addAudit(session.tenantId, session.nombre, session.rol, "REGISTRAR_PAGO_COTIZACION", "cotizacion", cot.id, "Generó un recibo de pago directo para " + (nombre || "un cliente") + " por " + fmtMoneda(total) + " (atendido por " + vendedorNombre + ").");
      pickerRecibo.selected = [];
      cargar();
      abrirEnviarRecibo(cot);
    }

    // ---------------------------------------------------------------------
    // LISTA DE PRECIOS
    // ---------------------------------------------------------------------
    var precioSearchTerm = "";
    var preciosEditados = {};

    var MONEDAS_COMUNES = ["COP", "Bs", "VES", "USD", "EUR"];
    function textoEjemploTasaCambio(monedaBase, moneda) {
      if (!moneda.codigo || !moneda.tasa) return "";
      var ejemploBase = 1000;
      var ejemploEquiv = (ejemploBase / moneda.tasa).toLocaleString("es-CO", { maximumFractionDigits: 2 });
      return "Ejemplo con la tasa de hoy: un examen de " + ejemploBase.toLocaleString("es-CO") + " " + monedaBase + " equivale a ≈ " + ejemploEquiv + " " + moneda.codigo + ".";
    }
    function buildPreciosHtml() {
      var moneda = tenant.monedaAdicional || {};
      var monedaBaseActual = C.monedaBaseLabel(tenant);
      var actualizada = moneda.actualizada ? new Date(moneda.actualizada).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
      return '<p class="text-muted" style="margin-top:14px">Define el precio de cada examen. También puedes descargar una plantilla en Excel, editarla y volver a subirla si son muchos.</p>' +
        '<div class="flex gap-2 wrap" style="margin-bottom:12px">' +
        '<button class="btn btn-outline btn-sm" id="btn-descargar-plantilla">' + U.icon("download") + " Descargar Plantilla Excel</button>" +
        '<label class="btn btn-outline btn-sm" style="cursor:pointer">' + U.icon("plus") + ' Subir Excel de Precios<input type="file" id="input-excel-precios" accept=".xlsx,.xls,.csv" style="display:none"/></label>' +
        "</div>" +
        '<fieldset style="margin-bottom:14px"><legend>Tu moneda y la tasa de cambio del día (para Venezuela / Ecuador)</legend>' +
        '<p class="text-muted" style="margin-top:0;font-size:12.5px">Primero indica en qué moneda tienes cargados tus precios (columna "Precio" de la tabla). Si además quieres que tus clientes vean el equivalente en otra moneda (ej. dólares o bolívares), actívala abajo y actualiza la tasa cada vez que cambie — todos los días, si hace falta. El equivalente aparece junto al precio en esta lista, en cotizaciones, recibos, órdenes e historial, sin reemplazar tu moneda principal.</p>' +
        '<div class="form-grid" style="align-items:end">' +
        '<div class="field"><label>Moneda de tus precios</label><select id="moneda-base">' +
        MONEDAS_COMUNES.map(function (cod) { return '<option value="' + cod + '" ' + (cod === monedaBaseActual ? "selected" : "") + ">" + cod + "</option>"; }).join("") +
        "</select></div>" +
        "</div>" +
        '<div class="form-grid" style="align-items:end;margin-top:10px">' +
        '<div class="field"><label>Moneda adicional a mostrar (opcional)</label><select id="moneda-codigo">' +
        ["", "USD", "EUR", "VES", "Bs", "COP"].map(function (cod) { return '<option value="' + cod + '" ' + (cod === (moneda.codigo || "") ? "selected" : "") + ">" + (cod || "— Ninguna —") + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label id="moneda-tasa-label">Cuántos ' + U.esc(monedaBaseActual) + ' equivalen a 1 de esa moneda, hoy</label><input type="number" step="any" min="0" id="moneda-tasa" value="' + (moneda.tasa || "") + '" placeholder="Ej: 780"/></div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-guardar-moneda">' + U.icon("check") + " Guardar Moneda</button>" +
        "</div>" +
        '<p class="text-muted" id="moneda-ejemplo" style="margin:8px 0 0;font-size:12.5px">' + textoEjemploTasaCambio(monedaBaseActual, moneda) + "</p>" +
        (actualizada ? '<p class="text-muted" id="moneda-actualizada" style="margin:4px 0 0;font-size:12px">Última actualización de la tasa: ' + actualizada + "</p>" : "") +
        "</fieldset>" +
        '<div class="field" style="margin-bottom:12px"><input id="precio-search" placeholder="Buscar examen por nombre o código CUPS…"/></div>' +
        '<div class="table-wrap" style="max-height:480px;overflow-y:auto"><table><thead><tr><th>Examen</th><th>Sección</th><th>CUPS</th><th style="min-width:150px">Precio (' + U.esc(monedaBaseActual) + ')</th></tr></thead><tbody id="precios-tbody"></tbody></table></div>' +
        '<button class="btn btn-primary" id="btn-guardar-precios" style="margin-top:14px">' + U.icon("check") + " Guardar Cambios</button>";
    }

    function renderPreciosTabla() {
      var term = U.normalizar(precioSearchTerm.trim());
      var todos = poolExamenes();
      var pool = term
        ? todos.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : todos;
      document.getElementById("precios-tbody").innerHTML = pool.map(function (e) {
        var valor = preciosEditados.hasOwnProperty(e.id) ? preciosEditados[e.id] : precioDe(e.id);
        return "<tr><td>" + U.esc(e.nombre) + "</td><td>" + resolverSeccionNombre(e.seccion) + "</td><td>" + e.cups + "</td>" +
          "<td><input type='number' step='any' min='0' data-precio-exam='" + e.id + "' value='" + (valor || "") + "' placeholder='0'/>" +
          '<span data-precio-equiv="' + e.id + '" class="text-muted" style="display:block;font-size:11px;margin-top:2px">' + equivalenteMonedaTexto(valor) + "</span></td></tr>";
      }).join("") || '<tr><td colspan="4" class="text-muted">Sin resultados.</td></tr>';
      document.querySelectorAll("[data-precio-exam]").forEach(function (inp) {
        inp.addEventListener("input", function () {
          var precio = parseFloat(inp.value) || 0;
          preciosEditados[inp.dataset.precioExam] = precio;
          var equiv = document.querySelector('[data-precio-equiv="' + inp.dataset.precioExam + '"]');
          if (equiv) equiv.textContent = equivalenteMonedaTexto(precio);
        });
        // Guarda de inmediato al salir del campo (clic afuera o Enter), para
        // que un solo precio quede aplicado al instante sin tener que buscar
        // el botón "Guardar Cambios" al final de una lista larga.
        inp.addEventListener("change", function () {
          var examId = inp.dataset.precioExam;
          var precio = parseFloat(inp.value) || 0;
          S.cotizador.setPrecio(tenantId, examId, precio);
          delete preciosEditados[examId];
          precios[examId] = precio;
          U.toast("Precio guardado.", "success");
        });
      });
    }

    function equivalenteMonedaTexto(valorBase) {
      var extra = C.fmtMonedaAdicional(tenant, valorBase || 0);
      return extra || "";
    }

    function wirePrecios() {
      renderPreciosTabla();
      document.getElementById("precio-search").addEventListener("input", function (e) { precioSearchTerm = e.target.value; renderPreciosTabla(); });
      // Cambiar la moneda base o la moneda adicional actualiza al instante
      // la etiqueta de la tasa y el ejemplo, para que quede claro el sentido
      // del cálculo ANTES de guardar (evita el error típico de configurarla
      // al revés y terminar mostrando un equivalente absurdo).
      function refrescarEtiquetasMoneda() {
        var baseElegida = document.getElementById("moneda-base").value;
        document.getElementById("moneda-tasa-label").textContent = "Cuántos " + baseElegida + " equivalen a 1 de esa moneda, hoy";
        var codigo = document.getElementById("moneda-codigo").value;
        var tasa = parseFloat(document.getElementById("moneda-tasa").value) || 0;
        document.getElementById("moneda-ejemplo").textContent = textoEjemploTasaCambio(baseElegida, { codigo: codigo, tasa: tasa });
      }
      document.getElementById("moneda-base").addEventListener("change", refrescarEtiquetasMoneda);
      document.getElementById("moneda-codigo").addEventListener("change", refrescarEtiquetasMoneda);
      document.getElementById("moneda-tasa").addEventListener("input", refrescarEtiquetasMoneda);
      document.getElementById("btn-guardar-moneda").addEventListener("click", function () {
        var monedaBase = document.getElementById("moneda-base").value;
        var codigo = document.getElementById("moneda-codigo").value;
        var tasa = parseFloat(document.getElementById("moneda-tasa").value) || 0;
        if (codigo && monedaBase === codigo) { U.toast("La moneda adicional no puede ser la misma que la moneda de tus precios.", "error"); return; }
        var monedaAdicional = codigo && tasa > 0 ? { codigo: codigo, tasa: tasa, actualizada: new Date().toISOString() } : null;
        tenant.monedaBase = monedaBase;
        tenant.monedaAdicional = monedaAdicional;
        S.updateTenant(tenantId, { monedaBase: monedaBase, monedaAdicional: monedaAdicional });
        U.toast(monedaAdicional ? "Moneda y tasa de cambio guardadas." : "Moneda guardada.", "success");
        build();
      });
      document.getElementById("btn-guardar-precios").addEventListener("click", function () {
        var pares = Object.keys(preciosEditados).map(function (examId) { return { examId: examId, precio: preciosEditados[examId] }; });
        if (!pares.length) { U.toast("No hay cambios para guardar.", "error"); return; }
        S.cotizador.bulkSetPrecios(tenantId, pares);
        preciosEditados = {};
        U.toast("Precios guardados.", "success");
        cargar();
      });
      document.getElementById("btn-descargar-plantilla").addEventListener("click", descargarPlantillaExcel);
      document.getElementById("input-excel-precios").addEventListener("change", subirExcelPrecios);
    }

    function descargarPlantillaExcel() {
      var filas = C.EXAMENES.map(function (e) {
        return { CUPS: e.cups, Examen: e.nombre, Seccion: C.seccionNombre(e.seccion), Precio: precioDe(e.id) || "" };
      });
      var ws = XLSX.utils.json_to_sheet(filas);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Precios");
      XLSX.writeFile(wb, "Plantilla_Precios_BIOsoft.xlsx");
    }

    // En Colombia un mismo código CUPS suele agrupar varias pruebas
    // específicas distintas, y cada laboratorio (o laboratorio de
    // referencia) le da su propio significado interno. Por eso un CUPS
    // igual entre el catálogo de BIOsoft y el archivo del cliente NO
    // garantiza que sea el mismo examen — hay que comparar también el
    // nombre antes de aplicar el precio a ciegas.
    var PALABRAS_VACIAS = ["de", "del", "la", "el", "los", "las", "en", "y", "a", "con", "por", "al", "para", "sin", "con"];
    function palabrasSignificativas(nombre) {
      return U.normalizar(nombre).toUpperCase().split(/[^A-Z0-9]+/).filter(function (w) {
        return w.length > 2 && PALABRAS_VACIAS.indexOf(w.toLowerCase()) === -1;
      });
    }
    function pareceMismoExamen(nombreCatalogo, nombreArchivo) {
      var wa = palabrasSignificativas(nombreCatalogo);
      var wb = palabrasSignificativas(nombreArchivo);
      return wa.some(function (w) { return wb.indexOf(w) !== -1; });
    }

    function subirExcelPrecios(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          var examenPorCups = {};
          C.EXAMENES.forEach(function (ex) { examenPorCups[ex.cups] = ex; });
          var matchesPorExamId = {}; // dedupe: el mismo CUPS puede repetirse en varias hojas
          var personalizadosPorCups = {};
          var filasConCupsYPrecio = 0;
          var seEncontroEncabezado = false;

          wb.SheetNames.forEach(function (nombreHoja) {
            var filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header: 1, defval: "" });
            var encabezado = ubicarEncabezado(filas);
            if (!encabezado) return;
            seEncontroEncabezado = true;
            for (var i = encabezado.fila + 1; i < filas.length; i++) {
              var fila = filas[i];
              var cups = normalizarCups(fila[encabezado.colCups]);
              var celdaPrecio = fila[encabezado.colPrecio];
              var precio = typeof celdaPrecio === "number" ? celdaPrecio : parseFloat(String(celdaPrecio).replace(/[^0-9,.\-]/g, "").replace(/\./g, "").replace(",", "."));
              if (!cups || isNaN(precio)) continue;
              filasConCupsYPrecio++;
              var nombreArchivo = encabezado.colNombre !== -1 ? String(fila[encabezado.colNombre] || "").trim() : "";
              var exam = examenPorCups[cups];
              // Toda fila con nombre entra a la lista personalizada del
              // laboratorio TAL CUAL viene en su archivo (sea que su CUPS
              // también exista en el catálogo global o no) — así su lista
              // de exámenes queda completa y con SU propio nombre, sin
              // depender de que el catálogo de BIOsoft use ese mismo nombre
              // para ese código.
              if (nombreArchivo) personalizadosPorCups[cups] = { cups: cups, nombre: nombreArchivo, precio: precio };
              // Si el CUPS también coincide con un examen del catálogo
              // global, se ofrece por separado (con revisión) actualizar
              // también el precio de ESE examen del catálogo.
              if (exam) {
                matchesPorExamId[exam.id] = {
                  examId: exam.id, cups: cups, nombreCatalogo: exam.nombre, nombreArchivo: nombreArchivo, precio: precio,
                  confiable: !nombreArchivo || pareceMismoExamen(exam.nombre, nombreArchivo)
                };
              }
            }
          });

          var matches = Object.keys(matchesPorExamId).map(function (k) { return matchesPorExamId[k]; });
          var personalizados = Object.keys(personalizadosPorCups).map(function (k) { return personalizadosPorCups[k]; });

          if (!matches.length && !personalizados.length) {
            var msg = !seEncontroEncabezado
              ? "No encontramos columnas de CUPS y Precio/Tarifa en el archivo. Verifica que tenga encabezados como \"CUPS\" y \"Tarifa\" o \"Precio\"."
              : "Encontramos " + filasConCupsYPrecio + " fila(s) con CUPS y precio, pero ninguno coincide con los códigos de exámenes de tu catálogo.";
            U.toast(msg, "error");
            return;
          }

          if (personalizados.length) S.cotizador.bulkUpsertExamenesPersonalizados(tenantId, personalizados);

          if (!matches.length) {
            U.toast(personalizados.length + " examen(es) de referencia agregados a tu lista personalizada.", "success");
            cargar();
            return;
          }
          abrirConfirmarPreciosCatalogo(matches, personalizados.length);
        } catch (err) {
          U.toast("No se pudo leer el archivo: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }

    // Antes de sobrescribir el precio de un examen de TU catálogo (a
    // diferencia de los personalizados, que siempre son nuevos y sin riesgo
    // de choque), mostramos una revisión: si el nombre del archivo no se
    // parece al del catálogo, lo dejamos SIN marcar para que el usuario
    // decida — evita que un CUPS reciclado le cambie el precio a un examen
    // que en realidad es otro completamente distinto.
    function abrirConfirmarPreciosCatalogo(matches, totalPersonalizados) {
      matches.sort(function (a, b) { return (a.confiable === b.confiable) ? 0 : a.confiable ? 1 : -1; });
      var dudosos = matches.filter(function (m) { return !m.confiable; }).length;
      var wrap = U.openModal(
        '<h3 class="modal-title">Confirmar precios de tu catálogo (' + matches.length + ')</h3>' +
        '<p class="text-muted" style="margin-top:0">Un mismo código CUPS a veces corresponde a exámenes distintos entre tu catálogo y el archivo. Revisa especialmente las filas en rojo (el nombre del archivo no se parece al de tu catálogo) antes de aplicar el precio.' +
        (dudosos ? " Encontramos <b>" + dudosos + " caso(s)</b> así, ya vienen sin marcar." : "") + "</p>" +
        '<div class="flex gap-2" style="margin-bottom:8px"><button type="button" class="btn btn-ghost btn-sm" id="conf-marcar-todos">Marcar todos</button><button type="button" class="btn btn-ghost btn-sm" id="conf-desmarcar-todos">Desmarcar todos</button></div>' +
        '<div class="table-wrap" style="max-height:400px;overflow-y:auto"><table><thead><tr><th></th><th>CUPS</th><th>Tu catálogo</th><th>El archivo dice</th><th>Precio</th></tr></thead><tbody>' +
        matches.map(function (m) {
          return "<tr" + (m.confiable ? "" : " style='background:#fee2e2'") + ">" +
            "<td><input type='checkbox' data-conf-match='" + m.examId + "' " + (m.confiable ? "checked" : "") + "/></td>" +
            "<td>" + U.esc(m.cups) + "</td><td>" + U.esc(m.nombreCatalogo) + "</td><td>" + U.esc(m.nombreArchivo || "—") + "</td><td>" + fmtMoneda(m.precio) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="conf-aplicar">' + U.icon("check") + " Aplicar precios marcados</button></div>"
      );
      wrap.querySelector("#conf-marcar-todos").addEventListener("click", function () {
        wrap.querySelectorAll("[data-conf-match]").forEach(function (c) { c.checked = true; });
      });
      wrap.querySelector("#conf-desmarcar-todos").addEventListener("click", function () {
        wrap.querySelectorAll("[data-conf-match]").forEach(function (c) { c.checked = false; });
      });
      wrap.querySelector("#conf-aplicar").addEventListener("click", function () {
        var idsMarcados = Array.prototype.slice.call(wrap.querySelectorAll("[data-conf-match]:checked")).map(function (c) { return c.dataset.confMatch; });
        var pares = matches.filter(function (m) { return idsMarcados.indexOf(m.examId) !== -1; }).map(function (m) { return { examId: m.examId, precio: m.precio }; });
        if (pares.length) S.cotizador.bulkSetPrecios(tenantId, pares);
        var partes = [];
        if (pares.length) partes.push(pares.length + " precio(s) de tu catálogo actualizados");
        if (totalPersonalizados) partes.push(totalPersonalizados + " examen(es) de referencia agregados a tu lista personalizada");
        U.toast((partes.join(" y ") || "Nada quedó marcado para aplicar") + ".", pares.length || totalPersonalizados ? "success" : "error");
        U.closeModal(wrap);
        cargar();
      });
    }

    // Los archivos de tarifas de laboratorios de referencia suelen traer
    // filas de título/sección antes del encabezado real, y a veces varias
    // columnas de tarifa (histórica, del año, la propia del laboratorio…).
    // Por eso buscamos la fila de encabezado en cualquiera de las primeras
    // filas de cada hoja, y si hay más de una columna de precio nos quedamos
    // con la última (la más específica, normalmente la tarifa propia del
    // laboratorio va al final).
    function ubicarEncabezado(filas) {
      var maxFilasABuscar = Math.min(filas.length, 15);
      for (var f = 0; f < maxFilasABuscar; f++) {
        var fila = filas[f] || [];
        var colCups = -1, colPrecio = -1, colNombre = -1;
        for (var c = 0; c < fila.length; c++) {
          var t = String(fila[c] || "").toLowerCase();
          if (colCups === -1 && t.indexOf("cups") !== -1) colCups = c;
          if (t.indexOf("tarifa") !== -1 || t.indexOf("precio") !== -1 || t.indexOf("valor") !== -1) colPrecio = c;
          if (colNombre === -1 && t.indexOf("nombre") !== -1) colNombre = c;
        }
        if (colCups !== -1 && colPrecio !== -1) return { fila: f, colCups: colCups, colPrecio: colPrecio, colNombre: colNombre };
      }
      return null;
    }

    function normalizarCups(v) {
      var s = String(v == null ? "" : v).trim();
      if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
      return /^\d+$/.test(s) ? s : "";
    }

    // ---------------------------------------------------------------------
    // CONVENIOS — precios especiales para laboratorios de referencia,
    // laboratorios de contrarreferencia o clientes institucionales.
    // ---------------------------------------------------------------------
    function buildConveniosHtml() {
      return '<p class="text-muted" style="margin-top:14px">Crea un convenio para cada laboratorio de referencia, laboratorio de contrarreferencia o cliente institucional con precios especiales. Puedes definir un descuento general (aplica a todos los exámenes) y/o precios especiales puntuales por examen — el precio puntual siempre tiene prioridad sobre el descuento general.</p>' +
        '<button type="button" class="btn btn-primary btn-sm" id="btn-nuevo-convenio">' + U.icon("plus") + " Nuevo Convenio</button>" +
        '<div id="convenios-grid" class="flex wrap gap-2" style="margin-top:14px;align-items:stretch">' +
        (convenios.length ? convenios.map(convenioCardHtml).join("") : '<p class="text-muted">Aún no has creado ningún convenio.</p>') +
        "</div>";
    }

    function convenioCardHtml(c) {
      var numEspeciales = Object.keys(convenioPreciosPorConvenio[c.id] || {}).length;
      return '<div class="card" style="width:300px' + (c.activo ? "" : ";opacity:.55") + '">' +
        '<div class="flex justify-between items-start"><div><h4 style="margin:0 0 2px">' + U.esc(c.nombre) + "</h4>" +
        '<span class="badge" style="font-size:11px">' + U.esc(c.tipo) + "</span></div>" +
        (c.activo ? '<span class="badge badge-validado">Activo</span>' : '<span class="badge badge-pendiente">Inactivo</span>') +
        "</div>" +
        '<p style="margin:10px 0 4px;font-size:13px">Descuento general: <b>' + (c.descuentoGeneral || 0) + "%</b></p>" +
        '<p style="margin:0 0 12px;font-size:13px">Precios especiales por examen: <b>' + numEspeciales + "</b></p>" +
        '<div class="flex gap-2 wrap">' +
        '<button type="button" class="btn btn-outline btn-sm" data-precios-especiales="' + c.id + '">💲 Precios Especiales</button>' +
        '<label class="btn btn-outline btn-sm" style="cursor:pointer">📥 Excel de Precios<input type="file" data-excel-convenio="' + c.id + '" accept=".xlsx,.xls,.csv" style="display:none"/></label>' +
        '<button type="button" class="btn btn-outline btn-sm" data-hoja-trabajo-convenio="' + c.id + '">📋 Hoja de Trabajo</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-crear-aliado="' + c.id + '">🔑 Acceso de Aliado</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-editar-convenio="' + c.id + '">' + U.icon("edit") + " Editar</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-eliminar-convenio="' + c.id + '">' + U.icon("trash") + " Eliminar</button>" +
        "</div></div>";
    }

    function wireConvenios() {
      document.getElementById("btn-nuevo-convenio").addEventListener("click", function () { abrirFormConvenio(null); });
      document.querySelectorAll("[data-precios-especiales]").forEach(function (b) {
        b.addEventListener("click", function () { abrirPreciosEspeciales(convenios.filter(function (c) { return c.id === b.dataset.preciosEspeciales; })[0]); });
      });
      document.querySelectorAll("[data-editar-convenio]").forEach(function (b) {
        b.addEventListener("click", function () { abrirFormConvenio(convenios.filter(function (c) { return c.id === b.dataset.editarConvenio; })[0]); });
      });
      document.querySelectorAll("[data-eliminar-convenio]").forEach(function (b) {
        b.addEventListener("click", function () {
          var c = convenios.filter(function (x) { return x.id === b.dataset.eliminarConvenio; })[0];
          if (!confirm('¿Eliminar el convenio "' + c.nombre + '"? También se borran sus precios especiales.')) return;
          S.cotizador.eliminarConvenio(tenantId, c.id);
          U.toast("Convenio eliminado.", "success");
          cargar();
        });
      });
      document.querySelectorAll("[data-excel-convenio]").forEach(function (inp) {
        inp.addEventListener("change", function (e) {
          var convenio = convenios.filter(function (c) { return c.id === inp.dataset.excelConvenio; })[0];
          subirExcelPrecioConvenio(convenio, e.target.files[0]);
          e.target.value = "";
        });
      });
      document.querySelectorAll("[data-hoja-trabajo-convenio]").forEach(function (b) {
        b.addEventListener("click", function () { abrirHojaTrabajoConvenio(convenios.filter(function (c) { return c.id === b.dataset.hojaTrabajoConvenio; })[0]); });
      });
      document.querySelectorAll("[data-crear-aliado]").forEach(function (b) {
        b.addEventListener("click", function () {
          var c = convenios.filter(function (x) { return x.id === b.dataset.crearAliado; })[0];
          try { sessionStorage.setItem("bio_prefill_aliado_convenio", c.id); } catch (err) {}
          U.toast("Ahora crea el usuario: rol \"Aliado / Convenio\", ya queda con " + c.nombre + " preseleccionado.", "success");
          location.hash = "#/usuarios";
        });
      });
    }

    function abrirFormConvenio(convenio) {
      var isEdit = !!convenio;
      convenio = convenio || { nombre: "", tipo: TIPOS_CONVENIO[0], descuentoGeneral: 0, activo: true };
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Convenio" : "Nuevo Convenio") + '</h3>' +
        '<form id="convenio-form"><div class="form-grid">' +
        '<div class="field"><label>Nombre del Convenio</label><input id="f_cnv_nombre" value="' + U.esc(convenio.nombre) + '" placeholder="Ej. Laboratorio ABC Referencia" required/></div>' +
        '<div class="field"><label>Tipo</label><select id="f_cnv_tipo">' +
        TIPOS_CONVENIO.map(function (t) { return '<option ' + (t === convenio.tipo ? "selected" : "") + ">" + t + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Descuento General (%)</label><input type="number" step="any" min="0" max="100" id="f_cnv_descuento" value="' + (convenio.descuentoGeneral || 0) + '"/></div>' +
        '<div class="field"><label>Estado</label><select id="f_cnv_activo"><option value="1" ' + (convenio.activo ? "selected" : "") + '>Activo</option><option value="0" ' + (!convenio.activo ? "selected" : "") + ">Inactivo</option></select></div>" +
        "</div>" +
        '<p class="text-muted" style="font-size:12.5px;margin:0 0 6px">El descuento general se aplica a TODOS los exámenes de este convenio, salvo que definas un precio especial puntual para alguno (desde "💲 Precios Especiales", después de guardar).</p>' +
        '<div class="flex gap-2 justify-between" style="margin-top:6px">' +
        '<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Convenio</button>" +
        "</div></form>"
      );
      wrap.querySelector("#convenio-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {
          tenantId: tenantId,
          nombre: wrap.querySelector("#f_cnv_nombre").value.trim(),
          tipo: wrap.querySelector("#f_cnv_tipo").value,
          descuentoGeneral: parseFloat(wrap.querySelector("#f_cnv_descuento").value) || 0,
          activo: wrap.querySelector("#f_cnv_activo").value === "1"
        };
        if (!data.nombre) { U.toast("Escribe el nombre del convenio.", "error"); return; }
        if (isEdit) {
          S.cotizador.updateConvenio(convenio.id, data);
          S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_CONVENIO", "convenio", convenio.id, "Actualizó el convenio " + data.nombre + ".");
        } else {
          var creado = S.cotizador.createConvenio(data);
          S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_CONVENIO", "convenio", creado.id, "Creó el convenio " + data.nombre + " (" + data.tipo + ").");
        }
        U.toast("Convenio guardado.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    var preciosEspecialesSearchTerm = "";
    function abrirPreciosEspeciales(convenio) {
      var wrap = U.openModal(
        '<h3 class="modal-title">💲 Precios Especiales — ' + U.esc(convenio.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Define un precio fijo o un % de descuento puntual para exámenes específicos de este convenio. Los exámenes sin precio especial usan el descuento general (' + (convenio.descuentoGeneral || 0) + '%) o el precio regular.</p>' +
        '<div class="field" style="margin-bottom:10px"><input id="pe-search" placeholder="Buscar examen por nombre o código CUPS…"/></div>' +
        '<div class="table-wrap" style="max-height:440px;overflow-y:auto"><table><thead><tr><th>Examen</th><th>Precio Base</th><th>Tipo</th><th style="min-width:120px">Valor</th><th></th></tr></thead><tbody id="pe-tbody"></tbody></table></div>' +
        '<div class="flex justify-between" style="margin-top:16px"><button type="button" class="btn btn-ghost" data-modal-close>Cerrar</button><span></span></div>',
        { lg: true }
      );
      preciosEspecialesSearchTerm = "";

      function renderTabla() {
        var term = U.normalizar(preciosEspecialesSearchTerm.trim());
        var todos = poolExamenes();
        var pool = term
          ? todos.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
          : todos.filter(function (e) { return (convenioPreciosPorConvenio[convenio.id] || {})[e.id]; }); // sin buscar: solo muestra los que ya tienen especial, para no listar cientos de exámenes de una

        if (!term && !pool.length) {
          wrap.querySelector("#pe-tbody").innerHTML = '<tr><td colspan="5" class="text-muted">Aún no tienes precios especiales para este convenio. Busca un examen arriba para agregarle uno.</td></tr>';
          return;
        }

        wrap.querySelector("#pe-tbody").innerHTML = pool.map(function (e) {
          var especial = (convenioPreciosPorConvenio[convenio.id] || {})[e.id];
          return "<tr>" +
            "<td>" + U.esc(e.nombre) + '<div class="text-muted" style="font-size:11px">CUPS ' + e.cups + "</div></td>" +
            "<td>" + fmtMoneda(precioDe(e.id)) + "</td>" +
            '<td><select data-pe-modo="' + e.id + '"><option value="" ' + (!especial ? "selected" : "") + '>— Sin especial —</option><option value="descuento" ' + (especial && especial.modo === "descuento" ? "selected" : "") + '>% Descuento</option><option value="fijo" ' + (especial && especial.modo === "fijo" ? "selected" : "") + ">Precio Fijo</option></select></td>" +
            '<td><input type="number" step="any" min="0" data-pe-valor="' + e.id + '" value="' + (especial ? especial.valor : "") + '" ' + (!especial ? 'style="display:none"' : "") + '/></td>' +
            '<td><button type="button" class="btn btn-primary btn-sm" data-pe-guardar="' + e.id + '">' + U.icon("check") + "</button></td>" +
            "</tr>";
        }).join("");

        wrap.querySelectorAll("[data-pe-modo]").forEach(function (sel) {
          sel.addEventListener("change", function () {
            var input = wrap.querySelector('[data-pe-valor="' + sel.dataset.peModo + '"]');
            input.style.display = sel.value ? "" : "none";
          });
        });
        wrap.querySelectorAll("[data-pe-guardar]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var examId = btn.dataset.peGuardar;
            var modo = wrap.querySelector('[data-pe-modo="' + examId + '"]').value;
            var valor = parseFloat(wrap.querySelector('[data-pe-valor="' + examId + '"]').value) || 0;
            if (!modo) {
              S.cotizador.quitarConvenioPrecio(tenantId, convenio.id, examId);
              delete convenioPreciosPorConvenio[convenio.id][examId];
              U.toast("Precio especial quitado.", "success");
            } else {
              S.cotizador.setConvenioPrecio(tenantId, convenio.id, examId, modo, valor);
              convenioPreciosPorConvenio[convenio.id] = convenioPreciosPorConvenio[convenio.id] || {};
              convenioPreciosPorConvenio[convenio.id][examId] = { modo: modo, valor: valor };
              U.toast("Precio especial guardado.", "success");
            }
            renderTabla();
          });
        });
      }

      wrap.querySelector("#pe-search").addEventListener("input", function (e) { preciosEspecialesSearchTerm = e.target.value; renderTabla(); });
      renderTabla();
      wrap.querySelectorAll("[data-modal-close]").forEach(function (b) { b.addEventListener("click", function () { U.closeModal(wrap); cargar(); }); });
    }

    // Sube un Excel con el listado de tarifas que te pasó una empresa/
    // convenio aliado y aplica esos precios como precios especiales FIJOS de
    // ese convenio — reutiliza el mismo detector de encabezado (columnas
    // CUPS + Tarifa/Precio/Valor) de la plantilla de precios regular, pero
    // solo contra los exámenes que YA existen en tu catálogo (un convenio no
    // agrega exámenes nuevos, solo les pone un precio especial).
    function subirExcelPrecioConvenio(convenio, file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          var examenPorCups = {};
          poolExamenes().forEach(function (ex) { examenPorCups[ex.cups] = ex; });
          var matchesPorExamId = {};
          var seEncontroEncabezado = false, filasConCupsYPrecio = 0;

          wb.SheetNames.forEach(function (nombreHoja) {
            var filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header: 1, defval: "" });
            var encabezado = ubicarEncabezado(filas);
            if (!encabezado) return;
            seEncontroEncabezado = true;
            for (var i = encabezado.fila + 1; i < filas.length; i++) {
              var fila = filas[i];
              var cups = normalizarCups(fila[encabezado.colCups]);
              var celdaPrecio = fila[encabezado.colPrecio];
              var precio = typeof celdaPrecio === "number" ? celdaPrecio : parseFloat(String(celdaPrecio).replace(/[^0-9,.\-]/g, "").replace(/\./g, "").replace(",", "."));
              if (!cups || isNaN(precio)) continue;
              filasConCupsYPrecio++;
              var nombreArchivo = encabezado.colNombre !== -1 ? String(fila[encabezado.colNombre] || "").trim() : "";
              var exam = examenPorCups[cups];
              if (exam) {
                matchesPorExamId[exam.id] = {
                  examId: exam.id, cups: cups, nombreCatalogo: exam.nombre, nombreArchivo: nombreArchivo, precio: precio,
                  confiable: !nombreArchivo || pareceMismoExamen(exam.nombre, nombreArchivo)
                };
              }
            }
          });

          var matches = Object.keys(matchesPorExamId).map(function (k) { return matchesPorExamId[k]; });
          if (!matches.length) {
            var msg = !seEncontroEncabezado
              ? "No encontramos columnas de CUPS y Tarifa/Precio en el archivo. Verifica que tenga encabezados como \"CUPS\" y \"Tarifa\" o \"Precio\"."
              : "Encontramos " + filasConCupsYPrecio + " fila(s) con CUPS y precio, pero ninguno coincide con exámenes de tu catálogo.";
            U.toast(msg, "error");
            return;
          }
          abrirConfirmarPreciosConvenio(convenio, matches);
        } catch (err) {
          U.toast("No se pudo leer el archivo: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function abrirConfirmarPreciosConvenio(convenio, matches) {
      matches.sort(function (a, b) { return (a.confiable === b.confiable) ? 0 : a.confiable ? 1 : -1; });
      var dudosos = matches.filter(function (m) { return !m.confiable; }).length;
      var wrap = U.openModal(
        '<h3 class="modal-title">Confirmar precios de "' + U.esc(convenio.nombre) + '" (' + matches.length + ')</h3>' +
        '<p class="text-muted" style="margin-top:0">Revisa especialmente las filas en rojo (el nombre del archivo no se parece al de tu catálogo) antes de aplicarlas como precio especial fijo de este convenio.' +
        (dudosos ? " Encontramos <b>" + dudosos + " caso(s)</b> así, ya vienen sin marcar." : "") + "</p>" +
        '<div class="flex gap-2" style="margin-bottom:8px"><button type="button" class="btn btn-ghost btn-sm" id="cnvexc-marcar-todos">Marcar todos</button><button type="button" class="btn btn-ghost btn-sm" id="cnvexc-desmarcar-todos">Desmarcar todos</button></div>' +
        '<div class="table-wrap" style="max-height:400px;overflow-y:auto"><table><thead><tr><th></th><th>CUPS</th><th>Tu catálogo</th><th>El archivo dice</th><th>Precio</th></tr></thead><tbody>' +
        matches.map(function (m) {
          return "<tr" + (m.confiable ? "" : " style='background:#fee2e2'") + ">" +
            "<td><input type='checkbox' data-cnvexc-match='" + m.examId + "' " + (m.confiable ? "checked" : "") + "/></td>" +
            "<td>" + U.esc(m.cups) + "</td><td>" + U.esc(m.nombreCatalogo) + "</td><td>" + U.esc(m.nombreArchivo || "—") + "</td><td>" + fmtMoneda(m.precio) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="cnvexc-aplicar">' + U.icon("check") + " Aplicar como precios especiales</button></div>"
      );
      wrap.querySelector("#cnvexc-marcar-todos").addEventListener("click", function () {
        wrap.querySelectorAll("[data-cnvexc-match]").forEach(function (c) { c.checked = true; });
      });
      wrap.querySelector("#cnvexc-desmarcar-todos").addEventListener("click", function () {
        wrap.querySelectorAll("[data-cnvexc-match]").forEach(function (c) { c.checked = false; });
      });
      wrap.querySelector("#cnvexc-aplicar").addEventListener("click", function () {
        var idsMarcados = Array.prototype.slice.call(wrap.querySelectorAll("[data-cnvexc-match]:checked")).map(function (c) { return c.dataset.cnvexcMatch; });
        var aplicados = matches.filter(function (m) { return idsMarcados.indexOf(m.examId) !== -1; });
        aplicados.forEach(function (m) { S.cotizador.setConvenioPrecio(tenantId, convenio.id, m.examId, "fijo", m.precio); });
        U.toast((aplicados.length ? aplicados.length + " precio(s) especial(es) aplicados" : "Nada quedó marcado para aplicar") + ".", aplicados.length ? "success" : "error");
        U.closeModal(wrap);
        cargar();
      });
    }

    // "Hoja de Trabajo" / reporte de un convenio: todos los exámenes de
    // órdenes ligadas a ese convenio en un rango de fechas, para que el
    // laboratorio pueda revisar o descargar (Excel) lo que le corresponde
    // facturar/reportar a esa empresa aliada.
    function abrirHojaTrabajoConvenio(convenio) {
      var hoy = new Date().toISOString().slice(0, 10);
      var hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      var wrap = U.openModal(
        '<h3 class="modal-title">📋 Hoja de Trabajo — ' + U.esc(convenio.nombre) + '</h3>' +
        '<div class="form-grid">' +
        '<div class="field"><label>Desde</label><input type="date" id="hwc-desde" value="' + hace30 + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="hwc-hasta" value="' + hoy + '"/></div>' +
        "</div>" +
        '<div class="table-wrap" style="max-height:420px;overflow-y:auto;margin-top:10px"><table><thead><tr><th>N° Orden</th><th>Fecha</th><th>Paciente</th><th>Examen</th><th>Estado</th></tr></thead><tbody id="hwc-tbody"></tbody></table></div>' +
        '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cerrar</button><button type="button" class="btn btn-outline" id="hwc-descargar">' + U.icon("download") + " Descargar Excel</button></div>",
        { lg: true }
      );
      var filas = [];
      function itemsEnRango() {
        var desde = wrap.querySelector("#hwc-desde").value, hasta = wrap.querySelector("#hwc-hasta").value;
        var orders = S.listOrders(tenantId).filter(function (o) { return o.convenioId === convenio.id && o.fechaOrden.slice(0, 10) >= desde && o.fechaOrden.slice(0, 10) <= hasta; });
        var out = [];
        orders.forEach(function (o) {
          o.examenes.forEach(function (ex) {
            var exCat = C.examenEfectivo(ex.examId, tenant);
            out.push({
              numeroOrden: o.numeroOrden, fecha: U.fmtFechaCorta(o.fechaOrden), paciente: o.pacienteSnap ? [o.pacienteSnap.primerNombre, o.pacienteSnap.primerApellido].filter(Boolean).join(" ") : "—",
              examen: exCat ? exCat.nombre : ex.examId, estado: ex.estado
            });
          });
        });
        return out;
      }
      function renderTabla() {
        filas = itemsEnRango();
        wrap.querySelector("#hwc-tbody").innerHTML = filas.length ? filas.map(function (f) {
          return "<tr><td>" + U.esc(f.numeroOrden) + "</td><td>" + U.esc(f.fecha) + "</td><td>" + U.esc(f.paciente) + "</td><td>" + U.esc(f.examen) + "</td><td>" + window.BIO_badgeEstado(f.estado === "en_proceso" ? "pendiente" : f.estado) + "</td></tr>";
        }).join("") : '<tr><td colspan="5" class="text-muted">No hay exámenes de este convenio en el rango elegido.</td></tr>';
      }
      wrap.querySelector("#hwc-desde").addEventListener("change", renderTabla);
      wrap.querySelector("#hwc-hasta").addEventListener("change", renderTabla);
      wrap.querySelector("#hwc-descargar").addEventListener("click", function () {
        if (!filas.length) { U.toast("No hay datos para descargar.", "error"); return; }
        var ws = XLSX.utils.json_to_sheet(filas.map(function (f) { return { "N° Orden": f.numeroOrden, Fecha: f.fecha, Paciente: f.paciente, Examen: f.examen, Estado: f.estado }; }));
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hoja de Trabajo");
        XLSX.writeFile(wb, "Hoja_Trabajo_" + convenio.nombre.replace(/[^a-z0-9]+/gi, "_") + ".xlsx");
      });
      renderTabla();
      wrap.querySelectorAll("[data-modal-close]").forEach(function (b) { b.addEventListener("click", function () { U.closeModal(wrap); }); });
    }

    // ---------------------------------------------------------------------
    // LABORATORIO DE REFERENCIA — precio de compra (lo que cobra el
    // laboratorio de referencia, ej. IDIME) y precio de venta (lo que este
    // laboratorio le cobra a su paciente) de cada examen que se remite,
    // para ver la ganancia de un vistazo. Es un catálogo independiente del
    // catálogo interno de exámenes — se sube por Excel porque suele traer
    // cientos o miles de exámenes muy especializados (patología, genética)
    // que el laboratorio nunca ofrece por sí mismo.
    // ---------------------------------------------------------------------
    function fmtGanancia(compra, venta) {
      var g = (venta || 0) - (compra || 0);
      var color = g > 0 ? "#16a34a" : g < 0 ? "#dc2626" : "#6b7280";
      return '<b style="color:' + color + '">' + (g >= 0 ? "+" : "") + fmtMoneda(g) + "</b>";
    }
    function buildLabReferenciaHtml() {
      var nombreLab = (tenant.laboratorioReferenciaNombre || "").trim();
      return '<p class="text-muted" style="margin-top:14px">Precio de compra al laboratorio de referencia y precio de venta a tu paciente de cada examen que remites — para ver tu ganancia en cada uno, de un vistazo. Sube el listado de tarifas de compra por Excel (código, examen y tarifa) y define aquí a cuánto lo vendes tú.</p>' +
        '<div class="form-grid" style="align-items:end;margin-bottom:10px">' +
        '<div class="field"><label>Nombre del Laboratorio de Referencia</label><input id="ref-nombre-lab" value="' + U.esc(nombreLab) + '" placeholder="Ej. IDIME"/></div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-guardar-nombre-lab" style="height:38px">' + U.icon("check") + " Guardar Nombre</button>" +
        "</div>" +
        '<div class="flex gap-2 wrap" style="margin-bottom:12px">' +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-descargar-plantilla-ref">' + U.icon("download") + " Descargar Plantilla Excel</button>" +
        '<label class="btn btn-outline btn-sm" style="cursor:pointer">' + U.icon("plus") + ' Subir Excel de Tarifas de Compra<input type="file" id="input-excel-ref" accept=".xlsx,.xls,.csv" style="display:none"/></label>' +
        "</div>" +
        (examenesReferencia.length
          ? '<div class="field" style="margin-bottom:12px"><input id="ref-search" placeholder="Buscar por nombre, código o CUPS entre ' + examenesReferencia.length + ' exámenes…" value="' + U.esc(refSearchTerm) + '"/></div>' +
            '<div class="table-wrap" style="max-height:520px;overflow-y:auto"><table><thead><tr><th>Examen</th><th>Código</th><th>Compra</th><th style="min-width:130px">Venta</th><th>Ganancia</th></tr></thead><tbody id="ref-tbody"></tbody></table></div>'
          : '<p class="text-muted">Aún no has cargado tarifas de tu laboratorio de referencia. Descarga la plantilla, complétala con el código, el examen y la tarifa de compra, y súbela aquí para empezar a ver tu margen en cada examen que remites.</p>')
        ;
    }
    function renderTablaLabReferencia() {
      var tbody = document.getElementById("ref-tbody");
      if (!tbody) return;
      var term = U.normalizar(refSearchTerm.trim());
      var pool = term
        ? examenesReferencia.filter(function (e) {
            return U.normalizar(e.nombre).indexOf(term) !== -1 || U.normalizar(e.codigoRef || "").indexOf(term) !== -1 || (e.cups || "").indexOf(term) !== -1;
          })
        : examenesReferencia.filter(function (e) { return e.precioVenta > 0; }); // sin buscar: solo los ya cotizados, para no listar miles de una
      tbody.innerHTML = pool.length ? pool.map(function (e) {
        return "<tr data-ref-row='" + e.id + "' style='cursor:pointer'><td>" + U.esc(e.nombre) + '<div class="text-muted" style="font-size:11px">' + U.esc(e.codigoRef || "") + (e.cups ? " · CUPS " + U.esc(e.cups) : "") + "</div></td>" +
          "<td>" + U.esc(e.codigoRef || "—") + "</td>" +
          "<td>" + fmtMoneda(e.precioCompra) + "</td>" +
          "<td><input type='number' step='any' min='0' data-ref-venta='" + e.id + "' value='" + (e.precioVenta || "") + "' placeholder='0' onclick='event.stopPropagation()'/></td>" +
          "<td data-ref-ganancia='" + e.id + "'>" + fmtGanancia(e.precioCompra, e.precioVenta) + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="text-muted">' + (term ? "Sin resultados para tu búsqueda." : "Aún no le has puesto precio de venta a ningún examen — búscalo arriba para empezar.") + "</td></tr>";

      tbody.querySelectorAll("[data-ref-venta]").forEach(function (inp) {
        inp.addEventListener("change", function () {
          var id = inp.dataset.refVenta;
          var venta = parseFloat(inp.value) || 0;
          S.cotizador.setPrecioVentaReferencia(tenantId, id, venta);
          var e = examenesReferencia.filter(function (x) { return x.id === id; })[0];
          if (e) e.precioVenta = venta;
          var celdaGanancia = tbody.querySelector('[data-ref-ganancia="' + id + '"]');
          if (celdaGanancia) celdaGanancia.innerHTML = fmtGanancia(e ? e.precioCompra : 0, venta);
          U.toast("Precio de venta guardado.", "success");
        });
      });
      tbody.querySelectorAll("[data-ref-row]").forEach(function (tr) {
        tr.addEventListener("click", function () {
          abrirDetalleExamenReferencia(examenesReferencia.filter(function (e) { return e.id === tr.dataset.refRow; })[0]);
        });
      });
    }
    function abrirDetalleExamenReferencia(examen) {
      if (!examen) return;
      var wrap = U.openModal(
        '<h3 class="modal-title">' + U.esc(examen.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">' + U.esc(examen.laboratorioReferencia || "Laboratorio de referencia") + " · Código " + U.esc(examen.codigoRef || "—") + (examen.cups ? " · CUPS " + U.esc(examen.cups) : "") + "</p>" +
        '<div class="form-grid">' +
        '<div class="field"><label>Precio de Compra (' + U.esc(examen.laboratorioReferencia || "laboratorio de referencia") + ')</label><input value="' + fmtMoneda(examen.precioCompra) + '" disabled/></div>' +
        '<div class="field"><label>Precio de Venta (a tu paciente)</label><input type="number" step="any" min="0" id="rd-venta" value="' + (examen.precioVenta || "") + '" placeholder="0"/></div>' +
        "</div>" +
        '<p style="margin:10px 0 0;font-size:14px">Ganancia: <span id="rd-ganancia">' + fmtGanancia(examen.precioCompra, examen.precioVenta) + "</span></p>" +
        '<div class="flex gap-2 justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button><button type="button" class="btn btn-primary" id="rd-guardar">' + U.icon("check") + " Guardar Precio de Venta</button></div>"
      );
      wrap.querySelector("#rd-venta").addEventListener("input", function (e) {
        wrap.querySelector("#rd-ganancia").innerHTML = fmtGanancia(examen.precioCompra, parseFloat(e.target.value) || 0);
      });
      wrap.querySelector("#rd-guardar").addEventListener("click", function () {
        var venta = parseFloat(wrap.querySelector("#rd-venta").value) || 0;
        S.cotizador.setPrecioVentaReferencia(tenantId, examen.id, venta);
        examen.precioVenta = venta;
        U.toast("Precio de venta guardado.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }
    function wireLabReferencia() {
      var btnGuardarNombre = document.getElementById("btn-guardar-nombre-lab");
      if (btnGuardarNombre) btnGuardarNombre.addEventListener("click", function () {
        var nombre = document.getElementById("ref-nombre-lab").value.trim();
        tenant.laboratorioReferenciaNombre = nombre;
        S.updateTenant(tenantId, { laboratorioReferenciaNombre: nombre });
        U.toast("Nombre guardado.", "success");
      });
      var btnPlantilla = document.getElementById("btn-descargar-plantilla-ref");
      if (btnPlantilla) btnPlantilla.addEventListener("click", function () {
        var ws = XLSX.utils.json_to_sheet([{ Codigo: "K503", Examen: "ACIDO FOLICO EN SUERO", CUPS: "903105", Tarifa: 17000 }]);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tarifas");
        XLSX.writeFile(wb, "Plantilla_Tarifas_Laboratorio_Referencia.xlsx");
      });
      var inputExcel = document.getElementById("input-excel-ref");
      if (inputExcel) inputExcel.addEventListener("change", subirExcelReferencia);
      var search = document.getElementById("ref-search");
      if (search) search.addEventListener("input", function (e) { refSearchTerm = e.target.value; renderTablaLabReferencia(); });
      renderTablaLabReferencia();
    }

    function ubicarEncabezadoReferencia(filas) {
      var maxFilasABuscar = Math.min(filas.length, 15);
      for (var f = 0; f < maxFilasABuscar; f++) {
        var fila = filas[f] || [];
        var colCodigo = -1, colExamen = -1, colTarifa = -1, colCups = -1;
        for (var c = 0; c < fila.length; c++) {
          var t = U.normalizar(String(fila[c] || ""));
          if (colCodigo === -1 && t.indexOf("cod") !== -1) colCodigo = c;
          if (colExamen === -1 && (t.indexOf("examen") !== -1 || t.indexOf("nombre") !== -1 || t.indexOf("descripcion") !== -1)) colExamen = c;
          if (colTarifa === -1 && (t.indexOf("tarifa") !== -1 || t.indexOf("precio") !== -1 || t.indexOf("valor") !== -1)) colTarifa = c;
          if (colCups === -1 && t.indexOf("cups") !== -1) colCups = c;
        }
        if (colCodigo !== -1 && colExamen !== -1 && colTarifa !== -1) return { fila: f, colCodigo: colCodigo, colExamen: colExamen, colTarifa: colTarifa, colCups: colCups };
      }
      return null;
    }
    function subirExcelReferencia(e) {
      var file = e.target.files[0];
      if (!file) return;
      var nombreLab = (tenant.laboratorioReferenciaNombre || "").trim();
      if (!nombreLab) { U.toast('Primero escribe y guarda el "Nombre del Laboratorio de Referencia" arriba.', "error"); e.target.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          var filasValidas = [];
          wb.SheetNames.forEach(function (nombreHoja) {
            var filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header: 1, defval: "" });
            var encabezado = ubicarEncabezadoReferencia(filas);
            if (!encabezado) return;
            for (var i = encabezado.fila + 1; i < filas.length; i++) {
              var fila = filas[i];
              var codigo = String(fila[encabezado.colCodigo] || "").trim();
              var nombre = String(fila[encabezado.colExamen] || "").trim();
              var celdaTarifa = fila[encabezado.colTarifa];
              var tarifa = typeof celdaTarifa === "number" ? celdaTarifa : parseFloat(String(celdaTarifa).replace(/[^0-9,.\-]/g, "").replace(/\./g, "").replace(",", "."));
              var cups = encabezado.colCups !== -1 ? String(fila[encabezado.colCups] || "").trim() : "";
              if (!codigo || !nombre || isNaN(tarifa)) continue;
              filasValidas.push({ codigoRef: codigo, nombre: nombre, cups: cups, precioCompra: tarifa });
            }
          });
          if (!filasValidas.length) {
            U.toast('No encontramos columnas de Código, Examen y Tarifa en el archivo. Descarga la plantilla para ver el formato esperado.', "error");
            return;
          }
          S.cotizador.bulkUpsertExamenesReferencia(tenantId, nombreLab, filasValidas);
          U.toast(filasValidas.length + " examen(es) de " + nombreLab + " cargados/actualizados.", "success");
          cargar();
        } catch (err) {
          U.toast("No se pudo leer el archivo: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }

    // ---------------------------------------------------------------------
    // HISTORIAL
    // ---------------------------------------------------------------------
    // Resumen de ventas por vendedor (control estilo CRM) — útil para
    // laboratorios con equipo comercial, para saber quién cerró cada venta.
    // Se calcula al vuelo a partir de las cotizaciones ya pagadas, sin
    // necesidad de un reporte aparte.
    function buildResumenVendedoresHtml() {
      var pagadas = cotizaciones.filter(function (c) { return c.estado === "pagada"; });
      if (!pagadas.length) return "";
      var porVendedor = {};
      pagadas.forEach(function (c) {
        var nombre = (c.pago && c.pago.vendedorNombre) || "Sin asignar";
        porVendedor[nombre] = porVendedor[nombre] || { ventas: 0, total: 0 };
        porVendedor[nombre].ventas++;
        porVendedor[nombre].total += (c.pago && c.pago.monto != null) ? c.pago.monto : c.total;
      });
      var filas = Object.keys(porVendedor).map(function (nombre) {
        return { nombre: nombre, ventas: porVendedor[nombre].ventas, total: porVendedor[nombre].total };
      }).sort(function (a, b) { return b.total - a.total; });
      return '<div class="card" style="margin:14px 0;background:var(--bg-soft, #f8fafc)"><h4 style="margin:0 0 8px;font-size:13.5px">📊 Ventas por Vendedor (histórico)</h4>' +
        '<div class="table-wrap"><table><thead><tr><th>Vendedor</th><th>Ventas</th><th>Monto Total</th></tr></thead><tbody>' +
        filas.map(function (f) { return "<tr><td>" + U.esc(f.nombre) + "</td><td>" + f.ventas + "</td><td><b>" + fmtMoneda(f.total) + "</b></td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }

    function buildHistorialHtml() {
      if (!cotizaciones.length) return '<p class="text-muted" style="margin-top:14px">Aún no has generado ninguna cotización.</p>';
      return buildResumenVendedoresHtml() +
        '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Fecha</th><th>Cliente</th><th># Exámenes</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>' +
        cotizaciones.map(function (c) {
          var cliente = c.cliente || {};
          var pagada = c.estado === "pagada";
          return "<tr><td>" + fmtFechaCorta(c.creadoEn) + "</td><td>" + U.esc(cliente.nombre || "—") + (c.convenio ? '<div class="text-muted" style="font-size:11px">🤝 ' + U.esc(c.convenio.nombre) + "</div>" : "") + "</td><td>" + c.examenes.length + "</td><td>" + fmtMoneda(c.total) + fmtMonedaExtra(c.total) + "</td>" +
            "<td>" + (pagada ? '<span class="badge badge-validado">Pagada</span>' : '<span class="badge badge-pendiente">Pendiente de pago</span>') + "</td>" +
            "<td><div class='flex gap-2 wrap'>" +
            "<button class='btn btn-ghost btn-sm' data-redescargar='" + c.id + "'>" + U.icon("download") + " Cotización</button>" +
            (pagada
              ? "<button class='btn btn-outline btn-sm' data-descargar-recibo='" + c.id + "'>" + U.icon("download") + " Recibo</button>" +
                "<button class='btn btn-primary btn-sm' data-enviar-recibo='" + c.id + "'>" + U.icon("send") + " Enviar Recibo</button>"
              : "<button class='btn btn-primary btn-sm' data-registrar-pago='" + c.id + "'>" + U.icon("check") + " Registrar Pago</button>") +
            "</div></td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function abrirRegistrarPago(cot) {
      var tenant = S.getTenant(tenantId);
      var usuarios = S.listUsers(tenantId).filter(function (u) { return u.activo; });
      var hoy = new Date().toISOString().slice(0, 10);
      var wrap = U.openModal(
        '<h3 class="modal-title">Registrar Pago — ' + fmtMoneda(cot.total) + fmtMonedaExtra(cot.total) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Cliente: ' + U.esc((cot.cliente && cot.cliente.nombre) || "—") + '</p>' +
        '<form id="pago-form"><div class="form-grid">' +
        '<div class="field"><label>Monto Pagado</label><input type="number" step="any" min="0" id="f_monto" value="' + cot.total + '" required/></div>' +
        '<div class="field"><label>Método de Pago</label><select id="f_metodoPago">' +
        Object.keys(METODO_PAGO_LABEL).map(function (k) { return '<option value="' + k + '">' + METODO_PAGO_LABEL[k] + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Fecha de Pago</label><input type="date" id="f_fechaPago" value="' + hoy + '"/></div>' +
        '<div class="field"><label>Atendido por (vendedor)</label><select id="f_vendedor">' +
        (usuarios.length ? usuarios.map(function (u) { return '<option value="' + U.esc(u.nombre) + '" ' + (u.nombre === session.nombre ? "selected" : "") + ">" + U.esc(u.nombre) + "</option>"; }).join("") : '<option value="' + U.esc(session.nombre) + '">' + U.esc(session.nombre) + "</option>") +
        "</select></div>" +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Registrar Pago</button></div>" +
        "</form>"
      );
      wrap.querySelector("#pago-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var monto = parseFloat(wrap.querySelector("#f_monto").value) || 0;
        var metodoPago = wrap.querySelector("#f_metodoPago").value;
        var fechaPago = wrap.querySelector("#f_fechaPago").value || hoy;
        var vendedorNombre = wrap.querySelector("#f_vendedor").value;
        S.cotizador.updateCotizacion(cot.id, { estado: "pagada", pago: { fecha: fechaPago, monto: monto, metodoPago: metodoPago, vendedorNombre: vendedorNombre } });
        S.addAudit(session.tenantId, session.nombre, session.rol, "REGISTRAR_PAGO_COTIZACION", "cotizacion", cot.id, "Registró el pago de la cotización de " + ((cot.cliente && cot.cliente.nombre) || "un cliente") + " por " + fmtMoneda(monto) + " (atendido por " + vendedorNombre + ").");
        U.toast("Pago registrado. Ya puedes enviar el recibo.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    function abrirEnviarRecibo(cot) {
      var tenant = S.getTenant(tenantId);
      var cliente = cot.cliente || {};
      var bytes = BIO_PDF_RECIBO_COTIZACION.buildReciboCotizacionPDF(cot, tenant);
      U.downloadBytes(bytes, "Recibo_" + (cliente.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf");
      var montoRecibo = (cot.pago && cot.pago.monto) || cot.total;
      var mensaje = "Hola " + (cliente.nombre ? cliente.nombre.split(" ")[0] : "") + " 👋 Adjunto el recibo de pago de tu compra en " + tenant.nombre + " por " + fmtMoneda(montoRecibo) + textoMonedaExtra(montoRecibo) + ". ¡Gracias por tu confianza! Cualquier duda, quedamos atentos.";
      U.toast("Recibo generado y descargado.", "success");
      var wrap = U.openModal(
        '<h3 class="modal-title">Recibo listo</h3>' +
        '<p class="text-muted" style="margin-top:0">Ya se descargó el PDF. Adjúntalo antes de enviar por el canal que elijas.</p>' +
        '<button class="btn btn-whatsapp btn-block" id="rec-send-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" +
        (cliente.correo ? U.emailProviderButtonsHtml("rec-mail") : "") +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrap.querySelector("#rec-send-wa").addEventListener("click", function () { window.open(waLinkTo(cliente.whatsapp, mensaje), "_blank"); });
      if (cliente.correo) U.wireEmailProviderButtons(wrap, "rec-mail", cliente.correo, "Recibo de pago — " + tenant.nombre, mensaje);
    }

    function wireHistorial() {
      root.querySelectorAll("[data-redescargar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var cot = cotizaciones.filter(function (c) { return c.id === b.dataset.redescargar; })[0];
          var tenant = S.getTenant(tenantId);
          var bytes = BIO_PDF_COTIZACION.buildCotizacionPDF(cot, tenant);
          U.downloadBytes(bytes, "Cotizacion_" + ((cot.cliente && cot.cliente.nombre) || "Cliente").replace(/\s+/g, "_") + ".pdf");
        });
      });
      root.querySelectorAll("[data-registrar-pago]").forEach(function (b) {
        b.addEventListener("click", function () { abrirRegistrarPago(cotizaciones.filter(function (c) { return c.id === b.dataset.registrarPago; })[0]); });
      });
      root.querySelectorAll("[data-descargar-recibo]").forEach(function (b) {
        b.addEventListener("click", function () {
          var cot = cotizaciones.filter(function (c) { return c.id === b.dataset.descargarRecibo; })[0];
          var tenant = S.getTenant(tenantId);
          var bytes = BIO_PDF_RECIBO_COTIZACION.buildReciboCotizacionPDF(cot, tenant);
          U.downloadBytes(bytes, "Recibo_" + ((cot.cliente && cot.cliente.nombre) || "Cliente").replace(/\s+/g, "_") + ".pdf");
        });
      });
      root.querySelectorAll("[data-enviar-recibo]").forEach(function (b) {
        b.addEventListener("click", function () { abrirEnviarRecibo(cotizaciones.filter(function (c) { return c.id === b.dataset.enviarRecibo; })[0]); });
      });
    }

    cargar();
  };
})();

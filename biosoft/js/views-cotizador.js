/* BIOsoft — Cotizador de exámenes: lista de precios (manual o por Excel),
   selección rápida de exámenes y envío de la cotización por WhatsApp o correo. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;
  var WA_NUMBER_GENERICO = "573505457420";

  function waLinkTo(numero, mensaje) {
    var n = (numero || "").replace(/\D/g, "");
    return "https://wa.me/" + (n || WA_NUMBER_GENERICO) + "?text=" + encodeURIComponent(mensaje);
  }
  function fmtMoneda(n) { return BIO_PDF_COTIZACION.fmtMoneda(n); }
  function fmtFechaCorta(iso) {
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
  }

  window.BIO_VIEWS.cotizador = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var vista = "nueva";
    var precios = {}; // examId -> precio
    var cotizaciones = [];

    function precioDe(examId) { return precios[examId] || 0; }

    function cargar() {
      var lista = S.cotizador.listPrecios(tenantId);
      precios = {};
      lista.forEach(function (p) { precios[p.examId] = p.precio; });
      cotizaciones = S.cotizador.listCotizaciones(tenantId);
      build();
    }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Cotizador de Exámenes</h3>' +
        '<div class="crm-view-toggle">' +
        '<button type="button" class="' + (vista === "nueva" ? "active" : "") + '" data-vista="nueva">🧾 Nueva Cotización</button>' +
        '<button type="button" class="' + (vista === "precios" ? "active" : "") + '" data-vista="precios">💲 Lista de Precios</button>' +
        '<button type="button" class="' + (vista === "historial" ? "active" : "") + '" data-vista="historial">🕓 Historial</button>' +
        "</div></div>" +
        (vista === "nueva" ? buildNuevaHtml() : vista === "precios" ? buildPreciosHtml() : buildHistorialHtml()) +
        "</div>";
      root.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { vista = b.dataset.vista; build(); }); });
      if (vista === "nueva") wireNueva(); else if (vista === "precios") wirePrecios(); else wireHistorial();
    }

    // ---------------------------------------------------------------------
    // NUEVA COTIZACIÓN
    // ---------------------------------------------------------------------
    var selected = []; // examIds
    var activeSection = C.SECCIONES[0].id;
    var searchTerm = "";

    function buildNuevaHtml() {
      return '<div class="form-grid" style="margin-top:14px">' +
        '<div class="field"><label>Nombre del Cliente</label><input id="cot-cliente-nombre"/></div>' +
        '<div class="field"><label>WhatsApp (con indicativo)</label><input id="cot-cliente-wa" placeholder="573001234567"/></div>' +
        '<div class="field"><label>Correo Electrónico</label><input id="cot-cliente-correo" type="email"/></div>' +
        "</div>" +
        '<div class="field" style="margin:12px 0"><input id="cot-exam-search" placeholder="Buscar examen por nombre o código CUPS en todas las secciones…"/></div>' +
        '<div class="exam-picker">' +
        '<div class="exam-picker-sections" id="cot-sec-list"></div>' +
        '<div class="exam-picker-list" id="cot-exam-list"></div>' +
        "</div>" +
        '<div class="flex justify-between items-center" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">' +
        '<span style="font-size:14px">Exámenes seleccionados: <b id="cot-count">0</b></span>' +
        '<span style="font-size:18px;font-weight:800;color:var(--brand-primary)">Total: <span id="cot-total">' + fmtMoneda(0) + "</span></span>" +
        "</div>" +
        '<button class="btn btn-primary btn-block" id="btn-generar-cot" style="margin-top:14px">' + U.icon("file") + " Generar Cotización</button>";
    }

    function wireNueva() {
      document.getElementById("cot-exam-search").addEventListener("input", function (e) { searchTerm = e.target.value; renderCotSections(); renderCotExams(); });
      renderCotSections();
      renderCotExams();
      document.getElementById("btn-generar-cot").addEventListener("click", generarCotizacion);
    }

    function renderCotSections() {
      document.getElementById("cot-sec-list").innerHTML = C.SECCIONES.map(function (s) {
        var count = selected.filter(function (id) { return C.examenPorId(id).seccion === s.id; }).length;
        return '<div class="sec-item ' + (!searchTerm && s.id === activeSection ? "active" : "") + '" data-sec="' + s.id + '">' + s.nombre + (count ? ' <span class="badge badge-validado" style="margin-left:4px">' + count + "</span>" : "") + "</div>";
      }).join("");
      document.querySelectorAll("#cot-sec-list .sec-item").forEach(function (el) {
        el.addEventListener("click", function () {
          activeSection = el.dataset.sec; searchTerm = ""; document.getElementById("cot-exam-search").value = "";
          renderCotSections(); renderCotExams();
        });
      });
    }

    function renderCotExams() {
      var term = U.normalizar(searchTerm.trim());
      var pool = term
        ? C.EXAMENES.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : C.EXAMENES.filter(function (e) { return e.seccion === activeSection; });

      document.getElementById("cot-exam-list").innerHTML = pool.map(function (e) {
        var checked = selected.indexOf(e.id) !== -1;
        var precio = precioDe(e.id);
        return '<label class="exam-row"><input type="checkbox" data-cot-exam="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + C.seccionNombre(e.seccion) + "</span>" : "") + "</div>" +
          '<div class="meta">CUPS ' + e.cups + "</div></div>" +
          '<div style="font-weight:700;font-size:13px;white-space:nowrap">' + (precio ? fmtMoneda(precio) : '<span class="text-muted">Sin precio</span>') + "</div>" +
          "</label>";
      }).join("") || '<p class="text-muted" style="padding:14px">Sin resultados para tu búsqueda.</p>';

      document.querySelectorAll("[data-cot-exam]").forEach(function (chk) {
        chk.addEventListener("change", function () {
          var id = chk.dataset.cotExam;
          if (chk.checked) selected.push(id); else selected = selected.filter(function (x) { return x !== id; });
          actualizarTotales(); renderCotSections();
        });
      });
    }

    function actualizarTotales() {
      var total = selected.reduce(function (a, id) { return a + precioDe(id); }, 0);
      document.getElementById("cot-count").textContent = selected.length;
      document.getElementById("cot-total").textContent = fmtMoneda(total);
    }

    function generarCotizacion() {
      if (!selected.length) { U.toast("Selecciona al menos un examen.", "error"); return; }
      var nombre = document.getElementById("cot-cliente-nombre").value.trim();
      var whatsapp = document.getElementById("cot-cliente-wa").value.trim();
      var correo = document.getElementById("cot-cliente-correo").value.trim();
      var tenant = S.getTenant(tenantId);
      var examenes = selected.map(function (id) {
        var e = C.examenPorId(id);
        return { examId: id, nombre: e.nombre, seccion: e.seccion, precio: precioDe(id) };
      });
      var total = examenes.reduce(function (a, e) { return a + e.precio; }, 0);
      var cot = S.cotizador.createCotizacion({
        tenantId: tenantId, cliente: { nombre: nombre, whatsapp: whatsapp, correo: correo }, examenes: examenes, total: total
      });
      var bytes = BIO_PDF_COTIZACION.buildCotizacionPDF(cot, tenant);
      var nombreArchivo = "Cotizacion_" + (nombre || "Cliente").replace(/\s+/g, "_") + ".pdf";
      U.downloadBytes(bytes, nombreArchivo);
      var mensaje = "Hola " + (nombre ? nombre.split(" ")[0] : "") + " 👋 Aquí tienes la cotización de " + tenant.nombre + " por " + fmtMoneda(total) + ". Cualquier duda, quedamos atentos.";
      U.toast("Cotización generada y descargada.", "success");
      var wrap = U.openModal(
        '<h3 class="modal-title">Cotización lista — ' + fmtMoneda(total) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Ya se descargó el PDF. Ahora elige por dónde enviarlo.</p>' +
        '<button class="btn btn-whatsapp btn-block" id="cot-send-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" +
        (correo ? U.emailProviderButtonsHtml("cot-mail") : "") +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      wrap.querySelector("#cot-send-wa").addEventListener("click", function () { window.open(waLinkTo(whatsapp, mensaje), "_blank"); });
      if (correo) U.wireEmailProviderButtons(wrap, "cot-mail", correo, "Cotización de exámenes — " + tenant.nombre, mensaje);

      selected = []; cargar();
    }

    // ---------------------------------------------------------------------
    // LISTA DE PRECIOS
    // ---------------------------------------------------------------------
    var precioSearchTerm = "";
    var preciosEditados = {};

    function buildPreciosHtml() {
      return '<p class="text-muted" style="margin-top:14px">Define el precio de cada examen. También puedes descargar una plantilla en Excel, editarla y volver a subirla si son muchos.</p>' +
        '<div class="flex gap-2 wrap" style="margin-bottom:12px">' +
        '<button class="btn btn-outline btn-sm" id="btn-descargar-plantilla">' + U.icon("download") + " Descargar Plantilla Excel</button>" +
        '<label class="btn btn-outline btn-sm" style="cursor:pointer">' + U.icon("plus") + ' Subir Excel de Precios<input type="file" id="input-excel-precios" accept=".xlsx,.xls,.csv" style="display:none"/></label>' +
        "</div>" +
        '<div class="field" style="margin-bottom:12px"><input id="precio-search" placeholder="Buscar examen por nombre o código CUPS…"/></div>' +
        '<div class="table-wrap" style="max-height:480px;overflow-y:auto"><table><thead><tr><th>Examen</th><th>Sección</th><th>CUPS</th><th style="min-width:140px">Precio (COP)</th></tr></thead><tbody id="precios-tbody"></tbody></table></div>' +
        '<button class="btn btn-primary" id="btn-guardar-precios" style="margin-top:14px">' + U.icon("check") + " Guardar Cambios</button>";
    }

    function renderPreciosTabla() {
      var term = U.normalizar(precioSearchTerm.trim());
      var pool = term
        ? C.EXAMENES.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : C.EXAMENES;
      document.getElementById("precios-tbody").innerHTML = pool.map(function (e) {
        var valor = preciosEditados.hasOwnProperty(e.id) ? preciosEditados[e.id] : precioDe(e.id);
        return "<tr><td>" + U.esc(e.nombre) + "</td><td>" + C.seccionNombre(e.seccion) + "</td><td>" + e.cups + "</td>" +
          "<td><input type='number' step='any' min='0' data-precio-exam='" + e.id + "' value='" + (valor || "") + "' placeholder='0'/></td></tr>";
      }).join("") || '<tr><td colspan="4" class="text-muted">Sin resultados.</td></tr>';
      document.querySelectorAll("[data-precio-exam]").forEach(function (inp) {
        inp.addEventListener("input", function () { preciosEditados[inp.dataset.precioExam] = parseFloat(inp.value) || 0; });
      });
    }

    function wirePrecios() {
      renderPreciosTabla();
      document.getElementById("precio-search").addEventListener("input", function (e) { precioSearchTerm = e.target.value; renderPreciosTabla(); });
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

    function subirExcelPrecios(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var filas = XLSX.utils.sheet_to_json(ws);
          var porCups = {};
          C.EXAMENES.forEach(function (ex) { porCups[ex.cups] = ex.id; });
          var pares = [];
          filas.forEach(function (fila) {
            var cups = String(fila.CUPS || fila.cups || fila.Cups || "").trim();
            var precio = parseFloat(fila.Precio || fila.precio || fila.PRECIO);
            var examId = porCups[cups];
            if (examId && !isNaN(precio)) pares.push({ examId: examId, precio: precio });
          });
          if (!pares.length) { U.toast("No se encontraron filas válidas (revisa las columnas CUPS y Precio).", "error"); return; }
          S.cotizador.bulkSetPrecios(tenantId, pares);
          U.toast(pares.length + " precio(s) actualizados desde el Excel.", "success");
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
    function buildHistorialHtml() {
      if (!cotizaciones.length) return '<p class="text-muted" style="margin-top:14px">Aún no has generado ninguna cotización.</p>';
      return '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Fecha</th><th>Cliente</th><th># Exámenes</th><th>Total</th><th></th></tr></thead><tbody>' +
        cotizaciones.map(function (c) {
          var cliente = c.cliente || {};
          return "<tr><td>" + fmtFechaCorta(c.creadoEn) + "</td><td>" + U.esc(cliente.nombre || "—") + "</td><td>" + c.examenes.length + "</td><td>" + fmtMoneda(c.total) + "</td>" +
            "<td><button class='btn btn-outline btn-sm' data-redescargar='" + c.id + "'>" + U.icon("download") + " Descargar</button></td></tr>";
        }).join("") + "</tbody></table></div>";
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
    }

    cargar();
  };
})();

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

  // Exámenes de referencia propios de un laboratorio (ej. tarifas de un
  // laboratorio externo que el catálogo global de BIOsoft no incluye) se
  // agrupan en esta sección "virtual", que solo aparece cuando el laboratorio
  // tiene al menos un examen personalizado propio.
  var SECCION_REF_EXT = { id: "ref-externa", nombre: "Enviados a Referencia (tu lista)" };

  window.BIO_VIEWS.cotizador = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var vista = "nueva";
    var precios = {}; // examId -> precio
    var cotizaciones = [];
    var customExams = []; // exámenes propios del laboratorio, fuera del catálogo global

    function precioDe(examId) { return precios[examId] || 0; }

    function poolExamenes() {
      return C.EXAMENES.concat(customExams.map(function (ce) {
        return { id: ce.id, nombre: ce.nombre, cups: ce.cups, seccion: SECCION_REF_EXT.id };
      }));
    }
    function seccionesDisponibles() {
      return customExams.length ? C.SECCIONES.concat([SECCION_REF_EXT]) : C.SECCIONES;
    }
    function resolverExamen(id) {
      return C.examenPorId(id) || poolExamenes().filter(function (e) { return e.id === id; })[0] || null;
    }
    function resolverSeccionNombre(seccionId) {
      return seccionId === SECCION_REF_EXT.id ? SECCION_REF_EXT.nombre : C.seccionNombre(seccionId);
    }

    function cargar() {
      var lista = S.cotizador.listPrecios(tenantId);
      precios = {};
      lista.forEach(function (p) { precios[p.examId] = p.precio; });
      cotizaciones = S.cotizador.listCotizaciones(tenantId);
      customExams = S.cotizador.listExamenesPersonalizados(tenantId);
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
      document.getElementById("cot-sec-list").innerHTML = seccionesDisponibles().map(function (s) {
        var count = selected.filter(function (id) { return resolverExamen(id).seccion === s.id; }).length;
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
      var todos = poolExamenes();
      var pool = term
        ? todos.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : todos.filter(function (e) { return e.seccion === activeSection; });

      document.getElementById("cot-exam-list").innerHTML = pool.map(function (e) {
        var checked = selected.indexOf(e.id) !== -1;
        var precio = precioDe(e.id);
        return '<label class="exam-row"><input type="checkbox" data-cot-exam="' + e.id + '" ' + (checked ? "checked" : "") + '/>' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + resolverSeccionNombre(e.seccion) + "</span>" : "") + "</div>" +
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
        var e = resolverExamen(id);
        return { examId: id, nombre: e.nombre, seccion: e.seccion, seccionNombre: resolverSeccionNombre(e.seccion), precio: precioDe(id) };
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
      var todos = poolExamenes();
      var pool = term
        ? todos.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : todos;
      document.getElementById("precios-tbody").innerHTML = pool.map(function (e) {
        var valor = preciosEditados.hasOwnProperty(e.id) ? preciosEditados[e.id] : precioDe(e.id);
        return "<tr><td>" + U.esc(e.nombre) + "</td><td>" + resolverSeccionNombre(e.seccion) + "</td><td>" + e.cups + "</td>" +
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
          var porCups = {};
          C.EXAMENES.forEach(function (ex) { porCups[ex.cups] = ex.id; });
          var pares = [];
          var personalizadosPorCups = {}; // dedupe: el mismo CUPS puede repetirse en varias hojas
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
              var examId = porCups[cups];
              if (examId) {
                pares.push({ examId: examId, precio: precio });
              } else if (encabezado.colNombre !== -1) {
                var nombre = String(fila[encabezado.colNombre] || "").trim();
                if (nombre) personalizadosPorCups[cups] = { cups: cups, nombre: nombre, precio: precio };
              }
            }
          });

          var personalizados = Object.keys(personalizadosPorCups).map(function (k) { return personalizadosPorCups[k]; });

          if (!pares.length && !personalizados.length) {
            var msg = !seEncontroEncabezado
              ? "No encontramos columnas de CUPS y Precio/Tarifa en el archivo. Verifica que tenga encabezados como \"CUPS\" y \"Tarifa\" o \"Precio\"."
              : "Encontramos " + filasConCupsYPrecio + " fila(s) con CUPS y precio, pero ninguno coincide con los códigos de exámenes de tu catálogo.";
            U.toast(msg, "error");
            return;
          }
          if (pares.length) S.cotizador.bulkSetPrecios(tenantId, pares);
          if (personalizados.length) S.cotizador.bulkUpsertExamenesPersonalizados(tenantId, personalizados);

          var partes = [];
          if (pares.length) partes.push(pares.length + " precio(s) de tu catálogo actualizados");
          if (personalizados.length) partes.push(personalizados.length + " examen(es) de referencia agregados a tu lista personalizada");
          U.toast(partes.join(" y ") + ".", "success");
          cargar();
        } catch (err) {
          U.toast("No se pudo leer el archivo: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
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

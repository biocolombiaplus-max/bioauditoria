/* BIOsoft — Control de Calidad (Westgard): captura diaria, configuración de
   controles y gráficas Levey-Jennings para Química Sanguínea y Hematología. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, Q = BIO_QC, F = window.BIO_formHelpers;

  var SECCIONES_QC = [
    { id: "quimica", nombre: "Química Sanguínea", emoji: "🧪" },
    { id: "hematologia", nombre: "Hematología", emoji: "🩸" }
  ];

  function analitoInfo(seccion, codigo) {
    return (Q.ANALITOS[seccion] || []).filter(function (a) { return a.codigo === codigo; })[0] || { codigo: codigo, nombre: codigo, unidad: "" };
  }

  function fmtFecha(iso) {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  }

  window.BIO_VIEWS.calidad = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var vista = "captura";
    var controles = [];

    function cargar() {
      controles = S.qc.listControles(tenantId);
      build();
    }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Control de Calidad</h3>' +
        '<div class="flex gap-2 wrap">' +
        '<div class="crm-view-toggle"><button type="button" class="' + (vista === "captura" ? "active" : "") + '" data-vista="captura">📋 Captura de Hoy</button><button type="button" class="' + (vista === "controles" ? "active" : "") + '" data-vista="controles">⚙️ Controles</button></div>' +
        '<button class="btn btn-primary btn-sm" id="btn-nuevo-control">' + U.icon("plus") + " Nuevo Control</button>" +
        "</div></div>" +
        (vista === "captura" ? buildCapturaHtml() : buildControlesHtml()) +
        "</div>";
      document.getElementById("btn-nuevo-control").addEventListener("click", function () { abrirFormControl(null); });
      root.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { vista = b.dataset.vista; build(); }); });
      if (vista === "captura") wireCaptura(); else wireControles();
    }

    // ---------------------------------------------------------------------
    // Captura diaria
    // ---------------------------------------------------------------------
    function buildCapturaHtml() {
      var activos = controles.filter(function (c) { return c.activo; });
      if (!activos.length) {
        return '<p class="text-muted">Aún no tienes controles de calidad configurados. Ve a "⚙️ Controles" → "Nuevo Control" para crear el primero.</p>';
      }
      return SECCIONES_QC.map(function (sec) {
        var lista = activos.filter(function (c) { return c.seccion === sec.id; });
        if (!lista.length) return "";
        return '<h4 style="margin:18px 0 10px">' + sec.emoji + " " + sec.nombre + "</h4>" +
          '<div class="table-wrap"><table><thead><tr><th>Control</th><th>Lote</th><th>Media / DS</th><th>Valor de hoy</th><th></th></tr></thead><tbody>' +
          lista.map(function (c) {
            var info = analitoInfo(c.seccion, c.analitoCodigo);
            return "<tr><td><b>" + U.esc(info.nombre) + "</b><div class='text-muted' style='font-size:11px'>" + U.esc(c.nivel) + "</div></td>" +
              "<td>" + U.esc(c.lote || "—") + "</td>" +
              "<td>" + c.media + " ± " + c.ds + " " + U.esc(info.unidad) + "</td>" +
              "<td style='min-width:140px'><input type='number' step='any' data-captura='" + c.id + "' placeholder='Ej: " + c.media + "'/></td>" +
              "<td><button class='btn btn-primary btn-sm' data-guardar-captura='" + c.id + "'>" + U.icon("check") + " Guardar</button></td>" +
              "</tr><tr class='qc-resultado-row hidden' data-resultado-de='" + c.id + "'><td colspan='5'></td></tr>";
          }).join("") + "</tbody></table></div>";
      }).join("");
    }

    function wireCaptura() {
      root.querySelectorAll("[data-guardar-captura]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.dataset.guardarCaptura;
          var input = root.querySelector("[data-captura='" + id + "']");
          var valor = parseFloat(input.value);
          if (isNaN(valor)) { U.toast("Ingresa un valor numérico.", "error"); return; }
          var control = controles.filter(function (c) { return c.id === id; })[0];
          var historial = S.qc.listLecturas(id).map(function (l) { return l.valor; });
          historial.push(valor);
          var resultado = Q.evaluar(historial, control.media, control.ds);
          S.qc.createLectura({
            tenantId: tenantId, controlId: id, fecha: S.nowISO(), valor: valor,
            usuario: session.nombre, z: resultado.z, reglas: resultado.reglas, estado: resultado.estado
          });
          mostrarResultadoCaptura(id, resultado, control);
          S.addAudit(tenantId, session.nombre, session.rol, "QC_LECTURA", "control_calidad", id,
            "Registró lectura de QC (" + analitoInfo(control.seccion, control.analitoCodigo).nombre + " " + control.nivel + "): " + valor + (resultado.reglas.length ? " — " + resultado.estado.toUpperCase() : ""));
          input.value = "";
        });
      });
    }

    function mostrarResultadoCaptura(controlId, resultado, control) {
      var row = root.querySelector("[data-resultado-de='" + controlId + "']");
      if (!row) return;
      row.classList.remove("hidden");
      var clase = resultado.estado === "rechazo" ? "qc-alerta-rechazo" : resultado.estado === "aviso" ? "qc-alerta-aviso" : "qc-alerta-ok";
      row.querySelector("td").innerHTML =
        '<div class="' + clase + '"><b>' + (resultado.estado === "rechazo" ? "🔴 Rechazado" : resultado.estado === "aviso" ? "🟡 Aviso" : "🟢 En control") +
        (resultado.z !== null ? " · z = " + resultado.z.toFixed(2) : "") + "</b>" +
        '<ul style="margin:6px 0 0;padding-left:18px">' + resultado.recomendaciones.map(function (r) { return "<li>" + U.esc(r) + "</li>"; }).join("") + "</ul></div>";
    }

    // ---------------------------------------------------------------------
    // Configuración de controles
    // ---------------------------------------------------------------------
    function buildControlesHtml() {
      if (!controles.length) return '<p class="text-muted">Aún no tienes controles de calidad configurados.</p>';
      return '<div class="table-wrap"><table><thead><tr><th>Sección</th><th>Analito</th><th>Nivel</th><th>Lote</th><th>Media / DS</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>' +
        controles.map(function (c) {
          var info = analitoInfo(c.seccion, c.analitoCodigo);
          var sec = SECCIONES_QC.filter(function (s) { return s.id === c.seccion; })[0] || {};
          return "<tr><td>" + (sec.emoji || "") + " " + U.esc(sec.nombre || c.seccion) + "</td>" +
            "<td>" + U.esc(info.nombre) + "</td><td>" + U.esc(c.nivel) + "</td><td>" + U.esc(c.lote || "—") + "</td>" +
            "<td>" + c.media + " ± " + c.ds + " " + U.esc(info.unidad) + "</td>" +
            "<td>" + (c.vencimiento ? fmtFecha(c.vencimiento) : "—") + "</td>" +
            "<td>" + (c.activo ? '<span class="badge badge-validado">Activo</span>' : '<span class="badge badge-rutina">Inactivo</span>') + "</td>" +
            "<td><div class='flex gap-2 wrap'>" +
            "<button class='btn btn-outline btn-sm' data-ver-grafica='" + c.id + "'>📈 Gráfica</button>" +
            "<button class='btn btn-ghost btn-sm' data-editar-control='" + c.id + "'>" + U.icon("edit") + "</button>" +
            "</div></td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function wireControles() {
      root.querySelectorAll("[data-ver-grafica]").forEach(function (b) { b.addEventListener("click", function () {
        abrirGrafica(controles.filter(function (c) { return c.id === b.dataset.verGrafica; })[0]);
      }); });
      root.querySelectorAll("[data-editar-control]").forEach(function (b) { b.addEventListener("click", function () {
        abrirFormControl(controles.filter(function (c) { return c.id === b.dataset.editarControl; })[0]);
      }); });
    }

    function abrirFormControl(control) {
      var isEdit = !!control;
      control = control || { seccion: "quimica", analitoCodigo: "", nivel: "Normal", lote: "", media: "", ds: "", vencimiento: "", activo: true };
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Control" : "Nuevo Control de Calidad") + '</h3>' +
        '<form id="qc-form">' +
        '<div class="form-grid">' +
        F.sel("qcSeccion", "Sección", SECCIONES_QC.map(function (s) { return "<option value='" + s.id + "' " + (s.id === control.seccion ? "selected" : "") + ">" + s.emoji + " " + s.nombre + "</option>"; }).join("")) +
        '<div class="field"><label>Analito</label><select id="f_qcAnalito"></select></div>' +
        F.sel("qcNivel", "Nivel del Control", Q.NIVELES.map(function (n) { return "<option value='" + n + "' " + (n === control.nivel ? "selected" : "") + ">" + n + "</option>"; }).join("")) +
        F.inp("qcLote", "Número de Lote", control.lote) +
        F.inp("qcMedia", "Media (valor objetivo)", control.media, true, "number") +
        F.inp("qcDs", "Desviación Estándar (DS)", control.ds, true, "number") +
        F.inp("qcVencimiento", "Fecha de Vencimiento del Lote", control.vencimiento, false, "date") +
        "</div>" +
        '<p class="text-muted" style="font-size:12.5px">La media y la DS son los valores objetivo del inserto del fabricante del control, o los calculados por tu laboratorio tras 20 corridas.</p>' +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button></div>" +
        "</form>", { lg: true }
      );
      function refrescarAnalitos() {
        var seccion = wrap.querySelector("#f_qcSeccion").value;
        var sel = wrap.querySelector("#f_qcAnalito");
        sel.innerHTML = (Q.ANALITOS[seccion] || []).map(function (a) { return "<option value='" + a.codigo + "' " + (a.codigo === control.analitoCodigo ? "selected" : "") + ">" + a.nombre + " (" + a.unidad + ")</option>"; }).join("");
      }
      wrap.querySelector("#f_qcSeccion").addEventListener("change", refrescarAnalitos);
      refrescarAnalitos();
      wrap.querySelector("#qc-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value; };
        var media = parseFloat(g("qcMedia")), ds = parseFloat(g("qcDs"));
        if (isNaN(media) || isNaN(ds) || ds <= 0) { U.toast("Ingresa una media y una DS válidas (DS mayor que 0).", "error"); return; }
        var data = {
          seccion: g("qcSeccion"), analitoCodigo: g("qcAnalito"), nivel: g("qcNivel"),
          lote: g("qcLote").trim(), media: media, ds: ds, vencimiento: g("qcVencimiento"), activo: true
        };
        var resultado = isEdit ? S.qc.updateControl(control.id, data) : S.qc.createControl(Object.assign({ tenantId: tenantId }, data));
        U.toast("Control guardado.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    // ---------------------------------------------------------------------
    // Gráfica Levey-Jennings
    // ---------------------------------------------------------------------
    function abrirGrafica(control) {
      if (!control) return;
      var lecturas = S.qc.listLecturas(control.id);
      var info = analitoInfo(control.seccion, control.analitoCodigo);
      var wrap = U.openModal(
        '<h3 class="modal-title">📈 ' + U.esc(info.nombre) + " — " + U.esc(control.nivel) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Lote ' + U.esc(control.lote || "—") + " · Media " + control.media + " ± " + control.ds + " " + U.esc(info.unidad) + '</p>' +
        (lecturas.length ? renderLJChart(lecturas, control.media, control.ds) : '<p class="text-muted">Aún no hay lecturas registradas para este control.</p>') +
        renderTablaLecturas(lecturas, control) +
        '<div class="flex justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>',
        { lg: true }
      );
    }

    function renderTablaLecturas(lecturas, control) {
      if (!lecturas.length) return "";
      var recientes = lecturas.slice(-15).reverse();
      return '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Fecha</th><th>Valor</th><th>z</th><th>Estado</th></tr></thead><tbody>' +
        recientes.map(function (l) {
          var badge = l.estado === "rechazo" ? '<span class="badge badge-urgente">Rechazo (' + (l.reglas || []).join(", ") + ")</span>"
            : l.estado === "aviso" ? '<span class="badge badge-pendiente">Aviso</span>'
            : '<span class="badge badge-validado">En control</span>';
          return "<tr><td>" + fmtFecha(l.fecha) + "</td><td>" + l.valor + "</td><td>" + (typeof l.z === "number" ? l.z.toFixed(2) : "—") + "</td><td>" + badge + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function renderLJChart(lecturas, media, ds) {
      var puntos = lecturas.slice(-30);
      var w = 640, h = 260, padL = 46, padR = 16, padT = 16, padB = 30;
      var plotW = w - padL - padR, plotH = h - padT - padB;
      var yMin = media - 4 * ds, yMax = media + 4 * ds;
      function yFor(v) { return padT + (yMax - v) / (yMax - yMin) * plotH; }
      function xFor(i) { return puntos.length <= 1 ? padL + plotW / 2 : padL + (i / (puntos.length - 1)) * plotW; }
      var niveles = [-3, -2, -1, 0, 1, 2, 3];
      var lineas = niveles.map(function (n) {
        var y = yFor(media + n * ds);
        var color = n === 0 ? "#94a3b8" : Math.abs(n) === 3 ? "#f0b0b0" : "#e2e8f0";
        return '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="' + color + '" stroke-width="1" stroke-dasharray="' + (n === 0 ? "0" : "4 3") + '"/>' +
          '<text x="' + (w - padR + 4) + '" y="' + (y + 3) + '" font-size="9" fill="#94a3b8">' + (n === 0 ? "x̄" : (n > 0 ? "+" + n : n) + "DS") + "</text>";
      }).join("");
      var colorFor = function (estado) { return estado === "rechazo" ? "#d64545" : estado === "aviso" ? "#c97e0d" : "#0b8a4a"; };
      var poly = puntos.map(function (l, i) { return xFor(i) + "," + yFor(l.valor); }).join(" ");
      var circulos = puntos.map(function (l, i) {
        return '<circle cx="' + xFor(i) + '" cy="' + yFor(l.valor) + '" r="4" fill="' + colorFor(l.estado) + '"><title>' + fmtFecha(l.fecha) + ": " + l.valor + (l.reglas && l.reglas.length ? " (" + l.reglas.join(", ") + ")" : "") + "</title></circle>";
      }).join("");
      return '<div style="overflow-x:auto"><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" style="background:#fff;border:1px solid var(--border);border-radius:10px">' +
        lineas +
        '<polyline points="' + poly + '" fill="none" stroke="#7c3aed" stroke-width="1.5" opacity="0.5"/>' +
        circulos +
        "</svg></div>";
    }

    cargar();
  };
})();

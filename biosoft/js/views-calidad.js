/* BIOsoft — Control de Calidad (Westgard): captura diaria, configuración de
   controles y gráficas Levey-Jennings para Química Sanguínea y Hematología. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, Q = BIO_QC, C = BIO_CATALOG, F = window.BIO_formHelpers;

  // Se listan TODAS las secciones del laboratorio (no solo Química y
  // Hematología), para que cada laboratorio pueda llevar control de calidad
  // en cualquier área que maneje, tal como lo exige la normativa.
  var SECCIONES_QC = C.SECCIONES;

  function analitoInfo(seccion, codigo) {
    return (Q.ANALITOS[seccion] || []).filter(function (a) { return a.codigo === codigo; })[0] || { codigo: codigo, nombre: codigo, unidad: "" };
  }

  function fmtFecha(iso) {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  }

  // La mayoría de insertos de controles comerciales en Colombia y Venezuela
  // (Wiener Lab, Spinreact, Biosystems, Human, etc.) no imprimen una "DS"
  // directa: imprimen una media y un rango aceptable (ej. "70,4 - 95,2"),
  // que casi siempre representa la media ± 2 DE del fabricante. De ahí se
  // despeja la DS que realmente usan las reglas de Westgard.
  function dsDesdeRango(rangoMin, rangoMax, rangoEnDS) {
    if (rangoMin == null || rangoMax == null || isNaN(rangoMin) || isNaN(rangoMax)) return null;
    var n = rangoEnDS || 2;
    return Math.abs(rangoMax - rangoMin) / (2 * n);
  }

  // Texto "Media ± DS" para las tablas, con el rango del inserto debajo
  // cuando el control se configuró a partir de él (en vez de una DS propia
  // calculada por el laboratorio) — así el usuario siempre ve el mismo
  // dato que tiene impreso en la caja del control, no solo la DS derivada.
  function mediaDsHtml(c, unidad) {
    var dsTxt = typeof c.ds === "number" ? (Math.round(c.ds * 100) / 100) : c.ds;
    var base = c.media + " ± " + dsTxt + " " + U.esc(unidad);
    if (c.dsOrigen === "inserto" && c.rangoMin != null && c.rangoMax != null) {
      base += "<div class='text-muted' style='font-size:10.5px'>Rango inserto: " + c.rangoMin + " – " + c.rangoMax + " (± " + (c.rangoEnDS || 2) + " DE)</div>";
    }
    return base;
  }

  window.BIO_VIEWS.calidad = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var vista = "captura";
    var controles = [];
    // Controles que el usuario decidió volver a capturar hoy a pesar de ya
    // tener una lectura (botón "Corregir") — mientras un id esté aquí, esa
    // fila vuelve a mostrar el campo de captura en vez del resultado de hoy.
    var forzarCaptura = {};

    function cargar() {
      controles = S.qc.listControles(tenantId);
      build();
    }

    function descargarInformeCalidad() {
      if (!controles.length) { U.toast("Aún no tienes controles de calidad configurados.", "error"); return; }
      var btn = document.getElementById("btn-informe-calidad");
      var htmlOriginal = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = "Generando…";
      var tenant = BIO_AUTH.currentTenant();
      var lecturasPorControlId = {};
      controles.forEach(function (c) { lecturasPorControlId[c.id] = S.qc.listLecturas(c.id); });
      BIO_PDF_CALIDAD.buildInformeCalidadPDF(controles, lecturasPorControlId, tenant).then(function (bytes) {
        U.downloadBytes(bytes, "Informe_Control_Calidad_" + (tenant.nombre || "BIOsoft").replace(/\s+/g, "_") + ".pdf");
        U.toast("Informe de Control de Calidad descargado.", "success");
      }).catch(function () {
        U.toast("No se pudo generar el informe.", "error");
      }).finally(function () {
        btn.disabled = false; btn.innerHTML = htmlOriginal;
      });
    }

    // La lectura de HOY de un control, si ya se registró — se compara solo
    // la fecha (no la hora) para que "hoy" siga siendo hoy sin importar a
    // qué hora del día se haya capturado.
    function lecturaDeHoy(controlId) {
      var hoy = new Date().toISOString().slice(0, 10);
      var lecturas = S.qc.listLecturas(controlId).filter(function (l) { return (l.fecha || "").slice(0, 10) === hoy; });
      return lecturas.length ? lecturas[lecturas.length - 1] : null;
    }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Control de Calidad</h3>' +
        '<div class="flex gap-2 wrap">' +
        '<div class="crm-view-toggle"><button type="button" class="' + (vista === "captura" ? "active" : "") + '" data-vista="captura">📋 Captura de Hoy</button><button type="button" class="' + (vista === "controles" ? "active" : "") + '" data-vista="controles">⚙️ Controles</button></div>' +
        '<button class="btn btn-outline btn-sm" id="btn-informe-calidad">' + U.icon("file") + " Descargar Informe</button>" +
        '<button class="btn btn-primary btn-sm" id="btn-nuevo-control">' + U.icon("plus") + " Nuevo Control</button>" +
        "</div></div>" +
        (vista === "captura" ? buildCapturaHtml() : buildControlesHtml()) +
        "</div>";
      document.getElementById("btn-nuevo-control").addEventListener("click", function () { abrirFormControl(null); });
      document.getElementById("btn-informe-calidad").addEventListener("click", descargarInformeCalidad);
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
            var lecturaHoy = !forzarCaptura[c.id] ? lecturaDeHoy(c.id) : null;
            var celdaCaptura;
            // Si ya se guardó un valor hoy para este control, NO vuelve a
            // mostrar el campo en blanco (que era justo lo que hacía parecer
            // que nunca se había guardado) — en su lugar queda visible el
            // valor y el resultado de Westgard de forma permanente, con la
            // opción de corregirlo si hiciera falta.
            if (lecturaHoy) {
              var claseHoy = lecturaHoy.estado === "rechazo" ? "qc-alerta-rechazo" : lecturaHoy.estado === "aviso" ? "qc-alerta-aviso" : "qc-alerta-ok";
              var etiquetaHoy = lecturaHoy.estado === "rechazo" ? "🔴 Rechazado" : lecturaHoy.estado === "aviso" ? "🟡 Aviso" : "🟢 En control";
              celdaCaptura = "<td colspan='2'><div class='" + claseHoy + "' style='padding:8px 10px'>" +
                "<b>✓ Hoy: " + lecturaHoy.valor + " " + U.esc(info.unidad) + " — " + etiquetaHoy + (typeof lecturaHoy.z === "number" ? " · z = " + lecturaHoy.z.toFixed(2) : "") + "</b>" +
                (lecturaHoy.reglas && lecturaHoy.reglas.length ? '<ul style="margin:4px 0 0;padding-left:16px;font-size:12px">' + lecturaHoy.reglas.map(function (r) { return "<li>" + U.esc(Q.RECOMENDACIONES && Q.RECOMENDACIONES[r] || r) + "</li>"; }).join("") + "</ul>" : "") +
                "</div></td>" +
                "<td><div class='flex gap-1 wrap'>" +
                "<button class='btn btn-ghost btn-sm' data-corregir='" + c.id + "'>Corregir</button>" +
                "<button class='btn btn-ghost btn-sm text-danger' data-eliminar-lectura='" + lecturaHoy.id + "' data-control='" + c.id + "' title='Eliminar esta lectura de hoy (si se digitó mal)'>" + U.icon("trash") + "</button>" +
                "</div></td>";
            } else {
              celdaCaptura = "<td style='min-width:140px'><input type='number' step='any' data-captura='" + c.id + "' placeholder='Ej: " + c.media + "'/></td>" +
                "<td><button class='btn btn-primary btn-sm' data-guardar-captura='" + c.id + "'>" + U.icon("check") + " Guardar</button></td>";
            }
            return "<tr><td><b>" + U.esc(info.nombre) + "</b><div class='text-muted' style='font-size:11px'>" + U.esc(c.nivel) + "</div></td>" +
              "<td>" + U.esc(c.lote || "—") + "</td>" +
              "<td>" + mediaDsHtml(c, info.unidad) + "</td>" +
              celdaCaptura + "</tr>";
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
          S.addAudit(tenantId, session.nombre, session.rol, "QC_LECTURA", "control_calidad", id,
            "Registró lectura de QC (" + analitoInfo(control.seccion, control.analitoCodigo).nombre + " " + control.nivel + "): " + valor + (resultado.reglas.length ? " — " + resultado.estado.toUpperCase() : ""));
          delete forzarCaptura[id];
          U.toast(resultado.estado === "rechazo" ? "🔴 Lectura guardada — quedó en RECHAZO según las reglas de Westgard." : resultado.estado === "aviso" ? "🟡 Lectura guardada — quedó en AVISO." : "🟢 Lectura guardada — en control.", resultado.estado === "rechazo" ? "error" : "success");
          build();
        });
      });
      root.querySelectorAll("[data-corregir]").forEach(function (b) {
        b.addEventListener("click", function () { forzarCaptura[b.dataset.corregir] = true; build(); });
      });
      root.querySelectorAll("[data-eliminar-lectura]").forEach(function (b) {
        b.addEventListener("click", function () {
          var control = controles.filter(function (c) { return c.id === b.dataset.control; })[0];
          var info = control ? analitoInfo(control.seccion, control.analitoCodigo) : null;
          if (!confirm('¿Eliminar la lectura de hoy' + (info ? " de \"" + info.nombre + " (" + control.nivel + ')"' : "") + '? Esta acción no se puede deshacer — úsala solo si el valor se digitó mal.')) return;
          S.qc.deleteLectura(b.dataset.eliminarLectura);
          S.addAudit(tenantId, session.nombre, session.rol, "QC_LECTURA_ELIMINADA", "control_calidad", b.dataset.control,
            "Eliminó una lectura de QC" + (info ? " (" + info.nombre + " " + control.nivel + ")" : "") + " por error de digitación.");
          U.toast("Lectura eliminada.", "success");
          cargar();
        });
      });
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
            "<td>" + mediaDsHtml(c, info.unidad) + "</td>" +
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
      control = control || { seccion: "quimica", analitoCodigo: "", nivel: "Normal", lote: "", media: "", ds: "", vencimiento: "", activo: true, dsOrigen: "inserto", rangoMin: "", rangoMax: "", rangoEnDS: 2 };
      // Un control ya existente SIN rango guardado (de antes de este ajuste,
      // o que el laboratorio ya recalculó con sus propios datos) arranca en
      // modo "propio" para no inventarle un rango de inserto que nunca tuvo.
      var origen = control.dsOrigen || (control.rangoMin != null && control.rangoMin !== "" ? "inserto" : (isEdit ? "propio" : "inserto"));
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Control" : "Nuevo Control de Calidad") + '</h3>' +
        '<form id="qc-form">' +
        '<div class="form-grid">' +
        F.sel("qcSeccion", "Sección", SECCIONES_QC.map(function (s) { return "<option value='" + s.id + "' " + (s.id === control.seccion ? "selected" : "") + ">" + s.emoji + " " + s.nombre + "</option>"; }).join("")) +
        '<div class="field"><label>Analito</label><select id="f_qcAnalito"></select></div>' +
        F.sel("qcNivel", "Nivel del Control", Q.NIVELES.map(function (n) { return "<option value='" + n + "' " + (n === control.nivel ? "selected" : "") + ">" + n + "</option>"; }).join("")) +
        F.inp("qcLote", "Número de Lote", control.lote) +
        F.inp("qcVencimiento", "Fecha de Vencimiento del Lote", control.vencimiento, false, "date") +
        "</div>" +
        '<div class="field" style="margin-top:4px"><label>¿De dónde salen la media y la DS de este control?</label>' +
        '<div class="crm-view-toggle"><button type="button" class="' + (origen === "inserto" ? "active" : "") + '" data-origen="inserto">📄 Datos del inserto</button>' +
        '<button type="button" class="' + (origen === "propio" ? "active" : "") + '" data-origen="propio">🔬 Datos propios del laboratorio</button></div></div>' +
        '<div id="qc-origen-inserto" class="form-grid" style="margin-top:6px">' +
        F.inp("qcMediaIns", "Media (valor objetivo impreso en el inserto)", control.media, false, "number") +
        F.inp("qcRangoMin", "Rango Mínimo Aceptable (del inserto)", control.rangoMin, false, "number") +
        F.inp("qcRangoMax", "Rango Máximo Aceptable (del inserto)", control.rangoMax, false, "number") +
        F.sel("qcRangoEnDS", "Ese rango representa", [2, 3].map(function (n) { return "<option value='" + n + "' " + ((control.rangoEnDS || 2) === n ? "selected" : "") + ">± " + n + " DE" + (n === 2 ? " (lo más común)" : "") + "</option>"; }).join("")) +
        "</div>" +
        '<p id="qc-ds-calculada" class="text-muted" style="font-size:12.5px;margin:2px 0 10px"></p>' +
        '<div id="qc-origen-propio" class="form-grid" style="margin-top:6px">' +
        F.inp("qcMediaProp", "Media (calculada con datos propios)", control.media, false, "number") +
        F.inp("qcDsProp", "Desviación Estándar (DS) calculada", control.ds, false, "number") +
        "</div>" +
        '<p class="text-muted" style="font-size:12.5px">La mayoría de insertos en Colombia y Venezuela no traen una "DS" impresa: traen una media y un rango aceptable (ej. "70,4 - 95,2"), que casi siempre representa la media ± 2 DE del fabricante — de ahí se calcula la DS que realmente usan las reglas de Westgard. Si tu laboratorio ya recalculó su propia media/DS tras acumular ~20 corridas (recomendado por CLSI), usa "Datos propios del laboratorio".</p>' +
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

      function actualizarDsCalculada() {
        if (origen !== "inserto") return;
        var min = parseFloat(wrap.querySelector("#f_qcRangoMin").value);
        var max = parseFloat(wrap.querySelector("#f_qcRangoMax").value);
        var nsd = parseFloat(wrap.querySelector("#f_qcRangoEnDS").value) || 2;
        var ds = dsDesdeRango(min, max, nsd);
        wrap.querySelector("#qc-ds-calculada").textContent = (ds != null && !isNaN(ds) && max > min)
          ? "DS calculada a partir del rango: " + (Math.round(ds * 100) / 100)
          : "Completa el rango mínimo y máximo (el máximo debe ser mayor que el mínimo) para calcular la DS.";
      }
      function actualizarVisibilidadOrigen() {
        wrap.querySelector("#qc-origen-inserto").style.display = origen === "inserto" ? "" : "none";
        wrap.querySelector("#qc-ds-calculada").style.display = origen === "inserto" ? "" : "none";
        wrap.querySelector("#qc-origen-propio").style.display = origen === "propio" ? "" : "none";
        actualizarDsCalculada();
      }
      wrap.querySelectorAll("[data-origen]").forEach(function (b) {
        b.addEventListener("click", function () {
          origen = b.dataset.origen;
          wrap.querySelectorAll("[data-origen]").forEach(function (x) { x.classList.toggle("active", x === b); });
          actualizarVisibilidadOrigen();
        });
      });
      wrap.querySelector("#f_qcRangoMin").addEventListener("input", actualizarDsCalculada);
      wrap.querySelector("#f_qcRangoMax").addEventListener("input", actualizarDsCalculada);
      wrap.querySelector("#f_qcRangoEnDS").addEventListener("change", actualizarDsCalculada);
      actualizarVisibilidadOrigen();

      wrap.querySelector("#qc-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value; };
        var data = {
          seccion: g("qcSeccion"), analitoCodigo: g("qcAnalito"), nivel: g("qcNivel"),
          lote: g("qcLote").trim(), vencimiento: g("qcVencimiento"), activo: true
        };
        if (origen === "inserto") {
          var mediaI = parseFloat(g("qcMediaIns"));
          var min = parseFloat(g("qcRangoMin")), max = parseFloat(g("qcRangoMax"));
          var nsd = parseFloat(g("qcRangoEnDS")) || 2;
          if (isNaN(mediaI) || isNaN(min) || isNaN(max)) { U.toast("Completa la media y el rango mínimo/máximo del inserto.", "error"); return; }
          if (max <= min) { U.toast("El rango máximo debe ser mayor que el mínimo.", "error"); return; }
          var dsCalc = dsDesdeRango(min, max, nsd);
          Object.assign(data, { media: mediaI, ds: Math.round(dsCalc * 100) / 100, dsOrigen: "inserto", rangoMin: min, rangoMax: max, rangoEnDS: nsd });
        } else {
          var mediaP = parseFloat(g("qcMediaProp")), dsP = parseFloat(g("qcDsProp"));
          if (isNaN(mediaP) || isNaN(dsP) || dsP <= 0) { U.toast("Ingresa una media y una DS válidas (DS mayor que 0).", "error"); return; }
          Object.assign(data, { media: mediaP, ds: dsP, dsOrigen: "propio", rangoMin: null, rangoMax: null });
        }
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
      // Sugerencia CLSI C24: tras ~20 corridas, lo recomendado es dejar de
      // usar la media/DS del inserto del fabricante (solo un punto de
      // partida) y pasar a la media/DS REAL calculada con los datos que ya
      // produjo el propio equipo del laboratorio — más representativa de
      // su desempeño real que el valor genérico de la caja del control.
      var statsPropias = lecturas.length >= 20 ? Q.estadisticas(lecturas.map(function (l) { return l.valor; })) : null;
      var sugerenciaHtml = "";
      if (statsPropias && statsPropias.ds) {
        var mediaR = Math.round(statsPropias.media * 100) / 100, dsR = Math.round(statsPropias.ds * 100) / 100;
        sugerenciaHtml = '<div class="card" style="background:var(--surface-2);box-shadow:none;margin:10px 0;padding:10px 12px">' +
          '<p style="margin:0 0 6px;font-size:13px"><b>📊 Recomendación CLSI C24:</b> ya tienes ' + lecturas.length + ' lecturas registradas. Puedes calcular tu propia media y DS con el desempeño real de tu equipo, en vez de seguir usando solo el valor del inserto: <b>Media ' + mediaR + '</b> · <b>DS ' + dsR + '</b> ' + U.esc(info.unidad) + '.</p>' +
          '<button type="button" class="btn btn-outline btn-sm" id="btn-usar-stats-propias">Usar estos valores como mi Media/DS</button>' +
          '</div>';
      }
      var wrap = U.openModal(
        '<h3 class="modal-title">📈 ' + U.esc(info.nombre) + " — " + U.esc(control.nivel) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Lote ' + U.esc(control.lote || "—") + " · Media " + control.media + " ± " + (Math.round(control.ds * 100) / 100) + " " + U.esc(info.unidad) +
        (control.dsOrigen === "inserto" && control.rangoMin != null ? " <span style='font-size:11px'>(rango inserto " + control.rangoMin + "–" + control.rangoMax + ", ± " + (control.rangoEnDS || 2) + " DE)</span>" : "") + '</p>' +
        sugerenciaHtml +
        (lecturas.length ? renderLJChart(lecturas, control.media, control.ds) : '<p class="text-muted">Aún no hay lecturas registradas para este control.</p>') +
        renderTablaLecturas(lecturas, control) +
        '<div class="flex justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>',
        { lg: true }
      );
      if (statsPropias && statsPropias.ds) {
        wrap.querySelector("#btn-usar-stats-propias").addEventListener("click", function () {
          if (!confirm("¿Usar la media y DS calculadas con tus propios datos (" + lecturas.length + " lecturas) en vez de los valores del inserto? Las próximas lecturas se evaluarán con estos nuevos valores.")) return;
          S.qc.updateControl(control.id, {
            media: Math.round(statsPropias.media * 100) / 100, ds: Math.round(statsPropias.ds * 100) / 100,
            dsOrigen: "propio", rangoMin: null, rangoMax: null
          });
          S.addAudit(tenantId, session.nombre, session.rol, "QC_RECALCULO", "control_calidad", control.id,
            "Recalculó Media/DS de QC (" + info.nombre + " " + control.nivel + ") con datos propios del laboratorio (" + lecturas.length + " lecturas).");
          U.toast("Media/DS actualizadas con datos propios del laboratorio.", "success");
          U.closeModal(wrap);
          cargar();
        });
      }
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

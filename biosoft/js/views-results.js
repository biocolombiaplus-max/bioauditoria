/* BIOsoft — Vistas: Captura, validación, remisión a laboratorio externo y corrección de resultados */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  window.BIO_VIEWS.resultados = function (root, param) {
    if (param) return renderCaptura(root, param);
    renderBandeja(root);
  };

  function puedeEditar(session, seccion) {
    if (session.rol === "admin" || session.rol === "superadmin") return true;
    // Un usuario de Recepción/Auxiliar/Asistente solo llega a esta pantalla
    // si ya tiene el permiso adicional "Resultados" (ver router.js ->
    // rutasPermitidas) — así que aquí ya no hace falta exigirle además una
    // sección puntual asignada: puede capturar cualquier examen de
    // cualquier sección (nunca valida/firma, ver puedeValidar). Antes se
    // exigía marcar secciones una por una y olvidar una era la causa más
    // común de "no me aparece el paciente para ingresar resultados".
    if (session.rol === "recepcion") return true;
    return session.secciones.indexOf(seccion) !== -1;
  }

  /* Validar y firmar un resultado es un acto clínico — se queda SIEMPRE
     exclusivo de Administrador y Bacteriólogo(a)/Bioanalista, sin importar
     qué permisos adicionales tenga un usuario de Recepción/Auxiliar. Ese
     perfil puede guardar borrador o marcar preliminar (ver puedeEditar),
     pero nunca ve el botón de validar. */
  function puedeValidar(session) {
    return session.rol === "admin" || session.rol === "superadmin" || session.rol === "bacteriologo";
  }

  function tuboChip(tuboKey) {
    var t = C.tuboInfo(tuboKey);
    return '<span class="chip" style="background:#fff"><span style="width:10px;height:10px;border-radius:50%;background:' + t.color + ';display:inline-block"></span>' + U.esc(t.nombre) + "</span>";
  }

  function renderBandeja(root) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var orders = S.listOrders(session.tenantId);
    var filtroEstado = "todos";
    var filtroSeccion = "todas";

    // Construye la fila de UN examen, aislada con su propio try/catch: un
    // dato viejo/corrupto en una sola orden ya no puede tumbar la bandeja
    // completa (antes un solo undefined en rows.map rompía TODA la tabla,
    // dejando a todo el laboratorio sin ver ningún examen de ninguna
    // orden). Si algo puntual falla, esa fila se marca y el resto se sigue
    // viendo con normalidad.
    function rowHtmlSeguro(r) {
      try {
        return rowHtml(r);
      } catch (err) {
        console.error("BIOsoft: fallo al mostrar la fila de un examen en la bandeja:", err);
        return "<tr><td colspan='7' class='text-danger'>⚠ No se pudo mostrar un examen de la orden " + U.esc((r.order && r.order.numeroOrden) || "") + " — contacta a soporte.</td></tr>";
      }
    }

    function build() {
      // Red de seguridad final: si algo no previsto rompe la construcción
      // de la bandeja, se ve el motivo exacto en pantalla (listo para
      // copiar a soporte) en vez de una pantalla en blanco sin explicación.
      try {
        var rows = [];
        orders.forEach(function (o) {
          (o.examenes || []).forEach(function (ex, idx) {
            if (!puedeEditar(session, ex.seccion)) return;
            rows.push({ order: o, ex: ex, idx: idx });
          });
        });
        rows = rows.filter(function (r) {
          var okEstado = filtroEstado === "todos" || r.ex.estado === filtroEstado || (filtroEstado === "pendiente" && r.ex.estado === "en_proceso");
          var okSec = filtroSeccion === "todas" || r.ex.seccion === filtroSeccion;
          return okEstado && okSec;
        });
        rows.sort(function (a, b) {
          var pr = { Urgente: 0, Rutina: 1 };
          return (pr[a.order.prioridad] - pr[b.order.prioridad]) || a.order.fechaOrden.localeCompare(b.order.fechaOrden);
        });

        root.innerHTML =
          '<div class="card"><div class="card-header"><h3 class="card-title">Bandeja de Resultados</h3>' +
          '<div class="flex gap-2 wrap">' +
          '<select id="f-estado"><option value="todos">Todos los estados</option><option value="pendiente">Pendientes</option><option value="preliminar">Preliminares</option><option value="validado">Validados</option><option value="remitido">Remitidos</option></select>' +
          '<select id="f-seccion"><option value="todas">Todas las secciones</option>' + C.seccionesEfectivas(tenant).map(function (s) { return '<option value="' + s.id + '">' + s.nombre + "</option>"; }).join("") + "</select>" +
          "</div></div>" +
          '<div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>N° Orden</th><th>Paciente</th><th>Examen</th><th>Sección</th><th>Estado</th><th></th></tr></thead><tbody>' +
          (rows.length ? rows.map(rowHtmlSeguro).join("") : '<tr><td colspan="7" class="text-muted">No hay exámenes que coincidan con el filtro.</td></tr>') +
          "</tbody></table></div></div>";

        document.getElementById("f-estado").value = filtroEstado;
        document.getElementById("f-seccion").value = filtroSeccion;
        document.getElementById("f-estado").addEventListener("change", function (e) { filtroEstado = e.target.value; build(); });
        document.getElementById("f-seccion").addEventListener("change", function (e) { filtroSeccion = e.target.value; build(); });
        root.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/resultados/" + b.dataset.go; }); });
      } catch (err) {
        console.error("BIOsoft: fallo al mostrar la Bandeja de Resultados:", err);
        root.innerHTML = '<div class="card"><p class="text-danger" style="margin:0"><b>No se pudo mostrar la Bandeja de Resultados.</b></p>' +
          '<p class="text-muted" style="font-size:12.5px;margin:6px 0 0">Envía una captura de este mensaje a soporte: <code>' + U.esc(String((err && err.message) || err)) + "</code></p></div>";
      }
    }

    function rowHtml(r) {
      var pac = S.getPatient(r.order.patientId);
      // Si el examen de esta fila ya no existe en el catálogo (se eliminó o
      // se renombró después de crear la orden), examenEfectivo() devuelve
      // undefined — antes esto tumbaba TODA la bandeja (rows.map crashea
      // por completo con un solo undefined), dejando a todo el laboratorio
      // sin ver ningún examen de ninguna orden. Ahora esa fila puntual se
      // marca como no disponible y el resto de la bandeja se sigue viendo
      // con normalidad.
      var exCat = C.examenEfectivo(r.ex.examId, tenant);
      var nombreExamen = exCat ? U.esc(exCat.nombre) : '<span class="text-danger">⚠ Examen no disponible (código ' + U.esc(r.ex.examId) + ")</span>";
      return "<tr><td>" + '<span class="badge badge-' + (r.order.prioridad === "Urgente" ? "urgente" : "rutina") + '">' + r.order.prioridad + "</span></td>" +
        "<td>" + r.order.numeroOrden + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + nombreExamen + "</td><td>" + C.seccionNombre(r.ex.seccion, tenant) + "</td>" +
        "<td>" + window.BIO_badgeEstado(r.ex.estado === "en_proceso" ? "pendiente" : r.ex.estado) + '</td><td><button class="btn btn-outline btn-sm" data-go="' + r.order.id + '">Abrir</button></td></tr>';
    }
    build();
  }

  function renderCaptura(root, orderId) {
    var session = BIO_AUTH.getSession();
    var order = S.getOrder(orderId);
    if (!order) { root.innerHTML = '<div class="card">Orden no encontrada.</div>'; return; }
    var pac = S.getPatient(order.patientId);
    var tenant = BIO_AUTH.currentTenant();

    // Registro de todos los parámetros "calculados" (ej. LDL, Globulinas)
    // de ESTA orden, sin importar en qué tarjeta de examen estén — un
    // valor calculado casi siempre depende de parámetros de OTROS
    // exámenes (ej. LDL necesita Colesterol Total, HDL y Triglicéridos,
    // cada uno su propio examen), no solo de los de su propia tarjeta. Se
    // reconstruye entero cada vez que build() vuelve a renderizar todas
    // las tarjetas (ver buildExamCard, donde cada tarjeta registra los
    // suyos).
    var formulasCalculadas = {};

    // Recalcula TODOS los parámetros calculados de la orden a partir de
    // los valores actuales en pantalla (de cualquier tarjeta) — se llama
    // cada vez que el usuario edita un campo que NO es en sí mismo
    // calculado (ver el listener "input" más abajo; si se llamara también
    // para los campos calculados se entraría en un loop con su propio
    // dispatchEvent). No usa eval()/Function(): ver C.evaluarFormula en
    // catalog.js, un intérprete propio y chico de +,-,*,/ y paréntesis.
    function recalcularCalculados() {
      var contenedor = document.getElementById("exam-cards");
      if (!contenedor) return;
      var valores = {};
      // Primero los valores YA GUARDADOS de toda la orden — cubre un
      // examen del que depende la fórmula pero que ya quedó validado/
      // bloqueado (sin campo editable en pantalla, ver
      // renderCapturaNormalReadOnly) — y luego se sobrescriben con lo que
      // haya en pantalla ahora mismo, para los exámenes aún pendientes de
      // guardar.
      (order.examenes || []).forEach(function (ex) { (ex.valores || []).forEach(function (v) { valores[v.codigo] = v.valor; }); });
      contenedor.querySelectorAll("[data-param]").forEach(function (el) { valores[el.dataset.param] = el.value; });
      Object.keys(formulasCalculadas).forEach(function (codigo) {
        var el = contenedor.querySelector('[data-param="' + codigo + '"]');
        if (!el) return;
        var valorNuevo = "";
        try {
          var resultado = C.evaluarFormula(formulasCalculadas[codigo], valores);
          if (isFinite(resultado)) valorNuevo = String(Math.round(resultado * 100) / 100);
        } catch (e) {
          valorNuevo = "";
        }
        if (el.value !== valorNuevo) { el.value = valorNuevo; el.dispatchEvent(new Event("input")); }
      });
    }

    function build() {
      var puedeRemision = window.BIO_REMISION && window.BIO_REMISION.puedeGestionar(session);
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Orden ' + order.numeroOrden + " · " + (pac ? U.esc(U.nombreCompleto(pac)) : "") + '</h3>' +
        '<div class="flex gap-2 wrap"><a class="btn btn-ghost btn-sm" id="btn-back">Volver a la bandeja</a>' +
        (puedeRemision ? '<button class="btn btn-outline btn-sm" id="btn-remision">' + U.icon("send") + " Hoja de Remisión</button>" : "") +
        "</div></div>" +
        '<p class="text-muted" style="margin:0">' + (pac ? U.edadTexto(pac) + " · " + pac.sexo + " · " + (pac.eps || "Particular") : "") + " · Médico remitente: " + U.esc(order.medicoRemitente || "—") + "</p></div>" +
        '<div id="exam-cards" style="margin-top:16px"></div>';
      document.getElementById("btn-back").addEventListener("click", function () { location.hash = "#/resultados"; });
      var btnRemision = document.getElementById("btn-remision");
      if (btnRemision) btnRemision.addEventListener("click", function () { window.BIO_REMISION.abrir(order, pac, tenant, build); });

      var host = document.getElementById("exam-cards");
      // Red de seguridad final: pase lo que pase al construir los exámenes
      // de esta orden (dato viejo/corrupto, un contenedor que no se
      // encontró, cualquier cosa no prevista), la pantalla YA NUNCA debe
      // quedar en blanco sin explicación — como mínimo se ve el motivo
      // exacto en pantalla, listo para copiar y mandar a soporte, en vez de
      // un espacio vacío que no dice nada.
      try {
        if (!host) throw new Error("No se encontró el contenedor de exámenes de la orden.");
        if (!order.examenes || !order.examenes.length) {
          host.innerHTML = '<div class="card"><p class="text-muted" style="margin:0">Esta orden no tiene ningún examen registrado.</p></div>';
          return;
        }
        // Muestra las tarjetas de examen en el orden que el laboratorio haya
        // personalizado (tenant.ordenExamenes), no en el orden en que se
        // agregaron a la orden — así el bacteriólogo(a) las ve en el orden
        // con el que ya está acostumbrado a trabajar.
        var examenesOrdenados = C.ordenarPorExamen(order.examenes, tenant, function (ex) { return (ex && ex.examId) || ""; });
        // Cada tarjeta se construye por separado, con su propio try/catch:
        // un fallo inesperado en UN examen (dato viejo/corrupto, catálogo
        // editado, etc.) ya no puede tumbar la pantalla completa de
        // resultados — el resto de los exámenes de la orden se siguen
        // viendo y editando con normalidad, y el roto queda señalado con un
        // aviso.
        examenesOrdenados.forEach(function (ex, idx) {
          try {
            host.appendChild(buildExamCard(ex, idx));
          } catch (err) {
            console.error("BIOsoft: fallo al construir la tarjeta del examen " + (ex && ex.examId) + ":", err);
            var aviso = document.createElement("div");
            aviso.className = "card";
            aviso.style.marginBottom = "14px";
            aviso.innerHTML = '<div class="card-header"><h3 class="card-title text-danger">' + U.icon("lock") + " Examen no disponible</h3></div>" +
              '<p class="text-muted" style="margin:8px 0 0">Hubo un problema al mostrar este examen. Contacta a soporte para revisarlo — los demás exámenes de esta orden se pueden ver e ingresar con normalidad.</p>' +
              '<p class="text-muted" style="margin:6px 0 0;font-size:11px">Detalle técnico: <code>' + U.esc(String((err && err.message) || err)) + "</code></p>";
            host.appendChild(aviso);
          }
        });
        // Recalcula de una vez los parámetros calculados (ej. LDL,
        // Globulinas) con los valores ya guardados de esta orden — así se
        // ve el valor correcto al abrir la orden, sin esperar a que se
        // edite algún campo primero.
        recalcularCalculados();
      } catch (err) {
        console.error("BIOsoft: fallo al mostrar los exámenes de esta orden:", err);
        var mensajeError = '<div class="card"><p class="text-danger" style="margin:0"><b>No se pudieron mostrar los exámenes de esta orden.</b></p>' +
          '<p class="text-muted" style="font-size:12.5px;margin:6px 0 0">Envía una captura de este mensaje a soporte: <code>' + U.esc(String((err && err.message) || err)) + "</code></p></div>";
        if (host) host.innerHTML = mensajeError; else root.insertAdjacentHTML("beforeend", mensajeError);
      }
    }

    function buildExamCard(ex, idx) {
      // Las categorías elegidas a mano (ej. "Fase Folicular" para un
      // parámetro con varios rangos que aplican igual a la paciente, sin
      // poder distinguirse solo por sexo/edad) se guardan junto con cada
      // valor — se recuperan aquí para que al reabrir la orden se siga
      // viendo/usando la misma categoría, y se completan con la selección
      // automática por defecto para los parámetros que aún no tienen una.
      var categoriaOverrides = C.categoriasDeValores(ex.valores || []);
      var exCat;
      function actualizarExCat() {
        exCat = C.examenParaPaciente(ex.examId, tenant, pac, categoriaOverrides);
        if (!exCat) return;
        exCat.parametros.forEach(function (p) {
          if (p.bandaEtiqueta && !categoriaOverrides[p.codigo]) categoriaOverrides[p.codigo] = p.bandaEtiqueta;
        });
      }
      actualizarExCat();
      var card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "14px";
      // Un examen de la orden puede quedar apuntando a un código que ya no
      // existe en el catálogo del laboratorio (se eliminó o se renombró
      // desde Configuración → Catálogo, después de que esta orden ya se
      // había creado). Antes esto rompía la construcción de ESTA tarjeta a
      // mitad de camino, y como todas las tarjetas se agregan en un mismo
      // forEach (ver build() más abajo), el error tumbaba TODA la pantalla
      // de resultados dejándola en blanco — para cualquier usuario, no solo
      // para Recepción/Auxiliar. Aquí se aísla: se avisa con claridad de
      // cuál examen específico quedó roto, y el resto de la orden se sigue
      // viendo y editando con total normalidad.
      if (!exCat) {
        card.innerHTML = '<div class="card-header"><div><h3 class="card-title text-danger">' + U.icon("lock") + " Examen no disponible</h3>" +
          '<span class="text-muted" style="font-size:12px">Código: ' + U.esc(ex.examId) + "</span></div></div>" +
          '<p class="text-muted" style="margin:8px 0 0">Este examen ya no existe en el catálogo de tu laboratorio (puede que se haya eliminado o renombrado desde Configuración → Catálogo después de crear esta orden). Contacta a soporte para revisarlo — mientras tanto, los demás exámenes de esta orden se pueden ver e ingresar con normalidad.</p>';
        return card;
      }
      var editable = puedeEditar(session, ex.seccion);
      var locked = ex.estado === "validado" || ex.estado === "remitido";
      var modoRemision = !!ex.remitido;
      var pdfPendienteDataUrl = "";
      var pdfPendienteNombre = "";

      var valuesMap = {};
      (ex.valores || []).forEach(function (v) { valuesMap[v.codigo] = v.valor; });

      // Estado en memoria de cada parámetro tipo "panel" (antibiograma /
      // alergia): un arreglo de ítems elegidos del catálogo maestro, cada
      // uno con su propio resultado. Vive aparte de valuesMap porque no es
      // un string simple — se serializa a JSON solo al guardar (collectValues).
      var panelState = {};
      exCat.parametros.forEach(function (p) {
        if (p.tipo === "panel") panelState[p.codigo] = C.parsePanelValor(valuesMap[p.codigo]);
      });

      function headerHtml() {
        return '<div class="card-header"><div><h3 class="card-title">' + U.esc(exCat.nombre) + '</h3>' +
          '<span class="text-muted" style="font-size:12px">' + C.seccionNombre(ex.seccion, tenant) + (exCat.cups ? " · CUPS " + U.esc(exCat.cups) : "") + (exCat.muestra ? " · Muestra: " + U.esc(exCat.muestra) : "") + (exCat.metodo ? " · Método: " + U.esc(exCat.metodo) : "") + "</span>" +
          '<div style="margin-top:6px">' + tuboChip(exCat.tubo) +
          (ex.recibidoDeEquipo ? ' <span class="chip" style="background:#eef2ff;color:#4338ca">🔌 Recibido de ' + U.esc(ex.equipoOrigen || "equipo") + (ex.estado !== "validado" ? " — revisa antes de validar" : "") + "</span>" : "") +
          "</div></div>" +
          window.BIO_badgeEstado(ex.estado === "en_proceso" ? "pendiente" : ex.estado) + "</div>";
      }

      function renderReadOnlyRemitido() {
        card.innerHTML = headerHtml() +
          '<div class="card" style="background:var(--surface-2);box-shadow:none">' +
          '<p style="margin:0"><b>Examen remitido a laboratorio de referencia</b></p>' +
          '<p class="text-muted" style="margin:4px 0">Laboratorio: <b>' + U.esc(ex.laboratorioRemision || "—") + "</b> · Recibido: " + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + " · Registrado por: " + U.esc(ex.validadoPor || "—") + "</p>" +
          '<div class="flex gap-2 wrap" style="margin-top:8px">' +
          (ex.pdfRemitidoDataUrl ? '<button class="btn btn-outline btn-sm" data-action="verpdf">' + U.icon("file") + " Ver PDF Remitido</button>" : "") +
          (editable ? '<button class="btn btn-danger btn-sm" data-action="corregir">' + U.icon("lock") + " Reemplazar PDF (requiere clave admin)</button>" : "") +
          "</div></div>" +
          (ex.correcciones && ex.correcciones.length ? '<p class="text-muted" style="font-size:12px;margin-top:8px">' + U.icon("history") + " Este examen tiene " + ex.correcciones.length + " corrección(es) registrada(s) en la trazabilidad." : "");

        var bv = card.querySelector('[data-action="verpdf"]');
        if (bv) bv.addEventListener("click", function () { U.openDataUrlInNewTab(ex.pdfRemitidoDataUrl); });
        var bc = card.querySelector('[data-action="corregir"]');
        if (bc) bc.addEventListener("click", function () { abrirCorreccion(ex, exCat, order, build); });
      }

      function renderFormularioRemision() {
        card.innerHTML = headerHtml() +
          '<p class="text-muted">Marca este examen como remitido cuando se envía a procesar en un laboratorio externo más especializado. El PDF que subas aquí será el que se le entregue al paciente para este examen, conforme a la Resolución 3100.</p>' +
          (editable ? '<div class="checkbox-row" style="margin-bottom:12px"><input type="checkbox" id="chk-remitido" checked/><label style="margin:0" for="chk-remitido">Este examen se remite a un laboratorio externo</label></div>' : "") +
          '<div class="form-grid">' +
          '<div class="field"><label>Laboratorio de Referencia *</label><input id="f-labref" value="' + U.esc(ex.laboratorioRemision || "") + '" placeholder="Ej: Laboratorio Especializado XYZ"/></div>' +
          '<div class="field"><label>PDF del Informe Remitido *</label><input type="file" id="f-pdfref" accept="application/pdf"/></div>' +
          "</div>" +
          '<div id="pdfref-preview" class="text-muted" style="font-size:12.5px">' + (ex.pdfRemitidoNombre ? "Archivo actual: " + U.esc(ex.pdfRemitidoNombre) : "Sin archivo cargado") + "</div>" +
          '<div class="flex gap-2 wrap" style="margin-top:12px">' +
          '<button class="btn btn-primary btn-sm" data-action="guardar-remision">' + U.icon("check") + " Guardar Remisión</button>" +
          "</div>";

        var chk = card.querySelector("#chk-remitido");
        if (chk) chk.addEventListener("change", function () { if (!chk.checked) { modoRemision = false; renderCapturaNormal(); } });
        card.querySelector("#f-pdfref").addEventListener("change", function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            pdfPendienteDataUrl = ev.target.result;
            pdfPendienteNombre = file.name;
            card.querySelector("#pdfref-preview").textContent = "Archivo seleccionado: " + file.name;
          };
          reader.readAsDataURL(file);
        });
        card.querySelector('[data-action="guardar-remision"]').addEventListener("click", function () {
          var lab = card.querySelector("#f-labref").value.trim();
          var pdf = pdfPendienteDataUrl || ex.pdfRemitidoDataUrl;
          var pdfNombre = pdfPendienteNombre || ex.pdfRemitidoNombre;
          if (!lab) { U.toast("Indica el nombre del laboratorio de referencia.", "error"); return; }
          if (!pdf) { U.toast("Adjunta el PDF del informe remitido.", "error"); return; }
          ex.remitido = true; ex.laboratorioRemision = lab; ex.pdfRemitidoDataUrl = pdf; ex.pdfRemitidoNombre = pdfNombre;
          ex.estado = "remitido"; ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId; ex.fechaValidacion = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          S.addAudit(session.tenantId, session.nombre, session.rol, "MARK_REFERRED_EXAM", "resultado", order.id + ":" + ex.examId, "Registró remisión de " + exCat.nombre + " al laboratorio " + lab + " (Orden " + order.numeroOrden + ").");
          U.toast("Remisión registrada.", "success");
          card.replaceWith(buildExamCard(ex, idx));
        });
      }

      // Sincroniza lo que el usuario ya haya escrito/seleccionado en pantalla
      // antes de reconstruir la tarjeta (ej. al cambiar una categoría) — para
      // no perder valores ya digitados en otros parámetros.
      function sincronizarValuesMapDesdeDOM() {
        card.querySelectorAll("[data-param]").forEach(function (el) { valuesMap[el.dataset.param] = el.value; });
      }

      // ---------------------------------------------------------------
      // Parámetros tipo "panel" (antibiograma / alergia): el bacteriólogo
      // elige de un catálogo maestro qué ítems aplican a este caso concreto
      // (no todos los urocultivos se prueban contra los mismos antibióticos)
      // y captura un resultado por cada uno. Si falta un ítem en el
      // catálogo, se agrega ahí mismo y queda disponible para la próxima vez.
      // ---------------------------------------------------------------
      function panelBoxHtml(p) {
        var catalogo = C.panelCatalogo(tenant, p.panelTipo);
        var items = panelState[p.codigo] || [];
        var agregados = {};
        items.forEach(function (it) { agregados[it.codigo] = true; });
        var frecuentes = C.panelFrecuentes(p.panelTipo).map(function (cod) { return catalogo.filter(function (c) { return c.codigo === cod; })[0]; }).filter(function (c) { return c && !agregados[c.codigo]; });
        var disponibles = catalogo.filter(function (c) { return !agregados[c.codigo]; });

        var controlesHtml = !editable ? "" :
          (frecuentes.length ? '<div class="flex gap-2 wrap" style="margin-bottom:8px">' +
            frecuentes.map(function (c) { return '<button type="button" class="btn btn-outline btn-sm" data-panel-quick="' + p.codigo + ':' + c.codigo + '">+ ' + U.esc(c.nombre) + "</button>"; }).join("") +
            "</div>" : "") +
          '<div class="flex gap-2 wrap" style="margin-bottom:8px">' +
          '<select data-panel-sel="' + p.codigo + '" style="flex:1;min-width:200px"><option value="">' + (p.panelTipo === "alergia" ? "Buscar y agregar alérgeno…" : "Buscar y agregar antibiótico…") + "</option>" +
          disponibles.map(function (c) { return '<option value="' + U.esc(c.codigo) + '">' + U.esc(c.nombre) + "</option>"; }).join("") +
          "</select>" +
          '<button type="button" class="btn btn-outline btn-sm" data-panel-addsel="' + p.codigo + '">Agregar</button>' +
          "</div>" +
          '<div class="flex gap-2 wrap" style="margin-bottom:12px">' +
          '<input type="text" data-panel-nuevo="' + p.codigo + '" placeholder="¿No está en la lista? Escribe el nombre y agrégalo…" style="flex:1;min-width:200px"/>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-panel-addnuevo="' + p.codigo + '">' + U.icon("plus") + " Agregar nuevo</button>" +
          "</div>";

        return '<div class="card" style="background:var(--surface-2);box-shadow:none;margin-top:14px">' +
          "<h4 style='margin:0 0 2px'>" + U.esc(p.nombre) + "</h4>" +
          (p.refText ? '<p class="text-muted" style="font-size:12px;margin:0 0 10px">' + U.esc(p.refText) + "</p>" : "") +
          controlesHtml +
          '<div data-panel-tabla="' + p.codigo + '">' + panelTablaHtml(p) + "</div>" +
          "</div>";
      }

      function panelTablaHtml(p, soloLectura) {
        var interactivo = editable && !soloLectura;
        var items = panelState[p.codigo] || [];
        if (!items.length) return '<p class="text-muted" style="font-size:12.5px;margin:0">Aún no se ha agregado ningún ' + (p.panelTipo === "alergia" ? "alérgeno" : "antibiótico") + ".</p>";
        if (p.panelTipo === "alergia") {
          return '<div class="table-wrap"><table><thead><tr><th>Alérgeno</th><th>Conc. IgE (kU/L)</th><th>Clase</th><th>Interpretación</th>' + (interactivo ? "<th></th>" : "") + "</tr></thead><tbody>" +
            items.map(function (it) {
              var c = it.valor !== "" && it.valor != null ? C.claseIgE(it.valor) : null;
              return "<tr><td>" + U.esc(it.nombre) + "</td><td style='min-width:110px'><input type='number' step='any' data-panel-res='" + p.codigo + ":" + it.codigo + "' value='" + U.esc(it.valor || "") + "' " + (!interactivo ? "disabled" : "") + "/></td>" +
                "<td data-panel-clase='" + p.codigo + ":" + it.codigo + "'>" + (c ? c.clase : "—") + "</td>" +
                "<td data-panel-interp='" + p.codigo + ":" + it.codigo + "'>" + (c ? '<span class="flag-' + (c.interpretacion === "Positivo" ? "alto" : "normal") + '">' + c.interpretacion + "</span>" : "—") + "</td>" +
                (interactivo ? "<td><button type='button' class='btn btn-ghost btn-sm' data-panel-quitar='" + p.codigo + ":" + it.codigo + "'>✕</button></td>" : "") + "</tr>";
            }).join("") + "</tbody></table></div>";
        }
        // La Concentración Inhibitoria Mínima (CIM, µg/mL) es opcional —
        // solo se muestra esta columna extra si el laboratorio la activó
        // en Configuración (tenant.reportarCIM); muchos laboratorios
        // trabajan solo con disco-difusión (Sensible/Intermedio/
        // Resistente) y no necesitan digitar ningún número aparte.
        var conCIM = !!tenant.reportarCIM;
        return '<div class="table-wrap"><table><thead><tr><th>Antibiótico</th><th>Resultado</th>' + (conCIM ? "<th>CIM (µg/mL)</th>" : "") + (interactivo ? "<th></th>" : "") + "</tr></thead><tbody>" +
          items.map(function (it) {
            return "<tr><td>" + U.esc(it.nombre) + "</td><td style='min-width:160px'><select data-panel-res='" + p.codigo + ":" + it.codigo + "' " + (!interactivo ? "disabled" : "") + "><option value=''>— Seleccionar —</option>" +
              C.RESULTADOS_ANTIBIOGRAMA.map(function (o) { return "<option " + (o === it.resultado ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select></td>" +
              (conCIM ? "<td style='min-width:90px'><input data-panel-cim='" + p.codigo + ":" + it.codigo + "' value='" + U.esc(it.cim || "") + "' placeholder='Ej: ≤0.5' " + (!interactivo ? "disabled" : "") + "/></td>" : "") +
              (interactivo ? "<td><button type='button' class='btn btn-ghost btn-sm' data-panel-quitar='" + p.codigo + ":" + it.codigo + "'>✕</button></td>" : "") + "</tr>";
          }).join("") + "</tbody></table></div>";
      }

      function wirePanelBox(p) {
        var cajaWrap = card.querySelector('[data-panel-tabla="' + p.codigo + '"]').closest(".card");
        function reRenderCaja() { cajaWrap.outerHTML = panelBoxHtml(p); wirePanelBox(p); }

        function agregarItem(item) {
          if ((panelState[p.codigo] || []).some(function (it) { return it.codigo === item.codigo; })) return;
          panelState[p.codigo] = (panelState[p.codigo] || []).concat([p.panelTipo === "alergia" ? { codigo: item.codigo, nombre: item.nombre, valor: "" } : { codigo: item.codigo, nombre: item.nombre, resultado: "", cim: "" }]);
          reRenderCaja();
        }

        cajaWrap.querySelectorAll("[data-panel-quick]").forEach(function (b) {
          b.addEventListener("click", function () {
            var codItem = b.dataset.panelQuick.split(":")[1];
            var item = C.panelCatalogo(tenant, p.panelTipo).filter(function (c) { return c.codigo === codItem; })[0];
            if (item) agregarItem(item);
          });
        });
        var selEl = cajaWrap.querySelector('[data-panel-sel="' + p.codigo + '"]');
        var btnAddSel = cajaWrap.querySelector('[data-panel-addsel="' + p.codigo + '"]');
        if (btnAddSel) btnAddSel.addEventListener("click", function () {
          if (!selEl.value) return;
          var item = C.panelCatalogo(tenant, p.panelTipo).filter(function (c) { return c.codigo === selEl.value; })[0];
          if (item) agregarItem(item);
        });
        var inpNuevo = cajaWrap.querySelector('[data-panel-nuevo="' + p.codigo + '"]');
        var btnAddNuevo = cajaWrap.querySelector('[data-panel-addnuevo="' + p.codigo + '"]');
        if (btnAddNuevo) btnAddNuevo.addEventListener("click", function () {
          var nombre = inpNuevo.value.trim();
          if (!nombre) { U.toast("Escribe el nombre antes de agregarlo.", "error"); return; }
          var nuevo = C.panelAgregarPersonalizado(tenant, p.panelTipo, nombre);
          S.updateTenant(tenant.id, p.panelTipo === "alergia" ? { alergenosPersonalizados: tenant.alergenosPersonalizados } : { antibioticosPersonalizados: tenant.antibioticosPersonalizados });
          agregarItem(nuevo);
          U.toast((p.panelTipo === "alergia" ? "Alérgeno" : "Antibiótico") + ' "' + nombre + '" agregado al catálogo del laboratorio.', "success");
        });
        cajaWrap.querySelectorAll("[data-panel-quitar]").forEach(function (b) {
          b.addEventListener("click", function () {
            var codItem = b.dataset.panelQuitar.split(":")[1];
            panelState[p.codigo] = (panelState[p.codigo] || []).filter(function (it) { return it.codigo !== codItem; });
            reRenderCaja();
          });
        });
        cajaWrap.querySelectorAll("select[data-panel-res]").forEach(function (sel) {
          sel.addEventListener("change", function () {
            var codItem = sel.dataset.panelRes.split(":")[1];
            var it = (panelState[p.codigo] || []).filter(function (x) { return x.codigo === codItem; })[0];
            if (it) it.resultado = sel.value;
          });
        });
        cajaWrap.querySelectorAll("input[data-panel-cim]").forEach(function (inp) {
          inp.addEventListener("input", function () {
            var codItem = inp.dataset.panelCim.split(":")[1];
            var it = (panelState[p.codigo] || []).filter(function (x) { return x.codigo === codItem; })[0];
            if (it) it.cim = inp.value;
          });
        });
        cajaWrap.querySelectorAll("input[data-panel-res]").forEach(function (inp) {
          inp.addEventListener("input", function () {
            var codItem = inp.dataset.panelRes.split(":")[1];
            var it = (panelState[p.codigo] || []).filter(function (x) { return x.codigo === codItem; })[0];
            if (!it) return;
            it.valor = inp.value;
            var c = inp.value !== "" ? C.claseIgE(inp.value) : null;
            var celdaClase = cajaWrap.querySelector('[data-panel-clase="' + p.codigo + ':' + codItem + '"]');
            var celdaInterp = cajaWrap.querySelector('[data-panel-interp="' + p.codigo + ':' + codItem + '"]');
            if (celdaClase) celdaClase.textContent = c ? c.clase : "—";
            if (celdaInterp) celdaInterp.innerHTML = c ? '<span class="flag-' + (c.interpretacion === "Positivo" ? "alto" : "normal") + '">' + c.interpretacion + "</span>" : "—";
          });
        });
      }

      // ---------------------------------------------------------------
      // Sugerencias rápidas para parámetros tipo "texto" con germen
      // aislado — el catálogo de microorganismos que se ofrece depende
      // del TIPO DE MUESTRA de ese examen (p.sugerencias: "urocultivo",
      // "hemocultivo", "respiratorio", "faringeo", "otico",
      // "piel_heridas", "vaginal", "coprocultivo" — ver germenesEfectivos()
      // en catalog.js), igual que en un laboratorio de referencia grande,
      // donde los "gérmenes esperados" que sugiere el sistema cambian
      // según de dónde viene la muestra. A diferencia del panel de
      // antibiograma/alergia, aquí no se arma una tabla de ítems — el
      // clic simplemente escribe en el mismo textarea de siempre, que
      // sigue siendo 100% editable a mano igual que antes.
      // ---------------------------------------------------------------
      function sugerenciasHtml(p) {
        if (!p.sugerencias) return "";
        var tipo = p.sugerencias;
        var catalogo = C.germenesEfectivos(tenant, tipo);
        var frecuentes = C.germenesFrecuentes(tipo).map(function (cod) { return catalogo.filter(function (g) { return g.codigo === cod; })[0]; }).filter(Boolean);
        // Agrupados por tipo (gram negativos / gram positivos / hongos) en
        // vez de una sola fila revuelta, para que el bacteriólogo escanee
        // más rápido qué botón corresponde a lo que está viendo al
        // microscopio o en la placa de cultivo.
        var grupos = C.germenesGruposOrden(tipo).map(function (nombreGrupo) {
          return { nombre: nombreGrupo, germenes: frecuentes.filter(function (g) { return g.grupo === nombreGrupo; }) };
        }).filter(function (gr) { return gr.germenes.length; });
        var sinGrupo = frecuentes.filter(function (g) { return !g.grupo; });
        if (sinGrupo.length) grupos.push({ nombre: null, germenes: sinGrupo });
        return '<div style="margin-top:6px" data-sugerencias-box="' + p.codigo + '">' +
          '<div style="margin-bottom:8px">' +
          '<button type="button" class="btn btn-outline btn-sm" style="border-color:var(--brand-primary);color:var(--brand-primary);font-weight:700" data-germen-negativo="' + p.codigo + '">✓ Sin crecimiento (Negativo)</button>' +
          "</div>" +
          '<p class="text-muted" style="font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.03em;font-weight:700">Germen aislado — selección rápida:</p>' +
          grupos.map(function (gr) {
            return '<div style="margin-bottom:6px">' +
              (gr.nombre ? '<div class="text-muted" style="font-size:11px;margin-bottom:3px">' + U.esc(gr.nombre) + "</div>" : "") +
              '<div class="flex gap-2 wrap">' +
              gr.germenes.map(function (g) { return '<button type="button" class="btn btn-outline btn-sm" data-germen-sel="' + p.codigo + ":" + g.codigo + '">+ ' + U.esc(g.nombre) + "</button>"; }).join("") +
              "</div></div>";
          }).join("") +
          '<div class="flex gap-2 wrap" style="margin-bottom:4px">' +
          '<select data-germen-buscar="' + p.codigo + '" style="flex:1;min-width:180px;font-size:12.5px"><option value="">Buscar otro microorganismo…</option>' +
          catalogo.map(function (g) { return '<option value="' + U.esc(g.codigo) + '">' + U.esc(g.nombre) + "</option>"; }).join("") +
          "</select>" +
          '<button type="button" class="btn btn-outline btn-sm" data-germen-addsel="' + p.codigo + '">Agregar</button>' +
          "</div>" +
          '<div class="flex gap-2 wrap">' +
          '<input type="text" data-germen-nuevo="' + p.codigo + '" placeholder="¿No está en la lista? Escribe el nombre…" style="flex:1;min-width:180px;font-size:12.5px"/>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-germen-addnuevo="' + p.codigo + '">' + U.icon("plus") + " Agregar</button>" +
          "</div></div>";
      }

      function wireSugerencias(p) {
        var tipo = p.sugerencias;
        var box = card.querySelector('[data-sugerencias-box="' + p.codigo + '"]');
        var textarea = card.querySelector('[data-param="' + p.codigo + '"]');
        if (!box || !textarea) return;

        function aplicarGermen(nombre) {
          // Si el bacteriólogo ya escribió algo a mano (ej. el recuento en
          // UFC/mL), el germen se agrega al final en vez de borrarlo.
          var actual = textarea.value.trim();
          textarea.value = actual ? (actual + " — " + nombre) : nombre;
          textarea.dispatchEvent(new Event("input"));
          textarea.focus();
        }

        var btnNeg = box.querySelector("[data-germen-negativo]");
        if (btnNeg) btnNeg.addEventListener("click", function () {
          textarea.value = p.refText;
          textarea.dispatchEvent(new Event("input"));
          textarea.focus();
        });
        box.querySelectorAll("[data-germen-sel]").forEach(function (b) {
          b.addEventListener("click", function () {
            var codItem = b.dataset.germenSel.split(":")[1];
            var item = C.germenesEfectivos(tenant, tipo).filter(function (g) { return g.codigo === codItem; })[0];
            if (item) aplicarGermen(item.nombre);
          });
        });
        var selBuscar = box.querySelector("[data-germen-buscar]");
        var btnAddSel = box.querySelector("[data-germen-addsel]");
        if (btnAddSel) btnAddSel.addEventListener("click", function () {
          if (!selBuscar.value) return;
          var item = C.germenesEfectivos(tenant, tipo).filter(function (g) { return g.codigo === selBuscar.value; })[0];
          if (item) aplicarGermen(item.nombre);
        });
        var inpNuevo = box.querySelector("[data-germen-nuevo]");
        var btnAddNuevo = box.querySelector("[data-germen-addnuevo]");
        if (btnAddNuevo) btnAddNuevo.addEventListener("click", function () {
          var nombre = inpNuevo.value.trim();
          if (!nombre) { U.toast("Escribe el nombre antes de agregarlo.", "error"); return; }
          var nuevo = C.crearGermenPersonalizado(tenant, tipo, nombre);
          S.updateTenant(tenant.id, tipo === "urocultivo" ? { germenesUrinariosPersonalizados: tenant.germenesUrinariosPersonalizados } : { germenesPersonalizadosPorTipo: tenant.germenesPersonalizadosPorTipo });
          aplicarGermen(nuevo.nombre);
          // Refresca el buscador para que el nuevo microorganismo quede
          // disponible ahí mismo la próxima vez, sin perder lo que el
          // bacteriólogo ya escribió en el textarea.
          box.outerHTML = sugerenciasHtml(p);
          wireSugerencias(p);
          U.toast('Microorganismo "' + nombre + '" agregado al catálogo del laboratorio.', "success");
        });
      }

      function renderCapturaNormal() {
        var parametrosPanel = exCat.parametros.filter(function (p) { return p.tipo === "panel"; });
        var rowsHtml = exCat.parametros.filter(function (p) { return p.tipo !== "panel"; }).map(function (p) {
          var val = valuesMap[p.codigo] || "";
          var flag = C.calcularFlag(p, val);
          var inputHtml;
          if (p.tipo === "numerico") {
            // Un parámetro calculado (ej. LDL por la fórmula de
            // Friedewald) se registra aquí para que recalcularCalculados()
            // lo tenga en cuenta, y su campo queda de solo lectura — se
            // rellena solo, nunca se digita a mano (ver el input
            // "readonly" y el botón "🧮 Valor Calculado" en Configuración
            // → Catálogo → un examen → Valores de Referencia).
            if (p.calculado && p.formula) formulasCalculadas[p.codigo] = p.formula;
            inputHtml = '<input type="number" step="any" placeholder="' + (p.calculado ? "Se calcula solo" : "Escribe aquí…") + '" data-param="' + p.codigo + '" value="' + U.esc(val) + '" ' + (!editable ? "disabled" : (p.calculado ? "readonly" : "")) + "/>" +
              (p.calculado ? '<div class="text-muted" style="font-size:10.5px;margin-top:2px" title="Fórmula: ' + U.esc(p.formula) + '">🧮 Calculado automáticamente</div>' : "");
          } else if (p.tipo === "cualitativo" || (p.tipo === "descriptivo" && Array.isArray(p.opciones) && p.opciones.length)) {
            // Un campo "descriptivo" del catálogo de fábrica sí trae
            // opciones predefinidas (ej. Color de heces) y se ve como
            // este selector — pero un campo "Descriptivo (texto libre)"
            // que un laboratorio agrega por su cuenta ("Agregar Campo
            // Personalizado") a propósito NO trae ninguna opción (por
            // eso "texto libre" en su nombre): antes, esta rama entraba
            // igual y .opciones.map() reventaba con "Cannot read
            // properties of undefined (reading 'map')" — tumbando la
            // tarjeta de ESE examen (y de paso toda la pantalla de
            // resultados, antes del aislamiento por tarjeta agregado en
            // build()). Ahora, sin opciones reales, cae al textarea de
            // abajo, que es justo el comportamiento de "texto libre".
            inputHtml = '<select data-param="' + p.codigo + '" ' + (!editable ? "disabled" : "") + '><option value="">— Selecciona el resultado —</option>' +
              p.opciones.map(function (o) { return '<option ' + (o === val ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select>";
          } else {
            inputHtml = '<textarea placeholder="Escribe aquí…" data-param="' + p.codigo + '" ' + (!editable ? "disabled" : "") + ">" + U.esc(val) + "</textarea>" +
              (editable && p.sugerencias ? sugerenciasHtml(p) : "");
          }
          // Cuando hay más de un rango que aplica igual al paciente (ej. las
          // fases del ciclo menstrual, que no se distinguen solo por
          // sexo/edad) se muestra un selector para elegir cuál corresponde.
          var bandasParam = p.tipo === "numerico" ? C.getBandas(tenant, ex.examId, p.codigo) : [];
          var candidatos = C.candidatosBanda(bandasParam, pac);
          // La "key" que identifica cada banda al guardar/reabrir NO puede
          // ser solo su etiqueta: cuando el laboratorio no le puso una
          // (queda ""), dos o más bandas comparten esa misma clave vacía y
          // se pierde cuál se eligió — por eso, sin etiqueta, se identifica
          // por su posición ("#0", "#1"…) en vez de por texto.
          var categoriaHtml = candidatos.length > 1
            ? '<select data-categoria="' + p.codigo + '" ' + (!editable ? "disabled" : "") + ' style="margin-top:4px;font-size:11.5px">' +
              candidatos.map(function (c, i) {
                var key = c.etiqueta || ("#" + bandasParam.indexOf(c));
                var etq = c.etiqueta || ("Opción " + (i + 1));
                return '<option value="' + U.esc(key) + '" ' + (categoriaOverrides[p.codigo] === key ? "selected" : "") + ">" + U.esc(etq) + "</option>";
              }).join("") +
              "</select>"
            : "";
          return "<tr><td>" + U.esc(p.nombre) + '</td><td class="celda-resultado' + (editable ? "" : " celda-resultado-solo-lectura") + '" style="min-width:160px">' + inputHtml + categoriaHtml + "</td><td>" + (p.unidad || "—") + "</td><td>" + U.esc(p.refText) + '</td><td class="flag-cell" data-flagfor="' + p.codigo + '">' +
            (flag.texto ? '<span class="flag-' + flag.clase + '">' + U.esc(flag.texto) + "</span>" : "") + "</td></tr>";
        }).join("");

        var puedeFirmar = puedeValidar(session);
        card.innerHTML = headerHtml() +
          (!editable ? '<p class="text-muted">Esta sección no está asignada a tu usuario. Solo lectura.</p>' : "") +
          (editable && !puedeFirmar ? '<p class="text-muted" style="font-size:12.5px">✍️ Puedes guardar el resultado como borrador o preliminar — la validación y firma final le corresponde a un Bacteriólogo(a)/Bioanalista.</p>' : "") +
          (editable ? '<div class="checkbox-row" style="margin-bottom:12px"><input type="checkbox" id="chk-remitido"/><label style="margin:0" for="chk-remitido">Este examen se remite a un laboratorio externo (no se procesa en este laboratorio)</label></div>' : "") +
          (rowsHtml ? '<div class="table-wrap"><table><thead><tr><th>Parámetro</th><th class="th-resultado">✏️ Resultado</th><th>Unidad</th><th>Valor de referencia</th><th>Interpretación</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" : "") +
          parametrosPanel.map(panelBoxHtml).join("") +
          '<div class="field" style="margin-top:12px"><label>Observaciones del examen</label><textarea data-obs ' + (!editable ? "disabled" : "") + ">" + U.esc(ex.observaciones || "") + "</textarea></div>" +
          '<div class="flex gap-2 wrap" style="margin-top:10px">' +
          (editable ? '<button class="btn btn-outline btn-sm" data-action="borrador">Guardar borrador</button>' : "") +
          (editable ? '<button class="btn btn-outline btn-sm" data-action="preliminar">Guardar como preliminar</button>' : "") +
          (editable && puedeFirmar ? '<button class="btn btn-primary btn-sm" data-action="validar">' + U.icon("check") + " Validar y Firmar</button>" : "") +
          "</div>";

        var chk = card.querySelector("#chk-remitido");
        if (chk) chk.addEventListener("change", function () { if (chk.checked) { modoRemision = true; renderFormularioRemision(); } });

        card.querySelectorAll("[data-param]").forEach(function (inputEl) {
          inputEl.addEventListener("input", function () {
            var p = exCat.parametros.filter(function (pp) { return pp.codigo === inputEl.dataset.param; })[0];
            var flag = C.calcularFlag(p, inputEl.value);
            var cell = card.querySelector('[data-flagfor="' + p.codigo + '"]');
            cell.innerHTML = flag.texto ? '<span class="flag-' + flag.clase + '">' + U.esc(flag.texto) + "</span>" : "";
            // Si el campo que se acaba de editar es EN SÍ MISMO calculado
            // (readonly, cambia solo por dispatchEvent desde
            // recalcularCalculados), no hay que volver a recalcular todo —
            // evita un loop. Para cualquier otro campo (los que sí digita
            // el bacteriólogo), se recalculan los parámetros calculados
            // que dependan de él, sean de esta tarjeta o de otra.
            if (!p.calculado) recalcularCalculados();
          });
        });

        card.querySelectorAll("[data-categoria]").forEach(function (sel) {
          sel.addEventListener("change", function () {
            sincronizarValuesMapDesdeDOM();
            categoriaOverrides[sel.dataset.categoria] = sel.value;
            actualizarExCat();
            renderCapturaNormal();
          });
        });

        parametrosPanel.forEach(wirePanelBox);
        exCat.parametros.filter(function (p) { return p.tipo === "texto" && p.sugerencias && editable; }).forEach(wireSugerencias);

        function collectValues() {
          return exCat.parametros.map(function (p) {
            if (p.tipo === "panel") return { codigo: p.codigo, valor: JSON.stringify(panelState[p.codigo] || []) };
            var el = card.querySelector('[data-param="' + p.codigo + '"]');
            var entry = { codigo: p.codigo, valor: el ? el.value : "" };
            if (categoriaOverrides[p.codigo]) entry.categoria = categoriaOverrides[p.codigo];
            return entry;
          });
        }
        function allFilled(vals) {
          return vals.every(function (v) {
            var p = exCat.parametros.filter(function (pp) { return pp.codigo === v.codigo; })[0];
            if (p && p.tipo === "panel") {
              var items = C.parsePanelValor(v.valor);
              return !items.length || C.panelCompleto(v.valor, p.panelTipo);
            }
            return v.valor !== "";
          });
        }

        var btnBorrador = card.querySelector('[data-action="borrador"]');
        if (btnBorrador) btnBorrador.addEventListener("click", function () {
          ex.valores = collectValues();
          ex.observaciones = card.querySelector("[data-obs]").value;
          ex.estado = "en_proceso";
          ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          S.addAudit(session.tenantId, session.nombre, session.rol, "SAVE_DRAFT_RESULT", "resultado", order.id + ":" + ex.examId, "Guardó borrador de " + exCat.nombre + " (Orden " + order.numeroOrden + ").");
          U.toast("Borrador guardado.", "success");
        });

        var btnPrelim = card.querySelector('[data-action="preliminar"]');
        if (btnPrelim) btnPrelim.addEventListener("click", function () {
          var vals = collectValues();
          if (!allFilled(vals)) { U.toast("Completa todos los parámetros antes de guardar como preliminar.", "error"); return; }
          ex.valores = vals; ex.observaciones = card.querySelector("[data-obs]").value; ex.estado = "preliminar";
          ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO();
          S.recalcEstadoGeneral(order); S.saveOrder(order);
          S.addAudit(session.tenantId, session.nombre, session.rol, "SAVE_PRELIMINARY", "resultado", order.id + ":" + ex.examId, "Marcó como preliminar " + exCat.nombre + " (Orden " + order.numeroOrden + ").");
          U.toast("Guardado como resultado preliminar. Puede enviarse desde Reportes.", "success");
          card.replaceWith(buildExamCard(ex, idx));
        });

        var btnValidar = card.querySelector('[data-action="validar"]');
        if (btnValidar) btnValidar.addEventListener("click", function () {
          var vals = collectValues();
          if (!allFilled(vals)) { U.toast("Completa todos los parámetros antes de validar.", "error"); return; }
          confirmValidation(function () {
            ex.valores = vals; ex.observaciones = card.querySelector("[data-obs]").value;
            ex.estado = "validado"; ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId; ex.fechaValidacion = S.nowISO();
            if (!ex.ingresadoPor) { ex.ingresadoPor = session.username; ex.fechaIngreso = S.nowISO(); }
            S.recalcEstadoGeneral(order); S.saveOrder(order);
            S.addAudit(session.tenantId, session.nombre, session.rol, "VALIDATE_RESULT", "resultado", order.id + ":" + ex.examId, "Validó y firmó " + exCat.nombre + " (Orden " + order.numeroOrden + ").");
            U.toast("Resultado validado y firmado.", "success");
            card.replaceWith(buildExamCard(ex, idx));
          });
        });
      }

      function renderCapturaNormalReadOnly() {
        var parametrosPanel = exCat.parametros.filter(function (p) { return p.tipo === "panel"; });
        var rowsHtml = exCat.parametros.filter(function (p) { return p.tipo !== "panel"; }).map(function (p) {
          var val = valuesMap[p.codigo] || "";
          var flag = C.calcularFlag(p, val);
          return "<tr><td>" + U.esc(p.nombre) + (p.calculado ? ' <span class="text-muted" style="font-size:10px" title="Fórmula: ' + U.esc(p.formula || "") + '">🧮</span>' : "") + "</td><td><b>" + U.esc(val) + "</b></td><td>" + (p.unidad || "—") + "</td><td>" + U.esc(p.refText) + '</td><td>' +
            (flag.texto ? '<span class="flag-' + flag.clase + '">' + U.esc(flag.texto) + "</span>" : "") + "</td></tr>";
        }).join("");
        card.innerHTML = headerHtml() +
          (rowsHtml ? '<div class="table-wrap"><table><thead><tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Valor de referencia</th><th>Interpretación</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" : "") +
          parametrosPanel.map(function (p) {
            return '<div class="card" style="background:var(--surface-2);box-shadow:none;margin-top:14px">' +
              "<h4 style='margin:0 0 8px'>" + U.esc(p.nombre) + "</h4>" +
              panelTablaHtml(p, true) + "</div>";
          }).join("") +
          (ex.observaciones ? '<p style="margin-top:10px"><b>Observaciones:</b> ' + U.esc(ex.observaciones) + "</p>" : "") +
          '<p class="text-muted" style="font-size:12px;margin-top:8px">Validado por ' + U.esc(ex.validadoPor || "—") + " el " + (ex.fechaValidacion ? U.fmtFecha(ex.fechaValidacion) : "—") + "</p>" +
          (ex.correcciones && ex.correcciones.length ? '<p class="text-muted" style="font-size:12px">' + U.icon("history") + " Este resultado tiene " + ex.correcciones.length + " corrección(es) registrada(s) en la trazabilidad." : "") +
          '<div class="flex gap-2 wrap" style="margin-top:10px">' +
          (editable ? '<button class="btn btn-danger btn-sm" data-action="corregir">' + U.icon("lock") + " Corregir (requiere clave admin)</button>" : "") +
          "</div>";
        var bc = card.querySelector('[data-action="corregir"]');
        if (bc) bc.addEventListener("click", function () { abrirCorreccion(ex, exCat, order, build); });
      }

      if (ex.estado === "remitido") renderReadOnlyRemitido();
      else if (locked) renderCapturaNormalReadOnly();
      else if (modoRemision) renderFormularioRemision();
      else renderCapturaNormal();

      return card;
    }

    function confirmValidation(onOk) {
      var me = S.listUsers(session.tenantId).filter(function (u) { return u.id === session.userId; })[0];
      var firmaTemp = me && me.firmaDataUrl ? me.firmaDataUrl : "";

      function render() {
        var card = wrap.querySelector(".modal-card");
        card.innerHTML =
          '<h3 class="modal-title">Confirmar Validación</h3>' +
          '<p class="text-muted">Al validar, usted certifica con su usuario y clave (' + U.esc(session.nombre) + ') que revisó y aprueba estos resultados. Esta acción queda registrada con fecha y hora en la trazabilidad.</p>' +
          '<div class="card" style="background:var(--surface-2);box-shadow:none;text-align:center">' +
          (firmaTemp
            ? '<p class="text-muted" style="margin:0 0 8px;font-size:12px">Esta firma se imprimirá en el informe</p><img src="' + firmaTemp + '" style="height:70px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:6px"/>' +
              '<p style="margin:10px 0 0;font-weight:700">' + U.esc(session.nombre) + "</p>" +
              '<p class="text-muted" style="margin:0;font-size:12px">' + (me && me.registroProfesional ? "Registro Profesional: " + U.esc(me.registroProfesional) : "") + "</p>"
            : '<p class="text-muted" style="margin:0 0 10px">Aún no tienes una firma escaneada cargada. Puedes agregarla ahora para que aparezca en tus informes validados:</p>' +
              '<input type="file" id="firma-rapida" accept="image/*"/>') +
          "</div>" +
          '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="btn-ok-validate">' + U.icon("check") + " Confirmar y Firmar</button></div>";

        var fq = wrap.querySelector("#firma-rapida");
        if (fq) fq.addEventListener("change", function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            firmaTemp = ev.target.result;
            if (me) { S.updateUser(me.id, { firmaDataUrl: firmaTemp }); }
            render();
          };
          reader.readAsDataURL(file);
        });
        wrap.querySelector("[data-modal-close]").addEventListener("click", function () { U.closeModal(wrap); });
        wrap.querySelector("#btn-ok-validate").addEventListener("click", function () { U.closeModal(wrap); onOk(); });
      }

      var wrap = U.openModal("");
      render();
    }

    build();
  }

  function abrirCorreccion(ex, exCat, order, onDone) {
    var session = BIO_AUTH.getSession();
    var esRemision = ex.estado === "remitido";
    var wrap = U.openModal(
      '<h3 class="modal-title">' + U.icon("lock") + (esRemision ? " Reemplazar PDF Remitido</h3>" : " Corrección de Resultado Validado</h3>") +
      '<p class="text-muted">' + (esRemision ? "Este examen fue remitido a un laboratorio externo. " : "El resultado <b>" + U.esc(exCat.nombre) + "</b> ya fue validado. ") + "Para modificarlo se requiere la clave de administrador del laboratorio y el motivo, dejando trazabilidad completa (usuario, fecha y hora).</p>" +
      '<div class="field"><label>Clave de administrador *</label><input type="password" id="c-clave"/></div>' +
      '<div class="field"><label>Motivo de la corrección *</label><textarea id="c-motivo" placeholder="Ej: Error de digitación, se corrige según repetición de la prueba."></textarea></div>' +
      '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-danger" id="c-continuar">Verificar y Continuar</button></div>'
    );
    wrap.querySelector("#c-continuar").addEventListener("click", function () {
      var clave = wrap.querySelector("#c-clave").value;
      var motivo = wrap.querySelector("#c-motivo").value.trim();
      if (!motivo) { U.toast("Describe el motivo de la corrección.", "error"); return; }
      if (!BIO_AUTH.verificarClaveAdmin(clave)) { U.toast("Clave de administrador incorrecta.", "error"); return; }
      U.closeModal(wrap);
      if (esRemision) abrirEdicionRemision(ex, exCat, order, motivo, onDone);
      else abrirEdicionCorreccion(ex, exCat, order, motivo, onDone);
    });
  }

  function abrirEdicionRemision(ex, exCat, order, motivo, onDone) {
    var session = BIO_AUTH.getSession();
    var labAnterior = ex.laboratorioRemision;
    var pdfAnteriorNombre = ex.pdfRemitidoNombre;
    var pdfNuevo = "", pdfNuevoNombre = "";
    var wrap = U.openModal(
      '<h3 class="modal-title">Reemplazar PDF Remitido — ' + U.esc(exCat.nombre) + '</h3>' +
      '<div class="field"><label>Laboratorio de Referencia</label><input id="r-lab" value="' + U.esc(ex.laboratorioRemision || "") + '"/></div>' +
      '<div class="field"><label>Nuevo PDF *</label><input type="file" id="r-pdf" accept="application/pdf"/></div>' +
      '<div class="flex gap-2 justify-between" style="margin-top:10px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="r-guardar">' + U.icon("check") + " Guardar Reemplazo</button></div>"
    );
    wrap.querySelector("#r-pdf").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) { pdfNuevo = ev.target.result; pdfNuevoNombre = file.name; };
      reader.readAsDataURL(file);
    });
    wrap.querySelector("#r-guardar").addEventListener("click", function () {
      if (!pdfNuevo) { U.toast("Selecciona el nuevo PDF.", "error"); return; }
      var labNuevo = wrap.querySelector("#r-lab").value.trim();
      ex.correcciones = ex.correcciones || [];
      ex.correcciones.push({
        fecha: S.nowISO(), usuario: session.nombre, rol: session.rol, motivo: motivo,
        valoresAnteriores: [{ codigo: "PDF", valor: pdfAnteriorNombre || "—" }, { codigo: "LABORATORIO", valor: labAnterior || "—" }],
        valoresNuevos: [{ codigo: "PDF", valor: pdfNuevoNombre }, { codigo: "LABORATORIO", valor: labNuevo }]
      });
      ex.laboratorioRemision = labNuevo; ex.pdfRemitidoDataUrl = pdfNuevo; ex.pdfRemitidoNombre = pdfNuevoNombre;
      ex.version = (ex.version || 1) + 1;
      ex.fechaValidacion = S.nowISO(); ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId;
      S.recalcEstadoGeneral(order); S.saveOrder(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "CORRECT_REFERRED_EXAM", "resultado", order.id + ":" + ex.examId,
        "Reemplazó el PDF remitido de " + exCat.nombre + " (Orden " + order.numeroOrden + "). Motivo: " + motivo);
      U.toast("PDF remitido actualizado y trazabilidad registrada.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }

  function abrirEdicionCorreccion(ex, exCat, order, motivo, onDone) {
    var session = BIO_AUTH.getSession();
    var valoresAnteriores = ex.valores.slice();
    var rowsHtml = exCat.parametros.map(function (p) {
      var current = (ex.valores.filter(function (v) { return v.codigo === p.codigo; })[0] || {}).valor || "";
      // Mismo caso que en renderCapturaNormal(): un "descriptivo" de texto
      // libre (campo personalizado sin opciones predefinidas) no debe
      // intentar armar un <select> con .opciones.map() — cae al <input>.
      var inputHtml = (p.tipo === "cualitativo" || (p.tipo === "descriptivo" && Array.isArray(p.opciones) && p.opciones.length))
        ? '<select data-cparam="' + p.codigo + '">' + p.opciones.map(function (o) { return '<option ' + (o === current ? "selected" : "") + ">" + o + "</option>"; }).join("") + "</select>"
        : '<input data-cparam="' + p.codigo + '" value="' + U.esc(current) + '"/>';
      return "<tr><td>" + U.esc(p.nombre) + "</td><td>" + inputHtml + "</td><td>" + (p.unidad || "") + "</td></tr>";
    }).join("");

    var wrap = U.openModal(
      '<h3 class="modal-title">Editar Valores — ' + U.esc(exCat.nombre) + '</h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Parámetro</th><th>Nuevo valor</th><th>Unidad</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" +
      '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="c-guardar">' + U.icon("check") + " Guardar Corrección y Re-validar</button></div>",
      { lg: true }
    );
    wrap.querySelector("#c-guardar").addEventListener("click", function () {
      var nuevos = exCat.parametros.map(function (p) {
        var el = wrap.querySelector('[data-cparam="' + p.codigo + '"]');
        return { codigo: p.codigo, valor: el.value };
      });
      ex.correcciones = ex.correcciones || [];
      ex.correcciones.push({
        fecha: S.nowISO(), usuario: session.nombre, rol: session.rol, motivo: motivo,
        valoresAnteriores: valoresAnteriores, valoresNuevos: nuevos
      });
      ex.valores = nuevos;
      ex.version = (ex.version || 1) + 1;
      ex.fechaValidacion = S.nowISO();
      ex.validadoPor = session.nombre; ex.validadoPorUserId = session.userId;
      ex.estado = "validado";
      S.recalcEstadoGeneral(order); S.saveOrder(order);
      S.addAudit(order.tenantId, session.nombre, session.rol, "CORRECT_VALIDATED_RESULT", "resultado", order.id + ":" + ex.examId,
        "Corrigió resultado validado de " + exCat.nombre + " (Orden " + order.numeroOrden + "). Motivo: " + motivo,
        { valoresAnteriores: valoresAnteriores, valoresNuevos: nuevos });
      U.toast("Corrección registrada y trazabilidad actualizada.", "success");
      U.closeModal(wrap);
      onDone();
    });
  }
})();

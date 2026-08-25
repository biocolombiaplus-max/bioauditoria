/* BIOsoft — Portal de Aliado: acceso de SOLO CONSULTA para una empresa/
   convenio (laboratorio de referencia, laboratorio de contrarreferencia o
   cliente institucional), que ve únicamente las órdenes ligadas a SU propio
   convenio (ver rol "aliado" en catalog.js/router.js/views-admin.js). Nunca
   pacientes de otros convenios ni ninguna otra sección de BIOsoft — tanto
   firestore.rules como el espejo en memoria de esta sesión (ver
   initRealtimePortalAliado en store.js) ya vienen filtrados a solo eso. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;

  window.BIO_VIEWS["portal-aliado"] = function (root) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var filtroEstado = "todos";

    function nombrePaciente(o) {
      if (!o.pacienteSnap) return "—";
      return [o.pacienteSnap.primerNombre, o.pacienteSnap.segundoNombre, o.pacienteSnap.primerApellido, o.pacienteSnap.segundoApellido].filter(Boolean).join(" ");
    }

    function build() {
      var orders = S.listOrders(session.tenantId).filter(function (o) { return o.convenioId === session.convenioId; });
      var filtradas = orders.filter(function (o) { return filtroEstado === "todos" || o.estadoGeneral === filtroEstado; });

      root.innerHTML =
        '<div class="card" style="margin-bottom:16px"><h3 class="card-title" style="margin:0 0 4px">🤝 ' + U.esc(tenant ? tenant.nombre : "") + '</h3>' +
        '<p class="text-muted" style="margin:0">Portal de solo consulta de resultados — ves únicamente las órdenes de tu convenio, no puedes editar ni ver datos de otros pacientes del laboratorio.</p></div>' +
        '<div class="card"><div class="card-header"><h3 class="card-title">Resultados de tu Convenio (' + orders.length + ')</h3>' +
        '<select id="pa-estado"><option value="todos">Todos los estados</option><option value="pendiente">Pendientes</option><option value="preliminar">Preliminares</option><option value="validado">Validados</option></select>' +
        "</div>" +
        '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Fecha</th><th>Paciente</th><th># Exámenes</th><th>Estado</th><th></th></tr></thead><tbody>' +
        (filtradas.length ? filtradas.map(rowHtml).join("") : '<tr><td colspan="6" class="text-muted">No hay órdenes de tu convenio con este filtro todavía.</td></tr>') +
        "</tbody></table></div></div>";

      document.getElementById("pa-estado").value = filtroEstado;
      document.getElementById("pa-estado").addEventListener("change", function (e) { filtroEstado = e.target.value; build(); });
      root.querySelectorAll("[data-ver-pdf]").forEach(function (b) {
        b.addEventListener("click", function () {
          var o = orders.filter(function (x) { return x.id === b.dataset.verPdf; })[0];
          window.BIO_PDF.previewOrModal(o, o.pacienteSnap || {}, tenant);
        });
      });
    }

    function rowHtml(o) {
      return "<tr><td><b>" + U.esc(o.numeroOrden) + "</b></td><td>" + U.fmtFecha(o.fechaOrden) + "</td><td>" + U.esc(nombrePaciente(o)) + "</td>" +
        "<td>" + o.examenes.length + "</td><td>" + window.BIO_badgeEstado(o.estadoGeneral) + "</td>" +
        '<td><button class="btn btn-outline btn-sm" data-ver-pdf="' + o.id + '">' + U.icon("download") + " Ver / Descargar</button></td></tr>";
    }

    build();
  };
})();

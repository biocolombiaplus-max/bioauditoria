/* BIOsoft — Vista: Reporte de Productividad Mensual */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  function kpi(value, label) {
    return '<div class="kpi"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + label + '</div></div>';
  }

  function barsHtml(map, max, nameFn) {
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    if (!keys.length) return '<p class="text-muted" style="margin:0">Sin datos este mes.</p>';
    return '<div class="prod-bars">' + keys.map(function (k) {
      var pct = Math.max(4, Math.round((map[k] / max) * 100));
      return '<div class="prod-bar-row">' +
        '<div class="prod-bar-label">' + U.esc(nameFn(k)) + '</div>' +
        '<div class="prod-bar-track"><div class="prod-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="prod-bar-count">' + map[k] + '</div>' +
        "</div>";
    }).join("") + "</div>";
  }

  window.BIO_VIEWS.productividad = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var orders = S.listOrders(tenantId);
    var mesStr = new Date().toISOString().slice(0, 7);
    var ordersMes = orders.filter(function (o) { return o.fechaOrden.slice(0, 7) === mesStr; });

    var examenesProcesados = 0;
    var pacientesSet = {};
    var porSeccion = {};
    var porBact = {};
    var horasTotales = 0, horasCount = 0;

    ordersMes.forEach(function (o) {
      var tieneProcesado = false;
      o.examenes.forEach(function (ex) {
        if (ex.estado === "validado" || ex.estado === "remitido") {
          examenesProcesados++;
          tieneProcesado = true;
          porSeccion[ex.seccion] = (porSeccion[ex.seccion] || 0) + 1;
          if (ex.validadoPor) porBact[ex.validadoPor] = (porBact[ex.validadoPor] || 0) + 1;
          if (ex.fechaValidacion && o.fechaOrden) {
            var h = (new Date(ex.fechaValidacion) - new Date(o.fechaOrden)) / 36e5;
            if (h >= 0 && isFinite(h)) { horasTotales += h; horasCount++; }
          }
        }
      });
      if (tieneProcesado) pacientesSet[o.patientId] = true;
    });

    var tiempoPromedio = horasCount ? (horasTotales / horasCount) : 0;
    var seccionTopId = Object.keys(porSeccion).sort(function (a, b) { return porSeccion[b] - porSeccion[a]; })[0];
    var maxSeccion = Math.max.apply(null, Object.keys(porSeccion).map(function (k) { return porSeccion[k]; }).concat([1]));
    var maxBact = Math.max.apply(null, Object.keys(porBact).map(function (k) { return porBact[k]; }).concat([1]));

    root.innerHTML =
      '<div class="kpi-grid">' +
        kpi(examenesProcesados, "Exámenes Procesados Este Mes") +
        kpi(Object.keys(pacientesSet).length, "Pacientes Atendidos") +
        kpi(horasCount ? tiempoPromedio.toFixed(1) + " h" : "—", "Tiempo Promedio de Entrega") +
        kpi(seccionTopId ? C.seccionNombre(seccionTopId) : "—", "Sección con Mayor Demanda") +
      "</div>" +
      '<div class="card"><div class="card-header"><h3 class="card-title">Exámenes procesados por sección (este mes)</h3></div>' +
      barsHtml(porSeccion, maxSeccion, function (k) { return C.seccionNombre(k); }) +
      "</div>" +
      '<div class="card"><div class="card-header"><h3 class="card-title">Exámenes validados por bacteriólogo (este mes)</h3></div>' +
      barsHtml(porBact, maxBact, function (k) { return k; }) +
      "</div>";
  };
})();

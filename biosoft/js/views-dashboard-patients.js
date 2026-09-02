/* BIOsoft — Vistas: Dashboard y Pacientes */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;

  // ------------------------------------------------------------------
  // DASHBOARD
  // ------------------------------------------------------------------
  window.BIO_VIEWS.dashboard = function (root) {
    var session = BIO_AUTH.getSession();

    if (session.rol === "superadmin") {
      buildSuperadminDashboard(root);
      return;
    }

    var tenantId = session.tenantId;
    var tenant = S.getTenant(tenantId);
    var patients = S.listPatients(tenantId);
    var orders = S.listOrders(tenantId);
    var todayStr = new Date().toISOString().slice(0, 10);
    var ordersToday = orders.filter(function (o) { return o.fechaOrden.slice(0, 10) === todayStr; });

    var pendItems = [];
    orders.forEach(function (o) {
      o.examenes.forEach(function (ex) {
        if (ex.estado === "pendiente" || ex.estado === "en_proceso") {
          if (session.rol !== "bacteriologo" || session.secciones.indexOf(ex.seccion) !== -1) {
            pendItems.push({ order: o, ex: ex });
          }
        }
      });
    });
    var validadosHoy = 0;
    orders.forEach(function (o) { o.examenes.forEach(function (ex) { if (ex.estado === "validado" && ex.fechaValidacion && ex.fechaValidacion.slice(0, 10) === todayStr) validadosHoy++; }); });

    var html = '<div class="kpi-grid">';
    if (session.rol !== "bacteriologo") {
      html += kpi(patients.length, "Pacientes Registrados") + kpi(ordersToday.length, "Órdenes de Hoy");
    }
    html += kpi(pendItems.length, session.rol === "bacteriologo" ? "Pendientes en Mis Secciones" : "Exámenes Pendientes por Validar") + kpi(validadosHoy, "Validados Hoy");
    html += "</div>";

    html += '<div class="card">' +
      '<div class="card-header"><h3 class="card-title">' + (session.rol === "bacteriologo" ? "Mi bandeja de trabajo" : "Órdenes recientes") + '</h3>' +
      '<a class="btn btn-outline btn-sm" data-route="resultados">Ir a Resultados</a></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N° Orden</th><th>Paciente</th><th>Examen</th><th>Sección</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>';

    var rows = session.rol === "bacteriologo" ? pendItems.slice(0, 8) : orders.slice(0, 8).map(function (o) { return { order: o, ex: o.examenes[0] }; });
    if (!rows.length) html += '<tr><td colspan="6" class="text-muted">Sin registros por ahora.</td></tr>';
    rows.forEach(function (r) {
      var pac = S.getPatient(r.order.patientId);
      html += "<tr><td>" + r.order.numeroOrden + "</td><td>" + (pac ? U.esc(U.nombreCompleto(pac)) : "—") + "</td><td>" + (r.ex ? U.esc(C.examenEfectivo(r.ex.examId, tenant).nombre) : "Varios") + "</td><td>" + (r.ex ? C.seccionNombre(r.ex.seccion, tenant) : "") + "</td><td>" + badgeEstado(r.order.estadoGeneral) + "</td><td>" + U.fmtFechaCorta(r.order.fechaOrden) + "</td></tr>";
    });
    html += "</tbody></table></div></div>";

    root.innerHTML = html;
    root.querySelectorAll("[data-route]").forEach(function (a) { a.addEventListener("click", function () { location.hash = "#/" + a.dataset.route; }); });
  };

  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function haceDiasISO(dias) { var d = new Date(); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); }
  function textoSegundos(seg) {
    if (seg < 60) return seg + " seg";
    var min = Math.round(seg / 60);
    return min + " min";
  }

  function buildSuperadminDashboard(root) {
    var tenants = [];
    var cargando = true;
    var ultimaActualizacion = null;
    // Últimos 30 días (incluye hoy) por defecto — el laboratorio y el
    // superadmin pueden cambiarlo a cualquier rango.
    var rangoDesde = haceDiasISO(29);
    var rangoHasta = hoyISO();
    root.innerHTML = '<div class="card"><p class="text-muted">Cargando resumen…</p></div>';

    function cargar(silencioso) {
      return S.tenantsGlobal.list().then(function (list) {
        tenants = list;
        cargando = false;
        ultimaActualizacion = new Date();
        render();
      }).catch(function (err) {
        cargando = false;
        console.error("BIOsoft: no se pudo cargar el resumen global ->", err.code, err.message);
        if (!silencioso) root.innerHTML = '<div class="card"><p class="text-muted">No se pudo cargar el resumen: ' + U.esc(err.message || String(err)) + '</p></div>';
      });
    }

    // Refresca solo (sin tapar la pantalla con "Cargando…") cada 60
    // segundos mientras este panel siga abierto, para que las cifras se
    // vean actualizadas sin que el superadmin tenga que recargar la
    // página a mano. Este router no tiene un gancho de "salir de la
    // vista", así que el propio temporizador se autocancela apenas "root"
    // ya no está conectado al documento (el siguiente cambio de pantalla
    // lo desconecta al reemplazar #content) — evita dejar temporizadores
    // corriendo de fondo, leyendo Firestore, en pantallas que ya no se ven.
    var pollTimer = setInterval(function () {
      if (!document.body.contains(root)) { clearInterval(pollTimer); return; }
      cargar(true);
    }, 60000);

    function enRango(fechaISO) {
      var f = (fechaISO || "").slice(0, 10);
      return !!f && f >= rangoDesde && f <= rangoHasta;
    }

    function diasDelRango() {
      var dias = [];
      var d = new Date(rangoDesde + "T00:00:00");
      var fin = new Date(rangoHasta + "T00:00:00");
      // Un rango invertido o absurdamente largo (varios años, por un typo
      // en la fecha) no debe intentar dibujar miles de barras — se limita
      // a 366 días y, si el rango no tiene sentido, se muestra vacío en
      // vez de trabar el navegador.
      var limite = 366;
      while (d <= fin && dias.length < limite) { dias.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
      return dias;
    }

    function chartHtml(fechas) {
      var dias = diasDelRango();
      if (!dias.length) return '<p class="text-muted" style="margin:0">Elige un rango de fechas válido.</p>';
      var porDia = {};
      fechas.forEach(function (f) { if (enRango(f)) { var d = f.slice(0, 10); porDia[d] = (porDia[d] || 0) + 1; } });
      var max = Math.max.apply(null, dias.map(function (d) { return porDia[d] || 0; }).concat([1]));
      // Con muchos días mostrar la fecha bajo CADA barra se ve saturado —
      // se reparten como mucho ~9 etiquetas a lo largo del rango.
      var paso = Math.max(1, Math.ceil(dias.length / 9));
      var barras = dias.map(function (d, i) {
        var val = porDia[d] || 0;
        var alturaPct = Math.max(3, Math.round((val / max) * 100));
        var mostrarEtiqueta = i % paso === 0 || i === dias.length - 1;
        return '<div style="flex:1 0 auto;min-width:5px;max-width:26px;display:flex;flex-direction:column;align-items:center;gap:4px">' +
          '<div style="width:100%;height:96px;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:' + alturaPct + '%;background:linear-gradient(180deg,var(--brand-primary),var(--brand-secondary));border-radius:3px 3px 0 0" title="' + U.fmtFechaCorta(d) + ': ' + val + ' paciente(s)"></div>' +
          "</div>" +
          '<div style="font-size:9px;color:var(--text-muted);white-space:nowrap">' + (mostrarEtiqueta ? U.fmtFechaCorta(d).slice(0, 5) : "") + "</div>" +
          "</div>";
      }).join("");
      return '<div style="display:flex;align-items:flex-end;gap:3px;overflow-x:auto;padding-bottom:2px">' + barras + "</div>";
    }

    function render() {
      if (cargando) return;
      var porEstado = { activo: [], por_vencer: [], vencido: [], suspendido: [], sin_fecha: [] };
      tenants.forEach(function (t) {
        var e = BIO_PLANES.estadoCuenta(t);
        (porEstado[e] || porEstado.sin_fecha).push(t);
      });
      var totalPacientes = tenants.reduce(function (a, t) { return a + (t._pacientes || 0); }, 0);
      var totalOrdenes = tenants.reduce(function (a, t) { return a + (t._ordenes || 0); }, 0);
      var totalUsuarios = tenants.reduce(function (a, t) { return a + (t._usuarios || 0); }, 0);
      var urgentes = porEstado.vencido.concat(porEstado.por_vencer);

      var todasFechasPacientes = [];
      tenants.forEach(function (t) { (t._pacientesFechas || []).forEach(function (f) { todasFechasPacientes.push(f); }); });
      var pacientesEnRango = todasFechasPacientes.filter(enRango).length;
      var ordenesEnRango = 0;
      tenants.forEach(function (t) { (t._ordenesFechas || []).forEach(function (f) { if (enRango(f)) ordenesEnRango++; }); });
      var laboratoriosNuevosEnRango = tenants.filter(function (t) { return enRango(t.creadoEn); }).length;

      // Ranking de laboratorios por actividad EN EL PERIODO elegido — el
      // dato que realmente le interesa a BIOsoft para saber quién está
      // usando de verdad el sistema (no solo quién tiene más pacientes
      // acumulados históricamente).
      var ranking = tenants.map(function (t) {
        return {
          t: t,
          pacientesRango: (t._pacientesFechas || []).filter(enRango).length,
          ordenesRango: (t._ordenesFechas || []).filter(enRango).length
        };
      }).sort(function (a, b) { return b.pacientesRango - a.pacientesRango || b.ordenesRango - a.ordenesRango; });

      var segsDesdeUltima = ultimaActualizacion ? Math.round((Date.now() - ultimaActualizacion.getTime()) / 1000) : null;

      root.innerHTML =
        '<div class="flex gap-2" style="align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-bottom:14px">' +
        '<span class="text-muted" style="font-size:11.5px">' + (segsDesdeUltima != null ? "🟢 Actualizado hace " + textoSegundos(segsDesdeUltima) + " · se refresca solo" : "") + "</span>" +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-resumen-refrescar">🔄 Actualizar ahora</button>' +
        "</div>" +
        '<div class="kpi-grid">' +
        kpi(tenants.length, "Laboratorios Cliente") +
        kpi(totalPacientes, "Pacientes (todos los clientes)") +
        kpi(totalOrdenes, "Órdenes Totales") +
        kpi(totalUsuarios, "Usuarios del Sistema") +
        "</div>" +
        '<div class="kpi-grid">' +
        kpi(porEstado.activo.length, "Al Día") +
        kpi(porEstado.por_vencer.length, "Por Vencer (≤" + BIO_PLANES.DIAS_AVISO_VENCIMIENTO + " días)") +
        kpi(porEstado.vencido.length, "Vencidos") +
        kpi(porEstado.suspendido.length, "Suspendidos") +
        "</div>" +
        '<div class="card">' +
        '<div class="card-header"><h3 class="card-title">📈 Actividad por Periodo</h3></div>' +
        '<div class="form-grid" style="max-width:420px;margin-bottom:14px">' +
        '<div class="field"><label>Desde</label><input type="date" id="resumen-desde" value="' + rangoDesde + '"/></div>' +
        '<div class="field"><label>Hasta</label><input type="date" id="resumen-hasta" value="' + rangoHasta + '"/></div>' +
        "</div>" +
        '<div class="kpi-grid" style="margin-bottom:18px">' +
        kpi(pacientesEnRango, "Pacientes Registrados en el Periodo") +
        kpi(ordenesEnRango, "Órdenes Creadas en el Periodo") +
        kpi(laboratoriosNuevosEnRango, "Laboratorios Nuevos en el Periodo") +
        "</div>" +
        '<h4 style="margin:0 0 8px;font-size:13px;color:var(--text-muted)">Pacientes registrados por día (todos los laboratorios)</h4>' +
        chartHtml(todasFechasPacientes) +
        "</div>" +
        '<div class="card"><div class="card-header"><h3 class="card-title">🏆 Laboratorios Más Activos en el Periodo</h3></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Laboratorio</th><th>Plan</th><th>Estado</th><th>Pacientes (periodo)</th><th>Órdenes (periodo)</th><th>Usuarios</th><th>Total histórico</th><th>Cliente desde</th></tr></thead><tbody>' +
        (ranking.length ? ranking.map(function (r) {
          var t = r.t;
          var plan = BIO_PLANES.porId(t.planId);
          var info = BIO_PLANES.ESTADOS_CUENTA[BIO_PLANES.estadoCuenta(t)];
          return "<tr><td><b>" + U.esc(t.nombre) + "</b></td><td>" + (plan ? U.esc(plan.nombre) : "—") + "</td>" +
            "<td><span class='badge " + info.badge + "'>" + info.label + "</span></td>" +
            "<td style='text-align:center;font-weight:700;color:var(--brand-secondary)'>" + r.pacientesRango + "</td>" +
            "<td style='text-align:center'>" + r.ordenesRango + "</td>" +
            "<td style='text-align:center'>" + (t._usuarios || 0) + "</td>" +
            "<td style='text-align:center' class='text-muted'>" + (t._pacientes || 0) + " pac. · " + (t._ordenes || 0) + " ord.</td>" +
            "<td class='text-muted'>" + (t.creadoEn ? U.fmtFechaCorta(t.creadoEn) : "—") + "</td></tr>";
        }).join("") : '<tr><td colspan="8" class="text-muted">Sin laboratorios registrados.</td></tr>') +
        "</tbody></table></div></div>" +
        (urgentes.length ?
          '<div class="card"><div class="card-header"><h3 class="card-title">⚠️ Requieren seguimiento de pago (' + urgentes.length + ')</h3>' +
          '<a class="btn btn-outline btn-sm" data-route="tenants">Ir a Laboratorios Cliente</a></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Laboratorio</th><th>Plan</th><th>Estado</th><th>Próximo pago</th><th></th></tr></thead><tbody>' +
          urgentes.map(function (t) {
            var plan = BIO_PLANES.porId(t.planId);
            var info = BIO_PLANES.ESTADOS_CUENTA[BIO_PLANES.estadoCuenta(t)];
            return "<tr><td><b>" + U.esc(t.nombre) + "</b></td><td>" + (plan ? U.esc(plan.nombre) : "—") + "</td>" +
              "<td><span class='badge " + info.badge + "'>" + info.label + "</span></td>" +
              "<td>" + (t.fechaProximoPago ? U.fmtFechaCorta(t.fechaProximoPago) : "—") + "</td>" +
              "<td><button class='btn btn-whatsapp btn-sm' data-recordar='" + t.id + "'>" + U.icon("send") + " Recordar</button></td></tr>";
          }).join("") + "</tbody></table></div></div>"
          : '<div class="card"><h3 class="card-title">✅ Todos tus laboratorios cliente están al día con el pago</h3></div>');

      root.querySelectorAll("[data-route]").forEach(function (a) { a.addEventListener("click", function () { location.hash = "#/" + a.dataset.route; }); });
      root.querySelectorAll("[data-recordar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var t = tenants.filter(function (x) { return x.id === b.dataset.recordar; })[0];
          var plan = BIO_PLANES.porId(t.planId);
          var numero = (t.telefonos || "").replace(/\D/g, "");
          if (!numero) { U.toast("Este laboratorio no tiene un número de WhatsApp registrado.", "error"); return; }
          var msg = "Hola 👋 Te escribimos de BIOsoft: la mensualidad de " + (plan ? "tu Plan " + plan.nombre : "tu plan") + " en " + t.nombre +
            (t.fechaProximoPago ? " vence el " + U.fmtFechaCorta(t.fechaProximoPago) : " está próxima a vencer") + ". ¿Te ayudamos a coordinar el pago?";
          window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(msg), "_blank");
        });
      });
      var btnRefrescar = document.getElementById("btn-resumen-refrescar");
      if (btnRefrescar) btnRefrescar.addEventListener("click", function () { root.innerHTML = '<div class="card"><p class="text-muted">Actualizando…</p></div>'; cargando = true; cargar(false); });
      var inpDesde = document.getElementById("resumen-desde");
      var inpHasta = document.getElementById("resumen-hasta");
      if (inpDesde) inpDesde.addEventListener("change", function () { rangoDesde = inpDesde.value; render(); });
      if (inpHasta) inpHasta.addEventListener("change", function () { rangoHasta = inpHasta.value; render(); });
    }

    cargar(false);
  }

  function kpi(value, label) {
    return '<div class="kpi"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + label + '</div></div>';
  }

  function badgeEstado(estado) {
    var labels = { pendiente: "Pendiente", parcial: "Parcial", preliminar: "Preliminar", validado: "Validado", remitido: "Remitido" };
    var clases = { remitido: "enviado" };
    return '<span class="badge badge-' + (clases[estado] || estado) + '">' + (labels[estado] || estado) + "</span>";
  }
  window.BIO_badgeEstado = badgeEstado;

  // ------------------------------------------------------------------
  // PACIENTES
  // ------------------------------------------------------------------
  window.BIO_VIEWS.pacientes = function (root) {
    var session = BIO_AUTH.getSession();
    renderList("");

    function renderList(filter) {
      var patients = S.listPatients(session.tenantId).filter(function (p) {
        if (!filter) return true;
        var f = filter.toLowerCase();
        return U.nombreCompleto(p).toLowerCase().indexOf(f) !== -1 || p.numeroDocumento.indexOf(f) !== -1;
      });
      root.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3 class="card-title">Pacientes (' + patients.length + ')</h3>' +
          '<div class="flex gap-2"><input id="pac-search" placeholder="Buscar por nombre o documento…" style="width:260px" value="' + U.esc(filter) + '"/>' +
          '<button class="btn btn-primary" id="btn-new-pac">' + U.icon("plus") + ' Nuevo Paciente</button></div></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Nombre</th><th>Edad</th><th>Sexo</th><th>EPS / Seguro</th><th>Ciudad</th><th>Acciones</th></tr></thead><tbody>' +
          (patients.length ? patients.map(rowPatient).join("") : '<tr><td colspan="7" class="text-muted">No hay pacientes registrados. Crea el primero con "Nuevo Paciente".</td></tr>') +
          "</tbody></table></div></div>";

      document.getElementById("btn-new-pac").addEventListener("click", function () { openPatientForm(null, renderList); });
      document.getElementById("pac-search").addEventListener("input", function (e) { renderList(e.target.value); });
      root.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openPatientForm(S.getPatient(b.dataset.edit), function () { renderList(filter); }); }); });
      root.querySelectorAll("[data-neworden]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#/ordenes/nueva-" + b.dataset.neworden; }); });
      // Solo el Administrador puede eliminar un paciente — pensado para
      // corregir un error de digitación (persona equivocada, duplicado),
      // no como una acción de uso diario. Además, solo se puede borrar si
      // el paciente todavía no tiene ninguna orden asociada (ver
      // deletePatient en store.js), para no dejar órdenes/resultados
      // huérfanos apuntando a un paciente que ya no existe.
      root.querySelectorAll("[data-eliminar-pac]").forEach(function (b) {
        b.addEventListener("click", function () {
          var p = S.getPatient(b.dataset.eliminarPac);
          if (!p) return;
          var tieneOrdenes = S.listOrders(session.tenantId).some(function (o) { return o.patientId === p.id; });
          if (tieneOrdenes) { U.toast("Este paciente ya tiene órdenes registradas — no se puede eliminar.", "error"); return; }
          if (!confirm('¿Eliminar al paciente "' + U.nombreCompleto(p) + '" (' + p.tipoDocumento + " " + p.numeroDocumento + ')? Esta acción no se puede deshacer.')) return;
          var res = S.deletePatient(p.id);
          if (!res.ok) { U.toast(res.error, "error"); return; }
          S.addAudit(session.tenantId, session.nombre, session.rol, "DELETE_PATIENT", "paciente", p.id, "Eliminó al paciente " + U.nombreCompleto(p) + ".");
          U.toast("Paciente eliminado.", "success");
          renderList(filter);
        });
      });
    }

    function rowPatient(p) {
      var esAdmin = session.rol === "admin";
      return "<tr><td>" + p.tipoDocumento + " " + U.esc(p.numeroDocumento) + "</td><td>" + U.esc(U.nombreCompleto(p)) + "</td><td>" + U.edadTexto(p) + "</td><td>" + p.sexo + "</td><td>" + (p.pais === "CO" ? U.esc(p.eps || "—") : "—") + "</td><td>" + U.esc(p.ciudad || "—") + "</td>" +
        '<td><div class="flex gap-2"><button class="btn btn-ghost btn-sm" data-edit="' + p.id + '">' + U.icon("edit") + " Editar</button>" +
        (session.rol !== "bacteriologo" || BIO_AUTH.tienePermisoExtra("ordenes") ? '<button class="btn btn-outline btn-sm" data-neworden="' + p.id + '">' + U.icon("plus") + " Orden</button>" : "") +
        (esAdmin ? '<button class="btn btn-ghost btn-sm" data-eliminar-pac="' + p.id + '" title="Eliminar paciente (solo si aún no tiene órdenes)">' + U.icon("trash") + "</button>" : "") +
        "</div></td></tr>";
    }
  };

  function openPatientForm(patient, onSaved) {
    var session = BIO_AUTH.getSession();
    var isEdit = !!patient;
    // Para un paciente nuevo, el país por defecto es el del propio
    // laboratorio (un laboratorio en Venezuela normalmente registra
    // pacientes venezolanos) — solo si es uno de los que este formulario
    // maneja (CO/VE/EC); cualquier otro país de tenant cae a Colombia, que
    // sigue siendo el valor por defecto de siempre.
    var tenant = BIO_AUTH.currentTenant();
    var paisPorDefecto = tenant && ["CO", "VE", "EC"].indexOf(tenant.pais) !== -1 ? tenant.pais : "CO";
    // El tipo de documento y el tipo de afiliación por defecto también
    // dependen del país: "CC"/"Contributivo" no existen en las listas de
    // Venezuela ni Ecuador, así que se toma el primero de la lista de cada
    // país (la cédula local y la afiliación más común, respectivamente).
    var tipoDocumentoPorDefecto = (C.TIPOS_DOCUMENTO[paisPorDefecto] || [])[0];
    var tipoAfiliacionPorDefecto = (C.TIPOS_AFILIACION[paisPorDefecto] || [])[0];
    // El campo de celular arranca con el indicativo del país del
    // laboratorio (ej. "+58 " en Venezuela) — así, cuando más adelante se
    // envíe un resultado por WhatsApp, el número ya trae el indicativo
    // correcto sin que quien registra el paciente tenga que acordarse de
    // escribirlo a mano.
    patient = patient || {
      pais: paisPorDefecto, tipoDocumento: tipoDocumentoPorDefecto ? tipoDocumentoPorDefecto.v : "CC",
      sexo: "Femenino", tipoAfiliacion: tipoAfiliacionPorDefecto || "Contributivo", procedencia: "Ambulatorio",
      celular: "+" + U.indicativoPais(paisPorDefecto) + " "
    };

    var docOptions = function (pais, current) {
      return (C.TIPOS_DOCUMENTO[pais] || []).map(function (d) { return '<option value="' + d.v + '" ' + (d.v === current ? "selected" : "") + ">" + d.t + "</option>"; }).join("");
    };
    var afilOptions = function (pais, current) {
      return (C.TIPOS_AFILIACION[pais] || []).map(function (a) { return '<option ' + (a === current ? "selected" : "") + ">" + a + "</option>"; }).join("");
    };
    var epsOptions = function (current) {
      return C.EPS_COLOMBIA.map(function (e) { return '<option ' + (e === current ? "selected" : "") + ">" + e + "</option>"; }).join("");
    };

    var wrap = U.openModal(
      '<h3 class="modal-title">' + (isEdit ? "Editar Paciente" : "Nuevo Paciente") + '</h3>' +
      '<p class="text-muted" style="margin-top:0">Registro completo según normativa de habilitación (Colombia / Venezuela / Ecuador).</p>' +
      '<div id="pac-existente-banner" class="hidden" style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px"></div>' +
      '<form id="pac-form">' +
        '<fieldset><legend>País e Identificación</legend><div class="form-grid">' +
          sel("pais", "País", ["CO", "VE", "EC"].map(function (p) { return '<option value="' + p + '" ' + (p === patient.pais ? "selected" : "") + ">" + (p === "CO" ? "Colombia" : p === "VE" ? "Venezuela" : "Ecuador") + "</option>"; }).join("")) +
          sel("tipoDocumento", "Tipo de Documento", docOptions(patient.pais, patient.tipoDocumento)) +
          inp("numeroDocumento", "Número de Documento", patient.numeroDocumento, true) +
          inp("fechaNacimiento", "Fecha de Nacimiento", patient.fechaNacimiento, false, "date") +
          inp("edadAnios", "Edad Aproximada en Años (si no conoce la fecha de nacimiento)", patient.edadAnios, false, "number") +
          sel("sexo", "Sexo Biológico", ["Femenino", "Masculino", "Indeterminado"].map(function (s) { return '<option ' + (s === patient.sexo ? "selected" : "") + ">" + s + "</option>"; }).join("")) +
        "</div>" +
        '<p class="text-muted" style="margin:0 0 8px">Ingresa la fecha de nacimiento o, si no se conoce, al menos la edad aproximada — no hace falta llenar los dos.</p></fieldset>' +
        '<fieldset><legend>Nombres</legend><div class="form-grid">' +
          inp("primerNombre", "Primer Nombre", patient.primerNombre, true) + inp("segundoNombre", "Segundo Nombre", patient.segundoNombre) +
          inp("primerApellido", "Primer Apellido", patient.primerApellido, true) + inp("segundoApellido", "Segundo Apellido", patient.segundoApellido) +
        "</div></fieldset>" +
        '<fieldset><legend>Contacto</legend><div class="form-grid">' +
          inp("direccion", "Dirección de Residencia", patient.direccion) + inp("ciudad", "Ciudad / Municipio", patient.ciudad) +
          inp("telefono", "Teléfono Fijo", patient.telefono) + inp("celular", "Celular", patient.celular) +
          inp("email", "Correo Electrónico", patient.email, false, "email") +
        "</div>" +
        '<div class="form-grid" id="co-rips-fields" style="display:' + (patient.pais === "CO" ? "grid" : "none") + '">' +
          sel("zonaResidencial", "Zona de Residencia (RIPS)", C.RIPS_ZONA_RESIDENCIAL.map(function (z) { return '<option value="' + z.v + '" ' + (z.v === patient.zonaResidencial ? "selected" : "") + ">" + z.t + "</option>"; }).join("")) +
          '<div class="field"><label>Código DANE del Municipio (RIPS)</label><input list="dane-list" id="f_codigoMunicipioDane" value="' + U.esc(patient.codigoMunicipioDane || "") + '" placeholder="Ej. 11001 = Bogotá D.C."/><datalist id="dane-list">' +
            C.MUNICIPIOS_DANE_COMUNES.map(function (m) { return '<option value="' + m.cod + '">' + U.esc(m.nombre) + "</option>"; }).join("") +
          '</datalist></div>' +
        "</div></fieldset>" +
        '<fieldset><legend>Aseguramiento y Remisión</legend><div class="form-grid">' +
          sel("tipoAfiliacion", "Tipo de Afiliación", afilOptions(patient.pais, patient.tipoAfiliacion)) +
          '<div class="field" id="eps-field" style="display:' + (patient.pais === "CO" ? "block" : "none") + '"><label>EPS / Asegurador / Entidad Responsable de Pago</label><input list="eps-list" id="f_eps" value="' + U.esc(patient.eps || "") + '"/><datalist id="eps-list">' + epsOptions() + "</datalist></div>" +
          inp("medicoRemitente", "Médico que Remite", patient.medicoRemitente) +
          sel("procedencia", "Procedencia", C.PROCEDENCIAS.map(function (p) { return '<option ' + (p === patient.procedencia ? "selected" : "") + ">" + p + "</option>"; }).join("")) +
          inp("ocupacion", "Ocupación", patient.ocupacion) +
        "</div></fieldset>" +
        '<fieldset><legend>Observaciones</legend><textarea id="f_observaciones">' + U.esc(patient.observaciones || "") + "</textarea></fieldset>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px">' +
          '<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Paciente</button>" +
        "</div>" +
      "</form>",
      { lg: true }
    );

    function refreshDependentSelects() {
      var pais = wrap.querySelector("#f_pais").value;
      wrap.querySelector("#f_tipoDocumento").innerHTML = docOptions(pais, patient.tipoDocumento);
      wrap.querySelector("#f_tipoAfiliacion").innerHTML = afilOptions(pais, patient.tipoAfiliacion);
      wrap.querySelector("#co-rips-fields").style.display = pais === "CO" ? "grid" : "none";
      // La EPS es una figura exclusivamente colombiana — para pacientes de
      // otros países ni se pide ni se guarda, para no confundir con un
      // concepto que no aplica ahí.
      var epsField = wrap.querySelector("#eps-field");
      epsField.style.display = pais === "CO" ? "block" : "none";
      if (pais !== "CO") wrap.querySelector("#f_eps").value = "";
      // Si el celular todavía es solo el indicativo (nadie escribió un
      // número encima), lo actualiza al indicativo del país recién elegido
      // — pero nunca toca un número que la persona ya empezó a digitar.
      if (!isEdit) {
        var celInput = wrap.querySelector("#f_celular");
        if (/^\+\d+\s*$/.test(celInput.value.trim())) celInput.value = "+" + U.indicativoPais(pais) + " ";
      }
    }
    wrap.querySelector("#f_pais").addEventListener("change", refreshDependentSelects);

    // Si el paciente ya asistió antes, no hace falta volver a digitar todo:
    // al escribir un número de documento que ya existe en este laboratorio,
    // se precargan sus datos y, al guardar, se actualiza ese mismo registro
    // en vez de crear uno duplicado. Solo aplica en "Nuevo Paciente" — al
    // editar uno ya abierto, esto no se activa.
    var pacienteExistenteId = null;
    function buscarPacienteExistente() {
      if (isEdit) return;
      var tipoDoc = wrap.querySelector("#f_tipoDocumento").value;
      var numDoc = wrap.querySelector("#f_numeroDocumento").value.trim();
      var banner = wrap.querySelector("#pac-existente-banner");
      if (!numDoc) { pacienteExistenteId = null; banner.classList.add("hidden"); return; }
      var encontrado = S.listPatients(session.tenantId).filter(function (p) { return p.numeroDocumento === numDoc && p.tipoDocumento === tipoDoc; })[0];
      if (!encontrado) { pacienteExistenteId = null; banner.classList.add("hidden"); return; }
      pacienteExistenteId = encontrado.id;
      var campos = ["pais", "tipoDocumento", "fechaNacimiento", "edadAnios", "sexo", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "direccion", "ciudad", "telefono", "celular", "email", "tipoAfiliacion", "eps", "medicoRemitente", "procedencia", "ocupacion",
        "observaciones", "zonaResidencial", "codigoMunicipioDane"];
      campos.forEach(function (c) {
        var el = wrap.querySelector("#f_" + c);
        if (el && encontrado[c] != null) el.value = encontrado[c];
      });
      refreshDependentSelects();
      wrap.querySelector("#f_tipoDocumento").value = tipoDoc;
      wrap.querySelector("#f_tipoAfiliacion").value = encontrado.tipoAfiliacion || "";
      banner.classList.remove("hidden");
      banner.innerHTML = "✅ <b>" + U.esc(U.nombreCompleto(encontrado)) + "</b> ya está registrado(a) — se cargaron sus datos. Si guardas, se actualiza este mismo registro (no se crea uno duplicado). Revisa que sea la misma persona antes de guardar.";
    }
    wrap.querySelector("#f_numeroDocumento").addEventListener("blur", buscarPacienteExistente);
    wrap.querySelector("#f_tipoDocumento").addEventListener("change", buscarPacienteExistente);

    wrap.querySelector("#pac-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
      var data = {
        tenantId: session.tenantId, pais: g("pais"), tipoDocumento: g("tipoDocumento"), numeroDocumento: g("numeroDocumento"),
        primerNombre: g("primerNombre"), segundoNombre: g("segundoNombre"), primerApellido: g("primerApellido"), segundoApellido: g("segundoApellido"),
        fechaNacimiento: g("fechaNacimiento"), edadAnios: g("edadAnios"), sexo: g("sexo"), direccion: g("direccion"), ciudad: g("ciudad"), telefono: g("telefono"),
        celular: g("celular"), email: g("email"), tipoAfiliacion: g("tipoAfiliacion"), eps: g("eps"), medicoRemitente: g("medicoRemitente"),
        procedencia: g("procedencia"), ocupacion: g("ocupacion"), observaciones: g("observaciones"),
        zonaResidencial: g("zonaResidencial"), codigoMunicipioDane: g("codigoMunicipioDane")
      };
      if (!data.numeroDocumento || !data.primerNombre || !data.primerApellido) {
        U.toast("Completa los campos obligatorios: documento, primer nombre y primer apellido.", "error");
        return;
      }
      if (!data.fechaNacimiento && !data.edadAnios) {
        U.toast("Ingresa la fecha de nacimiento o, si no se conoce, al menos la edad aproximada del paciente.", "error");
        return;
      }
      if (isEdit || pacienteExistenteId) {
        var idAActualizar = isEdit ? patient.id : pacienteExistenteId;
        S.updatePatient(idAActualizar, data);
        S.addAudit(session.tenantId, session.nombre, session.rol, "UPDATE_PATIENT", "paciente", idAActualizar, "Actualizó datos del paciente " + U.nombreCompleto(data));
        U.toast(pacienteExistenteId && !isEdit ? "Ya estaba registrado(a) — se actualizaron sus datos." : "Paciente actualizado.", "success");
        U.closeModal(wrap);
        onSaved();
      } else {
        var created = S.createPatient(Object.assign(data, { creadoPor: session.username }));
        S.addAudit(session.tenantId, session.nombre, session.rol, "CREATE_PATIENT", "paciente", created.id, "Registró al paciente " + U.nombreCompleto(data));
        U.toast("Paciente registrado.", "success");
        U.closeModal(wrap);
        onSaved();
        if (created.email) ofrecerCorreoRegistro(created);
      }
    });
  }
  window.BIO_openPatientForm = openPatientForm;

  function ofrecerCorreoRegistro(patient) {
    var session = BIO_AUTH.getSession();
    var tenant = BIO_AUTH.currentTenant();
    var asunto = "Confirmación de Registro — " + tenant.nombre;
    var cuerpo =
      "Estimado(a) " + U.nombreCompleto(patient) + ",\n\n" +
      "Le confirmamos que su registro en " + tenant.nombre + " se realizó exitosamente el " + U.fmtFechaCorta(patient.creadoEn) + ".\n\n" +
      "Datos registrados:\n" +
      "- Documento: " + patient.tipoDocumento + " " + patient.numeroDocumento + "\n" +
      (patient.pais === "CO" ? "- EPS / Asegurador: " + (patient.eps || "Particular") + "\n" : "") +
      "- Médico remitente: " + (patient.medicoRemitente || "—") + "\n\n" +
      "Si su información es correcta, no necesita hacer nada más. Si detecta algún error, por favor respóndanos a este correo o comuníquese con nosotros.\n\n" +
      "Gracias por confiar en " + tenant.nombre + " para el cuidado de su salud.\n\n" +
      "Atentamente,\n" + tenant.nombre + "\n" +
      (tenant.direccion || "") + (tenant.telefonos ? " · " + tenant.telefonos : "") + "\n" +
      (tenant.email || "") + (tenant.sitioWeb ? " · " + tenant.sitioWeb : "");

    var wrap = U.openModal(
      '<h3 class="modal-title">' + U.icon("send") + " Enviar Correo de Confirmación de Registro</h3>" +
      '<p class="text-muted">Elige con qué correo enviar este mensaje profesional ya redactado para <b>' + U.esc(patient.email) + "</b>, confirmando el registro de " + U.esc(U.nombreCompleto(patient)) + " en " + U.esc(tenant.nombre) + ".</p>" +
      '<div class="card" style="background:var(--surface-2);box-shadow:none;font-size:12.5px;white-space:pre-wrap;max-height:260px;overflow-y:auto">' + U.esc(cuerpo) + "</div>" +
      U.emailProviderButtonsHtml("regmail") +
      '<div class="flex gap-2 justify-between" style="margin-top:14px">' +
      '<button class="btn btn-ghost" data-modal-close>Omitir</button>' +
      "</div>",
      { lg: true }
    );
    U.wireEmailProviderButtons(wrap, "regmail", patient.email, asunto, cuerpo);
    wrap.querySelectorAll('[id^="regmail-"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.addAudit(session.tenantId, session.nombre, session.rol, "SEND_REGISTRATION_EMAIL", "paciente", patient.id, "Envió correo de confirmación de registro a " + patient.email + ".");
        U.toast("Correo abierto para enviar la confirmación.", "success");
        U.closeModal(wrap);
      });
    });
  }

  function inp(id, label, value, required, type) {
    return '<div class="field"><label>' + label + (required ? ' *' : '') + '</label><input id="f_' + id + '" type="' + (type || "text") + '" value="' + U.esc(value || "") + '" ' + (type === "number" ? 'step="any"' : "") + " " + (required ? "required" : "") + "/></div>";
  }
  function sel(id, label, optionsHtml) {
    return '<div class="field"><label>' + label + '</label><select id="f_' + id + '">' + optionsHtml + "</select></div>";
  }
  window.BIO_formHelpers = { inp: inp, sel: sel };
})();

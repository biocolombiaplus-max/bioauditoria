/* BIOsoft — CRM interno de clientes (solo superadmin): leads, contratos, cobros */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;

  var ESTADO_LABEL = {
    nuevo: "Nuevo / Interesado", contrato_enviado: "Contrato enviado", pagado: "Pagado",
    activo: "Activo", recordatorio_enviado: "Recordatorio enviado", en_mora: "En mora",
    bloqueado: "Bloqueado", cancelado: "Cancelado"
  };
  var WA_NUMBER = "573505457420";
  function waLink(mensaje) { return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(mensaje); }
  function waLinkTo(numero, mensaje) { return "https://wa.me/" + (numero || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(mensaje); }

  function diasHasta(fechaISO) {
    if (!fechaISO) return null;
    return Math.ceil((new Date(fechaISO) - new Date()) / 86400000);
  }
  function fmtFechaCorta(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
  }

  function badgeCobro(c) {
    if (["nuevo", "contrato_enviado", "bloqueado", "cancelado"].indexOf(c.estado) !== -1) return '<span class="text-muted" style="font-size:12px">—</span>';
    var dias = diasHasta(c.proximaFechaCobro);
    if (dias === null) return '<span class="text-muted" style="font-size:12px">—</span>';
    if (dias < 0) return '<span class="badge badge-urgente">En mora · ' + Math.abs(dias) + ' día(s)</span>';
    if (dias <= 5) return '<span class="badge badge-pendiente">Vence en ' + dias + ' día(s)</span>';
    return '<span class="badge badge-validado">Al día · vence ' + fmtFechaCorta(c.proximaFechaCobro) + "</span>";
  }

  window.BIO_VIEWS.crm = function (root) {
    var clientes = [];
    var cargando = true;
    var unsub = null;

    function cargar() {
      S.crm.list().then(function (list) {
        clientes = list;
        cargando = false;
        build();
      }).catch(function (err) {
        cargando = false;
        root.innerHTML = '<div class="card"><p class="text-muted">No se pudo cargar el CRM: ' + U.esc(err.message || String(err)) + '</p></div>';
      });
    }

    function build() {
      if (cargando) { root.innerHTML = '<div class="card"><p class="text-muted">Cargando clientes…</p></div>'; return; }
      root.innerHTML =
        '<div class="kpi-grid">' +
          kpi(clientes.length, "Clientes / Leads") +
          kpi(clientes.filter(function (c) { return c.estado === "activo" || c.estado === "recordatorio_enviado"; }).length, "Activos") +
          kpi(clientes.filter(function (c) { var d = diasHasta(c.proximaFechaCobro); return d !== null && d < 0; }).length, "En Mora") +
          kpi(clientes.filter(function (c) { return c.estado === "nuevo" || c.estado === "contrato_enviado"; }).length, "Por Cerrar") +
        "</div>" +
        '<div class="card"><div class="card-header"><h3 class="card-title">Clientes y Leads (' + clientes.length + ')</h3>' +
        '<button class="btn btn-primary" id="btn-new-crm">' + U.icon("plus") + ' Nuevo Cliente</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Laboratorio</th><th>Contacto</th><th>Plan</th><th>Estado</th><th>Próximo cobro</th><th></th></tr></thead><tbody>' +
        (clientes.length ? clientes.map(rowHtml).join("") : '<tr><td colspan="6" class="text-muted">Aún no hay clientes registrados. Usa "Nuevo Cliente" para agregar el primero.</td></tr>') +
        "</tbody></table></div></div>";
      document.getElementById("btn-new-crm").addEventListener("click", function () { openForm(null); });
      wireRowActions();
    }

    function rowHtml(c) {
      var lab = c.laboratorio || {}, contacto = c.contacto || {};
      var plan = BIO_PLANES.porId(c.planId) || {};
      return "<tr><td><b>" + U.esc(lab.nombre || "—") + "</b><div class='text-muted' style='font-size:11px'>" + U.esc(lab.ciudad || "") + (lab.pais ? ", " + U.esc(lab.pais) : "") + "</div></td>" +
        "<td>" + U.esc(contacto.nombre || "—") + "<div class='text-muted' style='font-size:11px'>" + U.esc(contacto.whatsapp || contacto.correo || "—") + "</div></td>" +
        "<td>" + U.esc(plan.nombre || "—") + "</td>" +
        "<td>" + (ESTADO_LABEL[c.estado] || c.estado) + "</td>" +
        "<td>" + badgeCobro(c) + "</td>" +
        "<td><div class='flex gap-2 wrap'>" +
        "<button class='btn btn-outline btn-sm' data-contrato='" + c.id + "'>" + U.icon("file") + " Contrato</button>" +
        "<button class='btn btn-outline btn-sm' data-recibo='" + c.id + "'>" + U.icon("file") + " Recibo</button>" +
        (c.estado !== "activo" ? "<button class='btn btn-primary btn-sm' data-pagado='" + c.id + "'>" + U.icon("check") + " Marcar Pagado</button>" : "") +
        "<button class='btn btn-whatsapp btn-sm' data-recordatorio='" + c.id + "'>" + U.icon("send") + " Recordatorio</button>" +
        "<button class='btn btn-ghost btn-sm' data-editar='" + c.id + "'>" + U.icon("edit") + "</button>" +
        "</div></td></tr>";
    }

    function kpi(value, label) {
      return '<div class="kpi"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + label + '</div></div>';
    }

    function clienteParaDocs(c) {
      var lab = c.laboratorio || {}, contacto = c.contacto || {};
      var secciones = (c.seccionesIds || []).map(function (id) { return C.seccionNombre(id); }).join(", ");
      return { laboratorio: lab, contacto: contacto, seccionesTexto: secciones || "por definir" };
    }

    function descargarYAbrir(bytes, nombreArchivo, contacto, mensaje) {
      U.downloadBytes(bytes, nombreArchivo);
      U.toast("Descargado. Ahora elige por dónde enviarlo.", "success");
      if (contacto && contacto.whatsapp) window.open(waLinkTo(contacto.whatsapp, mensaje), "_blank");
      else window.open(waLink(mensaje), "_blank");
    }

    function wireRowActions() {
      root.querySelectorAll("[data-contrato]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.contrato; })[0];
        var plan = BIO_PLANES.porId(c.planId);
        if (!plan) { U.toast("Este cliente no tiene un plan asignado.", "error"); return; }
        var bytes = BIO_PDF_CRM.buildContratoPDF(clienteParaDocs(c), plan);
        var mensaje = "Hola " + (c.contacto && c.contacto.nombre ? c.contacto.nombre.split(" ")[0] : "") + " 👋 Te comparto el contrato de prestación de servicios de BIOsoft para " + (c.laboratorio && c.laboratorio.nombre || "tu laboratorio") + ". Cualquier duda, quedo atento.";
        descargarYAbrir(bytes, "Contrato_BIOsoft_" + (c.laboratorio.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf", c.contacto, mensaje);
        if (c.estado === "nuevo") S.crm.update(c.id, { estado: "contrato_enviado" }).then(cargar);
      }); });

      root.querySelectorAll("[data-recibo]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.recibo; })[0];
        var plan = BIO_PLANES.porId(c.planId);
        if (!plan) { U.toast("Este cliente no tiene un plan asignado.", "error"); return; }
        var pago = { fecha: c.fechaPagoInicial || new Date(), totalFmt: c.totalPrimerPagoFmt, totalUSD: c.totalPrimerPagoUSD, proximaFecha: c.proximaFechaCobro };
        var bytes = BIO_PDF_CRM.buildReciboPDF(clienteParaDocs(c), plan, pago);
        var mensaje = "Hola " + (c.contacto && c.contacto.nombre ? c.contacto.nombre.split(" ")[0] : "") + " 👋 Aquí tienes el recibo de tu pago a BIOsoft. ¡Gracias por confiar en nosotros!";
        descargarYAbrir(bytes, "Recibo_BIOsoft_" + (c.laboratorio.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf", c.contacto, mensaje);
      }); });

      root.querySelectorAll("[data-pagado]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.pagado; })[0];
        abrirMarcarPagado(c);
      }); });

      root.querySelectorAll("[data-recordatorio]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.recordatorio; })[0];
        var plan = BIO_PLANES.porId(c.planId) || {};
        var dias = diasHasta(c.proximaFechaCobro);
        var estadoTexto = dias !== null && dias < 0 ? "tiene " + Math.abs(dias) + " día(s) de mora" : "vence pronto";
        var mensaje = "Hola " + (c.contacto && c.contacto.nombre ? c.contacto.nombre.split(" ")[0] : "") + " 👋 Te escribimos de BIOsoft: tu mensualidad del Plan " + (plan.nombre || "") + " " + estadoTexto +
          " (vencimiento: " + fmtFechaCorta(c.proximaFechaCobro) + "). Puedes pagarla aquí: " + (plan.wompiLink || "") + ". Cualquier duda, quedamos atentos.";
        window.open(waLinkTo(c.contacto && c.contacto.whatsapp, mensaje), "_blank");
        S.crm.update(c.id, { estado: "recordatorio_enviado" }).then(cargar);
      }); });

      root.querySelectorAll("[data-editar]").forEach(function (b) { b.addEventListener("click", function () {
        openForm(clientes.filter(function (x) { return x.id === b.dataset.editar; })[0]);
      }); });
    }

    function abrirMarcarPagado(c) {
      var plan = BIO_PLANES.porId(c.planId);
      if (!plan) { U.toast("Asigna un plan a este cliente antes de marcarlo como pagado.", "error"); return; }
      var totalCOP = BIO_PLANES.IMPLEMENTACION.cop + plan.precio;
      var totalUSD = BIO_PLANES.IMPLEMENTACION.usd + plan.usd;
      var wrap = U.openModal(
        '<h3 class="modal-title">Marcar como Pagado — ' + U.esc(c.laboratorio.nombre || "") + '</h3>' +
        '<p class="text-muted">Se calculará la próxima fecha de cobro a 30 días desde la fecha de pago, y se generará el recibo automáticamente.</p>' +
        '<div class="field"><label>Fecha de pago</label><input type="date" id="mp-fecha" value="' + new Date().toISOString().slice(0, 10) + '"/></div>' +
        '<p style="font-size:13px"><b>Total recibido:</b> $' + totalCOP.toLocaleString("es-CO") + ' COP (aprox. $' + totalUSD + ' USD)</p>' +
        '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="mp-confirmar">' + U.icon("check") + " Confirmar Pago</button></div>"
      );
      wrap.querySelector("#mp-confirmar").addEventListener("click", function () {
        var fechaPago = new Date(wrap.querySelector("#mp-fecha").value + "T12:00:00");
        var proxima = new Date(fechaPago.getTime() + 30 * 864e5);
        var patch = {
          estado: "activo",
          fechaPagoInicial: fechaPago.toISOString(),
          proximaFechaCobro: proxima.toISOString(),
          totalPrimerPagoFmt: totalCOP.toLocaleString("es-CO"),
          totalPrimerPagoUSD: totalUSD
        };
        S.crm.update(c.id, patch).then(function () {
          U.closeModal(wrap);
          U.toast("Pago registrado. Próximo cobro: " + fmtFechaCorta(proxima.toISOString()), "success");
          var bytes = BIO_PDF_CRM.buildReciboPDF(clienteParaDocs(c), plan, { fecha: fechaPago, totalFmt: patch.totalPrimerPagoFmt, totalUSD: patch.totalPrimerPagoUSD, proximaFecha: patch.proximaFechaCobro });
          U.downloadBytes(bytes, "Recibo_BIOsoft_" + (c.laboratorio.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf");
          cargar();
        }).catch(function (err) { U.toast("No se pudo guardar: " + err.message, "error"); });
      });
    }

    function openForm(cliente) {
      var isEdit = !!cliente;
      cliente = cliente || { laboratorio: {}, contacto: {}, seccionesIds: [] };
      var lab = cliente.laboratorio || {}, contacto = cliente.contacto || {};
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Cliente" : "Nuevo Cliente") + '</h3>' +
        '<form id="crm-form">' +
        '<fieldset><legend>Laboratorio</legend><div class="form-grid">' +
        F.inp("labNombre", "Nombre del Laboratorio", lab.nombre, true) +
        F.inp("labNit", "NIT / RIF / RUC", lab.nit) +
        F.inp("labCiudad", "Ciudad", lab.ciudad) +
        F.sel("labPais", "País", ["CO", "VE", "EC", "MX", "PE", "AR", "BO", "BR"].map(function (p) { return "<option value='" + p + "' " + (p === lab.pais ? "selected" : "") + ">" + p + "</option>"; }).join("")) +
        "</div></fieldset>" +
        '<fieldset><legend>Contacto</legend><div class="form-grid">' +
        F.inp("contNombre", "Nombre del Contacto", contacto.nombre, true) +
        F.inp("contCargo", "Cargo", contacto.cargo) +
        F.inp("contWhatsapp", "WhatsApp (con indicativo, solo números)", contacto.whatsapp) +
        F.inp("contCorreo", "Correo Electrónico", contacto.correo, false, "email") +
        "</div></fieldset>" +
        '<fieldset><legend>Plan</legend><div class="form-grid">' +
        F.sel("plan", "Plan Contratado", BIO_PLANES.PLANES.map(function (p) { return "<option value='" + p.id + "' " + (p.id === cliente.planId ? "selected" : "") + ">" + p.nombre + " (" + p.usuarios + ") — $" + p.precioFmt + "/mes</option>"; }).join("")) +
        "</div></fieldset>" +
        '<div class="field"><label>Secciones del laboratorio que maneja</label><div class="form-grid">' +
        C.SECCIONES.map(function (s) {
          var checked = (cliente.seccionesIds || []).indexOf(s.id) !== -1;
          return '<div class="checkbox-row"><input type="checkbox" data-seccion="' + s.id + '" ' + (checked ? "checked" : "") + '/><label style="margin:0">' + s.nombre + "</label></div>";
        }).join("") + "</div></div>" +
        '<div class="field"><label>Notas</label><textarea id="crm-notas">' + U.esc(cliente.notas || "") + "</textarea></div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button></div>" +
        "</form>", { lg: true }
      );
      wrap.querySelector("#crm-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value.trim(); };
        var secciones = Array.prototype.slice.call(wrap.querySelectorAll("[data-seccion]:checked")).map(function (c) { return c.dataset.seccion; });
        if (!g("labNombre") || !g("contNombre")) { U.toast("Completa al menos el nombre del laboratorio y del contacto.", "error"); return; }
        var data = {
          laboratorio: { nombre: g("labNombre"), nit: g("labNit"), ciudad: g("labCiudad"), pais: g("labPais") },
          contacto: { nombre: g("contNombre"), cargo: g("contCargo"), whatsapp: g("contWhatsapp"), correo: g("contCorreo") },
          planId: wrap.querySelector("#f_plan").value,
          seccionesIds: secciones,
          notas: wrap.querySelector("#crm-notas").value.trim()
        };
        var promesa = isEdit ? S.crm.update(cliente.id, data) : S.crm.create(data);
        promesa.then(function () {
          U.toast("Cliente guardado.", "success");
          U.closeModal(wrap);
          cargar();
        }).catch(function (err) { U.toast("No se pudo guardar: " + err.message, "error"); });
      });
    }

    cargar();
    unsub = S.crm.watch(function () { cargar(); });
  };
})();

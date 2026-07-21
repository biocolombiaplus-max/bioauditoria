/* BIOsoft — CRM interno de clientes (solo superadmin): leads, contratos, cobros,
   plantillas de WhatsApp, difusión guiada, tablero Kanban y seguimiento. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;

  var ESTADO_LABEL = {
    nuevo: "Nuevo / Interesado", contrato_enviado: "Contrato enviado", pagado: "Pagado",
    activo: "Activo", recordatorio_enviado: "Recordatorio enviado", en_mora: "En mora",
    bloqueado: "Bloqueado", cancelado: "Cancelado"
  };
  var KANBAN_COLS = [
    { key: "nuevo", label: "Nuevo / Interesado", estados: ["nuevo"] },
    { key: "contrato_enviado", label: "Contrato Enviado", estados: ["contrato_enviado"] },
    { key: "activo", label: "Activo", estados: ["activo", "recordatorio_enviado", "pagado"] },
    { key: "cancelado", label: "Cancelado / Bloqueado", estados: ["cancelado", "bloqueado"] }
  ];
  var PLANTILLAS_EJEMPLO = [
    { nombre: "Primer contacto", mensaje: "Hola {nombre} 👋 Soy del equipo de BIOsoft, el software de laboratorio clínico. Vi tu interés y quiero ayudarte a personalizar tu sistema para {laboratorio}. ¿Tienes unos minutos para contarte cómo funciona?" },
    { nombre: "Recordatorio de pago", mensaje: "Hola {nombre} 👋 Te escribimos de BIOsoft: la mensualidad del Plan {plan} de {laboratorio} vence el {fecha_cobro}. Puedes pagarla aquí: {link_pago}. Cualquier duda, quedamos atentos." },
    { nombre: "Bienvenida - contrato enviado", mensaje: "¡Bienvenido a BIOsoft, {laboratorio}! 🎉 Te acabamos de enviar el contrato. En 7 a 10 días hábiles tendrás tu sistema personalizado funcionando. Cualquier duda, aquí estamos." }
  ];
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
  function badgeOrigen(c) {
    var od = c.origenDetalle || {};
    if (od.utmSource && /meta|facebook|instagram|^fb$|^ig$/i.test(od.utmSource)) return '<span class="badge badge-preliminar">📣 Meta Ads</span>';
    if (od.utmSource) return '<span class="badge badge-preliminar">📣 ' + U.esc(od.utmSource) + '</span>';
    if (c.origen === "formulario_publico") return '<span class="badge badge-rutina">🌐 Formulario</span>';
    return '<span class="badge badge-rutina">✋ Manual</span>';
  }

  function llenarPlantilla(texto, c, plantillasCtx) {
    var lab = c.laboratorio || {}, contacto = c.contacto || {};
    var plan = BIO_PLANES.porId(c.planId) || {};
    var primerNombre = contacto.nombre ? contacto.nombre.split(" ")[0] : "";
    return (texto || "")
      .replace(/\{nombre\}/g, primerNombre)
      .replace(/\{laboratorio\}/g, lab.nombre || "")
      .replace(/\{plan\}/g, plan.nombre || "")
      .replace(/\{fecha_cobro\}/g, fmtFechaCorta(c.proximaFechaCobro))
      .replace(/\{link_pago\}/g, plan.wompiLink || "");
  }

  window.BIO_VIEWS.crm = function (root) {
    var clientes = [];
    var plantillas = [];
    var cargando = true;
    var vista = "tabla";
    var seleccionados = {};
    var unsubClientes = null, unsubPlantillas = null;

    function cargar() {
      Promise.all([S.crm.list(), S.plantillas.list()]).then(function (res) {
        clientes = res[0];
        plantillas = res[1];
        cargando = false;
        build();
      }).catch(function (err) {
        cargando = false;
        root.innerHTML = '<div class="card"><p class="text-muted">No se pudo cargar el CRM: ' + U.esc(err.message || String(err)) + '</p></div>';
      });
    }

    function agregarActividad(c, tipo, detalle) {
      var entry = { fecha: S.nowISO(), tipo: tipo, detalle: detalle };
      var actual = (c.actividad || []).slice();
      actual.push(entry);
      c.actividad = actual;
      return S.crm.update(c.id, { actividad: actual });
    }

    function build() {
      if (cargando) { root.innerHTML = '<div class="card"><p class="text-muted">Cargando clientes…</p></div>'; return; }
      var nSel = Object.keys(seleccionados).filter(function (k) { return seleccionados[k]; }).length;
      root.innerHTML =
        '<div class="kpi-grid">' +
          kpi(clientes.length, "Clientes / Leads") +
          kpi(clientes.filter(function (c) { return c.estado === "activo" || c.estado === "recordatorio_enviado"; }).length, "Activos") +
          kpi(clientes.filter(function (c) { var d = diasHasta(c.proximaFechaCobro); return d !== null && d < 0; }).length, "En Mora") +
          kpi(clientes.filter(function (c) { return c.estado === "nuevo" || c.estado === "contrato_enviado"; }).length, "Por Cerrar") +
        "</div>" +
        '<div class="card"><div class="card-header"><h3 class="card-title">Clientes y Leads (' + clientes.length + ')</h3>' +
        '<div class="flex gap-2 wrap">' +
        '<div class="crm-view-toggle"><button type="button" class="' + (vista === "tabla" ? "active" : "") + '" data-vista="tabla">☰ Tabla</button><button type="button" class="' + (vista === "kanban" ? "active" : "") + '" data-vista="kanban">🗂️ Kanban</button></div>' +
        '<button class="btn btn-outline btn-sm" id="btn-plantillas">📝 Plantillas</button>' +
        (nSel ? '<button class="btn btn-whatsapp btn-sm" id="btn-difusion">' + U.icon("send") + ' Difusión (' + nSel + ')</button>' : "") +
        '<button class="btn btn-primary btn-sm" id="btn-new-crm">' + U.icon("plus") + ' Nuevo Cliente</button>' +
        "</div></div>" +
        (vista === "tabla" ? buildTablaHtml() : buildKanbanHtml()) +
        "</div>";
      document.getElementById("btn-new-crm").addEventListener("click", function () { openForm(null); });
      document.getElementById("btn-plantillas").addEventListener("click", abrirPlantillas);
      var btnDif = document.getElementById("btn-difusion");
      if (btnDif) btnDif.addEventListener("click", abrirDifusion);
      root.querySelectorAll("[data-vista]").forEach(function (b) {
        b.addEventListener("click", function () { vista = b.dataset.vista; build(); });
      });
      if (vista === "tabla") { wireRowActions(); wireSeleccion(); } else { wireKanbanDnD(); }
    }

    function buildTablaHtml() {
      return '<div class="table-wrap"><table><thead><tr><th></th><th>Laboratorio</th><th>Contacto</th><th>Origen</th><th>Plan</th><th>Estado</th><th>Próximo cobro</th><th></th></tr></thead><tbody>' +
        (clientes.length ? clientes.map(rowHtml).join("") : '<tr><td colspan="8" class="text-muted">Aún no hay clientes registrados. Usa "Nuevo Cliente" para agregar el primero.</td></tr>') +
        "</tbody></table></div>";
    }

    function rowHtml(c) {
      var lab = c.laboratorio || {}, contacto = c.contacto || {};
      var plan = BIO_PLANES.porId(c.planId) || {};
      return "<tr><td><input type='checkbox' data-sel='" + c.id + "' " + (seleccionados[c.id] ? "checked" : "") + "/></td>" +
        "<td><b>" + U.esc(lab.nombre || "—") + "</b><div class='text-muted' style='font-size:11px'>" + U.esc(lab.ciudad || "") + (lab.pais ? ", " + U.esc(lab.pais) : "") + "</div></td>" +
        "<td>" + U.esc(contacto.nombre || "—") + "<div class='text-muted' style='font-size:11px'>" + U.esc(contacto.whatsapp || contacto.correo || "—") + "</div></td>" +
        "<td>" + badgeOrigen(c) + "</td>" +
        "<td>" + U.esc(plan.nombre || "—") + "</td>" +
        "<td>" + (ESTADO_LABEL[c.estado] || c.estado) + "</td>" +
        "<td>" + badgeCobro(c) + "</td>" +
        "<td><div class='flex gap-2 wrap'>" +
        "<button class='btn btn-outline btn-sm' data-contrato='" + c.id + "'>" + U.icon("file") + " Contrato</button>" +
        "<button class='btn btn-outline btn-sm' data-recibo='" + c.id + "'>" + U.icon("file") + " Recibo</button>" +
        (c.estado !== "activo" ? "<button class='btn btn-primary btn-sm' data-pagado='" + c.id + "'>" + U.icon("check") + " Marcar Pagado</button>" : "") +
        "<button class='btn btn-whatsapp btn-sm' data-mensaje='" + c.id + "'>" + U.icon("send") + " Mensaje</button>" +
        "<button class='btn btn-outline btn-sm' data-correo='" + c.id + "'>📧 Correo</button>" +
        "<button class='btn btn-ghost btn-sm' data-actividad='" + c.id + "'>🕓</button>" +
        "<button class='btn btn-ghost btn-sm' data-editar='" + c.id + "'>" + U.icon("edit") + "</button>" +
        "</div></td></tr>";
    }

    function buildKanbanHtml() {
      return '<div class="kanban-board">' + KANBAN_COLS.map(function (col) {
        var items = clientes.filter(function (c) { return col.estados.indexOf(c.estado) !== -1; });
        return '<div class="kanban-col"><div class="kanban-col-head">' + col.label + " (" + items.length + ')</div><div class="kanban-col-body" data-kanban-drop="' + col.key + '">' +
          (items.length ? items.map(kanbanCardHtml).join("") : '<div class="kanban-empty text-muted">Sin leads aquí</div>') +
          "</div></div>";
      }).join("") + "</div>";
    }

    function kanbanCardHtml(c) {
      var lab = c.laboratorio || {}, contacto = c.contacto || {};
      var plan = BIO_PLANES.porId(c.planId) || {};
      return '<div class="kanban-card" draggable="true" data-kanban-id="' + c.id + '">' +
        '<div style="font-weight:700;font-size:13px">' + U.esc(lab.nombre || "—") + "</div>" +
        '<div class="text-muted" style="font-size:11.5px">' + U.esc(contacto.nombre || "—") + "</div>" +
        '<div style="margin-top:6px">' + badgeOrigen(c) + "</div>" +
        '<div style="margin-top:4px;font-size:11.5px">' + U.esc(plan.nombre || "Sin plan") + "</div>" +
        '<div style="margin-top:6px">' + badgeCobro(c) + "</div>" +
        "</div>";
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

    function wireSeleccion() {
      root.querySelectorAll("[data-sel]").forEach(function (b) {
        b.addEventListener("change", function () {
          seleccionados[b.dataset.sel] = b.checked;
          build();
        });
      });
    }

    function wireKanbanDnD() {
      root.querySelectorAll("[data-kanban-id]").forEach(function (card) {
        card.addEventListener("dragstart", function (e) {
          e.dataTransfer.setData("text/plain", card.dataset.kanbanId);
          card.classList.add("dragging");
        });
        card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
        card.addEventListener("click", function () {
          openForm(clientes.filter(function (x) { return x.id === card.dataset.kanbanId; })[0]);
        });
      });
      root.querySelectorAll("[data-kanban-drop]").forEach(function (col) {
        col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("drop-hover"); });
        col.addEventListener("dragleave", function () { col.classList.remove("drop-hover"); });
        col.addEventListener("drop", function (e) {
          e.preventDefault();
          col.classList.remove("drop-hover");
          var id = e.dataTransfer.getData("text/plain");
          var target = KANBAN_COLS.filter(function (k) { return k.key === col.dataset.kanbanDrop; })[0];
          var c = clientes.filter(function (x) { return x.id === id; })[0];
          if (!c || !target || c.estado === target.estados[0]) return;
          var nuevoEstado = target.estados[0];
          S.crm.update(id, { estado: nuevoEstado }).then(function () {
            return agregarActividad(c, "cambio_etapa", 'Etapa cambiada a "' + (ESTADO_LABEL[nuevoEstado] || nuevoEstado) + '".');
          }).then(cargar);
        });
      });
    }

    function wireRowActions() {
      root.querySelectorAll("[data-contrato]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.contrato; })[0];
        var plan = BIO_PLANES.porId(c.planId);
        if (!plan) { U.toast("Este cliente no tiene un plan asignado.", "error"); return; }
        var bytes = BIO_PDF_CRM.buildContratoPDF(clienteParaDocs(c), plan);
        var mensaje = "Hola " + (c.contacto && c.contacto.nombre ? c.contacto.nombre.split(" ")[0] : "") + " 👋 Te comparto el contrato de prestación de servicios de BIOsoft para " + (c.laboratorio && c.laboratorio.nombre || "tu laboratorio") + ". Cualquier duda, quedo atento.";
        descargarYAbrir(bytes, "Contrato_BIOsoft_" + (c.laboratorio.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf", c.contacto, mensaje);
        var p = (c.estado === "nuevo" ? S.crm.update(c.id, { estado: "contrato_enviado" }) : Promise.resolve());
        p.then(function () { return agregarActividad(c, "contrato", "Contrato enviado por WhatsApp."); }).then(cargar);
      }); });

      root.querySelectorAll("[data-recibo]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.recibo; })[0];
        var plan = BIO_PLANES.porId(c.planId);
        if (!plan) { U.toast("Este cliente no tiene un plan asignado.", "error"); return; }
        var pago = { fecha: c.fechaPagoInicial || new Date(), totalFmt: c.totalPrimerPagoFmt, totalUSD: c.totalPrimerPagoUSD, proximaFecha: c.proximaFechaCobro };
        var bytes = BIO_PDF_CRM.buildReciboPDF(clienteParaDocs(c), plan, pago);
        var mensaje = "Hola " + (c.contacto && c.contacto.nombre ? c.contacto.nombre.split(" ")[0] : "") + " 👋 Aquí tienes el recibo de tu pago a BIOsoft. ¡Gracias por confiar en nosotros!";
        descargarYAbrir(bytes, "Recibo_BIOsoft_" + (c.laboratorio.nombre || "Cliente").replace(/\s+/g, "_") + ".pdf", c.contacto, mensaje);
        agregarActividad(c, "recibo", "Recibo de pago enviado por WhatsApp.");
      }); });

      root.querySelectorAll("[data-pagado]").forEach(function (b) { b.addEventListener("click", function () {
        var c = clientes.filter(function (x) { return x.id === b.dataset.pagado; })[0];
        abrirMarcarPagado(c);
      }); });

      root.querySelectorAll("[data-mensaje]").forEach(function (b) { b.addEventListener("click", function () {
        abrirMensajeConPlantilla(clientes.filter(function (x) { return x.id === b.dataset.mensaje; })[0]);
      }); });

      root.querySelectorAll("[data-correo]").forEach(function (b) { b.addEventListener("click", function () {
        abrirCorreo(clientes.filter(function (x) { return x.id === b.dataset.correo; })[0]);
      }); });

      root.querySelectorAll("[data-actividad]").forEach(function (b) { b.addEventListener("click", function () {
        abrirActividad(clientes.filter(function (x) { return x.id === b.dataset.actividad; })[0]);
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
          return agregarActividad(c, "pago", "Pago registrado. Próximo cobro: " + fmtFechaCorta(proxima.toISOString()) + ".");
        }).then(cargar).catch(function (err) { U.toast("No se pudo guardar: " + err.message, "error"); });
      });
    }

    // ---------------------------------------------------------------------
    // Plantillas de WhatsApp (gestión CRUD)
    // ---------------------------------------------------------------------
    function abrirPlantillas() {
      var wrap = U.openModal(renderPlantillasModal(), { lg: true });
      wirePlantillasModal(wrap);
    }

    function renderPlantillasModal() {
      return '<h3 class="modal-title">📝 Plantillas de WhatsApp</h3>' +
        '<p class="text-muted" style="margin-top:0">Usa <code>{nombre}</code>, <code>{laboratorio}</code>, <code>{plan}</code>, <code>{fecha_cobro}</code> y <code>{link_pago}</code> — se reemplazan automáticamente al enviar un mensaje.</p>' +
        '<div id="tpl-lista">' + (plantillas.length ? plantillas.map(plantillaFormHtml).join("") : emptyPlantillasHtml()) + "</div>" +
        '<fieldset style="margin-top:14px"><legend>Nueva Plantilla</legend>' +
        '<div class="field"><label>Nombre</label><input id="tpl-nueva-nombre" placeholder="Ej: Seguimiento semanal"/></div>' +
        '<div class="field"><label>Mensaje</label><textarea id="tpl-nueva-mensaje" rows="3" placeholder="Hola {nombre}..."></textarea></div>' +
        '<button type="button" class="btn btn-outline btn-block" id="tpl-crear">' + U.icon("plus") + " Crear Plantilla</button>" +
        "</fieldset>" +
        '<div class="flex justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>';
    }

    function emptyPlantillasHtml() {
      return '<div class="card" style="background:var(--surface-2);margin-bottom:10px"><p class="text-muted" style="margin-top:0">Aún no tienes plantillas.</p>' +
        '<button type="button" class="btn btn-outline btn-sm" id="tpl-ejemplo">✨ Usar 3 plantillas de ejemplo</button></div>';
    }

    function plantillaFormHtml(t) {
      return '<div class="card" style="background:var(--surface-2);margin-bottom:10px" data-tpl-card="' + t.id + '">' +
        '<div class="field"><label>Nombre</label><input data-tpl-nombre="' + t.id + '" value="' + U.esc(t.nombre) + '"/></div>' +
        '<div class="field"><label>Mensaje</label><textarea data-tpl-mensaje="' + t.id + '" rows="3">' + U.esc(t.mensaje) + "</textarea></div>" +
        '<div class="flex gap-2 justify-between"><button type="button" class="btn btn-danger btn-sm" data-tpl-eliminar="' + t.id + '">' + U.icon("trash") + " Eliminar</button>" +
        '<button type="button" class="btn btn-primary btn-sm" data-tpl-guardar="' + t.id + '">' + U.icon("check") + " Guardar</button></div>" +
        "</div>";
    }

    function wirePlantillasModal(wrap) {
      function refrescar() {
        wrap.querySelector("#tpl-lista").innerHTML = plantillas.length ? plantillas.map(plantillaFormHtml).join("") : emptyPlantillasHtml();
        wirePlantillasModal(wrap);
      }
      var btnEjemplo = wrap.querySelector("#tpl-ejemplo");
      if (btnEjemplo) btnEjemplo.addEventListener("click", function () {
        Promise.all(PLANTILLAS_EJEMPLO.map(function (t) { return S.plantillas.create(t); })).then(function () {
          return S.plantillas.list();
        }).then(function (list) {
          plantillas = list;
          U.toast("Plantillas de ejemplo creadas.", "success");
          refrescar();
        });
      });
      wrap.querySelectorAll("[data-tpl-guardar]").forEach(function (b) { b.addEventListener("click", function () {
        var id = b.dataset.tplGuardar;
        var nombre = wrap.querySelector("[data-tpl-nombre='" + id + "']").value.trim();
        var mensaje = wrap.querySelector("[data-tpl-mensaje='" + id + "']").value.trim();
        if (!nombre || !mensaje) { U.toast("Completa nombre y mensaje.", "error"); return; }
        S.plantillas.update(id, { nombre: nombre, mensaje: mensaje }).then(function () {
          var t = plantillas.filter(function (x) { return x.id === id; })[0];
          if (t) { t.nombre = nombre; t.mensaje = mensaje; }
          U.toast("Plantilla guardada.", "success");
        }).catch(function (err) { U.toast("No se pudo guardar: " + err.message, "error"); });
      }); });
      wrap.querySelectorAll("[data-tpl-eliminar]").forEach(function (b) { b.addEventListener("click", function () {
        var id = b.dataset.tplEliminar;
        S.plantillas.remove(id).then(function () {
          plantillas = plantillas.filter(function (x) { return x.id !== id; });
          U.toast("Plantilla eliminada.", "success");
          refrescar();
        }).catch(function (err) { U.toast("No se pudo eliminar: " + err.message, "error"); });
      }); });
      var btnCrear = wrap.querySelector("#tpl-crear");
      if (btnCrear) btnCrear.addEventListener("click", function () {
        var nombre = wrap.querySelector("#tpl-nueva-nombre").value.trim();
        var mensaje = wrap.querySelector("#tpl-nueva-mensaje").value.trim();
        if (!nombre || !mensaje) { U.toast("Completa nombre y mensaje.", "error"); return; }
        S.plantillas.create({ nombre: nombre, mensaje: mensaje }).then(function () {
          return S.plantillas.list();
        }).then(function (list) {
          plantillas = list;
          U.toast("Plantilla creada.", "success");
          refrescar();
        }).catch(function (err) { U.toast("No se pudo crear: " + err.message, "error"); });
      });
    }

    // ---------------------------------------------------------------------
    // Mensaje con plantilla (individual) y Difusión guiada (múltiples)
    // ---------------------------------------------------------------------
    function abrirMensajeConPlantilla(c) {
      if (!plantillas.length) { U.toast('Primero crea una plantilla en "📝 Plantillas".', "error"); return; }
      var opciones = plantillas.map(function (t) { return "<option value='" + t.id + "'>" + U.esc(t.nombre) + "</option>"; }).join("");
      var wrap = U.openModal(
        '<h3 class="modal-title">Enviar mensaje — ' + U.esc(c.laboratorio.nombre || "") + '</h3>' +
        '<div class="field"><label>Plantilla</label><select id="msg-plantilla">' + opciones + "</select></div>" +
        '<div class="field"><label>Mensaje (puedes editarlo antes de enviar)</label><textarea id="msg-texto" rows="5"></textarea></div>' +
        '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-whatsapp" id="msg-enviar">' + U.icon("send") + " Enviar por WhatsApp</button></div>"
      );
      function refrescarTexto() {
        var t = plantillas.filter(function (x) { return x.id === wrap.querySelector("#msg-plantilla").value; })[0];
        wrap.querySelector("#msg-texto").value = llenarPlantilla(t ? t.mensaje : "", c);
      }
      wrap.querySelector("#msg-plantilla").addEventListener("change", refrescarTexto);
      refrescarTexto();
      wrap.querySelector("#msg-enviar").addEventListener("click", function () {
        var texto = wrap.querySelector("#msg-texto").value;
        var t = plantillas.filter(function (x) { return x.id === wrap.querySelector("#msg-plantilla").value; })[0];
        if (!c.contacto || !c.contacto.whatsapp) { U.toast("Este lead no tiene WhatsApp registrado.", "error"); return; }
        window.open(waLinkTo(c.contacto.whatsapp, texto), "_blank");
        agregarActividad(c, "mensaje_wa", "Mensaje de WhatsApp enviado (plantilla: " + (t ? t.nombre : "personalizado") + ").").then(cargar);
        U.closeModal(wrap);
      });
    }

    function abrirDifusion() {
      var ids = Object.keys(seleccionados).filter(function (k) { return seleccionados[k]; });
      var lista = clientes.filter(function (c) { return ids.indexOf(c.id) !== -1 && c.contacto && c.contacto.whatsapp; });
      if (!lista.length) { U.toast("Selecciona al menos un lead con WhatsApp registrado.", "error"); return; }
      if (!plantillas.length) { U.toast('Primero crea una plantilla en "📝 Plantillas".', "error"); return; }
      var opciones = plantillas.map(function (t) { return "<option value='" + t.id + "'>" + U.esc(t.nombre) + "</option>"; }).join("");
      var idx = 0;
      var wrap = U.openModal(
        '<h3 class="modal-title">📢 Difusión guiada (' + lista.length + " leads)</h3>" +
        '<p class="text-muted">No existe una API real de WhatsApp para enviar en masa automáticamente — esto abre WhatsApp uno por uno para que confirmes cada envío.</p>' +
        '<div class="field"><label>Plantilla</label><select id="dif-plantilla">' + opciones + "</select></div>" +
        '<div id="dif-progreso" style="margin:14px 0;font-weight:700"></div>' +
        '<div id="dif-preview" class="text-muted" style="font-size:13px;white-space:pre-wrap;background:var(--surface-2);padding:10px;border-radius:8px"></div>' +
        '<div class="flex gap-2 justify-between" style="margin-top:14px"><button class="btn btn-ghost" data-modal-close>Cerrar</button><button class="btn btn-whatsapp" id="dif-abrir">' + U.icon("send") + " Abrir WhatsApp</button></div>"
      );
      function render() {
        var c = lista[idx];
        var lab = c.laboratorio || {}, contacto = c.contacto || {};
        wrap.querySelector("#dif-progreso").textContent = "Enviando a " + (contacto.nombre || lab.nombre || "—") + " (" + (idx + 1) + "/" + lista.length + ")";
        var t = plantillas.filter(function (x) { return x.id === wrap.querySelector("#dif-plantilla").value; })[0];
        wrap.querySelector("#dif-preview").textContent = llenarPlantilla(t ? t.mensaje : "", c);
        wrap.querySelector("#dif-abrir").textContent = idx < lista.length - 1 ? "Abrir WhatsApp y seguir" : "Abrir WhatsApp y finalizar";
      }
      wrap.querySelector("#dif-plantilla").addEventListener("change", render);
      wrap.querySelector("#dif-abrir").addEventListener("click", function () {
        var c = lista[idx];
        var t = plantillas.filter(function (x) { return x.id === wrap.querySelector("#dif-plantilla").value; })[0];
        var texto = llenarPlantilla(t ? t.mensaje : "", c);
        window.open(waLinkTo(c.contacto.whatsapp, texto), "_blank");
        agregarActividad(c, "mensaje_wa", "Difusión: " + (t ? t.nombre : "") + ".");
        idx++;
        if (idx >= lista.length) {
          U.toast("Difusión completada.", "success");
          U.closeModal(wrap);
          seleccionados = {};
          cargar();
          return;
        }
        render();
      });
      render();
    }

    // ---------------------------------------------------------------------
    // Actividad / seguimiento por lead
    // ---------------------------------------------------------------------
    function abrirActividad(c) {
      function renderTimeline() {
        var items = (c.actividad || []).slice().reverse();
        return items.length ? items.map(function (a) {
          return '<div style="border-left:2px solid var(--border);padding-left:10px;margin-bottom:10px">' +
            '<div class="text-muted" style="font-size:11px">' + fmtFechaCorta(a.fecha) + "</div>" +
            '<div style="font-size:13px">' + U.esc(a.detalle) + "</div></div>";
        }).join("") : '<p class="text-muted">Sin actividad registrada todavía.</p>';
      }
      var wrap = U.openModal(
        '<h3 class="modal-title">🕓 Actividad — ' + U.esc(c.laboratorio.nombre || "") + '</h3>' +
        '<div id="act-timeline" style="max-height:320px;overflow-y:auto;margin-bottom:14px">' + renderTimeline() + "</div>" +
        '<div class="field"><label>Agregar nota</label><textarea id="act-nota-txt" rows="2" placeholder="Ej: Llamó preguntando por el plan Plus..."></textarea></div>' +
        '<div class="flex gap-2 justify-between"><button class="btn btn-ghost" data-modal-close>Cerrar</button><button class="btn btn-primary" id="act-nota-guardar">' + U.icon("check") + " Guardar nota</button></div>"
      );
      wrap.querySelector("#act-nota-guardar").addEventListener("click", function () {
        var txt = wrap.querySelector("#act-nota-txt").value.trim();
        if (!txt) return;
        agregarActividad(c, "nota", txt).then(function () {
          wrap.querySelector("#act-nota-txt").value = "";
          wrap.querySelector("#act-timeline").innerHTML = renderTimeline();
          cargar();
        }).catch(function (err) { U.toast("No se pudo guardar: " + err.message, "error"); });
      });
    }

    // ---------------------------------------------------------------------
    // Correo profesional (Gmail/Outlook)
    // ---------------------------------------------------------------------
    function abrirCorreo(c) {
      var contacto = c.contacto || {}, lab = c.laboratorio || {};
      if (!contacto.correo) { U.toast("Este lead no tiene correo registrado.", "error"); return; }
      var asunto = "BIOsoft — Información para " + (lab.nombre || "tu laboratorio");
      var cuerpo = "Hola " + (contacto.nombre ? contacto.nombre.split(" ")[0] : "") + ",\n\n" +
        "Gracias por tu interés en BIOsoft, el software de laboratorio clínico. Quedo atento a cualquier duda para ayudarte a personalizar tu sistema.\n\n" +
        "Saludos,\nEquipo BIOsoft";
      var wrap = U.openModal(
        '<h3 class="modal-title">Enviar correo — ' + U.esc(lab.nombre || "") + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Elige con qué servicio de correo quieres redactarlo. Se abrirá ya escrito para que revises y envíes.</p>' +
        U.emailProviderButtonsHtml("crm-mail") +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      U.wireEmailProviderButtons(wrap, "crm-mail", contacto.correo, asunto, cuerpo);
      ["gmail", "outlook", "mailto"].forEach(function (prov) {
        var btn = wrap.querySelector("#crm-mail-" + prov);
        if (btn) btn.addEventListener("click", function () { agregarActividad(c, "correo", "Correo abierto para enviar (" + prov + ")."); });
      });
    }

    // ---------------------------------------------------------------------
    // Alta / edición de cliente
    // ---------------------------------------------------------------------
    function openForm(cliente) {
      var isEdit = !!cliente;
      cliente = cliente || { laboratorio: {}, contacto: {}, seccionesIds: [], estado: "nuevo" };
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
        '<fieldset><legend>Plan y Etapa</legend><div class="form-grid">' +
        F.sel("plan", "Plan Contratado", BIO_PLANES.PLANES.map(function (p) { return "<option value='" + p.id + "' " + (p.id === cliente.planId ? "selected" : "") + ">" + p.nombre + " (" + p.usuarios + ") — $" + p.precioFmt + "/mes</option>"; }).join("")) +
        F.sel("estado", "Etapa", Object.keys(ESTADO_LABEL).map(function (k) { return "<option value='" + k + "' " + (k === cliente.estado ? "selected" : "") + ">" + ESTADO_LABEL[k] + "</option>"; }).join("")) +
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
          estado: wrap.querySelector("#f_estado").value,
          seccionesIds: secciones,
          notas: wrap.querySelector("#crm-notas").value.trim()
        };
        var promesa = isEdit ? S.crm.update(cliente.id, data) : S.crm.create(Object.assign({ origen: "manual" }, data));
        promesa.then(function () {
          U.toast("Cliente guardado.", "success");
          U.closeModal(wrap);
          cargar();
        }).catch(function (err) { U.toast("No se pudo guardar: " + err.message, "error"); });
      });
    }

    cargar();
    unsubClientes = S.crm.watch(function () { cargar(); });
    unsubPlantillas = S.plantillas.watch(function () { cargar(); });
  };
})();

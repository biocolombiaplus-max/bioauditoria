/* BIOsoft — Vista: Médicos Remitentes (el profesional externo que remite
   pacientes al laboratorio) y la tarifa/comisión que el laboratorio le
   paga por cada uno — ver "Comisiones a Médicos Remitentes" en Reportes
   Administrativos para el cálculo de cuánto se le debe pagar a cada uno
   en un periodo. A diferencia de un Convenio (que le DEBE dinero al
   laboratorio), aquí el flujo del dinero es al revés. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, F = window.BIO_formHelpers;

  function fmtMoneda(n) {
    n = n || 0;
    var dec = Math.round(n) === n ? 0 : 2;
    return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
  }

  var TIPOS_TARIFA = {
    fijo_orden: "Fijo por orden remitida",
    fijo_examen: "Fijo por examen remitido",
    porcentaje: "% del valor de la orden"
  };
  function tarifaTexto(m) {
    if (m.tipoTarifa === "porcentaje") return (m.valorTarifa || 0) + "% del valor de cada orden";
    if (m.tipoTarifa === "fijo_examen") return fmtMoneda(m.valorTarifa) + " por examen remitido";
    return fmtMoneda(m.valorTarifa) + " por orden remitida";
  }

  window.BIO_VIEWS.medicos = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var medicos = [];

    function cargar() {
      medicos = S.medicos.list(tenantId);
      build();
    }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">Médicos Remitentes</h3>' +
        '<button class="btn btn-primary btn-sm" id="btn-nuevo-medico">' + U.icon("plus") + " Nuevo Médico</button></div>" +
        '<p class="text-muted" style="margin-top:0">Registra a cada médico externo que te remite pacientes y la comisión que le pagas — fija por orden, fija por examen, o un porcentaje del valor de la orden. Con esto ya puedes generar "Comisiones a Médicos Remitentes" en Reportes Administrativos para saber cuánto le debes pagar a cada uno en un periodo.</p>' +
        '<div id="medicos-grid" class="flex wrap gap-2" style="align-items:stretch">' +
        (medicos.length ? medicos.map(medicoCardHtml).join("") : '<p class="text-muted">Aún no has registrado ningún médico remitente.</p>') +
        "</div></div>";
      document.getElementById("btn-nuevo-medico").addEventListener("click", function () { abrirFormMedico(null); });
      document.querySelectorAll("[data-editar-medico]").forEach(function (b) {
        b.addEventListener("click", function () { abrirFormMedico(medicos.filter(function (m) { return m.id === b.dataset.editarMedico; })[0]); });
      });
      document.querySelectorAll("[data-eliminar-medico]").forEach(function (b) {
        b.addEventListener("click", function () {
          var m = medicos.filter(function (x) { return x.id === b.dataset.eliminarMedico; })[0];
          if (!confirm('¿Eliminar al médico "' + m.nombre + '"? Las órdenes que ya lo tienen asignado conservan su nombre, pero dejarán de contar en el reporte de comisiones.')) return;
          S.medicos.eliminar(tenantId, m.id);
          U.toast("Médico eliminado.", "success");
          cargar();
        });
      });
    }

    function medicoCardHtml(m) {
      return '<div class="card" style="width:280px' + (m.activo === false ? ";opacity:.55" : "") + '">' +
        '<div class="flex justify-between items-start"><h4 style="margin:0 0 2px">' + U.esc(m.nombre) + "</h4>" +
        (m.activo === false ? '<span class="badge badge-pendiente">Inactivo</span>' : '<span class="badge badge-validado">Activo</span>') +
        "</div>" +
        (m.especialidad ? '<p class="text-muted" style="margin:2px 0;font-size:12.5px">' + U.esc(m.especialidad) + "</p>" : "") +
        (m.documento ? '<p class="text-muted" style="margin:0 0 4px;font-size:12px">Doc. ' + U.esc(m.documento) + "</p>" : "") +
        '<p style="margin:8px 0 4px;font-size:13px">Comisión: <b>' + tarifaTexto(m) + "</b></p>" +
        (m.telefono || m.email ? '<p class="text-muted" style="margin:0 0 10px;font-size:12px">' + [m.telefono, m.email].filter(Boolean).map(U.esc).join(" · ") + "</p>" : '<div style="margin-bottom:10px"></div>') +
        '<div class="flex gap-2 wrap">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-editar-medico="' + m.id + '">' + U.icon("edit") + " Editar</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-eliminar-medico="' + m.id + '">' + U.icon("trash") + " Eliminar</button>" +
        "</div></div>";
    }

    function abrirFormMedico(medico) {
      var esNuevo = !medico;
      medico = medico || { nombre: "", documento: "", especialidad: "", telefono: "", email: "", tipoTarifa: "fijo_orden", valorTarifa: 0, activo: true };
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (esNuevo ? "Nuevo Médico Remitente" : "Editar Médico Remitente") + "</h3>" +
        '<div class="form-grid">' +
        F.inp("med-nombre", "Nombre completo", medico.nombre, true) +
        F.inp("med-documento", "Documento (opcional)", medico.documento) +
        F.inp("med-especialidad", "Especialidad (opcional)", medico.especialidad) +
        F.inp("med-telefono", "Teléfono", medico.telefono) +
        F.inp("med-email", "Correo Electrónico", medico.email) +
        "</div>" +
        '<div class="form-grid" style="margin-top:6px">' +
        F.sel("med-tipotarifa", "Tipo de Comisión", Object.keys(TIPOS_TARIFA).map(function (k) { return '<option value="' + k + '" ' + (medico.tipoTarifa === k ? "selected" : "") + ">" + TIPOS_TARIFA[k] + "</option>"; }).join("")) +
        '<div class="field"><label id="med-valortarifa-label">' + (medico.tipoTarifa === "porcentaje" ? "Porcentaje (%)" : "Valor") + '</label><input type="number" step="any" min="0" id="med-valortarifa" value="' + (medico.valorTarifa || 0) + '"/></div>' +
        "</div>" +
        '<label class="checkbox-row" style="margin-top:10px"><input type="checkbox" id="med-activo" ' + (medico.activo === false ? "" : "checked") + '/> Médico activo (aparece para elegir en Nueva Orden)</label>' +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="btn-guardar-medico">' + (esNuevo ? "Crear Médico" : "Guardar Cambios") + "</button></div>"
      );
      var selTipo = wrap.querySelector("#f_med-tipotarifa");
      var labelValor = wrap.querySelector("#med-valortarifa-label");
      selTipo.addEventListener("change", function () { labelValor.textContent = selTipo.value === "porcentaje" ? "Porcentaje (%)" : "Valor"; });
      wrap.querySelector("#btn-guardar-medico").addEventListener("click", function () {
        var nombre = wrap.querySelector("#f_med-nombre").value.trim();
        if (!nombre) { U.toast("Escribe el nombre del médico.", "error"); return; }
        var data = {
          tenantId: tenantId,
          nombre: nombre,
          documento: wrap.querySelector("#f_med-documento").value.trim(),
          especialidad: wrap.querySelector("#f_med-especialidad").value.trim(),
          telefono: wrap.querySelector("#f_med-telefono").value.trim(),
          email: wrap.querySelector("#f_med-email").value.trim(),
          tipoTarifa: selTipo.value,
          valorTarifa: parseFloat(wrap.querySelector("#med-valortarifa").value) || 0,
          activo: wrap.querySelector("#med-activo").checked
        };
        if (esNuevo) {
          S.medicos.create(data);
          S.addAudit(tenantId, session.nombre, session.rol, "CREATE_MEDICO_REMITENTE", "medico", nombre, "Registró al médico remitente " + nombre + ".");
          U.toast("Médico registrado.", "success");
        } else {
          S.medicos.update(medico.id, data);
          S.addAudit(tenantId, session.nombre, session.rol, "UPDATE_MEDICO_REMITENTE", "medico", medico.id, "Editó al médico remitente " + nombre + ".");
          U.toast("Médico actualizado.", "success");
        }
        U.closeModal(wrap);
        cargar();
      });
    }

    cargar();
  };
})();

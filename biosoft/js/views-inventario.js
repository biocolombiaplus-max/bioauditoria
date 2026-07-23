/* BIOsoft — Control de Inventario y Reactivos: catálogo de insumos, receta de
   consumo por examen (para descuento automático de stock al validar) y
   kardex profesional de movimientos, por laboratorio. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, F = window.BIO_formHelpers;

  var CATEGORIAS_INSUMO = ["Reactivo", "Insumo", "Control", "Material"];
  var DIAS_ALERTA_VENCIMIENTO = 30;

  function fmtMoneda(n) { return "$" + Math.round(n || 0).toLocaleString("es-CO"); }
  function fmtFechaCorta(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  }
  function diasHasta(iso) {
    if (!iso) return null;
    return Math.ceil((new Date(iso + "T00:00:00") - new Date()) / 86400000);
  }

  window.BIO_VIEWS.inventario = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var vista = "insumos";
    var insumos = [];
    var recetas = [];

    function cargar() {
      insumos = S.inventario.listInsumos(tenantId);
      recetas = S.inventario.listRecetas(tenantId);
      build();
    }

    function insumoPorId(id) { return insumos.filter(function (i) { return i.id === id; })[0]; }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">🧪 Control de Inventario y Reactivos</h3>' +
        '<div class="flex gap-2 wrap">' +
        '<div class="crm-view-toggle">' +
        '<button type="button" class="' + (vista === "insumos" ? "active" : "") + '" data-vista="insumos">📦 Insumos</button>' +
        '<button type="button" class="' + (vista === "recetas" ? "active" : "") + '" data-vista="recetas">🧾 Recetas por Examen</button>' +
        '<button type="button" class="' + (vista === "kardex" ? "active" : "") + '" data-vista="kardex">📋 Kardex</button>' +
        "</div>" +
        (vista === "insumos" ? '<button class="btn btn-primary btn-sm" id="btn-nuevo-insumo">' + U.icon("plus") + " Nuevo Insumo</button>" : "") +
        "</div></div>" +
        (vista === "insumos" ? buildInsumosHtml() : vista === "recetas" ? buildRecetasHtml() : buildKardexHtml()) +
        "</div>";
      root.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { vista = b.dataset.vista; build(); }); });
      var btnNuevo = document.getElementById("btn-nuevo-insumo");
      if (btnNuevo) btnNuevo.addEventListener("click", function () { abrirFormInsumo(null); });
      if (vista === "insumos") wireInsumos(); else if (vista === "recetas") wireRecetas(); else wireKardex();
    }

    // ---------------------------------------------------------------------
    // INSUMOS Y REACTIVOS
    // ---------------------------------------------------------------------
    var insumoSearchTerm = "";

    function buildInsumosHtml() {
      var bajos = insumos.filter(function (i) { return i.stockActual <= (i.stockMinimo || 0); }).length;
      var porVencer = insumos.filter(function (i) { var d = diasHasta(i.fechaVencimiento); return d !== null && d <= DIAS_ALERTA_VENCIMIENTO; }).length;
      var alertas = "";
      if (bajos) alertas += '<span class="badge badge-urgente" style="margin-right:8px">⚠️ ' + bajos + " con stock bajo</span>";
      if (porVencer) alertas += '<span class="badge badge-pendiente">⏳ ' + porVencer + " por vencer / vencidos</span>";
      return (alertas ? '<p style="margin:14px 0">' + alertas + "</p>" : "") +
        '<div class="field" style="margin-bottom:12px"><input id="insumo-search" placeholder="Buscar insumo por nombre…"/></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Insumo</th><th>Categoría</th><th>Stock</th><th>Costo Unit.</th><th>Valor en Stock</th><th>Vence</th><th></th></tr></thead><tbody id="insumos-tbody"></tbody></table></div>';
    }

    function renderInsumosTabla() {
      var term = U.normalizar(insumoSearchTerm.trim());
      var pool = term ? insumos.filter(function (i) { return U.normalizar(i.nombre).indexOf(term) !== -1; }) : insumos;
      document.getElementById("insumos-tbody").innerHTML = pool.map(function (i) {
        var bajo = i.stockActual <= (i.stockMinimo || 0);
        var dv = diasHasta(i.fechaVencimiento);
        var vencBadge = dv === null ? "—" : dv < 0 ? '<span class="badge badge-urgente">Vencido</span>' : dv <= DIAS_ALERTA_VENCIMIENTO ? '<span class="badge badge-pendiente">' + fmtFechaCorta(i.fechaVencimiento) + "</span>" : fmtFechaCorta(i.fechaVencimiento);
        return "<tr><td><b>" + U.esc(i.nombre) + '</b><div class="meta">' + (i.proveedor ? "Prov: " + U.esc(i.proveedor) : "") + (i.lote ? " · Lote " + U.esc(i.lote) : "") + "</div></td>" +
          "<td>" + i.categoria + "</td>" +
          "<td>" + (bajo ? '<span class="badge badge-urgente">' + i.stockActual + " " + U.esc(i.unidadMedida) + "</span>" : i.stockActual + " " + U.esc(i.unidadMedida)) +
          (i.stockMinimo ? '<div class="meta">Mín: ' + i.stockMinimo + "</div>" : "") + "</td>" +
          "<td>" + fmtMoneda(i.costoUnitario) + "</td><td>" + fmtMoneda(i.stockActual * (i.costoUnitario || 0)) + "</td>" +
          "<td>" + vencBadge + "</td>" +
          "<td><div class='flex gap-2 wrap'>" +
          "<button class='btn btn-outline btn-sm' data-editar-insumo='" + i.id + "'>Editar</button>" +
          "<button class='btn btn-outline btn-sm' data-entrada-insumo='" + i.id + "'>+ Entrada</button>" +
          "<button class='btn btn-ghost btn-sm' data-ajustar-insumo='" + i.id + "'>Ajustar</button>" +
          "</div></td></tr>";
      }).join("") || '<tr><td colspan="7" class="text-muted">Aún no has registrado insumos. Crea el primero con "Nuevo Insumo".</td></tr>';

      root.querySelectorAll("[data-editar-insumo]").forEach(function (b) { b.addEventListener("click", function () { abrirFormInsumo(insumoPorId(b.dataset.editarInsumo)); }); });
      root.querySelectorAll("[data-entrada-insumo]").forEach(function (b) { b.addEventListener("click", function () { abrirFormEntrada(insumoPorId(b.dataset.entradaInsumo)); }); });
      root.querySelectorAll("[data-ajustar-insumo]").forEach(function (b) { b.addEventListener("click", function () { abrirFormAjuste(insumoPorId(b.dataset.ajustarInsumo)); }); });
    }

    function wireInsumos() {
      renderInsumosTabla();
      document.getElementById("insumo-search").addEventListener("input", function (e) { insumoSearchTerm = e.target.value; renderInsumosTabla(); });
    }

    function abrirFormInsumo(insumo) {
      var isEdit = !!insumo;
      insumo = insumo || { nombre: "", categoria: "Reactivo", unidadMedida: "", stockMinimo: 0, costoUnitario: 0, proveedor: "", lote: "", fechaVencimiento: "" };
      var wrap = U.openModal(
        '<h3 class="modal-title">' + (isEdit ? "Editar Insumo" : "Nuevo Insumo o Reactivo") + '</h3>' +
        '<form id="insumo-form"><div class="form-grid">' +
        F.inp("insNombre", "Nombre del Insumo/Reactivo", insumo.nombre, true) +
        F.sel("insCategoria", "Categoría", CATEGORIAS_INSUMO.map(function (c) { return "<option value='" + c + "' " + (c === insumo.categoria ? "selected" : "") + ">" + c + "</option>"; }).join("")) +
        F.inp("insUnidad", "Unidad de Medida (mL, unidades, tiras…)", insumo.unidadMedida, true) +
        F.inp("insStockMinimo", "Stock Mínimo (alerta)", insumo.stockMinimo, false, "number") +
        F.inp("insCosto", "Costo Unitario", insumo.costoUnitario, false, "number") +
        (isEdit ? "" : F.inp("insStockInicial", "Stock Inicial (opcional)", 0, false, "number")) +
        F.inp("insProveedor", "Proveedor", insumo.proveedor) +
        F.inp("insLote", "Lote", insumo.lote) +
        F.inp("insVencimiento", "Fecha de Vencimiento", insumo.fechaVencimiento, false, "date") +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar</button></div>" +
        "</form>", { lg: true }
      );
      wrap.querySelector("#insumo-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value; };
        var data = {
          nombre: g("insNombre").trim(), categoria: g("insCategoria"), unidadMedida: g("insUnidad").trim(),
          stockMinimo: parseFloat(g("insStockMinimo")) || 0, costoUnitario: parseFloat(g("insCosto")) || 0,
          proveedor: g("insProveedor").trim(), lote: g("insLote").trim(), fechaVencimiento: g("insVencimiento")
        };
        if (!data.nombre || !data.unidadMedida) { U.toast("Completa el nombre y la unidad de medida.", "error"); return; }
        if (isEdit) {
          S.inventario.updateInsumo(insumo.id, data);
        } else {
          var nuevo = S.inventario.createInsumo(Object.assign({ tenantId: tenantId }, data));
          var stockInicial = parseFloat(g("insStockInicial")) || 0;
          if (stockInicial > 0) S.inventario.registrarEntrada(tenantId, nuevo.id, stockInicial, data.costoUnitario, { motivo: "Stock inicial", lote: data.lote, fechaVencimiento: data.fechaVencimiento, proveedor: data.proveedor, usuario: session.nombre });
        }
        U.toast("Insumo guardado.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    function abrirFormEntrada(insumo) {
      var wrap = U.openModal(
        '<h3 class="modal-title">Registrar Entrada — ' + U.esc(insumo.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Stock actual: <b>' + insumo.stockActual + " " + U.esc(insumo.unidadMedida) + '</b></p>' +
        '<form id="entrada-form"><div class="form-grid">' +
        F.inp("entCantidad", "Cantidad que ingresa", "", true, "number") +
        F.inp("entCosto", "Costo unitario de esta compra", insumo.costoUnitario, false, "number") +
        F.inp("entProveedor", "Proveedor", insumo.proveedor) +
        F.inp("entLote", "Lote", insumo.lote) +
        F.inp("entVencimiento", "Fecha de Vencimiento", insumo.fechaVencimiento, false, "date") +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Registrar Entrada</button></div>" +
        "</form>", { lg: true }
      );
      wrap.querySelector("#entrada-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value; };
        var cantidad = parseFloat(g("entCantidad"));
        if (!cantidad || cantidad <= 0) { U.toast("Ingresa una cantidad válida.", "error"); return; }
        S.inventario.registrarEntrada(tenantId, insumo.id, cantidad, parseFloat(g("entCosto")) || insumo.costoUnitario, {
          proveedor: g("entProveedor").trim(), lote: g("entLote").trim(), fechaVencimiento: g("entVencimiento"), usuario: session.nombre
        });
        U.toast("Entrada registrada. Stock actualizado.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    function abrirFormAjuste(insumo) {
      var wrap = U.openModal(
        '<h3 class="modal-title">Ajustar Inventario — ' + U.esc(insumo.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Stock actual en el sistema: <b>' + insumo.stockActual + " " + U.esc(insumo.unidadMedida) + '</b>. Ingresa el conteo físico real.</p>' +
        '<form id="ajuste-form"><div class="form-grid">' +
        F.inp("ajCantidad", "Cantidad real contada", insumo.stockActual, true, "number") +
        F.inp("ajMotivo", "Motivo del ajuste (merma, vencido, conteo físico…)", "", true) +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="submit" class="btn btn-primary">' + U.icon("check") + " Guardar Ajuste</button></div>" +
        "</form>"
      );
      wrap.querySelector("#ajuste-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var g = function (id) { return wrap.querySelector("#f_" + id).value; };
        var nueva = parseFloat(g("ajCantidad"));
        if (isNaN(nueva) || nueva < 0) { U.toast("Ingresa una cantidad válida.", "error"); return; }
        if (!g("ajMotivo").trim()) { U.toast("Indica el motivo del ajuste.", "error"); return; }
        var mov = S.inventario.registrarAjuste(tenantId, insumo.id, nueva, g("ajMotivo").trim(), session.nombre);
        if (!mov) { U.toast("No hubo cambios en el stock.", "error"); U.closeModal(wrap); return; }
        U.toast("Ajuste registrado.", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    // ---------------------------------------------------------------------
    // RECETAS POR EXAMEN
    // ---------------------------------------------------------------------
    var recetaSearchTerm = "";
    var recetaActiveSection = C.SECCIONES[0].id;

    function buildRecetasHtml() {
      return '<p class="text-muted" style="margin:14px 0">Configura cuánto reactivo o insumo consume cada examen. Cada vez que se ingrese un resultado por primera vez, BIOsoft descuenta automáticamente esas cantidades del inventario.</p>' +
        (insumos.length ? "" : '<div class="callout-ia">⚠️ Primero registra tus insumos en la pestaña "📦 Insumos" para poder asignarlos a un examen.</div>') +
        '<div class="field" style="margin:12px 0"><input id="rec-exam-search" placeholder="Buscar examen por nombre o código CUPS en todas las secciones…"/></div>' +
        '<div class="exam-picker"><div class="exam-picker-sections" id="rec-sec-list"></div><div class="exam-picker-list" id="rec-exam-list"></div></div>';
    }

    function recetasDeExamen(examId) { return recetas.filter(function (r) { return r.examId === examId; }); }

    function wireRecetas() {
      document.getElementById("rec-exam-search").addEventListener("input", function (e) { recetaSearchTerm = e.target.value; renderRecSections(); renderRecExams(); });
      renderRecSections();
      renderRecExams();
    }

    function renderRecSections() {
      document.getElementById("rec-sec-list").innerHTML = C.SECCIONES.map(function (s) {
        return '<div class="sec-item ' + (!recetaSearchTerm && s.id === recetaActiveSection ? "active" : "") + '" data-sec="' + s.id + '">' + s.nombre + "</div>";
      }).join("");
      document.querySelectorAll("#rec-sec-list .sec-item").forEach(function (el) {
        el.addEventListener("click", function () {
          recetaActiveSection = el.dataset.sec; recetaSearchTerm = ""; document.getElementById("rec-exam-search").value = "";
          renderRecSections(); renderRecExams();
        });
      });
    }

    function renderRecExams() {
      var term = U.normalizar(recetaSearchTerm.trim());
      var pool = term
        ? C.EXAMENES.filter(function (e) { return U.normalizar(e.nombre).indexOf(term) !== -1 || e.cups.indexOf(term) !== -1; })
        : C.EXAMENES.filter(function (e) { return e.seccion === recetaActiveSection; });

      document.getElementById("rec-exam-list").innerHTML = pool.map(function (e) {
        var n = recetasDeExamen(e.id).length;
        return '<button type="button" class="exam-row" data-config-receta="' + e.id + '" style="width:100%;text-align:left;border:none;background:none;cursor:pointer">' +
          '<div class="grow"><div>' + U.esc(e.nombre) + (term ? ' <span class="text-muted" style="font-size:11px">— ' + C.seccionNombre(e.seccion) + "</span>" : "") + "</div>" +
          '<div class="meta">CUPS ' + e.cups + "</div></div>" +
          (n ? '<span class="badge badge-validado">' + n + " insumo(s)</span>" : '<span class="text-muted" style="font-size:12px">Sin configurar</span>') +
          "</button>";
      }).join("") || '<p class="text-muted" style="padding:14px">Sin resultados para tu búsqueda.</p>';

      root.querySelectorAll("[data-config-receta]").forEach(function (b) {
        b.addEventListener("click", function () { abrirFormReceta(C.examenPorId(b.dataset.configReceta)); });
      });
    }

    function abrirFormReceta(examen) {
      if (!insumos.length) { U.toast("Registra al menos un insumo primero.", "error"); return; }
      var lineasIniciales = recetasDeExamen(examen.id).map(function (r) { return { insumoId: r.insumoId, cantidad: r.cantidad }; });
      if (!lineasIniciales.length) lineasIniciales = [{ insumoId: "", cantidad: "" }];

      var wrap = U.openModal(
        '<h3 class="modal-title">Receta de Consumo — ' + U.esc(examen.nombre) + '</h3>' +
        '<p class="text-muted" style="margin-top:0">Indica qué insumos y cuánto se gasta cada vez que se realiza este examen.</p>' +
        '<div id="receta-lineas"></div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-add-linea" style="margin-top:8px">' + U.icon("plus") + " Agregar Insumo</button>" +
        '<div class="flex gap-2 justify-between" style="margin-top:16px"><button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button><button type="button" class="btn btn-primary" id="btn-guardar-receta">' + U.icon("check") + " Guardar Receta</button></div>",
        { lg: true }
      );

      var lineas = lineasIniciales.slice();
      function opcionesInsumos(seleccionado) {
        return '<option value="">Selecciona…</option>' + insumos.map(function (i) { return "<option value='" + i.id + "' " + (i.id === seleccionado ? "selected" : "") + ">" + U.esc(i.nombre) + " (" + U.esc(i.unidadMedida) + ")</option>"; }).join("");
      }
      function renderLineas() {
        wrap.querySelector("#receta-lineas").innerHTML = lineas.map(function (l, i) {
          return '<div class="form-grid" style="grid-template-columns:2fr 1fr auto;align-items:end;margin-top:8px" data-linea="' + i + '">' +
            '<div class="field"><label>Insumo</label><select data-linea-insumo="' + i + '">' + opcionesInsumos(l.insumoId) + "</select></div>" +
            '<div class="field"><label>Cantidad por prueba</label><input type="number" step="any" min="0" value="' + (l.cantidad || "") + '" data-linea-cantidad="' + i + '"/></div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quitar-linea="' + i + '">✕</button>' +
            "</div>";
        }).join("");
        wrap.querySelectorAll("[data-linea-insumo]").forEach(function (s) { s.addEventListener("change", function () { lineas[Number(s.dataset.lineaInsumo)].insumoId = s.value; }); });
        wrap.querySelectorAll("[data-linea-cantidad]").forEach(function (inp) { inp.addEventListener("input", function () { lineas[Number(inp.dataset.lineaCantidad)].cantidad = parseFloat(inp.value) || 0; }); });
        wrap.querySelectorAll("[data-quitar-linea]").forEach(function (b) {
          b.addEventListener("click", function () { lineas.splice(Number(b.dataset.quitarLinea), 1); renderLineas(); });
        });
      }
      renderLineas();
      wrap.querySelector("#btn-add-linea").addEventListener("click", function () { lineas.push({ insumoId: "", cantidad: "" }); renderLineas(); });
      wrap.querySelector("#btn-guardar-receta").addEventListener("click", function () {
        var validas = lineas.filter(function (l) { return l.insumoId && l.cantidad > 0; });
        S.inventario.guardarRecetaExamen(tenantId, examen.id, validas);
        U.toast("Receta guardada para " + examen.nombre + ".", "success");
        U.closeModal(wrap);
        cargar();
      });
    }

    // ---------------------------------------------------------------------
    // KARDEX
    // ---------------------------------------------------------------------
    var kardexFiltroInsumo = "";

    function buildKardexHtml() {
      return '<div class="field" style="margin:14px 0 12px"><label>Filtrar por insumo</label><select id="kardex-filtro">' +
        '<option value="">Todos los insumos</option>' +
        insumos.map(function (i) { return "<option value='" + i.id + "'>" + U.esc(i.nombre) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Insumo</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Saldo</th><th>Usuario</th></tr></thead><tbody id="kardex-tbody"></tbody></table></div>';
    }

    function renderKardexTabla() {
      var movimientos = S.inventario.listKardex(tenantId, kardexFiltroInsumo || null);
      document.getElementById("kardex-tbody").innerHTML = movimientos.map(function (k) {
        var insumo = insumoPorId(k.insumoId);
        var tipoBadge = k.tipo === "entrada" ? '<span class="badge badge-validado">Entrada</span>' : k.tipo === "salida" ? '<span class="badge badge-urgente">Salida</span>' : '<span class="badge badge-pendiente">Ajuste</span>';
        return "<tr><td>" + U.fmtFecha(k.fecha) + "</td><td>" + (insumo ? U.esc(insumo.nombre) : "—") + "</td><td>" + tipoBadge + "</td>" +
          "<td>" + (k.tipo === "salida" ? "-" : "+") + k.cantidad + "</td><td>" + U.esc(k.motivo || "") + "</td>" +
          "<td>" + k.saldoAnterior + " → <b>" + k.saldoNuevo + "</b></td><td>" + U.esc(k.usuario || "—") + "</td></tr>";
      }).join("") || '<tr><td colspan="7" class="text-muted">Sin movimientos registrados todavía.</td></tr>';
    }

    function wireKardex() {
      renderKardexTabla();
      document.getElementById("kardex-filtro").addEventListener("change", function (e) { kardexFiltroInsumo = e.target.value; renderKardexTabla(); });
    }

    cargar();
  };
})();

/* BIOsoft — Reportes profesionales en PDF de Inventario y Reactivos:
   gasto de reactivos, inventario valorizado y kardex por insumo. */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
  // Con decimales cuando el precio los tiene (típico en dólares, ej.
  // "$4,50") pero sin ",00" de sobra en precios redondos.
  function fmtMoneda(n) {
    n = n || 0;
    var dec = Math.round(n) === n ? 0 : 2;
    return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
  }
  function fmtFecha(iso) { return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); }

  function encabezado(doc, tenant, titulo) {
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 40;
    var y = margin;
    var rgb = hexToRgb(tenant.colorPrimario);

    if (tenant.logoDataUrl) {
      try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 6, 46, 46); } catch (e) {}
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(tenant.nombre, margin + (tenant.logoDataUrl ? 56 : 0), y + 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    var metaLines = [C.documentoTributarioLabel(tenant.pais) + " " + (tenant.nit || "—"), (tenant.direccion || "") + (tenant.telefonos ? " · " + tenant.telefonos : "")];
    metaLines.forEach(function (line, i) { doc.text(line, margin + (tenant.logoDataUrl ? 56 : 0), y + 22 + i * 10); });

    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
    y += 62; doc.line(margin, y, pageW - margin, y); y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text(titulo, margin, y);
    y += 10;
    return { margin: margin, pageW: pageW, y: y, rgb: rgb };
  }

  function piePagina(doc, margin) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);
  }

  // -----------------------------------------------------------------------
  // 1. REPORTE DE GASTO DE REACTIVOS (por periodo)
  // -----------------------------------------------------------------------
  function buildGastoReactivosPDF(movimientos, insumosPorId, tenant, desde, hasta) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "REPORTE DE GASTO DE REACTIVOS E INSUMOS");
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta), margin, y);
    y += 18;

    var salidas = movimientos.filter(function (m) { return m.tipo === "salida"; });
    var porInsumo = {};
    salidas.forEach(function (m) {
      if (!porInsumo[m.insumoId]) porInsumo[m.insumoId] = { cantidad: 0, costo: 0 };
      porInsumo[m.insumoId].cantidad += m.cantidad;
      porInsumo[m.insumoId].costo += m.cantidad * (m.costoUnitario || 0);
    });
    var filasResumen = Object.keys(porInsumo).map(function (id) {
      var ins = insumosPorId[id] || { nombre: "(insumo eliminado)", unidadMedida: "" };
      var d = porInsumo[id];
      return { nombre: ins.nombre, unidad: ins.unidadMedida, cantidad: d.cantidad, costo: d.costo };
    }).sort(function (a, b) { return b.costo - a.costo; });
    var totalGasto = filasResumen.reduce(function (a, f) { return a + f.costo; }, 0);

    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text("Resumen por Insumo", margin, y); y += 6;

    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Insumo", "Cantidad Consumida", "Costo Total"]],
      body: filasResumen.length ? filasResumen.map(function (f) { return [f.nombre, f.cantidad + " " + f.unidad, fmtMoneda(f.costo)]; }) : [["Sin consumo registrado en el periodo.", "", ""]],
      theme: "grid", styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } }
    });
    y = doc.lastAutoTable.finalY + 16;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("GASTO TOTAL DEL PERIODO: " + fmtMoneda(totalGasto), pageW - margin, y, { align: "right" });
    y += 22;

    if (salidas.length) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
      doc.text("Detalle de Movimientos", margin, y); y += 6;
      doc.autoTable({
        startY: y, margin: { left: margin, right: margin },
        head: [["Fecha", "Insumo", "Cantidad", "Costo", "Motivo"]],
        body: salidas.map(function (m) {
          var ins = insumosPorId[m.insumoId] || { nombre: "—" };
          return [fmtFecha(m.fecha), ins.nombre, m.cantidad, fmtMoneda(m.cantidad * (m.costoUnitario || 0)), m.motivo || ""];
        }),
        theme: "striped", styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } }
      });
    }
    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  // -----------------------------------------------------------------------
  // 2. REPORTE DE INVENTARIO VALORIZADO (stock actual a costo)
  // -----------------------------------------------------------------------
  function buildInventarioValorizadoPDF(insumos, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "REPORTE DE INVENTARIO VALORIZADO");
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Corte al: " + fmtFecha(new Date().toISOString()), margin, y);
    y += 14;

    var totalGeneral = insumos.reduce(function (a, i) { return a + i.stockActual * (i.costoUnitario || 0); }, 0);

    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Insumo", "Categoría", "Stock", "Costo Unit.", "Valor en Stock"]],
      body: insumos.length ? insumos.map(function (i) {
        return [i.nombre, i.categoria, i.stockActual + " " + i.unidadMedida, fmtMoneda(i.costoUnitario), fmtMoneda(i.stockActual * (i.costoUnitario || 0))];
      }) : [["Sin insumos registrados.", "", "", "", ""]],
      theme: "grid", styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } }
    });
    y = doc.lastAutoTable.finalY + 16;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("VALOR TOTAL DEL INVENTARIO: " + fmtMoneda(totalGeneral), pageW - margin, y, { align: "right" });
    y += 24;

    var hoy = new Date();
    var alertas = insumos.filter(function (i) {
      var bajo = i.stockActual <= (i.stockMinimo || 0);
      var vence = i.fechaVencimiento && (new Date(i.fechaVencimiento + "T00:00:00") - hoy) / 86400000 <= 30;
      return bajo || vence;
    });
    if (alertas.length) {
      // Sin "⚠": fuera de WinAnsi, las fuentes base de jsPDF lo renderizan
      // corrupto (mismo problema ya corregido con "✓"/"≈" en otros PDF).
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(200, 40, 40);
      doc.text("Alertas de Stock Bajo o Vencimiento Próximo", margin, y); y += 6;
      doc.autoTable({
        startY: y, margin: { left: margin, right: margin },
        head: [["Insumo", "Stock Actual", "Stock Mínimo", "Vence"]],
        body: alertas.map(function (i) { return [i.nombre, i.stockActual + " " + i.unidadMedida, i.stockMinimo || 0, i.fechaVencimiento ? fmtFecha(i.fechaVencimiento) : "—"]; }),
        theme: "grid", styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: [253, 226, 226], textColor: 120, fontStyle: "bold" }
      });
    }
    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  // -----------------------------------------------------------------------
  // 3. KARDEX POR INSUMO (auditoría / trazabilidad)
  // -----------------------------------------------------------------------
  function buildKardexInsumoPDF(insumo, movimientos, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "KARDEX DE INVENTARIO — " + insumo.nombre.toUpperCase());
    var margin = ctx.margin, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    var info = [
      "Categoría: " + insumo.categoria + "   ·   Unidad: " + insumo.unidadMedida,
      "Stock actual: " + insumo.stockActual + " " + insumo.unidadMedida + "   ·   Costo unitario: " + fmtMoneda(insumo.costoUnitario),
      "Lote: " + (insumo.lote || "—") + "   ·   Vence: " + (insumo.fechaVencimiento ? fmtFecha(insumo.fechaVencimiento) : "—")
    ];
    info.forEach(function (line, i) { doc.text(line, margin, y + i * 13); });
    y += info.length * 13 + 12;

    var cronologico = movimientos.slice().sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Fecha", "Tipo", "Cantidad", "Saldo Anterior", "Saldo Nuevo", "Motivo", "Usuario"]],
      body: cronologico.length ? cronologico.map(function (m) {
        return [fmtFecha(m.fecha), m.tipo === "entrada" ? "Entrada" : m.tipo === "salida" ? "Salida" : "Ajuste", (m.tipo === "salida" ? "-" : "+") + m.cantidad, m.saldoAnterior, m.saldoNuevo, m.motivo || "", m.usuario || "—"];
      }) : [["Sin movimientos registrados.", "", "", "", "", "", ""]],
      theme: "striped", styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" }
    });
    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  // -----------------------------------------------------------------------
  // 4. REPORTE DE VENCIMIENTOS DE INVENTARIO (entre fechas)
  // -----------------------------------------------------------------------
  /* insumos: solo los que tienen fechaVencimiento configurada y esta cae
     entre "desde" y "hasta" (el filtro ya se aplica en views-reports.js).
     Cada uno se clasifica como VENCIDO (ya pasó la fecha) o POR VENCER
     (vence entre hoy y el fin del periodo) — en vez de franjas fijas de
     30/60/90 días, porque el propio rango de fechas que eligió el
     laboratorio ya define qué tan lejos quiere mirar. Ordenado por fecha
     de vencimiento ascendente (FEFO — First Expired, First Out), la
     misma lógica que usan los sistemas de inventario de laboratorios y
     farmacéuticas grandes para decidir qué salir a consumir primero. */
  function buildVencimientosPDF(insumos, tenant, desde, hasta) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "REPORTE DE VENCIMIENTOS DE INVENTARIO");
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Periodo de vencimiento: " + fmtFecha(desde) + " — " + fmtFecha(hasta) + "   ·   Orden: fecha de vencimiento más próxima primero (FEFO)", margin, y, { maxWidth: pageW - margin * 2 });
    y += 22;

    var hoyStr = new Date().toISOString().slice(0, 10);
    var filas = insumos.map(function (i) {
      var vencido = i.fechaVencimiento < hoyStr;
      return {
        nombre: i.nombre, categoria: i.categoria, lote: i.lote || "—",
        stock: i.stockActual, unidad: i.unidadMedida,
        valorRiesgo: (i.stockActual || 0) * (i.costoUnitario || 0),
        fechaVencimiento: i.fechaVencimiento, vencido: vencido
      };
    }).sort(function (a, b) { return a.fechaVencimiento.localeCompare(b.fechaVencimiento); });

    var vencidos = filas.filter(function (f) { return f.vencido; });
    var porVencer = filas.filter(function (f) { return !f.vencido; });
    var valorVencido = vencidos.reduce(function (a, f) { return a + f.valorRiesgo; }, 0);
    var valorPorVencer = porVencer.reduce(function (a, f) { return a + f.valorRiesgo; }, 0);

    // ---- Tarjetas resumen: cuántos insumos y cuánto valor hay en riesgo,
    // separado entre lo que ya venció y lo que está por vencer en el
    // periodo — el primer vistazo que necesita quien gestiona compras.
    var chips = [
      { titulo: "YA VENCIDOS", n: vencidos.length, valor: valorVencido, color: [185, 28, 28], fondo: [254, 226, 226] },
      { titulo: "POR VENCER EN EL PERIODO", n: porVencer.length, valor: valorPorVencer, color: [180, 83, 9], fondo: [254, 243, 199] }
    ];
    var chipW = (pageW - margin * 2 - 14) / 2, chipH = 46;
    chips.forEach(function (c, i) {
      var cx = margin + i * (chipW + 14);
      doc.setFillColor(c.fondo[0], c.fondo[1], c.fondo[2]); doc.setDrawColor(c.color[0], c.color[1], c.color[2]); doc.setLineWidth(1);
      doc.roundedRect(cx, y, chipW, chipH, 5, 5, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(c.color[0], c.color[1], c.color[2]);
      doc.text(c.titulo + " (" + c.n + ")", cx + 12, y + 17);
      doc.setFontSize(13);
      doc.text(fmtMoneda(c.valor), cx + chipW - 12, y + 34, { align: "right" });
    });
    y += chipH + 22;

    if (!filas.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text("No hay insumos con fecha de vencimiento en este periodo.", margin, y);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Insumo", "Categoría", "Lote", "Stock", "Vence", "Estado", "Valor en Riesgo"]],
      body: filas.map(function (f) {
        return [f.nombre, f.categoria, f.lote, f.stock + " " + f.unidad, fmtFecha(f.fechaVencimiento), f.vencido ? "VENCIDO" : "Por vencer", fmtMoneda(f.valorRiesgo)];
      }),
      theme: "grid", styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" }, 6: { halign: "right" } },
      didParseCell: function (data) {
        if (data.section !== "body") return;
        var f = filas[data.row.index];
        if (!f) return;
        if (data.column.index === 5) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = f.vencido ? [185, 28, 28] : [180, 83, 9];
        }
      }
    });
    y = doc.lastAutoTable.finalY + 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("VALOR TOTAL EN RIESGO: " + fmtMoneda(valorVencido + valorPorVencer), pageW - margin, y, { align: "right" });

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_INVENTARIO = {
    buildGastoReactivosPDF: buildGastoReactivosPDF,
    buildInventarioValorizadoPDF: buildInventarioValorizadoPDF,
    buildKardexInsumoPDF: buildKardexInsumoPDF,
    buildVencimientosPDF: buildVencimientosPDF,
    fmtMoneda: fmtMoneda
  };
})(window);

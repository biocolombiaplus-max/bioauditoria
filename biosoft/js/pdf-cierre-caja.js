/* BIOsoft — Reporte profesional en PDF de Cierre de Caja: cuánto ingresó
   en un periodo (solo dinero realmente recibido, ver nota en
   views-reports.js sobre "montoIngreso"), separado por moneda de pago
   (útil sobre todo para Venezuela, donde un mismo laboratorio puede
   recibir pesos, dólares y bolívares el mismo día) y, dentro de cada
   moneda, por método de pago — igual que un cierre de caja de verdad, para
   poder cuadrar lo recibido contra el efectivo/tarjeta/transferencia del
   día. Sigue el mismo lenguaje visual que pdf-cartera.js (mismo tipo de
   encabezado, tarjetas de totales y pie de página), pero es un documento
   interno de administración — no lleva el QR de verificación que sí
   llevan los informes de resultados que se entregan al paciente. */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;
  var PAGE_BOTTOM = 730;

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
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
    var totalPaginas = doc.internal.getNumberOfPages();
    for (var i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
      doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);
      doc.text("Página " + i + " de " + totalPaginas, doc.internal.pageSize.getWidth() - margin, 770, { align: "right" });
    }
  }

  /* Una tarjeta compacta por moneda, en fila, con el total recibido en esa
     moneda — el primer vistazo del cierre ("¿cuánto entró en cada
     moneda?") antes de entrar al detalle de cada una. */
  function tarjetasMonedas(doc, x, y, w, rgb, grupos) {
    var n = grupos.length;
    var gap = 10;
    var chipW = (w - gap * (n - 1)) / n;
    var h = 42;
    grupos.forEach(function (g, i) {
      var cx = x + i * (chipW + gap);
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
      doc.roundedRect(cx, y, chipW, h, 4, 4, "FD");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(g.moneda, cx + chipW / 2, y + 15, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(fmtMoneda(g.total), cx + chipW / 2, y + 33, { align: "center" });
    });
    return y + h;
  }

  /* Subtotal por método de pago DENTRO de una moneda — la tabla chica que
     de verdad se usa para cuadrar caja (cuánto debería haber en efectivo,
     cuánto en el datáfono, cuánto en transferencias, ese día). */
  function tablaMetodos(doc, y, margin, pageW, rgb, filasMoneda) {
    var porMetodo = {};
    var orden = [];
    filasMoneda.forEach(function (f) {
      if (!porMetodo[f.metodoPago]) { porMetodo[f.metodoPago] = 0; orden.push(f.metodoPago); }
      porMetodo[f.metodoPago] += f.monto;
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: pageW - margin - 230 },
      tableWidth: 230,
      head: [["Método de Pago", "Total"]],
      body: orden.map(function (m) { return [m, fmtMoneda(porMetodo[m])]; }),
      theme: "grid", styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", fontStyle: "bold", textColor: rgb } }
    });
    return doc.lastAutoTable.finalY + 14;
  }

  function tablaDetalle(doc, y, margin, pageW, filasMoneda) {
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Fecha", "N° Orden", "Paciente", "Método de Pago", "Monto"]],
      body: filasMoneda.map(function (f) { return [fmtFecha(f.fecha), f.numeroOrden, f.paciente, f.metodoPago, fmtMoneda(f.monto)]; }),
      theme: "striped", styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 4: { halign: "right" } }
    });
    return doc.lastAutoTable.finalY + 24;
  }

  /* filas: [{ numeroOrden, fecha (ISO del pago), paciente, metodoPago,
     moneda, monto }] — ya filtradas a solo pagos con dinero realmente
     recibido (ver views-reports.js: un cargo 100% a crédito de un
     convenio, sin copago, no entra aquí porque ese día no entró nada a
     caja). monedaFiltro (opcional): si el reporte ya viene restringido a
     una sola moneda, se muestra en el subtítulo. */
  function buildCierreCajaPDF(filas, tenant, desde, hasta, monedaFiltro) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "CIERRE DE CAJA" + (monedaFiltro ? " — " + monedaFiltro : ""));
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta) + "   ·   Solo pagos con dinero recibido (no incluye cargos 100% a crédito de convenio)", margin, y, { maxWidth: pageW - margin * 2 });
    y += 22;

    if (!filas.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text("No hay pagos recibidos en este periodo.", margin, y);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    var gruposMoneda = {};
    var ordenMonedas = [];
    filas.forEach(function (f) {
      if (!gruposMoneda[f.moneda]) { gruposMoneda[f.moneda] = []; ordenMonedas.push(f.moneda); }
      gruposMoneda[f.moneda].push(f);
    });
    ordenMonedas.sort();

    var chips = ordenMonedas.map(function (m) {
      return { moneda: m, total: gruposMoneda[m].reduce(function (acc, f) { return acc + f.monto; }, 0) };
    });
    y = tarjetasMonedas(doc, margin, y, pageW - margin * 2, rgb, chips) + 24;

    ordenMonedas.forEach(function (moneda) {
      var filasMoneda = gruposMoneda[moneda];
      var altoEstimado = 30 + 90 + (filasMoneda.length + 1) * 16;
      if (y + Math.min(altoEstimado, 200) > PAGE_BOTTOM) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      doc.text(moneda.toUpperCase() + " — " + filasMoneda.length + " pago" + (filasMoneda.length === 1 ? "" : "s"), margin, y);
      y += 12;
      y = tablaMetodos(doc, y, margin, pageW, rgb, filasMoneda);
      y = tablaDetalle(doc, y, margin, pageW, filasMoneda);
    });

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CIERRE_CAJA = {
    buildCierreCajaPDF: buildCierreCajaPDF,
    fmtMoneda: fmtMoneda
  };
})(window);

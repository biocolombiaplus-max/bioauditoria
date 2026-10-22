/* BIOsoft — Informe Cashea: detalle del recargo cobrado por pagos con
   Cashea (financiera de compra-ahora-paga-después muy usada en
   Venezuela), examen por examen, en el periodo elegido. Documento de uso
   EXCLUSIVO del administrador del laboratorio — nunca se entrega ni se
   muestra al cliente (ver views-cotizador.js -> buildInformeCasheaHtml,
   la única pantalla de BIOsoft donde este recargo aparece desglosado). */
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
  function fmtFecha(iso) { return iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—"; }

  function encabezado(doc, tenant, desde, hasta) {
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
    doc.text("INFORME CASHEA — DETALLE DE RECARGO", margin, y);
    y += 15;
    // Aviso de confidencialidad, bien visible — este documento es el
    // único lugar de BIOsoft donde el recargo queda explícito, y nunca
    // debe terminar en manos de un cliente.
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(185, 28, 28);
    doc.text("USO INTERNO Y CONFIDENCIAL — EXCLUSIVO DEL ADMINISTRADOR. NO ENTREGAR AL CLIENTE.", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta), margin, y);
    y += 16;
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

  /* Tarjeta con los 3 grandes totales del periodo (Subtotal / Recargo
     cobrado / Total cobrado), mismo lenguaje visual que el resto de
     reportes financieros de BIOsoft (ver pdf-cartera.js). */
  function tarjetaTotales(doc, x, y, w, rgb, totales) {
    var h = 44;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
    doc.roundedRect(x, y, w, h, 4, 4, "FD");
    var colW = w / 3;
    var etiquetas = ["SUBTOTAL (SIN RECARGO)", "RECARGO COBRADO", "TOTAL COBRADO POR CASHEA"];
    var valores = [totales.subtotal, totales.recargo, totales.total];
    var colores = [[60, 60, 60], [21, 128, 61], rgb];
    for (var i = 0; i < 3; i++) {
      var cx = x + colW * i + colW / 2;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(etiquetas[i], cx, y + 15, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(colores[i][0], colores[i][1], colores[i][2]);
      doc.text(fmtMoneda(valores[i]), cx, y + 34, { align: "center" });
      if (i < 2) { doc.setDrawColor(226, 232, 240); doc.line(x + colW * (i + 1), y + 6, x + colW * (i + 1), y + h - 6); }
    }
    return y + h;
  }

  function tablaDetalle(doc, y, margin, pageW, filas) {
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Fecha", "Tipo", "N°", "Cliente", "# Exám.", "Subtotal", "Recargo", "Recargo $", "Total Cobrado"]],
      body: filas.map(function (f) {
        return [fmtFecha(f.fecha), f.tipo, f.numero, f.cliente, String(f.nExamenes), fmtMoneda(f.subtotal), f.recargoPct + "%", fmtMoneda(f.recargoValor), fmtMoneda(f.total)];
      }),
      theme: "striped", styles: { fontSize: 7.8, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
      didParseCell: function (data) {
        if (data.section === "body" && (data.column.index === 7 || data.column.index === 8)) {
          data.cell.styles.textColor = data.column.index === 7 ? [21, 128, 61] : [20, 20, 20];
          if (data.column.index === 8) data.cell.styles.fontStyle = "bold";
        }
      }
    });
    return doc.lastAutoTable.finalY + 18;
  }

  /* filas: [{ fecha (ISO), tipo ("Cotización"|"Orden"), numero, cliente,
     nExamenes, subtotal, recargoPct, recargoValor, total }]. totales:
     { subtotal, recargo, total } ya sumados (ver calcularInformeCashea
     en views-cotizador.js). */
  function buildInformeCasheaPDF(filas, totales, tenant, desde, hasta) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, desde, hasta);
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y;

    if (!filas.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text("No hubo pagos con Cashea en este periodo.", margin, y + 10);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    y = tarjetaTotales(doc, margin, y, pageW - margin * 2, rgb, totales) + 10;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
    doc.text(filas.length + " cobro(s) con recargo de Cashea en el periodo — " + filas.filter(function (f) { return f.tipo === "Orden"; }).length + " orden(es) y " + filas.filter(function (f) { return f.tipo === "Cotización"; }).length + " cotización(es).", margin, y);
    y += 16;
    if (y + 80 > PAGE_BOTTOM) { doc.addPage(); y = margin; }
    tablaDetalle(doc, y, margin, pageW, filas);

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_INFORME_CASHEA = {
    buildInformeCasheaPDF: buildInformeCasheaPDF
  };
})(window);

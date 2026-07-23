/* BIOsoft — Generador de PDF de cotización de exámenes, con la marca del laboratorio */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
  function fmtMoneda(n) {
    return "$" + Math.round(n || 0).toLocaleString("es-CO");
  }

  function buildCotizacionPDF(cotizacion, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
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
    var metaLines = [
      "NIT " + (tenant.nit || "—"),
      (tenant.direccion || "") + (tenant.telefonos ? " · " + tenant.telefonos : ""),
      tenant.email || ""
    ];
    metaLines.forEach(function (line, i) { doc.text(line, margin + (tenant.logoDataUrl ? 56 : 0), y + 22 + i * 10); });

    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
    y += 62; doc.line(margin, y, pageW - margin, y); y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text("COTIZACIÓN DE EXÁMENES DE LABORATORIO", margin, y);
    y += 20;

    doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal");
    var col1 = margin, col2 = pageW / 2 + 10;
    var fechaEmision = new Date(cotizacion.creadoEn);
    var fechaValidez = new Date(fechaEmision.getTime() + 15 * 864e5);
    var cliente = cotizacion.cliente || {};
    var left = [
      ["Cliente:", cliente.nombre || "—"],
      ["WhatsApp:", cliente.whatsapp || "—"]
    ];
    var right = [
      ["N° Cotización:", cotizacion.id],
      ["Fecha:", fechaEmision.toLocaleDateString("es-CO")],
      ["Válida hasta:", fechaValidez.toLocaleDateString("es-CO")]
    ];
    left.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], col1, y + i * 14);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col1 + 70, y + i * 14);
    });
    right.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], col2, y + i * 14);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col2 + 90, y + i * 14);
    });
    y += Math.max(left.length, right.length) * 14 + 18;

    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Examen", "Sección", "Precio"]],
      body: cotizacion.examenes.map(function (ex) { return [ex.nombre, C.seccionNombre(ex.seccion) || "", fmtMoneda(ex.precio)]; }),
      theme: "grid", styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right" } }
    });
    y = doc.lastAutoTable.finalY + 14;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("TOTAL: " + fmtMoneda(cotizacion.total), pageW - margin, y, { align: "right" });
    y += 26;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    doc.text("Esta cotización es informativa y tiene una validez de 15 días desde su fecha de emisión. Los precios pueden variar según indicaciones médicas adicionales.", margin, y, { maxWidth: pageW - margin * 2 });

    doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_COTIZACION = { buildCotizacionPDF: buildCotizacionPDF, fmtMoneda: fmtMoneda };
})(window);

/* BIOsoft — Generador de PDF de cotización de exámenes, con la marca del laboratorio */
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

  async function buildCotizacionPDF(cotizacion, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 40;
    var rgb = hexToRgb(tenant.colorPrimario);

    // Mismo membrete (logo, nombre, datos de contacto) que el informe de
    // resultados — un laboratorio que activa el membrete grande en
    // Configuración lo ve igual en todos sus documentos impresos, no solo
    // en los resultados.
    var y = await window.BIO_PDF.dibujarMembrete(doc, tenant, margin);

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
    if (cotizacion.convenio) left.push(["Convenio:", cotizacion.convenio.nombre + " (" + cotizacion.convenio.tipo + ")"]);
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
      body: cotizacion.examenes.map(function (ex) { return [ex.nombre, ex.seccionNombre || C.seccionNombre(ex.seccion, tenant) || "", fmtMoneda(ex.precio)]; }),
      theme: "grid", styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right" } }
    });
    y = doc.lastAutoTable.finalY + 14;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("TOTAL: " + fmtMoneda(cotizacion.total), pageW - margin, y, { align: "right" });
    y += 14;
    var extraMoneda = C.fmtMonedaAdicional(tenant, cotizacion.total);
    if (extraMoneda) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
      doc.text(extraMoneda, pageW - margin, y, { align: "right" });
      y += 14;
    }
    y += 12;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    doc.text("Esta cotización es informativa y tiene una validez de 15 días desde su fecha de emisión. Los precios pueden variar según indicaciones médicas adicionales.", margin, y, { maxWidth: pageW - margin * 2 });

    doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_COTIZACION = { buildCotizacionPDF: buildCotizacionPDF, fmtMoneda: fmtMoneda };
})(window);

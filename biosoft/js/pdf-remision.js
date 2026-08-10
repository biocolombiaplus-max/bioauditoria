/* BIOsoft — Hoja de Remisión a Laboratorio de Referencia: documento
   profesional de trazabilidad/cadena de custodia para exámenes que el
   laboratorio no procesa internamente y envía a un laboratorio externo,
   conforme a los lineamientos de trazabilidad de muestras de la
   Resolución 3100 de 2019 (Colombia) y la normativa de habilitación de
   laboratorios clínicos vigente en cada país. */
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
  function buildQrDataUrl(texto, sizePx) {
    if (!window.qrcode) return null;
    var qr = window.qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    var count = qr.getModuleCount();
    var canvas = document.createElement("canvas");
    canvas.width = sizePx; canvas.height = sizePx;
    var ctx = canvas.getContext("2d");
    var cell = sizePx / count;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = "#0f172a";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(Math.round(c * cell), Math.round(r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    return canvas.toDataURL("image/png");
  }

  /* remision = {
       numero, fecha (Date), laboratorioDestino: {nombre, direccion, telefono, contacto},
       paciente: {nombre, tipoDocumento, numeroDocumento, edadTexto, sexo},
       numeroOrden, medicoRemitente, procedencia,
       examenes: [{nombre, cups, seccionNombre, muestra, tuboNombre, valor}],
       incluirValores (bool), observaciones
     } */
  function buildHojaRemisionPDF(remision, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 40;
    var y = margin;
    var rgb = hexToRgb(tenant.colorPrimario);

    if (tenant.logoDataUrl) {
      try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 6, 46, 46); } catch (e) {}
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(tenant.nombre || "Laboratorio", margin + (tenant.logoDataUrl ? 56 : 0), y + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    var metaLines = [
      C.documentoTributarioLabel(tenant.pais) + " " + (tenant.nit || "—") + (tenant.codigoREPS ? " · Código REPS " + tenant.codigoREPS : ""),
      (tenant.direccion || "") + (tenant.telefonos ? " · " + tenant.telefonos : ""),
      tenant.resolucionHabilitacion || ""
    ];
    metaLines.forEach(function (line, i) { doc.text(line, margin + (tenant.logoDataUrl ? 56 : 0), y + 20 + i * 10); });

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("N° " + remision.numero, pageW - margin, y + 8, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    doc.text("Fecha: " + remision.fecha.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }), pageW - margin, y + 20, { align: "right" });
    doc.text("Hora: " + remision.fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }), pageW - margin, y + 30, { align: "right" });

    y += 58;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.6);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text("HOJA DE REMISIÓN A LABORATORIO DE REFERENCIA", pageW / 2, y, { align: "center" });
    y += 24;

    // ---------- Paciente / Orden ----------
    var col1 = margin, col2 = pageW / 2 + 10;
    var pac = remision.paciente;
    var left = [
      ["Paciente:", pac.nombre || "—"],
      ["Documento:", (pac.tipoDocumento || "") + " " + (pac.numeroDocumento || "")],
      ["Edad / Sexo:", (pac.edadTexto || "—") + " / " + (pac.sexo || "—")]
    ];
    var right = [
      ["N° de Orden:", remision.numeroOrden || "—"],
      ["Médico Remitente:", remision.medicoRemitente || "—"],
      ["Procedencia:", remision.procedencia || "—"]
    ];
    doc.setFontSize(9);
    left.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 20); doc.text(row[0], col1, y + i * 14);
      doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); doc.text(String(row[1]), col1 + 78, y + i * 14, { maxWidth: col2 - col1 - 88 });
    });
    right.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 20); doc.text(row[0], col2, y + i * 14);
      doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); doc.text(String(row[1]), col2 + 90, y + i * 14, { maxWidth: pageW - margin - col2 - 90 });
    });
    y += 3 * 14 + 16;

    // ---------- Remitido a ----------
    var lab = remision.laboratorioDestino || {};
    doc.setFillColor(248, 248, 248); doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.7);
    var boxH = 36 + (lab.direccion || lab.telefono || lab.contacto ? 12 : 0);
    doc.rect(margin, y, pageW - margin * 2, boxH, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("REMITIDO A (LABORATORIO DE REFERENCIA):", margin + 10, y + 15);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
    doc.text(lab.nombre || "—", margin + 10, y + 29);
    if (lab.direccion || lab.telefono || lab.contacto) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text([lab.direccion, lab.telefono, lab.contacto].filter(Boolean).join(" · "), margin + 10, y + 41);
    }
    y += boxH + 18;

    // ---------- Tabla de exámenes ----------
    var incluirValores = !!remision.incluirValores;
    var head = incluirValores
      ? [["Examen", "CUPS", "Sección", "Muestra / Tubo", "Valor"]]
      : [["Examen", "CUPS", "Sección", "Muestra / Tubo"]];
    var body = remision.examenes.map(function (ex) {
      var fila = [ex.nombre, ex.cups || "—", ex.seccionNombre || "—", (ex.muestra || "") + (ex.tuboNombre ? " - " + ex.tuboNombre : "")];
      if (incluirValores) fila.push(fmtMoneda(ex.valor));
      return fila;
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: head, body: body, theme: "grid", styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: incluirValores ? { 4: { halign: "right" } } : {}
    });
    y = doc.lastAutoTable.finalY + 10;

    if (incluirValores) {
      var total = remision.examenes.reduce(function (a, e) { return a + (parseFloat(e.valor) || 0); }, 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text("TOTAL A CANCELAR AL LABORATORIO DE REFERENCIA: " + fmtMoneda(total), pageW - margin, y + 14, { align: "right" });
      y += 30;
    } else {
      y += 8;
    }

    if (remision.observaciones) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
      var obsLines = doc.splitTextToSize("Observaciones: " + remision.observaciones, pageW - margin * 2);
      if (y + obsLines.length * 11 > 700) { doc.addPage(); y = margin; }
      doc.text(obsLines, margin, y);
      y += obsLines.length * 11 + 10;
    }

    // ---------- Cadena de custodia / firmas ----------
    if (y > 660) { doc.addPage(); y = margin; }
    y += 24;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.7);
    var colW = (pageW - margin * 2 - 20) / 2;
    var col2x = margin + colW + 20;

    function bloqueFirma(x, titulo) {
      doc.line(x, y, x + colW, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(titulo, x, y + 12);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text("Nombre: _______________________________", x, y + 30);
      doc.text("Firma: ________________________________", x, y + 46);
      doc.text("Fecha / Hora: __________________________", x, y + 62);
    }
    bloqueFirma(margin, "ENTREGA — " + (tenant.nombre || "Laboratorio Remitente"));
    bloqueFirma(col2x, "RECIBE — " + (lab.nombre || "Laboratorio de Referencia"));
    var signBlockBottom = y + 70;

    try {
      var qrTexto = "BIOsoft | Hoja de Remisión\nLaboratorio remitente: " + tenant.nombre +
        "\nRemitido a: " + (lab.nombre || "—") + "\nRemisión N°: " + remision.numero +
        "\nOrden: " + (remision.numeroOrden || "—") + "\nPaciente: " + (pac.tipoDocumento || "") + " " + (pac.numeroDocumento || "") +
        "\nGenerado: " + remision.fecha.toLocaleString("es-CO");
      var qrDataUrl = buildQrDataUrl(qrTexto, 220);
      if (qrDataUrl) {
        var qrSize = 54;
        var qrX = pageW - margin - qrSize;
        var qrY = Math.max(signBlockBottom + 10, 690 - qrSize);
        if (qrY + qrSize + 16 > 760) { doc.addPage(); qrY = margin + 10; }
        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
        doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.6); doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
        doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.setTextColor(120, 120, 120);
        doc.text("TRAZABILIDAD", qrX + qrSize / 2, qrY + qrSize + 9, { align: "center" });
      }
    } catch (e) {}

    doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(140, 140, 140);
    doc.text(
      "Documento de remisión de muestra/examen a laboratorio de referencia, elaborado conforme a los lineamientos de trazabilidad exigidos por la normativa de habilitación de laboratorios clínicos vigente (en Colombia, Resolución 3100 de 2019). Generado electrónicamente por BIOsoft el " + new Date().toLocaleString("es-CO") + ".",
      margin, 775, { maxWidth: pageW - margin * 2 }
    );

    return new Uint8Array(doc.output("arraybuffer"));
  }

  function numeroRemision(fecha, orderId) {
    var f = fecha || new Date();
    return "REM-" + f.getFullYear() + "-" + String(orderId || "").slice(-6).toUpperCase() + "-" + String(f.getTime()).slice(-4);
  }

  global.BIO_PDF_REMISION = { buildHojaRemisionPDF: buildHojaRemisionPDF, numeroRemision: numeroRemision };
})(window);

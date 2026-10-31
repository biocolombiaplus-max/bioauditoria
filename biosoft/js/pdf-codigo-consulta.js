/* BIOsoft — Código de Consulta de Resultados: documento compacto (media
   carta) que el laboratorio imprime o comparte por WhatsApp para que el
   paciente pueda descargar su propio resultado desde la Página Web del
   laboratorio, solo con su número de documento y este código — sin tener
   que llamar ni pasar por recepción. */
(function (global) {
  "use strict";

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
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

  // Media carta en puntos (1in = 72pt): 5.5in x 8.5in, vertical — el
  // tamaño de papel que normalmente se usa para este tipo de comprobante
  // corto, para no gastar una hoja carta completa en 4 líneas de texto.
  var PAGE_W = 396, PAGE_H = 612;

  function buildCodigoConsultaPDF(order, pac, tenant, urlConsulta) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: [PAGE_W, PAGE_H] });
    var rgb = hexToRgb(tenant.colorPrimario);
    var margin = 32;
    var cx = PAGE_W / 2;
    var y = margin + 4;

    if (tenant.logoDataUrl) {
      try { doc.addImage(tenant.logoDataUrl, "PNG", cx - 26, y, 52, 52); y += 62; } catch (e) { y += 6; }
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(tenant.nombre || "Laboratorio Clínico", cx, y, { align: "center", maxWidth: PAGE_W - margin * 2 });
    y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(100, 116, 139);
    doc.text("Código de Consulta de Resultados", cx, y, { align: "center" });
    y += 13;
    doc.setFontSize(8.5);
    doc.text("Orden " + (order.numeroOrden || "—"), cx, y, { align: "center" });
    y += 14;

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
    doc.line(margin, y, PAGE_W - margin, y);
    y += 20;

    // Caja del código: separado en celdas individuales (más fácil de leer
    // y copiar a mano que un bloque de texto corrido).
    var codigo = String(order.codigoConsulta || "");
    var cajaH = 56;
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.3);
    doc.roundedRect(margin, y, PAGE_W - margin * 2, cajaH, 10, 10, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(codigo.split("").join(" "), cx, y + cajaH / 2 + 9, { align: "center" });
    y += cajaH + 22;

    // QR — para quien prefiera escanear en vez de escribir la dirección a
    // mano; el texto completo de la URL queda igual debajo, por si el
    // celular del paciente no tiene lector de QR a la mano.
    var qrDataUrl = buildQrDataUrl(urlConsulta, 240);
    if (qrDataUrl) {
      var qrSize = 92;
      doc.addImage(qrDataUrl, "PNG", cx - qrSize / 2, y, qrSize, qrSize);
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.8);
      doc.rect(cx - qrSize / 2 - 2, y - 2, qrSize + 4, qrSize + 4);
      y += qrSize + 12;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
      doc.text("Escanea para consultar tu resultado", cx, y, { align: "center" });
      y += 18;
    }

    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text("O ingresa manualmente en:", cx, y, { align: "center" });
    y += 11;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.textWithLink(urlConsulta, cx, y, { align: "center", url: urlConsulta });
    y += 20;

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
    doc.line(margin, y, PAGE_W - margin, y);
    y += 18;

    // Nombre y documento en renglones separados (en vez de "Etiqueta: valor"
    // en la misma línea) — un nombre compuesto largo (frecuente: dos
    // nombres + dos apellidos) cabe completo sin arriesgarse a encimar el
    // siguiente dato si llegara a necesitar más de una línea.
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text("PACIENTE", margin, y);
    y += 11;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(pac ? (BIO_UI.nombreCompleto ? BIO_UI.nombreCompleto(pac) : pac.nombres + " " + pac.apellidos) : "—", margin, y, { maxWidth: PAGE_W - margin * 2 });
    y += 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text("DOCUMENTO", margin, y);
    y += 11;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(pac ? (pac.numeroDocumento || "—") : "—", margin, y);
    y += 22;

    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text("Guarda este código — lo necesitas para descargar tu resultado.", cx, y, { align: "center", maxWidth: PAGE_W - margin * 2 });
    y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    doc.text("Generado electrónicamente por BIOsoft el " + new Date().toLocaleString("es-CO"), cx, PAGE_H - 16, { align: "center" });

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CODIGO_CONSULTA = { buildCodigoConsultaPDF: buildCodigoConsultaPDF };
})(window);

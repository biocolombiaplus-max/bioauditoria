/* BIOsoft — Recibo de pago de una Orden de Laboratorio, en tamaño carta
   (8.5" x 11"), con el mismo lenguaje visual premium de los demás
   documentos (membrete compartido, tarjeta de total resaltada, insignia
   de pago confirmado). Nació pensado sobre todo para laboratorios de
   Venezuela que muestran el equivalente en bolívares según la tasa del
   día (tenant.monedaAdicional), pero hoy funciona para cualquier país que
   tenga activado "Valor a Cobrar" en sus órdenes. */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;
  var METODO_PAGO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta Débito/Crédito", zelle: "Zelle", pago_movil: "Pago Móvil", otro: "Otro" };

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

  function numeroRecibo(order) {
    var fecha = new Date(order.fechaOrden);
    return "REC-" + fecha.getFullYear() + "-" + String(order.numeroOrden).slice(-6).toUpperCase();
  }

  function nombrePaciente(pac) {
    if (!pac) return "—";
    var nombre = window.BIO_UI ? window.BIO_UI.nombreCompleto(pac) : [pac.primerNombre, pac.segundoNombre, pac.primerApellido, pac.segundoApellido].filter(Boolean).join(" ");
    return nombre || "—";
  }

  /* pago: { fecha, metodoPago, confirmadoPor }. preciosPorId: mapa examId -> precio,
     para poder desglosar el cobro por examen (la Orden solo guarda el total).
     No todos los laboratorios configuran precio individual por examen en su
     Lista de Precios (muchos solo escriben un Valor a Cobrar único por
     orden) — si NINGÚN examen tiene precio conocido, la tabla se muestra
     sin la columna de Precio en vez de una fila de guiones que se ve como
     un dato faltante/roto. */
  async function buildReciboOrdenPDF(order, pac, tenant, pago, preciosPorId) {
    pago = pago || {};
    preciosPorId = preciosPorId || {};
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 48;
    var rgb = hexToRgb(tenant.colorPrimario);

    // Mismo membrete (logo, nombre, datos de contacto) que el informe de
    // resultados, la cotización y su recibo — un laboratorio que activa el
    // membrete grande en Configuración lo ve igual en todos sus documentos
    // impresos.
    var y = await window.BIO_PDF.dibujarMembrete(doc, tenant, margin);

    // ---- Título + número, con línea divisoria de color debajo -----------
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(20, 20, 20);
    doc.text("RECIBO DE PAGO", margin, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("N° " + numeroRecibo(order), pageW - margin, y, { align: "right" });
    y += 10;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.3);
    doc.line(margin, y, pageW - margin, y);
    y += 26;

    // ---- Datos del paciente / del pago, en dos columnas ------------------
    doc.setFontSize(9.5);
    var col1 = margin, col2 = pageW / 2 + 12;
    var left = [
      ["Paciente:", nombrePaciente(pac)],
      ["Documento:", pac ? (pac.tipoDocumento + " " + pac.numeroDocumento) : "—"],
      ["Orden N°:", String(order.numeroOrden)]
    ];
    var right = [
      ["Fecha de Pago:", new Date(pago.fecha || order.fechaOrden).toLocaleDateString("es-CO")],
      ["Método de Pago:", METODO_PAGO_LABEL[pago.metodoPago] || pago.metodoPago || "—"]
    ];
    if (pago.confirmadoPor) right.push(["Confirmado por:", pago.confirmadoPor]);
    var filasInfo = Math.max(left.length, right.length);
    left.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30); doc.text(row[0], col1, y + i * 15);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col1 + 68, y + i * 15, { maxWidth: col2 - col1 - 80 });
    });
    right.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30); doc.text(row[0], col2, y + i * 15);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col2 + 92, y + i * 15, { maxWidth: pageW - margin - col2 - 92 });
    });
    y += filasInfo * 15 + 20;

    // ---- Tabla de exámenes -------------------------------------------
    var hayAlgunPrecio = order.examenes.some(function (ex) { return preciosPorId[ex.examId] != null; });
    var filasExamenes = order.examenes.map(function (ex) {
      var exCat = C.examenEfectivo(ex.examId, tenant);
      var seccion = C.seccionNombre(exCat.seccion, tenant) || "";
      var nombre = exCat ? exCat.nombre : ex.examId;
      if (hayAlgunPrecio) {
        var precio = preciosPorId[ex.examId];
        return [nombre, seccion, precio != null ? fmtMoneda(precio) : "—"];
      }
      return [nombre, seccion];
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: hayAlgunPrecio ? [["Examen", "Sección", "Precio"]] : [["Examen", "Sección"]],
      body: filasExamenes,
      theme: "grid", styles: { fontSize: 9, cellPadding: 6, lineColor: [226, 228, 233], lineWidth: 0.6 },
      headStyles: { fillColor: [247, 248, 250], textColor: 40, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      columnStyles: hayAlgunPrecio ? { 2: { halign: "right", cellWidth: 90 } } : {}
    });
    y = doc.lastAutoTable.finalY + 22;

    // ---- Tarjeta de total pagado, resaltada ---------------------------
    var montoPagado = pago.monto != null ? pago.monto : order.valorCobrar;
    var extraMoneda = C.fmtMonedaAdicional(tenant, montoPagado);
    var cardW = 220, cardH = extraMoneda ? 54 : 40;
    var cardX = pageW - margin - cardW, cardY = y;
    doc.setFillColor(250, 250, 251); doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.1);
    doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110);
    doc.text("TOTAL PAGADO", cardX + 14, cardY + 17);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(fmtMoneda(montoPagado), cardX + cardW - 14, cardY + 30, { align: "right" });
    if (extraMoneda) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
      doc.text(extraMoneda, cardX + cardW - 14, cardY + 44, { align: "right" });
    }
    y = cardY + cardH + 24;

    // ---- Insignia de pago confirmado -----------------------------------
    // Nunca uses ✓/★/≈ ni ningún carácter fuera de WinAnsi dentro de
    // doc.text()/autoTable — las fuentes base de jsPDF (Helvetica) no las
    // soportan y el texto sale corrupto (ver el mismo problema ya
    // corregido con "≈" en catalog.js). El círculo relleno de abajo hace
    // el mismo trabajo visual de "insignia" sin depender de ningún glifo.
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    var badgeTxt = "PAGO CONFIRMADO", badgeW = doc.getTextWidth(badgeTxt) + 40, badgeH = 20;
    doc.setFillColor(224, 246, 234); doc.setDrawColor(11, 138, 74); doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, badgeW, badgeH, badgeH / 2, badgeH / 2, "FD");
    doc.setFillColor(11, 138, 74);
    doc.circle(margin + 16, y + badgeH / 2, 3, "F");
    doc.setTextColor(11, 138, 74);
    doc.text(badgeTxt, margin + 26, y + 13.5);
    y += badgeH + 22;

    // ---- Nota legal y pie de página -------------------------------------
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
    doc.text("Este recibo certifica la recepción del pago correspondiente a los exámenes de esta orden. Conserva este documento para cualquier reclamación relacionada con tu compra.", margin, y, { maxWidth: pageW - margin * 2 });

    doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_RECIBO_ORDEN = { buildReciboOrdenPDF: buildReciboOrdenPDF, numeroRecibo: numeroRecibo, fmtMoneda: fmtMoneda, METODO_PAGO_LABEL: METODO_PAGO_LABEL };
})(window);

/* BIOsoft — Recibo de pago de una Orden de Laboratorio, en tamaño media
   carta (5.5" x 8.5"), pensado sobre todo para laboratorios de Venezuela
   que cobran en dólares y muestran el equivalente en bolívares según la
   tasa del día (tenant.monedaAdicional). Reutiliza el mismo estilo que
   pdf-recibo-cotizacion.js (recibo del Cotizador) pero a partir de una
   Orden ya creada y de su confirmación de pago. */
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

  /* pago: { fecha, metodoPago, confirmadoPor }. preciosPorId: mapa examId -> precio,
     para poder desglosar el cobro por examen (la Orden solo guarda el total). */
  async function buildReciboOrdenPDF(order, pac, tenant, pago, preciosPorId) {
    pago = pago || {};
    preciosPorId = preciosPorId || {};
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: [396, 612] }); // media carta (5.5" x 8.5")
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var margin = 28;
    var rgb = hexToRgb(tenant.colorPrimario);

    // Mismo membrete (logo, nombre, datos de contacto) que el informe de
    // resultados, la cotización y su recibo — un laboratorio que activa el
    // membrete grande en Configuración lo ve igual en todos sus documentos
    // impresos. La función escala el logo según el ancho real de la
    // página, así que en esta hoja más angosta (media carta) queda
    // proporcional en vez de desbordado.
    var y = await window.BIO_PDF.dibujarMembrete(doc, tenant, margin);

    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text("RECIBO DE PAGO", margin, y);
    y += 13;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("N° " + numeroRecibo(order) + "  ·  Orden " + order.numeroOrden, margin, y);
    y += 16;

    doc.setFontSize(8); doc.setTextColor(30, 30, 30);
    var filas = [
      ["Paciente:", pac ? (pac.nombres + " " + pac.apellidos) : "—"],
      ["Documento:", pac ? (pac.tipoDocumento + " " + pac.numeroDocumento) : "—"],
      ["Fecha de Pago:", new Date(pago.fecha || order.fechaOrden).toLocaleDateString("es-CO")],
      ["Método de Pago:", METODO_PAGO_LABEL[pago.metodoPago] || pago.metodoPago || "—"]
    ];
    if (pago.confirmadoPor) filas.push(["Confirmado por:", pago.confirmadoPor]);
    filas.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], margin, y + i * 12);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), margin + 78, y + i * 12, { maxWidth: pageW - margin - (margin + 78) });
    });
    y += filas.length * 12 + 12;

    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Examen", "Precio"]],
      body: order.examenes.map(function (ex) {
        var exCat = C.examenEfectivo(ex.examId, tenant);
        var precio = preciosPorId[ex.examId];
        return [exCat.nombre, precio != null ? fmtMoneda(precio) : "—"];
      }),
      theme: "grid", styles: { fontSize: 7.5, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", cellWidth: 70 } }
    });
    y = doc.lastAutoTable.finalY + 12;

    var montoPagado = pago.monto != null ? pago.monto : order.valorCobrar;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("TOTAL PAGADO: " + fmtMoneda(montoPagado), pageW - margin, y, { align: "right" });
    y += 12;
    var extraMoneda = C.fmtMonedaAdicional(tenant, montoPagado);
    if (extraMoneda) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text(extraMoneda, pageW - margin, y, { align: "right" });
      y += 12;
    }
    y += 6;

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(11, 138, 74);
    doc.text("✓ PAGO CONFIRMADO", margin, y);
    y += 18;

    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(90, 90, 90);
    doc.text("Este recibo certifica la recepción del pago correspondiente a los exámenes de esta orden. Conserva este documento para cualquier reclamación relacionada con tu compra.", margin, y, { maxWidth: pageW - margin * 2 });

    doc.setFontSize(6.5); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, pageH - 16);

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_RECIBO_ORDEN = { buildReciboOrdenPDF: buildReciboOrdenPDF, numeroRecibo: numeroRecibo, fmtMoneda: fmtMoneda, METODO_PAGO_LABEL: METODO_PAGO_LABEL };
})(window);

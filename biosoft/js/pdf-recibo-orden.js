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
    // "Recibo detallado" (opción por laboratorio): si la orden es de un
    // convenio, arriba se nombra el convenio y no se pide/muestra método de
    // pago (todo convenio se maneja a crédito, ver pago.esCredito más
    // abajo) — un método de pago ahí no tendría sentido.
    var esCredito = !!pago.esCredito;
    // Copago: la orden es de un convenio, pero ese convenio en particular
    // tiene copago activado (ver catalog.js -> calcularCopago) — el
    // paciente sí pagó una parte con un método normal, y el resto queda a
    // crédito del convenio. No es lo mismo que "esCredito" a secas (100%
    // crédito, sin ningún pago del paciente): aquí el recibo debe mostrar
    // AMBAS partes, no una sola tarjeta de "saldo a cargo del convenio".
    var tieneCopago = !!pago.tieneCopago;
    doc.setFontSize(9.5);
    var col1 = margin, col2 = pageW / 2 + 12;
    var left = [
      ["Paciente:", nombrePaciente(pac)],
      ["Documento:", pac ? (pac.tipoDocumento + " " + pac.numeroDocumento) : "—"],
      ["Orden N°:", String(order.numeroOrden)]
    ];
    if (tenant.reciboConvenioComoCredito && order.convenioNombre) left.unshift(["Convenio:", order.convenioNombre]);
    var right = [
      ["Fecha de Pago:", new Date(pago.fecha || order.fechaOrden).toLocaleDateString("es-CO")]
    ];
    if (!esCredito || tieneCopago) right.push([tieneCopago ? "Método de Pago del Copago:" : "Método de Pago:", METODO_PAGO_LABEL[pago.metodoPago] || pago.metodoPago || "—"]);
    // Solo aplica a laboratorios de Venezuela con la moneda de pago
    // habilitada por orden (ver "Moneda de Pago" en Nueva Orden) — deja
    // registrado en el recibo en qué moneda entregó el dinero el paciente
    // (bolívares/dólares/pesos colombianos), para poder cuadrar caja.
    if (order.monedaPago) right.push(["Moneda de Pago:", C.monedaPagoLabel(order.monedaPago)]);
    if (pago.confirmadoPor) right.push(["Confirmado por:", pago.confirmadoPor]);
    var filasInfo = Math.max(left.length, right.length);
    // El valor de cada fila arranca justo después del ancho REAL de su
    // etiqueta (medido con la misma fuente/tamaño ya aplicados), no a un
    // ancho fijo — con "Método de Pago:" cabía bien en 92pt, pero la
    // etiqueta más larga "Método de Pago del Copago:" (copago) se montaba
    // encima del valor con ese ancho fijo (bug real: mismo patrón ya
    // corregido antes en pdf.js -> dibujarBloqueInformePaciente).
    doc.setFont("helvetica", "bold");
    left.forEach(function (row, i) {
      doc.setTextColor(30, 30, 30); doc.text(row[0], col1, y + i * 15);
      var offset = Math.max(68, doc.getTextWidth(row[0]) + 8);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col1 + offset, y + i * 15, { maxWidth: col2 - col1 - offset - 12 });
      doc.setFont("helvetica", "bold");
    });
    right.forEach(function (row, i) {
      doc.setTextColor(30, 30, 30); doc.text(row[0], col2, y + i * 15);
      var offsetR = doc.getTextWidth(row[0]) + 8;
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col2 + offsetR, y + i * 15, { maxWidth: pageW - margin - col2 - offsetR });
      doc.setFont("helvetica", "bold");
    });
    y += filasInfo * 15 + 20;

    // ---- Tabla de exámenes -------------------------------------------
    // La columna "Sección" (a qué área del laboratorio pertenece cada
    // examen) no le sirve de nada a quien recibe el recibo — se reemplaza
    // siempre por el valor de cada examen (cuando se conoce), que sí es lo
    // que alguien esperaría ver desglosado en un recibo de pago.
    var hayAlgunPrecio = order.examenes.some(function (ex) { return preciosPorId[ex.examId] != null; });
    var filasExamenes = order.examenes.map(function (ex) {
      var exCat = C.examenEfectivo(ex.examId, tenant);
      var nombre = exCat ? exCat.nombre : ex.examId;
      if (!hayAlgunPrecio) return [nombre];
      var precio = preciosPorId[ex.examId];
      return [nombre, precio != null ? fmtMoneda(precio) : "—"];
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: hayAlgunPrecio ? [["Examen", "Valor"]] : [["Examen"]],
      body: filasExamenes,
      theme: "grid", styles: { fontSize: 9, cellPadding: 6, lineColor: [226, 228, 233], lineWidth: 0.6 },
      headStyles: { fillColor: [247, 248, 250], textColor: 40, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      columnStyles: hayAlgunPrecio ? { 1: { halign: "right", cellWidth: 110 } } : {}
    });
    y = doc.lastAutoTable.finalY + 22;

    // ---- Tarjeta de total, resaltada -----------------------------------
    // Pagos parciales (abonos): C.totalAbonado() suma TODO lo recibido
    // hasta ahora (order.abonos siempre incluye este mismo pago como su
    // primer o último elemento — ver views-orders.js), y
    // C.saldoPendienteOrden() dice cuánto le sigue debiendo el paciente en
    // efectivo (nunca la parte que quedó a crédito del convenio). Antes
    // este recibo asumía que "abono" siempre era igual al total (no
    // existían los pagos parciales de verdad) — ahora usa los montos
    // reales, para que el cliente vea siempre su saldo exacto.
    var montoAdeudado = C.montoAdeudarPaciente(order);
    var montoAbonado = C.totalAbonado(order);
    var saldo = C.saldoPendienteOrden(order);
    var extraMoneda = C.fmtMonedaAdicional(tenant, montoAbonado);
    // El único caso que se queda con la tarjeta sencilla de un solo valor
    // es el crédito 100% al convenio SIN copago (esCredito && !tieneCopago
    // — ahí no hay ningún monto que el paciente haya puesto de su bolsillo
    // para desglosar). Con copago SIEMPRE se desglosa (aunque tieneCopago
    // también marca esCredito=true, porque el resto de la orden sí queda
    // a crédito) — igual que cuando el laboratorio activó "Recibo de Pago
    // detallado", o cuando queda un saldo pendiente por cobrar.
    var mostrarDesglose = tieneCopago || (tenant.reciboConvenioComoCredito && !esCredito) || saldo > 0;
    if (!(esCredito && !tieneCopago) && mostrarDesglose) {
      var cardW3 = 340, cardH3 = 46;
      var cardX3 = pageW - margin - cardW3, cardY3 = y;
      doc.setFillColor(250, 250, 251); doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.1);
      doc.roundedRect(cardX3, cardY3, cardW3, cardH3, 6, 6, "FD");
      var colW3 = cardW3 / 3;
      var etiquetas3 = tieneCopago ? ["VALOR TOTAL DE LA ORDEN", "COPAGO DEL PACIENTE", "A CARGO DEL CONVENIO"] : ["VALOR TOTAL", "ABONADO A LA FECHA", "SALDO PENDIENTE"];
      var valores3 = tieneCopago ? [order.valorCobrar, montoAdeudado, pago.valorConvenio || 0] : [order.valorCobrar, montoAbonado, saldo];
      var colores3 = tieneCopago ? [[60, 60, 60], [21, 128, 61], [37, 99, 235]] : [[60, 60, 60], [21, 128, 61], saldo > 0 ? [217, 119, 6] : [21, 128, 61]];
      for (var ci = 0; ci < 3; ci++) {
        var cx3 = cardX3 + colW3 * ci + colW3 / 2;
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
        doc.text(etiquetas3[ci], cx3, cardY3 + 16, { align: "center" });
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(colores3[ci][0], colores3[ci][1], colores3[ci][2]);
        doc.text(fmtMoneda(valores3[ci]), cx3, cardY3 + 34, { align: "center" });
        if (ci < 2) { doc.setDrawColor(226, 228, 233); doc.line(cardX3 + colW3 * (ci + 1), cardY3 + 6, cardX3 + colW3 * (ci + 1), cardY3 + cardH3 - 6); }
      }
      y = cardY3 + cardH3 + 24;
    } else {
      var cardW = 220, cardH = extraMoneda ? 54 : 40;
      var cardX = pageW - margin - cardW, cardY = y;
      doc.setFillColor(250, 250, 251); doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.1);
      doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110);
      doc.text(esCredito ? "SALDO A CARGO DEL CONVENIO" : "TOTAL PAGADO", cardX + 14, cardY + 17);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(fmtMoneda(esCredito ? order.valorCobrar : montoAbonado), cardX + cardW - 14, cardY + 30, { align: "right" });
      if (extraMoneda) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
        doc.text(extraMoneda, cardX + cardW - 14, cardY + 44, { align: "right" });
      }
      y = cardY + cardH + 24;
    }

    // ---- Historial de abonos ---------------------------------------------
    // Solo aparece cuando de verdad hay algo que contar — más de un abono
    // registrado, o un saldo que todavía queda pendiente — para que un
    // recibo de pago normal (pagado completo, de una sola vez) se vea
    // exactamente igual que siempre, sin una tabla de más. Esto es lo que
    // hace "fácil de entender" un pago en cuotas: el cliente ve, fecha por
    // fecha, cuánto ha ido pagando y cuánto le falta.
    var abonos = order.abonos || [];
    if (abonos.length && (abonos.length > 1 || saldo > 0)) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
      doc.text("Historial de Abonos", margin, y);
      y += 8;
      doc.autoTable({
        startY: y, margin: { left: margin, right: margin },
        head: [["Fecha", "Monto Abonado", "Método de Pago"]],
        body: abonos.map(function (a) { return [new Date(a.fecha).toLocaleDateString("es-CO"), fmtMoneda(a.monto), METODO_PAGO_LABEL[a.metodoPago] || a.metodoPago || "—"]; }),
        theme: "grid", styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [247, 248, 250], textColor: 40, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" } }
      });
      y = doc.lastAutoTable.finalY + 14;
    }

    // ---- Insignia de estado ---------------------------------------------
    // Nunca uses ✓/★/≈ ni ningún carácter fuera de WinAnsi dentro de
    // doc.text()/autoTable — las fuentes base de jsPDF (Helvetica) no las
    // soportan y el texto sale corrupto (ver el mismo problema ya
    // corregido con "≈" en catalog.js). El círculo relleno de abajo hace
    // el mismo trabajo visual de "insignia" sin depender de ningún glifo.
    // Un cargo a convenio (crédito) usa tono azul en vez de verde, y un
    // abono con saldo pendiente usa naranja — ninguno de los dos fue un
    // pago completo recibido, así que la insignia no debe leerse como tal.
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    var badgeTxt = saldo > 0
      ? (tieneCopago ? "ABONO DEL COPAGO REGISTRADO — SALDO PENDIENTE" : "ABONO REGISTRADO — SALDO PENDIENTE")
      : tieneCopago ? "COPAGO CONFIRMADO — RESTO A CRÉDITO DEL CONVENIO"
      : esCredito ? "CARGO A CONVENIO — CRÉDITO"
      : "PAGO CONFIRMADO";
    var badgeColor = saldo > 0 ? [217, 119, 6] : esCredito ? [37, 99, 235] : [11, 138, 74];
    var badgeFill = saldo > 0 ? [253, 237, 213] : esCredito ? [224, 234, 250] : [224, 246, 234];
    var badgeW = doc.getTextWidth(badgeTxt) + 40, badgeH = 20;
    doc.setFillColor(badgeFill[0], badgeFill[1], badgeFill[2]); doc.setDrawColor(badgeColor[0], badgeColor[1], badgeColor[2]); doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, badgeW, badgeH, badgeH / 2, badgeH / 2, "FD");
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.circle(margin + 16, y + badgeH / 2, 3, "F");
    doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.text(badgeTxt, margin + 26, y + 13.5);
    y += badgeH + 22;

    // ---- Nota legal y pie de página -------------------------------------
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
    doc.text(saldo > 0
      ? "Este recibo certifica el abono recibido a la fecha; queda un saldo pendiente de " + fmtMoneda(saldo) + " por esta orden. Conserva este documento para cualquier reclamación relacionada."
      : tieneCopago
      ? "Este recibo certifica la recepción del copago del paciente; el saldo restante queda a cargo del convenio indicado arriba, a crédito. Conserva este documento para cualquier reclamación relacionada."
      : esCredito
      ? "Este documento certifica el cargo a crédito de los exámenes de esta orden en la cuenta del convenio indicado arriba. Conserva este documento para cualquier reclamación relacionada."
      : "Este recibo certifica la recepción del pago correspondiente a los exámenes de esta orden. Conserva este documento para cualquier reclamación relacionada con tu compra.", margin, y, { maxWidth: pageW - margin * 2 });

    doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_RECIBO_ORDEN = { buildReciboOrdenPDF: buildReciboOrdenPDF, numeroRecibo: numeroRecibo, fmtMoneda: fmtMoneda, METODO_PAGO_LABEL: METODO_PAGO_LABEL };
})(window);

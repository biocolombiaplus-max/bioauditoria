/* BIOsoft — "Factura Estilo Clásico": un segundo formato de Recibo de
   Pago, opcional (tenant.formatoFactura === "clasica", ver Configuración
   → Operación), pensado para laboratorios que quieren un documento con la
   organización de una factura de venta tradicional — código, descripción,
   precio, cantidad e importe por examen, más Subtotal/Descuento/Impuesto/
   Total/Abono/Saldo y un N° de Factura consecutivo — en vez del Recibo de
   Pago normal de BIOsoft (pdf-recibo-orden.js).

   OJO: esto reproduce la ORGANIZACIÓN VISUAL de una factura de "Forma
   Libre" venezolana (RIF, N° de Factura, N° de Control), pero con los
   datos reales del laboratorio que la genera — nunca inventa un número de
   autorización de imprenta ni ninguna otra credencial fiscal que BIOsoft
   no tiene forma de verificar. El "N° de Control" que se ve aquí es solo
   el consecutivo interno de BIOsoft (S.facturacion.nextNumeroFactura),
   igual que ya usa el módulo de Facturación y RIPS de Colombia — cada
   laboratorio sigue siendo responsable de cumplir la normativa fiscal de
   su país para que este documento tenga validez tributaria. */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
  function fmtMoneda(n) {
    n = n || 0;
    var dec = Math.round(n) === n ? 0 : 2;
    return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
  }
  function fmtFecha(iso) { return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function nombrePaciente(pac) {
    if (!pac) return "—";
    return window.BIO_UI ? window.BIO_UI.nombreCompleto(pac) : [pac.primerNombre, pac.segundoNombre, pac.primerApellido, pac.segundoApellido].filter(Boolean).join(" ");
  }

  /* factura: { numero, fecha (ISO), filas: [{codigo, descripcion, precio,
     cantidad}], descuento, impuesto, abono, observaciones }. Las mismas
     filas ya traen precio y cantidad EDITADOS por quien generó la
     factura (ver abrirEditorFacturaClasica en views-orders.js) — este
     archivo solo calcula importe = precio*cantidad y los totales. */
  function buildFacturaClasicaPDF(order, pac, tenant, factura) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 40;
    var rgb = hexToRgb(tenant.colorPrimario);
    var rgbNaranja = [217, 119, 6];

    // ---- Encabezado: logo/nombre a la izquierda, RIF + datos + N° de
    // Factura a la derecha, igual que una factura de imprenta tradicional
    // (nombre grande de la empresa a un lado, caja de identificación
    // fiscal y número de documento al otro). ------------------------------
    var y = margin;
    var colIzqW = pageW - margin * 2 - 190;
    if (tenant.logoDataUrl) {
      try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 4, 50, 50); } catch (e) {}
    }
    var xNombre = margin + (tenant.logoDataUrl ? 62 : 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    var lineasNombre = doc.splitTextToSize(tenant.nombre || "", colIzqW - (tenant.logoDataUrl ? 62 : 0));
    doc.text(lineasNombre, xNombre, y + 14);
    var yNombre = y + 14 + (lineasNombre.length - 1) * 18;
    if (tenant.slogan) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text(tenant.slogan, xNombre, yNombre + 14);
    }

    var xCajaRif = pageW - margin - 190, wCajaRif = 190;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1);
    doc.roundedRect(xCajaRif, y - 4, wCajaRif, 20, 3, 3);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 64, 175);
    doc.text(C.documentoTributarioLabel(tenant.pais) + ": " + (tenant.nit || "—"), xCajaRif + wCajaRif / 2, y + 10, { align: "center" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    var lineasDireccion = doc.splitTextToSize(tenant.direccion || "", wCajaRif);
    doc.text(lineasDireccion, xCajaRif + wCajaRif, y + 26, { align: "right" });
    var yContacto = y + 26 + lineasDireccion.length * 10;
    var contacto = [tenant.telefonos ? "Telf.: " + tenant.telefonos : "", tenant.email || ""].filter(Boolean).join("  ·  ");
    if (contacto) { doc.text(contacto, xCajaRif + wCajaRif, yContacto, { align: "right" }); yContacto += 10; }

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(rgbNaranja[0], rgbNaranja[1], rgbNaranja[2]);
    doc.text("FACTURA Nº " + String(factura.numero).padStart(6, "0"), xCajaRif + wCajaRif, yContacto + 12, { align: "right" });

    y = Math.max(yNombre + 22, yContacto + 24) + 8;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.4);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    // ---- Datos del cliente / de la orden, en dos columnas ----------------
    var col1 = margin, col2 = pageW / 2 + 10;
    var nombreCliente = order.convenioNombre || nombrePaciente(pac);
    var left = [
      ["Nombre:", nombreCliente],
      ["Dirección:", (pac && pac.direccion) || "—"],
      ["Teléfono:", (pac && (pac.celular || pac.telefono)) || "—"]
    ];
    // La etiqueta de este campo es la del DOCUMENTO PERSONAL del cliente
    // (cédula/DNI/etc.), no la del RIF/NIT de una empresa — por eso no se
    // reutiliza C.documentoTributarioLabel() aquí (esa es para el RIF del
    // laboratorio, en la caja de arriba). Se deja "Cédula/RIF" tal como
    // aparece en el formato clásico venezolano porque un cliente puede
    // identificarse con cualquiera de los dos.
    var right = [
      ["Cédula/RIF:", pac ? (pac.tipoDocumento + " " + pac.numeroDocumento) : "—"],
      ["Fecha:", fmtFecha(factura.fecha)],
      ["N° de Orden:", String(order.numeroOrden)],
      ["Paciente:", nombrePaciente(pac)]
    ];
    doc.setFontSize(9);
    var filasInfo = Math.max(left.length, right.length);
    doc.setFont("helvetica", "bold");
    left.forEach(function (row, i) {
      doc.setTextColor(30, 30, 30); doc.text(row[0], col1, y + i * 14);
      var offset = Math.max(60, doc.getTextWidth(row[0]) + 8);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col1 + offset, y + i * 14, { maxWidth: col2 - col1 - offset - 12 });
      doc.setFont("helvetica", "bold");
    });
    right.forEach(function (row, i) {
      doc.setTextColor(30, 30, 30); doc.text(row[0], col2, y + i * 14);
      var offsetR = doc.getTextWidth(row[0]) + 8;
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col2 + offsetR, y + i * 14, { maxWidth: pageW - margin - col2 - offsetR });
      doc.setFont("helvetica", "bold");
    });
    y += filasInfo * 14 + 16;

    // ---- Tabla CÓDIGO / DESCRIPCIÓN / PRECIO / CANT. / IMPORTE -----------
    var filas = factura.filas.map(function (f) {
      var importe = (f.precio || 0) * (f.cantidad || 0);
      return { codigo: f.codigo, descripcion: f.descripcion, precio: f.precio, cantidad: f.cantidad, importe: importe };
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Código", "Descripción del Examen", "Precio", "Cant.", "Importe"]],
      body: filas.map(function (f) { return [f.codigo || "—", f.descripcion, fmtMoneda(f.precio), String(f.cantidad), fmtMoneda(f.importe)]; }),
      theme: "grid", styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 55 }, 2: { halign: "right", cellWidth: 70 }, 3: { halign: "center", cellWidth: 40 }, 4: { halign: "right", cellWidth: 75 } }
    });
    y = doc.lastAutoTable.finalY + 18;

    // ---- Tira de totales: Subtotal / Descuento / Impuesto / Total a
    // Pagar / Abono / Saldo, como una factura de venta tradicional. -------
    var subtotal = filas.reduce(function (a, f) { return a + f.importe; }, 0);
    var descuento = factura.descuento || 0;
    var impuesto = factura.impuesto || 0;
    var totalPagar = Math.max(0, subtotal - descuento + impuesto);
    var abono = factura.abono != null ? factura.abono : totalPagar;
    var saldo = Math.max(0, totalPagar - abono);
    var etiquetas = ["Subtotal", "Descuento", "Impuesto", "Total a Pagar", "Abono", "Saldo"];
    var valores = [subtotal, descuento, impuesto, totalPagar, abono, saldo];
    var wTotales = pageW - margin * 2, colW = wTotales / etiquetas.length, hTotales = 34;
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.7);
    doc.rect(margin, y, wTotales, hTotales);
    for (var i = 0; i < etiquetas.length; i++) {
      var cx = margin + colW * i;
      if (i > 0) doc.line(cx, y, cx, y + hTotales);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
      doc.text(etiquetas[i], cx + colW / 2, y + 12, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.setTextColor(i === 3 ? rgb[0] : 30, i === 3 ? rgb[1] : 30, i === 3 ? rgb[2] : 30);
      doc.text(fmtMoneda(valores[i]), cx + colW / 2, y + 26, { align: "center" });
    }
    y += hTotales + 16;

    // ---- Observaciones ----------------------------------------------------
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    doc.text("Observaciones:", margin, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
    var lineasObs = doc.splitTextToSize(factura.observaciones || "—", pageW - margin * 2 - 78);
    doc.text(lineasObs, margin + 78, y);
    y += Math.max(14, lineasObs.length * 11) + 22;

    // ---- Firma y N° de Control ---------------------------------------------
    doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.7);
    doc.line(margin, y, margin + 180, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    doc.text("Firma y sello", margin, y + 12);

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("N° DE CONTROL " + String(factura.numero).padStart(8, "0"), pageW - margin, y - 4, { align: "right" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ". Sin tachaduras ni enmiendas.", margin, 770, { maxWidth: pageW - margin * 2 });

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_FACTURA_CLASICA = { buildFacturaClasicaPDF: buildFacturaClasicaPDF, fmtMoneda: fmtMoneda };
})(window);

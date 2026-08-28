/* BIOsoft — Consentimiento Informado para Toma de Muestras de Laboratorio
   Clínico, conforme a la Resolución 3100 de 2019 (Colombia). Documento de
   una sola hoja carta, con la marca del laboratorio y las firmas (paciente
   o representante legal, y quien toma la muestra) incrustadas como imagen.

   Recibe el propio registro de "consentimiento" ya con todos los datos que
   necesita (tenantNombre, pacienteNombre, numeroOrden, etc. — ver
   store.js/views-consentimientos.js) en vez de objetos separados de orden/
   paciente/tenant, para poder generarse igual desde dentro de la app o
   desde la página pública de firma remota (firmar.html), que solo tiene
   acceso a ese único documento (por diseño de seguridad — ver
   firestore.rules). */
(function (global) {
  "use strict";
  var C = typeof BIO_CATALOG !== "undefined" ? BIO_CATALOG : null;
  var T = BIO_CONSENTIMIENTO_TEXTO;
  var RELACION_LABEL = { paciente: "Paciente", representante: "Representante Legal / Padre-Madre", testigo: "Testigo a Ruego (paciente no puede firmar)" };

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
  function docTributarioLabel(pais) {
    if (C && C.documentoTributarioLabel) return C.documentoTributarioLabel(pais);
    return pais === "VE" ? "RIF" : pais === "EC" ? "RUC" : "NIT";
  }
  function buildQrDataUrl(texto, sizePx) {
    if (!window.qrcode) return null;
    try {
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
    } catch (e) { return null; }
  }

  function encabezado(doc, c) {
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 42;
    var y = margin;
    var rgb = hexToRgb(c.tenantColorPrimario);
    if (c.tenantLogoDataUrl) {
      try { doc.addImage(c.tenantLogoDataUrl, "PNG", margin, y - 6, 46, 46); } catch (e) {}
    }
    var textX = margin + (c.tenantLogoDataUrl ? 56 : 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(c.tenantNombre || "", textX, y + 9);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(docTributarioLabel(c.tenantPais) + " " + (c.tenantNit || "—") + (c.tenantCodigoREPS ? " · Código REPS " + c.tenantCodigoREPS : ""), textX, y + 22);
    doc.text((c.tenantDireccion || "") + (c.tenantTelefonos ? " · " + c.tenantTelefonos : ""), textX, y + 33);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.8);
    y += 48; doc.line(margin, y, pageW - margin, y); y += 18;
    return { margin: margin, pageW: pageW, y: y, rgb: rgb };
  }

  // Banda de color a todo lo ancho, usada como título de documento y luego
  // como separador antes del bloque de firmas — le da al PDF la estructura
  // de secciones marcadas que tiene un documento clínico "de verdad", en
  // vez de un bloque de texto corrido de arriba a abajo.
  function banda(doc, x, y, w, h, rgb, textoIzq, textoDer) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y, w, h, "F");
    doc.setTextColor(255, 255, 255);
    if (textoIzq) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11.5);
      doc.text(textoIzq, x + 12, y + h / 2 + 4);
    }
    if (textoDer) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(textoDer, x + w - 12, y + h / 2 + 3, { align: "right" });
    }
  }

  function dibujarFirma(doc, x, y0, w, h, titulo, firmaDataUrl, nombre, documento, relacionLabel, fecha, rgb) {
    // Bloque de texto (badge/línea/título/nombre/detalle) anclado al PISO de
    // la caja con una altura fija (36pt) — lo que varía con h es solo el
    // espacio disponible arriba para la imagen de la firma, así una caja
    // más baja (cuando el texto legal quedó largo) no hace que el badge
    // "FIRMADO" se monte sobre la imagen.
    var pieH = 36, imgH = Math.max(20, h - pieH - 10);
    doc.setFillColor(250, 250, 251);
    doc.setDrawColor(215, 215, 220); doc.setLineWidth(0.8);
    doc.roundedRect(x, y0, w, h, 4, 4, "FD");
    if (firmaDataUrl) {
      try { doc.addImage(firmaDataUrl, "PNG", x + 8, y0 + 6, w - 16, imgH, undefined, "FAST"); } catch (e) {}
      // Sin "✓": ese glifo está fuera de WinAnsi y las fuentes base de
      // jsPDF (Helvetica) lo renderizan corrupto — ver el mismo problema
      // en pdf-recibo-orden.js.
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(11, 138, 74);
      doc.text("FIRMADO ELECTRÓNICAMENTE", x + w / 2, y0 + h - pieH + 3, { align: "center" });
    } else {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(170, 170, 170);
      doc.text("Pendiente de firma", x + w / 2, y0 + 6 + imgH / 2, { align: "center" });
    }
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(0.9);
    doc.line(x + 14, y0 + h - pieH + 10, x + w - 14, y0 + h - pieH + 10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(25, 25, 25);
    doc.text(titulo, x + w / 2, y0 + h - pieH + 20, { align: "center", maxWidth: w - 16 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); doc.setTextColor(90, 90, 90);
    doc.text(nombre ? nombre + (documento ? " — " + documento : "") : "—", x + w / 2, y0 + h - 12, { align: "center", maxWidth: w - 16 });
    var linea3 = (relacionLabel || "") + (fecha ? (relacionLabel ? " · " : "") + fecha : "");
    if (linea3) { doc.setFontSize(7); doc.text(linea3, x + w / 2, y0 + h - 3, { align: "center", maxWidth: w - 16 }); }
  }

  // Cada párrafo del texto legal viene con un prefijo tipo "1. RIESGOS...:"
  // (ver consentimiento-texto.js) — se resalta ese prefijo en negrita y
  // color de marca, EN LA MISMA línea donde arranca el cuerpo del párrafo
  // (en vez de en su propia línea aparte), para que el documento tenga
  // jerarquía visual sin gastar una línea completa por cada título — así
  // el texto legal completo cabe siempre en una sola hoja.
  function dibujarParrafo(doc, parrafo, x, y, maxW, rgb) {
    var fontSize = 8.6, lineH = 10.6;
    var m = /^(\d+\.\s*[^:]+:|DECLARACIÓN:)\s*([\s\S]*)$/.exec(parrafo);
    if (!m) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(fontSize); doc.setTextColor(95, 95, 95);
      var lineasIntro = doc.splitTextToSize(parrafo, maxW);
      doc.text(lineasIntro, x, y);
      return y + lineasIntro.length * lineH + 8;
    }
    var label = m[1], body = m[2];
    doc.setFont("helvetica", "bold"); doc.setFontSize(fontSize); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    var labelW = doc.getTextWidth(label + " ");
    doc.text(label, x, y);

    doc.setFont("helvetica", "normal"); doc.setTextColor(45, 45, 45);
    var palabras = body.split(" ");
    var lineas = [], lineaActual = "", anchoDisponible = maxW - labelW;
    palabras.forEach(function (palabra) {
      var probe = lineaActual ? lineaActual + " " + palabra : palabra;
      if (doc.getTextWidth(probe) > anchoDisponible && lineaActual) {
        lineas.push(lineaActual);
        lineaActual = palabra;
        anchoDisponible = maxW; // desde la 2ª línea, ya no hay etiqueta que descuente ancho
      } else {
        lineaActual = probe;
      }
    });
    if (lineaActual) lineas.push(lineaActual);

    if (lineas.length) doc.text(lineas[0], x + labelW, y);
    for (var i = 1; i < lineas.length; i++) doc.text(lineas[i], x, y + i * lineH);
    return y + Math.max(lineas.length, 1) * lineH + 8;
  }

  function buildConsentimientoPDF(c) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, c);
    var margin = ctx.margin, pageW = ctx.pageW, y = ctx.y, rgb = ctx.rgb;
    var maxW = pageW - margin * 2;

    var numero = "CI-" + new Date(c.creadoEn).getFullYear() + "-" + String(c.id).slice(-6).toUpperCase();
    var texto = T.buildTextoConsentimiento(c.tenantNombre, c.procedimiento, (c.examenes || []).map(function (e) { return e.nombre; }));

    banda(doc, margin, y, maxW, 30, rgb, texto.titulo, "N° " + numero);
    y += 30 + 16;

    // -------- Datos del paciente y la orden, en una tarjeta clara --------
    var cardH = 54;
    doc.setFillColor(247, 248, 250); doc.setDrawColor(226, 228, 233); doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, maxW, cardH, 5, 5, "FD");
    var col1 = margin + 14, col2 = margin + maxW / 2 + 6;
    var filas = [
      [["Paciente:", c.pacienteNombre || "—"], ["Documento:", c.pacienteDocumento || "—"]],
      [["N° de Orden:", c.numeroOrden || "—"], ["Fecha:", new Date(c.creadoEn).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })]]
    ];
    filas[0].forEach(function (row, i) {
      var yy = y + 20 + i * 20;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.8); doc.setTextColor(90, 90, 90);
      doc.text(row[0], col1, yy);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
      doc.text(String(row[1]), col1 + 66, yy, { maxWidth: col2 - col1 - 76 });
    });
    filas[1].forEach(function (row, i) {
      var yy = y + 20 + i * 20;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.8); doc.setTextColor(90, 90, 90);
      doc.text(row[0], col2, yy);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
      doc.text(String(row[1]), col2 + 66, yy, { maxWidth: margin + maxW - (col2 + 66) });
    });
    y += cardH + 20;

    // -------- Cuerpo legal, con mini-títulos resaltados por párrafo --------
    texto.parrafos.forEach(function (parrafo) {
      y = dibujarParrafo(doc, parrafo, margin, y, maxW, rgb);
    });

    y += 6;
    banda(doc, margin, y, maxW, 22, rgb, "DECLARACIÓN Y FIRMAS", "");
    y += 22 + 16;

    // Si un texto legal inusualmente largo (muchos exámenes, riesgos
    // extensos) dejó poco espacio libre, las cajas de firma se achican un
    // poco en vez de desbordar la hoja — el documento sigue siendo de una
    // sola página siempre.
    var firmaH = y > 640 ? 74 : 96;
    var wFirma = (maxW - 18) / 2;
    dibujarFirma(doc, margin, y, wFirma, firmaH, "Firma del Paciente / Representante Legal",
      c.firmaPacienteDataUrl, c.nombreFirmante, c.documentoFirmante,
      RELACION_LABEL[c.relacionFirmante] || "", c.fechaFirma ? new Date(c.fechaFirma).toLocaleDateString("es-CO") : "", rgb);
    dibujarFirma(doc, margin + wFirma + 18, y, wFirma, firmaH, "Firma de quien toma la muestra",
      c.firmaProfesionalDataUrl, c.nombreProfesional, "", "",
      c.firmaProfesionalDataUrl ? new Date(c.creadoEn).toLocaleDateString("es-CO") : "", rgb);
    var firmaBottom = y + firmaH;

    // -------- QR de verificación + pie de página --------
    var qrTexto = "BIOsoft | Consentimiento Informado\n" +
      "Laboratorio: " + (c.tenantNombre || "") +
      "\nPaciente: " + (c.pacienteNombre || "") +
      "\nDocumento: " + (c.pacienteDocumento || "") +
      "\nOrden: " + (c.numeroOrden || "") +
      "\nN° Consentimiento: " + numero +
      "\nVálido si coincide con el paciente y el número de orden.";
    var qrDataUrl = buildQrDataUrl(qrTexto, 220);
    var footerY = Math.max(firmaBottom + 26, 745);
    if (qrDataUrl) {
      var qrSize = 50;
      try { doc.addImage(qrDataUrl, "PNG", pageW - margin - qrSize, footerY - qrSize - 4, qrSize, qrSize); } catch (e) {}
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.6);
      doc.rect(pageW - margin - qrSize - 2, footerY - qrSize - 6, qrSize + 4, qrSize + 4);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft el " + new Date().toLocaleString("es-CO") + ".\nConsentimiento informado según Resolución 3100 de 2019, Ley 23 de 1981 y Ley 1581 de 2012.", margin, footerY - 14, { maxWidth: maxW - (qrDataUrl ? 70 : 0) });

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CONSENTIMIENTO = { buildConsentimientoPDF: buildConsentimientoPDF };
})(window);

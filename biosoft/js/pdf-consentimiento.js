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

  function encabezado(doc, c) {
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 40;
    var y = margin;
    var rgb = hexToRgb(c.tenantColorPrimario);
    if (c.tenantLogoDataUrl) {
      try { doc.addImage(c.tenantLogoDataUrl, "PNG", margin, y - 6, 40, 40); } catch (e) {}
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(c.tenantNombre || "", margin + (c.tenantLogoDataUrl ? 50 : 0), y + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    doc.text(docTributarioLabel(c.tenantPais) + " " + (c.tenantNit || "—") + (c.tenantCodigoREPS ? " · Código REPS " + c.tenantCodigoREPS : ""), margin + (c.tenantLogoDataUrl ? 50 : 0), y + 20);
    doc.text((c.tenantDireccion || "") + (c.tenantTelefonos ? " · " + c.tenantTelefonos : ""), margin + (c.tenantLogoDataUrl ? 50 : 0), y + 30);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.6);
    y += 44; doc.line(margin, y, pageW - margin, y); y += 16;
    return { margin: margin, pageW: pageW, y: y, rgb: rgb };
  }

  function dibujarFirma(doc, x, y0, w, titulo, firmaDataUrl, nombre, documento, relacionLabel, fecha) {
    var h = 66;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.7);
    doc.rect(x, y0, w, h);
    if (firmaDataUrl) {
      try { doc.addImage(firmaDataUrl, "PNG", x + 6, y0 + 4, w - 12, 34, undefined, "FAST"); } catch (e) {}
    } else {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(160, 160, 160);
      doc.text("Pendiente de firma", x + w / 2, y0 + 24, { align: "center" });
    }
    doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.5);
    doc.line(x + 8, y0 + 42, x + w - 8, y0 + 42);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(30, 30, 30);
    doc.text(titulo, x + w / 2, y0 + 51, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
    doc.text(nombre ? nombre + (documento ? " — " + documento : "") : "—", x + w / 2, y0 + 59, { align: "center", maxWidth: w - 10 });
    var linea3 = (relacionLabel || "") + (fecha ? (relacionLabel ? " · " : "") + fecha : "");
    if (linea3) doc.text(linea3, x + w / 2, y0 + 65, { align: "center", maxWidth: w - 10 });
  }

  function buildConsentimientoPDF(c) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, c);
    var margin = ctx.margin, pageW = ctx.pageW, y = ctx.y;

    var numero = "CI-" + new Date(c.creadoEn).getFullYear() + "-" + String(c.id).slice(-6).toUpperCase();
    var texto = T.buildTextoConsentimiento(c.tenantNombre, c.procedimiento, (c.examenes || []).map(function (e) { return e.nombre; }));
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 20, 20);
    var tituloLines = doc.splitTextToSize(texto.titulo, pageW - margin * 2 - 110);
    doc.text(tituloLines, margin, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(ctx.rgb[0], ctx.rgb[1], ctx.rgb[2]);
    doc.text("N° " + numero, pageW - margin, y, { align: "right" });
    y += tituloLines.length * 13 + 10;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
    var col1 = margin, col2 = pageW / 2 + 6;
    var left = [["Paciente:", c.pacienteNombre || "—"], ["Documento:", c.pacienteDocumento || "—"]];
    var right = [["N° de Orden:", c.numeroOrden || "—"], ["Fecha:", new Date(c.creadoEn).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })]];
    left.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], col1, y + i * 12);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col1 + 60, y + i * 12, { maxWidth: col2 - col1 - 66 });
    });
    right.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], col2, y + i * 12);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col2 + 70, y + i * 12, { maxWidth: pageW - margin - (col2 + 70) });
    });
    y += left.length * 12 + 12;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor(35, 35, 35);
    var maxW = pageW - margin * 2;
    texto.parrafos.forEach(function (parrafo) {
      var lines = doc.splitTextToSize(parrafo, maxW);
      doc.text(lines, margin, y);
      y += lines.length * 10.3 + 4;
    });

    y += 10;
    var wFirma = (pageW - margin * 2 - 16) / 2;
    dibujarFirma(doc, margin, y, wFirma, "Firma del Paciente / Representante Legal",
      c.firmaPacienteDataUrl, c.nombreFirmante, c.documentoFirmante,
      RELACION_LABEL[c.relacionFirmante] || "", c.fechaFirma ? new Date(c.fechaFirma).toLocaleDateString("es-CO") : "");
    dibujarFirma(doc, margin + wFirma + 16, y, wFirma, "Firma de quien toma la muestra",
      c.firmaProfesionalDataUrl, c.nombreProfesional, "", "",
      c.firmaProfesionalDataUrl ? new Date(c.creadoEn).toLocaleDateString("es-CO") : "");
    y += 78;

    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft el " + new Date().toLocaleString("es-CO") + ". Consentimiento informado según Resolución 3100 de 2019, Ley 23 de 1981 y Ley 1581 de 2012.", margin, y, { maxWidth: pageW - margin * 2 });

    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CONSENTIMIENTO = { buildConsentimientoPDF: buildConsentimientoPDF };
})(window);

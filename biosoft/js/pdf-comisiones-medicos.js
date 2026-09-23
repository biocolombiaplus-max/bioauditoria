/* BIOsoft — Reporte profesional en PDF de Comisiones a Médicos
   Remitentes: cuánto se le debe pagar a cada médico externo que remitió
   pacientes al laboratorio en un periodo, según la tarifa configurada
   para cada uno (ver "Médicos Remitentes" en Administración) — fija por
   orden, fija por examen, o un porcentaje del valor de la orden. Sigue el
   mismo lenguaje visual que pdf-cartera.js (encabezado, tarjetas de
   totales y pie de página). */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;
  var PAGE_BOTTOM = 730;

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
  function fmtMoneda(n) {
    n = n || 0;
    var dec = Math.round(n) === n ? 0 : 2;
    return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
  }
  function fmtFecha(iso) { return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); }

  function encabezado(doc, tenant, titulo) {
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
    var metaLines = [C.documentoTributarioLabel(tenant.pais) + " " + (tenant.nit || "—"), (tenant.direccion || "") + (tenant.telefonos ? " · " + tenant.telefonos : "")];
    metaLines.forEach(function (line, i) { doc.text(line, margin + (tenant.logoDataUrl ? 56 : 0), y + 22 + i * 10); });

    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
    y += 62; doc.line(margin, y, pageW - margin, y); y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text(titulo, margin, y);
    y += 10;
    return { margin: margin, pageW: pageW, y: y, rgb: rgb };
  }

  function piePagina(doc, margin) {
    var totalPaginas = doc.internal.getNumberOfPages();
    for (var i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
      doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 770);
      doc.text("Página " + i + " de " + totalPaginas, doc.internal.pageSize.getWidth() - margin, 770, { align: "right" });
    }
  }

  var TARIFA_LABEL = { fijo_orden: "Fijo por orden", fijo_examen: "Fijo por examen", porcentaje: "% del valor" };

  /* Una tarjeta compacta por médico, con cuántas órdenes remitió y el
     total de comisión a pagarle — el primer vistazo de "cuánto le debo a
     cada quién" antes de entrar al detalle. */
  function tarjetaMedico(doc, x, y, w, rgb, medico, totalComision, numOrdenes) {
    var h = 40;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
    doc.roundedRect(x, y, w, h, 4, 4, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
    doc.text(medico.nombre + " (" + numOrdenes + " orden" + (numOrdenes === 1 ? "" : "es") + ")", x + 12, y + 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(TARIFA_LABEL[medico.tipoTarifa] || "—", x + 12, y + 28);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(fmtMoneda(totalComision), x + w - 12, y + 25, { align: "right" });
    return y + h;
  }

  function tablaOrdenes(doc, y, margin, pageW, filasMedico) {
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Fecha", "N° Orden", "Paciente", "N° Exámenes", "Valor Orden", "Comisión"]],
      body: filasMedico.map(function (f) { return [fmtFecha(f.fecha), f.numeroOrden, f.paciente, f.numExamenes, fmtMoneda(f.valorCobrar), fmtMoneda(f.comision)]; }),
      theme: "striped", styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } }
    });
    return doc.lastAutoTable.finalY + 20;
  }

  /* filas: [{ numeroOrden, fecha (ISO), paciente, medicoId, medicoNombre,
     numExamenes, valorCobrar, comision }]. medicosPorId: mapa id -> médico
     (para leer su tipoTarifa/nombre incluso si ya no está activo).
     medicoNombreFiltro (opcional): si el reporte ya viene filtrado a un
     solo médico, se muestra en el título. */
  function buildComisionesMedicosPDF(filas, medicosPorId, tenant, desde, hasta, medicoNombreFiltro) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "COMISIONES A MÉDICOS REMITENTES" + (medicoNombreFiltro ? " — " + medicoNombreFiltro.toUpperCase() : ""));
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta) + "   ·   Según la orden en la que quedó registrado cada médico (\"Médico Remitente\" al crear la orden)", margin, y, { maxWidth: pageW - margin * 2 });
    y += 24;

    if (!filas.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text("No hay órdenes remitidas por un médico registrado en este periodo.", margin, y);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    var porMedico = {};
    var ordenMedicos = [];
    filas.forEach(function (f) {
      if (!porMedico[f.medicoId]) { porMedico[f.medicoId] = []; ordenMedicos.push(f.medicoId); }
      porMedico[f.medicoId].push(f);
    });
    ordenMedicos.sort(function (a, b) { return (medicosPorId[a] ? medicosPorId[a].nombre : "").localeCompare(medicosPorId[b] ? medicosPorId[b].nombre : ""); });

    var totalGeneral = filas.reduce(function (a, f) { return a + f.comision; }, 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text("TOTAL A PAGAR EN EL PERIODO: " + fmtMoneda(totalGeneral), pageW - margin, y, { align: "right" });
    y += 22;

    ordenMedicos.forEach(function (medicoId) {
      var filasMedico = porMedico[medicoId];
      var medico = medicosPorId[medicoId] || { nombre: "(médico eliminado)", tipoTarifa: "" };
      var totalComision = filasMedico.reduce(function (a, f) { return a + f.comision; }, 0);
      var altoEstimado = 40 + 22 + (filasMedico.length + 1) * 16;
      if (y + Math.min(altoEstimado, 200) > PAGE_BOTTOM) { doc.addPage(); y = margin; }
      y = tarjetaMedico(doc, margin, y, pageW - margin * 2, rgb, medico, totalComision, filasMedico.length) + 14;
      y = tablaOrdenes(doc, y, margin, pageW, filasMedico);
    });

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_COMISIONES_MEDICOS = {
    buildComisionesMedicosPDF: buildComisionesMedicosPDF,
    fmtMoneda: fmtMoneda
  };
})(window);

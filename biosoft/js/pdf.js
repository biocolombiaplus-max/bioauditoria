/* BIOsoft — Generación de reportes PDF profesionales */
(function (global) {
  "use strict";
  var U = BIO_UI, C = BIO_CATALOG;

  function buildResultadosPDF(order, patient, tenant, modo) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 40;
    var y = margin;
    var primary = tenant.colorPrimario || "#0b6e4f";

    function hexToRgb(hex) {
      hex = hex.replace("#", "");
      return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
    }
    var rgb = hexToRgb(primary);

    // Encabezado
    if (tenant.logoDataUrl) {
      try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 6, 46, 46); } catch (e) {}
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(tenant.nombre, margin + (tenant.logoDataUrl ? 56 : 0), y + 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    var metaLines = [
      "NIT " + tenant.nit + (tenant.codigoREPS ? " · Código REPS " + tenant.codigoREPS : ""),
      tenant.direccion + " · " + tenant.telefonos,
      tenant.email + (tenant.sitioWeb ? " · " + tenant.sitioWeb : ""),
      tenant.resolucionHabilitacion || ""
    ];
    metaLines.forEach(function (line, i) { doc.text(line, margin + (tenant.logoDataUrl ? 56 : 0), y + 22 + i * 10); });

    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
    y += 62; doc.line(margin, y, pageW - margin, y); y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text("INFORME DE RESULTADOS DE LABORATORIO CLÍNICO", margin, y);
    if (modo === "preliminar") {
      doc.setTextColor(201, 126, 13); doc.setFontSize(10);
      doc.text("RESULTADO PRELIMINAR — SUJETO A VALIDACIÓN FINAL", pageW - margin, y, { align: "right" });
    } else if (order.estadoGeneral !== "validado") {
      doc.setTextColor(201, 126, 13); doc.setFontSize(10);
      doc.text("INFORME PARCIAL — HAY EXÁMENES EN PROCESO", pageW - margin, y, { align: "right" });
    }
    y += 20;

    // Datos paciente
    doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal");
    var edad = U.calcEdad(patient.fechaNacimiento);
    var col1 = margin, col2 = pageW / 2 + 10;
    var left = [
      ["Paciente:", U.nombreCompleto(patient)],
      ["Documento:", patient.tipoDocumento + " " + patient.numeroDocumento],
      ["Edad / Sexo:", edad + " / " + patient.sexo],
      ["EPS / Asegurador:", patient.eps || "Particular"]
    ];
    var right = [
      ["N° de Orden:", order.numeroOrden],
      ["Fecha de Orden:", U.fmtFecha(order.fechaOrden)],
      ["Médico Remitente:", order.medicoRemitente || "—"],
      ["Procedencia:", order.procedencia || "—"]
    ];
    left.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], col1, y + i * 14);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col1 + 90, y + i * 14);
    });
    right.forEach(function (row, i) {
      doc.setFont("helvetica", "bold"); doc.text(row[0], col2, y + i * 14);
      doc.setFont("helvetica", "normal"); doc.text(String(row[1]), col2 + 90, y + i * 14);
    });
    y += left.length * 14 + 16;

    var examsToShow = order.examenes.filter(function (ex) {
      if (modo === "preliminar") return ex.estado === "preliminar" || ex.estado === "validado";
      return ex.estado === "validado";
    });

    var bySeccion = {};
    examsToShow.forEach(function (ex) { (bySeccion[ex.seccion] = bySeccion[ex.seccion] || []).push(ex); });

    Object.keys(bySeccion).forEach(function (seccionId) {
      if (y > 700) { doc.addPage(); y = margin; }
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(margin, y, pageW - margin * 2, 16, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text(C.seccionNombre(seccionId).toUpperCase(), margin + 6, y + 11);
      y += 24;

      var body = [];
      bySeccion[seccionId].forEach(function (ex) {
        var exCat = C.examenPorId(ex.examId);
        exCat.parametros.forEach(function (p) {
          var val = (ex.valores.filter(function (v) { return v.codigo === p.codigo; })[0] || {}).valor || "-";
          var flag = C.calcularFlag(p, val);
          body.push([exCat.nombre, p.nombre, val + (p.unidad ? " " + p.unidad : ""), p.refText || "", flag || ""]);
        });
      });

      doc.autoTable({
        startY: y, margin: { left: margin, right: margin },
        head: [["Examen", "Parámetro", "Resultado", "Valor de Referencia", "Interpretación"]],
        body: body, theme: "grid", styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
        didParseCell: function (data) {
          if (data.section === "body" && data.column.index === 4) {
            var v = data.cell.raw;
            if (v === "ALTO" || v === "BAJO" || v === "ANORMAL") { data.cell.styles.textColor = [214, 69, 69]; data.cell.styles.fontStyle = "bold"; }
          }
        }
      });
      y = doc.lastAutoTable.finalY + 18;
    });

    if (y > 680) { doc.addPage(); y = margin; }
    doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageW - margin, y); y += 22;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.nombre : "Bacteriólogo(a) Responsable", margin, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(tenant.bacteriologoResponsable ? "Registro Profesional: " + tenant.bacteriologoResponsable.registro : "", margin, y + 12);
    doc.text("Bacteriólogo(a) y Laboratorista Clínico", margin, y + 24);

    doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ". Los resultados deben interpretarse en conjunto con la clínica del paciente.", margin, 760, { maxWidth: pageW - margin * 2 });

    return doc;
  }

  function buildWorksheetFileName(tenant, seccion, fecha) {
    return "Hoja_Trabajo_" + seccion + "_" + fecha + ".pdf";
  }

  function previewOrModal(order, patient, tenant) {
    var hasValidado = order.examenes.some(function (ex) { return ex.estado === "validado"; });
    var hasPreliminar = order.examenes.some(function (ex) { return ex.estado === "preliminar"; });
    if (!hasValidado && !hasPreliminar) { U.toast("Esta orden aún no tiene resultados validados ni preliminares para generar el PDF.", "error"); return; }

    var wrap = U.openModal(
      '<h3 class="modal-title">Informe de Resultados — Orden ' + order.numeroOrden + '</h3>' +
      '<div class="flex gap-2 wrap" style="margin-bottom:12px">' +
      (hasValidado ? '<button class="btn btn-primary btn-sm" id="pv-final">' + U.icon("download") + " Descargar Informe Final</button>" : "") +
      (hasPreliminar ? '<button class="btn btn-outline btn-sm" id="pv-prelim">' + U.icon("download") + " Descargar Informe Preliminar</button>" : "") +
      '<button class="btn btn-ghost btn-sm" data-modal-close>Cerrar</button></div>' +
      '<iframe id="pv-frame" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:8px"></iframe>',
      { lg: true }
    );
    function show(modo) {
      var doc = buildResultadosPDF(order, patient, tenant, modo);
      wrap.querySelector("#pv-frame").src = doc.output("datauristring");
      wrap.dataset.lastDoc = "1";
      wrap.lastDoc = doc;
    }
    show(hasValidado ? "final" : "preliminar");
    var bf = wrap.querySelector("#pv-final"); if (bf) bf.addEventListener("click", function () { show("final"); wrap.lastDoc.save("Resultados_" + order.numeroOrden + "_Final.pdf"); });
    var bp = wrap.querySelector("#pv-prelim"); if (bp) bp.addEventListener("click", function () { show("preliminar"); wrap.lastDoc.save("Resultados_" + order.numeroOrden + "_Preliminar.pdf"); });
  }

  global.BIO_PDF = { buildResultadosPDF: buildResultadosPDF, previewOrModal: previewOrModal, buildWorksheetFileName: buildWorksheetFileName };
})(window);

/* BIOsoft — Generación de reportes PDF profesionales, fusión de informes remitidos y stickers de muestra */
(function (global) {
  "use strict";
  var U = BIO_UI, C = BIO_CATALOG, S = BIO_STORE;

  function hexToRgb(hex) {
    hex = (hex || "#0b6e4f").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }

  function dataUrlToUint8Array(dataUrl) {
    var base64 = dataUrl.split(",")[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function firmantesDe(order, tenant, examsToShow) {
    var ids = [];
    examsToShow.forEach(function (ex) {
      if (ex.estado === "validado" && ex.validadoPorUserId && ids.indexOf(ex.validadoPorUserId) === -1) ids.push(ex.validadoPorUserId);
    });
    var users = S.listUsers(tenant.id);
    var firmantes = ids.map(function (id) { return users.filter(function (u) { return u.id === id; })[0]; }).filter(Boolean);
    if (!firmantes.length) {
      firmantes = [{
        nombre: tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.nombre : "Bacteriólogo(a) Responsable",
        registroProfesional: tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.registro : "",
        firmaDataUrl: ""
      }];
    }
    return firmantes;
  }

  async function buildResultadosPDF(order, patient, tenant, modo) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
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
      var listos = ex.estado === "validado" || ex.estado === "remitido";
      if (modo === "preliminar") return listos || ex.estado === "preliminar";
      return listos;
    });

    var referidos = examsToShow.filter(function (ex) { return ex.estado === "remitido"; });
    var procesados = examsToShow.filter(function (ex) { return ex.estado !== "remitido"; });

    var bySeccion = {};
    procesados.forEach(function (ex) { (bySeccion[ex.seccion] = bySeccion[ex.seccion] || []).push(ex); });

    Object.keys(bySeccion).forEach(function (seccionId) {
      if (y > 700) { doc.addPage(); y = margin; }
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(margin, y, pageW - margin * 2, 16, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text(C.seccionNombre(seccionId).toUpperCase(), margin + 6, y + 11);
      y += 24;

      var body = [];
      bySeccion[seccionId].forEach(function (ex) {
        var exCat = C.examenEfectivo(ex.examId, tenant);
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

    if (referidos.length) {
      if (y > 680) { doc.addPage(); y = margin; }
      doc.setFillColor(90, 90, 90);
      doc.rect(margin, y, pageW - margin * 2, 16, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text("EXÁMENES PROCESADOS POR LABORATORIO DE REFERENCIA", margin + 6, y + 11);
      y += 24;
      doc.autoTable({
        startY: y, margin: { left: margin, right: margin },
        head: [["Examen", "Laboratorio de Referencia", "Nota"]],
        body: referidos.map(function (ex) {
          var exCat = C.examenPorId(ex.examId);
          return [exCat.nombre, ex.laboratorioRemision || "—", "Ver informe original anexo en las páginas siguientes"];
        }),
        theme: "grid", styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" }
      });
      y = doc.lastAutoTable.finalY + 18;
    }

    var firmantes = firmantesDe(order, tenant, examsToShow);
    firmantes.forEach(function (f) {
      if (y > 700) { doc.addPage(); y = margin; }
      if (f.firmaDataUrl) { try { doc.addImage(f.firmaDataUrl, "PNG", margin, y - 30, 110, 38); } catch (e) {} }
      doc.setDrawColor(180, 180, 180); doc.line(margin, y + 10, margin + 190, y + 10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      doc.text(f.nombre, margin, y + 22);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text(f.registroProfesional ? "Registro Profesional: " + f.registroProfesional : "", margin, y + 33);
      doc.text("Bacteriólogo(a) y Laboratorista Clínico", margin, y + 44);
      y += 62;
    });

    doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ". Los resultados deben interpretarse en conjunto con la clínica del paciente.", margin, 770, { maxWidth: pageW - margin * 2 });

    var coverBytes = new Uint8Array(doc.output("arraybuffer"));
    if (!referidos.length) return coverBytes;

    try {
      var PDFDocument = window.PDFLib.PDFDocument;
      var finalDoc = await PDFDocument.load(coverBytes);
      for (var i = 0; i < referidos.length; i++) {
        if (!referidos[i].pdfRemitidoDataUrl) continue;
        var donorBytes = dataUrlToUint8Array(referidos[i].pdfRemitidoDataUrl);
        var donor = await PDFDocument.load(donorBytes);
        var pages = await finalDoc.copyPages(donor, donor.getPageIndices());
        pages.forEach(function (p) { finalDoc.addPage(p); });
      }
      return await finalDoc.save();
    } catch (e) {
      return coverBytes;
    }
  }

  async function previewOrModal(order, patient, tenant) {
    var hasFinal = order.examenes.some(function (ex) { return ex.estado === "validado" || ex.estado === "remitido"; });
    var hasPreliminar = order.examenes.some(function (ex) { return ex.estado === "preliminar"; });
    if (!hasFinal && !hasPreliminar) { U.toast("Esta orden aún no tiene resultados validados, remitidos ni preliminares para generar el PDF.", "error"); return; }

    var wrap = U.openModal(
      '<h3 class="modal-title">Informe de Resultados — Orden ' + order.numeroOrden + '</h3>' +
      '<div class="flex gap-2 wrap" style="margin-bottom:12px">' +
      (hasFinal ? '<button class="btn btn-primary btn-sm" id="pv-final">' + U.icon("download") + " Descargar Informe Final</button>" : "") +
      (hasPreliminar ? '<button class="btn btn-outline btn-sm" id="pv-prelim">' + U.icon("download") + " Descargar Informe Preliminar</button>" : "") +
      '<button class="btn btn-ghost btn-sm" data-modal-close>Cerrar</button></div>' +
      '<div id="pv-loading" class="text-muted">Generando informe…</div>' +
      '<iframe id="pv-frame" class="hidden" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:8px"></iframe>',
      { lg: true }
    );
    var lastBytes = null;
    async function show(modo) {
      wrap.querySelector("#pv-loading").classList.remove("hidden");
      wrap.querySelector("#pv-frame").classList.add("hidden");
      var bytes = await buildResultadosPDF(order, patient, tenant, modo);
      lastBytes = bytes;
      var blob = new Blob([bytes], { type: "application/pdf" });
      var url = URL.createObjectURL(blob);
      wrap.querySelector("#pv-frame").src = url;
      wrap.querySelector("#pv-loading").classList.add("hidden");
      wrap.querySelector("#pv-frame").classList.remove("hidden");
    }
    show(hasFinal ? "final" : "preliminar");
    var bf = wrap.querySelector("#pv-final"); if (bf) bf.addEventListener("click", async function () { await show("final"); U.downloadBytes(lastBytes, "Resultados_" + order.numeroOrden + "_Final.pdf"); });
    var bp = wrap.querySelector("#pv-prelim"); if (bp) bp.addEventListener("click", async function () { await show("preliminar"); U.downloadBytes(lastBytes, "Resultados_" + order.numeroOrden + "_Preliminar.pdf"); });
  }

  // ---------------------------------------------------------------------
  // STICKERS DE MUESTRA (rotulado de tubos)
  // ---------------------------------------------------------------------
  function buildStickersPDF(order, patient, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var byTubo = {};
    order.examenes.forEach(function (ex) {
      var exCat = C.examenPorId(ex.examId);
      var key = exCat.tubo || "otro";
      (byTubo[key] = byTubo[key] || []).push(exCat);
    });
    var tuboKeys = Object.keys(byTubo);
    var doc = new jsPDFCtor({ unit: "mm", format: [90, 38], orientation: "landscape" });

    tuboKeys.forEach(function (key, idx) {
      if (idx > 0) doc.addPage([90, 38], "landscape");
      var tubo = C.tuboInfo(key);
      var rgb = hexToRgb(tubo.color);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(0, 0, 6, 38, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(20, 20, 20);
      doc.text((tenant.nombre || "").substring(0, 34), 9, 6);
      if (order.prioridad === "Urgente") {
        doc.setTextColor(214, 69, 69); doc.setFontSize(7); doc.text("URGENTE", 78, 6, { align: "right" });
        doc.setTextColor(20, 20, 20);
      }
      doc.setFontSize(11); doc.text(order.numeroOrden, 9, 13);
      doc.setFontSize(8.5); doc.text(U.nombreCompleto(patient).substring(0, 36), 9, 19);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(patient.tipoDocumento + " " + patient.numeroDocumento + " · " + (U.calcEdad(patient.fechaNacimiento) || ""), 9, 23.5);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text(tubo.nombre, 9, 28);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.3);
      doc.text(byTubo[key].map(function (e) { return e.nombre; }).join(", "), 9, 32, { maxWidth: 78 });

      try {
        var canvas = document.createElement("canvas");
        window.JsBarcode(canvas, order.numeroOrden, { format: "CODE128", width: 1.2, height: 16, displayValue: false, margin: 0 });
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 52, 4, 35, 9);
      } catch (e) {}
    });

    return doc;
  }

  function previewStickers(order, patient, tenant) {
    if (!order.examenes.length) { U.toast("Esta orden no tiene exámenes.", "error"); return; }
    var doc = buildStickersPDF(order, patient, tenant);
    var wrap = U.openModal(
      '<h3 class="modal-title">Stickers de Muestra — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted">Se genera un sticker por cada tipo de tubo/recipiente requerido para los exámenes de esta orden, listo para imprimir en impresora de etiquetas o papel normal.</p>' +
      '<div class="flex gap-2" style="margin-bottom:10px">' +
      '<button class="btn btn-primary btn-sm" id="st-download">' + U.icon("download") + ' Descargar</button>' +
      '<button class="btn btn-outline btn-sm" id="st-print">' + U.icon("printer") + ' Abrir para Imprimir</button>' +
      '<button class="btn btn-ghost btn-sm" data-modal-close>Cerrar</button></div>' +
      '<iframe id="st-frame" style="width:100%;height:55vh;border:1px solid var(--border);border-radius:8px"></iframe>',
      { lg: true }
    );
    wrap.querySelector("#st-frame").src = doc.output("datauristring");
    wrap.querySelector("#st-download").addEventListener("click", function () { doc.save("Stickers_" + order.numeroOrden + ".pdf"); });
    wrap.querySelector("#st-print").addEventListener("click", function () {
      window.open(doc.output("bloburl"), "_blank");
      U.toast("Se abrió en una nueva pestaña. Usa Ctrl+P (o Cmd+P) para imprimir.", "success");
    });
  }

  global.BIO_PDF = { buildResultadosPDF: buildResultadosPDF, previewOrModal: previewOrModal, buildStickersPDF: buildStickersPDF, previewStickers: previewStickers };
})(window);

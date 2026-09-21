/* BIOsoft — Reporte administrativo en PDF: Relación de Órdenes y Exámenes.
   Un renglón por examen realizado en el periodo (N° Orden, Documento,
   Paciente, Fecha, Edad, Sexo, Examen, Valor), con un subtotal por orden y
   un total general al final del listado — para auditorías/contabilidad. */
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

  /* ordenes: [{ numeroOrden, documento, paciente, fecha (ISO), edad,
     sexo, aliado, examenes: [{ nombre, valor }] }]. El valor de cada
     examen es el de la Lista de Precios (o la tarifa del convenio de esa
     orden, si tiene una especial) — las órdenes no guardan un precio por
     examen individual, así que este es el mejor cálculo disponible, igual
     que la sugerencia automática de "Valor a Cobrar" al crear la orden.
     convenioNombreFiltro (opcional): si el reporte ya viene filtrado a un
     solo convenio, se muestra en el título — y, como ya queda claro de
     cuál se trata, la tabla no repite la columna "Aliado" en cada fila
     (si no hay filtro, sí se agrega, para poder ver de un vistazo a qué
     convenio o si es particular pertenece cada orden). */
  function buildRelacionOrdenesPDF(ordenes, tenant, desde, hasta, convenioNombreFiltro) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "RELACIÓN DE ÓRDENES Y EXÁMENES" + (convenioNombreFiltro ? " — " + convenioNombreFiltro.toUpperCase() : ""));
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    var totalExamenes = ordenes.reduce(function (a, o) { return a + o.examenes.length; }, 0);
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta) + "   ·   " + ordenes.length + " orden(es)   ·   " + totalExamenes + " examen(es)", margin, y);
    y += 16;

    if (!ordenes.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text("No hay órdenes con exámenes en este periodo.", margin, y);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    var conAliado = !convenioNombreFiltro;
    var numColsFijas = conAliado ? 7 : 6;
    var head = conAliado
      ? [["N° Orden", "Documento", "Paciente", "Aliado", "Fecha", "Edad", "Sexo", "Examen", "Valor"]]
      : [["N° Orden", "Documento", "Paciente", "Fecha", "Edad", "Sexo", "Examen", "Valor"]];
    var body = [];
    var filaMeta = []; // "dato" | "subtotal" | "total"
    var totalGeneral = 0;
    ordenes.forEach(function (o) {
      o.examenes.forEach(function (ex, i) {
        var filaBase = i === 0
          ? (conAliado ? [o.numeroOrden, o.documento, o.paciente, o.aliado, fmtFecha(o.fecha), o.edad || "—", o.sexo || "—"] : [o.numeroOrden, o.documento, o.paciente, fmtFecha(o.fecha), o.edad || "—", o.sexo || "—"])
          : (conAliado ? ["", "", "", "", "", "", ""] : ["", "", "", "", "", ""]);
        body.push(filaBase.concat([ex.nombre, fmtMoneda(ex.valor)]));
        filaMeta.push({ tipo: "dato" });
        totalGeneral += ex.valor;
      });
      var totalOrden = o.examenes.reduce(function (a, ex) { return a + ex.valor; }, 0);
      body.push([{ content: "Total Orden " + o.numeroOrden + " (" + o.examenes.length + " examen" + (o.examenes.length === 1 ? "" : "es") + ")", colSpan: numColsFijas + 1, styles: { halign: "right", fontStyle: "bold", fillColor: [246, 247, 249] } }, { content: fmtMoneda(totalOrden), styles: { fontStyle: "bold", fillColor: [246, 247, 249] } }]);
      filaMeta.push({ tipo: "subtotal" });
    });
    body.push([{ content: "TOTAL GENERAL DEL LISTADO", colSpan: numColsFijas + 1, styles: { halign: "right", fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9.5 } }, { content: fmtMoneda(totalGeneral), styles: { fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9.5 } }]);
    filaMeta.push({ tipo: "total" });

    var idxValor = numColsFijas + 1;
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: head, body: body, theme: "grid", styles: { fontSize: 7.5, cellPadding: 3.5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: (function () { var cs = {}; cs[idxValor] = { halign: "right" }; return cs; })(),
      didParseCell: function (data) {
        if (data.section !== "body") return;
        var meta = filaMeta[data.row.index];
        if (meta && meta.tipo === "subtotal" && data.column.index !== 0) data.cell.styles.fillColor = [246, 247, 249];
      }
    });

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_RELACION_ORDENES = {
    buildRelacionOrdenesPDF: buildRelacionOrdenesPDF
  };
})(window);

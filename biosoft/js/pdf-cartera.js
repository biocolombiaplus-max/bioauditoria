/* BIOsoft — Reporte profesional en PDF de Cartera (cuentas por cobrar):
   valor total, valor abonado y saldo pendiente por orden, agrupable por
   Aliado (Convenio) o por Paciente, con subtotales y total general. */
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

  function sumar(filas) {
    return filas.reduce(function (acc, f) {
      acc.total += f.valorTotal; acc.abonado += f.valorAbonado; acc.saldo += f.saldoPendiente;
      return acc;
    }, { total: 0, abonado: 0, saldo: 0 });
  }

  /* Tarjeta con los 3 grandes totales (Total / Abonado / Saldo), como la
     usan los reportes financieros "de verdad" — se usa tanto para el total
     general como (más chica) para cada subtotal de grupo. */
  function tarjetaTotales(doc, x, y, w, rgb, totales, titulo, chica) {
    var h = chica ? 30 : 40;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
    doc.roundedRect(x, y, w, h, 4, 4, "FD");
    var colW = w / 3;
    var etiquetas = ["VALOR TOTAL", "ABONADO", "SALDO PENDIENTE"];
    var valores = [totales.total, totales.abonado, totales.saldo];
    var colores = [[60, 60, 60], [21, 128, 61], totales.saldo > 0 ? [185, 28, 28] : [21, 128, 61]];
    for (var i = 0; i < 3; i++) {
      var cx = x + colW * i + colW / 2;
      doc.setFont("helvetica", "normal"); doc.setFontSize(chica ? 6.5 : 7.5); doc.setTextColor(120, 120, 120);
      doc.text(etiquetas[i], cx, y + (chica ? 11 : 14), { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(chica ? 9.5 : 12); doc.setTextColor(colores[i][0], colores[i][1], colores[i][2]);
      doc.text(fmtMoneda(valores[i]), cx, y + (chica ? 23 : 32), { align: "center" });
      if (i < 2) { doc.setDrawColor(226, 232, 240); doc.line(x + colW * (i + 1), y + 5, x + colW * (i + 1), y + h - 5); }
    }
    if (titulo) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(chica ? 9 : 10); doc.setTextColor(30, 30, 30);
      doc.text(titulo, x, y - 6);
    }
    return y + h;
  }

  function tablaFilas(doc, y, margin, pageW, filas, conAliado) {
    var head = conAliado
      ? [["N° Orden", "Fecha", "Paciente", "Aliado", "Valor Total", "Abonado", "Saldo"]]
      : [["N° Orden", "Fecha", "Paciente", "Valor Total", "Abonado", "Saldo"]];
    var body = filas.map(function (f) {
      var fila = conAliado
        ? [f.numeroOrden, fmtFecha(f.fecha), f.paciente, f.aliado]
        : [f.numeroOrden, fmtFecha(f.fecha), f.paciente];
      return fila.concat([fmtMoneda(f.valorTotal), fmtMoneda(f.valorAbonado), fmtMoneda(f.saldoPendiente)]);
    });
    var idxDinero = conAliado ? [4, 5, 6] : [3, 4, 5];
    var columnStyles = {};
    idxDinero.forEach(function (i) { columnStyles[i] = { halign: "right" }; });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: head, body: body,
      theme: "striped", styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: columnStyles,
      didParseCell: function (data) {
        if (data.section === "body" && idxDinero.indexOf(data.column.index) === idxDinero[idxDinero.length - 1]) {
          var f = filas[data.row.index];
          if (f && f.saldoPendiente > 0) data.cell.styles.textColor = [185, 28, 28];
        }
      }
    });
    return doc.lastAutoTable.finalY + 18;
  }

  /* filas: [{ numeroOrden, fecha (ISO), paciente, aliado, valorTotal,
     valorAbonado, saldoPendiente }]. agrupacion: "general" | "aliado" | "paciente". */
  function buildCarteraPDF(filas, tenant, desde, hasta, agrupacion) {
    agrupacion = agrupacion || "aliado";
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "ESTADO DE CARTERA");
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    var etiquetaAgrup = agrupacion === "aliado" ? "Agrupado por Aliado (Convenio)" : agrupacion === "paciente" ? "Agrupado por Paciente" : "Detalle general";
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta) + "   ·   " + etiquetaAgrup, margin, y);
    y += 20;

    var totalGeneral = sumar(filas);
    y = tarjetaTotales(doc, margin, y, pageW - margin * 2, rgb, totalGeneral, null, false) + 20;

    if (!filas.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text("No hay órdenes con valor a cobrar en este periodo.", margin, y);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    if (agrupacion === "general") {
      y = tablaFilas(doc, y, margin, pageW, filas, true);
    } else {
      var clave = agrupacion === "aliado" ? "aliado" : "paciente";
      var grupos = {};
      var orden = [];
      filas.forEach(function (f) {
        var k = f[clave];
        if (!grupos[k]) { grupos[k] = []; orden.push(k); }
        grupos[k].push(f);
      });
      // Los "Particulares" (sin aliado/convenio) siempre al final del
      // listado por aliado, para que las cuentas de los convenios (lo que
      // más le interesa cobrar en bloque a un laboratorio) queden primero.
      orden.sort(function (a, b) {
        if (agrupacion === "aliado") {
          if (a === "Particulares") return 1;
          if (b === "Particulares") return -1;
        }
        return a.localeCompare(b);
      });
      orden.forEach(function (nombreGrupo) {
        var filasGrupo = grupos[nombreGrupo];
        var subtotal = sumar(filasGrupo);
        var altoEstimado = 46 + 20 + (filasGrupo.length + 1) * 16;
        if (y + altoEstimado > PAGE_BOTTOM) { doc.addPage(); y = margin; }
        y = tarjetaTotales(doc, margin, y, pageW - margin * 2, rgb, subtotal, nombreGrupo + " (" + filasGrupo.length + " orden" + (filasGrupo.length === 1 ? "" : "es") + ")", true) + 14;
        y = tablaFilas(doc, y, margin, pageW, filasGrupo, false);
      });
    }

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CARTERA = {
    buildCarteraPDF: buildCarteraPDF,
    fmtMoneda: fmtMoneda
  };
})(window);

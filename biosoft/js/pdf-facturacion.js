/* BIOsoft — Reportes administrativos en PDF: Facturación Detallada y
   Recibos Generados. Comparten exactamente la misma tabla (un renglón por
   orden, con los datos del paciente y los valores facturados/abonados/
   saldo) — lo único que cambia entre los dos es el universo de órdenes que
   entra (todas las facturadas en el periodo vs. solo las que ya tienen
   Recibo de Pago generado) y que Recibos Generados agrega la columna
   "N° Recibo". Las dos abren con una tarjeta de TOTALES bien visible
   (Total Facturado / Abonado / Saldo) antes del detalle, para que el
   número que más le importa al laboratorio no quede escondido al final
   de una tabla larga. */
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
      doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, doc.internal.pageSize.getHeight() - 20);
      doc.text("Página " + i + " de " + totalPaginas, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    }
  }

  /* Tarjeta con los 3 totales grandes (Total Facturado / Abonado / Saldo)
     bien visible ARRIBA del detalle — mismo lenguaje visual que el Estado
     de Cartera (ver pdf-cartera.js), para que se vea igual de "pro" en
     todos los reportes de dinero. */
  function tarjetaTotales(doc, x, y, w, rgb, totales) {
    var h = 40;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7);
    doc.roundedRect(x, y, w, h, 4, 4, "FD");
    var colW = w / 3;
    var etiquetas = ["TOTAL FACTURADO", "ABONADO", "SALDO PENDIENTE"];
    var valores = [totales.facturado, totales.abonado, totales.saldo];
    var colores = [[60, 60, 60], [21, 128, 61], totales.saldo > 0 ? [185, 28, 28] : [21, 128, 61]];
    for (var i = 0; i < 3; i++) {
      var cx = x + colW * i + colW / 2;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(etiquetas[i], cx, y + 14, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(colores[i][0], colores[i][1], colores[i][2]);
      doc.text(fmtMoneda(valores[i]), cx, y + 32, { align: "center" });
      if (i < 2) { doc.setDrawColor(226, 232, 240); doc.line(x + colW * (i + 1), y + 5, x + colW * (i + 1), y + h - 5); }
    }
    return y + h;
  }

  function sumarTotales(filas) {
    return filas.reduce(function (acc, f) {
      acc.facturado += f.valorTotal; acc.abonado += f.valorAbonado; acc.saldo += f.saldoPendiente;
      return acc;
    }, { facturado: 0, abonado: 0, saldo: 0 });
  }

  /* Columnas fijas (todo menos los 3 valores de dinero del final), e igual
     orden al armar cada fila — "conRecibo" agrega "N° Recibo" justo
     después de "N° Orden" (solo lo usa Recibos Generados). */
  function columnasFijas(conAliado, conRecibo) {
    var cols = ["N° Orden"];
    if (conRecibo) cols.push("N° Recibo");
    cols.push("Fecha", "Documento", "Paciente", "Edad", "Sexo");
    if (conAliado) cols.push("Aliado");
    cols.push("Exámenes", "Moneda", "Método de Pago");
    return cols;
  }
  function filaFija(f, conAliado, conRecibo) {
    var fila = [f.numeroOrden];
    if (conRecibo) fila.push(f.numeroRecibo);
    fila.push(fmtFecha(f.fecha), f.documento, f.paciente, f.edad || "—", f.sexo || "—");
    if (conAliado) fila.push(f.aliado);
    fila.push(f.examenes, f.moneda, f.metodoPago || "—");
    return fila;
  }

  /* filas: [{ numeroOrden, numeroRecibo (solo Recibos Generados), fecha
     (ISO), documento, paciente, edad, sexo, aliado, examenes (texto, ya
     unido con coma), moneda, metodoPago (texto), valorTotal, valorAbonado,
     saldoPendiente }]. convenioNombreFiltro/monedaNombreFiltro
     (opcionales): si el reporte ya viene filtrado a un solo convenio y/o
     una sola moneda, se muestran en el título — y, como ya queda claro de
     cuál se trata, la columna "Aliado" no se repite en cada fila. */
  function construirPDF(filas, tenant, desde, hasta, convenioNombreFiltro, monedaNombreFiltro, opts) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter", orientation: "landscape" });
    var tituloExtra = (convenioNombreFiltro ? " — " + convenioNombreFiltro.toUpperCase() : "") + (monedaNombreFiltro ? " — " + monedaNombreFiltro.toUpperCase() : "");
    var ctx = encabezado(doc, tenant, opts.titulo + tituloExtra);
    var margin = ctx.margin, pageW = ctx.pageW, rgb = ctx.rgb, y = ctx.y + 10;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Periodo: " + fmtFecha(desde) + " — " + fmtFecha(hasta) + "   ·   " + filas.length + " " + opts.contador, margin, y);
    y += 14;

    if (!filas.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
      doc.text(opts.vacio, margin, y);
      piePagina(doc, margin);
      return new Uint8Array(doc.output("arraybuffer"));
    }

    var totales = sumarTotales(filas);
    y = tarjetaTotales(doc, margin, y, pageW - margin * 2, rgb, totales) + 16;

    var conAliado = !convenioNombreFiltro;
    var conRecibo = !!opts.conRecibo;
    var head = [columnasFijas(conAliado, conRecibo).concat(["Valor Facturado", "Abonado", "Saldo"])];
    var numColsFijas = head[0].length - 3;
    var body = filas.map(function (f) { return filaFija(f, conAliado, conRecibo).concat([fmtMoneda(f.valorTotal), fmtMoneda(f.valorAbonado), fmtMoneda(f.saldoPendiente)]); });
    body.push([
      { content: "TOTAL GENERAL DEL PERIODO", colSpan: numColsFijas, styles: { halign: "right", fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9.5 } },
      { content: fmtMoneda(totales.facturado), styles: { fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9.5 } },
      { content: fmtMoneda(totales.abonado), styles: { fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9.5 } },
      { content: fmtMoneda(totales.saldo), styles: { fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9.5 } }
    ]);

    var idxValor = numColsFijas, idxAbonado = numColsFijas + 1, idxSaldo = numColsFijas + 2;
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: head, body: body, theme: "grid", styles: { fontSize: 7.5, cellPadding: 3.5 },
      headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
      columnStyles: (function () {
        var cs = {};
        cs[idxValor] = { halign: "right" }; cs[idxAbonado] = { halign: "right" }; cs[idxSaldo] = { halign: "right" };
        return cs;
      })(),
      didParseCell: function (data) {
        if (data.section !== "body" || data.row.index === body.length - 1) return;
        if (data.column.index === idxSaldo) {
          var f = filas[data.row.index];
          if (f && f.saldoPendiente > 0) data.cell.styles.textColor = [185, 28, 28];
        }
      }
    });

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  function buildFacturacionDetalladaPDF(filas, tenant, desde, hasta, convenioNombreFiltro, monedaNombreFiltro) {
    return construirPDF(filas, tenant, desde, hasta, convenioNombreFiltro, monedaNombreFiltro, {
      titulo: "FACTURACIÓN DETALLADA", contador: "orden(es) facturada(s)",
      vacio: "No hay órdenes con valor facturado en este periodo.", conRecibo: false
    });
  }

  function buildRecibosGeneradosPDF(filas, tenant, desde, hasta, convenioNombreFiltro, monedaNombreFiltro) {
    return construirPDF(filas, tenant, desde, hasta, convenioNombreFiltro, monedaNombreFiltro, {
      titulo: "RECIBOS GENERADOS", contador: "recibo(s) generado(s)",
      vacio: "No se ha generado ningún recibo de pago en este periodo.", conRecibo: true
    });
  }

  global.BIO_PDF_FACTURACION = {
    buildFacturacionDetalladaPDF: buildFacturacionDetalladaPDF,
    buildRecibosGeneradosPDF: buildRecibosGeneradosPDF
  };
})(window);

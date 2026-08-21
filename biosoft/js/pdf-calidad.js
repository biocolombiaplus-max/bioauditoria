/* BIOsoft — Informe de Control de Calidad (Westgard): resumen estadístico,
   gráfica Levey-Jennings y violaciones de reglas por cada control, generado
   a partir de las lecturas que el laboratorio ya fue capturando. */
(function (global) {
  "use strict";
  var C = BIO_CATALOG, Q = BIO_QC;

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }
  function fmtFecha(iso) { return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); }
  function analitoInfo(seccion, codigo) {
    return (Q.ANALITOS[seccion] || []).filter(function (a) { return a.codigo === codigo; })[0] || { codigo: codigo, nombre: codigo, unidad: "" };
  }
  function media(vals) { return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length; }
  function desviacion(vals, m) {
    if (vals.length < 2) return 0;
    var sq = vals.reduce(function (a, v) { return a + Math.pow(v - m, 2); }, 0);
    return Math.sqrt(sq / (vals.length - 1));
  }

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
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ". Reglas de Westgard evaluadas de forma determinística sobre las lecturas capturadas.", margin, 772, { maxWidth: 532 });
  }

  // Mini gráfica Levey-Jennings dibujada con las primitivas de jsPDF (líneas
  // y círculos), sin depender de convertir un SVG a imagen.
  function dibujarGraficaLJ(doc, x, y, w, h, lecturas, med, ds) {
    var puntos = lecturas.slice(-20);
    var padL = 32, padR = 24, padT = 4, padB = 4;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var yMin = med - 4 * ds, yMax = med + 4 * ds;
    function yFor(v) { return y + padT + (yMax - v) / (yMax - yMin) * plotH; }
    function xFor(i) { return puntos.length <= 1 ? x + padL + plotW / 2 : x + padL + (i / (puntos.length - 1)) * plotW; }
    [-3, -2, -1, 0, 1, 2, 3].forEach(function (n) {
      var yy = yFor(med + n * ds);
      doc.setLineWidth(n === 0 ? 0.6 : 0.35);
      var g = n === 0 ? 150 : 205;
      doc.setDrawColor(g, g, g);
      doc.line(x + padL, yy, x + w - padR, yy);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(140, 140, 140);
      doc.text(n === 0 ? "x̄" : (n > 0 ? "+" + n : n) + "DS", x + w - padR + 2, yy + 2);
    });
    if (puntos.length) {
      doc.setDrawColor(124, 58, 237); doc.setLineWidth(0.7);
      for (var i = 1; i < puntos.length; i++) doc.line(xFor(i - 1), yFor(puntos[i - 1].valor), xFor(i), yFor(puntos[i].valor));
      puntos.forEach(function (l, i) {
        var col = l.estado === "rechazo" ? [214, 69, 69] : l.estado === "aviso" ? [201, 126, 13] : [11, 138, 74];
        doc.setFillColor(col[0], col[1], col[2]);
        doc.circle(xFor(i), yFor(l.valor), 1.7, "F");
      });
    }
  }

  /* controles: todos los controles del laboratorio (activos e inactivos).
     lecturasPorControlId: { controlId: [lecturas ordenadas cronológicamente] }. */
  async function buildInformeCalidadPDF(controles, lecturasPorControlId, tenant) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var ctx = encabezado(doc, tenant, "INFORME DE CONTROL DE CALIDAD");
    var margin = ctx.margin, pageW = ctx.pageW, y = ctx.y + 6;
    var pageBottom = 745;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text("Generado: " + new Date().toLocaleString("es-CO"), margin, y);
    y += 18;

    // -------- Resumen ejecutivo --------
    var activos = controles.filter(function (c) { return c.activo; });
    var conRechazoHoy = 0, conAvisoHoy = 0, sinLecturas = 0;
    var hoy = new Date().toISOString().slice(0, 10);
    activos.forEach(function (c) {
      var lecturas = lecturasPorControlId[c.id] || [];
      if (!lecturas.length) { sinLecturas++; return; }
      var ultima = lecturas[lecturas.length - 1];
      if (ultima.estado === "rechazo") conRechazoHoy++;
      else if (ultima.estado === "aviso") conAvisoHoy++;
    });
    doc.setFillColor(246, 247, 249); doc.roundedRect(margin, y, pageW - margin * 2, 44, 4, 4, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    var resumenCols = [
      { label: "Controles activos", valor: String(activos.length) },
      { label: "Última lectura en rechazo", valor: String(conRechazoHoy), color: conRechazoHoy ? [214, 69, 69] : null },
      { label: "Última lectura en aviso", valor: String(conAvisoHoy), color: conAvisoHoy ? [201, 126, 13] : null },
      { label: "Sin ninguna lectura aún", valor: String(sinLecturas) }
    ];
    var colW = (pageW - margin * 2) / resumenCols.length;
    resumenCols.forEach(function (rc, i) {
      var cx = margin + i * colW + colW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.setTextColor(rc.color ? rc.color[0] : 20, rc.color ? rc.color[1] : 20, rc.color ? rc.color[2] : 20);
      doc.text(rc.valor, cx, y + 20, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
      doc.text(rc.label, cx, y + 33, { align: "center", maxWidth: colW - 8 });
    });
    y += 60;

    // -------- Detalle por sección / control --------
    var porSeccion = {};
    controles.forEach(function (c) { (porSeccion[c.seccion] = porSeccion[c.seccion] || []).push(c); });

    C.SECCIONES.filter(function (s) { return porSeccion[s.id] && porSeccion[s.id].length; }).forEach(function (sec) {
      if (y > pageBottom - 30) { doc.addPage(); y = margin; }
      doc.setFillColor(ctx.rgb[0], ctx.rgb[1], ctx.rgb[2]);
      doc.rect(margin, y, pageW - margin * 2, 16, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text((sec.emoji + " " + sec.nombre).toUpperCase(), margin + 6, y + 11);
      y += 26;

      porSeccion[sec.id].forEach(function (c) {
        var info = analitoInfo(c.seccion, c.analitoCodigo);
        var lecturas = lecturasPorControlId[c.id] || [];
        var chartH = 100, headerH = 46;
        if (y + headerH + (lecturas.length ? chartH + 10 : 0) > pageBottom) { doc.addPage(); y = margin; }

        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
        doc.text(info.nombre + " — " + c.nivel + (c.activo ? "" : " (INACTIVO)"), margin, y);
        y += 13;

        var valores = lecturas.map(function (l) { return l.valor; });
        var medReal = valores.length ? media(valores) : null;
        var dsReal = valores.length > 1 ? desviacion(valores, medReal) : null;
        var cv = medReal && dsReal ? (dsReal / medReal * 100) : null;
        var ultima = lecturas.length ? lecturas[lecturas.length - 1] : null;

        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        var lineaStats = "Lote " + (c.lote || "—") + "  ·  Objetivo: " + c.media + " ± " + c.ds + " " + info.unidad +
          "  ·  Lecturas: " + lecturas.length +
          (medReal != null ? "  ·  Media real: " + medReal.toFixed(2) : "") +
          (dsReal != null ? "  ·  DS real: " + dsReal.toFixed(2) : "") +
          (cv != null ? "  ·  CV: " + cv.toFixed(1) + "%" : "");
        doc.text(lineaStats, margin, y, { maxWidth: pageW - margin * 2 });
        y += 11;

        if (ultima) {
          var colUlt = ultima.estado === "rechazo" ? [214, 69, 69] : ultima.estado === "aviso" ? [201, 126, 13] : [11, 138, 74];
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(colUlt[0], colUlt[1], colUlt[2]);
          doc.text("Última lectura (" + fmtFecha(ultima.fecha) + "): " + ultima.valor + " " + info.unidad +
            (ultima.estado === "rechazo" ? " — RECHAZADO" : ultima.estado === "aviso" ? " — AVISO" : " — En control") +
            (ultima.reglas && ultima.reglas.length ? " [" + ultima.reglas.join(", ") + "]" : ""), margin, y);
        } else {
          doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
          doc.text("Aún no se ha capturado ninguna lectura para este control.", margin, y);
        }
        y += 12;

        if (lecturas.length) {
          dibujarGraficaLJ(doc, margin, y, pageW - margin * 2, chartH, lecturas, c.media, c.ds);
          y += chartH + 8;
        }

        var violaciones = lecturas.filter(function (l) { return l.reglas && l.reglas.length; });
        if (violaciones.length) {
          if (y + 16 + Math.min(violaciones.length, 8) * 11 > pageBottom) { doc.addPage(); y = margin; }
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(20, 20, 20);
          doc.text("Violaciones de reglas de Westgard en el periodo (" + violaciones.length + "):", margin, y);
          y += 10;
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
          violaciones.slice(-8).forEach(function (l) {
            if (y > pageBottom) { doc.addPage(); y = margin; }
            var esRechazo = l.reglas.some(function (r) { return Q.RECHAZO && Q.RECHAZO[r]; });
            doc.setTextColor(esRechazo ? 214 : 201, esRechazo ? 69 : 126, esRechazo ? 69 : 13);
            doc.text("• " + fmtFecha(l.fecha) + " — valor " + l.valor + " — " + l.reglas.join(", "), margin + 6, y);
            y += 10;
          });
          y += 4;
        }
        y += 10;
      });
    });

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CALIDAD = { buildInformeCalidadPDF: buildInformeCalidadPDF };
})(window);

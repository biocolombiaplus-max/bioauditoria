/* BIOsoft — Generación de reportes PDF profesionales, fusión de informes remitidos y stickers de muestra */
(function (global) {
  "use strict";
  var U = BIO_UI, C = BIO_CATALOG, S = BIO_STORE;

  /* Cuando un parámetro tiene varios rangos de interpretación (ej. un perfil
     lipídico con Óptimo/Intermedio/Alto/Muy Alto, o valores distintos para
     niños), C.textoReferenciaRangos() los junta en un solo texto separado
     por " · " para mostrarlo compacto en la pantalla de captura. En el PDF
     ese mismo texto, todo en una sola línea corrida, se ve amontonado y no
     se distingue un rango de otro — aquí se parte cada rango en su propia
     línea dentro de la celda para que se lea como una lista clara. */
  function formatearValorReferencia(refText) {
    return (refText || "").split(" · ").join("\n");
  }

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }

  function dataUrlToUint8Array(dataUrl) {
    var base64 = dataUrl.split(",")[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function buildQrDataUrl(texto, sizePx) {
    if (!window.qrcode) return null;
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

  /* Las firmas escaneadas/fotografiadas que sube cada bacteriólogo(a) suelen
     traer bastante espacio en blanco alrededor del trazo real, lo que hace
     que se vea "flotando" lejos de la línea al imprimirla a un tamaño fijo.
     Esta función recorta ese margen sobrante (detectando el rectángulo real
     del trazo) para que la firma quede justo encima de la línea sin importar
     cómo haya sido tomada la foto original — aplica por igual a las firmas
     ya cargadas de cualquier cliente y a las que se suban de ahora en adelante. */
  function recortarFirma(dataUrl) {
    return new Promise(function (resolve) {
      if (!dataUrl) { resolve(null); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          var step = Math.max(1, Math.round(Math.sqrt((canvas.width * canvas.height) / 500000)));
          var minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0, encontrado = false;
          for (var yy = 0; yy < canvas.height; yy += step) {
            for (var xx = 0; xx < canvas.width; xx += step) {
              var idx = (yy * canvas.width + xx) * 4;
              if (data[idx + 3] < 12) continue;
              if (data[idx] > 245 && data[idx + 1] > 245 && data[idx + 2] > 245) continue;
              encontrado = true;
              if (xx < minX) minX = xx;
              if (xx > maxX) maxX = xx;
              if (yy < minY) minY = yy;
              if (yy > maxY) maxY = yy;
            }
          }
          if (!encontrado) { resolve({ url: dataUrl, w: canvas.width, h: canvas.height }); return; }
          var pad = Math.max(2, Math.round(canvas.width * 0.015));
          minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
          maxX = Math.min(canvas.width - 1, maxX + pad); maxY = Math.min(canvas.height - 1, maxY + pad);
          var w = maxX - minX + 1, h = maxY - minY + 1;
          var out = document.createElement("canvas");
          out.width = w; out.height = h;
          out.getContext("2d").drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
          resolve({ url: out.toDataURL("image/png"), w: w, h: h });
        } catch (e) {
          resolve({ url: dataUrl, w: img.naturalWidth || 200, h: img.naturalHeight || 80 });
        }
      };
      img.onerror = function () { resolve({ url: dataUrl, w: 200, h: 80 }); };
      img.src = dataUrl;
    });
  }

  async function buildResultadosPDF(order, patient, tenant, modo) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var margin = 40;
    var y = margin;
    // Límite inferior para el contenido de las tablas de resultados, y
    // estimación (deliberadamente generosa) de cuánto ocupa cada fila —
    // se usan para decidir CON ANTICIPACIÓN si un examen completo cabe en
    // lo que queda de página, en vez de dejar que se corte a la mitad.
    var pageBottom = pageH - 55;
    var ROW_H = 17, HEAD_H = 22;
    var rgb = hexToRgb(tenant.colorPrimario);

    var metaLines = [
      C.documentoTributarioLabel(tenant.pais) + " " + tenant.nit + (tenant.codigoREPS ? " · Código REPS " + tenant.codigoREPS : ""),
      tenant.direccion + " · " + tenant.telefonos,
      tenant.email + (tenant.sitioWeb ? " · " + tenant.sitioWeb : ""),
      tenant.resolucionHabilitacion || ""
    ];

    if (tenant.logoGrandeReporte) {
      // Membrete centrado (activado en Configuración → "Diseño del Reporte
      // de Resultados", pedido puntual de un cliente): el logo centrado
      // arriba y, justo debajo, el nombre del laboratorio también
      // centrado — cada elemento se centra con su propio ancho conocido
      // (la imagen) o con el centrado nativo de jsPDF (el texto, vía
      // align:"center"), en vez de calcular a mano dónde empieza el
      // nombre según el ancho medido del logo — ese cálculo manual es lo
      // que se veía mal (el nombre quedaba lejos del logo y se desalineaba
      // con el resto del membrete).
      var cx = pageW / 2;
      if (tenant.logoDataUrl) {
        // "Logo a todo el ancho" (pedido puntual, ej. Yamdan): el logo ya
        // trae el nombre del laboratorio dibujado adentro, así que se
        // estira a todo el ancho de contenido de la hoja EN VEZ del
        // cuadrado fijo de 76pt. La altura se calcula a partir de las
        // proporciones reales del archivo (doc.getImageProperties), nunca
        // se fuerza a cuadrado — así funciona bien con cualquier logo que
        // suban, sea cuadrado, horizontal o vertical. Se limita una altura
        // máxima para que un logo muy alto/vertical no desborde la hoja.
        if (tenant.logoAnchoCompleto) {
          var logoW = pageW - margin * 2;
          var logoH = logoW;
          try {
            var props = doc.getImageProperties(tenant.logoDataUrl);
            if (props && props.width && props.height) {
              logoH = logoW * (props.height / props.width);
              var alturaMaxima = 170;
              if (logoH > alturaMaxima) { logoH = alturaMaxima; logoW = logoH * (props.width / props.height); }
            }
          } catch (e) {}
          try { doc.addImage(tenant.logoDataUrl, "PNG", cx - logoW / 2, y - 4, logoW, logoH); } catch (e) {}
          y += logoH + 12;
        } else {
          var logoCentradoSize = 76;
          try { doc.addImage(tenant.logoDataUrl, "PNG", cx - logoCentradoSize / 2, y - 4, logoCentradoSize, logoCentradoSize); } catch (e) {}
          y += logoCentradoSize + 12;
        }
      } else {
        y += 76 + 12;
      }
      // Si el logo ya trae el nombre del laboratorio dibujado (como el de
      // Yamdan), mostrar además el nombre en texto debajo queda repetido —
      // se puede ocultar desde Configuración.
      if (!tenant.ocultarNombreEncabezado) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(tenant.nombre, cx, y, { align: "center" });
        y += 15;
      }
      if (tenant.slogan) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(10.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(tenant.slogan, cx, y, { align: "center" });
        y += 15;
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
      metaLines.forEach(function (line, i) { doc.text(line, cx, y + i * 10, { align: "center" }); });
      y += metaLines.length * 10 + 14;
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
      doc.line(margin, y, pageW - margin, y); y += 20;
    } else {
      // El logo sale bien grande (100pt — subió de 46 a 62, a 84 y ahora a
      // 100) para aprovechar el espacio en blanco que quedaba debajo suyo en
      // el encabezado y que resalte con fuerza incluso impreso en papel. El
      // nombre y los datos del laboratorio se recorren proporcionalmente para
      // que el encabezado se vea equilibrado.
      var logoSize = 100;
      if (tenant.logoDataUrl) {
        try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 9, logoSize, logoSize); } catch (e) {}
      }
      var textX = margin + (tenant.logoDataUrl ? logoSize + 14 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(tenant.nombre, textX, y + 12);
      var metaStartOffset = 25;
      if (tenant.slogan) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(tenant.slogan, textX, y + 23);
        metaStartOffset = 35;
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
      metaLines.forEach(function (line, i) { doc.text(line, textX, y + metaStartOffset + i * 10); });

      doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
      y += tenant.slogan ? 106 : 96; doc.line(margin, y, pageW - margin, y); y += 20;
    }

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
      ["Edad / Sexo:", edad + " / " + patient.sexo]
    ];
    if (patient.pais === "CO") left.push(["EPS / Asegurador:", patient.eps || "Particular"]);
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
    // Respeta el orden de exámenes que el laboratorio haya personalizado
    // (tenant.ordenExamenes), en vez del orden en que se agregaron a la orden.
    Object.keys(bySeccion).forEach(function (seccionId) {
      bySeccion[seccionId] = C.ordenarPorExamen(bySeccion[seccionId], tenant, function (ex) { return ex.examId; });
    });

    Object.keys(bySeccion).forEach(function (seccionId) {
      // Los parámetros tipo "panel" (antibiograma/alergia) no encajan en la
      // tabla de un solo valor por fila — se recogen aparte para armarles su
      // propia tabla, justo después de la tabla principal de la sección.
      var panelesDeSeccion = [];
      // Se agrupan los parámetros por examen. Ya no hay una columna "Examen"
      // aparte de "Parámetro": con exámenes de un solo parámetro (la mayoría
      // en Química) esas dos columnas mostraban casi el mismo texto una al
      // lado de la otra y se veía redundante. Ahora el nombre del examen (y
      // su método, si lo tiene) van como una fila-título en negrita que
      // abarca todo el ancho de la tabla — el mismo formato que usan los
      // laboratorios de referencia grandes para reportes de panel — y debajo
      // van sus parámetros, cada uno con su propio nombre en la columna
      // "Parámetro". Todo esto se calcula ANTES de dibujar el banner de la
      // sección para poder decidir si hace falta pasar de página antes de
      // empezar — así nunca queda el banner solo, sin ninguna fila debajo,
      // al fondo de una página.
      var grupos = [];
      var examIdsConGrupo = {};
      bySeccion[seccionId].forEach(function (ex) {
        var exCat = C.examenParaPaciente(ex.examId, tenant, patient, C.categoriasDeValores(ex.valores));
        var metodoTexto = C.examenEfectivo(ex.examId, tenant).metodo || "";
        var filas = [];
        exCat.parametros.forEach(function (p) {
          if (p.tipo === "panel") {
            var entry = ex.valores.filter(function (v) { return v.codigo === p.codigo; })[0];
            var items = C.parsePanelValor(entry ? entry.valor : "");
            if (items.length) panelesDeSeccion.push({ exNombre: exCat.nombre, exId: ex.examId, p: p, items: items });
            return;
          }
          var val = (ex.valores.filter(function (v) { return v.codigo === p.codigo; })[0] || {}).valor || "-";
          var flag = C.calcularFlag(p, val);
          var refFormateado = formatearValorReferencia(p.refText);
          filas.push({
            fila: [p.nombre, val + (p.unidad ? " " + p.unidad : ""), refFormateado, flag.texto || ""],
            anormal: flag.clase !== "" && flag.clase !== "normal",
            // Parámetros con varios rangos de interpretación (ver arriba)
            // ocupan varias líneas en la columna "Valor de Referencia" — se
            // cuentan para que la estimación de espacio de la página no se
            // quede corta y termine cortando la fila a la mitad.
            lineas: Math.max(1, refFormateado.split("\n").length)
          });
        });
        if (filas.length) { grupos.push({ nombre: exCat.nombre, metodo: metodoTexto, filas: filas }); examIdsConGrupo[ex.examId] = true; }
      });

      // Alto estimado de un grupo: su fila-título + (opcional) su fila de
      // método + una fila por parámetro (cada una según cuántas líneas
      // ocupe su valor de referencia, no siempre 1).
      function altoGrupo(g) {
        var filasAlto = g.filas.reduce(function (sum, f) { return sum + f.lineas; }, 0);
        return (1 + (g.metodo ? 1 : 0) + filasAlto) * ROW_H;
      }

      // Antes de dibujar el banner rojo de la sección, se verifica que
      // quepa completo junto con el encabezado de la tabla y al menos el
      // primer examen — si no cabe, se pasa de página ANTES del banner, en
      // vez de dejarlo solo al fondo de la página sin ninguna fila debajo
      // (que es justo lo que se veía feo: el banner de una sección quedando
      // huérfano al final de una página y los resultados empezando recién
      // en la siguiente).
      var altoPrimerGrupo = grupos.length ? altoGrupo(grupos[0]) : 0;
      if (y + 24 + HEAD_H + altoPrimerGrupo > pageBottom) { doc.addPage(); y = margin; }

      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(margin, y, pageW - margin * 2, 16, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text(C.seccionNombre(seccionId, tenant).toUpperCase(), margin + 6, y + 11);
      y += 24;

      // Luego se arma la tabla en "trozos" que quepan completos en lo que
      // resta de la página: en un informe con muchos exámenes (20 o más),
      // esto evita que un examen con varios parámetros (ej. un Cuadro
      // Hemático) quede cortado a la mitad entre una página y la siguiente
      // — que es justo lo que más confunde a un médico leyendo el reporte.
      // Solo se salta de página cuando el siguiente examen de verdad no
      // cabe completo, nunca sección por sección, así se usan las menos
      // hojas posibles y todo queda consecutivo.
      var body = [];
      var filaMeta = []; // una entrada por fila de "body", en el mismo orden
      var yEstimado = y;
      function volcarTablaSeccion() {
        if (!body.length) return;
        doc.autoTable({
          startY: y, margin: { left: margin, right: margin },
          head: [["Parámetro", "Resultado", "Valor de Referencia", "Interpretación"]],
          body: body, theme: "grid", styles: { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
          didParseCell: function (data) {
            if (data.section !== "body") return;
            var meta = filaMeta[data.row.index];
            if (!meta || meta.tipo !== "dato") return;
            // El resultado siempre en negrita: es el dato que más le importa
            // leer rápido a un médico remitente en un reporte con muchos
            // parámetros.
            if (data.column.index === 1) data.cell.styles.fontStyle = "bold";
            if (data.column.index === 3 && meta.anormal) {
              data.cell.styles.textColor = [214, 69, 69]; data.cell.styles.fontStyle = "bold";
            }
          }
        });
        y = doc.lastAutoTable.finalY + 10;
        body = []; filaMeta = [];
      }

      grupos.forEach(function (g) {
        var necesita = (body.length ? 0 : HEAD_H) + altoGrupo(g);
        if (body.length && yEstimado + necesita > pageBottom) {
          volcarTablaSeccion();
          doc.addPage(); y = margin;
          doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
          doc.text(C.seccionNombre(seccionId, tenant).toUpperCase() + " (continuación)", margin, y);
          y += 14;
          yEstimado = y + HEAD_H;
        } else {
          yEstimado += necesita;
        }
        body.push([{ content: g.nombre, colSpan: 4, styles: { fillColor: [246, 247, 249], textColor: [50, 50, 50], fontStyle: "bold", fontSize: 8.5 } }]);
        filaMeta.push({ tipo: "titulo" });
        if (g.metodo) {
          body.push([{ content: "Método: " + g.metodo, colSpan: 4, styles: { fontStyle: "italic", textColor: [140, 140, 140], fontSize: 6.8 } }]);
          filaMeta.push({ tipo: "metodo" });
        }
        g.filas.forEach(function (f) {
          body.push(f.fila);
          filaMeta.push({ tipo: "dato", anormal: f.anormal });
        });
      });
      volcarTablaSeccion();

      panelesDeSeccion.forEach(function (panelInfo) {
        if (y > 690) { doc.addPage(); y = margin; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text((panelInfo.p.panelTipo === "alergia" ? "PANEL DE ALERGIA" : "ANTIBIOGRAMA") + " — " + panelInfo.exNombre, margin, y);
        y += 12;
        // El método solo se repite aquí si ese examen no tiene su propia
        // fila-título en la tabla principal de arriba (ej. un panel de
        // alergia que es 100% panel, sin ningún parámetro normal) — si ya
        // salió junto a su nombre en la tabla, no hace falta mostrarlo de nuevo.
        var metodoPanel = !examIdsConGrupo[panelInfo.exId] ? (C.examenEfectivo(panelInfo.exId, tenant).metodo || "") : "";
        if (metodoPanel) {
          doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
          doc.text("Método: " + metodoPanel, margin, y);
          y += 10;
        }
        if (panelInfo.p.panelTipo === "alergia") {
          var interpPorFila = panelInfo.items.map(function (it) {
            return it.valor !== "" && it.valor != null ? C.claseIgE(it.valor) : null;
          });
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin },
            head: [["Alérgeno", "Clase", "Concentración IgE", "Interpretación"]],
            body: panelInfo.items.map(function (it, i) {
              var c = interpPorFila[i];
              return [it.nombre, c ? String(c.clase) : "-", (it.valor || "-") + " kU/L", c ? c.interpretacion : "-"];
            }),
            theme: "grid", styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
            didParseCell: function (data) {
              if (data.section === "body" && data.column.index === 3 && interpPorFila[data.row.index] && interpPorFila[data.row.index].interpretacion === "Positivo") {
                data.cell.styles.textColor = [214, 69, 69]; data.cell.styles.fontStyle = "bold";
              }
            }
          });
        } else {
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin },
            head: [["Antibiótico", "Resultado"]],
            body: panelInfo.items.map(function (it) { return [it.nombre, it.resultado || "-"]; }),
            theme: "grid", styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" },
            didParseCell: function (data) {
              if (data.section === "body" && data.column.index === 1 && panelInfo.items[data.row.index] && panelInfo.items[data.row.index].resultado === "Resistente") {
                data.cell.styles.textColor = [214, 69, 69]; data.cell.styles.fontStyle = "bold";
              }
            }
          });
        }
        y = doc.lastAutoTable.finalY + 10;
      });

      // Las observaciones que el bacteriólogo(a) escribió en cada examen al
      // validarlo (ej. "muestra tomada por sonda urinaria") también deben
      // salir en el reporte que recibe el paciente, no solo en la pantalla.
      var obsExams = bySeccion[seccionId].filter(function (ex) { return ex.observaciones; });
      if (obsExams.length) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        obsExams.forEach(function (ex) {
          var exCat = C.examenEfectivo(ex.examId, tenant);
          var texto = (obsExams.length > 1 ? exCat.nombre + " — " : "") + "Observaciones: " + ex.observaciones;
          var lineas = doc.splitTextToSize(texto, pageW - margin * 2);
          if (y + lineas.length * 10 > 750) { doc.addPage(); y = margin; }
          doc.text(lineas, margin, y);
          y += lineas.length * 10 + 3;
        });
      }
      y += 8;
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
          var exCat = C.examenEfectivo(ex.examId, tenant);
          return [exCat.nombre, ex.laboratorioRemision || "—", "Ver informe original anexo en las páginas siguientes"];
        }),
        theme: "grid", styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [240, 244, 247], textColor: 40, fontStyle: "bold" }
      });
      y = doc.lastAutoTable.finalY + 18;
    }

    // Pie de página personalizado (opcional, definido en Configuración →
    // "Diseño del Reporte de Resultados") — una frase propia del
    // laboratorio (ej. su promesa de calidad), justo antes del bloque de
    // firmas, tal como lo usan otros laboratorios de referencia.
    if (tenant.piePaginaPersonalizado) {
      if (y > 700) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
      var lineasPie = doc.splitTextToSize(tenant.piePaginaPersonalizado, pageW - margin * 2);
      doc.text(lineasPie, margin, y);
      y += lineasPie.length * 11 + 10;
    }

    var firmantes = firmantesDe(order, tenant, examsToShow);
    var lineW = 190;
    // Espacio de seguridad antes de la primera firma: la imagen recortada
    // puede medir hasta maxH=40pt de alto y se dibuja con su base apenas
    // encima de la línea, así que sin este respiro adicional podía llegar a
    // montarse sobre la tabla de resultados justo arriba.
    y += 24;
    for (var fi = 0; fi < firmantes.length; fi++) {
      var f = firmantes[fi];
      if (y > 700) { doc.addPage(); y = margin; }
      if (f.firmaDataUrl) {
        try {
          var recorte = await recortarFirma(f.firmaDataUrl);
          var maxW = 150, maxH = 40;
          var escala = Math.min(maxW / recorte.w, maxH / recorte.h, 1);
          var dw = recorte.w * escala, dh = recorte.h * escala;
          // Se centra sobre el segmento de la línea y su base queda apenas
          // encima de ella, para que la firma se vea apoyada sobre la línea
          // sin importar cuánto margen en blanco traiga la imagen original.
          doc.addImage(recorte.url, "PNG", margin + (lineW - dw) / 2, y + 8 - dh, dw, dh);
        } catch (e) {}
      }
      doc.setDrawColor(180, 180, 180); doc.line(margin, y + 10, margin + lineW, y + 10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      doc.text(f.nombre, margin, y + 22);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text(f.registroProfesional ? "Registro Profesional: " + f.registroProfesional : "", margin, y + 33);
      doc.text(C.tituloFirmaProfesional(tenant.pais), margin, y + 44);
      y += 62;
    }
    var signBlockBottom = y;

    try {
      var qrTexto = "BIOsoft | Verificación de Documento\n" +
        "Laboratorio: " + tenant.nombre +
        "\nPaciente: " + U.nombreCompleto(patient) +
        "\nDocumento: " + patient.tipoDocumento + " " + patient.numeroDocumento +
        "\nOrden: " + order.numeroOrden + " · " + U.fmtFecha(order.fechaOrden) +
        "\nValidado: " + new Date().toLocaleString("es-CO") +
        "\nVálido si coincide con el paciente y la fecha del informe.";
      var qrDataUrl = buildQrDataUrl(qrTexto, 220);
      var qrSize = 58;
      var qrX = pageW - margin - qrSize;
      // El QR se ubica como una insignia de verificación en la esquina
      // inferior derecha, siempre POR DEBAJO de las firmas (nunca antes),
      // para que no tape ninguna información previa; si el bloque de firmas
      // llega muy abajo, se corre aún más abajo o pasa a una página nueva.
      var qrY = Math.max(signBlockBottom + 14, 690 - qrSize);
      if (qrY + qrSize + 20 > 760) { doc.addPage(); qrY = margin + 10; }
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.6); doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.3); doc.setTextColor(120, 120, 120);
      doc.text("DOCUMENTO VALIDADO", qrX + qrSize / 2, qrY + qrSize + 9, { align: "center" });
      doc.text("ELECTRÓNICAMENTE", qrX + qrSize / 2, qrY + qrSize + 16, { align: "center" });
    } catch (e) {}

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
  /* Iniciales de un examen para las etiquetas pequeñas, donde no cabe el
     nombre completo (ej. "Cuadro Hemático (Hemograma IV)" -> "CH") — quita
     lo que va entre paréntesis y palabras de enlace, y si el nombre es una
     sola palabra usa sus primeras letras en vez de una sola inicial (ej.
     "Creatinina" -> "CREA") para que siga siendo reconocible. */
  function siglaExamen(nombre) {
    var limpio = (nombre || "").replace(/\([^)]*\)/g, "").trim();
    var stop = { de: 1, del: 1, y: 1, la: 1, el: 1, en: 1, con: 1, para: 1, los: 1, las: 1 };
    var palabras = limpio.split(/\s+/).filter(function (w) { return w && !stop[w.toLowerCase()]; });
    if (palabras.length <= 1) return (palabras[0] || nombre || "").substring(0, 4).toUpperCase();
    return palabras.map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }

  /* perfil (opcional): { anchoMm, altoMm } — ver "Impresoras y Tamaños de
     Etiqueta" en Configuración. Sin perfil, usa el tamaño estándar de
     siempre (9 x 3,8 cm) para no romper el diseño de quien no configuró
     nada. El diseño completo se reescala proporcionalmente al tamaño
     elegido; en etiquetas muy pequeñas (menos de 2,5 cm de alto) cambia a
     un diseño reducido, porque a ese tamaño el texto completo ya no cabe
     de forma legible. */
  function buildStickersPDF(order, patient, tenant, perfil) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var byTubo = {};
    order.examenes.forEach(function (ex) {
      var exCat = C.examenPorId(ex.examId);
      var key = exCat.tubo || "otro";
      (byTubo[key] = byTubo[key] || []).push(exCat);
    });
    var tuboKeys = Object.keys(byTubo);
    var anchoMm = (perfil && perfil.anchoMm) || 90;
    var altoMm = (perfil && perfil.altoMm) || 38;
    var orientacion = anchoMm >= altoMm ? "landscape" : "portrait";
    var compacto = altoMm < 25;
    var doc = new jsPDFCtor({ unit: "mm", format: [anchoMm, altoMm], orientation: orientacion });

    var k = altoMm / 38; // escala vertical respecto al diseño de referencia (9 x 3,8 cm)
    var barW = Math.min(6, anchoMm * 0.08);
    var mL = barW + 3;
    var rightPad = 3;

    tuboKeys.forEach(function (key, idx) {
      if (idx > 0) doc.addPage([anchoMm, altoMm], orientacion);
      var tubo = C.tuboInfo(key);
      var rgb = hexToRgb(tubo.color);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(0, 0, barW, altoMm, "F");
      doc.setTextColor(20, 20, 20);

      if (compacto) {
        var bcWc = anchoMm * 0.32, bcHc = altoMm * 0.4;
        var anchoTexto = anchoMm - mL - bcWc - rightPad - 2;
        var siglas = byTubo[key].map(function (e) { return siglaExamen(e.nombre); }).join(",");

        doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(6.5, altoMm * 0.26));
        doc.text(order.numeroOrden, mL, altoMm * 0.24);
        doc.setFont("helvetica", "normal"); doc.setFontSize(Math.max(5, altoMm * 0.17));
        doc.text(U.nombreCompleto(patient).substring(0, Math.round(anchoMm * 0.55)), mL, altoMm * 0.44, { maxWidth: anchoTexto });
        doc.setFontSize(Math.max(4.5, altoMm * 0.15));
        doc.text("Doc: " + patient.tipoDocumento + " " + patient.numeroDocumento, mL, altoMm * 0.64, { maxWidth: anchoTexto });
        doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(4.2, altoMm * 0.13));
        doc.text((tubo.nombre + (siglas ? " — " + siglas : "")).substring(0, Math.round(anchoMm * 1.1)), mL, altoMm * 0.88, { maxWidth: anchoTexto });
        try {
          var canvasC = document.createElement("canvas");
          window.JsBarcode(canvasC, order.numeroOrden, { format: "CODE128", width: 1, height: 30, displayValue: false, margin: 0 });
          doc.addImage(canvasC.toDataURL("image/png"), "PNG", anchoMm - bcWc - rightPad, altoMm * 0.08, bcWc, bcHc);
        } catch (e) {}
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(8 * k);
        doc.text((tenant.nombre || "").substring(0, 34), mL, 6 * k);
        if (order.prioridad === "Urgente") {
          doc.setTextColor(214, 69, 69); doc.setFontSize(7 * k); doc.text("URGENTE", anchoMm - rightPad, 6 * k, { align: "right" });
          doc.setTextColor(20, 20, 20);
        }
        doc.setFontSize(11 * k); doc.text(order.numeroOrden, mL, 13 * k);
        doc.setFontSize(8.5 * k); doc.text(U.nombreCompleto(patient).substring(0, 36), mL, 19 * k);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7 * k);
        doc.text(patient.tipoDocumento + " " + patient.numeroDocumento + " · " + (U.calcEdad(patient.fechaNacimiento) || ""), mL, 23.5 * k);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7 * k);
        doc.text(tubo.nombre, mL, 28 * k);
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.3 * k);
        doc.text(byTubo[key].map(function (e) { return e.nombre; }).join(", "), mL, 32 * k, { maxWidth: anchoMm - mL - rightPad });

        try {
          var canvas = document.createElement("canvas");
          window.JsBarcode(canvas, order.numeroOrden, { format: "CODE128", width: 1.2, height: 16, displayValue: false, margin: 0 });
          var bcW = anchoMm * 0.39, bcH = 9 * k;
          doc.addImage(canvas.toDataURL("image/png"), "PNG", anchoMm - bcW - rightPad, 4 * k, bcW, bcH);
        } catch (e) {}
      }
    });

    return doc;
  }

  function previewStickers(order, patient, tenant) {
    if (!order.examenes.length) { U.toast("Esta orden no tiene exámenes.", "error"); return; }
    var perfiles = tenant.perfilesEtiqueta || [];
    var perfilActual = perfiles.filter(function (p) { return p.predeterminado; })[0] || perfiles[0] || null;
    var doc = buildStickersPDF(order, patient, tenant, perfilActual);
    var wrap = U.openModal(
      '<h3 class="modal-title">Stickers de Muestra — Orden ' + order.numeroOrden + '</h3>' +
      '<p class="text-muted">Se genera un sticker por cada tipo de tubo/recipiente requerido para los exámenes de esta orden, listo para imprimir en impresora de etiquetas o papel normal.</p>' +
      (perfiles.length > 1
        ? '<div class="field" style="max-width:360px"><label>Impresora / Tamaño de etiqueta</label><select id="st-perfil">' +
          perfiles.map(function (p) { return '<option value="' + p.id + '" ' + (perfilActual && p.id === perfilActual.id ? "selected" : "") + '>' + U.esc(p.nombre) + " (" + p.anchoMm + " x " + p.altoMm + " mm)</option>"; }).join("") +
          "</select></div>"
        : "") +
      '<div class="flex gap-2" style="margin:10px 0">' +
      '<button class="btn btn-primary btn-sm" id="st-download">' + U.icon("download") + ' Descargar</button>' +
      '<button class="btn btn-outline btn-sm" id="st-print">' + U.icon("printer") + ' Abrir para Imprimir</button>' +
      '<button class="btn btn-ghost btn-sm" data-modal-close>Cerrar</button></div>' +
      '<iframe id="st-frame" style="width:100%;height:55vh;border:1px solid var(--border);border-radius:8px"></iframe>',
      { lg: true }
    );
    function actualizarFrame() { wrap.querySelector("#st-frame").src = doc.output("datauristring"); }
    actualizarFrame();
    var selPerfil = wrap.querySelector("#st-perfil");
    if (selPerfil) selPerfil.addEventListener("change", function () {
      perfilActual = perfiles.filter(function (p) { return p.id === selPerfil.value; })[0] || null;
      doc = buildStickersPDF(order, patient, tenant, perfilActual);
      actualizarFrame();
    });
    wrap.querySelector("#st-download").addEventListener("click", function () { doc.save("Stickers_" + order.numeroOrden + ".pdf"); });
    wrap.querySelector("#st-print").addEventListener("click", function () {
      window.open(doc.output("bloburl"), "_blank");
      U.toast("Se abrió en una nueva pestaña. Usa Ctrl+P (o Cmd+P) para imprimir.", "success");
    });
  }

  /* Impresión rápida: para el trabajo diario de recepción, generar el PDF y
     mandarlo directo al diálogo de imprimir del navegador (con el perfil de
     etiqueta predeterminado) — sin la ventana de vista previa de por medio.
     El navegador SIEMPRE va a mostrar su propio diálogo de impresión (por
     seguridad, ningún sitio web puede imprimir sin que el usuario lo
     confirme ahí) — lo que se elimina es el paso extra de previsualizar y
     abrir en pestaña nueva antes de llegar a ese diálogo. */
  function imprimirStickersRapido(order, patient, tenant) {
    if (!order.examenes.length) { U.toast("Esta orden no tiene exámenes.", "error"); return; }
    var perfiles = tenant.perfilesEtiqueta || [];
    var perfil = perfiles.filter(function (p) { return p.predeterminado; })[0] || perfiles[0] || null;
    var doc = buildStickersPDF(order, patient, tenant, perfil);
    var blobUrl = doc.output("bloburl");
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    iframe.src = blobUrl;
    var yaImprimio = false;
    function lanzarImpresion() {
      if (yaImprimio) return;
      yaImprimio = true;
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { window.open(blobUrl, "_blank"); }
    }
    iframe.onload = function () { setTimeout(lanzarImpresion, 150); };
    document.body.appendChild(iframe);
    setTimeout(lanzarImpresion, 1200); // respaldo por si el visor de PDF del navegador no dispara "load"
    setTimeout(function () { iframe.remove(); }, 60000);
    U.toast("Abriendo el diálogo de impresión de tu navegador…", "success");
  }

  global.BIO_PDF = {
    buildResultadosPDF: buildResultadosPDF, previewOrModal: previewOrModal, buildStickersPDF: buildStickersPDF,
    previewStickers: previewStickers, imprimirStickersRapido: imprimirStickersRapido
  };
})(window);

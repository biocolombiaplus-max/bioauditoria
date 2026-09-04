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
    // Un mismo bacteriólogo(a) no debe salir firmando dos veces el mismo
    // informe — puede pasar si validó exámenes distintos de la orden bajo
    // dos cuentas de usuario diferentes (ej. una cuenta duplicada por
    // error), lo que antes producía dos IDs distintos y, con ellos, dos
    // bloques de firma repitiendo el mismo nombre. Se deduplica también
    // por nombre (no solo por ID de usuario) para blindar este caso.
    var nombresVistos = {};
    firmantes = firmantes.filter(function (f) {
      var clave = String(f.nombre || "").trim().toLowerCase();
      if (nombresVistos[clave]) return false;
      nombresVistos[clave] = true;
      return true;
    });
    if (!firmantes.length) {
      firmantes = [{
        nombre: tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.nombre : "Bacteriólogo(a) Responsable",
        registroProfesional: tenant.bacteriologoResponsable ? tenant.bacteriologoResponsable.registro : "",
        firmaDataUrl: ""
      }];
    }
    return firmantes;
  }

  /* Las firmas escaneadas/fotografiadas, y los logos exportados desde un
     editor de diseño, suelen traer bastante espacio en blanco/transparente
     alrededor del trazo o el gráfico real — una firma "flota" lejos de la
     línea, y un logo "ancho completo" (ver logoAnchoCompleto más abajo)
     hereda ese espacio en blanco ampliado proporcionalmente al estirarlo,
     dejando un membrete que se ve más vacío/alto de lo necesario aunque el
     archivo en sí no cambió. Esta función recorta ese margen sobrante
     (detectando el rectángulo real del contenido visible) para que tanto la
     firma como el logo queden ajustados a su contenido real, sin importar
     cómo se haya exportado el archivo original — aplica por igual a lo ya
     cargado de cualquier cliente y a lo que se suba de ahora en adelante. */
  function recortarEspacioSobrante(dataUrl) {
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

  /* Encabezado "membrete" compartido por TODOS los documentos imprimibles
     con la marca del laboratorio (resultados, cotizaciones, recibos) — así
     un laboratorio que activa el membrete grande y centrado (Configuración
     → "Diseño del Reporte de Resultados") lo ve igual en cualquier PDF que
     genere, en vez de que cada generador tenga su propio encabezado
     independiente con un logo chico fijo. Dibuja el logo, el nombre del
     laboratorio y los datos de contacto, y devuelve el nuevo valor de "y"
     (justo debajo de la línea divisoria) para que el resto del documento
     continúe desde ahí. */
  async function dibujarMembrete(doc, tenant, margin) {
    var pageW = doc.internal.pageSize.getWidth();
    var y = margin;
    var rgb = hexToRgb(tenant.colorPrimario);
    // Tipografía elegida en Configuración (Helvetica/Times/Courier — las
    // 3 fuentes base que jsPDF sabe dibujar sin tener que incrustar un
    // archivo de fuente aparte). "helvetica" si el laboratorio nunca lo
    // ha tocado, para no cambiar nada a quien no pidió esto.
    var fontFam = tenant.fuenteReporte || "helvetica";

    // Prepara un logo para dibujarlo dentro de una caja de ancho "boxW":
    // recorta su espacio en blanco/transparente sobrante (ver
    // recortarEspacioSobrante) y calcula el alto según sus proporciones
    // reales, con un tope de altura para que un logo muy vertical no se
    // desborde. La usan tanto el logo propio como el "logo secundario"
    // (tenant.logoSecundarioDataUrl) — algunos laboratorios necesitan dos
    // logos en el membrete, ej. el propio y el del laboratorio aliado que
    // procesa la muestra, uno junto al otro.
    async function prepararLogo(url, boxW, alturaMaxima) {
      var w = boxW, h = boxW, urlFinal = url;
      try {
        var r = await recortarEspacioSobrante(url);
        if (r && r.w && r.h) {
          urlFinal = r.url;
          h = boxW * (r.h / r.w);
          if (alturaMaxima && h > alturaMaxima) { h = alturaMaxima; w = h * (r.w / r.h); }
        }
      } catch (e) {}
      return { url: urlFinal, w: w, h: h };
    }

    // Se agrupan los datos de contacto en 2 líneas densas en vez de 4 (una
    // por dato) — nunca se pierde ningún dato, solo se juntan con " · " —
    // para que el encabezado (sobre todo el membrete grande, ver
    // logoGrandeReporte más abajo) no gaste una línea entera completa en un
    // solo campo, muchas veces vacío (ej. "Resolución de Habilitación" casi
    // nunca aplica fuera de Colombia).
    // El "Código REPS" es un registro exclusivo de Colombia (Registro
    // Especial de Prestadores de Servicios de Salud) — no aplica a
    // laboratorios de otros países aunque el campo tenga un valor guardado
    // (ej. de una migración de datos), así que solo se imprime para CO.
    var metaLineA = C.documentoTributarioLabel(tenant.pais) + " " + tenant.nit +
      (tenant.codigoREPS && tenant.pais === "CO" ? " · Código REPS " + tenant.codigoREPS : "") +
      (tenant.resolucionHabilitacion ? " · " + tenant.resolucionHabilitacion : "");
    var metaLineB = [tenant.direccion, tenant.telefonos, tenant.email, tenant.sitioWeb].filter(Boolean).join(" · ");
    var metaLines = [metaLineA, metaLineB].filter(Boolean);

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
      // El logo "a todo el ancho" es un membrete deliberadamente compacto
      // (pedido puntual, ej. Yamdan): arranca mucho más pegado al borde
      // superior que el resto del informe (22pt en vez del margen general
      // de 40pt) — hay margen de sobra para imprimirse bien en cualquier
      // impresora normal, y así no se desperdicia espacio arriba del logo.
      if (tenant.logoAnchoCompleto) y = 22;
      if (tenant.logoDataUrl) {
        // "Logo a todo el ancho": el logo ya trae el nombre del
        // laboratorio dibujado adentro, así que se estira a todo el ancho
        // de contenido de la hoja EN VEZ del cuadrado fijo de 76pt.
        // Primero se recorta el espacio en blanco/transparente sobrante
        // del archivo (ver recortarEspacioSobrante) — muchos logos
        // exportados traen bastante margen alrededor del gráfico real, y
        // al estirarlos a todo el ancho ese margen se amplía
        // proporcionalmente, dejando un membrete más alto y "vacío" de lo
        // necesario aunque el logo en sí se vea bien. Con el recorte, las
        // proporciones que se usan son las del contenido visible real,
        // nunca se fuerza a cuadrado. Se limita además una altura máxima
        // (deliberadamente baja, para un membrete discreto) para que un
        // logo genuinamente vertical no desborde la hoja.
        if (tenant.logoAnchoCompleto) {
          // El ancho lo controla el propio laboratorio con un control
          // deslizante en Configuración (tenant.logoAnchoPorcentaje, 20-100%
          // del ancho de contenido de la hoja — 55% si nunca lo ha tocado),
          // en vez de un tamaño fijo calculado a ciegas — así se ajusta
          // directo, sin ir y venir probando valores. La altura sale
          // siempre de las proporciones reales del archivo ya recortado
          // (nunca se fuerza a cuadrado), con un tope de seguridad solo
          // para el caso extremo de un logo genuinamente vertical.
          var porcentaje = (tenant.logoAnchoPorcentaje || 55) / 100;
          var anchoDisponible = (pageW - margin * 2) * porcentaje;
          if (tenant.logoSecundarioDataUrl) {
            // Dos logos lado a lado (ej. el propio y el de un laboratorio
            // aliado que procesa la muestra) — cada uno se recorta y
            // escala dentro de la mitad del espacio que le toca, y se
            // alinean por el centro vertical de la fila más alta.
            var gapLogos = 14;
            var mitad = (anchoDisponible - gapLogos) / 2;
            var logoIzq = await prepararLogo(tenant.logoDataUrl, mitad, 90);
            var logoDer = await prepararLogo(tenant.logoSecundarioDataUrl, mitad, 90);
            var altoFila = Math.max(logoIzq.h, logoDer.h);
            var startX = cx - anchoDisponible / 2;
            try { doc.addImage(logoIzq.url, "PNG", startX, y + (altoFila - logoIzq.h) / 2, logoIzq.w, logoIzq.h); } catch (e) {}
            try { doc.addImage(logoDer.url, "PNG", startX + anchoDisponible - logoDer.w, y + (altoFila - logoDer.h) / 2, logoDer.w, logoDer.h); } catch (e) {}
            y += altoFila + 2;
          } else {
            var logoW = anchoDisponible;
            var logoH = logoW;
            var logoParaDibujar = tenant.logoDataUrl;
            try {
              var recorteLogo = await recortarEspacioSobrante(tenant.logoDataUrl);
              if (recorteLogo && recorteLogo.w && recorteLogo.h) {
                logoParaDibujar = recorteLogo.url;
                logoH = logoW * (recorteLogo.h / recorteLogo.w);
                var alturaMaxima = 140;
                if (logoH > alturaMaxima) { logoH = alturaMaxima; logoW = logoH * (recorteLogo.w / recorteLogo.h); }
              }
            } catch (e) {}
            try { doc.addImage(logoParaDibujar, "PNG", cx - logoW / 2, y, logoW, logoH); } catch (e) {}
            y += logoH + 2;
          }
        } else if (tenant.logoSecundarioDataUrl) {
          var gapPar = 10, boxPar = 64;
          var parIzq = await prepararLogo(tenant.logoDataUrl, boxPar, boxPar);
          var parDer = await prepararLogo(tenant.logoSecundarioDataUrl, boxPar, boxPar);
          var altoPar = Math.max(parIzq.h, parDer.h);
          var totalPar = parIzq.w + gapPar + parDer.w;
          var startPar = cx - totalPar / 2;
          try { doc.addImage(parIzq.url, "PNG", startPar, y - 4 + (altoPar - parIzq.h) / 2, parIzq.w, parIzq.h); } catch (e) {}
          try { doc.addImage(parDer.url, "PNG", startPar + parIzq.w + gapPar, y - 4 + (altoPar - parDer.h) / 2, parDer.w, parDer.h); } catch (e) {}
          y += altoPar + 12;
        } else {
          var logoCentradoSize = 76;
          try { doc.addImage(tenant.logoDataUrl, "PNG", cx - logoCentradoSize / 2, y - 4, logoCentradoSize, logoCentradoSize); } catch (e) {}
          y += logoCentradoSize + 12;
        }
      } else {
        y += tenant.logoAnchoCompleto ? 40 + 2 : 76 + 12;
      }
      // Si el logo ya trae el nombre del laboratorio dibujado (como el de
      // Yamdan), mostrar además el nombre en texto debajo queda repetido —
      // se puede ocultar desde Configuración.
      if (!tenant.ocultarNombreEncabezado) {
        doc.setFont(fontFam, "bold"); doc.setFontSize(16); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(tenant.nombre, cx, y, { align: "center" });
        y += 13;
      }
      if (tenant.slogan) {
        doc.setFont(fontFam, "italic"); doc.setFontSize(10.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(tenant.slogan, cx, y, { align: "center" });
        y += 11;
      }
      // "A lo largo": los datos de contacto van en UNA sola línea horizontal
      // (en vez de apiladas una debajo de otra) — el membrete queda mucho
      // más bajo. Nada se pierde, solo se separa con " · " en una sola
      // fila, centrada como el resto del membrete.
      doc.setFont(fontFam, "normal"); doc.setFontSize(8);
      if (tenant.datosPacienteEstiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(90, 90, 90);
      var metaLineUnica = metaLines.join("   ·   ");
      if (metaLineUnica) { doc.text(metaLineUnica, cx, y, { align: "center" }); y += 8.5; }
      y += 2;
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
      doc.line(margin, y, pageW - margin, y); y += 14;
    } else {
      // El logo se ve grande y premium (70pt en una hoja carta completa)
      // pero ya no ocupa tanto encabezado como antes (llegó a subir hasta
      // 100pt) — entre el membrete y los datos del paciente se estaba
      // yendo demasiada hoja en blanco (queja real reportada, ajustada más
      // de una vez hasta comprimirlo lo suficiente). El nombre y los datos
      // del laboratorio se recorren proporcionalmente para que el
      // encabezado se vea equilibrado. Esta función también la usan
      // documentos en hojas más angostas (ej. el recibo de pago en media
      // carta), así que el tope real es relativo al ancho de la página —
      // en una hoja carta da exactamente 70pt como siempre, pero en una
      // más angosta se achica en proporción en vez de quedar desbordado.
      var logoSize = Math.min(70, (pageW - margin * 2) * 0.155);
      if (tenant.logoDataUrl) {
        try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 9, logoSize, logoSize); } catch (e) {}
      }
      // Logo secundario (ej. un laboratorio aliado que procesa la
      // muestra) arriba a la derecha, con el mismo tope de tamaño que el
      // logo propio pero respetando sus proporciones reales — el patrón
      // clásico de "nuestro logo a la izquierda, el del laboratorio que
      // procesa a la derecha" que usan varios laboratorios clínicos.
      if (tenant.logoSecundarioDataUrl) {
        var logoDerDefault = await prepararLogo(tenant.logoSecundarioDataUrl, logoSize, logoSize);
        try { doc.addImage(logoDerDefault.url, "PNG", pageW - margin - logoDerDefault.w, y - 9, logoDerDefault.w, logoDerDefault.h); } catch (e) {}
      }
      var textX = margin + (tenant.logoDataUrl ? logoSize + 14 : 0);
      doc.setFont(fontFam, "bold"); doc.setFontSize(15); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(tenant.nombre, textX, y + 12);
      var metaStartOffset = 25;
      if (tenant.slogan) {
        doc.setFont(fontFam, "italic"); doc.setFontSize(9); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(tenant.slogan, textX, y + 23);
        metaStartOffset = 35;
      }
      doc.setFont(fontFam, "normal"); doc.setFontSize(8.5);
      if (tenant.datosPacienteEstiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(90, 90, 90);
      metaLines.forEach(function (line, i) { doc.text(line, textX, y + metaStartOffset + i * 10); });

      doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(2);
      y += tenant.slogan ? 74 : 64; doc.line(margin, y, pageW - margin, y); y += 12;
    }
    return y;
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
    // Tipografía elegida en Configuración (Helvetica/Times/Courier) —
    // "helvetica" si el laboratorio nunca lo ha tocado.
    var fontFam = tenant.fuenteReporte || "helvetica";
    // Tamaño de letra elegido en Configuración para el cuerpo del informe
    // (la tabla de parámetro/resultado/referencia/interpretación, y las
    // tablas de paneles y de exámenes remitidos) — 8pt si el laboratorio
    // nunca lo ha tocado (el tamaño que siempre usó el sistema). El título
    // del método y de cada grupo de examen se ajustan proporcionalmente
    // para conservar la jerarquía visual sin importar el tamaño elegido.
    var tamanoBase = tenant.tamanoFuenteReporte || 8;

    y = await dibujarMembrete(doc, tenant, margin);

    // Encabezado compacto para hojas 2, 3… cuando el laboratorio activa
    // "Repetir el encabezado en todas las hojas" (Configuración → Diseño
    // del Reporte de Resultados) — antes toda hoja adicional arrancaba
    // completamente en blanco arriba. El logo se recorta UNA sola vez aquí
    // (misma función que usa el membrete grande de la portada) para poder
    // dibujarlo de nuevo en cada salto de página de forma síncrona, sin
    // repetir el recorte async en medio de un forEach.
    var logoRepetido = null;
    if (tenant.membreteEnTodasLasHojas && tenant.logoDataUrl) {
      try {
        var rLogoRep = await recortarEspacioSobrante(tenant.logoDataUrl);
        logoRepetido = (rLogoRep && rLogoRep.w && rLogoRep.h) ? rLogoRep : { url: tenant.logoDataUrl, w: 1, h: 1 };
      } catch (e) { logoRepetido = { url: tenant.logoDataUrl, w: 1, h: 1 }; }
    }
    function nuevaPagina() {
      doc.addPage();
      if (!tenant.membreteEnTodasLasHojas) return margin;
      var yy = margin;
      var cajaLogo = 26;
      if (logoRepetido) {
        var wLogo = cajaLogo, hLogo = cajaLogo * (logoRepetido.h / logoRepetido.w);
        if (hLogo > cajaLogo) { hLogo = cajaLogo; wLogo = hLogo * (logoRepetido.w / logoRepetido.h); }
        try { doc.addImage(logoRepetido.url, "PNG", margin, yy - 4, wLogo, hLogo); } catch (e) {}
      }
      var textX = margin + (logoRepetido ? cajaLogo + 10 : 0);
      doc.setFont(fontFam, "bold"); doc.setFontSize(10.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(tenant.nombre, textX, yy + 7);
      doc.setFont(fontFam, "normal"); doc.setFontSize(8);
      if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(90, 90, 90);
      doc.text(U.nombreCompleto(patient) + " — Orden " + order.numeroOrden, textX, yy + 18);
      yy += cajaLogo + 4;
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1);
      doc.line(margin, yy, pageW - margin, yy);
      return yy + 14;
    }

    // Estilo "discreto" del encabezado de datos del paciente (opción en
    // Configuración → Diseño del Reporte de Resultados, pedida puntual por
    // un cliente): sin el título "Informe de Resultados…", y el aviso de
    // "Informe Parcial" no sale arriba sino debajo de la firma del
    // bacteriólogo(a) en la última hoja (ver más abajo, junto al bloque de
    // firmas), indicando qué examen específico sigue pendiente. El aviso
    // de "Resultado Preliminar" sí se queda arriba en ambos estilos.
    var estiloDiscreto = !!tenant.datosPacienteEstiloDiscreto;
    if (!estiloDiscreto) {
      doc.setFont(fontFam, "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
      doc.text("INFORME DE RESULTADOS DE LABORATORIO CLÍNICO", margin, y);
      y += 10;
    }
    // El aviso de preliminar/parcial va en su PROPIA línea debajo del
    // título (antes iba a la derecha, en la misma línea que el título, y
    // con textos largos las dos frases se montaban una sobre la otra).
    if (modo === "preliminar") {
      doc.setFont(fontFam, "bold"); doc.setFontSize(9.5); doc.setTextColor(201, 126, 13);
      doc.text("RESULTADO PRELIMINAR — SUJETO A VALIDACIÓN FINAL", margin, y);
      y += 11;
    } else if (order.estadoGeneral !== "validado" && !estiloDiscreto) {
      doc.setFont(fontFam, "bold"); doc.setFontSize(9.5); doc.setTextColor(201, 126, 13);
      doc.text("INFORME PARCIAL — HAY EXÁMENES EN PROCESO", margin, y);
      y += 11;
    } else {
      y += 3;
    }

    // El nombre y el documento del paciente van destacados, cada uno en su
    // propia línea, más grandes y en negrita — son los dos datos que
    // primero se buscan al leer el informe — en vez de mezclados en la
    // misma cuadrícula chica que el resto de los datos. La columna
    // derecha (N° de orden, fecha, médico, procedencia) arranca desde el
    // mismo punto de partida que el nombre, no desde abajo del documento
    // — si no, queda un hueco vacío arriba a la derecha y el bloque se ve
    // descuadrado.
    var yInfoStart = y;
    var col1 = margin, col2 = pageW / 2 + 10;

    // Estilo discreto: el nombre lleva su propia etiqueta "Nombre:" (antes
    // salía suelto, sin decir qué dato es) y, junto con el documento, se
    // imprime en negro puro y peso normal — no negrita — igual que el
    // resto del bloque de datos del paciente, pedido puntual de un cliente
    // para que el informe se lea bien incluso con una impresora floja.
    doc.setFont(fontFam, estiloDiscreto ? "normal" : "bold"); doc.setFontSize(12.5);
    if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(20, 20, 20);
    doc.text((estiloDiscreto ? "Nombre: " : "") + U.nombreCompleto(patient), col1, y);
    y += 12;
    doc.setFont(fontFam, estiloDiscreto ? "normal" : "bold"); doc.setFontSize(10.5);
    if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(50, 50, 50);
    doc.text(patient.tipoDocumento + " " + patient.numeroDocumento, col1, y);
    y += 11;

    doc.setFont(fontFam, "normal");
    doc.setFontSize(estiloDiscreto ? 9 : 9.5);
    if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(30, 30, 30);
    var edad = U.edadTexto(patient);
    // Qué datos adicionales van en el reporte, elegido en Configuración
    // → "Diseño del Reporte de Resultados". Nombre, documento, N° de
    // orden y fecha son siempre obligatorios (son los identificadores
    // básicos de cualquier informe clínico); estos 4 son opcionales —
    // "true" salvo que el laboratorio los haya apagado explícitamente,
    // para no cambiar nada a quien nunca tocó esta configuración.
    var campos = tenant.camposReporte || {};
    var left = [];
    // Estilo discreto: "Edad:" y "Sexo:" en su propia fila cada uno (en
    // vez de "Edad / Sexo: 52 años / Masculino" en una sola), pedido
    // puntual de un cliente.
    if (campos.edadSexo !== false) {
      if (estiloDiscreto) { left.push(["Edad:", edad]); left.push(["Sexo:", patient.sexo]); }
      else left.push(["Edad / Sexo:", edad + " / " + patient.sexo]);
    }
    if (patient.pais === "CO" && campos.eps !== false) left.push(["EPS / Asegurador:", patient.eps || "Particular"]);
    var right = [
      ["N° de Orden:", order.numeroOrden],
      ["Fecha de Orden:", U.fmtFecha(order.fechaOrden)],
      ["Fecha de Impresión:", U.fmtFecha(new Date().toISOString())]
    ];
    if (campos.medico !== false) right.push(["Médico Remitente:", order.medicoRemitente || "—"]);
    if (campos.procedencia !== false) right.push(["Procedencia:", order.procedencia || "—"]);
    // Los datos del paciente van en negrita (etiqueta y valor) para un
    // informe con más carácter profesional, en vez de valores en fuente
    // normal más discretos. El valor arranca a un ancho fijo desde el
    // inicio de la etiqueta — con etiquetas cortas ("Edad / Sexo:") se ve
    // bien alineado, pero una más larga ("EPS / Asegurador:", "Fecha de
    // Impresión:") no cabía en ese ancho fijo y el valor quedaba montado
    // encima del final de la etiqueta (bug real reportado). Ahora el valor
    // arranca justo después del ancho real de CADA etiqueta (medido con la
    // misma fuente/tamaño ya aplicados), con un margen fijo, así nunca se
    // solapan sin importar qué tan larga sea.
    doc.setFont(fontFam, estiloDiscreto ? "normal" : "bold");
    left.forEach(function (row, i) {
      doc.text(row[0], col1, y + i * 11);
      doc.text(String(row[1]), col1 + doc.getTextWidth(row[0]) + 6, y + i * 11);
    });
    right.forEach(function (row, i) {
      doc.text(row[0], col2, yInfoStart + i * 11);
      doc.text(String(row[1]), col2 + doc.getTextWidth(row[0]) + 6, yInfoStart + i * 11);
    });
    y = Math.max(y + left.length * 11, yInfoStart + right.length * 11) + 8;

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
            fila: [p.nombre + (p.calculado ? " (calculado)" : ""), val + (p.unidad ? " " + p.unidad : ""), refFormateado, flag.texto || ""],
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

      // Antes de dibujar el banner de la sección, se verifica que quepa
      // completo junto con el encabezado de la tabla y al menos el primer
      // examen — si no cabe, se pasa de página ANTES del banner, en vez de
      // dejarlo solo al fondo de la página sin ninguna fila debajo (que es
      // justo lo que se veía feo: el banner de una sección quedando
      // huérfano al final de una página y los resultados empezando recién
      // en la siguiente).
      // Estilo del banner de sección — el bloque sólido con el color de
      // marca es el de siempre, pero un laboratorio puede preferir un
      // estilo más neutro/minimalista sin ese bloque de color (opción en
      // Configuración → "Diseño del Reporte de Resultados"), solo texto en
      // negrita con una línea fina debajo — también un poco más compacto.
      var alturaBanner = tenant.bandaSeccionSinColor ? 18 : 20;
      var altoPrimerGrupo = grupos.length ? altoGrupo(grupos[0]) : 0;
      if (y + alturaBanner + HEAD_H + altoPrimerGrupo > pageBottom) { y = nuevaPagina(); }

      if (tenant.bandaSeccionSinColor) {
        if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(30, 30, 30);
        doc.setFont(fontFam, "bold"); doc.setFontSize(9.5);
        doc.text(C.seccionNombre(seccionId, tenant).toUpperCase(), margin, y + 9);
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.8);
        doc.line(margin, y + 13, pageW - margin, y + 13);
      } else {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(margin, y, pageW - margin * 2, 16, "F");
        doc.setTextColor(255, 255, 255); doc.setFont(fontFam, "bold"); doc.setFontSize(9.5);
        doc.text(C.seccionNombre(seccionId, tenant).toUpperCase(), margin + 6, y + 11);
      }
      y += alturaBanner;

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
        // Estilo discreto: toda la tabla (encabezados y celdas) arranca en
        // negro puro por defecto — antes usaba el gris tenue por defecto
        // de la librería de tablas, que se ve mal en impresoras de baja
        // calidad. Los casos con significado especial (Resultado en
        // negrita, Interpretación anormal en rojo) se siguen resolviendo
        // aparte, en didParseCell más abajo.
        var stylesTabla = { font: fontFam, fontSize: tamanoBase, cellPadding: 4 };
        if (estiloDiscreto) stylesTabla.textColor = [0, 0, 0];
        doc.autoTable({
          startY: y, margin: { left: margin, right: margin },
          head: [["Parámetro", "Resultado", "Valor de Referencia", "Interpretación"]],
          body: body, theme: "grid", styles: stylesTabla,
          headStyles: { fillColor: [240, 244, 247], textColor: estiloDiscreto ? [0, 0, 0] : 40, fontStyle: "bold" },
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
            // Estilo discreto (Carreño): "Valor de Referencia" en negro
            // puro y peso normal — sin esta opción, esa columna sale con el
            // gris grisáceo por defecto de la librería de tablas.
            if (data.column.index === 2 && estiloDiscreto) {
              data.cell.styles.textColor = [0, 0, 0]; data.cell.styles.fontStyle = "normal";
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
          y = nuevaPagina();
          doc.setFont(fontFam, "italic"); doc.setFontSize(8);
          if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(120, 120, 120);
          doc.text(C.seccionNombre(seccionId, tenant).toUpperCase() + " (continuación)", margin, y);
          y += 14;
          yEstimado = y + HEAD_H;
        } else {
          yEstimado += necesita;
        }
        body.push([{ content: g.nombre, colSpan: 4, styles: { fillColor: [246, 247, 249], textColor: estiloDiscreto ? [0, 0, 0] : [50, 50, 50], fontStyle: "bold", fontSize: tamanoBase + 0.5 } }]);
        filaMeta.push({ tipo: "titulo" });
        if (g.metodo) {
          body.push([{ content: "Método: " + g.metodo, colSpan: 4, styles: { fontStyle: "italic", textColor: estiloDiscreto ? [0, 0, 0] : [140, 140, 140], fontSize: tamanoBase - 1.2 } }]);
          filaMeta.push({ tipo: "metodo" });
        }
        g.filas.forEach(function (f) {
          body.push(f.fila);
          filaMeta.push({ tipo: "dato", anormal: f.anormal });
        });
      });
      volcarTablaSeccion();

      panelesDeSeccion.forEach(function (panelInfo) {
        if (y > 690) { y = nuevaPagina(); }
        doc.setFont(fontFam, "bold"); doc.setFontSize(9); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text((panelInfo.p.panelTipo === "alergia" ? "PANEL DE ALERGIA" : "ANTIBIOGRAMA") + " — " + panelInfo.exNombre, margin, y);
        y += 12;
        // El método solo se repite aquí si ese examen no tiene su propia
        // fila-título en la tabla principal de arriba (ej. un panel de
        // alergia que es 100% panel, sin ningún parámetro normal) — si ya
        // salió junto a su nombre en la tabla, no hace falta mostrarlo de nuevo.
        var metodoPanel = !examIdsConGrupo[panelInfo.exId] ? (C.examenEfectivo(panelInfo.exId, tenant).metodo || "") : "";
        if (metodoPanel) {
          doc.setFont(fontFam, "italic"); doc.setFontSize(7);
          if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(140, 140, 140);
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
            theme: "grid", styles: { font: fontFam, fontSize: tamanoBase, cellPadding: 4, textColor: estiloDiscreto ? [0, 0, 0] : undefined }, headStyles: { fillColor: [240, 244, 247], textColor: estiloDiscreto ? [0, 0, 0] : 40, fontStyle: "bold" },
            didParseCell: function (data) {
              if (data.section === "body" && data.column.index === 3 && interpPorFila[data.row.index] && interpPorFila[data.row.index].interpretacion === "Positivo") {
                data.cell.styles.textColor = [214, 69, 69]; data.cell.styles.fontStyle = "bold";
              }
            }
          });
        } else {
          // La columna de CIM (Concentración Inhibitoria Mínima) solo se
          // imprime si el laboratorio la activó en Configuración — la
          // mayoría trabaja solo con disco-difusión (Sensible/Intermedio/
          // Resistente) y no necesita esta columna extra.
          var conCIM = !!tenant.reportarCIM;
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin },
            head: [conCIM ? ["Antibiótico", "Resultado", "CIM (µg/mL)"] : ["Antibiótico", "Resultado"]],
            body: panelInfo.items.map(function (it) { return conCIM ? [it.nombre, it.resultado || "-", it.cim || "-"] : [it.nombre, it.resultado || "-"]; }),
            theme: "grid", styles: { font: fontFam, fontSize: tamanoBase, cellPadding: 4, textColor: estiloDiscreto ? [0, 0, 0] : undefined }, headStyles: { fillColor: [240, 244, 247], textColor: estiloDiscreto ? [0, 0, 0] : 40, fontStyle: "bold" },
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
        doc.setFont(fontFam, "italic"); doc.setFontSize(8);
        if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(80, 80, 80);
        obsExams.forEach(function (ex) {
          var exCat = C.examenEfectivo(ex.examId, tenant);
          var texto = (obsExams.length > 1 ? exCat.nombre + " — " : "") + "Observaciones: " + ex.observaciones;
          var lineas = doc.splitTextToSize(texto, pageW - margin * 2);
          if (y + lineas.length * 10 > 750) { y = nuevaPagina(); }
          doc.text(lineas, margin, y);
          y += lineas.length * 10 + 3;
        });
      }
      y += 8;
    });

    if (referidos.length) {
      if (y > 680) { y = nuevaPagina(); }
      doc.setFillColor(90, 90, 90);
      doc.rect(margin, y, pageW - margin * 2, 16, "F");
      doc.setTextColor(255, 255, 255); doc.setFont(fontFam, "bold"); doc.setFontSize(9.5);
      doc.text("EXÁMENES PROCESADOS POR LABORATORIO DE REFERENCIA", margin + 6, y + 11);
      y += 24;
      doc.autoTable({
        startY: y, margin: { left: margin, right: margin },
        head: [["Examen", "Laboratorio de Referencia", "Nota"]],
        body: referidos.map(function (ex) {
          var exCat = C.examenEfectivo(ex.examId, tenant);
          return [exCat.nombre, ex.laboratorioRemision || "—", "Ver informe original anexo en las páginas siguientes"];
        }),
        theme: "grid", styles: { font: fontFam, fontSize: tamanoBase, cellPadding: 4, textColor: estiloDiscreto ? [0, 0, 0] : undefined }, headStyles: { fillColor: [240, 244, 247], textColor: estiloDiscreto ? [0, 0, 0] : 40, fontStyle: "bold" }
      });
      y = doc.lastAutoTable.finalY + 18;
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
      if (y > 700) { y = nuevaPagina(); }
      if (f.firmaDataUrl) {
        try {
          var recorte = await recortarEspacioSobrante(f.firmaDataUrl);
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
      doc.setFont(fontFam, estiloDiscreto ? "normal" : "bold"); doc.setFontSize(9);
      if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(20, 20, 20);
      doc.text(f.nombre, margin, y + 22);
      doc.setFont(fontFam, "normal"); doc.setFontSize(8);
      if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(90, 90, 90);
      doc.text(f.registroProfesional ? "Registro Profesional: " + f.registroProfesional : "", margin, y + 33);
      doc.text(C.tituloFirmaProfesional(tenant.pais), margin, y + 44);
      y += 62;
    }

    // Estilo discreto: el aviso de "Informe Parcial" no va arriba del todo
    // (ver más arriba) sino AQUÍ, debajo de la firma del bacteriólogo(a),
    // en la última hoja — e indica cuáles exámenes específicos siguen
    // pendientes, en vez de solo avisar que "hay exámenes en proceso" sin
    // decir cuáles.
    if (estiloDiscreto && modo !== "preliminar" && order.estadoGeneral !== "validado") {
      var pendientes = order.examenes.filter(function (ex) { return examsToShow.indexOf(ex) === -1; });
      var nombresPendientes = pendientes.map(function (ex) { return C.examenEfectivo(ex.examId, tenant).nombre; });
      if (y > 720) { y = nuevaPagina(); }
      y += 6;
      doc.setFont(fontFam, "bold"); doc.setFontSize(9.5); doc.setTextColor(201, 126, 13);
      doc.text("INFORME PARCIAL — HAY EXÁMENES EN PROCESO", margin, y);
      y += 12;
      if (nombresPendientes.length) {
        doc.setFont(fontFam, "normal"); doc.setFontSize(8.5);
        if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(90, 90, 90);
        var lineasPendientes = doc.splitTextToSize("Pendiente(s): " + nombresPendientes.join(", ") + ".", pageW - margin * 2);
        doc.text(lineasPendientes, margin, y);
        y += lineasPendientes.length * 10 + 4;
      }
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
      // Pie de página personalizado (opcional, definido en Configuración →
      // "Diseño del Reporte de Resultados") — una frase propia del
      // laboratorio (ej. su promesa de calidad, sus controles internos),
      // pedida para salir CENTRADA en la hoja y debajo de la insignia del
      // QR de verificación, en vez de arriba del bloque de firmas como
      // antes — así el cierre del informe queda con el QR, el eslogan y el
      // pie de página juntos, como lo manejan otros laboratorios de
      // referencia.
      var lineasPie = tenant.piePaginaPersonalizado ? doc.splitTextToSize(tenant.piePaginaPersonalizado, pageW - margin * 2 - 60) : [];
      var altoPie = lineasPie.length ? lineasPie.length * 10 + 12 : 0;
      // El QR se ubica como una insignia de verificación en la esquina
      // inferior derecha, siempre POR DEBAJO de las firmas (nunca antes),
      // para que no tape ninguna información previa; si el bloque de firmas
      // llega muy abajo, se corre aún más abajo o pasa a una página nueva.
      // Si el laboratorio tiene un eslogan, se reserva espacio de sobra
      // debajo de la insignia del QR para imprimirlo ahí también (con
      // estilo, en cursiva y en su color de marca) — un toque de cierre
      // más premium que dejar la insignia sola con el texto técnico de
      // "documento validado electrónicamente" — y lo mismo para el pie de
      // página personalizado, que va debajo de todo lo anterior.
      var espacioSlogan = tenant.slogan ? 20 : 0;
      var espacioReservado = qrSize + 20 + espacioSlogan + altoPie;
      // El ancla (antes 690) dejaba un tramo de hoja en blanco bastante
      // grande entre la insignia del QR y el pie de página (770) — se sube
      // a 748 para que la insignia quede pegada de verdad a la esquina
      // inferior, con solo el aire justo antes del pie de página (queja
      // real reportada: "el QR más en la esquina, no tan arriba").
      var qrY = Math.max(signBlockBottom + 14, 748 - espacioReservado);
      if (qrY + espacioReservado > 760) { qrY = nuevaPagina() + 10; }
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.6); doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
      doc.setFont(fontFam, "bold"); doc.setFontSize(6.3);
      if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(120, 120, 120);
      doc.text("DOCUMENTO VALIDADO", qrX + qrSize / 2, qrY + qrSize + 9, { align: "center" });
      doc.text("ELECTRÓNICAMENTE", qrX + qrSize / 2, qrY + qrSize + 16, { align: "center" });
      var yDebajoQr = qrY + qrSize + 16;
      if (tenant.slogan) {
        doc.setFont(fontFam, "italic"); doc.setFontSize(7.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        // Alineado a la derecha con el propio borde derecho del QR (que ya
        // coincide con el margen derecho de la hoja) — así el texto se
        // extiende hacia la izquierda tanto como haga falta, sin arriesgarse
        // nunca a salirse por ningún lado de la página, ni depender de un
        // cálculo de centrado más frágil.
        var anchoSlogan = Math.min(160, qrX + qrSize - margin);
        var lineasSloganQr = doc.splitTextToSize(tenant.slogan, anchoSlogan);
        doc.text(lineasSloganQr, qrX + qrSize, yDebajoQr + 9, { align: "right" });
        yDebajoQr += 9 + (lineasSloganQr.length - 1) * 9;
      }
      if (lineasPie.length) {
        doc.setFont(fontFam, "italic"); doc.setFontSize(8.5);
        if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(90, 90, 90);
        doc.text(lineasPie, pageW / 2, yDebajoQr + 16, { align: "center" });
      }
    } catch (e) {}

    doc.setFontSize(7);
    if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ". Los resultados deben interpretarse en conjunto con la clínica del paciente.", margin, 770, { maxWidth: pageW - margin * 2 });

    // Numeración "1/2, 2/2…" en el pie de cada hoja — el total de páginas
    // solo se sabe hasta este punto, con el documento ya completo, así que
    // se recorre cada página ya dibujada y se le agrega el número encima
    // (jsPDF sí permite volver a una página anterior con setPage()). Esto
    // numera únicamente las hojas que arma BIOsoft (esta parte del informe);
    // si además hay resultados remitidos fusionados de un laboratorio
    // externo (ver más abajo), esas páginas vienen de otro PDF ya
    // maquetado por ese laboratorio y no se renumeran.
    var totalPaginas = doc.internal.getNumberOfPages();
    for (var numPagina = 1; numPagina <= totalPaginas; numPagina++) {
      doc.setPage(numPagina);
      doc.setFont(fontFam, "normal"); doc.setFontSize(7);
      if (estiloDiscreto) doc.setTextColor(0, 0, 0); else doc.setTextColor(140, 140, 140);
      doc.text("Página " + numPagina + "/" + totalPaginas, pageW - margin, 770, { align: "right" });
    }

    var coverBytes = new Uint8Array(doc.output("arraybuffer"));
    if (!referidos.length) return coverBytes;

    try {
      var PDFDocument = window.PDFLib.PDFDocument;
      var finalDoc = await PDFDocument.load(coverBytes);
      for (var i = 0; i < referidos.length; i++) {
        var refEx = referidos[i];
        if (!refEx.pdfRemitidoDataUrl) continue;
        var donorBytes = dataUrlToUint8Array(refEx.pdfRemitidoDataUrl);
        var donor = await PDFDocument.load(donorBytes);
        var recorteMm = refEx.pdfRemitidoRecorteMm || 0;
        if (!recorteMm) {
          var pages = await finalDoc.copyPages(donor, donor.getPageIndices());
          pages.forEach(function (p) { finalDoc.addPage(p); });
          continue;
        }
        // Con recorte pedido: la primera página del PDF del laboratorio
        // de referencia se pega SIN su franja superior (donde suele ir
        // su logo y sus datos), y encima se dibuja el membrete PROPIO
        // del laboratorio — para el paciente, el resultado remitido se
        // ve como una página más del informe, no como un documento
        // ajeno pegado. jsPDF (que dibuja membretes) y pdf-lib (que
        // recorta/incrusta PDFs ajenos) son librerías distintas que no
        // comparten un mismo lienzo, así que se arma en dos pasos:
        // primero se dibuja el membrete en un PDF chico aparte con
        // jsPDF, se copia esa página ya lista al documento final, y
        // AHÍ ENCIMA se incrusta (con pdf-lib) el contenido recortado
        // del laboratorio de referencia, debajo de la línea del
        // membrete. Si algo sale mal (ej. un PDF con un formato que
        // pdf-lib no logra leer), se cae al comportamiento de siempre:
        // pegar el PDF completo del laboratorio de referencia tal cual.
        try {
          var exCatRef = C.examenEfectivo(refEx.examId, tenant);
          var headerDoc = new jsPDFCtor({ unit: "pt", format: "letter" });
          var yHeader = await dibujarMembrete(headerDoc, tenant, margin);
          headerDoc.setFont(fontFam, "bold"); headerDoc.setFontSize(9.5); headerDoc.setTextColor(rgb[0], rgb[1], rgb[2]);
          headerDoc.text("RESULTADO REMITIDO — " + (exCatRef ? exCatRef.nombre : ""), margin, yHeader);
          yHeader += 12;
          headerDoc.setFont(fontFam, "italic"); headerDoc.setFontSize(8); headerDoc.setTextColor(110, 110, 110);
          headerDoc.text("Procesado por laboratorio de referencia: " + (refEx.laboratorioRemision || "—") + " — documento original disponible como respaldo interno.", margin, yHeader, { maxWidth: pageW - margin * 2 });
          yHeader += 16;
          var headerBytes = new Uint8Array(headerDoc.output("arraybuffer"));
          var headerDonor = await PDFDocument.load(headerBytes);
          var headerPages = await finalDoc.copyPages(headerDonor, [0]);
          var nuevaPagina = headerPages[0];
          finalDoc.addPage(nuevaPagina);

          var donorPage = donor.getPage(0);
          var donorSize = donorPage.getSize();
          var recortePt = recorteMm * (72 / 25.4); // mm -> pt
          var altoUtilDonante = Math.max(1, donorSize.height - recortePt);
          var anchoDisponible = pageW - margin * 2;
          var altoDisponible = Math.max(1, (pageH - 55) - yHeader);
          var escala = Math.min(anchoDisponible / donorSize.width, altoDisponible / altoUtilDonante);
          var anchoDibujado = donorSize.width * escala;
          var altoDibujado = altoUtilDonante * escala;
          var embebida = await finalDoc.embedPage(donorPage, { left: 0, bottom: 0, right: donorSize.width, top: altoUtilDonante });
          nuevaPagina.drawPage(embebida, { x: margin, y: pageH - yHeader - altoDibujado, width: anchoDibujado, height: altoDibujado });

          // El resto de páginas del PDF remitido (si tiene más de una) se
          // pegan tal cual, sin recortar — normalmente solo la primera
          // trae el logo/encabezado completo del laboratorio de referencia.
          if (donor.getPageCount() > 1) {
            var restoPages = await finalDoc.copyPages(donor, donor.getPageIndices().slice(1));
            restoPages.forEach(function (p) { finalDoc.addPage(p); });
          }
        } catch (eRecorte) {
          var pagesFallback = await finalDoc.copyPages(donor, donor.getPageIndices());
          pagesFallback.forEach(function (p) { finalDoc.addPage(p); });
        }
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
      '<div style="border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:16px">' +
      '<h3 class="modal-title" style="margin:0">Informe de Resultados</h3>' +
      '<p class="text-muted" style="margin:4px 0 0;font-size:13px">Orden ' + order.numeroOrden + '</p>' +
      '</div>' +
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
      var exCat = C.examenEfectivo(ex.examId, tenant);
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
        doc.text(patient.tipoDocumento + " " + patient.numeroDocumento + " · " + (U.edadTexto(patient) || ""), mL, 23.5 * k);
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
    previewStickers: previewStickers, imprimirStickersRapido: imprimirStickersRapido,
    dibujarMembrete: dibujarMembrete
  };
})(window);

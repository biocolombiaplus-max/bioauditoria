/* BIOsoft — Generación de Contrato de Prestación de Servicios y Recibo de Pago (CRM) */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;

  var PROVEEDOR = {
    nombre: "BIO Colombia Plus",
    representanteLegal: "Juan Carlos Cáceres Medina",
    nit: "88262856-1",
    producto: "BIOsoft — Software de Gestión de Laboratorio Clínico",
    correo: "biomarketing.salud@gmail.com",
    whatsapp: "573505457420"
  };

  function fechaLarga(d) {
    return (d instanceof Date ? d : new Date(d)).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  }

  var UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
    "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte"];
  var DECENAS = { 30: "treinta", 40: "cuarenta", 50: "cincuenta", 60: "sesenta", 70: "setenta", 80: "ochenta", 90: "noventa" };
  function numeroEnPalabras(n) {
    if (n <= 20) return UNIDADES[n];
    if (n < 30) return "veinti" + UNIDADES[n - 20];
    var decena = Math.floor(n / 10) * 10;
    var unidad = n % 10;
    if (!DECENAS[decena]) return String(n);
    return unidad ? DECENAS[decena] + " y " + UNIDADES[unidad] : DECENAS[decena];
  }
  function numeroConDigito(n) { return numeroEnPalabras(n) + " (" + n + ")"; }

  function encabezado(doc, margin, titulo, subtitulo) {
    var pageW = doc.internal.pageSize.getWidth();
    var y = margin;
    try { doc.addImage("assets/logo-biosoft.png", "PNG", margin, y - 8, 40, 40); } catch (e) {}
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(46, 16, 101);
    doc.text("BIOsoft", margin + 50, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    doc.text(PROVEEDOR.nombre + " · NIT " + PROVEEDOR.nit + " · Rep. Legal " + PROVEEDOR.representanteLegal, margin + 50, y + 18);
    doc.text(PROVEEDOR.correo + " · WhatsApp +" + PROVEEDOR.whatsapp, margin + 50, y + 29);
    y += 50;
    doc.setDrawColor(249, 115, 22); doc.setLineWidth(1.4); doc.line(margin, y, pageW - margin, y);
    y += 26;
    var maxW = pageW - margin * 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 20, 20);
    // Un título largo (ej. "CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE Y
    // LICENCIA DE USO") se parte en varias líneas, reservando el ancho de la
    // derecha para la fecha — antes se dibujaban uno encima del otro cuando
    // el título no cabía en una sola línea junto a la fecha (bug real
    // detectado al alargar el título del contrato).
    var tituloLines = doc.splitTextToSize(titulo, subtitulo ? maxW * 0.66 : maxW);
    doc.text(tituloLines, margin, y);
    if (subtitulo) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(120, 120, 120);
      doc.text(subtitulo, pageW - margin, y, { align: "right" });
    }
    return y + tituloLines.length * 16 + 8;
  }

  function piePagina(doc, margin) {
    var pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 772, { maxWidth: pageW - margin * 2 });
  }

  // Marco normativo de protección de datos personales que aplica según el
  // país de domicilio de EL CLIENTE — se cita en la cláusula de Tratamiento
  // de Datos del contrato (ver DÉCIMA más abajo). Colombia lleva la cita
  // completa (Ley 1581 de 2012 + sus decretos reglamentarios) porque es el
  // marco bajo el cual se redacta y rige este contrato (EL PROVEEDOR está
  // domiciliado en Colombia); para VE/EC/MX se remite a la normativa local
  // vigente sin inventar una cita puntual que no se pueda sostener.
  var NORMATIVA_DATOS_PAIS = {
    CO: "la Ley Estatutaria 1581 de 2012, su Decreto Reglamentario 1377 de 2013 (compilado en el Decreto Único Reglamentario 1074 de 2015, Título 2, Capítulo 25) y demás normas que las adicionen, modifiquen o sustituyan, en materia de protección de datos personales y datos sensibles de salud",
    VE: "la normativa vigente en la República Bolivariana de Venezuela en materia de protección de datos personales y confidencialidad de la información de salud",
    EC: "la Ley Orgánica de Protección de Datos Personales de la República del Ecuador y demás normas vigentes en materia de confidencialidad de la información de salud",
    MX: "la Ley Federal de Protección de Datos Personales en Posesión de los Particulares de México y demás normas vigentes en materia de datos personales sensibles de salud"
  };
  function normativaDatosDe(pais) { return NORMATIVA_DATOS_PAIS[pais] || NORMATIVA_DATOS_PAIS.CO; }

  // -----------------------------------------------------------------------
  // LICENCIA DE FUNCIONAMIENTO DE SOFTWARE
  // -----------------------------------------------------------------------
  // Número de licencia ÚNICO y ESTABLE por laboratorio: una vez generado la
  // primera vez, debe quedar guardado en tenant.licenciaNumero (lo hace
  // quien llama a esta función, ver views-admin.js -> abrirEnviarLicencia)
  // para que reimprimir la licencia más adelante (ej. tras un cambio de
  // plan) NUNCA cambie el número ya entregado al cliente — igual que un
  // número de cédula o de matrícula, que no cambia entre reimpresiones.
  function generarNumeroLicencia(tenant) {
    if (tenant.licenciaNumero) return tenant.licenciaNumero;
    var anio = new Date().getFullYear();
    var sufijo = String(tenant.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
    while (sufijo.length < 6) sufijo = "0" + sufijo;
    return "BIOSOFT-LIC-" + anio + "-" + sufijo;
  }

  function cargarImagenLocal(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { resolve(null); };
      image.src = url;
    });
  }

  function buildQrDataUrlLocal(texto, sizePx) {
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
    ctx.fillStyle = "#2e1065";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(Math.round(c * cell), Math.round(r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    return canvas.toDataURL("image/png");
  }

  var VERSION_SOFTWARE = "BIOsoft Cloud — Edición 2026.1";

  // Certificado de licencia, en formato apaisado (landscape) para que se
  // vea como un diploma/certificado y no como una hoja de contrato más —
  // pensado para enmarcar o mostrar con orgullo, con los datos técnicos
  // exactos que debe llevar la licencia de un software: número único,
  // producto, versión, tipo y modalidad de licencia, alcance de uso,
  // titular, vigencia, infraestructura y el marco normativo que ampara el
  // tratamiento de la información que procesará. Incluye un código QR de
  // verificación (mismo mecanismo que ya usa BIOsoft en órdenes/etiquetas,
  // ver pdf.js -> buildQrDataUrl) para que cualquiera pueda confirmar su
  // autenticidad escaneándolo.
  function buildLicenciaPDF(cliente, plan, opts) {
    opts = opts || {};
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter", orientation: "landscape" });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var margin = 34;
    var lab = cliente.laboratorio || {};
    var contacto = cliente.contacto || {};
    var numero = opts.numero || generarNumeroLicencia({ id: opts.tenantId });
    var fechaExpedicion = opts.fechaExpedicion ? new Date(opts.fechaExpedicion) : new Date();
    var textoVerificacion = "BIOsoft · Licencia " + numero + " · " + (lab.nombre || "") + " · " + fechaLarga(fechaExpedicion);

    return Promise.all([cargarImagenLocal("assets/logo-biosoft.png"), Promise.resolve(buildQrDataUrlLocal(textoVerificacion, 260))]).then(function (res) {
      var logoImg = res[0], qrDataUrl = res[1];

      // Marco decorativo doble (línea gruesa exterior en el color de marca +
      // línea fina interior en dorado/naranja) — el acabado "certificado" que
      // se ve en un diploma, en vez de los márgenes planos de un contrato.
      doc.setDrawColor(46, 16, 101); doc.setLineWidth(3);
      doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);
      doc.setDrawColor(249, 115, 22); doc.setLineWidth(1);
      doc.rect(margin + 8, margin + 8, pageW - (margin + 8) * 2, pageH - (margin + 8) * 2);

      var innerMargin = margin + 26;
      var innerW = pageW - innerMargin * 2;
      // Zona inferior FIJA (firma, sello, código QR y pie de página), medida
      // desde el fondo de la hoja — nunca depende de cuánto mida el
      // contenido de arriba. Antes, la firma y el pie se dibujaban a partir
      // de un "y" que iba creciendo con el contenido (incluido el párrafo de
      // cumplimiento normativo, que es más largo para laboratorios en
      // Colombia por la mención a la Resolución 3100), y en un certificado
      // apaisado de una sola hoja ese acumulado se salía por debajo del
      // marco decorativo — bug real reportado ("las firmas quedan por fuera
      // del documento"). Con la firma anclada aquí, SIEMPRE queda dentro del
      // marco sin importar el país ni el largo del nombre del laboratorio.
      var yFirma = pageH - margin - 66;
      var yPie = pageH - margin - 15;
      var y = margin + 40;

      if (logoImg) { try { doc.addImage(logoImg, "PNG", innerMargin, y - 22, 40, 40); } catch (e) {} }
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(46, 16, 101);
      doc.text("BIOsoft", innerMargin + (logoImg ? 50 : 0), y + 2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
      doc.text(PROVEEDOR.nombre + " · NIT " + PROVEEDOR.nit, innerMargin + (logoImg ? 50 : 0), y + 14);

      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(249, 115, 22);
      doc.text("N.° DE LICENCIA", pageW - innerMargin, y - 9, { align: "right" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 20, 20);
      doc.text(numero, pageW - innerMargin, y + 7, { align: "right" });

      y += 32;
      doc.setDrawColor(230, 225, 240); doc.setLineWidth(1);
      doc.line(innerMargin, y, pageW - innerMargin, y);
      y += 26;

      doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(46, 16, 101);
      doc.text("LICENCIA DE FUNCIONAMIENTO DE SOFTWARE", pageW / 2, y, { align: "center" });
      y += 15;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(120, 120, 120);
      doc.text("Software como Servicio (SaaS) para la Gestión Integral de Laboratorio Clínico", pageW / 2, y, { align: "center" });
      y += 24;

      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(80, 80, 80);
      doc.text("Se certifica que", pageW / 2, y, { align: "center" });
      y += 19;
      // Un nombre de laboratorio muy largo se reduce hasta que quepa en el
      // ancho disponible, en vez de desbordarse fuera del marco decorativo
      // (mismo patrón de achicar la letra que ya usa el nombre del paciente
      // en pdf.js).
      var nombreLabTxt = lab.nombre || "—";
      var fsNombreLab = 17;
      doc.setFont("helvetica", "bold"); doc.setFontSize(fsNombreLab);
      while (doc.getTextWidth(nombreLabTxt) > innerW - 40 && fsNombreLab > 11) {
        fsNombreLab -= 0.5;
        doc.setFontSize(fsNombreLab);
      }
      doc.setTextColor(20, 20, 20);
      doc.text(nombreLabTxt, pageW / 2, y, { align: "center" });
      y += 15;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90);
      doc.text((lab.nit ? C.documentoTributarioLabel(lab.pais) + " " + lab.nit : "") + (contacto.nombre ? "  ·  Representante: " + contacto.nombre : ""), pageW / 2, y, { align: "center" });
      y += 13;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("es Licenciatario autorizado, bajo modalidad de suscripción, para el uso de " + PROVEEDOR.producto, pageW / 2, y, { align: "center", maxWidth: innerW - 200 });

      y += 24;
      var colW = innerW / 2 - 14;
      var col1x = innerMargin, col2x = innerMargin + innerW / 2 + 14;
      var filasIzq = [
        ["Producto", PROVEEDOR.producto],
        ["Versión del sistema", VERSION_SOFTWARE],
        ["Tipo de licencia", "SaaS — Suscripción, uso no exclusivo e intransferible"],
        ["Plan contratado", plan ? plan.nombre + " (" + plan.usuarios + ")" : "—"]
      ];
      var filasDer = [
        ["Fecha de expedición", fechaLarga(fechaExpedicion)],
        ["Vigencia", "Indefinida, sujeta al pago vigente de la suscripción"],
        ["País de operación autorizado", lab.pais || "—"],
        ["Alojamiento de la información", "Google Cloud / Firebase, con cifrado en tránsito y en reposo"]
      ];
      function tablaLicencia(x, filas) {
        var yy = y;
        filas.forEach(function (f) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(7.6); doc.setTextColor(249, 115, 22);
          doc.text(f[0].toUpperCase(), x, yy);
          yy += 10;
          doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
          var lines = doc.splitTextToSize(f[1], colW);
          doc.text(lines, x, yy);
          yy += lines.length * 10.5 + 7;
        });
        return yy;
      }
      var y1 = tablaLicencia(col1x, filasIzq);
      var y2 = tablaLicencia(col2x, filasDer);
      y = Math.max(y1, y2) + 4;

      doc.setDrawColor(230, 225, 240); doc.line(innerMargin, y, pageW - innerMargin, y);
      y += 13;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(46, 16, 101);
      doc.text("CUMPLIMIENTO NORMATIVO", innerMargin, y);
      y += 10;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(70, 70, 70);
      var textoCumplimiento = "El tratamiento de la información alojada en esta licencia se sujeta a " + normativaDatosDe(lab.pais) +
        (lab.pais === "CO" ? ", y el sistema incorpora las funcionalidades técnicas de trazabilidad, respaldo, disponibilidad y confidencialidad de la información orientadas a apoyar el cumplimiento de la Resolución 3100 de 2019 del Ministerio de Salud y Protección Social" : "") +
        ". El detalle completo consta en el Contrato de Prestación de Servicios suscrito entre las partes.";
      // Ancho reducido (deja libre la franja derecha para el sello y el QR,
      // alineados a esta misma altura, ver yIconos abajo) y máximo de
      // líneas acotado al espacio real disponible antes de la zona FIJA de
      // firma (yFirma) — si el texto no cupiera completo (nunca debería, ya
      // está medido para el peor caso: país CO con la mención a la
      // Resolución 3100), se recorta con "…" en vez de invadir la firma.
      var maxLineasCumplimiento = Math.max(3, Math.floor((yFirma - 12 - y) / 9.2));
      var lineasCumplimiento = doc.splitTextToSize(textoCumplimiento, innerW - 175);
      if (lineasCumplimiento.length > maxLineasCumplimiento) {
        lineasCumplimiento = lineasCumplimiento.slice(0, maxLineasCumplimiento);
        lineasCumplimiento[maxLineasCumplimiento - 1] = lineasCumplimiento[maxLineasCumplimiento - 1].replace(/\s*$/, "") + "…";
      }
      doc.text(lineasCumplimiento, innerMargin, y, { lineHeightFactor: 9.2 / 7.8 });

      // Sello circular "oficial" + QR de verificación, en la franja derecha
      // — alineados con el inicio del párrafo de la izquierda (mismo "y"),
      // en su propia columna, así que nunca chocan con el texto sin
      // importar cuántas líneas use (el texto tiene su propio límite y
      // nunca pasa de yFirma, ver maxLineasCumplimiento arriba).
      var yIconos = y - 2;
      var selloX = pageW - innerMargin - 58, selloY = yIconos + 32;
      doc.setDrawColor(249, 115, 22); doc.setLineWidth(1.5);
      doc.circle(selloX, selloY, 32);
      doc.setDrawColor(46, 16, 101); doc.setLineWidth(0.8);
      doc.circle(selloX, selloY, 26);
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(46, 16, 101);
      doc.text("BIOSOFT", selloX, selloY - 4, { align: "center" });
      doc.setFontSize(5.6); doc.setTextColor(120, 120, 120);
      doc.text("LICENCIA", selloX, selloY + 4, { align: "center" });
      doc.text("OFICIAL", selloX, selloY + 11, { align: "center" });

      if (qrDataUrl) {
        var qrSize = 60;
        var qrX = pageW - innerMargin - 60 - 100;
        try { doc.addImage(qrDataUrl, "PNG", qrX, yIconos, qrSize, qrSize); } catch (e) {}
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.4); doc.setTextColor(140, 140, 140);
        doc.text("Escanea para verificar", qrX + qrSize / 2, yIconos + qrSize + 9, { align: "center" });
      }

      var col2f = innerMargin + innerW / 2 + 10;
      var firmaW = 84, firmaH = firmaW * (140 / 548);
      try { doc.addImage("assets/firma-proveedor.png", "PNG", innerMargin - 4, yFirma - firmaH - 4, firmaW, firmaH); } catch (e) {}
      doc.setDrawColor(180, 180, 180); doc.line(innerMargin, yFirma, innerMargin + 170, yFirma); doc.line(col2f, yFirma, col2f + 170, yFirma);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.2); doc.setTextColor(20, 20, 20);
      doc.text(PROVEEDOR.representanteLegal, innerMargin, yFirma + 12);
      doc.text(numero, col2f, yFirma + 12);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); doc.setTextColor(90, 90, 90);
      doc.text("Representante Legal — " + PROVEEDOR.nombre, innerMargin, yFirma + 22);
      doc.text("Código de verificación de esta licencia", col2f, yFirma + 22);

      doc.setFont("helvetica", "normal"); doc.setFontSize(6.6); doc.setTextColor(150, 150, 150);
      doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", pageW / 2, yPie, { align: "center" });

      return new Uint8Array(doc.output("arraybuffer"));
    });
  }

  // -----------------------------------------------------------------------
  // CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE Y LICENCIA DE USO
  // -----------------------------------------------------------------------
  function buildContratoPDF(cliente, plan, modalidadPago, opts) {
    opts = opts || {};
    var cicloDias = opts.cicloCobroDias || 30;
    var mesesMembresia = opts.mesesMembresia || 6;
    var mesesCortesia = opts.mesesCortesia || 0;
    var numeroLicencia = opts.numeroLicencia || generarNumeroLicencia(opts.tenantParaLicencia || { id: opts.tenantId });
    var IMPL = (window.BIO_PLANES && window.BIO_PLANES.IMPLEMENTACION) || { copFmt: "380.000", usd: 120, cuotaCopFmt: "190.000", cuotaUsd: 60 };
    var esSemestral = modalidadPago === "semestral";
    var esSinImplementacion = modalidadPago === "sin_implementacion";
    var esContado = modalidadPago === "contado";
    // Un laboratorio puede tener un descuento adicional negociado sobre el
    // precio de lista del Plan (ver "Editar Plan" en Laboratorios Cliente ->
    // tenant.descuentoPlan, un % guardado por laboratorio) — cuando existe,
    // la mensualidad que se cita en TODO el contrato es la YA descontada,
    // nunca el precio de lista, y se deja constancia expresa del descuento
    // y del precio de lista original para que quede claro cuánto se
    // descontó.
    var descuentoPlan = opts.descuentoPlan > 0 ? Math.min(opts.descuentoPlan, 100) : 0;
    var precioEfectivoCop = descuentoPlan ? Math.round(plan.precio * (1 - descuentoPlan / 100)) : plan.precio;
    var precioEfectivoUsd = descuentoPlan ? Math.round(plan.usd * (1 - descuentoPlan / 100)) : plan.usd;
    var precioEfectivoFmt = precioEfectivoCop.toLocaleString("es-CO");
    var notaDescuentoPlan = descuentoPlan
      ? (" Este valor ya incluye un descuento adicional del " + descuentoPlan + "% acordado con EL CLIENTE sobre el precio de lista del Plan " + plan.nombre + " ($" + plan.precioFmt + " COP / aprox. $" + plan.usd + " USD).")
      : "";
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 50;
    var maxW = pageW - margin * 2;
    var lab = cliente.laboratorio || {};
    var contacto = cliente.contacto || {};
    var normativaDatos = normativaDatosDe(lab.pais);

    var y = encabezado(doc, margin, "CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE Y LICENCIA DE USO", fechaLarga(new Date()));

    function checkPage(minSpace) {
      if (y > 770 - (minSpace || 40)) { doc.addPage(); y = margin; }
    }
    function titulo(t) {
      checkPage(50);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(249, 115, 22);
      doc.text(t, margin, y); y += 14;
    }
    function parrafo(t) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
      var lines = doc.splitTextToSize(t, maxW);
      checkPage(lines.length * 12 + 10);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 14;
    }
    function bullets(items) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
      items.forEach(function (it) {
        var lines = doc.splitTextToSize("• " + it, maxW - 8);
        checkPage(lines.length * 12 + 4);
        doc.text(lines, margin + 6, y);
        y += lines.length * 12 + 3;
      });
      y += 12;
    }

    parrafo(
      "Entre los suscritos, " + PROVEEDOR.nombre + ", identificado con NIT " + PROVEEDOR.nit + ", representado legalmente por " +
      PROVEEDOR.representanteLegal + " (en adelante, “EL PROVEEDOR”), y " + (lab.nombre || "el laboratorio cliente") +
      (lab.nit ? ", identificado con " + C.documentoTributarioLabel(lab.pais) + " " + lab.nit : "") + " (en adelante, “EL CLIENTE”), representado por " +
      (contacto.nombre || "su representante") + (contacto.cargo ? " (" + contacto.cargo + ")" : "") +
      ", se celebra el presente Contrato de Prestación de Servicios de Software y Licencia de Uso (en adelante, “el Contrato”), el cual se regirá por las leyes de la República de Colombia y, en particular por el Código de Comercio, el Código Civil y la Ley 1581 de 2012, bajo las siguientes cláusulas:"
    );

    titulo("PRIMERA — DEFINICIONES");
    parrafo("Para efectos del Contrato, los siguientes términos tendrán el significado que se indica a continuación:");
    bullets([
      "“Software” o “el Sistema”: la plataforma " + PROVEEDOR.producto + ", identificada como " + VERSION_SOFTWARE + ", incluyendo sus actualizaciones, módulos y funcionalidades, prestada bajo la modalidad de software como servicio (SaaS).",
      "“Licencia de Uso”: el derecho no exclusivo, intransferible y revocable que EL PROVEEDOR otorga a EL CLIENTE para usar el Software conforme a la cláusula TERCERA, formalizado además en el certificado “Licencia de Funcionamiento de Software” N.° " + numeroLicencia + " expedido junto con este Contrato.",
      "“Datos del Cliente”: la información clínica, administrativa y de pacientes que EL CLIENTE y sus usuarios autorizados ingresen, almacenen o generen dentro del Software.",
      "“Usuario Autorizado”: toda persona natural vinculada a EL CLIENTE (administradores, bacteriólogos, auxiliares u otro personal) a quien EL CLIENTE le asigne una cuenta de acceso al Software bajo su propia responsabilidad.",
      "“Incidente de Seguridad”: todo evento que comprometa la confidencialidad, integridad o disponibilidad de los Datos del Cliente."
    ]);

    titulo("SEGUNDA — OBJETO");
    parrafo(
      "EL PROVEEDOR se obliga a prestar a EL CLIENTE el servicio de software " + PROVEEDOR.producto +
      ", bajo la modalidad de software como servicio (SaaS), incluyendo la personalización, configuración, capacitación, soporte técnico y la Licencia de Uso descritos en este Contrato."
    );

    titulo("TERCERA — LICENCIA DE USO DEL SOFTWARE");
    parrafo(
      "EL PROVEEDOR otorga a EL CLIENTE, durante la vigencia del Contrato y sujeto al pago oportuno de la suscripción, una licencia de uso NO EXCLUSIVA, INTRANSFERIBLE Y REVOCABLE sobre el Software, limitada al número de usuarios simultáneos que permita el Plan contratado (cláusula CUARTA) y al uso interno de EL CLIENTE para la gestión de su propio laboratorio clínico. Esta licencia NO incluye la venta, cesión, sublicenciamiento, distribución, ingeniería inversa, descompilación ni copia del código fuente del Software, cuya titularidad se mantiene en cabeza de EL PROVEEDOR conforme a la cláusula NOVENA. El certificado “Licencia de Funcionamiento de Software” N.° " +
      numeroLicencia + ", expedido junto con este Contrato, es el documento técnico que identifica de forma única esta Licencia de Uso, y sus datos (número, producto, versión, alcance y vigencia) hacen parte integral del Contrato. La Licencia de Uso se suspende automáticamente durante cualquier período de suspensión del servicio por mora (cláusula OCTAVA) y se extingue de pleno derecho a la terminación del Contrato (cláusula DÉCIMA SEXTA)."
    );

    titulo("CUARTA — PLAN CONTRATADO");
    parrafo(
      "EL CLIENTE contrata el Plan " + plan.nombre + " (" + plan.usuarios + "), por un valor mensual de $" + precioEfectivoFmt + " COP (aprox. $" + precioEfectivoUsd + " USD)" +
      (descuentoPlan ? (", que ya incluye un descuento adicional del " + descuentoPlan + "% sobre el precio de lista de dicho Plan ($" + plan.precioFmt + " COP / aprox. $" + plan.usd + " USD)") : "") +
      " — ver el detalle de la forma de pago en la cláusula SEXTA. El Plan incluye:"
    );
    bullets(plan.items || []);

    titulo("QUINTA — PERSONALIZACIÓN Y PLAZO DE ENTREGA");
    parrafo(
      "El software será configurado y personalizado según las necesidades específicas de EL CLIENTE: logo, colores institucionales, catálogo de exámenes y valores de referencia, firmas digitales de los bacteriólogos, y el formato del informe de resultados que reciben sus pacientes." +
      (cliente.seccionesTexto ? " Las secciones del laboratorio configuradas inicialmente son: " + cliente.seccionesTexto + "." : "") +
      " EL CLIENTE tendrá acceso al software desde la confirmación de su primer pago, sin necesidad de esperar a que la personalización esté finalizada. El plazo estimado para completar la personalización total del sistema es de " +
      "SIETE (7) A DIEZ (10) DÍAS HÁBILES, y los ajustes puntuales que EL CLIENTE solicite durante ese proceso se atenderán en un plazo de DOS (2) A CUATRO (4) DÍAS HÁBILES según la complejidad del ajuste." +
      " El primer período de mensualidad inicia en la fecha que ocurra primero entre: (i) la puesta en marcha del sistema totalmente personalizado para EL CLIENTE, o (ii) el registro del primer paciente en la plataforma. Los ajustes o solicitudes de personalización adicionales que EL CLIENTE realice después de la puesta en marcha no afectan, modifican ni eliminan la información ya registrada (pacientes, órdenes, resultados), preservando en todo momento la continuidad e integridad del historial clínico."
    );

    titulo("SEXTA — VALOR DEL SERVICIO");
    parrafo(
      esSemestral
        ? ("EL CLIENTE ha optado por la modalidad de membresía prepagada: cancela por adelantado el valor correspondiente a sus primeros " + numeroConDigito(mesesMembresia) + " meses de mensualidad del Plan " + plan.nombre + " ($" + precioEfectivoFmt + " COP c/u, aprox. $" + precioEfectivoUsd + " USD), quedando exento del pago de la cuota de implementación (valor $" + IMPL.copFmt + " COP / aprox. $" + IMPL.usd + " USD), la cual EL PROVEEDOR condona en su totalidad bajo esta modalidad. Vencidos los primeros " + numeroConDigito(mesesMembresia) + " meses, EL CLIENTE continuará pagando la mensualidad ordinaria del Plan " + plan.nombre + "." + notaDescuentoPlan)
        : esSinImplementacion
        ? ("EL PROVEEDOR condona en su totalidad la cuota de implementación (valor $" + IMPL.copFmt + " COP / aprox. $" + IMPL.usd + " USD) para EL CLIENTE. EL CLIENTE pagará únicamente la mensualidad ordinaria de $" + precioEfectivoFmt + " COP (aprox. $" + precioEfectivoUsd + " USD) correspondiente al Plan " + plan.nombre + ", desde la fecha de activación del servicio." +
            (mesesCortesia > 0 ? (" Como cortesía adicional, EL PROVEEDOR no cobrará mensualidad durante los primeros " + numeroConDigito(mesesCortesia) + " meses; transcurrido ese plazo, EL CLIENTE pagará la mensualidad ordinaria del Plan " + plan.nombre + ".") : "") + notaDescuentoPlan)
        : esContado
        ? ("EL CLIENTE pagará la cuota de implementación por valor de $" + IMPL.copFmt + " COP (aprox. $" + IMPL.usd + " USD) EN UN SOLO PAGO, junto con la mensualidad del primer mes. A partir del mes dos (2), EL CLIENTE solo pagará la mensualidad ordinaria de $" + precioEfectivoFmt + " COP (aprox. $" + precioEfectivoUsd + " USD) correspondiente al Plan " + plan.nombre + ". La cuota de implementación no se cobra nuevamente bajo ninguna circunstancia una vez cancelada en su totalidad, sin importar el tiempo que EL CLIENTE continúe usando el software." +
            (mesesCortesia > 0 ? (" Como cortesía adicional, EL PROVEEDOR no cobrará mensualidad durante los primeros " + numeroConDigito(mesesCortesia) + " meses; transcurrido ese plazo, EL CLIENTE pagará la mensualidad ordinaria del Plan " + plan.nombre + ".") : "") + notaDescuentoPlan)
        : ("EL CLIENTE pagará una cuota de implementación por valor de $" + IMPL.copFmt + " COP (aprox. $" + IMPL.usd + " USD), fraccionada en DOS (2) cuotas iguales de $" + IMPL.cuotaCopFmt + " COP (aprox. $" + IMPL.cuotaUsd + " USD) cada una, cobradas junto con la mensualidad de los meses uno (1) y dos (2). A partir del mes tres (3), EL CLIENTE solo pagará la mensualidad ordinaria de $" + precioEfectivoFmt + " COP (aprox. $" + precioEfectivoUsd + " USD) correspondiente al Plan " + plan.nombre + ". La cuota de implementación no se cobra nuevamente bajo ninguna circunstancia una vez cancelada en su totalidad, sin importar el tiempo que EL CLIENTE continúe usando el software." +
            (mesesCortesia > 0 ? (" Como cortesía adicional, EL PROVEEDOR no cobrará mensualidad durante los primeros " + numeroConDigito(mesesCortesia) + " meses; transcurrido ese plazo, EL CLIENTE pagará la mensualidad ordinaria del Plan " + plan.nombre + ".") : "") + notaDescuentoPlan)
    );

    titulo("SÉPTIMA — FORMA DE PAGO Y PERIODICIDAD");
    parrafo(
      "La mensualidad se cobrará cada " + numeroConDigito(cicloDias) + " días calendario, contados a partir de la fecha de inicio de facturación definida en la cláusula QUINTA. El pago se realiza a través de los medios habilitados por EL PROVEEDOR (Wompi u otros que se informen oportunamente)."
    );

    titulo("OCTAVA — POLÍTICA DE MORA Y SUSPENSIÓN DEL SERVICIO");
    parrafo(
      "En caso de no recibirse el pago de la mensualidad en la fecha de corte, EL PROVEEDOR otorgará un plazo de gracia de cinco (5) días calendario, durante el cual notificará a EL CLIENTE por los medios de contacto registrados. Transcurrido dicho plazo sin que se registre el pago, EL PROVEEDOR podrá suspender temporalmente el acceso al software (incluyendo la Licencia de Uso otorgada en la cláusula TERCERA) hasta que se regularice la situación, sin que ello genere responsabilidad alguna para EL PROVEEDOR por la interrupción del servicio. El acceso se restablece automáticamente al confirmarse el pago. La información de EL CLIENTE nunca se elimina por mora: solo se restringe el acceso mientras esta subsista."
    );

    titulo("NOVENA — PROPIEDAD INTELECTUAL");
    parrafo(
      "El Software, su código fuente, arquitectura, marcas, logotipos, documentación y demás elementos que lo componen son de propiedad exclusiva de EL PROVEEDOR (o de sus licenciantes) y están protegidos por las normas de propiedad intelectual y derechos de autor vigentes. El Contrato no transfiere a EL CLIENTE ningún derecho de propiedad sobre el Software, distinto de la Licencia de Uso otorgada en la cláusula TERCERA. En contraste, los Datos del Cliente (información de pacientes, órdenes, resultados e historial clínico ingresado al Software) son y seguirán siendo en todo momento de exclusiva propiedad de EL CLIENTE; EL PROVEEDOR no adquiere ningún derecho de propiedad sobre ellos por el solo hecho de alojarlos o procesarlos."
    );

    titulo("DÉCIMA — TRATAMIENTO DE DATOS PERSONALES Y CONFIDENCIALIDAD");
    parrafo(
      "Para efectos de " + normativaDatos + ", las partes reconocen que EL CLIENTE actúa como RESPONSABLE DEL TRATAMIENTO de los datos personales (incluyendo datos sensibles de salud) de sus pacientes y usuarios, y que EL PROVEEDOR actúa como ENCARGADO DEL TRATAMIENTO, procesando dichos datos ÚNICAMENTE por cuenta y bajo las instrucciones de EL CLIENTE, para la única finalidad de prestar el servicio objeto del Contrato."
    );
    parrafo("En su calidad de Encargado del Tratamiento, EL PROVEEDOR se obliga a:");
    bullets([
      "Guardar confidencialidad absoluta e indefinida sobre los Datos del Cliente, incluso después de terminado el Contrato.",
      "Implementar medidas de seguridad técnicas y administrativas razonables, incluyendo cifrado de la información en tránsito y en reposo, control de acceso basado en roles y perfiles de usuario, registro de trazabilidad/auditoría de las acciones realizadas en el sistema, y copias de respaldo periódicas.",
      "No usar los Datos del Cliente para ninguna finalidad distinta a la prestación del servicio, ni cederlos, venderlos o transferirlos a terceros no autorizados.",
      "Notificar a EL CLIENTE cualquier Incidente de Seguridad que llegue a conocer, dentro de un plazo máximo de cuarenta y ocho (48) horas desde su detección, informando su alcance y las medidas de contención adoptadas.",
      "Garantizar que cualquier subencargado o proveedor de infraestructura tecnológica que EL PROVEEDOR utilice para prestar el servicio (incluyendo Google Cloud / Firebase, donde se aloja la información) se encuentre sujeto a obligaciones de confidencialidad y seguridad equivalentes a las aquí pactadas.",
      "Suprimir o devolver los Datos del Cliente al terminar el Contrato, conforme al procedimiento descrito más adelante en esta cláusula, salvo obligación legal de conservarlos."
    ]);
    parrafo(
      "EL CLIENTE, en su calidad de Responsable del Tratamiento, es el único obligado a: (i) contar con la autorización previa, expresa e informada de sus pacientes y usuarios para el tratamiento de sus datos personales; (ii) atender directamente las solicitudes de sus titulares para ejercer sus derechos de acceso, conocimiento, actualización, rectificación, supresión y revocatoria de la autorización sobre sus datos (derechos ARCO); y (iii) garantizar la veracidad, legalidad y calidad de la información clínica y de pacientes que ingrese o autorice ingresar al Software. EL PROVEEDOR se obliga a mantener disponibles, dentro del Software, las herramientas técnicas razonablemente necesarias para que EL CLIENTE pueda atender dichas solicitudes (por ejemplo, consulta, corrección y eliminación de la información de un paciente)."
    );
    parrafo(
      "EL CLIENTE declara conocer y autoriza que, por la naturaleza de la infraestructura tecnológica en la nube utilizada para prestar el servicio (Google Cloud / Firebase), los Datos del Cliente pueden ser almacenados o transmitidos a través de servidores ubicados fuera del territorio de su país de operación, transferencia y/o transmisión internacional que se realiza exclusivamente para la ejecución del Contrato y bajo los estándares de seguridad de dicho proveedor de infraestructura. Al terminar el Contrato por cualquier causa, EL PROVEEDOR pondrá a disposición de EL CLIENTE, durante un plazo de treinta (30) días calendario, la exportación de la totalidad de sus Datos del Cliente en un formato de uso común; transcurrido dicho plazo sin que EL CLIENTE la solicite, EL PROVEEDOR podrá eliminarlos de forma segura y definitiva de sus sistemas, salvo que exista una obligación legal de conservación por un término mayor."
    );

    titulo("DÉCIMA PRIMERA — CUMPLIMIENTO NORMATIVO EN SALUD");
    parrafo(
      lab.pais === "VE"
        ? "El Software incorpora funcionalidades de trazabilidad, historia clínica electrónica, respaldo de la información y control de acceso orientadas a apoyar el cumplimiento, por parte de EL CLIENTE, de la normativa de habilitación y registro de prestadores de servicios de salud vigente en la República Bolivariana de Venezuela. La habilitación del laboratorio y el cumplimiento integral de dicha normativa ante la autoridad sanitaria competente es responsabilidad exclusiva de EL CLIENTE; EL PROVEEDOR únicamente suministra la herramienta tecnológica de apoyo."
        : lab.pais === "EC"
        ? "El Software incorpora funcionalidades de trazabilidad, historia clínica electrónica, respaldo de la información y control de acceso orientadas a apoyar el cumplimiento, por parte de EL CLIENTE, de la normativa de habilitación y registro de establecimientos de salud vigente en la República del Ecuador (ARCSA y demás autoridad sanitaria competente). La habilitación del laboratorio y el cumplimiento integral de dicha normativa es responsabilidad exclusiva de EL CLIENTE; EL PROVEEDOR únicamente suministra la herramienta tecnológica de apoyo."
        : lab.pais === "MX"
        ? "El Software incorpora funcionalidades de trazabilidad, expediente clínico electrónico, respaldo de la información y control de acceso orientadas a apoyar el cumplimiento, por parte de EL CLIENTE, de la normativa aplicable a laboratorios clínicos vigente en los Estados Unidos Mexicanos (incluyendo, en lo pertinente, la NOM-004-SSA3-2012 del expediente clínico). El cumplimiento integral de dicha normativa ante la autoridad sanitaria competente es responsabilidad exclusiva de EL CLIENTE; EL PROVEEDOR únicamente suministra la herramienta tecnológica de apoyo."
        : "El Software incorpora funcionalidades de trazabilidad y auditoría de la información, historia clínica electrónica, respaldo periódico, disponibilidad y confidencialidad e integridad de los datos, orientadas a apoyar el cumplimiento, por parte de EL CLIENTE, de los estándares del Sistema Único de Habilitación exigidos por la Resolución 3100 de 2019 del Ministerio de Salud y Protección Social de Colombia (o la norma que la adicione, modifique o sustituya) y, en lo pertinente, de la Resolución 2003 de 2014. Las partes dejan expresa constancia de que la habilitación del laboratorio clínico y el cumplimiento integral de las condiciones de calidad exigidas a EL CLIENTE como prestador de servicios de salud (talento humano, infraestructura física, dotación, procesos prioritarios asistenciales, historia clínica e interoperabilidad, y demás estándares aplicables) es responsabilidad EXCLUSIVA de EL CLIENTE ante la autoridad sanitaria competente; EL PROVEEDOR únicamente suministra la herramienta tecnológica de apoyo descrita en el Contrato, sin que ello implique una certificación, aval o responsabilidad de EL PROVEEDOR sobre la habilitación de EL CLIENTE."
    );

    titulo("DÉCIMA SEGUNDA — GARANTÍAS Y LIMITACIÓN DE RESPONSABILIDAD");
    parrafo(
      "EL PROVEEDOR garantiza que el Software operará sustancialmente conforme a sus funcionalidades descritas, con una disponibilidad objetivo del noventa y nueve por ciento (99%) mensual, salvo mantenimientos programados (que se notificarán con antelación razonable) y eventos de fuerza mayor o caso fortuito. EL PROVEEDOR NO será responsable por: (i) las decisiones clínicas, diagnósticas o administrativas que EL CLIENTE o sus Usuarios Autorizados adopten con base en la información capturada o generada en el Software; (ii) la exactitud, veracidad o integridad de los datos que EL CLIENTE o sus Usuarios Autorizados ingresen al sistema; ni (iii) fallas originadas en la conexión a internet, dispositivos o equipos de EL CLIENTE, ajenos al control de EL PROVEEDOR. En ningún caso la responsabilidad total de EL PROVEEDOR frente a EL CLIENTE, por cualquier causa derivada del Contrato, excederá el valor equivalente a tres (3) mensualidades efectivamente pagadas por EL CLIENTE en los últimos doce (12) meses."
    );

    titulo("DÉCIMA TERCERA — CONTINUIDAD Y RESPALDO DEL SERVICIO");
    parrafo(
      "EL PROVEEDOR realizará copias de respaldo (backup) periódicas de la información alojada en el Software, y prestará soporte técnico directo por WhatsApp y correo electrónico en los canales indicados en el encabezado de este Contrato. EL PROVEEDOR podrá realizar mantenimientos, actualizaciones y mejoras al Software sin costo adicional para EL CLIENTE, procurando programarlos en horarios de menor uso y notificándolos con antelación razonable cuando impliquen una interrupción del servicio."
    );

    titulo("DÉCIMA CUARTA — FUERZA MAYOR");
    parrafo(
      "Ninguna de las partes será responsable por el incumplimiento de sus obligaciones cuando este se derive de un evento de fuerza mayor o caso fortuito, entendido como todo hecho imprevisible e irresistible ajeno a su voluntad (incluyendo fallas generalizadas de internet, de los proveedores de infraestructura en la nube, desastres naturales o actos de autoridad), mientras dicho evento subsista."
    );

    titulo("DÉCIMA QUINTA — CESIÓN");
    parrafo(
      "Ninguna de las partes podrá ceder total o parcialmente los derechos u obligaciones derivados del Contrato sin la autorización previa y escrita de la otra parte, salvo la cesión que EL PROVEEDOR realice a favor de una sociedad matriz, subordinada, filial o sucesora de su actividad empresarial, la cual no requerirá autorización previa de EL CLIENTE, sin perjuicio de su deber de informarla oportunamente."
    );

    titulo("DÉCIMA SEXTA — VIGENCIA Y TERMINACIÓN");
    parrafo(
      "El presente Contrato tiene vigencia indefinida, sujeta al pago oportuno de las mensualidades pactadas. Cualquiera de las partes podrá darlo por terminado mediante aviso previo de al menos treinta (30) días calendario a la otra parte. Adicionalmente, EL PROVEEDOR podrá terminarlo de forma anticipada y sin necesidad de declaración judicial previa cuando: (i) EL CLIENTE incurra en mora superior a sesenta (60) días calendario; (ii) EL CLIENTE utilice el Software para fines ilícitos o contrarios a la ley; o (iii) EL CLIENTE incumpla grave y reiteradamente las obligaciones a su cargo bajo la cláusula DÉCIMA (Tratamiento de Datos Personales). La terminación del Contrato extingue de pleno derecho la Licencia de Uso otorgada en la cláusula TERCERA, sin perjuicio del derecho de EL CLIENTE a la exportación de sus Datos del Cliente conforme a la cláusula DÉCIMA."
    );

    titulo("DÉCIMA SÉPTIMA — LEY APLICABLE Y SOLUCIÓN DE CONTROVERSIAS");
    parrafo(
      "El Contrato se rige e interpreta conforme a las leyes de la República de Colombia. Toda controversia que surja de su celebración, ejecución o terminación se intentará resolver, en primer lugar, mediante negociación directa y de buena fe entre las partes por un término de quince (15) días calendario. De no lograrse un acuerdo, la controversia se someterá a un Centro de Conciliación y, si es del caso, a arbitraje ante el Centro de Arbitraje y Conciliación de la Cámara de Comercio del domicilio de EL PROVEEDOR, conforme a sus reglamentos vigentes."
    );

    titulo("DÉCIMA OCTAVA — NOTIFICACIONES");
    parrafo(
      "Para todos los efectos del Contrato, las partes señalan como medios válidos de notificación el correo electrónico y el número de WhatsApp registrados por cada una en el encabezado de este documento y en el sistema, los cuales se entenderán vigentes hasta que la parte respectiva notifique un cambio por el mismo medio."
    );

    titulo("DÉCIMA NOVENA — ACEPTACIÓN");
    parrafo(
      "Las partes declaran haber leído, entendido y aceptado íntegramente los términos del Contrato, el cual se perfecciona con el primer pago realizado por EL CLIENTE conforme a la modalidad elegida en la cláusula SEXTA."
    );

    checkPage(150);
    y += 40;
    var col2 = margin + maxW / 2 + 10;
    var firmaW = 130, firmaH = firmaW * (140 / 548);
    try { doc.addImage("assets/firma-proveedor.png", "PNG", margin - 4, y - firmaH - 4, firmaW, firmaH); } catch (e) {}
    doc.setDrawColor(180, 180, 180); doc.line(margin, y, margin + 200, y); doc.line(col2, y, col2 + 200, y);
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    doc.text("Por EL PROVEEDOR", margin, y); doc.text("Por EL CLIENTE", col2, y);
    y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    doc.text(PROVEEDOR.representanteLegal, margin, y); doc.text(contacto.nombre || "—", col2, y);
    y += 12;
    doc.text(PROVEEDOR.nombre + " · NIT " + PROVEEDOR.nit, margin, y); doc.text((lab.nombre || "—") + (lab.nit ? " · " + C.documentoTributarioLabel(lab.pais) + " " + lab.nit : ""), col2, y);

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  // -----------------------------------------------------------------------
  // RECIBO DE PAGO
  // -----------------------------------------------------------------------
  function buildReciboPDF(cliente, plan, pago) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 50;
    var lab = cliente.laboratorio || {};
    var contacto = cliente.contacto || {};
    var numeroRecibo = "REC-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));

    var y = encabezado(doc, margin, "RECIBO DE PAGO", "N° " + numeroRecibo);
    y += 10;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
    var rows = [
      ["Fecha de pago:", fechaLarga(pago && pago.fecha ? pago.fecha : new Date())],
      ["Recibido de:", (lab.nombre || "—") + (lab.nit ? " (" + C.documentoTributarioLabel(lab.pais) + " " + lab.nit + ")" : "")],
      ["Contacto:", contacto.nombre || "—"],
      ["Concepto:", (pago && pago.concepto ? pago.concepto : "Mensualidad") + " — Plan " + plan.nombre],
      ["Valor pagado:", "$" + (pago && pago.totalFmt ? pago.totalFmt : "—") + " COP (aprox. $" + (pago && pago.totalUSD ? pago.totalUSD : "—") + " USD)"],
      ["Próxima fecha de cobro:", pago && pago.proximaFecha ? fechaLarga(pago.proximaFecha) : "—"]
    ];
    rows.forEach(function (r, i) {
      doc.setFont("helvetica", "bold"); doc.text(r[0], margin, y + i * 18);
      doc.setFont("helvetica", "normal"); doc.text(String(r[1]), margin + 150, y + i * 18);
    });
    y += rows.length * 18 + 24;

    doc.setDrawColor(220, 220, 220); doc.line(margin, y, pageW - margin, y);
    y += 20;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    var nota = "Este recibo certifica la recepción del pago correspondiente. A partir de esta fecha, tu sistema BIOsoft será configurado y personalizado, y estará funcionando en un plazo de 7 a 10 días hábiles. La próxima mensualidad se cobrará en la fecha indicada arriba.";
    var lines = doc.splitTextToSize(nota, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 30;

    y += 26;
    var firmaWRecibo = 120, firmaHRecibo = firmaWRecibo * (140 / 548);
    try { doc.addImage("assets/firma-proveedor.png", "PNG", margin - 4, y - firmaHRecibo - 4, firmaWRecibo, firmaHRecibo); } catch (e) {}
    doc.setDrawColor(180, 180, 180); doc.line(margin, y, margin + 220, y);
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(PROVEEDOR.representanteLegal, margin, y);
    y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(PROVEEDOR.nombre + " · NIT " + PROVEEDOR.nit, margin, y);

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  // Vitrina módulo por módulo con capturas reales — reutiliza las mismas
  // imágenes del Manual de Usuario (assets/manual/*.jpg), pero con copy de
  // venta (el beneficio, no el paso a paso) y una selección corta (8, no
  // las 15 del manual) para que la propuesta se vea completa sin ser larga.
  var MODULOS_PROPUESTA = [
    { img: "assets/manual/resultados.jpg", titulo: "Resultados y validación",
      texto: "Captura, valida y firma resultados con trazabilidad total. Cada informe sale en PDF profesional con tu logo, tus colores y la firma digital de tu bacteriólogo(a) — listo para enviar en segundos." },
    { img: "assets/manual/ordenes.jpg", titulo: "Órdenes de laboratorio",
      texto: "Registra cada orden en segundos: exámenes, prioridad, procedencia y valor a cobrar en una sola pantalla. Todo tu flujo de recepción centralizado, sin papeles sueltos." },
    { img: "assets/manual/equipos-conectados-lista.jpg", titulo: "Conexión de equipos (interfaz LIS)",
      texto: "Conecta tus analizadores (Mindray, Dirui, Dymind, Maglumi, Rayto y otros) y los resultados llegan solos a BIOsoft — se acabó digitarlos uno por uno. Siempre queda como borrador hasta que un bacteriólogo lo revise y firme." },
    { img: "assets/manual/catalogo-rangos-interpretacion.jpg", titulo: "Valores de referencia inteligentes",
      texto: "Interpretación clínica automática con rangos por género, edad o categoría (ej. Hemoglobina Glicosilada: Normal / Prediabetes / Diabetes) — tu sistema piensa contigo, no solo digita." },
    { img: "assets/manual/hojas-trabajo.jpg", titulo: "Hojas de trabajo diarias",
      texto: "Organiza el día de cada sección del laboratorio con una hoja lista para imprimir o diligenciar en pantalla — nada se pierde ni se olvida." },
    { img: "assets/manual/reportes.jpg", titulo: "Reportes y envío automático",
      texto: "Envía resultados por correo o WhatsApp con un clic. Lo que antes tomaba horas ahora toma minutos, sin errores de digitación." },
    { img: "assets/manual/control-calidad.jpg", titulo: "Control de calidad",
      texto: "Lleva tu control de calidad interno con gráficos de Levey-Jennings e informes profesionales — cumple con la normativa y genera confianza con cada resultado que entregas." },
    { img: "assets/manual/marketing-remarketing.jpg", titulo: "Marketing con inteligencia artificial",
      texto: "Reglas de remarketing inteligente que identifican solas a qué pacientes recordarles su próximo control — más pacientes que regresan, sin esfuerzo manual." },
    { img: "assets/manual/marketing-creador-imagenes.jpg", titulo: "Creador de imágenes con IA para redes sociales",
      texto: "Genera en segundos imágenes profesionales para WhatsApp, Instagram y TikTok — plantillas listas de promociones, cumpleaños y campañas, con tu marca — sin contratar diseñador." },
    { img: "assets/manual/convenios-tarifas.jpg", titulo: "Convenios y tarifas para tus empresas aliadas",
      texto: "Crea un convenio para cada droguería, colegio, empresa o laboratorio de referencia con su propio descuento o recargo general — todo desde una pantalla, sin fórmulas sueltas en Excel." },
    { img: "assets/manual/convenios-precios-especiales.jpg", titulo: "Precios especiales, examen por examen",
      texto: "Define un descuento puntual o un precio fijo para cualquier examen o paquete, por cada convenio — la tarifa exacta que negociaste con cada cliente, sin perder el control de tu lista de precios general." },
    { img: "assets/manual/paquetes-exclusivos.jpg", titulo: "Paquetes de exámenes exclusivos por convenio",
      texto: "Arma paquetes como \"Perfil Lipídico\" y, si quieres, hazlos exclusivos de un convenio en particular — solo aparecen para ese cliente, con el precio que tú definas." }
  ];

  // Comparación honesta contra un "sistema tradicional" genérico (nunca se
  // nombra a un competidor puntual, para no hacer afirmaciones que no se
  // puedan sostener) — cada fila es una diferencia real y verificable de lo
  // que ya construye BIOsoft, no una promesa vacía de marketing.
  var COMPARATIVA = [
    ["Interpretación automática de resultados (por edad, sexo o categoría clínica)", "Incluida", "Generalmente manual"],
    ["Marketing y recordatorio de controles con Inteligencia Artificial", "Incluido", "No disponible"],
    ["Conexión directa con tus equipos de laboratorio (interfaz LIS)", "Incluida en el plan", "Cobro aparte por cada equipo, o no disponible"],
    ["Acceso desde cualquier dispositivo, sin instalar nada (100% en la nube)", "Sí", "Muchos requieren instalación local"],
    ["Actualizaciones y funciones nuevas", "Continuas, sin costo adicional", "Con costo extra o versión aparte"],
    ["Implementación y capacitación de tu equipo", "7 a 10 días hábiles, incluida", "Semanas o meses, a veces con costo"],
    ["Informe de resultados personalizado (tu logo, colores y firma digital)", "Incluido", "Con costo adicional o no disponible"],
    ["Soporte técnico", "Directo por WhatsApp, en español", "Tickets o líneas de espera largas"]
  ];

  function cargarImagen(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { resolve(null); };
      image.src = url;
    });
  }

  // -----------------------------------------------------------------------
  // PROPUESTA COMERCIAL — solo con nombre y correo de un prospecto (aún sin
  // laboratorio creado ni lead formal en el CRM), lista TODO lo que incluye
  // BIOsoft, los 4 planes vigentes (que solo varían en cuántos usuarios
  // pueden usar el sistema al mismo tiempo — ver BIO_PLANES.PLANES en
  // planes.js) y una vitrina módulo por módulo con capturas reales, para
  // poder enviarla por correo o WhatsApp de una vez. Devuelve una Promesa
  // (las capturas de pantalla se precargan de forma asíncrona, igual que en
  // pdf-manual.js -> buildManualPDF).
  //
  // IMPORTANTE: los textos que van dentro de doc.text()/autoTable aquí NUNCA
  // deben usar ✓/★/≈ ni ningún carácter fuera de WinAnsi — las fuentes base
  // de jsPDF (Helvetica) no las soportan y el texto sale cortado o corrupto
  // (bug real reportado). Se usan "-", "·" y palabras en su lugar.
  // -----------------------------------------------------------------------
  function buildPropuestaPDF(datos) {
    return Promise.all(MODULOS_PROPUESTA.map(function (m) { return cargarImagen(m.img); })).then(function (imagenesCargadas) {
      return buildPropuestaPDFConImagenes(datos, imagenesCargadas);
    });
  }

  function buildPropuestaPDFConImagenes(datos, imagenesCargadas) {
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 50;
    var maxW = pageW - margin * 2;
    var PLANES = (window.BIO_PLANES && window.BIO_PLANES.PLANES) || [];
    var ITEMS = (PLANES[0] && PLANES[0].items) || [];
    var PROMO = (window.BIO_PLANES && window.BIO_PLANES.PROMOCION_LANZAMIENTO) || { implementacionUsd: 120, equiposGratis: 5, costoPorEquipoUsd: 10 };

    var y = encabezado(doc, margin, "PROPUESTA COMERCIAL", fechaLarga(new Date()));

    function checkPage(minSpace) {
      if (y > 760 - (minSpace || 40)) { doc.addPage(); y = margin; }
    }
    function parrafo(t, opts) {
      opts = opts || {};
      doc.setFont("helvetica", opts.bold ? "bold" : "normal"); doc.setFontSize(opts.size || 9.5); doc.setTextColor.apply(doc, opts.color || [40, 40, 40]);
      var lines = doc.splitTextToSize(t, opts.maxW || maxW);
      checkPage(lines.length * (opts.lineH || 13) + 10);
      doc.text(lines, margin, y);
      y += lines.length * (opts.lineH || 13) + (opts.gap != null ? opts.gap : 12);
      return lines.length;
    }
    // Encabezado de sección: barra de color a la izquierda + texto en
    // versalitas, siempre el mismo patrón visual en toda la propuesta.
    function tituloSeccion(t) {
      checkPage(34);
      doc.setFillColor(249, 115, 22); doc.rect(margin, y - 10, 3, 14, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(46, 16, 101);
      doc.text(t.toUpperCase(), margin + 10, y);
      y += 18;
    }
    // Recuadro con borde y relleno suave: la altura se calcula ANTES de
    // dibujar (a partir de las líneas ya partidas con splitTextToSize), así
    // el texto nunca se sale ni se corta, sin importar cuánto mida.
    function recuadro(titulo, lineasItems) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      var tituloLines = doc.splitTextToSize(titulo, maxW - 24);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.3);
      var itemBlocks = lineasItems.map(function (it) { return doc.splitTextToSize("- " + it, maxW - 24); });
      var alto = 16 + tituloLines.length * 14 + itemBlocks.reduce(function (s, l) { return s + l.length * 12.5 + 5; }, 0) + 12;
      checkPage(alto + 10);
      doc.setFillColor(255, 247, 237); doc.setDrawColor(249, 115, 22); doc.setLineWidth(1);
      doc.roundedRect(margin, y, maxW, alto, 6, 6, "FD");
      var iy = y + 18;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(180, 83, 9);
      doc.text(tituloLines, margin + 12, iy); iy += tituloLines.length * 14 + 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.3); doc.setTextColor(60, 45, 30);
      itemBlocks.forEach(function (lines) { doc.text(lines, margin + 12, iy); iy += lines.length * 12.5 + 5; });
      y += alto + 16;
    }

    parrafo("Hola " + (datos.nombre || "").split(" ")[0] + ",", { bold: true, size: 12, color: [20, 20, 20], gap: 5 });
    parrafo(
      "Gracias por tu interés en " + PROVEEDOR.producto + ". Esta propuesta reúne todo lo que incluye BIOsoft y los planes disponibles, para que elijas el que mejor se ajuste al tamaño de tu equipo — con la información completa y sin letra pequeña."
    );

    recuadro("Oferta de lanzamiento — gratis al aceptar esta propuesta hoy", [
      "Implementación, adaptación del catálogo y capacitación virtual a la medida de tu laboratorio: normalmente $" + PROMO.implementacionUsd + " USD, HOY sin ningún costo.",
      "Conexión de hasta " + PROMO.equiposGratis + " equipos de laboratorio por interfaz (LIS): normalmente $" + PROMO.costoPorEquipoUsd + " USD/mes por equipo, HOY sin ningún costo."
    ]);

    tituloSeccion("Todo lo que incluye tu BIOsoft");
    parrafo("Los 4 planes de abajo incluyen exactamente esto, sin excepciones ni módulos aparte. Lo único que cambia entre un plan y otro es cuántas personas pueden usar el sistema al mismo tiempo.", { size: 9, color: [90, 90, 90], gap: 10 });
    var mitad = Math.ceil(ITEMS.length / 2);
    var filas = [];
    for (var i = 0; i < mitad; i++) {
      filas.push(["- " + ITEMS[i], ITEMS[mitad + i] ? "- " + ITEMS[mitad + i] : ""]);
    }
    checkPage(filas.length * 16 + 20);
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      body: filas, theme: "plain",
      styles: { fontSize: 9.3, textColor: [40, 40, 40], cellPadding: { top: 2.5, bottom: 2.5, left: 0, right: 10 } },
      columnStyles: { 0: { cellWidth: maxW / 2 }, 1: { cellWidth: maxW / 2 } }
    });
    y = doc.lastAutoTable.finalY + 18;

    tituloSeccion("Tecnología e inteligencia artificial incluidas");
    parrafo("Esto es lo que hace que BIOsoft no sea solo un programa para digitar resultados, sino un sistema que piensa contigo:", { size: 9, color: [90, 90, 90], gap: 10 });
    recuadro("Inteligencia Artificial trabajando para tu laboratorio, todos los días", [
      "Remarketing con IA: revisa sola tu base de pacientes todos los días y te dice a quién contactar para su próximo control, cruzando historial de exámenes con edad y género — más pacientes que regresan, sin esfuerzo manual.",
      "Marketing con IA: genera en segundos el texto (copy) listo para publicar en redes sociales, e incluye plantillas de imágenes para promociones, cumpleaños y campañas — sin contratar un diseñador ni un redactor.",
      "Interpretación clínica automática: cada resultado se compara solo contra el rango correcto según edad, sexo o categoría (ej. Hemoglobina Glicosilada: Normal / Prediabetes / Diabetes), reduciendo el margen de error humano.",
      "Interfaz automática con tus equipos de laboratorio: los resultados llegan solos desde el analizador a BIOsoft — se acabó digitarlos uno por uno."
    ]);

    tituloSeccion("Por qué BIOsoft frente a un sistema tradicional");
    parrafo("Una comparación honesta, punto por punto, contra lo que ofrece un software de laboratorio tradicional del mercado:", { size: 9, color: [90, 90, 90], gap: 10 });
    checkPage(160);
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Característica", "BIOsoft", "Software Tradicional"]],
      body: COMPARATIVA,
      theme: "grid",
      styles: { fontSize: 8.7, cellPadding: 7, valign: "middle" },
      headStyles: { fillColor: [46, 16, 101], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: maxW * 0.46 }, 1: { cellWidth: maxW * 0.27, fontStyle: "bold" }, 2: { cellWidth: maxW * 0.27 } },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      didParseCell: function (data) {
        if (data.section !== "body") return;
        // Columna BIOsoft en verde (la ventaja), columna del sistema
        // tradicional en gris itálica (lo que le falta) — sin usar ningún
        // símbolo (✓/✗) por la limitación de fuentes WinAnsi de jsPDF.
        if (data.column.index === 1) data.cell.styles.textColor = [21, 128, 61];
        if (data.column.index === 2) { data.cell.styles.textColor = [130, 130, 130]; data.cell.styles.fontStyle = "italic"; }
      }
    });
    y = doc.lastAutoTable.finalY + 18;

    tituloSeccion("Elige tu plan según tu equipo");
    checkPage(120);
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [["Plan", "Usuarios simultáneos", "Mensualidad"]],
      body: PLANES.map(function (p) {
        return [p.nombre + (p.destacado ? " (recomendado)" : ""), p.usuarios, "$" + p.precioFmt + " COP/mes\n(aprox. $" + p.usd + " USD)"];
      }),
      theme: "grid",
      styles: { fontSize: 9.5, cellPadding: 8, valign: "middle" },
      headStyles: { fillColor: [46, 16, 101], textColor: 255, fontStyle: "bold" },
      columnStyles: { 2: { fontStyle: "bold", halign: "right" } },
      didParseCell: function (data) {
        if (data.section === "body" && PLANES[data.row.index] && PLANES[data.row.index].destacado) {
          data.cell.styles.fillColor = [255, 247, 237];
        }
      }
    });
    y = doc.lastAutoTable.finalY + 16;

    doc.addPage(); y = margin;
    tituloSeccion("Así funciona tu BIOsoft, módulo por módulo");
    parrafo("Un vistazo rápido a lo que vas a tener funcionando desde el primer día — con capturas reales del sistema.", { size: 9, color: [90, 90, 90], gap: 12 });

    var imgMaxH = 118, capW = maxW;
    MODULOS_PROPUESTA.forEach(function (m, i) {
      var imagen = imagenesCargadas[i];
      var imgW = capW, imgH = imgMaxH;
      if (imagen && imagen.naturalWidth) {
        imgH = imgW * (imagen.naturalHeight / imagen.naturalWidth);
        if (imgH > imgMaxH) { imgH = imgMaxH; imgW = imgH * (imagen.naturalWidth / imagen.naturalHeight); }
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      var tituloLines = doc.splitTextToSize(m.titulo, maxW);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      var textoLines = doc.splitTextToSize(m.texto, maxW);
      var bloqueAlto = (imagen ? imgH + 8 : 0) + tituloLines.length * 12 + 6 + textoLines.length * 12 + 20;
      checkPage(bloqueAlto);
      if (imagen) {
        var xImg = margin + (capW - imgW) / 2;
        doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.7);
        doc.rect(xImg - 2, y - 2, imgW + 4, imgH + 4);
        try { doc.addImage(imagen, "JPEG", xImg, y, imgW, imgH); } catch (e) {}
        y += imgH + 10;
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(46, 16, 101);
      doc.text(tituloLines, margin, y); y += tituloLines.length * 12 + 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      doc.text(textoLines, margin, y); y += textoLines.length * 12 + 18;
    });

    checkPage(60);
    parrafo(
      "¿Tienes dudas o quieres ver el software en acción antes de decidir? Escríbenos por WhatsApp al +" + PROVEEDOR.whatsapp + " o respóndenos a " + PROVEEDOR.correo + " y con gusto te acompañamos a elegir el plan ideal para tu laboratorio.",
      { bold: true, color: [20, 20, 20] }
    );

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CRM = {
    buildContratoPDF: buildContratoPDF, buildReciboPDF: buildReciboPDF, buildPropuestaPDF: buildPropuestaPDF,
    buildLicenciaPDF: buildLicenciaPDF, generarNumeroLicencia: generarNumeroLicencia, PROVEEDOR: PROVEEDOR
  };
})(window);

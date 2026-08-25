/* BIOsoft — Generación de Contrato de Prestación de Servicios y Recibo de Pago (CRM) */
(function (global) {
  "use strict";
  var C = BIO_CATALOG;

  var PROVEEDOR = {
    nombre: "BioColombia Plus",
    representanteLegal: "Juan Carlos Cáceres",
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
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 20, 20);
    doc.text(titulo, margin, y);
    if (subtitulo) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(120, 120, 120);
      doc.text(subtitulo, pageW - margin, y, { align: "right" });
    }
    return y + 24;
  }

  function piePagina(doc, margin) {
    var pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text("Documento generado electrónicamente por BIOsoft — " + new Date().toLocaleString("es-CO") + ".", margin, 772, { maxWidth: pageW - margin * 2 });
  }

  // -----------------------------------------------------------------------
  // CONTRATO DE PRESTACIÓN DE SERVICIOS
  // -----------------------------------------------------------------------
  function buildContratoPDF(cliente, plan, modalidadPago, opts) {
    opts = opts || {};
    var cicloDias = opts.cicloCobroDias || 30;
    var mesesMembresia = opts.mesesMembresia || 6;
    var mesesCortesia = opts.mesesCortesia || 0;
    var IMPL = (window.BIO_PLANES && window.BIO_PLANES.IMPLEMENTACION) || { copFmt: "380.000", usd: 120, cuotaCopFmt: "190.000", cuotaUsd: 60 };
    var esSemestral = modalidadPago === "semestral";
    var esSinImplementacion = modalidadPago === "sin_implementacion";
    var esContado = modalidadPago === "contado";
    var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 50;
    var maxW = pageW - margin * 2;
    var lab = cliente.laboratorio || {};
    var contacto = cliente.contacto || {};

    var y = encabezado(doc, margin, "CONTRATO DE PRESTACIÓN DE SERVICIOS", fechaLarga(new Date()));

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
      ", se celebra el presente contrato de prestación de servicios de software, bajo las siguientes cláusulas:"
    );

    titulo("PRIMERA — OBJETO");
    parrafo(
      "EL PROVEEDOR se obliga a prestar a EL CLIENTE el servicio de software " + PROVEEDOR.producto +
      ", bajo la modalidad de software como servicio (SaaS), incluyendo la personalización, configuración, capacitación y soporte descritos en este contrato."
    );

    titulo("SEGUNDA — PLAN CONTRATADO");
    parrafo("EL CLIENTE contrata el Plan " + plan.nombre + " (" + plan.usuarios + "), que incluye:");
    bullets(plan.items || []);

    titulo("TERCERA — PERSONALIZACIÓN Y PLAZO DE ENTREGA");
    parrafo(
      "El software será configurado y personalizado según las necesidades específicas de EL CLIENTE: logo, colores institucionales, catálogo de exámenes y valores de referencia, firmas digitales de los bacteriólogos, y el formato del informe de resultados que reciben sus pacientes." +
      (cliente.seccionesTexto ? " Las secciones del laboratorio configuradas inicialmente son: " + cliente.seccionesTexto + "." : "") +
      " EL CLIENTE tendrá acceso al software desde la confirmación de su primer pago, sin necesidad de esperar a que la personalización esté finalizada. El plazo estimado para completar la personalización total del sistema es de " +
      "SIETE (7) A DIEZ (10) DÍAS HÁBILES, y los ajustes puntuales que EL CLIENTE solicite durante ese proceso se atenderán en un plazo de DOS (2) A CUATRO (4) DÍAS HÁBILES según la complejidad del ajuste." +
      " El primer período de mensualidad inicia en la fecha que ocurra primero entre: (i) la puesta en marcha del sistema totalmente personalizado para EL CLIENTE, o (ii) el registro del primer paciente en la plataforma. Los ajustes o solicitudes de personalización adicionales que EL CLIENTE realice después de la puesta en marcha no afectan, modifican ni eliminan la información ya registrada (pacientes, órdenes, resultados), preservando en todo momento la continuidad e integridad del historial clínico."
    );

    titulo("CUARTA — VALOR DEL SERVICIO");
    parrafo(
      esSemestral
        ? ("EL CLIENTE ha optado por la modalidad de membresía prepagada: cancela por adelantado el valor correspondiente a sus primeros " + numeroConDigito(mesesMembresia) + " meses de mensualidad del Plan " + plan.nombre + " ($" + plan.precioFmt + " COP c/u, aprox. $" + plan.usd + " USD), quedando exento del pago de la cuota de implementación (valor $" + IMPL.copFmt + " COP / aprox. $" + IMPL.usd + " USD), la cual EL PROVEEDOR condona en su totalidad bajo esta modalidad. Vencidos los primeros " + numeroConDigito(mesesMembresia) + " meses, EL CLIENTE continuará pagando la mensualidad ordinaria del Plan " + plan.nombre + ".")
        : esSinImplementacion
        ? ("EL PROVEEDOR condona en su totalidad la cuota de implementación (valor $" + IMPL.copFmt + " COP / aprox. $" + IMPL.usd + " USD) para EL CLIENTE. EL CLIENTE pagará únicamente la mensualidad ordinaria de $" + plan.precioFmt + " COP (aprox. $" + plan.usd + " USD) correspondiente al Plan " + plan.nombre + ", desde la fecha de activación del servicio." +
            (mesesCortesia > 0 ? (" Como cortesía adicional, EL PROVEEDOR no cobrará mensualidad durante los primeros " + numeroConDigito(mesesCortesia) + " meses; transcurrido ese plazo, EL CLIENTE pagará la mensualidad ordinaria del Plan " + plan.nombre + ".") : ""))
        : esContado
        ? ("EL CLIENTE pagará la cuota de implementación por valor de $" + IMPL.copFmt + " COP (aprox. $" + IMPL.usd + " USD) EN UN SOLO PAGO, junto con la mensualidad del primer mes. A partir del mes dos (2), EL CLIENTE solo pagará la mensualidad ordinaria de $" + plan.precioFmt + " COP (aprox. $" + plan.usd + " USD) correspondiente al Plan " + plan.nombre + ". La cuota de implementación no se cobra nuevamente bajo ninguna circunstancia una vez cancelada en su totalidad, sin importar el tiempo que EL CLIENTE continúe usando el software." +
            (mesesCortesia > 0 ? (" Como cortesía adicional, EL PROVEEDOR no cobrará mensualidad durante los primeros " + numeroConDigito(mesesCortesia) + " meses; transcurrido ese plazo, EL CLIENTE pagará la mensualidad ordinaria del Plan " + plan.nombre + ".") : ""))
        : ("EL CLIENTE pagará una cuota de implementación por valor de $" + IMPL.copFmt + " COP (aprox. $" + IMPL.usd + " USD), fraccionada en DOS (2) cuotas iguales de $" + IMPL.cuotaCopFmt + " COP (aprox. $" + IMPL.cuotaUsd + " USD) cada una, cobradas junto con la mensualidad de los meses uno (1) y dos (2). A partir del mes tres (3), EL CLIENTE solo pagará la mensualidad ordinaria de $" + plan.precioFmt + " COP (aprox. $" + plan.usd + " USD) correspondiente al Plan " + plan.nombre + ". La cuota de implementación no se cobra nuevamente bajo ninguna circunstancia una vez cancelada en su totalidad, sin importar el tiempo que EL CLIENTE continúe usando el software." +
            (mesesCortesia > 0 ? (" Como cortesía adicional, EL PROVEEDOR no cobrará mensualidad durante los primeros " + numeroConDigito(mesesCortesia) + " meses; transcurrido ese plazo, EL CLIENTE pagará la mensualidad ordinaria del Plan " + plan.nombre + ".") : ""))
    );

    titulo("QUINTA — FORMA DE PAGO Y PERIODICIDAD");
    parrafo(
      "La mensualidad se cobrará cada " + numeroConDigito(cicloDias) + " días calendario, contados a partir de la fecha de inicio de facturación definida en la cláusula TERCERA. El pago se realiza a través de los medios habilitados por EL PROVEEDOR (Wompi u otros que se informen oportunamente)."
    );

    titulo("SEXTA — POLÍTICA DE MORA Y SUSPENSIÓN DEL SERVICIO");
    parrafo(
      "En caso de no recibirse el pago de la mensualidad en la fecha de corte, EL PROVEEDOR otorgará un plazo de gracia de cinco (5) días calendario, durante el cual notificará a EL CLIENTE por los medios de contacto registrados. Transcurrido dicho plazo sin que se registre el pago, EL PROVEEDOR podrá suspender temporalmente el acceso al software hasta que se regularice la situación, sin que ello genere responsabilidad alguna para EL PROVEEDOR por la interrupción del servicio. El acceso se restablece automáticamente al confirmarse el pago."
    );

    titulo("SÉPTIMA — CONFIDENCIALIDAD Y TRATAMIENTO DE DATOS");
    parrafo(
      "EL CLIENTE es responsable de la veracidad y legalidad de la información clínica y de los pacientes que ingrese al sistema, así como del cumplimiento de la normativa vigente en materia de protección de datos personales (Habeas Data) en su país de operación. EL PROVEEDOR se compromete a mantener la confidencialidad de la información alojada y a no compartirla con terceros no autorizados."
    );

    titulo("OCTAVA — VIGENCIA Y TERMINACIÓN");
    parrafo(
      "El presente contrato tiene vigencia indefinida, sujeta al pago oportuno de las mensualidades pactadas. Cualquiera de las partes podrá darlo por terminado mediante aviso previo de al menos treinta (30) días calendario a la otra parte."
    );

    titulo("NOVENA — ACEPTACIÓN");
    parrafo(
      "Las partes declaran conocer y aceptar los términos de este contrato, el cual se perfecciona con el primer pago realizado por EL CLIENTE conforme a la modalidad elegida en la cláusula CUARTA."
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
      texto: "Reglas de remarketing inteligente que identifican solas a qué pacientes recordarles su próximo control — más pacientes que regresan, sin esfuerzo manual." }
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

  global.BIO_PDF_CRM = { buildContratoPDF: buildContratoPDF, buildReciboPDF: buildReciboPDF, buildPropuestaPDF: buildPropuestaPDF, PROVEEDOR: PROVEEDOR };
})(window);

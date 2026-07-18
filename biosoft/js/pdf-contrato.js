/* BIOsoft — Generación de Contrato de Prestación de Servicios y Recibo de Pago (CRM) */
(function (global) {
  "use strict";

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
  function buildContratoPDF(cliente, plan) {
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
      (lab.nit ? ", identificado con NIT " + lab.nit : "") + " (en adelante, “EL CLIENTE”), representado por " +
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
      " El plazo estimado de entrega del sistema totalmente personalizado y funcionando es de " +
      "SIETE (7) A DIEZ (10) DÍAS HÁBILES, contados a partir de la confirmación del pago de implementación y la recepción completa de la información requerida por parte de EL CLIENTE."
    );

    titulo("CUARTA — VALOR DEL SERVICIO");
    parrafo(
      "EL CLIENTE pagará una cuota única de implementación de $380.000 COP (aprox. $120 USD), la cual se paga una sola vez y no se cobra nuevamente bajo ninguna circunstancia, sin importar el tiempo que EL CLIENTE continúe usando el software. Adicionalmente, pagará una mensualidad de $" +
      plan.precioFmt + " COP (aprox. $" + plan.usd + " USD) correspondiente al Plan " + plan.nombre + "."
    );

    titulo("QUINTA — FORMA DE PAGO Y PERIODICIDAD");
    parrafo(
      "La mensualidad se cobrará cada treinta (30) días calendario, contados a partir de la fecha de activación del servicio. El pago se realiza a través de los medios habilitados por EL PROVEEDOR (Wompi u otros que se informen oportunamente)."
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
      "Las partes declaran conocer y aceptar los términos de este contrato, el cual se perfecciona con el pago de la cuota de implementación por parte de EL CLIENTE."
    );

    checkPage(110);
    y += 20;
    var col2 = margin + maxW / 2 + 10;
    doc.setDrawColor(180, 180, 180); doc.line(margin, y, margin + 200, y); doc.line(col2, y, col2 + 200, y);
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    doc.text("Por EL PROVEEDOR", margin, y); doc.text("Por EL CLIENTE", col2, y);
    y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    doc.text(PROVEEDOR.representanteLegal, margin, y); doc.text(contacto.nombre || "—", col2, y);
    y += 12;
    doc.text(PROVEEDOR.nombre + " · NIT " + PROVEEDOR.nit, margin, y); doc.text((lab.nombre || "—") + (lab.nit ? " · NIT " + lab.nit : ""), col2, y);

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
      ["Recibido de:", (lab.nombre || "—") + (lab.nit ? " (NIT " + lab.nit + ")" : "")],
      ["Contacto:", contacto.nombre || "—"],
      ["Concepto:", "Implementación (pago único) + primera mensualidad — Plan " + plan.nombre],
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

    doc.setDrawColor(180, 180, 180); doc.line(margin, y, margin + 220, y);
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(PROVEEDOR.representanteLegal, margin, y);
    y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(PROVEEDOR.nombre + " · NIT " + PROVEEDOR.nit, margin, y);

    piePagina(doc, margin);
    return new Uint8Array(doc.output("arraybuffer"));
  }

  global.BIO_PDF_CRM = { buildContratoPDF: buildContratoPDF, buildReciboPDF: buildReciboPDF, PROVEEDOR: PROVEEDOR };
})(window);

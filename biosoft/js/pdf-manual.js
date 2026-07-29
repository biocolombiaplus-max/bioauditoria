/* BIOsoft — Manual de Usuario en PDF: guía paso a paso de cada módulo,
   generado con la marca del laboratorio para que el admin lo envíe
   fácilmente a su equipo por WhatsApp o correo. */
(function (global) {
  "use strict";

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }

  var SECCIONES = [
    {
      titulo: "1. Ingresar al sistema",
      imagen: "assets/manual/ingreso-login.jpg",
      intro: "Cada persona del equipo tiene su propio usuario y contraseña. Así queda registrado quién hizo cada acción.",
      pasos: [
        "Abre el enlace de BIOsoft de tu laboratorio en el navegador (funciona en computador, tablet o celular).",
        "Ingresa tu usuario y contraseña en la pantalla de inicio de sesión.",
        "Si olvidaste tu contraseña, usa el enlace “¿Olvidaste tu contraseña?” para restablecerla por correo.",
        "Al entrar, verás el menú lateral con solo las secciones que tu rol puede usar (Recepción, Bacteriólogo o Administrador)."
      ]
    },
    {
      titulo: "2. Pacientes",
      imagen: "assets/manual/pacientes.jpg",
      intro: "Aquí se registran los datos de cada paciente, una sola vez, para reutilizarlos en todas sus órdenes futuras.",
      pasos: [
        "Ve a “Pacientes” en el menú lateral y haz clic en “Nuevo Paciente”.",
        "Completa los datos personales, documento de identidad, EPS/asegurador y datos de contacto.",
        "Guarda el paciente. Ya queda disponible para crearle órdenes cuando lo necesites.",
        "Puedes buscar un paciente existente por nombre o número de documento en cualquier momento."
      ]
    },
    {
      titulo: "3. Órdenes de Laboratorio",
      imagen: "assets/manual/ordenes.jpg",
      intro: "Una orden agrupa los exámenes que un paciente va a realizarse en una visita.",
      pasos: [
        "Ve a “Órdenes de Laboratorio” y haz clic en “Nueva Orden”.",
        "Selecciona el paciente (o créalo si es la primera vez que viene).",
        "Elige los exámenes por sección desde el catálogo (Hematología, Química, Inmunología, etc.); puedes buscar por nombre.",
        "Registra el médico remitente y la procedencia si aplica.",
        "Guarda la orden — automáticamente queda disponible en la bandeja de cada bacteriólogo, según la sección de cada examen.",
        "Desde aquí también puedes imprimir el sticker de identificación para los tubos de muestra."
      ]
    },
    {
      titulo: "4. Resultados (Bandeja de Trabajo)",
      imagen: "assets/manual/resultados.jpg",
      intro: "Cada bacteriólogo ve solo los exámenes de sus secciones asignadas, listos para capturar resultados.",
      pasos: [
        "Ve a “Resultados” — verás la lista de exámenes pendientes de tu sección.",
        "Abre un examen y digita los valores; el sistema muestra automáticamente el valor de referencia de cada parámetro.",
        "Guarda como “Borrador” si aún no está listo, “Preliminar” si quieres adelantarlo al paciente, o “Validado” cuando esté definitivo.",
        "Al validar, el resultado queda firmado electrónicamente con tu nombre, fecha y hora — no se puede editar sin la clave de administrador.",
        "Si un resultado validado necesita corrección, un Administrador debe ingresar la clave de administrador; la corrección queda registrada en la Trazabilidad."
      ]
    },
    {
      titulo: "5. Hojas de Trabajo",
      imagen: "assets/manual/hojas-trabajo.jpg",
      intro: "Listas diarias de los exámenes pendientes por sección, ideales para el trabajo en el laboratorio o para imprimir.",
      pasos: [
        "Ve a “Hojas de Trabajo” y elige la fecha y la sección que quieres revisar.",
        "Verás todos los exámenes pendientes de esa sección para el día seleccionado.",
        "Puedes trabajar directamente en pantalla o imprimir la hoja para diligenciarla a mano y luego digitar los resultados."
      ]
    },
    {
      titulo: "6. Reportes y Envíos",
      imagen: "assets/manual/reportes.jpg",
      intro: "Desde aquí se genera el informe en PDF con la marca de tu laboratorio y se envía al paciente.",
      pasos: [
        "Ve a “Reportes y Envíos” y busca la orden del paciente.",
        "Elige si el envío es del informe “Final” (resultados validados) o “Preliminar” (anticipado).",
        "Descarga el PDF — queda listo con el logo, colores, firma digital del bacteriólogo y código QR de verificación.",
        "Elige por dónde enviarlo: se abre WhatsApp o tu correo (Gmail/Outlook) ya redactado; solo adjunta el PDF que acabas de descargar."
      ]
    },
    {
      titulo: "7. Control de Calidad",
      imagen: "assets/manual/control-calidad.jpg",
      intro: "Permite llevar el control diario de los controles de calidad de cada analito, con alertas automáticas si algo se sale de rango (reglas de Westgard).",
      pasos: [
        "Ve a “Control de Calidad” y configura los controles (niveles, valores esperados) por analito, una sola vez.",
        "Cada día, registra la lectura del control antes de procesar las muestras de pacientes.",
        "El sistema evalúa automáticamente la lectura contra las reglas de Westgard y te avisa si hay una alerta.",
        "Consulta la gráfica de Levey-Jennings para ver la tendencia de cada analito en el tiempo."
      ]
    },
    {
      titulo: "8. Cotizaciones",
      imagen: "assets/manual/cotizador.jpg",
      intro: "Genera cotizaciones profesionales en PDF para pacientes particulares o empresas, antes de crear la orden.",
      pasos: [
        "Ve a “Cotizaciones” y haz clic en “Nueva Cotización”.",
        "Selecciona los exámenes desde el buscador rápido; el sistema calcula el total automáticamente según tu lista de precios.",
        "Genera el PDF y envíalo por WhatsApp o correo directamente desde la pantalla.",
        "Consulta el historial de cotizaciones enviadas en cualquier momento."
      ]
    },
    {
      titulo: "9. Marketing Digital",
      imagen: "assets/manual/marketing-remarketing.jpg",
      intro: "Módulo con Inteligencia Artificial para ayudarte a conseguir y recuperar pacientes.",
      pasos: [
        "Ve a “Marketing Digital” → “Remarketing con IA” para ver sugerencias automáticas de pacientes a contactar (por ejemplo, quienes no vuelven hace tiempo).",
        "Configura tus propias reglas de recall (a los cuántos días recontactar a un paciente según el tipo de examen).",
        "Usa el “Creador de Imágenes” para generar piezas gráficas listas para redes sociales, con el logo de tu laboratorio."
      ]
    },
    {
      titulo: "10. Inventario y Reactivos",
      imagen: "assets/manual/inventario.jpg",
      intro: "Kardex profesional para controlar tus insumos, su costo y el gasto real por cada examen realizado.",
      pasos: [
        "Ve a “Inventario y Reactivos” → “Insumos” y registra cada reactivo/insumo con su stock y costo.",
        "En “Recetas por Examen”, indica cuánto se gasta de cada insumo al realizar cada tipo de examen.",
        "A partir de ahí, el sistema descuenta el inventario automáticamente cada vez que se valida un resultado — no necesitas hacerlo manual.",
        "Consulta el “Kardex” para ver cada movimiento de entrada/salida, y descarga los reportes de gasto de reactivos e inventario valorizado en PDF."
      ]
    },
    {
      titulo: "11. Configuración del Laboratorio",
      imagen: "assets/manual/configuracion.jpg",
      intro: "Solo para Administradores: aquí se personaliza el sistema con la identidad de tu laboratorio.",
      pasos: [
        "Ve a “Configuración del Laboratorio” para actualizar nombre, NIT, dirección, teléfonos y resolución de habilitación.",
        "Sube el logo y define los colores institucionales — se aplican automáticamente a toda la app y a los PDF.",
        "Define o cambia la clave de administrador, necesaria para autorizar correcciones de resultados ya validados.",
        "En “Usuarios del Laboratorio”, crea el acceso de cada persona del equipo y asígnale sus secciones y firma digital."
      ]
    }
  ];

  function encabezado(doc, tenant, titulo) {
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 50;
    var y = margin;
    var rgb = hexToRgb(tenant.colorPrimario);

    if (tenant.logoDataUrl) {
      try { doc.addImage(tenant.logoDataUrl, "PNG", margin, y - 8, 44, 44); } catch (e) {}
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(tenant.nombre || "BIOsoft", margin + (tenant.logoDataUrl ? 54 : 0), y + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110);
    doc.text("Manual de Usuario del Sistema", margin + (tenant.logoDataUrl ? 54 : 0), y + 20);

    y += 46;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.6);
    doc.line(margin, y, pageW - margin, y);
    y += 22;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(titulo, margin, y);
    y += 6;
    return { margin: margin, pageW: pageW, y: y, rgb: rgb };
  }

  function piePagina(doc, margin) {
    var pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text("Manual de Usuario — generado por BIOsoft el " + new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) + ".", margin, 772);
  }

  /* Precarga cada captura de pantalla como <img> para poder conocer sus
     dimensiones reales (y así escalarla manteniendo proporción) antes de
     insertarla en el PDF. Si una imagen falla, se omite sin romper el PDF. */
  function cargarImagen(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function buildManualPDF(tenant) {
    return Promise.all(SECCIONES.map(function (s) { return cargarImagen(s.imagen); })).then(function (imagenes) {
      var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
      var margin = 50, pageW = doc.internal.pageSize.getWidth(), maxW = pageW - margin * 2;
      var rgb = hexToRgb(tenant.colorPrimario);

      // ---------- Portada ----------
      var y = 150;
      if (tenant.logoDataUrl) {
        try { doc.addImage(tenant.logoDataUrl, "PNG", pageW / 2 - 35, y, 70, 70); } catch (e) {}
        y += 90;
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(20, 20, 20);
      doc.text("Manual de Usuario", pageW / 2, y, { align: "center" }); y += 30;
      doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(tenant.nombre || "Tu Laboratorio", pageW / 2, y, { align: "center" }); y += 40;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
      var intro = doc.splitTextToSize(
        "Esta guía explica paso a paso cómo usar cada módulo del sistema BIOsoft, con capturas reales de pantalla, para que cualquier persona de tu equipo — sin experiencia previa en el software — pueda aprender a usarlo en minutos.",
        maxW - 80
      );
      doc.text(intro, pageW / 2, y, { align: "center" }); y += intro.length * 14 + 30;

      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
      doc.text("Contenido", pageW / 2, y, { align: "center" }); y += 18;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(60, 60, 60);
      SECCIONES.forEach(function (s) {
        doc.text(s.titulo, pageW / 2, y, { align: "center" }); y += 15;
      });
      piePagina(doc, margin);

      // ---------- Secciones ----------
      SECCIONES.forEach(function (seccion, idx) {
        doc.addPage();
        var ctx = encabezado(doc, tenant, seccion.titulo, "");
        var y2 = ctx.y + 10;

        function checkPage(minSpace) {
          if (y2 > 740 - (minSpace || 40)) {
            piePagina(doc, margin);
            doc.addPage();
            var ctx2 = encabezado(doc, tenant, seccion.titulo + " (cont.)", "");
            y2 = ctx2.y + 10;
          }
        }

        doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(80, 80, 80);
        var introLines = doc.splitTextToSize(seccion.intro, maxW);
        checkPage(introLines.length * 13 + 20);
        doc.text(introLines, margin, y2);
        y2 += introLines.length * 13 + 16;

        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
        seccion.pasos.forEach(function (paso, i) {
          var lines = doc.splitTextToSize(paso, maxW - 24);
          checkPage(lines.length * 13 + 10);
          doc.setFont("helvetica", "bold"); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(String(i + 1) + ".", margin, y2);
          doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
          doc.text(lines, margin + 18, y2);
          y2 += lines.length * 13 + 8;
        });

        var img = imagenes[idx];
        if (img && img.naturalWidth) {
          var imgW = maxW, imgH = imgW * (img.naturalHeight / img.naturalWidth);
          var maxImgH = 250;
          if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * (img.naturalWidth / img.naturalHeight); }
          checkPage(imgH + 34);
          doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
          doc.text("Así se ve en el sistema:", margin, y2);
          y2 += 10;
          var xImg = margin + (maxW - imgW) / 2;
          doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.7);
          doc.rect(xImg - 2, y2 - 2, imgW + 4, imgH + 4);
          try { doc.addImage(img, "JPEG", xImg, y2, imgW, imgH); } catch (e) {}
          y2 += imgH + 16;
        }
        piePagina(doc, margin);
      });

      return doc.output("arraybuffer");
    });
  }

  global.BIO_PDF_MANUAL = { buildManualPDF: buildManualPDF };
})(window);

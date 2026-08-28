/* BIOsoft — Manual de Usuario en PDF: guía paso a paso de cada módulo,
   generado con la marca del laboratorio para que el admin lo envíe
   fácilmente a su equipo por WhatsApp o correo. */
(function (global) {
  "use strict";

  function hexToRgb(hex) {
    hex = (hex || "#f97316").replace("#", "");
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  }

  function img(src, caption) { return { src: src, caption: caption }; }

  var SECCIONES = [
    {
      titulo: "1. Ingresar al sistema",
      imagenes: [img("assets/manual/ingreso-login.jpg", "Pantalla de inicio de sesión")],
      intro: "Cada persona del equipo tiene su propio usuario y contraseña. Así queda registrado quién hizo cada acción.",
      pasos: [
        "Abre el enlace de BIOsoft de tu laboratorio en el navegador (funciona en computador, tablet o celular).",
        "Ingresa tu usuario y contraseña en la pantalla de inicio de sesión.",
        "Si olvidaste tu contraseña, usa el enlace “¿Olvidaste tu contraseña?” para restablecerla por correo.",
        "Al entrar, verás el menú lateral con solo las secciones que tu rol puede usar (Recepción, Bacteriólogo o Administrador).",
        "Consejo: BIOsoft tiene Modo Offline — si se va la luz o el internet, puedes seguir capturando resultados con normalidad (incluso desde el celular). Verás un aviso en pantalla mientras estés sin conexión, y todo se sincroniza solo apenas vuelva la señal."
      ]
    },
    {
      titulo: "2. Configuración Inicial de tu Laboratorio",
      imagenes: [
        img("assets/manual/configuracion.jpg", "Identidad, datos fiscales y marca visual de tu laboratorio"),
        img("assets/manual/usuarios.jpg", "Usuarios del Laboratorio — el acceso de cada persona de tu equipo")
      ],
      intro: "Solo para Administradores: esto se hace UNA VEZ, antes de empezar a trabajar, para que todo el sistema (pantallas, PDF, informes) lleve la identidad de tu laboratorio.",
      pasos: [
        "Ve a “Configuración del Laboratorio” y completa Identidad y Datos: nombre, eslogan (aparece bajo el nombre en el encabezado de los informes de resultados), NIT/RIF/RUC, país, dirección, teléfonos, correo, sitio web, resolución de habilitación, código REPS y nivel de complejidad.",
        "Sube tu logo y elige los colores institucionales (primario, secundario, texto del menú, títulos y subtítulos) — se aplican de inmediato a toda la app y a los PDF que genera el sistema.",
        "Si trabajas con un aliado (ej. otro laboratorio que procesa la muestra) puedes subir también un Logo Secundario — aparece junto al tuyo en reportes, cotizaciones y recibos. También puedes elegir la Tipografía del Reporte (Helvetica, Times o Courier) para que combine con la imagen de tu laboratorio.",
        "En “Diseño del Reporte de Resultados” puedes activar que tu logo salga grande y centrado en el encabezado del informe (como un membrete, en vez del logo chico a la izquierda), elegir qué Datos Adicionales se muestran en el reporte del paciente (Edad/Sexo, EPS/Asegurador, Médico Remitente, Procedencia — desmarca los que no necesites), y definir un pie de página propio (ej. tu promesa de calidad) que aparece justo antes de la firma en cada informe.",
        "Define la clave de administrador: se pedirá cada vez que un bacteriólogo necesite corregir un resultado ya validado, para mantener la trazabilidad.",
        "Ve a “Usuarios del Laboratorio” y haz clic en “Nuevo Usuario” para crear el acceso de cada persona de tu equipo: nombre, usuario, contraseña y rol (Administrador, Bacteriólogo o Recepción).",
        "Para cada Bacteriólogo(a), asígnale las secciones que puede capturar y validar (Hematología, Química Sanguínea, etc.) y carga su firma digital — aparecerá en los informes que valide.",
        "Consejo: desde esta misma pantalla puedes descargar este Manual de Usuario en PDF o enviarlo por WhatsApp/correo a cualquier persona de tu equipo, ya con el logo y los colores de tu laboratorio."
      ]
    },
    {
      titulo: "3. Equipos Conectados — Interfaz con Analizadores de Laboratorio",
      imagenes: [
        img("assets/manual/equipos-conectados-modal.jpg", "Conectar un Equipo — registra tu analizador (ej. Mindray BC-10) y obtén su clave de interfaz"),
        img("assets/manual/equipos-conectados-lista.jpg", "Equipos Conectados — control de todos los analizadores enlazados a tu laboratorio")
      ],
      intro: "Función premium (incluida sin costo en el plan Plus; con costo adicional en Básico e Intermedio): conecta un analizador de laboratorio (por ejemplo, un equipo de hematología) para que los resultados lleguen directamente a BIOsoft, sin digitarlos a mano.",
      pasos: [
        "Ve a “Configuración del Laboratorio” — “Equipos Conectados” — “Conectar un Equipo”.",
        "Ponle un nombre al equipo, indica la sección (ej. Hematología) y el examen del catálogo al que corresponde (ej. Cuadro Hemático).",
        "Al guardar, BIOsoft genera una clave de interfaz única — la necesitarás para configurar el programa (middleware) que conecta el equipo físico con tu laboratorio.",
        "Crea, en “Usuarios del Laboratorio”, un usuario Bacteriólogo(a) dedicado exclusivamente a ese equipo, asignado solo a su sección — esas credenciales son las que usa la interfaz para conectarse de forma segura.",
        "Cuando el equipo transmite un resultado, este llega a BIOsoft como borrador con la etiqueta “Recibido de [equipo]” — nunca se valida ni se envía solo: un bacteriólogo humano siempre debe revisarlo y confirmarlo antes de firmarlo.",
        "Cada equipo conectado tiene un costo adicional de $10 USD/mes en los planes Básico e Intermedio; en el plan Plus está incluido sin costo."
      ]
    },
    {
      titulo: "4. Personaliza tu Catálogo de Exámenes y Valores de Referencia",
      imagenes: [
        img("assets/manual/catalogo-lista.jpg", "Busca, filtra o agrega exámenes y categorías nuevas"),
        img("assets/manual/catalogo-editor-examen.jpg", "Cambia el nombre y agrega el método/técnica de cualquier examen"),
        img("assets/manual/catalogo-rangos-genero-edad.jpg", "Rangos por género/edad con categoría — ideal para hormonas que varían según la fase (ej. FSH, LH)"),
        img("assets/manual/catalogo-rangos-interpretacion.jpg", "Rangos de Interpretación — ej. Hemoglobina Glicosilada: Normal / Prediabetes / Diabetes"),
        img("assets/manual/catalogo-captura-categoria.jpg", "Así se ve al capturar el resultado: aparece un selector para elegir qué categoría aplica")
      ],
      intro: "BIOsoft trae un catálogo completo de exámenes con sus valores de referencia estándar. Aquí lo ajustas exactamente a como trabaja tu laboratorio, sin afectar el catálogo general de BIOsoft — los cambios se aplican solo a tu cuenta.",
      pasos: [
        "Ve a “Valores de Referencia” y busca el examen por nombre o código CUPS, o filtra por sección.",
        "Haz clic en “Editar” para cambiar el nombre con el que tu laboratorio conoce el examen, agregar el método/técnica que usas (ej. ELISA, Quimioluminiscencia) o ajustar el mínimo, máximo y texto de referencia de cada parámetro según tu equipo.",
        "Si tu laboratorio procesa un examen que el catálogo no trae, usa “Agregar Examen Nuevo” para crearlo desde cero: nombre, sección, CUPS, muestra, tubo y todos los parámetros que necesites.",
        "Si necesitas una categoría que no está en la lista (Hematología, Química Sanguínea, etc.), créala con “Nueva Categoría” — queda disponible de inmediato en órdenes, resultados, usuarios y reportes.",
        "Para parámetros que varían según el sexo o la edad del paciente (ej. Hemoglobina distinta en hombres y mujeres), usa el botón “Por género/edad” y define cada rango — el sistema elige automáticamente el que corresponde a cada paciente.",
        "Para casos donde el rango no se puede saber solo con el sexo/edad (ej. las fases del ciclo menstrual en hormonas como FSH o LH), ponle una Etiqueta a cada rango (Fase Folicular, Ovulación, Lútea…). Al capturar el resultado, el sistema mostrará un selector para elegir cuál corresponde a esa paciente.",
        "Para exámenes con interpretación por tramos en vez del simple Bajo/Normal/Alto (ej. Hemoglobina Glicosilada: Normal / Prediabetes / Diabetes), usa el botón “Rangos de Interpretación” y define cada tramo con su propia etiqueta — se aplica solo según el valor que se capture.",
        "Para un parámetro que se calcula a partir de otros (ej. el Colesterol LDL, por la fórmula de Friedewald, o las Globulinas como Proteínas Totales menos Albúmina), usa el botón “Valor Calculado” y escribe la fórmula usando el código de cada parámetro como si fuera una variable (ej. COLT - HDL - (TGD/5)) — puede referenciar parámetros de otros exámenes de la misma orden, no solo del examen actual. Durante la captura de resultados, ese campo se llena solo, en tiempo real, y queda de solo lectura con una nota que muestra la fórmula usada; LDL y Globulinas ya vienen preconfigurados como ejemplo."
      ]
    },
    {
      titulo: "5. Pacientes",
      imagenes: [img("assets/manual/pacientes.jpg")],
      intro: "Aquí se registran los datos de cada paciente, una sola vez, para reutilizarlos en todas sus órdenes futuras.",
      pasos: [
        "Ve a “Pacientes” en el menú lateral y haz clic en “Nuevo Paciente”.",
        "Completa los datos personales, documento de identidad, EPS/asegurador y datos de contacto.",
        "Guarda el paciente. Ya queda disponible para crearle órdenes cuando lo necesites.",
        "Puedes buscar un paciente existente por nombre o número de documento en cualquier momento.",
        "Si alguien del equipo se equivocó al registrar un paciente (persona equivocada, duplicado), solo el Administrador ve un botón para eliminarlo — y solo funciona si ese paciente todavía no tiene ninguna orden creada, para no dejar resultados huérfanos."
      ]
    },
    {
      titulo: "6. Órdenes de Laboratorio",
      imagenes: [img("assets/manual/ordenes.jpg")],
      intro: "Una orden agrupa los exámenes que un paciente va a realizarse en una visita.",
      pasos: [
        "Ve a “Órdenes de Laboratorio” y haz clic en “Nueva Orden”.",
        "Selecciona el paciente (o créalo si es la primera vez que viene).",
        "Elige los exámenes por sección desde el catálogo (Hematología, Química, Inmunología, etc., incluyendo las categorías y exámenes propios que hayas agregado); puedes buscar por nombre.",
        "Registra el médico remitente y la procedencia si aplica.",
        "Si tu laboratorio indica el valor a cobrar en la orden (activable en “Configuración del Laboratorio”, sección Operación), el campo “Valor a Cobrar” se calcula solo según los exámenes elegidos — puedes ajustarlo a mano si hace falta; si tienes una moneda adicional configurada, también verás el equivalente (ej. en bolívares).",
        "Guarda la orden — automáticamente queda disponible en la bandeja de cada bacteriólogo, según la sección de cada examen.",
        "Desde aquí también puedes imprimir el sticker de identificación para los tubos de muestra.",
        "Si tu laboratorio indica el valor a cobrar en la orden, la lista de Órdenes muestra el estado del pago de cada una (“Pago pendiente” o “Pagado”) sin necesidad de abrirlas: con “Registrar Pago” confirmas que el cliente ya pagó (y el método) y se genera un Recibo de Pago profesional en tamaño carta, listo para imprimir o enviar por WhatsApp/correo; las que ya están pagadas tienen un botón “Recibo” para reimprimirlo o reenviarlo cuando lo necesites.",
        "Si una orden se creó de más por error (ej. dos veces seguidas para el mismo paciente), puedes eliminarla directamente desde la lista con el botón de eliminar (ícono de basurero) de su fila.",
        "Para laboratorios de Colombia: desde el detalle de la orden, el botón “Consentimiento Informado” genera el documento conforme a la Resolución 3100 de 2019 (una sola hoja, con los exámenes/procedimiento cubiertos). Puedes firmarlo ahí mismo entregando el celular o la tablet del laboratorio al paciente para que firme con el dedo, o enviarle un enlace único por WhatsApp/correo para que lo firme por su cuenta desde su propio celular, sin necesidad de instalar nada ni iniciar sesión."
      ]
    },
    {
      titulo: "7. Resultados (Bandeja de Trabajo)",
      imagenes: [img("assets/manual/resultados.jpg")],
      intro: "Cada bacteriólogo ve solo los exámenes de sus secciones asignadas, listos para capturar resultados.",
      pasos: [
        "Ve a “Resultados” — verás la lista de exámenes pendientes de tu sección.",
        "Abre un examen y digita los valores; el sistema muestra automáticamente el valor de referencia de cada parámetro.",
        "Si el parámetro tiene varios rangos que podrían aplicar (ej. las fases del ciclo menstrual — ver sección 4), aparecerá un selector para elegir cuál corresponde a ese resultado; la elección queda guardada.",
        "Guarda como “Borrador” si aún no está listo, “Preliminar” si quieres adelantarlo al paciente, o “Validado” cuando esté definitivo.",
        "Al validar, el resultado queda firmado electrónicamente con tu nombre, fecha y hora — no se puede editar sin la clave de administrador.",
        "Si un resultado validado necesita corrección, un Administrador debe ingresar la clave de administrador; la corrección queda registrada en la Trazabilidad."
      ]
    },
    {
      titulo: "8. Paneles de Selección — Antibiograma y Alergias",
      imagenes: [
        img("assets/manual/panel-antibiograma.jpg", "Antibiograma — elige los antibióticos del germen aislado y marca Sensible/Intermedio/Resistente"),
        img("assets/manual/panel-alergia.jpg", "Panel de Alergia — la Clase y la Interpretación se calculan solas según la concentración de IgE")
      ],
      intro: "Para exámenes con lista variable de opciones (antibiograma, paneles de alergia): en vez de escribir todo a mano, seleccionas de un catálogo maestro solo lo que aplica a ese caso.",
      pasos: [
        "En un Urocultivo y Antibiograma, ve al bloque “Antibiograma” dentro del examen y haz clic en los antibióticos más frecuentes (accesos rápidos) o búscalos en el selector.",
        "Para cada antibiótico agregado, marca el resultado: Sensible, Intermedio o Resistente.",
        "Si el antibiótico que necesitas no está en la lista, escribe su nombre en “¿No está en la lista?” y haz clic en “Agregar nuevo” — queda guardado en el catálogo de tu laboratorio para la próxima vez.",
        "En un Panel de Alergia, agrega los alérgenos probados de la misma forma, y digita la concentración de IgE de cada uno.",
        "La Clase (0 a 6) y la Interpretación (Positivo/Negativo) se calculan automáticamente — no hay que hacer ninguna cuenta a mano.",
        "Puedes quitar un ítem agregado por error con el botón de la “X” en su fila, en cualquier momento antes de validar."
      ]
    },
    {
      titulo: "9. Hoja de Remisión a Laboratorio de Referencia",
      imagenes: [
        img("assets/manual/remision-boton.jpg", "Botón “Hoja de Remisión” en el detalle de la orden (también disponible en la Bandeja de Resultados del bacteriólogo con el permiso activado)"),
        img("assets/manual/remision-modal.jpg", "Selecciona los exámenes, el laboratorio de referencia y, si lo necesitas, el valor de cada examen a modo de recibo")
      ],
      intro: "Para exámenes que tu laboratorio solo toma la muestra y remite a un laboratorio externo más especializado. Genera un documento profesional de trazabilidad, con cadena de custodia y código QR de verificación, conforme a la Resolución 3100.",
      pasos: [
        "Solo puede hacerlo un Administrador, o un Bacteriólogo(a) al que se le haya activado el permiso “Puede gestionar remisiones” desde “Usuarios del Laboratorio” (ver sección 2) — así el manejo de remisiones queda restringido a quien tú autorices.",
        "Abre la orden del paciente (desde “Órdenes de Laboratorio” si eres Administrador, o desde “Resultados” si eres el bacteriólogo delegado) y haz clic en “Hoja de Remisión”.",
        "Selecciona los exámenes que se van a remitir y completa los datos del laboratorio de referencia (nombre, dirección, teléfono/WhatsApp).",
        "Si necesitas llevar el control de costos de la remisión, activa “Incluir el valor de cada examen” — el documento funciona entonces también como recibo, con el total a cancelar.",
        "Haz clic en “1. Generar PDF”: se descarga la Hoja de Remisión con cadena de custodia (firma de quien entrega y quien recibe), código QR de trazabilidad y el número único de remisión.",
        "Elige “2. Elige dónde enviarlo” para mandarla por correo (Gmail/Outlook) o WhatsApp al laboratorio de referencia, adjuntando el PDF que acabas de descargar.",
        "Cada Hoja de Remisión generada queda guardada en el historial de la orden, con fecha, laboratorio y quién la generó, para poder descargarla de nuevo cuando la necesites.",
        "Cuando llegue el resultado del laboratorio externo, regístralo como siempre en “Resultados”: marca el examen como remitido y adjunta el PDF del informe externo — quedará incorporado dentro del informe final del paciente, tal como lo exige la normativa."
      ]
    },
    {
      titulo: "10. Hojas de Trabajo",
      imagenes: [img("assets/manual/hojas-trabajo.jpg")],
      intro: "Listas diarias de los exámenes pendientes por sección, ideales para el trabajo en el laboratorio o para imprimir.",
      pasos: [
        "Ve a “Hojas de Trabajo” y elige la fecha y la sección que quieres revisar.",
        "Verás todos los exámenes pendientes de esa sección para el día seleccionado.",
        "Puedes trabajar directamente en pantalla o imprimir la hoja para diligenciarla a mano y luego digitar los resultados."
      ]
    },
    {
      titulo: "11. Reportes y Envíos",
      imagenes: [img("assets/manual/reportes.jpg")],
      intro: "Desde aquí se genera el informe en PDF con la marca de tu laboratorio y se envía al paciente.",
      pasos: [
        "Ve a “Reportes y Envíos” y busca la orden del paciente.",
        "Elige si el envío es del informe “Final” (resultados validados) o “Preliminar” (anticipado).",
        "Descarga el PDF — queda listo con el logo, colores, firma digital del bacteriólogo y un código QR que verifica el nombre del paciente y la fecha del informe.",
        "El correo y el WhatsApp del paciente ya vienen precargados si están en su ficha; si falta alguno, verás un aviso con un botón para agregarlo sin salir de esta pantalla.",
        "Elige por dónde enviarlo: se abre WhatsApp o tu correo (Gmail/Outlook) ya redactado; solo adjunta el PDF que acabas de descargar."
      ]
    },
    {
      titulo: "12. Control de Calidad",
      imagenes: [img("assets/manual/control-calidad.jpg")],
      intro: "Permite llevar el control diario de los controles de calidad de cada analito, con alertas automáticas si algo se sale de rango (reglas de Westgard).",
      pasos: [
        "Ve a “Control de Calidad” y configura los controles (niveles, valores esperados) por analito, una sola vez.",
        "Cada día, registra la lectura del control antes de procesar las muestras de pacientes.",
        "El sistema evalúa automáticamente la lectura contra las reglas de Westgard y te avisa si hay una alerta; la confirmación con el resultado del día queda visible aunque cierres y vuelvas a entrar, con un botón “Corregir” si necesitas volver a capturarla.",
        "Consulta la gráfica de Levey-Jennings para ver la tendencia de cada analito en el tiempo.",
        "Haz clic en “Descargar Informe” para obtener un PDF profesional de Control de Calidad, con resumen ejecutivo, estadísticas (media real, DS real, CV%), la gráfica de cada control y el historial de violaciones de reglas de Westgard."
      ]
    },
    {
      titulo: "13. Cotizaciones",
      imagenes: [
        img("assets/manual/cotizador.jpg", "Nueva Cotización — selección rápida de exámenes con total automático"),
        img("assets/manual/cotizador-moneda.jpg", "Activa una moneda adicional (ej. USD) para tus clientes, junto a tu moneda principal")
      ],
      intro: "Genera cotizaciones profesionales en PDF para pacientes particulares o empresas, antes de crear la orden.",
      pasos: [
        "Ve a “Cotizaciones” y haz clic en “Nueva Cotización”.",
        "Selecciona los exámenes desde el buscador rápido; el sistema calcula el total automáticamente según tu lista de precios.",
        "En “Paquetes” arma perfiles como “Perfil Lipídico” o “Perfil 20”: elige qué exámenes incluye y ponle un solo precio total (distinto de sumar cada examen por separado). El paquete aparece como una opción más en el selector, siempre primero en la lista, con su propio precio — así cotizas de un clic los combos que más vendes.",
        "En “Lista de Precios” puedes activar una moneda adicional (ej. dólares o bolívares) con su tasa de cambio — actualízala cada vez que cambie (por ejemplo, a diario) y verás el equivalente junto a cada precio de la lista, en el total de cotizaciones, recibos, órdenes e historial, sin reemplazar tu moneda principal.",
        "Genera el PDF y envíalo por WhatsApp o correo directamente desde la pantalla.",
        "Consulta el historial de cotizaciones enviadas en cualquier momento."
      ]
    },
    {
      titulo: "14. Marketing Digital",
      imagenes: [img("assets/manual/marketing-remarketing.jpg")],
      intro: "Módulo con Inteligencia Artificial para ayudarte a conseguir y recuperar pacientes.",
      pasos: [
        "Ve a “Marketing Digital” y entra a “Remarketing con IA” para ver sugerencias automáticas de pacientes a contactar (por ejemplo, quienes no vuelven hace tiempo).",
        "Configura tus propias reglas de recall (a los cuántos días recontactar a un paciente según el tipo de examen).",
        "Usa el “Creador de Imágenes” para generar piezas gráficas listas para redes sociales, con el logo de tu laboratorio."
      ]
    },
    {
      titulo: "15. Inventario y Reactivos",
      imagenes: [img("assets/manual/inventario.jpg")],
      intro: "Kardex profesional para controlar tus insumos, su costo y el gasto real por cada examen realizado.",
      pasos: [
        "Ve a “Inventario y Reactivos” y entra a “Insumos” para registrar cada reactivo/insumo con su stock y costo — la unidad de medida sugiere las más comunes (mL, L, mg, unidades, tiras, viales, cajas…) pero puedes escribir otra si lo necesitas.",
        "En “Recetas por Examen”, indica cuánto se gasta de cada insumo al realizar cada tipo de examen (disponible para los exámenes del catálogo general).",
        "A partir de ahí, el sistema descuenta el inventario automáticamente cada vez que se valida un resultado — no necesitas hacerlo manual.",
        "Consulta el “Kardex” para ver cada movimiento de entrada/salida, y descarga los reportes de gasto de reactivos e inventario valorizado en PDF.",
        "Si un insumo ya no lo usas, elimínalo con el botón de eliminar (ícono de basurero) de su fila — el sistema te avisa si tiene stock o si está en uso en alguna receta de examen antes de confirmarlo."
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
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { resolve(null); };
      image.src = url;
    });
  }

  function buildManualPDF(tenant) {
    // Cada sección puede traer varias capturas de pantalla — se precargan
    // todas de una vez, en paralelo, respetando a qué sección/posición
    // pertenece cada una para poder recuperarlas después.
    var tareas = [];
    SECCIONES.forEach(function (s, si) {
      s.imagenes.forEach(function (im, ii) { tareas.push({ si: si, ii: ii, promesa: cargarImagen(im.src) }); });
    });
    return Promise.all(tareas.map(function (t) { return t.promesa; })).then(function (resultados) {
      var imagenesPorSeccion = SECCIONES.map(function () { return []; });
      tareas.forEach(function (t, idx) { imagenesPorSeccion[t.si][t.ii] = resultados[idx]; });

      var jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      var doc = new jsPDFCtor({ unit: "pt", format: "letter" });
      var margin = 50, pageW = doc.internal.pageSize.getWidth(), maxW = pageW - margin * 2;
      var rgb = hexToRgb(tenant.colorPrimario);

      // ---------- Portada ----------
      var y = 130;
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
        "Esta guía explica paso a paso cómo usar cada módulo del sistema BIOsoft, con capturas reales de pantalla, para que cualquier persona de tu equipo — sin experiencia previa en el software — pueda aprender a usarlo en minutos. Si es la primera vez que configuras tu laboratorio, empieza por la sección 2.",
        maxW - 60
      );
      doc.text(intro, pageW / 2, y, { align: "center" }); y += intro.length * 14 + 26;

      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
      doc.text("Contenido", pageW / 2, y, { align: "center" }); y += 20;
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

        var imagenesSeccion = imagenesPorSeccion[idx] || [];
        imagenesSeccion.forEach(function (imagen, ii) {
          if (!imagen || !imagen.naturalWidth) return;
          var imgW = maxW, imgH = imgW * (imagen.naturalHeight / imagen.naturalWidth);
          var maxImgH = 230;
          if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * (imagen.naturalWidth / imagen.naturalHeight); }
          checkPage(imgH + 40);
          var caption = (seccion.imagenes[ii] && seccion.imagenes[ii].caption) || "Así se ve en el sistema:";
          doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
          doc.text(caption, margin, y2);
          y2 += 10;
          var xImg = margin + (maxW - imgW) / 2;
          doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.7);
          doc.rect(xImg - 2, y2 - 2, imgW + 4, imgH + 4);
          try { doc.addImage(imagen, "JPEG", xImg, y2, imgW, imgH); } catch (e) {}
          y2 += imgH + 18;
        });
        piePagina(doc, margin);
      });

      return doc.output("arraybuffer");
    });
  }

  global.BIO_PDF_MANUAL = { buildManualPDF: buildManualPDF };
})(window);

/* BIOsoft — Planes comerciales, precios y links de pago (fuente única).
   Usado por el landing (index.html) y por el generador de contratos (app.html). */
(function (global) {
  "use strict";

  var IMPLEMENTACION = { cop: 380000, copFmt: "380.000", usd: 120, cuotaCop: 190000, cuotaCopFmt: "190.000", cuotaUsd: 60 };

  /* Conexión de equipos (interfaz con analizadores, ej. hematología,
     química) — incluida sin costo en el plan Plus; en los demás planes se
     cobra por equipo conectado, como ingreso adicional recurrente. */
  var INTERFAZ_EQUIPOS = { costoPorEquipoUsd: 10, costoPorEquipoCop: 40000, costoPorEquipoCopFmt: "40.000" };

  var PLANES = [
    { id: "basico", nombre: "Básico", usuarios: "1 usuario", limiteUsuarios: 1, precio: 120000, precioFmt: "120.000", usd: 45, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/ZrQT4t", interfazEquiposIncluida: false,
      items: ["Registro de pacientes y órdenes ilimitadas", "Resultados, validación y trazabilidad", "Reportes en PDF con tu marca", "Envío por correo y WhatsApp", "Soporte por WhatsApp", "Conexión de equipos de laboratorio: +$10 USD/mes por equipo"] },
    { id: "intermedio", nombre: "Intermedio", usuarios: "2 a 5 usuarios", limiteUsuarios: 5, precio: 180000, precioFmt: "180.000", usd: 60, destacado: true,
      wompiLink: "https://checkout.wompi.co/l/HZZJ7T", interfazEquiposIncluida: false,
      items: ["Todo lo del plan Básico", "Firma digital de cada bacteriólogo", "Exámenes remitidos a otros laboratorios", "Hojas de trabajo diarias y stickers de muestra", "Soporte prioritario", "Conexión de equipos de laboratorio: +$10 USD/mes por equipo"] },
    { id: "plus", nombre: "Plus", usuarios: "Hasta 10 usuarios", limiteUsuarios: 10, precio: 250000, precioFmt: "250.000", usd: 80, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/eEh3KM", interfazEquiposIncluida: true,
      items: ["Todo lo del plan Intermedio", "Valores de referencia personalizables por examen", "Trazabilidad y auditoría avanzada", "Ideal para laboratorios de alto volumen", "Soporte VIP prioritario", "Conexión de equipos de laboratorio incluida sin costo adicional"] }
  ];

  var TARJETAS_TXT = "💳 Aceptamos Visa, Mastercard y American Express (crédito y débito), PSE, Nequi, Bancolombia y otros medios de pago";

  function porId(id) { return PLANES.filter(function (p) { return p.id === id; })[0]; }

  // ---------------------------------------------------------------------
  // Estado de cuenta de cada laboratorio cliente (para el panel de socios).
  // "suspendido" es un interruptor manual del superadmin (bloquea el acceso
  // del laboratorio). Los demás estados se calculan solos a partir de
  // fechaProximoPago, comparada contra hoy.
  // ---------------------------------------------------------------------
  var DIAS_AVISO_VENCIMIENTO = 5;

  // Prueba gratis: el cliente prospecto usa BIOsoft con sus propios datos
  // reales por unos días, sin pagar ni elegir plan todavía — pensada para
  // generar confianza antes de la decisión de compra.
  var DIAS_PRUEBA_GRATIS = 3;

  var ESTADOS_CUENTA = {
    activo: { label: "Al día", badge: "badge-validado" },
    por_vencer: { label: "Por vencer", badge: "badge-pendiente" },
    vencido: { label: "Vencido", badge: "badge-urgente" },
    suspendido: { label: "Suspendido", badge: "badge-suspendido" },
    sin_fecha: { label: "Sin fecha de pago", badge: "badge-rutina" },
    en_prueba: { label: "Prueba gratis", badge: "badge-pendiente" },
    prueba_vencida: { label: "Prueba vencida", badge: "badge-urgente" }
  };

  function estadoCuenta(tenant) {
    if (!tenant) return "sin_fecha";
    if (tenant.suspendido) return "suspendido";
    if (tenant.esPruebaGratis) {
      if (!tenant.fechaFinPrueba) return "sin_fecha";
      return diasRestantes(tenant.fechaFinPrueba) < 0 ? "prueba_vencida" : "en_prueba";
    }
    if (!tenant.fechaProximoPago) return "sin_fecha";
    var diffDias = diasRestantes(tenant.fechaProximoPago);
    if (diffDias < 0) return "vencido";
    if (diffDias <= DIAS_AVISO_VENCIMIENTO) return "por_vencer";
    return "activo";
  }

  /* Días de diferencia entre hoy y una fecha "YYYY-MM-DD" — negativo si esa
     fecha ya pasó. Usada tanto por estadoCuenta() como por la pantalla de
     fin de prueba y el badge de "X días restantes" en el panel de socios. */
  function diasRestantes(fechaISO) {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var corte = new Date(fechaISO + "T00:00:00");
    return Math.round((corte - hoy) / 86400000);
  }

  // ---------------------------------------------------------------------
  // Planes y oferta de lanzamiento para la Propuesta Comercial del CRM
  // (ver "📄 Generar Propuesta" en Clientes/CRM). Es un catálogo APARTE de
  // PLANES (el que usan la landing pública, activar.html y los contratos ya
  // firmados) a propósito: refleja la política de precios vigente hoy —
  // los 4 planes incluyen exactamente lo mismo, la única diferencia es
  // cuántos usuarios pueden usar el sistema al mismo tiempo — sin tocar
  // ningún cobro o contrato que ya esté en producción con la estructura
  // anterior. Cuando se decida unificarlos, se hace aparte y con cuidado
  // (afecta la landing pública y el registro de nuevos clientes).
  // ---------------------------------------------------------------------
  var ITEMS_PROPUESTA = [
    "Pacientes y órdenes de laboratorio sin ningún límite ni tope",
    "Módulos con inteligencia artificial integrados",
    "Resultados, validación y trazabilidad clínica completa",
    "Firma digital de cada bacteriólogo(a) / bioanalista",
    "Informes en PDF 100% personalizados con tu marca",
    "Envío automático de resultados por correo y WhatsApp",
    "Hojas de trabajo diarias y stickers de rotulado de muestras",
    "Gestión de exámenes remitidos a otros laboratorios",
    "Valores de referencia personalizables por examen",
    "Cotizador, control de calidad y marketing digital",
    "Trazabilidad y auditoría avanzada de todo el laboratorio",
    "Soporte postventa las 24 horas, todos los días"
  ];
  var PLANES_PROPUESTA = [
    { id: "individual", nombre: "Individual", usuarios: "1 usuario simultáneo", usd: 45, precioFmt: "120.000" },
    { id: "equipo", nombre: "Equipo", usuarios: "2 a 5 usuarios simultáneos", usd: 60, precioFmt: "180.000", destacado: true },
    { id: "avanzado", nombre: "Avanzado", usuarios: "6 a 10 usuarios simultáneos", usd: 80, precioFmt: "250.000" },
    { id: "corporativo", nombre: "Corporativo", usuarios: "Más de 10 usuarios simultáneos", usd: 99, precioFmt: "320.000" }
  ];
  var PROMOCION_LANZAMIENTO_PROPUESTA = {
    implementacionUsd: 120,
    equiposGratis: 5,
    costoPorEquipoUsd: 10
  };

  global.BIO_PLANES = {
    IMPLEMENTACION: IMPLEMENTACION, PLANES: PLANES, TARJETAS_TXT: TARJETAS_TXT, porId: porId,
    INTERFAZ_EQUIPOS: INTERFAZ_EQUIPOS,
    ESTADOS_CUENTA: ESTADOS_CUENTA, DIAS_AVISO_VENCIMIENTO: DIAS_AVISO_VENCIMIENTO, estadoCuenta: estadoCuenta,
    DIAS_PRUEBA_GRATIS: DIAS_PRUEBA_GRATIS, diasRestantes: diasRestantes,
    ITEMS_PROPUESTA: ITEMS_PROPUESTA, PLANES_PROPUESTA: PLANES_PROPUESTA, PROMOCION_LANZAMIENTO_PROPUESTA: PROMOCION_LANZAMIENTO_PROPUESTA
  };
})(window);

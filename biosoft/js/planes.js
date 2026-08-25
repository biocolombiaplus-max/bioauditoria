/* BIOsoft — Planes comerciales, precios y links de pago (fuente única).
   Usado por el landing (index.html), activar.html, los contratos y la
   Propuesta Comercial del CRM (app.html). */
(function (global) {
  "use strict";

  var IMPLEMENTACION = { cop: 380000, copFmt: "380.000", usd: 120, cuotaCop: 190000, cuotaCopFmt: "190.000", cuotaUsd: 60 };

  /* Conexión de equipos (interfaz con analizadores, ej. hematología,
     química) — se cobra por equipo conectado como ingreso adicional
     recurrente, salvo la oferta de lanzamiento (ver PROMOCION_LANZAMIENTO
     abajo), que regala los primeros equipos al activarse. */
  var INTERFAZ_EQUIPOS = { costoPorEquipoUsd: 10, costoPorEquipoCop: 40000, costoPorEquipoCopFmt: "40.000" };

  /* Política de precios vigente (agosto 2026): los 4 planes incluyen
     EXACTAMENTE lo mismo — todos los módulos, con inteligencia artificial
     incluida, pacientes y órdenes sin ningún tope, soporte postventa 24/7 —
     la única diferencia entre uno y otro es cuántos usuarios pueden usar el
     sistema al mismo tiempo. Un solo array: lo usan la landing pública, el
     formulario de autoactivación, los contratos y la Propuesta Comercial,
     así todos muestran siempre lo mismo. */
  var ITEMS_COMUNES = [
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

  var PLANES = [
    { id: "individual", nombre: "Individual", usuarios: "1 usuario simultáneo", limiteUsuarios: 1, precio: 120000, precioFmt: "120.000", usd: 45, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/ZrQT4t", interfazEquiposIncluida: false, items: ITEMS_COMUNES },
    { id: "equipo", nombre: "Equipo", usuarios: "2 a 5 usuarios simultáneos", limiteUsuarios: 5, precio: 180000, precioFmt: "180.000", usd: 60, destacado: true,
      wompiLink: "https://checkout.wompi.co/l/HZZJ7T", interfazEquiposIncluida: false, items: ITEMS_COMUNES },
    { id: "avanzado", nombre: "Avanzado", usuarios: "6 a 10 usuarios simultáneos", limiteUsuarios: 10, precio: 250000, precioFmt: "250.000", usd: 80, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/eEh3KM", interfazEquiposIncluida: false, items: ITEMS_COMUNES },
    // NOTA: aún no tengo un link de pago Wompi real para este plan nuevo
    // (los otros 3 reutilizan los links existentes porque coinciden
    // exactamente en precio con los planes anteriores) — wompiLink queda
    // vacío hasta que me pases el link real; mientras tanto el botón de
    // pago directo de este plan en la landing simplemente no aparece.
    { id: "corporativo", nombre: "Corporativo", usuarios: "Más de 10 usuarios simultáneos", limiteUsuarios: null, precio: 320000, precioFmt: "320.000", usd: 99, destacado: false,
      wompiLink: "", interfazEquiposIncluida: false, items: ITEMS_COMUNES }
  ];

  // Oferta de lanzamiento vigente: se regala al activarse hoy, sin importar
  // el plan elegido — no es una diferencia entre planes, es una promoción
  // sobre TODOS ellos por igual.
  var PROMOCION_LANZAMIENTO = {
    implementacionUsd: IMPLEMENTACION.usd,
    equiposGratis: 5,
    costoPorEquipoUsd: INTERFAZ_EQUIPOS.costoPorEquipoUsd
  };

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

  global.BIO_PLANES = {
    IMPLEMENTACION: IMPLEMENTACION, PLANES: PLANES, TARJETAS_TXT: TARJETAS_TXT, porId: porId,
    INTERFAZ_EQUIPOS: INTERFAZ_EQUIPOS, PROMOCION_LANZAMIENTO: PROMOCION_LANZAMIENTO,
    ESTADOS_CUENTA: ESTADOS_CUENTA, DIAS_AVISO_VENCIMIENTO: DIAS_AVISO_VENCIMIENTO, estadoCuenta: estadoCuenta,
    DIAS_PRUEBA_GRATIS: DIAS_PRUEBA_GRATIS, diasRestantes: diasRestantes
  };
})(window);

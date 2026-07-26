/* BIOsoft — Planes comerciales, precios y links de pago (fuente única).
   Usado por el landing (index.html) y por el generador de contratos (app.html). */
(function (global) {
  "use strict";

  var IMPLEMENTACION = { cop: 380000, copFmt: "380.000", usd: 120, cuotaCop: 190000, cuotaCopFmt: "190.000", cuotaUsd: 60 };

  var PLANES = [
    { id: "basico", nombre: "Básico", usuarios: "1 usuario", limiteUsuarios: 1, precio: 120000, precioFmt: "120.000", usd: 45, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/ZrQT4t",
      items: ["Registro de pacientes y órdenes ilimitadas", "Resultados, validación y trazabilidad", "Reportes en PDF con tu marca", "Envío por correo y WhatsApp", "Soporte por WhatsApp"] },
    { id: "intermedio", nombre: "Intermedio", usuarios: "2 a 5 usuarios", limiteUsuarios: 5, precio: 180000, precioFmt: "180.000", usd: 60, destacado: true,
      wompiLink: "https://checkout.wompi.co/l/HZZJ7T",
      items: ["Todo lo del plan Básico", "Firma digital de cada bacteriólogo", "Exámenes remitidos a otros laboratorios", "Hojas de trabajo diarias y stickers de muestra", "Soporte prioritario"] },
    { id: "plus", nombre: "Plus", usuarios: "Hasta 10 usuarios", limiteUsuarios: 10, precio: 250000, precioFmt: "250.000", usd: 80, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/eEh3KM",
      items: ["Todo lo del plan Intermedio", "Valores de referencia personalizables por examen", "Trazabilidad y auditoría avanzada", "Ideal para laboratorios de alto volumen", "Soporte VIP prioritario"] }
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

  var ESTADOS_CUENTA = {
    activo: { label: "Al día", badge: "badge-validado" },
    por_vencer: { label: "Por vencer", badge: "badge-pendiente" },
    vencido: { label: "Vencido", badge: "badge-urgente" },
    suspendido: { label: "Suspendido", badge: "badge-suspendido" },
    sin_fecha: { label: "Sin fecha de pago", badge: "badge-rutina" }
  };

  function estadoCuenta(tenant) {
    if (!tenant) return "sin_fecha";
    if (tenant.suspendido) return "suspendido";
    if (!tenant.fechaProximoPago) return "sin_fecha";
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var corte = new Date(tenant.fechaProximoPago + "T00:00:00");
    var diffDias = Math.round((corte - hoy) / 86400000);
    if (diffDias < 0) return "vencido";
    if (diffDias <= DIAS_AVISO_VENCIMIENTO) return "por_vencer";
    return "activo";
  }

  global.BIO_PLANES = {
    IMPLEMENTACION: IMPLEMENTACION, PLANES: PLANES, TARJETAS_TXT: TARJETAS_TXT, porId: porId,
    ESTADOS_CUENTA: ESTADOS_CUENTA, DIAS_AVISO_VENCIMIENTO: DIAS_AVISO_VENCIMIENTO, estadoCuenta: estadoCuenta
  };
})(window);

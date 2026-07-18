/* BIOsoft — Planes comerciales, precios y links de pago (fuente única).
   Usado por el landing (index.html) y por el generador de contratos (app.html). */
(function (global) {
  "use strict";

  var IMPLEMENTACION = { cop: 380000, copFmt: "380.000", usd: 120 };

  var PLANES = [
    { id: "basico", nombre: "Básico", usuarios: "1 usuario", precio: 120000, precioFmt: "120.000", usd: 45, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/ZrQT4t",
      items: ["Registro de pacientes y órdenes ilimitadas", "Resultados, validación y trazabilidad", "Reportes en PDF con tu marca", "Envío por correo y WhatsApp", "Soporte por WhatsApp"] },
    { id: "intermedio", nombre: "Intermedio", usuarios: "2 a 5 usuarios", precio: 180000, precioFmt: "180.000", usd: 60, destacado: true,
      wompiLink: "https://checkout.wompi.co/l/HZZJ7T",
      items: ["Todo lo del plan Básico", "Firma digital de cada bacteriólogo", "Exámenes remitidos a otros laboratorios", "Hojas de trabajo diarias y stickers de muestra", "Soporte prioritario"] },
    { id: "plus", nombre: "Plus", usuarios: "Hasta 10 usuarios", precio: 250000, precioFmt: "250.000", usd: 80, destacado: false,
      wompiLink: "https://checkout.wompi.co/l/eEh3KM",
      items: ["Todo lo del plan Intermedio", "Valores de referencia personalizables por examen", "Trazabilidad y auditoría avanzada", "Ideal para laboratorios de alto volumen", "Soporte VIP prioritario"] }
  ];

  var TARJETAS_TXT = "💳 Aceptamos Visa, Mastercard y American Express (crédito y débito), PSE, Nequi, Bancolombia y otros medios de pago";

  function porId(id) { return PLANES.filter(function (p) { return p.id === id; })[0]; }

  global.BIO_PLANES = { IMPLEMENTACION: IMPLEMENTACION, PLANES: PLANES, TARJETAS_TXT: TARJETAS_TXT, porId: porId };
})(window);

/* BIOsoft — Lógica de demo-sitio.html: página pública (sin login) que se
   le envía a un cliente de BIOsoft como ejemplo de "así se vería la página
   web de tu laboratorio". Si la URL trae ?t=<tenantId>, se personaliza con
   el logo/color/contacto reales de ese laboratorio (ver
   abrirGenerarDemoPersonalizada en views-admin.js, que es quien escribe
   esos datos en la colección pública demoSitioWeb — ver store.js). Sin ese
   parámetro, o si no carga, se ve con la marca genérica de BIOsoft: la
   página NUNCA se rompe por falta de personalización. */
(function () {
  "use strict";

  var WA_BIOSOFT = "573505457420";

  function numeroWhatsapp(texto) {
    var n = (texto || "").replace(/\D/g, "");
    if (!n) return WA_BIOSOFT;
    // Toma el PRIMER número si "telefonos" trae varios separados por "·" u
    // otro signo — ya viene solo de dígitos aquí, así que se usan los
    // primeros 10 (celular colombiano típico) si el texto trae más de uno
    // pegado; si ya viene con indicativo de país (11-13 dígitos) se deja tal cual.
    if (n.length > 13) n = n.slice(0, 10);
    if (n.length === 10 && n.charAt(0) === "3") n = "57" + n;
    return n || WA_BIOSOFT;
  }
  function waLink(numero, mensaje) {
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje);
  }

  // ---------------------------------------------------------------------
  // Servicios / Ofertas / Testimonios — contenido de ejemplo. Los botones
  // "Cotizar" van SIEMPRE a WhatsApp (nunca muestran un precio en la
  // página, a propósito, para no revelarle precios a la competencia).
  // ---------------------------------------------------------------------
  var SERVICIOS = [
    { ic: "🩸", nombre: "Hematología", desc: "Cuadro hemático, VSG, frotis de sangre periférica y más." },
    { ic: "🧪", nombre: "Química Sanguínea", desc: "Glicemia, perfil lipídico, función renal y hepática." },
    { ic: "🧫", nombre: "Uroanálisis", desc: "Examen general de orina y urocultivo." },
    { ic: "🦠", nombre: "Serología", desc: "Pruebas de VIH, hepatitis, dengue y más." },
    { ic: "⚗️", nombre: "Hormonas", desc: "Tiroideas, reproductivas y de seguimiento prenatal." },
    { ic: "🔬", nombre: "Coprológico", desc: "Detección de parásitos y sangre oculta." }
  ];
  var OFERTAS = [
    { tag: "PROMO", nombre: "Perfil Lipídico Completo", desc: "Colesterol total, HDL, LDL y triglicéridos." },
    { tag: "POPULAR", nombre: "Chequeo Ejecutivo Anual", desc: "Hemograma, química completa, orina y más de 15 parámetros." },
    { tag: "FAMILIAR", nombre: "Combo Familiar (4 personas)", desc: "Exámenes básicos para toda la familia, un solo pago." }
  ];
  var TESTIMONIOS = [
    "[Espacio para un testimonio real de un paciente satisfecho]",
    "[Espacio para un testimonio real de un paciente satisfecho]",
    "[Espacio para un testimonio real de un paciente satisfecho]"
  ];

  // ---------------------------------------------------------------------
  // Orientador de exámenes — preguntas frecuentes FIJAS (nunca generadas
  // al vuelo): es solo orientación general, nunca un diagnóstico, y el
  // panel lo aclara siempre al pie (#orientador-aviso en demo-sitio.html).
  // ---------------------------------------------------------------------
  var FAQS = [
    { p: "¿Necesito estar en ayunas?", r: "Depende del examen: pruebas como glicemia, perfil lipídico o química sanguínea suelen requerir entre 8 y 12 horas de ayuno. Exámenes como el hemograma o el examen de orina generalmente no lo requieren. Confirma siempre con tu laboratorio cuál aplica al tuyo." },
    { p: "¿Puedo tomar agua antes del examen?", r: "Sí — el agua normalmente no rompe el ayuno. Evita café, jugos, gaseosas o cualquier bebida con calorías antes de la toma de muestra." },
    { p: "¿Qué NO debo hacer antes de un examen de sangre?", r: "Evita el alcohol 24 horas antes, el ejercicio intenso el día anterior, y fumar justo antes de la toma de muestra — pueden alterar los resultados." },
    { p: "¿Qué debo llevar el día de la toma de muestra?", r: "Tu documento de identidad, la orden médica (si la tienes) y, si es un seguimiento, tus resultados anteriores." },
    { p: "¿Cuánto tiempo toma recibir mis resultados?", r: "La mayoría de los exámenes de rutina (hemograma, química sanguínea) están listos en 24 horas; algunos exámenes especializados pueden tardar un poco más." },
    { p: "¿Debo suspender algún medicamento antes del examen?", r: "Algunos exámenes (como los perfiles hormonales) pueden verse afectados por ciertos medicamentos. Consulta siempre con tu médico antes de suspender cualquier tratamiento." },
    { p: "¿Puedo hacerme un examen de orina en mi periodo menstrual?", r: "Es preferible evitarlo o informarlo al laboratorio al momento de la toma, ya que puede alterar el resultado." },
    { p: "¿Los niños también deben estar en ayunas?", r: "Depende de la edad y del examen — en bebés y niños pequeños el ayuno prolongado no siempre es recomendable. Consulta con el pediatra o con el laboratorio antes de la toma." }
  ];

  function render() {
    document.getElementById("grid-servicios").innerHTML = SERVICIOS.map(function (s) {
      return '<div class="card-servicio"><div class="ic">' + s.ic + '</div><b>' + s.nombre + '</b><span class="desc">' + s.desc + '</span>' +
        '<a href="#" class="cotizar" data-cotizar="' + s.nombre + '">💲 Cotizar este examen →</a></div>';
    }).join("");

    document.getElementById("grid-ofertas").innerHTML = OFERTAS.map(function (o) {
      return '<div class="card-oferta"><span class="tag">' + o.tag + '</span><b>' + o.nombre + '</b><span class="desc">' + o.desc + '</span>' +
        '<a href="#" class="cotizar" data-cotizar="' + o.nombre + '">💲 Cotizar esta promoción</a></div>';
    }).join("");

    document.getElementById("grid-testimonios").innerHTML = TESTIMONIOS.map(function () {
      return '<div class="card-testimonio"><div class="estrellas">★★★★★</div><div style="font-size:13px;color:#334155;line-height:1.55">"[Espacio para un testimonio real de un paciente satisfecho]"</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><div class="avatar-ph">??</div><span style="font-size:12px;font-weight:700">[Nombre del paciente]</span></div></div>';
    }).join("");

    document.getElementById("orientador-lista").innerHTML = FAQS.map(function (f, i) {
      return '<div class="faq-item" id="faq-' + i + '"><button type="button" class="faq-pregunta" data-faq="' + i + '">' + f.p + '<span class="faq-flecha">▾</span></button><div class="faq-respuesta">' + f.r + '</div></div>';
    }).join("");
  }

  function wireOrientador() {
    var backdrop = document.getElementById("orientador-backdrop");
    function abrir() { backdrop.style.display = "flex"; }
    function cerrar() { backdrop.style.display = "none"; }
    document.querySelectorAll("[data-abrir-orientador]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); abrir(); }); });
    document.getElementById("btn-cerrar-orientador").addEventListener("click", cerrar);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) cerrar(); });
    document.querySelectorAll("[data-faq]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.getElementById("faq-" + btn.dataset.faq).classList.toggle("abierto");
      });
    });
  }

  function wireResultadosDemo() {
    var form = document.getElementById("resultado-form");
    var exito = document.getElementById("resultado-exito");
    var error = document.getElementById("resultado-error");
    function reiniciar() {
      form.style.display = "block"; exito.style.display = "none"; error.style.display = "none";
      document.getElementById("r-documento").value = ""; document.getElementById("r-clave").value = "";
    }
    document.getElementById("btn-consultar-resultado").addEventListener("click", function () {
      var ok = (document.getElementById("r-clave").value || "").trim().toUpperCase() === "DEMO1234";
      form.style.display = "none";
      exito.style.display = ok ? "flex" : "none";
      error.style.display = ok ? "none" : "flex";
    });
    document.getElementById("btn-reiniciar-resultado").addEventListener("click", reiniciar);
    document.getElementById("btn-reiniciar-error").addEventListener("click", reiniciar);
  }

  function wireCotizarWhatsapp(numero, nombreLab) {
    document.querySelectorAll("[data-cotizar]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var mensaje = "Hola, quiero cotizar el examen \"" + a.dataset.cotizar + "\" en " + nombreLab + " 🙌";
        window.open(waLink(numero, mensaje), "_blank");
      });
    });
    var mensajeHero = "Hola, quiero cotizar mis exámenes en " + nombreLab + " 🙌";
    ["btn-cotizar-hero", "btn-wa-header", "btn-wa-ubicacion", "btn-wa-barra", "boton-whatsapp-flotante"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = waLink(numero, mensajeHero);
    });
  }

  // ---------------------------------------------------------------------
  // Personalización: lee ?t=<tenantId> y aplica logo/nombre/color/contacto
  // desde la colección pública demoSitioWeb (sin sesión). Si falla o no
  // hay parámetro, la página se queda con la marca genérica — nunca se
  // rompe por esto (mismo criterio que landing-images.js).
  // ---------------------------------------------------------------------
  function personalizar() {
    var tenantId = new URLSearchParams(location.search).get("t");
    var nombreLabActual = "tu laboratorio";
    wireCotizarWhatsapp(WA_BIOSOFT, "Laboratorio Clínico Demo");

    if (!tenantId || typeof firebase === "undefined" || !window.BIO_FB || !window.BIO_FB.db) return;

    window.BIO_FB.db.collection("demoSitioWeb").doc(tenantId).get().then(function (doc) {
      if (!doc.exists) return;
      var d = doc.data();
      var nombre = d.nombre || nombreLabActual;
      var color = d.colorPrimario || "#f97316";
      var rgb = hexToRgb(color);

      document.documentElement.style.setProperty("--accent", color);
      if (rgb) document.documentElement.style.setProperty("--accent-rgb", rgb.join(","));

      if (d.logoDataUrl) {
        document.getElementById("marca-logo").innerHTML = '<img src="' + d.logoDataUrl + '" alt="Logo de ' + nombre + '"/>';
      } else {
        document.getElementById("marca-logo").textContent = (nombre || "LC").trim().slice(0, 2).toUpperCase();
      }
      document.getElementById("marca-nombre").textContent = nombre;
      document.getElementById("footer-nombre").textContent = "© 2026 " + nombre + " — Página web de ejemplo";
      document.title = "Demo — Página Web de " + nombre + " | BIOsoft";

      if (d.direccion) document.getElementById("dato-direccion").textContent = d.direccion;
      var contactoTxt = [d.telefonos, d.email].filter(Boolean).join(" · ");
      if (contactoTxt) document.getElementById("dato-contacto").textContent = contactoTxt;

      document.getElementById("franja-demo").innerHTML = "✨ Esta demo ya está personalizada con el logo y los colores de <b>" + nombre + "</b> — exactamente así se vería tu página web real";
      document.getElementById("texto-barra-personalizable").innerHTML = "💡 Esta ya es TU página, con tu logo y tus colores — ¿la activamos?";

      var numeroLab = numeroWhatsapp(d.telefonos);
      wireCotizarWhatsapp(numeroLab, nombre);
    }).catch(function (e) {
      console.warn("BIOsoft: no se pudo cargar la personalización de la demo ->", e && (e.code || e.message));
    });
  }

  function hexToRgb(hex) {
    hex = (hex || "").replace("#", "");
    if (hex.length !== 6) return null;
    var r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    if ([r, g, b].some(isNaN)) return null;
    return [r, g, b];
  }

  function init() {
    render();
    wireOrientador();
    wireResultadosDemo();
    personalizar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

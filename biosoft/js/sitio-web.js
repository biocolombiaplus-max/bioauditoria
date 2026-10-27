/* BIOsoft — Lógica de sitio-web.html: página web REAL (producción) de un
   laboratorio cliente, activada desde Configuración > "Página Web" por su
   propio administrador (tenant.paginaWeb.activo). A diferencia de
   demo-sitio.js (que es solo una vitrina de ventas con datos falsos), esta
   página consulta datos reales:
   - Branding / secciones / mapa: colección pública "demoSitioWeb" (mismo
     documento que usa la demo, con real:true — ver abrirResolverLimiteUsuarios
     y el guardado de Configuración en views-admin.js).
   - Resultados: colección pública "resultadosPublicos/{codigo}", escrita al
     enviar el resultado desde Reportes (ver views-reports.js). Solo permite
     consulta de UN resultado por código + documento — nunca una lista — para
     que nadie pueda enumerar resultados de otro paciente adivinando su cédula.

   Resolución del laboratorio: si la URL trae ?t=<tenantId> se usa directo
   (caso bioauditoria.com/biosoft/sitio-web.html?t=XXX); si no, se busca por
   el dominio propio del laboratorio (caso dominio personalizado, p.ej.
   laboratoriodivinamisericordia.com, apuntado por DNS a este mismo archivo). */
(function () {
  "use strict";

  function normalizarDocumento(v) { return (v || "").toString().replace(/[^A-Za-z0-9]/g, "").toUpperCase(); }

  // ---------------------------------------------------------------------
  // Contenido genérico de respaldo — se usa mientras carga la personalización
  // real, o si un laboratorio no ha llenado aún sus servicios/testimonios.
  // La página NUNCA se rompe por falta de datos (mismo criterio que demo-sitio.js).
  // ---------------------------------------------------------------------
  var SERVICIOS_GENERICOS = [
    { nombre: "Hematología", desc: "Cuadro hemático, VSG, frotis de sangre periférica y más." },
    { nombre: "Química Sanguínea", desc: "Glicemia, perfil lipídico, función renal y hepática." },
    { nombre: "Uroanálisis", desc: "Examen general de orina y urocultivo." },
    { nombre: "Serología", desc: "Pruebas de VIH, hepatitis, dengue y más." },
    { nombre: "Hormonas", desc: "Tiroideas, reproductivas y de seguimiento prenatal." },
    { nombre: "Coprológico", desc: "Detección de parásitos y sangre oculta." }
  ];
  var ICONOS_SERVICIO = ["🩸", "🧪", "🧫", "🦠", "⚗️", "🔬", "🩺", "📋"];
  var TESTIMONIOS_GENERICOS = [
    { texto: "Un laboratorio serio, rápido y con resultados confiables.", nombre: "Paciente" },
    { texto: "Excelente atención y resultados a tiempo.", nombre: "Paciente" }
  ];
  // A diferencia de servicios/testimonios, estos NUNCA inventan una cifra
  // sin respaldo (ej. "15 años de experiencia") — son cualidades ciertas
  // para cualquier laboratorio con BIOsoft activo, así que sirven de
  // respaldo seguro mientras el administrador no cargue sus propias cifras
  // reales (tenant.paginaWeb.stats, mismo formato "valor | etiqueta" que
  // servicios/testimonios).
  var STATS_GENERICOS = [
    { valor: "✅", etiqueta: "Resultados validados por Bacteriólogo" },
    { valor: "🔐", etiqueta: "Consulta tus resultados en línea" },
    { valor: "💬", etiqueta: "Atención directa por WhatsApp" }
  ];

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

  function numeroWhatsapp(texto) {
    var n = (texto || "").replace(/\D/g, "");
    if (!n) return "";
    if (n.length > 13) n = n.slice(0, 10);
    if (n.length === 10 && n.charAt(0) === "3") n = "57" + n;
    return n;
  }
  function waLink(numero, mensaje) { return "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje); }

  function renderGenericos() {
    pintarServicios(SERVICIOS_GENERICOS);
    pintarTestimonios(TESTIMONIOS_GENERICOS);
    pintarStats(STATS_GENERICOS);
    document.getElementById("orientador-lista").innerHTML = FAQS.map(function (f, i) {
      return '<div class="faq-item" id="faq-' + i + '"><button type="button" class="faq-pregunta" data-faq="' + i + '">' + f.p + '<span class="faq-flecha">▾</span></button><div class="faq-respuesta">' + f.r + '</div></div>';
    }).join("");
  }

  function pintarServicios(lista) {
    document.getElementById("grid-servicios").innerHTML = (lista || []).map(function (s, i) {
      return '<div class="card-servicio"><div class="ic">' + (ICONOS_SERVICIO[i % ICONOS_SERVICIO.length]) + '</div><b>' + (s.nombre || "") +
        '</b><span class="desc">' + (s.desc || "") + '</span><a href="#" class="cotizar" data-cotizar="' + (s.nombre || "") + '">💲 Cotizar este examen →</a></div>';
    }).join("");
  }

  function pintarTestimonios(lista) {
    document.getElementById("grid-testimonios").innerHTML = (lista || []).map(function (t) {
      var nombre = t.nombre || "Paciente";
      return '<div class="card-testimonio"><div class="estrellas">★★★★★</div><div style="font-size:13px;color:#334155;line-height:1.55">"' + (t.texto || "") + '"</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><div class="avatar-ph">' + nombre.trim().slice(0, 2).toUpperCase() + '</div><span style="font-size:12px;font-weight:700">' + nombre + '</span></div></div>';
    }).join("");
  }

  function pintarStats(lista) {
    document.getElementById("stats-row").innerHTML = (lista || []).slice(0, 4).map(function (s) {
      return '<div class="stat"><b>' + (s.valor || "") + '</b><span>' + (s.etiqueta || "") + '</span></div>';
    }).join("");
  }

  function pintarRedesSociales(d) {
    var redes = { facebook: (d.facebook || "").trim(), instagram: (d.instagram || "").trim(), tiktok: (d.tiktok || "").trim() };
    var hayRedes = false;
    Object.keys(redes).forEach(function (key) {
      var url = redes[key];
      document.querySelectorAll('[data-social="' + key + '"]').forEach(function (a) {
        if (url) { a.href = url; a.classList.remove("hidden"); hayRedes = true; }
        else a.classList.add("hidden");
      });
    });
    return hayRedes;
  }

  // La barra superior (horario + redes) solo aparece si hay algo real que
  // mostrar ahí — nunca una barra vacía, que se vería descuidado.
  function actualizarTopbar(d) {
    var hayRedes = pintarRedesSociales(d);
    var horario = (d.horario || "").trim();
    var topbar = document.getElementById("topbar");
    document.getElementById("topbar-horario").textContent = horario ? "🕒 " + horario.split("\n")[0] : "";
    topbar.classList.toggle("hidden", !(hayRedes || horario));
  }

  function actualizarFooter(d, nombre, direccionTxt, contactoTxt) {
    document.getElementById("footer-marca-nombre").textContent = nombre;
    document.getElementById("footer-copyright").textContent = "© " + new Date().getFullYear() + " " + nombre;
    if (direccionTxt) document.getElementById("footer-direccion").textContent = direccionTxt;
    if (contactoTxt) document.getElementById("footer-contacto").textContent = contactoTxt;
    var horario = (d.horario || "").trim();
    var col = document.getElementById("footer-horario-col");
    if (horario) {
      col.classList.remove("hidden");
      document.getElementById("footer-horario").textContent = horario;
    } else col.classList.add("hidden");
  }

  function wireOrientador() {
    var backdrop = document.getElementById("orientador-backdrop");
    function abrir() { backdrop.style.display = "flex"; }
    function cerrar() { backdrop.style.display = "none"; }
    document.querySelectorAll("[data-abrir-orientador]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); abrir(); }); });
    document.getElementById("btn-cerrar-orientador").addEventListener("click", cerrar);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) cerrar(); });
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-faq]");
      if (btn) document.getElementById("faq-" + btn.dataset.faq).classList.toggle("abierto");
    });
  }

  function wireCotizarWhatsapp(numero, nombreLab) {
    if (!numero) return;
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-cotizar]");
      if (!a) return;
      e.preventDefault();
      window.open(waLink(numero, "Hola, quiero cotizar el examen \"" + a.dataset.cotizar + "\" en " + nombreLab + " 🙌"), "_blank");
    });
    var mensajeHero = "Hola, quiero cotizar mis exámenes en " + nombreLab + " 🙌";
    ["btn-cotizar-hero", "btn-wa-header", "btn-wa-ubicacion", "boton-whatsapp-flotante"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = waLink(numero, mensajeHero);
    });
  }

  // ---------------------------------------------------------------------
  // Consulta REAL de resultados — un solo código + documento, nunca una
  // lista (ver nota de seguridad al inicio del archivo).
  // ---------------------------------------------------------------------
  function wireResultados(db) {
    var form = document.getElementById("resultado-form");
    var exito = document.getElementById("resultado-exito");
    var error = document.getElementById("resultado-error");
    var btn = document.getElementById("btn-consultar-resultado");
    var btnTextoOriginal = btn.textContent;

    function reiniciar() {
      form.style.display = "block"; exito.style.display = "none"; error.style.display = "none";
      document.getElementById("r-documento").value = ""; document.getElementById("r-clave").value = "";
    }
    function mostrarError(msg) {
      document.getElementById("rw-error-titulo").textContent = msg || "⚠️ No encontramos un resultado con esos datos.";
      form.style.display = "none"; exito.style.display = "none"; error.style.display = "flex";
    }
    function mostrarExito(d, codigo) {
      document.getElementById("rw-nombre-paciente").textContent = d.nombrePaciente || "Paciente";
      document.getElementById("rw-datos-orden").textContent = "Orden No. " + (d.numeroOrden || "—") + (d.fechaOrden ? " · " + d.fechaOrden : "");
      var link = document.getElementById("rw-btn-descargar");
      link.href = d.pdfDataUrl || "#";
      link.setAttribute("download", "Resultado-" + (d.numeroOrden || codigo) + ".pdf");
      form.style.display = "none"; error.style.display = "none"; exito.style.display = "flex";
    }

    btn.addEventListener("click", function () {
      var documento = (document.getElementById("r-documento").value || "").trim();
      var codigo = (document.getElementById("r-clave").value || "").trim().toUpperCase();
      if (!documento || !codigo) { mostrarError("⚠️ Ingresa tu número de documento y tu código de consulta."); return; }
      if (!db) { mostrarError("⚠️ El portal de resultados no está disponible en este momento. Escríbenos por WhatsApp."); return; }

      btn.disabled = true; btn.innerHTML = '<span class="spinner-rw"></span> Consultando…';
      db.collection("resultadosPublicos").doc(codigo).get().then(function (doc) {
        btn.disabled = false; btn.textContent = btnTextoOriginal;
        if (!doc.exists) { mostrarError(); return; }
        var d = doc.data();
        if (normalizarDocumento(d.numeroDocumento) !== normalizarDocumento(documento)) { mostrarError(); return; }
        mostrarExito(d, codigo);
      }).catch(function () {
        btn.disabled = false; btn.textContent = btnTextoOriginal;
        mostrarError("⚠️ No pudimos consultar tu resultado en este momento. Intenta de nuevo en unos minutos.");
      });
    });
    document.getElementById("btn-reiniciar-resultado").addEventListener("click", reiniciar);
    document.getElementById("btn-reiniciar-error").addEventListener("click", reiniciar);
  }

  function hexToRgb(hex) {
    hex = (hex || "").replace("#", "");
    if (hex.length !== 6) return null;
    var r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    if ([r, g, b].some(isNaN)) return null;
    return [r, g, b];
  }

  function aplicarMapa(mapsQuery) {
    var cont = document.getElementById("mapa-contenedor");
    if (!mapsQuery) return;
    cont.innerHTML = '<iframe src="https://www.google.com/maps?q=' + encodeURIComponent(mapsQuery) + '&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
  }

  function aplicarPersonalizacion(d) {
    var nombre = d.nombre || "Laboratorio Clínico";
    var color = d.colorPrimario || "#f97316";
    var rgb = hexToRgb(color);
    document.documentElement.style.setProperty("--accent", color);
    if (rgb) document.documentElement.style.setProperty("--accent-rgb", rgb.join(","));

    if (d.logoDataUrl) document.getElementById("marca-logo").innerHTML = '<img src="' + d.logoDataUrl + '" alt="Logo de ' + nombre + '"/>';
    else document.getElementById("marca-logo").textContent = nombre.trim().slice(0, 2).toUpperCase();
    document.getElementById("marca-nombre").textContent = nombre;
    document.getElementById("marca-eyebrow").textContent = "LABORATORIO CLÍNICO";
    document.title = nombre + " — Resultados y Citas";

    if (d.heroTitulo) document.getElementById("hero-titulo").textContent = d.heroTitulo;
    if (d.heroSubtitulo) document.getElementById("hero-subtitulo").textContent = d.heroSubtitulo;
    if (d.sobreNosotros) document.getElementById("sobre-nosotros").textContent = d.sobreNosotros;

    if (d.direccion) document.getElementById("dato-direccion").textContent = d.direccion;
    var contactoTxt = [d.telefonos, d.email].filter(Boolean).join(" · ");
    if (contactoTxt) document.getElementById("dato-contacto").textContent = contactoTxt;

    if (d.servicios && d.servicios.length) pintarServicios(d.servicios);
    if (d.testimonios && d.testimonios.length) pintarTestimonios(d.testimonios);
    if (d.stats && d.stats.length) pintarStats(d.stats);

    actualizarTopbar(d);
    actualizarFooter(d, nombre, d.direccion, contactoTxt);

    aplicarMapa(d.mapsQuery);

    var numeroLab = numeroWhatsapp(d.telefonos);
    if (numeroLab) wireCotizarWhatsapp(numeroLab, nombre);
  }

  function resolverTenantId(db, cb) {
    var t = new URLSearchParams(location.search).get("t");
    if (t) { cb(t); return; }
    if (!db) { cb(null); return; }
    var host = (location.hostname || "").replace(/^www\./, "");
    if (!host) { cb(null); return; }
    db.collection("demoSitioWeb").where("dominio", "==", host).limit(1).get().then(function (snap) {
      cb(snap.empty ? null : snap.docs[0].id);
    }).catch(function () { cb(null); });
  }

  function personalizar(db) {
    if (!db) return;
    resolverTenantId(db, function (tenantId) {
      if (!tenantId) return;
      db.collection("demoSitioWeb").doc(tenantId).get().then(function (doc) {
        if (doc.exists) aplicarPersonalizacion(doc.data());
      }).catch(function (e) {
        console.warn("BIOsoft: no se pudo cargar la personalización del sitio ->", e && (e.code || e.message));
      });
    });
  }

  function init() {
    renderGenericos();
    wireOrientador();
    wireResultados((window.BIO_FB && window.BIO_FB.db) || null);
    personalizar((window.BIO_FB && window.BIO_FB.db) || null);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

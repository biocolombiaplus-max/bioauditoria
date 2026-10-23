/* BIOsoft — Anuncios promocionales internos: un anuncio premium que se
   muestra como máximo UNA vez por día, al primer ingreso del usuario a la
   aplicación (login nuevo o sesión restaurada) — nunca interrumpe el
   trabajo, se cierra con la ✕ o haciendo clic afuera, igual que cualquier
   otro modal de BIOsoft (ver BIO_UI.openModal).

   Rotación de 3 anuncios, uno por día, en un ciclo de 3 días que se repite
   para siempre a partir de ANCLA (el día en que se activó este módulo =
   Página Web): no hace falta tocar este archivo para que la rotación
   siga funcionando más adelante.

   Promociona 3 productos adicionales de BIOsoft (ver acuerdo con el
   cliente): página web con portal de resultados, agente de WhatsApp 24/7,
   y manejo de redes sociales — cada uno con su propio precio en pesos
   colombianos y dólares. El clic en el botón principal abre WhatsApp con
   BIOsoft (mismo número de contacto que ya usa el Cotizador), con un
   mensaje ya escrito pidiendo ese producto.

   Diseño: tarjeta ancha de dos columnas (panel visual oscuro a la
   izquierda + contenido a la derecha), como los anuncios de upgrade de
   Stripe/Linear/Notion — mucho más "premium" en pantallas de computador
   que un popup angosto estirado. Se abre con BIO_UI.openModal(html,
   {lg:true}) para aprovechar el ancho de .modal-lg (920px), y un <style>
   con selector :has() reescribe el padding de .modal-card y el botón ✕
   SOLO mientras este anuncio está abierto (no toca el resto de modales
   de la app). */
(function (global) {
  "use strict";

  // Mismo número de contacto genérico de BIOsoft que ya usa el Cotizador
  // (ver WA_NUMBER_GENERICO en views-cotizador.js) — aquí es intencional
  // que sea SIEMPRE este número (no el del laboratorio): quien contesta es
  // el equipo comercial de BIOsoft, no el laboratorio cliente.
  var WA_BIOSOFT = "573505457420";

  // Día en que se activó la rotación: ese día = Página Web, el siguiente =
  // WhatsApp, el siguiente = Redes — y se repite el ciclo cada 3 días,
  // siempre. Reanclada al 24 de octubre de 2026 (desde el 23) para que la
  // Página Web —el anuncio con mejor rendimiento— vuelva a salir primero.
  var ANCLA = new Date(2026, 9, 24);

  function hoySinHora() {
    var h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), h.getDate());
  }
  function hoyISO() {
    var h = new Date();
    return h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0") + "-" + String(h.getDate()).padStart(2, "0");
  }
  function anuncioDeHoy() {
    var dias = Math.round((hoySinHora() - ANCLA) / 86400000);
    var idx = ((dias % 3) + 3) % 3;
    return ["web", "whatsapp", "redes"][idx];
  }

  // Un solo anuncio por día, por navegador — no por laboratorio ni por
  // usuario en Firestore: si alguien lo cierra en un computador, en otro
  // dispositivo lo sigue viendo (igual de molesto que nunca, nunca más de
  // una vez por día en cada sitio donde entra).
  var STORAGE_KEY = "biosoft_anuncio_ultima_fecha";
  function yaSeMostroHoy() {
    try { return localStorage.getItem(STORAGE_KEY) === hoyISO(); } catch (e) { return false; }
  }
  function marcarMostradoHoy() {
    try { localStorage.setItem(STORAGE_KEY, hoyISO()); } catch (e) {}
  }

  // Solo tiene sentido mostrárselo a quien de verdad usa el software del
  // laboratorio día a día (Administrador, Recepción, Bacteriólogo/a) —
  // nunca al superadmin (es BIOsoft mismo, no un cliente) ni a un aliado
  // (usuario externo de solo consulta de un convenio, no decide compras).
  function debeVerAnuncios(session) {
    return !!session && ["admin", "recepcion", "bacteriologo"].indexOf(session.rol) !== -1;
  }

  function waLink(mensaje) {
    return "https://wa.me/" + WA_BIOSOFT + "?text=" + encodeURIComponent(mensaje);
  }

  // ---------------------------------------------------------------------
  // Plantilla compartida: tarjeta de dos columnas.
  // ---------------------------------------------------------------------
  function shellHtml(opts) {
    var beneficiosHtml = opts.beneficios.map(function (b) {
      return '<div style="display:flex;gap:9px;align-items:flex-start;"><span style="color:#16a34a;font-weight:800;font-size:13px;flex:none;">✓</span><span style="font-size:13px;color:#1e293b;line-height:1.45;">' + b + '</span></div>';
    }).join("");

    var precioPanel =
      '<div style="margin-top:2px;position:relative;background:' + opts.precioBg + ';border:2px solid ' + opts.accent + ';border-radius:14px;padding:18px 18px 14px;display:flex;flex-direction:column;gap:10px;">' +
      '<span style="position:absolute;top:-12px;left:16px;background:#dc2626;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:4px 12px;border-radius:999px;box-shadow:0 4px 10px rgba(220,38,38,.35);">' + opts.ribbon + '</span>' +
      (opts.precioTachado
        ? '<div style="display:flex;align-items:baseline;gap:8px;margin-top:2px;"><span style="font-size:12px;color:#94a3b8;text-decoration:line-through;">' + opts.precioTachado + '</span><span style="background:#dc2626;color:#fff;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:6px;">' + opts.descuentoPct + '</span></div>'
        : (opts.planesDesde ? '<div style="font-size:10.5px;color:' + opts.accent + ';font-weight:800;margin-top:2px;letter-spacing:.03em;">' + opts.planesDesde + '</div>' : '<div style="margin-top:2px;"></div>')) +
      '<div style="display:flex;gap:12px;">' +
      '<div style="flex:1;text-align:center;background:#fff;border-radius:10px;padding:11px 8px;border:1px solid ' + opts.accent + '40;">' +
      '<div style="font-size:9.5px;color:#94a3b8;font-weight:800;letter-spacing:.05em;">PESOS COP</div>' +
      '<div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;">' + opts.precioCOP + '</div>' +
      '<div style="font-size:9.5px;color:' + opts.accent + ';font-weight:800;">' + opts.unidad + '</div>' +
      '</div>' +
      '<div style="flex:1;text-align:center;background:#fff;border-radius:10px;padding:11px 8px;border:1px solid ' + opts.accent + '40;">' +
      '<div style="font-size:9.5px;color:#94a3b8;font-weight:800;letter-spacing:.05em;">DÓLARES USD</div>' +
      '<div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;">' + opts.precioUSD + '</div>' +
      '<div style="font-size:9.5px;color:' + opts.accent + ';font-weight:800;">' + opts.unidad + '</div>' +
      '</div>' +
      '</div>' +
      (opts.destacado ? '<div style="background:' + opts.accent + ';border-radius:8px;padding:8px 11px;text-align:center;"><span style="font-size:11.5px;color:#fff;font-weight:800;">' + opts.destacado + '</span></div>' : "") +
      '<div style="font-size:11.5px;color:' + opts.notaColor + ';font-weight:700;line-height:1.4;">' + opts.nota + '</div>' +
      '</div>';

    return (
      '<style>' +
      '.modal:has(.bio-anuncio-card) .modal-card{padding:0 !important;overflow:hidden !important;border-radius:20px !important;box-shadow:0 40px 90px rgba(0,0,0,.4) !important;}' +
      '.modal:has(.bio-anuncio-card) .modal-x{background:rgba(255,255,255,.18) !important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px) !important;}' +
      '.modal:has(.bio-anuncio-card) .modal-x:hover{background:rgba(255,255,255,.32) !important;}' +
      '@media (max-width:760px){.bio-anuncio-card{flex-direction:column !important;}.bio-anuncio-visual{flex:none !important;width:100% !important;padding:28px 26px !important;}}' +
      '</style>' +
      '<div class="bio-anuncio-card" style="margin:-26px;display:flex;flex-wrap:wrap;min-height:540px;font-family:inherit;">' +

      '<div class="bio-anuncio-visual" style="flex:0 0 340px;width:340px;background:radial-gradient(circle at 28% 16%,' + opts.accent + '33,transparent 60%),#0b1120;padding:40px 32px;display:flex;flex-direction:column;justify-content:space-between;color:#fff;position:relative;">' +
      '<div style="display:flex;flex-direction:column;gap:20px;">' +
      '<div style="width:58px;height:58px;border-radius:16px;background:linear-gradient(135deg,' + opts.accent + ',' + opts.accent2 + ');display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 12px 26px ' + opts.accent + '55;">' + opts.icon + '</div>' +
      '<div>' +
      '<div style="font-size:10.5px;color:#94a3b8;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Nuevo · BIOsoft</div>' +
      '<div style="font-size:21px;font-weight:800;margin-top:5px;line-height:1.25;">' + opts.productoNombre + '</div>' +
      '</div>' +
      opts.visual +
      '</div>' +
      '<p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.5;">' + opts.trust + '</p>' +
      '</div>' +

      '<div style="flex:1 1 420px;min-width:320px;padding:40px 44px;display:flex;flex-direction:column;gap:15px;overflow-y:auto;max-height:min(680px,82vh);box-sizing:border-box;">' +
      '<span style="align-self:flex-start;display:inline-flex;align-items:center;gap:6px;background:' + opts.badgeBg + ';color:' + opts.badgeColor + ';font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:6px 13px;border-radius:999px;border:1px solid ' + opts.badgeBorder + ';">' + opts.badge + '</span>' +
      '<h3 style="margin:0;font-size:25px;line-height:1.24;color:#0f172a;font-weight:800;">' + opts.titulo + '</h3>' +
      '<p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">' + opts.subtitulo + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:9px;">' + beneficiosHtml + '</div>' +
      precioPanel +
      '<p style="margin:0;font-size:11px;color:#64748b;">🎨 100% personalizable — con el logo, los colores, los servicios y la información de <b>tu</b> laboratorio</p>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:2px;">' +
      '<a href="' + waLink(opts.mensajeWA) + '" target="_blank" rel="noopener" style="text-decoration:none;text-align:center;background:' + opts.accent + ';color:#fff;font-weight:800;font-size:14.5px;padding:14px 26px;border-radius:12px;box-shadow:0 10px 22px ' + opts.accent + '40;">' + opts.ctaTexto + '</a>' +
      '<button type="button" data-modal-close style="background:none;border:none;color:#94a3b8;font-size:12.5px;text-decoration:underline;cursor:pointer;padding:4px;">Tal vez más tarde</button>' +
      '</div>' +
      '</div>' +

      '</div>'
    );
  }

  function abrirAnuncioWeb() {
    var visual =
      '<div style="border-radius:12px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.35);">' +
      '<div style="background:#1e293b;padding:7px 10px;display:flex;align-items:center;gap:6px;">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:#f87171;display:inline-block;"></span>' +
      '<span style="width:7px;height:7px;border-radius:50%;background:#fbbf24;display:inline-block;"></span>' +
      '<span style="width:7px;height:7px;border-radius:50%;background:#34d399;display:inline-block;"></span>' +
      '<span style="margin-left:5px;font-size:9.5px;color:#94a3b8;">tulaboratorio.com</span>' +
      '</div>' +
      '<div style="background:#111827;padding:12px;display:flex;flex-direction:column;gap:7px;">' +
      '<div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:.03em;">🔐 CONSULTA TUS RESULTADOS</div>' +
      '<div style="height:8px;border-radius:4px;background:#334155;width:80%;"></div>' +
      '<div style="height:8px;border-radius:4px;background:#334155;width:55%;"></div>' +
      '<div style="margin-top:3px;align-self:flex-start;background:#f97316;color:#fff;font-size:10px;font-weight:800;padding:6px 13px;border-radius:8px;">Consultar →</div>' +
      '</div></div>';
    BIO_UI.openModal(shellHtml({
      accent: "#f97316", accent2: "#fb923c", icon: "🌐", productoNombre: "Página Web del Laboratorio",
      badge: "🚀 Nuevo · Exclusivo para clientes BIOsoft", badgeBg: "#fff7ed", badgeColor: "#c2410c", badgeBorder: "#fed7aa",
      titulo: "¿Hasta cuándo vas a seguir enviando resultados uno por uno?",
      subtitulo: 'Dale a cada paciente su propia clave de acceso y una <b style="color:#0f172a">página web profesional</b> para tu laboratorio, que trabaja por ti las 24 horas — sin WhatsApp, sin reprocesos.',
      visual: visual,
      beneficios: [
        "Resultados disponibles 24/7 con clave generada automáticamente por BIOsoft",
        "Página con tus servicios, ubicación y ofertas — tu portafolio digital",
        "Menos WhatsApp, menos reprocesos, más tiempo para tu laboratorio",
        "Presencia digital profesional que atrae más pacientes"
      ],
      precioBg: "#fff7ed", ribbon: "⏰ SOLO POR HOY",
      precioTachado: "$1.200.000 COP (USD $400) / año", descuentoPct: "-68%",
      precioCOP: "$380.000", precioUSD: "$140", unidad: "/ AÑO",
      destacado: "🗓️ ¡UN AÑO COMPLETO! — eso es menos de $32.000 COP (≈ $12 USD) al mes",
      notaColor: "#b45309", nota: "Precio por los 12 meses, no mensual · solo para los primeros 2 laboratorios que confirmen hoy — por ser nuestro cliente.",
      ctaTexto: "Quiero mi página web →",
      mensajeWA: "Hola, quiero mi página web con el descuento de hoy ($380.000 COP / $140 USD por el año completo) 🙌",
      trust: "✅ Ya lo usan laboratorios en Colombia, Venezuela y Ecuador"
    }), { lg: true });
  }

  function abrirAnuncioWhatsapp() {
    var visual =
      '<div style="border-radius:12px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.35);">' +
      '<div style="background:#16a34a;padding:8px 10px;display:flex;align-items:center;gap:7px;">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:10px;">🤖</span>' +
      '<span style="font-size:10.5px;color:#fff;font-weight:700;">Tu Laboratorio · Activo</span>' +
      '</div>' +
      '<div style="background:#1b2e20;padding:12px;display:flex;flex-direction:column;gap:7px;">' +
      '<div style="align-self:flex-start;background:#fff;border-radius:9px 9px 9px 2px;padding:8px 10px;font-size:10.5px;color:#1e293b;max-width:88%;">¿Cuánto cuesta un hemograma?</div>' +
      '<div style="align-self:flex-end;background:#dcf8c6;border-radius:9px 9px 2px 9px;padding:8px 10px;font-size:10.5px;color:#1e293b;max-width:88%;">¡Hola! 😊 Cuesta $XX.XXX. ¿Agendamos tu cita?</div>' +
      '<span style="align-self:flex-end;font-size:9px;color:#86efac;">⚡ Respondido en 2 segundos</span>' +
      '</div></div>';
    BIO_UI.openModal(shellHtml({
      accent: "#16a34a", accent2: "#22d3ee", icon: "🤖", productoNombre: "Agente de WhatsApp 24/7",
      badge: "🤖 Nuevo · Automatización de WhatsApp", badgeBg: "#f0fdf4", badgeColor: "#15803d", badgeBorder: "#bbf7d0",
      titulo: "Tu WhatsApp nunca duerme (aunque tú sí)",
      subtitulo: 'Un <b style="color:#0f172a">agente de WhatsApp profesional</b> que atiende solo a tus pacientes — precios, cotizaciones y atención al público, las 24 horas del día.',
      visual: visual,
      beneficios: [
        "Responde precios, cotizaciones y preguntas frecuentes al instante, 24/7",
        "Nunca pierdes un paciente por no contestar a tiempo",
        "Libera horas de trabajo a tu equipo de recepción cada semana",
        "Atención profesional y constante, incluso de madrugada o fin de semana"
      ],
      precioBg: "#f0fdf4", ribbon: "🎁 PRECIO ESPECIAL · SOLO HOY",
      precioTachado: "", descuentoPct: "",
      precioCOP: "$80.000", precioUSD: "$30", unidad: "/ MES",
      destacado: "",
      notaColor: "#15803d", nota: "Precio mensual (se renueva cada mes) · agenda hoy tu activación y asegura este valor como cliente BIOsoft.",
      ctaTexto: "Quiero mi Asistente de WhatsApp →",
      mensajeWA: "Hola, quiero activar el Agente de WhatsApp 24/7 para mi laboratorio ($80.000 COP / $30 USD al mes) 🤖",
      trust: "✅ Atención 24/7 sin contratar personal adicional"
    }), { lg: true });
  }

  function abrirAnuncioRedes() {
    var visual =
      '<div style="border-radius:12px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.35);">' +
      '<div style="background:#1e293b;padding:8px 10px;display:flex;align-items:center;gap:7px;">' +
      '<span style="font-size:10.5px;color:#fff;font-weight:700;">📸 @tulaboratorio</span>' +
      '<span style="margin-left:auto;font-size:9px;color:#4ade80;font-weight:700;">▲ en crecimiento</span>' +
      '</div>' +
      '<div style="background:#0f172a;padding:9px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">' +
      '<div style="aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#7c3aed,#ec4899);display:flex;align-items:center;justify-content:center;font-size:12px;">❤️</div>' +
      '<div style="aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#f97316,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:12px;">🔬</div>' +
      '<div style="aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#ec4899,#f97316);display:flex;align-items:center;justify-content:center;font-size:12px;">📊</div>' +
      '<div style="aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#f97316,#ec4899);display:flex;align-items:center;justify-content:center;font-size:12px;">🩺</div>' +
      '<div style="aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#7c3aed,#f97316);display:flex;align-items:center;justify-content:center;font-size:12px;">💬</div>' +
      '<div style="aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#ec4899,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:12px;">✨</div>' +
      '</div></div>';
    BIO_UI.openModal(shellHtml({
      accent: "#7c3aed", accent2: "#ec4899", icon: "📈", productoNombre: "Marketing Digital",
      badge: "📈 Nuevo · Marketing Digital para tu Laboratorio", badgeBg: "#faf5ff", badgeColor: "#7c2d92", badgeBorder: "#e9d5ff",
      titulo: "¿Tu laboratorio todavía no se ve en redes?",
      subtitulo: 'Manejamos tus redes sociales <b style="color:#0f172a">como una agencia de marketing</b>: contenido profesional, crecimiento real y más visibilidad en tu ciudad.',
      visual: visual,
      beneficios: [
        "Contenido profesional y diseño de publicaciones cada semana",
        "Estrategia pensada para atraer más pacientes desde redes sociales",
        "Más visibilidad en tu ciudad o zona de influencia",
        "Reportes mensuales para que veas el crecimiento real"
      ],
      precioBg: "#faf5ff", ribbon: "🎁 PRECIO ESPECIAL · SOLO HOY",
      precioTachado: "", descuentoPct: "", planesDesde: "PLANES DESDE",
      precioCOP: "$250.000", precioUSD: "$80", unidad: "/ MES",
      destacado: "",
      notaColor: "#7c2d92", nota: "Precio mensual (se renueva cada mes) · agenda hoy tu diagnóstico gratuito de redes y asegura este plan.",
      ctaTexto: "Quiero modernizar mis redes →",
      mensajeWA: "Hola, quiero modernizar las redes sociales de mi laboratorio (planes desde $250.000 COP / $80 USD al mes) 📈",
      trust: "✅ Resultados medibles, mes a mes"
    }), { lg: true });
  }

  function mostrarSiCorresponde() {
    var session = global.BIO_AUTH ? global.BIO_AUTH.getSession() : null;
    if (!debeVerAnuncios(session) || yaSeMostroHoy()) return;
    marcarMostradoHoy();
    var cual = anuncioDeHoy();
    if (cual === "web") abrirAnuncioWeb();
    else if (cual === "whatsapp") abrirAnuncioWhatsapp();
    else abrirAnuncioRedes();
  }

  global.BIO_ANUNCIOS_PROMO = { mostrarSiCorresponde: mostrarSiCorresponde };
})(window);

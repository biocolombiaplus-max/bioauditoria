/* BIOsoft — Marketing Digital: Remarketing con IA (recall clínico automático
   por reglas de edad/género/periodicidad) y Creador de Imágenes para redes
   sociales (WhatsApp Estado, Instagram, TikTok), 100% en el navegador. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG, R = BIO_RECALL;
  var WA_NUMBER_GENERICO = "573505457420";

  function waLinkTo(numero, mensaje) {
    var n = (numero || "").replace(/\D/g, "");
    return "https://wa.me/" + (n || WA_NUMBER_GENERICO) + "?text=" + encodeURIComponent(mensaje);
  }

  window.BIO_VIEWS.marketing = function (root) {
    var session = BIO_AUTH.getSession();
    var tenantId = session.tenantId;
    var tenant = S.getTenant(tenantId);
    var vista = "remarketing";
    var patients = [], orders = [], reglas = [], contactos = [], pendientes = [];

    function cargar() {
      patients = S.listPatients(tenantId);
      orders = S.listOrders(tenantId);
      reglas = S.remarketing.listReglas(tenantId);
      contactos = S.remarketing.listContactos(tenantId);
      pendientes = R.calcularRemarketing({ patients: patients, orders: orders, reglas: reglas, contactos: contactos });
      build();
    }

    function build() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">🤖 Marketing Digital</h3>' +
        '<div class="crm-view-toggle">' +
        '<button type="button" class="' + (vista === "remarketing" ? "active" : "") + '" data-vista="remarketing">🎯 Remarketing IA' + (pendientes.length ? ' <span class="badge badge-validado" style="margin-left:4px">' + pendientes.length + "</span>" : "") + "</button>" +
        '<button type="button" class="' + (vista === "reglas" ? "active" : "") + '" data-vista="reglas">⚙️ Reglas de Recall</button>' +
        '<button type="button" class="' + (vista === "imagenes" ? "active" : "") + '" data-vista="imagenes">🎨 Creador de Imágenes</button>' +
        "</div></div>" +
        (vista === "remarketing" ? buildRemarketingHtml() : vista === "reglas" ? buildReglasHtml() : buildImagenesHtml()) +
        "</div>";
      root.querySelectorAll("[data-vista]").forEach(function (b) { b.addEventListener("click", function () { vista = b.dataset.vista; build(); }); });
      if (vista === "remarketing") wireRemarketing(); else if (vista === "reglas") wireReglas(); else wireImagenes();
    }

    // ---------------------------------------------------------------------
    // REMARKETING IA — lista diaria de pacientes para contactar
    // ---------------------------------------------------------------------
    function buildRemarketingHtml() {
      if (!reglas.length) {
        return '<div class="callout-ia">🤖 <b>Activa el Remarketing con IA:</b> carga las reglas de recall recomendadas (por examen, edad y género) y BIOsoft empezará a detectar todos los días qué pacientes contactar.</div>' +
          '<button class="btn btn-primary" id="btn-cargar-reglas-recall" style="margin-top:14px">' + U.icon("plus") + " Activar Remarketing IA (cargar reglas recomendadas)</button>";
      }
      if (!pendientes.length) {
        return '<p class="text-muted" style="margin-top:14px">✅ Al día. Ningún paciente requiere remarketing hoy según tus reglas activas. BIOsoft sigue revisando automáticamente cada vez que entras a este módulo.</p>';
      }
      return '<p class="text-muted" style="margin:14px 0">La IA de BIOsoft revisó tu base de pacientes y encontró <b>' + pendientes.length + " oportunidad(es)</b> de remarketing hoy, cruzando historial de exámenes con edad y género.</p>" +
        '<div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Edad / Género</th><th>Examen recomendado</th><th>Motivo</th><th>Contacto</th><th></th></tr></thead><tbody>' +
        pendientes.map(function (item, i) {
          var edad = R.calcEdadNum(item.patient.fechaNacimiento);
          var motivo = item.nunca
            ? '<span class="badge badge-pendiente">Nunca se lo ha hecho</span>'
            : '<span class="badge badge-preliminar">Vencido hace ' + item.diasVencido + " días</span>";
          return "<tr><td>" + U.esc(U.nombreCompleto(item.patient)) + "</td><td>" + edad + " años · " + item.patient.sexo + "</td>" +
            "<td>" + U.esc(item.regla.nombre) + "</td><td>" + motivo + "</td>" +
            "<td>" + (item.patient.celular ? "📱 " + U.esc(item.patient.celular) : "") + (item.patient.email ? "<br>✉️ " + U.esc(item.patient.email) : "") + "</td>" +
            "<td><button class='btn btn-outline btn-sm' data-contactar='" + i + "'>" + U.icon("send") + " Contactar</button></td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function wireRemarketing() {
      var btnCargar = document.getElementById("btn-cargar-reglas-recall");
      if (btnCargar) {
        btnCargar.addEventListener("click", function () {
          S.remarketing.bulkCreateReglas(tenantId, R.DEFAULT_REGLAS);
          U.toast("Remarketing IA activado con " + R.DEFAULT_REGLAS.length + " reglas recomendadas.", "success");
          cargar();
        });
        return;
      }
      root.querySelectorAll("[data-contactar]").forEach(function (b) {
        b.addEventListener("click", function () { abrirContacto(pendientes[Number(b.dataset.contactar)]); });
      });
    }

    function abrirContacto(item) {
      var msgWa = R.mensajeWhatsapp(item, tenant);
      var correoInfo = R.mensajeCorreo(item, tenant);
      var wrap = U.openModal(
        '<h3 class="modal-title">Contactar a ' + U.esc(U.nombreCompleto(item.patient)) + "</h3>" +
        '<div class="field"><label>Mensaje de WhatsApp</label><textarea id="mktg-msg-wa" rows="4">' + U.esc(msgWa) + "</textarea></div>" +
        (item.patient.celular ? '<button class="btn btn-whatsapp btn-block" id="mktg-send-wa">' + U.icon("send") + " Enviar por WhatsApp</button>" : '<p class="text-muted">Este paciente no tiene celular registrado.</p>') +
        (item.patient.email ? '<div style="margin-top:14px">' + U.emailProviderButtonsHtml("mktg-mail") + "</div>" : "") +
        '<div class="flex justify-between" style="margin-top:16px"><button class="btn btn-ghost" data-modal-close>Cerrar</button></div>'
      );
      if (item.patient.celular) {
        wrap.querySelector("#mktg-send-wa").addEventListener("click", function () {
          window.open(waLinkTo(item.patient.celular, wrap.querySelector("#mktg-msg-wa").value), "_blank");
          registrarContacto(item, "whatsapp");
        });
      }
      if (item.patient.email) {
        U.wireEmailProviderButtons(wrap, "mktg-mail", item.patient.email, correoInfo.asunto, correoInfo.cuerpo);
        wrap.querySelectorAll("#mktg-mail-gmail, #mktg-mail-outlook, #mktg-mail-mailto").forEach(function (b) {
          b.addEventListener("click", function () { registrarContacto(item, "correo"); });
        });
      }
    }

    function registrarContacto(item, canal) {
      S.remarketing.registrarContacto({ tenantId: tenantId, patientId: item.patient.id, reglaId: item.regla.id, canal: canal });
      U.toast("Contacto registrado. No se volverá a sugerir por " + item.regla.nombre + " en los próximos días.", "success");
      U.closeModal(document.querySelector(".modal"));
      cargar();
    }

    // ---------------------------------------------------------------------
    // REGLAS DE RECALL
    // ---------------------------------------------------------------------
    function buildReglasHtml() {
      if (!reglas.length) {
        return '<p class="text-muted" style="margin-top:14px">Aún no hay reglas configuradas.</p>' +
          '<button class="btn btn-primary" id="btn-cargar-reglas-recall2" style="margin-top:8px">' + U.icon("plus") + " Cargar reglas recomendadas</button>";
      }
      return '<p class="text-muted" style="margin:14px 0">Estas reglas determinan a quién le sugiere BIOsoft contactar y con qué mensaje. Actívalas, desactívalas o ajusta la periodicidad.</p>' +
        '<div class="table-wrap"><table><thead><tr><th>Examen</th><th>Género</th><th>Edad</th><th>Cada</th><th>Activa</th></tr></thead><tbody>' +
        reglas.map(function (r) {
          return "<tr><td>" + U.esc(r.nombre) + "</td><td>" + r.generoObjetivo + "</td>" +
            "<td>" + (r.edadMin || 0) + (r.edadMax ? "–" + r.edadMax : "+") + " años</td>" +
            "<td><input type='number' min='1' step='1' data-intervalo='" + r.id + "' value='" + r.intervaloMeses + "' style='width:64px'/> meses</td>" +
            "<td><label class='switch'><input type='checkbox' data-activa='" + r.id + "' " + (r.activa !== false ? "checked" : "") + "/><span class='slider'></span></label></td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<button class="btn btn-primary" id="btn-guardar-reglas" style="margin-top:14px">' + U.icon("check") + " Guardar Cambios</button>";
    }

    function wireReglas() {
      var btnCargar2 = document.getElementById("btn-cargar-reglas-recall2");
      if (btnCargar2) {
        btnCargar2.addEventListener("click", function () {
          S.remarketing.bulkCreateReglas(tenantId, R.DEFAULT_REGLAS);
          U.toast("Reglas de recall cargadas.", "success");
          cargar();
        });
        return;
      }
      var btnGuardar = document.getElementById("btn-guardar-reglas");
      if (btnGuardar) {
        btnGuardar.addEventListener("click", function () {
          root.querySelectorAll("[data-intervalo]").forEach(function (inp) {
            S.remarketing.updateRegla(inp.dataset.intervalo, { intervaloMeses: parseInt(inp.value, 10) || 12 });
          });
          root.querySelectorAll("[data-activa]").forEach(function (chk) {
            S.remarketing.updateRegla(chk.dataset.activa, { activa: chk.checked });
          });
          U.toast("Reglas actualizadas.", "success");
          cargar();
        });
      }
    }

    // ---------------------------------------------------------------------
    // CREADOR DE IMÁGENES — plantillas premium para WhatsApp/Instagram/TikTok
    // ---------------------------------------------------------------------
    var CATEGORIAS = [
      { id: "urgente", emoji: "🚨", kicker: "AVISO URGENTE", c1: "#dc2626", c2: "#f97316", titulo: "Atención pacientes", subtitulo: "Información importante que debes conocer hoy." },
      { id: "promocion", emoji: "🎉", kicker: "PROMOCIÓN ESPECIAL", c1: "#7c3aed", c2: "#ec4899", titulo: "Descuento especial", subtitulo: "Válido por tiempo limitado. ¡No te lo pierdas!" },
      { id: "info", emoji: "ℹ️", kicker: "INFORMACIÓN DE INTERÉS", c1: "#0369a1", c2: "#06b6d4", titulo: "Sabías que...", subtitulo: "Cuidar tu salud empieza por hacerte tus exámenes a tiempo." },
      { id: "jornada", emoji: "🩺", kicker: "JORNADA DE SALUD", c1: "#059669", c2: "#0d9488", titulo: "Jornada especial de salud", subtitulo: "Exámenes con descuento este fin de semana." },
      { id: "marca", emoji: "✨", kicker: "", c1: (tenant && tenant.colorPrimario) || "#f97316", c2: (tenant && tenant.colorSecundario) || "#7c3aed", titulo: (tenant && tenant.nombre) || "Tu laboratorio", subtitulo: "Resultados confiables, entrega rápida." }
    ];
    var FORMATOS = [
      { id: "story", label: "WhatsApp / Instagram / TikTok (9:16)", w: 1080, h: 1920 },
      { id: "cuadrada", label: "Publicación cuadrada (1:1)", w: 1080, h: 1080 }
    ];
    var mktgState = {
      categoria: CATEGORIAS[1].id, formato: FORMATOS[0].id,
      kicker: CATEGORIAS[1].kicker, titulo: CATEGORIAS[1].titulo, subtitulo: CATEGORIAS[1].subtitulo,
      c1: CATEGORIAS[1].c1, c2: CATEGORIAS[1].c2, mostrarGuia: true, fondoImg: null
    };

    function buildImagenesHtml() {
      return '<p class="text-muted" style="margin:14px 0">Crea imágenes profesionales para Estados de WhatsApp, Instagram y TikTok en segundos. Elige una plantilla, cambia el texto y el fondo, y descárgala lista para publicar — respetando los márgenes seguros de cada red.</p>' +
        '<div class="mktg-editor">' +
        '<div class="mktg-controls">' +
        '<div class="field"><label>Tipo de publicación</label><select id="mktg-categoria">' +
        CATEGORIAS.map(function (c) { return '<option value="' + c.id + '" ' + (c.id === mktgState.categoria ? "selected" : "") + ">" + c.emoji + " " + (c.kicker || "Marca del laboratorio") + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Formato</label><select id="mktg-formato">' +
        FORMATOS.map(function (f) { return '<option value="' + f.id + '" ' + (f.id === mktgState.formato ? "selected" : "") + ">" + f.label + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Etiqueta superior</label><input id="mktg-kicker" value="' + U.esc(mktgState.kicker) + '"/></div>' +
        '<div class="field"><label>Título</label><input id="mktg-titulo" value="' + U.esc(mktgState.titulo) + '"/></div>' +
        '<div class="field"><label>Texto / Subtítulo</label><textarea id="mktg-subtitulo" rows="3">' + U.esc(mktgState.subtitulo) + "</textarea></div>" +
        '<div class="field"><label>Colores de fondo</label><div class="mktg-swatches" id="mktg-swatches"></div></div>' +
        '<div class="field"><label>Color 1</label><input type="color" id="mktg-c1" value="' + mktgState.c1 + '"/></div>' +
        '<div class="field"><label>Color 2</label><input type="color" id="mktg-c2" value="' + mktgState.c2 + '"/></div>' +
        '<div class="field"><label class="btn btn-outline btn-sm" style="cursor:pointer;display:inline-block">' + U.icon("plus") + ' Subir imagen de fondo<input type="file" id="mktg-fondo-file" accept="image/*" style="display:none"/></label> <button class="btn btn-ghost btn-sm" id="mktg-fondo-quitar" type="button">Quitar imagen</button></div>' +
        '<label class="flex items-center gap-2" style="font-size:12.5px;margin-top:6px"><input type="checkbox" id="mktg-guia" ' + (mktgState.mostrarGuia ? "checked" : "") + "/> Mostrar guía de márgenes seguros (solo en el editor)</label>" +
        '<button class="btn btn-primary btn-block" id="mktg-descargar" style="margin-top:16px">' + U.icon("download") + " Descargar Imagen (PNG)</button>" +
        "</div>" +
        '<div class="mktg-canvas-wrap"><canvas id="mktg-canvas"></canvas></div>' +
        "</div>";
    }

    function wireImagenes() {
      var $ = function (id) { return document.getElementById(id); };
      var canvas = $("mktg-canvas");

      $("mktg-swatches").innerHTML = CATEGORIAS.map(function (c) {
        return '<button type="button" class="mktg-swatch" data-swatch="' + c.id + '" style="background:linear-gradient(135deg,' + c.c1 + "," + c.c2 + ')" title="' + (c.kicker || "Marca") + '"></button>';
      }).join("");

      function redibujar() { dibujarPlantilla(canvas, mktgState); }

      $("mktg-categoria").addEventListener("change", function (e) {
        var cat = CATEGORIAS.filter(function (c) { return c.id === e.target.value; })[0];
        mktgState.categoria = cat.id; mktgState.kicker = cat.kicker; mktgState.titulo = cat.titulo; mktgState.subtitulo = cat.subtitulo;
        mktgState.c1 = cat.c1; mktgState.c2 = cat.c2;
        $("mktg-kicker").value = cat.kicker; $("mktg-titulo").value = cat.titulo; $("mktg-subtitulo").value = cat.subtitulo;
        $("mktg-c1").value = cat.c1; $("mktg-c2").value = cat.c2;
        redibujar();
      });
      $("mktg-formato").addEventListener("change", function (e) { mktgState.formato = e.target.value; redibujar(); });
      $("mktg-kicker").addEventListener("input", function (e) { mktgState.kicker = e.target.value; redibujar(); });
      $("mktg-titulo").addEventListener("input", function (e) { mktgState.titulo = e.target.value; redibujar(); });
      $("mktg-subtitulo").addEventListener("input", function (e) { mktgState.subtitulo = e.target.value; redibujar(); });
      $("mktg-c1").addEventListener("input", function (e) { mktgState.c1 = e.target.value; redibujar(); });
      $("mktg-c2").addEventListener("input", function (e) { mktgState.c2 = e.target.value; redibujar(); });
      $("mktg-guia").addEventListener("change", function (e) { mktgState.mostrarGuia = e.target.checked; redibujar(); });
      root.querySelectorAll("[data-swatch]").forEach(function (b) {
        b.addEventListener("click", function () {
          var cat = CATEGORIAS.filter(function (c) { return c.id === b.dataset.swatch; })[0];
          mktgState.c1 = cat.c1; mktgState.c2 = cat.c2;
          $("mktg-c1").value = cat.c1; $("mktg-c2").value = cat.c2;
          redibujar();
        });
      });
      $("mktg-fondo-file").addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var img = new Image();
        img.onload = function () { mktgState.fondoImg = img; redibujar(); };
        img.src = URL.createObjectURL(file);
      });
      $("mktg-fondo-quitar").addEventListener("click", function () { mktgState.fondoImg = null; redibujar(); });
      $("mktg-descargar").addEventListener("click", function () {
        var guiaPrevia = mktgState.mostrarGuia;
        mktgState.mostrarGuia = false;
        dibujarPlantilla(canvas, mktgState);
        var url = canvas.toDataURL("image/png");
        mktgState.mostrarGuia = guiaPrevia;
        redibujar();
        var a = document.createElement("a");
        a.href = url; a.download = "BIOsoft_" + mktgState.categoria + "_" + Date.now() + ".png";
        document.body.appendChild(a); a.click(); a.remove();
      });

      redibujar();
    }

    function envolverTexto(ctx, texto, maxAncho) {
      var palabras = String(texto || "").split(" ");
      var lineas = [], actual = "";
      palabras.forEach(function (p) {
        var prueba = actual ? actual + " " + p : p;
        if (ctx.measureText(prueba).width > maxAncho && actual) { lineas.push(actual); actual = p; }
        else actual = prueba;
      });
      if (actual) lineas.push(actual);
      return lineas;
    }

    function dibujarPlantilla(canvas, st) {
      var fmt = FORMATOS.filter(function (f) { return f.id === st.formato; })[0];
      canvas.width = fmt.w; canvas.height = fmt.h;
      var ctx = canvas.getContext("2d");
      var w = fmt.w, h = fmt.h;
      var margenLat = Math.round(w * 0.09);
      var margenTop = Math.round(h * (fmt.id === "story" ? 0.14 : 0.09));
      var margenBottom = Math.round(h * (fmt.id === "story" ? 0.16 : 0.1));

      if (st.fondoImg) {
        var img = st.fondoImg;
        var esc = Math.max(w / img.width, h / img.height);
        var iw = img.width * esc, ih = img.height * esc;
        ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
        ctx.fillStyle = "rgba(15,23,42,.38)"; ctx.fillRect(0, 0, w, h);
      } else {
        var grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, st.c1); grad.addColorStop(1, st.c2);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      }

      var overlay = ctx.createLinearGradient(0, h * 0.45, 0, h);
      overlay.addColorStop(0, "rgba(0,0,0,0)"); overlay.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = overlay; ctx.fillRect(0, h * 0.4, w, h * 0.6);

      var cx = w / 2;
      var y = margenTop + Math.round(w * 0.02);

      if (st.kicker) {
        ctx.font = "700 " + Math.round(w * 0.032) + "px Poppins, Arial, sans-serif";
        var kw = ctx.measureText(st.kicker.toUpperCase()).width;
        var padX = w * 0.045, padY = h * 0.014;
        var boxW = kw + padX * 2, boxH = w * 0.075;
        ctx.fillStyle = "rgba(255,255,255,.92)";
        redondeada(ctx, cx - boxW / 2, y, boxW, boxH, boxH / 2);
        ctx.fill();
        ctx.fillStyle = st.c1;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(st.kicker.toUpperCase(), cx, y + boxH / 2 + 2);
        y += boxH + w * 0.06;
      }

      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "800 " + Math.round(w * 0.088) + "px Poppins, Arial, sans-serif";
      var lineasTitulo = envolverTexto(ctx, st.titulo, w - margenLat * 2);
      lineasTitulo.forEach(function (linea) {
        ctx.textBaseline = "alphabetic";
        ctx.fillText(linea, cx, y + w * 0.08);
        y += w * 0.1;
      });

      y += w * 0.02;
      ctx.font = "500 " + Math.round(w * 0.042) + "px Arial, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.94)";
      var lineasSub = envolverTexto(ctx, st.subtitulo, w - margenLat * 2.4);
      lineasSub.slice(0, 5).forEach(function (linea) {
        ctx.fillText(linea, cx, y + w * 0.045);
        y += w * 0.058;
      });

      // Pie con nombre del laboratorio
      var footerY = h - margenBottom;
      ctx.font = "700 " + Math.round(w * 0.036) + "px Poppins, Arial, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText((tenant && tenant.nombre) || "BIOsoft", cx, footerY);
      if (tenant && (tenant.telefonos || tenant.whatsapp)) {
        ctx.font = "500 " + Math.round(w * 0.028) + "px Arial, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.fillText(tenant.telefonos || tenant.whatsapp, cx, footerY + w * 0.045);
      }

      if (st.mostrarGuia) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,.55)";
        ctx.setLineDash([12, 10]);
        ctx.lineWidth = 3;
        ctx.strokeRect(margenLat, margenTop, w - margenLat * 2, h - margenTop - margenBottom);
        ctx.restore();
      }
    }

    function redondeada(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    cargar();
  };
})();

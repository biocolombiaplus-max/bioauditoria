/* BIOsoft — Panel de superadmin: Rendimiento de Campañas. Analítica propia
   de la landing pública (index.html) y del formulario de activación
   (activar.html) — ver js/landing-tracker.js. No depende de la API de
   Meta Ads (eso exigiría un token de Business Manager y un backend propio
   para no exponerlo al navegador) — en vez de eso, mide de primera mano
   quién visita, qué tan lejos llega y a quién vale la pena hacerle
   remarketing, cruzando la fuente (utm_source/utm_campaign de cada
   enlace) con el embudo real de conversión hasta volverse un lead en el
   CRM (crmClientes). */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;

  var ETAPA_RANK = { visita: 0, precios: 1, demo: 2, contacto: 3, lead: 4 };
  var ETAPA_LABEL = { visita: "Visitando", precios: "Vio Precios", demo: "Vio la Demo", contacto: "Hizo contacto", lead: "Dejó sus datos" };
  var ETAPA_BADGE = { visita: "badge-rutina", precios: "badge-preliminar", demo: "badge-parcial", contacto: "badge-pendiente", lead: "badge-validado" };

  function ago(ms) {
    if (!ms) return "—";
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return "hace un momento";
    var m = Math.round(s / 60);
    if (m < 60) return "hace " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "hace " + h + " h";
    return "hace " + Math.round(h / 24) + " d";
  }
  function msDe(valor) {
    // lastSeen llega como Firestore Timestamp (tiene .toMillis) o, si aún no
    // ha sincronizado el reloj del servidor, como null/undefined.
    if (!valor) return 0;
    if (typeof valor.toMillis === "function") return valor.toMillis();
    if (valor instanceof Date) return valor.getTime();
    return 0;
  }

  window.BIO_VIEWS.campanas = function (root) {
    var visitantes = null;
    var leads = [];
    var cargando = true;
    var error = "";
    var periodo = "7d"; // "hoy" | "7d" | "30d"
    var unsubVisitantes = null;

    function cargar() {
      S.crm.list().then(function (list) {
        leads = list;
        return S.visitantesLanding.list();
      }).then(function (list) {
        visitantes = list;
        cargando = false;
        build();
        if (!unsubVisitantes) unsubVisitantes = S.visitantesLanding.watch(function () { S.visitantesLanding.list().then(function (l) { visitantes = l; build(); }); });
      }).catch(function (err) {
        cargando = false;
        error = err && err.code === "permission-denied"
          ? "Falta publicar la regla nueva de Firestore (landingVisitantes) — ver instrucciones en firestore.rules."
          : (err && err.message) || String(err);
        build();
      });
    }

    function kpi(value, label) {
      return '<div class="kpi"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + U.esc(label) + '</div></div>';
    }

    function desdePeriodo() {
      var ahora = Date.now();
      if (periodo === "hoy") { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
      if (periodo === "30d") return ahora - 30 * 864e5;
      return ahora - 7 * 864e5;
    }

    function build() {
      if (cargando) { root.innerHTML = '<div class="card"><p class="text-muted">Cargando…</p></div>'; return; }
      if (error) { root.innerHTML = '<div class="card"><p class="text-muted">' + U.esc(error) + "</p></div>"; return; }

      var todos = visitantes || [];
      var desde = desdePeriodo();
      var enRango = todos.filter(function (v) { return msDe(v.lastSeen) >= desde || !v.lastSeen; });
      var ahoraMs = Date.now();
      var enVivo = todos.filter(function (v) { return ahoraMs - msDe(v.lastSeen) < 5 * 60 * 1000; });

      function alcanzo(etapa) {
        return enRango.filter(function (v) { return ETAPA_RANK[v.stage || "visita"] >= ETAPA_RANK[etapa]; }).length;
      }
      var embudo = [
        { etapa: "visita", label: "Visitantes", count: enRango.length },
        { etapa: "precios", label: "Vieron los precios", count: alcanzo("precios") },
        { etapa: "demo", label: "Vieron la demo", count: alcanzo("demo") },
        { etapa: "contacto", label: "Hicieron contacto (WhatsApp / plan)", count: alcanzo("contacto") },
        { etapa: "lead", label: "Dejaron sus datos", count: alcanzo("lead") }
      ];
      var totalLeadsPeriodo = leads.filter(function (c) { return (c.creadoEn || "") >= new Date(desde).toISOString(); }).length;
      var conversion = enRango.length ? (embudo[4].count / enRango.length) * 100 : 0;

      var fuentes = {};
      enRango.forEach(function (v) {
        var k = v.source || "Directo";
        fuentes[k] = fuentes[k] || { visitas: 0, contacto: 0, leads: 0 };
        fuentes[k].visitas++;
        if (ETAPA_RANK[v.stage || "visita"] >= ETAPA_RANK.contacto) fuentes[k].contacto++;
        if (v.stage === "lead") fuentes[k].leads++;
      });
      var fuentesOrdenadas = Object.keys(fuentes).map(function (k) { return [k, fuentes[k]]; }).sort(function (a, b) { return b[1].visitas - a[1].visitas; });

      var campanas = {};
      enRango.forEach(function (v) {
        if (!v.campaign) return;
        var k = (v.source || "—") + " — " + v.campaign;
        campanas[k] = campanas[k] || { visitas: 0, leads: 0 };
        campanas[k].visitas++;
        if (v.stage === "lead") campanas[k].leads++;
      });
      var campanasOrdenadas = Object.keys(campanas).map(function (k) { return [k, campanas[k]]; }).sort(function (a, b) { return b[1].visitas - a[1].visitas; });

      var leadsPorId = {};
      leads.forEach(function (c) { leadsPorId[c.id] = c; });
      leadsPorIdGlobal = leadsPorId;
      var recientes = todos.slice().sort(function (a, b) { return msDe(b.lastSeen) - msDe(a.lastSeen); }).slice(0, 60);

      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">📊 Rendimiento de Campañas</h3>' +
        '<div class="crm-view-toggle">' +
        ['hoy', '7d', '30d'].map(function (p) {
          return '<button type="button" class="' + (periodo === p ? "active" : "") + '" data-periodo="' + p + '">' + (p === "hoy" ? "Hoy" : p === "7d" ? "7 días" : "30 días") + "</button>";
        }).join("") +
        "</div></div>" +
        '<p class="text-muted" style="margin-top:0">Quién visita <b>bioauditoria.com/biosoft</b>, qué tan lejos llega y a quién vale la pena hacerle remarketing — sin depender de la API de Meta Ads. Para ver el rendimiento real de tus anuncios, agrega <code>?utm_source=meta&amp;utm_campaign=nombre-de-tu-campaña</code> al enlace que uses en Meta Ads (ver nota al final).</p>' +
        "</div>" +

        '<div class="kpi-grid" style="margin-top:14px">' +
        kpi(enRango.length, "Visitantes") +
        kpi(embudo[3].count, "Hicieron contacto") +
        kpi(totalLeadsPeriodo, "Dejaron sus datos (CRM)") +
        kpi(conversion.toFixed(1) + "%", "Conversión total") +
        "</div>" +

        '<div class="flex gap-2 wrap" style="margin:14px 0 18px;align-items:center">' +
        '<span class="chip"><span style="width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block"></span> ' + enVivo.length + " en la página ahora</span>" +
        "</div>" +

        '<div class="card">' +
        '<h3 class="card-title" style="margin-bottom:14px">Embudo de conversión</h3>' +
        embudo.map(function (f, i) {
          var pct = enRango.length ? (f.count / enRango.length) * 100 : 0;
          return '<div style="margin-bottom:12px">' +
            '<div class="flex justify-between" style="font-size:13px;font-weight:700"><span>' + (i + 1) + ". " + U.esc(f.label) + "</span><span>" + f.count + ' <span class="text-muted" style="font-weight:600">· ' + pct.toFixed(0) + "%</span></span></div>" +
            '<div style="margin-top:4px;height:10px;border-radius:6px;background:var(--surface-2);overflow:hidden"><div style="height:100%;border-radius:6px;background:var(--brand-primary);width:' + Math.max(pct, f.count ? 2 : 0) + '%"></div></div>' +
            "</div>";
        }).join("") +
        "</div>" +

        '<div class="lp-grid" style="margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
        '<div class="card">' +
        '<h3 class="card-title" style="margin-bottom:12px">¿De dónde llegan?</h3>' +
        (fuentesOrdenadas.length ? '<div class="table-wrap"><table><thead><tr><th>Fuente</th><th>Visitas</th><th>Contacto</th><th>Dejaron datos</th></tr></thead><tbody>' +
          fuentesOrdenadas.map(function (f) {
            return "<tr><td><b>" + U.esc(f[0]) + "</b></td><td>" + f[1].visitas + "</td><td>" + f[1].contacto + "</td><td>" + f[1].leads + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="text-muted">Aún sin visitas en este periodo.</p>') +
        "</div>" +
        '<div class="card">' +
        '<h3 class="card-title" style="margin-bottom:12px">Campañas (utm_campaign)</h3>' +
        (campanasOrdenadas.length ? '<div class="table-wrap"><table><thead><tr><th>Campaña</th><th>Visitas</th><th>Dejaron datos</th></tr></thead><tbody>' +
          campanasOrdenadas.map(function (c) {
            return "<tr><td>" + U.esc(c[0]) + "</td><td>" + c[1].visitas + "</td><td>" + c[1].leads + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="text-muted">Ningún visitante trae <code>utm_campaign</code> todavía — agrégalo a tus enlaces de anuncios para medir campaña por campaña.</p>') +
        "</div>" +
        "</div>" +

        '<div class="card" style="margin-top:14px">' +
        '<h3 class="card-title" style="margin-bottom:12px">Visitantes recientes</h3>' +
        (recientes.length ? recientes.map(filaVisitante).join("") : '<p class="text-muted">Aún no hay visitantes registrados.</p>') +
        "</div>" +

        '<div class="lp-value-stack" style="margin-top:14px;max-width:none">' +
        "<h4>Cómo medir una campaña específica de Meta Ads</h4>" +
        '<p style="font-size:13px;color:var(--text-muted);line-height:1.6">En el administrador de anuncios de Meta, usa como enlace de destino algo como:<br/>' +
        '<code>https://bioauditoria.com/biosoft/?utm_source=meta&amp;utm_medium=cpc&amp;utm_campaign=lanzamiento-octubre</code><br/>' +
        "Así cada visitante que venga de ESE anuncio queda marcado como “Meta Ads” con el nombre exacto de la campaña, y aparece aquí con su embudo completo — sin que tengas que conectar ninguna cuenta ni token.</p>" +
        "</div>";

      root.querySelectorAll("[data-periodo]").forEach(function (b) {
        b.addEventListener("click", function () { periodo = b.dataset.periodo; build(); });
      });
      root.querySelectorAll("[data-ver-lead]").forEach(function (b) {
        b.addEventListener("click", function () { location.hash = "#/crm"; });
      });
    }

    function filaVisitante(v) {
      var stage = v.stage || "visita";
      var vivo = Date.now() - msDe(v.lastSeen) < 5 * 60 * 1000;
      var lead = v.leadId ? leadsPorIdGlobal[v.leadId] : null;
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border)" class="flex justify-between items-center wrap gap-2">' +
        '<div style="min-width:0">' +
        '<div class="flex items-center gap-2">' +
        (vivo ? '<span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block"></span>' : "") +
        '<span style="font-weight:700;font-size:13.5px">' + U.esc(v.source || "Directo") + (v.campaign ? " · " + U.esc(v.campaign) : "") + "</span>" +
        '<span class="badge ' + (ETAPA_BADGE[stage] || "badge-rutina") + '">' + (ETAPA_LABEL[stage] || stage) + "</span>" +
        "</div>" +
        '<div class="text-muted" style="font-size:12px;margin-top:2px">' + (v.pageviews || 1) + " página(s) · " + U.esc(v.device || "—") + " · " + ago(msDe(v.lastSeen)) +
        (lead ? " · <a href='#' data-ver-lead='1' style='font-weight:700'>Ver en CRM →</a>" : "") +
        "</div></div></div>";
    }
    var leadsPorIdGlobal = {};

    cargar();
  };
})();

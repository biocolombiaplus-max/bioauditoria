/* BIOsoft — Utilidades de interfaz: iconos, toasts, modales, formato */
(function (global) {
  "use strict";

  var ICONS = {
    home: "M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9",
    users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M23 20c0-2.6-2-4.4-5-5",
    clipboard: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 13h6M9 17h6",
    flask: "M9 3h6M10 3v6.2L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.2V3M7.5 15h9",
    check: "M20 6 9 17l-5-5",
    printer: "M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.97 7.97 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.3 2.5a8 8 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a8 8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1L11 21h4l.3-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    shield: "M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4Z",
    building: "M4 21V5a1 1 0 0 1 1-1h6v17M15 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11M2 21h20M8 7h1M8 11h1M8 15h1",
    file: "M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4",
    send: "m3 11 18-8-8 18-2-8-8-2Z",
    plus: "M12 5v14M5 12h14",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
    trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6h12Z",
    x: "M18 6 6 18M6 6l12 12",
    menu: "M4 6h16M4 12h16M4 18h16",
    droplet: "M12 2s7 7.5 7 12a7 7 0 1 1-14 0c0-4.5 7-12 7-12Z",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    layers: "M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    history: "M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 3",
    lock: "M6 11V7a6 6 0 1 1 12 0v4M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9Z",
    key: "M21 2l-2 2m-7.5 7.5a4 4 0 1 1-5.7 5.7 4 4 0 0 1 5.7-5.7Zm0 0L17 5m0 0 3 3m-3-3-2.5 2.5M19 8l-3-3",
    trending: "M23 6 13.5 15.5l-5-5L1 18M17 6h6v6"
  };

  function icon(name, cls) {
    var d = ICONS[name] || ICONS.file;
    return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + d + '"/></svg>';
  }

  function esc(s) {
    if (s === null || typeof s === "undefined") return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toast(msg, type) {
    var stack = document.getElementById("toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    var t = document.createElement("div");
    t.className = "toast" + (type ? " " + type : "");
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }

  function openModal(innerHtml, opts) {
    opts = opts || {};
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = '<div class="overlay-bd" data-close="1"></div><button type="button" class="modal-x" data-close="1" aria-label="Cerrar">✕</button><div class="modal-card ' + (opts.lg ? "modal-lg" : "") + '">' + innerHtml + "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target.dataset.close) closeModal(wrap);
    });
    wrap.querySelectorAll("[data-modal-close]").forEach(function (b) {
      b.addEventListener("click", function () { closeModal(wrap); });
    });
    return wrap;
  }
  function closeModal(wrap) {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
  }

  function calcEdad(fechaNacimiento) {
    if (!fechaNacimiento) return "";
    var nac = new Date(fechaNacimiento + "T00:00:00");
    if (isNaN(nac.getTime())) return "";
    var hoy = new Date();
    var years = hoy.getFullYear() - nac.getFullYear();
    var months = hoy.getMonth() - nac.getMonth();
    var days = hoy.getDate() - nac.getDate();
    if (days < 0) { months--; }
    if (months < 0) { years--; months += 12; }
    if (years >= 1) return years + " años";
    if (months >= 1) return months + " meses";
    var diffDays = Math.max(0, Math.round((hoy - nac) / 86400000));
    return diffDays + " días";
  }

  function fmtFecha(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
      d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtFechaCorta(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function nombreCompleto(p) {
    return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(" ");
  }

  function applyTenantTheme(tenant) {
    var root = document.documentElement;
    if (!tenant) return;
    root.style.setProperty("--brand-primary", tenant.colorPrimario || "#f97316");
    root.style.setProperty("--brand-secondary", tenant.colorSecundario || "#2e1065");
    var dark = shadeColor(tenant.colorPrimario || "#f97316", -18);
    root.style.setProperty("--brand-primary-dark", dark);
  }
  function shadeColor(hex, percent) {
    try {
      hex = hex.replace("#", "");
      var num = parseInt(hex, 16);
      var r = Math.min(255, Math.max(0, (num >> 16) + percent));
      var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
      var b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
      return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }

  function normalizar(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    var binary = atob(parts[1]);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function openDataUrlInNewTab(dataUrl) {
    var blob = dataUrlToBlob(dataUrl);
    var url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function downloadBytes(bytes, filename, mime) {
    var blob = new Blob([bytes], { type: mime || "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  /* Enlaces de composición directa en Gmail/Outlook (web), para no depender de
     que el usuario tenga un cliente de correo configurado por defecto en su
     equipo — el problema más común al usar simplemente "mailto:". */
  function emailLinks(to, subject, body) {
    var enc = encodeURIComponent;
    return {
      gmail: "https://mail.google.com/mail/?view=cm&fs=1&to=" + enc(to) + "&su=" + enc(subject) + "&body=" + enc(body),
      outlook: "https://outlook.live.com/mail/0/deeplink/compose?to=" + enc(to) + "&subject=" + enc(subject) + "&body=" + enc(body),
      mailto: "mailto:" + enc(to) + "?subject=" + enc(subject) + "&body=" + enc(body)
    };
  }

  function emailProviderButtonsHtml(idPrefix) {
    return '<div class="flex gap-2 wrap" style="margin-top:10px">' +
      '<button type="button" class="btn btn-outline btn-sm" id="' + idPrefix + '-gmail">📧 Abrir en Gmail</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="' + idPrefix + '-outlook">📧 Abrir en Outlook / Hotmail</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="' + idPrefix + '-mailto">Mi correo predeterminado</button>' +
      "</div>";
  }

  function wireEmailProviderButtons(root, idPrefix, to, subject, body) {
    var links = emailLinks(to, subject, body);
    var g = root.querySelector("#" + idPrefix + "-gmail");
    var o = root.querySelector("#" + idPrefix + "-outlook");
    var m = root.querySelector("#" + idPrefix + "-mailto");
    if (g) g.addEventListener("click", function () { window.open(links.gmail, "_blank"); });
    if (o) o.addEventListener("click", function () { window.open(links.outlook, "_blank"); });
    if (m) m.addEventListener("click", function () { window.open(links.mailto, "_blank"); });
  }

  global.BIO_UI = {
    icon: icon, esc: esc, toast: toast, openModal: openModal, closeModal: closeModal,
    calcEdad: calcEdad, fmtFecha: fmtFecha, fmtFechaCorta: fmtFechaCorta, nombreCompleto: nombreCompleto,
    applyTenantTheme: applyTenantTheme, dataUrlToBlob: dataUrlToBlob, openDataUrlInNewTab: openDataUrlInNewTab,
    downloadBytes: downloadBytes, normalizar: normalizar, emailLinks: emailLinks,
    emailProviderButtonsHtml: emailProviderButtonsHtml, wireEmailProviderButtons: wireEmailProviderButtons
  };
})(window);

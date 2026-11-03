/* BIOsoft — Carrusel de "Nuestros Clientes" en la landing pública
   (index.html). Lee la colección Firestore "landingClientes" (lectura
   pública, sin login, ver firestore.rules) y pinta un carrusel horizontal
   continuo con el logo de cada laboratorio cliente — cada uno es un enlace
   directo a WhatsApp con ese cliente, con un mensaje ya escrito pidiéndole
   una recomendación de BIOsoft.

   Administrado desde el panel de superadmin (ver
   js/views-landing-imagenes.js, sección "🤝 Nuestros Clientes"). Si no hay
   ningún cliente cargado, o si Firestore no está disponible, la sección
   completa queda oculta — nunca bloquea ni retrasa el resto de la landing. */
(function (global) {
  "use strict";

  function waLink(numero, mensaje) {
    return "https://wa.me/" + (numero || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(mensaje || "");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function logoHtml(c) {
    var img = c.logoDataUrl
      ? '<img src="' + esc(c.logoDataUrl) + '" alt="' + esc(c.nombre || "Laboratorio cliente de BIOsoft") + '"/>'
      : '<div class="lp-cliente-logo-ph">🏥</div>';
    return '<a class="lp-cliente-logo" href="' + waLink(c.whatsapp, c.mensaje) + '" target="_blank" rel="noopener" title="' + esc(c.nombre || "") + '">' +
      img + "<span>" + esc(c.nombre || "") + (c.pais ? " · " + esc(c.pais) : "") + "</span></a>";
  }

  function cargar() {
    var seccion = document.getElementById("lp-clientes-section");
    var track = document.getElementById("lp-clientes-track");
    if (!seccion || !track) return;
    if (typeof firebase === "undefined" || !global.BIO_FB || !global.BIO_FB.db) return;

    global.BIO_FB.db.collection("landingClientes").get().then(function (snap) {
      var lista = [];
      snap.forEach(function (doc) { lista.push(doc.data()); });
      if (!lista.length) return;
      // El track se duplica una vez (mismo set de logos, dos veces seguidas)
      // para que la animación de desplazamiento continuo (ver css, -50%) dé
      // una vuelta completa y siga de largo sin ningún salto visible.
      var html = lista.map(logoHtml).join("");
      track.innerHTML = html + html;
      seccion.style.display = "block";
    }).catch(function (e) {
      console.warn("BIOsoft: no se pudieron cargar los clientes de la landing ->", e.code || e.message);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cargar);
  else cargar();
})(window);

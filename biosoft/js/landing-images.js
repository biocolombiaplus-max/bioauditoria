/* BIOsoft — Imágenes editables de la landing pública (index.html).
   Lee la colección Firestore "landingImagenes" (lectura pública, sin login,
   ver firestore.rules) y rellena los espacios <div class="lp-img-slot"
   data-slot="..."> que existan en la página con la imagen configurada desde
   el panel de superadmin (views-landing-imagenes.js).

   Si un espacio no tiene imagen configurada, o si Firestore no está
   disponible por cualquier motivo, el espacio simplemente queda oculto — la
   página se ve exactamente igual que antes de esta función existir. Nunca
   bloquea ni retrasa el resto de la landing. */
(function (global) {
  "use strict";

  function mostrarImagenEnSlot(slotEl, datos) {
    if (!datos || !datos.dataUrl) return;
    var img = slotEl.querySelector("img");
    if (!img) return;
    img.src = datos.dataUrl;
    img.alt = datos.alt || "";
    slotEl.style.display = "block";
    var seccion = slotEl.closest(".lp-hero, .lp-section");
    if (seccion) seccion.classList.add("lp-tiene-img");
  }

  function cargar() {
    var slots = document.querySelectorAll(".lp-img-slot[data-slot]");
    if (!slots.length) return;
    if (typeof firebase === "undefined" || !global.BIO_FB || !global.BIO_FB.db) return;

    global.BIO_FB.db.collection("landingImagenes").get().then(function (snap) {
      snap.forEach(function (doc) {
        var slotEl = document.querySelector('.lp-img-slot[data-slot="' + doc.id + '"]');
        if (slotEl) mostrarImagenEnSlot(slotEl, doc.data());
      });
    }).catch(function (e) {
      console.warn("BIOsoft: no se pudieron cargar las imágenes de la landing ->", e.code || e.message);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cargar);
  else cargar();
})(window);

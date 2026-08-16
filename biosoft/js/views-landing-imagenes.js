/* BIOsoft — Panel de superadmin: Imágenes de la Landing pública (index.html).
   Permite subir/quitar la foto de cada "espacio" (slot) de la landing sin
   tocar código ni esperar un despliegue — la imagen se guarda en Firestore
   (colección landingImagenes, ver firestore.rules) y la propia landing la
   carga en tiempo real (ver js/landing-images.js).

   Las imágenes se redimensionan y comprimen en el navegador ANTES de
   guardarse, porque Firestore limita cada documento a ~1 MB — así una foto
   de varios MB tomada con el celular no rompe el guardado. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;

  var LIMITE_BYTES = 900 * 1024; // margen bajo el límite de ~1 MB de Firestore

  var SLOTS = [
    { id: "hero", label: "Encabezado Principal (Hero)", hint: "Aparece justo debajo del título y la descripción principal, antes de los botones." },
    { id: "funciones", label: "Funciones Principales", hint: "Aparece arriba de la cuadrícula de funciones del sistema." },
    { id: "comparacion", label: "¿Por qué cambiar a BIOsoft?", hint: "Aparece arriba de la comparación 'Sin BIOsoft vs. Con BIOsoft'." },
    { id: "secciones", label: "Todas las Secciones del Laboratorio", hint: "Aparece arriba del listado de secciones y exámenes." },
    { id: "precios", label: "Planes y Precios", hint: "Aparece arriba de la promoción y las tarjetas de precios." },
    { id: "preguntas", label: "Preguntas Frecuentes", hint: "Aparece arriba del acordeón de preguntas frecuentes." },
    { id: "final", label: "Cierre Final", hint: "Aparece en la última sección, antes de los botones finales." }
  ];

  window.BIO_VIEWS["landing-imagenes"] = function (root) {
    var session = BIO_AUTH.getSession();
    var actuales = {};

    root.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">🖼️ Imágenes de la Landing Pública</h3></div>' +
      '<p class="text-muted" style="margin-top:0">Sube una foto para cada espacio y aparece de inmediato en <b>bioauditoria.com/biosoft/</b> — sin necesidad de un desarrollador. Si un espacio no tiene imagen, esa sección se ve exactamente igual que hoy, sin huecos ni espacios en blanco.</p>' +
      '<p class="text-muted" style="font-size:12.5px">Sugerencia: usa fotos horizontales (apaisadas), de buena luz y en alta calidad — se comprimen automáticamente al guardar, así que no te preocupes por el peso del archivo.</p>' +
      "</div>" +
      '<div id="slots-grid" class="flex wrap gap-2" style="align-items:stretch"></div>';

    var grid = document.getElementById("slots-grid");
    grid.innerHTML = SLOTS.map(function (s) { return cardHtml(s, null, true); }).join("");

    S.landingImagenes.list().then(function (datos) {
      actuales = datos;
      SLOTS.forEach(function (s) { actualizarCard(s, actuales[s.id]); });
    }).catch(function (e) {
      U.toast(e.message || "No se pudieron cargar las imágenes actuales.", "error");
      SLOTS.forEach(function (s) { actualizarCard(s, null, false); });
    });

    function cardHtml(slot, datos, cargando) {
      return '<div class="card" style="width:320px" id="slot-card-' + slot.id + '">' +
        '<h4 style="margin:0 0 4px">' + U.esc(slot.label) + "</h4>" +
        '<p class="text-muted" style="font-size:12px;margin:0 0 10px">' + U.esc(slot.hint) + "</p>" +
        '<div id="slot-preview-' + slot.id + '" style="margin-bottom:10px">' +
        (cargando ? '<p class="text-muted" style="font-size:12.5px">Cargando…</p>' : previewHtml(datos)) +
        "</div>" +
        '<label class="btn btn-outline btn-sm btn-block" style="cursor:pointer">' + U.icon("plus") + " " + (datos && datos.dataUrl ? "Reemplazar imagen" : "Subir imagen") +
        '<input type="file" accept="image/*" data-file="' + slot.id + '" style="display:none"/></label>' +
        (datos && datos.dataUrl ? '<button type="button" class="btn btn-ghost btn-sm btn-block" data-quitar="' + slot.id + '" style="margin-top:6px">' + U.icon("x") + " Quitar imagen</button>" : "") +
        "</div>";
    }

    function previewHtml(datos) {
      if (!datos || !datos.dataUrl) return '<div style="height:120px;border:1.5px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center"><span class="text-muted" style="font-size:12.5px">Sin imagen — la sección se ve como hoy</span></div>';
      return '<img src="' + datos.dataUrl + '" style="width:100%;height:120px;object-fit:cover;border-radius:10px;border:1px solid var(--border)"/>';
    }

    function actualizarCard(slot, datos, wireInputs) {
      var card = document.getElementById("slot-card-" + slot.id);
      if (!card) return;
      card.outerHTML = cardHtml(slot, datos, false);
      wireCard(slot);
    }

    function wireCard(slot) {
      var card = document.getElementById("slot-card-" + slot.id);
      var fileInput = card.querySelector("[data-file]");
      fileInput.addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        subirImagen(slot, file);
      });
      var btnQuitar = card.querySelector("[data-quitar]");
      if (btnQuitar) {
        btnQuitar.addEventListener("click", function () {
          if (!confirm('¿Quitar la imagen de "' + slot.label + '"? La sección volverá a verse como antes de subirla.')) return;
          S.landingImagenes.remove(slot.id).then(function () {
            delete actuales[slot.id];
            actualizarCard(slot, null);
            U.toast("Imagen eliminada.", "success");
          }).catch(function (e) { U.toast(e.message || "No se pudo eliminar la imagen.", "error"); });
        });
      }
    }

    function subirImagen(slot, file) {
      var card = document.getElementById("slot-card-" + slot.id);
      var preview = document.getElementById("slot-preview-" + slot.id);
      preview.innerHTML = '<p class="text-muted" style="font-size:12.5px">Procesando imagen…</p>';
      redimensionarComprimir(file, 1400, 0.78).then(function (dataUrl) {
        return S.landingImagenes.set(slot.id, dataUrl, "", session.username).then(function (doc) {
          actuales[slot.id] = doc;
          actualizarCard(slot, doc);
          U.toast('Imagen de "' + slot.label + '" guardada — ya está en vivo en la landing.', "success");
        });
      }).catch(function (e) {
        U.toast(e.message || "No se pudo guardar la imagen. Intenta con otra foto.", "error");
        actualizarCard(slot, actuales[slot.id]);
      });
    }

    // Redimensiona a un ancho máximo y comprime como JPEG; si el resultado
    // sigue pesando más de lo que Firestore admite por documento, baja la
    // calidad en pasos hasta que quepa (o rechaza si ni así entra).
    function redimensionarComprimir(file, maxDim, calidadInicial) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error("No se pudo leer el archivo.")); };
        reader.onload = function (ev) {
          var img = new Image();
          img.onerror = function () { reject(new Error("El archivo no parece ser una imagen válida.")); };
          img.onload = function () {
            var w = img.width, h = img.height;
            var scale = Math.min(1, maxDim / Math.max(w, h));
            var canvas = document.createElement("canvas");
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            var calidad = calidadInicial;
            var dataUrl = canvas.toDataURL("image/jpeg", calidad);
            var intentos = 0;
            while (dataUrl.length * 0.75 > LIMITE_BYTES && intentos < 6) {
              calidad -= 0.12;
              if (calidad < 0.3) { calidad = 0.3; }
              dataUrl = canvas.toDataURL("image/jpeg", calidad);
              intentos++;
              if (calidad <= 0.3 && dataUrl.length * 0.75 > LIMITE_BYTES) break;
            }
            if (dataUrl.length * 0.75 > LIMITE_BYTES) {
              reject(new Error("La imagen sigue siendo muy pesada incluso comprimida. Prueba con una foto más simple o de menor resolución."));
              return;
            }
            resolve(dataUrl);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
  };
})();

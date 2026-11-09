/* BIOsoft — Panel de superadmin: Popup del Día (dentro de la app, ya con
   sesión iniciada — NO es la landing pública).

   Permite subir UNA imagen propia que reemplaza a los 3 anuncios internos
   rotativos (Página Web / WhatsApp / Redes — ver js/anuncios-promo.js) en
   el primer ingreso del día de cualquier laboratorio real, sin tocar
   código ni esperar un despliegue. Mientras la imagen no esté activa (o
   se quite), todo sigue exactamente igual que siempre: la rotación de 3
   anuncios.

   Mismo patrón de compresión en el navegador que "Imágenes de la Landing"
   (ver js/views-landing-imagenes.js), porque Firestore limita cada
   documento a ~1 MB — así una foto de varios MB no rompe el guardado. */
(function () {
  "use strict";
  window.BIO_VIEWS = window.BIO_VIEWS || {};
  var U = BIO_UI, S = BIO_STORE;

  var LIMITE_BYTES = 900 * 1024; // margen bajo el límite de ~1 MB de Firestore

  window.BIO_VIEWS["anuncio-popup"] = function (root) {
    var session = BIO_AUTH.getSession();
    var actual = null;
    var dataUrlNueva = "";

    root.innerHTML = '<div class="card"><p class="text-muted">Cargando…</p></div>';

    S.anuncioPopup.get().then(function (datos) {
      actual = datos;
      dataUrlNueva = (datos && datos.dataUrl) || "";
      render();
    }).catch(function (e) {
      root.innerHTML = '<div class="card"><p class="text-muted">No se pudo cargar el popup actual: ' + U.esc(e.message || String(e)) + "</p></div>";
    });

    function previewHtml() {
      if (!dataUrlNueva) return '<div style="max-width:260px;height:160px;border:1.5px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center"><span class="text-muted" style="font-size:12.5px">Sin imagen</span></div>';
      return '<img src="' + dataUrlNueva + '" style="max-width:260px;max-height:320px;border-radius:10px;border:1px solid var(--border);display:block"/>';
    }

    function render() {
      root.innerHTML =
        '<div class="card"><div class="card-header"><h3 class="card-title">📢 Popup del Día</h3></div>' +
        '<p class="text-muted" style="margin-top:0">Reemplaza los 3 anuncios internos rotativos (Página Web / WhatsApp / Redes) por UNA imagen propia tuya. Se muestra igual que ellos: como máximo una vez al día, al primer ingreso de cada laboratorio real — nunca en el entorno de Demo. Si la desactivas o la quitas, vuelve a mostrarse la rotación de siempre.</p>' +
        '<div class="form-grid">' +
        '<div class="field" style="grid-column:1/-1"><label class="flex gap-2" style="align-items:center;font-weight:400"><input type="checkbox" id="f_activo" style="width:auto" ' + (actual && actual.activo ? "checked" : "") + '/> Mostrar esta imagen en vez de la rotación de anuncios</label>' +
        '<span class="text-muted" style="font-size:11px">Déjala sin marcar si quieres preparar la imagen sin activarla todavía.</span></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Imagen</label><input type="file" id="f_imagen" accept="image/*"/>' +
        '<span class="text-muted" style="font-size:11px">Se redimensiona y comprime sola al subirla — sube la mejor calidad que tengas. Funciona mejor en formato vertical u horizontal, no la fuerza a ningún tamaño fijo.</span>' +
        '<div id="img-preview" style="margin-top:10px">' + previewHtml() + "</div></div>" +
        '<div class="field" style="grid-column:1/-1"><label>Enlace al hacer clic (opcional)</label><input id="f_link" placeholder="https://wa.me/573505457420?text=..." value="' + U.esc((actual && actual.linkUrl) || "") + '"/>' +
        '<span class="text-muted" style="font-size:11px">Si lo dejas vacío, la imagen solo se puede cerrar — un clic en ella no lleva a ningún lado.</span></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Texto alternativo (opcional, accesibilidad)</label><input id="f_alt" value="' + U.esc((actual && actual.alt) || "") + '"/></div>' +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:14px">' +
        (actual && actual.dataUrl ? '<button type="button" class="btn btn-ghost" id="btn-quitar">' + U.icon("trash") + " Quitar imagen</button>" : "<span></span>") +
        '<button type="button" class="btn btn-primary" id="btn-guardar">' + U.icon("check") + " Guardar</button>" +
        "</div></div>";

      document.getElementById("f_imagen").addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var preview = document.getElementById("img-preview");
        preview.innerHTML = '<p class="text-muted" style="font-size:12.5px">Procesando imagen…</p>';
        redimensionarComprimir(file, 1200, 0.82).then(function (dataUrl) {
          dataUrlNueva = dataUrl;
          preview.innerHTML = previewHtml();
        }).catch(function (e2) {
          U.toast(e2.message || "No se pudo procesar la imagen.", "error");
          preview.innerHTML = previewHtml();
        });
      });

      var btnQuitar = document.getElementById("btn-quitar");
      if (btnQuitar) {
        btnQuitar.addEventListener("click", function () {
          if (!confirm("¿Quitar la imagen del popup? Mientras no subas otra, los laboratorios volverán a ver la rotación de anuncios de siempre.")) return;
          S.anuncioPopup.remove().then(function () {
            actual = null; dataUrlNueva = "";
            U.toast("Imagen eliminada — ya volvió la rotación de anuncios de siempre.", "success");
            render();
          }).catch(function (e) { U.toast(e.message || "No se pudo eliminar.", "error"); });
        });
      }

      document.getElementById("btn-guardar").addEventListener("click", function () {
        var activo = document.getElementById("f_activo").checked;
        if (activo && !dataUrlNueva) { U.toast("Sube una imagen antes de activarla.", "error"); return; }
        var datos = {
          dataUrl: dataUrlNueva, alt: document.getElementById("f_alt").value.trim(),
          linkUrl: document.getElementById("f_link").value.trim(), activo: activo
        };
        S.anuncioPopup.set(datos, session.username).then(function (doc) {
          actual = doc;
          U.toast(activo ? "Guardado y activado — ya reemplaza a la rotación de anuncios." : "Guardado (sin activar todavía).", "success");
          render();
        }).catch(function (e) { U.toast(e.message || "No se pudo guardar.", "error"); });
      });
    }

    // Igual que en views-landing-imagenes.js: redimensiona a un ancho máximo
    // y comprime como JPEG; si el resultado sigue pesando más de lo que
    // Firestore admite por documento, baja la calidad en pasos hasta que
    // quepa (o rechaza si ni así entra).
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

/* BIOsoft — Formulario público de activación (sin sesión): el cliente ya pagó
   o está listo para empezar y aquí nos deja los datos para personalizar su
   BIOsoft. Crea un lead directamente en Firestore (crmClientes), visible
   solo para el superadmin en el CRM interno. */
(function () {
  "use strict";
  var U = BIO_UI, S = BIO_STORE, C = BIO_CATALOG;
  var WA_NUMBER = "573505457420";

  var PAISES = { CO: "Colombia", VE: "Venezuela", EC: "Ecuador", MX: "México", PE: "Perú", AR: "Argentina", BO: "Bolivia", BR: "Brasil" };
  document.getElementById("f_labPais").innerHTML = Object.keys(PAISES).map(function (p) {
    return '<option value="' + p + '">' + PAISES[p] + "</option>";
  }).join("");

  var params = new URLSearchParams(location.search);
  var planPreseleccionado = params.get("plan");

  /* Si el anuncio de Meta Ads (u otra campaña) apunta aquí con parámetros
     utm_*, los guardamos junto al lead para que el CRM sepa de dónde vino,
     sin necesitar el formulario nativo de leads de Meta (que sí requeriría
     un servidor para recibir el webhook). */
  var origenDetalle = {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || ""
  };
  document.getElementById("f_plan").innerHTML = BIO_PLANES.PLANES.map(function (p) {
    return '<option value="' + p.id + '" ' + (p.id === planPreseleccionado ? "selected" : "") + '>' + p.nombre + " (" + p.usuarios + ") — $" + p.precioFmt + "/mes</option>";
  }).join("");

  document.getElementById("act-secciones").innerHTML = C.SECCIONES.map(function (s) {
    return '<div class="checkbox-row"><input type="checkbox" data-seccion="' + s.id + '"/><label style="margin:0">' + s.emoji + " " + s.nombre + "</label></div>";
  }).join("");

  var logoDataUrl = "";
  document.getElementById("f_logo").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    redimensionarLogo(file, 240).then(function (dataUrl) {
      logoDataUrl = dataUrl;
      document.getElementById("act-logo-preview").innerHTML = '<img src="' + dataUrl + '" alt="Logo"/>';
    }).catch(function () {
      U.toast("No se pudo procesar la imagen. Intenta con otro archivo.", "error");
    });
  });

  function redimensionarLogo(file, maxDim) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function (ev) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("act-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var errBox = document.getElementById("act-error");
    errBox.classList.add("hidden");
    var g = function (id) { return document.getElementById(id).value.trim(); };
    var labNombre = g("f_labNombre"), contNombre = g("f_contNombre"), whatsapp = g("f_contWhatsapp"), correo = g("f_contCorreo");
    if (!labNombre || !contNombre || !whatsapp || !correo) {
      errBox.textContent = "Completa todos los campos obligatorios (*)."; errBox.classList.remove("hidden"); return;
    }
    var secciones = Array.prototype.slice.call(document.querySelectorAll("[data-seccion]:checked")).map(function (c) { return c.dataset.seccion; });
    var planId = document.getElementById("f_plan").value;
    var pedirLogo = document.getElementById("f_pedirLogo").checked;

    var data = {
      origen: "formulario_publico",
      origenDetalle: origenDetalle,
      laboratorio: { nombre: labNombre, nit: g("f_labNit"), ciudad: g("f_labCiudad"), pais: document.getElementById("f_labPais").value },
      contacto: { nombre: contNombre, cargo: g("f_contCargo"), whatsapp: whatsapp, correo: correo },
      planId: planId,
      seccionesIds: secciones,
      logoDataUrl: logoDataUrl,
      pedirDisenoLogo: pedirLogo,
      notas: g("f_notas")
    };

    var submitBtn = document.getElementById("act-submit");
    submitBtn.disabled = true; submitBtn.textContent = "Enviando…";

    S.crm.create(data).then(function () {
      document.getElementById("act-form-block").classList.add("hidden");
      document.getElementById("act-success-block").classList.remove("hidden");
      var plan = BIO_PLANES.porId(planId);
      var mensaje = "🎉 Nueva activación de BIOsoft\n\nLaboratorio: " + labNombre + "\nContacto: " + contNombre + " (" + whatsapp + ")\nPlan: " + (plan ? plan.nombre : planId) +
        (pedirLogo ? "\n¡Pidió diseño de logo! (+$40.000 COP)" : "") + "\n\nRevisa el CRM para generar el contrato.";
      window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(mensaje), "_blank");
    }).catch(function (err) {
      submitBtn.disabled = false; submitBtn.textContent = "Enviar mis datos de activación";
      errBox.textContent = "No se pudo enviar: " + (err.message || String(err)); errBox.classList.remove("hidden");
    });
  });
})();

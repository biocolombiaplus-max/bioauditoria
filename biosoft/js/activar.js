/* BIOsoft — Formulario público de activación (sin sesión): el cliente ya
   pagó y aquí crea su propio laboratorio, quedando activo al instante — sin
   que el superadmin tenga que crearlo a mano desde "Laboratorios Cliente".
   Usa el mismo provisionRealAccount() del panel de superadmin, que ya está
   preparado para correr sin sesión previa (usa una instancia secundaria de
   Firebase) y las reglas de Firestore ya permiten que un usuario recién
   autenticado cree su propio laboratorio (ver firestore.rules -> tenants,
   "La creación ocurre en el mismo flujo de aprovisionamiento").
   Además deja un registro en crmClientes (mismo camino público de siempre)
   solo para que quede trazabilidad en el CRM interno — si eso falla, no
   bloquea la activación real del laboratorio, que es lo que de verdad
   importa. */
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
  // El precio se muestra en la moneda que de verdad usa el cliente: pesos
  // colombianos solo para Colombia, dólares para cualquier otro país — así
  // no confunde a alguien en Venezuela/Ecuador/México con un precio en COP
  // que no le dice nada. Se recalcula cada vez que cambia el país elegido,
  // sin perder el plan que ya tenía seleccionado.
  function renderPlanOptions() {
    var selEl = document.getElementById("f_plan");
    var valorActual = selEl.value || planPreseleccionado;
    var esCO = document.getElementById("f_labPais").value === "CO";
    selEl.innerHTML = BIO_PLANES.PLANES.map(function (p) {
      var precioTxt = esCO ? "$" + p.precioFmt + " COP/mes" : "$" + p.usd + " USD/mes";
      return '<option value="' + p.id + '" ' + (p.id === valorActual ? "selected" : "") + '>' + p.nombre + " (" + p.usuarios + ") — " + precioTxt + "</option>";
    }).join("");
  }
  renderPlanOptions();
  document.getElementById("f_labPais").addEventListener("change", renderPlanOptions);

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

  var FIREBASE_ERRORS = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta de BIOsoft — si ya activaste antes, ingresa directamente en app.html, o escríbenos si necesitas ayuda.",
    "auth/invalid-email": "El correo ingresado no es válido.",
    "auth/weak-password": "La contraseña es muy débil — usa al menos 6 caracteres.",
    "auth/network-request-failed": "No hay conexión con el servidor. Verifica tu internet e inténtalo de nuevo."
  };

  document.getElementById("act-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var errBox = document.getElementById("act-error");
    errBox.classList.add("hidden");
    var g = function (id) { return document.getElementById(id).value.trim(); };
    var labNombre = g("f_labNombre"), contNombre = g("f_contNombre"), whatsapp = g("f_contWhatsapp"), correo = g("f_contCorreo");
    var pass = g("f_contPass"), pass2 = g("f_contPass2");
    if (!labNombre || !contNombre || !whatsapp || !correo || !pass || !pass2) {
      errBox.textContent = "Completa todos los campos obligatorios (*)."; errBox.classList.remove("hidden"); return;
    }
    if (correo.indexOf("@") === -1) {
      errBox.textContent = "Ingresa un correo electrónico válido."; errBox.classList.remove("hidden"); return;
    }
    if (pass.length < 6) {
      errBox.textContent = "La contraseña debe tener al menos 6 caracteres."; errBox.classList.remove("hidden"); return;
    }
    if (pass !== pass2) {
      errBox.textContent = "Las dos contraseñas no coinciden."; errBox.classList.remove("hidden"); return;
    }
    var secciones = Array.prototype.slice.call(document.querySelectorAll("[data-seccion]:checked")).map(function (c) { return c.dataset.seccion; });
    var planId = document.getElementById("f_plan").value;
    var plan = BIO_PLANES.porId(planId);
    var pais = document.getElementById("f_labPais").value;
    var pedirLogo = document.getElementById("f_pedirLogo").checked;
    var hoy = new Date();
    var proximoPago = new Date(hoy.getTime() + 30 * 864e5);

    var submitBtn = document.getElementById("act-submit");
    submitBtn.disabled = true; submitBtn.textContent = "Activando tu BIOsoft…";

    // El registro en el CRM es solo trazabilidad interna — si falla (ej. sin
    // internet un instante), no debe impedir que el laboratorio se active.
    S.crm.create({
      origen: "formulario_publico", origenDetalle: origenDetalle,
      laboratorio: { nombre: labNombre, nit: g("f_labNit"), ciudad: g("f_labCiudad"), pais: pais },
      contacto: { nombre: contNombre, cargo: g("f_contCargo"), whatsapp: whatsapp, correo: correo },
      planId: planId, seccionesIds: secciones, logoDataUrl: logoDataUrl, pedirDisenoLogo: pedirLogo, notas: g("f_notas")
    }).catch(function (err) { console.warn("BIOsoft: no se pudo registrar el lead en el CRM ->", err); });

    S.provisionRealAccount({
      tenantData: {
        nombre: labNombre, nit: g("f_labNit"), pais: pais, direccion: g("f_labCiudad"),
        telefonos: whatsapp, email: correo, contactoNombre: contNombre, nivel: 1,
        planId: planId, maxUsuarios: plan ? plan.limiteUsuarios : null,
        cicloCobroDias: 30, fechaInicioPlan: hoy.toISOString().slice(0, 10), fechaProximoPago: proximoPago.toISOString().slice(0, 10),
        logoDataUrl: logoDataUrl
      },
      userData: { username: correo, password: pass, nombre: contNombre, rol: "admin", secciones: [] }
    }).then(function (res) {
      document.getElementById("act-form-block").classList.add("hidden");
      document.getElementById("act-success-block").classList.remove("hidden");
      document.getElementById("act-res-user").textContent = correo;
      var mensaje = "✅ Nueva activación instantánea de BIOsoft\n\nLaboratorio: " + labNombre + "\nContacto: " + contNombre + " (" + whatsapp + ")\nPlan: " + (plan ? plan.nombre : planId) +
        (pedirLogo ? "\n¡Pidió diseño de logo! (+$40.000 COP)" : "") + "\n\nYa quedó creado y funcionando — solo revisa que el pago haya llegado y, si quieres, genérale el contrato desde el CRM.";
      window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(mensaje), "_blank");
    }).catch(function (err) {
      submitBtn.disabled = false; submitBtn.textContent = "🚀 Activar mi BIOsoft Ahora";
      errBox.textContent = FIREBASE_ERRORS[err && err.code] || ("No se pudo activar: " + (err.message || String(err)));
      errBox.classList.remove("hidden");
    });
  });
})();

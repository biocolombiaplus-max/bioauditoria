/* BIOsoft — Lógica de firmar.html: página pública (sin sesión) donde el
   paciente firma su Consentimiento Informado desde su propio celular. El
   tenant "demo" se resuelve contra localStorage (mismo navegador que usó la
   demo de BIOsoft); cualquier otro laboratorio, contra Firestore
   directamente y sin autenticación — ver firestore.rules: solo permite
   pasar un consentimiento de "pendiente" a "firmado", tocando únicamente
   los campos de la firma. */
(function () {
  "use strict";
  var U = BIO_UI, T = BIO_CONSENTIMIENTO_TEXTO;

  var params = new URLSearchParams(location.search);
  var tenantId = params.get("t") || "";
  var consentId = params.get("c") || "";
  var esDemo = tenantId === "demo";
  var pad = null;
  var registro = null;

  function el(id) { return document.getElementById(id); }
  function mostrarSolo(id) {
    ["fir-cargando", "fir-error", "fir-firmado"].forEach(function (x) { el(x).classList.toggle("hidden", x !== id); });
    el("fir-form-block").classList.toggle("hidden", id !== "fir-form-block");
  }

  function docRefReal() {
    return BIO_FB.db.collection("tenants").doc(tenantId).collection("consentimientos").doc(consentId);
  }

  function cargarConsentimiento() {
    if (!tenantId || !consentId) { mostrarError("Este enlace está incompleto."); return; }
    if (esDemo) {
      var c = BIO_STORE.consentimientos.get(consentId);
      if (!c) { mostrarError(); return; }
      registro = c;
      onCargado();
      return;
    }
    docRefReal().get().then(function (doc) {
      if (!doc.exists) { mostrarError(); return; }
      registro = Object.assign({ id: consentId }, doc.data());
      onCargado();
    }).catch(function () { mostrarError("No pudimos conectarnos para cargar tu consentimiento. Verifica tu conexión a internet e intenta de nuevo."); });
  }

  function mostrarError(msg) {
    if (msg) el("fir-error-msg").textContent = msg;
    mostrarSolo("fir-error");
  }

  function pintarMarca() {
    if (registro.tenantLogoDataUrl) el("fir-logo").src = registro.tenantLogoDataUrl;
    el("fir-lab-nombre").textContent = registro.tenantNombre || "BIOsoft";
  }

  function onCargado() {
    pintarMarca();
    if (registro.estado === "firmado") {
      mostrarSolo("fir-firmado");
      el("fir-btn-descargar-firmado").addEventListener("click", function () { descargarPDF(registro); });
      return;
    }
    var texto = T.buildTextoConsentimiento(registro.tenantNombre, registro.procedimiento, (registro.examenes || []).map(function (e) { return e.nombre; }));
    el("fir-titulo").textContent = texto.titulo;
    el("fir-subtitulo").textContent = "Orden " + (registro.numeroOrden || "—") + " · Paciente: " + (registro.pacienteNombre || "—");
    el("fir-texto").innerHTML = texto.parrafos.map(function (p) { return "<p>" + U.esc(p) + "</p>"; }).join("");
    el("f_nombreFirmante").value = registro.pacienteNombre || "";
    el("f_documentoFirmante").value = registro.pacienteDocumento || "";

    pad = BIO_FIRMA_PAD.crear(el("fir-canvas"));
    el("fir-btn-limpiar").addEventListener("click", function () { pad.limpiar(); });
    el("fir-btn-firmar").addEventListener("click", firmar);
    mostrarSolo("fir-form-block");
  }

  function mostrarErrorForm(msg) {
    var e = el("fir-form-error");
    e.textContent = msg;
    e.classList.remove("hidden");
  }

  function firmar() {
    el("fir-form-error").classList.add("hidden");
    if (!pad || pad.estaVacia()) { mostrarErrorForm("Falta tu firma — dibújala en el recuadro con el dedo."); return; }
    var nombreFirmante = el("f_nombreFirmante").value.trim();
    if (!nombreFirmante) { mostrarErrorForm("Escribe el nombre de quien firma."); return; }

    var btn = el("fir-btn-firmar");
    btn.disabled = true; btn.textContent = "Guardando…";

    var firma = {
      firmaPacienteDataUrl: pad.toDataURL(),
      nombreFirmante: nombreFirmante,
      documentoFirmante: el("f_documentoFirmante").value.trim(),
      relacionFirmante: el("f_relacion").value
    };

    if (esDemo) {
      var actualizado = BIO_STORE.consentimientos.firmarPublico(consentId, firma);
      if (!actualizado) { btn.disabled = false; btn.textContent = "✓ Firmar Consentimiento"; mostrarErrorForm("Este consentimiento ya no está disponible para firmar (puede que ya se haya firmado antes)."); return; }
      registro = actualizado;
      mostrarSolo("fir-firmado");
      el("fir-btn-descargar-firmado").addEventListener("click", function () { descargarPDF(registro); });
      return;
    }

    var fechaFirma = new Date().toISOString();
    docRefReal().update({
      estado: "firmado",
      firmaPacienteDataUrl: firma.firmaPacienteDataUrl,
      nombreFirmante: firma.nombreFirmante,
      documentoFirmante: firma.documentoFirmante,
      relacionFirmante: firma.relacionFirmante,
      fechaFirma: fechaFirma
    }).then(function () {
      registro = Object.assign({}, registro, { estado: "firmado", fechaFirma: fechaFirma }, firma);
      mostrarSolo("fir-firmado");
      el("fir-btn-descargar-firmado").addEventListener("click", function () { descargarPDF(registro); });
    }).catch(function () {
      btn.disabled = false; btn.textContent = "✓ Firmar Consentimiento";
      mostrarErrorForm("No pudimos guardar tu firma. Verifica tu conexión a internet e intenta de nuevo.");
    });
  }

  function descargarPDF(c) {
    var bytes = BIO_PDF_CONSENTIMIENTO.buildConsentimientoPDF(c);
    U.downloadBytes(bytes, "Consentimiento_" + (c.numeroOrden || c.id) + ".pdf");
  }

  cargarConsentimiento();
})();

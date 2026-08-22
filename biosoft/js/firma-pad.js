/* BIOsoft — Firma táctil (firma-pad): captura de firma con el dedo, el mouse
   o un lápiz óptico sobre un <canvas>, para consentimientos informados y
   cualquier otro documento que necesite firma en pantalla. Sin dependencias
   externas, para poder usarse tanto dentro de la app (app.html) como en la
   página pública y ligera de firma remota (firmar.html). */
(function (global) {
  "use strict";

  function crear(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var trazos = []; // [[{x,y}, ...], ...] — para poder redibujar al cambiar tamaño
    var dibujando = false;
    var ultimoPunto = null;

    function ajustarTamano() {
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.scale(dpr, dpr);
      ctx.lineWidth = opts.grosor || 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = opts.color || "#1a1a2e";
      redibujar();
    }

    function redibujar() {
      var rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      trazos.forEach(function (trazo) {
        if (trazo.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trazo[0].x, trazo[0].y);
        for (var i = 1; i < trazo.length; i++) ctx.lineTo(trazo[i].x, trazo[i].y);
        ctx.stroke();
      });
    }

    function puntoDesdeEvento(e) {
      var rect = canvas.getBoundingClientRect();
      var clientX = e.clientX, clientY = e.clientY;
      if (e.touches && e.touches.length) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function iniciar(e) {
      e.preventDefault();
      dibujando = true;
      var p = puntoDesdeEvento(e);
      ultimoPunto = p;
      trazos.push([p]);
    }
    function mover(e) {
      if (!dibujando) return;
      e.preventDefault();
      var p = puntoDesdeEvento(e);
      trazos[trazos.length - 1].push(p);
      ctx.beginPath();
      ctx.moveTo(ultimoPunto.x, ultimoPunto.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ultimoPunto = p;
      if (opts.onDibujar) opts.onDibujar();
    }
    function terminar() { dibujando = false; ultimoPunto = null; }

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", iniciar);
    canvas.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", terminar);
    canvas.addEventListener("pointerleave", function (e) { if (dibujando) mover(e); });
    // Respaldo para navegadores sin soporte de Pointer Events.
    canvas.addEventListener("touchstart", iniciar, { passive: false });
    canvas.addEventListener("touchmove", mover, { passive: false });
    canvas.addEventListener("touchend", terminar);

    window.addEventListener("resize", ajustarTamano);
    ajustarTamano();

    return {
      limpiar: function () { trazos = []; redibujar(); if (opts.onDibujar) opts.onDibujar(); },
      estaVacia: function () { return trazos.length === 0; },
      // Recorta el margen en blanco alrededor del trazo para que la firma
      // quede compacta al insertarse en el PDF, en vez de ocupar todo el
      // rectángulo del canvas con espacio vacío alrededor.
      toDataURL: function () {
        var rect = canvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        trazos.forEach(function (trazo) {
          trazo.forEach(function (p) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
          });
        });
        if (minX === Infinity) return canvas.toDataURL("image/png");
        var pad = 8;
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(rect.width, maxX + pad); maxY = Math.min(rect.height, maxY + pad);
        var out = document.createElement("canvas");
        out.width = Math.max(1, Math.round((maxX - minX) * dpr));
        out.height = Math.max(1, Math.round((maxY - minY) * dpr));
        out.getContext("2d").drawImage(canvas, minX * dpr, minY * dpr, out.width, out.height, 0, 0, out.width, out.height);
        return out.toDataURL("image/png");
      },
      destruir: function () { window.removeEventListener("resize", ajustarTamano); window.removeEventListener("pointerup", terminar); }
    };
  }

  global.BIO_FIRMA_PAD = { crear: crear };
})(window);

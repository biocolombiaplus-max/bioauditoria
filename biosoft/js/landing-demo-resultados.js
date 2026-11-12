/* BIOsoft — Landing: mockup animado "Consulta de Resultados" (sección
   #pagina-web-resultados en index.html). Reproduce en bucle, solo con
   CSS/JS, el mismo flujo real de sitio-web.html (documento + código ->
   "Consultar" -> resultado encontrado) — es una maqueta de ventas, nunca
   consulta datos reales. Arranca solo cuando la sección entra en pantalla,
   para no gastar ciclos mientras el visitante no la ha visto todavía, y
   deja el estado final fijo (sin animar) si el visitante pidió "reducir
   movimiento" en su sistema. */
(function () {
  "use strict";

  var card = document.getElementById("lp-demo-card");
  var success = document.getElementById("lp-demo-success");
  if (!card || !success) return;
  var campoDoc = document.getElementById("lp-demo-doc");
  var campoCod = document.getElementById("lp-demo-cod");
  var cursorDoc = document.getElementById("lp-demo-cursor-doc");
  var cursorCod = document.getElementById("lp-demo-cursor-cod");
  var btn = document.getElementById("lp-demo-btn");

  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function escribir(el, texto) {
    return new Promise(function (resolve) {
      var i = 0;
      (function paso() {
        el.textContent = texto.slice(0, i);
        if (i >= texto.length) { resolve(); return; }
        i++;
        setTimeout(paso, 75);
      })();
    });
  }
  function reiniciar() {
    campoDoc.textContent = ""; campoCod.textContent = "";
    card.classList.remove("lp-demo-fade");
    success.classList.remove("on");
    cursorDoc.classList.remove("hidden"); cursorCod.classList.add("hidden");
  }

  var detenido = false;
  async function ciclo() {
    if (detenido) return;
    reiniciar();
    await esperar(900);
    await escribir(campoDoc, "1020304050");
    cursorDoc.classList.add("hidden"); cursorCod.classList.remove("hidden");
    await esperar(300);
    await escribir(campoCod, "482193");
    cursorCod.classList.add("hidden");
    await esperar(500);
    btn.classList.add("lp-demo-press");
    await esperar(220);
    btn.classList.remove("lp-demo-press");
    await esperar(650);
    card.classList.add("lp-demo-fade");
    success.classList.add("on");
    await esperar(3200);
    ciclo();
  }

  // "Reducir movimiento": nunca se anima — se deja de una vez el estado
  // final (resultado ya encontrado), que es el mensaje de venta real.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    campoDoc.textContent = "1020304050"; campoCod.textContent = "482193";
    cursorDoc.classList.add("hidden"); cursorCod.classList.add("hidden");
    card.classList.add("lp-demo-fade"); success.classList.add("on");
    return;
  }

  var seccion = document.getElementById("pagina-web-resultados");
  if (!seccion || typeof IntersectionObserver === "undefined") { ciclo(); return; }
  var yaArranco = false;
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting && !yaArranco) { yaArranco = true; ciclo(); }
    });
  }, { threshold: 0.3 });
  obs.observe(seccion);
})();

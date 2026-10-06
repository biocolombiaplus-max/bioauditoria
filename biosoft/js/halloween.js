/* BIOsoft — Detalle de temporada (octubre): una decoración muy sutil al
   abrir el software (murciélagos/calabazas/fantasmas/brujas cruzando la
   pantalla un momento) y, solo tras un buen rato sin actividad, un
   "filtro" interactivo de pausa — un bacteriólogo(a) al que se le pueden
   lanzar tubos de ensayo para "cazar" los espantos que van cayendo,
   sumando puntos — pensado como un respiro breve para bacteriólogos(as) y
   auxiliares en medio de la rutina, nunca como una interrupción del
   trabajo real:
     - NUNCA aparece mientras hay actividad (solo tras IDLE_MS sin mover
       el mouse, teclear, tocar la pantalla o hacer scroll).
     - NUNCA aparece con un modal abierto (no tapa un formulario a medio
       llenar).
     - Se cierra al instante con un clic, la tecla Esc, o tocando fuera
       del área de juego — y no toca ningún dato de la pantalla de abajo,
       que queda exactamente como se dejó.
     - Solo corre en octubre: en noviembre este archivo no hace nada,
       sin tener que desinstalarlo.
     - Respeta "reducir animaciones" del sistema operativo del usuario. */
(function () {
  "use strict";

  if (new Date().getMonth() !== 9) return; // 9 = octubre (0-indexado)
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var IDLE_MS = 150000; // 2.5 minutos sin actividad para ofrecer la pausa
  var CRIATURAS = ["🦇", "🎃", "👻", "🧙"];

  var lastActivity = Date.now();
  var yaMostroAmbiente = false;
  var overlayAbierto = false;

  ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"].forEach(function (ev) {
    document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true, capture: true });
  });

  function estaLogueado() {
    var shell = document.getElementById("app-shell");
    return !!(shell && !shell.classList.contains("hidden"));
  }
  // No se ofrece en la consola del superadmin (Laboratorios Cliente,
  // CRM...) — este detalle es para el día a día de un laboratorio, no
  // para la operación interna de BIOsoft.
  function sesionValida() {
    try {
      var s = window.BIO_AUTH && window.BIO_AUTH.getSession && BIO_AUTH.getSession();
      return !!(s && s.rol !== "superadmin");
    } catch (e) { return false; }
  }
  function hayModalAbierto() {
    return !!document.querySelector(".modal");
  }

  // ------------------------------------------------------------------
  // Sonidos cortos con Web Audio API (sin archivos que cargar) — mismo
  // criterio que el Cronómetro/Contador de Células de tools-lab.js.
  // ------------------------------------------------------------------
  var audioCtx = null;
  function ctxAudio() {
    try {
      if (!audioCtx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctor();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  function tono(freq, ms, tipo, vol, retrasoMs) {
    var ctx = ctxAudio();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = tipo || "sine";
      osc.frequency.value = freq;
      var inicio = ctx.currentTime + (retrasoMs || 0) / 1000;
      var dur = ms / 1000;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.linearRampToValueAtTime(vol || 0.15, inicio + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + dur + 0.03);
    } catch (e) {}
  }
  function sonidoLanzar() { tono(520, 60, "sine", 0.07); }
  function sonidoAcierto() { tono(880, 90, "triangle", 0.13); tono(1320, 120, "triangle", 0.09, 45); }

  // ------------------------------------------------------------------
  // Estilos — inyectados aparte del styles.css general para que todo el
  // detalle de temporada viva en un único archivo, fácil de ubicar (y,
  // si algún año no se quiere, fácil de quitar quitando una sola línea
  // de app.html).
  // ------------------------------------------------------------------
  var style = document.createElement("style");
  style.textContent =
    ".hw-ambiente{position:fixed;inset:0;z-index:42;pointer-events:none;overflow:hidden}" +
    ".hw-ambiente-item{position:absolute;left:-12vw;opacity:0;animation:hw-flotar var(--hw-dur,20s) ease-in-out forwards;filter:drop-shadow(0 3px 6px rgba(0,0,0,.24))}" +
    "@keyframes hw-flotar{" +
      "0%{transform:translate(0,0) rotate(-4deg) scale(.9);opacity:0}" +
      "6%{opacity:var(--hw-op,.7)}" +
      "22%{transform:translate(26vw,-26px) rotate(3deg) scale(1.05)}" +
      "40%{transform:translate(46vw,14px) rotate(-3deg) scale(.96)}" +
      "58%{transform:translate(66vw,-20px) rotate(4deg) scale(1.04)}" +
      "76%{transform:translate(86vw,10px) rotate(-2deg) scale(.97)}" +
      "93%{opacity:var(--hw-op,.7)}" +
      "100%{transform:translate(122vw,-8px) rotate(2deg) scale(1);opacity:0}" +
    "}" +
    ".hw-overlay{position:fixed;inset:0;z-index:500;background:rgba(15,23,42,.74);backdrop-filter:blur(10px) saturate(1.15);-webkit-backdrop-filter:blur(10px) saturate(1.15);cursor:crosshair;animation:hw-entra .3s ease;overflow:hidden}" +
    ".hw-overlay.hw-saliendo{animation:hw-sale .22s ease forwards}" +
    "@keyframes hw-entra{from{opacity:0}to{opacity:1}}@keyframes hw-sale{to{opacity:0}}" +
    ".hw-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:18px 22px;box-sizing:border-box}" +
    ".hw-score{color:#fff;font-weight:700;font-size:14.5px;background:rgba(255,255,255,.14);padding:8px 14px;border-radius:999px}" +
    ".hw-score-mejor{opacity:.75;font-weight:500;font-size:12px;margin-left:4px}" +
    ".hw-cerrar{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.28);padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;font-family:inherit}" +
    ".hw-cerrar:hover{background:rgba(255,255,255,.3)}" +
    ".hw-centro{position:absolute;top:70px;left:0;right:0;text-align:center;color:#fff;pointer-events:none;text-shadow:0 2px 12px rgba(0,0,0,.45);transition:opacity .5s ease;padding:0 20px;box-sizing:border-box}" +
    ".hw-centro.hw-centro-oculto{opacity:0}" +
    ".hw-titulo{font-size:21px;font-weight:800;margin:0 0 6px}" +
    ".hw-sub{font-size:13px;opacity:.88;max-width:420px;margin:0 auto;line-height:1.5}" +
    ".hw-cientifico{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);font-size:52px;filter:drop-shadow(0 8px 14px rgba(0,0,0,.35));pointer-events:none;animation:hw-bob 2.4s ease-in-out infinite}" +
    "@keyframes hw-bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-6px)}}" +
    ".hw-criatura{position:absolute;top:-60px;font-size:32px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3));animation:hw-caer var(--hw-caida,5s) linear forwards;pointer-events:none;user-select:none}" +
    "@keyframes hw-caer{0%{top:-60px;transform:translateX(0) rotate(0deg)}100%{top:112vh;transform:translateX(var(--hw-wiggle,0px)) rotate(30deg)}}" +
    ".hw-criatura.hw-pop{animation:hw-pop .24s ease forwards !important}" +
    "@keyframes hw-pop{0%{transform:scale(1);opacity:1}45%{transform:scale(1.35);opacity:1}100%{transform:scale(.2);opacity:0}}" +
    ".hw-tubo{position:fixed;font-size:25px;opacity:.95;pointer-events:none;z-index:501;transition:transform .24s cubic-bezier(.2,.7,.3,1)}" +
    ".hw-chispa{position:fixed;color:#fde68a;font-weight:800;font-size:14px;transform:translate(-50%,-50%);animation:hw-chispa-float .6s ease forwards;pointer-events:none;z-index:501;text-shadow:0 2px 6px rgba(0,0,0,.55)}" +
    "@keyframes hw-chispa-float{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-50%,-190%)}}";
  document.head.appendChild(style);

  // ------------------------------------------------------------------
  // Decoración ambiental al abrir (una sola vez por carga de página) —
  // varias figuras flotando con un vaivén suave (no una línea recta
  // apurada) repartidas por TODA la pantalla (de arriba a abajo), con
  // una pizca de profundidad: las más grandes/cercanas se ven más
  // nítidas y cruzan un poco más rápido; las más chicas/lejanas se ven
  // más tenues y cruzan más despacio — un efecto de capas, no todas
  // iguales, para que se sienta más cuidado. pointer-events:none en
  // toda la capa: jamás puede tapar un clic real, sin importar cuántas
  // salgan a la vez ni cuánta pantalla cubran.
  // ------------------------------------------------------------------
  var PALETA_AMBIENTE = ["🦇", "🎃", "👻", "🧙"];
  var NUM_AMBIENTE = 18;
  function mostrarAmbiente() {
    if (yaMostroAmbiente) return;
    yaMostroAmbiente = true;
    var capa = document.createElement("div");
    capa.className = "hw-ambiente";
    document.body.appendChild(capa);
    var maxDelay = 0, maxDur = 0;
    for (var i = 0; i < NUM_AMBIENTE; i++) {
      var profundidad = Math.random(); // 0 = lejos (chica, tenue, lenta) · 1 = cerca (grande, nítida, rápida)
      var el = document.createElement("span");
      el.className = "hw-ambiente-item";
      el.textContent = PALETA_AMBIENTE[Math.floor(Math.random() * PALETA_AMBIENTE.length)];
      el.style.top = (2 + Math.random() * 88) + "%";
      el.style.fontSize = (15 + profundidad * 21) + "px";
      el.style.setProperty("--hw-op", (0.42 + profundidad * 0.42).toFixed(2));
      var delay = i * 0.5 + Math.random() * 0.5;
      var dur = 14 + (1 - profundidad) * 15;
      el.style.animationDelay = delay + "s";
      el.style.setProperty("--hw-dur", dur + "s");
      capa.appendChild(el);
      if (delay > maxDelay) maxDelay = delay;
      if (dur > maxDur) maxDur = dur;
    }
    setTimeout(function () { capa.remove(); }, (maxDelay + maxDur + 1.5) * 1000);
  }

  // ------------------------------------------------------------------
  // Pausa interactiva ("filtro" de cacería de espantos).
  // ------------------------------------------------------------------
  function abrirPausa() {
    overlayAbierto = true;
    var spawnTimer = null;
    var vivos = [];
    var puntaje = 0;
    var mejor = parseInt(localStorage.getItem("bio_hw_mejor") || "0", 10) || 0;

    var overlay = document.createElement("div");
    overlay.className = "hw-overlay";
    overlay.innerHTML =
      '<div class="hw-top">' +
        '<div class="hw-score">🧪 <span id="hw-puntaje">0</span><span class="hw-score-mejor"> · Mejor: <span id="hw-mejor">' + mejor + "</span></span></div>" +
        '<button type="button" class="hw-cerrar" id="hw-cerrar">Volver al trabajo ✕</button>' +
      "</div>" +
      '<div class="hw-centro" id="hw-centro">' +
        '<p class="hw-titulo">🎃 Un respiro rápido</p>' +
        '<p class="hw-sub">Lánzales un tubo de ensayo a los espantos — haz clic donde quieras apuntar. Tu trabajo sigue exactamente como lo dejaste.</p>' +
      "</div>" +
      '<div class="hw-cientifico">🧑‍🔬</div>';
    document.body.appendChild(overlay);

    var cientifico = overlay.querySelector(".hw-cientifico");
    var elPuntaje = overlay.querySelector("#hw-puntaje");
    var elMejor = overlay.querySelector("#hw-mejor");

    setTimeout(function () {
      var centro = overlay.querySelector("#hw-centro");
      if (centro) centro.classList.add("hw-centro-oculto");
    }, 4000);

    function limpiarYSalir() {
      overlayAbierto = false;
      if (spawnTimer) clearInterval(spawnTimer);
      vivos.forEach(function (c) { if (c.timeout) clearTimeout(c.timeout); });
      vivos = [];
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("visibilitychange", onVisibilidad);
      overlay.classList.add("hw-saliendo");
      setTimeout(function () { overlay.remove(); }, 230);
      lastActivity = Date.now();
    }
    function onEsc(e) { if (e.key === "Escape") limpiarYSalir(); }
    document.addEventListener("keydown", onEsc);
    overlay.querySelector("#hw-cerrar").addEventListener("click", limpiarYSalir);
    overlay.addEventListener("click", function (e) {
      if (e.target.id === "hw-cerrar") return;
      lanzarTuboHacia(e.clientX, e.clientY);
    });

    function spawnCriatura() {
      var ch = CRIATURAS[Math.floor(Math.random() * CRIATURAS.length)];
      var el = document.createElement("div");
      el.className = "hw-criatura";
      el.textContent = ch;
      el.style.left = (8 + Math.random() * 82) + "%";
      var dur = 4.3 + Math.random() * 2.4;
      el.style.setProperty("--hw-caida", dur + "s");
      el.style.setProperty("--hw-wiggle", (Math.random() * 70 - 35) + "px");
      overlay.appendChild(el);
      var registro = { el: el, viva: true, timeout: null };
      vivos.push(registro);
      registro.timeout = setTimeout(function () {
        registro.viva = false;
        el.remove();
        vivos = vivos.filter(function (v) { return v !== registro; });
      }, dur * 1000 + 60);
    }
    spawnTimer = setInterval(spawnCriatura, 1000);
    spawnCriatura();

    function lanzarTuboHacia(x, y) {
      sonidoLanzar();
      var origenRect = cientifico.getBoundingClientRect();
      var ox = origenRect.left + origenRect.width / 2;
      var oy = origenRect.top + origenRect.height * 0.25;
      var tubo = document.createElement("div");
      tubo.className = "hw-tubo";
      tubo.textContent = "🧪";
      tubo.style.left = ox + "px";
      tubo.style.top = oy + "px";
      overlay.appendChild(tubo);
      requestAnimationFrame(function () {
        tubo.style.transform = "translate(" + (x - ox) + "px," + (y - oy) + "px) rotate(420deg)";
      });
      setTimeout(function () {
        tubo.remove();
        verAcierto(x, y);
      }, 250);
    }

    function verAcierto(x, y) {
      var radio = 46;
      var golpeada = null;
      vivos.forEach(function (c) {
        if (golpeada || !c.viva) return;
        var r = c.el.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (Math.hypot(cx - x, cy - y) <= radio) golpeada = c;
      });
      if (!golpeada) return;
      golpeada.viva = false;
      clearTimeout(golpeada.timeout);
      vivos = vivos.filter(function (v) { return v !== golpeada; });
      sonidoAcierto();
      puntaje += 10;
      elPuntaje.textContent = puntaje;
      if (puntaje > mejor) {
        mejor = puntaje;
        elMejor.textContent = mejor;
        try { localStorage.setItem("bio_hw_mejor", String(mejor)); } catch (e) {}
      }
      var r = golpeada.el.getBoundingClientRect();
      golpeada.el.classList.add("hw-pop");
      setTimeout(function () { golpeada.el.remove(); }, 240);
      mostrarChispa(r.left + r.width / 2, r.top + r.height / 2);
    }

    function mostrarChispa(x, y) {
      var sp = document.createElement("div");
      sp.className = "hw-chispa";
      sp.textContent = "+10";
      sp.style.left = x + "px";
      sp.style.top = y + "px";
      overlay.appendChild(sp);
      setTimeout(function () { sp.remove(); }, 620);
    }

    // Si la pestaña queda en segundo plano, se pausa de generar más
    // espantos (ahorra batería/CPU) — no se cierra el filtro: si
    // vuelven a esa pestaña, lo siguen viendo tal cual lo dejaron.
    function onVisibilidad() {
      if (document.hidden) {
        if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
      } else if (!spawnTimer && overlayAbierto) {
        spawnTimer = setInterval(spawnCriatura, 1000);
      }
    }
    document.addEventListener("visibilitychange", onVisibilidad);
  }

  // ------------------------------------------------------------------
  // Control: revisa cada pocos segundos si toca mostrar la decoración
  // ambiental (una vez) o la pausa interactiva (solo si hay sesión real,
  // sin modal abierto, y pasó el tiempo de inactividad).
  // ------------------------------------------------------------------
  setInterval(function () {
    if (!estaLogueado() || !sesionValida()) return;
    mostrarAmbiente();
    if (overlayAbierto || hayModalAbierto()) return;
    if (Date.now() - lastActivity >= IDLE_MS) abrirPausa();
  }, 3000);
})();

/* BIOsoft — Herramientas premium de banco de trabajo: Contador de Células
   (conteo diferencial manual mientras se mira el microscopio) y Cronómetro
   de Laboratorio flotante. Ninguna de las dos guarda nada en una orden —
   son herramientas de apoyo mientras se trabaja, como un contador de
   células físico o un cronómetro de cocina, no un módulo de resultados. */
(function (global) {
  "use strict";
  var U = BIO_UI;

  // -----------------------------------------------------------------
  // SONIDOS — generados con Web Audio API (sin archivos de audio que
  // cargar): un "clic" corto por cada célula contada, un sonido distinto
  // al deshacer, y una melodía de cierre al llegar a 100 células — igual
  // que un contador de células electrónico de verdad.
  // -----------------------------------------------------------------
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
  function tono(freq, duracionMs, tipo, volumen, retrasoMs) {
    var ctx = ctxAudio();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = tipo || "sine";
      osc.frequency.value = freq;
      var inicio = ctx.currentTime + (retrasoMs || 0) / 1000;
      var dur = duracionMs / 1000;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.linearRampToValueAtTime(volumen || 0.2, inicio + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + dur + 0.03);
    } catch (e) {}
  }
  function sonidoClic() { tono(1150, 65, "square", 0.16); }
  function sonidoDeshacer() { tono(320, 100, "sine", 0.16); }
  function sonidoCompleto() {
    tono(523.25, 140, "sine", 0.22, 0);
    tono(659.25, 140, "sine", 0.22, 140);
    tono(783.99, 320, "sine", 0.24, 280);
  }
  function sonidoAlarma() {
    for (var i = 0; i < 5; i++) tono(880, 240, "square", 0.28, i * 320);
  }

  // -----------------------------------------------------------------
  // CONTADOR DE CÉLULAS — conteo diferencial manual (100 células) con
  // teclado numérico, sonido por cada tecla y aviso al llegar a 100.
  // -----------------------------------------------------------------
  var CATEGORIAS_CELULAS = [
    { id: "seg", nombre: "Neutrófilos Segmentados", color: "#f97316" },
    { id: "band", nombre: "Neutrófilos en Banda (Cayados)", color: "#fb923c" },
    { id: "linfo", nombre: "Linfocitos", color: "#2563eb" },
    { id: "mono", nombre: "Monocitos", color: "#7c3aed" },
    { id: "eosino", nombre: "Eosinófilos", color: "#059669" },
    { id: "baso", nombre: "Basófilos", color: "#db2777" },
    { id: "otras", nombre: "Otras / Atípicas", color: "#64748b" }
  ];
  // El conteo vive fuera de abrirContadorCelulas() para que, si el
  // bacteriólogo(a) cierra la ventana sin querer a mitad de un conteo, al
  // volver a abrirla siga exactamente donde iba — solo "Reiniciar Conteo"
  // lo borra de verdad.
  var conteoCelulas = {};
  CATEGORIAS_CELULAS.forEach(function (c) { conteoCelulas[c.id] = 0; });
  var historialCelulas = []; // pila de ids, para "Deshacer"
  var seleccionActiva = 0; // índice resaltado con las flechas, para quien no tiene teclado numérico

  function totalCelulas() {
    return CATEGORIAS_CELULAS.reduce(function (sum, c) { return sum + conteoCelulas[c.id]; }, 0);
  }

  function abrirContadorCelulas() {
    if (document.getElementById("cc-overlay")) return; // ya está abierto
    var overlay = document.createElement("div");
    overlay.id = "cc-overlay";
    overlay.className = "cc-overlay";
    document.body.appendChild(overlay);

    function render() {
      var total = totalCelulas();
      var completo = total >= 100;
      overlay.innerHTML =
        '<div class="cc-topbar">' +
        '<div class="cc-titulo">🔬 Contador de Células — Diferencial Hematológico</div>' +
        '<button type="button" class="cc-close" id="cc-cerrar" aria-label="Cerrar">' + U.icon("x") + "</button>" +
        "</div>" +
        '<div class="cc-total-wrap">' +
        '<div class="cc-total-num">' + total + "<span class=\"cc-total-de100\">/100</span></div>" +
        '<div class="cc-total-label">' + (completo ? "✅ Conteo diferencial completo" : "células contadas") + "</div>" +
        '<div class="cc-total-bar"><div class="cc-total-fill" style="width:' + Math.min(100, total) + '%"></div></div>' +
        "</div>" +
        '<div class="cc-grid">' +
        CATEGORIAS_CELULAS.map(function (c, i) {
          var n = conteoCelulas[c.id];
          var pct = total ? (n / total * 100).toFixed(1) : "0.0";
          return '<button type="button" class="cc-tile' + (i === seleccionActiva ? " cc-tile-activa" : "") + '" data-cc-tile="' + c.id + '" style="--tile-color:' + c.color + '">' +
            '<span class="cc-tile-tecla">' + (i + 1) + "</span>" +
            '<span class="cc-tile-count">' + n + "</span>" +
            '<span class="cc-tile-pct">' + pct + "%</span>" +
            '<span class="cc-tile-nombre">' + U.esc(c.nombre) + "</span>" +
            "</button>";
        }).join("") +
        "</div>" +
        '<div class="cc-footer">' +
        '<button type="button" class="btn btn-outline" id="cc-deshacer"' + (historialCelulas.length ? "" : " disabled") + ">↩ Deshacer (Retroceso)</button>" +
        '<button type="button" class="btn btn-outline" id="cc-reiniciar">Reiniciar Conteo</button>' +
        '<button type="button" class="btn btn-primary" id="cc-ia">📷 ¿Dudas con una célula? Identifícala con IA</button>' +
        "</div>" +
        '<p class="cc-ayuda">Usa el teclado numérico (1-' + CATEGORIAS_CELULAS.length + ') para contar sin soltar el microscopio, o las flechas ↑↓ para elegir y Enter para sumar. Cada clic suena — al llegar a 100 se avisa con un sonido distinto.</p>' +
        '<input type="file" id="cc-ia-input" accept="image/*" capture="environment" class="hidden"/>';

      overlay.querySelector("#cc-cerrar").addEventListener("click", cerrar);
      overlay.querySelectorAll("[data-cc-tile]").forEach(function (btn) {
        btn.addEventListener("click", function () { sumar(btn.dataset.ccTile); });
      });
      var btnDeshacer = overlay.querySelector("#cc-deshacer");
      if (!btnDeshacer.disabled) btnDeshacer.addEventListener("click", deshacer);
      overlay.querySelector("#cc-reiniciar").addEventListener("click", reiniciar);
      overlay.querySelector("#cc-ia").addEventListener("click", function () { overlay.querySelector("#cc-ia-input").click(); });
      overlay.querySelector("#cc-ia-input").addEventListener("change", manejarFotoIA);
    }

    function sumar(id) {
      conteoCelulas[id] = (conteoCelulas[id] || 0) + 1;
      historialCelulas.push(id);
      var total = totalCelulas();
      if (total === 100) sonidoCompleto(); else sonidoClic();
      render();
    }
    function deshacer() {
      var ultimo = historialCelulas.pop();
      if (!ultimo) return;
      conteoCelulas[ultimo] = Math.max(0, conteoCelulas[ultimo] - 1);
      sonidoDeshacer();
      render();
    }
    function reiniciar() {
      if (totalCelulas() > 0 && !confirm("¿Reiniciar el conteo? Se pierden las " + totalCelulas() + " células ya contadas.")) return;
      CATEGORIAS_CELULAS.forEach(function (c) { conteoCelulas[c.id] = 0; });
      historialCelulas = [];
      seleccionActiva = 0;
      render();
    }
    function manejarFotoIA(e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      U.toast("La identificación de células por IA todavía no está activada para tu laboratorio — pídele a soporte que la habilite (tiene un costo por análisis). Tu foto no se envió a ningún lado.", "warning");
    }
    function onKeydown(e) {
      var idx = -1;
      if (/^Numpad[1-9]$/.test(e.code)) idx = parseInt(e.code.replace("Numpad", ""), 10) - 1;
      else if (/^Digit[1-9]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) idx = parseInt(e.code.replace("Digit", ""), 10) - 1;
      if (idx !== -1 && idx < CATEGORIAS_CELULAS.length) {
        e.preventDefault();
        sumar(CATEGORIAS_CELULAS[idx].id);
        return;
      }
      if (e.code === "ArrowDown" || e.code === "ArrowRight") {
        e.preventDefault();
        seleccionActiva = (seleccionActiva + 1) % CATEGORIAS_CELULAS.length;
        render();
      } else if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
        e.preventDefault();
        seleccionActiva = (seleccionActiva - 1 + CATEGORIAS_CELULAS.length) % CATEGORIAS_CELULAS.length;
        render();
      } else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
        e.preventDefault();
        sumar(CATEGORIAS_CELULAS[seleccionActiva].id);
      } else if (e.code === "Backspace" || e.code === "NumpadSubtract") {
        e.preventDefault();
        deshacer();
      } else if (e.code === "Escape") {
        cerrar();
      }
    }
    function cerrar() {
      document.removeEventListener("keydown", onKeydown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    document.addEventListener("keydown", onKeydown);
    render();
  }

  // -----------------------------------------------------------------
  // CRONÓMETRO DE LABORATORIO — ventana flotante que NO bloquea el resto
  // del software: se puede seguir trabajando (capturando resultados,
  // navegando entre pantallas) mientras cuenta el tiempo de un reactivo,
  // una incubación, etc. Vive fuera del área que controla el router
  // (document.body directamente), así que sobrevive a cualquier cambio de
  // pantalla sin perder la cuenta.
  // -----------------------------------------------------------------
  var timerState = null; // { restante, total, intervalId, corriendo }

  function abrirCronometro() {
    var existente = document.getElementById("timer-float");
    if (existente) { existente.classList.remove("timer-shake"); void existente.offsetWidth; return; }

    var wrap = document.createElement("div");
    wrap.id = "timer-float";
    wrap.className = "timer-float";
    document.body.appendChild(wrap);

    if (!timerState) timerState = { restante: 300, total: 300, intervalId: null, corriendo: false };

    function fmt(seg) {
      seg = Math.max(0, seg);
      var m = Math.floor(seg / 60), s = seg % 60;
      return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    function render() {
      wrap.innerHTML =
        '<div class="timer-float-header">' +
        '<span>⏱ Cronómetro de Laboratorio</span>' +
        '<button type="button" id="timer-cerrar" aria-label="Cerrar">' + U.icon("x") + "</button>" +
        "</div>" +
        '<div class="timer-display' + (timerState.restante === 0 ? " timer-display-fin" : "") + '">' + fmt(timerState.restante) + "</div>" +
        '<div class="timer-presets">' +
        [30, 60, 120, 300, 600].map(function (s) {
          return '<button type="button" data-timer-preset="' + s + '">' + (s < 60 ? s + "s" : (s / 60) + "m") + "</button>";
        }).join("") +
        "</div>" +
        '<div class="timer-custom">' +
        '<input type="number" id="timer-min" min="0" max="180" placeholder="min"/>' +
        '<input type="number" id="timer-seg" min="0" max="59" placeholder="seg"/>' +
        '<button type="button" id="timer-fijar">Fijar</button>' +
        "</div>" +
        '<div class="timer-controls">' +
        '<button type="button" class="btn btn-primary btn-sm" id="timer-start">' + (timerState.corriendo ? "⏸ Pausar" : "▶ Iniciar") + "</button>" +
        '<button type="button" class="btn btn-outline btn-sm" id="timer-reset">⟲ Reiniciar</button>' +
        "</div>";

      wrap.querySelector("#timer-cerrar").addEventListener("click", cerrarFlotante);
      wrap.querySelectorAll("[data-timer-preset]").forEach(function (b) {
        b.addEventListener("click", function () { fijarTiempo(parseInt(b.dataset.timerPreset, 10)); });
      });
      wrap.querySelector("#timer-fijar").addEventListener("click", function () {
        var min = parseInt(wrap.querySelector("#timer-min").value, 10) || 0;
        var seg = parseInt(wrap.querySelector("#timer-seg").value, 10) || 0;
        if (min || seg) fijarTiempo(min * 60 + seg);
      });
      wrap.querySelector("#timer-start").addEventListener("click", toggleIniciar);
      wrap.querySelector("#timer-reset").addEventListener("click", reiniciarTiempo);
    }

    function fijarTiempo(seg) {
      pausar();
      timerState.total = seg;
      timerState.restante = seg;
      render();
    }
    function toggleIniciar() {
      if (timerState.corriendo) { pausar(); return; }
      if (timerState.restante <= 0) return;
      timerState.corriendo = true;
      timerState.intervalId = setInterval(function () {
        timerState.restante--;
        if (timerState.restante <= 0) {
          timerState.restante = 0;
          pausar();
          sonidoAlarma();
          var w = document.getElementById("timer-float");
          if (w) {
            w.classList.add("timer-shake");
            U.toast("⏰ ¡Tiempo cumplido! (" + fmt(timerState.total) + ")", "success");
          }
        }
        var w2 = document.getElementById("timer-float");
        if (w2) render();
      }, 1000);
      render();
    }
    function pausar() {
      if (timerState.intervalId) clearInterval(timerState.intervalId);
      timerState.intervalId = null;
      timerState.corriendo = false;
    }
    function reiniciarTiempo() {
      pausar();
      timerState.restante = timerState.total;
      render();
    }
    function cerrarFlotante() {
      // Cerrar solo quita la ventana de la pantalla — si estaba corriendo,
      // sigue contando en segundo plano (igual que un cronómetro físico
      // que se guarda en el bolsillo) y avisa con sonido al llegar a cero
      // aunque la ventana esté cerrada; "Cronómetro de Laboratorio" en el
      // panel la vuelve a mostrar donde iba.
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    render();
  }

  global.BIO_TOOLS = { abrirContadorCelulas: abrirContadorCelulas, abrirCronometro: abrirCronometro };
})(window);

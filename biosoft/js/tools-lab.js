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
  // Al llegar a las 100 células (fin del conteo diferencial) el sonido
  // tiene que notarse claramente más fuerte y más largo que un clic
  // cualquiera — un acorde completo (no solo 3 notas sueltas, cada nota
  // suena junto con la anterior) y bastante más volumen, para que el
  // bacteriólogo(a) lo distinga sin necesidad de mirar la pantalla.
  function sonidoCompleto() {
    tono(523.25, 200, "sine", 0.34, 0);
    tono(659.25, 200, "sine", 0.34, 0);
    tono(783.99, 420, "sine", 0.36, 160);
    tono(1046.5, 420, "sine", 0.3, 160);
  }
  // Alerta al intentar sumar una célula MÁS después de ya haber llegado a
  // 100 — un timbre corto y grave, bien distinto del clic normal y del
  // sonido de "completo", para que quede claro que ese clic NO se contó.
  function sonidoLimite() {
    tono(220, 90, "sawtooth", 0.3, 0);
    tono(180, 140, "sawtooth", 0.3, 100);
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
        '<div class="cc-total-label">' + (completo ? "✅ Conteo diferencial completo — no se pueden sumar más" : "células contadas") + "</div>" +
        '<div class="cc-total-bar"><div class="cc-total-fill" style="width:' + Math.min(100, total) + '%"></div></div>' +
        "</div>" +
        '<div class="cc-grid">' +
        CATEGORIAS_CELULAS.map(function (c, i) {
          var n = conteoCelulas[c.id];
          var pct = total ? (n / total * 100).toFixed(1) : "0.0";
          return '<button type="button" class="cc-tile' + (i === seleccionActiva ? " cc-tile-activa" : "") + (completo ? " cc-tile-completa" : "") + '" data-cc-tile="' + c.id + '" style="--tile-color:' + c.color + '">' +
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
        '<p class="cc-ayuda">Usa el teclado numérico (1-' + CATEGORIAS_CELULAS.length + ') para contar sin soltar el microscopio, o las flechas ↑↓ para elegir y Enter para sumar. Cada clic suena — al llegar a 100 se avisa con un sonido fuerte, y no se puede sumar más (una tecla de más suena como alerta).</p>' +
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
      // Un conteo diferencial siempre es sobre 100 células — pasar de ahí
      // no tiene sentido clínico (los porcentajes dejan de cuadrar), así
      // que una vez completo se bloquea cualquier tecla/clic de sumar más:
      // suena una alerta bien distinta (grave, corta) para que quede claro
      // que ESE clic no se contó, en vez de sumarlo en silencio.
      if (totalCelulas() >= 100) {
        sonidoLimite();
        var totalEl = overlay.querySelector(".cc-total-wrap");
        if (totalEl) { totalEl.classList.remove("cc-shake"); void totalEl.offsetWidth; totalEl.classList.add("cc-shake"); }
        return;
      }
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
      // Este aviso solo aparece si de verdad se intentó usar la función (se
      // tomó/eligió una foto) — nunca como un anuncio suelto interrumpiendo
      // el conteo — para ofrecer el paquete de IA Premium justo en el
      // momento en que le serviría a quien lo está pidiendo.
      var mensajeWa = "Hola, estoy usando BIOsoft y quiero más información sobre el paquete IA Premium (identificación de células por foto, USD $20/mes).";
      U.openModal(
        '<h3 class="modal-title">✨ Identificación de Células con IA</h3>' +
        '<p class="text-muted">Esta función hace parte del <b>paquete IA Premium de BIOsoft</b> — identifica la célula de tu foto según sus rasgos morfológicos, y da acceso a más herramientas de inteligencia artificial a medida que las vayamos sumando.</p>' +
        '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin:14px 0;text-align:center">' +
        '<div style="font-size:26px;font-weight:800;color:var(--brand-primary)">USD $20<span style="font-size:14px;font-weight:600;color:var(--text-muted)">/mes</span></div>' +
        '<div class="text-muted" style="font-size:12.5px">por laboratorio, sin importar cuántos usuarios lo usen</div>' +
        "</div>" +
        '<div class="flex gap-2 justify-between" style="margin-top:6px">' +
        '<button class="btn btn-ghost" data-modal-close>Tal vez después</button>' +
        '<a class="btn btn-whatsapp" href="https://wa.me/573505457420?text=' + encodeURIComponent(mensajeWa) + '" target="_blank">' + U.icon("send") + " Preguntar por WhatsApp</a>" +
        "</div>"
      );
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
  // { restante, total, intervalId, corriendo, nota, sonando, alarmaIntervalId }
  // — vive a nivel de módulo (no dentro de abrirCronometro) para que el
  // conteo y la alarma sigan corriendo en segundo plano aunque se cierre
  // la ventanita, y para poder RECREARLA sola si la alarma suena estando
  // cerrada (ver dispararAlarma más abajo) — nunca debe sonar sin que
  // quede a la vista un botón con el que apagarla.
  var timerState = { restante: 300, total: 300, intervalId: null, corriendo: false, nota: "", sonando: false, alarmaIntervalId: null, minimizado: false };

  function fmtTiempo(seg) {
    seg = Math.max(0, seg);
    var m = Math.floor(seg / 60), s = seg % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function crearWidgetCronometro() {
    var wrap = document.createElement("div");
    wrap.id = "timer-float";
    wrap.className = "timer-float";
    document.body.appendChild(wrap);
    return wrap;
  }

  function renderCronometro() {
    var wrap = document.getElementById("timer-float");
    if (!wrap) return;
    wrap.classList.remove("timer-float-sonando", "timer-float-mini");
    if (timerState.sonando) {
      // Estado de alarma: ocupa toda la ventanita con el aviso, la nota
      // del examen/lectura (si se escribió) bien grande, y UN SOLO botón
      // para apagarla — nada de temporizador nuevo ni presets mientras
      // sigue sonando, para que sea imposible no verlo. Si estaba
      // minimizado, se expande solo: una alarma nunca debe quedar
      // reducida a una pastillita chica donde es fácil no verla.
      wrap.innerHTML =
        '<div class="timer-float-header timer-float-header-alarma">' +
        '<span>🔔 ¡Tiempo cumplido!</span>' +
        "</div>" +
        '<div class="timer-display timer-display-fin">00:00</div>' +
        (timerState.nota ? '<div class="timer-nota-aviso">' + U.esc(timerState.nota) + "</div>" : "") +
        '<button type="button" class="btn btn-danger btn-block" id="timer-detener-alarma">🔕 Detener Alarma</button>';
      wrap.querySelector("#timer-detener-alarma").addEventListener("click", detenerAlarma);
      wrap.classList.add("timer-float-sonando");
      return;
    }
    if (timerState.minimizado) {
      // Minimizado: una pastilla chica y llamativa arriba de la pantalla,
      // lejos del menú y de la bandeja de resultados donde de verdad
      // trabajan bacteriólogos/bioanalistas/auxiliares — solo el tiempo
      // restante, y un clic la vuelve a abrir completa.
      wrap.classList.add("timer-float-mini");
      wrap.innerHTML =
        '<button type="button" class="timer-mini-btn" id="timer-restaurar" title="Abrir cronómetro">' +
        "⏱ " + fmtTiempo(timerState.restante) +
        (timerState.corriendo ? "" : " ⏸") +
        "</button>";
      wrap.querySelector("#timer-restaurar").addEventListener("click", function () {
        timerState.minimizado = false;
        renderCronometro();
      });
      return;
    }
    wrap.innerHTML =
      '<div class="timer-float-header">' +
      '<span>⏱ Cronómetro de Laboratorio</span>' +
      '<span class="timer-float-header-actions">' +
      '<button type="button" id="timer-minimizar" aria-label="Minimizar" title="Minimizar">' + U.icon("chevron-down") + "</button>" +
      '<button type="button" id="timer-cerrar" aria-label="Cerrar">' + U.icon("x") + "</button>" +
      "</span>" +
      "</div>" +
      '<div class="timer-display">' + fmtTiempo(timerState.restante) + "</div>" +
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
      '<input type="text" id="timer-nota" class="timer-nota-input" maxlength="60" placeholder="Nota (ej: Lectura de VDRL)" value="' + U.esc(timerState.nota) + '"/>' +
      '<div class="timer-controls">' +
      '<button type="button" class="btn btn-primary btn-sm" id="timer-start">' + (timerState.corriendo ? "⏸ Pausar" : "▶ Iniciar") + "</button>" +
      '<button type="button" class="btn btn-outline btn-sm" id="timer-reset">⟲ Reiniciar</button>' +
      "</div>";

    wrap.querySelector("#timer-cerrar").addEventListener("click", cerrarFlotanteCronometro);
    wrap.querySelector("#timer-minimizar").addEventListener("click", function () {
      timerState.minimizado = true;
      renderCronometro();
    });
    wrap.querySelectorAll("[data-timer-preset]").forEach(function (b) {
      b.addEventListener("click", function () { fijarTiempo(parseInt(b.dataset.timerPreset, 10)); });
    });
    wrap.querySelector("#timer-fijar").addEventListener("click", function () {
      var min = parseInt(wrap.querySelector("#timer-min").value, 10) || 0;
      var seg = parseInt(wrap.querySelector("#timer-seg").value, 10) || 0;
      if (min || seg) fijarTiempo(min * 60 + seg);
    });
    wrap.querySelector("#timer-nota").addEventListener("input", function (e) { timerState.nota = e.target.value; });
    wrap.querySelector("#timer-start").addEventListener("click", toggleIniciarCronometro);
    wrap.querySelector("#timer-reset").addEventListener("click", reiniciarTiempoCronometro);
  }

  function fijarTiempo(seg) {
    pausarCronometro();
    timerState.total = seg;
    timerState.restante = seg;
    renderCronometro();
  }
  function toggleIniciarCronometro() {
    if (timerState.corriendo) { pausarCronometro(); return; }
    if (timerState.restante <= 0) return;
    timerState.corriendo = true;
    timerState.intervalId = setInterval(function () {
      timerState.restante--;
      if (timerState.restante <= 0) {
        timerState.restante = 0;
        pausarCronometro();
        dispararAlarma();
        return;
      }
      renderCronometro();
    }, 1000);
    renderCronometro();
  }
  function pausarCronometro() {
    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    timerState.corriendo = false;
  }
  function reiniciarTiempoCronometro() {
    pausarCronometro();
    timerState.restante = timerState.total;
    renderCronometro();
  }
  // Al llegar a cero: la alarma suena EN BUCLE (nunca solo unas cuantas
  // veces) hasta que alguien la apague a propósito — caso real pedido:
  // una alarma corta se puede no notar mientras se está ocupado con otro
  // paciente; una que no para obliga a atenderla. Si la ventanita estaba
  // cerrada, se vuelve a crear sola mostrando el botón de apagar — nunca
  // debe quedar sonando sin ningún control visible en pantalla.
  function dispararAlarma() {
    timerState.sonando = true;
    timerState.minimizado = false;
    if (!document.getElementById("timer-float")) crearWidgetCronometro();
    renderCronometro();
    sonidoAlarma();
    timerState.alarmaIntervalId = setInterval(sonidoAlarma, 2200);
  }
  function detenerAlarma() {
    if (timerState.alarmaIntervalId) clearInterval(timerState.alarmaIntervalId);
    timerState.alarmaIntervalId = null;
    timerState.sonando = false;
    renderCronometro();
  }
  function cerrarFlotanteCronometro() {
    // Cerrar solo quita la ventanita de la pantalla — si estaba corriendo,
    // sigue contando en segundo plano (igual que un cronómetro físico que
    // se guarda en el bolsillo); "Cronómetro de Laboratorio" en el panel
    // la vuelve a mostrar donde iba. Mientras la alarma esté sonando esta
    // función no se usa (ver renderCronometro, ahí no hay botón de
    // cerrar) — la única salida en ese estado es "Detener Alarma".
    var wrap = document.getElementById("timer-float");
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
  }

  function abrirCronometro() {
    if (document.getElementById("timer-float")) {
      // Ya está abierto — si estaba minimizado (la pastillita chica de
      // arriba), volver a pulsar "Cronómetro de Laboratorio" en el panel
      // lo expande de nuevo, en vez de no hacer nada.
      if (timerState.minimizado) { timerState.minimizado = false; renderCronometro(); }
      return;
    }
    crearWidgetCronometro();
    renderCronometro();
  }

  global.BIO_TOOLS = { abrirContadorCelulas: abrirContadorCelulas, abrirCronometro: abrirCronometro };
})(window);

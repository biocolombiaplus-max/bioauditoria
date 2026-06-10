/**
 * hamsa-bundle-add.js
 *
 * 1. HamsaBundle.addToCart — agrega items al carrito y abre el drawer
 * 2. Fix Releasit — garantiza que el DOM del carrito siempre tenga
 *    todos los items ANTES de que Releasit abra su formulario
 */

/* ═══════════════════════════════════════════════════════════
   1. FUNCIÓN CENTRAL DE AGREGAR AL CARRITO
   ═══════════════════════════════════════════════════════════ */
window.HamsaBundle = window.HamsaBundle || {};

window.HamsaBundle.addToCart = function(items, opts) {
  opts = opts || {};
  if (!items || !items.length) {
    if (opts.onError) opts.onError('No hay productos seleccionados');
    return;
  }
  if (opts.onStart) opts.onStart();

  var cleanItems = items.map(function(i) {
    return { id: parseInt(i.id, 10), quantity: parseInt(i.quantity, 10) || 1 };
  });

  fetch('/cart/add.js', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify({ items: cleanItems })
  })
  .then(function(r) { return r.json(); })
  .then(function(response) {
    if (response.status) {
      throw new Error(response.description || response.message || 'Error al agregar');
    }
    /* Disparar cart:update sin sections para que el tema actualice el contador */
    document.dispatchEvent(new CustomEvent('cart:update', {
      bubbles: true,
      detail: { resource: response, data: {} }
    }));
    /* Abrir drawer */
    setTimeout(function() {
      var drawer = document.querySelector('cart-drawer-component');
      if (drawer && typeof drawer.open === 'function') drawer.open();
      if (opts.onSuccess) opts.onSuccess(response);
    }, 100);
  })
  .catch(function(err) {
    var msg = (err && err.message) ? err.message : 'Error — intenta de nuevo';
    if (opts.onError) opts.onError(msg);
  });
};


/* ═══════════════════════════════════════════════════════════
   2. FIX RELEASIT — SINCRONIZACIÓN GARANTIZADA
   
   PROBLEMA RAÍZ:
   El tema Horizon actualiza el DOM del carrito con morphSection
   usando las `sections` del response inmediato de /cart/add.js.
   Ese response solo contiene el item recién agregado, NO todo
   el carrito. Entonces el DOM queda con 1 item aunque haya 2
   en el servidor. Releasit lee el DOM y ve solo 1.
   
   SOLUCIÓN DEFINITIVA:
   Interceptar el CLIC en el botón de Releasit y hacer un fetch
   fresco del carrito real ANTES de que Releasit lo lea.
   Esto cubre TODOS los escenarios:
   - 2 productos agregados por separado desde páginas de producto
   - 1 desde página de producto + 1 desde bundle
   - 2 desde bundle (ya funciona, pero igual aplica)
   ═══════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* Obtener el HTML real del carrito desde el servidor */
  function syncCartFromServer(callback) {
    var ids = [];
    document.querySelectorAll('cart-items-component[data-section-id]').forEach(function(el) {
      if (el.dataset.sectionId) ids.push(el.dataset.sectionId);
    });

    if (!ids.length) {
      if (callback) callback();
      return;
    }

    fetch('/cart?sections=' + encodeURIComponent(ids.join(',')), {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      /* Actualizar el DOM con el carrito real completo */
      document.dispatchEvent(new CustomEvent('cart:update', {
        bubbles: true,
        detail: { resource: {}, data: { sections: data } }
      }));
      /* Pequeño delay para que morphSection termine */
      setTimeout(function() {
        if (callback) callback();
      }, 50);
    })
    .catch(function() {
      if (callback) callback();
    });
  }

  /* Interceptar clicks en cualquier botón de Releasit o checkout */
  function interceptCheckoutButtons() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target) return;

      /* Buscar el botón más cercano al click */
      var btn = target.closest('button, a, [role="button"]');
      if (!btn) return;

      var isReleasit = false;

      /* Detectar botón de Releasit por múltiples métodos */
      var btnText = (btn.textContent || '').toLowerCase().trim();
      var btnClass = (btn.className || '').toLowerCase();
      var btnId = (btn.id || '').toLowerCase();
      var btnDataType = (btn.getAttribute('data-testid') || '').toLowerCase();

      /* Releasit COD Form inyecta botones con estas características */
      if (
        btnId.includes('releasit') ||
        btnClass.includes('releasit') ||
        btnClass.includes('cod-form') ||
        btnClass.includes('cod_form') ||
        btnDataType.includes('releasit') ||
        /* Buscar en el árbol de padres */
        btn.closest('[id*="releasit"], [class*="releasit"], [id*="cod-form"], [class*="cod_form"]')
      ) {
        isReleasit = true;
      }

      /* También interceptar el botón nativo de checkout por si acaso */
      if (btn.name === 'checkout' || btnId === 'checkout') {
        isReleasit = true;
      }

      if (!isReleasit) return;

      /* Tenemos un click en Releasit/checkout
         Verificar si hay posible desincronización del carrito */
      var cartComponent = document.querySelector('cart-items-component');
      if (!cartComponent) return;

      /* Si el carrito tiene items, sincronizar antes de dejar pasar el click */
      fetch('/cart.js', { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(cart) {
          if (!cart || !cart.item_count) return;
          /* Sincronizar el DOM con el servidor */
          syncCartFromServer();
        })
        .catch(function() {});

    }, true); /* true = capture phase, antes de que Releasit reciba el evento */
  }

  /* También corregir después de cada add nativo desde product-form */
  var refreshTimer = null;
  document.addEventListener('cart:update', function(e) {
    var source = (e.detail && e.detail.data && e.detail.data.source) || '';
    if (source === 'product-form-component') {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function() {
        syncCartFromServer();
      }, 200);
    }
  });

  /* Inicializar cuando el DOM esté listo */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptCheckoutButtons);
  } else {
    interceptCheckoutButtons();
  }

})();

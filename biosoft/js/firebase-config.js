/* BIOsoft — Configuración e inicialización de Firebase (cuentas reales de laboratorio)
   Este archivo solo inicializa Firebase; toda la lógica de datos/autenticación vive en
   store.js y auth.js. El objeto de configuración de una app web de Firebase no es secreto:
   está diseñado para viajar al navegador (la seguridad real la dan las Reglas de Firestore). */
(function (global) {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyD3GrNA36sy4iCszTuPN5Ol2H3KTNbyUQM",
    authDomain: "biosoft-produccion.firebaseapp.com",
    projectId: "biosoft-produccion",
    storageBucket: "biosoft-produccion.firebasestorage.app",
    messagingSenderId: "806962064823",
    appId: "1:806962064823:web:27225d45915585d087cc32",
    measurementId: "G-34Z9W51RHF"
  };

  if (typeof firebase === "undefined") {
    console.error("Firebase SDK no cargó. Revisa tu conexión o los <script> de Firebase en app.html.");
    return;
  }

  // Autorrecuperación de "FIRESTORE INTERNAL ASSERTION FAILED": un bug real
  // reportado (celular con señal débil que se había quedado sin memoria
  // varias veces) — la copia local de Firestore en IndexedDB queda en un
  // estado inconsistente y el SDK, para no arriesgar los datos, se apaga
  // por completo: CUALQUIER acción después (incluso iniciar sesión) sale
  // con ese mensaje crudo en inglés, en cualquier navegador del mismo
  // dispositivo. Antes de este ajuste, la única salida era que la persona
  // misma encontrara y borrara los datos del sitio a mano — difícil de
  // explicarle por WhatsApp a alguien con la batería casi agotada. Ahora,
  // la primera vez que se detecta este error en la sesión, BIOsoft mismo
  // borra su copia local corrupta y recarga la página solo — sin que la
  // persona tenga que hacer nada. Una bandera en sessionStorage evita un
  // ciclo infinito si el problema persistiera (ej. sin IndexedDB real):
  // como mucho, UN intento automático por pestaña.
  function esErrorDeAsercionFirestore(msg) { return /internal assertion failed/i.test(msg || ""); }
  function intentarAutorrecuperarFirestoreCorrupto(msg) {
    if (!esErrorDeAsercionFirestore(msg)) return;
    var YA_INTENTADO_KEY = "biosoft_fs_autorrecuperado_v1";
    try { if (sessionStorage.getItem(YA_INTENTADO_KEY)) return; } catch (e) { return; }
    try { sessionStorage.setItem(YA_INTENTADO_KEY, "1"); } catch (e) { return; }
    console.warn("BIOsoft: la copia local de Firestore quedó corrupta en este navegador — borrándola y recargando automáticamente.");
    var recargar = function () { location.reload(); };
    if (global.indexedDB && typeof global.indexedDB.databases === "function") {
      global.indexedDB.databases().then(function (dbs) {
        return Promise.all((dbs || [])
          .filter(function (d) { return d && d.name && /firestore/i.test(d.name); })
          .map(function (d) { return new Promise(function (resolve) {
            var req = global.indexedDB.deleteDatabase(d.name);
            req.onsuccess = req.onerror = req.onblocked = resolve;
          }); }));
      }).then(recargar).catch(recargar);
    } else {
      // Navegador sin indexedDB.databases() (no puede listar para borrar
      // solo lo de Firestore): recarga de todos modos — si el problema
      // sigue, mensajeErrorFirestore() ya deja instrucciones claras para
      // borrar los datos del sitio a mano.
      recargar();
    }
  }
  global.addEventListener("error", function (e) { intentarAutorrecuperarFirestoreCorrupto(e && e.message); });
  global.addEventListener("unhandledrejection", function (e) { intentarAutorrecuperarFirestoreCorrupto(e && e.reason && e.reason.message); });

  var app = firebase.initializeApp(firebaseConfig);
  app.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
  var db = app.firestore();

  /* Deja que el laboratorio siga trabajando aunque se vaya el internet: los
     datos que ya se sincronizaron quedan disponibles en el dispositivo
     (lectura), y lo que se capture mientras no hay señal queda en una cola
     local que se sube sola en cuanto vuelve la conexión (escritura) — sin
     tener que hacer nada manual. Ya NO se usa synchronizeTabs (permitía
     tener BIOsoft abierto en varias pestañas/ventanas del mismo navegador a
     la vez): es justo la opción que coordina varias pestañas sobre el MISMO
     IndexedDB, y esa coordinación es la que entra en un estado imposible
     ("INTERNAL ASSERTION FAILED") cuando el navegador suspende una pestaña
     de fondo o el dispositivo se queda sin memoria — el caso típico en un
     celular con señal débil. Sin esta opción, cada pestaña mantiene su
     propia copia local (deja de funcionar bien con dos pestañas de BIOsoft
     abiertas a la vez en el mismo navegador — caso raro en el celular,
     donde casi nadie hace eso), pero el Modo Offline de una sola pestaña
     sigue intacto y mucho menos propenso a este error. */
  db.enablePersistence().catch(function (e) {
    if (e.code === "unimplemented") console.warn("BIOsoft: este navegador no soporta el trabajo sin conexión.");
    else if (e.code === "failed-precondition") console.warn("BIOsoft: el trabajo sin conexión ya está activo en otra pestaña de este navegador.");
    else console.warn("BIOsoft: no se pudo activar el trabajo sin conexión ->", e.code || e.message);
  });

  global.BIO_FB = {
    app: app,
    auth: app.auth(),
    db: db,

    /* Devuelve una instancia secundaria de Firebase Auth, aislada de la sesión principal.
       Se usa para crear cuentas de nuevos usuarios (laboratorios/bacteriólogos) sin
       desloguear al superadmin o al admin que está haciendo la creación. */
    secondaryAuth: function () {
      var name = "Secondary-" + Date.now();
      var secondaryApp = firebase.initializeApp(firebaseConfig, name);
      return {
        auth: secondaryApp.auth(),
        db: secondaryApp.firestore(),
        cleanup: function () { secondaryApp.delete(); }
      };
    }
  };
})(window);

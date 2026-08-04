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

  var app = firebase.initializeApp(firebaseConfig);
  app.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
  var db = app.firestore();

  /* Deja que el laboratorio siga trabajando aunque se vaya el internet: los
     datos que ya se sincronizaron quedan disponibles en el dispositivo
     (lectura), y lo que se capture mientras no hay señal queda en una cola
     local que se sube sola en cuanto vuelve la conexión (escritura) — sin
     tener que hacer nada manual. synchronizeTabs permite tener BIOsoft
     abierto en más de una pestaña/ventana del mismo navegador a la vez. */
  db.enablePersistence({ synchronizeTabs: true }).catch(function (e) {
    if (e.code === "unimplemented") console.warn("BIOsoft: este navegador no soporta el trabajo sin conexión.");
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

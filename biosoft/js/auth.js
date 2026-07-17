/* BIOsoft — Autenticación y manejo de sesión.
   El modo Demo (usuarios sembrados en localStorage) sigue funcionando exactamente
   igual que siempre. Si el usuario/clave no es de la demo y el usuario ingresó un
   correo, se intenta como cuenta real de laboratorio contra Firebase. */
(function (global) {
  "use strict";

  var SESSION_KEY = "biosoft_session_v1";

  var FIREBASE_ERRORS = {
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Usuario o contraseña incorrectos.",
    "auth/user-not-found": "Usuario no encontrado o inactivo.",
    "auth/invalid-email": "El correo ingresado no es válido.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    "auth/network-request-failed": "No hay conexión con el servidor. Verifica tu internet."
  };
  function mapFirebaseError(err) {
    return FIREBASE_ERRORS[err && err.code] || "Usuario no encontrado o inactivo.";
  }

  function buildSession(user, esReal) {
    return {
      userId: user.id, username: user.username, nombre: user.nombre, rol: user.rol, tenantId: user.tenantId,
      secciones: user.secciones || [], fotoUrl: user.fotoUrl || "", iniciadoEn: BIO_STORE.nowISO(), real: !!esReal
    };
  }

  /* Devuelve una Promesa siempre (tanto para demo como para cuentas reales),
     para que el único punto que llama a login() pueda usar await de forma
     consistente sin importar qué camino se tome internamente. */
  function login(username, password) {
    var user = BIO_STORE.findUser(username);
    if (user) {
      if (!user.activo) return Promise.resolve({ ok: false, error: "Usuario no encontrado o inactivo." });
      if (user.password !== password) return Promise.resolve({ ok: false, error: "Contraseña incorrecta." });
      var session = buildSession(user, false);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      BIO_STORE.addAudit(user.tenantId, user.nombre, user.rol, "LOGIN", "sesion", user.id, "Inicio de sesión exitoso.");
      return Promise.resolve({ ok: true, session: session });
    }
    if (username.indexOf("@") === -1) return Promise.resolve({ ok: false, error: "Usuario no encontrado o inactivo." });
    return BIO_STORE.loginReal(username, password).then(function (realUser) {
      var session = buildSession(realUser, true);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      BIO_STORE.addAudit(realUser.tenantId, realUser.nombre, realUser.rol, "LOGIN", "sesion", realUser.id, "Inicio de sesión exitoso.");
      return { ok: true, session: session };
    }).catch(function (err) {
      return { ok: false, error: mapFirebaseError(err) };
    });
  }

  function logout() {
    var s = getSession();
    if (s) BIO_STORE.addAudit(s.tenantId, s.nombre, s.rol, "LOGOUT", "sesion", s.userId, "Cierre de sesión.");
    if (s && s.real) BIO_STORE.logoutReal();
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* Se llama al arrancar la app si ya hay sesión guardada. Para sesiones Demo
     no hace nada (ya están en localStorage). Para sesiones reales, vuelve a
     poblar los datos del laboratorio desde Firestore sin pedir clave de nuevo. */
  function rehydrate() {
    var s = getSession();
    if (!s || !s.real) return Promise.resolve(true);
    return BIO_STORE.restoreRealtime(s.tenantId).then(function () { return true; }).catch(function () {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    });
  }

  function currentTenant() {
    var s = getSession();
    if (!s || !s.tenantId) return null;
    return BIO_STORE.getTenant(s.tenantId);
  }

  function isRole() {
    var s = getSession();
    if (!s) return false;
    for (var i = 0; i < arguments.length; i++) if (arguments[i] === s.rol) return true;
    return false;
  }

  function verificarClaveAdmin(clave) {
    var s = getSession();
    if (!s) return false;
    if (s.rol === "superadmin") return true;
    var tenant = BIO_STORE.getTenant(s.tenantId);
    return !!tenant && tenant.claveAdmin === clave;
  }

  global.BIO_AUTH = {
    login: login,
    logout: logout,
    getSession: getSession,
    rehydrate: rehydrate,
    currentTenant: currentTenant,
    isRole: isRole,
    verificarClaveAdmin: verificarClaveAdmin
  };
})(window);

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
    "auth/network-request-failed": "No hay conexión con el servidor. Verifica tu internet.",
    "auth/missing-email": "Ingresa tu correo electrónico."
  };
  function mapFirebaseError(err) {
    if (err && err.code && FIREBASE_ERRORS[err.code]) return FIREBASE_ERRORS[err.code];
    // Errores propios que lanza loginReal() (ej. "Esta cuenta no tiene un
    // laboratorio asociado." o "No se encontró el usuario del laboratorio.")
    // no traen un código auth/* de Firebase — antes se perdían y siempre se
    // mostraba el mensaje genérico, ocultando la causa real y dificultando
    // el soporte a laboratorios que sí lograron entrar a Firebase Auth
    // (ej. después de restablecer su contraseña) pero cuyo registro en el
    // laboratorio quedó incompleto o desactivado.
    if (err && err.message && !err.code) return err.message;
    return "Usuario no encontrado o inactivo.";
  }

  function buildSession(user, esReal) {
    return {
      userId: user.id, username: user.username, nombre: user.nombre, rol: user.rol, tenantId: user.tenantId,
      secciones: user.secciones || [], fotoUrl: user.fotoUrl || "", iniciadoEn: BIO_STORE.nowISO(), real: !!esReal,
      puedeGestionarRemisiones: !!user.puedeGestionarRemisiones,
      permisosExtra: user.permisosExtra || [],
      convenioId: user.convenioId || ""
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
      if (realUser.tenantId) {
        var tenant = BIO_STORE.getTenant(realUser.tenantId);
        if (tenant && tenant.suspendido) {
          BIO_STORE.logoutReal();
          return { ok: false, error: "El acceso de tu laboratorio está suspendido por pago pendiente. Escríbenos por WhatsApp para reactivarlo." };
        }
      }
      // A diferencia del modo Demo, este chequeo faltaba en el camino real:
      // un usuario desactivado por su administrador (ej. desde "Usuarios del
      // Laboratorio") podía autenticarse contra Firebase Auth igual, ya que
      // ese estado "activo" vive en Firestore, no en Firebase Auth.
      if (realUser.rol !== "superadmin" && realUser.activo === false) {
        BIO_STORE.logoutReal();
        return { ok: false, error: "Tu usuario fue desactivado por el administrador de tu laboratorio." };
      }
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
    var restaurar = s.rol === "superadmin" ? BIO_STORE.restoreSuperadminSession()
      : s.rol === "aliado" ? BIO_STORE.restoreRealtimePortalAliado(s.tenantId, s.convenioId)
      : BIO_STORE.restoreRealtime(s.tenantId);
    return restaurar.then(function () {
      if (s.rol !== "superadmin") {
        var tenant = BIO_STORE.getTenant(s.tenantId);
        if (tenant && tenant.suspendido) {
          BIO_STORE.logoutReal();
          sessionStorage.removeItem(SESSION_KEY);
          return false;
        }
        // La sesión guarda una FOTO de secciones/permisosExtra tomada al
        // iniciar sesión — si un administrador le cambia esos permisos a un
        // usuario que ya tenía la pestaña abierta, sin esto el cambio nunca
        // se reflejaba hasta que esa persona cerrara sesión del todo (un
        // simple refrescar de página no alcanzaba). Aquí se refresca desde
        // su documento real, que restoreRealtime ya acaba de traer.
        var usuarioActual = BIO_STORE.listUsers(s.tenantId).filter(function (u) { return u.id === s.userId; })[0];
        if (usuarioActual) {
          s.secciones = usuarioActual.secciones || [];
          s.permisosExtra = usuarioActual.permisosExtra || [];
          s.puedeGestionarRemisiones = !!usuarioActual.puedeGestionarRemisiones;
          s.rol = usuarioActual.rol || s.rol;
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
        }
      }
      return true;
    }).catch(function () {
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

  /* Permiso adicional (ver catalog.js -> PERMISOS_EXTRA_BACTERIOLOGO), hoy
     solo aplica a bacteriólogos con acceso extra a pantallas que
     normalmente son de Recepción/Administración. */
  function tienePermisoExtra(id) {
    var s = getSession();
    return !!(s && s.permisosExtra && s.permisosExtra.indexOf(id) !== -1);
  }

  /* Envía el correo de restablecimiento de contraseña de Firebase. Por
     seguridad, nunca revela si el correo existe o no en el sistema: un
     "usuario no encontrado" se responde igual que un envío exitoso, para no
     permitir que alguien use este formulario para adivinar qué correos están
     registrados como clientes reales de BIOsoft. */
  function recuperarContrasena(email) {
    if (!email || email.indexOf("@") === -1) {
      return Promise.resolve({ ok: false, error: "Ingresa un correo electrónico válido." });
    }
    if (typeof global.BIO_FB === "undefined" || !global.BIO_FB) {
      return Promise.resolve({ ok: false, error: "No se pudo conectar con el servidor. Verifica tu conexión a internet." });
    }
    return global.BIO_FB.auth.sendPasswordResetEmail(email).then(function () {
      return { ok: true };
    }).catch(function (err) {
      if (err && err.code === "auth/user-not-found") return { ok: true };
      return { ok: false, error: mapFirebaseError(err) };
    });
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
    tienePermisoExtra: tienePermisoExtra,
    verificarClaveAdmin: verificarClaveAdmin,
    recuperarContrasena: recuperarContrasena
  };
})(window);

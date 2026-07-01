/* BIOsoft — Autenticación y manejo de sesión (demo, basada en sessionStorage) */
(function (global) {
  "use strict";

  var SESSION_KEY = "biosoft_session_v1";

  function login(username, password) {
    var user = BIO_STORE.findUser(username);
    if (!user || !user.activo) return { ok: false, error: "Usuario no encontrado o inactivo." };
    if (user.password !== password) return { ok: false, error: "Contraseña incorrecta." };
    var session = { userId: user.id, username: user.username, nombre: user.nombre, rol: user.rol, tenantId: user.tenantId, secciones: user.secciones || [], iniciadoEn: BIO_STORE.nowISO() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    BIO_STORE.addAudit(user.tenantId, user.nombre, user.rol, "LOGIN", "sesion", user.id, "Inicio de sesión exitoso.");
    return { ok: true, session: session };
  }

  function logout() {
    var s = getSession();
    if (s) BIO_STORE.addAudit(s.tenantId, s.nombre, s.rol, "LOGOUT", "sesion", s.userId, "Cierre de sesión.");
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
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
    currentTenant: currentTenant,
    isRole: isRole,
    verificarClaveAdmin: verificarClaveAdmin
  };
})(window);

/* BIOsoft — Capa de datos (localStorage) multi-tenant
   Esta es una capa de datos de DEMOSTRACIÓN pensada para funcionar 100% en el
   navegador (sin servidor). En una implementación de producción esta capa se
   reemplaza por llamadas a una API/backend con base de datos real, cifrado de
   contraseñas (hash), envío real de correos y almacenamiento seguro de archivos. */
(function (global) {
  "use strict";

  var DB_KEY = "biosoft_db_v1";

  /* ---------------------------------------------------------------------
     MODO REAL (Firebase) — laboratorios clientes reales, con datos en
     Firestore accesibles desde cualquier dispositivo. El modo Demo (arriba)
     no cambia en absoluto: sigue siendo 100% localStorage.
     realCache espeja en memoria los datos del laboratorio actual mientras
     dura la sesión; se mantiene sincronizado con Firestore vía onSnapshot. */
  var MODE = "demo"; // "demo" | "real"
  var FB_TENANT_ID = null;
  var realCache = null;
  var realUnsubs = [];
  var onRealtimeChangeCb = null;

  function fbColl(coll) {
    return global.BIO_FB.db.collection("tenants").doc(FB_TENANT_ID).collection(coll);
  }
  function fbWrite(coll, id, data) {
    if (MODE !== "real") return;
    fbColl(coll).doc(id).set(data).catch(function (e) { console.error("BIOsoft Firestore write error (" + coll + "/" + id + "):", e); });
  }
  function fbWriteTenant(tenant) {
    if (MODE !== "real") return;
    global.BIO_FB.db.collection("tenants").doc(tenant.id).set(tenant).catch(function (e) { console.error("BIOsoft Firestore write error (tenant):", e); });
  }

  function onRealtimeChange(cb) { onRealtimeChangeCb = cb; }

  /* Se llama justo después de un login real exitoso. Devuelve una promesa que
     resuelve cuando realCache ya tiene los datos iniciales del laboratorio
     (para que el primer render no encuentre datos vacíos). */
  function initRealtime(tenantId) {
    MODE = "real";
    FB_TENANT_ID = tenantId;
    realCache = emptyDB();
    var db = global.BIO_FB.db;

    function attach(coll, arrKey, isMap) {
      return fbColl(coll).get().then(function (snap) {
        snap.forEach(function (doc) { pushDoc(doc); });
        var unsub = fbColl(coll).onSnapshot(function (snap) {
          snap.docChanges().forEach(function (change) {
            if (change.type === "removed") removeDoc(change.doc.id);
            else pushDoc(change.doc);
          });
          if (onRealtimeChangeCb) onRealtimeChangeCb();
        });
        realUnsubs.push(unsub);
      });
      function pushDoc(doc) {
        var data = doc.data();
        if (isMap) { realCache[arrKey][doc.id] = data; return; }
        var idx = realCache[arrKey].findIndex(function (x) { return x.id === doc.id; });
        if (idx >= 0) realCache[arrKey][idx] = data; else realCache[arrKey].push(data);
      }
      function removeDoc(id) {
        if (isMap) { delete realCache[arrKey][id]; return; }
        realCache[arrKey] = realCache[arrKey].filter(function (x) { return x.id !== id; });
      }
    }

    var tenantPromise = db.collection("tenants").doc(tenantId).get().then(function (doc) {
      if (doc.exists) realCache.tenants[tenantId] = doc.data();
      var unsub = db.collection("tenants").doc(tenantId).onSnapshot(function (doc) {
        if (doc.exists) realCache.tenants[tenantId] = doc.data();
        if (onRealtimeChangeCb) onRealtimeChangeCb();
      });
      realUnsubs.push(unsub);
    });

    return Promise.all([
      tenantPromise,
      attach("users", "users", false),
      attach("patients", "patients", false),
      attach("orders", "orders", false),
      attach("auditLog", "auditLog", false),
      attach("qcControles", "qcControles", false),
      attach("qcLecturas", "qcLecturas", false),
      attach("preciosExamenes", "preciosExamenes", false),
      attach("cotizaciones", "cotizaciones", false)
    ]).then(function () { return realCache; });
  }

  function stopRealtime() {
    realUnsubs.forEach(function (u) { try { u(); } catch (e) {} });
    realUnsubs = [];
    MODE = "demo";
    FB_TENANT_ID = null;
    realCache = null;
  }

  /* Crea un laboratorio real nuevo (o un usuario nuevo dentro de uno ya
     existente) con su propia cuenta de Firebase Authentication. Usa una
     instancia secundaria de Firebase para no afectar la sesión de quien
     está creando la cuenta (superadmin o el admin del laboratorio). */
  function provisionRealAccount(opts) {
    var secondary = global.BIO_FB.secondaryAuth();
    return secondary.auth.createUserWithEmailAndPassword(opts.userData.username, opts.userData.password)
      .then(function (cred) {
        var newUid = cred.user.uid;
        var tenantId = opts.tenantId;
        var tenant = null;
        if (!tenantId) {
          tenantId = uid("lab");
          tenant = Object.assign({
            id: tenantId, nivel: 1, colorPrimario: "#f97316", colorSecundario: "#2e1065", logoDataUrl: "",
            claveAdmin: "ADMIN" + Math.floor(1000 + Math.random() * 9000), creadoEn: nowISO()
          }, opts.tenantData, { id: tenantId });
        }
        var userObj = Object.assign({ activo: true, secciones: [], creadoEn: nowISO() }, opts.userData, { id: newUid, tenantId: tenantId });
        delete userObj.password;
        return secondary.db.collection("userProfiles").doc(newUid).set({ tenantId: tenantId, rol: userObj.rol })
          .then(function () { if (tenant) return secondary.db.collection("tenants").doc(tenantId).set(tenant); })
          .then(function () { return secondary.db.collection("tenants").doc(tenantId).collection("users").doc(newUid).set(userObj); })
          .then(function () {
            var detalle = tenant ? "Se creó el laboratorio cliente " + tenant.nombre + "." : "Se creó el usuario " + userObj.nombre + ".";
            var entry = { id: uid("log"), tenantId: tenantId, fecha: nowISO(), usuario: "Soporte BIOsoft", rol: "superadmin", accion: tenant ? "CREATE_TENANT" : "CREATE_USER", entidad: tenant ? "laboratorio" : "usuario", entidadId: tenant ? tenantId : newUid, detalle: detalle };
            return secondary.db.collection("tenants").doc(tenantId).collection("auditLog").doc(entry.id).set(entry);
          })
          .then(function () {
            secondary.cleanup();
            return { tenant: tenant, user: userObj, tenantId: tenantId };
          });
      })
      .catch(function (err) { secondary.cleanup(); throw err; });
  }

  /* Autentica un correo/contraseña de laboratorio real y ubica su perfil
     (a qué tenant pertenece). No toca el login Demo en absoluto. */
  function loginReal(email, password) {
    return global.BIO_FB.auth.signInWithEmailAndPassword(email, password).then(function (cred) {
      var uidAuth = cred.user.uid;
      return global.BIO_FB.db.collection("userProfiles").doc(uidAuth).get().then(function (doc) {
        if (!doc.exists) throw new Error("Esta cuenta no tiene un laboratorio asociado.");
        var perfil = doc.data();
        if (perfil.rol === "superadmin") {
          MODE = "real"; // habilita fbWrite/onSnapshot para el CRM sin tenant asociado
          return { id: uidAuth, username: email, nombre: perfil.nombre || "Soporte BIOsoft", rol: "superadmin", tenantId: null, secciones: [] };
        }
        return initRealtime(perfil.tenantId).then(function () {
          var user = realCache.users.filter(function (u) { return u.id === uidAuth; })[0];
          if (!user) throw new Error("No se encontró el usuario del laboratorio.");
          return user;
        });
      });
    });
  }

  function logoutReal() {
    if (MODE === "real") { global.BIO_FB.auth.signOut().catch(function () {}); }
    stopRealtime();
  }

  // -----------------------------------------------------------------------
  // CRM (leads y clientes de BIOsoft) — colección Firestore independiente,
  // solo accesible por el superadmin real. No pasa por el "espejo" de
  // tenant: cada función habla directo con Firestore y devuelve Promesas.
  // -----------------------------------------------------------------------
  function crmColl() { return global.BIO_FB.db.collection("crmClientes"); }

  function crmList() {
    return crmColl().get().then(function (snap) {
      var out = [];
      snap.forEach(function (doc) { out.push(doc.data()); });
      out.sort(function (a, b) { return (b.creadoEn || "").localeCompare(a.creadoEn || ""); });
      return out;
    });
  }
  function crmWatch(onChange) {
    return crmColl().onSnapshot(function () { onChange(); }, function (err) { console.error("BIOsoft CRM listener error:", err); });
  }
  function crmCreate(data) {
    var id = uid("crm");
    var doc = Object.assign({ estado: "nuevo", creadoEn: nowISO() }, data, { id: id });
    return crmColl().doc(id).set(doc).then(function () { return doc; });
  }
  function crmUpdate(id, patch) {
    return crmColl().doc(id).update(patch);
  }

  // -----------------------------------------------------------------------
  // Plantillas de mensajes de WhatsApp reutilizables (solo superadmin).
  // -----------------------------------------------------------------------
  function plantillasColl() { return global.BIO_FB.db.collection("crmPlantillas"); }

  function plantillasList() {
    return plantillasColl().get().then(function (snap) {
      var out = [];
      snap.forEach(function (doc) { out.push(doc.data()); });
      out.sort(function (a, b) { return (a.creadoEn || "").localeCompare(b.creadoEn || ""); });
      return out;
    });
  }
  function plantillasWatch(onChange) {
    return plantillasColl().onSnapshot(function () { onChange(); }, function (err) { console.error("BIOsoft plantillas listener error:", err); });
  }
  function plantillasCreate(data) {
    var id = uid("tpl");
    var doc = Object.assign({ creadoEn: nowISO() }, data, { id: id });
    return plantillasColl().doc(id).set(doc).then(function () { return doc; });
  }
  function plantillasUpdate(id, patch) {
    return plantillasColl().doc(id).update(patch);
  }
  function plantillasDelete(id) {
    return plantillasColl().doc(id).delete();
  }

  /* Al recargar la página, sessionStorage conserva la sesión pero realCache
     se pierde (es memoria, no disco). Espera a que Firebase confirme que la
     sesión de Auth sigue viva y vuelve a poblar realCache sin pedir clave. */
  function waitForAuthReady() {
    return new Promise(function (resolve) {
      var settled = false;
      var unsub = global.BIO_FB.auth.onAuthStateChanged(function (u) {
        if (settled) return;
        settled = true;
        resolve(u);
        if (typeof unsub === "function") unsub();
      });
    });
  }
  function restoreRealtime(tenantId) {
    return waitForAuthReady().then(function (user) {
      if (!user) throw new Error("La sesión de Firebase expiró.");
      return initRealtime(tenantId);
    });
  }
  /* Igual que restoreRealtime, pero para el superadmin (que no tiene tenant):
     solo confirma que Firebase Auth sigue vivo, sin poblar ningún espejo. */
  function restoreSuperadminSession() {
    return waitForAuthReady().then(function (user) {
      if (!user) throw new Error("La sesión de Firebase expiró.");
      MODE = "real";
      return true;
    });
  }

  function uid(prefix) {
    return (prefix ? prefix + "-" : "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function firmaDemo(texto) {
    return "data:image/svg+xml;utf8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70">' +
      '<text x="8" y="46" font-family="\'Segoe Script\', \'Brush Script MT\', cursive" font-size="30" fill="#1e3a8a" transform="rotate(-4 10 45)">' + texto + "</text></svg>"
    );
  }

  function loadDemoDB() {
    var raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function loadDB() {
    // El superadmin real no tiene tenant propio (realCache queda null): se le
    // devuelve una base vacía en vez de null para que ninguna vista truene.
    if (MODE === "real") return realCache || emptyDB();
    return loadDemoDB();
  }

  function saveDB(db) {
    if (MODE === "real") { realCache = db; return; }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function emptyDB() {
    return { tenants: {}, users: [], patients: [], orders: [], auditLog: [], qcControles: [], qcLecturas: [], preciosExamenes: [], cotizaciones: [] };
  }

  // ---------------------------------------------------------------------
  // SEED DE DATOS DE DEMOSTRACIÓN
  // ---------------------------------------------------------------------
  function seedIfEmpty() {
    var db = loadDB();
    if (db) return db;
    db = emptyDB();

    db.tenants["demo"] = {
      id: "demo",
      nombre: "Laboratorio Clínico DEMO BIOsoft",
      nit: "900123456-7",
      pais: "CO",
      direccion: "Cra 45 # 12 - 34, Bogotá D.C.",
      telefonos: "(601) 555 0101 · 300 555 0101",
      email: "contacto@labdemo.com",
      sitioWeb: "www.labdemo.com",
      nivel: 2,
      resolucionHabilitacion: "Resolución 000000 de 2024 - Secretaría de Salud",
      codigoREPS: "1100100000-01",
      bacteriologoResponsable: { nombre: "Laura Gómez Pérez", registro: "TP-BACT 12345 CTBBTQ" },
      logoDataUrl: "assets/logo-biosoft.png",
      colorPrimario: "#f97316",
      colorSecundario: "#2e1065",
      claveAdmin: "ADMIN2026",
      creadoEn: nowISO()
    };

    var uAdmin = { id: uid("usr"), tenantId: "demo", username: "admin.demo", password: "Demo2026*", nombre: "Carolina Restrepo (Administradora)", rol: "admin", secciones: [], fotoUrl: "assets/avatars/admin-mujer.svg", activo: true, creadoEn: nowISO() };
    var uLaura = { id: uid("usr"), tenantId: "demo", username: "laura.gomez", password: "Bacterio2026*", nombre: "Laura Gómez Pérez", rol: "bacteriologo", secciones: ["hematologia", "coagulacion", "banco", "quimica", "uroanalisis", "coprologia", "pruebasrapidas", "gases"], registroProfesional: "TP-BACT 12345 CTBBTQ", firmaDataUrl: firmaDemo("Laura Gómez"), fotoUrl: "assets/avatars/bacteriologa.svg", activo: true, creadoEn: nowISO() };
    var uAndres = { id: uid("usr"), tenantId: "demo", username: "andres.rios", password: "Bacterio2026*", nombre: "Andrés Ríos Molano", rol: "bacteriologo", secciones: ["inmunologia", "microbiologia", "hormonas", "marcadores", "especiales"], registroProfesional: "TP-BACT 67890 CTBBTQ", firmaDataUrl: firmaDemo("A. Ríos M."), fotoUrl: "assets/avatars/bacteriologo.svg", activo: true, creadoEn: nowISO() };
    db.users.push(
      { id: uid("usr"), tenantId: null, username: "biosoft", password: "BIOsoft#2026", nombre: "Soporte BIOsoft", rol: "superadmin", secciones: [], activo: true, creadoEn: nowISO() },
      uAdmin, uLaura, uAndres,
      { id: uid("usr"), tenantId: "demo", username: "recepcion.demo", password: "Recepcion2026*", nombre: "Juliana Torres (Recepción)", rol: "recepcion", secciones: [], fotoUrl: "assets/avatars/recepcion.svg", activo: true, creadoEn: nowISO() }
    );

    var p1 = { id: uid("pac"), tenantId: "demo", tipoDocumento: "CC", numeroDocumento: "1010123456", primerNombre: "María", segundoNombre: "Fernanda", primerApellido: "Rojas", segundoApellido: "Cárdenas", fechaNacimiento: "1990-04-12", sexo: "Femenino", pais: "CO", ciudad: "Bogotá D.C.", direccion: "Calle 80 # 20-15", telefono: "", celular: "3011234567", email: "maria.rojas@example.com", tipoAfiliacion: "Contributivo", eps: "Nueva EPS", medicoRemitente: "Dr. Jorge Salamanca", procedencia: "Ambulatorio", ocupacion: "Contadora", observaciones: "", creadoEn: nowISO(), creadoPor: "recepcion.demo" };
    var p2 = { id: uid("pac"), tenantId: "demo", tipoDocumento: "CC", numeroDocumento: "79345678", primerNombre: "Carlos", segundoNombre: "", primerApellido: "Martínez", segundoApellido: "López", fechaNacimiento: "1975-11-02", sexo: "Masculino", pais: "CO", ciudad: "Bogotá D.C.", direccion: "Av. Suba # 100-20", telefono: "", celular: "3157654321", email: "carlos.martinez@example.com", tipoAfiliacion: "Medicina Prepagada", eps: "Sanitas", medicoRemitente: "Dra. Ana Beltrán", procedencia: "Consulta Externa", ocupacion: "Ingeniero", observaciones: "", creadoEn: nowISO(), creadoPor: "recepcion.demo" };
    var p3 = { id: uid("pac"), tenantId: "demo", tipoDocumento: "TI", numeroDocumento: "1102345678", primerNombre: "Valentina", segundoNombre: "", primerApellido: "Pérez", segundoApellido: "Gómez", fechaNacimiento: "2010-06-20", sexo: "Femenino", pais: "CO", ciudad: "Chía", direccion: "Cra 10 # 5-40", telefono: "6018765432", celular: "3201122334", email: "", tipoAfiliacion: "Subsidiado", eps: "Coosalud", medicoRemitente: "Dr. Fabián Niño", procedencia: "Urgencias", ocupacion: "Estudiante", observaciones: "", creadoEn: nowISO(), creadoPor: "recepcion.demo" };
    var p4 = { id: uid("pac"), tenantId: "demo", tipoDocumento: "VCI", numeroDocumento: "V-18234567", primerNombre: "José", segundoNombre: "Luis", primerApellido: "Fernández", segundoApellido: "", fechaNacimiento: "1988-01-15", sexo: "Masculino", pais: "VE", ciudad: "Bogotá D.C.", direccion: "Calle 63 # 9-30", telefono: "", celular: "3187778899", email: "jose.fernandez@example.com", tipoAfiliacion: "Particular", eps: "Particular", medicoRemitente: "Dra. Ana Beltrán", procedencia: "Ambulatorio", ocupacion: "Comerciante", observaciones: "Paciente migrante, sin afiliación aún", creadoEn: nowISO(), creadoPor: "recepcion.demo" };
    db.patients.push(p1, p2, p3, p4);

    function item(examId, estado, valores, validador, fechaValidacion) {
      return {
        examId: examId, seccion: BIO_CATALOG.examenPorId(examId).seccion, estado: estado, valores: valores || [], observaciones: "",
        validadoPor: validador ? validador.nombre : "", validadoPorUserId: validador ? validador.id : "", fechaValidacion: fechaValidacion || "",
        ingresadoPor: "", fechaIngreso: "", version: 1, correcciones: [],
        remitido: false, laboratorioRemision: "", pdfRemitidoDataUrl: "", pdfRemitidoNombre: ""
      };
    }

    var today = new Date();
    var hoyStr = today.toISOString().slice(0, 10);

    db.orders.push(
      {
        id: uid("ord"), tenantId: "demo", numeroOrden: "20260001", patientId: p1.id, fechaOrden: hoyStr + "T08:15:00",
        prioridad: "Rutina", procedencia: "Ambulatorio", medicoRemitente: "Dr. Jorge Salamanca", diagnostico: "Control anual",
        examenes: [
          item("HEM-001", "validado", [
            { codigo: "HB", valor: "13.2" }, { codigo: "HTO", valor: "40" }, { codigo: "LEU", valor: "6.8" },
            { codigo: "NEUT", valor: "55" }, { codigo: "LINF", valor: "35" }, { codigo: "MONO", valor: "5" },
            { codigo: "EOS", valor: "3" }, { codigo: "BASO", valor: "1" }, { codigo: "PLT", valor: "260" },
            { codigo: "VCM", valor: "88" }, { codigo: "HCM", valor: "29" }, { codigo: "CHCM", valor: "34" }, { codigo: "RDW", valor: "12.8" }
          ], uLaura, nowISO()),
          item("QUI-001", "validado", [{ codigo: "GLU", valor: "128" }], uLaura, nowISO()),
          item("QUI-008", "validado", [{ codigo: "CREA", valor: "0.9" }], uLaura, nowISO())
        ],
        estadoGeneral: "validado", enviado: true, fechaEnvio: nowISO(), creadoEn: nowISO(), creadoPor: "recepcion.demo"
      },
      {
        id: uid("ord"), tenantId: "demo", numeroOrden: "20260002", patientId: p2.id, fechaOrden: hoyStr + "T09:00:00",
        prioridad: "Rutina", procedencia: "Consulta Externa", medicoRemitente: "Dra. Ana Beltrán", diagnostico: "Chequeo lipídico",
        examenes: [
          item("QUI-004", "validado", [{ codigo: "COLT", valor: "215" }], uLaura, nowISO()),
          item("QUI-005", "validado", [{ codigo: "HDL", valor: "38" }], uLaura, nowISO()),
          item("QUI-006", "validado", [{ codigo: "LDL", valor: "142" }], uLaura, nowISO()),
          item("QUI-007", "validado", [{ codigo: "TGD", valor: "190" }], uLaura, nowISO()),
          item("URO-001", "pendiente", [])
        ],
        estadoGeneral: "parcial", enviado: false, fechaEnvio: "", creadoEn: nowISO(), creadoPor: "recepcion.demo"
      },
      {
        id: uid("ord"), tenantId: "demo", numeroOrden: "20260003", patientId: p3.id, fechaOrden: hoyStr + "T10:30:00",
        prioridad: "Urgente", procedencia: "Urgencias", medicoRemitente: "Dr. Fabián Niño", diagnostico: "Síndrome febril + disuria",
        examenes: [
          item("MIC-001", "pendiente", []),
          item("HEM-001", "pendiente", [])
        ],
        estadoGeneral: "pendiente", enviado: false, fechaEnvio: "", creadoEn: nowISO(), creadoPor: "recepcion.demo"
      },
      {
        id: uid("ord"), tenantId: "demo", numeroOrden: "20260004", patientId: p4.id, fechaOrden: hoyStr + "T11:45:00",
        prioridad: "Rutina", procedencia: "Ambulatorio", medicoRemitente: "Dra. Ana Beltrán", diagnostico: "Evaluación tiroidea y prostática",
        examenes: [
          item("HOR-001", "validado", [{ codigo: "TSH", valor: "2.1" }], uAndres, nowISO()),
          item("HOR-002", "validado", [{ codigo: "T4L", valor: "1.2" }], uAndres, nowISO()),
          item("MAR-001", "preliminar", [{ codigo: "PSA", valor: "1.8" }])
        ],
        estadoGeneral: "parcial", enviado: false, fechaEnvio: "", creadoEn: nowISO(), creadoPor: "recepcion.demo"
      }
    );

    db.auditLog.push({ id: uid("log"), tenantId: "demo", fecha: nowISO(), usuario: "Sistema", rol: "sistema", accion: "SEED_DEMO", entidad: "sistema", entidadId: "demo", detalle: "Datos de demostración inicializados." });

    saveDB(db);
    return db;
  }

  // ---------------------------------------------------------------------
  // AUDITORÍA
  // ---------------------------------------------------------------------
  function addAudit(tenantId, usuario, rol, accion, entidad, entidadId, detalle, extra) {
    var entry = { id: uid("log"), tenantId: tenantId, fecha: nowISO(), usuario: usuario, rol: rol, accion: accion, entidad: entidad, entidadId: entidadId, detalle: detalle };
    if (extra) entry.extra = extra;
    // El superadmin no tiene laboratorio (tenantId null): no hay dónde espejar el log localmente.
    if (!tenantId) return entry;
    var db = loadDB();
    db.auditLog.unshift(entry);
    saveDB(db);
    fbWrite("auditLog", entry.id, entry);
    return entry;
  }

  function listAudit(tenantId) {
    var db = loadDB();
    return db.auditLog.filter(function (a) { return tenantId ? a.tenantId === tenantId : true; });
  }

  // ---------------------------------------------------------------------
  // TENANTS (LABORATORIOS CLIENTE)
  // ---------------------------------------------------------------------
  function listTenants() {
    var db = loadDB();
    return Object.keys(db.tenants).map(function (k) { return db.tenants[k]; });
  }
  function getTenant(id) {
    var db = loadDB();
    return db.tenants[id];
  }
  function saveTenant(tenant) {
    var db = loadDB();
    db.tenants[tenant.id] = tenant;
    saveDB(db);
    fbWriteTenant(tenant);
  }
  function createTenant(data) {
    var db = loadDB();
    var id = uid("lab");
    var tenant = Object.assign({
      id: id, nivel: 1, colorPrimario: "#f97316", colorSecundario: "#2e1065", logoDataUrl: "",
      claveAdmin: "ADMIN" + Math.floor(1000 + Math.random() * 9000), creadoEn: nowISO()
    }, data, { id: id });
    db.tenants[id] = tenant;
    saveDB(db);
    return tenant;
  }

  // ---------------------------------------------------------------------
  // USUARIOS
  // ---------------------------------------------------------------------
  function listUsers(tenantId) {
    var db = loadDB();
    return db.users.filter(function (u) { return tenantId ? u.tenantId === tenantId : true; });
  }
  function findUser(username) {
    // Siempre revisa la tabla Demo (localStorage), sin importar el MODE actual:
    // se usa para decidir si un intento de login es un usuario demo, incluso
    // si ya hay (o hubo) una sesión real activa en esta misma pestaña.
    var db = loadDemoDB();
    if (!db) return null;
    return db.users.filter(function (u) { return u.username.toLowerCase() === String(username).toLowerCase(); })[0];
  }
  function createUser(data) {
    var db = loadDB();
    var user = Object.assign({ id: uid("usr"), activo: true, secciones: [], creadoEn: nowISO() }, data);
    db.users.push(user);
    saveDB(db);
    fbWrite("users", user.id, user);
    return user;
  }
  function updateUser(id, patch) {
    var db = loadDB();
    var u = db.users.filter(function (x) { return x.id === id; })[0];
    if (!u) return null;
    Object.assign(u, patch);
    saveDB(db);
    fbWrite("users", u.id, u);
    return u;
  }

  // ---------------------------------------------------------------------
  // PACIENTES
  // ---------------------------------------------------------------------
  function listPatients(tenantId) {
    var db = loadDB();
    return db.patients.filter(function (p) { return p.tenantId === tenantId; }).sort(function (a, b) { return b.creadoEn.localeCompare(a.creadoEn); });
  }
  function getPatient(id) {
    var db = loadDB();
    return db.patients.filter(function (p) { return p.id === id; })[0];
  }
  function createPatient(data) {
    var db = loadDB();
    var p = Object.assign({ id: uid("pac"), creadoEn: nowISO() }, data);
    db.patients.push(p);
    saveDB(db);
    fbWrite("patients", p.id, p);
    return p;
  }
  function updatePatient(id, patch) {
    var db = loadDB();
    var p = db.patients.filter(function (x) { return x.id === id; })[0];
    if (!p) return null;
    Object.assign(p, patch);
    saveDB(db);
    fbWrite("patients", p.id, p);
    return p;
  }

  // ---------------------------------------------------------------------
  // ÓRDENES / RESULTADOS
  // ---------------------------------------------------------------------
  function listOrders(tenantId) {
    var db = loadDB();
    return db.orders.filter(function (o) { return o.tenantId === tenantId; }).sort(function (a, b) { return b.fechaOrden.localeCompare(a.fechaOrden); });
  }
  function getOrder(id) {
    var db = loadDB();
    return db.orders.filter(function (o) { return o.id === id; })[0];
  }
  function nextOrderNumber(tenantId) {
    var db = loadDB();
    var orders = db.orders.filter(function (o) { return o.tenantId === tenantId; });
    var year = new Date().getFullYear();
    var max = 0;
    orders.forEach(function (o) {
      var n = parseInt(o.numeroOrden, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    if (max === 0) max = year * 10000;
    return String(max + 1);
  }
  function createOrder(data) {
    var db = loadDB();
    var o = Object.assign({ id: uid("ord"), creadoEn: nowISO(), enviado: false, fechaEnvio: "" }, data);
    db.orders.push(o);
    saveDB(db);
    fbWrite("orders", o.id, o);
    return o;
  }
  function saveOrder(order) {
    var db = loadDB();
    var idx = db.orders.findIndex(function (o) { return o.id === order.id; });
    if (idx >= 0) db.orders[idx] = order; else db.orders.push(order);
    saveDB(db);
    fbWrite("orders", order.id, order);
  }

  function recalcEstadoGeneral(order) {
    var estados = order.examenes.map(function (e) { return e.estado; });
    var terminado = function (e) { return e === "validado" || e === "remitido"; };
    if (estados.every(terminado)) order.estadoGeneral = "validado";
    else if (estados.every(function (e) { return e === "pendiente"; })) order.estadoGeneral = "pendiente";
    else order.estadoGeneral = "parcial";
    return order.estadoGeneral;
  }

  // ---------------------------------------------------------------------
  // CONTROL DE CALIDAD (Westgard) — controles por lote/nivel y sus lecturas
  // diarias, por laboratorio (tenant).
  // ---------------------------------------------------------------------
  function listQCControles(tenantId) {
    var db = loadDB();
    return db.qcControles.filter(function (c) { return c.tenantId === tenantId; }).sort(function (a, b) { return (a.seccion + a.analitoNombre).localeCompare(b.seccion + b.analitoNombre); });
  }
  function getQCControl(id) {
    var db = loadDB();
    return db.qcControles.filter(function (c) { return c.id === id; })[0];
  }
  function createQCControl(data) {
    var db = loadDB();
    var c = Object.assign({ id: uid("qcc"), activo: true, creadoEn: nowISO() }, data);
    db.qcControles.push(c);
    saveDB(db);
    fbWrite("qcControles", c.id, c);
    return c;
  }
  function updateQCControl(id, patch) {
    var db = loadDB();
    var c = db.qcControles.filter(function (x) { return x.id === id; })[0];
    if (!c) return null;
    Object.assign(c, patch);
    saveDB(db);
    fbWrite("qcControles", c.id, c);
    return c;
  }
  function listQCLecturas(controlId) {
    var db = loadDB();
    return db.qcLecturas.filter(function (l) { return l.controlId === controlId; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }
  function createQCLectura(data) {
    var db = loadDB();
    var l = Object.assign({ id: uid("qcl"), creadoEn: nowISO() }, data);
    db.qcLecturas.push(l);
    saveDB(db);
    fbWrite("qcLecturas", l.id, l);
    return l;
  }

  // ---------------------------------------------------------------------
  // COTIZADOR DE EXÁMENES — lista de precios por examen y cotizaciones
  // generadas, por laboratorio (tenant).
  // ---------------------------------------------------------------------
  function listPrecios(tenantId) {
    var db = loadDB();
    return db.preciosExamenes.filter(function (p) { return p.tenantId === tenantId; });
  }
  function setPrecio(tenantId, examId, precio) {
    var db = loadDB();
    var reg = db.preciosExamenes.filter(function (p) { return p.tenantId === tenantId && p.examId === examId; })[0];
    if (reg) { reg.precio = precio; reg.actualizadoEn = nowISO(); }
    else { reg = { id: uid("prc"), tenantId: tenantId, examId: examId, precio: precio, actualizadoEn: nowISO() }; db.preciosExamenes.push(reg); }
    saveDB(db);
    fbWrite("preciosExamenes", reg.id, reg);
    return reg;
  }
  function bulkSetPrecios(tenantId, pares) {
    // pares: [{ examId, precio }]
    return pares.map(function (par) { return setPrecio(tenantId, par.examId, par.precio); });
  }
  function listCotizaciones(tenantId) {
    var db = loadDB();
    return db.cotizaciones.filter(function (c) { return c.tenantId === tenantId; }).sort(function (a, b) { return b.creadoEn.localeCompare(a.creadoEn); });
  }
  function createCotizacion(data) {
    var db = loadDB();
    var c = Object.assign({ id: uid("cot"), creadoEn: nowISO() }, data);
    db.cotizaciones.push(c);
    saveDB(db);
    fbWrite("cotizaciones", c.id, c);
    return c;
  }

  global.BIO_STORE = {
    seedIfEmpty: seedIfEmpty,
    loadDB: loadDB,
    saveDB: saveDB,
    uid: uid,
    nowISO: nowISO,
    addAudit: addAudit,
    listAudit: listAudit,
    listTenants: listTenants,
    getTenant: getTenant,
    saveTenant: saveTenant,
    createTenant: createTenant,
    listUsers: listUsers,
    findUser: findUser,
    createUser: createUser,
    updateUser: updateUser,
    listPatients: listPatients,
    getPatient: getPatient,
    createPatient: createPatient,
    updatePatient: updatePatient,
    listOrders: listOrders,
    getOrder: getOrder,
    nextOrderNumber: nextOrderNumber,
    createOrder: createOrder,
    saveOrder: saveOrder,
    recalcEstadoGeneral: recalcEstadoGeneral,
    isRealMode: function () { return MODE === "real"; },
    initRealtime: initRealtime,
    stopRealtime: stopRealtime,
    onRealtimeChange: onRealtimeChange,
    provisionRealAccount: provisionRealAccount,
    loginReal: loginReal,
    logoutReal: logoutReal,
    restoreRealtime: restoreRealtime,
    restoreSuperadminSession: restoreSuperadminSession,
    crm: { list: crmList, watch: crmWatch, create: crmCreate, update: crmUpdate },
    plantillas: { list: plantillasList, watch: plantillasWatch, create: plantillasCreate, update: plantillasUpdate, remove: plantillasDelete },
    qc: {
      listControles: listQCControles, getControl: getQCControl, createControl: createQCControl, updateControl: updateQCControl,
      listLecturas: listQCLecturas, createLectura: createQCLectura
    },
    cotizador: {
      listPrecios: listPrecios, setPrecio: setPrecio, bulkSetPrecios: bulkSetPrecios,
      listCotizaciones: listCotizaciones, createCotizacion: createCotizacion
    }
  };
})(window);

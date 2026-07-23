/* BIOsoft — Motor de Remarketing Inteligente.
   Reglas de recomendación clínica (examen + edad + género + periodicidad) que
   se cruzan contra el historial real de cada paciente para detectar a quién
   contactar hoy: por control periódico vencido o porque nunca se ha hecho un
   examen recomendado para su perfil. Es un motor experto basado en reglas
   (mismo enfoque que el Control de Calidad), no un modelo generativo. */
(function (global) {
  "use strict";

  var DEFAULT_REGLAS = [
    {
      id: "recall-hemograma", examId: "HEM-001", nombre: "Cuadro Hemático (Chequeo General)",
      generoObjetivo: "Todos", edadMin: 18, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 En {lab} recomendamos repetir tu Cuadro Hemático cada año como parte de tu chequeo general. Ya pasó un año desde tu último control. ¿Agendamos tu cita?"
    },
    {
      id: "recall-glucosa", examId: "QUI-001", nombre: "Glucosa Basal (Control Metabólico)",
      generoObjetivo: "Todos", edadMin: 40, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 Después de los 40 años se recomienda revisar tu glucosa una vez al año. En {lab} ya te podemos hacer ese control. ¿Te agendamos?"
    },
    {
      id: "recall-lipidico", examId: "QUI-004", nombre: "Perfil Lipídico (Colesterol)",
      generoObjetivo: "Todos", edadMin: 40, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 Ya se cumplió un año desde tu último Perfil Lipídico (colesterol). En {lab} te ayudamos a mantener controlado tu corazón. ¿Programamos tu examen?"
    },
    {
      id: "recall-hba1c", examId: "QUI-003", nombre: "Hemoglobina Glicosilada (Control de Diabetes)",
      generoObjetivo: "Todos", edadMin: 45, edadMax: null, intervaloMeses: 6, activa: true,
      mensaje: "Hola {nombre} 👋 Para un buen control de diabetes se recomienda repetir la Hemoglobina Glicosilada cada 6 meses. Ya es momento de tu control en {lab}. ¿Te agendamos?"
    },
    {
      id: "recall-orina", examId: "URO-001", nombre: "Parcial de Orina (Chequeo General)",
      generoObjetivo: "Todos", edadMin: 18, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 Ya pasó un año desde tu último Parcial de Orina. En {lab} podemos hacerte ese control cuando quieras. ¿Agendamos tu cita?"
    },
    {
      id: "recall-psa", examId: "MAR-001", nombre: "Antígeno Prostático (PSA)",
      generoObjetivo: "Masculino", edadMin: 45, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 A partir de los 45 años se recomienda controlar el Antígeno Prostático (PSA) una vez al año. En {lab} te lo podemos realizar. ¿Programamos tu cita?"
    },
    {
      id: "recall-tsh", examId: "HOR-001", nombre: "Perfil Tiroideo (TSH)",
      generoObjetivo: "Femenino", edadMin: 30, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 Se recomienda revisar tu tiroides (TSH) una vez al año. En {lab} ya te podemos hacer ese control. ¿Te agendamos?"
    },
    {
      id: "recall-coprologico", examId: "COP-001", nombre: "Coprológico y Parasitología",
      generoObjetivo: "Todos", edadMin: 0, edadMax: null, intervaloMeses: 12, activa: true,
      mensaje: "Hola {nombre} 👋 Se recomienda repetir el Coprológico y Parasitológico una vez al año, sobre todo en niños. En {lab} lo podemos programar cuando gustes. ¿Agendamos?"
    }
  ];

  function calcEdadNum(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    var nac = new Date(fechaNacimiento + "T00:00:00");
    if (isNaN(nac.getTime())) return null;
    var hoy = new Date();
    var years = hoy.getFullYear() - nac.getFullYear();
    var m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) years--;
    return years;
  }

  function calcularRemarketing(opts) {
    var patients = opts.patients || [];
    var orders = opts.orders || [];
    var reglas = (opts.reglas || []).filter(function (r) { return r.activa !== false; });
    var contactos = opts.contactos || [];
    var hoy = opts.hoy ? new Date(opts.hoy) : new Date();
    var DIAS_SILENCIO = 20;

    var ordersPorPaciente = {};
    orders.forEach(function (o) {
      (ordersPorPaciente[o.patientId] = ordersPorPaciente[o.patientId] || []).push(o);
    });

    var resultados = [];
    reglas.forEach(function (regla) {
      patients.forEach(function (pac) {
        var edad = calcEdadNum(pac.fechaNacimiento);
        if (edad === null) return;
        if (regla.generoObjetivo !== "Todos" && pac.sexo !== regla.generoObjetivo) return;
        if (regla.edadMin != null && edad < regla.edadMin) return;
        if (regla.edadMax != null && edad > regla.edadMax) return;
        if (!pac.celular && !pac.email) return;

        var ultimaFecha = null;
        (ordersPorPaciente[pac.id] || []).forEach(function (o) {
          (o.examenes || []).forEach(function (it) {
            if (it.examId !== regla.examId) return;
            if (it.estado !== "validado" && it.estado !== "preliminar") return;
            var f = it.fechaValidacion || o.fechaOrden;
            if (f && (!ultimaFecha || f > ultimaFecha)) ultimaFecha = f;
          });
        });

        var nunca = ultimaFecha === null;
        var diasTranscurridos = nunca ? null : Math.floor((hoy - new Date(ultimaFecha)) / 86400000);
        var diasIntervalo = regla.intervaloMeses * 30;
        var vencido = nunca || diasTranscurridos >= diasIntervalo;
        if (!vencido) return;

        var yaContactado = contactos.some(function (c) {
          return c.patientId === pac.id && c.reglaId === regla.id &&
            (hoy - new Date(c.fecha)) / 86400000 < DIAS_SILENCIO;
        });
        if (yaContactado) return;

        resultados.push({
          patient: pac, regla: regla, ultimaFecha: ultimaFecha, nunca: nunca,
          diasVencido: nunca ? null : (diasTranscurridos - diasIntervalo)
        });
      });
    });

    resultados.sort(function (a, b) {
      var da = a.nunca ? 999999 : a.diasVencido;
      var db = b.nunca ? 999999 : b.diasVencido;
      return db - da;
    });
    return resultados;
  }

  function primerNombre(pac) {
    return pac.primerNombre || "";
  }

  function mensajeWhatsapp(item, tenant) {
    var plantilla = item.regla.mensaje || "Hola {nombre} 👋 Te recordamos que ya es momento de repetir tu examen de {examen} en {lab}. ¿Te agendamos?";
    return plantilla
      .replace(/\{nombre\}/g, primerNombre(item.patient))
      .replace(/\{examen\}/g, item.regla.nombre)
      .replace(/\{lab\}/g, (tenant && tenant.nombre) || "nuestro laboratorio");
  }

  function mensajeCorreo(item, tenant) {
    var labNombre = (tenant && tenant.nombre) || "nuestro laboratorio";
    var asunto = "Es momento de repetir tu " + item.regla.nombre;
    var cuerpo = "Hola " + primerNombre(item.patient) + ",\n\n" +
      (item.nunca
        ? "Según tu perfil, en " + labNombre + " te recomendamos realizarte: " + item.regla.nombre + "."
        : "Ya pasó el tiempo recomendado desde tu último control de " + item.regla.nombre + " en " + labNombre + ".") +
      "\n\nEscríbenos para agendar tu cita cuando gustes.\n\n" +
      "Gracias por confiar en " + labNombre + ".";
    return { asunto: asunto, cuerpo: cuerpo };
  }

  global.BIO_RECALL = {
    DEFAULT_REGLAS: DEFAULT_REGLAS,
    calcEdadNum: calcEdadNum,
    calcularRemarketing: calcularRemarketing,
    mensajeWhatsapp: mensajeWhatsapp,
    mensajeCorreo: mensajeCorreo
  };
})(window);

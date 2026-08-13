/* BIOsoft — Generador de RIPS (Registro Individual de Prestación de Servicios
   de Salud), SOLO Colombia. Arma el JSON con la estructura de la Resolución
   2275 de 2023 de MinSalud a partir de las órdenes, pacientes y catálogo ya
   registrados en BIOsoft.

   IMPORTANTE (ver también C.RIPS_DISCLAIMER, mostrado en la pantalla de
   Facturación): este archivo arma la ESTRUCTURA y los DATOS del RIPS con la
   mejor referencia disponible. MinSalud actualiza el Anexo Técnico
   periódicamente — el laboratorio debe verificar los códigos vigentes antes
   de transmitir, y la transmisión/validación/asignación del CUV se hace en
   la plataforma oficial de MinSalud, no aquí. */
(function (global) {
  "use strict";
  var C = global.BIO_CATALOG, S = global.BIO_STORE;

  function codSexoRips(sexo) {
    if (sexo === "Femenino") return "F";
    if (sexo === "Masculino") return "M";
    return "I";
  }

  /* Arma el bloque "usuarios" agrupando por paciente: si un mismo paciente
     tiene varias órdenes dentro del período seleccionado, sus procedimientos
     quedan todos bajo el mismo usuario (como exige la estructura RIPS), no
     duplicado por cada orden. */
  function buildRipsJSON(tenant, orders, patientsById, preciosPorExamen) {
    var usuariosPorPaciente = {};
    var ordenPacientes = [];

    orders.forEach(function (order) {
      var pac = patientsById[order.patientId];
      if (!pac) return;
      if (!usuariosPorPaciente[pac.id]) {
        usuariosPorPaciente[pac.id] = {
          tipoDocumentoIdentificacion: C.ripsTipoDocumento(pac.tipoDocumento),
          numDocumentoIdentificacion: pac.numeroDocumento,
          tipoUsuario: C.ripsTipoUsuario(pac.tipoAfiliacion),
          fechaNacimiento: pac.fechaNacimiento,
          codSexo: codSexoRips(pac.sexo),
          codPaisResidencia: "170",
          codMunicipioResidencia: pac.codigoMunicipioDane || "",
          codZonaTerritorialResidencia: pac.zonaResidencial || "U",
          incapacidad: "NO",
          consecutivo: ordenPacientes.length + 1,
          codPaisOrigen: "170",
          servicios: { procedimientos: [] }
        };
        ordenPacientes.push(pac.id);
      }
      var usuario = usuariosPorPaciente[pac.id];
      order.examenes.forEach(function (ex) {
        var exCat = C.examenEfectivo(ex.examId, tenant);
        usuario.servicios.procedimientos.push({
          codPrestador: tenant.codigoREPS || "",
          fechaInicioAtencion: (order.fechaOrden || "").slice(0, 10),
          idMIPRES: "",
          numAutorizacion: order.numAutorizacion || "",
          codProcedimiento: exCat ? exCat.cups : "",
          viaIngresoServicioSalud: C.ripsViaIngreso(order.procedencia),
          modalidadGrupoServicioTecSal: "01",
          grupoServicios: "01",
          codServicio: "",
          finalidadTecnologiaSalud: "15",
          conceptoRecaudo: "05",
          valorPagoModerador: 0,
          numFEVPagoModerador: "",
          consecutivo: usuario.servicios.procedimientos.length + 1,
          codDiagnosticoPrincipal: order.diagnosticoCIE10 || "",
          codDiagnosticoRelacionado: "",
          codComplicacion: "",
          vrServicio: preciosPorExamen[ex.examId] || 0
        });
      });
    });

    return {
      numDocumentoIdObligado: (tenant.nit || "").replace(/[^0-9]/g, ""),
      numFactura: null,
      tipoNota: null,
      numNota: null,
      usuarios: ordenPacientes.map(function (pid) { return usuariosPorPaciente[pid]; })
    };
  }

  /* Punto de entrada usado por views-facturacion.js: recibe el tenant y un
     arreglo de órdenes ya filtradas (por fecha, por selección manual, etc.)
     y resuelve pacientes + precios por su cuenta. */
  function generarRipsParaOrdenes(tenant, orders) {
    var patients = {};
    orders.forEach(function (o) {
      var p = S.getPatient(o.patientId);
      if (p) patients[p.id] = p;
    });
    var precios = {};
    S.cotizador.listPrecios(tenant.id).forEach(function (p) { precios[p.examId] = p.precio; });
    return buildRipsJSON(tenant, orders, patients, precios);
  }

  function contarProcedimientos(ripsJson) {
    return ripsJson.usuarios.reduce(function (n, u) { return n + u.servicios.procedimientos.length; }, 0);
  }

  global.BIO_RIPS = { buildRipsJSON: buildRipsJSON, generarRipsParaOrdenes: generarRipsParaOrdenes, contarProcedimientos: contarProcedimientos };
})(window);

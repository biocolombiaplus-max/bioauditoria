// ============================================================
// BIOAuditoria — Base de datos de clientes y documentos
// Modificar solo como administrador
// ============================================================

const BIO_DATA = {
  clientes: {
    vesga: {
      id: 'vesga',
      nombre: 'Dra. Yesika Vesga',
      tipo: 'Persona Natural — Médico General',
      especialidad: 'Medicina General',
      registro_medico: '(Ingresar RM en edición)',
      ciudad: 'Cúcuta, Norte de Santander',
      direccion_sede: '(Ingresar dirección sede)',
      codigo_reps: '(Pendiente — REPS)',
      telefono: '(Ingresar teléfono)',
      email: '(Ingresar correo)',
      fecha_habilitacion: '(Ingresar fecha)',
      servicios_habilitados: ['Consulta externa de medicina general'],
      servicios_complementarios: ['Procedimientos estéticos no invasivos (sin notificación adicional requerida)'],
      servicios_NO: ['Procedimientos quirúrgicos invasivos', 'Hospitalización', 'Urgencias'],
      carpetas: [
        {
          id: 'talento',
          nombre: 'Talento Humano',
          icono: '👤',
          norma: 'Res. 3100/2019 — Estándar 1',
          color: '#7B2FBE',
          documentos: [
            { id:'th01', nombre:'Hoja de vida profesional Dra. Yesika Vesga', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Hoja de vida con soportes académicos y experiencia' },
            { id:'th02', nombre:'Tarjeta profesional médica', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Registro médico ante la Secretaría de Salud' },
            { id:'th03', nombre:'Certificados de educación continuada', version:'v1.0', estado:'pendiente', tipo:'word', descripcion:'Constancias de cursos y actualizaciones' },
            { id:'th04', nombre:'Manual de inducción y reinducción del personal', version:'v2.0', estado:'vigente', tipo:'word', descripcion:'Protocolo de incorporación y actualización periódica' },
            { id:'th05', nombre:'Certificado de vacunación talento humano', version:'v1.0', estado:'requerido', tipo:'word', descripcion:'Esquema de vacunación hepatitis B, tétano, influenza' },
            { id:'th06', nombre:'Evaluación de desempeño anual', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Formato de evaluación de competencias clínicas' },
          ]
        },
        {
          id: 'dotacion',
          nombre: 'Dotación e Infraestructura',
          icono: '🏥',
          norma: 'Res. 3100/2019 — Estándar 2',
          color: '#FF6B00',
          documentos: [
            { id:'do01', nombre:'Inventario dotación e insumos médicos', version:'v1.2', estado:'pendiente', tipo:'word', descripcion:'Relación completa de equipos, mobiliario e insumos' },
            { id:'do02', nombre:'Programa de mantenimiento preventivo de equipos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Cronograma y registros de mantenimiento' },
            { id:'do03', nombre:'Hoja de vida de equipos biomédicos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Ficha técnica de cada equipo biomédico' },
            { id:'do04', nombre:'Contrato de mantenimiento equipos (si aplica)', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Contratos con proveedores de mantenimiento' },
            { id:'do05', nombre:'Plano de planta física del consultorio', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Distribución de áreas según habilitación' },
          ]
        },
        {
          id: 'medicamentos',
          nombre: 'Medicamentos e Insumos',
          icono: '💊',
          norma: 'Res. 1403/2007 · Res. 3100/2019',
          color: '#E63946',
          documentos: [
            { id:'me01', nombre:'Listado de medicamentos autorizados (CURE)', version:'v1.0', estado:'requerido', tipo:'word', descripcion:'Medicamentos del consultorio según CURE vigente' },
            { id:'me02', nombre:'Procedimiento de almacenamiento de medicamentos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Condiciones de temperatura, luz y cadena de frío' },
            { id:'me03', nombre:'Formato de control de vencimientos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Registro mensual de revisión de vencimientos' },
            { id:'me04', nombre:'Procedimiento de dispensación y administración', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Protocolo de entrega y aplicación de medicamentos' },
          ]
        },
        {
          id: 'historiaclinica',
          nombre: 'Historia Clínica',
          icono: '📋',
          norma: 'Res. 1995/1999 · Res. 3100/2019',
          color: '#2D9F5C',
          documentos: [
            { id:'hc01', nombre:'Manual del sistema de historia clínica', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Normativa interna para gestión de HC según Res. 1995/1999' },
            { id:'hc02', nombre:'Formato de historia clínica estandarizado', version:'v2.0', estado:'vigente', tipo:'word', descripcion:'Plantilla oficial HC con todos los campos requeridos' },
            { id:'hc03', nombre:'Consentimiento informado general', version:'v1.1', estado:'vigente', tipo:'word', descripcion:'Autorización paciente para tratamiento médico general' },
            { id:'hc04', nombre:'Política de manejo y custodia de HC', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Tiempos de conservación, acceso y confidencialidad' },
            { id:'hc05', nombre:'Registro de entrega y devolución de HC', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Control de préstamo de carpetas de HC' },
          ]
        },
        {
          id: 'pgirh',
          nombre: 'PGIRH — Residuos Hospitalarios',
          icono: '♻️',
          norma: 'Res. 1164/2002 · Dec. 351/2014',
          color: '#2D9F5C',
          documentos: [
            { id:'pg01', nombre:'Plan PGIRH completo del consultorio', version:'v2.0', estado:'vigente', tipo:'word', descripcion:'Plan integral de gestión de residuos hospitalarios' },
            { id:'pg02', nombre:'Procedimiento de segregación en la fuente', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Clasificación y separación correcta de residuos' },
            { id:'pg03', nombre:'Procedimiento de almacenamiento temporal', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Condiciones de almacenamiento según tipo de residuo' },
            { id:'pg04', nombre:'Contrato con gestor externo de residuos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Acuerdo con empresa autorizada de disposición final' },
            { id:'pg05', nombre:'Registro mensual de generación de residuos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Formato de reporte mensual obligatorio' },
            { id:'pg06', nombre:'Plan de contingencias PGIRH', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Protocolo ante derrames o situaciones de emergencia' },
            { id:'pg07', nombre:'Ficha de datos de seguridad (FDS) productos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Fichas técnicas de seguridad productos químicos' },
          ]
        },
        {
          id: 'bioseguridad',
          nombre: 'Bioseguridad',
          icono: '🛡️',
          norma: 'Res. 2674/2013 · Res. 3100/2019',
          color: '#FF6B00',
          documentos: [
            { id:'bs01', nombre:'Manual de bioseguridad', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Normas y precauciones universales de bioseguridad' },
            { id:'bs02', nombre:'Protocolo de lavado de manos (5 momentos OMS)', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Técnica correcta según lineamientos OMS' },
            { id:'bs03', nombre:'Protocolo de limpieza y desinfección de superficies', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Frecuencias, agentes y técnicas de desinfección' },
            { id:'bs04', nombre:'Protocolo de esterilización y desinfección de equipos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Niveles de desinfección según uso del equipo' },
            { id:'bs05', nombre:'Protocolo manejo accidentes de riesgo biológico', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Conducta ante exposición a fluidos biológicos' },
            { id:'bs06', nombre:'Inventario de EPP disponible', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Relación de elementos de protección personal' },
          ]
        },
        {
          id: 'estetica',
          nombre: 'Procedimientos Estéticos',
          icono: '✨',
          norma: 'Res. 3100/2019 · Concepto técnico Minsalud',
          color: '#7B2FBE',
          documentos: [
            { id:'es01', nombre:'Protocolo de procedimientos estéticos no invasivos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Guía clínica para cada procedimiento estético autorizado' },
            { id:'es02', nombre:'Consentimiento informado — estética facial', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Autorización específica para procedimientos estéticos' },
            { id:'es03', nombre:'Formato de valoración previa al procedimiento estético', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Evaluación de contraindicaciones y expectativas' },
            { id:'es04', nombre:'Formato de seguimiento post-procedimiento', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Control de evolución y satisfacción del paciente' },
            { id:'es05', nombre:'Listado de procedimientos estéticos no invasivos autorizados', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Catalogo de procedimientos permitidos en consulta externa' },
          ]
        },
        {
          id: 'calidad',
          nombre: 'Calidad y Gestión del Riesgo',
          icono: '🏆',
          norma: 'Res. 3100/2019 · Res. 0256/2016',
          color: '#FF6B00',
          documentos: [
            { id:'ca01', nombre:'Manual de calidad del consultorio', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Sistema de gestión de calidad del prestador' },
            { id:'ca02', nombre:'Programa de seguridad del paciente', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Estrategias y barreras para eventos adversos' },
            { id:'ca03', nombre:'Formato de notificación de incidentes y eventos adversos', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Reporte de situaciones de riesgo clínico' },
            { id:'ca04', nombre:'Manual de humanización del servicio', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Principios de trato digno y atención centrada en el paciente' },
            { id:'ca05', nombre:'Procedimiento de PQRS y satisfacción del usuario', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Gestión de peticiones, quejas, reclamos y sugerencias' },
            { id:'ca06', nombre:'Política de privacidad y habeas data (Ley 1581/2012)', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Tratamiento de datos personales de pacientes' },
            { id:'ca07', nombre:'Plan de gestión del riesgo de desastres', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Preparación y respuesta ante emergencias' },
            { id:'ca08', nombre:'Indicadores de calidad y seguimiento', version:'v1.0', estado:'vigente', tipo:'word', descripcion:'Tablero de indicadores asistenciales básicos' },
          ]
        },
      ],
      formatos_diligenciables: [
        { id:'fd01', nombre:'Historia clínica de consulta externa', categoria:'Atención clínica' },
        { id:'fd02', nombre:'Consentimiento informado general', categoria:'Atención clínica' },
        { id:'fd03', nombre:'Consentimiento informado — procedimiento estético', categoria:'Estética' },
        { id:'fd04', nombre:'Valoración previa procedimiento estético', categoria:'Estética' },
        { id:'fd05', nombre:'Registro mensual PGIRH', categoria:'Residuos' },
        { id:'fd06', nombre:'Registro de accidente de riesgo biológico', categoria:'Bioseguridad' },
        { id:'fd07', nombre:'Formato PQRS', categoria:'Calidad' },
        { id:'fd08', nombre:'Registro de capacitación y reinducción', categoria:'Talento humano' },
      ]
    }
  },

  // LOG DE TRAZABILIDAD — se almacena en sessionStorage en producción real
  trazabilidad: [
    { fecha:'2025-06-02 10:42', usuario:'Admin (BIOMarketing)', accion:'Firmó', documento:'Manual de bioseguridad v1.0' },
    { fecha:'2025-06-02 09:15', usuario:'Admin', accion:'Actualizó', documento:'Consentimiento informado v1.1' },
    { fecha:'2025-06-01 16:30', usuario:'Admin', accion:'Subió', documento:'Inventario dotación e insumos v1.2' },
    { fecha:'2025-06-01 11:00', usuario:'Admin', accion:'Publicó', documento:'PGIRH versión 2 firmado' },
    { fecha:'2025-05-30 14:22', usuario:'Dra. Vesga (cliente)', accion:'Consultó', documento:'Protocolo estética no invasiva' },
    { fecha:'2025-05-30 09:00', usuario:'Sistema', accion:'Alerta', documento:'Certificado cursos — vence en 15 días' },
  ],

  verificacion_3100: [
    { estandar:'1', descripcion:'Talento humano — idoneidad y suficiencia acreditada', estado:'cumple' },
    { estandar:'2', descripcion:'Dotación básica consultorio medicina general', estado:'cumple' },
    { estandar:'3', descripcion:'Medicamentos — listado CURE actualizado', estado:'pendiente' },
    { estandar:'4', descripcion:'Infraestructura física según condiciones de habilitación', estado:'cumple' },
    { estandar:'5', descripcion:'Bioseguridad y EPP disponible', estado:'cumple' },
    { estandar:'6', descripcion:'PGIRH actualizado con gestor externo contratado', estado:'cumple' },
    { estandar:'7', descripcion:'Historia clínica — formato y sistema de custodia', estado:'cumple' },
    { estandar:'8', descripcion:'Consentimientos informados vigentes', estado:'cumple' },
    { estandar:'9', descripcion:'Inventario dotación actualizado y firmado', estado:'pendiente' },
    { estandar:'10', descripcion:'Protocolos estéticos — vigentes y firmados', estado:'pendiente' },
    { estandar:'11', descripcion:'Certificado de vacunación talento humano', estado:'requerido' },
    { estandar:'12', descripcion:'Programa de seguridad del paciente implementado', estado:'cumple' },
    { estandar:'13', descripcion:'Sistema de PQRS operativo', estado:'cumple' },
    { estandar:'14', descripcion:'Política habeas data publicada (Ley 1581/2012)', estado:'cumple' },
  ]
};

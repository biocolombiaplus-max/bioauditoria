// ============================================================
// BIOAuditoria v2.0 — Estructura según Res. 3100/2019
// 8 Estándares oficiales · Todos los niveles de atención
// ============================================================

const GITHUB = 'https://raw.githubusercontent.com/biocolombiaplus-max/bioauditoria/main/docs/';

// TIPOS DE AUDITORÍA
const TIPOS_AUDITORIA = [
  'Visita de verificación habilitación (Secretaría de Salud)',
  'Auditoría EPS / Aseguradora',
  'Visita Supersalud',
  'Auditoría interna',
  'Auditoría externa independiente',
  'Visita INVIMA',
  'Auditoría de calidad SOGCS',
  'Visita Ministerio de Salud',
];

// NIVELES DE ATENCIÓN
const NIVELES = {
  1: 'Nivel 1 — Consulta externa, procedimientos básicos',
  2: 'Nivel 2 — Hospitalización, urgencias, cirugía ambulatoria',
  3: 'Nivel 3 — Alta complejidad, UCI, cirugía especializada',
};

// 8 ESTÁNDARES OFICIALES RES. 3100/2019
const ESTANDARES_3100 = [
  {
    id: 'e1', num: 1, nombre: 'Talento Humano',
    icono: '👤', color: '#7B2FBE',
    descripcion: 'Idoneidad, suficiencia y competencia del recurso humano',
    norma: 'Res. 3100/2019 — Estándar 1',
    requisitos: [
      'Hojas de vida con soportes académicos vigentes',
      'Tarjetas profesionales y registro en RETHUS',
      'Certificados de vacunación completos',
      'Programa de inducción y reinducción ejecutado',
      'Evaluación de desempeño anual',
      'Certificados de educación continuada (mín. 20h/año)',
      'Contratos o vinculaciones laborales',
      'Dotación y elementos de trabajo',
    ]
  },
  {
    id: 'e2', num: 2, nombre: 'Infraestructura',
    icono: '🏥', color: '#FF6B00',
    descripcion: 'Condiciones físicas, ambientales y de seguridad de la sede',
    norma: 'Res. 3100/2019 — Estándar 2',
    requisitos: [
      'Plano de planta física actualizado',
      'Condiciones de ventilación e iluminación',
      'Accesibilidad para personas con discapacidad',
      'Señalización de emergencias y rutas de evacuación',
      'Extintor vigente y accesible',
      'Plan de gestión del riesgo de desastres',
      'Condiciones de privacidad del paciente garantizadas',
      'Almacenamiento seguro de residuos',
    ]
  },
  {
    id: 'e3', num: 3, nombre: 'Dotación',
    icono: '🩺', color: '#2D9F5C',
    descripcion: 'Equipos biomédicos, mobiliario e insumos según el servicio',
    norma: 'Res. 3100/2019 — Estándar 3',
    requisitos: [
      'Inventario de dotación actualizado y firmado',
      'Hojas de vida de equipos biomédicos',
      'Programa de mantenimiento preventivo al día',
      'Calibración de equipos de medición',
      'Contratos de mantenimiento vigentes',
      'Insumos suficientes para el servicio',
      'Condiciones de almacenamiento de insumos',
    ]
  },
  {
    id: 'e4', num: 4, nombre: 'Medicamentos y Dispositivos',
    icono: '💊', color: '#E63946',
    descripcion: 'Gestión segura de medicamentos, dispositivos e insumos',
    norma: 'Res. 3100/2019 — Estándar 4 · Res. 1403/2007',
    requisitos: [
      'Listado de medicamentos CURE vigente',
      'Política de medicamentos seguros (5 correctos)',
      'Control de vencimientos mensual',
      'Condiciones de almacenamiento (temperatura, luz)',
      'Cadena de frío si aplica',
      'Manejo de medicamentos de alto riesgo',
      'Registro de RAM al INVIMA',
      'Medicamentos con registro INVIMA vigente',
    ]
  },
  {
    id: 'e5', num: 5, nombre: 'Procesos Prioritarios',
    icono: '📋', color: '#FF6B00',
    descripcion: 'Bioseguridad, seguridad del paciente, PGIRH y procesos asistenciales',
    norma: 'Res. 3100/2019 — Estándar 5',
    requisitos: [
      'Manual de bioseguridad implementado',
      'Protocolo lavado de manos (5 momentos OMS)',
      'Protocolo limpieza y desinfección',
      'Plan PGIRH actualizado con gestor externo',
      'Programa de seguridad del paciente',
      'Consentimientos informados vigentes',
      'Protocolo manejo accidente biológico',
      'Protocolo referencia y contrarreferencia',
      'Indicadores de seguridad con seguimiento',
    ]
  },
  {
    id: 'e6', num: 6, nombre: 'Historia Clínica',
    icono: '📁', color: '#7B2FBE',
    descripcion: 'Sistema de gestión, custodia y confidencialidad de HC',
    norma: 'Res. 3100/2019 — Estándar 6 · Res. 1995/1999',
    requisitos: [
      'Manual del sistema de historia clínica',
      'Formato de historia clínica estandarizado',
      'Política de custodia y conservación (30 años)',
      'Política de confidencialidad y acceso',
      'Sistema de archivo activo, central e histórico',
      'Registro de préstamo y devolución de HC',
      'Autorización de uso de datos (Ley 1581/2012)',
    ]
  },
  {
    id: 'e7', num: 7, nombre: 'Interdependencia de Servicios',
    icono: '🔗', color: '#2D9F5C',
    descripcion: 'Articulación con otros servicios y procesos de apoyo',
    norma: 'Res. 3100/2019 — Estándar 7',
    requisitos: [
      'Protocolo de referencia y contrarreferencia',
      'Red de prestadores de apoyo diagnóstico',
      'Convenios con laboratorio clínico',
      'Convenios con servicio de imágenes diagnósticas',
      'Protocolo de traslado de pacientes',
      'Directorio de entidades de referencia',
      'Procedimiento de remisión de urgencias',
    ]
  },
  {
    id: 'e8', num: 8, nombre: 'Mejoramiento de la Calidad',
    icono: '🏆', color: '#FF6B00',
    descripcion: 'Sistema de calidad, PQRS, indicadores y gestión del riesgo',
    norma: 'Res. 3100/2019 — Estándar 8 · Res. 0256/2016',
    requisitos: [
      'Manual de calidad actualizado',
      'Programa de seguridad del paciente',
      'Manual de humanización del servicio',
      'Sistema de PQRS operativo',
      'Indicadores de calidad con seguimiento mensual',
      'Reporte de eventos adversos al SIVIGILA',
      'Plan de mejoramiento continuo',
      'Política habeas data (Ley 1581/2012)',
    ]
  },
];

const BIO_DATA = {
  version: '2.0',
  clientes: {
    vesga: {
      id: 'vesga',
      nombre: 'Dra. Yesika Zayra Vesga Español',
      nombre_corto: 'Dra. Vesga',
      cedula: '1.140.858.207',
      especialidad: 'Médico General',
      registro_medico: '(pendiente completar)',
      empresa: 'MEDICAL CENTER SILOÉ SAS',
      nit: '902.052.974-3',
      representante_legal: 'Yesika Zayra Vesga Español',
      nivel_atencion: 1,
      ciudad: 'Cúcuta, Norte de Santander',
      departamento: 'Norte de Santander',
      direccion: 'Calle 15A No. 1E-109 Local 1, Barrio Caobos',
      telefono: '(pendiente)',
      email: 'jessicavesga1305@hotmail.com',
      email_admin: 'biomarketing.salud@gmail.com',
      logo_url: '',
      servicio_habilitado: 'Consulta Externa de Medicina General',
      codigo_habilitacion: '(pendiente REPS)',
      fecha_habilitacion: '(pendiente)',
      secretaria_salud: 'Secretaría de Salud Municipal de Cúcuta',
      servicios: ['Consulta Externa de Medicina General', 'Procedimientos estéticos no invasivos'],
      color_institucional: '#FF6B00',

      // 8 ESTÁNDARES CON DOCUMENTOS
      estandares: [
        {
          id: 'e1', estandar_num: 1,
          documentos: [
            { id:'e1-01', nombre:'Hoja de vida — Dra. Yesika Zayra Vesga Español', version:'v1.0 · 2025', estado:'pendiente', archivo:'04_Hoja_Vida_Medico.docx', tipo:'documento' },
            { id:'e1-02', nombre:'Tarjeta profesional médica y registro RETHUS', version:'v1.0 · 2025', estado:'requerido', archivo:'', tipo:'soporte' },
            { id:'e1-03', nombre:'Certificados de vacunación del personal', version:'v1.0 · 2025', estado:'requerido', archivo:'', tipo:'soporte' },
            { id:'e1-04', nombre:'Manual de talento humano', version:'v1.0 · 2025', estado:'vigente', archivo:'03_Manual_Talento_Humano.docx', tipo:'manual' },
            { id:'e1-05', nombre:'Programa de inducción y reinducción', version:'v1.0 · 2025', estado:'vigente', archivo:'30_Programa_Induccion_Reinduccion.docx', tipo:'programa' },
            { id:'e1-06', nombre:'Evaluación de desempeño anual', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'formato' },
            { id:'e1-07', nombre:'Certificados de educación continuada', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'soporte' },
          ]
        },
        {
          id: 'e2', estandar_num: 2,
          documentos: [
            { id:'e2-01', nombre:'Plano de planta física del consultorio', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'plano' },
            { id:'e2-02', nombre:'Ficha técnica del establecimiento', version:'v1.0 · 2025', estado:'pendiente', archivo:'35_Ficha_Tecnica_Establecimiento.docx', tipo:'documento' },
            { id:'e2-03', nombre:'Plan de gestión del riesgo de desastres', version:'v1.0 · 2025', estado:'vigente', archivo:'24_Plan_Gestion_Riesgo_Desastres.docx', tipo:'plan' },
            { id:'e2-04', nombre:'Inventario extintor y equipos de emergencia', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'inventario' },
            { id:'e2-05', nombre:'Registro de simulacros de evacuación', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'registro' },
          ]
        },
        {
          id: 'e3', estandar_num: 3,
          documentos: [
            { id:'e3-01', nombre:'Inventario de dotación e insumos médicos', version:'v1.2 · 2025', estado:'pendiente', archivo:'13_Inventario_Dotacion.docx', tipo:'inventario' },
            { id:'e3-02', nombre:'Programa de mantenimiento de equipos biomédicos', version:'v1.0 · 2025', estado:'vigente', archivo:'14_Programa_Mantenimiento_Equipos.docx', tipo:'programa' },
            { id:'e3-03', nombre:'Hojas de vida de equipos biomédicos', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'documento' },
            { id:'e3-04', nombre:'Contratos de mantenimiento y calibración', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'contrato' },
          ]
        },
        {
          id: 'e4', estandar_num: 4,
          documentos: [
            { id:'e4-01', nombre:'Listado de medicamentos autorizados CURE', version:'v1.0 · 2025', estado:'requerido', archivo:'', tipo:'listado' },
            { id:'e4-02', nombre:'Política de medicamentos seguros — 5 correctos', version:'v1.0 · 2025', estado:'vigente', archivo:'31_Politica_Medicamentos_Seguros.docx', tipo:'política' },
            { id:'e4-03', nombre:'Control mensual de medicamentos y vencimientos', version:'v1.0 · 2025', estado:'vigente', archivo:'29_Control_Medicamentos_Vencimientos.docx', tipo:'formato' },
            { id:'e4-04', nombre:'Inventario y control del botiquín de primeros auxilios', version:'v1.0 · 2025', estado:'vigente', archivo:'28_Inventario_Botiquin.docx', tipo:'inventario' },
          ]
        },
        {
          id: 'e5', estandar_num: 5,
          documentos: [
            { id:'e5-01', nombre:'Manual de bioseguridad', version:'v1.0 · 2025', estado:'vigente', archivo:'02_Manual_Bioseguridad.docx', tipo:'manual' },
            { id:'e5-02', nombre:'Protocolo de lavado de manos — 5 momentos OMS', version:'v1.0 · 2025', estado:'vigente', archivo:'19_Protocolo_Lavado_Manos.docx', tipo:'protocolo' },
            { id:'e5-03', nombre:'Protocolo de limpieza y desinfección de superficies', version:'v1.0 · 2025', estado:'vigente', archivo:'18_Protocolo_Limpieza_Desinfeccion.docx', tipo:'protocolo' },
            { id:'e5-04', nombre:'Plan PGIRH completo — Residuos hospitalarios', version:'v2.0 · 2025', estado:'vigente', archivo:'15_Plan_PGIRH.docx', tipo:'plan' },
            { id:'e5-05', nombre:'Procedimiento de segregación de residuos en la fuente', version:'v1.0 · 2025', estado:'vigente', archivo:'17_Protocolo_Segregacion_Residuos.docx', tipo:'protocolo' },
            { id:'e5-06', nombre:'Registro mensual de generación de residuos PGIRH', version:'v1.0 · 2025', estado:'vigente', archivo:'16_Registro_Mensual_PGIRH.docx', tipo:'formato' },
            { id:'e5-07', nombre:'Contrato con gestor externo de residuos hospitalarios', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'contrato' },
            { id:'e5-08', nombre:'Programa de seguridad del paciente', version:'v1.0 · 2025', estado:'vigente', archivo:'05_Programa_Seguridad_Paciente.docx', tipo:'programa' },
            { id:'e5-09', nombre:'Protocolo de manejo de accidente de riesgo biológico', version:'v1.0 · 2025', estado:'vigente', archivo:'27_Protocolo_Accidente_Biologico.docx', tipo:'protocolo' },
            { id:'e5-10', nombre:'Consentimiento informado general', version:'v1.1 · 2025', estado:'vigente', archivo:'08_Consentimiento_Informado_General.docx', tipo:'formato' },
            { id:'e5-11', nombre:'Consentimiento informado — procedimientos estéticos', version:'v1.0 · 2025', estado:'vigente', archivo:'09_Consentimiento_Estetica.docx', tipo:'formato' },
            { id:'e5-12', nombre:'Protocolo de procedimientos estéticos no invasivos', version:'v1.0 · 2025', estado:'vigente', archivo:'11_Protocolo_Procedimientos_Esteticos.docx', tipo:'protocolo' },
          ]
        },
        {
          id: 'e6', estandar_num: 6,
          documentos: [
            { id:'e6-01', nombre:'Manual del sistema de historia clínica', version:'v1.0 · 2025', estado:'vigente', archivo:'20_Manual_Historia_Clinica.docx', tipo:'manual' },
            { id:'e6-02', nombre:'Formato de historia clínica estandarizado', version:'v2.0 · 2025', estado:'vigente', archivo:'07_Formato_Historia_Clinica.docx', tipo:'formato' },
            { id:'e6-03', nombre:'Política de custodia, conservación y confidencialidad', version:'v1.0 · 2025', estado:'vigente', archivo:'20_Manual_Historia_Clinica.docx', tipo:'política' },
            { id:'e6-04', nombre:'Política de tratamiento de datos personales (Ley 1581/2012)', version:'v1.0 · 2025', estado:'vigente', archivo:'21_Politica_Habeas_Data.docx', tipo:'política' },
            { id:'e6-05', nombre:'Registro de préstamo y devolución de historias clínicas', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'registro' },
          ]
        },
        {
          id: 'e7', estandar_num: 7,
          documentos: [
            { id:'e7-01', nombre:'Protocolo de referencia y contrarreferencia', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'protocolo' },
            { id:'e7-02', nombre:'Directorio de entidades de referencia y apoyo diagnóstico', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'directorio' },
            { id:'e7-03', nombre:'Convenios con laboratorio clínico y diagnóstico', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'convenio' },
            { id:'e7-04', nombre:'Protocolo de traslado de pacientes', version:'v1.0 · 2025', estado:'pendiente', archivo:'', tipo:'protocolo' },
          ]
        },
        {
          id: 'e8', estandar_num: 8,
          documentos: [
            { id:'e8-01', nombre:'Manual de calidad y gestión', version:'v1.0 · 2025', estado:'vigente', archivo:'01_Manual_Calidad.docx', tipo:'manual' },
            { id:'e8-02', nombre:'Manual de humanización del servicio', version:'v1.0 · 2025', estado:'vigente', archivo:'06_Manual_Humanizacion.docx', tipo:'manual' },
            { id:'e8-03', nombre:'Procedimiento y formato de PQRS', version:'v1.0 · 2025', estado:'vigente', archivo:'22_Procedimiento_PQRS.docx', tipo:'procedimiento' },
            { id:'e8-04', nombre:'Tablero de indicadores de calidad', version:'v1.0 · 2025', estado:'vigente', archivo:'25_Indicadores_Calidad.docx', tipo:'tablero' },
            { id:'e8-05', nombre:'Formato de reporte de evento adverso / incidente', version:'v1.0 · 2025', estado:'vigente', archivo:'26_Formato_Reporte_Evento_Adverso.docx', tipo:'formato' },
            { id:'e8-06', nombre:'Registro diario de atenciones', version:'v1.0 · 2025', estado:'vigente', archivo:'33_Registro_Diario_Atenciones.docx', tipo:'registro' },
            { id:'e8-07', nombre:'Lista de verificación — Simulacro visita habilitación', version:'v1.0 · 2025', estado:'vigente', archivo:'34_Lista_Verificacion_Habilitacion.docx', tipo:'lista' },
          ]
        },
      ],

      formatos_diligenciables: [
        { id:'fd01', nombre:'Historia clínica de consulta externa', categoria:'Estándar 6 — Historia Clínica', archivo:'07_Formato_Historia_Clinica.docx', frecuencia:'Por consulta' },
        { id:'fd02', nombre:'Consentimiento informado general', categoria:'Estándar 5 — Procesos Prioritarios', archivo:'08_Consentimiento_Informado_General.docx', frecuencia:'Por consulta' },
        { id:'fd03', nombre:'Consentimiento informado — procedimiento estético', categoria:'Estándar 5 — Procesos Prioritarios', archivo:'09_Consentimiento_Estetica.docx', frecuencia:'Por procedimiento' },
        { id:'fd04', nombre:'Valoración previa procedimiento estético', categoria:'Estándar 5 — Procesos Prioritarios', archivo:'10_Formato_Valoracion_Estetica.docx', frecuencia:'Por procedimiento' },
        { id:'fd05', nombre:'Seguimiento post-procedimiento estético', categoria:'Estándar 5 — Procesos Prioritarios', archivo:'12_Formato_Seguimiento_Post_Procedimiento.docx', frecuencia:'Por procedimiento' },
        { id:'fd06', nombre:'Registro mensual PGIRH', categoria:'Estándar 5 — Procesos Prioritarios', archivo:'16_Registro_Mensual_PGIRH.docx', frecuencia:'Mensual' },
        { id:'fd07', nombre:'Reporte de evento adverso / incidente', categoria:'Estándar 8 — Mejoramiento Calidad', archivo:'26_Formato_Reporte_Evento_Adverso.docx', frecuencia:'Por evento' },
        { id:'fd08', nombre:'Formato PQRS', categoria:'Estándar 8 — Mejoramiento Calidad', archivo:'23_Formato_PQRS.docx', frecuencia:'Por solicitud' },
        { id:'fd09', nombre:'Registro diario de atenciones', categoria:'Estándar 8 — Mejoramiento Calidad', archivo:'33_Registro_Diario_Atenciones.docx', frecuencia:'Diario' },
        { id:'fd10', nombre:'Control medicamentos y vencimientos', categoria:'Estándar 4 — Medicamentos', archivo:'29_Control_Medicamentos_Vencimientos.docx', frecuencia:'Mensual' },
        { id:'fd11', nombre:'Verificación inventario dotación', categoria:'Estándar 3 — Dotación', archivo:'13_Inventario_Dotacion.docx', frecuencia:'Semestral' },
        { id:'fd12', nombre:'Registro de capacitación / reinducción', categoria:'Estándar 1 — Talento Humano', archivo:'30_Programa_Induccion_Reinduccion.docx', frecuencia:'Anual' },
      ],

      // ACTAS DE AUDITORÍA
      auditorias: [],
    }
  },

  // VERIFICACIÓN POR ESTÁNDAR
  verificacion_3100: [
    // E1
    { estandar:'1', codigo:'1.1', descripcion:'Hoja de vida con soportes académicos completa y vigente', estado:'pendiente' },
    { estandar:'1', codigo:'1.2', descripcion:'Tarjeta profesional vigente y registrada en RETHUS', estado:'requerido' },
    { estandar:'1', codigo:'1.3', descripcion:'Certificados de vacunación completos (HepB, Tétanos, Influenza)', estado:'requerido' },
    { estandar:'1', codigo:'1.4', descripcion:'Inducción y reinducción ejecutada con registro', estado:'vigente' },
    { estandar:'1', codigo:'1.5', descripcion:'Educación continuada mínima 20 horas/año certificada', estado:'pendiente' },
    // E2
    { estandar:'2', codigo:'2.1', descripcion:'Plano de planta física actualizado y archivado', estado:'pendiente' },
    { estandar:'2', codigo:'2.2', descripcion:'Condiciones físicas adecuadas para el servicio habilitado', estado:'vigente' },
    { estandar:'2', codigo:'2.3', descripcion:'Extintor vigente, accesible y señalizado', estado:'pendiente' },
    { estandar:'2', codigo:'2.4', descripcion:'Señalización de emergencias y ruta de evacuación', estado:'pendiente' },
    { estandar:'2', codigo:'2.5', descripcion:'Plan de gestión del riesgo de desastres implementado', estado:'vigente' },
    // E3
    { estandar:'3', codigo:'3.1', descripcion:'Inventario de dotación actualizado y firmado', estado:'pendiente' },
    { estandar:'3', codigo:'3.2', descripcion:'Equipos biomédicos con hojas de vida', estado:'pendiente' },
    { estandar:'3', codigo:'3.3', descripcion:'Mantenimiento preventivo al día y documentado', estado:'vigente' },
    { estandar:'3', codigo:'3.4', descripcion:'Calibración de equipos de medición vigente', estado:'pendiente' },
    // E4
    { estandar:'4', codigo:'4.1', descripcion:'Listado CURE de medicamentos autorizados disponible', estado:'requerido' },
    { estandar:'4', codigo:'4.2', descripcion:'Control de vencimientos mensual diligenciado', estado:'vigente' },
    { estandar:'4', codigo:'4.3', descripcion:'Condiciones de almacenamiento de medicamentos correctas', estado:'vigente' },
    { estandar:'4', codigo:'4.4', descripcion:'Botiquín de primeros auxilios completo y vigente', estado:'vigente' },
    // E5
    { estandar:'5', codigo:'5.1', descripcion:'Manual de bioseguridad disponible y socializado', estado:'vigente' },
    { estandar:'5', codigo:'5.2', descripcion:'Protocolo lavado de manos implementado (5 momentos OMS)', estado:'vigente' },
    { estandar:'5', codigo:'5.3', descripcion:'PGIRH actualizado con gestor externo contratado', estado:'vigente' },
    { estandar:'5', codigo:'5.4', descripcion:'Segregación correcta de residuos en la fuente', estado:'vigente' },
    { estandar:'5', codigo:'5.5', descripcion:'Programa de seguridad del paciente implementado', estado:'vigente' },
    { estandar:'5', codigo:'5.6', descripcion:'Consentimientos informados vigentes y disponibles', estado:'vigente' },
    { estandar:'5', codigo:'5.7', descripcion:'EPP disponible y suficiente para el servicio', estado:'vigente' },
    { estandar:'5', codigo:'5.8', descripcion:'Contrato gestor externo residuos hospitalarios vigente', estado:'pendiente' },
    // E6
    { estandar:'6', codigo:'6.1', descripcion:'Manual del sistema de historia clínica disponible', estado:'vigente' },
    { estandar:'6', codigo:'6.2', descripcion:'Formato de historia clínica estandarizado en uso', estado:'vigente' },
    { estandar:'6', codigo:'6.3', descripcion:'Política de custodia y conservación (30 años mínimo)', estado:'vigente' },
    { estandar:'6', codigo:'6.4', descripcion:'Consentimiento para uso de datos personales (Ley 1581)', estado:'vigente' },
    // E7
    { estandar:'7', codigo:'7.1', descripcion:'Protocolo de referencia y contrarreferencia disponible', estado:'pendiente' },
    { estandar:'7', codigo:'7.2', descripcion:'Directorio de entidades de referencia actualizado', estado:'pendiente' },
    { estandar:'7', codigo:'7.3', descripcion:'Convenios o acuerdos con apoyo diagnóstico establecidos', estado:'pendiente' },
    // E8
    { estandar:'8', codigo:'8.1', descripcion:'Manual de calidad disponible y actualizado', estado:'vigente' },
    { estandar:'8', codigo:'8.2', descripcion:'Sistema de PQRS operativo con registro de respuestas', estado:'vigente' },
    { estandar:'8', codigo:'8.3', descripcion:'Indicadores de calidad con seguimiento mensual', estado:'vigente' },
    { estandar:'8', codigo:'8.4', descripcion:'Reporte de eventos adversos al SIVIGILA cuando aplica', estado:'vigente' },
    { estandar:'8', codigo:'8.5', descripcion:'Política habeas data publicada (Ley 1581/2012)', estado:'vigente' },
  ],

  trazabilidad: [
    { fecha:'05/06/2025 10:00', usuario:'Admin (BIOMarketing)', accion:'Publicó', documento:'BIOAuditoria v2.0 — Estructura Res. 3100' },
    { fecha:'05/06/2025 09:30', usuario:'Admin', accion:'Subió', documento:'35 documentos Medical Center Siloé SAS' },
    { fecha:'04/06/2025 16:00', usuario:'Admin', accion:'Activó', documento:'Dominio bioauditoria.com' },
  ],

  github_docs_url: GITHUB,
};

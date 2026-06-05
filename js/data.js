// ============================================================
// BIOAuditoria — Base de datos actualizada
// Medical Center Siloé SAS — 35 documentos reales
// ============================================================

const GITHUB_DOCS = 'https://raw.githubusercontent.com/biocolombiaplus-max/bioauditoria/main/docs/';

const BIO_DATA = {
  clientes: {
    vesga: {
      id: 'vesga',
      nombre: 'Dra. Yesika Zayra Vesga Español',
      tipo: 'Persona Natural — Médico General',
      especialidad: 'Médico General',
      cedula: '1.140.858.207',
      empresa: 'MEDICAL CENTER SILOÉ SAS',
      nit: '902.052.974-3',
      ciudad: 'Cúcuta, Norte de Santander',
      direccion: 'Calle 15A No. 1E-109 Local 1, Barrio Caobos',
      email: 'jessicavesga1305@hotmail.com',
      servicio_habilitado: 'Consulta Externa de Medicina General',
      servicios_complementarios: ['Procedimientos estéticos no invasivos'],
      carpetas: [
        {
          id: 'calidad',
          nombre: 'Calidad y Gestión',
          icono: '🏆',
          norma: 'Res. 3100/2019 · Res. 0256/2016',
          color: '#FF6B00',
          documentos: [
            { id:'01', nombre:'Manual de Calidad y Gestión', version:'v1.0 · 2025', estado:'vigente', archivo:'01_Manual_Calidad.docx' },
            { id:'05', nombre:'Programa de Seguridad del Paciente', version:'v1.0 · 2025', estado:'vigente', archivo:'05_Programa_Seguridad_Paciente.docx' },
            { id:'06', nombre:'Manual de Humanización del Servicio', version:'v1.0 · 2025', estado:'vigente', archivo:'06_Manual_Humanizacion.docx' },
            { id:'22', nombre:'Procedimiento de PQRS', version:'v1.0 · 2025', estado:'vigente', archivo:'22_Procedimiento_PQRS.docx' },
            { id:'23', nombre:'Formato PQRS', version:'v1.0 · 2025', estado:'vigente', archivo:'23_Formato_PQRS.docx' },
            { id:'25', nombre:'Tablero de Indicadores de Calidad', version:'v1.0 · 2025', estado:'vigente', archivo:'25_Indicadores_Calidad.docx' },
            { id:'26', nombre:'Formato Reporte Evento Adverso', version:'v1.0 · 2025', estado:'vigente', archivo:'26_Formato_Reporte_Evento_Adverso.docx' },
            { id:'31', nombre:'Política de Medicamentos Seguros', version:'v1.0 · 2025', estado:'vigente', archivo:'31_Politica_Medicamentos_Seguros.docx' },
          ]
        },
        {
          id: 'talento',
          nombre: 'Talento Humano',
          icono: '👤',
          norma: 'Res. 3100/2019 — Estándar 1',
          color: '#7B2FBE',
          documentos: [
            { id:'03', nombre:'Manual de Talento Humano', version:'v1.0 · 2025', estado:'vigente', archivo:'03_Manual_Talento_Humano.docx' },
            { id:'04', nombre:'Hoja de Vida — Dra. Yesika Vesga', version:'v1.0 · 2025', estado:'pendiente', archivo:'04_Hoja_Vida_Medico.docx' },
            { id:'30', nombre:'Programa de Inducción y Reinducción', version:'v1.0 · 2025', estado:'vigente', archivo:'30_Programa_Induccion_Reinduccion.docx' },
            { id:'35', nombre:'Ficha Técnica del Establecimiento', version:'v1.0 · 2025', estado:'pendiente', archivo:'35_Ficha_Tecnica_Establecimiento.docx' },
          ]
        },
        {
          id: 'bioseguridad',
          nombre: 'Bioseguridad',
          icono: '🛡️',
          norma: 'Res. 2674/2013 · Res. 3100/2019',
          color: '#FF6B00',
          documentos: [
            { id:'02', nombre:'Manual de Bioseguridad', version:'v1.0 · 2025', estado:'vigente', archivo:'02_Manual_Bioseguridad.docx' },
            { id:'18', nombre:'Protocolo Limpieza y Desinfección de Superficies', version:'v1.0 · 2025', estado:'vigente', archivo:'18_Protocolo_Limpieza_Desinfeccion.docx' },
            { id:'19', nombre:'Protocolo Lavado de Manos — 5 Momentos OMS', version:'v1.0 · 2025', estado:'vigente', archivo:'19_Protocolo_Lavado_Manos.docx' },
            { id:'27', nombre:'Protocolo Accidente de Riesgo Biológico', version:'v1.0 · 2025', estado:'vigente', archivo:'27_Protocolo_Accidente_Biologico.docx' },
            { id:'28', nombre:'Inventario y Control del Botiquín', version:'v1.0 · 2025', estado:'vigente', archivo:'28_Inventario_Botiquin.docx' },
          ]
        },
        {
          id: 'historiaclinica',
          nombre: 'Historia Clínica',
          icono: '📋',
          norma: 'Res. 1995/1999 · Res. 3100/2019',
          color: '#2D9F5C',
          documentos: [
            { id:'07', nombre:'Formato de Historia Clínica — Consulta Externa', version:'v2.0 · 2025', estado:'vigente', archivo:'07_Formato_Historia_Clinica.docx' },
            { id:'08', nombre:'Consentimiento Informado General', version:'v1.1 · 2025', estado:'vigente', archivo:'08_Consentimiento_Informado_General.docx' },
            { id:'20', nombre:'Manual del Sistema de Historia Clínica', version:'v1.0 · 2025', estado:'vigente', archivo:'20_Manual_Historia_Clinica.docx' },
            { id:'21', nombre:'Política de Tratamiento de Datos (Habeas Data)', version:'v1.0 · 2025', estado:'vigente', archivo:'21_Politica_Habeas_Data.docx' },
          ]
        },
        {
          id: 'estetica',
          nombre: 'Procedimientos Estéticos',
          icono: '✨',
          norma: 'Res. 3100/2019 · Concepto MinSalud',
          color: '#7B2FBE',
          documentos: [
            { id:'09', nombre:'Consentimiento Informado — Estética', version:'v1.0 · 2025', estado:'vigente', archivo:'09_Consentimiento_Estetica.docx' },
            { id:'10', nombre:'Formato Valoración Previa — Procedimiento Estético', version:'v1.0 · 2025', estado:'vigente', archivo:'10_Formato_Valoracion_Estetica.docx' },
            { id:'11', nombre:'Protocolo Procedimientos Estéticos No Invasivos', version:'v1.0 · 2025', estado:'vigente', archivo:'11_Protocolo_Procedimientos_Esteticos.docx' },
            { id:'12', nombre:'Formato Seguimiento Post-Procedimiento', version:'v1.0 · 2025', estado:'vigente', archivo:'12_Formato_Seguimiento_Post_Procedimiento.docx' },
            { id:'32', nombre:'Listado Procedimientos Estéticos Autorizados', version:'v1.0 · 2025', estado:'vigente', archivo:'32_Listado_Procedimientos_Esteticos.docx' },
          ]
        },
        {
          id: 'pgirh',
          nombre: 'PGIRH — Residuos',
          icono: '♻️',
          norma: 'Res. 1164/2002 · Dec. 351/2014',
          color: '#2D9F5C',
          documentos: [
            { id:'15', nombre:'Plan PGIRH Completo del Consultorio', version:'v2.0 · 2025', estado:'vigente', archivo:'15_Plan_PGIRH.docx' },
            { id:'16', nombre:'Registro Mensual de Generación de Residuos', version:'v1.0 · 2025', estado:'vigente', archivo:'16_Registro_Mensual_PGIRH.docx' },
            { id:'17', nombre:'Procedimiento de Segregación en la Fuente', version:'v1.0 · 2025', estado:'vigente', archivo:'17_Protocolo_Segregacion_Residuos.docx' },
          ]
        },
        {
          id: 'dotacion',
          nombre: 'Dotación e Infraestructura',
          icono: '🏥',
          norma: 'Res. 3100/2019 — Estándar 2',
          color: '#FF6B00',
          documentos: [
            { id:'13', nombre:'Inventario de Dotación e Insumos Médicos', version:'v1.2 · 2025', estado:'pendiente', archivo:'13_Inventario_Dotacion.docx' },
            { id:'14', nombre:'Programa de Mantenimiento de Equipos Biomédicos', version:'v1.0 · 2025', estado:'vigente', archivo:'14_Programa_Mantenimiento_Equipos.docx' },
            { id:'29', nombre:'Control de Medicamentos y Vencimientos', version:'v1.0 · 2025', estado:'vigente', archivo:'29_Control_Medicamentos_Vencimientos.docx' },
          ]
        },
        {
          id: 'operaciones',
          nombre: 'Operaciones',
          icono: '📊',
          norma: 'Res. 3100/2019',
          color: '#7B2FBE',
          documentos: [
            { id:'24', nombre:'Plan de Gestión del Riesgo de Desastres', version:'v1.0 · 2025', estado:'vigente', archivo:'24_Plan_Gestion_Riesgo_Desastres.docx' },
            { id:'33', nombre:'Registro Diario de Atenciones', version:'v1.0 · 2025', estado:'vigente', archivo:'33_Registro_Diario_Atenciones.docx' },
            { id:'34', nombre:'Lista de Verificación — Simulacro Visita Habilitación', version:'v1.0 · 2025', estado:'vigente', archivo:'34_Lista_Verificacion_Habilitacion.docx' },
          ]
        },
      ],

      formatos_diligenciables: [
        { id:'fd01', nombre:'Historia clínica de consulta externa', categoria:'Atención clínica', archivo:'07_Formato_Historia_Clinica.docx' },
        { id:'fd02', nombre:'Consentimiento informado general', categoria:'Atención clínica', archivo:'08_Consentimiento_Informado_General.docx' },
        { id:'fd03', nombre:'Consentimiento informado — procedimiento estético', categoria:'Estética', archivo:'09_Consentimiento_Estetica.docx' },
        { id:'fd04', nombre:'Valoración previa procedimiento estético', categoria:'Estética', archivo:'10_Formato_Valoracion_Estetica.docx' },
        { id:'fd05', nombre:'Seguimiento post-procedimiento estético', categoria:'Estética', archivo:'12_Formato_Seguimiento_Post_Procedimiento.docx' },
        { id:'fd06', nombre:'Registro mensual PGIRH', categoria:'Residuos', archivo:'16_Registro_Mensual_PGIRH.docx' },
        { id:'fd07', nombre:'Reporte de evento adverso / incidente', categoria:'Seguridad del paciente', archivo:'26_Formato_Reporte_Evento_Adverso.docx' },
        { id:'fd08', nombre:'Formato PQRS', categoria:'Calidad', archivo:'23_Formato_PQRS.docx' },
        { id:'fd09', nombre:'Registro diario de atenciones', categoria:'Operaciones', archivo:'33_Registro_Diario_Atenciones.docx' },
        { id:'fd10', nombre:'Control medicamentos y vencimientos', categoria:'Medicamentos', archivo:'29_Control_Medicamentos_Vencimientos.docx' },
      ]
    }
  },

  trazabilidad: [
    { fecha:'05/06/2025 10:42', usuario:'Admin (BIOMarketing)', accion:'Subió', documento:'35 documentos Medical Center Siloé SAS' },
    { fecha:'05/06/2025 09:15', usuario:'Admin', accion:'Actualizó', documento:'data.js — estructura documentos reales' },
    { fecha:'04/06/2025 16:30', usuario:'Admin', accion:'Publicó', documento:'Plataforma BIOAuditoria en bioauditoria.com' },
    { fecha:'04/06/2025 11:00', usuario:'Admin', accion:'Creó', documento:'Repositorio GitHub biocolombiaplus-max/bioauditoria' },
    { fecha:'04/06/2025 09:00', usuario:'Sistema', accion:'Alerta', documento:'Hoja de vida e Inventario dotación — pendientes completar' },
  ],

  verificacion_3100: [
    { estandar:'1', descripcion:'Talento humano — idoneidad y suficiencia acreditada', estado:'pendiente' },
    { estandar:'2', descripcion:'Tarjeta profesional vigente y registrada en RETHUS', estado:'pendiente' },
    { estandar:'3', descripcion:'Certificados de vacunación del personal de salud', estado:'requerido' },
    { estandar:'4', descripcion:'Dotación básica consultorio medicina general completa', estado:'vigente' },
    { estandar:'5', descripcion:'Equipos biomédicos con hojas de vida y mantenimiento', estado:'vigente' },
    { estandar:'6', descripcion:'Infraestructura física adecuada para el servicio', estado:'vigente' },
    { estandar:'7', descripcion:'Manual de bioseguridad disponible y socializado', estado:'vigente' },
    { estandar:'8', descripcion:'EPP disponible y suficiente', estado:'vigente' },
    { estandar:'9', descripcion:'Protocolo lavado de manos implementado', estado:'vigente' },
    { estandar:'10', descripcion:'PGIRH actualizado con gestor externo contratado', estado:'vigente' },
    { estandar:'11', descripcion:'Segregación correcta de residuos en la fuente', estado:'vigente' },
    { estandar:'12', descripcion:'Formato de historia clínica estandarizado', estado:'vigente' },
    { estandar:'13', descripcion:'Consentimientos informados vigentes disponibles', estado:'vigente' },
    { estandar:'14', descripcion:'Manual de calidad disponible', estado:'vigente' },
    { estandar:'15', descripcion:'Programa de seguridad del paciente implementado', estado:'vigente' },
    { estandar:'16', descripcion:'Sistema de PQRS operativo', estado:'vigente' },
    { estandar:'17', descripcion:'Política habeas data publicada (Ley 1581/2012)', estado:'vigente' },
    { estandar:'18', descripcion:'Plan de gestión del riesgo de desastres', estado:'vigente' },
    { estandar:'19', descripcion:'Botiquín de primeros auxilios completo y vigente', estado:'vigente' },
    { estandar:'20', descripcion:'Control de medicamentos y vencimientos al día', estado:'vigente' },
    { estandar:'21', descripcion:'Protocolo procedimientos estéticos no invasivos', estado:'vigente' },
    { estandar:'22', descripcion:'Consentimientos estéticos disponibles', estado:'vigente' },
    { estandar:'23', descripcion:'Inventario dotación actualizado y firmado', estado:'pendiente' },
    { estandar:'24', descripcion:'Indicadores de calidad con seguimiento', estado:'vigente' },
    { estandar:'25', descripcion:'Programa inducción/reinducción ejecutado', estado:'vigente' },
  ],

  // URL base para descargar documentos desde GitHub
  github_docs_url: GITHUB_DOCS,
};

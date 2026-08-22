/* BIOsoft — Texto legal del Consentimiento Informado para Toma de Muestras
   de Laboratorio Clínico, conforme a la Resolución 3100 de 2019 (Ministerio
   de Salud y Protección Social, Colombia), la Ley 23 de 1981 (Código de
   Ética Médica) y la Ley 1581 de 2012 (protección de datos personales).
   Módulo compartido, sin dependencias, para poder usarse tanto dentro de la
   app (pdf-consentimiento.js) como en la página pública y ligera de firma
   remota (firmar.html). */
(function (global) {
  "use strict";

  var PROCEDIMIENTOS = {
    venopuncion: "Punción venosa (toma de una muestra de sangre de una vena, generalmente del brazo)",
    capilar: "Punción capilar (toma de una muestra de sangre del dedo o, en lactantes, del talón)",
    no_invasivo: "Toma de muestra no invasiva (orina, materia fecal, hisopado u otro tipo de muestra que no requiere punción)"
  };

  function buildTextoConsentimiento(tenantNombre, procedimientoKey, examenesNombres) {
    var procedimientoLabel = PROCEDIMIENTOS[procedimientoKey] || PROCEDIMIENTOS.venopuncion;
    var listaExamenes = (examenesNombres && examenesNombres.length) ? examenesNombres.join(", ") : "los exámenes indicados en la orden";
    return {
      titulo: "CONSENTIMIENTO INFORMADO PARA TOMA DE MUESTRAS DE LABORATORIO CLÍNICO",
      parrafos: [
        "En cumplimiento de la Resolución 3100 de 2019 del Ministerio de Salud y Protección Social, la Ley 23 de 1981 (Código de Ética Médica) y la Ley 1581 de 2012 (protección de datos personales), " + (tenantNombre || "el laboratorio") + " le informa lo siguiente antes de realizar el procedimiento de toma de muestra:",
        "1. PROCEDIMIENTO A REALIZAR: " + procedimientoLabel + ", con el fin de obtener la(s) muestra(s) biológica(s) necesaria(s) para procesar: " + listaExamenes + ".",
        "2. OBJETIVO: La muestra obtenida se procesará exclusivamente con fines de apoyo diagnóstico, para contribuir a la evaluación de su estado de salud por parte de su médico tratante.",
        "3. RIESGOS Y MOLESTIAS: Procedimiento de bajo riesgo. Puede presentarse dolor leve y transitorio en el sitio de punción, un pequeño hematoma (moretón), mareo o lipotimia (desvanecimiento) durante o después del procedimiento y, en muy raras ocasiones, infección local. En pacientes con venas de difícil acceso puede requerirse más de una punción.",
        "4. BENEFICIOS: La información obtenida permitirá apoyar el diagnóstico, seguimiento o control de su condición de salud.",
        "5. ALTERNATIVAS: La realización de este procedimiento es siempre voluntaria; de existir una alternativa distinta, su médico tratante se la habrá indicado previamente.",
        "6. CONFIDENCIALIDAD Y TRATAMIENTO DE DATOS: Sus datos personales y los resultados de sus exámenes se tratarán de forma confidencial conforme a la Ley 1581 de 2012, y solo se entregarán a usted, a su médico tratante o a quien usted autorice expresamente. Si algún examen requiere remitirse a un laboratorio de referencia externo, este consentimiento también autoriza dicha remisión, bajo las mismas condiciones de confidencialidad.",
        "7. REVOCATORIA: Usted puede revocar este consentimiento en cualquier momento antes de la toma de la muestra, sin que ello genere consecuencia alguna, comunicándolo al personal del laboratorio.",
        "DECLARACIÓN: Declaro que he sido informado(a) de forma clara y suficiente sobre el procedimiento a realizar, sus riesgos, beneficios y alternativas; que he podido resolver mis dudas e inquietudes; y que, en pleno uso de mis facultades (o como representante legal del paciente), otorgo mi consentimiento libre, voluntario y consciente para la realización del procedimiento descrito."
      ]
    };
  }

  global.BIO_CONSENTIMIENTO_TEXTO = { PROCEDIMIENTOS: PROCEDIMIENTOS, buildTextoConsentimiento: buildTextoConsentimiento };
})(window);

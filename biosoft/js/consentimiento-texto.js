/* BIOsoft — Texto legal del Consentimiento Informado para Toma de Muestras
   de Laboratorio Clínico, conforme a la Resolución 3100 de 2019 (Ministerio
   de Salud y Protección Social, Colombia), la Ley 23 de 1981 (Código de
   Ética Médica) y la Ley 1581 de 2012 (protección de datos personales).
   Módulo compartido, sin dependencias, para poder usarse tanto dentro de la
   app (pdf-consentimiento.js) como en la página pública y ligera de firma
   remota (firmar.html).

   Cada procedimiento trae su propio texto de riesgos/molestias, porque una
   punción venosa y, por ejemplo, un frotis vaginal no comparten los mismos
   riesgos — así el documento queda ajustado a lo que realmente se le va a
   hacer al paciente en vez de un texto genérico. */
(function (global) {
  "use strict";

  var PROCEDIMIENTOS = {
    venopuncion: {
      nombre: "Punción venosa (toma de una muestra de sangre de una vena, generalmente del brazo)",
      riesgos: "Procedimiento de bajo riesgo. Puede presentarse dolor leve y transitorio en el sitio de punción, un pequeño hematoma (moretón), mareo o lipotimia (desvanecimiento) durante o después del procedimiento y, en muy raras ocasiones, infección local. En pacientes con venas de difícil acceso puede requerirse más de una punción."
    },
    capilar: {
      nombre: "Punción capilar (toma de una muestra de sangre del dedo o, en lactantes, del talón)",
      riesgos: "Procedimiento de muy bajo riesgo. Puede presentarse dolor leve y transitorio en el sitio de punción y, en muy raras ocasiones, un pequeño hematoma o infección local."
    },
    arterial: {
      nombre: "Punción arterial (toma de sangre de una arteria, generalmente en la muñeca, para gases arteriales)",
      riesgos: "Procedimiento algo más delicado que la punción venosa, realizado por personal capacitado. Puede presentarse dolor más intenso en el sitio de punción y un hematoma; en muy raras ocasiones, espasmo arterial, sangrado prolongado o lesión de estructuras cercanas."
    },
    vaginal: {
      nombre: "Toma de muestra de secreción o flujo vaginal, con espéculo estéril desechable",
      riesgos: "Procedimiento de bajo riesgo, realizado con espéculo estéril desechable, preservando en todo momento su privacidad e intimidad. Puede presentarse leve molestia o incomodidad durante la toma y, en muy raras ocasiones, un sangrado leve."
    },
    faringeo: {
      nombre: "Hisopado o frotis faríngeo (toma de muestra de la garganta con un hisopo)",
      riesgos: "Procedimiento de bajo riesgo. Puede presentarse náusea o arcadas leves y transitorias durante la toma de la muestra."
    },
    nasofaringeo: {
      nombre: "Hisopado nasofaríngeo (toma de muestra de la nariz con un hisopo)",
      riesgos: "Procedimiento de bajo riesgo. Puede presentarse molestia leve, estornudo, lagrimeo o, en muy raras ocasiones, un pequeño sangrado nasal."
    },
    otico: {
      nombre: "Hisopado ótico (toma de muestra del oído con un hisopo)",
      riesgos: "Procedimiento de bajo riesgo. Puede presentarse una leve molestia durante la toma de la muestra."
    },
    esputo: {
      nombre: "Toma de muestra de esputo (expectoración)",
      riesgos: "Procedimiento no invasivo. Puede requerir tos forzada para obtener una muestra adecuada; no representa riesgos relevantes para su salud."
    },
    perianal: {
      nombre: "Escobillado perianal / Test de Graham (toma de muestra de la piel perianal con cinta adhesiva)",
      riesgos: "Procedimiento no invasivo y de muy bajo riesgo. Puede presentarse una leve incomodidad durante la toma."
    },
    no_invasivo: {
      nombre: "Toma de muestra no invasiva (orina, materia fecal u otra muestra que usted mismo entrega)",
      riesgos: "Procedimiento sin riesgo relevante, ya que la muestra es recolectada y entregada por el propio paciente siguiendo las indicaciones del laboratorio."
    }
  };

  function buildTextoConsentimiento(tenantNombre, procedimientoKey, examenesNombres) {
    var proc = PROCEDIMIENTOS[procedimientoKey] || PROCEDIMIENTOS.venopuncion;
    // Se limita la lista a 6 exámenes en el texto (con "y N más") para que
    // una orden con muchos exámenes no alargue el párrafo hasta desbordar
    // la hoja — el detalle completo igual queda en la orden.
    var listaExamenes = "los exámenes indicados en la orden";
    if (examenesNombres && examenesNombres.length) {
      listaExamenes = examenesNombres.length > 6
        ? examenesNombres.slice(0, 6).join(", ") + " y " + (examenesNombres.length - 6) + " examen(es) más"
        : examenesNombres.join(", ");
    }
    return {
      titulo: "CONSENTIMIENTO INFORMADO PARA TOMA DE MUESTRAS DE LABORATORIO CLÍNICO",
      parrafos: [
        "En cumplimiento de la Resolución 3100 de 2019 del Ministerio de Salud y Protección Social, la Ley 23 de 1981 (Código de Ética Médica) y la Ley 1581 de 2012 (protección de datos personales), " + (tenantNombre || "el laboratorio") + " le informa lo siguiente antes de realizar el procedimiento de toma de muestra:",
        "1. PROCEDIMIENTO A REALIZAR: " + proc.nombre + ", con el fin de obtener la(s) muestra(s) biológica(s) necesaria(s) para procesar: " + listaExamenes + ".",
        "2. OBJETIVO: La muestra obtenida se procesará exclusivamente con fines de apoyo diagnóstico, para contribuir a la evaluación de su estado de salud por parte de su médico tratante.",
        "3. RIESGOS Y MOLESTIAS: " + proc.riesgos,
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

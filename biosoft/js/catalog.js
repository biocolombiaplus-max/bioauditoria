/* BIOsoft — Catálogo de secciones, exámenes y datos de referencia (CO/VE/EC)
   Los códigos CUPS incluidos son de referencia general (Res. 3100/4678 y actualizaciones).
   El administrador de cada laboratorio puede editarlos desde el panel de Catálogo
   para ajustarlos a la normativa vigente y a su manual tarifario. */
(function (global) {
  "use strict";

  var SECCIONES = [
    { id: "hematologia", nombre: "Hematología", icono: "droplet" },
    { id: "coagulacion", nombre: "Coagulación / Hemostasia", icono: "activity" },
    { id: "banco", nombre: "Banco de Sangre / Inmunohematología", icono: "shield" },
    { id: "quimica", nombre: "Química Sanguínea", icono: "flask" },
    { id: "uroanalisis", nombre: "Uroanálisis", icono: "beaker" },
    { id: "coprologia", nombre: "Coprología y Parasitología", icono: "leaf" },
    { id: "inmunologia", nombre: "Inmunología y Serología", icono: "shield-check" },
    { id: "microbiologia", nombre: "Microbiología y Bacteriología", icono: "microscope" },
    { id: "hormonas", nombre: "Endocrinología (Hormonas)", icono: "atom" },
    { id: "marcadores", nombre: "Marcadores Tumorales", icono: "target" },
    { id: "gases", nombre: "Gases Arteriales y Electrolitos", icono: "wind" },
    { id: "especiales", nombre: "Química Especial (Segundo Nivel)", icono: "flask-conical" },
    { id: "pruebasrapidas", nombre: "Pruebas Rápidas / POCT", icono: "zap" }
  ];

  function num(codigo, nombre, unidad, min, max, refText) {
    return { codigo: codigo, nombre: nombre, unidad: unidad, tipo: "numerico", min: min, max: max, refText: refText || (min + " - " + max + " " + unidad) };
  }
  function cual(codigo, nombre, opciones, normal, refText) {
    return { codigo: codigo, nombre: nombre, unidad: "", tipo: "cualitativo", opciones: opciones, normal: normal, refText: refText || ("Normal: " + normal) };
  }
  function texto(codigo, nombre, refText) {
    return { codigo: codigo, nombre: nombre, unidad: "", tipo: "texto", refText: refText || "" };
  }

  var EXAMENES = [
    // ---------------- HEMATOLOGÍA ----------------
    {
      id: "HEM-001", seccion: "hematologia", nombre: "Cuadro Hemático (Hemograma IV)", cups: "902210", nivel: 1,
      muestra: "Sangre total EDTA", metodo: "Citometría de flujo / Impedancia",
      parametros: [
        num("HB", "Hemoglobina", "g/dL", 12.0, 16.0),
        num("HTO", "Hematocrito", "%", 36, 48),
        num("LEU", "Leucocitos", "x10³/µL", 4.5, 11.0),
        num("NEUT", "Neutrófilos", "%", 40, 70),
        num("LINF", "Linfocitos", "%", 20, 45),
        num("MONO", "Monocitos", "%", 2, 10),
        num("EOS", "Eosinófilos", "%", 0, 6),
        num("BASO", "Basófilos", "%", 0, 2),
        num("PLT", "Plaquetas", "x10³/µL", 150, 450),
        num("VCM", "VCM", "fL", 80, 100),
        num("HCM", "HCM", "pg", 27, 33),
        num("CHCM", "CHCM", "g/dL", 32, 36),
        num("RDW", "RDW", "%", 11.5, 14.5)
      ]
    },
    { id: "HEM-002", seccion: "hematologia", nombre: "Recuento de Reticulocitos", cups: "902241", nivel: 1, muestra: "Sangre total EDTA", metodo: "Coloración vital",
      parametros: [num("RETIC", "Reticulocitos", "%", 0.5, 2.5)] },
    { id: "HEM-003", seccion: "hematologia", nombre: "Velocidad de Sedimentación Globular (VSG)", cups: "903230", nivel: 1, muestra: "Sangre total citrato", metodo: "Westergren",
      parametros: [num("VSG", "VSG 1 hora", "mm/h", 0, 20, "0-20 mm/h (mujer un poco mayor)")] },
    { id: "HEM-004", seccion: "hematologia", nombre: "Extendido de Sangre Periférica", cups: "902225", nivel: 1, muestra: "Sangre total EDTA", metodo: "Microscopía óptica",
      parametros: [texto("MORFO", "Descripción morfológica", "Sin alteraciones morfológicas relevantes")] },
    { id: "HEM-005", seccion: "hematologia", nombre: "Recuento de Plaquetas (aislado)", cups: "902217", nivel: 1, muestra: "Sangre total EDTA", metodo: "Impedancia",
      parametros: [num("PLT", "Plaquetas", "x10³/µL", 150, 450)] },

    // ---------------- COAGULACIÓN ----------------
    { id: "COA-001", seccion: "coagulacion", nombre: "Tiempo de Protrombina (PT/INR)", cups: "903707", nivel: 1, muestra: "Plasma citratado", metodo: "Coagulométrico",
      parametros: [num("PT", "Tiempo de Protrombina", "seg", 10, 14), num("INR", "INR", "", 0.8, 1.2, "0.8 - 1.2")] },
    { id: "COA-002", seccion: "coagulacion", nombre: "Tiempo Parcial de Tromboplastina (PTT)", cups: "903714", nivel: 1, muestra: "Plasma citratado", metodo: "Coagulométrico",
      parametros: [num("PTT", "PTT", "seg", 25, 35)] },
    { id: "COA-003", seccion: "coagulacion", nombre: "Fibrinógeno", cups: "903721", nivel: 2, muestra: "Plasma citratado", metodo: "Clauss",
      parametros: [num("FIB", "Fibrinógeno", "mg/dL", 200, 400)] },

    // ---------------- BANCO DE SANGRE ----------------
    { id: "BAN-001", seccion: "banco", nombre: "Grupo Sanguíneo y Factor Rh", cups: "903610", nivel: 1, muestra: "Sangre total EDTA", metodo: "Hemaglutinación",
      parametros: [cual("GRUPO", "Grupo ABO", ["O", "A", "B", "AB"], "—", "—"), cual("RH", "Factor Rh", ["Positivo", "Negativo"], "Positivo")] },
    { id: "BAN-002", seccion: "banco", nombre: "Coombs Directo", cups: "903622", nivel: 1, muestra: "Sangre total EDTA", metodo: "Antiglobulina directa",
      parametros: [cual("COOMBSD", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "BAN-003", seccion: "banco", nombre: "Coombs Indirecto", cups: "903634", nivel: 1, muestra: "Suero", metodo: "Antiglobulina indirecta",
      parametros: [cual("COOMBSI", "Resultado", ["Negativo", "Positivo"], "Negativo")] },

    // ---------------- QUÍMICA SANGUÍNEA ----------------
    { id: "QUI-001", seccion: "quimica", nombre: "Glucosa Basal", cups: "903841", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico",
      parametros: [num("GLU", "Glucosa", "mg/dL", 70, 100)] },
    { id: "QUI-002", seccion: "quimica", nombre: "Glucosa 2 Horas Postprandial", cups: "903847", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico",
      parametros: [num("GLU2H", "Glucosa 2h", "mg/dL", 70, 140)] },
    { id: "QUI-003", seccion: "quimica", nombre: "Hemoglobina Glicosilada (HbA1c)", cups: "903872", nivel: 1, muestra: "Sangre total EDTA", metodo: "HPLC / Turbidimetría",
      parametros: [num("HBA1C", "HbA1c", "%", 4.0, 5.6)] },
    { id: "QUI-004", seccion: "quimica", nombre: "Colesterol Total", cups: "903818", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico",
      parametros: [num("COLT", "Colesterol Total", "mg/dL", 0, 200)] },
    { id: "QUI-005", seccion: "quimica", nombre: "Colesterol HDL", cups: "903820", nivel: 1, muestra: "Suero", metodo: "Enzimático directo",
      parametros: [num("HDL", "HDL", "mg/dL", 40, 60)] },
    { id: "QUI-006", seccion: "quimica", nombre: "Colesterol LDL (calculado)", cups: "903822", nivel: 1, muestra: "Suero", metodo: "Fórmula de Friedewald",
      parametros: [num("LDL", "LDL", "mg/dL", 0, 130)] },
    { id: "QUI-007", seccion: "quimica", nombre: "Triglicéridos", cups: "903824", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico",
      parametros: [num("TGD", "Triglicéridos", "mg/dL", 0, 150)] },
    { id: "QUI-008", seccion: "quimica", nombre: "Creatinina", cups: "903895", nivel: 1, muestra: "Suero", metodo: "Jaffé cinético",
      parametros: [num("CREA", "Creatinina", "mg/dL", 0.6, 1.3)] },
    { id: "QUI-009", seccion: "quimica", nombre: "Nitrógeno Ureico (BUN)", cups: "903872", nivel: 1, muestra: "Suero", metodo: "Enzimático UV",
      parametros: [num("BUN", "BUN", "mg/dL", 7, 20)] },
    { id: "QUI-010", seccion: "quimica", nombre: "Ácido Úrico", cups: "903890", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico",
      parametros: [num("AURI", "Ácido Úrico", "mg/dL", 3.5, 7.2)] },
    { id: "QUI-011", seccion: "quimica", nombre: "Bilirrubinas Total y Directa", cups: "903810", nivel: 1, muestra: "Suero", metodo: "Colorimétrico (Jendrassik-Grof)",
      parametros: [num("BT", "Bilirrubina Total", "mg/dL", 0.2, 1.2), num("BD", "Bilirrubina Directa", "mg/dL", 0.0, 0.3), num("BI", "Bilirrubina Indirecta", "mg/dL", 0.1, 0.9)] },
    { id: "QUI-012", seccion: "quimica", nombre: "Proteínas Totales y Albúmina", cups: "903833", nivel: 1, muestra: "Suero", metodo: "Biuret / Verde de Bromocresol",
      parametros: [num("PT_", "Proteínas Totales", "g/dL", 6.4, 8.3), num("ALB", "Albúmina", "g/dL", 3.5, 5.0), num("GLOB", "Globulinas", "g/dL", 2.0, 3.5)] },
    { id: "QUI-013", seccion: "quimica", nombre: "AST (TGO)", cups: "903840", nivel: 1, muestra: "Suero", metodo: "UV cinético IFCC",
      parametros: [num("AST", "AST/TGO", "U/L", 5, 40)] },
    { id: "QUI-014", seccion: "quimica", nombre: "ALT (TGP)", cups: "903835", nivel: 1, muestra: "Suero", metodo: "UV cinético IFCC",
      parametros: [num("ALT", "ALT/TGP", "U/L", 5, 41)] },
    { id: "QUI-015", seccion: "quimica", nombre: "Fosfatasa Alcalina", cups: "903849", nivel: 1, muestra: "Suero", metodo: "Cinético colorimétrico",
      parametros: [num("FA", "Fosfatasa Alcalina", "U/L", 40, 130)] },
    { id: "QUI-016", seccion: "quimica", nombre: "Gamma Glutamil Transferasa (GGT)", cups: "903850", nivel: 1, muestra: "Suero", metodo: "Cinético colorimétrico",
      parametros: [num("GGT", "GGT", "U/L", 8, 61)] },
    { id: "QUI-017", seccion: "quimica", nombre: "Amilasa", cups: "903806", nivel: 2, muestra: "Suero", metodo: "Cinético colorimétrico",
      parametros: [num("AMIL", "Amilasa", "U/L", 28, 100)] },
    { id: "QUI-018", seccion: "quimica", nombre: "Lipasa", cups: "903868", nivel: 2, muestra: "Suero", metodo: "Cinético colorimétrico",
      parametros: [num("LIP", "Lipasa", "U/L", 13, 60)] },
    { id: "QUI-019", seccion: "quimica", nombre: "Deshidrogenasa Láctica (LDH)", cups: "903869", nivel: 2, muestra: "Suero", metodo: "Cinético UV",
      parametros: [num("LDH", "LDH", "U/L", 120, 246)] },
    { id: "QUI-020", seccion: "quimica", nombre: "CPK Total", cups: "903815", nivel: 2, muestra: "Suero", metodo: "Cinético UV",
      parametros: [num("CPK", "CPK Total", "U/L", 30, 200)] },
    { id: "QUI-021", seccion: "quimica", nombre: "CPK-MB", cups: "903816", nivel: 2, muestra: "Suero", metodo: "Inmunoinhibición",
      parametros: [num("CPKMB", "CPK-MB", "U/L", 0, 25)] },
    { id: "QUI-022", seccion: "quimica", nombre: "Troponina I", cups: "903629", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("TROP", "Troponina I", "ng/mL", 0, 0.04)] },
    { id: "QUI-023", seccion: "quimica", nombre: "Calcio Sérico", cups: "903812", nivel: 1, muestra: "Suero", metodo: "Colorimétrico (Arsenazo III)",
      parametros: [num("CA", "Calcio", "mg/dL", 8.5, 10.5)] },
    { id: "QUI-024", seccion: "quimica", nombre: "Fósforo Sérico", cups: "903880", nivel: 1, muestra: "Suero", metodo: "Colorimétrico UV",
      parametros: [num("P", "Fósforo", "mg/dL", 2.5, 4.5)] },
    { id: "QUI-025", seccion: "quimica", nombre: "Magnesio Sérico", cups: "903874", nivel: 2, muestra: "Suero", metodo: "Colorimétrico",
      parametros: [num("MG", "Magnesio", "mg/dL", 1.6, 2.6)] },
    { id: "QUI-026", seccion: "quimica", nombre: "Hierro Sérico", cups: "903860", nivel: 2, muestra: "Suero", metodo: "Colorimétrico Ferrozina",
      parametros: [num("FE", "Hierro", "µg/dL", 50, 170)] },
    { id: "QUI-027", seccion: "quimica", nombre: "Ferritina", cups: "904238", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("FERR", "Ferritina", "ng/mL", 15, 200)] },

    // ---------------- UROANÁLISIS ----------------
    { id: "URO-001", seccion: "uroanalisis", nombre: "Parcial de Orina", cups: "907106", nivel: 1, muestra: "Orina espontánea", metodo: "Físico-químico + sedimento",
      parametros: [
        cual("COLOR", "Color", ["Amarillo", "Amarillo claro", "Ámbar", "Rojizo", "Otro"], "Amarillo"),
        cual("ASPECTO", "Aspecto", ["Claro", "Ligeramente turbio", "Turbio"], "Claro"),
        num("DENS", "Densidad", "", 1.005, 1.030),
        num("PH", "pH", "", 5.0, 8.0),
        cual("PROT", "Proteínas", ["Negativo", "Trazas", "1+", "2+", "3+"], "Negativo"),
        cual("GLUO", "Glucosa", ["Negativo", "Trazas", "1+", "2+", "3+"], "Negativo"),
        cual("CET", "Cetonas", ["Negativo", "Trazas", "1+", "2+", "3+"], "Negativo"),
        cual("SANG", "Sangre", ["Negativo", "Trazas", "1+", "2+", "3+"], "Negativo"),
        cual("NIT", "Nitritos", ["Negativo", "Positivo"], "Negativo"),
        num("LEUO", "Leucocitos (sedimento)", "x campo", 0, 5),
        num("HEMO", "Hematíes (sedimento)", "x campo", 0, 3),
        texto("SEDOBS", "Otros hallazgos del sedimento", "Sin hallazgos patológicos")
      ]
    },
    { id: "URO-002", seccion: "uroanalisis", nombre: "Microalbuminuria", cups: "907113", nivel: 2, muestra: "Orina 24h / muestra aislada", metodo: "Inmunoturbidimetría",
      parametros: [num("MALB", "Microalbuminuria", "mg/L", 0, 20)] },
    { id: "URO-003", seccion: "uroanalisis", nombre: "Depuración de Creatinina en Orina 24h", cups: "903897", nivel: 2, muestra: "Orina 24 horas", metodo: "Cálculo con creatinina sérica",
      parametros: [num("DEPCR", "Depuración de Creatinina", "mL/min", 90, 130)] },

    // ---------------- COPROLOGÍA Y PARASITOLOGÍA ----------------
    { id: "COP-001", seccion: "coprologia", nombre: "Coprológico (Examen General de Heces)", cups: "907205", nivel: 1, muestra: "Materia fecal", metodo: "Macroscópico / microscópico",
      parametros: [texto("COPOBS", "Hallazgos", "No se observan parásitos ni elementos anormales")] },
    { id: "COP-002", seccion: "coprologia", nombre: "Sangre Oculta en Heces", cups: "907211", nivel: 1, muestra: "Materia fecal", metodo: "Inmunocromatografía",
      parametros: [cual("SOH", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "COP-003", seccion: "coprologia", nombre: "Coproparasitológico Seriado (x3)", cups: "907212", nivel: 1, muestra: "Materia fecal (3 muestras)", metodo: "Concentración + directo",
      parametros: [texto("PARSER", "Hallazgos parasitológicos", "No se observan parásitos ni quistes")] },
    { id: "COP-004", seccion: "coprologia", nombre: "Test de Graham (Escobillado Perianal)", cups: "907214", nivel: 1, muestra: "Escobillado perianal", metodo: "Microscopía directa",
      parametros: [cual("GRAHAM", "Huevos de Enterobius vermicularis", ["No se observan", "Se observan"], "No se observan")] },

    // ---------------- INMUNOLOGÍA Y SEROLOGÍA ----------------
    { id: "INM-001", seccion: "inmunologia", nombre: "VDRL / RPR", cups: "906909", nivel: 1, muestra: "Suero", metodo: "Floculación",
      parametros: [cual("VDRL", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-002", seccion: "inmunologia", nombre: "Prueba Treponémica (FTA-ABS/TPHA)", cups: "906915", nivel: 2, muestra: "Suero", metodo: "Inmunofluorescencia / Hemaglutinación",
      parametros: [cual("TREPO", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-003", seccion: "inmunologia", nombre: "Prueba Rápida VIH", cups: "906965", nivel: 1, muestra: "Suero / sangre total", metodo: "Inmunocromatografía",
      parametros: [cual("VIH", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-004", seccion: "inmunologia", nombre: "Antígeno de Superficie Hepatitis B (HBsAg)", cups: "906038", nivel: 1, muestra: "Suero", metodo: "Inmunocromatografía / ELISA",
      parametros: [cual("HBSAG", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-005", seccion: "inmunologia", nombre: "Anticuerpos Anti-VHC (Hepatitis C)", cups: "906042", nivel: 2, muestra: "Suero", metodo: "ELISA / Inmunocromatografía",
      parametros: [cual("VHC", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-006", seccion: "inmunologia", nombre: "Prueba de Embarazo en Sangre (BHCG cualitativa)", cups: "903942", nivel: 1, muestra: "Suero", metodo: "Inmunocromatografía",
      parametros: [cual("BHCGQ", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "INM-007", seccion: "inmunologia", nombre: "BHCG Cuantitativa", cups: "903944", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("BHCG", "BHCG", "mUI/mL", 0, 5)] },
    { id: "INM-008", seccion: "inmunologia", nombre: "Proteína C Reactiva (PCR)", cups: "906030", nivel: 1, muestra: "Suero", metodo: "Turbidimetría",
      parametros: [num("PCR", "PCR", "mg/L", 0, 10)] },
    { id: "INM-009", seccion: "inmunologia", nombre: "Antiestreptolisinas O (ASTO)", cups: "906010", nivel: 1, muestra: "Suero", metodo: "Turbidimetría / Látex",
      parametros: [num("ASTO", "ASTO", "UI/mL", 0, 200)] },
    { id: "INM-010", seccion: "inmunologia", nombre: "Factor Reumatoide", cups: "906027", nivel: 1, muestra: "Suero", metodo: "Turbidimetría / Látex",
      parametros: [num("FR", "Factor Reumatoide", "UI/mL", 0, 14)] },
    { id: "INM-011", seccion: "inmunologia", nombre: "Anticuerpos Antinucleares (ANA)", cups: "906104", nivel: 2, muestra: "Suero", metodo: "Inmunofluorescencia indirecta",
      parametros: [cual("ANA", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "INM-012", seccion: "inmunologia", nombre: "Reacciones Febriles (Widal)", cups: "906909", nivel: 1, muestra: "Suero", metodo: "Aglutinación en placa",
      parametros: [texto("WIDAL", "Títulos", "No reactivo / Títulos < 1:80")] },

    // ---------------- MICROBIOLOGÍA Y BACTERIOLOGÍA ----------------
    { id: "MIC-001", seccion: "microbiologia", nombre: "Urocultivo y Antibiograma", cups: "907310", nivel: 1, muestra: "Orina limpia / sondaje", metodo: "Cultivo en agar CLED + antibiograma",
      parametros: [texto("UROCULT", "Recuento y germen aislado", "< 10.000 UFC/mL — Sin crecimiento significativo"), texto("ATB", "Antibiograma", "No aplica (sin crecimiento)")] },
    { id: "MIC-002", seccion: "microbiologia", nombre: "Coprocultivo", cups: "907320", nivel: 2, muestra: "Materia fecal", metodo: "Cultivo selectivo (SS, XLD, Mac Conkey)",
      parametros: [texto("COPROCULT", "Germen aislado", "Flora habitual, no se aíslan patógenos")] },
    { id: "MIC-003", seccion: "microbiologia", nombre: "Cultivo de Secreción Vaginal", cups: "907330", nivel: 1, muestra: "Secreción vaginal", metodo: "Cultivo + Gram",
      parametros: [texto("SVAG", "Resultado", "Flora vaginal habitual")] },
    { id: "MIC-004", seccion: "microbiologia", nombre: "Cultivo de Secreción Faríngea", cups: "907335", nivel: 1, muestra: "Hisopado faríngeo", metodo: "Cultivo en agar sangre",
      parametros: [texto("SFAR", "Resultado", "Flora faríngea habitual")] },
    { id: "MIC-005", seccion: "microbiologia", nombre: "Coloración de Gram", cups: "907110", nivel: 1, muestra: "Según origen", metodo: "Microscopía directa",
      parametros: [texto("GRAM", "Descripción", "Sin microorganismos observados")] },
    { id: "MIC-006", seccion: "microbiologia", nombre: "KOH (Hongos y Levaduras)", cups: "907115", nivel: 1, muestra: "Escama / secreción", metodo: "Microscopía directa con KOH",
      parametros: [cual("KOH", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "MIC-007", seccion: "microbiologia", nombre: "Baciloscopia (BK) Directa", cups: "907360", nivel: 1, muestra: "Esputo", metodo: "Ziehl-Neelsen",
      parametros: [cual("BK", "Bacilos ácido alcohol resistentes", ["No se observan (0)", "1-9 BAAR (Positivo +)", "10-99 BAAR (Positivo ++)", ">99 BAAR (Positivo +++)"], "No se observan (0)")] },
    { id: "MIC-008", seccion: "microbiologia", nombre: "Hemocultivo (Aerobio/Anaerobio)", cups: "907340", nivel: 2, muestra: "Sangre venosa", metodo: "Sistema automatizado + subcultivo",
      parametros: [texto("HEMOC", "Resultado", "Negativo a las 5-7 días de incubación")] },
    { id: "MIC-009", seccion: "microbiologia", nombre: "Cultivo de Esputo", cups: "907345", nivel: 2, muestra: "Esputo", metodo: "Cultivo en agar sangre/chocolate",
      parametros: [texto("ESPUC", "Germen aislado", "Flora respiratoria habitual")] },

    // ---------------- ENDOCRINOLOGÍA / HORMONAS ----------------
    { id: "HOR-001", seccion: "hormonas", nombre: "Hormona Estimulante de Tiroides (TSH)", cups: "904125", nivel: 1, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("TSH", "TSH", "µUI/mL", 0.4, 4.5)] },
    { id: "HOR-002", seccion: "hormonas", nombre: "T4 Libre", cups: "904132", nivel: 1, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("T4L", "T4 Libre", "ng/dL", 0.8, 1.8)] },
    { id: "HOR-003", seccion: "hormonas", nombre: "T3 Total", cups: "904129", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("T3", "T3 Total", "ng/dL", 80, 200)] },
    { id: "HOR-004", seccion: "hormonas", nombre: "Prolactina", cups: "904147", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("PRL", "Prolactina", "ng/mL", 4.0, 23.0)] },
    { id: "HOR-005", seccion: "hormonas", nombre: "Hormona Folículo Estimulante (FSH)", cups: "904138", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("FSH", "FSH", "mUI/mL", 1.5, 12.4)] },
    { id: "HOR-006", seccion: "hormonas", nombre: "Hormona Luteinizante (LH)", cups: "904141", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("LH", "LH", "mUI/mL", 1.7, 8.6)] },
    { id: "HOR-007", seccion: "hormonas", nombre: "Estradiol", cups: "904135", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("E2", "Estradiol", "pg/mL", 12.5, 166)] },
    { id: "HOR-008", seccion: "hormonas", nombre: "Progesterona", cups: "904144", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("PROG", "Progesterona", "ng/mL", 0.2, 25)] },
    { id: "HOR-009", seccion: "hormonas", nombre: "Testosterona Total", cups: "904150", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("TESTO", "Testosterona Total", "ng/dL", 280, 1100, "280 - 1100 ng/dL (hombre adulto)")] },
    { id: "HOR-010", seccion: "hormonas", nombre: "Cortisol Basal (8 AM)", cups: "904120", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("CORT", "Cortisol", "µg/dL", 5, 25)] },
    { id: "HOR-011", seccion: "hormonas", nombre: "Insulina Basal", cups: "904139", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("INSU", "Insulina", "µU/mL", 2.6, 24.9)] },

    // ---------------- MARCADORES TUMORALES ----------------
    { id: "MAR-001", seccion: "marcadores", nombre: "Antígeno Prostático Específico Total (PSA)", cups: "902551", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("PSA", "PSA Total", "ng/mL", 0, 4.0)] },
    { id: "MAR-002", seccion: "marcadores", nombre: "PSA Libre", cups: "902552", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("PSAL", "PSA Libre", "ng/mL", 0, 0.93)] },
    { id: "MAR-003", seccion: "marcadores", nombre: "CA 125", cups: "902560", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("CA125", "CA 125", "U/mL", 0, 35)] },
    { id: "MAR-004", seccion: "marcadores", nombre: "CA 19-9", cups: "902563", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("CA199", "CA 19-9", "U/mL", 0, 37)] },
    { id: "MAR-005", seccion: "marcadores", nombre: "CA 15-3", cups: "902566", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("CA153", "CA 15-3", "U/mL", 0, 31.3)] },
    { id: "MAR-006", seccion: "marcadores", nombre: "Antígeno Carcinoembrionario (CEA)", cups: "902557", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("CEA", "CEA", "ng/mL", 0, 5.0)] },
    { id: "MAR-007", seccion: "marcadores", nombre: "Alfafetoproteína (AFP)", cups: "902554", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("AFP", "AFP", "ng/mL", 0, 10)] },

    // ---------------- GASES Y ELECTROLITOS ----------------
    { id: "GAS-001", seccion: "gases", nombre: "Gases Arteriales", cups: "903910", nivel: 2, muestra: "Sangre arterial heparinizada", metodo: "Electrodo ion-selectivo",
      parametros: [
        num("PH_", "pH", "", 7.35, 7.45),
        num("PCO2", "pCO2", "mmHg", 35, 45),
        num("PO2", "pO2", "mmHg", 80, 100),
        num("HCO3", "HCO3⁻", "mEq/L", 22, 26),
        num("SATO2", "Saturación O2", "%", 95, 100)
      ]
    },
    { id: "GAS-002", seccion: "gases", nombre: "Electrolitos (Na, K, Cl)", cups: "903875", nivel: 1, muestra: "Suero", metodo: "Electrodo ion-selectivo",
      parametros: [num("NA", "Sodio", "mEq/L", 135, 145), num("K", "Potasio", "mEq/L", 3.5, 5.1), num("CL", "Cloro", "mEq/L", 98, 107)] },
    { id: "GAS-003", seccion: "gases", nombre: "Lactato", cups: "903870", nivel: 2, muestra: "Sangre arterial / venosa", metodo: "Enzimático",
      parametros: [num("LACT", "Lactato", "mmol/L", 0.5, 2.2)] },

    // ---------------- QUÍMICA ESPECIAL (2° NIVEL) ----------------
    { id: "ESP-001", seccion: "especiales", nombre: "Vitamina B12", cups: "903790", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("B12", "Vitamina B12", "pg/mL", 200, 900)] },
    { id: "ESP-002", seccion: "especiales", nombre: "Ácido Fólico", cups: "903792", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("FOLI", "Ácido Fólico", "ng/mL", 3.1, 20.5)] },
    { id: "ESP-003", seccion: "especiales", nombre: "Vitamina D (25-OH)", cups: "903795", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("VITD", "25-OH Vitamina D", "ng/mL", 30, 100)] },
    { id: "ESP-004", seccion: "especiales", nombre: "Paratohormona (PTH)", cups: "904160", nivel: 2, muestra: "Suero/Plasma EDTA", metodo: "Quimioluminiscencia",
      parametros: [num("PTH", "PTH Intacta", "pg/mL", 15, 65)] },
    { id: "ESP-005", seccion: "especiales", nombre: "Anticuerpos Anti-TPO", cups: "904128", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia",
      parametros: [num("TPO", "Anti-TPO", "UI/mL", 0, 34)] },
    { id: "ESP-006", seccion: "especiales", nombre: "Electroforesis de Proteínas", cups: "903834", nivel: 2, muestra: "Suero", metodo: "Electroforesis capilar",
      parametros: [texto("EFP", "Bandas e interpretación", "Patrón electroforético sin alteraciones")] },

    // ---------------- PRUEBAS RÁPIDAS / POCT ----------------
    { id: "POC-001", seccion: "pruebasrapidas", nombre: "Prueba Rápida de Embarazo en Orina", cups: "903941", nivel: 1, muestra: "Orina", metodo: "Inmunocromatografía",
      parametros: [cual("BHCGO", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "POC-002", seccion: "pruebasrapidas", nombre: "Glucometría Capilar", cups: "903842", nivel: 1, muestra: "Sangre capilar", metodo: "Tira reactiva / glucómetro",
      parametros: [num("GLUCAP", "Glucosa capilar", "mg/dL", 70, 100)] },
    { id: "POC-003", seccion: "pruebasrapidas", nombre: "Prueba Rápida COVID-19 (Antígeno)", cups: "906980", nivel: 1, muestra: "Hisopado nasofaríngeo", metodo: "Inmunocromatografía",
      parametros: [cual("COVAG", "Resultado", ["No detectado", "Detectado"], "No detectado")] },
    { id: "POC-004", seccion: "pruebasrapidas", nombre: "Prueba Rápida Dual VIH/Sífilis", cups: "906966", nivel: 1, muestra: "Sangre total", metodo: "Inmunocromatografía",
      parametros: [cual("DUAL_VIH", "VIH", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("DUAL_SIF", "Sífilis", ["No Reactivo", "Reactivo"], "No Reactivo")] }
  ];

  var TIPOS_DOCUMENTO = {
    CO: [
      { v: "CC", t: "Cédula de Ciudadanía" },
      { v: "TI", t: "Tarjeta de Identidad" },
      { v: "RC", t: "Registro Civil" },
      { v: "CE", t: "Cédula de Extranjería" },
      { v: "PA", t: "Pasaporte" },
      { v: "PEP", t: "Permiso Especial de Permanencia" },
      { v: "PPT", t: "Permiso por Protección Temporal" },
      { v: "MSI", t: "Menor Sin Identificación" },
      { v: "ASO", t: "Adulto Sin Identificación" },
      { v: "CD", t: "Carné Diplomático" },
      { v: "SC", t: "Salvoconducto" }
    ],
    VE: [
      { v: "VCI", t: "Cédula de Identidad (V)" },
      { v: "ECI", t: "Cédula de Identidad (E - Extranjero)" },
      { v: "PA", t: "Pasaporte" },
      { v: "RIF", t: "RIF" }
    ],
    EC: [
      { v: "CI", t: "Cédula de Identidad" },
      { v: "PA", t: "Pasaporte" },
      { v: "RUC", t: "RUC" }
    ]
  };

  var TIPOS_AFILIACION = {
    CO: ["Contributivo", "Subsidiado", "Vinculado", "Particular", "Medicina Prepagada", "Póliza / Seguro Privado", "SOAT", "ARL", "Otro"],
    VE: ["Seguro Privado", "IVSS", "Particular", "Otro"],
    EC: ["IESS", "ISSFA", "ISSPOL", "Seguro Privado", "Particular", "Otro"]
  };

  var EPS_COLOMBIA = [
    "Nueva EPS", "EPS Sura", "Sanitas", "Compensar", "Famisanar", "Salud Total",
    "Coosalud", "Mutual Ser", "Comfenalco Valle", "Aliansalud", "Capital Salud",
    "Emssanar", "Asmet Salud", "Savia Salud", "Comfaoriente", "Particular", "Otra / No aplica"
  ];

  var PROCEDENCIAS = ["Ambulatorio", "Hospitalizado", "Urgencias", "Consulta Externa", "Domiciliario"];
  var PRIORIDADES = ["Rutina", "Urgente"];

  function seccionNombre(id) {
    var s = SECCIONES.filter(function (x) { return x.id === id; })[0];
    return s ? s.nombre : id;
  }

  function examenPorId(id) {
    return EXAMENES.filter(function (e) { return e.id === id; })[0];
  }

  function calcularFlag(param, valor) {
    if (valor === "" || valor === null || typeof valor === "undefined") return "";
    if (param.tipo === "numerico") {
      var n = parseFloat(valor);
      if (isNaN(n)) return "";
      if (n < param.min) return "BAJO";
      if (n > param.max) return "ALTO";
      return "NORMAL";
    }
    if (param.tipo === "cualitativo") {
      return valor === param.normal ? "NORMAL" : "ANORMAL";
    }
    return "";
  }

  global.BIO_CATALOG = {
    SECCIONES: SECCIONES,
    EXAMENES: EXAMENES,
    TIPOS_DOCUMENTO: TIPOS_DOCUMENTO,
    TIPOS_AFILIACION: TIPOS_AFILIACION,
    EPS_COLOMBIA: EPS_COLOMBIA,
    PROCEDENCIAS: PROCEDENCIAS,
    PRIORIDADES: PRIORIDADES,
    seccionNombre: seccionNombre,
    examenPorId: examenPorId,
    calcularFlag: calcularFlag
  };
})(window);

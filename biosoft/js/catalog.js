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

  /* Tipos de tubo/recipiente para toma de muestra, usados en la captura de
     resultados y en la impresión de stickers para rotular tubos. */
  var TUBOS = {
    edta: { nombre: "Tapa Lila (EDTA)", color: "#7c3aed" },
    citrato: { nombre: "Tapa Celeste (Citrato de Sodio)", color: "#38bdf8" },
    seco: { nombre: "Tapa Roja (Seco / Sin anticoagulante)", color: "#dc2626" },
    gel: { nombre: "Tapa Amarilla (Gel Separador / SST)", color: "#eab308" },
    fluoruro: { nombre: "Tapa Gris (Fluoruro de Sodio)", color: "#9ca3af" },
    heparina: { nombre: "Tapa Verde (Heparina de Litio)", color: "#16a34a" },
    orina: { nombre: "Frasco de Orina", color: "#fbbf24" },
    orina24h: { nombre: "Recipiente de Orina 24 Horas", color: "#f59e0b" },
    heces: { nombre: "Frasco de Coprológico", color: "#92400e" },
    hisopo: { nombre: "Hisopo / Tórula Estéril", color: "#64748b" },
    esputo: { nombre: "Frasco Estéril de Esputo", color: "#475569" },
    hemocultivo: { nombre: "Frasco de Hemocultivo", color: "#0f172a" },
    capilar: { nombre: "Muestra Capilar (Lanceta)", color: "#f472b6" }
  };

  function num(codigo, nombre, unidad, min, max, refText) {
    return { codigo: codigo, nombre: nombre, unidad: unidad, tipo: "numerico", min: min, max: max, refText: refText || (min + " - " + max + " " + unidad) };
  }
  function cual(codigo, nombre, opciones, normal, refText) {
    return { codigo: codigo, nombre: nombre, unidad: "", tipo: "cualitativo", opciones: opciones, normal: normal, refText: refText || ("Normal: " + normal) };
  }
  function desc(codigo, nombre, opciones, refText) {
    return { codigo: codigo, nombre: nombre, unidad: "", tipo: "descriptivo", opciones: opciones, refText: refText || "" };
  }
  function texto(codigo, nombre, refText) {
    return { codigo: codigo, nombre: nombre, unidad: "", tipo: "texto", refText: refText || "" };
  }

  var EXAMENES = [
    // ---------------- HEMATOLOGÍA ----------------
    {
      id: "HEM-001", seccion: "hematologia", nombre: "Cuadro Hemático (Hemograma IV)", cups: "902210", nivel: 1,
      muestra: "Sangre total EDTA", metodo: "Citometría de flujo / Impedancia", tubo: "edta",
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
    { id: "HEM-002", seccion: "hematologia", nombre: "Recuento de Reticulocitos", cups: "902241", nivel: 1, muestra: "Sangre total EDTA", metodo: "Coloración vital", tubo: "edta",
      parametros: [num("RETIC", "Reticulocitos", "%", 0.5, 2.5)] },
    { id: "HEM-003", seccion: "hematologia", nombre: "Velocidad de Sedimentación Globular (VSG)", cups: "903230", nivel: 1, muestra: "Sangre total citrato", metodo: "Westergren", tubo: "citrato",
      parametros: [num("VSG", "VSG 1 hora", "mm/h", 0, 20, "0-20 mm/h (mujer un poco mayor)")] },
    { id: "HEM-004", seccion: "hematologia", nombre: "Extendido de Sangre Periférica", cups: "902225", nivel: 1, muestra: "Sangre total EDTA", metodo: "Microscopía óptica", tubo: "edta",
      parametros: [texto("MORFO", "Descripción morfológica", "Sin alteraciones morfológicas relevantes")] },
    { id: "HEM-005", seccion: "hematologia", nombre: "Recuento de Plaquetas (aislado)", cups: "902217", nivel: 1, muestra: "Sangre total EDTA", metodo: "Impedancia", tubo: "edta",
      parametros: [num("PLT", "Plaquetas", "x10³/µL", 150, 450)] },

    // ---------------- COAGULACIÓN ----------------
    { id: "COA-001", seccion: "coagulacion", nombre: "Tiempo de Protrombina (PT/INR)", cups: "903707", nivel: 1, muestra: "Plasma citratado", metodo: "Coagulométrico", tubo: "citrato",
      parametros: [num("PT", "Tiempo de Protrombina", "seg", 10, 14), num("INR", "INR", "", 0.8, 1.2, "0.8 - 1.2")] },
    { id: "COA-002", seccion: "coagulacion", nombre: "Tiempo Parcial de Tromboplastina (PTT)", cups: "903714", nivel: 1, muestra: "Plasma citratado", metodo: "Coagulométrico", tubo: "citrato",
      parametros: [num("PTT", "PTT", "seg", 25, 35)] },
    { id: "COA-003", seccion: "coagulacion", nombre: "Fibrinógeno", cups: "903721", nivel: 2, muestra: "Plasma citratado", metodo: "Clauss", tubo: "citrato",
      parametros: [num("FIB", "Fibrinógeno", "mg/dL", 200, 400)] },
    { id: "COA-004", seccion: "coagulacion", nombre: "Dímero D", cups: "903723", nivel: 2, muestra: "Plasma citratado", metodo: "Inmunoturbidimetría", tubo: "citrato",
      parametros: [num("DIMD", "Dímero D", "ng/mL", 0, 500)] },
    { id: "COA-005", seccion: "coagulacion", nombre: "Tiempo de Trombina", cups: "903725", nivel: 2, muestra: "Plasma citratado", metodo: "Coagulométrico", tubo: "citrato",
      parametros: [num("TT", "Tiempo de Trombina", "seg", 14, 21)] },

    // ---------------- BANCO DE SANGRE ----------------
    { id: "BAN-001", seccion: "banco", nombre: "Grupo Sanguíneo y Factor Rh", cups: "903610", nivel: 1, muestra: "Sangre total EDTA", metodo: "Hemaglutinación", tubo: "edta",
      parametros: [cual("GRUPO", "Grupo ABO", ["O", "A", "B", "AB"], "—", "—"), cual("RH", "Factor Rh", ["Positivo", "Negativo"], "Positivo")] },
    { id: "BAN-002", seccion: "banco", nombre: "Coombs Directo", cups: "903622", nivel: 1, muestra: "Sangre total EDTA", metodo: "Antiglobulina directa", tubo: "edta",
      parametros: [cual("COOMBSD", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "BAN-003", seccion: "banco", nombre: "Coombs Indirecto", cups: "903634", nivel: 1, muestra: "Suero", metodo: "Antiglobulina indirecta", tubo: "gel",
      parametros: [cual("COOMBSI", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "BAN-004", seccion: "banco", nombre: "Prueba Cruzada (Compatibilidad)", cups: "903640", nivel: 2, muestra: "Sangre total EDTA", metodo: "Hemaglutinación en gel", tubo: "edta",
      parametros: [cual("CRUZADA", "Compatibilidad", ["Compatible", "Incompatible"], "Compatible")] },

    // ---------------- QUÍMICA SANGUÍNEA ----------------
    { id: "QUI-001", seccion: "quimica", nombre: "Glucosa Basal", cups: "903841", nivel: 1, muestra: "Suero (fluoruro de sodio recomendado)", metodo: "Enzimático colorimétrico", tubo: "fluoruro",
      parametros: [num("GLU", "Glucosa", "mg/dL", 70, 100)] },
    { id: "QUI-002", seccion: "quimica", nombre: "Glucosa 2 Horas Postprandial", cups: "903847", nivel: 1, muestra: "Suero (fluoruro de sodio recomendado)", metodo: "Enzimático colorimétrico", tubo: "fluoruro",
      parametros: [num("GLU2H", "Glucosa 2h", "mg/dL", 70, 140)] },
    { id: "QUI-003", seccion: "quimica", nombre: "Hemoglobina Glicosilada (HbA1c)", cups: "903872", nivel: 1, muestra: "Sangre total EDTA", metodo: "HPLC / Turbidimetría", tubo: "edta",
      parametros: [num("HBA1C", "HbA1c", "%", 4.0, 5.6)] },
    { id: "QUI-004", seccion: "quimica", nombre: "Colesterol Total", cups: "903818", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico", tubo: "seco",
      parametros: [num("COLT", "Colesterol Total", "mg/dL", 0, 200)] },
    { id: "QUI-005", seccion: "quimica", nombre: "Colesterol HDL", cups: "903820", nivel: 1, muestra: "Suero", metodo: "Enzimático directo", tubo: "seco",
      parametros: [num("HDL", "HDL", "mg/dL", 40, 60)] },
    { id: "QUI-006", seccion: "quimica", nombre: "Colesterol LDL (calculado)", cups: "903822", nivel: 1, muestra: "Suero", metodo: "Fórmula de Friedewald", tubo: "seco",
      parametros: [num("LDL", "LDL", "mg/dL", 0, 130)] },
    { id: "QUI-007", seccion: "quimica", nombre: "Triglicéridos", cups: "903824", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico", tubo: "seco",
      parametros: [num("TGD", "Triglicéridos", "mg/dL", 0, 150)] },
    { id: "QUI-008", seccion: "quimica", nombre: "Creatinina", cups: "903895", nivel: 1, muestra: "Suero", metodo: "Jaffé cinético", tubo: "seco",
      parametros: [num("CREA", "Creatinina", "mg/dL", 0.6, 1.3)] },
    { id: "QUI-009", seccion: "quimica", nombre: "Nitrógeno Ureico (BUN)", cups: "903872", nivel: 1, muestra: "Suero", metodo: "Enzimático UV", tubo: "seco",
      parametros: [num("BUN", "BUN", "mg/dL", 7, 20)] },
    { id: "QUI-010", seccion: "quimica", nombre: "Ácido Úrico", cups: "903890", nivel: 1, muestra: "Suero", metodo: "Enzimático colorimétrico", tubo: "seco",
      parametros: [num("AURI", "Ácido Úrico", "mg/dL", 3.5, 7.2)] },
    { id: "QUI-011", seccion: "quimica", nombre: "Bilirrubinas Total y Directa", cups: "903810", nivel: 1, muestra: "Suero", metodo: "Colorimétrico (Jendrassik-Grof)", tubo: "seco",
      parametros: [num("BT", "Bilirrubina Total", "mg/dL", 0.2, 1.2), num("BD", "Bilirrubina Directa", "mg/dL", 0.0, 0.3), num("BI", "Bilirrubina Indirecta", "mg/dL", 0.1, 0.9)] },
    { id: "QUI-012", seccion: "quimica", nombre: "Proteínas Totales y Albúmina", cups: "903833", nivel: 1, muestra: "Suero", metodo: "Biuret / Verde de Bromocresol", tubo: "seco",
      parametros: [num("PT_", "Proteínas Totales", "g/dL", 6.4, 8.3), num("ALB", "Albúmina", "g/dL", 3.5, 5.0), num("GLOB", "Globulinas", "g/dL", 2.0, 3.5)] },
    { id: "QUI-013", seccion: "quimica", nombre: "AST (TGO)", cups: "903840", nivel: 1, muestra: "Suero", metodo: "UV cinético IFCC", tubo: "seco",
      parametros: [num("AST", "AST/TGO", "U/L", 5, 40)] },
    { id: "QUI-014", seccion: "quimica", nombre: "ALT (TGP)", cups: "903835", nivel: 1, muestra: "Suero", metodo: "UV cinético IFCC", tubo: "seco",
      parametros: [num("ALT", "ALT/TGP", "U/L", 5, 41)] },
    { id: "QUI-015", seccion: "quimica", nombre: "Fosfatasa Alcalina", cups: "903849", nivel: 1, muestra: "Suero", metodo: "Cinético colorimétrico", tubo: "seco",
      parametros: [num("FA", "Fosfatasa Alcalina", "U/L", 40, 130)] },
    { id: "QUI-016", seccion: "quimica", nombre: "Gamma Glutamil Transferasa (GGT)", cups: "903850", nivel: 1, muestra: "Suero", metodo: "Cinético colorimétrico", tubo: "seco",
      parametros: [num("GGT", "GGT", "U/L", 8, 61)] },
    { id: "QUI-017", seccion: "quimica", nombre: "Amilasa", cups: "903806", nivel: 2, muestra: "Suero", metodo: "Cinético colorimétrico", tubo: "seco",
      parametros: [num("AMIL", "Amilasa", "U/L", 28, 100)] },
    { id: "QUI-018", seccion: "quimica", nombre: "Lipasa", cups: "903868", nivel: 2, muestra: "Suero", metodo: "Cinético colorimétrico", tubo: "seco",
      parametros: [num("LIP", "Lipasa", "U/L", 13, 60)] },
    { id: "QUI-019", seccion: "quimica", nombre: "Deshidrogenasa Láctica (LDH)", cups: "903869", nivel: 2, muestra: "Suero", metodo: "Cinético UV", tubo: "seco",
      parametros: [num("LDH", "LDH", "U/L", 120, 246)] },
    { id: "QUI-020", seccion: "quimica", nombre: "CPK Total", cups: "903815", nivel: 2, muestra: "Suero", metodo: "Cinético UV", tubo: "seco",
      parametros: [num("CPK", "CPK Total", "U/L", 30, 200)] },
    { id: "QUI-021", seccion: "quimica", nombre: "CPK-MB", cups: "903816", nivel: 2, muestra: "Suero", metodo: "Inmunoinhibición", tubo: "seco",
      parametros: [num("CPKMB", "CPK-MB", "U/L", 0, 25)] },
    { id: "QUI-022", seccion: "quimica", nombre: "Troponina I", cups: "903629", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("TROP", "Troponina I", "ng/mL", 0, 0.04)] },
    { id: "QUI-023", seccion: "quimica", nombre: "Calcio Sérico", cups: "903812", nivel: 1, muestra: "Suero", metodo: "Colorimétrico (Arsenazo III)", tubo: "seco",
      parametros: [num("CA", "Calcio", "mg/dL", 8.5, 10.5)] },
    { id: "QUI-024", seccion: "quimica", nombre: "Fósforo Sérico", cups: "903880", nivel: 1, muestra: "Suero", metodo: "Colorimétrico UV", tubo: "seco",
      parametros: [num("P", "Fósforo", "mg/dL", 2.5, 4.5)] },
    { id: "QUI-025", seccion: "quimica", nombre: "Magnesio Sérico", cups: "903874", nivel: 2, muestra: "Suero", metodo: "Colorimétrico", tubo: "seco",
      parametros: [num("MG", "Magnesio", "mg/dL", 1.6, 2.6)] },
    { id: "QUI-026", seccion: "quimica", nombre: "Hierro Sérico", cups: "903860", nivel: 2, muestra: "Suero", metodo: "Colorimétrico Ferrozina", tubo: "seco",
      parametros: [num("FE", "Hierro", "µg/dL", 50, 170)] },
    { id: "QUI-027", seccion: "quimica", nombre: "Ferritina", cups: "904238", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("FERR", "Ferritina", "ng/mL", 15, 200)] },
    { id: "QUI-028", seccion: "quimica", nombre: "Colinesterasa Sérica", cups: "903828", nivel: 2, muestra: "Suero", metodo: "Cinético colorimétrico", tubo: "seco",
      parametros: [num("CHE", "Colinesterasa", "U/L", 5300, 12900)] },
    { id: "QUI-029", seccion: "quimica", nombre: "Homocisteína", cups: "903862", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("HCY", "Homocisteína", "µmol/L", 5, 15)] },
    { id: "QUI-030", seccion: "quimica", nombre: "Osmolaridad Sérica", cups: "903878", nivel: 2, muestra: "Suero", metodo: "Descenso crioscópico", tubo: "seco",
      parametros: [num("OSM", "Osmolaridad", "mOsm/kg", 275, 295)] },
    { id: "QUI-031", seccion: "quimica", nombre: "Amonio (Amoniaco)", cups: "903807", nivel: 2, muestra: "Plasma EDTA en frío", metodo: "Enzimático UV", tubo: "edta",
      parametros: [num("NH3", "Amonio", "µg/dL", 15, 45)] },
    { id: "QUI-032", seccion: "quimica", nombre: "Transferrina y Capacidad de Fijación de Hierro (TIBC)", cups: "903898", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "seco",
      parametros: [num("TRANSF", "Transferrina", "mg/dL", 200, 360), num("TIBC", "TIBC", "µg/dL", 250, 450)] },
    { id: "QUI-033", seccion: "quimica", nombre: "Haptoglobina", cups: "903863", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("HAPTO", "Haptoglobina", "mg/dL", 30, 200)] },
    { id: "QUI-034", seccion: "quimica", nombre: "Lipoproteína (a)", cups: "903826", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("LPA", "Lipoproteína (a)", "mg/dL", 0, 30)] },
    { id: "QUI-035", seccion: "quimica", nombre: "Apolipoproteínas A1 y B", cups: "903827", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("APOA1", "Apolipoproteína A1", "mg/dL", 110, 205), num("APOB", "Apolipoproteína B", "mg/dL", 55, 130)] },
    { id: "QUI-036", seccion: "quimica", nombre: "Zinc Sérico", cups: "903899", nivel: 2, muestra: "Suero", metodo: "Espectrofotometría de absorción atómica", tubo: "seco",
      parametros: [num("ZN", "Zinc", "µg/dL", 60, 130)] },

    // ---------------- UROANÁLISIS ----------------
    { id: "URO-001", seccion: "uroanalisis", nombre: "Parcial de Orina", cups: "907106", nivel: 1, muestra: "Orina espontánea", metodo: "Físico-químico + sedimento", tubo: "orina",
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
    { id: "URO-002", seccion: "uroanalisis", nombre: "Microalbuminuria", cups: "907113", nivel: 2, muestra: "Orina 24h / muestra aislada", metodo: "Inmunoturbidimetría", tubo: "orina",
      parametros: [num("MALB", "Microalbuminuria", "mg/L", 0, 20)] },
    { id: "URO-003", seccion: "uroanalisis", nombre: "Depuración de Creatinina en Orina 24h", cups: "903897", nivel: 2, muestra: "Orina 24 horas", metodo: "Cálculo con creatinina sérica", tubo: "orina24h",
      parametros: [num("DEPCR", "Depuración de Creatinina", "mL/min", 90, 130)] },
    { id: "URO-004", seccion: "uroanalisis", nombre: "Proteinuria de 24 Horas", cups: "907114", nivel: 2, muestra: "Orina 24 horas", metodo: "Colorimétrico (Rojo de Pirogalol)", tubo: "orina24h",
      parametros: [num("PROT24", "Proteínas en Orina 24h", "mg/24h", 0, 150)] },
    { id: "URO-005", seccion: "uroanalisis", nombre: "Relación Proteína/Creatinina en Orina", cups: "907116", nivel: 2, muestra: "Orina espontánea", metodo: "Cálculo", tubo: "orina",
      parametros: [num("PROTCREA", "Relación Proteína/Creatinina", "mg/g", 0, 150)] },

    // ---------------- COPROLOGÍA Y PARASITOLOGÍA ----------------
    { id: "COP-001", seccion: "coprologia", nombre: "Coprológico (Examen General de Heces)", cups: "907205", nivel: 1, muestra: "Materia fecal", metodo: "Macroscópico / microscópico", tubo: "heces",
      parametros: [
        desc("COLOR", "Color", ["Amarillo", "Amarillo Verdoso", "Café", "Verde", "Negro", "Otro"]),
        desc("CONSIST", "Consistencia", ["Formada", "Blanda", "Pastosa / Semiformada", "Semilíquida", "Líquida"]),
        cual("MOCO", "Moco", ["Ausente", "Presente"], "Ausente"),
        cual("SANGREF", "Sangre", ["Ausente", "Presente"], "Ausente"),
        cual("RESTAL", "Restos Alimenticios", ["Ausentes", "Presentes"], "Ausentes"),
        cual("LEUF", "Leucocitos", ["Ausentes", "Escasos (1-3 x campo)", "Moderados (4-10 x campo)", "Abundantes (>10 x campo)"], "Ausentes"),
        cual("HEMF", "Hematíes", ["Ausentes", "Escasos (1-3 x campo)", "Moderados (4-10 x campo)", "Abundantes (>10 x campo)"], "Ausentes"),
        cual("LEVAF", "Levaduras", ["Ausentes", "Escasas", "Abundantes"], "Ausentes"),
        texto("PARF", "Elementos Parasitarios", "No se observan parásitos, quistes ni huevos")
      ]
    },
    { id: "COP-002", seccion: "coprologia", nombre: "Sangre Oculta en Heces", cups: "907211", nivel: 1, muestra: "Materia fecal", metodo: "Inmunocromatografía", tubo: "heces",
      parametros: [cual("SOH", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "COP-003", seccion: "coprologia", nombre: "Coproparasitológico Seriado (x3)", cups: "907212", nivel: 1, muestra: "Materia fecal (3 muestras)", metodo: "Concentración + directo", tubo: "heces",
      parametros: [texto("PARSER", "Hallazgos parasitológicos", "No se observan parásitos ni quistes")] },
    { id: "COP-004", seccion: "coprologia", nombre: "Test de Graham (Escobillado Perianal)", cups: "907214", nivel: 1, muestra: "Escobillado perianal", metodo: "Microscopía directa", tubo: "hisopo",
      parametros: [cual("GRAHAM", "Huevos de Enterobius vermicularis", ["No se observan", "Se observan"], "No se observan")] },
    { id: "COP-005", seccion: "coprologia", nombre: "Grasas en Materia Fecal (Esteatocrito)", cups: "907216", nivel: 2, muestra: "Materia fecal", metodo: "Esteatocrito ácido", tubo: "heces",
      parametros: [num("ESTEAT", "Esteatocrito", "%", 0, 3)] },
    { id: "COP-006", seccion: "coprologia", nombre: "Rotavirus / Adenovirus en Heces (Prueba Rápida)", cups: "907218", nivel: 1, muestra: "Materia fecal", metodo: "Inmunocromatografía", tubo: "heces",
      parametros: [cual("ROTAADENO", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "COP-007", seccion: "coprologia", nombre: "Antígeno de Helicobacter Pylori en Heces", cups: "907219", nivel: 2, muestra: "Materia fecal", metodo: "Inmunocromatografía / ELISA", tubo: "heces",
      parametros: [cual("HPYLAG", "Resultado", ["Negativo", "Positivo"], "Negativo")] },

    // ---------------- INMUNOLOGÍA Y SEROLOGÍA ----------------
    { id: "INM-001", seccion: "inmunologia", nombre: "VDRL / RPR", cups: "906909", nivel: 1, muestra: "Suero", metodo: "Floculación", tubo: "gel",
      parametros: [cual("VDRL", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-002", seccion: "inmunologia", nombre: "Prueba Treponémica (FTA-ABS/TPHA)", cups: "906915", nivel: 2, muestra: "Suero", metodo: "Inmunofluorescencia / Hemaglutinación", tubo: "gel",
      parametros: [cual("TREPO", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-003", seccion: "inmunologia", nombre: "Prueba Rápida VIH", cups: "906965", nivel: 1, muestra: "Suero / sangre total", metodo: "Inmunocromatografía", tubo: "gel",
      parametros: [cual("VIH", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-004", seccion: "inmunologia", nombre: "Antígeno de Superficie Hepatitis B (HBsAg)", cups: "906038", nivel: 1, muestra: "Suero", metodo: "Inmunocromatografía / ELISA", tubo: "gel",
      parametros: [cual("HBSAG", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-005", seccion: "inmunologia", nombre: "Anticuerpos Anti-VHC (Hepatitis C)", cups: "906042", nivel: 2, muestra: "Suero", metodo: "ELISA / Inmunocromatografía", tubo: "gel",
      parametros: [cual("VHC", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-006", seccion: "inmunologia", nombre: "Prueba de Embarazo en Sangre (BHCG cualitativa)", cups: "903942", nivel: 1, muestra: "Suero", metodo: "Inmunocromatografía", tubo: "gel",
      parametros: [cual("BHCGQ", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "INM-007", seccion: "inmunologia", nombre: "BHCG Cuantitativa", cups: "903944", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("BHCG", "BHCG", "mUI/mL", 0, 5)] },
    { id: "INM-008", seccion: "inmunologia", nombre: "Proteína C Reactiva (PCR)", cups: "906030", nivel: 1, muestra: "Suero", metodo: "Turbidimetría", tubo: "gel",
      parametros: [num("PCR", "PCR", "mg/L", 0, 10)] },
    { id: "INM-009", seccion: "inmunologia", nombre: "Antiestreptolisinas O (ASTO)", cups: "906010", nivel: 1, muestra: "Suero", metodo: "Turbidimetría / Látex", tubo: "gel",
      parametros: [num("ASTO", "ASTO", "UI/mL", 0, 200)] },
    { id: "INM-010", seccion: "inmunologia", nombre: "Factor Reumatoide", cups: "906027", nivel: 1, muestra: "Suero", metodo: "Turbidimetría / Látex", tubo: "gel",
      parametros: [num("FR", "Factor Reumatoide", "UI/mL", 0, 14)] },
    { id: "INM-011", seccion: "inmunologia", nombre: "Anticuerpos Antinucleares (ANA)", cups: "906104", nivel: 2, muestra: "Suero", metodo: "Inmunofluorescencia indirecta", tubo: "gel",
      parametros: [cual("ANA", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "INM-012", seccion: "inmunologia", nombre: "Reacciones Febriles (Widal)", cups: "906909", nivel: 1, muestra: "Suero", metodo: "Aglutinación en placa", tubo: "gel",
      parametros: [texto("WIDAL", "Títulos", "No reactivo / Títulos < 1:80")] },
    { id: "INM-013", seccion: "inmunologia", nombre: "Anticuerpos Totales Anti-VHA (Hepatitis A)", cups: "906040", nivel: 2, muestra: "Suero", metodo: "ELISA / Quimioluminiscencia", tubo: "gel",
      parametros: [cual("VHA", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-014", seccion: "inmunologia", nombre: "Anticuerpos de Superficie Anti-HBs", cups: "906039", nivel: 1, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("ANTIHBS", "Anti-HBs", "mUI/mL", 10, 1000, "≥10 mUI/mL: Inmunidad protectora")] },
    { id: "INM-015", seccion: "inmunologia", nombre: "Anticuerpo Core Anti-HBc Total", cups: "906041", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [cual("ANTIHBC", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-016", seccion: "inmunologia", nombre: "IgG / IgM Toxoplasma gondii", cups: "906120", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [cual("TOXOIGG", "Toxoplasma IgG", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("TOXOIGM", "Toxoplasma IgM", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-017", seccion: "inmunologia", nombre: "IgG / IgM Rubéola", cups: "906130", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [cual("RUBIGG", "Rubéola IgG", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("RUBIGM", "Rubéola IgM", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-018", seccion: "inmunologia", nombre: "IgG / IgM Citomegalovirus (CMV)", cups: "906135", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [cual("CMVIGG", "CMV IgG", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("CMVIGM", "CMV IgM", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-019", seccion: "inmunologia", nombre: "Dengue: Antígeno NS1 + IgG/IgM", cups: "906700", nivel: 1, muestra: "Suero", metodo: "Inmunocromatografía", tubo: "gel",
      parametros: [cual("DENNS1", "Antígeno NS1", ["Negativo", "Positivo"], "Negativo"), cual("DENIGM", "Dengue IgM", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("DENIGG", "Dengue IgG", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-020", seccion: "inmunologia", nombre: "Chikungunya IgM", cups: "906705", nivel: 2, muestra: "Suero", metodo: "ELISA / Inmunocromatografía", tubo: "gel",
      parametros: [cual("CHIKIGM", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-021", seccion: "inmunologia", nombre: "Zika IgM", cups: "906710", nivel: 2, muestra: "Suero", metodo: "ELISA / Inmunocromatografía", tubo: "gel",
      parametros: [cual("ZIKAIGM", "Resultado", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-022", seccion: "inmunologia", nombre: "IgG / IgM Chagas (Trypanosoma cruzi)", cups: "906715", nivel: 1, muestra: "Suero", metodo: "ELISA / Inmunocromatografía", tubo: "gel",
      parametros: [cual("CHAGIGG", "Chagas IgG", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("CHAGIGM", "Chagas IgM", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "INM-023", seccion: "inmunologia", nombre: "Anti-CCP (Péptido Citrulinado)", cups: "906108", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CCP", "Anti-CCP", "U/mL", 0, 20)] },
    { id: "INM-024", seccion: "inmunologia", nombre: "Complemento C3 y C4", cups: "906150", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("C3", "Complemento C3", "mg/dL", 90, 180), num("C4", "Complemento C4", "mg/dL", 10, 40)] },
    { id: "INM-025", seccion: "inmunologia", nombre: "Inmunoglobulinas G, A, M", cups: "906155", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("IGG", "IgG", "mg/dL", 700, 1600), num("IGA", "IgA", "mg/dL", 70, 400), num("IGM", "IgM", "mg/dL", 40, 230)] },
    { id: "INM-026", seccion: "inmunologia", nombre: "IgE Total", cups: "906160", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("IGE", "IgE Total", "UI/mL", 0, 100)] },
    { id: "INM-027", seccion: "inmunologia", nombre: "Anticuerpos Anti-DNA de Doble Cadena (Anti-dsDNA)", cups: "906112", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia / ELISA", tubo: "gel",
      parametros: [num("DSDNA", "Anti-dsDNA", "UI/mL", 0, 30)] },

    // ---------------- MICROBIOLOGÍA Y BACTERIOLOGÍA ----------------
    { id: "MIC-001", seccion: "microbiologia", nombre: "Urocultivo y Antibiograma", cups: "907310", nivel: 1, muestra: "Orina limpia / sondaje", metodo: "Cultivo en agar CLED + antibiograma", tubo: "orina",
      parametros: [texto("UROCULT", "Recuento y germen aislado", "< 10.000 UFC/mL — Sin crecimiento significativo"), texto("ATB", "Antibiograma", "No aplica (sin crecimiento)")] },
    { id: "MIC-002", seccion: "microbiologia", nombre: "Coprocultivo", cups: "907320", nivel: 2, muestra: "Materia fecal", metodo: "Cultivo selectivo (SS, XLD, Mac Conkey)", tubo: "heces",
      parametros: [texto("COPROCULT", "Germen aislado", "Flora habitual, no se aíslan patógenos")] },
    { id: "MIC-003", seccion: "microbiologia", nombre: "Cultivo de Secreción Vaginal", cups: "907330", nivel: 1, muestra: "Secreción vaginal", metodo: "Cultivo + Gram", tubo: "hisopo",
      parametros: [texto("SVAG", "Resultado", "Flora vaginal habitual")] },
    { id: "MIC-004", seccion: "microbiologia", nombre: "Cultivo de Secreción Faríngea", cups: "907335", nivel: 1, muestra: "Hisopado faríngeo", metodo: "Cultivo en agar sangre", tubo: "hisopo",
      parametros: [texto("SFAR", "Resultado", "Flora faríngea habitual")] },
    { id: "MIC-005", seccion: "microbiologia", nombre: "Coloración de Gram", cups: "907110", nivel: 1, muestra: "Según origen", metodo: "Microscopía directa", tubo: "hisopo",
      parametros: [texto("GRAM", "Descripción", "Sin microorganismos observados")] },
    { id: "MIC-006", seccion: "microbiologia", nombre: "KOH (Hongos y Levaduras)", cups: "907115", nivel: 1, muestra: "Escama / secreción", metodo: "Microscopía directa con KOH", tubo: "hisopo",
      parametros: [cual("KOH", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "MIC-007", seccion: "microbiologia", nombre: "Baciloscopia (BK) Directa", cups: "907360", nivel: 1, muestra: "Esputo", metodo: "Ziehl-Neelsen", tubo: "esputo",
      parametros: [cual("BK", "Bacilos ácido alcohol resistentes", ["No se observan (0)", "1-9 BAAR (Positivo +)", "10-99 BAAR (Positivo ++)", ">99 BAAR (Positivo +++)"], "No se observan (0)")] },
    { id: "MIC-008", seccion: "microbiologia", nombre: "Hemocultivo (Aerobio/Anaerobio)", cups: "907340", nivel: 2, muestra: "Sangre venosa", metodo: "Sistema automatizado + subcultivo", tubo: "hemocultivo",
      parametros: [texto("HEMOC", "Resultado", "Negativo a las 5-7 días de incubación")] },
    { id: "MIC-009", seccion: "microbiologia", nombre: "Cultivo de Esputo", cups: "907345", nivel: 2, muestra: "Esputo", metodo: "Cultivo en agar sangre/chocolate", tubo: "esputo",
      parametros: [texto("ESPUC", "Germen aislado", "Flora respiratoria habitual")] },
    { id: "MIC-010", seccion: "microbiologia", nombre: "Antígeno Estreptococo Grupo A (Prueba Rápida Faríngea)", cups: "907337", nivel: 1, muestra: "Hisopado faríngeo", metodo: "Inmunocromatografía", tubo: "hisopo",
      parametros: [cual("STREPA", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "MIC-011", seccion: "microbiologia", nombre: "Cultivo de Punta de Catéter", cups: "907350", nivel: 2, muestra: "Punta de catéter estéril", metodo: "Técnica de Maki (rodado en placa)", tubo: "hisopo",
      parametros: [texto("CATCULT", "Resultado", "< 15 UFC — No significativo")] },
    { id: "MIC-012", seccion: "microbiologia", nombre: "Cultivo y Frotis de Secreción Ótica", cups: "907338", nivel: 1, muestra: "Hisopado ótico", metodo: "Cultivo + Gram", tubo: "hisopo",
      parametros: [texto("OTICO", "Resultado", "Flora habitual del conducto")] },
    { id: "MIC-013", seccion: "microbiologia", nombre: "Micológico Directo y Cultivo (Piel/Uñas/Cabello)", cups: "907365", nivel: 1, muestra: "Escamas / uña / cabello", metodo: "KOH + Cultivo en Sabouraud", tubo: "hisopo",
      parametros: [texto("MICOL", "Resultado", "No se observan estructuras fúngicas")] },
    { id: "MIC-014", seccion: "microbiologia", nombre: "Gota Gruesa y Extendido de Malaria", cups: "907370", nivel: 1, muestra: "Sangre total EDTA", metodo: "Microscopía (Coloración de Giemsa)", tubo: "edta",
      parametros: [cual("MALARIA", "Resultado", ["No se observan hemoparásitos", "Se observan hemoparásitos"], "No se observan hemoparásitos")] },

    // ---------------- ENDOCRINOLOGÍA / HORMONAS ----------------
    { id: "HOR-001", seccion: "hormonas", nombre: "Hormona Estimulante de Tiroides (TSH)", cups: "904125", nivel: 1, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("TSH", "TSH", "µUI/mL", 0.4, 4.5)] },
    { id: "HOR-002", seccion: "hormonas", nombre: "T4 Libre", cups: "904132", nivel: 1, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("T4L", "T4 Libre", "ng/dL", 0.8, 1.8)] },
    { id: "HOR-003", seccion: "hormonas", nombre: "T3 Total", cups: "904129", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("T3", "T3 Total", "ng/dL", 80, 200)] },
    { id: "HOR-004", seccion: "hormonas", nombre: "Prolactina", cups: "904147", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("PRL", "Prolactina", "ng/mL", 4.0, 23.0)] },
    { id: "HOR-005", seccion: "hormonas", nombre: "Hormona Folículo Estimulante (FSH)", cups: "904138", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("FSH", "FSH", "mUI/mL", 1.5, 12.4)] },
    { id: "HOR-006", seccion: "hormonas", nombre: "Hormona Luteinizante (LH)", cups: "904141", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("LH", "LH", "mUI/mL", 1.7, 8.6)] },
    { id: "HOR-007", seccion: "hormonas", nombre: "Estradiol", cups: "904135", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("E2", "Estradiol", "pg/mL", 12.5, 166)] },
    { id: "HOR-008", seccion: "hormonas", nombre: "Progesterona", cups: "904144", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("PROG", "Progesterona", "ng/mL", 0.2, 25)] },
    { id: "HOR-009", seccion: "hormonas", nombre: "Testosterona Total", cups: "904150", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("TESTO", "Testosterona Total", "ng/dL", 280, 1100, "280 - 1100 ng/dL (hombre adulto)")] },
    { id: "HOR-010", seccion: "hormonas", nombre: "Cortisol Basal (8 AM)", cups: "904120", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CORT", "Cortisol", "µg/dL", 5, 25)] },
    { id: "HOR-011", seccion: "hormonas", nombre: "Insulina Basal", cups: "904139", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("INSU", "Insulina", "µU/mL", 2.6, 24.9)] },
    { id: "HOR-012", seccion: "hormonas", nombre: "Hormona Antimülleriana (AMH)", cups: "904170", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("AMH", "AMH", "ng/mL", 1.0, 4.0)] },
    { id: "HOR-013", seccion: "hormonas", nombre: "17-OH Progesterona", cups: "904145", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("OHPROG", "17-OH Progesterona", "ng/mL", 0.1, 1.0)] },
    { id: "HOR-014", seccion: "hormonas", nombre: "Péptido C", cups: "904142", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("PEPC", "Péptido C", "ng/mL", 0.9, 4.0)] },
    { id: "HOR-015", seccion: "hormonas", nombre: "Aldosterona", cups: "904118", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("ALDO", "Aldosterona", "ng/dL", 4, 31)] },
    { id: "HOR-016", seccion: "hormonas", nombre: "Renina Activa", cups: "904148", nivel: 2, muestra: "Plasma EDTA", metodo: "Quimioluminiscencia", tubo: "edta",
      parametros: [num("RENINA", "Renina Activa", "ng/mL/h", 0.5, 4.0)] },
    { id: "HOR-017", seccion: "hormonas", nombre: "Somatomedina C (IGF-1)", cups: "904137", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("IGF1", "IGF-1", "ng/mL", 90, 360)] },
    { id: "HOR-018", seccion: "hormonas", nombre: "Hormona de Crecimiento (GH)", cups: "904136", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("GH", "Hormona de Crecimiento", "ng/mL", 0, 5)] },
    { id: "HOR-019", seccion: "hormonas", nombre: "DHEA-S (Sulfato de Dehidroepiandrosterona)", cups: "904131", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("DHEAS", "DHEA-S", "µg/dL", 35, 430)] },
    { id: "HOR-020", seccion: "hormonas", nombre: "Androstenediona", cups: "904119", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("ANDRO", "Androstenediona", "ng/mL", 0.3, 3.3)] },

    // ---------------- MARCADORES TUMORALES ----------------
    { id: "MAR-001", seccion: "marcadores", nombre: "Antígeno Prostático Específico Total (PSA)", cups: "902551", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("PSA", "PSA Total", "ng/mL", 0, 4.0)] },
    { id: "MAR-002", seccion: "marcadores", nombre: "PSA Libre", cups: "902552", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("PSAL", "PSA Libre", "ng/mL", 0, 0.93)] },
    { id: "MAR-003", seccion: "marcadores", nombre: "CA 125", cups: "902560", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CA125", "CA 125", "U/mL", 0, 35)] },
    { id: "MAR-004", seccion: "marcadores", nombre: "CA 19-9", cups: "902563", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CA199", "CA 19-9", "U/mL", 0, 37)] },
    { id: "MAR-005", seccion: "marcadores", nombre: "CA 15-3", cups: "902566", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CA153", "CA 15-3", "U/mL", 0, 31.3)] },
    { id: "MAR-006", seccion: "marcadores", nombre: "Antígeno Carcinoembrionario (CEA)", cups: "902557", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CEA", "CEA", "ng/mL", 0, 5.0)] },
    { id: "MAR-007", seccion: "marcadores", nombre: "Alfafetoproteína (AFP)", cups: "902554", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("AFP", "AFP", "ng/mL", 0, 10)] },
    { id: "MAR-008", seccion: "marcadores", nombre: "HE4 (Proteína del Epidídimo Humano 4)", cups: "902570", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("HE4", "HE4", "pmol/L", 0, 70)] },
    { id: "MAR-009", seccion: "marcadores", nombre: "CA 72-4", cups: "902568", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("CA724", "CA 72-4", "U/mL", 0, 6.9)] },
    { id: "MAR-010", seccion: "marcadores", nombre: "Beta 2 Microglobulina", cups: "902572", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("B2M", "Beta 2 Microglobulina", "mg/L", 0.8, 2.2)] },

    // ---------------- GASES Y ELECTROLITOS ----------------
    { id: "GAS-001", seccion: "gases", nombre: "Gases Arteriales", cups: "903910", nivel: 2, muestra: "Sangre arterial heparinizada", metodo: "Electrodo ion-selectivo", tubo: "heparina",
      parametros: [
        num("PH_", "pH", "", 7.35, 7.45),
        num("PCO2", "pCO2", "mmHg", 35, 45),
        num("PO2", "pO2", "mmHg", 80, 100),
        num("HCO3", "HCO3⁻", "mEq/L", 22, 26),
        num("SATO2", "Saturación O2", "%", 95, 100)
      ]
    },
    { id: "GAS-002", seccion: "gases", nombre: "Electrolitos (Na, K, Cl)", cups: "903875", nivel: 1, muestra: "Suero", metodo: "Electrodo ion-selectivo", tubo: "seco",
      parametros: [num("NA", "Sodio", "mEq/L", 135, 145), num("K", "Potasio", "mEq/L", 3.5, 5.1), num("CL", "Cloro", "mEq/L", 98, 107)] },
    { id: "GAS-003", seccion: "gases", nombre: "Lactato", cups: "903870", nivel: 2, muestra: "Sangre arterial / venosa", metodo: "Enzimático", tubo: "heparina",
      parametros: [num("LACT", "Lactato", "mmol/L", 0.5, 2.2)] },

    // ---------------- QUÍMICA ESPECIAL (2° NIVEL) ----------------
    { id: "ESP-001", seccion: "especiales", nombre: "Vitamina B12", cups: "903790", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("B12", "Vitamina B12", "pg/mL", 200, 900)] },
    { id: "ESP-002", seccion: "especiales", nombre: "Ácido Fólico", cups: "903792", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("FOLI", "Ácido Fólico", "ng/mL", 3.1, 20.5)] },
    { id: "ESP-003", seccion: "especiales", nombre: "Vitamina D (25-OH)", cups: "903795", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("VITD", "25-OH Vitamina D", "ng/mL", 30, 100)] },
    { id: "ESP-004", seccion: "especiales", nombre: "Paratohormona (PTH)", cups: "904160", nivel: 2, muestra: "Suero/Plasma EDTA", metodo: "Quimioluminiscencia", tubo: "edta",
      parametros: [num("PTH", "PTH Intacta", "pg/mL", 15, 65)] },
    { id: "ESP-005", seccion: "especiales", nombre: "Anticuerpos Anti-TPO", cups: "904128", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("TPO", "Anti-TPO", "UI/mL", 0, 34)] },
    { id: "ESP-006", seccion: "especiales", nombre: "Electroforesis de Proteínas", cups: "903834", nivel: 2, muestra: "Suero", metodo: "Electroforesis capilar", tubo: "seco",
      parametros: [texto("EFP", "Bandas e interpretación", "Patrón electroforético sin alteraciones")] },
    { id: "ESP-007", seccion: "especiales", nombre: "Procalcitonina", cups: "903870", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("PCT", "Procalcitonina", "ng/mL", 0, 0.05)] },
    { id: "ESP-008", seccion: "especiales", nombre: "Ceruloplasmina", cups: "903838", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("CERULO", "Ceruloplasmina", "mg/dL", 20, 60)] },
    { id: "ESP-009", seccion: "especiales", nombre: "Alfa-1 Antitripsina", cups: "903839", nivel: 2, muestra: "Suero", metodo: "Inmunoturbidimetría", tubo: "gel",
      parametros: [num("A1AT", "Alfa-1 Antitripsina", "mg/dL", 90, 200)] },
    { id: "ESP-010", seccion: "especiales", nombre: "Cobre Sérico", cups: "903843", nivel: 2, muestra: "Suero", metodo: "Espectrofotometría de absorción atómica", tubo: "seco",
      parametros: [num("CU", "Cobre", "µg/dL", 70, 140)] },
    { id: "ESP-011", seccion: "especiales", nombre: "Péptido Natriurético NT-proBNP", cups: "903632", nivel: 2, muestra: "Suero", metodo: "Quimioluminiscencia", tubo: "gel",
      parametros: [num("NTPROBNP", "NT-proBNP", "pg/mL", 0, 125)] },

    // ---------------- PRUEBAS RÁPIDAS / POCT ----------------
    { id: "POC-001", seccion: "pruebasrapidas", nombre: "Prueba Rápida de Embarazo en Orina", cups: "903941", nivel: 1, muestra: "Orina", metodo: "Inmunocromatografía", tubo: "orina",
      parametros: [cual("BHCGO", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "POC-002", seccion: "pruebasrapidas", nombre: "Glucometría Capilar", cups: "903842", nivel: 1, muestra: "Sangre capilar", metodo: "Tira reactiva / glucómetro", tubo: "capilar",
      parametros: [num("GLUCAP", "Glucosa capilar", "mg/dL", 70, 100)] },
    { id: "POC-003", seccion: "pruebasrapidas", nombre: "Prueba Rápida COVID-19 (Antígeno)", cups: "906980", nivel: 1, muestra: "Hisopado nasofaríngeo", metodo: "Inmunocromatografía", tubo: "hisopo",
      parametros: [cual("COVAG", "Resultado", ["No detectado", "Detectado"], "No detectado")] },
    { id: "POC-004", seccion: "pruebasrapidas", nombre: "Prueba Rápida Dual VIH/Sífilis", cups: "906966", nivel: 1, muestra: "Sangre total", metodo: "Inmunocromatografía", tubo: "capilar",
      parametros: [cual("DUAL_VIH", "VIH", ["No Reactivo", "Reactivo"], "No Reactivo"), cual("DUAL_SIF", "Sífilis", ["No Reactivo", "Reactivo"], "No Reactivo")] },
    { id: "POC-005", seccion: "pruebasrapidas", nombre: "Prueba Rápida de Malaria", cups: "907371", nivel: 1, muestra: "Sangre capilar", metodo: "Inmunocromatografía", tubo: "capilar",
      parametros: [cual("MALRAP", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "POC-006", seccion: "pruebasrapidas", nombre: "Prueba Rápida Dengue NS1/IgG/IgM", cups: "906701", nivel: 1, muestra: "Sangre capilar", metodo: "Inmunocromatografía", tubo: "capilar",
      parametros: [cual("DENRAP", "Resultado", ["Negativo", "Positivo"], "Negativo")] },
    { id: "POC-007", seccion: "pruebasrapidas", nombre: "Cetonas en Sangre Capilar", cups: "903844", nivel: 1, muestra: "Sangre capilar", metodo: "Tira reactiva", tubo: "capilar",
      parametros: [num("CETCAP", "Cetonas Capilares", "mmol/L", 0, 0.6)] },
    { id: "POC-008", seccion: "pruebasrapidas", nombre: "Hemoglobina Capilar (POCT)", cups: "902212", nivel: 1, muestra: "Sangre capilar", metodo: "Hemoglobinómetro portátil", tubo: "capilar",
      parametros: [num("HBCAP", "Hemoglobina Capilar", "g/dL", 12.0, 16.0)] }
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

  var CATALOG_DISCLAIMER = "Catálogo de referencia: los códigos CUPS mostrados son una guía general. Verifícalos y actualízalos según la Resolución 3100 de 2019 (y sus actualizaciones) y tu manual tarifario antes de facturar.";

  function seccionNombre(id) {
    var s = SECCIONES.filter(function (x) { return x.id === id; })[0];
    return s ? s.nombre : id;
  }

  function examenPorId(id) {
    return EXAMENES.filter(function (e) { return e.id === id; })[0];
  }

  function tuboInfo(key) {
    return TUBOS[key] || { nombre: key || "No especificado", color: "#94a3b8" };
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

  /* Cada laboratorio puede tener sus propios valores de referencia (según
     equipo/metodología). Los ajustes se guardan por laboratorio (tenant) y
     se combinan aquí con los valores de fábrica del catálogo, sin modificar
     el catálogo global compartido. */
  function overrideKey(examId, codigo) { return examId + "::" + codigo; }

  function parametroEfectivo(examId, param, tenant) {
    var overrides = tenant && tenant.refOverrides ? tenant.refOverrides[overrideKey(examId, param.codigo)] : null;
    return overrides ? Object.assign({}, param, overrides) : param;
  }

  function examenEfectivo(examId, tenant) {
    var exCat = examenPorId(examId);
    if (!exCat) return exCat;
    if (!tenant || !tenant.refOverrides) return exCat;
    var clone = Object.assign({}, exCat);
    clone.parametros = exCat.parametros.map(function (p) { return parametroEfectivo(examId, p, tenant); });
    return clone;
  }

  function tieneOverride(examId, tenant) {
    if (!tenant || !tenant.refOverrides) return false;
    return examenPorId(examId).parametros.some(function (p) { return !!tenant.refOverrides[overrideKey(examId, p.codigo)]; });
  }

  function setOverride(tenant, examId, codigo, patch) {
    tenant.refOverrides = tenant.refOverrides || {};
    tenant.refOverrides[overrideKey(examId, codigo)] = patch;
  }

  function clearOverride(tenant, examId, codigo) {
    if (tenant.refOverrides) delete tenant.refOverrides[overrideKey(examId, codigo)];
  }

  global.BIO_CATALOG = {
    SECCIONES: SECCIONES,
    TUBOS: TUBOS,
    EXAMENES: EXAMENES,
    TIPOS_DOCUMENTO: TIPOS_DOCUMENTO,
    TIPOS_AFILIACION: TIPOS_AFILIACION,
    EPS_COLOMBIA: EPS_COLOMBIA,
    PROCEDENCIAS: PROCEDENCIAS,
    PRIORIDADES: PRIORIDADES,
    CATALOG_DISCLAIMER: CATALOG_DISCLAIMER,
    seccionNombre: seccionNombre,
    examenPorId: examenPorId,
    tuboInfo: tuboInfo,
    calcularFlag: calcularFlag,
    examenEfectivo: examenEfectivo,
    parametroEfectivo: parametroEfectivo,
    tieneOverride: tieneOverride,
    setOverride: setOverride,
    clearOverride: clearOverride
  };
})(window);

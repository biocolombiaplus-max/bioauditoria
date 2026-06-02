# BIOAuditoria — Guía de despliegue en BIOauditoria.com

## Estructura de archivos

```
bioauditoria/
├── index.html          ← Login principal (RAÍZ DEL SITIO)
├── js/
│   └── data.js         ← Base de datos de clientes y documentos
├── admin/
│   └── index.html      ← Panel administrador (EDICIÓN COMPLETA)
├── cliente/
│   └── index.html      ← Portal cliente (SOLO LECTURA)
└── docs/               ← Documentos Word (.docx) — SOLO ADMIN DESCARGA
    ├── TH_Manual_Bioseguridad.docx
    ├── HC_Consentimiento_Informado_General.docx
    ├── ES_Consentimiento_Informado_Estetica.docx
    ├── PG_Plan_PGIRH_Completo.docx
    ├── HC_Formato_Historia_Clinica.docx
    ├── CA_Manual_Calidad.docx
    ├── DO_Inventario_Dotacion.docx
    └── ES_Protocolo_Procedimientos_Esteticos.docx
```

---

## OPCIÓN 1: GitHub Pages (RECOMENDADO — GRATIS)

### Paso 1 — Crear repositorio
1. Ve a github.com → Crea cuenta si no tienes
2. Nuevo repositorio → nombre: `bioauditoria` → Público o Privado
3. Subir todos los archivos arrastrando a la interfaz de GitHub

### Paso 2 — Activar GitHub Pages
1. Settings del repositorio → Pages
2. Branch: main → Folder: / (root)
3. Save → Tu sitio estará en: `tuusuario.github.io/bioauditoria`

### Paso 3 — Conectar dominio BIOauditoria.com
1. En el panel de tu registrador de dominio (ej: GoDaddy, Namecheap, Hostinger):
   - Agrega registro CNAME: `www` → `tuusuario.github.io`
   - Agrega registros A apuntando a las IPs de GitHub Pages:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
2. En GitHub Pages Settings → Custom domain → Escribe: `bioauditoria.com`
3. Marca "Enforce HTTPS" ✅

### Paso 4 — URLs finales
- **Login:** `https://bioauditoria.com/`
- **Admin:** `https://bioauditoria.com/admin/`  
- **Cliente Dra. Vesga:** `https://bioauditoria.com/cliente/`

---

## OPCIÓN 2: Netlify (También gratis, más fácil)

1. Ve a netlify.com → Sign up con GitHub
2. "New site from Git" → Conecta tu repositorio
3. Deploy → Obtienes URL como `bioauditoria.netlify.app`
4. Domain settings → Add custom domain → `bioauditoria.com`

---

## CREDENCIALES POR DEFECTO (CAMBIAR INMEDIATAMENTE)

| Usuario     | Contraseña      | Rol           |
|-------------|-----------------|---------------|
| admin       | Bio@Admin2025!  | Administrador |
| dra.vesga   | Vesga@2025      | Cliente       |

### Para cambiar contraseñas:
Edita en `index.html` la sección `const USERS = { ... }`

### Para agregar un nuevo cliente:
1. Copia el bloque de `vesga` en `js/data.js` con nuevo ID
2. Agrega usuario en `index.html` sección USERS
3. Crea el archivo `cliente/index.html` con datos del nuevo cliente

---

## DOCUMENTOS WORD — Agregar a la plataforma

Los 8 documentos generados están en la carpeta `docs/`. Para el sistema de descarga real:

### Opción A (Simple — GitHub Pages):
Los archivos .docx están en `/docs/`. El admin los ve y descarga directamente.
Los clientes NO pueden ver la carpeta `/docs/` porque no hay link desde su portal.

### Opción B (Más seguro — Google Drive):
1. Sube los .docx a una carpeta de Google Drive del admin
2. Comparte SOLO con tu cuenta de admin
3. En `admin/index.html`, cambia la función `downloadDoc()` para abrir el link de Drive

---

## SEGURIDAD — Protecciones implementadas

### Para clientes (vista lectura):
✅ `user-select: none` — No pueden seleccionar/copiar texto
✅ `contextmenu` bloqueado — No hay clic derecho
✅ Ctrl+S, Ctrl+A, Ctrl+C bloqueados
✅ F12 (DevTools) bloqueado
✅ Watermark "BIOAuditoria" en todos los documentos visualizados
✅ Overlay transparente sobre el contenido (bloquea interacción)
✅ Sin botón de descarga en la vista cliente
✅ Los archivos .docx NO están enlazados desde el portal cliente

### Para admin:
✅ Sesión con sessionStorage (expira al cerrar pestaña)
✅ Verificación de rol en cada página
✅ Trazabilidad de todas las acciones

---

## PRÓXIMOS PASOS RECOMENDADOS

1. **Completar datos Dra. Vesga** en `js/data.js`:
   - Dirección de la sede
   - Número de registro médico
   - Código REPS
   - Teléfono y email

2. **Completar documentos Word** con info específica del consultorio

3. **Agregar más clientes** siguiendo la estructura de `vesga` en data.js

4. **Para producción avanzada**: Migrar a Firebase o Supabase para:
   - Autenticación robusta
   - Almacenamiento real de archivos
   - Base de datos en tiempo real
   - Firmas digitales verificadas

---

## SOPORTE

**BIOMarketing — Juan Carlos**  
ventasbio.com · biocolombiaplus@gmail.com  
© 2025 BIOAuditoria — Todos los derechos reservados

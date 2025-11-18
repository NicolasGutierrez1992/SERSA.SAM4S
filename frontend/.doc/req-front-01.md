# Frontend - Gestión de certificados CRS

## Objetivo
Desarrollar la interfaz web para la gestión y descarga de certificados fiscales, con soporte para múltiples roles, control de estados, límites visuales, notificaciones y auditoría. Compatible con Chrome, Edge y Firefox.

---

## 1. Autenticación y sesión

- [ ] @frontend Pantalla de login con validación de CUIT y contraseña
- [ ] @frontend Flujo de cambio obligatorio de contraseña en primer acceso
- [ ] @frontend Validación visual de política de contraseña (mínimo 10 caracteres, mayúscula, minúscula, número, especial)
- [ ] @frontend Manejo de sesión expirada y redirección a login
- [ ] @frontend Mensajes de error claros y accesibles

---

## 2. Gestión de usuarios

- [ ] @frontend Vista de listado de usuarios con filtros por rol, estado y mayorista
- [ ] @frontend Formulario de alta/edición con validaciones (nombre, email, teléfono, rol, límite)
- [ ] @frontend Asociación automática de mayorista al crear distribuidores
- [ ] @frontend Exportación de usuarios a CSV/JSON desde UI
- [ ] @frontend Indicadores visuales de estado (activo/inactivo) y último acceso

---

## 3. Panel de certificados

- [ ] @frontend Listado de certificados disponibles con filtros (fecha, controlador, estado)
- [ ] @frontend Visualización previa del certificado: nombre, fecha, tamaño, logs
- [ ] @frontend Botón de descarga con feedback visual (progreso, éxito, error)
- [ ] @frontend Estado visible por rol: `Pendiente`, `Facturado`, `Cobrado`
- [ ] @frontend Acciones de cambio de estado según permisos (mayorista/admin)

---

## 4. Control de límites

- [ ] @frontend Contador visual de descargas pendientes vs. límite
- [ ] @frontend Alerta visual al 80% y bloqueo al 100%
- [ ] @frontend Mensaje contextual si se bloquea la descarga por límite
- [ ] @frontend Badge en panel de administrador con usuarios bloqueados o cercanos al límite

---

## 5. Auditoría

- [ ] @frontend Vista de auditoría con filtros por fecha, tipo de acción y usuario
- [ ] @frontend Visualización de cambios con resumen antes/después
- [ ] @frontend Acceso restringido a administradores

---

## 6. Notificaciones

- [ ] @frontend Badge de notificaciones internas para administradores
- [ ] @frontend Panel de notificaciones con estado (pendiente, enviado, error)
- [ ] @frontend Mensajes contextuales en UI para eventos críticos (bloqueo, error de descarga)

---

## 7. Reportes y métricas

- [ ] @frontend Panel de control con métricas clave:
  - Descargas por día
  - Pendientes por usuario
  - Top mayoristas/distribuidores
- [ ] @frontend Gráficos interactivos (ej: barras, líneas, torta)
- [ ] @frontend Exportación de reportes a XLS desde UI

---

## 8. Integración con backend

- [ ] @frontend Consumo de API REST `/api/v1/` con manejo de errores y loading states
- [ ] @frontend Uso de interceptores para token JWT y expiración
- [ ] @frontend Mapeo de errores backend a mensajes amigables
- [ ] @frontend Logs de descarga visibles en tiempo real durante la operación

---

## 9. Accesibilidad y experiencia de usuario

- [ ] @frontend Navegación accesible por teclado
- [ ] @frontend Contraste adecuado y soporte para dark mode (si aplica)
- [ ] @frontend Feedback visual consistente en formularios, botones y estados
- [ ] @frontend Responsive design para desktop y tablets

---

## 10. Demo funcional

- [ ] @frontend Flujo completo: login → crear usuario → simular descarga → bloqueo por límite → ver auditoría
- [ ] @frontend Validación visual de todos los casos de uso
- [ ] @frontend Soporte para pruebas manuales y automatizadas (e2e)

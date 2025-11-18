# Módulo: Gestión de certificados CRS

## Objetivo
Implementar solución web para gestión y descarga de certificados fiscales, con control de estados, límites, auditoría y notificaciones. Debe integrarse con la lógica de descarga existente sin modificar su comportamiento funcional.

---

## 1. Autenticación y seguridad

- [ ] @backend Endpoint `POST /auth/login` con CUIT y contraseña
- [ ] @backend Validar cambio obligatorio de contraseña (`must_change_password`)
- [ ] @backend Aplicar política de contraseñas en DTO (`class-validator`)
- [ ] @backend Configurar expiración de sesión y revocación por administrador
- [ ] @backend Guard para bloquear usuarios inactivos

---

## 2. Gestión de usuarios

- [ ] @backend CRUD de usuarios (`Administrador`, `Mayorista`, `Distribuidor`)
- [ ] @backend Asociación automática de `id_mayorista` al crear distribuidores
- [ ] @backend Exportar listado de usuarios a CSV/JSON
- [ ] @backend Validaciones por rol (`RolesGuard`)
- [ ] @frontend UI para listado, edición y creación de usuarios

---

## 3. Descargas de certificados

- [ ] @backend Endpoint `GET /certificados` con filtros y paginación
- [ ] @frontend Visualización previa con metadata y logs
- [ ] @backend Registro de descarga con estado inicial `Pendiente de Facturar`
- [ ] @backend Cambio de estado por rol (`estadoMayorista`, `estadoDistribuidor`)
- [ ] @backend Bloqueo por límite de descargas pendientes
- [ ] @frontend UI con botón de descarga, estado y logs en tiempo real

---

## 4. Control de límites

- [ ] @backend Validar `limite_descargas` antes de permitir descarga
- [ ] @backend Enviar email al 80% y 100% del límite
- [ ] @frontend Mostrar contador y alerta visual en panel del usuario
- [ ] @frontend Badge en panel de administrador con pendientes por usuario

---

## 5. Auditoría

- [ ] @backend Registrar acciones administrativas en tabla `auditoria`
- [ ] @backend Guardar actor, acción, objetivo, IP, antes/después
- [ ] @backend Endpoint `GET /auditoria` con filtros por fecha y tipo
- [ ] @frontend UI para consultar auditoría con filtros

---

## 6. Notificaciones

- [ ] @backend Modelo `notificaciones` con estado de envío
- [ ] @backend Envío de email al administrador por eventos de límite
- [ ] @frontend UI para visualizar notificaciones internas

---

## 7. Reportes y métricas

- [ ] @backend Endpoint `GET /reportes/certificados` con filtros
- [ ] @backend Exportación a XLS
- [ ] @backend Métricas: descargas por día, pendientes, top mayoristas/distribuidores
- [ ] @frontend Panel de control con gráficos y KPIs

---

## 8. Integración con sistema actual

- [ ] @backend Adaptador para lógica de descarga existente (microservicio o módulo)
- [ ] @backend API REST que invoque la descarga y capture logs
- [ ] @frontend Mostrar progreso y logs en tiempo real durante la descarga

---

## 9. Seguridad y cumplimiento

- [ ] @backend TLS obligatorio en todas las comunicaciones
- [ ] @backend Hash de contraseñas con bcrypt (≥12 rounds)
- [ ] @backend Enmascarado de datos sensibles en logs
- [ ] @backend Retención de auditoría por 1 año

---

## 10. Entregables

- [ ] @backend Documentación de arquitectura y OpenAPI
- [ ] @backend Scripts de migración y plan de despliegue
- [ ] @backend Suite de pruebas automatizadas (≥80% cobertura)
- [ ] @frontend Demo funcional con casos de uso completos

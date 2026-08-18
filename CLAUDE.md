# CLAUDE.md

Guía rápida para trabajar en este repo. Para contexto de negocio, arquitectura y flujo de certificados ver [`README.md`](./README.md) y [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Qué es esto

Monorepo (npm workspaces) con `backend/` (NestJS + TypeORM + PostgreSQL) y `frontend/` (Next.js 15 App Router). Sistema de gestión de certificados CRS para controladores fiscales SAM4S, con integración SOAP a AFIP.

## ⚠️ Antes de tocar la base de datos

`backend/.env` (local, gitignored) puede apuntar a una base **remota** (Railway), no a la local de Docker — revisar `DB_HOST` antes de correr cualquier cosa que escriba en la base (tests E2E, scripts, migraciones). Para desarrollo local seguro, usar `docker compose up` (base descartable en `localhost:5433`) y, si hace falta correr algo fuera de Docker contra esa base, sobreescribir las variables `DB_*` explícitamente en la línea de comandos — no confiar en que `.env` apunta a local.

## Desarrollo local

```bash
cp backend/.env.example backend/.env.docker   # completar valores
docker compose up -d --build
```
Frontend `:3010`, backend `:3011/api`, Postgres `:5433`. Ver `README.md` para la configuración inicial (subir certificado PFX + Root_RTI desde el panel de Admin).

## Convenciones que importa conocer

- **Roles**: 1=Admin, 2=Mayorista, 3=Distribuidor, 4=Facturación, 5=Técnico. Casi todo el control de acceso se hace vía guards + decoradores en `backend/src/auth/decorators/roles.decorator.ts` (`@RequireAdmin()`, `@RequireAuthenticated()`, etc.), pero `users.controller.ts` usa un patrón más viejo (`@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@SetMetadata('roles', [...])`) — ambos coexisten, no asumir que todo el código usa el mismo patrón.
- **Auditoría**: cualquier acción administrativa nueva (alta/baja/edición de algo sensible) debería loguearse con `AuditoriaService.log(actorId, accion, entidad, entidadId, antes, despues, ip)` — ver `backend/src/auditoria/auditoria.service.ts`. Patrón ya usado en users, auth (login/logout), app-settings, certificado-maestro, descargas. Al serializar el actor en una consulta de auditoría, **nunca** hacer `leftJoinAndSelect` sobre la relación `User` completa — expone el hash de password. Usar `leftJoin` + `addSelect` con columnas explícitas (ver `auditoria.service.ts`).
- **CSRF**: el login devuelve `csrfToken` en el body (además del JWT). El frontend lo guarda en una cookie propia y lo reenvía como header `X-CSRF-Token` en todo POST/PUT/PATCH/DELETE (ver interceptor de axios en `frontend/src/lib/api.ts`). El backend lo valida en `backend/src/common/guards/csrf.guard.ts` (guard global). Si se agrega un nuevo cliente HTTP fuera de `lib/api.ts`, hay que replicar esto o los requests mutantes van a devolver 403.
- **Rate limiting**: `ThrottlerGuard` es global (`app.module.ts`, `APP_GUARD`) — cualquier endpoint nuevo hereda el límite por defecto (`THROTTLE_LIMIT`/`THROTTLE_TTL`, 100/min). Para endpoints sensibles (auth, reset de password, descargas) se usa `@Throttle({ default: { limit, ttl } })` por endpoint.
- **Certificados AFIP**: el PFX y el Root_RTI se cargan desde el panel de Admin (`/dashboard/cert-archivos`) y se guardan encriptados (AES-256) en la BD, **no** en archivos locales — `backend/certs/` no se usa en runtime.
- **Errores al cliente**: no reenviar `error.message` crudo de integraciones externas (AFIP, SOAP) en excepciones HTTP — puede filtrar detalles internos. Loguear el detalle server-side y devolver un mensaje genérico (ver `afip.service.ts`/`certificados.service.ts` para el patrón).
- **Envío de mail por Gmail OAuth2**: el patrón (refresh-token exchange + armar RFC2822 + `gmail.googleapis.com/gmail/v1/users/me/messages/send`) está duplicado casi idéntico en `auditoria.service.ts` (`notificarExcesoDescargas`) y `backup.service.ts` (`notificarFallo`). Si se toca uno, probablemente el otro también necesite el mismo cambio — candidato a extraer a un servicio compartido si aparece un tercer caso de uso.

## Tests

- `backend/test/*.e2e-spec.ts` — Jest + Supertest, bootstrapea la app completa vía `@nestjs/testing` (sin Docker) y siembra/limpia sus propios datos. Requiere una BD Postgres real por env vars `DB_*` — **nunca apuntarlos a producción**. Si un spec crea usuarios de prueba y también genera eventos de auditoría (ej. llamando a `/auth/login`), el `afterAll` tiene que borrar `auditoria` antes que `users` (hay FK `auditoria.actor_id -> users.id_usuario`).
- `frontend/e2e/*.spec.ts` — Playwright, corre contra un stack real (`http://localhost:3010` por defecto, o `PLAYWRIGHT_BASE_URL`). Los tests que necesitan login leen credenciales de `E2E_ADMIN_CUIT`/`E2E_ADMIN_PASSWORD` (y `E2E_DISTRIBUIDOR_*`) por variable de entorno — **nunca hardcodear contraseñas reales en specs**; si las variables no están seteadas, el test se saltea solo (ver `frontend/e2e/helpers.ts`).
- CI (`.github/workflows/ci.yml`) corre todo esto automáticamente contra bases de datos efímeras — ver ese archivo para cómo se siembran los usuarios de prueba en el job de E2E de Playwright.

## Gotchas ya encontrados (para no repetir)

- `backend/.eslintrc.js` tenía el `extends` de `@typescript-eslint/recommended` sin el prefijo `plugin:` — `npm run lint` nunca corrió con éxito hasta que se corrigió. Si `npm run lint` empieza a fallar con "couldn't find the config", revisar que los `extends` de plugins usen el prefijo `plugin:`.
- `RolesGuard` en `backend/src/auth/guards/auth.guards.ts` devolvía 401 en vez de 403 cuando el rol no alcanzaba — esto hacía que el interceptor del frontend tratara un "sin permiso" como "sesión vencida" y deslogueara al usuario. Ya corregido; si se agregan guards de rol nuevos, usar `ForbiddenException` (403) para "autenticado pero sin permiso", `UnauthorizedException` (401) solo para "no autenticado".
- **Cuidado al hacer `git add <archivo>` sobre un archivo que tenía cambios sin commitear de OTRO trabajo en curso**: en un momento `backend/src/app.module.ts` tenía, sin commitear, tanto un import de una feature en desarrollo (backup) como cambios míos — al stagear el archivo completo se coló el import ajeno en el commit y rompió el build de Railway (`Cannot find module './backup/backup.module'`, porque esa carpeta nunca se había commiteado). Antes de `git add` sobre un archivo modificado, revisar `git diff <archivo>` si hay sospecha de que puede tener cambios de más de una fuente.

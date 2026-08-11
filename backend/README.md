# SERSA Backend

API de SERSA para la gestión de certificados CRS (SAM4S), construida con NestJS, TypeScript y PostgreSQL. Integra con AFIP (WSAA/WSCERT) para la generación de certificados, y con Google Drive/Gmail para backups automáticos y notificaciones.

## 🚀 Tecnologías

- **NestJS 10** — framework
- **TypeScript 5**
- **PostgreSQL** + **TypeORM** — persistencia
- **JWT** (cookie httpOnly + fallback `Authorization: Bearer`) — autenticación
- **class-validator** / **ValidationPipe** global — validación de DTOs
- **@nestjs/throttler** — rate limiting (guard global, ver `app.module.ts`)
- **Guard CSRF propio** (`common/guards/csrf.guard.ts`) — protección contra CSRF sobre el flujo de cookie
- **bcrypt** — hash de contraseñas
- **node-forge** — parseo/generación de certificados PKCS#12
- **soap** — cliente SOAP para AFIP (WSAA/WSCERT)
- **Jest + Supertest** — tests E2E (`test/*.e2e-spec.ts`)

## 🏗️ Estructura del proyecto

```
src/
├── auth/                 # Login, JWT, guards de rol, CSRF
├── users/                # CRUD de usuarios, compras prepago
├── certificados/         # Descarga de certificados CRS, certificado maestro (.pfx)
├── descargas/             # Registro de descargas, límites, estados de facturación
├── afip/                  # Integración SOAP con AFIP (WSAA/WSCERT)
├── auditoria/             # Registro de auditoría (login, CRUD, descargas, config)
├── backup/                 # Backup automático de la BD a Google Drive (cron)
├── common/                 # Guards, interceptors, servicios compartidos (app-settings, encriptación)
├── notificaciones/         # Notificaciones a usuarios/mayoristas
├── reportes/                # (parcialmente implementado — ver reportes.service.ts)
├── database/migrations/     # Migraciones TypeORM
└── main.ts                  # Bootstrap: helmet, CORS, ValidationPipe, prefijo /api
```

## 🔐 Roles

1. **Administrador** — acceso completo, incluida Auditoría
2. **Mayorista** — gestiona sus distribuidores y certificados
3. **Distribuidor** — descarga certificados
4. **Facturación** — gestión de facturación de descargas
5. **Técnico** — soporte interno, sin límites de descarga

## 🛠️ Instalación

### Opción A — Docker Compose (recomendado)

Desde la raíz del repo:
```bash
cp backend/.env.example backend/.env.docker   # completar valores
docker compose up -d --build
```
Levanta Postgres + backend (`:3011`) + frontend (`:3010`). Ver el README raíz para más detalle.

### Opción B — Local directo

```bash
npm install
cp .env.example .env
```

Completar `.env` (ver la sección siguiente) y luego:
```bash
npm run start:dev
```

### Variables de entorno requeridas

`backend/.env.example` documenta todas las variables usadas. Como mínimo, para arrancar, se necesitan `DB_HOST/PORT/USERNAME/PASSWORD/NAME`, `JWT_SECRET` y `ENCRYPTION_KEY` (el arranque falla explícitamente si faltan — ver `validateRequiredEnv()` en `main.ts`). AFIP, Gmail y el backup a Drive son opcionales para desarrollo local.

## 📝 Scripts disponibles

```bash
npm run start:dev          # Servidor con hot-reload
npm run build                # Compilar TypeScript
npm run start:prod           # Servidor de producción (requiere build previo)

npm run test                 # Tests unitarios (jest)
npm run test:e2e             # Tests E2E (jest + supertest, requiere una BD accesible)
npm run test:cov             # Cobertura

npm run lint                  # ESLint (incluye eslint-plugin-security)
npm run format                 # Prettier

npm run migration:run          # Correr migraciones pendientes
npm run migration:generate      # Generar una migración a partir de cambios en entidades
```

## 🧪 Tests E2E

`test/*.e2e-spec.ts` bootstrapea la app completa con `@nestjs/testing` (sin pasar por Docker) y siembra sus propios datos de prueba directamente vía TypeORM en `beforeAll`/los limpia en `afterAll`. Necesitan una base Postgres real accesible por las variables `DB_*` — **nunca apuntar esto a una base de producción**: los specs insertan y borran filas de `users`/`auditoria`/`descargas`.

En CI (`.github/workflows/ci.yml`) corren contra un contenedor Postgres efímero, sin ningún dato real.

## 🔐 Autenticación, autorización y CSRF

1. Login con CUIT (11 dígitos) + contraseña → `POST /api/auth/login`.
2. El JWT viaja en una cookie `auth_token` httpOnly (protección XSS) y también en el body de la respuesta, para clientes cross-domain que lo reenvían como `Authorization: Bearer`.
3. La misma respuesta incluye un `csrfToken` — el frontend lo guarda en una cookie propia (no httpOnly) y lo reenvía como header `X-CSRF-Token` en cada request mutante (POST/PUT/PATCH/DELETE). `CsrfGuard` (guard global) lo valida contra el claim homónimo dentro del JWT ya verificado. Esto protege el flujo de cookie (necesariamente `sameSite=none` en producción, porque frontend y backend viven en dominios distintos) contra CSRF clásico.
4. Rate limiting global (100 req/min por defecto, configurable por `THROTTLE_*`) + límites más estrictos en endpoints sensibles (`/auth/login`, `/auth/change-password`, `/users/:id/reset-password`, `/certificados/descargar`).

## 🔍 Auditoría

Todas las acciones administrativas y de autenticación quedan registradas en la tabla `auditoria`: login/login fallido/logout, alta/edición/baja de usuarios, reseteo de contraseña, compras prepago, cambios de configuración del sistema, carga de certificado maestro, y descargas/errores de certificados. Consultable desde `GET /api/auditoria` (solo Admin/Facturación) y visible en el frontend en `/dashboard/auditoria`.

## 📚 Documentación de la API

Con el servidor en desarrollo corriendo:
- **Swagger UI**: http://localhost:3001/api/docs (deshabilitado en producción)

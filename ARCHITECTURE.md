# Arquitectura del Sistema — SERSA SAM4S

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Next.js (App Router) | 15.x |
| Frontend UI | Ant Design + Tailwind CSS | antd 5.x |
| Frontend HTTP | Axios (con `withCredentials`) | 1.x |
| Backend | NestJS | 10.x |
| Backend ORM | TypeORM | 0.3.x |
| Base de datos | PostgreSQL | 15 |
| Autenticación | JWT via cookie httpOnly | — |
| Seguridad | Helmet, ThrottlerModule, bcrypt | — |
| Integración externa | AFIP WSAA + WSCert (SOAP) | — |
| Deploy frontend | Vercel | — |
| Deploy backend | Railway | — |

---

## Flujo de autenticación

```
Browser                   Frontend (Next.js)         Backend (NestJS)
  │                              │                         │
  │── POST /login (CUIT+pwd) ───►│                         │
  │                              │── POST /api/auth/login ►│
  │                              │                         │── bcrypt.compare
  │                              │                         │── JWT.sign
  │                              │◄── 200 { user } ────────│
  │                              │    Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=None
  │◄── user_info cookie ─────────│
  │    (no httpOnly, solo UI)    │
  │                              │
  │── GET /dashboard ───────────►│
  │                              │── middleware: cookie auth_token presente?
  │                              │   Sí → next()
  │◄── 200 HTML ─────────────────│
  │                              │
  │── GET /api/certificados ────►│── withCredentials: true (cookie se envía auto)
  │                              │── GET /api/certificados ─────────────────────►│
  │                              │                                                │── JwtStrategy: lee cookie
  │                              │                                                │── valida JWT
  │                              │◄─────────────────── 200 datos ────────────────│
  │◄── datos ───────────────────│
```

**Cookies:**
- `auth_token` (httpOnly, Secure, SameSite=None en prod): contiene el JWT. Solo el servidor puede leerla.
- `user_info` (no httpOnly, SameSite=Strict): contiene `{ id, nombre, rol }` para mostrar en UI sin fetch. Se regenera en cada login.

**Cross-domain (Vercel ↔ Railway):** se usa `SameSite=None; Secure` porque los dominios son distintos. El backend configura `Access-Control-Allow-Credentials: true` y `Access-Control-Allow-Origin` con el dominio de Vercel.

---

## Flujo de generacion de certificados CRS (AFIP)

```
Admin/Distribuidor          Backend (NestJS)              AFIP (externo)
       │                          │                              │
       │── POST /certificados ───►│                              │
       │   { marca, modelo,       │── AfipService.loginWsaa() ──►│
       │     nro_serie }          │   (usa PFX de BD, encriptado)│── WSAA.LoginCms
       │                          │◄── { token, sign } (12 hs) ──│
       │                          │── (cache en memoria 12 hs)   │
       │                          │                              │
       │                          │── AfipService.generarCert() ─►│
       │                          │   (token + sign + datos ctrl)│── WSCert.renovarCertificado
       │                          │◄── certificado PEM ───────────│
       │                          │
       │                          │── guarda PEM en BD (descargas)
       │                          │── registra descarga con estado PENDIENTE_FACTURAR
       │◄── .pem descargado ──────│
```

**Prerequisitos (configurables desde `/dashboard/cert-archivos`):**
- Certificado PFX de SERSA + contrasena → almacenado AES-256 en `certificados_maestro`
- Root_RTI.txt (certificado raiz AFIP) → almacenado AES-256 en `afip_files`
- `AFIP_CUIT`, `AFIP_WSAA_URL`, `AFIP_WSCERT_WSDL`, `AFIP_FABRICANTE` → tabla `app_settings`

**Nombre del archivo generado:** `SE{Marca}{Modelo}{NroSerie_10digits}-{fecha}.pem`
Ejemplo: `SESHIA0000001371-2025-08-22.pem`

---

## Módulos del backend

```
src/
├── main.ts              Bootstrap: Helmet, cookie-parser, CORS, ValidationPipe,
│                        ThrottlerModule, validación de secretos requeridos
├── app.module.ts        TypeORM (synchronize=false en prod, SSL configurable),
│                        ConfigModule global
│
├── auth/
│   ├── auth.controller.ts    POST /login (setea cookie), POST /logout (borra cookie),
│   │                         GET /me (devuelve payload JWT)
│   ├── auth.service.ts       Valida credenciales, genera JWT, valida contraseña actual
│   │                         en changePassword
│   ├── strategies/
│   │   └── jwt.strategy.ts   Lee token de cookie auth_token primero, luego Bearer header
│   ├── guards/
│   │   ├── auth.guards.ts    JwtAuthGuard
│   │   └── roles.guard.ts    Verifica rol requerido (sin logs de PII)
│   └── decorators/
│       ├── roles.decorator.ts    @RequireAuthenticated(), @RequireAdmin()
│       └── current-user.decorator.ts  @CurrentUser()
│
├── users/
│   ├── users.service.ts    findAll usa findAndCount con WHERE SQL (no carga todos en memoria),
│   │                       findByCuit sin dump de usuarios, min password 10 chars
│   └── entities/
│       ├── user.entity.ts
│       └── mayorista.entity.ts
│
├── certificados/
│   ├── certificados.controller.ts        POST /certificados (genera CRS via AFIP),
│   │                                     GET /afip/status (validarConfiguracion real),
│   │                                     Content-Disposition sanitizado, fileFilter MIME
│   ├── certificado-maestro.controller.ts POST /certificados-maestro/upload (PFX + password),
│   │                                     POST /certificados-maestro/upload-root-rti (Root_RTI.txt),
│   │                                     GET /certificados-maestro/admin/status
│   └── certificados.service.ts
│
├── descargas/           Historial de descargas por usuario
├── afip/                Cliente SOAP para WSAA y WSCert
│   └── afip.service.ts  validateConfiguration() verifica archivos y env vars
├── auditoria/           Registro de acciones
└── common/
    ├── timezone.service.ts    Fechas en zona horaria Argentina
    └── interceptors/
        └── audit.interceptor.ts
```

---

## Módulos del frontend

```
src/
├── app/                     App Router de Next.js 15
│   ├── login/page.tsx        Login con CUIT, llama a authApi.login()
│   ├── dashboard/page.tsx    Panel principal
│   ├── usuarios/page.tsx     CRUD de usuarios (usa getUser() de lib/api)
│   ├── certificados/page.tsx Descarga de CRS, export Excel (exceljs)
│   └── change-password/      Cambio obligatorio de contraseña
│
├── middleware.ts             Protección de rutas: si no hay cookie auth_token → /login
│
├── contexts/
│   └── AuthContext.tsx       Estado de usuario via getUser() de lib/api
│
├── lib/
│   └── api.ts               Axios con withCredentials:true, interceptor 401 → logout,
│                            authApi.{login,logout,me}, getUser/setUser via js-cookie
│
└── services/
    └── api.ts               Re-export/adapter de lib/api.ts (compatibilidad)
```

---

## Roles y permisos

| Rol | Valor | Puede crear usuarios | Ve usuarios | Puede editar |
|-----|-------|----------------------|-------------|--------------|
| Administrador | 1 | Todos los roles | Todos | Todo |
| Mayorista | 2 | No | Solo sus distribuidores | Límites y tipo_descarga |
| Distribuidor | 3 | No | Solo propio | Solo su perfil |
| Facturación | 4 | No | Historial y facturas | No |
| Técnico | 5 | Mayorista, Distribuidor, Técnico | Todos | Todo excepto cambiar rol |

Los técnicos (rol 5) se crean siempre con `id_mayorista = 1` (SERSA).

---

## Base de datos

TypeORM con `synchronize: false` en producción. Los cambios de esquema se manejan con migraciones:

```bash
# Generar migración desde cambios en entidades
cd backend
npm run migration:generate -- src/migrations/NombreMigracion -d src/data-source.ts

# Ejecutar migraciones pendientes
npm run migration:run -- -d src/data-source.ts

# Revertir última migración
npm run migration:revert -- -d src/data-source.ts
```

**Tablas principales:** `usuarios`, `mayoristas`, `descargas`, `auditoria`, `afip_files`

---

## Seguridad por capa

| Capa | Medida |
|------|--------|
| Red | HTTPS obligatorio en producción (Vercel + Railway) |
| HTTP headers | Helmet (CSP, HSTS, X-Frame-Options, etc.) |
| Auth | Cookie httpOnly, SameSite=None en prod |
| Auth fuerza bruta | ThrottlerModule: 5 intentos/min en `/auth/login` |
| Contraseñas | bcrypt rounds=12, mínimo 10 chars + complejidad |
| Uploads | MIME filter (.pfx / .txt), límite 5 MB |
| Logs | Sin PII (sin CUITs, emails ni tokens en logs) |
| Secretos | Validación al arrancar: falla si JWT_SECRET / ENCRYPTION_KEY / DB_PASSWORD no están |
| TypeORM | synchronize=false en producción |
| Swagger | Solo disponible cuando NODE_ENV != production |
| SSL DB | Configurable vía DB_SSL y DB_SSL_REJECT_UNAUTHORIZED |

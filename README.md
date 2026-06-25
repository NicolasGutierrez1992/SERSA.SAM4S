# SERSA SAM4S — Sistema de Gestión de Certificados CRS

Sistema web para la gestión, generación y descarga de **certificados CRS** para controladores fiscales SAM4S, con integración directa a los servicios SOAP de AFIP.

---

## Qué es este sistema

Los **certificados CRS** son certificados digitales obligatorios que habilitan legalmente el funcionamiento de controladores fiscales ante AFIP (Administración Federal de Ingresos Públicos, Argentina). Sin un certificado CRS vigente, el controlador fiscal no puede emitir comprobantes.

**Cadena de distribución:**

```
SERSA (fabricante)
  └── Mayorista (ej: OLICART, MARINUCCI, COLOMA, SANTICH)
        └── Distribuidor (técnico que instala el controlador en el local comercial)
              └── Controlador fiscal SAM4S (necesita certificado CRS de AFIP)
```

SERSA es el fabricante habilitado por AFIP. A través de este sistema, sus distribuidores pueden obtener el certificado CRS de un controlador fiscal sin necesidad de interactuar directamente con los servicios web de AFIP.

---

## Arquitectura

```
Usuarios
   │
   ▼
┌─────────────────────────────────┐
│  Frontend (Vercel)              │
│  Next.js 15 · TypeScript        │
│  TailwindCSS · Ant Design       │
│  Auth: cookie httpOnly          │
└────────────┬────────────────────┘
             │ HTTPS + cookie
             ▼
┌─────────────────────────────────┐
│  Backend (Railway)              │
│  NestJS 10 · TypeORM            │
│  Helmet · JWT · bcrypt          │
│  Swagger (solo dev)             │
└──────┬─────────────────┬────────┘
       │ TLS             │ SOAP/HTTPS
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │  AFIP (externo)  │
│  (Railway)   │  │  WSAA · WSCert   │
└──────────────┘  └──────────────────┘
```

---

## Flujo de generación de certificados CRS

```
1. [Admin] Sube certificado PFX de SERSA + contraseña → almacenado AES-256 en BD
2. [Admin] Sube Root_RTI.txt (certificado raíz AFIP) → almacenado AES-256 en BD
3. [Admin] Configura CUIT de SERSA en panel de configuraciones
4. [Distribuidor] Ingresa: Marca (SH) + Modelo (IA o RA) + Nro. de serie del controlador
5. [Backend] Llama a AFIP WSAA con el PFX → obtiene token + sign (válidos 12 hs, cacheados)
6. [Backend] Llama a AFIP WSCert.renovarCertificado() con token/sign + datos del controlador
7. [AFIP] Devuelve certificado CRS en formato PEM (cadena de certificación)
8. [Backend] Arma el archivo .pem, lo almacena en BD, registra la descarga
9. [Distribuidor] Descarga el .pem e instala en el controlador fiscal
```

El nombre del archivo sigue el formato: `SE{Marca}{Modelo}{NroSerie_10digits}-{fecha}.pem`
Ejemplo: `SESHIA0000001371-2025-08-22.pem`

---

## Roles del sistema

| Rol | Nombre | Descripcion | Puede crear usuarios |
|-----|--------|-------------|---------------------|
| 1 | Administrador | Acceso total: usuarios, certs, configuracion, auditoria | Todos los roles |
| 2 | Mayorista | Ve y edita sus distribuidores; sin acceso a configuracion | No |
| 3 | Distribuidor | Descarga certificados CRS segun su limite asignado | No |
| 4 | Facturacion | Acceso a historial de descargas para facturar | No |
| 5 | Tecnico | Gestiona usuarios y configuracion (no puede cambiar roles) | Mayorista, Distribuidor, Tecnico |

### Jerarquia Mayorista - Distribuidor

Cada **distribuidor** pertenece a un mayorista (`id_mayorista`). El mayorista puede:
- Ver y editar solo sus propios distribuidores
- Configurar el `limite_descargas` y el `tipo_descarga` de cada distribuidor

**Tipos de cuenta del distribuidor:**
- `CUENTA_CORRIENTE`: descarga sin prepago; el sistema alerta cuando las descargas pendientes de facturar superan el `notification_limit` del mayorista
- `PREPAGO`: descarga hasta agotar el `limite_descargas` asignado

**Mayoristas predefinidos** (IDs fijos, hardcodeados en frontend):

| ID | Nombre |
|----|--------|
| 1 | SERSA |
| 2 | OLICART |
| 3 | MARINUCCI |
| 4 | COLOMA |
| 5 | SANTICH |

---

## Estados de una descarga

Cada descarga tiene dos estados independientes: uno que ve el **mayorista** (`estadoMayorista`) y otro que ve el **distribuidor** (`estadoDistribuidor`).

| Estado | Descripcion |
|--------|-------------|
| `PENDIENTE_FACTURAR` | Descarga realizada, aun no incluida en factura |
| `FACTURADO` | Descarga ya facturada al mayorista |
| `COBRADO` | Pago recibido (incluye referencia de cobro) |
| `GARANTIA` | Descarga cubierta por garantia |
| `BONIFICADO` | Descarga bonificada sin cargo |
| `PREPAGO` | Descarga descontada de saldo prepago del distribuidor |

Cuando la suma de descargas `PENDIENTE_FACTURAR` de un mayorista supera su `notification_limit`, el sistema envia un email de alerta al administrador via Gmail API (OAuth2, puerto 443).

## Estados de un usuario

| Estado | Valor | Comportamiento |
|--------|-------|----------------|
| Activo | 1 | Puede iniciar sesion y descargar |
| Suspendido | 2 | Puede iniciar sesion y ver el historial, pero no puede descargar |
| Inactivo | 3 | No puede iniciar sesion |

**Suspension en cascada**: si un mayorista esta Suspendido, todos sus distribuidores quedan bloqueados para descargar (sin cambiar su propio estado individual).

---

## Autenticacion

El login devuelve una **cookie httpOnly** (`auth_token`, 1 hora de vigencia). El token nunca queda expuesto en JavaScript ni en `localStorage`.

- **Login**: `POST /api/auth/login` — recibe CUIT + contrasena, setea cookie
- **Logout**: `POST /api/auth/logout` — borra la cookie en el servidor
- **Me**: `GET /api/auth/me` — devuelve el usuario autenticado desde el JWT
- **Cambio de contrasena**: `POST /api/auth/change-password` — requiere autenticacion
- **Contrasena**: minimo 6 caracteres (sin restriccion de complejidad)
- **Rate limiting**: 5 intentos de login por minuto por IP
- **Cambio obligatorio**: los usuarios nuevos o con contrasena reseteada deben cambiarla en el primer login

---

## Desarrollo local con Docker

**Requisitos**: Docker Desktop instalado y corriendo.

```bash
# 1. Copiar y ajustar el archivo de entorno
cp backend/.env.example backend/.env.docker
# Editar backend/.env.docker con los valores reales (ver seccion Variables)

# 2. Levantar todos los servicios
docker compose up --build

# URLs locales:
#   Frontend:   http://localhost:3010
#   Backend:    http://localhost:3011/api
#   Swagger:    http://localhost:3011/api/docs  (solo cuando NODE_ENV != production)
#   PostgreSQL: localhost:5433
```

Comandos utiles:

```bash
docker compose down            # Detener servicios
docker compose logs backend    # Ver logs del backend
docker compose logs frontend   # Ver logs del frontend
docker compose ps              # Ver estado de los servicios
docker compose build backend   # Reconstruir solo el backend
```

### Configuracion inicial (primer arranque)

Despues de levantar Docker por primera vez, ingresar como administrador y:

1. Ir a `http://localhost:3010/dashboard/cert-archivos`
2. **Subir el certificado PFX** de SERSA y su contrasena en la seccion "Certificado PFX"
3. **Subir el Root_RTI.txt** en la seccion "Root_RTI.txt"
4. En la tab **Configuraciones**, editar `AFIP_CUIT` con el CUIT real de SERSA
5. Ir a `http://localhost:3010/usuarios` y actualizar los CUITs de los mayoristas (los valores sembrados son placeholders: `30000000002` a `30000000005`)

---

## Variables de entorno

### Backend (`backend/.env.docker` o Railway)

**Secretos (siempre en `.env`, nunca en BD):**

| Variable | Descripcion | Requerida |
|----------|-------------|-----------|
| `NODE_ENV` | `production` o `development` | Si |
| `PORT` | Puerto del servidor (default 3001) | No |
| `DB_HOST` | Host de PostgreSQL | Si |
| `DB_PORT` | Puerto de PostgreSQL (default 5432) | No |
| `DB_USERNAME` | Usuario de la base de datos | Si |
| `DB_PASSWORD` | Contrasena de la base de datos | Si |
| `DB_NAME` | Nombre de la base de datos | Si |
| `DB_SSL` | Habilitar SSL (`true`/`false`) | No |
| `DB_SSL_REJECT_UNAUTHORIZED` | Verificar certificado TLS | No |
| `JWT_SECRET` | Clave secreta JWT (minimo 64 chars hex) | Si |
| `JWT_EXPIRES_IN` | Vigencia del token (ej: `1h`) | No |
| `ENCRYPTION_KEY` | Clave AES-256 para cifrar certs en BD (64 chars hex) | Si |
| `CORS_ORIGINS` | Origenes permitidos (ej: `https://sersa.vercel.app`) | Si |
| `DEFAULT_USER_PASSWORD` | Contrasena asignada al resetear un usuario | No |
| `ADMIN_MAIL_USER` | Email remitente para alertas (Gmail OAuth2) | No |
| `GMAIL_CLIENT_ID` | Client ID de Google OAuth2 para envio de alertas | No |
| `GMAIL_CLIENT_SECRET` | Client Secret de Google OAuth2 | No |
| `GMAIL_REFRESH_TOKEN` | Refresh Token de Google OAuth2 (expira en 7 dias en modo Testing) | No |
| `THROTTLE_TTL` | Ventana de rate limiting en segundos | No |
| `THROTTLE_LIMIT` | Requests maximos por ventana | No |

**Configuracion AFIP (editable desde el panel `/dashboard/cert-archivos`):**

Estas variables estan almacenadas en la tabla `app_settings` de la BD y se editan desde el panel de administracion sin necesidad de redeploy:

| Clave en `app_settings` | Descripcion |
|-------------------------|-------------|
| `AFIP_WSAA_URL` | URL del servicio WSAA de AFIP |
| `AFIP_WSCERT_WSDL` | WSDL del servicio WSCert de AFIP |
| `AFIP_CUIT` | CUIT de SERSA ante AFIP |
| `AFIP_FABRICANTE` | Codigo de fabricante (`SE`) |
| `ADMIN_MAIL_TO` | Email destino de las alertas |

> El limite de notificacion de descargas pendientes se configura por mayorista en el campo `notification_limit` del usuario (no es un setting global).

Generar valores seguros:
```bash
# JWT_SECRET (128 chars = 512 bits)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (64 chars = 32 bytes = AES-256)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend (`frontend/.env.local`)

| Variable | Descripcion |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL del backend (ej: `https://sersa-backend.railway.app/api`) |

---

## Despliegue en produccion

### Backend (Railway)

1. Conectar el repositorio a Railway y seleccionar la carpeta `backend/`
2. Configurar todas las variables de entorno secretas en el panel de Railway
3. Railway ejecuta automaticamente `npm run build && npm run start:prod`
4. Las migraciones se aplican manualmente: conectarse a la DB de Railway y ejecutar el SQL de cada migracion en `backend/src/database/migrations/`

### Frontend (Vercel)

1. Conectar el repositorio a Vercel y seleccionar la carpeta `frontend/`
2. Configurar `NEXT_PUBLIC_API_URL` apuntando al backend de Railway
3. Vercel ejecuta automaticamente `npm run build`

> **Nota cross-domain**: Las cookies usan `SameSite=None; Secure` en produccion para funcionar entre dominios distintos (Vercel frontend <-> Railway backend). Requiere HTTPS en ambos extremos.

---

## Seguridad

| Medida | Descripcion |
|--------|-------------|
| Cookies httpOnly | El JWT nunca es accesible desde JavaScript del browser |
| Helmet | Headers HTTP de seguridad (CSP, HSTS, X-Frame-Options, etc.) |
| Rate limiting | 5 intentos de login por minuto por IP |
| Swagger deshabilitado en produccion | Documentacion solo disponible en desarrollo |
| `synchronize: false` en produccion | TypeORM no modifica el esquema automaticamente |
| Validacion de secretos al arrancar | El backend falla rapido si faltan JWT_SECRET, ENCRYPTION_KEY o DB_PASSWORD |
| Certificados encriptados en BD | PFX y Root_RTI se almacenan con AES-256; nunca en disco |
| Sin PII en logs | Los logs no registran CUITs, emails ni contenido de tokens |
| Validacion MIME en uploads | Solo se aceptan `.pfx` y `.txt`, limite 5 MB |
| Sanitizacion de filenames | Content-Disposition sanitiza nombres antes de enviar archivos |

---

## Estado del sistema

| Funcionalidad | Estado |
|---------------|--------|
| Login con CUIT + cookie httpOnly | Implementado |
| Roles y permisos (5 roles) | Implementado |
| Cambio de contrasena obligatorio | Implementado |
| Generacion de certificados CRS via AFIP | Implementado (produccion comentada) |
| Descarga de certificados en formato PEM | Implementado |
| Almacenamiento de certs AFIP en BD (AES-256) | Implementado |
| Historial de descargas con estados | Implementado |
| Sistema de notificaciones por email | Implementado |
| Gestion de usuarios (CRUD completo) | Implementado |
| Mayoristas y distribuidores | Implementado |
| Configuracion AFIP desde panel (app_settings) | Implementado |
| Export a Excel del historial | Implementado |
| Auditoria de acciones | Implementado |
| Swagger (solo dev) | Implementado |
| Entorno Docker local | Implementado |

---

## Estructura del proyecto

```
SERSA.SAM4S/
├── backend/                    NestJS API
│   ├── src/
│   │   ├── afip/               Integracion AFIP (WSAA, WSCert SOAP)
│   │   │   ├── afip.module.ts
│   │   │   ├── afip.service.ts
│   │   │   ├── entities/afip-file.entity.ts
│   │   │   └── services/afip-files.service.ts
│   │   ├── auth/               Autenticacion JWT + cookies httpOnly
│   │   ├── certificados/       Gestion y descarga de certificados CRS
│   │   │   ├── controllers/
│   │   │   │   ├── certificado-admin.controller.ts
│   │   │   │   └── certificado-public.controller.ts
│   │   │   ├── certificados.controller.ts    Endpoint de generacion/descarga
│   │   │   ├── certificado-maestro.controller.ts  Upload PFX + Root_RTI
│   │   │   ├── certificado-maestro.service.ts
│   │   │   └── certificados.service.ts
│   │   ├── common/             Servicios compartidos, interceptores, app_settings
│   │   ├── descargas/          Historial de descargas y estados de facturacion
│   │   ├── users/              CRUD de usuarios y mayoristas
│   │   │   ├── dto/user.dto.ts
│   │   │   ├── enums/
│   │   │   │   ├── user-role.enum.ts
│   │   │   │   └── user-status.enum.ts
│   │   │   └── entities/
│   │   │       ├── user.entity.ts
│   │   │       └── mayorista.entity.ts
│   │   ├── auditoria/          Registro de acciones del sistema
│   │   └── main.ts             Bootstrap: Helmet, cookie-parser, CORS, ValidationPipe
│   ├── .env.example            Plantilla de variables de entorno
│   └── Dockerfile
├── frontend/                   Next.js 15 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/          Formulario de login con CUIT
│   │   │   ├── dashboard/      Panel principal (Admin/Tecnico)
│   │   │   │   └── cert-archivos/  Upload PFX, Root_RTI y configuraciones AFIP
│   │   │   ├── usuarios/       CRUD de usuarios
│   │   │   ├── certificados/   Generacion y descarga de certificados CRS
│   │   │   └── change-password/ Cambio obligatorio de contrasena
│   │   ├── components/         AuthGuard, CertificateStatusCard
│   │   ├── contexts/           AuthContext
│   │   ├── hooks/useAuth.tsx   Hook de autenticacion
│   │   ├── lib/api.ts          Cliente Axios (withCredentials, interceptor 401)
│   │   ├── services/api.ts     Facade sobre lib/api.ts para AuthContext
│   │   ├── types/index.ts      Tipos compartidos
│   │   └── middleware.ts       Proteccion de rutas (verifica cookie user_info)
│   └── Dockerfile
├── docker-compose.yml          Orquesta DB + Backend + Frontend
└── README.md
```

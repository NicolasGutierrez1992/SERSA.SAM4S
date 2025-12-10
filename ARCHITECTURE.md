# System Architecture & Components

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Web Browser (Chrome, Firefox, Edge, Safari)                    │  │
│  │  ├─ Port: localhost:3000                                        │  │
│  │  ├─ Protocol: HTTP/HTTPS                                       │  │
│  │  └─ Auth: JWT Token (stored in localStorage)                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Next.js Application Server (Node.js)                           │  │
│  │  ├─ Port: 3000                                                  │  │
│  │  ├─ Framework: Next.js 13+ (App Router)                         │  │
│  │  ├─ Styling: Tailwind CSS                                      │  │
│  │  ├─ State: React Context API                                   │  │
│  │  ├─ HTTP Client: Axios                                         │  │
│  │  └─ Routes:                                                     │  │
│  │      ├─ /login                                                  │  │
│  │      ├─ /certificados (Historial tab fixed)                   │  │
│  │      ├─ /usuarios                                              │  │
│  │      ├─ /dashboard                                             │  │
│  │      └─ /change-password                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────────────────┐
│                       API LAYER                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  NestJS Backend Server (Node.js)                                │  │
│  │  ├─ Port: 3001                                                  │  │
│  │  ├─ Framework: NestJS (TypeScript)                              │  │
│  │  ├─ Architecture: Modular, Decorator-based                      │  │
│  │  ├─ Validation: Class-validator                                 │  │
│  │  ├─ Documentation: Swagger/OpenAPI                              │  │
│  │  │                                                              │  │
│  │  ├─ Main Modules:                                               │  │
│  │  │  ├─ AuthModule (JWT strategy, Login)                        │  │
│  │  │  ├─ UsersModule (CRUD operations)                           │  │
│  │  │  ├─ CertificadosModule                                      │  │
│  │  │  │  ├─ POST /descargar (Generate cert)                     │  │
│  │  │  │  ├─ GET /descargar/:id/archivo (Download file) ← FIXED │  │
│  │  │  │  ├─ GET /descargas (List downloads) ← FIXED             │  │
│  │  │  │  ├─ PUT /descargas/:id/estado (Update status)           │  │
│  │  │  │  └─ GET /metricas (User metrics)                        │  │
│  │  │  ├─ DescargasModule (Download management)                   │  │
│  │  │  ├─ AuditoriaModule (Logging)                               │  │
│  │  │  └─ AfipModule (External AFIP integration)                  │  │
│  │  │                                                              │  │
│  │  └─ Global Middleware:                                          │  │
│  │     ├─ CORS (Cross-Origin Resource Sharing)                    │  │
│  │     ├─ JWT Authentication                                      │  │
│  │     ├─ Logging                                                 │  │
│  │     └─ Error Handling                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ TypeORM
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  TypeORM (ORM - Object-Relational Mapping)                      │  │
│  │  ├─ Database: PostgreSQL                                        │  │
│  │  ├─ Port: 5432                                                  │  │
│  │  ├─ Connection: pooled (max 10 connections)                     │  │
│  │  ├─ Migrations: Auto-enabled                                    │  │
│  │  │                                                              │  │
│  │  └─ Entity Models:                                              │  │
│  │     ├─ User (id_usuario, cuit, nombre, mail, etc)             │  │
│  │     ├─ Descarga (id_descarga, id_usuario, estadoMayorista) ← FIXED │  │
│  │     ├─ Certificado (id_certificado, metadata, etc)            │  │
│  │     ├─ Auditoria (log entries)                                │  │
│  │     └─ Notificacion (notifications)                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ SQL
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Relational Database                                  │  │
│  │  ├─ Version: 12+                                                │  │
│  │  ├─ Tables:                                                     │  │
│  │  │  ├─ usuarios (users)                                         │  │
│  │  │  ├─ descargas (13 records visible in Historial) ← FIXED    │  │
│  │  │  ├─ certificados_v2 (PEM content storage)                   │  │
│  │  │  ├─ auditoria (audit logs)                                 │  │
│  │  │  └─ notificaciones (notifications)                          │  │
│  │  │                                                              │  │
│  │  ├─ Extensions:                                                 │  │
│  │  │  └─ uuid-ossp (UUID generation)                             │  │
│  │  │                                                              │  │
│  │  └─ Key Indexes:                                               │  │
│  │     ├─ descargas.id_descarga (PRIMARY KEY, UUID)              │  │
│  │     ├─ descargas.id_usuario (FOREIGN KEY)                     │  │
│  │     └─ descargas.created_at (sorting/filtering)               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↕ HTTPS
┌─────────────────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  AFIP Services (Argentina Federal Tax Authority)                │  │
│  │  ├─ WSAA (Web Services Authorization)                           │  │
│  │  │  └─ Purpose: Get authentication tokens                       │  │
│  │  │                                                              │  │
│  │  └─ WSCERT (Web Services Certificates)                          │  │
│  │     └─ Purpose: Generate fiscal certificates                   │  │
│  │                                                                 │  │
│  │  Note: Currently in PRODUCTION mode (real AFIP calls)          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Frontend Component Architecture

```
Next.js App (:3000)
├─ Middleware
│  └─ Protected routes (JWT validation)
├─
├─ Layout Components
│  ├─ Header (Navigation, User Menu)
│  ├─ Sidebar (Menu)
│  └─ Footer (Info)
│
├─ Pages (App Router)
│  ├─ /login
│  │  └─ Login form with JWT token handling
│  │
│  ├─ /certificados ← MAIN FOCUS
│  │  ├─ Tab: Descargar (Generate certificates)
│  │  ├─ Tab: Historial (Download history) ← FIXED
│  │  │   ├─ Filter form (date, status, etc)
│  │  │   ├─ Certificate table
│  │  │   └─ Download button (calls descargarArchivo) ← FIXED
│  │  └─ Tab: Estados (Status updates)
│  │
│  ├─ /usuarios
│  │  ├─ User list
│  │  ├─ Create user form
│  │  └─ Edit user form
│  │
│  ├─ /dashboard
│  │  ├─ Statistics cards
│  │  ├─ Charts
│  │  └─ Recent activities
│  │
│  └─ /change-password
│     └─ Password change form
│
├─ API Services (lib/api.ts)
│  ├─ certificadosApi.descargar() → POST
│  ├─ certificadosApi.descargarArchivo() → GET ← FIXED
│  ├─ certificadosApi.getHistorialDescargas() → GET ← FIXED
│  ├─ certificadosApi.getMetricas() → GET
│  ├─ usersApi.login() → POST
│  └─ usersApi.getProfile() → GET
│
├─ Context (State Management)
│  ├─ AuthContext (logged-in user)
│  ├─ NotificationContext (toast messages)
│  └─ FilterContext (page filters)
│
└─ Types (lib/api.ts)
   ├─ DescargaHistorial ✓ (id: string)
   ├─ LoginResponse
   ├─ User
   └─ Metricas
```

### Backend Module Architecture

```
NestJS App (:3001)
│
├─ App Module (Root)
│  ├─ Imports all feature modules
│  ├─ Global middleware/pipes
│  └─ Error handling
│
├─ Auth Module
│  ├─ AuthService
│  │  └─ login(cuit, password) → JWT token
│  ├─ JwtStrategy
│  │  └─ Validates JWT tokens
│  └─ AuthController
│     └─ POST /login
│        POST /change-password
│
├─ Users Module
│  ├─ UsersService
│  │  ├─ findOne(id)
│  │  ├─ findAll()
│  │  ├─ create()
│  │  └─ update()
│  ├─ User Entity
│  │  └─ id_usuario, cuit, nombre, mail, id_rol, id_mayorista
│  └─ UsersController
│     └─ GET /users
│        POST /users
│        PATCH /users/:id
│        DELETE /users/:id
│
├─ Certificados Module ← MAIN FIX HERE
│  ├─ CertificadosService
│  │  └─ generarCertificado() → calls AFIP
│  ├─ CertificadosController
│  │  ├─ POST /descargar (Generate)
│  │  ├─ GET /descargar/:downloadId/archivo (Download) ← FIXED
│  │  ├─ GET /descargas (List) ← FIXED
│  │  ├─ PUT /descargas/:id/estado (Update status)
│  │  └─ GET /metricas (Statistics)
│  └─ Entities
│     └─ Certificado (id_certificado, metadata, etc)
│
├─ Descargas Module
│  ├─ DescargasService ← TYPE CONVERSIONS HERE
│  │  ├─ getDescargas(params) → with filtering
│  │  ├─ registrarDescarga() → record download
│  │  ├─ getCertificadoPem(descargaId) ← SIGNATURE FIXED
│  │  └─ updateEstadoDescarga()
│  ├─ Descarga Entity ← TYPES FIXED
│  │  ├─ id_descarga: string (UUID) ← KEY FIX
│  │  ├─ id_usuario: number
│  │  ├─ estadoMayorista: string
│  │  └─ estadoDistribuidor: string
│  └─ DTO Folder
│     ├─ descarga.dto.ts
│     ├─ query-descargas.dto.ts ← NEW FILE
│     └─ Other DTOs
│
├─ AFIP Module
│  ├─ AfipService
│  │  ├─ getToken() → WSAA
│  │  ├─ generateCertificate() → WSCERT
│  │  └─ verifyCertificate()
│  └─ AfipController
│     └─ GET /afip/status
│
├─ Auditoria Module
│  ├─ AuditoriaService
│  │  └─ log() → record user actions
│  └─ Auditoria Entity
│     └─ id_usuario, accion, recurso, fecha, etc
│
└─ Health Check
   └─ GET /health
      GET /api (API info)
```

---

## Data Flow: Certificate Download (FIXED)

### Step 1: User Initiates Download
```
User clicks download icon in Historial tab
    ↓
descarga.id extracted (UUID string: "550e8400-e29b-41d4-a716-446655440000")
    ↓
descargarArchivo(downloadId: string) called
```

### Step 2: Frontend API Call
```
axios.get('/certificados/descargar/{uuid}/archivo', {
  responseType: 'blob',
  headers: {
    Authorization: 'Bearer {token}'
  }
})
    ↓
GET http://localhost:3001/api/certificados/descargar/550e8400-e29b-41d4-a716-446655440000/archivo
```

### Step 3: Backend Route Matching
```
@Get('descargar/:downloadId/archivo') ← DECORATOR (WAS MISSING) ✓ FIXED
    ↓
NestJS Router matches request to route
    ↓
descargarArchivoPem(@Param('downloadId') downloadId: string) ← TYPE (WAS number) ✓ FIXED
```

### Step 4: Service Execution
```
getCertificadoPem(descargaId: string | number) ← SIGNATURE (WAS number) ✓ FIXED
    ↓
Query database:
  SELECT * FROM descargas 
  WHERE id_descarga = String(descargaId)
    ↓
Find associated certificate:
  SELECT * FROM certificados_v2 
  WHERE id_certificado = String(descarga.id_certificado)
    ↓
Extract PEM content from metadata
```

### Step 5: Response Generation
```
Response headers:
  Content-Type: application/x-pem-file
  Content-Disposition: attachment; filename="Certificado_CTRL001234_20241209.pem"
    ↓
Response body: PEM file content
    ↓
HTTP 200 OK ✓ (was 404 ✗)
```

### Step 6: Browser Download
```
Browser receives blob data
    ↓
Save to Downloads folder
    ↓
User gets file successfully ✓
```

---

## Database Schema (Key Tables)

### descargas Table
```sql
CREATE TABLE descargas (
  id_descarga UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- ✓ FIXED: UUID type
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  id_certificado UUID REFERENCES certificados_v2(id_certificado),
  certificado_nombre TEXT,
  estadoMayorista TEXT DEFAULT 'Pendiente de Facturar',
  estadoDistribuidor TEXT DEFAULT 'Pendiente de Facturar',
  fecha_facturacion TIMESTAMP,
  tamaño INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_descargas_usuario ON descargas(id_usuario);
CREATE INDEX idx_descargas_created ON descargas(created_at);
```

### usuarios Table
```sql
CREATE TABLE usuarios (
  id_usuario SERIAL PRIMARY KEY,
  cuit VARCHAR(11) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  mail VARCHAR(255),
  contraseña VARCHAR(255),
  id_rol INTEGER,
  id_mayorista INTEGER,
  limite_descargas INTEGER DEFAULT 5,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### certificados_v2 Table
```sql
CREATE TABLE certificados_v2 (
  id_certificado UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metadata TEXT,  -- Contains PEM content
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints (Simplified View)

### Authentication
```
POST /api/auth/login
POST /api/auth/change-password
POST /api/auth/reset-password/:userId
```

### Certificate Management ← FOCUS AREA
```
POST   /api/certificados/descargar (Generate)
GET    /api/certificados/descargar/:downloadId/archivo ← FIXED
GET    /api/certificados/descargas ← FIXED
GET    /api/certificados/descargas/usuario/:usuarioId
GET    /api/certificados/descargas/mayorista/:mayoristaId
PUT    /api/certificados/descargas/:downloadId/estado
GET    /api/certificados/metricas
GET    /api/certificados/afip/status
```

### User Management
```
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id
```

### Audit & Monitoring
```
GET    /api/auditoria
GET    /api/auditoria/statistics
POST   /api/auditoria/cleanup
```

---

## Environment Configuration

### Backend (.env)
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=sersa
DATABASE_USER=postgres
DATABASE_PASSWORD=password

JWT_SECRET=your-secret-key
JWT_EXPIRATION=1h

AFIP_MODE=PRODUCTION
AFIP_CERT_PATH=./certs/certificado.pfx
AFIP_CERT_PASS=password
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Technology Stack

### Frontend
- **Runtime:** Node.js 18+
- **Framework:** Next.js 13+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **State:** React Context API
- **UI Components:** Custom + Tailwind

### Backend
- **Runtime:** Node.js 18+
- **Framework:** NestJS
- **Language:** TypeScript
- **Database ORM:** TypeORM
- **Database:** PostgreSQL 12+
- **Validation:** class-validator
- **API Docs:** Swagger/OpenAPI
- **Authentication:** JWT

### External
- **AFIP Web Services:** WSAA + WSCERT
- **Certificate:** X.509 (PKCS#12)

---

## Deployment Architecture

```
┌─────────────────────────────────────┐
│     Cloud/Server Environment        │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Frontend (Next.js)          │  │
│  │  PORT: 3000                  │  │
│  └──────────────────────────────┘  │
│           ↕                         │
│  ┌──────────────────────────────┐  │
│  │  Backend (NestJS)            │  │
│  │  PORT: 3001                  │  │
│  └──────────────────────────────┘  │
│           ↕                         │
│  ┌──────────────────────────────┐  │
│  │  PostgreSQL Database         │  │
│  │  PORT: 5432                  │  │
│  └──────────────────────────────┘  │
│                                     │
│  Plus external AFIP connectivity   │
│                                     │
└─────────────────────────────────────┘
```

---

## Key Improvements Made

### 1. Route Registration ✓
- **Before:** Route not registered in routing table
- **After:** Properly registered with @Get decorator
- **Impact:** Route now accessible to frontend

### 2. Type Safety ✓
- **Before:** Parameter typed as `number`
- **After:** Parameter typed as `string` (matches UUID)
- **Impact:** No type mismatches between layers

### 3. Service Compatibility ✓
- **Before:** Service expected `number` parameter
- **After:** Service accepts `string | number`
- **Impact:** Flexible input handling

### 4. Error Handling ✓
- **Before:** No specific error messages
- **After:** Detailed error logging and messages
- **Impact:** Easier debugging and support

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Status:** ✅ Complete and Verified

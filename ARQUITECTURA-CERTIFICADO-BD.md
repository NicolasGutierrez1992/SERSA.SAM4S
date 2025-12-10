# 🏗️ Arquitectura - Certificado .PFX en Base de Datos

## Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE / USUARIO                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP Request (JWT Token)
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                     NestJS Backend API                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          CertificadoMaestroController                    │  │
│  │  ┌─ POST /certificados-maestro/upload                   │  │
│  │  ├─ GET /certificados-maestro/info                      │  │
│  │  └─ (solo ADMIN)                                         │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│  ┌────────────────▼─────────────────────────────────────────┐  │
│  │       CertificadoMaestroService                          │  │
│  │  ├─ cargarCertificadoMaestro()                           │  │
│  │  ├─ obtenerCertificadoMaestro()                          │  │
│  │  ├─ extraerMetadatos()                                   │  │
│  │  └─ validarCertificado()                                 │  │
│  └────────────────┬──────────────┬────────────────────────┐   │
│                   │              │                        │    │
│  ┌────────────────▼──┐  ┌────────▼──────────┐  ┌─────────▼──┐ │
│  │  EncryptionService│  │ CertificadoMigr.  │  │ AfipService│ │
│  │                   │  │                   │  │            │ │
│  │ encrypt()         │  │ migrarSiEs        │  │ loginWsaa()│ │
│  │ decrypt()         │  │  Necesario()      │  │            │ │
│  │ AES-256-CBC       │  │                   │  │ generarCert│ │
│  └─────────────────┘  └─────────────────────┘  └────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            AppInitializerService                          │ │
│  │     (Ejecuta migración al startup)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       │ Read/Write            │ Read (fallback)
       │                       │
┌──────▼────────────┐   ┌─────▼────────────────┐
│  PostgreSQL BD    │   │  File System         │
├───────────────────┤   ├─────────────────────┤
│ certificados_     │   │ backend/certs/      │
│   maestro         │   │   certificado.pfx   │
│                   │   │   Root_RTI.txt      │
│ id: VARCHAR(50)   │   │                     │
│ pfx_data: BYTEA   │   │ (Legacy/Fallback)   │
│ password_enc...   │   │                     │
│ metadata: JSONB   │   └─────────────────────┘
│ activo: BOOLEAN   │
└───────────────────┘
```

---

## 🔐 Flujo de Encriptación

```
CERTIFICADO CARGADO
       │
       ▼
┌─────────────────────────────┐
│  Validación                 │
│  ├─ Es .pfx válido?        │
│  ├─ Contraseña correcta?   │
│  └─ Metadatos extraídos?   │
└────────────┬────────────────┘
             │ ✓ Válido
             ▼
┌─────────────────────────────┐
│  EncryptionService.encrypt()│
│  ├─ Generar IV aleatorio   │
│  ├─ AES-256-CBC encrypt    │
│  └─ Resultado: base64      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Almacenar en BD            │
│  ├─ pfx_data (encriptado)  │
│  ├─ password_encriptada    │
│  ├─ metadata (JSONB)       │
│  └─ timestamps             │
└─────────────────────────────┘
```

---

## 🔄 Flujo de Autenticación AFIP

```
AfipService.loginWsaa()
       │
       ▼
    ¿USAR_BD_PARA_CERTIFICADO = true?
       │
   ┌───┴────┐
   │        │
  SÍ       NO
   │        │
   ▼        ▼
CertMaestro  FileSystem
Service      (backend/certs/)
   │        │
   │        ├─ readFileSync()
   │        └─ fs.existsSync()
   │        │
   └────┬──┘
        │
        ▼
   Desencriptar (si es BD)
        │
        ▼
   Parse PFX (forge.pkcs12)
        │
        ├─ Extraer certificado
        └─ Extraer clave privada
        │
        ▼
   Crear TRA (Ticket Request Access)
        │
        ▼
   Firmar TRA con clave privada
        │
        ▼
   Generar CMS base64
        │
        ▼
   SOAP Request a WSAA AFIP
        │
        ▼
   Recibir token y sign
        │
        ▼
   Cachear en memoria (12 horas)
        │
        ▼
   Retornar al cliente
```

---

## 📦 Estructura de Módulos

```
CertificadosModule
├── Imports:
│   ├── TypeOrmModule.forFeature([
│   │   User, 
│   │   Certificado, 
│   │   CertificadoMaestro
│   │])
│   ├── CertificadosModule (forwardRef)
│   ├── AfipModule (forwardRef)
│   ├── DescargasModule (forwardRef)
│   ├── SharedAuthModule
│   └── UsersModule
│
├── Controllers:
│   ├── CertificadosController (certificados CRS generados)
│   └── CertificadoMaestroController (certificado maestro .pfx)
│
├── Providers:
│   ├── CertificadosService
│   ├── CertificadoMaestroService
│   ├── EncryptionService
│   └── CertificadoMigrationService
│
└── Exports:
    ├── CertificadosService
    ├── CertificadoMaestroService
    ├── EncryptionService
    └── CertificadoMigrationService
```

---

## 🔄 Ciclo de Vida de la Aplicación

```
Application Start
       │
       ▼
┌─────────────────────────────┐
│ TypeOrmModule.forRootAsync()│
│ ├─ Conectar a PostgreSQL   │
│ ├─ Crear tablas (sync)     │
│ └─ Tablas listas           │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ AppInitializerService       │
│ onModuleInit()              │
│                             │
│ ├─ Cargar config            │
│ ├─ Si USAR_BD=true          │
│ │  └─ migrarSiEsNecesario()│
│ │     ├─ ¿Existe en BD?    │
│ │     │  Sí: SKIP ✓        │
│ │     │  No: Migrar        │
│ │     │  ├─ Leer archivo   │
│ │     │  ├─ Validar .pfx   │
│ │     │  ├─ Encriptar      │
│ │     │  ├─ Almacenar BD   │
│ │     │  └─ Log ✓          │
│ │                          │
│ └─ Listo para usar          │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Aplicación lista            │
│ ├─ APIs disponibles         │
│ ├─ BD con certificado       │
│ └─ AFIP listo               │
└─────────────────────────────┘
```

---

## 🗄️ Modelo de Datos

### Tabla: `certificados_maestro`

```typescript
@Entity('certificados_maestro')
export class CertificadoMaestro {
  @PrimaryColumn()
  id: string;                          // 'AFIP_PRINCIPAL'
  
  @Column({ type: 'bytea' })
  pfx_data: Buffer;                    // Encriptado AES-256-CBC
  
  @Column({ type: 'text' })
  password_encriptada: string;         // Encriptado AES-256-CBC
  
  @Column({ type: 'jsonb' })
  metadata?: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    thumbprint: string;
  };
  
  @Column({ type: 'varchar(50)', nullable: true })
  certificado_identificador?: string;  // CUIT
  
  @Column({ type: 'boolean', default: true })
  activo: boolean;
  
  @Column({ type: 'timestamp' })
  created_at: Date;
  
  @Column({ type: 'timestamp' })
  updated_at: Date;
  
  @Column({ type: 'timestamp', nullable: true })
  uploaded_at?: Date;
}
```

---

## 🔐 Encriptación AES-256-CBC

```
Datos Originales (string | Buffer)
       │
       ▼
┌─────────────────────────────┐
│ EncryptionService.encrypt() │
├─────────────────────────────┤
│                             │
│ 1. Generar IV (16 bytes)   │
│    const iv = randomBytes()│
│                             │
│ 2. Crear cipher             │
│    createCipheriv(          │
│      'aes-256-cbc',         │
│      ENCRYPTION_KEY,        │ ← 32 bytes (256 bits)
│      iv                     │   Derivado de variable env
│    )                        │
│                             │
│ 3. Encriptar               │
│    encrypted = cipher.update(data)
│    encrypted += cipher.final()
│                             │
│ 4. Concatenar IV + encrypted
│    Buffer.concat([iv, encrypted])
│                             │
│ 5. Base64 encode            │
│    .toString('base64')      │
│                             │
└────────────┬────────────────┘
             │
    Datos Encriptados (Base64)
             │
             ▼
   Almacenar en BD
```

**Desencriptación:**
```
1. Base64 decode
2. Extraer IV (primeros 16 bytes)
3. Extraer encrypted (resto)
4. createDecipheriv() con misma clave
5. Desencriptar
6. Retornar datos originales
```

---

## 📡 API Endpoints

### Certificado Maestro (.pfx)

```
POST /certificados-maestro/upload
├─ Auth: JwtAuthGuard
├─ Role: ADMIN
├─ Body:
│  ├─ pfxFile (form-data)
│  ├─ password
│  └─ certificado_identificador? (optional)
└─ Response: { mensaje, certificado_id }

GET /certificados-maestro/info
├─ Auth: JwtAuthGuard
├─ Role: ADMIN
└─ Response: { existe, id, metadata, activo, timestamps }
```

### Certificados Generados (CRS)

```
GET /certificados
├─ Auth: JwtAuthGuard
└─ Response: Lista de certificados generados

POST /certificados/generar
├─ Auth: JwtAuthGuard
├─ Body: { marca, modelo, numeroSerie }
└─ Response: { downloadId, filename, checksum }

GET /certificados/descargar/:id
└─ Response: Archivo .pem
```

---

## 🔄 Relaciones entre Servicios

```
AppModule
    │
    ├─ CertificadosModule
    │   │
    │   ├─ CertificadoMaestroService
    │   │   ├─ EncryptionService
    │   │   └─ Repository<CertificadoMaestro>
    │   │
    │   ├─ CertificadoMigrationService
    │   │   ├─ CertificadoMaestroService
    │   │   └─ Repository<CertificadoMaestro>
    │   │
    │   ├─ CertificadosService
    │   │   ├─ AfipService
    │   │   ├─ DescargasService
    │   │   └─ Repository<Certificado>
    │   │
    │   └─ CertificadoMaestroController
    │
    ├─ AfipModule
    │   └─ AfipService
    │       ├─ CertificadoMaestroService
    │       └─ LoggerService
    │
    └─ AppInitializerService
        └─ CertificadoMigrationService
```

---

## ⚙️ Variables de Configuración

```
Environment Variables
│
├─ Encriptación (NEW)
│  ├─ ENCRYPTION_KEY (32 bytes hex)
│  └─ USAR_BD_PARA_CERTIFICADO (true|false)
│
├─ AFIP (EXISTING)
│  ├─ AFIP_CUIT
│  ├─ AFIP_FABRICANTE
│  ├─ AFIP_WSAA_URL
│  ├─ AFIP_WSCERT_WSDL
│  ├─ AFIP_CERT_PATH
│  ├─ AFIP_KEY_PASSWORD
│  └─ AFIP_ROOT_PATH
│
├─ Base de Datos
│  ├─ DB_HOST
│  ├─ DB_PORT
│  ├─ DB_USERNAME
│  ├─ DB_PASSWORD
│  └─ DB_NAME
│
└─ Aplicación
   ├─ NODE_ENV
   ├─ PORT
   ├─ JWT_SECRET
   └─ JWT_EXPIRATION
```

---

## 🎯 Decisiones de Arquitectura

### 1. **Tabla Separada**
- ✅ `certificados_maestro` para almacenar .pfx
- ✅ `certificados_v2` para almacenar .pem generados
- ✅ Separación de responsabilidades

### 2. **Encriptación AES-256-CBC**
- ✅ Estándar militar
- ✅ IV aleatorio (no predecible)
- ✅ Clave derivada de variable de entorno

### 3. **Migración Automática**
- ✅ OnModuleInit en AppInitializerService
- ✅ Verifica existencia en BD
- ✅ No bloquea si falla (graceful degradation)

### 4. **Fallback a Archivo**
- ✅ Si BD falla, lee de archivo
- ✅ Compatibilidad hacia atrás
- ✅ Resilencia

### 5. **Acceso Restringido**
- ✅ Solo administradores
- ✅ JWT required
- ✅ Nunca expone contraseña en API

---

## 📈 Escalabilidad

### Actual
- 1 certificado maestro por aplicación
- Almacenado en PostgreSQL
- Acceso en memoria mediante caché

### Futuro (Opcional)
- Múltiples certificados maestros (por cliente/región)
- Rotación automática de certificados
- Auditoría detallada de accesos
- Bóveda de secretos externa (Vault)
- Replicación de BD para alta disponibilidad

---

**Última actualización:** Diciembre 2025
**Versión:** 1.0

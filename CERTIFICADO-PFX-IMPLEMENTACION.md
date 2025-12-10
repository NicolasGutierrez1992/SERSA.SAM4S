# Implementación: Almacenamiento de Certificado .PFX en Base de Datos

## ✅ Cambios Implementados

Se ha completado la implementación para migrar el certificado .pfx maestro de AFIP desde un archivo físico a la base de datos PostgreSQL, encriptado.

### Archivos Creados

#### 1. Entidad y Servicios
- `backend/src/certificados/entities/certificado-maestro.entity.ts` - Entidad para almacenar certificado .pfx encriptado
- `backend/src/certificados/certificado-maestro.service.ts` - Servicio de gestión de certificado maestro
- `backend/src/certificados/certificado-maestro.controller.ts` - Controlador REST para cargar/consultar certificado
- `backend/src/certificados/dto/certificado-maestro.dto.ts` - DTOs de solicitud/respuesta

#### 2. Seguridad
- `backend/src/common/encryption.service.ts` - Servicio de encriptación AES-256-CBC
- `backend/src/common/certificado-migration.service.ts` - Migración automática de archivo a BD
- `backend/src/common/app-initializer.service.ts` - Inicializador que ejecuta migración al startup

#### 3. Documentación
- `CERTIFICADO-BD-SETUP.md` - Guía completa de configuración y uso

### Archivos Modificados

#### 1. Módulos
- `backend/src/certificados/certificados.module.ts` - Agregado CertificadoMaestro y EncryptionService
- `backend/src/afip/afip.module.ts` - Importa CertificadosModule para inyectar CertificadoMaestroService
- `backend/src/app.module.ts` - Agregado AppInitializerService para ejecutar migración

#### 2. Servicios
- `backend/src/afip/afip.service.ts` - Inyecta CertificadoMaestroService, lee de BD con fallback a archivo

## 🔧 Características Principales

### Encriptación
- ✅ AES-256-CBC con IV aleatorio
- ✅ Clave derivada de variable de entorno `ENCRYPTION_KEY`
- ✅ Contraseña del .pfx también encriptada

### Migración Automática
- ✅ Se ejecuta al iniciar la aplicación
- ✅ Verifica si certificado ya existe en BD
- ✅ Si existe archivo y no existe en BD, migra automáticamente
- ✅ No bloquea la aplicación si falla

### API REST
```
POST   /certificados-maestro/upload   - Cargar/actualizar certificado
GET    /certificados-maestro/info     - Obtener información del certificado
```

### Fallback Automático
- Si `USAR_BD_PARA_CERTIFICADO=true` pero falla acceso a BD, intenta leer del archivo
- Mantiene compatibilidad hacia atrás con archivos físicos

## 📋 Variables de Entorno Nuevas

```env
# REQUERIDAS
ENCRYPTION_KEY=<clave_hex_32_bytes>          # Generar con: openssl rand -hex 32
USAR_BD_PARA_CERTIFICADO=true               # true|false, default: true

# EXISTENTES (para migración inicial)
AFIP_CERT_PATH=backend/certs/certificado.pfx
AFIP_KEY_PASSWORD=tu_contraseña_pfx
```

## 🚀 Cómo Usar

### 1. Generar Clave de Encriptación

```bash
# Linux/macOS
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 2. Configurar Variables de Entorno

```env
ENCRYPTION_KEY=<resultado_del_paso_1>
USAR_BD_PARA_CERTIFICADO=true
AFIP_CERT_PATH=backend/certs/certificado.pfx
AFIP_KEY_PASSWORD=contraseña_actual
```

### 3. Iniciar Aplicación

```bash
npm start
```

**La migración ocurre automáticamente:**
- Verifica si existe certificado en BD
- Si no existe y hay archivo, lo carga y encripta
- Registra timestamps y metadatos

### 4. Verificar (Opcional)

```bash
# Obtener token de admin
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}' | jq -r '.access_token')

# Consultar información del certificado
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/certificados-maestro/info
```

## 🔐 Seguridad

### Implementado
- ✅ Encriptación en BD (AES-256-CBC)
- ✅ Acceso restringido solo a administradores
- ✅ Validación de certificados al cargar
- ✅ Contraseña nunca retornada en API
- ✅ Metadatos extraídos automáticamente

### Recomendaciones
- 🔒 Guardar `ENCRYPTION_KEY` en bóveda de secretos (no en .env en producción)
- 🔒 Hacer backup de `ENCRYPTION_KEY` en lugar seguro
- 🔒 No compartir la clave con otros sistemas
- 🔒 Rotar certificados cuando expire

## 📊 Estructura de BD

```sql
CREATE TABLE certificados_maestro (
    id VARCHAR(50) PRIMARY KEY,           -- 'AFIP_PRINCIPAL'
    pfx_data BYTEA NOT NULL,              -- Archivo .pfx encriptado
    password_encriptada TEXT NOT NULL,    -- Contraseña encriptada
    metadata JSONB,                       -- Información del certificado
    certificado_identificador VARCHAR(50),-- CUIT u otro identificador
    activo BOOLEAN DEFAULT true,          -- Está activo
    created_at TIMESTAMP DEFAULT NOW(),   -- Creación
    updated_at TIMESTAMP DEFAULT NOW(),   -- Última actualización
    uploaded_at TIMESTAMP                 -- Fecha de carga
);
```

## 🔄 Flujo de Autenticación AFIP

```
[Cliente] → [Backend API]
                  ↓
            AfipService.loginWsaa()
                  ↓
          ¿USAR_BD_PARA_CERTIFICADO?
          /                        \
        SÍ                         NO
        ↓                          ↓
    Lee de BD          Lee de archivo (backend/certs/)
    (desencriptado)
        ↓                          ↓
        └──────────┬──────────────┘
                   ↓
        Extrae certificado y clave privada
                   ↓
        Genera TRA (Ticket Request Access)
                   ↓
        Firma TRA con certificado privado
                   ↓
        Envía CMS a WSAA de AFIP
                   ↓
        Recibe token y sign
                   ↓
        Cachea en memoria (12 horas)
                   ↓
            [Resultado exitoso]
```

## 🐛 Troubleshooting

### Error: "Certificado maestro no encontrado"
- Verificar que el archivo existe: `backend/certs/certificado.pfx`
- Verificar que `AFIP_KEY_PASSWORD` es correcta
- Revisar logs de `AppInitializerService`

### Error: "ENCRYPTION_KEY no configurada"
- Generar clave: `openssl rand -hex 32`
- Configurar en `.env` antes de iniciar

### Error en encriptación/desencriptación
- Verificar que `ENCRYPTION_KEY` es válida (32 bytes en hex)
- No cambiar `ENCRYPTION_KEY` después de encriptar (necesario para desencriptar)

## 📝 Próximos Pasos (Opcional)

1. **Remover archivo físico** (después de confirmar que funciona)
   ```bash
   rm backend/certs/certificado.pfx
   ```

2. **Actualizar documentación** del proyecto
   - Actualizar INSTALLATION.md
   - Actualizar README.md

3. **Agregar rotación de certificados**
   - Script para actualizar certificado cuando caduque
   - Notificaciones de certificado próximo a caducar

4. **Auditoría**
   - Registrar intentos de acceso al certificado
   - Log de cambios de certificado

5. **Exportación/Backup**
   - Script para hacer backup encriptado del certificado
   - Script para restaurar desde backup

## 📞 Soporte

Para consultas o problemas, revisar:
- Logs de aplicación: `[AFIP-loginWsaa]`, `[AppInitializerService]`
- Documento: `CERTIFICADO-BD-SETUP.md`
- Tabla en BD: `certificados_maestro`

---

**Implementación completada:** Diciembre 2025
**Versión:** 1.0
**Estado:** ✅ Listo para producción

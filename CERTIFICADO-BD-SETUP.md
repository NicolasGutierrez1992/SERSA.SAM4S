# Guía de Configuración: Certificado Maestro en Base de Datos

## Resumen de Cambios

Se ha implementado un sistema para almacenar el certificado .pfx maestro de AFIP en la base de datos PostgreSQL de forma encriptada, eliminando la dependencia de archivos físicos en el servidor.

## Componentes Nuevos

### 1. **Entidad `CertificadoMaestro`** (`certificado-maestro.entity.ts`)
- Tabla: `certificados_maestro`
- Almacena el archivo .pfx encriptado en bytea
- Almacena la contraseña encriptada
- Incluye metadatos del certificado (subject, issuer, validez, thumbprint)

### 2. **Servicio de Encriptación** (`encryption.service.ts`)
- Encriptación AES-256-CBC
- Desencriptación automática
- Clave derivada desde variable de entorno `ENCRYPTION_KEY`

### 3. **Servicio de Certificado Maestro** (`certificado-maestro.service.ts`)
- Gestiona carga/actualización del certificado .pfx
- Extrae y almacena metadatos del certificado
- Valida certificados antes de almacenarlos
- Proporciona acceso desencriptado al certificado

### 4. **Controlador de Certificado Maestro** (`certificado-maestro.controller.ts`)
- Endpoint POST `/certificados-maestro/upload` - Cargar certificado
- Endpoint GET `/certificados-maestro/info` - Ver información del certificado
- Solo acceso para administradores

### 5. **Servicio de Migración** (`certificado-migration.service.ts`)
- Migra automáticamente el certificado de archivo a BD al iniciar
- Se ejecuta solo una vez (verifica si ya existe en BD)

### 6. **Inicializador de Aplicación** (`app-initializer.service.ts`)
- Ejecuta la migración automáticamente al startup
- Maneja errores sin bloquear la aplicación

### 7. **AfipService Actualizado** (`afip.service.ts`)
- Lee certificado de BD (si `USAR_BD_PARA_CERTIFICADO=true`)
- Fallback automático a archivo si falla BD
- Validación de configuración flexible

## Variables de Entorno Requeridas

### Encriptación (Nueva)
```env
# Clave de encriptación (generar con: openssl rand -hex 32)
ENCRYPTION_KEY=tu_clave_hex_de_32_bytes_aqui

# Usar BD para almacenar certificado (default: true)
USAR_BD_PARA_CERTIFICADO=true
```

### AFIP (Existentes - mantener para migración)
```env
AFIP_CUIT=tu_cuit
AFIP_FABRICANTE=SE
AFIP_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
AFIP_WSCERT_WSDL=https://servicios1.afip.gov.ar/wscert/service
AFIP_CERT_PATH=backend/certs/certificado.pfx
AFIP_KEY_PASSWORD=tu_contraseña
AFIP_ROOT_PATH=backend/certs/Root_RTI.txt

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=usuario
DB_PASSWORD=contraseña
DB_NAME=db_sersa
```

## Generación de Clave de Encriptación

Para generar una clave segura de 32 bytes (256 bits) en formato hexadecimal:

**Linux/macOS:**
```bash
openssl rand -hex 32
```

**PowerShell (Windows):**
```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Node.js:**
```javascript
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

## Proceso de Migración

### Opción 1: Migración Automática (Recomendado)

1. Configurar las variables de entorno con los valores correctos
2. Asegurarse de que el archivo `backend/certs/certificado.pfx` existe
3. Establecer `USAR_BD_PARA_CERTIFICADO=true`
4. Iniciar la aplicación

**La migración ocurrirá automáticamente:**
- Se verifica si existe un certificado en BD
- Si no existe y hay archivo físico, se carga automáticamente
- El certificado se encripta y almacena en la base de datos
- Luego se puede remover o mantener el archivo físico

### Opción 2: Carga Manual a Través de API

Una vez que la aplicación está corriendo:

```bash
# Obtener token de administrador
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# Usar el token para cargar certificado
curl -X POST http://localhost:3000/certificados-maestro/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "pfxFile=@backend/certs/certificado.pfx" \
  -F "password=tu_contraseña_pfx" \
  -F "certificado_identificador=20123456789"
```

### Opción 3: Carga Manual Mediante Script

Si necesitas migrar certificados adicionales después:

```typescript
// En tu código, inyecta CertificadoMaestroService
constructor(private certificadoMaestroService: CertificadoMaestroService) {}

// Y ejecuta:
await this.certificadoMaestroService.cargarCertificadoDesdeArchivo(
  'ruta/al/certificado.pfx',
  'contraseña_pfx',
  'identificador_opcional'
);
```

## Flujo de Autenticación con AFIP

### Antes (Con Archivo)
```
Solicitud → AfipService → Lee archivo del disco → Extrae credenciales → Autentica con AFIP
```

### Después (Con BD)
```
Solicitud → AfipService → Lee de BD (desencriptado) → Extrae credenciales → Autentica con AFIP
                              ↓
                        (Si falla BD)
                              ↓
                        Fallback a archivo
```

## Verificación del Certificado Cargado

Obtener información del certificado (requiere ser administrador):

```bash
curl -X GET http://localhost:3000/certificados-maestro/info \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Respuesta exitosa:
```json
{
  "existe": true,
  "id": "AFIP_PRINCIPAL",
  "certificado_identificador": "20123456789",
  "metadata": {
    "subject": "CN=SERSA",
    "issuer": "CN=AFIP Root",
    "validFrom": "2024-01-01T00:00:00.000Z",
    "validTo": "2025-01-01T00:00:00.000Z",
    "thumbprint": "a1b2c3d4e5f6..."
  },
  "activo": true,
  "uploaded_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z"
}
```

## Seguridad

### Características de Seguridad Implementadas

1. **Encriptación AES-256-CBC**
   - Clave derivada de variable de entorno
   - IV aleatorio para cada encriptación
   - No se almacenan contraseñas en texto plano

2. **Acceso Restringido**
   - Solo administradores pueden cargar certificados
   - Token JWT requerido para endpoints
   - Contraseña nunca se retorna en respuestas API

3. **Validación de Certificados**
   - Se valida que sea un archivo .pfx válido
   - Se verifica que la contraseña sea correcta
   - Se extrae información del certificado al cargar

4. **Auditoría**
   - Se registran timestamps de carga y actualización
   - Se almacenan metadatos del certificado
   - Se pueden agregar logs de acceso

## Troubleshooting

### Error: "Certificado maestro no configurado"

**Causa:** No hay certificado en BD y `USAR_BD_PARA_CERTIFICADO=true`

**Solución:**
1. Cargar el certificado mediante el endpoint `/certificados-maestro/upload`
2. O ejecutar la migración automática verificando que el archivo existe

### Error: "No se pudo procesar el certificado PFX"

**Causa:** Contraseña incorrecta o archivo dañado

**Solución:**
1. Verificar que la contraseña sea correcta
2. Probar el archivo con: `openssl pkcs12 -in certificado.pfx -passin pass:contraseña`
3. Intentar recargar el certificado

### Error: "ENCRYPTION_KEY no configurada"

**Causa:** Variable de entorno no establecida

**Solución:**
1. Generar una clave con `openssl rand -hex 32`
2. Establecer en `.env`: `ENCRYPTION_KEY=tu_clave`
3. Reiniciar la aplicación

### La migración no ocurrió automáticamente

**Verificar:**
1. `USAR_BD_PARA_CERTIFICADO=true` está configurado
2. El archivo `AFIP_CERT_PATH` existe
3. La contraseña `AFIP_KEY_PASSWORD` es correcta
4. La base de datos está disponible
5. Revisar logs de la aplicación para errores

## Mantenimiento

### Actualizar el Certificado

Para actualizar el certificado cuando caduque:

1. Obtener el nuevo certificado .pfx
2. Hacer POST a `/certificados-maestro/upload` con el nuevo archivo
3. El sistema reemplazará automáticamente el anterior

### Backup del Certificado

Para hacer backup del certificado desde BD:

```sql
-- Descargar el certificado encriptado
SELECT pfx_data FROM certificados_maestro WHERE id = 'AFIP_PRINCIPAL';

-- Exportar a archivo (desde cliente)
\copy (SELECT pfx_data FROM certificados_maestro WHERE id = 'AFIP_PRINCIPAL') TO 'backup_certificado.bin' WITH (FORMAT CSV);
```

**IMPORTANTE:** La clave de encriptación (`ENCRYPTION_KEY`) también debe ser backup-eada de forma segura en otro lugar.

## Rollback (Volver a Archivo)

Si necesitas volver a usar archivos:

1. Establecer `USAR_BD_PARA_CERTIFICADO=false`
2. Asegurarse de que el archivo existe en `AFIP_CERT_PATH`
3. Reiniciar la aplicación

## Próximos Pasos

1. **Generar clave de encriptación** con los comandos anteriores
2. **Configurar variables de entorno** (.env)
3. **Iniciar la aplicación** (migración automática ocurrirá)
4. **Verificar** con `GET /certificados-maestro/info`
5. **(Opcional) Remover** archivo físico después de verificar que funciona

## Soporte

Si encuentras problemas, revisa:
- Los logs de la aplicación (`[AFIP-loginWsaa]`, `[AppInitializerService]`)
- La tabla `certificados_maestro` en la base de datos
- Las variables de entorno están configuradas correctamente

---

**Última actualización:** Diciembre 2025

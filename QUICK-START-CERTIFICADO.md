# 🚀 Guía Rápida - Certificado .PFX en Base de Datos

## ⚡ TL;DR (Muy Rapido)

```bash
# 1. Generar clave
node backend/scripts/generate-encryption-key.js

# 2. Configurar .env
ENCRYPTION_KEY=<resultado_del_paso_1>
USAR_BD_PARA_CERTIFICADO=true

# 3. Iniciar
npm start
```

✅ La migración ocurre automáticamente.

---

## 🔑 Generar Clave de Encriptación

### Linux/macOS
```bash
openssl rand -hex 32
```

### Windows PowerShell
```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Node.js (cualquier SO)
```bash
node backend/scripts/generate-encryption-key.js
```

---

## 📝 Variables de Entorno Necesarias

```env
# ENCRIPTACIÓN (Nueva - REQUERIDA)
ENCRYPTION_KEY=<32_bytes_en_hexadecimal>

# CERTIFICADO (Nueva - default true)
USAR_BD_PARA_CERTIFICADO=true

# AFIP (Existentes - para migración inicial)
AFIP_CUIT=20123456789
AFIP_FABRICANTE=SE
AFIP_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
AFIP_WSCERT_WSDL=https://servicios1.afip.gov.ar/wscert/service
AFIP_CERT_PATH=backend/certs/certificado.pfx
AFIP_KEY_PASSWORD=contraseña_actual
AFIP_ROOT_PATH=backend/certs/Root_RTI.txt
```

---

## 🔌 Endpoints de API

### Cargar Certificado
```bash
curl -X POST http://localhost:3000/certificados-maestro/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "pfxFile=@certificado.pfx" \
  -F "password=contraseña"
```

### Ver Información
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/certificados-maestro/info
```

**Nota:** Solo administradores pueden acceder.

---

## 📊 Tabla en BD

```sql
SELECT * FROM certificados_maestro;
```

```
id              | AFIP_PRINCIPAL
pfx_data        | [bytes encriptados]
password_encriptada | [encriptada]
metadata        | {"subject":"...", "issuer":"..."}
activo          | true
uploaded_at     | 2025-01-15 10:30:00
```

---

## 🔧 Configuración Detallada

### Opción 1: Usar BD (Recomendado)
```env
USAR_BD_PARA_CERTIFICADO=true
```
- Lee de PostgreSQL
- Fallback automático a archivo si falla
- Encriptado en tránsito y en reposo

### Opción 2: Usar Archivo (Legacy)
```env
USAR_BD_PARA_CERTIFICADO=false
```
- Lee de `backend/certs/certificado.pfx`
- Antigua forma, no recomendado

---

## 🔐 Seguridad

### Implementado
✅ AES-256-CBC encryption
✅ IV aleatorio
✅ Acceso solo admin
✅ Contraseña encriptada
✅ Sin exposición de datos sensibles

### Precauciones
- 🔒 Guardar `ENCRYPTION_KEY` de forma segura
- 🔒 Hacer backup en lugar separado
- 🔒 No compartir la clave
- 🔒 Auditar accesos regularmente

---

## 📁 Archivos Clave

```
backend/
  src/
    certificados/
      certificado-maestro.service.ts     # Lógica principal
      certificado-maestro.controller.ts  # API endpoints
      entities/
        certificado-maestro.entity.ts    # Tabla BD
      dto/
        certificado-maestro.dto.ts       # DTOs
    
    common/
      encryption.service.ts               # Encriptación
      app-initializer.service.ts          # Migración automática
      certificado-migration.service.ts    # Migración lógica
    
    afip/
      afip.service.ts                     # Lee de BD/archivo

  scripts/
    generate-encryption-key.js             # Generar clave
    generate-encryption-key.sh
    Generate-EncryptionKey.ps1
```

---

## 🐛 Troubleshooting Rápido

### Error: "Certificado maestro no encontrado"
```bash
# Verificar que existe el archivo
ls backend/certs/certificado.pfx

# Revisar logs
npm start
# Buscar: "[CertificadoMigrationService]"
```

### Error: "ENCRYPTION_KEY no configurada"
```bash
# Generar y copiar
node backend/scripts/generate-encryption-key.js

# Agregar a .env
ENCRYPTION_KEY=<resultado>
```

### Error: "Contraseña incorrecta"
```bash
# Verificar contraseña
openssl pkcs12 -in backend/certs/certificado.pfx -passin pass:CONTRASEÑA
```

---

## ✅ Verificación

### 1. Compilación
```bash
npm run build
# Debe terminar sin errores
```

### 2. Migración
```bash
npm start
# Buscar en logs: "[CertificadoMigrationService] Certificado migrado"
```

### 3. API
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/certificados-maestro/info
# Debe retornar información del certificado
```

### 4. Generación de Certificados
```bash
# POST /certificados/generar debe funcionar igual que antes
```

---

## 📚 Documentación Completa

Archivos con información detallada:

| Archivo | Contenido |
|---------|----------|
| CERTIFICADO-BD-SETUP.md | Guía completa de instalación |
| CERTIFICADO-PFX-IMPLEMENTACION.md | Resumen técnico |
| IMPLEMENTACION-CHECKLIST.md | Checklist de implementación |
| IMPLEMENTACION-FINAL.md | Resumen final |

---

## 🎯 Flujo Típico

```
1. Generar ENCRYPTION_KEY
   ↓
2. Configurar .env
   ↓
3. npm start
   ↓
4. Migración automática ✓
   ↓
5. Verificar con GET /info ✓
   ↓
6. Listo para usar ✓
```

---

## 💡 Tips

- **Cambiar certificado:** POST `/certificados-maestro/upload` con nuevo archivo
- **Actualizar clave:** SI cambia `ENCRYPTION_KEY`, los datos existentes se pierden
- **Backup:** Exportar tabla + guardar `ENCRYPTION_KEY`
- **Fallback:** Si BD no disponible, automáticamente lee archivo

---

## 🔗 Enlaces Útiles

```
Scripts:
  - backend/scripts/generate-encryption-key.js
  - backend/scripts/generate-encryption-key.sh
  - backend/scripts/Generate-EncryptionKey.ps1

Ejemplos:
  - backend/.env.example.certificado-bd

Documentación:
  - CERTIFICADO-BD-SETUP.md
  - CERTIFICADO-PFX-IMPLEMENTACION.md
```

---

**Última actualización:** Diciembre 2025
**Versión:** 1.0
**Estado:** ✅ Listo para usar

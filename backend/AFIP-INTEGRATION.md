# Integración AFIP - SERSA

## 📋 Descripción

Esta documentación describe la integración completa de los servicios AFIP en el backend de SERSA, basada en los scripts existentes `wsaa.js` y `wscert.js`.

## 🔧 Servicios Integrados

### 1. AfipService (`src/afip/afip.service.ts`)
- **loginWsaa()**: Autenticación con WSAA usando certificados PFX
- **renovarCertificado()**: Descarga de certificados CRS desde AFIP
- **isTokenValid()**: Validación de tokens JWT de AFIP
- **getCertificadosDisponibles()**: Mock de certificados disponibles

### 2. CertificadosController (`src/certificados/certificados.controller.ts`)
- **GET /certificados**: Lista certificados disponibles
- **POST /certificados/descargar**: Descarga certificado desde AFIP
- **GET /certificados/preview/:id**: Vista previa con metadata
- **GET /certificados/test-afip-connection**: Test de conexión (admins)

### 3. DescargasService (`src/certificados/descargas.service.ts`)
- **registrarDescarga()**: Registro de descargas en BD
- **contarDescargasPendientes()**: Control de límites por usuario
- **updateEstadoDescarga()**: Cambio de estados (Pendiente → Facturado → Cobrado)

## 📁 Estructura de Archivos

```
backend/
├── src/
│   ├── afip/
│   │   └── afip.service.ts          # Servicio principal AFIP
│   ├── certificados/
│   │   ├── certificados.controller.ts # Controlador REST
│   │   ├── descargas.service.ts     # Gestión de descargas
│   │   └── dto/                     # DTOs de descarga
│   ├── config/
│   │   └── afip.config.ts          # Configuración AFIP
│   └── entities/
│       ├── descarga.entity.ts       # Entidad de descargas
│       └── auditoria.entity.ts      # Auditoría
├── certs/                           # Certificados AFIP
│   ├── certificado.pfx             # Certificado PFX (NO incluido)
│   ├── Root_RTI.txt                # Certificado raíz RTI
│   └── pwrCst.txt                  # Contraseña del PFX
```

## ⚙️ Configuración

### Variables de Entorno (.env)
```env
# AFIP Configuration
AFIP_CUIT=20123456789
AFIP_FABRICANTE=MI_FABRICANTE
AFIP_WSAA_URL=https://wsaahomo.afip.gov.ar/ws/services/LoginCms
AFIP_WSCERT_URL=https://wswhomo.afip.gov.ar/wshab/service.asmx?wsdl
AFIP_CERT_PATH=./certs/certificado.pfx
AFIP_KEY_PASSWORD=Panama8523
AFIP_ROOT_PATH=./certs/Root_RTI.txt
```

### Certificados Requeridos

1. **certificado.pfx**: Certificado digital AFIP (solicitar a AFIP)
2. **Root_RTI.txt**: Certificado raíz RTI (incluido)
3. **pwrCst.txt**: Archivo con contraseña del PFX

## 🚀 Uso del Sistema

### 1. Flujo de Descarga de Certificado

```typescript
// Frontend → Backend
POST /api/certificados/descargar
{
  "controladorId": "CTRL001",
  "marca": "SESHIA", 
  "modelo": "ABC123",
  "numeroSerie": "0000001371"
}

// Proceso interno:
// 1. Validar límite de descargas pendientes
// 2. Login WSAA → obtener token/sign
// 3. Llamar wsCert → renovarCertificado
// 4. Construir archivo PEM completo
// 5. Registrar descarga en BD
// 6. Retornar archivo PEM al cliente
```

### 2. Estados de Descarga

```
PENDIENTE_FACTURAR → FACTURADO → COBRADO
       ↑                ↑           ↑
  (automático)    (mayorista)   (admin)
```

### 3. Control de Límites

```typescript
// Verificación antes de descarga
if (descargasPendientes >= user.limiteDescargas) {
  throw new BadRequestException('Límite alcanzado');
}

// Advertencia al 80%
if ((pendientes / limite) >= 0.8) {
  logger.warn('Usuario cerca del límite');
}
```

## 📊 Formato de Certificado Generado

### Nomenclatura
```
{MARCA}{NUMERO_SERIE}-{YYYY-MM-DD}.pem
Ejemplo: SESHIA0000001371-2025-08-22.pem
```

### Estructura PEM
```pem
-----BEGIN CMS-----
{Root_RTI_Certificate_Base64}
-----END CMS-----
-----BEGIN CERTIFICATE-----
{Cadena_Certificacion_1_Base64}
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
{Certificado_Principal_Base64}
-----END CERTIFICATE-----
```

## 🔍 Monitoreo y Debugging

### Logs Importantes
```typescript
// Servicio AFIP
[AfipService] Iniciando proceso de login con AFIP...
[AfipService] Login exitoso. Token y Sign obtenidos.
[AfipService] Certificado generado exitosamente: SESHIA0000001371-2025-08-22.pem

// Controlador
[CertificadosController] Usuario 123 solicita descarga
[CertificadosController] Descarga registrada con ID: uuid-descarga
```

### Test de Conexión
```bash
GET /api/certificados/test-afip-connection
# Respuesta exitosa:
{
  "status": "success",
  "connection": "OK", 
  "token_valid": true,
  "expiration": "2024-01-15T12:00:00Z"
}
```

## 🚨 Manejo de Errores

### Errores Comunes

1. **Certificado PFX no encontrado**
```
Error: Archivo PFX no encontrado: ./certs/certificado.pfx
Solución: Colocar certificado AFIP en la ruta especificada
```

2. **Contraseña PFX incorrecta**
```  
Error: No se pudo extraer certificado o clave del PFX
Solución: Verificar contraseña en AFIP_KEY_PASSWORD
```

3. **Error de conexión WSAA**
```
Error en login WSAA: Network timeout
Solución: Verificar conectividad y URLs de servicios AFIP
```

4. **Token AFIP expirado**
```
Error: Token WSAA expirado
Solución: El sistema reintenta automáticamente el login
```

## 🔐 Seguridad

### Buenas Prácticas Implementadas

1. **Certificados seguros**: PFX con contraseña robusta
2. **Timeouts configurables**: Evitar conexiones colgadas  
3. **Logs enmascarados**: Tokens/passwords no aparecen en logs
4. **Validación de entrada**: DTOs con class-validator
5. **Auditoría completa**: Registro de todas las operaciones

### Archivos Sensibles
```bash
# NO incluir en Git:
/certs/certificado.pfx
/certs/pwrCst.txt

# Incluir en .gitignore:
certs/*.pfx
certs/pwrCst.txt
```

## 📈 Métricas y Monitoreo

### Endpoints de Estado
```typescript
GET /api/descargas/estadisticas
// Retorna:
{
  "totalDescargas": 1250,
  "descargasHoy": 45, 
  "pendientesFacturar": 120,
  "facturadas": 800,
  "cobradas": 330
}
```

### Auditoría de Operaciones
```typescript
GET /api/auditoria?accion=DOWNLOAD_CERTIFICATE
// Filtra todas las descargas para auditoría
```

## 🛠️ Troubleshooting

### Comandos Útiles

```bash
# Verificar certificados
openssl pkcs12 -info -in ./certs/certificado.pfx -nokeys

# Test manual de conexión
curl -X GET http://localhost:3001/api/certificados/test-afip-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Logs de aplicación  
tail -f logs/application.log | grep -i afip
```

### Problemas Frecuentes

1. **Certificado expirado**: Renovar certificado con AFIP
2. **Horario AFIP**: Servicios no disponibles fuera de horario comercial
3. **Rate limiting**: AFIP limita requests por minuto
4. **Formato PFX**: Verificar formato y versión del certificado

## 📞 Soporte

Para problemas con la integración AFIP:

1. **Verificar configuración** en variables de entorno
2. **Revisar logs** de aplicación y errores
3. **Probar conexión** con endpoint de test
4. **Consultar documentación** oficial de AFIP
5. **Contactar soporte técnico** con logs específicos

---

**Última actualización**: 2024-01-15  
**Versión**: 1.0.0  
**Autor**: SERSA Development Team
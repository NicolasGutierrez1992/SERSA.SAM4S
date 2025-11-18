# 🔧 Instalación de Dependencias SERSA

## 📋 Estado Actual
El proyecto está configurado con **versiones simplificadas** de los servicios para permitir desarrollo sin todas las dependencias instaladas.

## 🚀 Activar Funcionalidad Completa

### 1. Instalar Dependencias Backend
```bash
cd backend
npm install @nestjs/typeorm @nestjs/jwt @nestjs/passport typeorm pg bcrypt passport passport-jwt passport-local jsonwebtoken node-forge soap helmet @nestjs/throttler
npm install --save-dev @types/bcrypt @types/passport-jwt @types/passport-local @types/jsonwebtoken
```

### 2. Instalar Dependencias Frontend
```bash
cd frontend
npm install @tanstack/react-query @hookform/resolvers react-hook-form zod date-fns recharts tailwindcss-animate
```

### 3. Activar Servicios Reales

#### Backend - Reemplazar archivos simplificados:
```bash
# Reemplazar servicios MOCK por versiones reales
mv src/afip/afip.service.simplified.ts src/afip/afip.service.ts
mv src/certificados/certificados.service.simplified.ts src/certificados/certificados.service.ts

# Descomentar decoradores TypeORM en entities/
# Descomentar imports TypeORM en servicios
```

#### Frontend - Descomentar providers:
```bash
# En src/pages/_app.tsx descomentar:
# - QueryClientProvider
# - AuthProvider
```

## 📊 Funcionalidades por Estado

### ✅ **Funcional Actualmente (MOCK)**
- ✅ Estructura completa del proyecto
- ✅ Endpoints REST documentados con Swagger
- ✅ Sistema de autenticación básico
- ✅ Generación de certificados MOCK
- ✅ Frontend con páginas principales
- ✅ Validaciones de DTOs
- ✅ Sistema de auditoría (logs)

### 🔄 **Requiere Dependencias Instaladas**
- 🔄 Conexión real a PostgreSQL
- 🔄 Persistencia de datos (TypeORM)
- 🔄 JWT real con refresh tokens
- 🔄 Integración AFIP real (WSAA/WSCERT)
- 🔄 Hash de contraseñas con bcrypt
- 🔄 Manejo de formularios avanzado
- 🔄 Gráficos y reportes

## 🎯 Scripts de Migración

### Migrar Backend a Producción
```bash
# 1. Instalar dependencias
npm run install:backend:full

# 2. Activar TypeORM
npm run activate:typeorm

# 3. Configurar AFIP
npm run setup:afip
```

### Migrar Frontend a Producción
```bash
# 1. Instalar dependencias
npm run install:frontend:full

# 2. Activar providers
npm run activate:providers
```

## 🔐 Configuración AFIP Real

### Obtener Certificados
1. **Registrarse como fabricante** en AFIP
2. **Solicitar certificado digital** (.pfx)
3. **Colocar en `backend/certs/`**
4. **Configurar variables .env**:
```env
AFIP_CUIT=20123456789
AFIP_FABRICANTE=SERSA
AFIP_CERT_PATH=./certs/sersa_certificate.pfx
AFIP_KEY_PASSWORD=tu_password_real
```

### URLs de Producción
```env
# Cambiar de homologación a producción
AFIP_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
AFIP_WSCERT_URL=https://certificado.afip.gov.ar/ws/services/CertificadoService
```

## 📋 Checklist de Migración

### Backend
- [ ] Instalar TypeORM y dependencias de BD
- [ ] Instalar JWT y Passport
- [ ] Instalar dependencias AFIP (soap, node-forge)
- [ ] Configurar conexión PostgreSQL real
- [ ] Obtener certificados AFIP reales
- [ ] Descomentar decoradores en entities
- [ ] Activar repositorios en servicios
- [ ] Configurar variables de entorno de producción

### Frontend
- [ ] Instalar React Query
- [ ] Instalar librerías de formularios (react-hook-form, zod)
- [ ] Instalar librerías de gráficos (recharts)
- [ ] Activar AuthProvider
- [ ] Activar QueryClientProvider
- [ ] Configurar variables de entorno
- [ ] Probar flujos completos

### Base de Datos
- [ ] Crear base de datos `db_sersa`
- [ ] Ejecutar script SQL existente
- [ ] Configurar usuario `s3rs4`
- [ ] Verificar permisos
- [ ] Crear usuario administrador inicial

## 🧪 Testing Post-Migración

### Backend
```bash
# Verificar conexión BD
npm run test:db

# Verificar AFIP
npm run test:afip

# Tests unitarios
npm run test

# Tests e2e
npm run test:e2e
```

### Frontend
```bash
# Verificar componentes
npm run test

# Verificar build
npm run build

# Verificar tipos
npm run type-check
```

## 🚨 Troubleshooting

### Error: TypeORM no conecta
```bash
# Verificar PostgreSQL activo
pg_isready -h localhost -p 5432

# Verificar credenciales en .env
# Verificar que la BD existe
```

### Error: AFIP no responde
```bash
# Verificar certificado existe
ls -la backend/certs/

# Verificar configuración .env
# Probar URLs de homologación primero
```

### Error: JWT inválido
```bash
# Verificar JWT_SECRET configurado
# Limpiar localStorage del navegador
# Verificar formato del token
```

---

**¿Necesitas instalar las dependencias ahora?**
Ejecuta: `npm run setup:full` (cuando esté disponible)

O instala manualmente siguiendo esta guía paso a paso.
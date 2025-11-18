# SERSA Backend

Backend de la aplicación SERSA desarrollado con Nest.js, TypeScript y PostgreSQL para la gestión de certificados CRS.

## 🚀 Tecnologías

- **Nest.js 10.x** - Framework de Node.js
- **TypeScript 5.x** - Tipado estático
- **PostgreSQL** - Base de datos principal
- **TypeORM** - ORM para base de datos
- **JWT** - Autenticación y autorización
- **Swagger/OpenAPI** - Documentación de API
- **bcrypt** - Hash de contraseñas
- **class-validator** - Validación de DTOs

## 🏗️ Estructura del Proyecto

```
src/
├── auth/                   # Módulo de autenticación
│   ├── dto/               # DTOs de autenticación
│   ├── guards/            # Guards de autenticación y autorización
│   └── strategies/        # Estrategias de Passport
├── users/                 # Gestión de usuarios
├── certificados/          # Gestión de certificados y descargas
├── auditoria/            # Sistema de auditoría
├── notificaciones/       # Sistema de notificaciones
├── entities/             # Entidades de TypeORM
├── config/               # Configuraciones
├── common/               # Utilidades comunes
│   ├── decorators/       # Decoradores personalizados
│   ├── filters/          # Filtros de excepción
│   └── interceptors/     # Interceptores
└── main.ts               # Punto de entrada
```

## 🛠️ Instalación

### Prerrequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 13

### Configuración

1. **Instalar dependencias**
```bash
npm install
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:

```env
# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=s3rs4
DB_PASSWORD=tu_password
DB_NAME=db_sersa

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura
JWT_EXPIRES_IN=24h

# Otros...
```

3. **Verificar conexión a base de datos**

La base de datos `db_sersa` debe existir y contener las tablas según el script SQL proporcionado.

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Servidor con hot-reload
npm run start:debug        # Servidor con debug

# Producción  
npm run build              # Compilar TypeScript
npm run start:prod         # Servidor de producción

# Testing
npm run test               # Tests unitarios
npm run test:e2e           # Tests end-to-end
npm run test:cov           # Tests con cobertura

# Linting
npm run lint               # Ejecutar ESLint
npm run format             # Formatear con Prettier
```

## 🌐 Endpoints Principales

### Autenticación
- `POST /api/auth/login` - Login con CUIT y contraseña
- `POST /api/auth/change-password` - Cambiar contraseña
- `POST /api/auth/refresh` - Renovar token

### Usuarios
- `GET /api/users` - Listar usuarios (con filtros)
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario
- `GET /api/users/export` - Exportar usuarios a CSV/JSON

### Certificados y Descargas
- `GET /api/certificados` - Listar certificados disponibles
- `POST /api/certificados/descargar` - Descargar certificado
- `GET /api/descargas` - Historial de descargas
- `PUT /api/descargas/:id/estado` - Cambiar estado de descarga

### Auditoría
- `GET /api/auditoria` - Consultar logs de auditoría

## 🔐 Autenticación y Autorización

### Roles de Usuario

1. **Administrador (1)** - Acceso completo al sistema
2. **Mayorista (2)** - Gestión de distribuidores y certificados
3. **Distribuidor (3)** - Descarga de certificados
4. **Facturación (4)** - (Futuro) Gestión de facturación

### Flujo de Autenticación

1. Login con CUIT (11 dígitos) y contraseña
2. Sistema devuelve JWT token
3. Token debe incluirse en header: `Authorization: Bearer <token>`
4. Cambio obligatorio de contraseña en primer acceso

### Política de Contraseñas

- Mínimo 10 caracteres
- Al menos 1 mayúscula
- Al menos 1 minúscula  
- Al menos 1 número
- Al menos 1 carácter especial (@$!%*?&)

## 📊 Control de Límites

Cada usuario tiene un `limite_descargas` que controla cuántas descargas pueden tener en estado "Pendiente de Facturar" simultáneamente.

### Flujo de Estados

1. **Descarga** → Estado inicial: "Pendiente de Facturar"
2. **Mayorista/Admin** → Puede cambiar a "Facturado"  
3. **Admin** → Puede cambiar a "Cobrado"

### Notificaciones

- Al 80% del límite → Notificación de advertencia
- Al 100% del límite → Bloqueo de nuevas descargas

## 🔍 Sistema de Auditoría

Todas las acciones administrativas quedan registradas:

- **Actor**: Usuario que realizó la acción
- **Acción**: Tipo de operación (CREATE_USER, UPDATE_DOWNLOAD, etc.)
- **Objetivo**: Entidad afectada
- **Antes/Después**: Estado previo y posterior
- **IP y Timestamp**: Metadatos de la operación

## 📈 Métricas y Reportes

### Métricas Disponibles
- Descargas por día/semana/mes
- Top mayoristas por volumen
- Usuarios con más descargas pendientes
- Estados de certificados

### Exportación
- Reportes en formato XLS
- Filtros por fechas, usuarios, estados
- Programación de reportes automáticos

## 🧪 Testing

### Tests Unitarios
```bash
npm run test
```

### Tests E2E
```bash
npm run test:e2e
```

### Cobertura (objetivo: ≥80%)
```bash
npm run test:cov
```

## 📋 Validaciones

### CUIT
- Exactamente 11 dígitos numéricos
- Validación de formato (sin guiones)

### Estados de Descarga
- `Pendiente de Facturar` (inicial)
- `Facturado` (mayorista/admin)
- `Cobrado` (solo admin)

### Límites
- Descargas pendientes: 1-100
- Usuarios por página: 1-100

## 🚀 Despliegue

### Desarrollo
```bash
npm run start:dev
```

### Producción
```bash
npm run build
npm run start:prod
```

### Docker (futuro)
```bash
docker build -t sersa-backend .
docker run -p 3001:3001 sersa-backend
```

## 📚 Documentación API

Una vez iniciado el servidor, la documentación interactiva está disponible en:

- **Swagger UI**: http://localhost:3001/api/docs
- **JSON Schema**: http://localhost:3001/api/docs-json

## 🐛 Solución de Problemas

### Error de Conexión a BD
1. Verificar que PostgreSQL esté ejecutándose
2. Confirmar credenciales en `.env`
3. Verificar que la base `db_sersa` exista

### Error de Token JWT
1. Verificar que `JWT_SECRET` esté configurado
2. Verificar formato del header: `Authorization: Bearer <token>`

### Error de Permisos
1. Verificar rol del usuario
2. Confirmar que el endpoint requiere el rol correcto

## 📞 Soporte

Para soporte técnico, contactar al equipo de desarrollo o revisar:

- Logs de aplicación
- Documentación de API
- Tests automatizados
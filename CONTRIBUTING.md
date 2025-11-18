# Guía de Contribución

## 🤝 Cómo Contribuir

¡Gracias por tu interés en contribuir al proyecto SERSA! Esta guía te ayudará a entender el proceso.

### 📋 Prerrequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 🚀 Configuración del Entorno de Desarrollo

1. **Fork del repositorio**
```bash
# Hacer fork en GitHub y clonar tu fork
git clone https://github.com/tu-usuario/SERSA.git
cd SERSA
```

2. **Instalar dependencias**
```bash
npm run setup
```

3. **Configurar variables de entorno**
```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend  
cp backend/.env.example backend/.env
```

4. **Ejecutar el proyecto**
```bash
npm run dev
```

### 📝 Flujo de Trabajo

1. **Crear una rama para tu feature/fix**
```bash
git checkout -b feature/nombre-de-tu-feature
```

2. **Hacer commits siguiendo convenciones**
```bash
# Ejemplos de commits
git commit -m "feat: agregar autenticación de usuarios"
git commit -m "fix: corregir validación de formularios"
git commit -m "docs: actualizar README"
```

3. **Ejecutar tests antes de push**
```bash
npm run test
npm run lint
```

4. **Push y crear Pull Request**
```bash
git push origin feature/nombre-de-tu-feature
```

### 📐 Convenciones de Código

#### Frontend (Next.js)
- Usar **TypeScript** para todo el código
- Componentes en **PascalCase**: `UserProfile.tsx`
- Hooks personalizados: `useAuth.ts`
- Estilos con **CSS Modules**
- Usar **ESLint** y **Prettier**

#### Backend (Nest.js)
- Usar **TypeScript** exclusivamente
- Decoradores para **Swagger** en todos los endpoints
- **DTOs** para validación de datos
- **Guards** para autenticación/autorización
- **Interceptors** para logging y transformación

### 🧪 Tests

#### Frontend
```bash
cd frontend
npm run test
npm run test:coverage
```

#### Backend
```bash
cd backend
npm run test
npm run test:e2e
npm run test:cov
```

### 📏 Estándares de Calidad

- **Cobertura de tests**: mínimo 80%
- **ESLint**: sin errores
- **TypeScript**: strict mode habilitado
- **Commits**: seguir [Conventional Commits](https://conventionalcommits.org/)

### 🔄 Tipos de Commits

- `feat`: nueva funcionalidad
- `fix`: corrección de bugs
- `docs`: cambios en documentación
- `style`: cambios de formato (no afectan lógica)
- `refactor`: refactorización de código
- `test`: agregar o modificar tests
- `chore`: tareas de mantenimiento

### 📋 Pull Request Checklist

- [ ] El código compila sin errores
- [ ] Todos los tests pasan
- [ ] Se agregaron tests para nuevas funcionalidades
- [ ] La documentación está actualizada
- [ ] El código sigue las convenciones establecidas
- [ ] Se probó manualmente la funcionalidad

### 🐛 Reportar Bugs

Al reportar un bug, incluye:
- Descripción clara del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Versión de Node.js y navegador
- Screenshots si aplica

### 💡 Solicitar Features

Para solicitar nuevas funcionalidades:
- Describe la necesidad del usuario
- Propón una solución
- Considera el impacto en el rendimiento
- Verifica que no exista una issue similar

### ❓ ¿Necesitas Ayuda?

- Revisa la documentación existente
- Busca en issues cerradas
- Crea una nueva issue con la etiqueta `question`

¡Gracias por contribuir a SERSA! 🚀
# SERSA Frontend

Frontend de la aplicación SERSA desarrollado con Next.js y TypeScript.

## 🚀 Tecnologías

- **Next.js 14** - Framework de React
- **TypeScript 5.x** - Tipado estático
- **React 18** - Librería de UI
- **CSS Modules** - Estilos modulares

## 🏗️ Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
├── pages/              # Páginas de Next.js
├── styles/             # Archivos de estilos
├── utils/              # Utilidades y helpers
├── types/              # Definiciones de tipos TypeScript
├── hooks/              # Custom hooks
└── services/           # Servicios de API
```

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local

# Ejecutar en modo desarrollo
npm run dev
```

## 📝 Scripts Disponibles

- `npm run dev` - Ejecutar servidor de desarrollo
- `npm run build` - Construir para producción
- `npm start` - Ejecutar servidor de producción
- `npm run lint` - Ejecutar linter
- `npm run type-check` - Verificar tipos TypeScript

## 🌐 URLs

- **Desarrollo**: http://localhost:3000
- **API Backend**: http://localhost:3001/api

## 📁 Convenciones

- Usar **PascalCase** para componentes
- Usar **camelCase** para funciones y variables
- Usar **kebab-case** para archivos y carpetas
- Usar **CSS Modules** para estilos de componentes
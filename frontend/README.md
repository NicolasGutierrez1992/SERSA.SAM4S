# SERSA Frontend

Frontend de SERSA para la gestión de certificados CRS (SAM4S), construido con Next.js 15 (App Router) y TypeScript.

## 🚀 Tecnologías

- **Next.js 15** — App Router (no `pages/`)
- **TypeScript 5.x**
- **React 18**
- **Tailwind CSS** — estilos utilitarios
- **Ant Design (antd)** — tablas, formularios, tabs, date pickers
- **axios** — cliente HTTP (`src/lib/api.ts`), con cookies + fallback `Authorization: Bearer` y protección CSRF integrada
- **Playwright** — pruebas E2E (`e2e/`)

## 🏗️ Estructura del proyecto

```
src/
├── app/                     # Rutas (App Router) — cada carpeta = una ruta
│   ├── login/
│   ├── certificados/        # Descarga de certificados + historial
│   ├── usuarios/            # Gestión de usuarios y créditos prepago
│   └── dashboard/
│       ├── page.tsx         # Panel principal, tarjetas por rol
│       ├── auditoria/       # Auditoría — solo Admin (historial + métricas)
│       └── cert-archivos/   # Configuración de certificados — solo Admin
├── components/
│   └── charts/              # Gráficos propios en SVG (BarList, AreaTrend) — sin librería de charts
├── lib/api.ts                # Cliente axios central + helpers de cookies/auth
└── services/                 # Wrapper liviano usado por AuthContext
e2e/                          # Specs de Playwright
```

## 🔐 Roles

1. Administrador — acceso completo, incluida Auditoría
2. Mayorista — gestiona sus distribuidores y certificados
3. Distribuidor — descarga certificados
4. Facturación — gestión de facturación de descargas
5. Técnico — soporte interno, sin límites de descarga

## 🛠️ Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

Alternativa recomendada para desarrollo local completo (incluye backend + Postgres): correr `docker compose up` desde la raíz del repo — ver el README raíz.

### Variables de entorno (`.env.local`)

Ver `.env.example` para el detalle. Como mínimo se necesita `NEXT_PUBLIC_API_URL` apuntando al backend.

## 📝 Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo (localhost:3000)
npm run build        # Build de producción
npm start             # Servidor de producción (post-build)
npm run lint          # ESLint
npm run test:e2e      # Suite E2E de Playwright (requiere el stack corriendo)
npm run test:e2e:ui   # Playwright en modo UI interactivo
```

## 🧪 Tests E2E

`e2e/` usa Playwright contra un stack real corriendo en `http://localhost:3010` (el puerto expuesto por `docker compose up` en la raíz). Algunos tests requieren credenciales de prueba vía variables de entorno — si no están seteadas, esos tests se saltean automáticamente:

```bash
E2E_ADMIN_CUIT=... E2E_ADMIN_PASSWORD=... \
E2E_DISTRIBUIDOR_CUIT=... E2E_DISTRIBUIDOR_PASSWORD=... \
npm run test:e2e
```

En CI (`.github/workflows/ci.yml`), estas credenciales se siembran automáticamente en una base de datos descartable — nunca contra datos reales.

## 🌐 URLs

- Desarrollo: http://localhost:3000 (o `:3010` vía Docker Compose)
- API Backend: http://localhost:3001/api (o `:3011` vía Docker Compose)

## 📁 Convenciones

- **PascalCase** para componentes
- **camelCase** para funciones y variables
- **kebab-case** para archivos y carpetas de rutas
- Estilos con clases de Tailwind directamente en el JSX; Ant Design para componentes de datos (tablas, tabs, date pickers)
